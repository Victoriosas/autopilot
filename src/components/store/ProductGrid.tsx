import React, { useState, useMemo } from 'react';
import { ProductCard } from './ProductCard';
import { SlidersHorizontal, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { STORE_CURRENCY } from '../../services/revenue';
import { useApp } from '../../context/AppContext';
import type { Product } from '../../types';

interface ProductGridProps {
  activeCategory: string;
  searchQuery: string;
  onSelectProduct: (p: Product) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  activeCategory,
  searchQuery,
  onSelectProduct
}) => {
  const { publishedProducts, setViewMode, userProfile } = useApp();
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating' | 'score'>('featured');
  const [priceFilter, setPriceFilter] = useState<number>(300);

  const filteredProducts = useMemo(() => {
    return publishedProducts.filter((p) => {
      // Must be published (strict requirement: unapproved products NEVER appear)
      if (p.status !== 'published') return false;

      // Category filter
      if (activeCategory !== 'Todos' && p.category !== activeCategory) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesTag = p.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesSku = p.sku.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesTag && !matchesSku) {
          return false;
        }
      }

      // Max price filter
      if (p.price > priceFilter) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'score') {
        const scoreA = a.traceability?.analysis?.overallScore || 0;
        const scoreB = b.traceability?.analysis?.overallScore || 0;
        return scoreB - scoreA;
      }
      return 0; // featured default
    });
  }, [publishedProducts, activeCategory, searchQuery, sortBy, priceFilter]);

  return (
    <section id="catalogo" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Controls and Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h2 className="text-2xl font-serif font-bold text-white flex items-center gap-2">
            <span>{activeCategory === 'Todos' ? 'Catálogo Victoriosa' : activeCategory}</span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-indigo-300 font-normal border border-white/10">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Explorá el catálogo. Estamos verificando disponibilidad y condiciones de venta.
          </p>
        </div>

        {/* Filters and Sorting Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-md">
            <span className="text-slate-400">Hasta:</span>
            <span className="font-semibold text-slate-200">{STORE_CURRENCY} {priceFilter.toFixed(0)}</span>
            <input
              type="range"
              min="20"
              max="350"
              step="10"
              value={priceFilter}
              onChange={(e) => setPriceFilter(Number(e.target.value))}
              className="w-20 accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 bg-white/5 px-3.5 py-2 rounded-xl border border-white/10 backdrop-blur-md">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="featured" className="bg-[#0d111d] text-slate-200">Destacados</option>
              <option value="score" className="bg-[#0d111d] text-slate-200">Mejor valorados</option>
              <option value="price_asc" className="bg-[#0d111d] text-slate-200">Precio: Menor a Mayor</option>
              <option value="price_desc" className="bg-[#0d111d] text-slate-200">Precio: Mayor a Menor</option>
              <option value="rating" className="bg-[#0d111d] text-slate-200">Mejor Valorados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid Display */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {filteredProducts.map((prod) => (
            <ProductCard 
              key={prod.id} 
              product={prod} 
              onSelect={onSelectProduct} 
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10 backdrop-blur-xl mt-8 p-8 max-w-xl mx-auto shadow-2xl">
          <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">No hay productos publicados que coincidan</h3>
          <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
            {searchQuery 
              ? `No encontramos resultados para "${searchQuery}". Intenta con otros términos.`
              : `No hay productos con precio inferior a ${STORE_CURRENCY} ${priceFilter.toFixed(0)} en la categoría ${activeCategory}.`}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => {
                setPriceFilter(350);
              }}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs text-slate-200 rounded-xl border border-white/10 transition-colors"
            >
              Restablecer Filtros
            </button>
            {userProfile?.role === 'admin' && <button
              onClick={() => { if (userProfile?.role === 'admin') setViewMode('admin'); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl transition-all shadow-lg shadow-indigo-600/25"
            >
              Abrir área de gestión
            </button>}
          </div>
        </div>
      )}
    </section>
  );
};
