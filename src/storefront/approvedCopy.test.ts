import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const approved = JSON.parse(readFileSync('tests/approved-copy-pr80.json','utf8'));
test('PR80 approved copy is preserved verbatim in public components',()=>{
 const home=readFileSync('src/components/public/ProfessionalSite.tsx','utf8');
 const editorial=readFileSync('src/components/public/EditorialPage.tsx','utf8');
 for(const text of approved.homeTexts)assert.ok(home.includes(text),'Missing approved copy: '+text);
 assert.ok(editorial.includes(approved.editorialDescription));
});
