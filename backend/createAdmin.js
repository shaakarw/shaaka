// createAdmin.js
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();
const connectDB = require('./config/db');
const { closeDB } = connectDB;
const adminUserLimits = require('./config/adminUserLimits');

// Adjust path to your User model if needed
const User = require('./models/User');

const createAdmin = async () => {
  try {
    await connectDB();

    const phone = process.env.ADMIN_PHONE;
    const username = process.env.ADMIN_USERNAME || 'shaaka';
    const password = process.env.ADMIN_PASSWORD;
    if (!phone || !password) {
      throw new Error('ADMIN_PHONE and ADMIN_PASSWORD must be configured');
    }

    console.log('🔍 Checking for admin user with phone:', phone);

    let existing = await User.findOne({ phone });

    if (existing) {
      console.log('📌 User exists with ID:', existing._id);
      console.log('   Current role:', existing.role);

      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log('✅ User promoted to admin');
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

      Object.assign(existing, adminUserLimits);
      await existing.save();

      console.log('✅ Admin is ready – you can now log in with:');
      console.log(`   Phone: ${phone}`);
    } else {
      console.log('❌ Admin not found – creating new...');
      // ✅ Use a valid 16‑digit ID number
      const idNumber = '1234567890123456';

      const admin = await User.create({
        phone,
        username,
        idNumber: idNumber,          // Now 16 digits
        password,
        role: 'admin',
        ...adminUserLimits,
        name: 'Admin',
        avatar: '',
        location: 'Kigali, Rwanda',
        bio: 'System Administrator',
        email: '',
      });
      console.log('✅ Admin created with ID:', admin._id);
      console.log(`   Phone: ${phone}`);
    }

    await closeDB();
    console.log('👋 Done.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    // Print detailed validation errors
    if (err.name === 'ValidationError') {
      console.error('🔍 Validation details:');
      for (let field in err.errors) {
        console.error(`   - ${field}: ${err.errors[field].message}`);
      }
    }
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
};

createAdmin();