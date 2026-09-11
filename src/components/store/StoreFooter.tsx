import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  Bot, 
  Heart, 
  Mail, 
  Check, 
  ExternalLink,
  Lock,
  Cpu
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const StoreFooter: React.FC = () => {
  const { setViewMode, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    showToast('¡Bienvenido al Club Victoriosa! Recibirás primicias de catálogo.', 'success');
  };

  return (
    <footer className="bg-black/40 border-t border-white/10 text-slate-400 text-xs backdrop-blur-xl">
      
      {/* 3 Pillars of Victoriosa Care */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Garantía Victoriosa Care 3 Años</h4>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Reemplazo inmediato sin fricción y asistencia técnica directa desde Madrid.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Logística Express Asegurada</h4>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Entrega nacional en 24/48h y trazabilidad continua vía código de tracking directo.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">Curaduría Autopilot™</h4>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                Solo productos con Score &gt;85 y rigurosa auditoría de materiales llegan al catálogo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand column */}
        <div className="space-y-4 md:col-span-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-serif font-black text-white text-base shadow-md shadow-indigo-500/20 border border-white/20">
              V
            </div>
            <span className="font-serif tracking-widest text-lg font-bold text-white">
              VICTORIOSA
            </span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            La tienda del futuro impulsada por un Autopilot inteligente de curaduría, análisis y fijación de precios en tiempo real.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setViewMode('admin')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-indigo-300 border border-white/10 font-mono text-[11px] transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Consola Autopilot (Admin)</span>
            </button>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-3">
          <h5 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Colecciones</h5>
          <ul className="space-y-2 text-slate-400">
            <li><a href="#catalogo" className="hover:text-indigo-400 transition-colors">Relojería & Cronógrafos</a></li>
            <li><a href="#catalogo" className="hover:text-indigo-400 transition-colors">Audio & Sonido Hi-Fi</a></li>
            <li><a href="#catalogo" className="hover:text-indigo-400 transition-colors">Hogar & Confort</a></li>
            <li><a href="#catalogo" className="hover:text-indigo-400 transition-colors">Accesorios Tech</a></li>
          </ul>
        </div>

        {/* Customer Care */}
        <div className="space-y-3">
          <h5 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Atención al Cliente</h5>
          <ul className="space-y-2 text-slate-400">
            <li><span className="hover:text-slate-200 cursor-pointer">Seguimiento de Pedido</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Política de Devoluciones (30 Días)</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Términos y Condiciones</span></li>
            <li><span className="hover:text-slate-200 cursor-pointer">Contacto: ayuda@victoriosa.es</span></li>
          </ul>
        </div>

        {/* Newsletter */}
        <div className="space-y-3">
          <h5 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Club Victoriosa</h5>
          <p className="text-slate-400 text-xs">
            Sé el primero en acceder a lanzamientos curados y drops limitados.
          </p>
          {subscribed ? (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>¡Suscripción confirmada!</span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Tu correo electrónico..."
                  className="w-full pl-3.5 pr-8 py-2 bg-black/40 border border-white/10 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-indigo-400"
                >
                  <Mail className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>

      </div>

      {/* Copyright Bar */}
      <div className="border-t border-white/10 bg-black/20 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <p>© {new Date().getFullYear()} Victoriosa™ — Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <span>Privacidad Cifrada</span>
            <span>•</span>
            <span>Conformidad UE</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-400">
              <Lock className="w-3 h-3 text-emerald-400" /> Cifrado SSL 256-bit
            </span>
          </div>
        </div>
      </div>

    </footer>
  );
};
