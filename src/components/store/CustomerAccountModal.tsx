import React, { useState } from 'react';
import { 
  X, 
  Package, 
  Heart, 
  User, 
  Truck, 
  Clock, 
  ExternalLink, 
  ShoppingBag,
  ShieldCheck
} from 'lucide-react';
import { STORE_CURRENCY } from '../../services/revenue';
import { useApp } from '../../context/AppContext';
import type { Product } from '../../types';

interface CustomerAccountModalProps {
  onClose: () => void;
  onSelectProduct: (p: Product) => void;
}

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({
  onClose,
  onSelectProduct
}) => {
  const { 
    orders, 
    wishlist, 
    products, 
    addToCart, 
    userRole, 
    user, 
    userProfile, 
    signOutUser, 
    setIsAuthModalOpen, 
    setViewMode 
  } = useApp();
  const [activeTab, setActiveTab] = useState<'orders' | 'wishlist' | 'profile'>('orders');

  const wishlistedProducts = products.filter((p) => wishlist.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-[#0d111d]/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border shadow-lg ${
              userRole === 'admin'
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">Mi Cuenta Victoriosa</h2>
              <p className="text-xs text-slate-400 font-mono">
                {user && !user.isAnonymous 
                  ? `${user.displayName || user.email} • ${userRole === 'admin' ? 'Administrador' : 'Cliente'}`
                  : `Sesión de Invitado / Anónimo • Rol: ${userRole}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                setIsAuthModalOpen(true);
              }}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
            >
              {user && !user.isAnonymous ? 'Gestionar sesión' : 'Iniciar Sesión'}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-white/[0.01] px-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-3.5 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'orders'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Mis Pedidos ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('wishlist')}
            className={`py-3.5 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'wishlist'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Favoritos ({wishlist.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3.5 px-4 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-indigo-500 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Seguridad & Datos</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-medium text-slate-300">Aún no has realizado pedidos</p>
                  <p className="text-xs text-slate-500">
                    Tus compras aparecerán aquí con su seguimiento en tiempo real.
                  </p>
                </div>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10 text-xs">
                      <div>
                        <span className="font-bold text-white">{order.orderNumber}</span>
                        <span className="text-slate-500 ml-2">
                          {new Date(order.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono bg-emerald-500/10 px-3 py-0.5 rounded-full border border-emerald-500/30">
                          <Truck className="w-3 h-3" />
                          Tracking: {order.trackingNumber}
                        </span>
                        <span className="font-bold text-white font-mono">
                          ${order.total.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-10 h-10 rounded-xl object-cover bg-black/40 border border-white/10"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <p className="font-semibold text-slate-200 line-clamp-1">{item.title}</p>
                              <span className="text-[11px] text-slate-500">Cantidad: {item.quantity}</span>
                            </div>
                          </div>
                          <span className="font-mono text-slate-300">
                            {order.currency || STORE_CURRENCY} {(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[11px] text-slate-400">
                      <span>Entrega estimada: <strong className="text-slate-200">{order.estimatedDelivery}</strong></span>
                      <span className="text-emerald-400 font-medium">Consultá las condiciones de tu pedido</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'wishlist' && (
            <div className="space-y-4">
              {wishlistedProducts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <Heart className="w-10 h-10 mx-auto text-slate-600" />
                  <p className="text-sm font-medium text-slate-300">No tienes favoritos guardados</p>
                  <p className="text-xs text-slate-500">
                    Pulsa el icono de corazón en cualquier producto para guardarlo aquí.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {wishlistedProducts.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-white/5 rounded-2xl border border-white/10 flex gap-3.5 items-center backdrop-blur-md"
                    >
                      <img
                        src={p.images[0]}
                        alt={p.title}
                        className="w-16 h-16 object-cover rounded-xl bg-black/40 border border-white/10 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-white line-clamp-1">{p.title}</h4>
                        <span className="text-xs font-bold text-indigo-400 font-mono block mt-0.5">{STORE_CURRENCY} {p.price.toFixed(2)}</span>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              onClose();
                              onSelectProduct(p);
                            }}
                            className="px-3 py-1 bg-white/5 hover:bg-white/10 text-[11px] rounded-lg text-slate-200 border border-white/10 transition-colors"
                          >
                            Ver Producto
                          </button>
                          <button
                            onClick={() => addToCart(p, 1)}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-[11px] font-bold rounded-lg text-white transition-all shadow-md shadow-indigo-600/20"
                          >
                            Comprar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-4 text-xs backdrop-blur-md">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Datos de la Cuenta & Autenticación</h3>
                <button
                  onClick={() => {
                    onClose();
                    setIsAuthModalOpen(true);
                  }}
                  className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs transition-colors"
                >
                  Gestionar sesión
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-slate-400">
                <div>
                  <span className="block text-[10px] uppercase text-slate-500">Nombre / Alias</span>
                  <span className="text-slate-200 font-medium">
                    {user?.displayName || userProfile?.displayName || 'Usuario Victoriosa'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-500">Correo Electrónico</span>
                  <span className="text-slate-200 font-medium font-mono">
                    {user?.email || 'Autenticación Anónima / Invitado'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-500">Identificador</span>
                  <span className="text-slate-300 font-mono text-[11px] truncate block">
                    {user?.uid || 'Sin sesión activa'}
                  </span>
                </div>
                <div>
                      <span className="block text-[10px] uppercase text-slate-500">Tipo de cuenta</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    userRole === 'admin' ? 'text-indigo-400' : 'text-emerald-400'
                  }`}>
                    {userRole === 'admin' ? 'Administrador' : 'Cliente'}
                  </span>
                </div>
              </div>

              {user && !user.isAnonymous && (
                <div className="pt-3 border-t border-white/10 flex justify-end">
                  <button
                    onClick={async () => {
                      await signOutUser();
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs border border-rose-500/30 transition-colors"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
