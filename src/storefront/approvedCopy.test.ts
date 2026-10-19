import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const approved = JSON.parse(readFileSync('tests/approved-copy-pr80.json','utf8'));
test('Figma copy supersedes the historical PR80 home copy while retaining editorial boundaries',()=>{
 const home=readFileSync('src/components/public/ProfessionalSite.tsx','utf8');
 const editorial=readFileSync('src/components/public/EditorialPage.tsx','utf8');
 for(const text of ['Tu bienestar, a tu manera', 'Tu cuidado empieza aquí.', 'Detrás de cada cuidado,', 'Todo empieza por escucharte.', 'La belleza también está', 'Tus dudas también', 'Sin reservas automáticas']) assert.ok(home.includes(text),'Missing Figma copy: '+text);
 assert.ok(home.includes('evaluación inicial remota'));
 assert.doesNotMatch(home, /<form|precio_uyu|Comprar ahora/);
 assert.ok(editorial.includes(approved.editorialDescription));
});
