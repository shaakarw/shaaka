// forceResetAdmin.js
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/db');
const { closeDB } = connectDB;

// Direct import of the User model (or you can use the connection)
const User = require('./models/User');

const forceReset = async () => {
  try {
    await connectDB();

    const phone = process.env.ADMIN_PHONE;
    const username = process.env.ADMIN_USERNAME || 'shaaka';
    const newPassword = process.env.ADMIN_PASSWORD;
    if (!phone || !newPassword) {
      throw new Error('ADMIN_PHONE and ADMIN_PASSWORD must be configured');
    }
    const hashed = await bcrypt.hash(newPassword, 10);

    // Option 1: Use findOneAndUpdate with model (bypasses pre-save hooks if any)
    const result = await User.findOneAndUpdate(
      { phone },
      { username, password: hashed, role: 'admin' },
      { new: true, runValidators: false } // skip validators to be safe
    );

    if (!result) {
      console.log('❌ User not found – creating one...');
      const newUser = await User.create({
        phone,
        username,
        idNumber: '1234567890123456',
        password: newPassword,
        role: 'admin',
        name: 'Admin',
        avatar: '',
        location: 'Kigali, Rwanda',
        bio: 'System Administrator',
        email: '',
      });
      console.log('✅ New admin created:', newUser._id);
    } else {
      console.log('✅ Admin password updated:', result._id);
      console.log('   Phone:', result.phone);
      console.log('   Role:', result.role);
    }

    // Verify by comparing directly
    const verifyUser = await User.findOne({ phone });
    const isMatch = await bcrypt.compare(newPassword, verifyUser.password);
    console.log('🔐 Verification password match:', isMatch);

    await closeDB();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

forceReset();