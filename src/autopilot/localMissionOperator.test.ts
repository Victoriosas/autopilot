import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { localProcessEnvironment, validateLocalConfig, type LocalMissionConfig } from './localMissionConfig';
import { admissionRequest } from './localMissionStore';
function config(): LocalMissionConfig {
  return {version:1,mode:'local_synthetic_lab',database:{host:'127.0.0.1',port:55439,name:'victoriosa_mission_operator_lab',user:'postgres'},
    resources:{repository:path.join(tmpdir(),'seed'),worktreeRoot:path.join(tmpdir(),'worktrees'),baseSha:'a'.repeat(40)},
    permissions:{admit:true,execute:true,cancel:true},leaseSeconds:60,deadlineMs:45000,queryTimeoutMs:3000};
}
const goal={version:1,kind:'synthetic.ensure_verified_artifact',expected:'canonical_synthetic_result',restrictions:['local_synthetic_only','no_network','no_send'],
  resources:['synthetic_worktree','result_artifact','verification_fixture'],acceptance:['artifact_matches','synthetic_test_passed'],limits:{maxReplans:1,maxSteps:8}};
test('local operator configuration fails closed on remote destinations and credential fields',()=>{
  for(const database of [{...config().database,host:'example.org'},{...config().database,name:'postgres'},{...config().database,password:'not-a-real-secret'}]){
    assert.throws(()=>validateLocalConfig({...config(),database}),/unauthorized_local_config/);
  }
});
test('local operator does not accept command or permission selection from admitted data',()=>{
  assert.deepEqual(admissionRequest({id:'synthetic-admitted',objective:goal}).objective,goal);
  for(const extra of [{plan:['shell:arbitrary']},{permissions:['network']},{credentials:{}},{database:{host:'example.org'}}])
    assert.throws(()=>admissionRequest({id:'synthetic-admitted',objective:goal,...extra}),/invalid_admission_request/);
});
test('unsafe ids and unsupported objectives never reach admission',()=>{
  assert.throws(()=>admissionRequest({id:'synthetic-../../escape',objective:goal}),/invalid_mission_id/);
  assert.throws(()=>admissionRequest({id:'synthetic-admitted',objective:{...goal,resources:[...goal.resources,'network']}}),/objective_not_admitted/);
});
test('execution deadline remains strictly within the granted lease',()=>{
  assert.throws(()=>validateLocalConfig({...config(),leaseSeconds:5,deadlineMs:5000}),/unauthorized_local_config/);
  assert.throws(()=>validateLocalConfig({...config(),queryTimeoutMs:50000}),/unauthorized_local_config/);
  assert.throws(()=>validateLocalConfig({...config(),resources:{...config().resources,worktreeRoot:path.join(config().resources.repository,'nested')}}),/workspace_must_be_outside_repository/);
});
test('database redirection and preload environment cannot escape host destination controls',()=>{
  const previous={PGHOSTADDR:process.env.PGHOSTADDR,PGOPTIONS:process.env.PGOPTIONS,NODE_OPTIONS:process.env.NODE_OPTIONS};
  try {
    process.env.PGHOSTADDR='203.0.113.2';process.env.PGOPTIONS='synthetic-untrusted-options';process.env.NODE_OPTIONS='synthetic-untrusted-preload';
    const env=localProcessEnvironment();assert.equal(env.PGHOSTADDR,undefined);assert.equal(env.PGOPTIONS,undefined);assert.equal(env.NODE_OPTIONS,undefined);
  } finally {for(const [key,value]of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
