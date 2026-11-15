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
const READY_CHECK_TIMEOUT_MS = 2000;
const shouldLogDebug = () => process.env.DEBUG_LOGS === 'true';
const shouldLogPerformance = () => (
  process.env.PERF_LOGS === 'true'
);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    service: 'shaaka-backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (req, res) => {
  let timeout;
  try {
    const database = connectDB.getClient();
    await Promise.race([
      database.execute('SELECT 1'),
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Readiness check timed out')), READY_CHECK_TIMEOUT_MS);
      }),
    ]);
    res.status(200).json({
      success: true,
      status: 'ready',
      service: 'shaaka-backend',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'not_ready',
      service: 'shaaka-backend',
      timestamp: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timeout);
  }
});

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

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Shaaka Backend API is running',
    service: 'shaaka-backend',
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

// Keep the root-mounted payment fallback after all defined routes.
const paymentRouter = require('./routes/payment');
app.use('/', paymentRouter);

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
        socket.join(currentUserId);
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
      }).catch((err) => {
        console.error('Socket user lookup error:', err.code || 'SOCKET_USER_LOOKUP_FAILED');
      });
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

let startPromise;
let runtimeInitialization;
let runtimeInitialized = false;
let retryTimer;
let cronStop;
let shutdownPromise;
let isShuttingDown = false;

const initializeRuntime = async ({ initializeCron = true, retryDelayMs = 30000 } = {}) => {
  if (runtimeInitialized || isShuttingDown) return;
  if (runtimeInitialization) return runtimeInitialization;

  runtimeInitialization = (async () => {
    const databaseStartedAt = process.hrtime.bigint();
    try {
      await connectDB();
      if (shouldLogPerformance()) {
        console.info(`[Perf][Startup] database-connected ${(Number(process.hrtime.bigint() - databaseStartedAt) / 1e6).toFixed(1)}ms`);
      }
    } catch (error) {
      console.error('[Startup] Database initialization failed; health remains available:', error.code || 'DATABASE_INITIALIZATION_FAILED');
      if (!isShuttingDown) {
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          initializeRuntime({ initializeCron, retryDelayMs }).catch((retryError) => {
            console.error('[Startup] Database retry failed:', retryError.code || 'DATABASE_RETRY_FAILED');
          });
        }, retryDelayMs);
        retryTimer.unref?.();
      }
      return;
    }

    await seedAdmin();
    if (initializeCron && !cronStop) {
      cronStop = initCronJobs({ initialDelayMs: 30000 });
    }
    runtimeInitialized = true;
  })();

  try {
    await runtimeInitialization;
  } finally {
    runtimeInitialization = undefined;
  }
};

const startServer = async ({
  port = process.env.PORT || 5000,
  host = '0.0.0.0',
  initializeDatabase = true,
  initializeCron = true,
  retryDelayMs = 30000,
} = {}) => {
  if (server.listening) return { app, server, io };
  if (startPromise) return startPromise;
  isShuttingDown = false;

  const startupStartedAt = process.hrtime.bigint();
  startPromise = new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });

  try {
    await startPromise;
  } catch (error) {
    startPromise = undefined;
    throw error;
  }

  server.on('error', (error) => {
    console.error('[Server] HTTP server error:', error.message);
  });
  const address = server.address();
  console.log(`[Server] Listening on ${address.address}:${address.port}`);
  if (shouldLogPerformance()) {
    console.info(`[Perf][Startup] server-ready ${(Number(process.hrtime.bigint() - startupStartedAt) / 1e6).toFixed(1)}ms`);
  }

  if (initializeDatabase) {
    initializeRuntime({ initializeCron, retryDelayMs }).catch((error) => {
      console.error('[Startup] Runtime initialization failed:', error.code || 'RUNTIME_INITIALIZATION_FAILED');
    });
  }
  return { app, server, io };
};

const shutdown = () => {
  if (shutdownPromise) return shutdownPromise;
  isShuttingDown = true;
  clearTimeout(retryTimer);
  retryTimer = undefined;
  if (cronStop) {
    cronStop();
    cronStop = undefined;
  }

  shutdownPromise = (async () => {
    if (runtimeInitialization) await runtimeInitialization;
    if (io) {
      await new Promise((resolve, reject) => {
        io.close((error) => error ? reject(error) : resolve());
      });
    } else if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
    await connectDB.closeDB();
    runtimeInitialized = false;
    startPromise = undefined;
  })().finally(() => {
    shutdownPromise = undefined;
  });

  return shutdownPromise;
};

if (require.main === module) {
  const shutdownForSignal = (signal) => {
    console.info(`[Shutdown] Received ${signal}; closing server resources.`);
    shutdown().then(() => {
      process.exitCode = signal === 'SIGINT' ? 130 : 0;
    }).catch((error) => {
      console.error('[Shutdown] Graceful shutdown failed:', error.code || error.message || 'SHUTDOWN_FAILED');
      process.exitCode = 1;
    });
  };
  const handleFatalError = (error, type) => {
    console.error(`[Process] ${type}:`, error);
    shutdown().catch((shutdownError) => {
      console.error('[Shutdown] Failed after process error:', shutdownError.code || 'SHUTDOWN_FAILED');
    }).finally(() => {
      process.exitCode = 1;
    });
  };

  process.on('SIGTERM', () => shutdownForSignal('SIGTERM'));
  process.on('SIGINT', () => shutdownForSignal('SIGINT'));
  process.on('unhandledRejection', (error) => handleFatalError(error, 'Unhandled promise rejection'));
  process.on('uncaughtException', (error) => handleFatalError(error, 'Uncaught exception'));

  startServer().catch((error) => {
    console.error('[Startup] HTTP server failed to start:', error.code || error.message || 'SERVER_START_FAILED');
    process.exitCode = 1;
  });
}

module.exports = { app, server, startServer, shutdown, seedAdmin };
