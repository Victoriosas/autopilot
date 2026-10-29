import test from 'node:test';
import assert from 'node:assert/strict';
import { articles, getPublishedArticle, getPublishedArticles } from './editorial';
import { clientEditorial } from './clientEditorial';
import { serviceGroups } from '../components/public/serviceDirectory';
import { serviceQuestions, firstConsultationQuestions } from '../components/public/serviceQuestions';
import { publicRouteResponse } from './publicRouting';
import { discoveryItems } from './careDiscovery';

test('las nuevas lecturas tienen desarrollo, referencias válidas y servicios existentes', () => {
  const names = serviceGroups.flatMap(group => [...group.services]);
  assert.equal(clientEditorial.length, 12);
  for (const article of clientEditorial) {
    assert.ok(article.sections && article.sections.length >= 4, article.slug);
    assert.equal(new Set(article.sections.map(section => section.title)).size, article.sections.length);
    assert.ok(article.sections.every(section => section.paragraphs.every(text => text.length > 80)));
    for (const name of article.serviceNames ?? []) assert.ok(names.some(service => service === name), name);
    for (const source of article.sources) {
      assert.equal(new URL(source.url).protocol, 'https:');
      assert.equal(source.checkedAt, '2026-10-29');
    }
    for (const slug of article.relatedSlugs) assert.ok(articles.some(item => item.slug === slug));
  }
  assert.deepEqual(Object.keys(serviceQuestions).sort(), [...names].sort());
  assert.ok(Object.values(serviceQuestions).every(questions => questions.length === 2));
  assert.equal(firstConsultationQuestions.length, 6);
});

test('los doce borradores quedan fuera de rutas y búsqueda públicas incluso con slug conocido', () => {
  const publicItems = discoveryItems();
  assert.deepEqual(getPublishedArticles(), []);
  for (const article of clientEditorial) {
    const route = '/de-mi-para-ti/' + article.slug;
    assert.equal(getPublishedArticle(article.slug), undefined);
    assert.equal(publicItems.some(item => item.href === route), false);
    assert.equal(publicRouteResponse(new Request('https://victoriosas.online' + route), false)?.status, 404);
    assert.equal(publicRouteResponse(new Request('https://example.test' + route), true), undefined);
  }
});
