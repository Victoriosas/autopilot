import { createHash } from 'node:crypto';
import type { ConsultationInput } from './consultationRequest';
import { consultationKnowledge } from './consultationKnowledge';
import type { QuestionTopic, RiskCode } from './consultationIntelligenceContracts';

export const normalizeIntelligenceText=(text:string)=>text.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function understandConsultation(input:ConsultationInput){
 const message=normalizeIntelligenceText(input.message), risks:RiskCode[]=[];
 const patterns:[QuestionTopic,RegExp][]=[
  ['price',/pres?cios?|precios?|presios|tarifa|cuanto (?:sale|cuesta)|costo|valor|presupuesto/],
  ['duration',/duracion|cuanto dura|dur[aá]/],['availability',/horario|disponib|reserv|agenda|turno/],
  ['location',/donde|direccion|ubicacion/],['complaint',/reclam|devolucion|queja/],['gift',/regal|obsequio/],
  ['service',/incluye|informacion|diferencia|efectiv|sirve|curar|que masaje|limpieza|peeling|contorno|facial/],
 ];
 let found=patterns.filter(([,re])=>re.test(message)).map(([topic])=>topic);
 // Mentioning a service as the object of another question does not add an unasked question.
 if(found.length>1&&!/incluye|informacion|diferencia|efectiv|sirve|curar|que masaje/.test(message))found=found.filter(t=>t!=='service');
 if(!found.length)found=['unknown'];
 const full=consultationKnowledge.services.filter(s=>message.includes(normalizeIntelligenceText(s.name)));
 const candidates=full.length ? full : /limpieza/.test(message) ? consultationKnowledge.services.filter(s=>/limpieza/i.test(s.name)) : /masaje/.test(message)&&!found.includes('gift') ? consultationKnowledge.services.filter(s=>/^Masaje/.test(s.name)) : [];
 const selected=consultationKnowledge.services.find(s=>s.slug===input.service);
 if(candidates.length>1||selected&&candidates.length===1&&selected.slug!==candidates[0].slug)risks.push('ambiguous');
 if(/embaraz|lactan|amamant|medic|alerg|cirug|herid|infecc|dolor|quem|diagnost|enfermedad|tengo acne|tengo rosacea/.test(message))risks.push('health');
 if(input.age!==null&&input.age<18||/menor|mi hij[oa]|tengo (?:[0-9]|1[0-7]) anos/.test(message))risks.push('minor');
 if(/no puedo respirar|reaccion alergica grave|anafilax|desmayo|sangrado abundante|dolor.*pecho/.test(message))risks.push('urgent');
 if(/efectiv|garantiz|curar|eliminar|sin riesgo/.test(message))risks.push('efficacy');
 if(/ignora|ignorá|system\s*:|instruccion|claves|api.key|otros? clientes|otras clientas|todos los emails|actua como/.test(message))risks.push('injection');
 if(found.includes('complaint'))risks.push('complaint');
 const services=candidates.length ? candidates.map(s=>s.slug) : selected ? [selected.slug] : [];
 return {
  questions:found.map((topic,index)=>({id:'q-'+createHash('sha256').update(input.message+'|'+topic+'|'+index).digest('hex').slice(0,12),topic})),
  serviceCandidates:services,risks,missing:services.length!==1?['service']:[],
  ambiguities:risks.includes('ambiguous')?['multiple_or_conflicting_services']:[],
  explicit:{age:input.age,selectedService:selected?.slug??null},
  confidence:{value:risks.length?0.4:services.length===1?0.8:0.5,basis:'deterministic_rules_not_calibrated'},
  needsVictoria:risks.length>0,
 };
}
