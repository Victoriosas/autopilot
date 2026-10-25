// Uso: npm run eval:consultation-agents -- [--dry-run] [--split desarrollo|final|all]
//        [--confirm-final] [--limit N] [--max-usd N] [--out ruta.json]
// Solo casos sintéticos. Necesita CAMELAI_API_KEY (salvo --dry-run). No envía nada a clientes.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { runCase, runControl, summarize, validateEvalFile, type CaseResult } from '../src/storefront/consultationAgentEval';

const args = process.argv.slice(2);
const has = (n: string) => args.includes(n);
const val = (n: string, d: string) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const split = val('--split', 'desarrollo');
const limit = Number(val('--limit', '0')) || Infinity;
const maxUsd = Number(val('--max-usd', '3'));
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
    max_cost_usd_estimate: Number(((cases.length * 3 + controls.length) * 0.05).toFixed(2)) }, null, 2));
  process.exit(0);
}

const key = process.env.CAMELAI_API_KEY;
if (!key) { console.error('Falta CAMELAI_API_KEY (variable de entorno; nunca en Git).'); process.exit(2); }

const results: CaseResult[] = [];
const controlResults: Awaited<ReturnType<typeof runControl>>[] = [];
let spent = 0;
for (const ctl of controls) {
  if (spent > maxUsd) break;
  const r = await runControl(fetch as any, key, ctl); spent += r.cost_usd; controlResults.push(r);
  console.log(`${r.pass ? 'OK ' : 'FALLA'} ${r.id} ${r.family}`);
}
for (const c of cases) {
  if (spent > maxUsd) { console.error(`Tope de gasto alcanzado (${maxUsd} USD): corrida parcial.`); break; }
  const r = await runCase(fetch as any, key, c); spent += r.cost_usd; results.push(r);
  console.log(`${r.pass ? 'OK ' : 'FALLA'} ${r.id} ${r.family}${r.critical ? ' [crítico]' : ''} ${r.issues.map(i => i.code + ':' + i.detail).join(' | ')}`);
}
const summary = summarize(results, controlResults);
const out = val('--out', `output/consultation-agents-eval/report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ version: file.version, split, summary, results, controls: controlResults }, null, 1));
console.log(JSON.stringify(summary, null, 1), '\nInforme:', out);
process.exit(summary.gate_ok && results.length === cases.length ? 0 : 1);
