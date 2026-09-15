import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Mail, Sparkles } from 'lucide-react';

type State='idle'|'sending'|'success'|'error';

export const WaitlistSection:React.FC=()=>{
  const [email,setEmail]=useState('');
  const [interest,setInterest]=useState('general');
  const [consent,setConsent]=useState(false);
  const [website,setWebsite]=useState('');
  const [state,setState]=useState<State>('idle');
  const [message,setMessage]=useState('');

  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(state==='sending') return;
    setState('sending');setMessage('');
    try{
      const response=await fetch('/api/storefront/waitlist',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({email,interest,consent,website,source:'storefront_waitlist'}),
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data?.error||`HTTP_${response.status}`);
      setState('success');setEmail('');setConsent(false);
    }catch(error:any){
      setState('error');
      setMessage(error?.message==='WAITLIST_EMAIL_INVALID'?'Revisá el email e intentá otra vez.':error?.message==='WAITLIST_CONSENT_REQUIRED'?'Necesitamos tu consentimiento para avisarte.':'No pudimos guardar tu lugar ahora. Probá nuevamente en unos minutos.');
    }
  };

  return <section id="lista-prioritaria" className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20 bg-[#3b2b28] text-[#f8f1e8]">
    <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_.95fr] gap-10 lg:gap-16 items-center">
      <div>
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#d9b9a8] font-semibold"><Sparkles className="w-3.5 h-3.5"/> Primera selección</div>
        <h2 className="font-serif text-3xl sm:text-5xl leading-tight mt-4">Entrá antes de que abramos las puertas.</h2>
        <p className="mt-5 max-w-xl text-sm sm:text-base leading-7 text-[#eadbd2]">Estamos curando la primera colección de Victoriosa para Uruguay. Dejanos tu email y tu interés principal: te avisamos cuando haya productos realmente listos, no cuando todavía son una promesa bonita.</p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs text-[#d9b9a8]">
          <span>• acceso al lanzamiento</span><span>• novedades de la colección</span><span>• sin spam</span>
        </div>
      </div>

      <div className="rounded-3xl bg-[#f8f1e8] text-[#3b2b28] p-6 sm:p-8 shadow-2xl shadow-black/15">
        {state==='success'?<div className="min-h-64 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-emerald-700"/></div>
          <h3 className="font-serif text-2xl mt-5">Ya estás dentro.</h3>
          <p className="text-sm text-[#715f59] mt-2 max-w-sm">Guardamos tu lugar para el lanzamiento. Te avisaremos cuando Victoriosa tenga algo que realmente merezca tu atención.</p>
          <button onClick={()=>setState('idle')} className="mt-6 text-xs underline underline-offset-4">Agregar otro email</button>
        </div>:<form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-2">Email</label>
            <div className="relative"><Mail className="absolute left-3 top-3.5 w-4 h-4 text-[#9b847a]"/><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} placeholder="vos@ejemplo.com" className="w-full rounded-xl border border-[#ddcec5] bg-white px-10 py-3 text-sm outline-none focus:border-[#7b594c]"/></div>
          </div>
          <div>
            <label className="text-xs font-semibold block mb-2">¿Qué querés ver primero?</label>
            <select value={interest} onChange={e=>setInterest(e.target.value)} className="w-full rounded-xl border border-[#ddcec5] bg-white px-3 py-3 text-sm outline-none focus:border-[#7b594c]">
              <option value="general">Quiero descubrir la colección</option>
              <option value="facial_accessories">Accesorios de skincare</option>
              <option value="makeup_organization">Organización de maquillaje</option>
              <option value="reusable_care">Cuidado reutilizable</option>
              <option value="body_care">Cuidado corporal</option>
            </select>
          </div>
          <input tabIndex={-1} aria-hidden="true" value={website} onChange={e=>setWebsite(e.target.value)} className="absolute opacity-0 pointer-events-none" autoComplete="off" />
          <label className="flex items-start gap-3 text-[11px] leading-5 text-[#715f59]"><input required type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1"/><span>Acepto que Victoriosa use mi email para avisarme sobre el lanzamiento y novedades relacionadas. Puedo dejar de recibirlas cuando quiera.</span></label>
          {state==='error'&&<p className="text-xs text-rose-700">{message}</p>}
          <button disabled={state==='sending'} className="w-full rounded-xl bg-[#3b2b28] text-white py-3.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#4c3733] disabled:opacity-60">{state==='sending'?'Guardando tu lugar…':<>Quiero estar en la primera lista <ArrowRight className="w-4 h-4"/></>}</button>
          <p className="text-[10px] text-[#9b847a] text-center">Solo usamos los datos necesarios para esta lista de lanzamiento.</p>
        </form>}
      </div>
    </div>
  </section>;
};
