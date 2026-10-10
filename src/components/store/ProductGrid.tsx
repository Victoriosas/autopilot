import React, { useEffect, useMemo, useState } from 'react';
import { ProductCard } from './ProductCard';
import { ArrowRight, SearchX, SlidersHorizontal, Sparkles } from 'lucide-react';
import { STORE_CURRENCY } from '../../services/revenue';
import { useApp } from '../../context/AppContext';
import type { Product } from '../../types';
import { discoverProducts, ROUTINES, type CatalogSort, type Routine } from '../../storefront/catalogDiscovery';

interface ProductGridProps {
  activeCategory: string;
  searchQuery: string;
  onSelectProduct: (p: Product) => void;
  onClearSearch?: () => void;
  onClearFilters?: () => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  activeCategory,
  searchQuery,
  onSelectProduct,
  onClearSearch,
  onClearFilters,
}) => {
  const { publishedProducts, setViewMode, userProfile } = useApp();
  const [sortBy, setSortBy] = useState<CatalogSort>('featured');
  const [routine, setRoutine] = useState<Routine>('all');
  const [inStockOnly, setInStockOnly] = useState(false);

  const isUyu = STORE_CURRENCY === 'UYU';
  const priceStep = isUyu ? 500 : 25;
  const baseMaximum = isUyu ? 10000 : 500;
  const catalogMaximum = useMemo(
    () => publishedProducts.reduce((max, product) => product.status === 'published' && Number.isFinite(product.price) ? Math.max(max, product.price) : max, 0),
    [publishedProducts],
  );
  const sliderMaximum = Math.max(baseMaximum, Math.ceil(catalogMaximum / priceStep) * priceStep || baseMaximum);
  const [priceFilter, setPriceFilter] = useState(baseMaximum);

  useEffect(() => {
    if (publishedProducts.length > 0) setPriceFilter(sliderMaximum);
  }, [publishedProducts.length, sliderMaximum]);

  const filteredProducts = useMemo(() => discoverProducts(publishedProducts, {
    category: activeCategory, query: searchQuery, maximumPrice: priceFilter,
    sort: sortBy, routine, inStockOnly,
  }), [publishedProducts, activeCategory, searchQuery, sortBy, priceFilter, routine, inStockOnly]);
  const clearFilters = () => {
    setPriceFilter(sliderMaximum);
    setRoutine('all');
    setInStockOnly(false);
    setSortBy('featured');
    (onClearFilters ?? onClearSearch)?.();
  };
  const hasFilters = activeCategory !== 'Todos' || sortBy !== 'featured' || routine !== 'all' || inStockOnly || priceFilter < sliderMaximum || Boolean(searchQuery.trim());

  const hasPublishedProducts = publishedProducts.some((product) => product.status === 'published');

  return (
    <section id="catalogo" className="bg-[#f8f1e8] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 border-b border-[#7b594c]/15 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9c7868]">Selección pública</p>
            <h2 className="mt-2 flex flex-wrap items-center gap-2 font-serif text-3xl text-[#3b2b28]">
              <span>{activeCategory === 'Todos' ? 'Catálogo Victoriosa' : activeCategory}</span>
              <span role="status" aria-live="polite" className="rounded-full border border-[#7b594c]/15 bg-[#7b594c]/10 px-2.5 py-0.5 font-mono text-xs font-normal text-[#7b594c]">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'producto' : 'productos'}
              </span>
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#76635c]">Encontrá tu punto de partida: cuidado diario, herramientas y pequeños momentos de spa en casa.</p>
          </div>

          {hasPublishedProducts && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2 rounded-full border border-[#7b594c]/15 bg-[#fffaf4] px-3.5 py-2">
                <span className="text-[#9b8478]">Hasta</span>
                <span className="font-semibold text-[#3b2b28]">{STORE_CURRENCY} {priceFilter.toLocaleString('es-UY')}</span>
                <input
                  type="range"
                  min={0}
                  max={sliderMaximum}
                  step={priceStep}
                  value={priceFilter}
                  onChange={(event) => setPriceFilter(Number(event.target.value))}
                  className="w-20 cursor-pointer accent-[#7b594c]"
                  aria-label="Precio máximo"
                  aria-valuetext={`${STORE_CURRENCY} ${priceFilter.toLocaleString('es-UY')}`}
                />
              </div>

              <div className="flex items-center gap-2 rounded-full border border-[#7b594c]/15 bg-[#fffaf4] px-3.5 py-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#9b8478]" />
                <select aria-label="Ordenar productos" value={sortBy} onChange={(event) => setSortBy(event.target.value as CatalogSort)} className="min-h-8 max-w-full cursor-pointer bg-transparent text-xs text-[#3b2b28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7b594c]">
                  <option value="featured">Orden del catálogo</option>
                  <option value="price_asc">Precio: menor a mayor</option>
                  <option value="price_desc">Precio: mayor a menor</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {hasPublishedProducts && (
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div role="group" aria-label="Elegir tipo de rutina" className="flex flex-wrap gap-2">
              {ROUTINES.map(option => (
                <button key={option.value} type="button" aria-pressed={routine === option.value} onClick={() => setRoutine(option.value)} className={`min-h-11 rounded-full border px-4 py-2 text-xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7b594c] ${routine === option.value ? 'border-[#3b2b28] bg-[#3b2b28] text-white' : 'border-[#7b594c]/20 bg-[#fffaf4] text-[#3b2b28] hover:bg-[#efe3d4]'}`}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#3b2b28]">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                <input type="checkbox" checked={inStockOnly} onChange={event => setInStockOnly(event.target.checked)} className="h-4 w-4 accent-[#7b594c]" />
                Con unidades registradas
              </label>
              {hasFilters && <button type="button" onClick={clearFilters} className="min-h-11 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7b594c]">Limpiar filtros</button>}
            </div>
          </div>
        )}

        {filteredProducts.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => <ProductCard key={product.id} product={product} onSelect={onSelectProduct} />)}
          </div>
        ) : !hasPublishedProducts ? (
          <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#7b594c]/15 bg-[#fffaf4]">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_.9fr]">
              <div className="p-8 sm:p-10 lg:p-12">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#7b594c]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7b594c]"><Sparkles className="h-3.5 w-3.5" /> Curaduría en curso</div>
                <h3 className="mt-5 max-w-2xl font-serif text-3xl leading-tight text-[#3b2b28] sm:text-4xl">Estamos preparando nuestra selección.</h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#76635c]">Preferimos mostrarte una colección pequeña y explicable antes que llenar la página con productos sin verificar. Mientras abrimos el catálogo, podés recorrer cómo seleccionamos y qué categorías estamos preparando.</p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a href="#proximamente" className="inline-flex items-center gap-2 rounded-full bg-[#3b2b28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#7b594c]">Ver lo que viene <ArrowRight className="h-4 w-4" /></a>
                  <a href="#como-elegimos" className="rounded-full border border-[#7b594c]/20 px-5 py-3 text-sm font-semibold text-[#3b2b28] transition hover:bg-[#f8f1e8]">Cómo elegimos</a>
                  {userProfile?.role === 'admin' && <button onClick={() => setViewMode('admin')} className="rounded-full border border-[#7b594c]/20 px-5 py-3 text-sm font-semibold text-[#7b594c]">Abrir gestión</button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-[#7b594c]/10">
                {['Accesorios skincare', 'Cuidado facial', 'Organización', 'Kits'].map((label, index) => (
                  <div key={label} className="flex min-h-32 items-end bg-[#efe3d4] p-5"><span className="font-serif text-lg text-[#3b2b28]"><span className="mr-2 text-xs text-[#9c7868]">0{index + 1}</span>{label}</span></div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-8 max-w-xl rounded-[2rem] border border-[#7b594c]/15 bg-[#fffaf4] p-8 text-center">
            <SearchX className="mx-auto h-10 w-10 text-[#b58e79]" />
            <h3 className="mt-4 font-serif text-2xl text-[#3b2b28]">No encontramos una coincidencia</h3>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#76635c]">{searchQuery ? `No hay resultados publicados para “${searchQuery}”. Probá con un término más general.` : 'Los filtros actuales no dejan productos visibles. Podés ampliar el precio máximo o volver a ver toda la selección.'}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={clearFilters} className="min-h-11 rounded-full border border-[#7b594c]/20 px-4 py-2 text-xs font-semibold text-[#3b2b28]">Limpiar filtros</button>
              {searchQuery && onClearSearch && <button onClick={onClearSearch} className="rounded-full bg-[#3b2b28] px-4 py-2 text-xs font-semibold text-white">Limpiar búsqueda</button>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
