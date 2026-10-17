import {Router,type RequestHandler} from 'express';
import {requireSupabaseAdminAuth} from '../security/adminAuth';
import {safeCatalogUrl} from '../storefront/salesChannel';

const programs = [
 {id:'aliexpress',name:'AliExpress',env:'ALIEXPRESS_AFFILIATE_URL',hosts:['s.click.aliexpress.com','www.aliexpress.com','aliexpress.com'],signup:'https://portals.aliexpress.com/',kind:'products'},
 {id:'cj',name:'CJ Dropshipping',env:'CJ_AFFILIATE_URL',hosts:['cjdropshipping.com','www.cjdropshipping.com','affiliate.cjdropshipping.com'],signup:'https://affiliate.cjdropshipping.com/',kind:'referrals'},
 {id:'dsers',name:'DSers',env:'DSERS_AFFILIATE_URL',hosts:['www.dsers.com','dsers.com','dsers.partnerstack.com'],signup:'https://www.dsers.com/dsers-affiliate-program',kind:'subscriptions'},
] as const;

export function affiliatePrograms(env:NodeJS.ProcessEnv=process.env) {
 return programs.map(p=>{
  const url=safeCatalogUrl(env[p.env]);
  const valid=!!url && (p.hosts as readonly string[]).includes(url.hostname);
  const reviewed=env[p.env+'_APPROVED']==='true';
  return {id:p.id,name:p.name,kind:p.kind,signup:p.signup,
   state:!env[p.env]?'missing_link':!valid?'invalid_link':!reviewed?'approval_required':'configured',
   url:valid&&reviewed?url!.href:null};
 });
}

export async function researchProducts(query:unknown,options:{env?:NodeJS.ProcessEnv;fetcher?:typeof fetch}={}) {
 const env=options.env||process.env,fetcher=options.fetcher||fetch;
 if(typeof query!=='string'||query.trim().length<3||query.length>200) throw Error('INVALID_QUERY');
 if(!env.FIRECRAWL_API_KEY?.trim()) throw Error('FIRECRAWL_NOT_CONFIGURED');
 const response=await fetcher('https://api.firecrawl.dev/v2/search',{
  method:'POST',headers:{Authorization:'Bearer '+env.FIRECRAWL_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({query:query.trim(),includeDomains:['aliexpress.com','cjdropshipping.com'],limit:5,sources:['web'],domainTools:false}),
  signal:AbortSignal.timeout(20000),redirect:'error'
 });
 if(!response.ok) throw Error('FIRECRAWL_REQUEST_FAILED');
 const result=await response.json();
 if(result.success!==true||!Array.isArray(result.data?.web)) throw Error('FIRECRAWL_INVALID_RESPONSE');
 return result.data.web.slice(0,5).flatMap((item:any)=>{
  const url=safeCatalogUrl(item?.url);
  if(!url||!['aliexpress.com','cjdropshipping.com'].some(h=>url.hostname===h||url.hostname.endsWith('.'+h)))return [];
  return [{title:String(item.title||'').slice(0,160),url:url.href,description:String(item.description||'').slice(0,1500),reviewRequired:true}];
 });
}

export function createAffiliateResearchRouter(deps:{auth?:RequestHandler;env?:NodeJS.ProcessEnv;fetcher?:typeof fetch}={}) {
 const router=Router(),env=deps.env||process.env;
 router.use(deps.auth||requireSupabaseAdminAuth);
 router.get('/status',(_req,res)=>res.json({firecrawl:{configured:!!env.FIRECRAWL_API_KEY?.trim()},programs:affiliatePrograms(env)}));
 router.post('/search',async(req,res)=>{
  try{return res.json({candidates:await researchProducts(req.body?.query,{env,fetcher:deps.fetcher}),notice:'Fuentes para revisar: no confirman stock, precio, permiso de imagen ni afiliacion.'});}
  catch(error){const code=error instanceof Error?error.message:'';return res.status(code==='INVALID_QUERY'?400:503).json({error:code==='INVALID_QUERY'||code==='FIRECRAWL_NOT_CONFIGURED'?code:'RESEARCH_UNAVAILABLE'});}
 });
 return router;
}
