const mongoose = require('mongoose');
const Admin = require('../models/Admin');
require('dotenv').config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/meesho_shopping_assistant');
    
    console.log('🔧 Creating default admin account...');
    
    // Create default admin
    const admin = new Admin({
      adminId: 'admin_001',
      email: 'admin@meesho.com',
      name: 'Meesho Admin',
      password: 'admin123456',
      role: 'super_admin'
    });

    await admin.save();
    
    console.log('✅ Default admin created successfully!');
    console.log('📧 Email: admin@meesho.com');
    console.log('🔑 Password: admin123456');
    console.log('⚠️  Please change the password after first login');
    
    process.exit(0);
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️  Admin already exists');
    } else {
      console.error('❌ Admin creation error:', error);
    }
    process.exit(1);
  }
};

createAdmin();
