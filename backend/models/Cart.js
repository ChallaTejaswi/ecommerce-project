const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: String,
  price: Number,
  images: [String],
  category: String,
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  // ML-based analytics for cart items
  addedVia: {
    type: String,
    enum: ['chat', 'search', 'recommendation', 'manual', 'browse', 'frontend_sync', 'ml_recommendation'],
    default: 'manual'
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  chatInteractionId: String, // Track which chat led to this addition
  mlRecommendationScore: Number // ML confidence score if added via recommendation
});

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  totalItems: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  // ML-based cart analytics
  cartAnalytics: {
    averageItemPrice: { type: Number, default: 0 },
    mostAddedCategory: String,
    chatDrivenItems: { type: Number, default: 0 }, // Items added via chat
    recommendationDrivenItems: { type: Number, default: 0 }, // Items added via ML recommendations
    conversionSources: [{
      source: String, // 'chat', 'search', 'recommendation'
      count: { type: Number, default: 1 }
    }],
    lastActivity: { type: Date, default: Date.now },
    abandonmentRisk: { type: String, enum: ['low', 'medium', 'high'], default: 'low' }
  },
  // Session tracking for ML
  sessionData: {
    createdAt: { type: Date, default: Date.now },
    lastUpdated: { type: Date, default: Date.now },
    timeSpent: { type: Number, default: 0 }, // seconds
    interactions: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Calculate totals before saving
cartSchema.pre('save', function(next) {
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  
  // Update cart analytics
  if (this.items.length > 0) {
    this.cartAnalytics.averageItemPrice = this.totalAmount / this.totalItems;
    
    // Find most added category
    const categoryCount = {};
    this.items.forEach(item => {
      if (item.category) {
        categoryCount[item.category] = (categoryCount[item.category] || 0) + item.quantity;
      }
    });
    
    if (Object.keys(categoryCount).length > 0) {
      this.cartAnalytics.mostAddedCategory = Object.keys(categoryCount).reduce((a, b) => 
        categoryCount[a] > categoryCount[b] ? a : b);
    }
    
    // Count items by source
    this.cartAnalytics.chatDrivenItems = this.items.filter(item => item.addedVia === 'chat').length;
    this.cartAnalytics.recommendationDrivenItems = this.items.filter(item => item.addedVia === 'recommendation').length;
    
    // Update session data
    this.sessionData.lastUpdated = new Date();
    this.sessionData.interactions += 1;
  }
  
  this.cartAnalytics.lastActivity = new Date();
  next();
});

// Static method to get cart with populated products
cartSchema.statics.getCartWithProducts = async function(userId) {
  return this.findOne({ userId }).populate('items.productId', 'name price images category rating inStock');
};

module.exports = mongoose.model('Cart', cartSchema);
