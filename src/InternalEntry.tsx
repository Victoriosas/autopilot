import React from 'react';
import App from './App';
import { AppProvider, useApp } from './context/AppContext';
import { AuthModal } from './components/auth/AuthModal';

function Access() {
  const { userRole, viewMode, setViewMode, isAuthModalOpen, setIsAuthModalOpen } = useApp();
  const professional = window.location.pathname.replace(/\/$/, '') === '/beauty-professional';
  React.useEffect(() => {
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'noindex,nofollow');
    if (!professional && userRole === 'admin') setViewMode('admin');
  }, [professional, userRole, setViewMode]);
  if (professional) return <App />;
  if (userRole === 'admin') return viewMode === 'admin' ? <App /> : <p role="status">Cargando administración…</p>;
  return <main className="min-h-screen bg-stone-50 p-8 text-stone-800">
    <h1 className="text-3xl">Acceso administrativo</h1>
    <p className="my-6">Se requiere una cuenta autorizada.</p>
    <button className="rounded border p-3" onClick={() => setIsAuthModalOpen(true)}>Iniciar sesión</button>
    <p className="my-6"><a href="/">Volver a Victoriosas</a></p>
    <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} adminRequiredNotice />
  </main>;
}
export default function InternalEntry() {
  return <AppProvider internalOnly><Access /></AppProvider>;
}
