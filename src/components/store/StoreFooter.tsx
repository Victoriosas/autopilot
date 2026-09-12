import React from 'react';
import { useApp } from '../../context/AppContext';

export const StoreFooter: React.FC = () => {
  const { setViewMode, userProfile } = useApp();
  return (
    <footer className="bg-black/40 border-t border-white/10 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-3">
        <div>
          <h2 className="font-serif tracking-widest text-lg text-white">VICTORIOSA</h2>
          <p className="mt-3">Productos para descubrir. Una tienda en preparación para Uruguay.</p>
          {userProfile?.role === 'admin' && <button onClick={() => setViewMode('admin')} className="mt-4 text-indigo-300">Administrar tienda</button>}
        </div>
        <div>
          <h3 className="font-semibold text-white">Catálogo y disponibilidad</h3>
          <p className="mt-3">Estamos verificando proveedores y condiciones de venta. La presencia de un producto en el catálogo no garantiza stock ni un plazo de entrega.</p>
          <a className="inline-block mt-3 text-indigo-300" href="#catalogo">Explorar productos</a>
        </div>
        <div>
          <h3 className="font-semibold text-white">Antes de comprar</h3>
          <p className="mt-3">Los pagos se habilitarán cuando estén confirmados los precios, envíos y canales de atención. Las garantías y devoluciones se informarán antes de la compra.</p>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-5 text-center text-xs">© {new Date().getFullYear()} Victoriosa</div>
    </footer>
  );
};
