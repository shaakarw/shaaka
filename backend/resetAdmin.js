// resetAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your_database_name';

const resetAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('🔌 Connected to MongoDB');

    const phone = process.env.ADMIN_PHONE;
    const password = process.env.ADMIN_PASSWORD;
    if (!phone || !password) {
      throw new Error('ADMIN_PHONE and ADMIN_PASSWORD must be configured');
    }

    const user = await User.findOneAndUpdate(
      { phone },
      { password: await bcrypt.hash(password, 10), role: 'admin' },
      { new: true, runValidators: false }
    );
    if (!user) {
      console.log('❌ Admin user not found');
      process.exit(0);
    }

    console.log('✅ Admin password reset and role set to admin');
    console.log('   Phone:', user.phone);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

resetAdmin();