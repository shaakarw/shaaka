// controllers/typingController.js
const { setTyping, isTyping } = require('../utils/typingStore');

/**
 * POST /api/messages/typing
 * Body: { postId, toUserId, isTyping, fromUserId? }
 * If fromUserId is provided in body, use it (frontend sends phone).
 * Otherwise, fall back to req.user.id from JWT (backend user ID).
 * 
 * IMPORTANT: Frontend sends phone numbers, so we store by phone numbers
 * in the typing store for consistency.
 */
exports.setTypingStatus = async (req, res) => {
  try {
    const { postId, toUserId, isTyping: isTypingFlag, fromUserId: bodyFromUserId } = req.body;
    const jwtUserId = req.user.id;

    // Use fromUserId from body if provided, otherwise use JWT user id
    const fromUserId = bodyFromUserId || jwtUserId;

    console.log('[TYPING-BACKEND] setTypingStatus called:', {
      postId,
      toUserId,
      isTypingFlag,
      bodyFromUserId,
      jwtUserId,
      effectiveFromUserId: fromUserId,
    });

    if (!postId || !toUserId) {
      console.warn('[TYPING-BACKEND] setTypingStatus: missing postId or toUserId', {
        postId: !!postId,
        toUserId: !!toUserId,
      });
      return res.status(400).json({ success: false, message: 'Missing postId or toUserId' });
    }

    setTyping(postId, fromUserId, toUserId, isTypingFlag);

    console.log('[TYPING-BACKEND] setTypingStatus: typing state updated', {
      postId,
      fromUserId,
      toUserId,
      isTypingFlag,
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[TYPING-BACKEND] Error setting typing status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/messages/typing/:postId/:currentUserId/:otherUserId
 * Returns whether the "other" user is typing in this post.
 * 
 * Parameters are typically phone numbers from the frontend.
 */
exports.getTypingStatus = async (req, res) => {
  try {
    const { postId, currentUserId, otherUserId } = req.params;

    console.log('[TYPING-BACKEND] getTypingStatus called:', {
      postId,
      currentUserId,
      otherUserId,
    });

    if (!postId || !currentUserId || !otherUserId) {
      console.warn('[TYPING-BACKEND] getTypingStatus: missing parameters', {
        postId: !!postId,
        currentUserId: !!currentUserId,
        otherUserId: !!otherUserId,
      });
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const result = isTyping(postId, currentUserId, otherUserId);

    console.log('[TYPING-BACKEND] getTypingStatus: result', {
      postId,
      currentUserId,
      otherUserId,
      result,
    });

    res.status(200).json({
      success: true,
      typing: result.typing,
      by: result.by,
    });
  } catch (error) {
    console.error('[TYPING-BACKEND] Error getting typing status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};