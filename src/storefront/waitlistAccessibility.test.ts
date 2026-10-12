import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { WaitlistSection } from '../components/store/WaitlistSection';

const getOpeningTag = (html: string, tag: string, marker: string) => {
  const match = html.match(new RegExp(`<${tag}[^>]*${marker}[^>]*>`));
  assert.ok(match, `Missing <${tag}> with ${marker}`);
  return match[0];
};

test('waitlist fields expose their visible labels as accessible names', () => {
  const html = renderToStaticMarkup(React.createElement(WaitlistSection));

  const emailInput = getOpeningTag(html, 'input', 'id="waitlist-email"');
  const interestSelect = getOpeningTag(html, 'select', 'id="waitlist-interest"');

  assert.match(html, /<label[^>]*for="waitlist-email"[^>]*>Email<\/label>/);
  assert.match(emailInput, /name="email"/);
  assert.match(emailInput, /type="email"/);
  assert.match(html, /<label[^>]*for="waitlist-interest"[^>]*>¿Qué querés ver primero\?<\/label>/);
  assert.match(interestSelect, /name="interest"/);
});
