import React, { Suspense, lazy, useState } from 'react';
import { useApp } from './context/AppContext';

// Store Components
import { StoreHeader } from './components/store/StoreHeader';
import { HeroBanner } from './components/store/HeroBanner';
import { StoreDiscoverySections, StoreTrustSections } from './components/store/StoreExperienceSections';
import { ProductGrid } from './components/store/ProductGrid';
import { ProductDetailModal } from './components/store/ProductDetailModal';
import { CartDrawer } from './components/store/CartDrawer';
import { CheckoutModal } from './components/store/CheckoutModal';
import { CustomerAccountModal } from './components/store/CustomerAccountModal';
import { StoreFooter } from './components/store/StoreFooter';
import { WaitlistSection } from './components/store/WaitlistSection';
import { PaymentReturn } from './components/store/PaymentReturn';
import { readCatalogLocation, writeCatalogLocation } from './storefront/catalogLocation';

// Administration dedicated to actual Victoriosas operations; legacy commerce modules remain in the repository.
const ProfessionalAdminHub = lazy(() => import('./components/admin/ProfessionalAdminHub').then(module => ({ default: module.ProfessionalAdminHub })));
import { AuthModal } from './components/auth/AuthModal';

import type { Product, Order } from './types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function App() {
  const {
    viewMode,
    userRole,
    user,
    signOutUser,
    toast,
    setToast,
    isAuthModalOpen,
    setIsAuthModalOpen,
  } = useApp();

  // Never render privileged admin UI while the resolved profile is not admin.
  // Backend authorization remains authoritative; this is a fail-closed UI barrier.
  const effectiveViewMode: 'store' | 'admin' = viewMode === 'admin' && userRole !== 'admin' ? 'store' : viewMode;

  // Public Store State
  const [activeCategory, setActiveCategory] = useState(() => readCatalogLocation(window.location.search).category);
  const [searchQuery, setSearchQuery] = useState(() => readCatalogLocation(window.location.search).query);
  React.useEffect(() => {
    const href = writeCatalogLocation(window.location.href, { query: searchQuery, category: activeCategory });
    if (href !== window.location.href) window.history.replaceState(null, '', href);
  }, [activeCategory, searchQuery]);
  React.useEffect(() => {
    const restore = () => {
      const state = readCatalogLocation(window.location.search);
      setSearchQuery(state.query);
      setActiveCategory(state.category);
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<'orders' | 'wishlist'>('orders');

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (window.location.pathname.replace(/\/$/, '') === '/beauty-professional') return (
    <div className="min-h-screen bg-neutral-950 p-4 text-white">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Victoriosas · Espacio profesional</h1>
        <button className="rounded border p-3" onClick={() => setIsAuthModalOpen(true)}>{user ? 'Cambiar sesión' : 'Iniciar sesión'}</button>
        {user && <button className="rounded border p-3" onClick={() => void signOutUser()}>Cerrar sesión</button>}
      </header>
      <main className="mx-auto max-w-5xl">
        <Suspense fallback={<p role="status">Cargando espacio privado…</p>}>
          <BeautyEvaluationPanel key={user?.id || 'signed-out'} />
        </Suspense>
        <p className="text-sm">Este acceso requiere autorización profesional asignada por el responsable. No se habilita automáticamente por administrar el catálogo.</p>
      </main>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
  return (
    <div className={`${effectiveViewMode === 'store' ? 'storefront-editorial min-h-screen bg-[#f8f1e8] text-[#3b2b28] selection:bg-[#7b594c] selection:text-white' : 'min-h-screen bg-[#0a0c14] text-slate-200 selection:bg-indigo-500 selection:text-white'} font-sans flex flex-col relative overflow-x-hidden`}>
      {effectiveViewMode !== 'store' && <>
        <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="fixed bottom-10 right-10 w-[30rem] h-[30rem] bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="fixed top-1/2 right-1/3 w-80 h-80 bg-purple-600/5 rounded-full blur-3xl pointer-events-none -z-10" />
      </>}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-xs font-semibold backdrop-blur-xl ${
            toast.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30 shadow-emerald-950/40'
              : toast.type === 'error'
              ? 'bg-rose-950/80 text-rose-300 border-rose-500/30 shadow-rose-950/40'
              : 'bg-[#0d111d]/90 text-slate-200 border-white/10 shadow-black/60'
          }`}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400" />}
            <span role="status">{toast.message}</span>
            <button aria-label="Cerrar aviso" onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {effectiveViewMode === 'store' ? (
        <div className="flex-1 flex flex-col">
          <StoreHeader
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenAccount={() => { setAccountTab('orders'); setIsAccountOpen(true); }}
            onOpenWishlist={() => { setAccountTab('wishlist'); setIsAccountOpen(true); }}
          />

          <PaymentReturn />

          <main className="flex-1">
            <HeroBanner
              onExploreClick={() => scrollToSection('catalogo')}
              onEvaluationClick={() => scrollToSection('rituales')}
            />

            <ProductGrid
              activeCategory={activeCategory}
              searchQuery={searchQuery}
              onSelectProduct={(product) => setSelectedProductForModal(product)}
              onClearSearch={() => setSearchQuery('')}
              onClearFilters={() => { setSearchQuery(''); setActiveCategory('Todos'); }}
            />

            <StoreDiscoverySections onSelectCategory={setActiveCategory} />
            <StoreTrustSections onSelectCategory={setActiveCategory} />
            <WaitlistSection />
          </main>

          <StoreFooter />

          {selectedProductForModal && (
            <ProductDetailModal
              product={selectedProductForModal}
              onClose={() => setSelectedProductForModal(null)}
            />
          )}

          <CartDrawer onProceedToCheckout={() => setIsCheckoutOpen(true)} />

          {isCheckoutOpen && (
            <CheckoutModal
              onClose={() => setIsCheckoutOpen(false)}
              onOrderSuccess={(order: Order) => {
                void order;
                // Keep open on confirmation screen.
              }}
            />
          )}

          {isAccountOpen && (
            <CustomerAccountModal
              initialTab={accountTab}
              onClose={() => setIsAccountOpen(false)}
              onSelectProduct={(product) => {
                setIsAccountOpen(false);
                setSelectedProductForModal(product);
              }}
            />
          )}
        </div>
      ) : (
        <Suspense fallback={<p role="status" className="p-8">Cargando espacio de atención…</p>}>
          <ProfessionalAdminHub
            onOpenAccount={() => setIsAuthModalOpen(true)}
            sessionKey={user?.id || 'signed-out'}
          />
        </Suspense>
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        adminRequiredNotice={effectiveViewMode !== 'admin'}
      />
    </div>
  );
}

export default App;
