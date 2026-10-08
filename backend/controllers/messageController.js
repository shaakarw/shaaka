// controllers/messageController.js
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Post = require('../models/Post');
const storageService = require('../services/storage/storageService');
const { computeAggregatedLimits } = require('../utils/subscriptionHelpers_clean');
const socketHelper = require('../socket');

const privateMediaUrl = (key, req) => key
  ? storageService.getMediaUrl(key, { origin: storageService.getRequestOrigin(req), isPrivate: true })
  : '';

const publicMediaUrl = key => key ? storageService.getPublicMediaUrl(key) : '';

const isValidPrivateMediaUrl = (url, key) => {
  try {
    const parsed = new URL(url);
    return key.startsWith('shaaka/chats/') && storageService.verifyPrivateMediaUrl(
      key,
      parsed.searchParams.get('expires'),
      parsed.searchParams.get('signature')
    );
  } catch {
    return false;
  }
};

const refreshMessageMediaUrls = (message, req) => {
  const value = message.toObject ? message.toObject() : { ...message };
  const sourceImageUrls = Array.isArray(value.imageUrls) && value.imageUrls.length
    ? value.imageUrls
    : (value.imageUrl ? [value.imageUrl] : []);
  const imageStorageKeys = Array.isArray(value.imageStorageKeys) ? value.imageStorageKeys : [];
  const refreshedImageUrls = sourceImageUrls.map((url, index) => {
    const key = imageStorageKeys[index] || storageService.getStorageKeyFromUrl(url) || (index === 0 ? value.imageStorageKey : '');
    return publicMediaUrl(key) || url;
  });
  if (refreshedImageUrls.length) {
    value.imageUrl = refreshedImageUrls[0];
    if (sourceImageUrls.length > 1) value.imageUrls = refreshedImageUrls;
  }
  value.videoUrl = privateMediaUrl(value.videoStorageKey || storageService.getStorageKeyFromUrl(value.videoUrl), req) || value.videoUrl;
  value.audioUrl = privateMediaUrl(value.audioStorageKey || storageService.getStorageKeyFromUrl(value.audioUrl), req) || value.audioUrl;
  return value;
};

// Helper: get UTC start/end of today
const getTodayRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
};

// Send message
exports.sendMessage = async (req, res) => {
  const uploadedStorageKeys = [];
  try {
    const clientMessageId = String(req.body.clientMessageId || '').trim();
    if (clientMessageId) {
      const existingMessage = await Message.findOne({ clientMessageId });
      if (existingMessage) return res.status(200).json({ success: true, message: refreshMessageMediaUrls(existingMessage, req), idempotent: true });
    }
    const senderId = req.user?.id || req.body.senderId;
    if (!senderId) return res.status(401).json({ success: false, message: 'Authentication required' });

    let audioUrl = null, audioStorageKey = '', videoUrlFromFile = null, videoStorageKey = '', audioDuration = null;
    const audioFile = req.files?.audio?.[0];
    const videoFile = req.files?.video?.[0];
    if (audioFile) {
      const audioResult = await storageService.uploadMedia({
        buffer: audioFile.buffer,
        mimeType: audioFile.mimetype,
        folder: `chats/${senderId}/audio`,
        maxBytes: 25 * 1024 * 1024,
      });
      audioStorageKey = audioResult.storageKey;
      uploadedStorageKeys.push(audioStorageKey);
      audioUrl = privateMediaUrl(audioStorageKey, req);
      audioDuration = req.body.audioDuration || null;
    }
    if (videoFile) {
      const videoResult = await storageService.uploadMedia({
        buffer: videoFile.buffer,
        mimeType: videoFile.mimetype,
        folder: `chats/${senderId}/videos`,
        maxBytes: 50 * 1024 * 1024,
      });
      videoStorageKey = videoResult.storageKey;
      uploadedStorageKeys.push(videoStorageKey);
      videoUrlFromFile = privateMediaUrl(videoStorageKey, req);
    }

    let repliedTo = req.body.repliedTo;
    if (repliedTo && typeof repliedTo === 'string') {
      try { repliedTo = JSON.parse(repliedTo); } catch { repliedTo = null; }
    }

    let replyPost = req.body.replyPost;
    if (replyPost && typeof replyPost === 'string') {
      try { replyPost = JSON.parse(replyPost); } catch { replyPost = null; }
    }

    const requestedImageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : [];
    const submittedImageUrls = [...new Set([req.body.imageUrl, ...requestedImageUrls]
      .filter(url => typeof url === 'string' && url.trim())
      .map(url => url.trim()))];

    let replyPostData = null;
    if (replyPost && replyPost.postId) {
      const contextType = replyPost.contextType || 'post';
      const postExists = contextType === 'post' && mongoose.Types.ObjectId.isValid(replyPost.postId)
        ? await Post.findById(replyPost.postId)
        : null;
      replyPostData = {
        postId: replyPost.postId,
        contextId: replyPost.contextId || '',
        contextType,
        title: replyPost.title || postExists?.productName || 'Product',
        description: replyPost.description || postExists?.description || '',
        image: replyPost.image || postExists?.houseImages?.[0] || '',
        price: replyPost.price ?? postExists?.price ?? null,
        amount: replyPost.amount || postExists?.amount || '',
        location: replyPost.location || postExists?.location || '',
        category: replyPost.category || postExists?.category || '',
        bedrooms: replyPost.bedrooms ?? postExists?.bedrooms ?? null,
        bathrooms: replyPost.bathrooms ?? postExists?.bathrooms ?? null,
        size: replyPost.size ?? postExists?.size ?? null,
        priceNegotiable: replyPost.priceNegotiable ?? postExists?.priceNegotiable ?? false,
        contactNumbers: replyPost.contactNumbers || postExists?.contactNumbers || [],
        houseImages: replyPost.houseImages || postExists?.houseImages || [],
        videoUrl: replyPost.videoUrl || postExists?.videoUrl || '',
        username: replyPost.username || postExists?.username || '',
        userAvatar: replyPost.userAvatar || postExists?.userAvatar || '',
        ownerId: replyPost.ownerId || postExists?.user || null,
        timestamp: replyPost.timestamp || postExists?.createdAt || new Date(),
        available: contextType !== 'post' || !!postExists,
      };
    }

    // ---- Enforce image active limit for messages with imageUrl (user-specific limit and retention) ----
    if (submittedImageUrls.length) {
      const senderId = req.body.senderId || req.user.id;
      const senderUser = await User.findById(senderId);
      if (!senderUser) return res.status(404).json({ success: false, message: 'Sender user not found' });

      const MessageModel = require('../models/Message');
      const retentionDays = typeof senderUser.imagesRetentionDays === 'number' ? senderUser.imagesRetentionDays : 5;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - retentionDays);

      const activeImageCount = await MessageModel.countDocuments({ senderId: senderId, imageUrl: { $exists: true, $ne: '' }, createdAt: { $gte: cutoff } });
      const maxImagesPerMessage = typeof senderUser.imagesPerMessage === 'number' ? senderUser.imagesPerMessage : 10;
      if (activeImageCount >= maxImagesPerMessage) {
        return res.status(403).json({ success: false, message: `You have reached the maximum number of active images (${maxImagesPerMessage}). Please wait for some to expire.` });
      }
    }

    const normalizedImageUrls = [];
    const imageStorageKeys = [];
    for (const url of submittedImageUrls) {
      const storageKey = storageService.getStorageKeyFromUrl(url);
      if (storageKey) {
        if (!storageService.isPublicMediaUrl(url, storageKey) && !isValidPrivateMediaUrl(url, storageKey)) {
          return res.status(403).json({ success: false, message: 'Chat media URL is invalid or expired' });
        }
        normalizedImageUrls.push(publicMediaUrl(storageKey));
        imageStorageKeys.push(storageKey);
      } else {
        normalizedImageUrls.push(url);
        imageStorageKeys.push('');
      }
    }
    const imageUrl = normalizedImageUrls[0] || '';
    const imageUrls = normalizedImageUrls.length > 1 ? normalizedImageUrls : [];
    const imageStorageKey = imageStorageKeys[0] || '';
    uploadedStorageKeys.push(...imageStorageKeys.filter(Boolean));
    const videoUrl = videoUrlFromFile || req.body.videoUrl || '';

    const messageData = {
      postId: req.body.postId || '',
      postTitle: req.body.postTitle,
      postUser: req.body.postUser,
      senderId,
      senderName: req.body.senderName,
      senderPhone: req.body.senderPhone,
      senderAvatar: req.body.senderAvatar,
      receiverId: req.body.receiverId,
      receiverName: req.body.receiverName,
      receiverPhone: req.body.receiverPhone,
      clientMessageId: clientMessageId || undefined,
      text: req.body.text || '',
      imageUrl,
      imageUrls,
      imageStorageKeys,
      videoUrl,
      audioUrl,
      imageStorageKey: imageStorageKey || '',
      videoStorageKey,
      audioStorageKey,
      storageProvider: uploadedStorageKeys.length ? 'b2' : '',
      audioDuration,
      repliedTo,
      replyPost: replyPostData,
    };

    const message = new Message(messageData);
    await message.save();
    uploadedStorageKeys.length = 0;

    const receiverId = String(message.receiverId || '');
    const room = receiverId
      ? `chat_${[String(message.senderId), receiverId].sort().join('_')}`
      : null;
    const io = socketHelper.getIO();
    if (io && room) {
      const chatId = message.postId || `direct_${[String(message.senderId), receiverId].sort().join('_')}`;
      io.to(room).emit('new-message', {
        chatId: String(chatId),
        senderId: String(message.senderId),
        receiverId,
        message,
      });
    }

    // Increment dailyMessagesUsed if this message has an image
    if (imageUrl) {
      await User.findByIdAndUpdate(req.body.senderId, { $inc: { dailyMessagesUsed: 1 } });
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    await Promise.all(uploadedStorageKeys.map(key => storageService.deleteMedia(key).catch(deleteError => {
      console.error('[Storage] Failed to clean up an unsaved message upload:', deleteError.code || 'B2_OPERATION_FAILED');
    })));
    console.error('Send message error:', error.code || error.message || 'Unknown error');
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Server error' });
  }
};

// GET /messages/thread/:userId1/:userId2
exports.getMessages = async (req, res) => {
  try {
    const { postId, userId1, userId2 } = req.params;
    const requestedPostId = req.query.postId || postId;
    const normalizedPostId = String(requestedPostId || '').trim();
    const firstUser = String(userId1 || '').trim();
    const secondUser = String(userId2 || '').trim();

    const authenticatedUserId = String(req.user?.id || '').trim();
    if (authenticatedUserId !== firstUser && authenticatedUserId !== secondUser) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this conversation' });
    }

    const mongoose = require('mongoose');
    const isId1 = mongoose.Types.ObjectId.isValid(firstUser);
    const isId2 = mongoose.Types.ObjectId.isValid(secondUser);

    const buildQuery = (filterByPostId = true) => {
      const conditions = [];
      if (isId1 && isId2) {
        conditions.push(
          { senderId: firstUser, receiverId: secondUser },
          { senderId: secondUser, receiverId: firstUser }
        );
      }
      conditions.push(
        { senderPhone: firstUser, receiverPhone: secondUser },
        { senderPhone: secondUser, receiverPhone: firstUser }
      );
      const query = { $or: conditions };
      if (filterByPostId) {
        query.postId = normalizedPostId && normalizedPostId !== 'undefined' && normalizedPostId !== 'null'
          ? normalizedPostId
          : { $in: ['', null] };
      }
      return query;
    };

    let messages = await Message.find(buildQuery(true)).sort({ createdAt: 1 });

    const updatedMessages = await Promise.all(messages.map(async (msg) => {
      const msgObj = refreshMessageMediaUrls(msg, req);
      if (msgObj.replyPost && msgObj.replyPost.postId && (msgObj.replyPost.contextType || 'post') === 'post') {
        try {
          const postExists = await Post.findById(msgObj.replyPost.postId);
          msgObj.replyPost.available = !!postExists;
          if (postExists) {
            msgObj.replyPost = {
              ...msgObj.replyPost,
              title: postExists.productName || msgObj.replyPost.title || 'Product',
              description: postExists.description || '',
              image: postExists.houseImages?.[0] || msgObj.replyPost.image || '',
              price: postExists.price ?? msgObj.replyPost.price ?? null,
              amount: postExists.amount || '',
              location: postExists.location || '',
              category: postExists.category || '',
              bedrooms: postExists.bedrooms,
              bathrooms: postExists.bathrooms,
              size: postExists.size,
              priceNegotiable: postExists.priceNegotiable,
              contactNumbers: postExists.contactNumbers || [],
              houseImages: postExists.houseImages || [],
              videoUrl: postExists.videoUrl || '',
              username: postExists.username || '',
              userAvatar: postExists.userAvatar || '',
            };
          }
        } catch {
          msgObj.replyPost.available = false;
        }
      }
      return msgObj;
    }));

    res.json({ success: true, messages: updatedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /conversations
exports.getConversations = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const userId = req.user.id;
    const isUserObjectId = mongoose.Types.ObjectId.isValid(userId);

    const orClauses = [];
    if (isUserObjectId) {
      orClauses.push({ senderId: userId }, { receiverId: userId });
    }
    orClauses.push({ senderPhone: userId }, { receiverPhone: userId });

    const messages = await Message.find({ $or: orClauses }).sort({ createdAt: -1 });

    const conversationsMap = new Map();
    messages.forEach(msg => {
      const senderKey = String(msg.senderId || msg.senderPhone || '');
      const receiverKey = String(msg.receiverId || msg.receiverPhone || '');
      const otherId = senderKey === String(userId) ? receiverKey : senderKey;
      const key = `${msg.postId}_${otherId}`;
      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          postId: msg.postId,
          postTitle: msg.postTitle,
          otherUserId: otherId,
          otherUserName: senderKey === String(userId) ? msg.receiverName : msg.senderName,
          otherUserAvatar: senderKey === String(userId) ? msg.receiverAvatar : msg.senderAvatar,
          otherUserPhone: senderKey === String(userId) ? msg.receiverPhone : msg.senderPhone,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
      const conv = conversationsMap.get(key);
      if (!conv.lastMessage || new Date(msg.createdAt) > new Date(conv.lastMessage.createdAt)) {
        conv.lastMessage = msg;
      }
      const msgReceiverKey = String(msg.receiverId || msg.receiverPhone || '');
      if (msgReceiverKey === String(userId) && !msg.read) {
        conv.unreadCount++;
      }
    });

    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    for (const conv of conversations) {
      conv.lastMessage = refreshMessageMediaUrls(conv.lastMessage, req);
      const otherId = conv.otherUserId;
      if (!otherId) continue;
      try {
        const user = await User.findOne({
          $or: [{ _id: otherId }, { phone: otherId }, { username: otherId }]
        }).select('username avatar name phone');
        if (user) {
          conv.otherUserName = conv.otherUserName || user.username || user.name || '';
          conv.otherUserAvatar = conv.otherUserAvatar || user.avatar || '';
          conv.otherUserPhone = user.phone || '';
        }
      } catch (e) { /* ignore */ }
    }

    res.json({ success: true, conversations });
  } catch (error) {
    console.error('GET CONVERSATIONS ERROR:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Mark as read
exports.markAsRead = async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      { read: true },
      { new: true }
    );
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, message });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Edit message
exports.editMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    const authUserId = req.user?.id || req.user?._id;
    if (!authUserId) return res.status(401).json({ success: false, message: 'Authentication required' });
    if (String(message.senderId) !== String(authUserId)) {
      return res.status(403).json({ success: false, message: 'You can only edit messages that you sent' });
    }
    if (message.audioUrl) return res.status(400).json({ success: false, message: 'Cannot edit voice message' });

    const now = new Date();
    const diffMinutes = (now - new Date(message.createdAt)) / 60000;
    if (diffMinutes > 15) return res.status(400).json({ success: false, message: 'Editing window closed' });

    message.text = req.body.text;
    message.isEdited = true;
    await message.save();
    const io = socketHelper.getIO();
    if (io) io.emit('message-updated', { message });
    res.json({ success: true, message });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete (unsend) message for everyone
exports.deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.messageId;
    if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const authUserId = req.user?.id || req.user?._id;
    if (!authUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    if (String(message.senderId) !== String(authUserId)) {
      return res.status(403).json({ success: false, message: 'You can only delete messages that you sent' });
    }

    const mediaKeys = [...new Set([
      message.imageStorageKey || storageService.getStorageKeyFromUrl(message.imageUrl),
      ...(message.imageStorageKeys || []),
      ...storageService.collectStorageKeys(message.imageUrls || []),
      message.videoStorageKey || storageService.getStorageKeyFromUrl(message.videoUrl),
      message.audioStorageKey || storageService.getStorageKeyFromUrl(message.audioUrl),
    ].filter(storageService.isStorageKey))];
    await Message.findByIdAndDelete(messageId);
    await Promise.all(mediaKeys.map(key => storageService.deleteMedia(key).catch(error => {
      console.error('[Storage] Message media deletion failed:', error.code || 'B2_OPERATION_FAILED');
    })));

    const io = socketHelper.getIO();
    if (io) {
      io.emit('message-deleted', {
        messageId: String(messageId),
        senderId: String(message.senderId),
        receiverId: String(message.receiverId),
        postId: message.postId || '',
      });
    }

    res.json({ success: true, message: { deleted: String(messageId) } });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Upload image (with user-wide active-image limit and file size checks)
exports.uploadImage = async (req, res) => {
  const uploadedStorageKeys = [];
  try {
    console.log('[uploadImage] Request received, files:', req.files ? req.files.length : 0);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const userId = req.user.id;
    const user = await User.findById(userId).select('postUploadLimitPerDay');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Enforce per-file size limit (3 MB)
    const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
    for (const file of req.files) {
      if (!file.buffer || file.buffer.length > MAX_IMAGE_BYTES) {
        return res.status(400).json({ success: false, message: 'One or more images exceed the 3 MB size limit.' });
      }
    }

    // Enforce maximum number of active message images per user (user-specific limit and retention)
    const Message = require('../models/Message');
    const senderUser = await User.findById(userId);
    const retentionDays = senderUser && typeof senderUser.imagesRetentionDays === 'number' ? senderUser.imagesRetentionDays : 5;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const activeImageCount = await Message.countDocuments({ senderId: userId, imageUrl: { $exists: true, $ne: '' }, createdAt: { $gte: cutoff } });
    const maxImagesPerMessage = senderUser && typeof senderUser.imagesPerMessage === 'number' ? senderUser.imagesPerMessage : 10;
    const remaining = Math.max(maxImagesPerMessage - activeImageCount, 0);

    if (remaining <= 0) {
      return res.status(403).json({ success: false, message: `You have reached the maximum number of active images (${maxImagesPerMessage}). Please wait for some to expire.` });
    }
    if (req.files.length > remaining) {
      return res.status(403).json({ success: false, message: `You can only upload ${remaining} more image(s) at the moment.` });
    }

    const urls = [];
    for (const file of req.files) {
      const result = await storageService.uploadMedia({
        buffer: file.buffer,
        mimeType: file.mimetype,
        folder: `chats/${userId}/images`,
        maxBytes: MAX_IMAGE_BYTES,
      });
      uploadedStorageKeys.push(result.storageKey);
      const imageUrl = storageService.getPublicMediaUrl(result.storageKey);
      await storageService.verifyPublicMediaAccess(imageUrl, result.mimeType);
      console.log('[Storage] B2 image verified:', result.fileName, result.mimeType, result.fileSize);
      console.log('B2 IMAGE URL:', imageUrl);
      urls.push(imageUrl);
    }

    // Return uploaded URLs to client. Messages themselves are created via /send which should reference these URLs.
    res.json({ success: true, url: urls[0], urls });
  } catch (error) {
    await Promise.all(uploadedStorageKeys.map(key => storageService.deleteMedia(key).catch(() => {})));
    console.error('Upload image error:', error.code || error.message || 'Unknown error');
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Image upload failed' });
  }
};

