const bcrypt = require('bcryptjs');
const createModel = require('./sqlModel');

const userDefaults = {
  role: 'user',
  passwordHistory: [],
  avatar: '',
  avatarStorageKey: '',
  avatarVariants: [],
  storageProvider: '',
  stories: [],
  location: 'Kigali, Rwanda',
  bio: '',
  name: '',
  email: '',
  socialLinks: [],
  notificationPreferences: {
    newPosts: true, newShops: true, newPlaces: true, newShoppingMalls: true,
    newMallShops: true, mapPlacesAdded: true, passwordChanged: true, nameChanged: true,
    messages: true, socialActivities: true, followers: true, marketplace: true,
    orders: true, business: true, accountSecurity: true, promotional: true,
    notificationSound: true, vibration: true,
  },
  isOnline: false,
  accountDeletionStatus: 'active',
  accountDeletionScheduledAt: null,
  accountDeletionNotifiedAt: null,
  tokenVersion: 0,
  currentSession: { sessionId: '', deviceId: '', socketId: '' },
  savedPosts: [],
  blocked: false,
  dailyMessagesUsed: 0,
  postUploadLimitPerDay: 0,
  shopUploadLimitLifetime: 0,
  mallShopUploadLimitLifetime: 0,
  placeProductUploadLimitPerDay: 0,
  mallProductUploadLimitPerDay: 0,
  allowVideoUpload: false,
  videoUploadLimitPerDay: 0,
  imagesPerMessage: 0,
  imagesRetentionDays: 0,
  messagesRetentionDays: 0,
  plan: 'free',
  planName: 'Free',
  planExpiry: null,
  subscriptionStatus: 'active',
  paymentHistory: [],
};

const User = createModel('User', 'users', {
  columns: {
    phone: 'phone', username: 'username', idNumber: 'id_number', role: 'role',
    blocked: 'blocked', plan: 'plan', subscriptionStatus: 'subscription_status',
    createdAt: 'created_at', updatedAt: 'updated_at',
  },
  timestamps: true,
  defaults: () => ({
    ...userDefaults,
    lastActiveAt: new Date(),
    lastSeen: new Date(),
    messagesLastReset: new Date(),
    planStartDate: new Date(),
  }),
  beforeSave: async (document, original) => {
    if (document.username !== undefined) document.username = String(document.username).trim().toLowerCase();
    if (!document.password || (original && document.password === original.password)) return;
    if (/^\$2[aby]\$/.test(document.password)) return;
    const hashedPassword = await bcrypt.hash(document.password, await bcrypt.genSalt(10));
    const history = (document.passwordHistory || []).filter(Boolean);
    document.password = hashedPassword;
    document.passwordHistory = [hashedPassword, ...history]
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 5);
  },
});

const Post = createModel('Post', 'posts', {
  columns: {
    user: 'user_id', category: 'category', status: 'status', trending: 'trending',
    featured: 'featured', price: 'price', createdAt: 'created_at', updatedAt: 'updated_at',
  },
  timestamps: true,
  defaults: {
    userAvatar: '', userAvatarVariants: [], productName: '', bedrooms: null, bathrooms: null,
    size: null, priceNegotiable: false, contactNumbers: [], houseImages: [],
    houseImageStorageKeys: [], houseImageVariants: [], storageProvider: '', videoUrl: '',
    videoHlsUrl: '', videoId: '', videoStorageKey: '', videoDuration: 0, videoThumbnail: '',
    videoThumbnailStorageKey: '', videoThumbnailStatus: '', featured: false, trending: false,
    status: 'active', isReported: false,
  },
  beforeSave: async (document) => {
    if (document.price !== undefined) document.amount = `RWF ${Number(document.price).toLocaleString()}`;
    if (document.userPhone !== undefined) document.ownerPhone = document.userPhone;
  },
  fieldTypes: { videoDuration: 'Number' },
});

const Message = createModel('Message', 'messages', {
  columns: {
    senderId: 'sender_id', receiverId: 'receiver_id', postId: 'post_id',
    clientMessageId: 'client_message_id', read: 'read', createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  timestamps: true,
  defaults: {
    postId: '', text: '', imageUrl: '', imageUrls: [], videoUrl: '', audioUrl: '',
    imageStorageKey: '', imageStorageKeys: [], videoStorageKey: '', audioStorageKey: '',
    storageProvider: '', cloudinaryPublicId: '', cloudinaryResourceType: '',
    read: false, isEdited: false,
    replyPost: { postId: '', contextId: '', contextType: 'post', shopId: '', mallId: '', available: true },
    deletedFor: [],
  },
});

const Notification = createModel('Notification', 'notifications', {
  columns: {
    userId: 'user_id', senderId: 'sender_id', postId: 'post_ref_id', shopId: 'shop_id',
    placeId: 'place_id', shoppingMallId: 'shopping_mall_id', mallShopId: 'mall_shop_id',
    messageId: 'message_id', eventKey: 'event_key', deliveryStatus: 'delivery_status',
    isRead: 'is_read', createdAt: 'created_at',
  },
  foreignReferences: { postId: { column: 'post_id', target: 'posts' } },
  defaults: () => ({
    image: '', conversationId: '', destination: '', destinationParams: {}, deliveryStatus: 'pending',
    deliveryAttempts: [], deliveryAttemptCount: 0, deliveryError: '', deliveryRetryAt: new Date(),
    isRead: false, createdAt: new Date(),
  }),
});

const definitions = {
  SavedPost: ['savedposts', { columns: {
    user: 'user_id', post: 'post_id', savedAt: 'saved_at',
  }, defaults: () => ({ savedAt: new Date() }) }],
  Place: ['places', { columns: {
    userId: 'user_id', category: 'category', createdAt: 'created_at',
  }, defaults: () => ({
    images: {}, imageStorageKeys: {
      streetImage: '', street: '', streetVideo: '', doorImage: '', doorVideo: '',
    },
    imageVariants: [], products: [], storageProvider: '', stopped: false, createdAt: new Date(),
  }) }],
  Favorite: ['favorites', { timestamps: true, columns: {
    userId: 'user_id', placeId: 'place_id', shopId: 'shop_ref_id', type: 'type',
    createdAt: 'created_at', updatedAt: 'updated_at',
  }, foreignReferences: { shopId: { column: 'shop_id', target: 'shops' } }, defaults: { placeId: null, shopId: null } }],
  Report: ['reports', { columns: {
    reporter: 'reporter_id', post: 'post_id', ignored: 'ignored', createdAt: 'created_at',
  }, defaults: () => ({ ignored: false, createdAt: new Date() }) }],
  MallShop: ['mallshops', { columns: {
    mallId: 'mall_id', ownerId: 'owner_id', createdDate: 'created_date',
  }, defaults: () => ({
    images: {}, imageVariants: [], products: [], frontImageStorageKey: '',
    storageProvider: '', createdDate: new Date(),
  }) }],
  AppSetting: ['appsettings', {
    timestamps: true,
    columns: { key: 'key', updatedBy: 'updated_by', updatedAt: 'updated_at' },
    defaults: { value: '', description: '' },
    beforeSave: async (document) => {
      if (document.key !== undefined) document.key = String(document.key).trim().toLowerCase();
    },
  }],
  Note: ['notes', { columns: {
    userId: 'user_id', createdAt: 'created_at', expiresAt: 'expires_at',
  }, defaults: () => ({ link: '', createdAt: new Date(), images: [] }) }],
  BusinessIdea: ['businessideas', { timestamps: true, columns: {
    createdBy: 'created_by', updatedBy: 'updated_by', category: 'category',
    published: 'published', createdAt: 'created_at', updatedAt: 'updated_at',
  }, defaults: {
    category: '', businessCategory: '', description: '', fullDescription: '', cost: '', profit: '',
    risk: '', time: '', steps: [], targetAudience: '', requiredSkills: [], equipment: [],
    potentialCustomers: [], marketingStrategy: '', challenges: [], location: '', additionalInfo: '',
    published: true, title: '', company: '', district: '', salary: '', exp: '', edu: '',
    deadline: '', phone: '', whatsapp: '', email: '', website: '', linkedin: '', level: '',
    duration: '', cert: '', type: '', contactPhone: '', contactWhatsapp: '', updatedBy: null,
  } }],
  Status: ['status', { columns: { userId: 'user_id', updatedAt: 'updated_at' }, defaults: () => ({ updatedAt: new Date() }) }],
  Shop: ['shops', { columns: {
    owner: 'owner_id', status: 'status', type: 'type', createdAt: 'created_at',
  }, defaults: () => ({
    location: '', status: 'active', type: 'shop', createdAt: new Date(), images: [],
  }) }],
  DeviceToken: ['devicetokens', { timestamps: true, columns: {
    userId: 'user_id', deviceId: 'device_id', token: 'token', status: 'status',
    platform: 'platform', lastSeenAt: 'last_seen_at', createdAt: 'created_at',
    updatedAt: 'updated_at',
  }, defaults: () => ({ status: 'active', lastSeenAt: new Date() }) }],
  Subscription: ['subscriptions', { columns: {
    user: 'user_id', status: 'status', createdAt: 'created_at', expiresAt: 'expires_at',
  }, defaults: () => ({
    status: 'active', amount: 0, createdAt: new Date(),
  }) }],
  Story: ['stories', { columns: {
    userId: 'user_id', createdAt: 'created_at',
  }, defaults: () => ({ views: [], createdAt: new Date() }) }],
  Conversation: ['conversations', { columns: {
    userAId: 'user_a_id', userBId: 'user_b_id', createdAt: 'created_at', updatedAt: 'updated_at',
  } }],
  Video: ['videos', { columns: {
    userId: 'user_id', postId: 'post_id', createdAt: 'created_at',
  } }],
};

const models = { User, Post, Message, Notification };
for (const [modelName, [collection, options]] of Object.entries(definitions)) {
  models[modelName] = createModel(modelName, collection, options);
}

module.exports = models;
