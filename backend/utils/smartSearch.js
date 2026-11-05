const SYNONYMS = {
  phone: ['smartphone', 'mobile', 'cellphone', 'iphone', 'samsung galaxy'],
  shoes: ['sneakers', 'footwear', 'trainers'],
  laptop: ['notebook', 'computer', 'portable computer'],
  television: ['tv', 'smart tv'],
};

const normalizeSearchText = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const tokenize = (value) => normalizeSearchText(value).split(' ').filter(Boolean);

const expandSearchTerms = (query) => {
  const normalized = normalizeSearchText(query);
  const terms = new Set([normalized, normalized.replace(/\s+/g, '')]);
  const words = tokenize(normalized);
  words.forEach((word) => terms.add(word));
  for (const [key, values] of Object.entries(SYNONYMS)) {
    const keyNormalized = normalizeSearchText(key);
    const synonyms = values.map(normalizeSearchText);
    if (normalized === keyNormalized || synonyms.includes(normalized)) {
      terms.add(keyNormalized);
      synonyms.forEach((value) => terms.add(value));
    }
    if (words.includes(keyNormalized)) {
      terms.add(keyNormalized);
      synonyms.forEach((value) => terms.add(value));
    }
  }
  return [...terms].filter((term) => term && term.length >= 2).slice(0, 20);
};

const levenshteinDistance = (left, right) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
};

const similarity = (left, right) => {
  const longest = Math.max(left.length, right.length);
  return longest ? 1 - levenshteinDistance(left, right) / longest : 1;
};

const valuesFrom = (value) => {
  if (Array.isArray(value)) return value.flatMap(valuesFrom);
  if (value && typeof value === 'object') return Object.values(value).flatMap(valuesFrom);
  return value == null ? [] : [String(value)];
};

const getSearchFields = (post) => ({
  name: normalizeSearchText(post.productName),
  model: normalizeSearchText(post.model || post.modelName || post.productModel),
  brand: normalizeSearchText(post.brand),
  category: normalizeSearchText(post.category),
  subcategory: normalizeSearchText(post.subcategory || post.subCategory),
  description: normalizeSearchText(post.description),
  tags: normalizeSearchText([
    ...valuesFrom(post.tags),
    ...valuesFrom(post.searchKeywords || post.keywords),
    ...valuesFrom(post.attributes),
  ].join(' ')),
  location: normalizeSearchText(post.location),
  seller: normalizeSearchText(post.user?.username || post.username || post.storeName || post.sellerName),
});

const scoreProduct = (query, post) => {
  const normalized = normalizeSearchText(query);
  if (!normalized) return 0;
  const compact = normalized.replace(/\s+/g, '');
  const fields = getSearchFields(post);
  const words = tokenize(normalized);
  const fieldValues = Object.values(fields).filter(Boolean);
  const allText = fieldValues.join(' ');
  let score = 0;

  if (fields.name === normalized || fields.name.replace(/\s+/g, '') === compact) score = Math.max(score, 1200);
  if (fields.model && (fields.model === normalized || fields.model.replace(/\s+/g, '') === compact)) score = Math.max(score, 1100);
  if (fields.brand === normalized) score = Math.max(score, 1000);
  if (fields.name.startsWith(normalized) || fields.name.replace(/\s+/g, '').startsWith(compact)) score = Math.max(score, 900);
  if (fields.model.startsWith(normalized) || fields.brand.startsWith(normalized)) score = Math.max(score, 850);

  const nameWords = tokenize(`${post.productName || ''} ${post.model || ''} ${post.modelName || ''}`);
  const queryWords = words.length ? words : [compact];
  const fuzzy = Math.max(0, ...queryWords.flatMap((word) => nameWords.map((candidate) => {
    if (candidate.startsWith(word) || word.startsWith(candidate)) return 0.9;
    return similarity(word, candidate);
  })));
  if (fuzzy >= (compact.length <= 4 ? 0.7 : 0.58)) score = Math.max(score, 700 + Math.round(fuzzy * 100));
  if (words.length > 1 && words.every((word) => allText.includes(word))) score = Math.max(score, 620);
  if (fields.category === normalized || fields.subcategory === normalized) score = Math.max(score, 560);
  if (fields.category.includes(normalized) || fields.subcategory.includes(normalized)) score = Math.max(score, 500);
  if (fields.description.includes(normalized) || fields.tags.includes(normalized)) score = Math.max(score, 300);
  if (fields.location.includes(normalized) || fields.seller.includes(normalized)) {
    score = Math.max(score, 250);
  }

  const queryTerms = new Set([normalized, ...words]);
  for (const [root, aliases] of Object.entries(SYNONYMS)) {
    const normalizedAliases = aliases.map(normalizeSearchText);
    const related = [root, ...normalizedAliases];
    if (related.some((term) => queryTerms.has(term))
      && related.some((term) => allText.includes(term))) {
      score = Math.max(score, 420);
    }
  }
  return score;
};

const suggestCorrection = (query, posts) => {
  const normalized = normalizeSearchText(query);
  const compact = normalized.replace(/\s+/g, '');
  const hasDirectMatch = posts.some((post) => {
    const name = normalizeSearchText(post.productName);
    return name.includes(normalized) || name.replace(/\s+/g, '').includes(compact);
  });
  if (hasDirectMatch) return null;
  let closest = null;
  for (const post of posts) {
    const sourceWords = `${post.productName || ''} ${post.brand || ''} ${post.model || ''}`
      .match(/[\p{L}\p{N}]+/gu) || [];
    for (const sourceWord of sourceWords) {
      const word = normalizeSearchText(sourceWord);
      const ratio = similarity(compact, word);
      if (ratio >= 0.65 && (!closest || ratio > closest.ratio)) {
        closest = { ratio, word: sourceWord };
      }
    }
  }
  return closest && normalizeSearchText(closest.word) !== compact ? closest.word : null;
};

const getSuggestions = (query, posts, limit = 8) => {
  const suggestions = [];
  const seen = new Set();
  const add = (value, type) => {
    const label = String(value || '').trim();
    const key = normalizeSearchText(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    suggestions.push({ label, type });
  };
  for (const post of posts) {
    add(post.productName, 'product');
    add(post.brand, 'brand');
    add(post.category, 'category');
    if (suggestions.length >= limit) break;
  }
  return suggestions.slice(0, limit);
};

module.exports = {
  SYNONYMS,
  normalizeSearchText,
  tokenize,
  expandSearchTerms,
  levenshteinDistance,
  scoreProduct,
  suggestCorrection,
  getSuggestions,
};
