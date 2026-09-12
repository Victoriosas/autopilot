import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Banknote, CheckCircle2, Loader2, Lock, MessageCircle, ShieldCheck, Truck, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiFetch } from '../../lib/api';
import { useApp } from '../../context/AppContext';
import type { Order, OrderCustomer } from '../../types';
import {
  BANK_TRANSFER_INSTRUCTIONS,
  BANK_TRANSFER_LABEL,
  PAYPAL_USD_RATE,
  SALES_WHATSAPP,
  STORE_CURRENCY,
  buildWhatsAppOrderUrl,
  calculateCartTotals,
  createManualTransferOrder,
  createPendingPayPalOrder,
  markPayPalOrderPaid,
  trackRevenueEvent,
} from '../../services/revenue';

interface CheckoutModalProps {
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

type Completion = {
  orderId: string;
  mode: 'paid' | 'pending_verification';
  total: number;
  currency: string;
  message: string;
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onOrderSuccess }) => {
  const { cart, clearCart, showToast } = useApp();
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const paypalButtonsRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRendered = useRef(false);
  const victoriosaOrderIdRef = useRef<string | null>(null);

  const [formData, setFormData] = useState<OrderCustomer>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    province: '',
    country: 'Uruguay',
  });

  const totals = useMemo(() => calculateCartTotals(cart), [cart]);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const isFormValid = Boolean(
    (formData.name || formData.fullName) &&
      formData.email &&
      formData.phone &&
      formData.address &&
      formData.city &&
      formData.postalCode &&
      formData.country,
  );
  const whatsappUrl = useMemo(() => buildWhatsAppOrderUrl(cart, formData), [cart, formData]);
  const paypalAvailableForCurrency = STORE_CURRENCY === 'USD' || PAYPAL_USD_RATE > 0;
  const paypalTotalUsd = STORE_CURRENCY === 'USD' ? totals.total : Number((totals.total * PAYPAL_USD_RATE).toFixed(2));

  useEffect(() => {
    void trackRevenueEvent('checkout_started', {
      value: totals.total,
      currency: totals.currency,
      itemCount,
      channel: 'store',
    });
  }, []);

  useEffect(() => {
    if (!paypalAvailableForCurrency) {
      setPaypalError('PayPal está desactivado hasta configurar VITE_PAYPAL_USD_RATE para la moneda local.');
      return;
    }

    const loadPayPal = async () => {
      try {
        const res = await apiFetch('/api/payments/paypal/config');
        const config = await res.json();
        if (!config.configured || !config.clientId) {
          setPaypalError('PayPal no está configurado. Podés usar transferencia o WhatsApp.');
          return;
        }

        if (document.querySelector('script[data-victoriosa-paypal="true"]')) {
          setPaypalLoaded(Boolean(window.paypal));
          return;
        }

        const script = document.createElement('script');
        script.dataset.victoriosaPaypal = 'true';
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=USD&disable-funding=credit,card,venmo`;
        script.async = true;
        script.onload = () => setPaypalLoaded(true);
        script.onerror = () => setPaypalError('No se pudo cargar PayPal.');
        document.head.appendChild(script);
      } catch {
        setPaypalError('No se pudo verificar PayPal.');
      }
    };

    void loadPayPal();
  }, [paypalAvailableForCurrency]);

  useEffect(() => {
    if (!paypalLoaded || !window.paypal || paypalButtonsRendered.current || !isFormValid || !paypalButtonsRef.current) return;

    paypalButtonsRendered.current = true;
    window.paypal
      .Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 48 },
        createOrder: async () => {
          try {
            setPaying(true);
            const localOrder = await createPendingPayPalOrder(cart, formData);
            victoriosaOrderIdRef.current = localOrder.orderId;

            const res = await apiFetch('/api/payments/paypal/order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: localOrder.orderId,
                total: paypalTotalUsd,
                currency: 'USD',
                items: localOrder.items,
              }),
            });
            const data = await res.json();
            if (!res.ok || !data.paypalOrderId) throw new Error(data.message || 'No se pudo crear el pago PayPal.');
            return data.paypalOrderId;
          } catch (error: any) {
            setPaying(false);
            showToast(error.message || 'Error al iniciar PayPal.', 'error');
            return undefined;
          }
        },
        onApprove: async (data: any) => {
          const orderId = victoriosaOrderIdRef.current;
          if (!orderId) {
            showToast('No se encontró el pedido local asociado.', 'error');
            return;
          }

          try {
            const captureRes = await apiFetch('/api/payments/paypal/capture', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paypalOrderId: data.orderID, orderId }),
            });
            const captureData = await captureRes.json();
            if (!captureRes.ok || !captureData.success || !captureData.paymentId) {
              throw new Error(captureData.error || 'PayPal no confirmó el pago.');
            }

            await markPayPalOrderPaid(orderId, captureData.paymentId);
            await trackRevenueEvent('payment_completed', {
              orderId,
              value: totals.total,
              currency: totals.currency,
              itemCount,
              channel: 'paypal',
            });

            const order = {
              id: orderId,
              orderNumber: orderId,
              customer: formData,
              items: cart.map((item) => ({
                productId: item.product.id,
                title: item.product.title,
                price: item.product.price,
                quantity: item.quantity,
                image: item.product.images?.[0] || '',
                selectedVariant: item.selectedVariant,
                sku: item.product.sku,
              })),
              subtotal: totals.subtotal,
              shippingCost: totals.shipping,
              discount: 0,
              total: totals.total,
              currency: totals.currency,
              paymentMethod: 'paypal',
              paymentStatus: 'paid',
              paymentId: captureData.paymentId,
              paymentGateway: 'paypal',
              status: 'confirmed',
              trackingNumber: '',
              estimatedDelivery: '',
              createdAt: new Date().toISOString(),
            } as Order;

            setCompletion({
              orderId,
              mode: 'paid',
              total: totals.total,
              currency: totals.currency,
              message: 'Pago confirmado. Tu pedido quedó listo para preparación.',
            });
            clearCart();
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            onOrderSuccess(order);
            showToast('Pago confirmado. Pedido registrado.', 'success');
          } catch (error: any) {
            showToast(error.message || 'Error al confirmar el pago.', 'error');
          } finally {
            setPaying(false);
          }
        },
        onError: () => {
          setPaying(false);
          showToast('PayPal no pudo completar la operación.', 'error');
        },
        onCancel: () => {
          setPaying(false);
          showToast('Pago cancelado.', 'info');
        },
      })
      .render(paypalButtonsRef.current);
  }, [paypalLoaded, isFormValid, paypalTotalUsd, cart, formData, totals, itemCount]);

  const startWhatsAppOrder = async () => {
    if (!whatsappUrl) return;
    await trackRevenueEvent('whatsapp_order_started', {
      value: totals.total,
      currency: totals.currency,
      itemCount,
      channel: 'whatsapp',
    });
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  const startTransfer = async () => {
    if (!isFormValid) {
      showToast('Completá tus datos de envío antes de generar el pedido.', 'error');
      return;
    }
    try {
      setTransferBusy(true);
      const order = await createManualTransferOrder(cart, formData);
      setCompletion({
        orderId: order.orderId,
        mode: 'pending_verification',
        total: order.total,
        currency: order.currency,
        message: 'Pedido creado. El pago quedará pendiente hasta que el administrador verifique la transferencia.',
      });
      clearCart();
      showToast('Pedido creado. Transferencia pendiente de verificación.', 'success');
    } catch (error: any) {
      showToast(error.message || 'No se pudo crear el pedido por transferencia.', 'error');
    } finally {
      setTransferBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#0d111d]/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-8">
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">{completion ? 'Pedido Victoriosa' : 'Checkout Victoriosa'}</h2>
              <p className="text-xs text-slate-400">Compra en {STORE_CURRENCY}. Victoriosa no almacena números de tarjeta.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {completion ? (
          <div className="p-8 text-center space-y-6">
            <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border ${completion.mode === 'paid' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'}`}>
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-400">{completion.mode === 'paid' ? 'Pago confirmado' : 'Esperando verificación'}</div>
              <h3 className="text-2xl font-serif font-bold text-white mt-2">{completion.orderId}</h3>
              <p className="text-sm text-slate-300 mt-3 max-w-xl mx-auto">{completion.message}</p>
            </div>
            <div className="max-w-md mx-auto p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between text-sm">
              <span className="text-slate-400">Total</span>
              <strong className="text-white">{completion.currency} {completion.total.toFixed(2)}</strong>
            </div>
            {completion.mode === 'pending_verification' && BANK_TRANSFER_INSTRUCTIONS && (
              <div className="max-w-xl mx-auto p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left text-sm text-amber-100 whitespace-pre-line">
                <strong>{BANK_TRANSFER_LABEL || 'Datos para transferencia'}</strong>
                <div className="mt-2">{BANK_TRANSFER_INSTRUCTIONS}</div>
                <div className="mt-3 text-xs text-amber-200/70">Usá {completion.orderId} como referencia. El pedido no se considera pagado hasta verificación administrativa.</div>
              </div>
            )}
            <button onClick={onClose} className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm">Volver a la tienda</button>
          </div>
        ) : (
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-7">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-400" />Datos de entrega</h3>
              <div className="space-y-3 text-xs">
                <Field label="Nombre completo" value={formData.name || ''} onChange={(value) => setFormData({ ...formData, name: value })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Email" type="email" value={formData.email || ''} onChange={(value) => setFormData({ ...formData, email: value })} />
                  <Field label="Teléfono" type="tel" value={formData.phone || ''} onChange={(value) => setFormData({ ...formData, phone: value })} />
                </div>
                <Field label="Dirección" value={formData.address} onChange={(value) => setFormData({ ...formData, address: value })} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Código postal" value={formData.postalCode} onChange={(value) => setFormData({ ...formData, postalCode: value })} />
                  <Field label="Ciudad" value={formData.city} onChange={(value) => setFormData({ ...formData, city: value })} />
                  <Field label="País" value={formData.country} onChange={(value) => setFormData({ ...formData, country: value })} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-400" />Elegí cómo pagar</h3>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400"><span>Artículos ({itemCount})</span><span>{STORE_CURRENCY} {totals.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-slate-400"><span>Envío</span><span>{totals.shipping === 0 ? 'GRATIS' : `${STORE_CURRENCY} ${totals.shipping.toFixed(2)}`}</span></div>
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/10"><span>Total</span><span className="text-indigo-300">{STORE_CURRENCY} {totals.total.toFixed(2)}</span></div>
              </div>

              {SALES_WHATSAPP && whatsappUrl && (
                <button onClick={startWhatsAppOrder} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm">
                  <MessageCircle className="w-4 h-4" /> Comprar por WhatsApp
                </button>
              )}

              {BANK_TRANSFER_INSTRUCTIONS && (
                <button disabled={!isFormValid || transferBusy} onClick={startTransfer} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white font-bold text-sm border border-white/10">
                  {transferBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />} Transferencia bancaria
                </button>
              )}

              <div className="pt-2 border-t border-white/10">
                <div className="text-[11px] text-slate-500 mb-2">PayPal internacional</div>
                {paypalError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{paypalError}</span></div>
                )}
                {!paypalLoaded && !paypalError && <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando PayPal...</div>}
                <div ref={paypalButtonsRef} className="min-h-[48px]" />
                {paypalAvailableForCurrency && STORE_CURRENCY !== 'USD' && PAYPAL_USD_RATE > 0 && (
                  <div className="text-[10px] text-slate-500 mt-2">PayPal cobrará aproximadamente USD {paypalTotalUsd.toFixed(2)} usando la tasa configurada por Victoriosa.</div>
                )}
              </div>

              {paying && <div className="flex items-center justify-center gap-2 text-xs text-indigo-300"><Loader2 className="w-4 h-4 animate-spin" />Procesando pago...</div>}
              <div className="flex items-start gap-2 text-[10px] text-slate-500"><Lock className="w-3 h-3 mt-0.5 shrink-0" /><span>Nunca envíes datos de tarjeta por WhatsApp o transferencia. Los pagos con tarjeta son procesados por la pasarela correspondiente.</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; type?: string; onChange: (value: string) => void }> = ({ label, value, type = 'text', onChange }) => (
  <div>
    <label className="block text-slate-400 mb-1">{label}</label>
    <input
      type={type}
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-colors"
    />
  </div>
);
