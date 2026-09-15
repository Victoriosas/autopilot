import React from 'react';
import { Bot, Heart, Search, ShoppingBag, User as UserIcon } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface StoreHeaderProps {
  onOpenAccount: () => void;
  onOpenWishlist?: () => void;
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  onOpenAccount,
  onOpenWishlist,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
}) => {
  const { cart, wishlist, setIsCartOpen, setViewMode, candidateProducts, user, userRole, isAuthLoading, setIsAuthModalOpen } = useApp();
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const pendingReviewCount = candidateProducts.filter((product) => product.status === 'ready_for_review' || product.status === 'discovered').length;
  const categories = ['Todos', 'Rostro', 'Cuerpo', 'Kits'];

  const selectAndScroll = (category: string) => {
    onSelectCategory(category);
    requestAnimationFrame(() => document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#7b594c]/15 bg-[#fffaf4]/90 backdrop-blur-2xl">
      <div className="border-b border-[#7b594c]/10 bg-[#3b2b28] px-4 py-2 text-[11px] text-white/75">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <span>Apertura progresiva · las compras se habilitan solo con stock, precio y envío validados</span>
          {!isAuthLoading && userRole === 'admin' && (
            <button
              onClick={() => setViewMode('admin')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold text-white transition hover:bg-white/15"
              title="Centro de Control privado"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Panel Admin</span>
              {pendingReviewCount > 0 && <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#3b2b28]">{pendingReviewCount}</span>}
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          <button onClick={() => { onSelectCategory('Todos'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="group flex flex-col items-start text-left">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#7b594c]/30 bg-[#f6ede2] font-serif text-lg font-black text-[#7b594c]">V</div>
              <span className="font-serif text-xl font-normal tracking-[0.2em] text-[#3b2b28] transition-colors group-hover:text-[#7b594c] sm:text-2xl">VICTORIOSA</span>
            </div>
            <span className="ml-11 mt-0.5 text-[9px] font-medium uppercase tracking-[0.25em] text-[#76635c] sm:text-[10px]">Belleza en calma</span>
          </button>

          <div className="hidden max-w-lg flex-1 md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#76635c]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar en la selección..."
                aria-label="Buscar productos"
                className="w-full rounded-full border border-[#7b594c]/15 bg-[#f6ede2]/70 py-2.5 pl-10 pr-14 text-sm text-[#3b2b28] placeholder-[#9b8478] focus:border-[#7b594c]/60 focus:outline-none focus:ring-1 focus:ring-[#7b594c]/20"
              />
              {searchQuery && <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#9b8478] transition hover:text-[#3b2b28]">Limpiar</button>}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenWishlist && (
              <button onClick={onOpenWishlist} className="relative rounded-full p-2.5 text-[#76635c] transition hover:bg-[#f6ede2] hover:text-[#3b2b28]" title="Favoritos">
                <Heart className="h-5 w-5" />
                {wishlist.length > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7b594c] px-1 text-[10px] font-bold text-white">{wishlist.length}</span>}
              </button>
            )}

            <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-[#7b594c]/15 bg-white/60 px-3 py-2 text-[#76635c] transition hover:bg-white hover:text-[#3b2b28]" title="Cuenta">
              <UserIcon className="h-4 w-4 text-[#7b594c]" />
              <span className="hidden text-xs sm:inline">{user && !user.isAnonymous ? (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cuenta') : 'Ingresar'}</span>
            </button>

            <button onClick={onOpenAccount} className="hidden rounded-full p-2.5 text-[#76635c] transition hover:bg-[#f6ede2] hover:text-[#3b2b28] sm:block" title="Mis pedidos"><UserIcon className="h-5 w-5" /></button>

            <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#3b2b28] px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#7b594c]/20 transition hover:bg-[#7b594c] sm:px-4">
              <ShoppingBag className="h-4 w-4" /><span className="hidden sm:inline">Bolsa</span><span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-white">{cartItemCount}</span>
            </button>
          </div>
        </div>

        <div className="pb-3 md:hidden">
          <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#76635c]" /><input type="search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar en la selección..." aria-label="Buscar productos" className="w-full rounded-full border border-[#7b594c]/15 bg-[#f6ede2]/70 py-2 pl-10 pr-4 text-sm text-[#3b2b28] placeholder-[#9b8478] focus:border-[#7b594c]/60 focus:outline-none" /></div>
        </div>

        <nav className="flex items-center justify-between gap-4 overflow-x-auto border-t border-[#7b594c]/10 py-3 text-sm no-scrollbar" aria-label="Navegación principal">
          <div className="flex items-center gap-2">
            {categories.map((category) => (
              <button key={category} onClick={() => selectAndScroll(category)} className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 font-medium transition-all ${activeCategory === category ? 'border border-[#3b2b28] bg-[#3b2b28] text-white' : 'text-[#76635c] hover:bg-[#7b594c]/10 hover:text-[#3b2b28]'}`}>{category}</button>
            ))}
          </div>
          <div className="hidden shrink-0 items-center gap-5 text-xs text-[#76635c] lg:flex">
            <a href="#rituales" className="transition hover:text-[#3b2b28]">Guía</a>
            <a href="#como-elegimos" className="transition hover:text-[#3b2b28]">Cómo elegimos</a>
            <a href="#proximamente" className="transition hover:text-[#3b2b28]">Próximamente</a>
            <a href="#faq" className="transition hover:text-[#3b2b28]">FAQ</a>
          </div>
        </nav>
      </div>
    </header>
  );
};
