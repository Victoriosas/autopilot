import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

test('middleware transpiled without bundling imports under native Node ESM, as on Vercel', () => {
  const directory = mkdtempSync(join(tmpdir(), 'victoriosas-middleware-'));
  try {
    writeFileSync(join(directory, 'package.json'), '{"type":"module"}');
    for (const source of ['middleware.ts', 'src/storefront/publicRouting.ts', 'src/storefront/editorial.ts']) {
      const destination = join(directory, source.replace(/\.ts$/, '.js'));
      mkdirSync(dirname(destination), {recursive:true});
      writeFileSync(destination, ts.transpileModule(readFileSync(source, 'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
    }
    const url = pathToFileURL(join(directory, 'middleware.js')).href;
    const script = `import assert from 'node:assert/strict'; const {default:handler}=await import(${JSON.stringify(url)}); assert.equal(handler(new Request('https://example.test/tienda')).status,410); assert.equal(handler(new Request('https://example.test/')),undefined); console.log('native middleware passed');`;
    assert.match(execFileSync(process.execPath, ['--input-type=module', '-e', script], {encoding:'utf8',timeout:10000}), /native middleware passed/);
  } finally { rmSync(directory, {recursive:true,force:true}); }
});
