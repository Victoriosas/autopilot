import React from 'react';
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface CartDrawerProps {
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onProceedToCheckout }) => {
  const { cart, isCartOpen, setIsCartOpen, updateCartQuantity, removeFromCart, clearCart } = useApp();

  if (!isCartOpen) return null;

  const subtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const exchangeRate = 1.08;
  const freeShippingThresholdUsd = 80;
  const subtotalUsd = +(subtotal * exchangeRate).toFixed(2);
  const progressToFreeShipping = Math.min(100, (subtotalUsd / freeShippingThresholdUsd) * 100);
  const remainingForFreeShipping = Math.max(0, +(freeShippingThresholdUsd - subtotalUsd).toFixed(2));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xl animate-fadeIn">
      <div 
        className="w-full max-w-md bg-[#0d111d]/90 h-full border-l border-white/10 flex flex-col justify-between shadow-2xl backdrop-blur-2xl animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <h2 className="font-serif font-bold text-lg text-white">Tu Bolsa Victoriosa</h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-indigo-300 font-mono border border-white/10">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free Shipping Progress Indicator */}
        <div className="px-6 py-3.5 bg-white/[0.02] border-b border-white/10 text-xs">
          <div className="flex items-center justify-between text-slate-300 mb-2">
            <span className="flex items-center gap-1.5 font-medium">
              <Truck className="w-3.5 h-3.5 text-indigo-400" />
              {remainingForFreeShipping === 0 ? (
                <span className="text-emerald-400 font-semibold">¡Envío Gratuito Conseguido!</span>
              ) : (
                <span>Faltan <strong className="text-indigo-300">${remainingForFreeShipping}</strong> para Envío Gratis</span>
              )}
            </span>
            <span className="font-mono text-slate-400">{Math.round(progressToFreeShipping)}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
              style={{ width: `${progressToFreeShipping}%` }}
            />
          </div>
        </div>

        {/* Cart Item List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <ShoppingBag className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-300 font-medium">Tu bolsa de compra está vacía</p>
              <p className="text-xs text-slate-500">
                Descubre los productos curados en nuestro catálogo publicado.
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
              >
                Explorar Colección
              </button>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={`${item.product.id}-${item.selectedVariant || idx}`}
                className="flex gap-4 p-3.5 bg-white/5 rounded-2xl border border-white/10 items-center backdrop-blur-md"
              >
                <img
                  src={item.product.images[0]}
                  alt={item.product.title}
                  className="w-16 h-16 object-cover rounded-xl bg-black/40 border border-white/10 flex-shrink-0"
                  referrerPolicy="no-referrer"
                />

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white line-clamp-1">
                    {item.product.title}
                  </h4>
                  {item.selectedVariant && (
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {item.selectedVariant}
                    </span>
                  )}
                  <span className="text-xs font-bold text-white block mt-1 font-mono">
                    ${(item.product.price * exchangeRate).toFixed(2)}
                  </span>

                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border border-white/10 rounded-lg bg-black/40">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1, item.selectedVariant)}
                        className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                      >
                        -
                      </button>
                      <span className="px-2 text-xs font-mono text-slate-200">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1, item.selectedVariant)}
                        className="px-2 py-0.5 text-xs text-slate-400 hover:text-white"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id, item.selectedVariant)}
                      className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-white/10 bg-white/[0.02] space-y-4">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono text-slate-200">${subtotalUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Envío estimado</span>
                <span className="font-mono text-slate-200">
                  {subtotalUsd >= freeShippingThresholdUsd ? (
                    <span className="text-emerald-400 font-semibold">GRATIS</span>
                  ) : (
                    '$5.95'
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-white/10">
                <span>Total Estimado</span>
                <span className="text-indigo-400 text-base font-mono">
                  ${(subtotalUsd + (subtotalUsd >= freeShippingThresholdUsd ? 0 : 5.95)).toFixed(2)}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setIsCartOpen(false);
                onProceedToCheckout();
              }}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.99] flex items-center justify-center gap-2 border border-white/10"
            >
              <span>Tramitar Pedido Seguro</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Pago Cifrado SSL 256-bit
              </span>
              <span>•</span>
              <span>Garantía Oficial Victoriosa</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
