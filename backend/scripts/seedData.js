const mongoose = require('mongoose');
const { Product, Category, Order } = require('../models');
require('dotenv').config();

const categories = [
  { name: 'Fashion', slug: 'fashion', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=400', description: 'Trendy clothing and accessories' },
  { name: 'Electronics', slug: 'electronics', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400', description: 'Latest gadgets and devices' },
  { name: 'Home & Kitchen', slug: 'home-kitchen', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400', description: 'Home essentials and kitchen items' },
  { name: 'Beauty & Personal Care', slug: 'beauty', image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400', description: 'Beauty and personal care products' },
  { name: 'Books', slug: 'books', image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400', description: 'Books and educational materials' },
  { name: 'Sports & Fitness', slug: 'sports-fitness', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400', description: 'Sports equipment and fitness gear' }
];

const products = [
  // Fashion
  { name: "Men's Denim Jacket", description: "Stylish blue denim jacket perfect for casual wear", price: 2499, category: 'Fashion', images: ['https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 50, tags: ['denim', 'jacket', 'men', 'casual'] },
  { name: "Women's Floral Dress", description: "Beautiful floral print dress for summer", price: 1899, category: 'Fashion', images: ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 30, tags: ['dress', 'women', 'floral', 'summer'] },

  // Electronics
  { name: 'Noise Cancelling Headphones', description: 'Premium wireless headphones with active noise cancellation', price: 7999, category: 'Electronics', images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 25, tags: ['headphones', 'wireless', 'audio'] },
  { name: 'Portable Bluetooth Speaker', description: 'Compact speaker with powerful sound', price: 3499, category: 'Electronics', images: ['https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 40, tags: ['speaker', 'bluetooth', 'portable'] },

  // Home & Kitchen
  { name: 'Espresso Coffee Machine', description: 'Professional grade espresso machine for home use', price: 12999, category: 'Home & Kitchen', images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 15, tags: ['coffee', 'machine', 'espresso'] },
  { name: 'Non-Stick Cookware Set', description: 'Complete cookware set with non-stick coating', price: 4599, category: 'Home & Kitchen', images: ['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 20, tags: ['cookware', 'kitchen', 'non-stick'] },

  // Beauty & Personal Care
  { name: 'Vitamin C Face Serum', description: 'Brightening vitamin C serum for glowing skin', price: 799, category: 'Beauty & Personal Care', images: ['https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 100, tags: ['serum', 'skincare', 'vitamin-c'] },
  { name: 'Electric Toothbrush', description: 'Advanced electric toothbrush with multiple modes', price: 2199, category: 'Beauty & Personal Care', images: ['https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 35, tags: ['toothbrush', 'dental', 'electric'] },
  { name: 'Manual Toothbrush Set', description: 'Pack of 4 soft bristle manual toothbrushes', price: 299, category: 'Beauty & Personal Care', images: ['https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 150, tags: ['toothbrush', 'manual', 'dental', 'pack'] },
  { name: 'Bamboo Toothbrush', description: 'Eco-friendly bamboo toothbrush with soft bristles', price: 149, category: 'Beauty & Personal Care', images: ['https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 200, tags: ['toothbrush', 'bamboo', 'eco-friendly', 'dental'] },
  { name: 'Kids Toothbrush Set', description: 'Colorful toothbrush set designed for children', price: 199, category: 'Beauty & Personal Care', images: ['https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 120, tags: ['toothbrush', 'kids', 'children', 'dental'] },

  // Books
  { name: '"The Midnight Library" - Matt Haig', description: 'A novel about life, hope and the endless possibilities', price: 349, category: 'Books', images: ['https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 80, tags: ['fiction', 'novel', 'bestseller'] },
  { name: '"Atomic Habits" - James Clear', description: 'An easy and proven way to build good habits', price: 499, category: 'Books', images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 60, tags: ['self-help', 'habits', 'productivity'] },

  // Sports & Fitness
  { name: 'Yoga Mat with Carry Strap', description: 'Non-slip yoga mat with convenient carry strap', price: 1299, category: 'Sports & Fitness', images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 45, tags: ['yoga', 'mat', 'fitness'] },
  { name: 'Adjustable Dumbbell Set', description: 'Space-saving adjustable dumbbells for home workouts', price: 6999, category: 'Sports & Fitness', images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 20, tags: ['dumbbells', 'weights', 'fitness'] },

  // Toys & Games
  { name: 'LEGO Star Wars Set', description: 'Build your favorite Star Wars scenes with this LEGO set', price: 8999, category: 'Toys & Games', images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 25, tags: ['lego', 'star-wars', 'building'] },
  { name: 'Catan Board Game', description: 'Strategic board game for 3-4 players', price: 2999, category: 'Toys & Games', images: ['https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 30, tags: ['board-game', 'strategy', 'family'] },

  // Groceries
  { name: 'Organic Olive Oil', description: 'Extra virgin organic olive oil from Italy', price: 650, category: 'Groceries', images: ['https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 120, tags: ['olive-oil', 'organic', 'cooking'] },
  { name: 'Assorted Nuts & Berries Mix', description: 'Healthy mix of premium nuts and dried berries', price: 450, category: 'Groceries', images: ['https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 90, tags: ['nuts', 'healthy', 'snacks'] },

  // Automotive
  { name: 'Digital Tire Pressure Gauge', description: 'Accurate digital gauge for tire pressure monitoring', price: 899, category: 'Automotive', images: ['https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 55, tags: ['automotive', 'gauge', 'tire'] },
  { name: 'Car Vacuum Cleaner', description: 'Portable vacuum cleaner designed for car interiors', price: 1599, category: 'Automotive', images: ['https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 40, tags: ['vacuum', 'car', 'cleaning'] },

  // Health & Wellness
  { name: 'Aromatherapy Oil Diffuser', description: 'Ultrasonic essential oil diffuser for relaxation', price: 1499, category: 'Health & Wellness', images: ['https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 65, tags: ['aromatherapy', 'diffuser', 'wellness'] },
  { name: 'Digital Weighing Scale', description: 'Smart digital scale with body composition analysis', price: 1199, category: 'Health & Wellness', images: ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 70, tags: ['scale', 'health', 'digital'] },

  // Jewelry
  { name: 'Sterling Silver Necklace', description: 'Elegant sterling silver chain necklace', price: 2999, category: 'Jewelry', images: ['https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 35, tags: ['necklace', 'silver', 'jewelry'] },
  { name: 'Minimalist Gold-Plated Earrings', description: 'Simple and elegant gold-plated stud earrings', price: 1299, category: 'Jewelry', images: ['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 50, tags: ['earrings', 'gold', 'minimalist'] },

  // Bags & Luggage
  { name: 'Anti-Theft Laptop Backpack', description: 'Secure backpack with anti-theft features and USB port', price: 2299, category: 'Bags & Luggage', images: ['https://images.unsplash.com/photo-1553062407-98eeb6e0e5c8?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 40, tags: ['backpack', 'laptop', 'anti-theft'] },
  { name: 'Hard-Shell Cabin Luggage', description: 'Durable hard-shell suitcase perfect for travel', price: 4999, category: 'Bags & Luggage', images: ['https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 25, tags: ['luggage', 'travel', 'suitcase'] },

  // Pet Supplies
  { name: 'Automatic Pet Feeder', description: 'Smart pet feeder with timer and portion control', price: 3999, category: 'Pet Supplies', images: ['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 30, tags: ['pet', 'feeder', 'automatic'] },
  { name: 'Interactive Cat Toy', description: 'Motion-activated toy to keep your cat entertained', price: 799, category: 'Pet Supplies', images: ['https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 85, tags: ['cat', 'toy', 'interactive'] },

  // Office Products
  { name: 'Ergonomic Office Chair', description: 'Comfortable office chair with lumbar support', price: 8999, category: 'Office Products', images: ['https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 15, tags: ['chair', 'office', 'ergonomic'] },
  { name: 'Wireless Keyboard and Mouse', description: 'Wireless combo set for efficient computing', price: 2499, category: 'Office Products', images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 45, tags: ['keyboard', 'mouse', 'wireless'] },

  // Musical Instruments
  { name: 'Acoustic Guitar Starter Kit', description: 'Complete beginner guitar kit with accessories', price: 5999, category: 'Musical Instruments', images: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 20, tags: ['guitar', 'acoustic', 'beginner'] },
  { name: 'Ukulele with Gig Bag', description: 'Beautiful soprano ukulele with carrying case', price: 2999, category: 'Musical Instruments', images: ['https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop'], inStock: true, stockQuantity: 25, tags: ['ukulele', 'music', 'portable'] }
];

// Sample orders for testing
const sampleOrders = [
  {
    orderId: 'ORD123456',
    userId: 'user123',
    userName: 'John Doe',
    userEmail: 'john@example.com',
    items: [
      { 
        productId: 'prod1', 
        name: 'Electric Toothbrush', 
        description: 'Advanced electric toothbrush',
        quantity: 1, 
        price: 2199,
        subtotal: 2199,
        image: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400'
      },
      { 
        productId: 'prod2', 
        name: 'Vitamin C Face Serum', 
        description: 'Brightening face serum',
        quantity: 2, 
        price: 799,
        subtotal: 1598,
        image: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400'
      }
    ],
    pricing: { 
      subtotal: 3797, 
      tax: 380, 
      shippingCost: 0,
      discount: 0,
      total: 4177 
    },
    status: 'shipped',
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    shippingAddress: {
      name: 'John Doe',
      street: '123 Main Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      zipCode: '400001',
      country: 'India',
      phoneNumber: '+91 9876543210'
    },
    paymentMethod: 'cod',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
  },
  {
    orderId: 'ORD789123',
    userId: 'user456',
    userName: 'Jane Smith',
    userEmail: 'jane@example.com',
    items: [
      { 
        productId: 'prod3', 
        name: 'Wireless Headphones', 
        description: 'Premium wireless headphones',
        quantity: 1, 
        price: 7999,
        subtotal: 7999,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400'
      }
    ],
    pricing: { 
      subtotal: 7999, 
      tax: 800, 
      shippingCost: 0,
      discount: 0,
      total: 8799 
    },
    status: 'delivered',
    estimatedDelivery: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // yesterday
    shippingAddress: {
      name: 'Jane Smith',
      street: '456 Oak Avenue',
      city: 'Delhi',
      state: 'Delhi',
      zipCode: '110001',
      country: 'India',
      phoneNumber: '+91 9876543211'
    },
    paymentMethod: 'card',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
  },
  {
    orderId: 'ORD456789',
    userId: 'user789',
    userName: 'Bob Johnson',
    userEmail: 'bob@example.com',
    items: [
      { 
        productId: 'prod4', 
        name: "Women's Floral Dress", 
        description: 'Beautiful floral print dress',
        quantity: 1, 
        price: 1899,
        subtotal: 1899,
        image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400'
      },
      { 
        productId: 'prod5', 
        name: 'Sterling Silver Necklace', 
        description: 'Elegant silver necklace',
        quantity: 1, 
        price: 2999,
        subtotal: 2999,
        image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400'
      }
    ],
    pricing: { 
      subtotal: 4898, 
      tax: 490, 
      shippingCost: 0,
      discount: 0,
      total: 5388 
    },
    status: 'confirmed',
    estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    shippingAddress: {
      name: 'Bob Johnson',
      street: '789 Pine Road',
      city: 'Bangalore',
      state: 'Karnataka',
      zipCode: '560001',
      country: 'India',
      phoneNumber: '+91 9876543212'
    },
    paymentMethod: 'upi',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // yesterday
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/meesho_shopping_assistant');
    
    console.log('🌱 Starting database seeding...');
    
    // Clear existing data
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    
    // Seed categories
    await Category.insertMany(categories);
    console.log('✅ Categories seeded');
    
    // Seed products
    await Product.insertMany(products);
    console.log('✅ Products seeded');
    
    // Seed sample orders
    await Order.insertMany(sampleOrders);
    console.log('✅ Sample orders seeded');
    
    console.log('🎉 Database seeding completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();
