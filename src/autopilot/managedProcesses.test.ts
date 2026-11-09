import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { ManagedProcesses } from './managedProcesses';
async function gone(pid:number){const deadline=Date.now()+5000;while(Date.now()<deadline){try{process.kill(pid,0);}catch{return;}await sleep(20);}throw Error('owned_child_still_alive');}
test('managed cancellation terminates the owned child and its descendant',{timeout:15000},async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'autopilot-child-tree-'));const marker=path.join(root,'child-pid');
  const manager=new ManagedProcesses();const controller=new AbortController();let grandchild:number|undefined;
  const source=`const cp=require('node:child_process');const fs=require('node:fs');const p=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});fs.writeFileSync(process.argv[1],String(p.pid));setInterval(()=>{},1000);`;
  const running=manager.exec(process.execPath,['-e',source,marker],{timeout:10000,signal:controller.signal,operation:'owned_tree'});
  const rejected=assert.rejects(running,/process_cancelled/);
  try {
    const deadline=Date.now()+5000;
    while(!grandchild&&Date.now()<deadline){try{grandchild=Number(await readFile(marker,'utf8'));}catch{}if(!grandchild)await sleep(20);}
    assert.ok(grandchild);controller.abort();await rejected;await manager.close();await gone(grandchild);assert.equal(manager.size,0);
  } finally {controller.abort();await manager.close();if(grandchild){try{process.kill(grandchild,'SIGKILL');}catch{}}}
});
test('managed timeout waits for subprocess termination',{timeout:10000},async()=>{
  let pid:number|undefined;const manager=new ManagedProcesses(event=>{if(event.event==='process_started')pid=event.pid;});
  try {await assert.rejects(manager.exec(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:200,operation:'owned_timeout'}),/process_timeout/);
    assert.ok(pid);await gone(pid);assert.equal(manager.size,0);
  } finally {await manager.close();}
});
