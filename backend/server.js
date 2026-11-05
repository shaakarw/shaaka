// ✅ LOAD ENV FIRST – before anything else
require('dotenv').config();

// Now require other modules
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const placeRoutes = require('./routes/placeRoutes');
const mallShopRoutes = require('./routes/mallShopRoutes');
const messageRoutes = require('./routes/messages');
const favoriteRoutes = require('./routes/favorites');
const userNotesRouter = require('./routes/userNotes');
const { initCronJobs } = require('./cron');

const app = express();
const server = http.createServer(app);
const shouldLogDebug = () => process.env.DEBUG_LOGS === 'true';
const shouldLogPerformance = () => (
  process.env.PERF_LOGS === 'true'
);

// ---------- Seed admin user ----------
const seedAdmin = async () => {
  try {
    const phone = process.env.ADMIN_PHONE;
    const username = process.env.ADMIN_USERNAME || 'shaaka';
    const password = process.env.ADMIN_PASSWORD;
    if (!phone || !password) {
      throw new Error('ADMIN_PHONE and ADMIN_PASSWORD must be configured');
    }

    let existing = await User.findOne({ phone });

    if (!existing) {
      const admin = await User.create({
        phone,
        username,
        idNumber: '1234567890123456',
        password,
        role: 'admin',
        avatar: '',
        location: 'Kigali, Rwanda',
        bio: 'System Administrator',
        name: 'Admin',
        email: '',
      });
      console.log('✅ Admin user created');
      return;
    }

    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log('✅ Existing user promoted to admin');
    }

    if (existing.username !== username) {
      existing.username = username;
      await existing.save();
    }

    const isMatch = await bcrypt.compare(password, existing.password);
    if (!isMatch) {
      existing.password = password;
      await existing.save();
      console.log('🔑 Admin password reset');
    }

    console.log('✅ Admin user already exists');
  } catch (err) {
    console.error('❌ seedAdmin error:', err);
  }
};

// ---------- Start server after seeding ----------
const startServer = async () => {
  const startupStartedAt = process.hrtime.bigint();
  try {
    const databaseStartedAt = process.hrtime.bigint();
    await connectDB();
    if (shouldLogPerformance()) {
      console.info(`[Perf][Startup] database-connected ${(Number(process.hrtime.bigint() - databaseStartedAt) / 1e6).toFixed(1)}ms`);
    }
    const adminSeedStartedAt = process.hrtime.bigint();
    await seedAdmin();
    if (shouldLogPerformance()) {
      console.info(`[Perf][Startup] admin-seeded ${(Number(process.hrtime.bigint() - adminSeedStartedAt) / 1e6).toFixed(1)}ms`);
    }
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      if (shouldLogPerformance()) {
        console.info(`[Perf][Startup] server-ready ${(Number(process.hrtime.bigint() - startupStartedAt) / 1e6).toFixed(1)}ms`);
      }
      initCronJobs({ initialDelayMs: 30000 });
    });
  } catch (error) {
    console.error('Failed to start server:', error.code || 'STARTUP_FAILED');
    process.exit(1);
  }
};

startServer();

// ---------- Middleware ----------
app.use(cors());
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    if (!shouldLogPerformance()) return;
    const endpoint = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.info(`[Perf][HTTP] ${req.method} ${endpoint} ${durationMs.toFixed(1)}ms status=${res.statusCode}`);
  });
  next();
});
app.use(express.json());

// ---------- Routes ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/media', require('./routes/media'));
app.use('/api/messages', messageRoutes);
app.use('/api/sync', require('./routes/sync'));
app.use('/api/user', require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/business-ideas', require('./routes/businessIdeas'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/places', placeRoutes);
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/settings', require('./routes/settings'));
        // admin
app.use('/api/user/notes', require('./routes/userNotes')); // user
app.use('/api/mall-shops', mallShopRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/notifications', require('./routes/notifications'));

// 👇 **NEW: Payment routes (MTN MoMo)**
const paymentRouter = require('./routes/payment');
app.use('/', paymentRouter); // Now /request-payment, /callback, etc. will work

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Shaaka API is running.',
    app: 'Shaaka'
  });
});

// ---------- 🔍 DEBUG: Check admin user ----------
app.get('/api/admin/debug', async (req, res) => {
  try {
    const user = await User.findOne({ phone: process.env.ADMIN_PHONE });
    if (!user) {
      return res.json({ success: false, message: 'Admin user not found' });
    }
    const match = await bcrypt.compare(process.env.ADMIN_PASSWORD, user.password);
    res.json({
      success: true,
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
        passwordHash: user.password.substring(0, 20) + '...',
        passwordMatches: match,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- 🛠️ MANUAL ADMIN SETUP ----------
app.post('/api/admin/setup', async (req, res) => {
  try {
    const phone = process.env.ADMIN_PHONE;
    const username = process.env.ADMIN_USERNAME || 'shaaka';
    const password = process.env.ADMIN_PASSWORD;
    if (!phone || !password) {
      return res.status(500).json({ success: false, message: 'Admin credentials are not configured' });
    }
    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        phone,
        username,
        idNumber: '1234567890123456',
        password,
        role: 'admin',
        name: 'Admin',
        avatar: '',
        location: 'Kigali, Rwanda',
        bio: 'System Administrator',
        email: '',
      });
      return res.json({ success: true, message: 'Admin created', user: { id: user._id, phone: user.phone, role: user.role } });
    }
    user.role = 'admin';
    user.username = username;
    user.password = password;
    await user.save();
    res.json({ success: true, message: 'Admin updated (password reset, role set)', user: { id: user._id, phone: user.phone, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- Socket.IO ----------
const socketHelper = require('./socket');
const io = socketHelper.init(server);
const onlineStore = require('./utils/onlineStore');

io.on('connection', (socket) => {
  const token = socket.handshake.auth?.token;
  let currentUserId = null;
  const pendingChatUsers = new Set();

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
      const decodedUserId = decoded.id || decoded.userId || decoded._id;
      if (!decodedUserId) {
        socket.disconnect(true);
        return;
      }
      User.findById(decodedUserId).then((user) => {
        if (!user) return;
        if (
          (decoded.sessionId && decoded.sessionId !== user.currentSession?.sessionId)
          || Number(decoded.tokenVersion ?? 0) !== Number(user.tokenVersion ?? 0)
        ) {
          socket.disconnect(true);
          return;
        }
        currentUserId = String(user._id);
        user.currentSession = user.currentSession || {};
        user.currentSession.socketId = socket.id;
        user.currentSession.lastSeen = new Date();
        user.isOnline = true;
        user.lastSeen = new Date();
        user.save().catch((err) => console.error('Save user online error:', err));

        onlineStore.setOnline(user._id, true);
        io.emit('user-online', { userId: String(user._id), lastSeen: null });
        for (const sellerId of pendingChatUsers) {
          socket.join(`chat_${[currentUserId, sellerId].sort().join('_')}`);
        }
        pendingChatUsers.clear();

        if (shouldLogDebug()) {
          console.log(`✅ User ${user.username || user._id} connected (socket ${socket.id})`);
        }
      }).catch(() => {});
    } catch (err) {
      console.warn('Invalid auth token on socket connection');
    }
  }

  // ---------- Chat events ----------
  socket.on('join-chat', (payload = {}) => {
    const sellerId = String(payload.sellerId || '').trim();
    if (!sellerId) return;
    if (!currentUserId) {
      pendingChatUsers.add(sellerId);
      return;
    }
    const room = `chat_${[currentUserId, sellerId].sort().join('_')}`;
    socket.join(room);
  });

  socket.on('leave-chat', (payload = {}) => {
    const sellerId = String(payload.sellerId || '').trim();
    if (!sellerId) return;
    pendingChatUsers.delete(sellerId);
    if (!currentUserId) return;
    const room = `chat_${[currentUserId, sellerId].sort().join('_')}`;
    socket.leave(room);
  });

  const broadcastTyping = (eventName, payload = {}) => {
    const chatId = payload.chatId || payload.postId;
    const receiverId = payload.receiverId || payload.toUserId;
    if (!currentUserId || !chatId || !receiverId) return;
    const room = `chat_${[currentUserId, receiverId].sort().join('_')}`;
    socket.to(room).emit(eventName, {
      chatId: String(chatId),
      senderId: String(currentUserId),
      receiverId: String(receiverId),
      typing: eventName === 'user-typing',
    });
  };

  socket.on('typing', (payload) => broadcastTyping('user-typing', payload));
  socket.on('stop_typing', (payload) => broadcastTyping('user-stop-typing', payload));

  socket.on('logout', () => {
    if (!currentUserId) return;
    User.findById(currentUserId).then(async (user) => {
      if (!user) return;
      user.isOnline = false;
      user.lastSeen = new Date();
      if (user.currentSession) user.currentSession.socketId = '';
      await user.save();
      onlineStore.setOnline(user._id, false);
      io.emit('user-offline', { userId: String(user._id), lastSeen: user.lastSeen });
      socket.disconnect(true);
    }).catch((err) => console.error('Error handling logout:', err));
  });

socket.on('disconnect', () => {
    User.findOne({ 'currentSession.socketId': socket.id }).then(async (user) => {
      if (!user) return;
      if (user.currentSession) user.currentSession.socketId = '';
      await user.save();
      if (shouldLogDebug()) {
        console.log(`🔌 Socket ${socket.id} disconnected for user ${user.username || user._id}`);
      }
    }).catch((err) => console.error('Find user on disconnect error:', err));
  });
});
