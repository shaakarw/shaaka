// createAdmin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

// Adjust path to your User model if needed
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your_database_name';

const createAdmin = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const phone = '0799882580';
    const password = '1234';

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

      const isMatch = await bcrypt.compare(password, existing.password);
      if (!isMatch) {
        existing.password = await bcrypt.hash(password, 10);
        await existing.save();
        console.log('🔑 Password reset to "1234"');
      }

      console.log('✅ Admin is ready – you can now log in with:');
      console.log(`   Phone: ${phone}`);
      console.log(`   Password: ${password}`);
    } else {
      console.log('❌ Admin not found – creating new...');
      const hashed = await bcrypt.hash(password, 10);
      // ✅ Use a valid 16‑digit ID number
      const idNumber = '1234567890123456';

      const admin = await User.create({
        phone,
        username: 'Admin',
        idNumber: idNumber,          // Now 16 digits
        password: hashed,
        role: 'admin',
        name: 'Admin',
        avatar: '',
        location: 'Kigali, Rwanda',
        bio: 'System Administrator',
        email: '',
      });
      console.log('✅ Admin created with ID:', admin._id);
      console.log(`   Phone: ${phone}`);
      console.log(`   Password: ${password}`);
    }

    await mongoose.disconnect();
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