import test from 'node:test';
import assert from 'node:assert/strict';
import { articles, categories, editorialVersion, getPublishedArticle, getPublishedArticles, type EditorialArticle } from './editorial';

test('editorial drafts are versioned, categorized and never exposed through public helpers', () => {
  assert.equal(editorialVersion, 2);
  assert.deepEqual(categories, ['Bienestar', 'Belleza', 'Pequeños rituales', 'Secretos y cuidados']);
  assert.equal(articles.length, 14);
  assert.deepEqual(getPublishedArticles(), []);
  assert.equal(new Set(articles.map(article => article.slug)).size, articles.length);
  for (const article of articles) {
    assert.equal(article.status, 'draft');
    assert.equal(article.date, null);
    assert.equal(getPublishedArticle(article.slug), undefined);
    assert.match(article.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(categories.includes(article.category));
    assert.ok(article.paragraphs.length > 0);
    assert.ok(article.imageAlt.trim());
    assert.equal(article.image, '/brand/editorial-pausa.svg');
    for (const slug of article.relatedSlugs) assert.ok(articles.some(related => related.slug === slug));
  }
});

test('public lookup only resolves exact published slugs with a publication date', () => {
  const published: EditorialArticle = { ...articles[0], status: 'published', date: '2026-10-19' };
  const undated: EditorialArticle = { ...articles[1], status: 'published', date: null };
  const items = [...articles, published, undated];
  assert.deepEqual(getPublishedArticles(items), [published]);
  assert.equal(getPublishedArticle(published.slug, items), published);
  for (const slug of ['', '/'+published.slug, published.slug+'/', '../'+published.slug, 'inexistente', articles[1].slug]) {
    assert.equal(getPublishedArticle(slug, items), undefined);
  }
  assert.equal(articles[0].status, 'draft');
});
