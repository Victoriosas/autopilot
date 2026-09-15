import test from 'node:test';
import assert from 'node:assert/strict';
import { runSourcing } from './sourcingOrchestrator';
import type { SourcingConfig, Evidence } from './sourcingEvidence';
import type { SourcingStore, Item, Run } from './sourcingStore';

function config(mode:'shadow'|'production'):SourcingConfig{
  return {
    enabled:false,mode,destination:'UY',currency:'UYU',providerCurrency:'UYU',providerToStoreRate:1,
    minMargin:30,keyword:'velvet facial headband',maxCandidates:1,maxAiCalls:4,durationMs:40000,retries:2,version:'test-release-v1',
    customsRatePct:0,paymentFeePct:4,paymentFeeFixed:0,returnReservePct:4,acquisitionCost:0,taxRatePct:0,
    imageSaleUseAllowed:true,commercialProxiesAllowed:false,
  };
}

function evidence():Evidence{
  return {
    provider:'cj',productId:'p-release',variantId:'v-release',observedAt:new Date().toISOString(),
    sourceUrl:'https://cjdropshipping.com/product-p-release.html',currency:'UYU',providerCurrency:'UYU',fxRate:1,
    stock:500,supplierCost:100,shippingCost:50,destination:'UY',shippingVerified:true,imageRightsVerified:true,
    candidate:{
      id:'cj:p-release:v-release:UY',title:'Velvet Facial Headband Beauty Accessory',source:'cj',sourceUrl:'https://cjdropshipping.com/product-p-release.html',risk:'low',
      pricing:{supplierCost:100,supplierShipping:50,customsRatePct:0,paymentFeePct:4,paymentFeeFixed:0,returnReservePct:4,acquisitionCost:0,taxRatePct:0,targetNetMarginPct:30,currency:'UYU',provenance:{supplierCost:'observed',supplierShipping:'observed'}},
      supplierReliabilityScore:90,logisticsScore:90,
      evidence:{title:'observed',source:'observed',demand:'unknown',supplierReliability:'observed',logistics:'observed',competition:'unknown'},
    },
    facts:{category:'Hair Accessories',description:'Soft headband accessory for skincare routines.',images:['https://img.example/headband.jpg'],sourceUrl:'https://cjdropshipping.com/product-p-release.html'},
  };
}

class MemoryStore implements SourcingStore{
  run:Run|null=null;
  items:Item[]=[];
  commands:string[]=[];
  async command<T=any>(command:string,args:Record<string,any>):Promise<T>{
    this.commands.push(command);
    if(command==='claim'){
      this.run={id:'11111111-1111-4111-8111-111111111111',status:'running',mode:args.mode,config:args.config,discovery_done:false,lease_owner:args.owner,lease_generation:1,attempt:1};
      return {status:'claimed',run:this.run} as T;
    }
    if(command==='discover'){
      this.run!.discovery_done=true;
      this.items=(args.items||[]).map((entry:any,index:number)=>({id:`22222222-2222-4222-8222-22222222222${index}`,identity:entry.identity,status:'discovered',payload:entry.payload,checkpoint:{},attempt:0}));
      return this.run as T;
    }
    if(command==='items') return this.items as T;
    if(command==='reserve_ai') return this.run as T;
    const item=this.items.find(value=>value.id===args.item);
    if(command==='checkpoint'&&item){item.status=args.status;item.checkpoint={...item.checkpoint,...(args.data||{}),[args.status]:true};return item as T;}
    if(command==='draft'&&item){item.draft_id='33333333-3333-4333-8333-333333333333';item.status='draft_created';return item as T;}
    if(command==='council'&&item){item.council=args.council;item.status=args.council.decision==='approve'&&!args.council.ownerEscalationRequired?'council_approved':'council_rejected';return item as T;}
    if(command==='publish'&&item){item.status=this.run!.mode==='shadow'?'shadow_completed':'published';return item as T;}
    if(command==='release'){
      const done=this.items.every(value=>['needs_evidence','evidence_rejected','pricing_rejected','council_rejected','shadow_completed','production_ready','published','failed_terminal'].includes(value.status));
      this.run!.status=done?(this.items.some(value=>value.draft_id)?'completed':'completed_no_candidates'):'queued';
      return this.run as T;
    }
    throw new Error(`Unexpected command ${command}`);
  }
}

const approveCouncil=async()=>({
  decision:'approve' as const,quorum:'3_of_3' as const,debatePerformed:false,summary:'Approved with complete evidence.',ownerEscalationRequired:false,escalationReasons:[],
  votes:[
    {agent:'commercial' as const,decision:'approve' as const,confidence:95,reason:'Strong economics',concerns:[]},
    {agent:'quality_risk' as const,decision:'approve' as const,confidence:95,reason:'Low risk',concerns:[]},
    {agent:'governor' as const,decision:'approve' as const,confidence:95,reason:'Policy compliant',concerns:[]},
  ],
});

test('production revalidation uses Market Evidence and stops at production_ready without publication',async()=>{
  const store=new MemoryStore();
  let marketCalls=0;
  const result=await runSourcing(store,config('production'),'release-candidate-test',{
    discover:async()=>[evidence()],
    marketEvidence:async()=>{marketCalls++;return {status:'ok',provider:'mercadolibre_uy',marketPriceUyu:500,minPriceUyu:450,maxPriceUyu:550,demandScore:90,competitionScore:10,confidence:90,comparableCount:4,sources:[{title:'A',url:'https://example.com.uy/a'},{title:'B',url:'https://example.com.uy/b'}],notes:[],observedAt:new Date().toISOString()};},
    council:approveCouncil as any,
  });
  assert.equal(marketCalls,1);
  assert.equal(result.status,'completed');
  assert.equal(store.items[0].status,'production_ready');
  assert.ok(store.items[0].draft_id);
  assert.equal(store.commands.includes('publish'),false);
});

test('shadow approval still records shadow_completed and never production_ready',async()=>{
  const store=new MemoryStore();
  const result=await runSourcing(store,config('shadow'),'shadow-release-test',{
    discover:async()=>[evidence()],
    marketEvidence:async()=>({status:'ok',provider:'mercadolibre_uy',marketPriceUyu:500,minPriceUyu:450,maxPriceUyu:550,demandScore:90,competitionScore:10,confidence:90,comparableCount:4,sources:[{title:'A',url:'https://example.com.uy/a'},{title:'B',url:'https://example.com.uy/b'}],notes:[],observedAt:new Date().toISOString()}),
    council:approveCouncil as any,
  });
  assert.equal(result.status,'completed');
  assert.equal(store.items[0].status,'shadow_completed');
  assert.equal(store.commands.includes('publish'),true);
});
