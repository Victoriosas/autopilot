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
  const categories = ['Todos', 'Tecnología & Gadgets', 'Hogar & Diseño', 'Moda & Accesorios', 'Belleza & Bienestar', 'Fitness & Outdoor'];

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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7b594c] to-[#b58e79] flex items-center justify-center font-serif font-black text-white text-lg shadow-[0_0_20px_rgba(123,89,76,0.25)] border border-white/20">V</div>
              <span className="font-serif tracking-widest text-2xl font-bold text-[#3b2b28] group-hover:text-[#7b594c] transition-colors">VICTORIOSA</span>
            </div>
            <span className="text-[10px] tracking-[0.25em] text-[#76635c] font-medium uppercase mt-0.5 ml-11">Belleza en calma</span>
          </button>

          <div className="flex-1 max-w-lg hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#76635c]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-10 pr-14 py-2.5 bg-white/60 border border-[#7b594c]/15 rounded-xl text-sm text-[#3b2b28] placeholder-[#9b8478] focus:outline-none focus:border-[#7b594c]/60 focus:ring-1 focus:ring-[#7b594c]/20"
              />
              {searchQuery && <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white">Limpiar</button>}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenWishlist && (
              <button onClick={onOpenWishlist} className="relative p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10" title="Favoritos">
                <Heart className="w-5 h-5" />
                {wishlist.length > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-indigo-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">{wishlist.length}</span>}
              </button>
            )}

            <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/60 hover:bg-white text-[#76635c] hover:text-[#3b2b28] border border-[#7b594c]/15" title="Cuenta">
              <UserIcon className="w-4 h-4 text-[#7b594c]" />
              <span className="hidden sm:inline text-xs">{user && !user.isAnonymous ? (user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cuenta') : 'Ingresar'}</span>
            </button>

            <button onClick={onOpenAccount} className="hidden sm:block p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10" title="Mis pedidos"><UserIcon className="w-5 h-5" /></button>

            <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-[#3b2b28] hover:bg-[#7b594c] text-white font-semibold text-sm shadow-lg shadow-[#7b594c]/20 border border-white/10">
              <ShoppingBag className="w-4 h-4" /><span className="hidden sm:inline">Bolsa</span><span className="bg-black/40 text-indigo-200 px-2 py-0.5 rounded-full text-xs font-bold">{cartItemCount}</span>
            </button>
          </div>
        </div>

        <div className="pb-3 md:hidden">
          <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar productos..." className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" /></div>
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
