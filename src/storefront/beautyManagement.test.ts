import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBeautyService, normalizeBeautyEvaluation } from './beautyManagement';
const service={id:'facial',requestService:'facial',category:'Faciales',title:'Facial personalizado',description:'Cuidado cosmético acordado.',durationMinutes:75,proposedPriceUyu:null,priceApproved:false,conditions:'Traslado cotizado antes.',availability:'A coordinar',available:false,publicationStatus:'draft'};
test('catalogue permits pending prices, rejects publishing without approval and unknown fields',()=>{
 assert.equal(normalizeBeautyService(service).proposedPriceUyu,null);
 assert.throws(()=>normalizeBeautyService({...service,publicationStatus:'published'}));
 assert.throws(()=>normalizeBeautyService({...service,durationMinutes:-1}));
 assert.throws(()=>normalizeBeautyService({...service,medicalCure:true}));
 assert.equal(normalizeBeautyService({...service,proposedPriceUyu:3600,priceApproved:true,publicationStatus:'approved'}).proposedPriceUyu,3600);
});
const evaluation={requestId:'8f7c7698-cdbe-4a77-8a86-5a1d090284b5',clientDeclared:{skinType:'No conoce',sensitivity:'Prefiere conversar'},professionalNotes:{observations:'Observación cosmética de prueba',suggestedServices:['facial'],referral:false},consent:true,consentVersion:'beauty-evaluation-v1',consentEvidence:'fixture-written-001',consentRecordedAt:'2026-10-01T12:00:00Z',status:'draft'};
test('professional evaluation strictly separates declarations, notes and documented consent',()=>{
 assert.equal(normalizeBeautyEvaluation(evaluation).consentEvidence,'fixture-written-001');
 for(const bad of [{...evaluation,consent:false},{...evaluation,consentEvidence:''},{...evaluation,consentRecordedAt:'2999-01-01T00:00:00Z'},{...evaluation,clientDeclared:{diagnosis:'forbidden'}},{...evaluation,professionalNotes:{referral:'yes'}},{...evaluation,status:'finalized',professionalNotes:{observations:''}}]) assert.throws(()=>normalizeBeautyEvaluation(bad));
});
