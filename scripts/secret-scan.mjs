import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const patterns=[/\b(?:ghp_|sk_live_|sb_secret_)[A-Za-z0-9_-]{20,}/,
 /(?:SUPABASE_SERVICE_ROLE_KEY|AUTOPILOT_ADMIN_TOKEN|AUTOPILOT_CODEX_TOKEN|CRON_SECRET|CJ_API_KEY|PAYPAL_CLIENT_SECRET|MERCADOPAGO_ACCESS_TOKEN)\s*[:=]\s*["']?([A-Za-z0-9_.-]{24,})/];
let failed=false;
for(const file of execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{encoding:'utf8'}).trim().split('\n')) {
 if(!file || /(?:lock|\.png|\.jpg|\.webp)$/.test(file) || file==='scripts/secret-scan.mjs' || file==='.env.example') continue;
 const text=readFileSync(file,'utf8');
 if(patterns.some(p=>p.test(text))){ console.error(`Potential secret value in ${file}; value suppressed`);failed=true; }
}
if(failed)process.exit(1);
console.log('Secret-value checks passed');
