import { spawn, execFile, type ChildProcess } from 'node:child_process';
import path from 'node:path';

export type ProcessEvent = { event: 'process_started' | 'process_ended'; pid: number; operation: string };
export class ManagedProcesses {
  private active = new Map<ChildProcess, Promise<void>>();
  constructor(private readonly report: (event: ProcessEvent) => void = () => {}) {}
  get size() { return this.active.size; }
  async exec(file: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal; timeout: number; input?: string; operation: string; acceptExitCodes?: number[]; onStdout?: (chunk: string) => void }): Promise<{ stdout: string; exitCode: number }> {
    options.signal?.throwIfAborted();
    const minimalEnv = Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP'].flatMap(k => process.env[k] ? [[k,process.env[k]!]] : []));
    const child = spawn(file, args, { cwd: options.cwd, env: options.env ?? minimalEnv, windowsHide: true,
      detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    let output = ''; let failed = false; let reason = 'process_failed';
    let resolveClosed!: () => void;
    const closed = new Promise<void>(resolve => { resolveClosed = resolve; });
    this.active.set(child, closed);
    const terminate = () => {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
      if (process.platform === 'win32') {
        execFile(path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'taskkill.exe'),
          ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 3000 }, () => {});
      } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }
    };
    const abort = () => { failed = true; reason = 'process_cancelled'; terminate(); };
    const timeout = setTimeout(() => { failed = true; reason = 'process_timeout'; terminate(); }, options.timeout);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const result = new Promise<{ stdout: string; exitCode: number }>((resolve, reject) => {
      child.stdout!.on('data', data => { if (failed) return; output += data; if (Buffer.byteLength(output) > 65536) { failed = true; reason = 'process_output_limit'; terminate(); return; }
        try { options.onStdout?.(String(data)); } catch { failed=true;reason='process_observation_failed';terminate(); } });
      child.stderr!.on('data', () => {}); // Raw child errors may contain credentials or SQL parameters.
      child.on('error', () => { failed = true; });
      child.on('close', code => {
        clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); this.active.delete(child); resolveClosed();
        if (child.pid) this.report({ event: 'process_ended', pid: child.pid, operation: options.operation });
        if (failed || code === null || !(options.acceptExitCodes ?? [0]).includes(code)) reject(Error(reason)); else resolve({ stdout: output, exitCode: code });
      });
    });
    if (child.pid) this.report({ event: 'process_started', pid: child.pid, operation: options.operation });
    child.stdin!.on('error', () => {}); child.stdin!.end(options.input);
    return result;
  }
  async close(): Promise<void> {
    for (const child of this.active.keys()) {
      if (!child.pid) continue;
      if (process.platform === 'win32') await new Promise<void>(resolve => {
        execFile(path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'taskkill.exe'),
          ['/PID', String(child.pid!), '/T', '/F'], { windowsHide: true, timeout: 3000 }, () => resolve());
      });
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ } }
    }
    await Promise.all([...this.active.values()]);
  }
}
