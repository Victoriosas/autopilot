import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
if(!fs.existsSync(path.join(root,'node_modules/@playwright/mcp/cli.js'))||!fs.existsSync(path.join(root,'node_modules/typescript-language-server/lib/cli.mjs')))throw new Error('Run npm ci --ignore-scripts in the workstation directory before installing.');
const target=path.join(os.homedir(),'.config/opencode');
const backup=path.join(os.homedir(),'.local/state/opencode-autopilot/backups',new Date().toISOString().replaceAll(':','-'));
fs.mkdirSync(backup,{recursive:true});
function copy(source,dest){fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(dest))fs.copyFileSync(dest,path.join(backup,path.relative(target,dest).replaceAll(path.sep,'__')));fs.copyFileSync(source,dest);}
function tree(source,dest){for(const item of fs.readdirSync(source,{withFileTypes:true})){const a=path.join(source,item.name),b=path.join(dest,item.name);if(item.isDirectory())tree(a,b);else copy(a,b);}}
copy(path.join(root,'profiles/global.json'),path.join(target,'opencode.json'));
copy(path.join(root,'REGLAS.md'),path.join(target,'REGLAS.md'));
tree(path.join(root,'skills'),path.join(target,'skills'));
tree(path.join(root,'commands'),path.join(target,'commands'));
for(const name of ['context-budget','project-guard'])copy(path.join(root,`plugins/${name}.mjs`),path.join(target,`plugins/${name}.js`));
const config=JSON.parse(fs.readFileSync(path.join(target,'opencode.json'),'utf8'));
config.mcp.ops.command=['node',path.join(root,'scripts/ops-mcp.mjs').replaceAll('\\','/')];
config.mcp.browser.command[1]=path.join(root,'node_modules/@playwright/mcp/cli.js').replaceAll('\\','/');
config.lsp.typescript.command[1]=path.join(root,'node_modules/typescript-language-server/lib/cli.mjs').replaceAll('\\','/');
fs.writeFileSync(path.join(target,'opencode.json'),JSON.stringify(config,null,2)+'\n');
console.log('Installed global OpenCode profile, 10 agents, 6 skills, 6 commands and 2 local plugins. Previous files backed up locally.');
