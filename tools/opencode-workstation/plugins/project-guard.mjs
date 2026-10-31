import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
export function secretPath(value) {
  const v = String(value || '').replaceAll('\\', '/');
  return /(^|\/)\.env($|\.(?!example$|sample$|template$))|(^|\/)(auth\.json|credentials(?:\.json)?|\.encryption-key|freeapi\.db(?:-wal|-shm)?|id_rsa|id_ed25519)$|\.(pem|p12|pfx|key)$/i.test(v);
}
export function blockedShell(s) {
  return /git\s+push\b[^\n]*(?:--force|-f\b)|git\s+reset\s+--hard|git\s+clean\s+-[^\s]*f|supabase\s+db\s+(?:push|reset)\b|vercel\s+(?:deploy|promote|rollback|--prod)\b|gh\s+pr\s+merge\b|(?:curl|wget|iwr|Invoke-WebRequest)[^\n]*\|\s*(?:sh|bash|iex|Invoke-Expression)|Get-ChildItem\s+Env:|\bprintenv\b/i.test(String(s));
}
export const ProjectGuard = async () => ({
  'tool.execute.before': async (input, output) => {
    for (const k of ['filePath', 'path', 'filename']) {
      if (output.args?.[k] && secretPath(output.args[k])) throw new Error('Secret file blocked. Use documented environment references; do not read credentials.');
    }
    if (input.tool === 'bash' && blockedShell(output.args?.command)) {
      throw new Error('This profile blocks destructive, production and credential-dump commands. Prepare a reviewed change instead.');
    }
  },
  'tool.execute.after': async (input) => {
    // Metadata only. Never persist arguments, outputs, prompts, file contents or tokens.
    try {
      const dir = path.join(os.homedir(), '.local', 'state', 'opencode-autopilot');
      fs.mkdirSync(dir, { recursive: true });
      const log = path.join(dir, 'tools.jsonl');
      if (fs.existsSync(log) && fs.statSync(log).size > 1_000_000) fs.renameSync(log, log + '.previous');
      fs.appendFileSync(log, JSON.stringify({ time: new Date().toISOString(), tool: input.tool }) + '\n');
    } catch { /* Logging must not break development. */ }
  },
});
