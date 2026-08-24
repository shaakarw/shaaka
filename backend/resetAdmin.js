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

    const user = await User.findOne({ phone: '0799882580' });
    if (!user) {
      console.log('❌ Admin user not found');
      process.exit(0);
    }

    user.password = await bcrypt.hash('1234', 10);
    user.role = 'admin';
    await user.save();

    console.log('✅ Password reset to "1234" and role set to admin');
    console.log('   Phone: 0799882580');
    console.log('   Password: 1234');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

resetAdmin();