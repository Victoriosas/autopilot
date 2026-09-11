import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  ShieldCheck, 
  Percent, 
  Truck, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Save, 
  Plus, 
  Trash2,
  CheckCircle2
} from 'lucide-react';
import type { Supplier } from '../../types';

interface SupplierModalProps {
  supplier?: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplierData: any) => Promise<void>;
}

export const SupplierModal: React.FC<SupplierModalProps> = ({
  supplier,
  isOpen,
  onClose,
  onSave
}) => {
  const isEdit = !!supplier;

  const [name, setName] = useState(supplier?.name || '');
  const [code, setCode] = useState(supplier?.code || `SUP-${Math.floor(Math.random() * 8999 + 1000)}`);
  const [status, setStatus] = useState<Supplier['status']>(supplier?.status || 'active');
  const [contactName, setContactName] = useState(supplier?.contact.contactName || '');
  const [email, setEmail] = useState(supplier?.contact.email || '');
  const [phone, setPhone] = useState(supplier?.contact.phone || '');
  const [country, setCountry] = useState(supplier?.contact.country || 'España');
  const [city, setCity] = useState(supplier?.contact.city || 'Madrid');
  const [address, setAddress] = useState(supplier?.contact.address || '');
  const [website, setWebsite] = useState(supplier?.contact.website || '');
  const [categories, setCategories] = useState<string[]>(supplier?.catalogs.categories || ['Tecnología & Gadgets']);
  const [categoryInput, setCategoryInput] = useState('');
  const [leadTimeMin, setLeadTimeMin] = useState(supplier?.pricingAgreements.leadTimeDaysMin || 2);
  const [leadTimeMax, setLeadTimeMax] = useState(supplier?.pricingAgreements.leadTimeDaysMax || 4);
  const [moq, setMoq] = useState(supplier?.catalogs.minOrderQty || 1);
  const [baseDiscount, setBaseDiscount] = useState(supplier?.pricingAgreements.baseDiscountPct || 15);
  const [avgShipping, setAvgShipping] = useState(supplier?.pricingAgreements.avgShippingPerUnit || 3.5);
  const [paymentTerms, setPaymentTerms] = useState(supplier?.pricingAgreements.paymentTerms || 'Net 30');
  const [returnAgreement, setReturnAgreement] = useState(supplier?.pricingAgreements.returnAgreement || '30 días sin coste con recogida');
  const [reliabilityScore, setReliabilityScore] = useState(supplier?.metrics.reliabilityScore || 90);
  const [fulfillmentRate, setFulfillmentRate] = useState(supplier?.metrics.fulfillmentRate || 98);
  const [defectRate, setDefectRate] = useState(supplier?.metrics.defectRate || 0.4);

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddCategory = () => {
    if (categoryInput.trim() && !categories.includes(categoryInput.trim())) {
      setCategories([...categories, categoryInput.trim()]);
      setCategoryInput('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const data = {
        ...(supplier ? { id: supplier.id } : {}),
        name,
        code,
        status,
        contact: {
          contactName,
          email,
          phone,
          country,
          city,
          address,
          website
        },
        catalogs: {
          categories,
          productCount: supplier?.catalogs.productCount || 0,
          leadTimeDays: Math.round((leadTimeMin + leadTimeMax) / 2),
          minOrderQty: Number(moq),
          inventoryStatus: 'high' as const
        },
        pricingAgreements: {
          baseDiscountPct: Number(baseDiscount),
          volumeTiers: supplier?.pricingAgreements.volumeTiers || [
            { minUnits: 10, discountPct: Number(baseDiscount) },
            { minUnits: 50, discountPct: Number(baseDiscount) + 5 },
            { minUnits: 200, discountPct: Number(baseDiscount) + 10 }
          ],
          paymentTerms,
          avgShippingPerUnit: Number(avgShipping),
          currency: 'EUR',
          returnAgreement
        },
        metrics: {
          reliabilityScore: Number(reliabilityScore),
          fulfillmentRate: Number(fulfillmentRate),
          defectRate: Number(defectRate),
          avgDispatchDays: Math.max(1, Math.round(leadTimeMin / 2))
        }
      };

      await onSave(data);
      onClose();
    } catch (err) {
      console.error('Error saving supplier:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xl overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-3xl bg-[#0d111d]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white">
                {isEdit ? `Editar Proveedor: ${supplier?.name}` : 'Registrar Nuevo Proveedor'}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Gestión de acuerdos B2B, catálogo y parámetros de evaluación Autopilot
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-xs text-slate-300">
          
          {/* 1. General Info */}
          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              1. Información General y Estado
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej. Nordic Timepieces GmbH"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Código Identificador</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Estado de Homologación</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#121626] border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="active">Activo (Autorizado para Autopilot)</option>
                  <option value="evaluating">En Evaluación / Auditoría</option>
                  <option value="restricted">Restringido / En Pausa</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Sitio Web / Portal B2B</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://proveedor.com"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 2. Contact Details */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-2">
              <Mail className="w-4 h-4 text-emerald-400" />
              2. Contacto & Ubicación Logística
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Persona de Contacto</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="ej. Elena García (Key Account)"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="b2b@proveedor.com"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Teléfono / WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+34 912 345 678"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">País de Despacho</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="España / UE"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Ciudad</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Madrid"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Dirección Almacén</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Polígono Logístico Norte, Nave 4"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white backdrop-blur-md focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 3. Catalog & Categories */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-400" />
              3. Categorías Suministradas & Plazos de Entrega
            </h3>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Categorías de Producto</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                  placeholder="Añadir categoría (ej. Relojería, Audio, Hogar...)"
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 backdrop-blur-sm"
                  >
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat)}
                      className="hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Plazo Mínimo (Días)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={leadTimeMin}
                  onChange={(e) => setLeadTimeMin(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Plazo Máximo (Días)</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={leadTimeMax}
                  onChange={(e) => setLeadTimeMax(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Pedido Mínimo (MOQ)</label>
                <input
                  type="number"
                  min="1"
                  value={moq}
                  onChange={(e) => setMoq(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* 4. Pricing & Agreements */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-400" />
              4. Acuerdos de Precio & Descuento B2B
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Descuento Base Mayorista (%)</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={baseDiscount}
                  onChange={(e) => setBaseDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Costo Envío / Unidad (€)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={avgShipping}
                  onChange={(e) => setAvgShipping(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Términos de Pago</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="ej. Net 30, Prepago 50%"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase block mb-1">Política de Devolución & Garantía</label>
              <input
                type="text"
                value={returnAgreement}
                onChange={(e) => setReturnAgreement(e.target.value)}
                placeholder="30 días sin coste con recogida a domicilio"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 5. Performance Metrics */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              5. Métricas de Rendimiento & Fiabilidad
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Puntuación Fiabilidad (0-100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={reliabilityScore}
                  onChange={(e) => setReliabilityScore(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Tasa de Cumplimiento (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="0.1"
                  value={fulfillmentRate}
                  onChange={(e) => setFulfillmentRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase block mb-1">Tasa de Defectos (%)</label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.1"
                  value={defectRate}
                  onChange={(e) => setDefectRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando en Firestore...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{isEdit ? 'Guardar Cambios' : 'Registrar Proveedor'}</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
