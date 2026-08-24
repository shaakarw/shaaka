// controllers/messageController.js
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Post = require('../models/Post');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const { computeAggregatedLimits } = require('../utils/subscriptionHelpers_clean');
const socketHelper = require('../socket');

const parseCloudinaryPublicId = (url, expectedResourceType = 'image') => {
  if (!url || typeof url !== 'string') return null;
  const lower = String(url).toLowerCase();
  const resourceType = lower.includes('/video/') || lower.includes('/video/upload') ? 'video' : 'image';
  const normalized = String(url).trim();
  const match = normalized.match(/\/\w+\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/);
  if (!match || !match[1]) return null;
  return {
    cloudinaryPublicId: match[1],
    cloudinaryResourceType: expectedResourceType || resourceType,
  };
};

const deleteCloudinaryMedia = async (message) => {
  const publicId = message.cloudinaryPublicId || message.publicId || '';
  const resourceType = message.cloudinaryResourceType || (message.videoUrl ? 'video' : 'image');
  if (!publicId) return null;

  try {
    const destroyOptions = {
      resource_type: resourceType === 'video' ? 'video' : 'image',
    };
    const result = await cloudinary.uploader.destroy(publicId, destroyOptions);
    if (result?.result && result.result !== 'ok') {
      console.warn('[Cloudinary] Non-ok destroy result:', result.result, 'for', publicId);
    }
    return result;
  } catch (error) {
    console.error('[Cloudinary] delete failed:', error.message || error);
    return null;
  }
};

// Helper: get UTC start/end of today
const getTodayRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
};

// Upload audio to Cloudinary
const uploadAudioToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'video', folder: 'chat_audio', format: 'mp3' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    let audioUrl = null, audioDuration = null;
    if (req.file) {
      audioUrl = await uploadAudioToCloudinary(req.file.buffer);
      audioDuration = req.body.audioDuration || null;
    }

    let repliedTo = req.body.repliedTo;
    if (repliedTo && typeof repliedTo === 'string') {
      try { repliedTo = JSON.parse(repliedTo); } catch { repliedTo = null; }
    }

    let replyPost = req.body.replyPost;
    if (replyPost && typeof replyPost === 'string') {
      try { replyPost = JSON.parse(replyPost); } catch { replyPost = null; }
    }

    let replyPostData = null;
    if (replyPost && replyPost.postId) {
      const postExists = await Post.findById(replyPost.postId);
      replyPostData = {
        postId: replyPost.postId,
        title: replyPost.title || 'Product',
        description: replyPost.description || '',
        image: replyPost.image || '',
        price: replyPost.price || null,
        location: replyPost.location || '',
        ownerId: replyPost.ownerId || null,
        timestamp: replyPost.timestamp || new Date(),
        available: !!postExists,
      };
    }

    // ---- Enforce image active limit for messages with imageUrl (user-specific limit and retention) ----
    if (req.body.imageUrl) {
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

    const senderId = req.user?.id || req.body.senderId;
    if (!senderId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const imageUrl = req.body.imageUrl || '';
    const videoUrl = req.body.videoUrl || '';
    const imageMeta = imageUrl ? parseCloudinaryPublicId(imageUrl, 'image') : null;
    const videoMeta = videoUrl ? parseCloudinaryPublicId(videoUrl, 'video') : null;

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
      text: req.body.text || '',
      imageUrl,
      videoUrl,
      audioUrl,
      audioDuration,
      cloudinaryPublicId: imageMeta?.cloudinaryPublicId || videoMeta?.cloudinaryPublicId || '',
      cloudinaryResourceType: imageMeta?.cloudinaryResourceType || videoMeta?.cloudinaryResourceType || '',
      repliedTo,
      replyPost: replyPostData,
    };

    const message = new Message(messageData);
    await message.save();

    // Increment dailyMessagesUsed if this message has an image
    if (req.body.imageUrl) {
      await User.findByIdAndUpdate(req.body.senderId, { $inc: { dailyMessagesUsed: 1 } });
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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
      if (filterByPostId && normalizedPostId && normalizedPostId !== 'undefined' && normalizedPostId !== 'null') {
        query.postId = normalizedPostId;
      }
      return query;
    };

    let messages = await Message.find(buildQuery(true)).sort({ createdAt: 1 });
    if (!messages.length) {
      messages = await Message.find(buildQuery(false)).sort({ createdAt: 1 });
    }

    const updatedMessages = await Promise.all(messages.map(async (msg) => {
      const msgObj = msg.toObject();
      if (msgObj.replyPost && msgObj.replyPost.postId) {
        try {
          const postExists = await Post.findById(msgObj.replyPost.postId);
          msgObj.replyPost.available = !!postExists;
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
    if (message.audioUrl) return res.status(400).json({ success: false, message: 'Cannot edit voice message' });

    const now = new Date();
    const diffMinutes = (now - new Date(message.createdAt)) / 60000;
    if (diffMinutes > 15) return res.status(400).json({ success: false, message: 'Editing window closed' });

    message.text = req.body.text;
    message.isEdited = true;
    await message.save();
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

    // Cloudinary deletion is best-effort but must be attempted for image/video messages.
    if (message.cloudinaryPublicId) {
      try {
        await deleteCloudinaryMedia(message);
      } catch (error) {
        console.error('[Message delete] Cloudinary delete failed, continuing DB delete:', error.message || error);
      }
    } else if (message.imageUrl && String(message.imageUrl).toLowerCase().includes('cloudinary.com')) {
      const imageMeta = parseCloudinaryPublicId(message.imageUrl, 'image');
      if (imageMeta?.cloudinaryPublicId) {
        try {
          await deleteCloudinaryMedia({ ...message.toObject(), cloudinaryPublicId: imageMeta.cloudinaryPublicId, cloudinaryResourceType: 'image' });
        } catch (error) {
          console.error('[Message delete] Cloudinary image delete failed, continuing DB delete:', error.message || error);
        }
      }
    } else if (message.videoUrl && String(message.videoUrl).toLowerCase().includes('cloudinary.com')) {
      const videoMeta = parseCloudinaryPublicId(message.videoUrl, 'video');
      if (videoMeta?.cloudinaryPublicId) {
        try {
          await deleteCloudinaryMedia({ ...message.toObject(), cloudinaryPublicId: videoMeta.cloudinaryPublicId, cloudinaryResourceType: 'video' });
        } catch (error) {
          console.error('[Message delete] Cloudinary video delete failed, continuing DB delete:', error.message || error);
        }
      }
    }

    await Message.findByIdAndDelete(messageId);

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

    // Upload to Cloudinary
    const uploadPromises = req.files.map(file => new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'chat_images', transformation: [{ width: 800, crop: 'limit' }] },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    }));

    const urls = await Promise.all(uploadPromises);

    // Return uploaded URLs to client. Messages themselves are created via /send which should reference these URLs.
    res.json({ success: true, urls });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ success: false, message: 'Image upload failed' });
  }
};

