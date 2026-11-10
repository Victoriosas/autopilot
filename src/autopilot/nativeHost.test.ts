import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { manifest, disposition, nativeMission, nativeTask } from './nativeHost';
import { ManagedProcesses } from './managedProcesses';
import type { LocalMissionStatus } from './localMissionStore';
const m={version:1,checkout:tmpdir(),approvedSha:'a'.repeat(40),executionConfig:path.join(tmpdir(),'host.json'),configSha256:'b'.repeat(64),
  evidenceDirectory:path.resolve(tmpdir(),'../native-evidence'),taskName:nativeTask,missionId:nativeMission,node:process.execPath,git:process.execPath,psql:process.execPath,maxDurationMs:45000};
test('native manifest rejects other missions, arbitrary commands, secrets and unbounded duration',()=>{
  assert.equal(manifest(m).missionId,nativeMission);
  for(const change of [{missionId:'synthetic-other'},{node:[process.execPath,process.execPath]},{command:'echo payload'},{password:'synthetic-denied'},{approvedSha:'main'},{maxDurationMs:0},{maxDurationMs:60001},{evidenceDirectory:tmpdir()}])
    assert.throws(()=>manifest({...m,...change}));
});
test('native dispatch never reactivates terminal missions or bypasses lease, backoff and budgets',()=>{
  const state={state:'running',queueState:'queued',attempts:0,maxAttempts:3,leaseActive:false,availableAt:new Date(0).toISOString()} as LocalMissionStatus;
  assert.equal(disposition(state),'ready');
  for(const s of ['completed','blocked','cancelled']) assert.equal(disposition({...state,state:s}),'terminal');
  assert.equal(disposition({...state,queueState:'running',leaseActive:true}),'busy');
  assert.equal(disposition({...state,queueState:'failed',availableAt:new Date(Date.now()+60000).toISOString()}),'backoff');
  assert.equal(disposition({...state,queueState:'failed',attempts:3}),'attempt_budget_exhausted');
  assert.equal(disposition({...state,queueState:'running',attempts:3}),'ready');
  assert.throws(()=>disposition({...state,queueState:'unknown'}));
});
test('managed subprocess reports explicitly accepted busy exit without changing default rejection',async()=>{
  const p=new ManagedProcesses();
  try {
    const r=await p.exec(process.execPath,['-e','console.log("busy");process.exitCode=3'],{timeout:5000,operation:'busy',acceptExitCodes:[0,3]});
    assert.equal(r.exitCode,3);assert.equal(r.stdout.trim(),'busy');
    await assert.rejects(p.exec(process.execPath,['-e','process.exitCode=3'],{timeout:5000,operation:'default'}));
    assert.equal(p.size,0);
  } finally {await p.close();}
});
test('stdout observation survives a child failing after announcing its run',async()=>{
  const p=new ManagedProcesses();let seen='';
  try {
    await assert.rejects(p.exec(process.execPath,['-e','console.log("run-before-loss");setTimeout(()=>process.exit(7),30)'],
      {timeout:5000,operation:'loss',onStdout:chunk=>{seen+=chunk;}}));
    assert.match(seen,/run-before-loss/);assert.equal(p.size,0);
  } finally {await p.close();}
});
