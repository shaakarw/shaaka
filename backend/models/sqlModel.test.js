const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const connectDB = require('../config/db');
const User = require('./User');
const Post = require('./Post');
const Message = require('./Message');
const Notification = require('./Notification');

test('SQL models preserve documents, relational queries, and idempotent legacy copies', async () => {
  process.env.TURSO_DATABASE_URL = 'file::memory:';
  process.env.TURSO_AUTH_TOKEN = 'test-only';
  const database = await connectDB();

  try {
    await database.execute('CREATE TABLE migration_retry_test (id TEXT PRIMARY KEY)');
    const addMigrationColumn = 'ALTER TABLE migration_retry_test ADD COLUMN marker TEXT';
    await connectDB.applyMigrationStatement(database, addMigrationColumn);
    await connectDB.applyMigrationStatement(database, addMigrationColumn);
    const retryColumns = await database.execute('PRAGMA table_info(migration_retry_test)');
    assert.equal(retryColumns.rows.filter((row) => row.name === 'marker').length, 1);
    await database.execute('DROP TABLE migration_retry_test');

    const modelTables = [
      'appsettings', 'businessideas', 'conversations', 'devicetokens', 'favorites',
      'mallshops', 'messages', 'notes', 'notifications', 'places', 'posts', 'reports',
      'savedposts', 'shops', 'status', 'stories', 'subscriptions', 'users', 'videos',
    ];
    const tableInfo = await database.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    assert.deepEqual(tableInfo.rows.map((row) => row.name).filter((name) => modelTables.includes(name)).sort(), modelTables);
    for (const table of modelTables) {
      const columns = await database.execute(`PRAGMA table_info("${table}")`);
      assert.equal(columns.rows.find((row) => row.name === 'id').pk, 1, `${table} has an indexed primary key`);
    }

    const foreignKeys = [
      ['places', 'user_id', 'users'], ['posts', 'user_id', 'users'],
      ['shops', 'owner_id', 'users'], ['mallshops', 'mall_id', 'places'],
      ['mallshops', 'owner_id', 'users'], ['messages', 'sender_id', 'users'],
      ['messages', 'receiver_id', 'users'], ['savedposts', 'user_id', 'users'],
      ['savedposts', 'post_id', 'posts'], ['favorites', 'place_id', 'places'],
      ['favorites', 'shop_id', 'shops'], ['reports', 'reporter_id', 'users'],
      ['reports', 'post_id', 'posts'], ['notifications', 'message_id', 'messages'],
      ['businessideas', 'created_by', 'users'], ['devicetokens', 'user_id', 'users'],
      ['subscriptions', 'user_id', 'users'], ['appsettings', 'updated_by', 'users'],
      ['notes', 'user_id', 'users'], ['status', 'user_id', 'users'],
      ['stories', 'user_id', 'users'], ['conversations', 'user_a_id', 'users'],
      ['conversations', 'user_b_id', 'users'], ['videos', 'post_id', 'posts'],
      ['videos', 'user_id', 'users'],
    ];
    for (const [table, column, target] of foreignKeys) {
      const result = await database.execute(`PRAGMA foreign_key_list("${table}")`);
      assert.ok(result.rows.some((row) => row.table === target && row.from === column), `${table}.${column} references ${target}`);
    }
    const indexes = await database.execute("SELECT name FROM sqlite_master WHERE type = 'index'");
    for (const index of [
      'shops_owner_idx', 'savedposts_post_idx', 'favorites_place_idx', 'favorites_shop_idx',
      'reports_reporter_idx', 'notifications_message_idx', 'subscriptions_user_idx',
      'businessideas_created_by_idx', 'appsettings_updated_by_idx', 'videos_post_idx',
      'posts_product_name_search_idx', 'posts_brand_search_idx', 'posts_model_search_idx',
      'posts_category_search_idx', 'posts_location_search_idx', 'posts_search_status_created_idx',
      'search_analytics_popular_idx',
    ]) {
      assert.ok(indexes.rows.some((row) => row.name === index), `${index} indexes a relationship`);
    }
    const searchTables = await database.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('search_analytics', 'search_product_analytics')",
    );
    assert.deepEqual(searchTables.rows.map((row) => row.name).sort(), [
      'search_analytics',
      'search_product_analytics',
    ]);

    const legacyUser = {
      _id: 'legacy-copy-user', phone: '0700000002', username: 'legacy-copy-user',
      idNumber: 'legacy-copy-id', role: 'user', blocked: false,
    };
    const legacyPost = {
      _id: 'legacy-copy-post', user: legacyUser._id, category: 'house',
      status: 'active', createdAt: new Date().toISOString(),
    };
    for (const [collection, document] of [['users', legacyUser], ['posts', legacyPost]]) {
      await database.execute({
        sql: 'INSERT INTO documents (collection_name, document_id, document_json) VALUES (?, ?, ?)',
        args: [collection, document._id, JSON.stringify(document)],
      });
    }
    const relationalMigration = fs.readFileSync(
      path.join(__dirname, '..', 'db', 'migrations', '003_model_tables.sql'),
      'utf8',
    );
    const runRelationalMigration = async () => {
      for (const statement of relationalMigration.split(';').map((part) => part.trim()).filter(Boolean)) {
        await database.execute(statement);
      }
    };
    await runRelationalMigration();
    const copiedPost = await database.execute({
      sql: 'SELECT id, user_id, payload FROM posts WHERE id = ?',
      args: [legacyPost._id],
    });
    assert.equal(copiedPost.rows.length, 1);
    assert.equal(copiedPost.rows[0].user_id, legacyUser._id);
    assert.equal(JSON.parse(copiedPost.rows[0].payload).category, 'house');
    await runRelationalMigration();
    const duplicateCopy = await database.execute({
      sql: 'SELECT COUNT(*) AS count FROM posts WHERE id = ?',
      args: [legacyPost._id],
    });
    assert.equal(Number(duplicateCopy.rows[0].count), 1);
    await database.execute({ sql: 'DELETE FROM posts WHERE id = ?', args: [legacyPost._id] });
    await database.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [legacyUser._id] });
    await database.execute({
      sql: 'DELETE FROM documents WHERE document_id IN (?, ?)',
      args: [legacyUser._id, legacyPost._id],
    });
  const phoneFilter = User._compileFilter({ phone: '0700000001' });
  assert.match(phoneFilter.sql, /"users"\."phone"/);
  assert.deepEqual(phoneFilter.args, ['0700000001']);
  assert.equal(phoneFilter.sql.includes('0700000001'), false);

  const user = await User.create({
      phone: '0700000001',
      username: 'test-user',
      idNumber: '12345678',
      password: 'initial-password',
      notificationPreferences: { messages: false },
    });
    assert.match(user._id, /^[a-f\d]{24}$/i);
    assert.notEqual(user.password, 'initial-password');
    assert.equal(await user.matchPassword('initial-password'), true);
    assert.equal(user.notificationPreferences.messages, false);
    assert.equal(user.notificationPreferences.newPosts, true);

    const selectedUser = await User.findOne({ phone: '0700000001' }).select('-password');
    assert.equal(selectedUser.password, undefined);
    assert.equal(selectedUser.id, user._id);
    assert.equal(await User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 60_000) } }), 1);

    const post = await Post.create({
      user: user._id,
      username: user.username,
      userPhone: user.phone,
      category: 'house',
      description: 'Test listing',
      location: 'Kigali',
      price: 2500,
      houseImages: ['one.jpg'],
    });
    const populatedPost = await Post.findById(post._id).populate('user', 'username');
    assert.equal(populatedPost.user.username, user.username);
    assert.equal((await Post.findById(post._id)).user, user._id);
    await Post.create({
      user: user._id,
      username: user.username,
      userPhone: user.phone,
      category: 'house',
      description: 'Earlier listing',
      location: 'Kigali',
      price: 1800,
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const newestPost = await Post.find({ user: user._id }).sort({ createdAt: -1 }).limit(1);
    assert.equal(newestPost[0]._id, post._id);
    assert.equal((await User.find({
      $or: [{ phone: user.phone }, { username: user.username }],
    })).length, 1);

    user.savedPosts = [post._id];
    await user.save();
    const savedPosts = await User.findById(user._id).populate({
      path: 'savedPosts',
      select: 'productName user',
      populate: { path: 'user', select: 'username' },
    });
    assert.equal(savedPosts.savedPosts[0].user.username, user.username);

    const message = await Message.create({
      senderId: user._id,
      receiverId: user._id,
      imageUrl: 'image.jpg',
      createdAt: new Date().toISOString(),
    });
    assert.equal(await Message.countDocuments({
      senderId: user._id,
      imageUrl: { $exists: true, $ne: '' },
    }), 1);
    await Message.updateOne({ _id: message._id }, { $set: { read: true }, $inc: { retryCount: 1 } });
    const updatedMessage = await Message.findById(message._id);
    assert.equal(updatedMessage.read, true);
    assert.equal(updatedMessage.retryCount, 1);

    const notification = await Notification.create({
      userId: user._id,
      type: 'NEW_MESSAGE',
      title: 'Test',
      message: 'Test notification',
      deliveryAttempts: [{ deviceTokenId: '0123456789abcdef01234567', status: 'pending' }],
    });
    await Notification.updateOne({
      _id: notification._id,
      'deliveryAttempts.deviceTokenId': '0123456789abcdef01234567',
    }, {
      $set: { 'deliveryAttempts.$.status': 'failed' },
    });
    assert.equal((await Notification.findById(notification._id)).deliveryAttempts[0].status, 'failed');
    const danglingNotification = await Notification.create({
      userId: user._id,
      type: 'NEW_POST',
      title: 'Legacy reference',
      message: 'Payload relation remains available',
      postId: '0123456789abcdef01234567',
    });
    const danglingNotificationRow = await database.execute({
      sql: 'SELECT post_id, post_ref_id FROM notifications WHERE id = ?',
      args: [danglingNotification._id],
    });
    assert.equal(danglingNotificationRow.rows[0].post_id, null);
    assert.equal(danglingNotificationRow.rows[0].post_ref_id, '0123456789abcdef01234567');

    const updatedUser = await User.findByIdAndUpdate(user._id, { $set: { blocked: true } }, {
      new: true,
      select: '-password',
    });
    assert.equal(updatedUser.password, undefined);
    assert.equal((await User.findById(user._id)).blocked, true);
    const aggregate = await Post.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: null, total: { $sum: 1 } } },
    ]);
    assert.equal(aggregate[0].total, 2);
    const rowsInModelTables = await database.execute({
      sql: 'SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM messages) AS messages',
    });
    assert.equal(Number(rowsInModelTables.rows[0].users), 1);
    assert.equal(Number(rowsInModelTables.rows[0].posts), 2);
    assert.equal(Number(rowsInModelTables.rows[0].messages), 1);
    assert.equal((await Post.findByIdAndDelete(post._id))._id, post._id);
  } finally {
    await connectDB.closeDB();
  }
});
