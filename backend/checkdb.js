const mongoose = require('mongoose');
require('dotenv').config();
const Product = require('./models/Product');
const Order = require('./models/Order');

async function checkProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('🔍 All products in database:');
    const products = await Product.find({}, 'name category price').limit(10);
    products.forEach((product, index) => {
      console.log(`  ${index + 1}. ${product.name} (${product.category}) - ₹${product.price}`);
    });
    
    console.log('\n🔍 Products with "dress" in name or category:');
    const dresses = await Product.find({ 
      $or: [
        { name: { $regex: 'dress', $options: 'i' } },
        { category: { $regex: 'dress', $options: 'i' } },
        { category: { $regex: 'fashion', $options: 'i' } }
      ]
    });
    console.log(`Found: ${dresses.length} dress/fashion products`);
    dresses.forEach(dress => {
      console.log(`  - ${dress.name} (${dress.category})`);
    });
    
    console.log('\n🔍 Products with "phone" in name:');
    const phones = await Product.find({ 
      $or: [
        { name: { $regex: 'phone', $options: 'i' } },
        { category: { $regex: 'phone', $options: 'i' } },
        { category: { $regex: 'electronics', $options: 'i' } }
      ]
    });
    console.log(`Found: ${phones.length} phone/electronics products`);
    phones.forEach(phone => {
      console.log(`  - ${phone.name} (${phone.category}) - ₹${phone.price}`);
    });
    
    console.log('\n📦 Orders in database:');
    const orders = await Order.find({}, 'orderId status userId pricing.total createdAt').limit(10);
    console.log(`Found: ${orders.length} orders`);
    orders.forEach((order, index) => {
      const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN');
      console.log(`  ${index + 1}. ${order.orderId} - ${order.status} - ₹${order.pricing?.total || 'N/A'} - ${orderDate} (User: ${order.userId})`);
    });
    
    console.log('\n🔍 All categories in database:');
    const categories = await Product.distinct('category');
    console.log('Categories:', categories.join(', '));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}


checkProducts();
