import { readFile, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export interface LocalMissionConfig {
  version: 1; mode: 'local_synthetic_lab';
  database: { host: '127.0.0.1'; port: number; name: 'victoriosa_mission_operator_lab'; user: string };
  resources: { repository: string; worktreeRoot: string; baseSha: string };
  permissions: { admit: boolean; execute: boolean; cancel: boolean };
  leaseSeconds: number; deadlineMs: number; queryTimeoutMs: number;
}
function exact(value: unknown, keys: string[]) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === keys.sort().join(',');
}
export function validateLocalConfig(value: unknown): LocalMissionConfig {
  const c = value as LocalMissionConfig;
  if (!exact(c, ['version','mode','database','resources','permissions','leaseSeconds','deadlineMs','queryTimeoutMs'])
    || c.version !== 1 || c.mode !== 'local_synthetic_lab'
    || !exact(c.database, ['host','port','name','user']) || c.database.host !== '127.0.0.1'
    || c.database.name !== 'victoriosa_mission_operator_lab' || !/^[a-z_][a-z0-9_]{0,62}$/.test(c.database.user)
    || !Number.isInteger(c.database.port) || c.database.port < 1024 || c.database.port > 65535
    || !exact(c.resources, ['repository','worktreeRoot','baseSha']) || !/^[a-f0-9]{40}$/.test(c.resources.baseSha)
    || !path.isAbsolute(c.resources.repository) || !path.isAbsolute(c.resources.worktreeRoot)
    || !exact(c.permissions, ['admit','execute','cancel']) || Object.values(c.permissions).some(v => typeof v !== 'boolean')
    || !Number.isInteger(c.leaseSeconds) || c.leaseSeconds < 5 || c.leaseSeconds > 60
    || !Number.isInteger(c.deadlineMs) || c.deadlineMs < 500 || c.deadlineMs > 45000 || c.deadlineMs > c.leaseSeconds * 1000 - 1000
    || !Number.isInteger(c.queryTimeoutMs) || c.queryTimeoutMs < 500 || c.queryTimeoutMs > 5000) throw Error('unauthorized_local_config');
  const relative = path.relative(c.resources.repository, c.resources.worktreeRoot);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) throw Error('workspace_must_be_outside_repository');
  return c;
}
export async function readLocalConfig(file: string): Promise<LocalMissionConfig> {
  const info = await lstat(file); if (!info.isFile() || info.isSymbolicLink() || info.size > 16384) throw Error('invalid_config_file');
  const c = validateLocalConfig(JSON.parse(await readFile(file, 'utf8')));
  for (const directory of [c.resources.repository, c.resources.worktreeRoot]) {
    const entry = await lstat(directory);
    if (!entry.isDirectory() || entry.isSymbolicLink() || await realpath(directory) !== path.resolve(directory)) throw Error('unsafe_host_resource');
  }
  return c;
}
export function hostBinding(c: LocalMissionConfig): string {
  return createHash('sha256').update(JSON.stringify({ database: c.database, resources: c.resources, domain: 'synthetic.ensure_verified_artifact' })).digest('hex');
}
export function localProcessEnvironment(): NodeJS.ProcessEnv {
  // Host-only credentials; ignore PGHOSTADDR, PGOPTIONS, NODE_OPTIONS and other inherited redirection/preload settings.
  return Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','PGPASSWORD','PGPASSFILE'].flatMap(k => process.env[k] ? [[k, process.env[k]!]] : []));
}
