import React from 'react';
import { 
  Bot, 
  Play, 
  Search, 
  Settings, 
  History, 
  RotateCcw, 
  Store, 
  Sparkles, 
  Cpu,
  Database,
  CheckCircle2,
  Building2,
  Layers,
  Truck,
  Plug,
  AlertTriangle,
  ShieldCheck,
  User as UserIcon
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AdminHeaderProps {
  adminTab: 'pipeline' | 'fulfillment' | 'suppliers';
  onSelectAdminTab: (tab: 'pipeline' | 'fulfillment' | 'suppliers') => void;
  onOpenGlobalSearch: () => void;
  onOpenRunner: () => void;
  onOpenDiscovery: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenConnectors: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  adminTab,
  onSelectAdminTab,
  onOpenGlobalSearch,
  onOpenRunner,
  onOpenDiscovery,
  onOpenSettings,
  onOpenHistory,
  onOpenConnectors
}) => {
  const { 
    setViewMode, 
    publishedProducts, 
    suppliers,
    supplierOrders,
    unreadAlertsCount,
    isAutopilotRunning,
    resetToInitialData,
    user,
    userRole,
    setIsAuthModalOpen
  } = useApp();

  return (
    <header className="sticky top-0 z-40 bg-[#0a0c14]/85 backdrop-blur-xl border-b border-white/10">
      {/* Autopilot System Status Bar */}
      <div className="bg-white/[0.03] border-b border-white/5 px-4 py-1.5 text-xs text-slate-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              AUTOPILOT V4 SHADOW CONECTADO
            </span>
            <span className="hidden sm:inline-flex text-white/20">|</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-slate-400 font-mono text-[11px]">
              <Database className="w-3 h-3 text-indigo-400" />
              Supabase Durable Engine
            </span>
            <span className="hidden md:inline-flex text-white/20">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-slate-400 font-mono text-[11px]">
              <Cpu className="w-3 h-3 text-blue-400" />
              CJ + Market Evidence
            </span>
          </div>

          <div className="flex items-center gap-3">
            {unreadAlertsCount > 0 && (
              <button
                onClick={() => onSelectAdminTab('fulfillment')}
                className="px-2.5 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-colors animate-pulse"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{unreadAlertsCount} Alerta{unreadAlertsCount > 1 ? 's' : ''}</span>
              </button>
            )}

            <button
              onClick={() => resetToInitialData()}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              title="Restablecer catálogo base de demostración"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer</span>
            </button>

            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-2.5 py-1 rounded-full text-xs font-mono bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 backdrop-blur-md transition-all flex items-center gap-1.5"
              title="Gestionar cuenta de Administrador y RBAC"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[11px] text-slate-300 hidden sm:inline">
                {user && !user.isAnonymous ? (user.displayName || user.email?.split('@')[0]) : 'Admin Session'}
              </span>
              <span className="px-1.5 py-0.2 bg-indigo-500/30 text-indigo-300 rounded text-[9px] font-bold uppercase">
                {userRole}
              </span>
            </button>

            <button
              onClick={() => setViewMode('store')}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 backdrop-blur-md transition-all flex items-center gap-1.5 hover:border-indigo-400/40"
            >
              <Store className="w-3.5 h-3.5 text-indigo-400" />
              <span>Ver Tienda Pública ({publishedProducts.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Admin Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-serif font-black text-white text-xl shadow-lg shadow-indigo-500/25 border border-indigo-400/30">
                V
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif tracking-widest text-xl font-bold text-white">
                    VICTORIOSA
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase backdrop-blur-sm">
                    Autopilot Hub
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono">
                  Descubrimiento, Verificación de Suministro y Fulfillment Real
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="hidden lg:flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-xl ml-4 backdrop-blur-md">
              <button
                onClick={() => onSelectAdminTab('pipeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  adminTab === 'pipeline'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Pipeline Productos</span>
              </button>

              <button
                onClick={() => onSelectAdminTab('fulfillment')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 relative ${
                  adminTab === 'fulfillment'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Fulfillment & Compras</span>
                {supplierOrders.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-white/20 text-white">
                    {supplierOrders.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelectAdminTab('suppliers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  adminTab === 'suppliers'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Proveedores ({suppliers.length})</span>
              </button>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Search Button */}
            <button
              onClick={onOpenGlobalSearch}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 backdrop-blur-md transition-all flex items-center gap-2.5 hover:border-indigo-500/40 group shadow-sm"
              title="Buscar en todo el panel de administración (⌘K / Ctrl+K)"
            >
              <Search className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="hidden xl:inline text-slate-300">Buscar en Admin...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-400 border border-white/10 group-hover:text-slate-200">
                <span>⌘</span>
                <span>K</span>
              </kbd>
            </button>

            {/* Connectors Hub Button */}
            <button
              onClick={onOpenConnectors}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 backdrop-blur-md transition-all flex items-center gap-2 hover:border-white/20"
              title="Directorio y Auditoría de Conectores"
            >
              <Plug className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Conectores</span>
            </button>

            <button
              onClick={onOpenDiscovery}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 backdrop-blur-md transition-all flex items-center gap-2 hover:border-white/20"
              title="Descubrir nuevos candidatos o importar URL"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Descubrir</span>
            </button>

            <button
              onClick={onOpenHistory}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 backdrop-blur-md transition-all flex items-center gap-2 hover:border-white/20"
              title="Historial de Ejecuciones del Autopilot"
            >
              <History className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline">Ejecuciones</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 backdrop-blur-md transition-all flex items-center gap-2 hover:border-white/20"
              title="Reglas de Negocio y Configuración"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="hidden md:inline">Configuración</span>
            </button>

            <button
              onClick={onOpenRunner}
              disabled={isAutopilotRunning}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-500/25 active:scale-95 flex items-center gap-2 disabled:opacity-50 border border-indigo-400/30"
            >
              {isAutopilotRunning ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Ejecutar Autopilot</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* Mobile Sub-Navigation Tabs */}
        <div className="flex lg:hidden items-center gap-2 pb-3 border-t border-white/5 pt-2">
          <button
            onClick={() => onSelectAdminTab('pipeline')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
              adminTab === 'pipeline'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400'
            }`}
          >
            Pipeline
          </button>
          <button
            onClick={() => onSelectAdminTab('fulfillment')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
              adminTab === 'fulfillment'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400'
            }`}
          >
            Fulfillment ({supplierOrders.length})
          </button>
          <button
            onClick={() => onSelectAdminTab('suppliers')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
              adminTab === 'suppliers'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white/5 text-slate-400'
            }`}
          >
            Proveedores ({suppliers.length})
          </button>
        </div>

      </div>
    </header>
  );
};
