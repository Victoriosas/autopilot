import React, { useState, useMemo } from 'react';
import { 
  Bot, 
  Sparkles, 
  Layers, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  ShieldAlert, 
  ExternalLink, 
  Play, 
  ChevronRight,
  Eye,
  Check,
  Ban,
  ArrowUpRight,
  Trash2,
  DollarSign,
  PackageCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Product, ProductStatus, RiskLevel, ScoreTier } from '../../types';
import { SystemAlertsBanner } from './SystemAlertsBanner';

interface AutopilotDashboardProps {
  onInspectCandidate: (p: Product) => void;
  onOpenDiscovery: () => void;
  onOpenRunner: () => void;
}

export const AutopilotDashboard: React.FC<AutopilotDashboardProps> = ({
  onInspectCandidate,
  onOpenDiscovery,
  onOpenRunner
}) => {
  const { 
    products, 
    runPipelineOnCandidate, 
    approveProduct, 
    publishProduct, 
    unpublishProduct, 
    rejectProduct, 
    deleteProduct,
    isAutopilotRunning 
  } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('Margen insuficiente o riesgo de calidad');

  // KPI Metrics Calculation
  const totalProducts = products.length;
  const discoveredCount = products.filter(p => p.status === 'discovered').length;
  const analyzingCount = products.filter(p => p.status === 'analyzing').length;
  const reviewCount = products.filter(p => p.status === 'ready_for_review').length;
  const approvedCount = products.filter(p => p.status === 'approved' || p.status === 'draft_ready').length;
  const publishedCount = products.filter(p => p.status === 'published').length;
  const rejectedCount = products.filter(p => p.status === 'rejected').length;

  const avgMargin = useMemo(() => {
    const published = products.filter(p => p.status === 'published');
    if (published.length === 0) return 55;
    const total = published.reduce((acc, p) => acc + (p.traceability?.pricing?.targetMarginPct || 55), 0);
    return Math.round(total / published.length);
  }, [products]);

  const totalRetailValue = useMemo(() => {
    const published = products.filter(p => p.status === 'published');
    return published.reduce((acc, p) => acc + p.price * p.inventory, 0);
  }, [products]);

  // Filtered list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (riskFilter !== 'all' && p.traceability?.risk?.level !== riskFilter) return false;
      if (tierFilter !== 'all' && p.traceability?.analysis?.scoreTier !== tierFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q) || p.originalTitle?.toLowerCase().includes(q);
        const matchesSku = p.sku.toLowerCase().includes(q);
        const matchesSupplier = p.traceability?.supplier?.name.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSku && !matchesSupplier && !matchesCategory) return false;
      }
      return true;
    });
  }, [products, statusFilter, riskFilter, tierFilter, searchQuery]);

  const getStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm shadow-[0_0_10px_rgba(52,211,153,0.15)]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Publicado en Tienda
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 backdrop-blur-sm">
            <Check className="w-3.5 h-3.5 text-indigo-400" />
            Aprobado (Listo)
          </span>
        );
      case 'draft_ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 backdrop-blur-sm">
            <PackageCheck className="w-3.5 h-3.5 text-blue-400" />
            Borrador Preparado
          </span>
        );
      case 'ready_for_review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 backdrop-blur-sm animate-pulse">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Revisión Pendiente
          </span>
        );
      case 'analyzing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            En Análisis IA
          </span>
        );
      case 'discovered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/5 text-slate-300 border border-white/10 backdrop-blur-sm">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            Descubierto (Crudo)
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30 backdrop-blur-sm">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Rechazado (Descartado)
          </span>
        );
      default:
        return null;
    }
  };

  const getRiskBadge = (level?: RiskLevel) => {
    switch (level) {
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 backdrop-blur-sm">Riesgo Bajo</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 backdrop-blur-sm">Riesgo Medio</span>;
      case 'high':
      case 'critical':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 backdrop-blur-sm">Riesgo Crítico</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] text-slate-400 bg-white/5 border border-white/10">Sin evaluar</span>;
    }
  };

  const getTierBadge = (tier?: ScoreTier) => {
    switch (tier) {
      case 'S':
        return <span className="px-2 py-0.5 rounded-md font-black text-[11px] bg-gradient-to-r from-amber-400 to-amber-500 text-neutral-950 shadow-sm">Tier S</span>;
      case 'A':
        return <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm">Tier A</span>;
      case 'B':
        return <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm">Tier B</span>;
      case 'C':
        return <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-slate-700 text-slate-200 border border-slate-600">Tier C</span>;
      case 'D':
        return <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-rose-900/60 text-rose-200 border border-rose-700/50">Tier D</span>;
      default:
        return <span className="text-[11px] text-slate-500 font-mono">-</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Real-time Operational Alerts */}
      <SystemAlertsBanner />
      
      {/* 1. KPI Top Cards Deck */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Descubiertos</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-white">{discoveredCount}</div>
          <span className="text-[10px] text-slate-400">Pendientes de pipeline</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>En Revisión</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-amber-400">{reviewCount}</div>
          <span className="text-[10px] text-slate-400">Esperando aprobación</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Publicados</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-emerald-400">{publishedCount}</div>
          <span className="text-[10px] text-slate-400">En tienda pública</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Rechazados</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-rose-400">{rejectedCount}</div>
          <span className="text-[10px] text-slate-400">Filtrados por riesgo</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Margen Medio</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-white">{avgMargin}%</div>
          <span className="text-[10px] text-slate-400">Objetivo &gt;50%</span>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/[0.08] transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Valor Catálogo</span>
            <DollarSign className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-indigo-300">
            {Math.round(totalRetailValue).toLocaleString()} €
          </div>
          <span className="text-[10px] text-slate-400">Inventario activo</span>
        </div>
      </div>

      {/* 2. Autopilot Pipeline Stage Visualizer */}
      <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <h3 className="font-serif font-bold text-sm text-white">
              Pipeline de Estados del Autopilot
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Flujo continuo: Descubrimiento → Análisis IA → Aprobación → Tienda Pública
          </span>
        </div>

        {/* Pipeline Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          {[
            { id: 'discovered', label: '1. Discovered', count: discoveredCount, color: 'border-white/10 text-slate-300' },
            { id: 'analyzing', label: '2. Analyzing', count: analyzingCount, color: 'border-purple-500/30 text-purple-300' },
            { id: 'ready_for_review', label: '3. Ready Review', count: reviewCount, color: 'border-amber-500/30 text-amber-300' },
            { id: 'approved', label: '4. Approved', count: approvedCount, color: 'border-indigo-500/30 text-indigo-300' },
            { id: 'published', label: '5. Published', count: publishedCount, color: 'border-emerald-500/30 text-emerald-300 font-bold' },
            { id: 'rejected', label: '6. Rejected', count: rejectedCount, color: 'border-rose-500/30 text-rose-300' },
            { id: 'all', label: 'Todos', count: totalProducts, color: 'border-white/10 text-slate-400' }
          ].map((stage) => (
            <button
              key={stage.id}
              onClick={() => setStatusFilter(stage.id)}
              className={`p-3 rounded-xl border text-left transition-all backdrop-blur-md ${
                statusFilter === stage.id
                  ? 'bg-indigo-500/20 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/40'
                  : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 text-slate-300'
              }`}
            >
              <div className="text-[11px] text-slate-400">{stage.label}</div>
              <div className="text-base font-mono font-bold mt-1 text-white">{stage.count}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Search and Multi-Dimensional Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md text-xs">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, SKU, proveedor o categoría..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 backdrop-blur-md"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Risk Filter */}
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 backdrop-blur-md"
          >
            <option value="all" className="bg-[#0d111d] text-slate-200">Riesgo: Todos</option>
            <option value="low" className="bg-[#0d111d] text-slate-200">Riesgo: Bajo</option>
            <option value="medium" className="bg-[#0d111d] text-slate-200">Riesgo: Medio</option>
            <option value="high" className="bg-[#0d111d] text-slate-200">Riesgo: Alto / Crítico</option>
          </select>

          {/* Tier Filter */}
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 backdrop-blur-md"
          >
            <option value="all" className="bg-[#0d111d] text-slate-200">Tier Score: Todos</option>
            <option value="S" className="bg-[#0d111d] text-slate-200">Tier S (90-100)</option>
            <option value="A" className="bg-[#0d111d] text-slate-200">Tier A (80-89)</option>
            <option value="B" className="bg-[#0d111d] text-slate-200">Tier B (70-79)</option>
            <option value="C" className="bg-[#0d111d] text-slate-200">Tier C (60-69)</option>
            <option value="D" className="bg-[#0d111d] text-slate-200">Tier D (&lt;60)</option>
          </select>

          {(statusFilter !== 'all' || riskFilter !== 'all' || tierFilter !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setRiskFilter('all');
                setTierFilter('all');
                setSearchQuery('');
              }}
              className="px-3 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* 4. Products Table / Candidate Explorer */}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-2xl backdrop-blur-lg">
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-white text-sm">
              Gestor de Catálogo y Candidatos ({filteredProducts.length})
            </h4>
          </div>
          <span className="text-xs text-slate-400">
            Trazabilidad inmutable y sincronización en tiempo real
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-slate-400 uppercase tracking-wider text-[10px] border-b border-white/10">
              <tr>
                <th className="p-4">Producto & SKU</th>
                <th className="p-4">Estado Pipeline</th>
                <th className="p-4">Score & Tier</th>
                <th className="p-4">Márgenes & Precios</th>
                <th className="p-4">Riesgo & Fiabilidad</th>
                <th className="p-4">Fuente / Proveedor</th>
                <th className="p-4 text-right">Acciones Autopilot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    No se encontraron productos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const score = p.traceability?.analysis?.overallScore;
                  const tier = p.traceability?.analysis?.scoreTier;
                  const risk = p.traceability?.risk?.level;
                  const marginPct = p.traceability?.pricing?.targetMarginPct || 50;

                  return (
                    <tr key={p.id} className="hover:bg-white/[0.04] transition-colors">
                      {/* Product & SKU */}
                      <td className="p-4 max-w-xs">
                        <div className="flex items-start gap-3">
                          <img
                            src={p.images[0] || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80"}
                            alt={p.title}
                            className="w-12 h-12 rounded-xl object-cover bg-white/5 flex-shrink-0 border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <span 
                              onClick={() => onInspectCandidate(p)}
                              className="font-semibold text-white hover:text-indigo-300 cursor-pointer line-clamp-1 block text-xs transition-colors"
                            >
                              {p.title}
                            </span>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                              <span className="font-mono text-indigo-400">{p.sku}</span>
                              <span>•</span>
                              <span>{p.category}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 whitespace-nowrap">
                        {getStatusBadge(p.status)}
                      </td>

                      {/* Score & Tier */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTierBadge(tier)}
                          <span className="font-mono font-bold text-slate-200">
                            {score ? `${score}/100` : 'Pendiente'}
                          </span>
                        </div>
                      </td>

                      {/* Margins & Pricing */}
                      <td className="p-4 whitespace-nowrap">
                        <div>
                          <div className="font-bold text-white font-mono">
                            {p.price.toFixed(2)} € <span className="text-[10px] text-slate-400 font-normal">PVP</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Costo: {p.costPrice.toFixed(2)}€ • <span className="text-emerald-400 font-semibold">{marginPct}% Margen</span>
                          </div>
                        </div>
                      </td>

                      {/* Risk & Compliance */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {getRiskBadge(risk)}
                          <div className="text-[10px] text-slate-400">
                            Fiabilidad Prov: <strong className="text-slate-200">{p.traceability?.supplier?.reliabilityScore || 85}%</strong>
                          </div>
                        </div>
                      </td>

                      {/* Source & Platform */}
                      <td className="p-4 whitespace-nowrap text-[11px]">
                        <div className="font-medium text-slate-200">
                          {p.traceability?.source?.platform || 'Marketplace'}
                        </div>
                        <div className="text-slate-400">
                          {p.traceability?.supplier?.name || 'Proveedor Global'} ({p.traceability?.supplier?.country || 'UE'})
                        </div>
                      </td>

                      {/* Quick Actions */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Inspect 360 */}
                          <button
                            onClick={() => onInspectCandidate(p)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-all hover:border-indigo-400/40"
                            title="Inspección 360° y Trazabilidad"
                          >
                            <Eye className="w-4 h-4 text-indigo-400" />
                          </button>

                          {/* Run Pipeline button if discovered or analyzing */}
                          {(p.status === 'discovered' || p.status === 'analyzing') && (
                            <button
                              onClick={() => runPipelineOnCandidate(p)}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white font-semibold text-[11px] border border-purple-400/30 transition-all shadow-md flex items-center gap-1"
                              title="Ejecutar análisis de IA completo"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Analizar</span>
                            </button>
                          )}

                          {/* Approve & Publish directly */}
                          {p.status !== 'published' && p.status !== 'rejected' && (
                            <button
                              onClick={() => publishProduct(p.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] border border-emerald-400/30 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1"
                              title="Aprobar y Publicar en Tienda Pública"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Publicar</span>
                            </button>
                          )}

                          {/* Unpublish button if published */}
                          {p.status === 'published' && (
                            <button
                              onClick={() => unpublishProduct(p.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-[11px] transition-all"
                              title="Despublicar de la tienda pública"
                            >
                              Retirar a Draft
                            </button>
                          )}

                          {/* Reject button */}
                          {p.status !== 'rejected' && (
                            <button
                              onClick={() => {
                                setRejectingId(p.id);
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 transition-all"
                              title="Rechazar candidato"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => deleteProduct(p.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 transition-all"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Reason Confirmation Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="bg-[#0d111d]/95 border border-white/10 backdrop-blur-2xl p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              Rechazar Candidato
            </h3>
            <p className="text-xs text-slate-400">
              Especifica el motivo de descarte. El candidato quedará registrado en lista de rechazados para evitar procesamientos duplicados.
            </p>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Motivo de Rechazo</label>
              <select
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-200 backdrop-blur-md focus:outline-none focus:border-indigo-500"
              >
                <option value="Margen insuficiente o costo logístico desproporcionado" className="bg-[#0d111d] text-slate-200">Margen insuficiente o costo logístico alto</option>
                <option value="Riesgo de propiedad intelectual o patentes protegidas" className="bg-[#0d111d] text-slate-200">Riesgo de propiedad intelectual / Patentes</option>
                <option value="Proveedor poco confiable o alta tasa de devoluciones" className="bg-[#0d111d] text-slate-200">Proveedor poco confiable (&lt;70% fiabilidad)</option>
                <option value="Calidad percibida o estética no acorde a Victoriosa" className="bg-[#0d111d] text-slate-200">Incompatible con identidad de marca Victoriosa</option>
                <option value="Claims médicos o propiedades no verificadas" className="bg-[#0d111d] text-slate-200">Claims no verificables / Riesgo regulatorio</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  rejectProduct(rejectingId, rejectionReasonInput);
                  setRejectingId(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/25 transition-all"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
