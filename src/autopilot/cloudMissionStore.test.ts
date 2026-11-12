import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { CloudMissionStore, cloudBinding, cloudProcessEnvironment, validateCloudConfig, type CloudMissionConfig } from './cloudMissionStore';
import { ManagedProcesses } from './managedProcesses';
export const cloudConfig = (): CloudMissionConfig => ({version:1,mode:'cloud_synthetic_lab',ledgerId:'synthetic-cloud-fixture',
 database:{host:'ledger.example.invalid',port:5432,name:'victoriosa_mission_operator_lab',user:'autopilot_cloud_runner',
   sslRootCert:path.resolve('fixture-ca.crt'),passFile:path.resolve('fixture.pgpass')},
 resources:{repository:path.resolve('seed'),worktreeRoot:path.resolve('../cloud-worktrees'),baseSha:'a'.repeat(40)},
 permissions:{admit:false,execute:true,cancel:true},leaseSeconds:30,deadlineMs:25000,queryTimeoutMs:3000});
test('cloud ledger fails closed for missing, unknown or credential-bearing config',()=>{
 for(const value of [undefined,{}, {...cloudConfig(),ledgerId:''}, {...cloudConfig(),permissions:{admit:true,execute:true,cancel:true}},
   {...cloudConfig(),database:{...cloudConfig().database,sslmode:'disable'}},
   {...cloudConfig(),database:{...cloudConfig().database,host:'host user=postgres'}},
   {...cloudConfig(),database:{...cloudConfig().database,passFile:''}},
   {...cloudConfig(),database:{...cloudConfig().database,user:'postgres'}},
   {...cloudConfig(),database:{...cloudConfig().database,name:'production'}},
   {...cloudConfig(),credentials:'untrusted'}]) assert.throws(()=>validateCloudConfig(value));
});
test('ledger binding survives runner relocation but separates seed and authorization scope',()=>{
 const a=cloudConfig(),b=structuredClone(a);b.resources.repository=path.resolve('runner-b/seed');b.resources.worktreeRoot=path.resolve('../runner-b/work');
 b.database.host='other-alias.example.invalid';b.database.passFile=path.resolve('rotated.pgpass');
 assert.equal(cloudBinding(a),cloudBinding(b));
 assert.notEqual(cloudBinding(a),cloudBinding({...b,ledgerId:'synthetic-other-fixture'}));
 assert.notEqual(cloudBinding(a),cloudBinding({...b,resources:{...b.resources,baseSha:'b'.repeat(40)}}));
});
test('cloud libpq environment cannot inherit redirection, password, TLS downgrade or preload options',()=>{
 const poisoned={PGHOSTADDR:'203.0.113.1',PGOPTIONS:'untrusted',PGPASSWORD:'untrusted',PGSSLMODE:'disable',PGSERVICE:'untrusted',NODE_OPTIONS:'untrusted'};
 const before=Object.fromEntries(Object.keys(poisoned).map(k=>[k,process.env[k]]));
 try {Object.assign(process.env,poisoned);const env=cloudProcessEnvironment(cloudConfig());
   assert.equal(env.PGSSLMODE,'verify-full');assert.equal(env.PGPASSFILE,cloudConfig().database.passFile);
   for(const k of Object.keys(poisoned).filter(k=>k!=='PGSSLMODE'))assert.equal(env[k],undefined);
 } finally {for(const[k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
test('cloud runner never provisions or admits and owns a copy of host config',async()=>{
 const c=cloudConfig(),p=new ManagedProcesses(),store=new CloudMissionStore(c,p);const binding=store.binding;
 c.ledgerId='synthetic-mutated-fixture';assert.equal(store.binding,binding);
 await assert.rejects(store.initialize(),/cloud_provisioning_not_allowed/);
 await assert.rejects(store.admit({}),/cloud_admission_not_allowed/);
 await assert.rejects(store.status('synthetic-missing'),/ENOENT/);assert.equal(p.size,0);
});
