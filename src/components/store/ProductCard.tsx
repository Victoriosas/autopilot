import React from 'react';
import { Heart, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { STORE_CURRENCY } from '../../services/revenue';
import { useApp } from '../../context/AppContext';
import type { Product } from '../../types';

interface ProductCardProps { product: Product; onSelect: (p: Product) => void; }

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  const { addToCart, wishlist, toggleWishlist } = useApp();
  const isWishlisted = wishlist.includes(product.id);
  const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7b594c]';
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#7b594c]/15 bg-[#fffaf4] text-[#3b2b28] transition-shadow hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-[#efe3d4]">
        <button type="button" onClick={() => onSelect(product)} aria-label={`Ver ${product.title}`} className={`h-full w-full ${focus}`}>
          {product.images[0] ? <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105" referrerPolicy="no-referrer" loading="lazy" /> : <span className="flex h-full items-center justify-center px-6 text-sm text-[#76635c]">Imagen no disponible</span>}
        </button>
        <button type="button" onClick={() => toggleWishlist(product.id)} aria-pressed={isWishlisted} aria-label={`${isWishlisted ? 'Quitar de' : 'Guardar en'} favoritos: ${product.title}`} className={`absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#7b594c]/20 bg-[#fffaf4] text-[#7b594c] transition hover:bg-[#efe3d4] ${focus}`}>
          <Heart aria-hidden="true" className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
        </button>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium text-[#76635c]">{product.category}</p>
        <h3 className="mt-2 text-base font-semibold leading-6"><button type="button" onClick={() => onSelect(product)} className={`text-left hover:underline hover:underline-offset-4 ${focus}`}>{product.title}</button></h3>
        {product.subtitle && <p className="mt-1 text-xs leading-5 text-[#76635c]">{product.subtitle}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-[#7b594c]/15 pt-4">
          <div className="pt-4">
            <span className="block text-lg font-semibold tabular-nums">{STORE_CURRENCY} {product.price.toLocaleString('es-UY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span className="mt-1 block text-xs text-[#76635c]">Disponibilidad por confirmar</span>
          </div>
          <button type="button" onClick={() => addToCart(product, 1, product.variants?.[0]?.options?.[0])} aria-label={`Añadir a la bolsa: ${product.title}`} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#3b2b28] text-white transition hover:bg-[#7b594c] ${focus}`}><ShoppingBag aria-hidden="true" className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={() => onSelect(product)} className={`mt-3 inline-flex min-h-11 items-center gap-1 self-start text-xs font-semibold text-[#7b594c] ${focus}`}>Ver detalles <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" /></button>
      </div>
    </article>
  );
};
