const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing MongoDB connection...');
  console.log('📋 MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not Set');
  
  if (!process.env.MONGODB_URI) {
    console.log('❌ MONGODB_URI environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('🔄 Attempting connection with extended timeout...');
    
    const connection = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000, // 15 seconds
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });

    console.log('✅ Connection successful!');
    console.log('🏠 Host:', connection.connection.host);
    console.log('📊 Database:', connection.connection.name);
    console.log('🔌 Ready State:', connection.connection.readyState);

    // Test a simple query
    console.log('🔍 Testing database query...');
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📁 Found ${collections.length} collections`);
    collections.forEach(col => console.log(`   - ${col.name}`));

    await mongoose.disconnect();
    console.log('✅ Test completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('🔧 Error type:', error.name);
    
    if (error.message.includes('ETIMEOUT')) {
      console.log('\n🚨 Network Timeout Solutions:');
      console.log('1. Check your internet connection');
      console.log('2. Verify MongoDB Atlas cluster is running');
      console.log('3. Add your IP to Atlas whitelist (0.0.0.0/0 for development)');
      console.log('4. Check if corporate firewall blocks MongoDB ports');
      console.log('5. Try using a VPN if on restricted network');
    }
    
    process.exit(1);
  }
}

testConnection();
