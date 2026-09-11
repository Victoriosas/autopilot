import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  Truck, 
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../../context/AppContext';
import type { Order } from '../../types';

interface CheckoutModalProps {
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
}

declare global {
  interface Window {
    paypal?: any;
  }
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onOrderSuccess }) => {
  const { cart, placeOrder, showToast } = useApp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const paypalButtonsRef = useRef<HTMLDivElement>(null);
  const paypalButtonsRendered = useRef(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    province: '',
    country: 'España'
  });

  // USD conversion
  const exchangeRate = 1.08;
  const subtotalEur = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shippingEur = subtotalEur >= 80 ? 0 : 5.95;
  const totalEur = +(subtotalEur + shippingEur).toFixed(2);
  const totalUsd = +(totalEur * exchangeRate).toFixed(2);
  const subtotalUsd = +(subtotalEur * exchangeRate).toFixed(2);
  const shippingUsd = +(shippingEur * exchangeRate).toFixed(2);

  // Fetch PayPal config and load SDK
  useEffect(() => {
    const loadPayPal = async () => {
      try {
        const res = await apiFetch('/api/payments/paypal/config');
        const config = await res.json();

        if (!config.configured || !config.clientId) {
          setPaypalError('PayPal no está configurado. Contacta al administrador.');
          return;
        }

        // Load PayPal JS SDK
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${config.clientId}&currency=USD&disable-funding=credit,card,venmo`;
        script.async = true;
        script.onload = () => setPaypalLoaded(true);
        script.onerror = () => setPaypalError('Error al cargar el SDK de PayPal.');
        document.head.appendChild(script);
      } catch {
        setPaypalError('Error al verificar la configuración de pagos.');
      }
    };
    loadPayPal();
  }, []);

  // Render PayPal buttons when SDK is loaded and form is valid
  useEffect(() => {
    if (!paypalLoaded || !window.paypal || paypalButtonsRendered.current) return;

    const isFormValid = formData.name && formData.email && formData.address && formData.city && formData.postalCode;
    if (!isFormValid) return;
    if (!paypalButtonsRef.current) return;

    paypalButtonsRendered.current = true;

    window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay',
        height: 50,
      },
      createOrder: async () => {
        try {
          setPaying(true);

          // Step 1: Create Victoriosa order in Firestore (pending_payment)
          const order = await placeOrder(formData);
          if (!order) {
            setPaying(false);
            showToast('Error al crear el pedido.', 'error');
            return undefined;
          }

          // Step 2: Create PayPal order (server-side)
          const res = await apiFetch('/api/payments/paypal/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              total: totalUsd,
              currency: 'USD',
              items: order.items.map(i => ({
                name: i.title.slice(0, 127),
                unit_amount: { currency_code: 'USD', value: (i.price * exchangeRate).toFixed(2) },
                quantity: i.quantity.toString(),
              })),
            }),
          });

          const data = await res.json();

          if (!res.ok || !data.paypalOrderId) {
            setPaying(false);
            showToast(data.message || 'Error al procesar el pago con PayPal.', 'error');
            // Revert order status - in production, mark as failed
            return undefined;
          }

          return data.paypalOrderId;
        } catch (err) {
          setPaying(false);
          showToast('Error de conexión con PayPal.', 'error');
          return undefined;
        }
      },
      onApprove: async (data: any) => {
        try {
          // Step 3: Capture PayPal payment (server-side)
          const captureRes = await apiFetch('/api/payments/paypal/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paypalOrderId: data.orderID,
              orderId: data.orderID, // Will be matched server-side
            }),
          });

          const captureData = await captureRes.json();

          if (captureRes.ok && captureData.success) {
            // Payment confirmed - show success
            setCompletedOrder({
              id: data.orderID,
              orderNumber: data.orderID,
              customer: formData,
              items: cart.map(i => ({
                productId: i.product.id,
                title: i.product.title,
                price: i.product.price,
                quantity: i.quantity,
                image: i.product.images[0] || '',
                sku: i.product.sku,
              })),
              subtotal: subtotalUsd,
              shippingCost: shippingUsd,
              discount: 0,
              total: totalUsd,
              currency: 'USD',
              paymentMethod: 'paypal',
              paymentStatus: 'paid',
              paymentId: captureData.paymentId,
              paymentGateway: 'paypal',
              status: 'confirmed',
              trackingNumber: '',
              estimatedDelivery: '',
              createdAt: new Date().toISOString(),
            });

            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
            onOrderSuccess({
              id: data.orderID,
              orderNumber: data.orderID,
              customer: formData,
              items: [],
              subtotal: subtotalUsd,
              shippingCost: shippingUsd,
              discount: 0,
              total: totalUsd,
              currency: 'USD',
              paymentMethod: 'paypal',
              paymentStatus: 'paid',
              paymentId: captureData.paymentId,
              paymentGateway: 'paypal',
              status: 'confirmed',
              trackingNumber: '',
              estimatedDelivery: '',
              createdAt: new Date().toISOString(),
            });
            showToast('¡Pago confirmado por PayPal! Pedido completado.', 'success');
          } else {
            showToast('Pago no completado. Intenta de nuevo.', 'error');
          }
        } catch (err) {
          showToast('Error al confirmar el pago.', 'error');
        } finally {
          setPaying(false);
        }
      },
      onError: () => {
        setPaying(false);
        showToast('Error en el proceso de pago de PayPal.', 'error');
      },
      onCancel: () => {
        setPaying(false);
        showToast('Pago cancelado por el usuario.', 'info');
      },
    }).render(paypalButtonsRef.current);
  }, [paypalLoaded, formData, totalUsd]);

  const isFormValid = formData.name && formData.email && formData.address && formData.city && formData.postalCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl bg-[#0d111d]/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                {completedOrder ? '¡Pedido Confirmado!' : 'Checkout Seguro Victoriosa'}
              </h2>
              <p className="text-xs text-slate-400">
                {completedOrder ? 'Gracias por tu confianza' : 'Pago seguro vía PayPal • Cifrado TLS 256-bit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {completedOrder ? (
          /* Order Confirmation View */
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.2)]">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">
                Pago Confirmado
              </span>
              <h3 className="text-2xl font-serif font-bold text-white">
                Pedido {completedOrder.orderNumber}
              </h3>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Tu pago ha sido procesado exitosamente por PayPal. El centro logístico ya está preparando tu paquete.
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-3 text-xs backdrop-blur-md">
              <div className="flex justify-between pb-2 border-b border-white/10">
                <span className="text-slate-400">Estado del Pago:</span>
                <span className="font-mono font-bold text-emerald-400">Pagado</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/10">
                <span className="text-slate-400">Número de Pedido:</span>
                <span className="font-mono font-bold text-indigo-400">{completedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-white/10">
                <span className="text-slate-400">Total Pagado:</span>
                <span className="font-mono font-bold text-white">${totalUsd.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Dirección de Envío:</span>
                <span className="text-slate-200 text-right">{completedOrder.customer.address}, {completedOrder.customer.city}</span>
              </div>
            </div>

            <div className="pt-4 flex justify-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 border border-white/10"
              >
                Volver a la Tienda
              </button>
            </div>
          </div>
        ) : (
          /* Checkout Form */
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Shipping Address Inputs */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-indigo-400" />
                  <span>1. Dirección de Envío</span>
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">Nombre Completo</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Teléfono</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Dirección Postal</label>
                    <input
                      type="text"
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Código Postal</label>
                      <input
                        type="text"
                        required
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Ciudad</label>
                      <input
                        type="text"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">País</label>
                      <input
                        type="text"
                        required
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method & Order Summary */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>2. Pago con PayPal</span>
                </h3>

                {/* Price Breakdown (USD) */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs backdrop-blur-md">
                  <div className="flex justify-between text-slate-400">
                    <span>Artículos ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
                    <span className="font-mono text-slate-200">${subtotalUsd.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Envío Express Asegurado</span>
                    <span className="font-mono text-slate-200">
                      {shippingUsd === 0 ? <strong className="text-emerald-400">GRATIS</strong> : `$${shippingUsd.toFixed(2)} USD`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
                    <span>Total a Pagar</span>
                    <span className="text-indigo-400 font-mono text-base">${totalUsd.toFixed(2)} USD</span>
                  </div>
                </div>

                {/* PayPal Error */}
                {paypalError && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs space-y-2 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-red-300 font-semibold">
                      <AlertCircle className="w-4 h-4" />
                      <span>Pago No Disponible</span>
                    </div>
                    <p className="text-red-200/80 leading-relaxed">{paypalError}</p>
                  </div>
                )}

                {/* PayPal Buttons Container */}
                <div className="space-y-3">
                  {!paypalLoaded && !paypalError && (
                    <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cargando PayPal...</span>
                    </div>
                  )}
                  <div ref={paypalButtonsRef} className="min-h-[50px]" />
                </div>

                {paying && (
                  <div className="flex items-center justify-center gap-2 py-2 text-indigo-300 text-xs">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Procesando pago con PayPal...</span>
                  </div>
                )}

                {/* Security Note */}
                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-2">
                  <Lock className="w-3 h-3" />
                  <span>Pago procesado de forma segura por PayPal. Victoriosa nunca almacena datos de tu tarjeta.</span>
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};
