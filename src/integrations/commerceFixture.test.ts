import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const workflow = readFileSync('.github/workflows/commerce-supabase.yml', 'utf8');
const script = readFileSync('scripts/prepare-commerce-supabase.ps1', 'utf8');
const ciSources = [...workflow.matchAll(/^\s+cp (\S+) /gm)].map(match => match[1]).sort();

test('local Supabase preparation includes every synthetic migration used by CI', () => {
  const localSources = [...script.matchAll(/Source = '([^']+)'/g)].map(match => match[1]).sort();
  assert.deepEqual(localSources, ciSources, 'Local sandbox must reproduce the CI permission and publication fixtures');
});

test('offline preparation copies exact CI SQL without starting or linking a database', { skip: process.platform !== 'win32' }, () => {
  const output = execFileSync('powershell.exe', ['-NoProfile', '-File', 'scripts/prepare-commerce-supabase.ps1', '-PrepareOnly'], { encoding: 'utf8', timeout: 30000 });
  const result = JSON.parse(output);
  try {
    assert.equal(result.stackStarted, false);
    assert.equal(result.cliInitialized, false);
    const directory = join(result.workspace, 'supabase', 'migrations');
    const copies = readdirSync(directory).map(name => readFileSync(join(directory, name)));
    assert.equal(copies.length, ciSources.length);
    for (const source of ciSources) assert.ok(copies.some(copy => copy.equals(readFileSync(source))), `Missing exact copy of ${source}`);
  } finally { rmSync(result.workspace, { recursive: true, force: true }); }
});
