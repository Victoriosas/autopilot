import { randomUUID } from 'node:crypto';
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

const MP_API = 'https://api.mercadopago.com';

function getDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('PAYMENT_DATABASE_NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function accessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('MERCADOPAGO_NOT_CONFIGURED');
  return token;
}

function publicAppUrl() {
  const raw = process.env.PUBLIC_APP_URL?.trim();
  if (!raw) throw new Error('PUBLIC_APP_URL_REQUIRED');
  const parsed = new URL(raw);
  if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('PUBLIC_APP_URL_MUST_USE_HTTPS');
  }
  return parsed.toString().replace(/\/$/, '');
}

function storeConfig() {
  const currency = (process.env.STORE_CURRENCY || process.env.VITE_STORE_CURRENCY || 'UYU').toUpperCase();
  const shippingFlat = Math.max(0, Number(process.env.STORE_SHIPPING_FLAT || process.env.VITE_SHIPPING_FLAT || '0') || 0);
  const freeShippingFrom = Math.max(0, Number(process.env.STORE_FREE_SHIPPING_FROM || process.env.VITE_FREE_SHIPPING_FROM || '0') || 0);
  return { currency, shippingFlat, freeShippingFrom };
}

function validateCustomer(value: unknown): Required<Pick<CustomerInput, 'email'>> & CustomerInput {
  const customer = (value || {}) as CustomerInput;
  const email = String(customer.email || '').trim();
  const name = String(customer.fullName || customer.name || '').trim();
  const phone = String(customer.phone || '').trim();
  const address = String(customer.address || '').trim();
  const city = String(customer.city || '').trim();
  const postalCode = String(customer.postalCode || '').trim();
  const country = String(customer.country || '').trim();
  if (!email || !name || !phone || !address || !city || !postalCode || !country) throw new Error('CUSTOMER_FIELDS_REQUIRED');
  return { email, name, fullName: name, phone, address, city, postalCode, country };
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

async function priceCheckout(itemsInput: CheckoutItemInput[]) {
  const db = getDb();
  const ids = [...new Set(itemsInput.map((item) => item.productId))];
  const { data: products, error } = await db.from('products').select('id,title,price,sku,images,status').in('id', ids);
  if (error) throw new Error('PRODUCT_LOOKUP_FAILED');
  if (!products || products.length !== ids.length) throw new Error('PRODUCT_NOT_FOUND');

  const map = new Map(products.map((product: any) => [product.id, product]));
  const items = itemsInput.map((input) => {
    const product: any = map.get(input.productId);
    if (!product || product.status !== 'published') throw new Error('PRODUCT_NOT_AVAILABLE');
    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error('INVALID_PRODUCT_PRICE');
    return {
      productId: product.id,
      title: String(product.title || 'Producto Victoriosa').slice(0, 120),
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

async function createLocalOrder(customer: CustomerInput, priced: Awaited<ReturnType<typeof priceCheckout>>) {
  const orderId = `VIC-MP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error } = await priced.db.from('orders').insert({
    id: orderId,
    order_number: orderId,
    customer_email: customer.email,
    customer_name: customer.fullName || customer.name,
    customer_phone: customer.phone,
    customer_address: customer.address,
    customer_city: customer.city,
    customer_postal_code: customer.postalCode,
    customer_country: customer.country,
    items: priced.items,
    subtotal: priced.subtotal,
    shipping_cost: priced.shipping,
    discount: 0,
    total: priced.total,
    currency: priced.cfg.currency,
    payment_method: 'mercadopago',
    payment_status: 'pending',
    payment_id: null,
    payment_gateway: 'mercadopago',
    status: 'pending_payment',
    tracking_number: '',
    estimated_delivery: '',
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`ORDER_CREATE_FAILED:${error.message}`);
  return orderId;
}

async function audit(eventType: string, entityId: string, values: Record<string, unknown>) {
  try {
    await getDb().from('audit_logs').insert({ event_type: eventType, entity_id: entityId, new_values: values });
  } catch (error) {
    console.warn('Mercado Pago audit write failed:', error);
  }
}

async function fetchMpOrder(orderId: string) {
  const response = await fetch(`${MP_API}/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${accessToken()}`, Accept: 'application/json' },
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`MERCADOPAGO_ORDER_LOOKUP_FAILED:${response.status}`);
  return data;
}

async function reconcileMpOrder(mpOrderId: string) {
  const provider = await fetchMpOrder(mpOrderId);
  const localOrderId = String(provider.external_reference || '').trim();
  if (!localOrderId) throw new Error('MERCADOPAGO_EXTERNAL_REFERENCE_MISSING');

  const db = getDb();
  const { data: local, error } = await db
    .from('orders')
    .select('id,total,currency,payment_method,payment_status')
    .eq('id', localOrderId)
    .single();
  if (error || !local) throw new Error('ORDER_NOT_FOUND');
  if (local.payment_method !== 'mercadopago') throw new Error('ORDER_PROVIDER_MISMATCH');

  const expected = Number(local.total);
  const providerTotal = Number(provider.total_amount);
  const paidTotal = Number(provider.total_paid_amount ?? 0);
  if (!Number.isFinite(providerTotal) || Math.abs(providerTotal - expected) > 0.01) {
    await audit('MERCADOPAGO_AMOUNT_MISMATCH', localOrderId, { mpOrderId, expected, providerTotal, paidTotal });
    throw new Error('MERCADOPAGO_AMOUNT_MISMATCH');
  }

  const processed = provider.status === 'processed' && paidTotal + 0.001 >= expected;
  if (processed && local.payment_status !== 'paid') {
    const { error: updateError } = await db.from('orders').update({
      payment_status: 'paid',
      payment_id: mpOrderId,
      payment_gateway: 'mercadopago',
      status: 'confirmed',
    }).eq('id', localOrderId).eq('payment_method', 'mercadopago');
    if (updateError) throw new Error('ORDER_PAYMENT_UPDATE_FAILED');
    await audit('REVENUE_PAYMENT_COMPLETED', localOrderId, { provider: 'mercadopago', mpOrderId, total: expected, currency: local.currency });
  }

  return {
    orderId: localOrderId,
    providerOrderId: mpOrderId,
    providerStatus: provider.status,
    paymentStatus: processed ? 'paid' : 'pending',
    total: expected,
    currency: local.currency,
  };
}

export function createMercadoPagoRouter(): Router {
  const router = Router();

  router.get('/config', (_req, res) => {
    res.json({
      configured: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() && process.env.PUBLIC_APP_URL?.trim()),
      provider: 'mercadopago',
      checkout: 'pro-orders',
      storeCurrency: storeConfig().currency,
    });
  });

  router.post('/order', async (req, res) => {
    let localOrderId: string | null = null;
    try {
      const customer = validateCustomer(req.body?.customer);
      const requestedItems = validateItems(req.body?.items);
      const priced = await priceCheckout(requestedItems);
      localOrderId = await createLocalOrder(customer, priced);
      const appUrl = publicAppUrl();

      const mpItems = priced.items.map((item) => ({
        title: item.title,
        unit_price: item.price.toFixed(2),
        quantity: item.quantity,
        unit_measure: 'unit',
        total_amount: (item.price * item.quantity).toFixed(2),
      }));
      if (priced.shipping > 0) {
        mpItems.push({
          title: 'Envío',
          unit_price: priced.shipping.toFixed(2),
          quantity: 1,
          unit_measure: 'unit',
          total_amount: priced.shipping.toFixed(2),
        });
      }

      const response = await fetch(`${MP_API}/v1/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          type: 'online',
          processing_mode: 'manual',
          capture_mode: 'automatic_async',
          total_amount: priced.total.toFixed(2),
          external_reference: localOrderId,
          payer: { email: customer.email },
          items: mpItems,
          description: `Pedido Victoriosa ${localOrderId}`,
          config: {
            notification_url: `${appUrl}/api/payments/mercadopago/webhook`,
            online: {
              success_url: `${appUrl}/?payment=success&provider=mercadopago&order=${encodeURIComponent(localOrderId)}`,
              failure_url: `${appUrl}/?payment=failure&provider=mercadopago&order=${encodeURIComponent(localOrderId)}`,
              pending_url: `${appUrl}/?payment=pending&provider=mercadopago&order=${encodeURIComponent(localOrderId)}`,
              auto_return: 'all',
            },
          },
        }),
      });
      const provider: any = await response.json().catch(() => ({}));
      if (!response.ok || !provider.id || !provider.checkout_url) {
        await audit('MERCADOPAGO_ORDER_CREATE_FAILED', localOrderId, { status: response.status, code: provider.code || null });
        return res.status(502).json({ error: 'MERCADOPAGO_ORDER_CREATE_FAILED', orderId: localOrderId });
      }

      await audit('MERCADOPAGO_ORDER_CREATED', localOrderId, { providerOrderId: provider.id, total: priced.total, currency: priced.cfg.currency });
      return res.status(201).json({
        orderId: localOrderId,
        providerOrderId: provider.id,
        checkoutUrl: provider.checkout_url,
        total: priced.total,
        currency: priced.cfg.currency,
      });
    } catch (error: any) {
      const message = String(error?.message || 'MERCADOPAGO_ORDER_FAILED');
      if (localOrderId) await audit('MERCADOPAGO_ORDER_CREATE_FAILED', localOrderId, { error: message });
      const status = message.includes('NOT_CONFIGURED') || message.includes('PUBLIC_APP_URL') ? 503 : 400;
      return res.status(status).json({ error: message, orderId: localOrderId });
    }
  });

  router.post('/webhook', async (req, res) => {
    // The notification is treated only as a hint. Payment truth is fetched from Mercado Pago with the server Access Token.
    const candidate = req.body?.data?.id || req.body?.id || req.query?.['data.id'] || req.query?.id;
    const mpOrderId = typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : '';
    if (!mpOrderId) return res.status(200).json({ received: true, reconciled: false });
    try {
      const result = await reconcileMpOrder(mpOrderId);
      return res.status(200).json({ received: true, reconciled: true, ...result });
    } catch (error: any) {
      console.warn('Mercado Pago webhook reconcile failed:', error?.message || error);
      // Acknowledge notifications so provider retries do not become a denial-of-service loop.
      return res.status(200).json({ received: true, reconciled: false });
    }
  });

  router.post('/reconcile', async (req, res) => {
    try {
      const mpOrderId = typeof req.body?.providerOrderId === 'string' ? req.body.providerOrderId.trim() : '';
      if (!mpOrderId) return res.status(400).json({ error: 'PROVIDER_ORDER_ID_REQUIRED' });
      const result = await reconcileMpOrder(mpOrderId);
      return res.json(result);
    } catch (error: any) {
      return res.status(400).json({ error: String(error?.message || 'MERCADOPAGO_RECONCILE_FAILED') });
    }
  });

  return router;
}
