import React, { useState } from 'react';
import { 
  Package, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw, 
  Clock, 
  ShieldCheck, 
  ArrowUpRight, 
  UserCheck, 
  DollarSign, 
  Search,
  ChevronDown,
  ChevronUp,
  XCircle,
  Copy,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { SupplierOrder } from '../../types';

export const FulfillmentOrdersTable: React.FC = () => {
  const { 
    supplierOrders, 
    performPrePurchaseVerification, 
    executeSupplierPurchase, 
    markSupplierOrderAsManualBought, 
    updateSupplierOrderTracking, 
    cancelSupplierOrder,
    connectors 
  } = useApp();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  
  // Manual purchase modal / popover state
  const [manualBuyOrder, setManualBuyOrder] = useState<SupplierOrder | null>(null);
  const [manualRefNotes, setManualRefNotes] = useState('');
  const [manualTracking, setManualTracking] = useState('');
  const [manualCarrier, setManualCarrier] = useState('Correos Express / DHL');

  // Tracking update modal state
  const [trackingOrder, setTrackingOrder] = useState<SupplierOrder | null>(null);
  const [inputTracking, setInputTracking] = useState('');
  const [inputCarrier, setInputCarrier] = useState('DHL Express');

  // Verification loading state
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const filteredOrders = supplierOrders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.sourcePlatform.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerShippingAddress.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleVerify = async (order: SupplierOrder) => {
    setVerifyingId(order.id);
    try {
      await performPrePurchaseVerification(order.productId, order.id);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleExecutePurchase = async (order: SupplierOrder) => {
    setBuyingId(order.id);
    try {
      await executeSupplierPurchase(order.id);
    } finally {
      setBuyingId(null);
    }
  };

  const handleSaveManualPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBuyOrder) return;
    await markSupplierOrderAsManualBought(manualBuyOrder.id, manualRefNotes, manualTracking, manualCarrier);
    setManualBuyOrder(null);
    setManualRefNotes('');
    setManualTracking('');
  };

  const handleSaveTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingOrder || !inputTracking.trim()) return;
    await updateSupplierOrderTracking(trackingOrder.id, inputTracking.trim(), inputCarrier);
    setTrackingOrder(null);
    setInputTracking('');
  };

  const getStatusBadge = (status: SupplierOrder['status']) => {
    switch (status) {
      case 'order_placed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Tramitado / Pagado</span>
          </span>
        );
      case 'human_action_required':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/35 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Acción Humana Requerida</span>
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Truck className="w-3.5 h-3.5" />
            <span>Enviado al Cliente</span>
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Check className="w-3.5 h-3.5" />
            <span>Entregado</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/30">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelado</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Pendiente Verificación</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2.5 font-serif">
            <Truck className="w-5 h-5 text-indigo-400" />
            <span>Centro de Fulfillment & Compras a Proveedores</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestión de compras a origen, verificación previa de stock y tracking directo para cada pedido
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por orden, cliente, producto..."
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="all" className="bg-[#0d111d]">Todos los Estados</option>
            <option value="human_action_required" className="bg-[#0d111d]">⚠ Acción Humana Requerida</option>
            <option value="order_placed" className="bg-[#0d111d]">Comprado a Proveedor</option>
            <option value="shipped" className="bg-[#0d111d]">Enviado con Tracking</option>
            <option value="delivered" className="bg-[#0d111d]">Entregado</option>
            <option value="cancelled" className="bg-[#0d111d]">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Orders List / Table */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/10 backdrop-blur-md">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No hay órdenes de fulfillment registradas</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Cuando un cliente compre en la tienda pública, las órdenes de compra a proveedor y las verificaciones previas se generarán aquí automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderId === order.id;
            const verification = order.prePurchaseVerification;
            const isAutoConnector = order.sourcePlatform === 'Supplier Hub B2B';

            return (
              <div 
                key={order.id}
                className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-xl transition-all hover:border-white/20"
              >
                {/* Main Row */}
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Product & Customer info */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-indigo-400">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-white">{order.id}</span>
                        <span className="text-slate-500">•</span>
                        <span className="text-xs text-slate-400">Cliente: <strong className="text-slate-200">{order.customerShippingAddress.fullName}</strong></span>
                        <span className="text-slate-500">•</span>
                        <span className="text-xs text-slate-400 font-mono">Pedido #{order.orderId}</span>
                      </div>
                      
                      <h4 className="text-sm font-bold text-slate-100 line-clamp-1">{order.productTitle}</h4>
                      
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                        <span>Origen: <strong className="text-slate-200">{order.sourcePlatform}</strong></span>
                        <span>•</span>
                        <span>Cant: <strong className="text-slate-200">{order.quantity}x</strong></span>
                        <span>•</span>
                        <span>Costo: <strong className="text-amber-300">€{order.totalCostEur.toFixed(2)}</strong></span>
                        <span>•</span>
                        <span>Venta: <strong className="text-emerald-300">€{order.totalRevenueEur.toFixed(2)}</strong></span>
                        <span>•</span>
                        <span>Margen: <strong className="text-emerald-400 font-mono">+{order.estimatedMarginPct}%</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Status & Pre-Purchase Badge */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {getStatusBadge(order.status)}

                    {verification && (
                      <div className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${
                        verification.passed 
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' 
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                      }`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verificación: {verification.passed ? 'Superada' : 'Alertada'}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0 border-white/10">
                    
                    {/* Re-Verify Live Button */}
                    <button
                      type="button"
                      disabled={verifyingId === order.id}
                      onClick={() => handleVerify(order)}
                      title="Comprobar stock y delta de precio en origen"
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${verifyingId === order.id ? 'animate-spin text-indigo-400' : ''}`} />
                      <span className="hidden sm:inline">Verificar</span>
                    </button>

                    {/* Auto-buy (if B2B supported) or Manual-buy button */}
                    {order.status === 'human_action_required' ? (
                      <button
                        type="button"
                        onClick={() => setManualBuyOrder(order)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-amber-600/20 flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Registrar Compra Asistida</span>
                      </button>
                    ) : order.status === 'ready_to_order' && isAutoConnector ? (
                      <button
                        type="button"
                        disabled={buyingId === order.id}
                        onClick={() => handleExecutePurchase(order)}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-600/25 flex items-center gap-1.5"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>{buyingId === order.id ? 'Tramitando...' : 'Ordenar Automático'}</span>
                      </button>
                    ) : null}

                    {/* Add / Edit Tracking */}
                    {order.status === 'order_placed' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTrackingOrder(order);
                          setInputTracking(order.trackingNumber || '');
                          setInputCarrier(order.carrier || 'DHL Express');
                        }}
                        className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-medium rounded-xl text-xs transition-colors flex items-center gap-1.5"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>{order.trackingNumber ? 'Editar Tracking' : 'Añadir Tracking'}</span>
                      </button>
                    )}

                    {/* Expand Details */}
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2 border-t border-white/10 bg-white/[0.01] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    
                    {/* Destination Address */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Dirección de Envío del Cliente</span>
                      </div>
                      <div className="text-slate-200 font-medium">{order.customerShippingAddress.fullName}</div>
                      <div className="text-slate-400">{order.customerShippingAddress.address}</div>
                      <div className="text-slate-400">{order.customerShippingAddress.city}, {order.customerShippingAddress.postalCode}</div>
                      <div className="text-slate-400">{order.customerShippingAddress.country}</div>
                      {order.customerShippingAddress.phone && (
                        <div className="text-slate-400">Tel: {order.customerShippingAddress.phone}</div>
                      )}
                    </div>

                    {/* Pre-purchase Verification Matrix */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Verificación de Suministro</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Stock en Almacén:</span>
                        <span className="text-emerald-400 font-medium">Disponible</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Costo Base Proveedor:</span>
                        <span className="text-slate-200 font-mono">€{order.unitCostEur.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Portes de Origen:</span>
                        <span className="text-slate-200 font-mono">€{order.shippingCostEur.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Margen Neto Estimado:</span>
                        <span className="text-emerald-400 font-mono font-bold">+{order.estimatedMarginPct}%</span>
                      </div>
                      {verification?.notes && (
                        <div className="text-[11px] text-slate-400 pt-1 border-t border-white/5 italic">
                          "{verification.notes}"
                        </div>
                      )}
                    </div>

                    {/* Supplier Order Details & Link */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                      <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-blue-400" />
                        <span>Datos de Compra en Origen</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Proveedor:</span>
                        <span className="text-slate-200 font-medium">{order.supplierName}</span>
                      </div>
                      {order.supplierOrderReference && (
                        <div className="flex justify-between text-slate-400">
                          <span>Ref. Compra:</span>
                          <span className="text-slate-200 font-mono">{order.supplierOrderReference}</span>
                        </div>
                      )}
                      {order.trackingNumber && (
                        <div className="flex justify-between text-slate-400">
                          <span>Tracking:</span>
                          <span className="text-blue-400 font-mono font-semibold">{order.trackingNumber}</span>
                        </div>
                      )}
                      {order.sourceUrl && (
                        <a
                          href={order.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold"
                        >
                          <span>Abrir enlace directo de origen</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Manual Buy Registration */}
      {manualBuyOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="bg-[#0d111d] border border-white/15 rounded-2xl max-w-lg w-full p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Registrar Compra Asistida</h3>
              </div>
              <button onClick={() => setManualBuyOrder(null)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] leading-relaxed">
              <strong>Instrucciones para el Operador:</strong> Abre el enlace de origen, añade el producto al carrito e introduce la dirección de envío del cliente: <strong>{manualBuyOrder.customerShippingAddress.fullName}, {manualBuyOrder.customerShippingAddress.city}</strong>.
            </div>

            <form onSubmit={handleSaveManualPurchase} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Nº Pedido / ID de Transacción del Marketplace</label>
                <input
                  type="text"
                  required
                  value={manualRefNotes}
                  onChange={(e) => setManualRefNotes(e.target.value)}
                  placeholder="Ej. AMZ-402-9841294 o ALI-8192384912"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Código de Tracking (Opcional si ya se ha generado)</label>
                <input
                  type="text"
                  value={manualTracking}
                  onChange={(e) => setManualTracking(e.target.value)}
                  placeholder="Ej. ES948192841"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Transportista / Courier</label>
                <input
                  type="text"
                  value={manualCarrier}
                  onChange={(e) => setManualCarrier(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setManualBuyOrder(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-600/25"
                >
                  Confirmar Compra Realizada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Tracking */}
      {trackingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="bg-[#0d111d] border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <Truck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm text-white">Actualizar Código de Seguimiento</h3>
              </div>
              <button onClick={() => setTrackingOrder(null)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTracking} className="space-y-4">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Número de Seguimiento (Tracking ID)</label>
                <input
                  type="text"
                  required
                  value={inputTracking}
                  onChange={(e) => setInputTracking(e.target.value)}
                  placeholder="Ej. TRK-DHL-918239 o 0034009281928"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Empresa de Mensajería</label>
                <input
                  type="text"
                  value={inputCarrier}
                  onChange={(e) => setInputCarrier(e.target.value)}
                  placeholder="Ej. DHL Express, Correos Express, SEUR, FedEx"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setTrackingOrder(null)}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/25"
                >
                  Guardar y Notificar Envío
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
