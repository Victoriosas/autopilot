import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CloudMissionStore } from './cloudMissionStore';
import { ManagedProcesses } from './managedProcesses';
import { directorSlot, validateDirectorGrant } from './directorCloudMission';
import type { CloudMissionConfig } from './cloudMissionStore';

const at=new Date('2026-11-22T10:17:00Z');
function fixture(){
  const config:CloudMissionConfig={version:1,mode:'cloud_synthetic_lab',ledgerId:'synthetic-director-unit-test',
    database:{host:'127.0.0.1',port:5432,name:'victoriosa_director_supervision_lab',user:'autopilot_cloud_runner',
      sslRootCert:path.resolve('fixture-ca.crt'),passFile:path.resolve('fixture.pgpass')},
    resources:{repository:path.resolve('seed'),worktreeRoot:path.resolve('../worktrees'),baseSha:'a'.repeat(40)},
    permissions:{admit:false,execute:true,cancel:false},leaseSeconds:25,deadlineMs:20000,queryTimeoutMs:5000};
  const store=new CloudMissionStore(config,new ManagedProcesses());
  const slot=directorSlot(at);
  const grant={missionId:'synthetic-director-supervision',binding:store.binding,reviewedSha:store.reviewedBaseSha,
    slot,authorizationId:'director-auth-lab-0001',hostIdentity:'autopilot_cloud_runner' as const,
    notBefore:slot,expiresAt:new Date(Date.parse(slot)+30*60_000).toISOString().replace('.000Z','Z')};
  return {config,store,grant};
}

test('Director grant is exact to one synthetic mission, ledger binding, reviewed base, host and current 30-minute slot',()=>{
  const {store,grant}=fixture();
  assert.equal(directorSlot(new Date('2026-11-22T10:29:59Z')), '2026-11-22T10:00:00Z');
  assert.equal(directorSlot(new Date('2026-11-22T10:30:00Z')), '2026-11-22T10:30:00Z');
  assert.deepEqual(validateDirectorGrant(grant,store,at),grant);
  for(const patch of [
    {missionId:'synthetic-other-task'}, {binding:'f'.repeat(64)}, {reviewedSha:'b'.repeat(40)},
    {hostIdentity:'service_role'}, {slot:'2026-11-22T09:30:00Z'}, {authorizationId:'bad'},
    {expiresAt:'2026-11-22T10:31:00Z'}, {notBefore:'2026-11-22T10:18:00Z'},
  ]) assert.throws(()=>validateDirectorGrant({...grant,...patch},store,at),/director_authorization_denied/);
  const expired={...grant,expiresAt:'2026-11-22T10:17:00Z'};
  assert.throws(()=>validateDirectorGrant(expired,store,at),/director_authorization_denied/);
  assert.throws(()=>validateDirectorGrant({...grant,extra:true},store,at),/director_authorization_denied/);
});

test('Director store refuses admission, generic RPCs and any permission beyond exact execute',async()=>{
  const {config,store,grant}=fixture();
  await assert.rejects(store.admit({}),/cloud_admission_not_allowed/);
  const client=store.directorClient(grant) as unknown as {rpc(name:string,args:Record<string,unknown>):Promise<{error:{message:string}|null}>};
  assert.equal((await client.rpc('unlisted_rpc',{})).error?.message,'director_rpc_denied');
  assert.equal((await client.rpc('six_agent_claim_mission',{p_agent:'software',p_lease_seconds:5})).error?.message,'director_rpc_denied');
  assert.throws(()=>new CloudMissionStore({...config,permissions:{admit:true,execute:true,cancel:false}},new ManagedProcesses()),
    /cloud_ledger_adapter_not_configured/);
  for(const permissions of [
    {admit:false,execute:false,cancel:false}, {admit:false,execute:true,cancel:true},
  ]) {
    const denied=new CloudMissionStore({...config,permissions},new ManagedProcesses());
    assert.throws(()=>validateDirectorGrant(grant,denied,at),/cloud_director_execution_disabled/);
  }
});
