import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesServiceSearch } from '../components/public/serviceSearch';

test('treatment search ignores accents, case and spacing and requires every word', () => {
  assert.equal(matchesServiceSearch('Hidrataci\u00f3n y nutrici\u00f3n profunda', 'Cuidado facial', ' HIDRATACION  facial '), true);
  assert.equal(matchesServiceSearch('Masaje de drenaje linf\u00e1tico', 'Cuidado corporal', 'linfatico'), true);
  assert.equal(matchesServiceSearch('Masaje relax', 'Bienestar corporal', 'facial'), false);
  assert.equal(matchesServiceSearch('Peeling', 'Cuidado facial', '   '), true);
  assert.equal(matchesServiceSearch('Peeling', 'Cuidado facial', '<script>'), false);
});
