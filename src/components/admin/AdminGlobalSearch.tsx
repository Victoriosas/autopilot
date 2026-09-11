import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Package, 
  Truck, 
  Layers, 
  Building2, 
  Sparkles, 
  X, 
  ExternalLink, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Product, Supplier, SupplierOrder, Order } from '../../types';

interface AdminGlobalSearchProps {
  onSelectProduct?: (product: Product) => void;
  onSelectSupplier?: (supplier: Supplier) => void;
  onNavigateTab?: (tabName: string) => void;
}

export const AdminGlobalSearch: React.FC<AdminGlobalSearchProps> = ({ 
  onSelectProduct, 
  onSelectSupplier,
  onNavigateTab
}) => {
  const { products, candidateProducts, suppliers, orders, supplierOrders, runs } = useApp();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmed = query.trim().toLowerCase();

  const matchedPublished = trimmed ? products.filter(p => 
    p.title.toLowerCase().includes(trimmed) ||
    p.sku.toLowerCase().includes(trimmed) ||
    p.category.toLowerCase().includes(trimmed)
  ).slice(0, 4) : [];

  const matchedCandidates = trimmed ? candidateProducts.filter(c => 
    c.title.toLowerCase().includes(trimmed) ||
    c.originalTitle?.toLowerCase().includes(trimmed) ||
    c.sku.toLowerCase().includes(trimmed)
  ).slice(0, 4) : [];

  const matchedSuppliers = trimmed ? suppliers.filter(s => 
    s.name.toLowerCase().includes(trimmed) ||
    s.code.toLowerCase().includes(trimmed) ||
    s.catalogs.categories.some(cat => cat.toLowerCase().includes(trimmed))
  ).slice(0, 3) : [];

  const matchedSupplierOrders = trimmed ? supplierOrders.filter(so => 
    so.id.toLowerCase().includes(trimmed) ||
    so.orderId.toLowerCase().includes(trimmed) ||
    so.productTitle.toLowerCase().includes(trimmed) ||
    so.customerShippingAddress.fullName.toLowerCase().includes(trimmed)
  ).slice(0, 3) : [];

  const hasResults = matchedPublished.length > 0 || matchedCandidates.length > 0 || matchedSuppliers.length > 0 || matchedSupplierOrders.length > 0;

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Búsqueda global (SKU, producto, proveedor, orden)..."
          className="w-full pl-9 pr-9 py-2 bg-white/5 border border-white/10 hover:border-white/20 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
            }}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && trimmed.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#0d111d]/95 border border-white/15 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-2xl max-h-[75vh] overflow-y-auto divide-y divide-white/10 text-xs">
          
          {!hasResults && (
            <div className="p-6 text-center text-slate-500">
              No se encontraron coincidencias para "{query}"
            </div>
          )}

          {/* Published Products */}
          {matchedPublished.length > 0 && (
            <div className="p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-400" />
                <span>Productos en Catálogo ({matchedPublished.length})</span>
              </div>
              <div className="space-y-1">
                {matchedPublished.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      if (onSelectProduct) onSelectProduct(p);
                      if (onNavigateTab) onNavigateTab('products');
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={p.images[0]} alt={p.title} className="w-8 h-8 rounded-lg object-cover bg-white/5 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate text-xs group-hover:text-indigo-300 transition-colors">
                          {p.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          SKU: {p.sku} • €{p.price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      Publicado
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Autopilot Candidates */}
          {matchedCandidates.length > 0 && (
            <div className="p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Candidatos Autopilot ({matchedCandidates.length})</span>
              </div>
              <div className="space-y-1">
                {matchedCandidates.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => {
                      if (onSelectProduct) onSelectProduct(c);
                      if (onNavigateTab) onNavigateTab('autopilot');
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate text-xs group-hover:text-amber-300 transition-colors">
                        {c.title}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Score: {c.traceability?.analysis?.overallScore || 0}/100 • Estado: {c.status}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suppliers */}
          {matchedSuppliers.length > 0 && (
            <div className="p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>Proveedores B2B ({matchedSuppliers.length})</span>
              </div>
              <div className="space-y-1">
                {matchedSuppliers.map(s => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => {
                      if (onSelectSupplier) onSelectSupplier(s);
                      if (onNavigateTab) onNavigateTab('suppliers');
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate text-xs group-hover:text-blue-300 transition-colors">
                        {s.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {s.contact.country} • Fiabilidad: {s.metrics.reliabilityScore}%
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      {s.code}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Supplier Orders / Fulfillment */}
          {matchedSupplierOrders.length > 0 && (
            <div className="p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Órdenes de Suministro ({matchedSupplierOrders.length})</span>
              </div>
              <div className="space-y-1">
                {matchedSupplierOrders.map(so => (
                  <button
                    type="button"
                    key={so.id}
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab('fulfillment');
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-2 rounded-xl hover:bg-white/10 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate text-xs group-hover:text-emerald-300 transition-colors">
                        {so.id} — {so.productTitle}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Cliente: {so.customerShippingAddress.fullName} • Estado: {so.status}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">
                      €{so.totalRevenueEur.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
