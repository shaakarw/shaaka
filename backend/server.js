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

const app = express();
const server = http.createServer(app);

// ---------- Seed admin user ----------
const seedAdmin = async () => {
  try {
    const phone = '0799882580';
    const password = '1234';
    console.log('🔍 Checking for admin user with phone:', phone);

    let existing = await User.findOne({ phone });

    if (!existing) {
      console.log('❌ Admin not found – creating one...');
      const hashed = await bcrypt.hash(password, 10);
      const admin = await User.create({
        phone,
        username: 'Admin',
        idNumber: '1234567890123456',
        password: hashed,
        role: 'admin',
        avatar: '',
        location: 'Kigali, Rwanda',
        bio: 'System Administrator',
        name: 'Admin',
        email: '',
      });
      console.log('✅ Admin user CREATED with ID:', admin._id);
      return;
    }

    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
      console.log('✅ Existing user PROMOTED to admin:', existing._id);
      return;
    }

    const isMatch = await bcrypt.compare(password, existing.password);
    if (!isMatch) {
      existing.password = await bcrypt.hash(password, 10);
      await existing.save();
      console.log('🔑 Admin password reset to "1234"');
    }

    console.log('✅ Admin user ALREADY EXISTS with ID:', existing._id);
    console.log('   Phone:', existing.phone);
    console.log('   Role:', existing.role);
  } catch (err) {
    console.error('❌ seedAdmin error:', err);
  }
};

// ---------- Start server after seeding ----------
const startServer = async () => {
  try {
    await connectDB();
    await seedAdmin();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());

// 📨 Request logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  if (req.headers.authorization) {
    console.log(`🔑 Authorization: ${req.headers.authorization.substring(0, 30)}...`);
  }
  next();
});

// ---------- Routes ----------
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', messageRoutes);
app.use('/api/user', require('./routes/user'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/places', placeRoutes);
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
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
    const user = await User.findOne({ phone: '0799882580' });
    if (!user) {
      return res.json({ success: false, message: 'Admin user not found' });
    }
    const match = await bcrypt.compare('1234', user.password);
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
    const phone = '0799882580';
    const password = '1234';
    let user = await User.findOne({ phone });
    if (!user) {
      const hashed = await bcrypt.hash(password, 10);
      user = await User.create({
        phone,
        username: 'Admin',
        idNumber: '1234567890123456',
        password: hashed,
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
    user.password = await bcrypt.hash(password, 10);
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

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      currentUserId = decoded.id;
      User.findById(decoded.id).then((user) => {
        if (!user) return;
        user.currentSession = user.currentSession || {};
        user.currentSession.socketId = socket.id;
        user.currentSession.lastSeen = new Date();
        user.isOnline = true;
        user.lastSeen = new Date();
        user.save().catch((err) => console.error('Save user online error:', err));

        onlineStore.setOnline(user._id, true);
        io.emit('user-online', { userId: String(user._id), lastSeen: null });

        console.log(`✅ User ${user.username || user._id} connected (socket ${socket.id})`);
      }).catch(() => {});
    } catch (err) {
      console.warn('Invalid auth token on socket connection');
    }
  }

  // ---------- Chat events ----------
  socket.on('join-chat', ({ sellerId }) => {
    if (!currentUserId) return;
    const room = `chat_${[currentUserId, sellerId].sort().join('_')}`;
    socket.join(room);
  });

  socket.on('leave-chat', ({ sellerId }) => {
    if (!currentUserId) return;
    const room = `chat_${[currentUserId, sellerId].sort().join('_')}`;
    socket.leave(room);
  });

  socket.on('typing', ({ postId, toUserId, isTyping }) => {
    if (!currentUserId || !postId || !toUserId) return;
    const room = `chat_${[currentUserId, toUserId].sort().join('_')}`;
    socket.to(room).emit('user-typing', {
      userId: currentUserId,
      typing: isTyping,
    });
  });

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
      console.log(`🔌 Socket ${socket.id} disconnected for user ${user.username || user._id}`);
    }).catch((err) => console.error('Find user on disconnect error:', err));
  });
});

// ---------- Start Cron Jobs ----------
const { initCronJobs } = require('./cron');
initCronJobs();
