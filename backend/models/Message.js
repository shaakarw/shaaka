// models/Message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  postId: { type: String, default: '', index: true },
  postTitle: String,
  postUser: String,
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  senderName: String,
  senderPhone: String,
  senderAvatar: String,
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiverName: String,
  receiverPhone: String,
  text: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' },
  audioUrl: { type: String, default: '' },
  audioDuration: Number,
  cloudinaryPublicId: { type: String, default: '' },
  cloudinaryResourceType: { type: String, enum: ['image', 'video', 'audio', ''], default: '' },
  read: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  repliedTo: {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    text: String,
    imageUrl: { type: String, default: '' },
    senderName: String,
  },
  // ----- NEW: Reply to Post -----
 // models/Message.js (partial – add this field)
replyPost: {
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
  title: String,
  description: String,
  image: String,
  price: Number,           // if available
  location: String,
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: Date,
  available: { type: Boolean, default: true },
},
  // ----- END NEW -----
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

messageSchema.index({ postId: 1, senderId: 1, receiverId: 1 });
messageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);