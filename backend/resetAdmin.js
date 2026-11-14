// resetAdmin.js
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/db');
const { closeDB } = connectDB;
const adminUserLimits = require('./config/adminUserLimits');

const User = require('./models/User');

const resetAdmin = async () => {
  try {
    await connectDB();

    const phone = process.env.ADMIN_PHONE;
    const username = process.env.ADMIN_USERNAME || 'shaaka';
    const password = process.env.ADMIN_PASSWORD;
    if (!phone || !password) {
      throw new Error('ADMIN_PHONE and ADMIN_PASSWORD must be configured');
    }

    const user = await User.findOneAndUpdate(
      { phone },
      {
        username,
        password: await bcrypt.hash(password, 10),
        role: 'admin',
        ...adminUserLimits,
      },
      { new: true, runValidators: false }
    );
    if (!user) {
      console.log('❌ Admin user not found');
      process.exit(0);
    }

    console.log('✅ Admin password reset and role set to admin');
    console.log('   Phone:', user.phone);

    await closeDB();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

resetAdmin();