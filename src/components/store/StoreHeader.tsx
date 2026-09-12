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
  const categories = ['Todos', 'Rostro', 'Cuerpo', 'Kits', 'Asesoría'];

  return (
    <header className="sticky top-0 z-40 bg-[#fffaf4]/90 backdrop-blur-2xl border-b border-[#7b594c]/15">
      <div className="bg-[#fffaf4]/70 border-b border-[#7b594c]/10 px-4 py-1.5 text-xs text-[#76635c]">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
          <span>Catálogo en preparación · pagos todavía no habilitados</span>
          {!isAuthLoading && userRole === 'admin' && (
            <button
              onClick={() => setViewMode('admin')}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#7b594c]/10 text-[#7b594c] hover:bg-[#7b594c]/20 border border-[#7b594c]/20"
              title="Centro de Control privado"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Panel Admin</span>
              {pendingReviewCount > 0 && <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white rounded-full text-[10px] font-bold">{pendingReviewCount}</span>}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          <button onClick={() => onSelectCategory('Todos')} className="group flex flex-col items-start text-left">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#7b594c]/30 bg-[#f6ede2] font-serif text-lg font-black text-[#7b594c]">V</div>
              <span className="font-serif text-2xl font-normal tracking-[0.22em] text-[#3b2b28] transition-colors group-hover:text-[#7b594c]">VICTORIOSA</span>
            </div>
            <span className="ml-11 mt-0.5 text-[10px] font-medium uppercase tracking-[0.25em] text-[#76635c]">Belleza en calma</span>
          </button>

          <div className="hidden max-w-lg flex-1 md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#76635c]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar productos..."
                className="w-full rounded-full border border-[#7b594c]/15 bg-[#f6ede2]/70 py-2.5 pl-10 pr-14 text-sm text-[#3b2b28] placeholder-[#9b8478] focus:border-[#7b594c]/60 focus:outline-none focus:ring-1 focus:ring-[#7b594c]/20"
              />
              {searchQuery && <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white">Limpiar</button>}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenWishlist && (
              <button onClick={onOpenWishlist} className="relative rounded-full p-2.5 text-[#76635c] hover:bg-[#f6ede2] hover:text-[#3b2b28]" title="Favoritos">
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7b594c] px-1 text-[10px] font-bold text-white">{wishlist.length}</span>}
              </button>
            )}

            <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/60 hover:bg-white text-[#76635c] hover:text-[#3b2b28] border border-[#7b594c]/15" title="Cuenta">
              <UserIcon className="w-4 h-4 text-[#7b594c]" />
              <span className="hidden sm:inline text-xs">{user && !user.isAnonymous ? (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cuenta') : 'Ingresar'}</span>
            </button>

            <button onClick={onOpenAccount} className="hidden rounded-full p-2.5 text-[#76635c] hover:bg-[#f6ede2] hover:text-[#3b2b28] sm:block" title="Mis pedidos"><UserIcon className="h-5 w-5" /></button>

            <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-[#3b2b28] hover:bg-[#7b594c] text-white font-semibold text-sm shadow-lg shadow-[#7b594c]/20 border border-white/10">
              <ShoppingBag className="h-4 w-4" /><span className="hidden sm:inline">Bolsa</span><span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-bold text-white">{cartItemCount}</span>
            </button>
          </div>
        </div>

        <div className="pb-3 md:hidden">
          <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#76635c]" /><input type="text" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar productos..." className="w-full rounded-full border border-[#7b594c]/15 bg-[#f6ede2]/70 py-2 pl-10 pr-4 text-sm text-[#3b2b28] placeholder-[#9b8478] focus:border-[#7b594c]/60 focus:outline-none" /></div>
        </div>

        <nav className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar border-t border-[#7b594c]/10 text-sm">
          {categories.map((category) => (
            <button key={category} onClick={() => onSelectCategory(category)} className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${activeCategory === category ? 'bg-[#3b2b28] text-white border border-[#3b2b28]' : 'text-[#76635c] hover:text-[#3b2b28] hover:bg-[#7b594c]/10'}`}>{category}</button>
          ))}
        </nav>
      </div>
    </header>
  );
};
