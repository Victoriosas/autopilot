import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMarketEvidence, buildOpenRouterMarketRequest } from './marketEvidence';
import { assessVictoriosaFit } from './victoriosaProductFilter';
import type { OpportunityCandidate } from './opportunityEngine';

const candidate=(title:string):OpportunityCandidate=>({
  id:'c1',title,source:'cj',pricing:{supplierCost:100,supplierShipping:50,currency:'UYU',provenance:{supplierCost:'observed',supplierShipping:'observed'}},
  supplierReliabilityScore:90,logisticsScore:60,
});

const facts=(description:string,category='')=>({description,category,images:[]});

test('Victoriosa filter rejects costume noise before market search',()=>{
  const fit=assessVictoriosaFit(candidate('Halloween Demon Wings Bird-beak Mask And Horn Headband'),facts('costume accessory','Hair Accessories'));
  assert.equal(fit.decision,'reject');
  assert.equal(fit.regulatoryReviewRequired,false);
});

test('Victoriosa filter accepts ordinary beauty accessory',()=>{
  const fit=assessVictoriosaFit(candidate('Retro Pearl Rhinestone Headband Hair Accessory For Women'),facts('pearl hair accessory','Hair Accessories'));
  assert.equal(fit.decision,'eligible');
  assert.equal(fit.risk,'low');
});

test('Victoriosa filter forces Uruguay regulatory review for topical cosmetic',()=>{
  const fit=assessVictoriosaFit(candidate('Hydrating Facial Skin Toner'),facts('topical facial toner','Skin Care'));
  assert.equal(fit.decision,'review');
  assert.equal(fit.regulatoryReviewRequired,true);
  assert.match(fit.reasons.join(','),/COSMETIC_REGISTRATION/);
});

test('OpenRouter market request uses exactly one bounded fast web plugin search',()=>{
  const body:any=buildOpenRouterMarketRequest(candidate('Pearl rhinestone headband'));
  assert.equal(body.model,'openrouter/auto');
  assert.equal(body.tools,undefined);
  assert.equal(body.plugins.length,1);
  assert.equal(body.plugins[0].id,'web');
  assert.equal(body.plugins[0].engine,'exa');
  assert.equal(body.plugins[0].mode,'fast');
  assert.equal(body.plugins[0].max_results,5);
});

test('grounded market evidence enriches price and market signals without overwriting supplier facts',()=>{
  const base=candidate('Pearl headband');
  const enriched=applyMarketEvidence(base,{
    status:'ok',marketPriceUyu:1290,minPriceUyu:990,maxPriceUyu:1690,demandScore:72,competitionScore:48,confidence:78,
    comparableCount:4,sources:[{title:'A',url:'https://example.com/a'},{title:'B',url:'https://example.com/b'}],notes:[],observedAt:new Date().toISOString(),
  });
  assert.equal(enriched.pricing.marketPrice,1290);
  assert.equal(enriched.pricing.provenance?.marketPrice,'inferred');
  assert.equal(enriched.pricing.supplierCost,100);
  assert.equal(enriched.demandScore,72);
  assert.equal(enriched.competitionScore,48);
  assert.equal(enriched.evidence?.demand,'inferred');
});
