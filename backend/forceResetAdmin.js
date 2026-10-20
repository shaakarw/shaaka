// forceResetAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

// Direct import of the User model (or you can use the connection)
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your_database_name';

const forceReset = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🔌 Connected to MongoDB');

    const phone = process.env.ADMIN_PHONE;
    const newPassword = process.env.ADMIN_PASSWORD;
    if (!phone || !newPassword) {
      throw new Error('ADMIN_PHONE and ADMIN_PASSWORD must be configured');
    }
    const hashed = await bcrypt.hash(newPassword, 10);

    // Option 1: Use findOneAndUpdate with model (bypasses pre-save hooks if any)
    const result = await User.findOneAndUpdate(
      { phone },
      { password: hashed, role: 'admin' },
      { new: true, runValidators: false } // skip validators to be safe
    );

    if (!result) {
      console.log('❌ User not found – creating one...');
      const newUser = await User.create({
        phone,
        username: 'Admin',
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

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

forceReset();