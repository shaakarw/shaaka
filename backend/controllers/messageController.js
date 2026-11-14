// controllers/messageController.js
const Message = require('../models/Message');
const User = require('../models/User');
const Post = require('../models/Post');
const Shop = require('../models/Shop');
const Place = require('../models/Place');
const MallShop = require('../models/MallShop');
const { Conversation } = require('../models/registry');
const storageService = require('../services/storage/storageService');
const { computeAggregatedLimits } = require('../utils/subscriptionHelpers_clean');
const socketHelper = require('../socket');
const { notifyUser } = require('../services/notificationService');
const { isValidObjectId } = require('../utils/objectId');
const { getMessageStorageKeys } = require('../utils/deletionCleanup');
const { DEFAULT_USER_PERMISSIONS } = require('../config/userPermissions');
const {
  attachMessageImages,
  recordUploadedMessageImages,
  removeUploadedMessageImages,
} = require('../utils/chatImageRetention');

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

const getReferenceId = value => String(value?._id || value?.id || value || '').trim();

const findUserByIdentifier = async identifier => {
  const id = getReferenceId(identifier);
  if (!id) return null;
  return (isValidObjectId(id) ? await User.findById(id) : null)
    || await User.findOne({ phone: id })
    || await User.findOne({ username: id.toLowerCase() });
};

const getConversationId = (userA, userB, contextType, contextId) => {
  const participants = [String(userA), String(userB)].sort();
  return `conversation:${participants.join(':')}:${contextType}:${contextId || 'direct'}`;
};

const getContextOwnerId = context => getReferenceId(
  context?.user
  || context?.userId
  || context?.ownerId
  || context?.owner
);

// Send message
exports.sendMessage = async (req, res) => {
  const uploadedStorageKeys = [];
  let canonicalReceiverId = '';
  try {
    const senderId = String(req.user?._id || req.user?.id || '');
    if (!senderId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const requestedReceiverId = String(req.body.receiverId || '').trim();
    if (!requestedReceiverId) return res.status(400).json({ success: false, message: 'Receiver is required' });
    const receiverUser = await findUserByIdentifier(requestedReceiverId);
    if (!receiverUser) return res.status(404).json({ success: false, message: 'Receiver not found' });
    const receiverId = String(receiverUser._id || receiverUser.id || '');
    canonicalReceiverId = receiverId;
    if (!receiverId || receiverId === senderId) {
      return res.status(400).json({ success: false, message: 'You cannot message yourself' });
    }

    const clientMessageId = String(req.body.clientMessageId || '').trim();
    if (clientMessageId) {
      const existingMessage = await Message.findOne({ clientMessageId });
      if (existingMessage) {
        if (
          String(existingMessage.senderId) !== senderId
          || String(existingMessage.receiverId || '') !== receiverId
        ) {
          return res.status(409).json({ success: false, message: 'Message ID is already in use' });
        }
        return res.status(200).json({ success: true, message: refreshMessageMediaUrls(existingMessage, req), idempotent: true });
      }
    }

    let replyPost = req.body.replyPost;
    if (replyPost && typeof replyPost === 'string') {
      try {
        replyPost = JSON.parse(replyPost);
      } catch {
        return res.status(400).json({ success: false, message: 'Post context must be valid JSON' });
      }
    }
    if (replyPost && (typeof replyPost !== 'object' || Array.isArray(replyPost))) {
      return res.status(400).json({ success: false, message: 'Post context is invalid' });
    }

    const contextId = String(
      replyPost?.contextId || replyPost?.postId || req.body.postId || ''
    ).trim();
    if (replyPost && !contextId) {
      return res.status(400).json({ success: false, message: 'Post context ID is required' });
    }
    let contextType = replyPost?.contextType || '';
    let existingContextMessage = null;
    let contextRecord = null;

    if (contextId) {
      existingContextMessage = await Message.findOne({
        postId: contextId,
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      }).sort({ createdAt: -1, _id: -1 });
      contextType = contextType || existingContextMessage?.replyPost?.contextType || 'post';
      if (!['post', 'shop', 'place'].includes(contextType)) {
        return res.status(400).json({ success: false, message: 'Unsupported conversation context' });
      }
      if (!isValidObjectId(contextId)) {
        return res.status(400).json({ success: false, message: 'Invalid conversation context ID' });
      }

      if (contextType === 'post') {
        contextRecord = await Post.findById(contextId);
      } else if (contextType === 'place') {
        contextRecord = await Place.findById(contextId);
      } else {
        contextRecord = await MallShop.findById(contextId) || await Shop.findById(contextId);
      }

      if (!contextRecord && !existingContextMessage) {
        return res.status(404).json({ success: false, message: 'Conversation context not found' });
      }
      if (contextRecord) {
        const ownerId = getContextOwnerId(contextRecord);
        if (!ownerId) {
          return res.status(409).json({ success: false, message: 'Conversation context owner is unavailable' });
        }
        if (ownerId !== senderId && ownerId !== receiverId) {
          return res.status(403).json({ success: false, message: 'The context owner must be a conversation participant' });
        }
      }
    }

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

    const requestedImageUrls = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : [];
    const submittedImageUrls = [...new Set([req.body.imageUrl, ...requestedImageUrls]
      .filter(url => typeof url === 'string' && url.trim())
      .map(url => url.trim()))];

    let replyPostData = null;
    if (replyPost && contextId) {
      const contextSnapshot = contextRecord || existingContextMessage?.replyPost || {};
      const postExists = contextType === 'post' ? contextRecord : null;
      const contextImages = contextSnapshot.houseImages
        || contextSnapshot.images
        || (Array.isArray(contextSnapshot.image) ? contextSnapshot.image : []);
      const contextImage = contextSnapshot.image
        || contextSnapshot.houseImages?.[0]
        || contextSnapshot.images?.frontImage
        || contextSnapshot.images?.front
        || contextSnapshot.images?.streetImage
        || contextSnapshot.images?.street
        || '';
      replyPostData = {
        ...replyPost,
        postId: contextId,
        contextId,
        contextType,
        shopId: contextType === 'shop' ? contextId : (replyPost.shopId || ''),
        mallId: replyPost.mallId || '',
        lat: replyPost.lat ?? null,
        lon: replyPost.lon ?? null,
        title: postExists?.productName || contextSnapshot.name || replyPost.title || 'Product',
        description: contextSnapshot.description || replyPost.description || '',
        image: postExists?.houseImages?.[0] || contextImage || replyPost.image || '',
        price: postExists?.price ?? contextSnapshot.price ?? replyPost.price ?? null,
        amount: contextSnapshot.amount || replyPost.amount || '',
        location: contextSnapshot.location || replyPost.location || '',
        category: contextSnapshot.category || replyPost.category || '',
        bedrooms: postExists?.bedrooms ?? contextSnapshot.bedrooms ?? replyPost.bedrooms ?? null,
        bathrooms: postExists?.bathrooms ?? contextSnapshot.bathrooms ?? replyPost.bathrooms ?? null,
        size: postExists?.size ?? contextSnapshot.size ?? replyPost.size ?? null,
        priceNegotiable: postExists?.priceNegotiable ?? contextSnapshot.priceNegotiable ?? replyPost.priceNegotiable ?? false,
        contactNumbers: postExists?.contactNumbers || contextSnapshot.contactNumbers || replyPost.contactNumbers || [],
        houseImages: postExists?.houseImages || contextImages,
        videoUrl: postExists?.videoUrl || contextSnapshot.videoUrl || replyPost.videoUrl || '',
        videoThumbnail: postExists?.videoThumbnail || contextSnapshot.videoThumbnail || replyPost.videoThumbnail || '',
        username: receiverUser.username || receiverUser.name || contextSnapshot.username || replyPost.username || '',
        userAvatar: receiverUser.avatar || contextSnapshot.userAvatar || replyPost.userAvatar || '',
        ownerId: contextRecord ? getContextOwnerId(contextRecord) : (contextSnapshot.ownerId || null),
        timestamp: contextSnapshot.createdAt || contextSnapshot.timestamp || replyPost.timestamp || new Date(),
        available: !!contextRecord,
      };
    }

    // Image limits apply to one direct-message submission, not the user's total active images.
    if (submittedImageUrls.length) {
      const senderUser = await User.findById(senderId);
      if (!senderUser) return res.status(404).json({ success: false, message: 'Sender user not found' });
      const maxImagesPerMessage = Number.isSafeInteger(senderUser.imagesPerMessage)
        ? senderUser.imagesPerMessage
        : DEFAULT_USER_PERMISSIONS.imagesPerMessage;
      if (submittedImageUrls.length > maxImagesPerMessage) {
        return res.status(403).json({
          success: false,
          message: `You can attach up to ${maxImagesPerMessage} images per message.`,
        });
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

    const conversationId = getConversationId(
      senderId,
      receiverId,
      contextId ? contextType : 'direct',
      contextId
    );
    const messageData = {
      conversationId,
      contextType: contextId ? contextType : 'direct',
      postId: contextId,
      postTitle: req.body.postTitle,
      postUser: receiverUser.username || receiverUser.name || '',
      senderId,
      senderName: req.user.username || req.user.name || '',
      senderPhone: req.user.phone || '',
      senderAvatar: req.user.avatar || '',
      receiverId,
      receiverName: receiverUser.username || receiverUser.name || '',
      receiverPhone: receiverUser.phone || '',
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
    const participants = [senderId, receiverId].sort();
    const existingConversation = await Conversation.findById(conversationId);
    if (existingConversation) {
      const savedParticipants = [
        String(existingConversation.userAId || ''),
        String(existingConversation.userBId || ''),
      ].sort();
      if (savedParticipants[0] !== participants[0] || savedParticipants[1] !== participants[1]) {
        const error = new Error('Conversation ID does not match its participants');
        error.statusCode = 409;
        throw error;
      }
      existingConversation.updatedAt = new Date().toISOString();
      await existingConversation.save();
    } else {
      await Conversation.create({
        _id: conversationId,
        userAId: participants[0],
        userBId: participants[1],
        contextType: contextId ? contextType : 'direct',
        contextId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    await message.save();
    try {
      await attachMessageImages(senderId, message._id, imageStorageKeys);
    } catch (trackingError) {
      console.error('[Retention] Could not associate uploaded chat images with the message:', trackingError.code || trackingError.message);
    }
    uploadedStorageKeys.length = 0;

    const messageReceiverId = String(message.receiverId || '');
    const room = messageReceiverId
      ? `chat_${[String(message.senderId), messageReceiverId].sort().join('_')}`
      : null;
    const io = socketHelper.getIO();
    if (io && room) {
      const chatId = message.conversationId;
      io.to(room).emit('new-message', {
        chatId: String(chatId),
        senderId: String(message.senderId),
        receiverId: messageReceiverId,
        message,
      });
    }

    try {
      const replyPostId = message.replyPost?.contextType === 'post'
        ? (message.replyPost.postId || message.postId)
        : '';
      const replyPost = replyPostId && isValidObjectId(String(replyPostId))
        ? await Post.findById(replyPostId)
        : null;
      await notifyUser({
        userId: message.receiverId,
        actorId: message.senderId,
        type: 'NEW_MESSAGE',
        title: req.user?.name || req.user?.username || 'New message',
        message: message.imageUrl || message.videoUrl || message.audioUrl
          ? 'You received a new message'
          : 'You have a new message',
        image: req.user?.avatar || '',
        eventKey: `message:${message._id}`,
        messageId: message._id,
        ...(replyPost ? { postId: String(replyPost._id) } : {}),
        conversationId: message.conversationId,
        destination: 'Chat',
        destinationParams: {
          sellerId: String(message.senderId),
          sellerName: req.user?.name || req.user?.username || '',
          sellerPhone: req.user?.phone || '',
          sellerAvatar: req.user?.avatar || '',
          postId: message.postId || '',
          postTitle: message.postTitle || replyPost?.productName || message.replyPost?.title || '',
          conversationId: message.conversationId,
          contextType: message.contextType,
          replyPost: message.replyPost || null,
        },
      });
    } catch (notificationError) {
      console.error('[Notifications] Could not queue incoming message notification:', notificationError?.message || notificationError);
    }

    // Increment dailyMessagesUsed if this message has an image
    if (imageUrl) {
      await User.findByIdAndUpdate(senderId, { $inc: { dailyMessagesUsed: 1 } });
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    await Promise.all(uploadedStorageKeys.map(key => storageService.deleteMedia(key).catch(deleteError => {
      console.error('[Storage] Failed to clean up an unsaved message upload:', deleteError.code || 'B2_OPERATION_FAILED');
    })));
    await removeUploadedMessageImages(uploadedStorageKeys).catch(trackingError => {
      console.error('[Retention] Could not remove failed chat image tracking records:', trackingError.code || trackingError.message);
    });
    if ((error.code === 11000 || /UNIQUE constraint|SQLITE_CONSTRAINT/i.test(error.message || '')) && req.body.clientMessageId) {
      const existingMessage = await Message.findOne({ clientMessageId: String(req.body.clientMessageId).trim() });
      if (
        existingMessage
        && String(existingMessage.senderId) === String(req.user?._id || req.user?.id || '')
        && String(existingMessage.receiverId || '') === canonicalReceiverId
      ) {
        return res.status(200).json({
          success: true,
          message: refreshMessageMediaUrls(existingMessage, req),
          idempotent: true,
        });
      }
    }
    console.error('Send message error:', error.code || error.message || 'Unknown error');
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Server error' });
  }
};

// GET /messages/thread/:userId1/:userId2
exports.getMessages = async (req, res) => {
  try {
    const { userId1, userId2 } = req.params;
    const firstUser = String(userId1 || '').trim();
    const secondUser = String(userId2 || '').trim();
    const postId = String(req.query.postId || req.params.postId || '').trim();
    const hasPostFilter = typeof req.query.postId === 'string' || Boolean(req.params.postId);
    const requestedContextType = String(req.query.contextType || '').trim();
    const limitValue = req.query.limit == null ? null : Number.parseInt(req.query.limit, 10);
    const pageLimit = limitValue == null ? null : Math.min(Math.max(limitValue, 1), 100);
    const beforeId = String(req.query.beforeId || '').trim();

    if (limitValue != null && (!Number.isInteger(limitValue) || limitValue < 1)) {
      return res.status(400).json({ success: false, message: 'Invalid message page size' });
    }
    if (beforeId && !isValidObjectId(beforeId)) {
      return res.status(400).json({ success: false, message: 'Invalid message cursor' });
    }
    if (requestedContextType && !['post', 'shop', 'place', 'direct'].includes(requestedContextType)) {
      return res.status(400).json({ success: false, message: 'Unsupported conversation context' });
    }

    const authenticatedUserIds = [req.user?._id, req.user?.id, req.user?.phone]
      .filter(Boolean)
      .map(value => String(value).trim());
    if (!authenticatedUserIds.includes(firstUser) && !authenticatedUserIds.includes(secondUser)) {
      return res.status(403).json({ success: false, message: 'You are not a participant in this conversation' });
    }

    const conditions = [
      { senderId: firstUser, receiverId: secondUser },
      { senderId: secondUser, receiverId: firstUser },
      { senderPhone: firstUser, receiverPhone: secondUser },
      { senderPhone: secondUser, receiverPhone: firstUser },
      { senderId: firstUser, receiverPhone: secondUser },
      { senderPhone: firstUser, receiverId: secondUser },
      { senderId: secondUser, receiverPhone: firstUser },
      { senderPhone: secondUser, receiverId: firstUser },
    ];

    const messageFilter = { $or: conditions };
    if (hasPostFilter && postId) {
      messageFilter.postId = postId;
    } else if (hasPostFilter) {
      messageFilter.$and = [{
        $or: [
          { postId: '' },
          { postId: null },
          { postId: { $exists: false } },
        ],
      }];
    }
    let cursorMessage = null;
    if (beforeId) {
      cursorMessage = await Message.findOne({
        $and: [messageFilter, { _id: beforeId }],
      });
      if (!cursorMessage) {
        return res.status(400).json({ success: false, message: 'Message cursor is not in this conversation' });
      }
      messageFilter.$and = [
        ...(messageFilter.$and || []),
        {
          $or: [
            { createdAt: { $lt: cursorMessage.createdAt } },
            {
              createdAt: cursorMessage.createdAt,
              _id: { $lt: cursorMessage._id },
            },
          ],
        },
      ];
    }
    let messages = pageLimit
      ? await Message.find(messageFilter).sort({ createdAt: -1, _id: -1 }).limit(pageLimit + 1)
      : await Message.find(messageFilter).sort({ createdAt: 1, _id: 1 });
    const hasMore = pageLimit != null && messages.length > pageLimit;
    if (pageLimit != null) {
      messages = messages.slice(0, pageLimit).reverse();
    }
    const contextType = requestedContextType
      || messages.find(message => message.replyPost?.contextType)?.replyPost?.contextType
      || (postId ? 'post' : 'direct');

    const updatedMessages = await Promise.all(messages.map(async (msg) => {
      const msgObj = refreshMessageMediaUrls(msg, req);
      if (!msgObj.conversationId) {
        msgObj.conversationId = getConversationId(
          msgObj.senderId || msgObj.senderPhone,
          msgObj.receiverId || msgObj.receiverPhone,
          msgObj.replyPost?.contextType || msgObj.contextType || contextType,
          msgObj.postId || msgObj.replyPost?.contextId || ''
        );
      }
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
              videoThumbnail: postExists.videoThumbnail || msgObj.replyPost.videoThumbnail || '',
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

    res.json({
      success: true,
      messages: updatedMessages,
      hasMore,
      nextCursor: hasMore && updatedMessages.length ? String(updatedMessages[0]._id) : null,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET /conversations
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const userIdentifiers = [userId, req.user.phone].filter(Boolean).map(String);
    const orClauses = userIdentifiers.flatMap(identifier => [
      { senderId: identifier },
      { receiverId: identifier },
      { senderPhone: identifier },
      { receiverPhone: identifier },
    ]);

    const messages = await Message.find({ $or: orClauses }).sort({ createdAt: -1 });

    const conversationsMap = new Map();
    const contextTypes = new Map();
    messages.forEach(msg => {
      if (!msg.replyPost?.contextType || !msg.postId) return;
      const participants = [
        String(msg.senderId || msg.senderPhone || ''),
        String(msg.receiverId || msg.receiverPhone || ''),
      ].sort();
      contextTypes.set(`${participants.join(':')}:${msg.postId}`, msg.replyPost.contextType);
    });
    messages.forEach(msg => {
      const senderKey = String(msg.senderId || msg.senderPhone || '');
      const receiverKey = String(msg.receiverId || msg.receiverPhone || '');
      const isCurrentUserSender = userIdentifiers.includes(String(msg.senderId || ''))
        || userIdentifiers.includes(String(msg.senderPhone || ''));
      const otherId = isCurrentUserSender ? receiverKey : senderKey;
      const participantKey = [senderKey, receiverKey].sort().join(':');
      const contextType = msg.replyPost?.contextType
        || msg.contextType
        || contextTypes.get(`${participantKey}:${msg.postId || ''}`)
        || (msg.postId ? 'post' : 'direct');
      const conversationId = msg.conversationId || getConversationId(
        senderKey,
        receiverKey,
        contextType,
        msg.postId || msg.replyPost?.contextId || ''
      );
      const key = conversationId;
      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          conversationId,
          contextType,
          postId: msg.postId,
          postTitle: msg.postTitle,
          replyPost: msg.replyPost || null,
          otherUserId: otherId,
          otherUserName: isCurrentUserSender ? msg.receiverName : msg.senderName,
          otherUserAvatar: isCurrentUserSender ? msg.receiverAvatar : msg.senderAvatar,
          otherUserPhone: isCurrentUserSender ? msg.receiverPhone : msg.senderPhone,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
      const conv = conversationsMap.get(key);
      if (!conv.replyPost && msg.replyPost) {
        conv.replyPost = msg.replyPost;
      }
      if (
        !conv.lastMessage
        || new Date(msg.createdAt) > new Date(conv.lastMessage.createdAt)
        || (
          new Date(msg.createdAt).getTime() === new Date(conv.lastMessage.createdAt).getTime()
          && String(msg._id).localeCompare(String(conv.lastMessage._id)) > 0
        )
      ) {
        conv.lastMessage = msg;
      }
      const receiverMatchesCurrentUser = userIdentifiers.includes(String(msg.receiverId || ''))
        || userIdentifiers.includes(String(msg.receiverPhone || ''));
      if (receiverMatchesCurrentUser && !msg.read) {
        conv.unreadCount++;
      }
    });

    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => (
        new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
        || String(a.conversationId).localeCompare(String(b.conversationId))
      ));

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
    const userId = String(req.user?._id || req.user?.id || '');
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required' });
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    const userIdentifiers = [userId, req.user?.phone].filter(Boolean).map(String);
    if (
      !userIdentifiers.includes(String(message.receiverId || ''))
      && !userIdentifiers.includes(String(message.receiverPhone || ''))
    ) {
      return res.status(403).json({ success: false, message: 'You can only mark messages sent to you as read' });
    }
    if (!message.read) {
      message.read = true;
      await message.save();
      const senderId = String(message.senderId || message.senderPhone || '');
      const receiverId = String(message.receiverId || message.receiverPhone || '');
      const room = `chat_${[senderId, receiverId].sort().join('_')}`;
      const io = socketHelper.getIO();
      if (io && senderId && receiverId) {
        io.to(room).emit('message-read', {
          messageId: String(message._id),
          senderId,
          receiverId,
        });
      }
    }
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
    const receiverId = String(message.receiverId || message.receiverPhone || '');
    const room = `chat_${[String(message.senderId), receiverId].sort().join('_')}`;
    if (io && receiverId) io.to(room).emit('message-updated', { message });
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
    if (!messageId || !isValidObjectId(messageId)) {
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

    const mediaKeys = getMessageStorageKeys(message);
    await Promise.all(mediaKeys.map(key => storageService.deleteMedia(key)));
    await Message.findByIdAndDelete(messageId);
    await removeUploadedMessageImages(mediaKeys);

    const io = socketHelper.getIO();
    const receiverId = String(message.receiverId || message.receiverPhone || '');
    const room = `chat_${[String(message.senderId), receiverId].sort().join('_')}`;
    if (io && receiverId) {
      io.to(room).emit('message-deleted', {
        messageId: String(messageId),
        senderId: String(message.senderId),
        receiverId,
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
    const user = await User.findById(userId).select('imagesPerMessage');
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

    const maxImagesPerMessage = Number.isSafeInteger(user.imagesPerMessage)
      ? user.imagesPerMessage
      : DEFAULT_USER_PERMISSIONS.imagesPerMessage;
    if (req.files.length > maxImagesPerMessage) {
      return res.status(403).json({
        success: false,
        message: `You can attach up to ${maxImagesPerMessage} images per message.`,
      });
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

    await recordUploadedMessageImages(userId, uploadedStorageKeys);

    // Return uploaded URLs to client. Messages themselves are created via /send which should reference these URLs.
    res.json({ success: true, url: urls[0], urls });
  } catch (error) {
    await Promise.all(uploadedStorageKeys.map(key => storageService.deleteMedia(key).catch(() => {})));
    await removeUploadedMessageImages(uploadedStorageKeys).catch(trackingError => {
      console.error('[Retention] Could not remove failed chat image tracking records:', trackingError.code || trackingError.message);
    });
    console.error('Upload image error:', error.code || error.message || 'Unknown error');
    res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Image upload failed' });
  }
};
