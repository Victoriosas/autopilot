import { createClient } from '@supabase/supabase-js';
import { Router } from 'express';

interface CheckoutItemInput {
  productId: string;
  quantity: number;
  selectedVariant?: string;
}

interface CustomerInput {
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

let paypalAccessToken: string | null = null;
let paypalTokenExpiry = 0;

function getDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('PAYMENT_DATABASE_NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getPayPalAccessToken() {
  if (paypalAccessToken && Date.now() < paypalTokenExpiry) return paypalAccessToken;
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error('PAYMENT_NOT_CONFIGURED');

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error('PAYPAL_AUTH_FAILED');
  const data = await response.json() as { access_token: string; expires_in: number };
  paypalAccessToken = data.access_token;
  paypalTokenExpiry = Date.now() + Math.max(30, data.expires_in - 60) * 1000;
  return paypalAccessToken;
}

function storeConfig() {
  const currency = (process.env.STORE_CURRENCY || process.env.VITE_STORE_CURRENCY || 'UYU').toUpperCase();
  const shippingFlat = Math.max(0, Number(process.env.STORE_SHIPPING_FLAT || process.env.VITE_SHIPPING_FLAT || '0') || 0);
  const freeShippingFrom = Math.max(0, Number(process.env.STORE_FREE_SHIPPING_FROM || process.env.VITE_FREE_SHIPPING_FROM || '0') || 0);
  const storeToUsdRate = currency === 'USD' ? 1 : Number(process.env.PAYPAL_STORE_TO_USD_RATE || '0');
  return { currency, shippingFlat, freeShippingFrom, storeToUsdRate };
}

function validateCustomer(value: unknown): CustomerInput {
  const customer = (value || {}) as CustomerInput;
  const name = String(customer.fullName || customer.name || '').trim();
  const email = String(customer.email || '').trim();
  const phone = String(customer.phone || '').trim();
  const address = String(customer.address || '').trim();
  const city = String(customer.city || '').trim();
  const postalCode = String(customer.postalCode || '').trim();
  const country = String(customer.country || '').trim();
  if (!name || !email || !phone || !address || !city || !postalCode || !country) {
    throw new Error('CUSTOMER_FIELDS_REQUIRED');
  }
  return { name, fullName: name, email, phone, address, city, postalCode, country };
}

function validateItems(value: unknown): CheckoutItemInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) throw new Error('INVALID_CHECKOUT_ITEMS');
  return value.map((raw) => {
    const item = raw as Partial<CheckoutItemInput>;
    const productId = typeof item.productId === 'string' ? item.productId.trim() : '';
    const quantity = Number(item.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('INVALID_CHECKOUT_ITEM');
    return { productId, quantity, selectedVariant: typeof item.selectedVariant === 'string' ? item.selectedVariant : undefined };
  });
}

async function buildServerOrder(itemsInput: CheckoutItemInput[]) {
  const db = getDb();
  const ids = [...new Set(itemsInput.map((item) => item.productId))];
  const { data: products, error } = await db
    .from('products')
    .select('id,title,price,sku,images,status')
    .in('id', ids);
  if (error) throw new Error('PRODUCT_LOOKUP_FAILED');
  if (!products || products.length !== ids.length) throw new Error('PRODUCT_NOT_FOUND');

  const productMap = new Map(products.map((product: any) => [product.id, product]));
  const items = itemsInput.map((input) => {
    const product: any = productMap.get(input.productId);
    if (!product || product.status !== 'published') throw new Error('PRODUCT_NOT_AVAILABLE');
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error('INVALID_PRODUCT_PRICE');
    return {
      productId: product.id,
      title: String(product.title || 'Producto Victoriosa'),
      price,
      quantity: input.quantity,
      image: Array.isArray(product.images) ? product.images[0] || '' : '',
      selectedVariant: input.selectedVariant,
      sku: String(product.sku || ''),
    };
  });

  const cfg = storeConfig();
  const subtotal = Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
  const shipping = cfg.freeShippingFrom > 0 && subtotal >= cfg.freeShippingFrom ? 0 : cfg.shippingFlat;
  const total = Number((subtotal + shipping).toFixed(2));
  if (total <= 0) throw new Error('INVALID_ORDER_TOTAL');
  return { db, cfg, items, subtotal, shipping, total };
}

async function insertOrder(params: {
  customer: CustomerInput;
  items: any[];
  subtotal: number;
  shipping: number;
  total: number;
  currency: string;
  paymentMethod: 'paypal' | 'bank_transfer';
}) {
  const db = getDb();
  const prefix = params.paymentMethod === 'paypal' ? 'PP' : 'TR';
  const orderId = `VIC-${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const paymentStatus = params.paymentMethod === 'paypal' ? 'pending' : 'pending_verification';
  const row = {
    id: orderId,
    order_number: orderId,
    customer_email: params.customer.email,
    customer_name: params.customer.fullName || params.customer.name,
    customer_phone: params.customer.phone,
    customer_address: params.customer.address,
    customer_city: params.customer.city,
    customer_postal_code: params.customer.postalCode,
    customer_country: params.customer.country,
    items: params.items,
    subtotal: params.subtotal,
    shipping_cost: params.shipping,
    discount: 0,
    total: params.total,
    currency: params.currency,
    payment_method: params.paymentMethod,
    payment_status: paymentStatus,
    payment_id: null,
    payment_gateway: params.paymentMethod === 'paypal' ? 'paypal' : null,
    status: 'pending_payment',
    tracking_number: '',
    estimated_delivery: '',
    created_at: new Date().toISOString(),
  };
  const { error } = await db.from('orders').insert(row);
  if (error) throw new Error(`ORDER_CREATE_FAILED:${error.message}`);
  return orderId;
}

async function audit(eventType: string, entityId: string, values: Record<string, unknown>) {
  try {
    const db = getDb();
    await db.from('audit_logs').insert({ event_type: eventType, entity_id: entityId, new_values: values });
  } catch (error) {
    console.warn('Payment audit write failed:', error);
  }
}

function toUsd(total: number, rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('PAYPAL_STORE_TO_USD_RATE_REQUIRED');
  const usd = Number((total * rate).toFixed(2));
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('INVALID_PAYPAL_TOTAL');
  return usd;
}

async function verifyWebhookSignature(req: any) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_NOT_CONFIGURED');
  const transmissionId = req.header('paypal-transmission-id');
  const transmissionTime = req.header('paypal-transmission-time');
  const transmissionSig = req.header('paypal-transmission-sig');
  const certUrl = req.header('paypal-cert-url');
  const authAlgo = req.header('paypal-auth-algo');
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) return false;

  const token = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: req.body,
    }),
  });
  if (!response.ok) return false;
  const data = await response.json() as { verification_status?: string };
  return data.verification_status === 'SUCCESS';
}

export function createPaymentV2Router(): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    const cfg = storeConfig();
    res.json({
      storeCurrency: cfg.currency,
      paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      paypalCurrency: 'USD',
      paypalConversionConfigured: cfg.currency === 'USD' || cfg.storeToUsdRate > 0,
      transferConfigured: Boolean(process.env.BANK_TRANSFER_PUBLIC_INSTRUCTIONS || process.env.VITE_BANK_TRANSFER_INSTRUCTIONS),
    });
  });

  router.post('/transfer/order', async (req, res) => {
    try {
      const customer = validateCustomer(req.body?.customer);
      const requestedItems = validateItems(req.body?.items);
      const order = await buildServerOrder(requestedItems);
      const orderId = await insertOrder({
        customer,
        items: order.items,
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        currency: order.cfg.currency,
        paymentMethod: 'bank_transfer',
      });
      await audit('REVENUE_TRANSFER_ORDER_CREATED', orderId, { total: order.total, currency: order.cfg.currency, itemCount: order.items.length });
      return res.status(201).json({
        orderId,
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        currency: order.cfg.currency,
        paymentStatus: 'pending_verification',
        instructions: process.env.BANK_TRANSFER_PUBLIC_INSTRUCTIONS || process.env.VITE_BANK_TRANSFER_INSTRUCTIONS || null,
        label: process.env.BANK_TRANSFER_PUBLIC_LABEL || process.env.VITE_BANK_TRANSFER_LABEL || 'Transferencia bancaria',
      });
    } catch (error: any) {
      const message = String(error?.message || 'TRANSFER_ORDER_FAILED');
      return res.status(message.includes('NOT_CONFIGURED') ? 503 : 400).json({ error: message });
    }
  });

  router.post('/paypal/order', async (req, res) => {
    try {
      const customer = validateCustomer(req.body?.customer);
      const requestedItems = validateItems(req.body?.items);
      const order = await buildServerOrder(requestedItems);
      const totalUsd = toUsd(order.total, order.cfg.storeToUsdRate);
      const orderId = await insertOrder({
        customer,
        items: order.items,
        subtotal: order.subtotal,
        shipping: order.shipping,
        total: order.total,
        currency: order.cfg.currency,
        paymentMethod: 'paypal',
      });

      const token = await getPayPalAccessToken();
      const paypalResponse = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: orderId,
            custom_id: orderId,
            amount: { currency_code: 'USD', value: totalUsd.toFixed(2) },
            description: `Victoriosa ${orderId}`,
          }],
          application_context: { brand_name: 'Victoriosa', user_action: 'PAY_NOW' },
        }),
      });
      const paypalData: any = await paypalResponse.json();
      if (!paypalResponse.ok || !paypalData.id) {
        await audit('PAYPAL_ORDER_CREATE_FAILED', orderId, { status: paypalResponse.status });
        return res.status(502).json({ error: 'PAYPAL_ORDER_CREATE_FAILED', orderId });
      }
      await audit('PAYPAL_ORDER_CREATED', orderId, { paypalOrderId: paypalData.id, totalUsd });
      return res.status(201).json({ orderId, paypalOrderId: paypalData.id, total: order.total, currency: order.cfg.currency, totalUsd });
    } catch (error: any) {
      const message = String(error?.message || 'PAYPAL_ORDER_FAILED');
      const status = message.includes('NOT_CONFIGURED') || message.includes('RATE_REQUIRED') ? 503 : 400;
      return res.status(status).json({ error: message });
    }
  });

  router.post('/paypal/capture', async (req, res) => {
    try {
      const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
      const paypalOrderId = typeof req.body?.paypalOrderId === 'string' ? req.body.paypalOrderId.trim() : '';
      if (!orderId || !paypalOrderId) return res.status(400).json({ error: 'ORDER_IDS_REQUIRED' });

      const db = getDb();
      const { data: localOrder, error: lookupError } = await db
        .from('orders')
        .select('id,total,currency,payment_method,payment_status')
        .eq('id', orderId)
        .single();
      if (lookupError || !localOrder) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      if (localOrder.payment_method !== 'paypal' || localOrder.payment_status !== 'pending') {
        return res.status(409).json({ error: 'ORDER_NOT_PAYABLE' });
      }

      const cfg = storeConfig();
      const expectedUsd = toUsd(Number(localOrder.total), cfg.storeToUsdRate);
      const token = await getPayPalAccessToken();
      const captureResponse = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const captureData: any = await captureResponse.json();
      if (!captureResponse.ok || captureData.status !== 'COMPLETED') {
        await audit('PAYMENT_CAPTURE_FAILED', orderId, { paypalOrderId, status: captureData.status || captureResponse.status });
        return res.status(402).json({ error: 'PAYMENT_NOT_COMPLETED' });
      }

      const unit = captureData.purchase_units?.[0];
      const capture = unit?.payments?.captures?.[0];
      const referenceId = unit?.reference_id || unit?.custom_id;
      const capturedValue = Number(capture?.amount?.value);
      const capturedCurrency = capture?.amount?.currency_code;
      if (referenceId !== orderId || capturedCurrency !== 'USD' || !Number.isFinite(capturedValue) || Math.abs(capturedValue - expectedUsd) > 0.01) {
        await audit('PAYMENT_CAPTURE_MISMATCH', orderId, { paypalOrderId, referenceId, capturedValue, capturedCurrency, expectedUsd });
        return res.status(409).json({ error: 'PAYMENT_CAPTURE_MISMATCH' });
      }

      const paymentId = String(capture?.id || paypalOrderId);
      const { error: updateError } = await db
        .from('orders')
        .update({ payment_status: 'paid', payment_id: paymentId, payment_gateway: 'paypal', status: 'confirmed' })
        .eq('id', orderId)
        .eq('payment_status', 'pending');
      if (updateError) throw new Error('ORDER_PAYMENT_UPDATE_FAILED');
      await audit('REVENUE_PAYMENT_COMPLETED', orderId, { paymentId, total: localOrder.total, currency: localOrder.currency, provider: 'paypal' });
      return res.json({ success: true, orderId, paymentId, paymentStatus: 'paid' });
    } catch (error: any) {
      const message = String(error?.message || 'PAYMENT_CAPTURE_FAILED');
      return res.status(message.includes('NOT_CONFIGURED') || message.includes('RATE_REQUIRED') ? 503 : 500).json({ error: message });
    }
  });

  router.post('/paypal/webhook', async (req: any, res) => {
    try {
      const verified = await verifyWebhookSignature(req);
      if (!verified) return res.status(401).json({ error: 'INVALID_PAYPAL_WEBHOOK_SIGNATURE' });
      const eventType = req.body?.event_type;
      const resource = req.body?.resource || {};
      const orderId = resource.custom_id || resource.supplementary_data?.related_ids?.order_id || null;
      if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && resource.custom_id) {
        const db = getDb();
        await db.from('orders').update({
          payment_status: 'paid',
          payment_id: resource.id,
          payment_gateway: 'paypal',
          status: 'confirmed',
        }).eq('id', resource.custom_id).eq('payment_method', 'paypal');
        await audit('PAYPAL_WEBHOOK_PAYMENT_COMPLETED', resource.custom_id, { paymentId: resource.id });
      }
      return res.status(200).json({ received: true, eventType, orderId });
    } catch (error: any) {
      const message = String(error?.message || 'PAYPAL_WEBHOOK_FAILED');
      return res.status(message.includes('NOT_CONFIGURED') ? 503 : 500).json({ error: message });
    }
  });

  return router;
}
