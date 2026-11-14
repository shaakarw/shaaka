process.env.TURSO_DATABASE_URL = 'file::memory:';
process.env.TURSO_AUTH_TOKEN = 'message-controller-test';

const test = require('node:test');
const assert = require('node:assert/strict');
const connectDB = require('../config/db');
const User = require('../models/User');
const Post = require('../models/Post');
const Place = require('../models/Place');
const MallShop = require('../models/MallShop');
const Message = require('../models/Message');
const { Conversation } = require('../models/registry');
const { sendMessage, getMessages } = require('./messageController');

const invokeSend = async (user, body) => {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  await sendMessage({ user, body, files: {} }, response);
  return response;
};

const invokeGetMessages = async (user, userId1, userId2, postId, options = {}) => {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  await getMessages({
    user,
    params: { userId1, userId2 },
    query: { postId, ...options },
  }, response);
  return response;
};

test('message sending validates context ownership and deduplicates client retries', async () => {
  const database = await connectDB();
  try {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const sender = await User.create({
      phone: `sender-${suffix}`,
      username: `sender-${suffix}`,
      idNumber: `sender-id-${suffix}`,
      password: 'test-password',
      notificationPreferences: { messages: false },
    });
    const owner = await User.create({
      phone: `owner-${suffix}`,
      username: `owner-${suffix}`,
      idNumber: `owner-id-${suffix}`,
      password: 'test-password',
      notificationPreferences: { messages: false },
    });
    const otherUser = await User.create({
      phone: `other-${suffix}`,
      username: `other-${suffix}`,
      idNumber: `other-id-${suffix}`,
      password: 'test-password',
    });
    const post = await Post.create({
      user: owner._id,
      productName: 'Owner post',
      category: 'general',
    });
    const place = await Place.create({
      userId: owner._id,
      name: 'Owner place',
      category: 'place',
    });
    const shop = await MallShop.create({
      mallId: place._id,
      ownerId: owner._id,
      name: 'Owner shop',
    });

    const messageId = `retry-${suffix}`;
    const sendBody = {
      receiverId: owner._id,
      senderId: otherUser._id,
      senderName: 'Impersonated sender',
      clientMessageId: messageId,
      text: 'Is this available?',
      postId: post._id,
      replyPost: {
        postId: post._id,
        contextType: 'post',
        title: 'Untrusted title',
        ownerId: otherUser._id,
      },
    };
    const sent = await invokeSend(sender, sendBody);
    assert.equal(sent.statusCode, 201);
    assert.equal(sent.data.message.senderId, sender._id);
    assert.equal(sent.data.message.senderName, sender.username);
    assert.equal(sent.data.message.receiverId, owner._id);
    assert.equal(sent.data.message.replyPost.ownerId, owner._id);
    assert.equal(sent.data.message.replyPost.title, 'Owner post');
    assert.ok(sent.data.message.conversationId);
    const storedMessage = await Message.findById(sent.data.message._id);
    assert.equal(storedMessage.conversationId, sent.data.message.conversationId);
    const storedConversation = await Conversation.findById(sent.data.message.conversationId);
    assert.deepEqual(
      [storedConversation.userAId, storedConversation.userBId].sort(),
      [sender._id, owner._id].sort()
    );
    assert.equal(storedConversation.contextType, 'post');

    const ownerReply = await invokeSend(owner, {
      receiverId: sender._id,
      clientMessageId: `owner-reply-${suffix}`,
      text: 'Yes, it is available.',
      postId: post._id,
    });
    assert.equal(ownerReply.statusCode, 201);
    assert.equal(ownerReply.data.message.conversationId, sent.data.message.conversationId);

    const retry = await invokeSend(sender, sendBody);
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.data.idempotent, true);
    assert.equal(await Message.countDocuments({ clientMessageId: messageId }), 1);

    const wrongPostOwner = await invokeSend(sender, {
      receiverId: otherUser._id,
      clientMessageId: `wrong-post-${suffix}`,
      postId: post._id,
      replyPost: { postId: post._id, contextType: 'post' },
      text: 'Wrong recipient',
    });
    assert.equal(wrongPostOwner.statusCode, 403);

    const wrongShopOwner = await invokeSend(sender, {
      receiverId: otherUser._id,
      clientMessageId: `wrong-shop-${suffix}`,
      postId: shop._id,
      replyPost: { postId: shop._id, contextId: shop._id, contextType: 'shop' },
      text: 'Wrong shop recipient',
    });
    assert.equal(wrongShopOwner.statusCode, 403);

    const shopMessage = await invokeSend(sender, {
      receiverId: owner._id,
      clientMessageId: `shop-${suffix}`,
      postId: shop._id,
      replyPost: { postId: shop._id, contextId: shop._id, contextType: 'shop' },
      text: 'A question about the shop',
    });
    assert.equal(shopMessage.statusCode, 201);
    assert.equal(shopMessage.data.message.contextType, 'shop');
    assert.notEqual(shopMessage.data.message.conversationId, sent.data.message.conversationId);
    assert.equal(
      (await Conversation.findById(shopMessage.data.message.conversationId)).contextType,
      'shop'
    );

    const placeMessage = await invokeSend(sender, {
      receiverId: owner._id,
      clientMessageId: `place-${suffix}`,
      postId: place._id,
      replyPost: { postId: place._id, contextId: place._id, contextType: 'place' },
      text: 'A question about the place',
    });
    assert.equal(placeMessage.statusCode, 201);
    assert.equal(placeMessage.data.message.replyPost.ownerId, owner._id);

    const selfMessage = await invokeSend(sender, {
      receiverId: sender._id,
      clientMessageId: `self-${suffix}`,
      text: 'This must be rejected',
    });
    assert.equal(selfMessage.statusCode, 400);

    const concurrentId = `concurrent-${suffix}`;
    const concurrentBody = {
      receiverId: owner._id,
      clientMessageId: concurrentId,
      text: 'Send once',
    };
    const concurrentResults = await Promise.all([
      invokeSend(sender, concurrentBody),
      invokeSend(sender, concurrentBody),
    ]);
    assert.ok(concurrentResults.every(result => [200, 201].includes(result.statusCode)));
    assert.equal(await Message.countDocuments({ clientMessageId: concurrentId }), 1);

    const directMessages = await invokeGetMessages(sender, sender._id, owner._id, '');
    assert.equal(directMessages.statusCode, 200);
    assert.equal(directMessages.data.messages.length, 1);
    assert.equal(directMessages.data.messages[0].clientMessageId, concurrentId);

    const postMessages = await invokeGetMessages(sender, sender._id, owner._id, post._id);
    assert.equal(postMessages.statusCode, 200);
    assert.equal(postMessages.data.messages.length, 2);
    assert.ok(postMessages.data.messages.every(message => message.postId === post._id));

    const newestPage = await invokeGetMessages(sender, sender._id, owner._id, post._id, {
      contextType: 'post',
      limit: '1',
    });
    assert.equal(newestPage.data.messages.length, 1);
    assert.equal(newestPage.data.hasMore, true);
    const olderPage = await invokeGetMessages(sender, sender._id, owner._id, post._id, {
      contextType: 'post',
      limit: '1',
      beforeId: newestPage.data.nextCursor,
    });
    assert.equal(olderPage.data.messages.length, 1);
    assert.equal(olderPage.data.hasMore, false);
    assert.equal(
      `${olderPage.data.messages[0]._id},${newestPage.data.messages[0]._id}`,
      postMessages.data.messages.map(message => message._id).join(',')
    );

    const storedPost = await Post.findById(post._id);
    await storedPost.deleteOne();
    const deletedPostReply = await invokeSend(sender, {
      receiverId: owner._id,
      clientMessageId: `deleted-post-reply-${suffix}`,
      text: 'I still have a question about this post.',
      postId: post._id,
    });
    assert.equal(deletedPostReply.statusCode, 201);
    const deletedPostMessages = await invokeGetMessages(sender, sender._id, owner._id, post._id);
    assert.equal(
      deletedPostMessages.data.messages.find(message => message.replyPost)?.replyPost.available,
      false
    );

    const unauthorizedMessages = await invokeGetMessages(otherUser, sender._id, owner._id, post._id);
    assert.equal(unauthorizedMessages.statusCode, 403);
  } finally {
    await connectDB.closeDB();
  }
});
