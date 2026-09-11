import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  Package, 
  Building2, 
  History, 
  Zap, 
  ArrowRight, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Play, 
  Store, 
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Tag,
  ExternalLink,
  Layers,
  CornerDownLeft,
  Command
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Product, Supplier, AutopilotRun } from '../../types';

interface GlobalAdminSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  onSelectSupplier: (supplier: Supplier) => void;
  onSelectRun: (run: AutopilotRun) => void;
  onOpenDiscovery: () => void;
  onOpenRunner: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onSelectAdminTab: (tab: 'pipeline' | 'suppliers') => void;
}

type SearchCategory = 'all' | 'products' | 'suppliers' | 'logs' | 'actions';

interface SearchResultItem {
  id: string;
  type: 'product' | 'supplier' | 'run' | 'action';
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  tag?: string;
  icon: React.ReactNode;
  data?: any;
  action?: () => void;
}

export const GlobalAdminSearchModal: React.FC<GlobalAdminSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
  onSelectSupplier,
  onSelectRun,
  onOpenDiscovery,
  onOpenRunner,
  onOpenSettings,
  onOpenHistory,
  onSelectAdminTab
}) => {
  const { products, suppliers, runs, setViewMode } = useApp();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Quick Actions List
  const quickActions: SearchResultItem[] = useMemo(() => [
    {
      id: 'action-run-autopilot',
      type: 'action',
      title: 'Ejecutar Misión de Autopilot',
      subtitle: 'Lanzar pipeline autónomo de descubrimiento, análisis con Gemini y publicación',
      badge: 'Acción Rápida',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: <Play className="w-4 h-4 text-indigo-400" />,
      action: () => {
        onClose();
        onOpenRunner();
      }
    },
    {
      id: 'action-discovery',
      type: 'action',
      title: 'Descubrir Nuevos Candidatos',
      subtitle: 'Escanear marketplaces globales con filtros de tendencia y nicho',
      badge: 'Acción Rápida',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: <Search className="w-4 h-4 text-indigo-400" />,
      action: () => {
        onClose();
        onOpenDiscovery();
      }
    },
    {
      id: 'action-suppliers-tab',
      type: 'action',
      title: 'Gestionar Proveedores Homologados',
      subtitle: 'Administrar acuerdos B2B, métricas de fiabilidad y almacenes',
      badge: 'Navegación',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: <Building2 className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onClose();
        onSelectAdminTab('suppliers');
      }
    },
    {
      id: 'action-pipeline-tab',
      type: 'action',
      title: 'Ir al Pipeline Kanban de Productos',
      subtitle: 'Ver candidatos por etapas: Descubiertos, Analizando, Validación, Publicados',
      badge: 'Navegación',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: <Layers className="w-4 h-4 text-blue-400" />,
      action: () => {
        onClose();
        onSelectAdminTab('pipeline');
      }
    },
    {
      id: 'action-settings',
      type: 'action',
      title: 'Configuración y Reglas del Autopilot',
      subtitle: 'Umbrales de aprobación IA, márgenes mínimos y palabras clave bloqueadas',
      badge: 'Ajustes',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: <Sliders className="w-4 h-4 text-amber-400" />,
      action: () => {
        onClose();
        onOpenSettings();
      }
    },
    {
      id: 'action-history',
      type: 'action',
      title: 'Auditoría e Historial de Ejecuciones',
      subtitle: 'Ver registro de misiones pasadas, logs de eventos y estadísticas globales',
      badge: 'Auditoría',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: <History className="w-4 h-4 text-purple-400" />,
      action: () => {
        onClose();
        onOpenHistory();
      }
    },
    {
      id: 'action-view-store',
      type: 'action',
      title: 'Ver Tienda Pública Victoriosa',
      subtitle: 'Cambiar a la experiencia de compra para clientes finales',
      badge: 'Tienda',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      icon: <Store className="w-4 h-4 text-rose-400" />,
      action: () => {
        onClose();
        setViewMode('store');
      }
    }
  ], [onClose, onOpenDiscovery, onOpenRunner, onOpenSettings, onOpenHistory, onSelectAdminTab, setViewMode]);

  // Product Status Labels and Colors
  const getProductStatusInfo = (status: string) => {
    switch (status) {
      case 'published':
        return { label: 'En Tienda', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'approved':
      case 'ready_for_review':
        return { label: 'Listo p/ Revisión', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
      case 'validated':
        return { label: 'Validado IA', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'analyzing':
        return { label: 'En Análisis', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'rejected':
        return { label: 'Descartado', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
      default:
        return { label: 'Descubierto', color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
    }
  };

  // Filtered Results Calculation
  const { productResults, supplierResults, runResults, actionResults } = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1. Products
    const pResults: SearchResultItem[] = products
      .filter((p) => {
        if (!q) return true;
        const inTitle = p.title.toLowerCase().includes(q);
        const inOrig = (p.originalTitle || '').toLowerCase().includes(q);
        const inCategory = (p.category || '').toLowerCase().includes(q);
        const inSupplier = (p.traceability?.supplier?.name || '').toLowerCase().includes(q);
        const inTags = (p.tags || []).some((t) => t.toLowerCase().includes(q));
        const inStatus = p.status.toLowerCase().includes(q);
        const inSku = (p.traceability?.source?.sku || '').toLowerCase().includes(q);
        return inTitle || inOrig || inCategory || inSupplier || inTags || inStatus || inSku;
      })
      .map((p) => {
        const st = getProductStatusInfo(p.status);
        const price = p.pricing?.retailPrice || p.traceability?.pricing?.retailPrice || 0;
        const margin = p.pricing?.targetMarginPct || p.traceability?.pricing?.targetMarginPct || 0;
        const supplierName = p.traceability?.supplier?.name || 'Proveedor Homologado';

        return {
          id: `product-${p.id}`,
          type: 'product' as const,
          title: p.title,
          subtitle: `${p.category} • ${supplierName} • €${price.toFixed(2)} (${margin}% margen)`,
          badge: st.label,
          badgeColor: st.color,
          tag: p.traceability?.analysis?.scoreTier ? `Score ${p.traceability.analysis.scoreTier}` : undefined,
          icon: p.media?.mainImage ? (
            <img 
              src={p.media.mainImage} 
              alt={p.title} 
              className="w-9 h-9 rounded-lg object-cover border border-white/10"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Package className="w-4 h-4" />
            </div>
          ),
          data: p,
          action: () => {
            onClose();
            onSelectProduct(p);
          }
        };
      });

    // 2. Suppliers
    const sResults: SearchResultItem[] = suppliers
      .filter((s) => {
        if (!q) return true;
        const inName = s.name.toLowerCase().includes(q);
        const inCode = s.code.toLowerCase().includes(q);
        const inCountry = s.contact.country.toLowerCase().includes(q);
        const inContact = (s.contact.contactName || s.contact.representative || '').toLowerCase().includes(q);
        const inEmail = s.contact.email.toLowerCase().includes(q);
        const inCat = s.catalogs.categories.some((c) => c.toLowerCase().includes(q));
        const inType = (s.supplierType || '').toLowerCase().includes(q);
        return inName || inCode || inCountry || inContact || inEmail || inCat || inType;
      })
      .map((s) => {
        const prodCount = products.filter(p => p.traceability?.supplier?.name === s.name).length;
        return {
          id: `supplier-${s.id}`,
          type: 'supplier' as const,
          title: s.name,
          subtitle: `Código: ${s.code} • ${s.contact.country} • Descuento: ${s.pricingAgreements.baseDiscountPct}% • ${prodCount} productos`,
          badge: s.status === 'active' ? 'Activo' : s.status === 'evaluating' ? 'En Evaluación' : 'Restringido',
          badgeColor: s.status === 'active' 
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
            : 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          tag: `Fiabilidad ${s.metrics.reliabilityScore}%`,
          icon: (
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Building2 className="w-4 h-4" />
            </div>
          ),
          data: s,
          action: () => {
            onClose();
            onSelectAdminTab('suppliers');
            onSelectSupplier(s);
          }
        };
      });

    // 3. Execution Runs & Logs
    const rResults: SearchResultItem[] = [];
    runs.forEach((r) => {
      const matchInId = r.id.toLowerCase().includes(q);
      const matchInTrigger = (r.trigger || '').toLowerCase().includes(q);
      const matchInStatus = r.status.toLowerCase().includes(q);
      const matchingLog = (r.logs || []).find((l) => {
        const text = typeof l === 'string' ? l : (l.message || '');
        return text.toLowerCase().includes(q);
      });

      if (!q || matchInId || matchInTrigger || matchInStatus || matchingLog) {
        const logSnippet = matchingLog 
          ? (typeof matchingLog === 'string' ? matchingLog : matchingLog.message)
          : `${r.itemsProcessed} procesados • ${r.itemsApproved} aprobados • ${r.itemsPublished} publicados`;

        rResults.push({
          id: `run-${r.id}`,
          type: 'run' as const,
          title: `Misión Autopilot #${r.id.slice(-6).toUpperCase()}`,
          subtitle: `${new Date(r.startedAt).toLocaleString('es-ES')} • ${logSnippet}`,
          badge: r.status === 'completed' ? 'Completada' : r.status === 'running' ? 'En Ejecución' : 'Fallida',
          badgeColor: r.status === 'completed' 
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
            : r.status === 'running'
            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
            : 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          tag: r.trigger === 'manual' ? 'Manual' : 'Automatizado',
          icon: (
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <History className="w-4 h-4" />
            </div>
          ),
          data: r,
          action: () => {
            onClose();
            onSelectRun(r);
          }
        });
      }
    });

    // 4. Quick Actions
    const aResults = quickActions.filter((a) => {
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q);
    });

    return {
      productResults: pResults,
      supplierResults: sResults,
      runResults: rResults,
      actionResults: aResults
    };
  }, [products, suppliers, runs, query, quickActions, onClose, onSelectProduct, onSelectSupplier, onSelectRun, onSelectAdminTab]);

  // Combined Results based on active tab
  const activeResults = useMemo(() => {
    switch (activeCategory) {
      case 'products':
        return productResults;
      case 'suppliers':
        return supplierResults;
      case 'logs':
        return runResults;
      case 'actions':
        return actionResults;
      case 'all':
      default:
        return [
          ...actionResults.slice(0, 3),
          ...productResults.slice(0, 10),
          ...supplierResults.slice(0, 6),
          ...runResults.slice(0, 6)
        ];
    }
  }, [activeCategory, productResults, supplierResults, runResults, actionResults]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < activeResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : activeResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeResults[selectedIndex]) {
        activeResults[selectedIndex].action?.();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const totalCount = productResults.length + supplierResults.length + runResults.length + actionResults.length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-3xl bg-[#0c101d] border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header Bar */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Search className="w-5 h-5" />
          </div>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Buscar productos, SKUs, proveedores, logs o ejecutar acciones..."
              className="w-full bg-transparent text-white placeholder-slate-400 text-sm sm:text-base font-medium focus:outline-none pr-8"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
            <span className="text-slate-300">ESC</span>
            <span>cerrar</span>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 border-b border-white/5 bg-white/[0.01] overflow-x-auto text-xs">
          <button
            onClick={() => {
              setActiveCategory('all');
              setSelectedIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveCategory('products');
              setSelectedIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeCategory === 'products'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Productos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {productResults.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveCategory('suppliers');
              setSelectedIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeCategory === 'suppliers'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Proveedores</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {supplierResults.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveCategory('logs');
              setSelectedIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeCategory === 'logs'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Misiones & Logs</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {runResults.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveCategory('actions');
              setSelectedIndex(0);
            }}
            className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeCategory === 'actions'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Acciones</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-mono">
              {actionResults.length}
            </span>
          </button>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5 focus:outline-none"
        >
          {activeResults.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mx-auto mb-3">
                <Search className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-300">
                No se encontraron resultados para "{query}"
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Prueba buscando por título, SKU, nombre de proveedor, categoría de moda o palabras clave de misiones.
              </p>
            </div>
          ) : (
            activeResults.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => item.action?.()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 border ${
                    isSelected
                      ? 'bg-indigo-600/15 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {item.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs sm:text-sm font-semibold truncate ${
                          isSelected ? 'text-white' : 'text-slate-200'
                        }`}>
                          {item.title}
                        </span>

                        {item.badge && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${
                            item.badgeColor || 'bg-white/10 text-slate-300 border-white/10'
                          }`}>
                            {item.badge}
                          </span>
                        )}

                        {item.tag && (
                          <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/5 text-slate-400 border border-white/5 flex-shrink-0">
                            {item.tag}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                    {isSelected && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-indigo-300 font-mono bg-indigo-500/20 px-2 py-1 rounded-md border border-indigo-500/30">
                        <CornerDownLeft className="w-3 h-3" />
                        Enter
                      </span>
                    )}
                    <ChevronRight className={`w-4 h-4 transition-transform ${
                      isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600'
                    }`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="p-3 border-t border-white/10 bg-black/40 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">↓</kbd>
              <span>para navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">↵</kbd>
              <span>para seleccionar</span>
            </span>
            <span className="hidden sm:flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px]">⌘K</kbd>
              <span>acceso rápido global</span>
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {activeResults.length} elementos encontrados
          </div>
        </div>

      </div>
    </div>
  );
};
