import React, { useState, useMemo } from 'react';
import { apiFetch } from '../../lib/api';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  Truck, 
  Percent, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Layers,
  Package,
  TrendingUp,
  ArrowUpRight,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SupplierModal } from './SupplierModal';
import type { Supplier } from '../../types';

interface SupplierManagementProps {
  onOpenProductDetail?: (productId: string) => void;
}

export const SupplierManagement: React.FC<SupplierManagementProps> = ({ onOpenProductDetail }) => {
  const { suppliers, products, addSupplier, updateSupplier, deleteSupplier, showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'evaluating' | 'restricted'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedSupplierForEval, setSelectedSupplierForEval] = useState<Supplier | null>(null);

  // All unique categories across suppliers
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    suppliers.forEach(s => s.catalogs.categories.forEach(c => cats.add(c)));
    return Array.from(cats);
  }, [suppliers]);

  // KPIs
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.status === 'active').length;
  const avgReliability = useMemo(() => {
    if (!suppliers.length) return 0;
    const sum = suppliers.reduce((acc, s) => acc + s.metrics.reliabilityScore, 0);
    return Math.round(sum / suppliers.length);
  }, [suppliers]);
  const avgDiscount = useMemo(() => {
    if (!suppliers.length) return 0;
    const sum = suppliers.reduce((acc, s) => acc + s.pricingAgreements.baseDiscountPct, 0);
    return Math.round(sum / suppliers.length);
  }, [suppliers]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (selectedCategory !== 'all' && !s.catalogs.categories.includes(selectedCategory)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesCode = s.code.toLowerCase().includes(q);
        const matchesCountry = s.contact.country.toLowerCase().includes(q);
        const matchesContact = s.contact.contactName.toLowerCase().includes(q);
        const matchesCat = s.catalogs.categories.some(c => c.toLowerCase().includes(q));
        if (!matchesName && !matchesCode && !matchesCountry && !matchesContact && !matchesCat) return false;
      }
      return true;
    });
  }, [suppliers, statusFilter, selectedCategory, searchQuery]);

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar al proveedor "${name}"?`)) {
      await deleteSupplier(id);
    }
  };

  const handleEvaluateSupplier = async (supplier: Supplier) => {
    setSelectedSupplierForEval(supplier);
    setIsEvaluating(true);
    setEvaluationResult(null);

    try {
      const res = await apiFetch('/api/autopilot/evaluate-supplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier, expectedVolume: 50 })
      });
      const data = await res.json();
      if (data.success) {
        setEvaluationResult(data.evaluation);
      } else {
        showToast(`Error al evaluar proveedor: ${data.error}`, 'error');
      }
    } catch (err: any) {
      console.error('Supplier eval error:', err);
      showToast(`Error de conexión con Gemini AI: ${err.message}`, 'error');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Count products associated with a supplier
  const getProductCountForSupplier = (supplierId: string, supplierName: string) => {
    return products.filter(p => 
      p.supplierId === supplierId || 
      (p.traceability?.supplier?.name && p.traceability.supplier.name.toLowerCase() === supplierName.toLowerCase())
    ).length;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & KPI Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#121626]/70 border border-white/10 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Proveedores</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-serif">{totalSuppliers}</span>
            <span className="text-xs text-emerald-400 font-mono font-bold">
              {activeSuppliers} Homologados
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Sincronizados con Cloud Firestore</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#121626]/70 border border-white/10 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Fiabilidad Media</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white font-mono">{avgReliability}%</span>
            <span className="text-xs text-emerald-400 font-semibold font-mono">Tier A+</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Auditoría automática por Autopilot</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#121626]/70 border border-white/10 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Descuento B2B Medio</span>
            <Percent className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-300 font-mono">-{avgDiscount}%</span>
            <span className="text-xs text-purple-400 font-mono">Margen +55%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Escalados por volumen negociados</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#121626]/70 border border-white/10 backdrop-blur-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Entregas UE</span>
            <Truck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-300 font-mono">2-4 Días</span>
            <span className="text-xs text-blue-400 font-mono font-semibold">Express</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Acuerdo logístico con tracking</p>
        </div>
      </div>

      {/* Actions & Filters Bar */}
      <div className="p-4 rounded-2xl bg-[#121626]/80 border border-white/10 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, código, país o categoría..."
            className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs placeholder:text-slate-500 backdrop-blur-md focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-[#171b2d] border border-white/10 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Todos los Estados</option>
            <option value="active">Activos (Homologados)</option>
            <option value="evaluating">En Auditoría</option>
            <option value="restricted">Restringidos</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-[#171b2d] border border-white/10 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">Todas las Categorías</option>
            {allCategories.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-1.5 ml-auto active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Supplier Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredSuppliers.map((sup) => {
          const linkedCount = getProductCountForSupplier(sup.id, sup.name);

          return (
            <div
              key={sup.id}
              className="p-6 rounded-2xl bg-[#121626]/80 border border-white/10 hover:border-indigo-500/30 transition-all duration-300 backdrop-blur-xl shadow-xl space-y-5 group"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-serif font-black text-xl shadow-inner flex-shrink-0">
                    {sup.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-serif font-bold text-white text-base group-hover:text-indigo-300 transition-colors">
                        {sup.name}
                      </h3>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300 font-semibold">
                        {sup.code}
                      </span>
                      {sup.status === 'active' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                          <CheckCircle2 className="w-3 h-3" />
                          Activo
                        </span>
                      )}
                      {sup.status === 'evaluating' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                          <Clock className="w-3 h-3" />
                          Auditoría
                        </span>
                      )}
                      {sup.status === 'restricted' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 font-mono">
                          <AlertTriangle className="w-3 h-3" />
                          Restringido
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{sup.contact.city ? `${sup.contact.city}, ` : ''}{sup.contact.country}</span>
                      {sup.contact.website && (
                        <>
                          <span className="text-white/20">•</span>
                          <a 
                            href={sup.contact.website} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-indigo-400 hover:underline flex items-center gap-0.5 font-mono text-[11px]"
                          >
                            <span>Web</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Top Action Icons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEvaluateSupplier(sup)}
                    className="p-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-all text-xs font-semibold flex items-center gap-1"
                    title="Evaluar proveedor con IA Autopilot"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Evaluar IA</span>
                  </button>

                  <button
                    onClick={() => handleEdit(sup)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Editar acuerdo y datos"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDelete(sup.id, sup.name)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Eliminar proveedor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Categories Badges */}
              <div className="flex flex-wrap gap-1.5">
                {sup.catalogs.categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-full text-[11px] bg-white/5 border border-white/10 text-slate-300 font-medium"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* Commercial Terms & Agreements Bento */}
              <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Descuento B2B</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    -{sup.pricingAgreements.baseDiscountPct}% Base
                  </span>
                  <span className="text-[10px] text-slate-500 block">Hasta -{Math.max(...(sup.pricingAgreements.volumeTiers?.map(t => t.discountPct) || [sup.pricingAgreements.baseDiscountPct]))}% por volumen</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Envío & Plazo</span>
                  <span className="font-mono font-bold text-slate-200 text-sm">
                    {sup.pricingAgreements.leadTimeDaysMin}-{sup.pricingAgreements.leadTimeDaysMax} días
                  </span>
                  <span className="text-[10px] text-slate-500 block">{sup.pricingAgreements.avgShippingPerUnit.toFixed(2)} €/ud</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Productos en Catálogo</span>
                  <span className="font-mono font-bold text-indigo-300 text-sm">
                    {linkedCount} productos
                  </span>
                  <span className="text-[10px] text-slate-500 block">MOQ: {sup.catalogs.minOrderQty} ud</span>
                </div>
              </div>

              {/* Reliability & Quality Metrics Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Puntuación de Fiabilidad
                  </span>
                  <span className="font-bold text-emerald-400">
                    {sup.metrics.reliabilityScore} / 100
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden border border-white/5">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      sup.metrics.reliabilityScore >= 90
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : sup.metrics.reliabilityScore >= 80
                        ? 'bg-gradient-to-r from-indigo-500 to-blue-400'
                        : 'bg-gradient-to-r from-amber-500 to-rose-400'
                    }`}
                    style={{ width: `${sup.metrics.reliabilityScore}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Cumplimiento: <strong className="text-slate-200">{sup.metrics.fulfillmentRate}%</strong></span>
                  <span>Defectos: <strong className="text-slate-200">{sup.metrics.defectRate}%</strong></span>
                  <span>Despacho: <strong className="text-slate-200">{sup.metrics.avgDispatchDays} días</strong></span>
                </div>
              </div>

              {/* Contact Footer */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  {sup.contact.email && (
                    <span className="flex items-center gap-1 hover:text-slate-200 transition-colors">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-[11px] font-mono">{sup.contact.email}</span>
                    </span>
                  )}
                  {sup.contact.phone && (
                    <span className="hidden sm:flex items-center gap-1 text-[11px] font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{sup.contact.phone}</span>
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 font-mono">
                  {sup.pricingAgreements.paymentTerms}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-[#121626]/50 border border-white/10 backdrop-blur-xl">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="font-serif font-bold text-white text-base">No se encontraron proveedores</h3>
          <p className="text-xs text-slate-400 mt-1">Prueba con otros términos de búsqueda o añade un nuevo proveedor.</p>
          <button
            onClick={handleCreate}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Añadir Proveedor</span>
          </button>
        </div>
      )}

      {/* AI Supplier Evaluation Modal */}
      {selectedSupplierForEval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#0d111d]/95 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-white text-sm">
                    Evaluación Autopilot: {selectedSupplierForEval.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Auditoría de fiabilidad, márgenes y riesgo logístico
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplierForEval(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {isEvaluating ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-300 font-mono">Analizando acuerdos, histórico y compatibilidad con Autopilot...</p>
              </div>
            ) : evaluationResult ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-200 leading-relaxed">
                  <strong className="block text-purple-300 mb-1 font-mono uppercase text-[10px]">Diagnóstico de Autopilot:</strong>
                  {evaluationResult.recommendation}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase block">Descuento B2B Efectivo</span>
                    <span className="font-mono font-bold text-emerald-400 text-base">
                      -{evaluationResult.effectiveDiscountPct}%
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase block">Nivel de Riesgo Logístico</span>
                    <span className={`font-mono font-bold text-base uppercase ${
                      evaluationResult.supplierRiskLevel === 'low' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {evaluationResult.supplierRiskLevel}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Apto para Auto-publicación:</span>
                  <span className={`font-mono font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                    evaluationResult.isApprovedForAutopilot
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {evaluationResult.isApprovedForAutopilot ? '✓ HOMOLOGADO' : '✗ REQUIERE REVISIÓN'}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedSupplierForEval(null)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all"
                >
                  Entendido
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      <SupplierModal
        supplier={editingSupplier}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={async (data) => {
          if (editingSupplier) {
            await updateSupplier(data);
          } else {
            await addSupplier(data);
          }
        }}
      />
    </div>
  );
};
