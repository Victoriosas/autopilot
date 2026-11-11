import test from 'node:test';
import assert from 'node:assert/strict';
import { composeGroundedConsultation } from './consultationGroundedComposer';
import { persistConsultationMaterial } from './consultationMaterial';
import type { MaterialStore } from './consultationMaterialStore';
import type { ConsultationInput } from './consultationRequest';
const input: ConsultationInput={id:'11111111-1111-4111-8111-111111111111',fullName:'Caso sintético',phone:'00000000',email:'',age:null,service:'orientacion',message:'¿Me pueden mandar información por correo?',responseChannel:'whatsapp',consent:true,consentVersion:'consultation-v1',website:''};
const op='22222222-2222-4222-8222-222222222222';
const now=new Date('2026-11-11T00:00:00Z');
function fixture(){let writes=0;let payload:unknown;
 const store:MaterialStore={context:async()=>({input,fingerprint:'a'.repeat(64),expiresAt:'2026-11-12T00:00:00Z'}),save:async(_token,_id,_op,value)=>{writes++;payload=value;return{id:op,state:'pending',delivery_decision:'no_send'};},list:async()=>[],review:async()=>false,purge:async()=>0};
 return {store,get writes(){return writes;},get payload(){return payload;}};
}
test('supervised material stores references only, never body, recipient or delivery permission',async()=>{
 const f=fixture(),draft=composeGroundedConsultation(input,{now});
 const result=await persistConsultationMaterial(input,draft,op,{token:'synthetic-token',store:f.store,now});
 assert.equal(result.state,'persisted');assert.equal(result.delivery_decision,'no_send');assert.equal(f.writes,1);
 const p=f.payload as any;assert.equal(p.sources.length,17);assert.ok(p.sources.every((s:any)=>/^[0-9a-f]{64}$/.test(s.sha256)));
 assert.ok(!JSON.stringify(p).includes(input.fullName));assert.ok(!Object.hasOwn(p,'recipient'));assert.ok(!Object.hasOwn(p,'response_text'));
});
test('consent, channel/self approval tampering, expired context and parent mismatch prevent writes',async()=>{
 for(const kind of ['consent','self_approval','delivery','parent','expiry','operation','missing_request']){
  const f=fixture(),value={...input},draft=composeGroundedConsultation(input,{now});let operation=op;
  if(kind==='consent')(value as any).consent=false;
  if(kind==='self_approval')(draft as any).guardian_status='approved';
  if(kind==='delivery')(draft as any).delivery_decision='send';
  if(kind==='missing_request')draft.information_request=null;
  if(kind==='parent')f.store.context=async()=>({input:{...input,message:'Other synthetic input'},fingerprint:'a'.repeat(64),expiresAt:'2026-11-12'});
  if(kind==='expiry')f.store.context=async()=>({input,fingerprint:'a'.repeat(64),expiresAt:'2020-01-01'});
  if(kind==='operation')operation='invalid';
  assert.deepEqual(await persistConsultationMaterial(value,draft,operation,{token:'synthetic-token',store:f.store,now}),{state:'unavailable',delivery_decision:'no_send'},kind);assert.equal(f.writes,0,kind);
 }
});
test('database conflict, denial, transport loss and forged success remain no_send without retry',async()=>{
 for(const failure of ['conflict','denied','timeout','unsafe_success']){
  const f=fixture();let calls=0;
  f.store.save=async()=>{calls++;if(failure==='unsafe_success')return{id:op,state:'pending',delivery_decision:'send'} as any;throw Error('private provider '+failure);};
  const result=await persistConsultationMaterial(input,composeGroundedConsultation(input,{now}),op,{token:'synthetic-token',store:f.store,now});
  assert.deepEqual(result,{state:'unavailable',delivery_decision:'no_send'});assert.equal(calls,1);assert.ok(!JSON.stringify(result).includes('private provider'));
 }
});
