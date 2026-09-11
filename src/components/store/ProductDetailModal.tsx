import React, { useState } from 'react';
import { 
  X, 
  Star, 
  ShoppingBag, 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  Check, 
  Cpu, 
  Heart, 
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Product } from '../../types';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onOpenAutopilotTraceability?: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onOpenAutopilotTraceability
}) => {
  const { addToCart, wishlist, toggleWishlist, setViewMode, setSelectedCandidateForReview } = useApp();
  const [selectedImage, setSelectedImage] = useState(product.images[0] || '');
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0]?.options?.[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'traceability'>('details');

  const isWishlisted = wishlist.includes(product.id);
  const discountPct = product.compareAtPrice 
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  const handleInspectInAutopilot = () => {
    onClose();
    setSelectedCandidateForReview(product);
    setViewMode('admin');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-5xl bg-[#0d111d]/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-black/60 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/10"
          title="Cerrar vista"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 sm:p-8">
          {/* Gallery Column */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-black/40 border border-white/10">
              <img
                src={selectedImage || product.images[0]}
                alt={product.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              {discountPct > 0 && (
                <div className="absolute top-3 left-3 bg-indigo-600 text-white font-bold text-xs px-3 py-1 rounded-xl shadow-md border border-white/20">
                  -{discountPct}% DESCUENTO
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                      selectedImage === img ? 'border-indigo-500 scale-95 shadow-lg shadow-indigo-500/20' : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`Vista ${idx + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}

            {/* Quick Guarantee Box */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5 text-xs text-slate-300 backdrop-blur-md">
              <div className="flex items-center gap-2.5 text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span>Garantía Oficial Victoriosa Care (3 años con reemplazo express)</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-400">
                <Truck className="w-4 h-4 flex-shrink-0 text-indigo-400" />
                <span>Envío 24/48h asegurado desde almacén central en España</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-400">
                <RotateCcw className="w-4 h-4 flex-shrink-0 text-cyan-400" />
                <span>30 días de prueba gratuita sin preguntas</span>
              </div>
            </div>
          </div>

          {/* Details & Purchase Column */}
          <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
            <div>
              {/* Category, Rating & SKU */}
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-white/10">
                <span className="font-semibold text-indigo-400 uppercase tracking-wider">{product.category}</span>
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-bold text-white">{product.rating}</span>
                  <span className="text-slate-500">({product.reviewCount} valoraciones verificadas)</span>
                </div>
              </div>

              {/* Title & Subtitle */}
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-3 leading-tight">
                {product.title}
              </h1>

              {product.subtitle && (
                <p className="text-sm text-slate-300 mt-2 font-normal">
                  {product.subtitle}
                </p>
              )}

              {/* Price Banner */}
              <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-baseline justify-between backdrop-blur-md">
                <div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-white font-mono">${(product.price * 1.08).toFixed(2)}</span>
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                      <span className="text-sm text-slate-500 line-through font-mono">
                        ${(product.compareAtPrice * 1.08).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    Impuestos incluidos. Stock disponible ({product.inventory} unidades).
                  </span>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    En Stock Listo para Envío
                  </span>
                </div>
              </div>

              {/* Variant Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="mt-5 space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    {product.variants[0].name}: <span className="text-indigo-400 font-normal">{selectedVariant}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {product.variants[0].options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSelectedVariant(opt)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all ${
                          selectedVariant === opt
                            ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 font-semibold shadow-sm'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity & CTA Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <div className="flex items-center border border-white/10 rounded-xl bg-black/40 p-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-white font-mono">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => q + 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => {
                    addToCart(product, quantity, selectedVariant);
                    onClose();
                  }}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.99] flex items-center justify-center gap-2 border border-white/10"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Añadir a la Bolsa (${(product.price * quantity * 1.08).toFixed(2)})</span>
                </button>

                <button
                  onClick={() => toggleWishlist(product.id)}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isWishlisted 
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' 
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title="Añadir a favoritos"
                >
                  <Heart className="w-5 h-5 fill-current" />
                </button>
              </div>

              {/* Tabs for Story, Specs & Traceability */}
              <div className="mt-8 border-t border-white/10 pt-4">
                <div className="flex gap-4 border-b border-white/10 pb-2 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`pb-2 transition-colors ${
                      activeTab === 'details' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Descripción & Experiencia
                  </button>
                  <button
                    onClick={() => setActiveTab('specs')}
                    className={`pb-2 transition-colors ${
                      activeTab === 'specs' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Especificaciones Técnicas
                  </button>
                  <button
                    onClick={() => setActiveTab('traceability')}
                    className={`pb-2 transition-colors flex items-center gap-1 ${
                      activeTab === 'traceability' ? 'border-b-2 border-indigo-500 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Trazabilidad Autopilot</span>
                  </button>
                </div>

                <div className="py-4 text-xs leading-relaxed text-slate-300">
                  {activeTab === 'details' && (
                    <div className="space-y-4">
                      <p className="whitespace-pre-line">{product.description}</p>
                      
                      {product.features && product.features.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <h4 className="font-semibold text-white uppercase tracking-wider text-[11px]">
                            Puntos Clave Seleccionados
                          </h4>
                          <ul className="space-y-1.5">
                            {product.features.map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'specs' && (
                    <div className="divide-y divide-white/10 rounded-2xl bg-white/5 p-4 border border-white/10 backdrop-blur-md">
                      {product.specs && Object.entries(product.specs).map(([key, val]) => (
                        <div key={key} className="py-2.5 flex justify-between">
                          <span className="text-slate-400">{key}</span>
                          <span className="font-medium text-white text-right">{val}</span>
                        </div>
                      ))}
                      <div className="py-2.5 flex justify-between">
                        <span className="text-slate-400">SKU Oficial</span>
                        <span className="font-mono text-indigo-300">{product.sku}</span>
                      </div>
                    </div>
                  )}

                  {activeTab === 'traceability' && (
                    <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="font-semibold text-indigo-400 flex items-center gap-1.5">
                          <Cpu className="w-4 h-4" /> Proceso de Certificación Autopilot
                        </span>
                        <span className="font-mono text-emerald-400 text-xs font-bold">
                          Score: {product.traceability?.analysis?.overallScore || 90}/100 (Tier {product.traceability?.analysis?.scoreTier || 'S'})
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        Este producto fue evaluado por el motor de inteligencia de Victoriosa. Cumple el estándar de margen mínimo ({product.traceability?.pricing?.targetMarginPct || 55}%), riesgo legal nulo y fiabilidad logística del proveedor ({product.traceability?.supplier?.reliabilityScore || 95}%).
                      </p>
                      
                      <div className="pt-2 flex items-center justify-between border-t border-white/10 text-[11px]">
                        <span className="text-slate-500">
                          Fuente de Origen: {product.traceability?.source?.platform || 'Amazon Global'}
                        </span>
                        <button
                          onClick={handleInspectInAutopilot}
                          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                        >
                          <span>Abrir en Centro de Control Autopilot</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
