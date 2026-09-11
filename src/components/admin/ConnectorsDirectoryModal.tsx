import React, { useState } from 'react';
import { apiFetch } from '../../lib/api';
import { 
  X, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Globe, 
  Cpu, 
  Search, 
  ShieldCheck, 
  Terminal, 
  ExternalLink,
  Zap,
  Key,
  HelpCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { SourceConnectorConfig } from '../../types';

interface ConnectorsDirectoryModalProps {
  onClose: () => void;
}

export const ConnectorsDirectoryModal: React.FC<ConnectorsDirectoryModalProps> = ({ onClose }) => {
  const { connectors } = useApp();
  const [selectedConnector, setSelectedConnector] = useState<SourceConnectorConfig | null>(connectors[0] || null);
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testUrl.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await apiFetch('/api/connectors/direct-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl.trim() })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const getStatusBadge = (status: SourceConnectorConfig['status']) => {
    switch (status) {
      case 'IMPLEMENTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>IMPLEMENTED (Operativo)</span>
          </span>
        );
      case 'REQUIRES_HUMAN_ACTION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>REQUIRES_HUMAN_ACTION</span>
          </span>
        );
      case 'REQUIRES_CREDENTIALS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <Lock className="w-3.5 h-3.5" />
            <span>REQUIRES_CREDENTIALS</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/30">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>NOT_CONFIGURED</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-[#0d111d]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                Directorio de Conectores de Suministro Real
              </h2>
              <p className="text-xs text-slate-400">
                Auditoría de APIs, estado de credenciales y capacidades de fulfillment por origen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split view */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-white/10">
          
          {/* Connector Sidebar List */}
          <div className="md:col-span-5 p-4 space-y-2 bg-white/[0.01]">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
              Conectores Registrados ({connectors.length})
            </div>
            {connectors.map((c) => {
              const isSelected = selectedConnector?.id === c.id;
              return (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    setSelectedConnector(c);
                    setTestResult(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-white shadow-lg shadow-indigo-500/10'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs text-white">{c.name}</span>
                    <span className="font-mono text-[10px] text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded">
                      {c.platform}
                    </span>
                  </div>
                  <div className="mb-2">
                    {getStatusBadge(c.status)}
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2">{c.description}</p>
                </button>
              );
            })}
          </div>

          {/* Selected Connector Detail View */}
          <div className="md:col-span-7 p-6 space-y-6 text-xs bg-white/[0.02] overflow-y-auto">
            {selectedConnector ? (
              <>
                {/* Top Info */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-base text-white">{selectedConnector.name}</h3>
                    {getStatusBadge(selectedConnector.status)}
                  </div>
                  <p className="text-slate-300 leading-relaxed text-xs">
                    {selectedConnector.statusReason}
                  </p>
                </div>

                {/* Capabilities Matrix */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Matriz de Capacidades Técnicas</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400">Búsqueda / Catálogo:</span>
                      <span className={selectedConnector.capabilities.search ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {selectedConnector.capabilities.search ? 'Soportado' : 'No'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400">Importación por URL:</span>
                      <span className={selectedConnector.capabilities.directUrlImport ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {selectedConnector.capabilities.directUrlImport ? 'Soportado' : 'No'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400">Verificación de Stock:</span>
                      <span className={selectedConnector.capabilities.verifyStockAndPrice ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                        {selectedConnector.capabilities.verifyStockAndPrice ? 'Soportado' : 'No'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between">
                      <span className="text-slate-400">Compra 100% Automática:</span>
                      <span className={selectedConnector.capabilities.autoPurchase ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {selectedConnector.capabilities.autoPurchase ? 'Directa B2B' : 'Acción Asistida'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Environment Variables & Secrets Required */}
                {selectedConnector.requiresCredentials && selectedConnector.requiresCredentials.length > 0 && (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                      <Key className="w-4 h-4 text-indigo-400" />
                      <span>Variables de Entorno para Acceso API Directo</span>
                    </div>
                    <div className="space-y-1.5 font-mono text-[11px]">
                      {selectedConnector.requiresCredentials.map((k) => (
                        <div key={k} className="p-2 rounded bg-black/50 border border-white/5 text-indigo-300 flex items-center justify-between">
                          <span>{k}</span>
                          <span className="text-[10px] text-slate-500">Cloud Function Secret</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400 pt-1">
                      Nota: En ausencia de claves privadas de marketplace, el conector conmuta a modo de verificación transparente y compra humana asistida sin simulación ficticia.
                    </p>
                  </div>
                )}

                {/* Direct Connector Tester */}
                <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-3">
                  <div className="font-bold text-indigo-200 text-xs flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>Prueba en Vivo de Extracción URL</span>
                  </div>
                  <form onSubmit={handleTestConnector} className="flex gap-2">
                    <input
                      type="url"
                      value={testUrl}
                      onChange={(e) => setTestUrl(e.target.value)}
                      placeholder="https://ejemplo.com/producto..."
                      className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={isTesting || !testUrl.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50"
                    >
                      {isTesting ? 'Probando...' : 'Test'}
                    </button>
                  </form>

                  {testResult && (
                    <div className="p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-[11px] max-h-40 overflow-y-auto">
                      <pre className="text-slate-300 whitespace-pre-wrap">
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

              </>
            ) : (
              <div className="p-8 text-center text-slate-500">
                Selecciona un conector para ver su configuración y estado en tiempo real.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
