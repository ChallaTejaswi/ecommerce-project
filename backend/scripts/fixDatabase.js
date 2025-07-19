const mongoose = require('mongoose');
require('dotenv').config();

const fixDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/meesho_shopping_assistant');
    
    console.log('🔧 Fixing database issues...');
    
    // Drop the problematic index
    try {
      await mongoose.connection.db.collection('orders').dropIndex('orderID_1');
      console.log('✅ Dropped old orderID index');
    } catch (error) {
      console.log('⚠️  Index orderID_1 not found (this is fine)');
    }
    
    // Delete documents with null orderId
    const result = await mongoose.connection.db.collection('orders').deleteMany({
      $or: [
        { orderId: null },
        { orderId: { $exists: false } }
      ]
    });
    console.log(`🗑️  Deleted ${result.deletedCount} documents with null orderId`);
    
    // Create new sparse unique index
    try {
      await mongoose.connection.db.collection('orders').createIndex(
        { orderId: 1 }, 
        { unique: true, sparse: true }
      );
      console.log('✅ Created new sparse unique index for orderId');
    } catch (error) {
      console.log('⚠️  Index already exists:', error.message);
    }
    
    console.log('✅ Database fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database fix error:', error);
    process.exit(1);
  }
};

fixDatabase();
