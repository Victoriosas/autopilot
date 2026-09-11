import React from 'react';
import { Heart, Star, ShoppingBag, ShieldCheck, Cpu, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onSelect: (p: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const { addToCart, wishlist, toggleWishlist } = useApp();
  const isWishlisted = wishlist.includes(product.id);
  const discountPct = product.compareAtPrice 
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  return (
    <div 
      className="group relative bg-white/5 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all duration-300 flex flex-col overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 backdrop-blur-xl"
    >
      {/* Image Showcase Container */}
      <div 
        onClick={() => onSelect(product)}
        className="relative aspect-square overflow-hidden bg-black/40 cursor-pointer"
      >
        <img
          src={product.images[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80"}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          referrerPolicy="no-referrer"
          loading="lazy"
        />

        {/* Overlay Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {discountPct > 0 && (
            <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 text-white shadow-md border border-white/20">
              -{discountPct}%
            </span>
          )}
          {product.badges && product.badges[0] && (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-black/70 backdrop-blur-xl text-slate-200 border border-white/10">
              {product.badges[0]}
            </span>
          )}
        </div>

        {/* Wishlist Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          className={`absolute top-3 right-3 p-2.5 rounded-xl backdrop-blur-xl transition-all z-10 border ${
            isWishlisted 
              ? 'bg-indigo-600 text-white border-white/20 shadow-lg shadow-indigo-600/30' 
              : 'bg-black/60 text-slate-300 border-white/10 hover:text-white hover:bg-black/80'
          }`}
          title={isWishlisted ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        >
          <Heart className="w-4 h-4 fill-current" />
        </button>

        {/* Autopilot Score Pill in corner */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-xl border border-white/10 text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-emerald-400" />
          <span>Score {product.traceability?.analysis?.overallScore || 90}/100</span>
        </div>
      </div>

      {/* Product Information */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium text-indigo-300">{product.category}</span>
            <div className="flex items-center gap-1 text-slate-300">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-xs">{product.rating}</span>
              <span className="text-slate-500 text-[11px]">({product.reviewCount})</span>
            </div>
          </div>

          <h3 
            onClick={() => onSelect(product)}
            className="text-sm font-semibold text-white line-clamp-2 cursor-pointer hover:text-indigo-300 transition-colors leading-snug"
          >
            {product.title}
          </h3>

          {product.subtitle && (
            <p className="text-xs text-slate-400 line-clamp-1 mt-1">
              {product.subtitle}
            </p>
          )}
        </div>

        {/* Pricing and Action Footer */}
        <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-white font-mono">
                ${(product.price * 1.08).toFixed(2)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > product.price && (
                <span className="text-xs text-slate-500 line-through font-mono">
                  ${(product.compareAtPrice * 1.08).toFixed(2)}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              IVA incl. • Envío 24/48h
            </span>
          </div>

          <button
            onClick={() => addToCart(product, 1, product.variants?.[0]?.options?.[0])}
            className="p-3 rounded-xl bg-white/5 hover:bg-indigo-600 text-slate-200 hover:text-white border border-white/10 hover:border-indigo-500/50 transition-all duration-200 shadow-sm flex items-center justify-center active:scale-95"
            title="Añadir a la bolsa"
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
