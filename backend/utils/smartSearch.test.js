const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSearchText,
  expandSearchTerms,
  scoreProduct,
  suggestCorrection,
  getSuggestions,
} = require('./smartSearch');

const iphone = { productName: 'iPhone 15 Pro', category: 'Phones' };
const samsung = { productName: 'Samsung Galaxy S25', category: 'Phones' };

test('normalizes joined words and punctuation without changing source values', () => {
  assert.equal(normalizeSearchText('  i Pone---15!! '), 'i pone 15');
  assert.ok(expandSearchTerms('i phone').includes('iphone'));
});

test('ranks exact and typo-tolerant product matches above unrelated results', () => {
  const exact = scoreProduct('iphone 15 pro', iphone);
  const typo = scoreProduct('iphon', iphone);
  const unrelated = scoreProduct('iphon', { productName: 'Leather shoes', category: 'Fashion' });
  assert.ok(exact > typo);
  assert.ok(typo > unrelated);
  assert.ok(scoreProduct('samsng', samsung) > unrelated);
  assert.ok(scoreProduct('i pone', iphone) > unrelated);
  assert.ok(scoreProduct('sam sung', samsung) > unrelated);
  assert.ok(scoreProduct('phone', samsung) > 0);
  assert.ok(scoreProduct('shoes', { productName: 'Leather sneakers' }) > 0);
});

test('suggests a likely correction and relevant product labels', () => {
  assert.equal(suggestCorrection('ifone', [iphone]), 'iPhone');
  assert.deepEqual(getSuggestions('iph', [iphone]).map((item) => item.label), ['iPhone 15 Pro', 'Phones']);
});
