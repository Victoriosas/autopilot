import {spawn} from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function test(command,args,tool,params){
 const child=spawn(command,args,{cwd:root,env:process.env,stdio:['pipe','pipe','pipe'],windowsHide:true});
 const waiting=new Map();let id=0;
 const rl=readline.createInterface({input:child.stdout});rl.on('line',line=>{try{const m=JSON.parse(line);const w=waiting.get(m.id);if(w){waiting.delete(m.id);clearTimeout(w.timer);m.error?w.reject(new Error(JSON.stringify(m.error))):w.resolve(m.result);}}catch{}});
 function call(method,params){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{waiting.delete(n);reject(new Error('MCP timeout'))},20000);waiting.set(n,{resolve,reject,timer});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');});}
 try{
  await call('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'autopilot-check',version:'1.0'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const listing=await call('tools/list',{});
  const result=await call('tools/call',{name:tool,arguments:params});
  if(result.isError)throw new Error(JSON.stringify(result));
  console.log(JSON.stringify({server:tool,toolCount:listing.tools.length,success:true,summary:JSON.stringify(result).slice(0,800)}));
 }finally{rl.close();child.kill();}
}
await test(process.execPath,[path.join(root,'scripts/ops-mcp.mjs')],'inspect',{target:'github',action:'repository'});
await test(process.execPath,[path.join(root,'node_modules/@playwright/mcp/cli.js'),'--headless','--isolated','--browser','chrome'],'browser_navigate',{url:'http://127.0.0.1:3000/'});
