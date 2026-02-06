const test = require('node:test');
const assert = require('node:assert/strict');

const { renderPage } = require('../renderPage');

test('renderPage includes title and body content', () => {
  const html = renderPage({ title: 'テスト', body: '<p>本文</p>' });

  assert.match(html, /<title>テスト<\/title>/);
  assert.match(html, /<h1>テスト<\/h1>/);
  assert.match(html, /<p>本文<\/p>/);
});
