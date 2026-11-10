import path from 'node:path';
import { lstat, realpath, readFile, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const protectedName = /^(?:\.git|\.env(?:\..*)?|\.ssh|\.aws|credentials.*|.*\.(?:pem|key|pfx))$/i;
export type AccessGrant = { root: string; write: boolean };
/** Host-created, mission-scoped capability. File contents cannot grant permissions.
 * Logical isolation for cooperative workers, NOT a sandbox against a hostile OS user.
 */
export class FileAccessController {
  #grants: AccessGrant[];
  #reserved: string[];
  #additional: AccessGrant[];
  constructor(readonly missionId: string, grants: AccessGrant[], reserved: string[] = [],
    additional: AccessGrant[] = [], private readonly approved: (receipt: object) => boolean = () => false) {
    this.#grants = structuredClone(grants);
    this.#reserved = reserved.map(p => path.resolve(p).toLowerCase());
    this.#additional = structuredClone(additional);
  }
  async expand(root: string, receipt: object) {
    const grant = this.#additional.find(g => path.resolve(g.root) === path.resolve(root));
    if (!grant || !this.approved(receipt)) throw Error('expansion_denied');
    if (await realpath(root) !== path.resolve(root) || (await lstat(root)).isSymbolicLink()) throw Error('unsafe_root');
    if (!this.#grants.some(g => path.resolve(g.root) === path.resolve(root))) this.#grants.push(structuredClone(grant));
    return Object.freeze({ missionId: this.missionId, decision: 'preauthorized_scope_added', root: path.resolve(root) });
  }
  async resolve(root: string, relative: string, write = false): Promise<string> {
    const grant = this.#grants.find(g => path.resolve(g.root) === path.resolve(root));
    if (!grant || (write && !grant.write)) throw Error('scope_denied');
    // Reject traversal, Windows ADS/devices and alternate separators on every host.
    if (!relative || /[\\:\x00-\x1f]/.test(relative) || path.isAbsolute(relative)
      || relative.split('/').some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p)
        || protectedName.test(p) || /^(?:con|prn|aux|nul|com\d|lpt\d)(?:\.|$)/i.test(p))) throw Error('path_denied');
    const absolute = path.resolve(root, relative);
    if (this.#reserved.some(p => absolute.toLowerCase() === p || absolute.toLowerCase().startsWith(p + path.sep))) throw Error('supervisor_protected');
    if (await realpath(root) !== path.resolve(root) || (await lstat(root)).isSymbolicLink()) throw Error('unsafe_root');
    let cursor = path.resolve(root);
    const parts = relative.split('/');
    for (let i = 0; i < parts.length; i++) {
      cursor = path.join(cursor, parts[i]);
      try {
        const s = await lstat(cursor);
        if (s.isSymbolicLink() || (s.isFile() && s.nlink !== 1)
          || (i < parts.length - 1 && !s.isDirectory()) || (i === parts.length - 1 && !s.isFile())) throw Error('unsafe_file');
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT' || i !== parts.length - 1) throw e;
      }
    }
    return absolute;
  }
  async read(root: string, file: string): Promise<string | null> {
    const target = await this.resolve(root, file);
    try {
      if ((await lstat(target)).size > 65536) throw Error('file_budget');
      return await readFile(target, 'utf8');
    } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
  }
  async replace(root: string, file: string, expected: string | null, next: string | null) {
    const target = await this.resolve(root, file, true);
    const current = await this.read(root, file);
    if (current !== expected) throw Error('concurrent_edit');
    if (next !== null && Buffer.byteLength(next) > 65536) throw Error('file_budget');
    if (next === null) { if (current !== null) await unlink(target); }
    else await writeFile(target, next, { flag: current === null ? 'wx' : 'w' });
  }
}
