const test = require('node:test');
const assert = require('node:assert/strict');
const connectDB = require('../config/db');
const User = require('../models/User');
const Post = require('../models/Post');
const postController = require('./postController');

const invoke = async (handler, req) => {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
  await handler(req, response);
  return response;
};

test('post search ranks fuzzy and synonym matches, paginates, and aggregates privacy-safe analytics', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.TURSO_AUTH_TOKEN = 'test-only';
  await connectDB();

  try {
    const user = await User.create({
      phone: '0700000013',
      username: 'smart-search-seller',
      idNumber: 'smart-search-id',
      password: 'test-password',
    });
    const products = await Post.create([
      { user: user._id, productName: 'iPhone 15 Pro', category: 'Phones', status: 'active' },
      { user: user._id, productName: 'iPhone 14', category: 'Phones', status: 'active' },
      { user: user._id, productName: 'Samsung Galaxy S25', category: 'Phones', status: 'active' },
      { user: user._id, productName: 'Notebook computer', category: 'Computers', status: 'active' },
      { user: user._id, productName: 'Leather sneakers', category: 'Shoes', status: 'active' },
    ]);

    const cursorPageOne = await invoke(postController.getAllPosts, {
      query: { pagination: 'cursor', limit: '1' },
    });
    assert.equal(cursorPageOne.statusCode, 200);
    assert.equal(typeof cursorPageOne.payload.nextCursor, 'string');
    const cursorPageTwo = await invoke(postController.getAllPosts, {
      query: { pagination: 'cursor', limit: '1', cursor: cursorPageOne.payload.nextCursor },
    });
    assert.equal(cursorPageTwo.statusCode, 200);
    assert.equal(cursorPageTwo.payload.posts.length, 1);
    assert.notEqual(cursorPageOne.payload.posts[0]._id, cursorPageTwo.payload.posts[0]._id);

    const typo = await invoke(postController.searchPosts, { query: { q: 'ifone', limit: '20' } });
    assert.equal(typo.statusCode, 200);
    assert.match(typo.payload.posts[0].productName, /^iPhone/);
    assert.equal(typo.payload.correctedQuery, 'iPhone');

    const samsung = await invoke(postController.searchPosts, { query: { q: 'samsng' } });
    assert.equal(samsung.payload.posts[0].productName, 'Samsung Galaxy S25');
    const synonym = await invoke(postController.searchPosts, { query: { q: 'laptop' } });
    assert.equal(synonym.payload.posts[0].productName, 'Notebook computer');

    const pageOne = await invoke(postController.searchPosts, {
      query: { q: 'iphone', page: '1', limit: '1' },
    });
    const pageTwo = await invoke(postController.searchPosts, {
      query: { q: 'iphone', page: '2', limit: '1' },
    });
    assert.equal(pageOne.payload.hasMore, true);
    assert.notEqual(pageOne.payload.posts[0]._id, pageTwo.payload.posts[0]._id);

    await invoke(postController.trackSearchEvent, {
      body: { query: 'iPhone', event: 'search' },
    });
    await invoke(postController.trackSearchEvent, {
      body: { query: 'iPhone', event: 'product_view', postId: products[0]._id },
    });
    const popular = await invoke(postController.getPopularSearches, { query: {} });
    assert.deepEqual(popular.payload.searches, ['iphone']);
    const aggregate = await connectDB.getClient().execute({
      sql: 'SELECT search_count FROM search_analytics WHERE query_key = ?',
      args: ['iphone'],
    });
    assert.equal(Number(aggregate.rows[0].search_count), 1);
    const productViews = await connectDB.getClient().execute({
      sql: 'SELECT view_count FROM search_product_analytics WHERE post_id = ?',
      args: [products[0]._id],
    });
    assert.equal(Number(productViews.rows[0].view_count), 1);
  } finally {
    await connectDB.closeDB();
  }
});
