// Validate the Codex repository-scoped skills without external dependencies.
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve('.agents/skills');
const entries = await readdir(root, { withFileTypes: true });
const errors = [];
const found = [];
const names = new Set();

for (const folder of entries.filter(entry => entry.isDirectory())) {
  const path = join(root, folder.name, 'SKILL.md');
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch {
    errors.push(`${folder.name}: falta SKILL.md`);
    continue;
  }
  const front = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!front) {
    errors.push(`${folder.name}: falta frontmatter YAML`);
    continue;
  }
  const meta = front[1];
  const name = /^name:\s*(\S+)\s*$/m.exec(meta)?.[1];
  const description = /^description:\s*(.+)\s*$/m.exec(meta)?.[1]?.trim();
  if (!name || name !== folder.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    errors.push(`${folder.name}: name inválido o no coincide con carpeta`);
  }
  if (!description || description.length < 40 || description.length > 1024) {
    errors.push(`${folder.name}: description debe tener 40-1024 caracteres`);
  }
  if (name && names.has(name)) errors.push(`${folder.name}: name duplicado`);
  if (name) names.add(name);
  if (source.trim().length < 250) errors.push(`${folder.name}: instrucciones incompletas`);
  found.push(name);
}
if (found.length < 7) errors.push(`solo ${found.length} habilidades; se esperaban al menos 7`);
if (errors.length) {
  console.error('Habilidades de Codex: errores de validación\n' + errors.map(e => '- ' + e).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`OK: ${found.length} habilidades válidas para Codex`);
}
