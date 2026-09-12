import React, { useEffect, useState } from 'react';
import { Check, Heart, Info, ShoppingBag, Star, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { STORE_CURRENCY, trackRevenueEvent } from '../../services/revenue';
import type { Product } from '../../types';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onOpenAutopilotTraceability?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, onOpenAutopilotTraceability }) => {
  const { addToCart, wishlist, toggleWishlist, userRole, setViewMode, setSelectedCandidateForReview } = useApp();
  const [selectedImage, setSelectedImage] = useState(product.images?.[0] || '');
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0]?.options?.[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'specs'>('details');
  const isWishlisted = wishlist.includes(product.id);
  const discountPct = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;
  const hasReviews = Number(product.reviewCount || 0) > 0 && Number(product.rating || 0) > 0;

  useEffect(() => {
    void trackRevenueEvent('product_view', {
      productId: product.id,
      value: product.price,
      currency: STORE_CURRENCY,
      channel: 'store',
    });
  }, [product.id]);

  const handleAddToCart = () => {
    addToCart(product, quantity, selectedVariant);
    void trackRevenueEvent('add_to_cart', {
      productId: product.id,
      value: product.price * quantity,
      currency: STORE_CURRENCY,
      itemCount: quantity,
      channel: 'store',
    });
    onClose();
  };

  const handleAdminInspect = () => {
    if (userRole !== 'admin') return;
    onOpenAutopilotTraceability?.(product);
    setSelectedCandidateForReview(product);
    setViewMode('admin');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-[#0d111d]/95 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-8">
        <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10" title="Cerrar">
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-8">
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/10">
              {selectedImage ? (
                <img src={selectedImage} alt={product.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">Imagen no disponible</div>
              )}
              {discountPct > 0 && <div className="absolute top-3 left-3 bg-indigo-600 text-white font-bold text-xs px-3 py-1 rounded-xl border border-white/20">-{discountPct}%</div>}
            </div>

            {product.images?.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((img, index) => (
                  <button key={`${img}-${index}`} onClick={() => setSelectedImage(img)} className={`w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 ${selectedImage === img ? 'border-indigo-500' : 'border-white/10 opacity-70 hover:opacity-100'}`}>
                    <img src={img} alt={`Vista ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-400 flex gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>Disponibilidad, entrega y condiciones finales se confirman durante el checkout. No mostramos garantías o certificaciones que no estén documentadas en la ficha del producto.</span>
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col space-y-6">
            <div>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400 pb-2 border-b border-white/10">
                <span className="font-semibold text-indigo-400 uppercase tracking-wider">{product.category}</span>
                {hasReviews && (
                  <div className="flex items-center gap-1.5"><Star className="w-4 h-4 fill-amber-400 text-amber-400" /><span className="font-bold text-white">{Number(product.rating).toFixed(1)}</span><span>({product.reviewCount} opiniones)</span></div>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-3 leading-tight">{product.title}</h1>
              {product.subtitle && <p className="text-sm text-slate-300 mt-2">{product.subtitle}</p>}

              <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-white font-mono">{STORE_CURRENCY} {Number(product.price).toFixed(2)}</span>
                  {product.compareAtPrice && product.compareAtPrice > product.price && <span className="text-sm text-slate-500 line-through font-mono">{STORE_CURRENCY} {Number(product.compareAtPrice).toFixed(2)}</span>}
                </div>
                <span className="text-xs text-slate-400 mt-1 block">El total definitivo y el envío se calculan en checkout.</span>
              </div>

              {product.variants && product.variants.length > 0 && (
                <div className="mt-5 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{product.variants[0].name}: <span className="text-indigo-400 font-normal">{selectedVariant}</span></label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants[0].options.map((option) => (
                      <button key={option} onClick={() => setSelectedVariant(option)} className={`px-3.5 py-2 rounded-xl text-xs border ${selectedVariant === option ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-300'}`}>{option}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <div className="flex items-center border border-white/10 rounded-xl bg-black/40 p-1">
                  <button onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="w-8 h-8 text-slate-400 hover:text-white">-</button>
                  <span className="w-10 text-center text-sm font-semibold text-white font-mono">{quantity}</span>
                  <button onClick={() => setQuantity((value) => Math.min(20, value + 1))} className="w-8 h-8 text-slate-400 hover:text-white">+</button>
                </div>
                <button onClick={handleAddToCart} className="flex-1 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 border border-white/10">
                  <ShoppingBag className="w-4 h-4" /> Añadir a la bolsa · {STORE_CURRENCY} {(product.price * quantity).toFixed(2)}
                </button>
                <button onClick={() => toggleWishlist(product.id)} className={`p-3.5 rounded-xl border ${isWishlisted ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`} title="Favoritos"><Heart className="w-5 h-5 fill-current" /></button>
              </div>

              <div className="mt-8 border-t border-white/10 pt-4">
                <div className="flex gap-4 border-b border-white/10 pb-2 text-xs font-semibold">
                  <button onClick={() => setActiveTab('details')} className={`pb-2 ${activeTab === 'details' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400'}`}>Descripción</button>
                  <button onClick={() => setActiveTab('specs')} className={`pb-2 ${activeTab === 'specs' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400'}`}>Especificaciones</button>
                </div>
                <div className="py-4 text-xs leading-relaxed text-slate-300">
                  {activeTab === 'details' ? (
                    <div className="space-y-4"><p className="whitespace-pre-line">{product.description}</p>{product.features?.length > 0 && <ul className="space-y-1.5">{product.features.map((feature, index) => <li key={index} className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" /><span>{feature}</span></li>)}</ul>}</div>
                  ) : (
                    <div className="divide-y divide-white/10 rounded-2xl bg-white/5 p-4 border border-white/10">{product.specs && Object.entries(product.specs).map(([key, value]) => <div key={key} className="py-2.5 flex justify-between gap-4"><span className="text-slate-400">{key}</span><span className="font-medium text-white text-right">{String(value)}</span></div>)}<div className="py-2.5 flex justify-between"><span className="text-slate-400">SKU</span><span className="font-mono text-indigo-300">{product.sku}</span></div></div>
                  )}
                </div>
              </div>

              {userRole === 'admin' && <button onClick={handleAdminInspect} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">Abrir ficha interna del producto</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
