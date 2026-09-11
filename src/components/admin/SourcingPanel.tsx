import { useState, useEffect } from 'react';

interface SourcingStats {
  totalRuns: number;
  totalProductsFound: number;
  totalPublished: number;
  totalDraft: number;
  totalRejected: number;
  lastRunAt: string | null;
  apiCallsUsed: number;
}

interface SourcingRun {
  id: string;
  status: string;
  productsFound: number;
  productsPublished: number;
  productsDraft: number;
  productsRejected: number;
  apiCallsUsed: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

interface SchedulerStatus {
  isRunning: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  isScheduled: boolean;
}

interface DiscoveredProduct {
  id: string;
  title: string;
  price: number;
  original_price: number;
  category: string;
  ai_score: number;
  status: string;
  source: string;
  created_at: string;
}

export default function SourcingPanel() {
  const [stats, setStats] = useState<SourcingStats | null>(null);
  const [runs, setRuns] = useState<SourcingRun[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [products, setProducts] = useState<DiscoveredProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourcing, setSourcing] = useState(false);
  const [config, setConfig] = useState({
    isEnabled: true,
    categories: ['Electronics', 'Home & Garden', 'Beauty & Health', 'Fashion'],
    minPrice: 5,
    maxPrice: 100,
    autoPublishScore: 85,
    maxProductsPerRun: 50,
    scheduleInterval: 21600,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [statsRes, runsRes, schedulerRes, productsRes] = await Promise.all([
        fetch('/api/sourcing/stats'),
        fetch('/api/sourcing/history?limit=10'),
        fetch('/api/sourcing/status'),
        fetch('/api/sourcing/products?limit=20'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (runsRes.ok) setRuns((await runsRes.json()).runs || []);
      if (schedulerRes.ok) setScheduler(await schedulerRes.json());
      if (productsRes.ok) setProducts((await productsRes.json()).products || []);
    } catch (err) {
      console.error('Failed to load sourcing data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runSourcingNow() {
    setSourcing(true);
    try {
      const res = await fetch('/api/sourcing/run', { method: 'POST' });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Sourcing run failed:', err);
    } finally {
      setSourcing(false);
    }
  }

  async function saveConfig() {
    try {
      await fetch('/api/sourcing/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      await loadData();
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(start: string, end?: string) {
    if (!start) return '-';
    const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm">Cargando sourcing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="text-3xl">🤖</span>
            Product Sourcing Agent
          </h2>
          <p className="text-gray-400 mt-1">
            Auto-descubrimiento de productos desde CJ Dropshipping + Gemini AI
          </p>
        </div>
        <button
          onClick={runSourcingNow}
          disabled={sourcing || scheduler?.isRunning}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
            sourcing || scheduler?.isRunning
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25'
          }`}
        >
          {sourcing ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Buscando...
            </span>
          ) : (
            '🔍 Ejecutar Sourcing Ahora'
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Productos Encontrados"
          value={stats?.totalProductsFound || 0}
          icon="📦"
          color="text-blue-400"
        />
        <StatCard
          label="Publicados"
          value={stats?.totalPublished || 0}
          icon="✅"
          color="text-green-400"
        />
        <StatCard
          label="Borradores"
          value={stats?.totalDraft || 0}
          icon="📝"
          color="text-yellow-400"
        />
        <StatCard
          label="Rechazados"
          value={stats?.totalRejected || 0}
          icon="❌"
          color="text-red-400"
        />
      </div>

      {/* Scheduler Status */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          ⏱️ Scheduler Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Estado:</span>
            <span className={`ml-2 font-medium ${scheduler?.isScheduled ? 'text-green-400' : 'text-red-400'}`}>
              {scheduler?.isScheduled ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Ejecutando:</span>
            <span className={`ml-2 font-medium ${scheduler?.isRunning ? 'text-yellow-400' : 'text-gray-300'}`}>
              {scheduler?.isRunning ? 'Sí' : 'No'}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Última ejecución:</span>
            <span className="ml-2 text-gray-300">{formatDate(scheduler?.lastRunAt || '')}</span>
          </div>
          <div>
            <span className="text-gray-400">Próxima ejecución:</span>
            <span className="ml-2 text-gray-300">{formatDate(scheduler?.nextRunAt || '')}</span>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          ⚙️ Configuración
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Categorías</label>
            <div className="flex flex-wrap gap-1">
              {config.categories.map((cat) => (
                <span key={cat} className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs">
                  {cat}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Rango de precio</label>
            <span className="text-white text-sm">${config.minPrice} - ${config.maxPrice}</span>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Score auto-publish</label>
            <span className="text-white text-sm">≥ {config.autoPublishScore}</span>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Productos/run</label>
            <span className="text-white text-sm">{config.maxProductsPerRun}</span>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">Intervalo</label>
            <span className="text-white text-sm">{config.scheduleInterval / 3600}h</span>
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">API Calls usados</label>
            <span className="text-white text-sm">{stats?.apiCallsUsed || 0}</span>
          </div>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          📊 Historial de Runs
        </h3>
        {runs.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay ejecuciones registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-white/10">
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Estado</th>
                  <th className="text-center py-2">Encontrados</th>
                  <th className="text-center py-2">Publicados</th>
                  <th className="text-center py-2">Borradores</th>
                  <th className="text-center py-2">Rechazados</th>
                  <th className="text-center py-2">Duración</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-2 text-gray-300">{formatDate(run.startedAt)}</td>
                    <td className="py-2">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-2 text-center text-blue-400">{run.productsFound}</td>
                    <td className="py-2 text-center text-green-400">{run.productsPublished}</td>
                    <td className="py-2 text-center text-yellow-400">{run.productsDraft}</td>
                    <td className="py-2 text-center text-red-400">{run.productsRejected}</td>
                    <td className="py-2 text-center text-gray-400">
                      {formatDuration(run.startedAt, run.completedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discovered Products */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          🎯 Productos Descubiertos Recientes
        </h3>
        {products.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay productos descubiertos aún</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-indigo-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-white text-sm font-medium line-clamp-2 flex-1">{p.title}</h4>
                  <ScoreBadge score={p.ai_score} />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <span>{p.category}</span>
                  <span>•</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-400 font-semibold">${p.price}</span>
                  {p.original_price > 0 && (
                    <span className="text-gray-500 line-through text-xs">${p.original_price}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-2">{formatDate(p.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: 'bg-yellow-500/20 text-yellow-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    published: 'bg-green-500/20 text-green-400',
    draft: 'bg-yellow-500/20 text-yellow-400',
    rejected: 'bg-red-500/20 text-red-400',
    pending: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'text-gray-400';
  if (score >= 85) color = 'text-green-400';
  else if (score >= 70) color = 'text-yellow-400';
  else if (score >= 50) color = 'text-orange-400';
  else color = 'text-red-400';

  return (
    <span className={`text-xs font-bold ${color} ml-2`}>
      {score}
    </span>
  );
}
