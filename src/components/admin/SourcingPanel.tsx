import { useState, useEffect } from 'react';
import { apiFetch, apiPost } from '../../lib/api';

interface SourcingStats {
  totalProducts: number;
  cjProducts: number;
  lastSourcingAt: string | null;
  avgPrice: number;
}

interface SourcedProduct {
  id: string;
  title: string;
  price: number;
  compare_at_price?: number;
  category: string;
  status: string;
  sku: string;
  created_at: string;
  brand?: string;
}

interface SchedulerStatus {
  isRunning: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  isScheduled: boolean;
}

export default function SourcingPanel() {
  const [stats, setStats] = useState<SourcingStats | null>(null);
  const [products, setProducts] = useState<SourcedProduct[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sourcing, setSourcing] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [productsRes, schedulerRes] = await Promise.all([
        apiFetch('/api/products'),
        apiFetch('/api/sourcing/status'),
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        const prods = data.products || data || [];
        const cjProducts = prods.filter((p: SourcedProduct) => p.sku?.startsWith('CJ-'));
        setProducts(cjProducts);
        setStats({
          totalProducts: prods.length,
          cjProducts: cjProducts.length,
          lastSourcingAt: cjProducts.length > 0 ? cjProducts[0].created_at : null,
          avgPrice: cjProducts.length > 0
            ? cjProducts.reduce((sum: number, p: SourcedProduct) => sum + (p.price || 0), 0) / cjProducts.length
            : 0,
        });
      }

      if (schedulerRes.ok) {
        setScheduler(await schedulerRes.json());
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runSourcingNow() {
    setSourcing(true);
    setLastResult(null);
    try {
      const res = await apiPost('/api/sourcing/run');
      const data = await res.json();
      setLastResult(data);
      await loadData();
    } catch (err) {
      setLastResult({ error: 'Sourcing failed' });
    } finally {
      setSourcing(false);
    }
  }

  function formatCurrency(val: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Nunca';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'Ahora mismo';
    if (diffMin < 60) return `Hace ${diffMin}min`;
    if (diffMin < 1440) return `Hace ${Math.floor(diffMin / 60)}h`;
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
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
            Auto-descubrimiento desde CJ Dropshipping + Gemini AI
          </p>
        </div>
        <button
          onClick={runSourcingNow}
          disabled={sourcing}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
            sourcing
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25'
          }`}
        >
          {sourcing ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Buscando productos...
            </span>
          ) : (
            '🔍 Ejecutar Sourcing Ahora'
          )}
        </button>
      </div>

      {/* Last Result */}
      {lastResult && (
        <div className={`rounded-2xl p-4 border ${
          lastResult.error ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'
        }`}>
          {lastResult.error ? (
            <p className="text-red-400 text-sm">❌ {lastResult.error}</p>
          ) : (
            <div className="text-sm">
              <p className="text-green-400 font-medium mb-1">✅ Sourcing completado</p>
              <div className="flex gap-4 text-gray-300">
                <span>📦 {lastResult.productsFound} encontrados</span>
                <span className="text-green-400">✅ {lastResult.published} publicados</span>
                <span className="text-yellow-400">📝 {lastResult.draft} borradores</span>
                <span className="text-red-400">❌ {lastResult.rejected} rechazados</span>
                <span className="text-gray-400">⏱️ {(lastResult.duration / 1000).toFixed(1)}s</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Productos CJ"
          value={stats?.cjProducts || 0}
          icon="📦"
          color="text-blue-400"
          sub={`de ${stats?.totalProducts || 0} total`}
        />
        <StatCard
          label="Precio Promedio"
          value={stats?.avgPrice ? formatCurrency(stats.avgPrice) : '$0'}
          icon="💰"
          color="text-green-400"
        />
        <StatCard
          label="Último Sourcing"
          value={formatDate(stats?.lastSourcingAt || null)}
          icon="🕐"
          color="text-purple-400"
        />
        <StatCard
          label="Scheduler"
          value={scheduler?.isScheduled ? 'Activo' : 'Inactivo'}
          icon="⏱️"
          color={scheduler?.isScheduled ? 'text-green-400' : 'text-red-400'}
        />
      </div>

      {/* Sourced Products */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          🎯 Productos Sourced from CJ ({products.length})
        </h3>
        {products.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-4">No hay productos sourced aún</p>
            <button
              onClick={runSourcingNow}
              disabled={sourcing}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-500"
            >
              Ejecutar primer sourcing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div
                key={p.id}
                className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-indigo-500/30 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-white text-sm font-medium line-clamp-2 flex-1">{p.title}</h4>
                  <StatusBadge status={p.status} />
                </div>
                <div className="text-xs text-gray-400 mb-2">{p.category}</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-400 font-semibold">{formatCurrency(p.price)}</span>
                  <span className="text-xs text-gray-500">{p.sku}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">{formatDate(p.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduler Info */}
      <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          ⏱️ Scheduler Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Estado:</span>
            <span className={`ml-2 font-medium ${scheduler?.isScheduled ? 'text-green-400' : 'text-red-400'}`}>
              {scheduler?.isScheduled ? 'Activo (cada 6h)' : 'Inactivo'}
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
            <span className="ml-2 text-gray-300">{formatDate(scheduler?.lastRunAt || null)}</span>
          </div>
          <div>
            <span className="text-gray-400">Próxima:</span>
            <span className="ml-2 text-gray-300">{formatDate(scheduler?.nextRunAt || null)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, sub }: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-gray-400 text-xs">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
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
