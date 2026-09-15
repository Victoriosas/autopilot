import { createClient } from '@supabase/supabase-js';
import { cjSourcingReadConfigured } from '../services/cjSourcingProvider';
import { marketProviderStatus } from './marketEvidence';

export type ReleaseState='safe_shadow'|'blocked_for_commerce'|'ready_for_manual_release';

export interface ReleaseCheck {
  id:string;
  ok:boolean;
  requiredForCommerce:boolean;
  detail:string;
}

export interface ReleaseReadiness {
  state:ReleaseState;
  commerceEnabled:boolean;
  blockers:string[];
  checks:ReleaseCheck[];
  providers:{
    cj:boolean;
    marketEvidence:{mercadoLibre:boolean;gemini:boolean;openRouter:boolean;openRouterCircuitOpen:boolean};
    payments:{mercadoPago:boolean;paypal:boolean};
  };
  catalog:{published:number;productionEligible:number;shadowDrafts:number};
  generatedAt:string;
}

function truthy(value:string|undefined){return value==='true';}
function positive(value:string|undefined){const n=Number(value);return Number.isFinite(n)&&n>0;}

export async function computeReleaseReadiness():Promise<ReleaseReadiness>{
  const url=process.env.SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) throw new Error('RELEASE_READINESS_DATABASE_NOT_CONFIGURED');

  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const [publishedResult,eligibleResult,shadowDraftResult,settingsResult]=await Promise.all([
    db.from('products').select('*',{count:'exact',head:true}).eq('status','published'),
    db.from('products').select('*',{count:'exact',head:true}).eq('status','published').eq('publication_eligible',true).eq('created_in_shadow_mode',false),
    db.from('autopilot_product_drafts').select('*',{count:'exact',head:true}).eq('created_in_shadow_mode',true),
    db.from('settings').select('value').eq('key','autopilot_config').maybeSingle(),
  ]);

  for(const result of [publishedResult,eligibleResult,shadowDraftResult,settingsResult]){
    if(result.error) throw new Error('RELEASE_READINESS_DATABASE_ERROR');
  }

  const published=publishedResult.count||0;
  const productionEligible=eligibleResult.count||0;
  const shadowDrafts=shadowDraftResult.count||0;
  const settings=(settingsResult.data?.value||{}) as Record<string,unknown>;

  const market=marketProviderStatus();
  const cj=cjSourcingReadConfigured({mode:'shadow'} as any);
  const mercadoPago=Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN?.trim());
  const paypal=Boolean(process.env.PAYPAL_CLIENT_ID?.trim()&&process.env.PAYPAL_CLIENT_SECRET?.trim());
  const checkout=truthy(process.env.CHECKOUT_ENABLED);
  const purchaseLimit=positive(process.env.AUTOPILOT_PURCHASE_LIMIT_USD);
  const legacyOff=!truthy(process.env.AUTOPILOT_LEGACY_SOURCING_ENABLED);
  const autoPublishOff=settings.autoPublishApproved!==true;
  const v4CronOff=!truthy(process.env.AUTOPILOT_V4_SOURCING_ENABLED);
  const shadowMode=process.env.AUTOPILOT_SHADOW_MODE!=='false';
  const hasMarketProvider=market.mercadoLibre||market.gemini||market.openRouter;
  const hasPaymentProvider=mercadoPago||paypal;

  const checks:ReleaseCheck[]=[
    {id:'cj_read_provider',ok:cj,requiredForCommerce:true,detail:cj?'CJ read provider configured':'CJ sourcing provider is not configured'},
    {id:'market_evidence_provider',ok:hasMarketProvider,requiredForCommerce:true,detail:hasMarketProvider?'At least one Market Evidence provider configured':'No Market Evidence provider configured'},
    {id:'production_catalog',ok:productionEligible>0,requiredForCommerce:true,detail:`${productionEligible} production-eligible published products`},
    {id:'payment_provider',ok:hasPaymentProvider,requiredForCommerce:true,detail:hasPaymentProvider?'At least one payment provider configured':'No production payment provider configured'},
    {id:'legacy_scheduler_off',ok:legacyOff,requiredForCommerce:true,detail:legacyOff?'Legacy sourcing disabled':'Legacy sourcing must be disabled'},
    {id:'auto_publish_off',ok:autoPublishOff,requiredForCommerce:true,detail:autoPublishOff?'Automatic publication disabled':'Automatic publication must be disabled for manual release'},
    {id:'autonomous_purchase_off',ok:!purchaseLimit,requiredForCommerce:true,detail:!purchaseLimit?'Autonomous purchase limit is zero':'Autonomous purchasing must remain disabled for manual release'},
    {id:'v4_cron_off',ok:v4CronOff,requiredForCommerce:false,detail:v4CronOff?'Automatic sourcing cron disabled':'Automatic sourcing cron enabled'},
    {id:'shadow_mode',ok:shadowMode,requiredForCommerce:false,detail:shadowMode?'Autopilot remains in Shadow':'Autopilot Shadow flag is off'},
    {id:'checkout_off',ok:!checkout,requiredForCommerce:false,detail:!checkout?'Checkout remains disabled':'Checkout is enabled'},
  ];

  const blockers=checks.filter(check=>check.requiredForCommerce&&!check.ok).map(check=>check.id);
  const readyForManualRelease=blockers.length===0;
  const commerceEnabled=checkout||purchaseLimit||settings.autoPublishApproved===true;
  const state:ReleaseState=commerceEnabled&&!readyForManualRelease?'blocked_for_commerce':readyForManualRelease?'ready_for_manual_release':'safe_shadow';

  return {
    state,commerceEnabled,blockers,checks,
    providers:{cj,marketEvidence:market,payments:{mercadoPago,paypal}},
    catalog:{published,productionEligible,shadowDrafts},
    generatedAt:new Date().toISOString(),
  };
}
