#!/usr/bin/env node
// Read-only, no-model, no-secrets operational audit for Victoriosas.
// Outputs evidence from GitHub without touching production or customer data.
const repo = process.env.GITHUB_REPOSITORY || 'Victoriosas/autopilot';
const token = process.env.GITHUB_TOKEN;
if (!token) { console.error('GITHUB_TOKEN unavailable'); process.exit(2); }
const headers = {Authorization: `Bearer ${token}`, Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
async function read(path) {
  const response=await fetch(`https://api.github.com/repos/${repo}/${path}`,{headers,signal:AbortSignal.timeout(10000)});
  if(!response.ok) throw new Error(`GitHub API ${path}: HTTP ${response.status}`);
  return response.json();
}
const profiles=[
  ['director','Director Autopilot'],
  ['engineer','Ingeniero de software'],
  ['infrastructure','Auditor de infraestructura'],
  ['consultations','Asistente de consultas'],
  ['followup','Seguimiento operativo'],
  ['reports','Informes y auditoría']
];
const timestamp=new Date().toISOString();
let results={};
try {
  const [runs,pulls,commits]=await Promise.all([
    read('actions/runs?per_page=20'),
    read('pulls?state=open&per_page=50'),
    read('commits?per_page=1')
  ]);
  results={
    checked_at:timestamp,
    scope:'GitHub read-only; no Supabase, Vercel, camelRun or email attestations',
    current_sha:commits[0]?.sha||null,
    open_prs:pulls.length,
    recent_workflow_runs:(runs.workflow_runs||[]).map(x=>({name:x.name,conclusion:x.conclusion,status:x.status,html_url:x.html_url})),
    agents:profiles.map(([id,name])=>({id,name,status:'unverified',reason:'No authenticated runtime execution evidence checked by this audit'}))
  };
} catch(error) {
  results={checked_at:timestamp,error:String(error),agents:profiles.map(([id,name])=>({id,name,status:'unverified'}))};
  process.exitCode=1;
}
const summary=[
  '# Victoriosas · auditoría sin consumo de IA',
  '',
  'Esta revisión **no certifica agentes activos 24/7**. Comprueba únicamente GitHub.',
  '',
  `Fecha UTC: ${results.checked_at}`,
  `SHA main consultado: ${results.current_sha||'sin verificar'}`,
  `PR abiertas: ${results.open_prs??'sin verificar'}`,
  '',
  '## Seis agentes: estado real no verificado',
  ...profiles.map(([,name])=>`- ${name}: no verificado (sin prueba de ejecución del runtime)`),
  '',
  '## Últimas ejecuciones de workflows',
  ...(results.recent_workflow_runs||[]).slice(0,10).map(x=>`- ${x.name}: ${x.status}/${x.conclusion||'pendiente'}`),
  results.error?`Error: ${results.error}`:'',
  '',
  'No se invocaron modelos, no se procesaron consultas, no se enviaron mensajes.'
].join('\n');
if(process.env.GITHUB_STEP_SUMMARY) {
  const fs=await import('node:fs/promises');
  await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,summary+'\n');
}
console.log(JSON.stringify(results,null,2));
