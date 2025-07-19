const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const conversationHistorySchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  intent: String,
  query: String,
  response: String,
  sentiment: String,
  confidence: Number,
  flowType: { type: String, enum: ['regular_ivr', 'ava_flow'], default: 'regular_ivr' }
});

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phoneNumber: {
    type: String,
    sparse: true
  },
  preferences: {
    language: { type: String, default: 'en' },
    categories: [String],
    brands: [String],
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 10000 }
    },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    voiceEnabled: { type: Boolean, default: false }
  },
  shippingAddresses: [{
    name: String,
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
    isDefault: { type: Boolean, default: false }
  }],
  conversationHistory: [conversationHistorySchema],
  purchaseHistory: [{
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    purchaseDate: { type: Date, default: Date.now },
    totalAmount: Number,
    items: [{
      productId: String,
      name: String,
      quantity: Number,
      price: Number
    }]
  }],
  analytics: {
    totalSessions: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    lifetimeValue: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    averageSessionDuration: { type: Number, default: 0 }
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ userId: 1 });
userSchema.index({ 'preferences.categories': 1 });
userSchema.index({ createdAt: -1 });

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to add conversation entry
userSchema.methods.addConversation = function(conversationData) {
  this.conversationHistory.push(conversationData);
  this.analytics.totalSessions += 1;
  this.analytics.lastActive = new Date();
  
  // Keep only last 100 conversations
  if (this.conversationHistory.length > 100) {
    this.conversationHistory = this.conversationHistory.slice(-100);
  }
};

// Method to update analytics
userSchema.methods.updateAnalytics = function(orderValue = 0) {
  if (orderValue > 0) {
    this.analytics.totalOrders += 1;
    this.analytics.lifetimeValue += orderValue;
  }
  this.analytics.lastActive = new Date();
};

module.exports = mongoose.model('User', userSchema);
