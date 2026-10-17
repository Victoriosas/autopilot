export const BEAUTY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const BEAUTY_SERVICES = ['facial','massage','ritual','consultation'] as const;
export const BEAUTY_STATUSES = ['pending','reviewing','confirmed','completed','cancelled'] as const;
export type BeautyStatus = typeof BEAUTY_STATUSES[number];
export type BeautyInput = {id:string;firstName:string;lastName:string;contact:string;zone:string;service:typeof BEAUTY_SERVICES[number];availability:string;source:string;consent:true;consentVersion:'beauty-v1'};
export function normalizeBeautyRequest(input: unknown): BeautyInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('BEAUTY_INPUT_INVALID');
  const b = input as Record<string, unknown>;
  const keys = ['id','firstName','lastName','contact','zone','service','availability','source','consent','consentVersion'];
  if (Object.keys(b).some(k=>!keys.includes(k)) || b.consent !== true || b.consentVersion !== 'beauty-v1') throw new Error('BEAUTY_INPUT_INVALID');
  function str(key:string,max:number,required=true) {
    if(typeof b[key] !== 'string') throw new Error('BEAUTY_INPUT_INVALID');
    const v=(b[key] as string).trim();
    if((required&&!v)||v.length>max||/[\x00-\x1f<>]/.test(v)) throw new Error('BEAUTY_INPUT_INVALID');
    return v;
  }
  const id=str('id',36).toLowerCase(), contact=str('contact',100), service=str('service',20);
  if(!BEAUTY_UUID.test(id)||!BEAUTY_SERVICES.includes(service as any)) throw new Error('BEAUTY_INPUT_INVALID');
  const digits=contact.replace(/\D/g,'').length;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)&&!( /^\+?[\d ()-]{8,25}$/.test(contact)&&digits>=8&&digits<=15)) throw new Error('BEAUTY_CONTACT_INVALID');
  const source=str('source',20);
  if(!['web','instagram','facebook','whatsapp','recomendacion'].includes(source)) throw new Error('BEAUTY_INPUT_INVALID');
  return {id,firstName:str('firstName',60),lastName:str('lastName',60),contact,zone:str('zone',100),service:service as BeautyInput['service'],availability:str('availability',120,false),source,consent:true,consentVersion:'beauty-v1'};
}
export function beautyWhatsAppUrl(id:string) {
  if(!BEAUTY_UUID.test(id)) throw new Error('BEAUTY_REFERENCE_INVALID');
  return 'https://wa.me/59897045305?text='+encodeURIComponent(`Hola Sofía, registré mi consulta en Victoriosas. Referencia: ${id}. Quisiera coordinar los próximos pasos.`);
}
export function beautyTransition(from:BeautyStatus,to:BeautyStatus) {
  const allowed:Record<BeautyStatus,BeautyStatus[]>={pending:['reviewing','cancelled'],reviewing:['confirmed','cancelled'],confirmed:['completed','cancelled'],completed:[],cancelled:[]};
  return allowed[from]?.includes(to) || false;
}
