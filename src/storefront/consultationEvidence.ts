import { consultationKnowledge } from './consultationKnowledge';
import { serviceDetails } from '../components/public/serviceDetails';

export type ConsultationFact = {
 id:string; version:string; source:string; fragment:string; approval:'approved'|'draft'; owner:string;
 reviewedAt:string; validUntil:string|null; scope:'general_information'; topic:string; service:string|null; authority:number;
};
const fact = (id:string,topic:string,fragment:string,service:string|null=null):ConsultationFact => ({
 id,topic,fragment,service,version:consultationKnowledge.version,
 source:service ? 'src/components/public/serviceDetails.ts#'+service : 'src/storefront/consultationKnowledge.ts#'+id,
 approval:'approved',owner:'Victoriosas (fuente publicada)',reviewedAt:'2026-10-23T00:00:00Z',validUntil:null,
 scope:'general_information',authority:1,
});
/** Mirrors already published facts; no new commercial approval or invented fees/availability. */
export const approvedConsultationFacts:readonly ConsultationFact[] = Object.freeze([
 fact('pricing','price',consultationKnowledge.pricingPolicy),
 fact('initial-step','general','En Victoriosas comenzamos con una evaluación inicial remota.'),
 fact('clinical-limit','general',consultationKnowledge.clinicalLimit),
 ...consultationKnowledge.services.map(service=>fact('service:'+service.slug,'service',serviceDetails[service.name].description,service.slug)),
]);

export function currentFacts(facts:readonly ConsultationFact[],now:Date):{facts:ConsultationFact[];conflicts:string[]} {
 const conflicts:string[]=[], selected:ConsultationFact[]=[];
 const valid=facts.filter(f=>f.approval==='approved'&&f.scope==='general_information'&&f.owner&&f.source&&f.fragment&&
  Number.isFinite(Date.parse(f.reviewedAt))&&Date.parse(f.reviewedAt)<=now.getTime()&&(!f.validUntil||Date.parse(f.validUntil)>now.getTime()));
 for(const id of new Set(valid.map(f=>f.id))){
  const candidates=valid.filter(f=>f.id===id).sort((a,b)=>b.authority-a.authority||Date.parse(b.reviewedAt)-Date.parse(a.reviewedAt));
  const best=candidates[0],peers=candidates.filter(f=>f.authority===best.authority&&f.reviewedAt===best.reviewedAt);
  if(peers.some(f=>f.fragment!==best.fragment||f.version!==best.version))conflicts.push(id);else selected.push(best);
 }
 return {facts:selected,conflicts};
}
