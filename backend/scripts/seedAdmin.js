const mongoose = require('mongoose');
const Admin = require('../models/Admin');

async function seedAdmin() {
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/meesho';
await mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

  const email = 'admin@meesho.com';
  const password = 'admin123456';
  const adminId = 'ADMIN001';

  let admin = await Admin.findOne({ email });
  if (!admin) {
    admin = new Admin({
      adminId,
      email,
      name: 'Super Admin',
      password,
      role: 'super_admin',
      isActive: true
    });
    await admin.save();
    console.log('✅ Test admin seeded!');
  } else {
    console.log('ℹ️ Admin already exists.');
  }
  mongoose.disconnect();
}

seedAdmin().catch(console.error);
