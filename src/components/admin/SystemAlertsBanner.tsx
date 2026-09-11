import React, { useState } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  ExternalLink, 
  X, 
  ChevronDown, 
  ChevronUp,
  ShieldAlert,
  UserCheck
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const SystemAlertsBanner: React.FC = () => {
  const { alerts, resolveAlert, dismissAlert } = useApp();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeAlerts = alerts.filter(a => !a.resolved && !a.dismissed);

  if (activeAlerts.length === 0) return null;

  const criticalCount = activeAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-slate-200 backdrop-blur-xl shadow-lg shadow-amber-500/5 transition-all">
      {/* Banner Summary Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-200">
                {activeAlerts.length} {activeAlerts.length === 1 ? 'Alerta Operativa Activa' : 'Alertas Operativas Activas'}
              </span>
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold">
                  {criticalCount} Crítica{criticalCount > 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                  {warningCount} Aviso{warningCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {activeAlerts[0]?.title || 'Atención requerida en compras a proveedor o stock.'}
            </p>
          </div>
        </div>

        {/* Toggle Details Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-xs text-slate-300 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <span>{isExpanded ? 'Ocultar' : 'Ver Detalles'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Alert Items */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-amber-500/20 space-y-2.5">
          {activeAlerts.map((alert) => (
            <div 
              key={alert.id}
              className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                {alert.severity === 'critical' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold text-slate-200">{alert.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{alert.message}</div>
                  {alert.sourcePlatform && (
                    <span className="inline-block mt-1 text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      Fuente: {alert.sourcePlatform}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {alert.actionLink && (
                  <a
                    href={alert.actionLink}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-slate-300 rounded-lg text-[11px] font-medium flex items-center gap-1"
                  >
                    <span>Ir a Origen</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => resolveAlert(alert.id)}
                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Resolver</span>
                </button>

                <button
                  type="button"
                  onClick={() => dismissAlert(alert.id)}
                  className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Descartar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
