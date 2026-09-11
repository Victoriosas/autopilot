import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Heart, 
  User as UserIcon, 
  Sparkles, 
  ShieldCheck, 
  Truck, 
  RotateCcw,
  SlidersHorizontal,
  ArrowRight,
  Bot,
  Lock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface StoreHeaderProps {
  onOpenAccount: () => void;
  onOpenWishlist: () => void;
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
  onSearchChange
}) => {
  const { 
    cart, 
    wishlist, 
    setIsCartOpen, 
    setViewMode, 
    candidateProducts, 
    user, 
    userRole, 
    setIsAuthModalOpen 
  } = useApp();
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const pendingReviewCount = candidateProducts.filter(p => p.status === 'ready_for_review' || p.status === 'discovered').length;

  const categories = [
    'Todos',
    'Tecnología & Gadgets',
    'Hogar & Diseño',
    'Moda & Accesorios',
    'Belleza & Bienestar',
    'Fitness & Outdoor'
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0a0c14]/80 backdrop-blur-2xl border-b border-white/10 transition-all">
      {/* Top Banner Notice */}
      <div className="bg-white/[0.02] border-b border-white/5 px-4 py-1.5 text-xs text-slate-300 flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Colección Seleccionada por Victoriosa Autopilot
            </span>
            <span className="hidden md:inline-flex text-slate-600">•</span>
            <span className="hidden md:inline-flex items-center gap-1 text-slate-400">
              <Truck className="w-3.5 h-3.5 text-indigo-400" /> Envío Gratuito en pedidos superiores a $80
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Garantía Oficial 3 Años
            </span>
            <button
              onClick={() => setViewMode('admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all backdrop-blur-sm ${
                userRole === 'admin'
                  ? 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 border-indigo-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border-white/10'
              }`}
              title={userRole === 'admin' ? "Abrir Centro de Control Autopilot" : "Requiere credenciales de Administrador (Firestore RBAC)"}
            >
              {userRole === 'admin' ? <Bot className="w-3.5 h-3.5 text-indigo-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
              <span>{userRole === 'admin' ? 'Panel Autopilot' : 'Acceso Admin'}</span>
              {pendingReviewCount > 0 && userRole === 'admin' && (
                <span className="ml-1 px-1.5 py-0.2 bg-indigo-500 text-white rounded-full text-[10px] font-bold">
                  {pendingReviewCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-8">
            <div 
              onClick={() => onSelectCategory('Todos')} 
              className="cursor-pointer group flex flex-col items-start"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-serif font-black text-white text-lg shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-white/20">
                  V
                </div>
                <span className="font-serif tracking-widest text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors">
                  VICTORIOSA
                </span>
              </div>
              <span className="text-[10px] tracking-[0.25em] text-slate-400 font-medium uppercase mt-0.5 ml-11">
                Curated Living & Tech
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-lg hidden md:block">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Buscar productos en el catálogo publicado..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenWishlist}
              className="relative p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors backdrop-blur-sm"
              title="Favoritos"
            >
              <Heart className="w-5 h-5" />
              {wishlist.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-indigo-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(99,102,241,0.6)]">
                  {wishlist.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors backdrop-blur-sm"
              title="Autenticación & Control de Roles (RBAC)"
            >
              <UserIcon className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline font-mono text-xs">
                {user && !user.isAnonymous ? (user.displayName || user.email?.split('@')[0]) : 'Sesión'}
              </span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold uppercase ${
                userRole === 'admin' 
                  ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40' 
                  : 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
              }`}>
                {userRole === 'admin' ? 'Admin' : 'Cliente'}
              </span>
            </button>

            <button
              onClick={onOpenAccount}
              className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors backdrop-blur-sm"
              title="Mi Cuenta & Pedidos"
            >
              <UserIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.98] border border-white/10"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Bolsa</span>
              <span className="bg-black/40 text-indigo-300 px-2 py-0.5 rounded-full text-xs font-bold border border-white/10">
                {cartItemCount}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="pb-3 md:hidden">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar en el catálogo..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Categories Bar */}
        <nav className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar border-t border-white/5 text-sm">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all ${
                activeCategory === cat
                  ? 'bg-white/15 text-white shadow-sm border border-white/20 backdrop-blur-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};
