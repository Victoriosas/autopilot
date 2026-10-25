// Uso: npm run eval:consultation-agents -- [--dry-run] [--split desarrollo|final|all]
//        [--confirm-final] [--limit N] [--max-usd N] [--out ruta.json]
// Solo casos sintéticos. Necesita CAMELAI_API_KEY (salvo --dry-run). No envía nada a clientes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EVAL_MODEL, runCase, runControl, summarize, validateEvalFile, type CaseResult } from '../src/storefront/consultationAgentEval';
import { verifyCamelCost } from '../src/storefront/consultationModelGateway';

const args = process.argv.slice(2);
const has = (n: string) => args.includes(n);
const val = (n: string, d: string) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const split = val('--split', 'desarrollo');
const requestedLimit = Number(val('--limit', '0'));
if (!['desarrollo','final','all'].includes(split) || !Number.isSafeInteger(requestedLimit) || requestedLimit < 0) { console.error('Selección de casos inválida.'); process.exit(2); }
const limit = requestedLimit || Infinity;
const maxUsd = Number(val('--max-usd', '3'));
if (!Number.isFinite(maxUsd) || maxUsd <= 0 || maxUsd > 3) {
  console.error('Presupuesto inválido: --max-usd debe ser mayor que 0 y como máximo 3.');
  process.exit(2);
}
// Reserva el máximo que autoriza cada ejecución, incluso si el proveedor omite el costo real.
const MAX_PER_AGENT_RUN_USD = 0.02;
const MAX_PER_CASE_USD = 3 * MAX_PER_AGENT_RUN_USD;
const file = validateEvalFile(JSON.parse(readFileSync('docs/consultation-agents/eval-cases-v1.json', 'utf8')));

if ((split === 'final' || split === 'all') && !has('--confirm-final')) {
  console.error('Los casos finales no se usan para ajustar prompts: agregá --confirm-final solo para la medición final.');
  process.exit(2);
}
const cases = file.cases.filter(c => split === 'all' || c.split === split).slice(0, limit);
const controls = split === 'final' ? [] : file.guardian_controls;

if (has('--dry-run')) {
  console.log(JSON.stringify({ version: file.version, frozen: file.frozen, split, cases: cases.length,
    critical: cases.filter(c => c.critical).length, guardian_controls: controls.length,
    maximum_authorized_usd: Number(((cases.length * 3 + controls.length) * MAX_PER_AGENT_RUN_USD).toFixed(2)), max_usd: maxUsd }, null, 2));
  process.exit(0);
}

const key = process.env.CAMELAI_API_KEY;
if (!key) { console.error('Falta CAMELAI_API_KEY (variable de entorno; nunca en Git).'); process.exit(2); }
try { await verifyCamelCost(fetch, key, EVAL_MODEL, MAX_PER_AGENT_RUN_USD); }
catch { console.error('No se pudo verificar el costo máximo con el catálogo actual. No se ejecutó la evaluación.'); process.exit(2); }

const results: CaseResult[] = [];
const runId = randomUUID();
const controlResults: Awaited<ReturnType<typeof runControl>>[] = [];
let spent = 0;
let reserved = 0;
let budgetExhausted = false;
for (const ctl of controls) {
  if (reserved + MAX_PER_AGENT_RUN_USD > maxUsd + 1e-9) {
    budgetExhausted = true;
    break;
  }
  reserved += MAX_PER_AGENT_RUN_USD;
  const r = await runControl(fetch as any, key, ctl, runId); spent += r.cost_usd; controlResults.push(r);
  console.log(`${r.pass ? 'OK ' : 'FALLA'} ${r.id} ${r.family}`);
}
for (const c of cases) {
  if (c.split === 'final' && results.some(r => !r.pass)) { console.error('Casos finales reservados: desarrollo no aprobado.'); break; }
  if (reserved + MAX_PER_CASE_USD > maxUsd + 1e-9) {
    budgetExhausted = true;
    console.error(`Presupuesto reservado agotado (${maxUsd} USD): corrida parcial segura.`);
    break;
  }
  reserved += MAX_PER_CASE_USD;
  const r = await runCase(fetch as any, key, c, runId); spent += r.cost_usd; results.push(r);
  console.log(`${r.pass ? 'OK ' : 'FALLA'} ${r.id} ${r.family}${r.critical ? ' [crítico]' : ''} ${r.issues.map(i => i.code + ':' + i.detail).join(' | ')}`);
}
const summary = summarize(results, controlResults);
const complete = results.length === cases.length && controlResults.length === controls.length && !budgetExhausted;
const out = val('--out', `output/consultation-agents-eval/report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ version: file.version, runId, split, complete, maximum_authorized_usd: reserved, cost_semantics: 'reported_or_reserved_upper_bound', summary, results, controls: controlResults }, null, 1), { mode: 0o600 });
console.log(JSON.stringify(summary, null, 1), '\nInforme:', out);
process.exit(summary.gate_ok && complete ? 0 : 1);
