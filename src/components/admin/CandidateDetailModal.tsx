import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  Cpu, 
  TrendingUp, 
  DollarSign, 
  Truck, 
  Store, 
  History, 
  ExternalLink,
  Edit3,
  Save,
  Ban,
  Check,
  RotateCcw,
  Sliders,
  Building2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ImageStudioModal } from './ImageStudioModal';
import type { Product, ScoreTier, RiskLevel } from '../../types';

interface CandidateDetailModalProps {
  product: Product;
  onClose: () => void;
}

export const CandidateDetailModal: React.FC<CandidateDetailModalProps> = ({ product, onClose }) => {
  const { 
    suppliers,
    approveProduct, 
    publishProduct, 
    unpublishProduct, 
    rejectProduct, 
    runPipelineOnCandidate,
    saveProductEdits,
    assignSupplierToProduct,
    setViewMode,
    isAutopilotRunning
  } = useApp();

  const [activeTab, setActiveTab] = useState<'comparison' | 'financials' | 'analysis' | 'traceability'>('comparison');
  const [isEditing, setIsEditing] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product>(product);
  const [editedTitle, setEditedTitle] = useState(product.title);
  const [editedPrice, setEditedPrice] = useState(product.price);
  const [editedDesc, setEditedDesc] = useState(product.description);
  const [selectedSupplierId, setSelectedSupplierId] = useState(product.supplierId || '');
  const [rejectionReason, setRejectionReason] = useState('Margen insuficiente o riesgo');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const analysis = currentProduct.traceability?.analysis;
  const risk = currentProduct.traceability?.risk;
  const pricing = currentProduct.traceability?.pricing;
  const supplier = currentProduct.traceability?.supplier;
  const source = currentProduct.traceability?.source;
  const history = currentProduct.traceability?.history || [];

  const handleSaveEdits = () => {
    const updated = {
      ...currentProduct,
      title: editedTitle,
      price: Number(editedPrice),
      description: editedDesc
    };
    saveProductEdits(updated);
    setCurrentProduct(updated);
    setIsEditing(false);
  };

  const handleSupplierChange = async (newSupplierId: string) => {
    setSelectedSupplierId(newSupplierId);
    if (newSupplierId) {
      await assignSupplierToProduct(currentProduct.id, newSupplierId);
    }
  };

  const handleApproveAndPublish = async () => {
    await publishProduct(currentProduct.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-5xl bg-[#0d111d]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-lg text-white">
                  Inspección 360° de Candidato
                </h2>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-indigo-300 font-bold backdrop-blur-sm">
                  {product.sku}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Creado por: <strong className="text-slate-200">{product.traceability?.createdBy || 'Autopilot Bot'}</strong> • {new Date(product.traceability?.createdAt || Date.now()).toLocaleString('es-ES')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => runPipelineOnCandidate(product)}
              disabled={isAutopilotRunning}
              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all backdrop-blur-sm disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Re-analizar con IA</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-white/[0.01] px-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('comparison')}
            className={`py-3.5 px-4 border-b-2 transition-colors ${
              activeTab === 'comparison'
                ? 'border-indigo-400 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Comparativa: Crudo vs Adaptado Victoriosa
          </button>

          <button
            onClick={() => setActiveTab('financials')}
            className={`py-3.5 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'financials'
                ? 'border-indigo-400 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pricing & Margen ({pricing?.targetMarginPct || 55}%)</span>
          </button>

          <button
            onClick={() => setActiveTab('analysis')}
            className={`py-3.5 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'analysis'
                ? 'border-indigo-400 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Scoring & Riesgo ({analysis?.overallScore || 90}/100)</span>
          </button>

          <button
            onClick={() => setActiveTab('traceability')}
            className={`py-3.5 px-4 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'traceability'
                ? 'border-indigo-400 text-indigo-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Trazabilidad & Eventos ({history.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 max-h-[62vh] overflow-y-auto space-y-6 text-xs">
          
          {/* TAB 1: SIDE-BY-SIDE COMPARISON */}
          {activeTab === 'comparison' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* RAW SOURCE DATA */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-500" />
                    Datos de Origen en Bruto (Marketplace)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {source?.platform || 'Amazon Global'}
                  </span>
                </div>

                <div className="aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10">
                  <img
                    src={product.originalImages?.[0] || product.images[0]}
                    alt="Origen"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block">Título Crudo</label>
                    <p className="font-mono text-slate-300 text-xs bg-white/5 p-2 rounded-xl border border-white/10">
                      {product.originalTitle || product.title}
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block">Costo Mayorista Original</label>
                    <p className="font-mono font-bold text-slate-200">
                      {product.costPrice.toFixed(2)} {pricing?.originalCurrency || 'EUR'}
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block">Proveedor & Fiabilidad</label>
                    <p className="text-slate-300">
                      {supplier?.name || 'Distribuidor Global'} • Fiabilidad: <strong>{supplier?.reliabilityScore || 88}%</strong> ({supplier?.country || 'UE'})
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-400 uppercase block">URL Fuente / SKU Externo</label>
                    <a
                      href={source?.url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
                    >
                      <span>{source?.sku || 'SKU-EXT-9921'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* ADAPTED VICTORIOSA DATA */}
              <div className="p-4 rounded-2xl bg-white/5 border border-indigo-500/30 space-y-3 backdrop-blur-md shadow-[0_0_20px_rgba(99,102,241,0.08)]">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-bold text-indigo-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    Versión Adaptada Victoriosa (IA Curada)
                  </span>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditing ? 'Cancelar Edición' : 'Editar Campos'}</span>
                  </button>
                </div>

                <div className="relative aspect-video rounded-xl overflow-hidden bg-white/5 border border-white/10 group">
                  <img
                    src={currentProduct.images[0]}
                    alt="Victoriosa Curated"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button
                    onClick={() => setIsStudioOpen(true)}
                    className="absolute inset-x-3 bottom-3 py-2 px-3 bg-[#0d111d]/90 hover:bg-indigo-600 text-white font-semibold text-xs rounded-xl backdrop-blur-md border border-white/20 transition-all flex items-center justify-center gap-1.5 shadow-xl opacity-90 group-hover:opacity-100"
                  >
                    <Sliders className="w-3.5 h-3.5 text-indigo-300 group-hover:text-white" />
                    <span>Abrir Estudio de Retoque IA & Filtros</span>
                  </button>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Título de Marca</label>
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Precio PVP (€)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={editedPrice}
                        onChange={(e) => setEditedPrice(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono backdrop-blur-md focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Descripción</label>
                      <textarea
                        rows={3}
                        value={editedDesc}
                        onChange={(e) => setEditedDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      onClick={handleSaveEdits}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/25 transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar Cambios</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-indigo-400/80 uppercase block">Título Comercial Victoriosa</label>
                      <p className="font-semibold text-white text-xs bg-white/5 p-2.5 rounded-xl border border-white/10">
                        {product.title}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase block">PVP Calculado</label>
                        <span className="font-mono font-bold text-indigo-300 text-sm">
                          {product.price.toFixed(2)} €
                        </span>
                      </div>
                      <div className="text-right">
                        <label className="text-[10px] text-slate-400 uppercase block">Margen Neto Estimado</label>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          +{pricing?.potentialProfit || (product.price - product.costPrice).toFixed(2)} €
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block">Copywriting Persuasivo</label>
                      <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-3 bg-white/[0.03] p-2.5 rounded-xl border border-white/10">
                        {product.description}
                      </p>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 uppercase block">Insignias de Confianza</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {product.badges?.map((b, i) => (
                          <span key={i} className="px-2.5 py-0.5 rounded-full text-[10px] bg-white/5 text-slate-300 border border-white/10 backdrop-blur-sm">
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: FINANCIALS & PRICING SIMULATOR */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 backdrop-blur-md">
                <div>
                  <span className="text-slate-400 uppercase text-[10px] block">Costo Proveedor</span>
                  <span className="font-mono font-bold text-slate-200 text-base">{product.costPrice.toFixed(2)} €</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] block">Envío Proveedor</span>
                  <span className="font-mono font-bold text-slate-200 text-base">{pricing?.supplierShippingCost?.toFixed(2) || '3.50'} €</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase text-[10px] block">Pasarela Pago (2.9%)</span>
                  <span className="font-mono font-bold text-slate-200 text-base">{pricing?.gatewayFee?.toFixed(2) || '2.10'} €</span>
                </div>
                <div>
                  <span className="text-emerald-400 uppercase text-[10px] block font-bold">Beneficio Neto / Unidad</span>
                  <span className="font-mono font-bold text-emerald-400 text-base">+{pricing?.potentialProfit?.toFixed(2) || '35.00'} €</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md">
                <h4 className="font-semibold text-white text-xs flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Ecuación de Fijación de Precios de Victoriosa
                </h4>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  El algoritmo de fijación de precios garantiza un margen objetivo del <strong>{pricing?.targetMarginPct || 55}%</strong>, absorbiendo posibles fluctuaciones arancelarias y aplicando redondeo psicológico a <strong>.{pricing?.psychologicalEnding || '95'}€</strong> para optimizar la conversión en la tienda pública.
                </p>
                <div className="pt-2 flex justify-between items-center text-slate-300 font-mono text-xs border-t border-white/10">
                  <span>Precio Minorista Recomendado (PVP)</span>
                  <span className="text-indigo-300 text-base font-bold">{product.price.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ANALYSIS, SCORING & RISK */}
          {activeTab === 'analysis' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Scoring Gauge Deck */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="font-bold text-slate-300 uppercase text-[11px]">Evaluación Multidimensional</span>
                  <span className="px-2.5 py-0.5 rounded-md font-black text-xs bg-gradient-to-r from-amber-400 to-amber-500 text-neutral-950 shadow-sm">
                    Tier {analysis?.scoreTier || 'S'}
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Puntuación Global (Score)', value: analysis?.overallScore || 90, color: 'bg-indigo-500' },
                    { label: 'Demanda del Mercado', value: analysis?.demandScore || 88, color: 'bg-blue-500' },
                    { label: 'Potencial de Margen', value: analysis?.marginPotential || 92, color: 'bg-emerald-500' },
                    { label: 'Brand Fit (Alineación Victoriosa)', value: analysis?.brandFitScore || 94, color: 'bg-purple-500' },
                    { label: 'Calidad Percibida', value: analysis?.qualityScore || 90, color: 'bg-teal-500' },
                    { label: 'Fiabilidad Logística', value: analysis?.logisticsScore || 92, color: 'bg-amber-400' }
                  ].map((metric, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{metric.label}</span>
                        <span className="font-mono font-bold text-slate-200">{metric.value}/100</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full ${metric.color} rounded-full`} style={{ width: `${metric.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300 block mb-0.5">Justificación Brand Fit:</span>
                  <p>{analysis?.brandFitJustification || 'Excelente estética contemporánea y alta satisfacción de clientes.'}</p>
                </div>
              </div>

              {/* Risk & Compliance Matrix */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <span className="font-bold text-slate-300 uppercase text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Auditoría de Riesgo & Compliance
                  </span>
                  <span className="text-emerald-400 font-bold uppercase text-[10px]">
                    Nivel: {risk?.level || 'Bajo'}
                  </span>
                </div>

                <div className="divide-y divide-white/5">
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-slate-400">Riesgo de Propiedad Intelectual</span>
                    <span className="font-semibold text-emerald-400 capitalize">{risk?.copyrightRisk || 'Ninguno'}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-slate-400">Veracidad de Claims / Salud</span>
                    <span className="font-semibold text-emerald-400 capitalize">{risk?.claimsRisk || 'Seguro'}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-slate-400">Riesgo de Devolución</span>
                    <span className="font-semibold text-emerald-400 capitalize">{risk?.returnRisk || 'Bajo (<2%)'}</span>
                  </div>
                  <div className="py-2 flex justify-between items-center">
                    <span className="text-slate-400">Fiabilidad del Proveedor</span>
                    <span className="font-semibold text-slate-200">{supplier?.reliabilityScore || 90}%</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300 block">Detalles de Verificación:</span>
                  {risk?.details && risk.details.length > 0 ? (
                    risk.details.map((d, idx) => (
                      <p key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-400">✓</span> {d}
                      </p>
                    ))
                  ) : (
                    <p>Verificación de seguridad conforme a normativas comunitarias.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TRACEABILITY & TIMELINE */}
          {activeTab === 'traceability' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 backdrop-blur-md">
                <h4 className="font-semibold text-white text-xs">
                  Registro Inmutable de Eventos de Ciclo de Vida
                </h4>
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                  {history.map((entry, idx) => (
                    <div key={idx} className="relative space-y-1">
                      <div className="absolute -left-6 top-0.5 w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-[#0d111d]" />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-200 capitalize">
                          Etapa: {entry.stage}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {new Date(entry.timestamp).toLocaleString('es-ES')}
                        </span>
                      </div>
                      <p className="text-slate-300 text-xs">{entry.action}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Actor: <strong className="text-slate-300">{entry.actor}</strong></span>
                        {entry.fromStatus && entry.toStatus && (
                          <span>• Transición: <span className="font-mono text-indigo-400">{entry.fromStatus} → {entry.toStatus}</span></span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-[11px] text-slate-400 italic bg-white/5 p-2 rounded-xl mt-1 border border-white/10">
                          "{entry.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/10 bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Estado Actual:</span>
            <span className="font-mono font-bold text-xs uppercase text-indigo-300">
              {product.status}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* If not published: Publish button */}
            {product.status !== 'published' && (
              <button
                onClick={handleApproveAndPublish}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-600/25 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aprobar y Publicar en Tienda</span>
              </button>
            )}

            {/* If published: Unpublish button */}
            {product.status === 'published' && (
              <button
                onClick={() => {
                  unpublishProduct(product.id);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold transition-colors"
              >
                Retirar a Borrador
              </button>
            )}

            {/* Reject button */}
            {product.status !== 'rejected' && (
              <button
                onClick={() => {
                  rejectProduct(product.id, 'Descartado en revisión manual.');
                  onClose();
                }}
                className="px-3 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Ban className="w-4 h-4" />
                <span>Rechazar</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Image Studio Modal */}
        {isStudioOpen && (
          <ImageStudioModal
            product={currentProduct}
            isOpen={isStudioOpen}
            onClose={() => setIsStudioOpen(false)}
            onImageUpdated={(updated) => {
              setCurrentProduct(updated);
            }}
          />
        )}

      </div>
    </div>
  );
};
