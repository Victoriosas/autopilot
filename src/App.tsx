import React, { useState } from 'react';
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

// Admin Components
import { AdminHeader } from './components/admin/AdminHeader';
import { AutopilotDashboard } from './components/admin/AutopilotDashboard';
import { SupplierManagement } from './components/admin/SupplierManagement';
import { FulfillmentOrdersTable } from './components/admin/FulfillmentOrdersTable';
import { CandidateDetailModal } from './components/admin/CandidateDetailModal';
import { AutopilotRunnerModal } from './components/admin/AutopilotRunnerModal';
import { AutopilotSettingsModal } from './components/admin/AutopilotSettingsModal';
import { AutopilotHistoryModal } from './components/admin/AutopilotHistoryModal';
import { ConnectorsDirectoryModal } from './components/admin/ConnectorsDirectoryModal';
import { GlobalAdminSearchModal } from './components/admin/GlobalAdminSearchModal';
import { ReleaseReadinessCard } from './components/admin/ReleaseReadinessCard';
import { AuthModal } from './components/auth/AuthModal';

import type { Product, Order } from './types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export function App() {
  const {
    viewMode,
    userRole,
    products,
    selectedCandidateForReview,
    setSelectedCandidateForReview,
    toast,
    setToast,
    isAuthModalOpen,
    setIsAuthModalOpen,
  } = useApp();

  // Never render privileged admin UI while the resolved profile is not admin.
  // Backend authorization remains authoritative; this is a fail-closed UI barrier.
  const effectiveViewMode: 'store' | 'admin' = viewMode === 'admin' && userRole !== 'admin' ? 'store' : viewMode;

  // Public Store State
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  // Admin State & Modals
  const [adminTab, setAdminTab] = useState<'pipeline' | 'fulfillment' | 'suppliers'>('pipeline');
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isRunnerOpen, setIsRunnerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isConnectorsOpen, setIsConnectorsOpen] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && effectiveViewMode === 'admin') {
        event.preventDefault();
        setIsGlobalSearchOpen((previous) => !previous);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [effectiveViewMode]);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
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
            onOpenAccount={() => setIsAccountOpen(true)}
          />

          <main className="flex-1">
            <HeroBanner
              onExploreClick={() => scrollToSection('descubrir')}
              onEvaluationClick={() => scrollToSection('rituales')}
            />

            <StoreDiscoverySections onSelectCategory={setActiveCategory} />

            <ProductGrid
              activeCategory={activeCategory}
              searchQuery={searchQuery}
              onSelectProduct={(product) => setSelectedProductForModal(product)}
              onClearSearch={() => setSearchQuery('')}
            />

            <StoreTrustSections onSelectCategory={setActiveCategory} />
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
              onClose={() => setIsAccountOpen(false)}
              onSelectProduct={(product) => {
                setIsAccountOpen(false);
                setSelectedProductForModal(product);
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-neutral-950">
          <AdminHeader
            adminTab={adminTab}
            onSelectAdminTab={setAdminTab}
            onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
            onOpenDiscovery={() => setIsRunnerOpen(true)}
            onOpenRunner={() => setIsRunnerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenConnectors={() => setIsConnectorsOpen(true)}
          />

          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <ReleaseReadinessCard />
            {adminTab === 'pipeline' ? (
              <AutopilotDashboard
                onInspectCandidate={(product) => setSelectedCandidateForReview(product)}
                onOpenDiscovery={() => setIsRunnerOpen(true)}
                onOpenRunner={() => setIsRunnerOpen(true)}
              />
            ) : adminTab === 'fulfillment' ? (
              <FulfillmentOrdersTable />
            ) : (
              <SupplierManagement
                onOpenProductDetail={(productId) => {
                  const found = products.find((product) => product.id === productId);
                  if (found) setSelectedCandidateForReview(found);
                }}
              />
            )}
          </main>

          <GlobalAdminSearchModal
            isOpen={isGlobalSearchOpen}
            onClose={() => setIsGlobalSearchOpen(false)}
            onSelectProduct={(product) => setSelectedCandidateForReview(product)}
            onSelectSupplier={() => setAdminTab('suppliers')}
            onSelectRun={() => setIsHistoryOpen(true)}
            onOpenDiscovery={() => setIsRunnerOpen(true)}
            onOpenRunner={() => setIsRunnerOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onSelectAdminTab={setAdminTab}
          />

          {selectedCandidateForReview && (
            <CandidateDetailModal product={selectedCandidateForReview} onClose={() => setSelectedCandidateForReview(null)} />
          )}

          {isRunnerOpen && <AutopilotRunnerModal onClose={() => setIsRunnerOpen(false)} />}
          {isSettingsOpen && <AutopilotSettingsModal onClose={() => setIsSettingsOpen(false)} />}
          {isHistoryOpen && <AutopilotHistoryModal onClose={() => setIsHistoryOpen(false)} />}
          {isConnectorsOpen && <ConnectorsDirectoryModal onClose={() => setIsConnectorsOpen(false)} />}
        </div>
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