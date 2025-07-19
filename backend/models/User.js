const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    trim: true
  },
  avatar: {
    type: String,
    default: ''
  },
  preferences: {
    categories: [String],
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 100000 }
    },
    language: { type: String, default: 'en' },
    voiceEnabled: { type: Boolean, default: true }
  },
  // ML-based conversation analytics
  conversationAnalytics: {
    totalInteractions: { type: Number, default: 0 },
    averageSentiment: { type: Number, default: 0 }, // -1 to 1
    preferredFlow: { type: String, enum: ['IVR', 'AVA', 'PRODUCT_SEARCH', 'ORDER_TRACKING', 'RECOMMENDATIONS'], default: 'IVR' },
    escalationHistory: [{
      date: { type: Date, default: Date.now },
      reason: String,
      resolved: { type: Boolean, default: false }
    }],
    searchHistory: [{
      query: String,
      intent: String,
      timestamp: { type: Date, default: Date.now },
      resultCount: Number
    }],
    languageUsage: [{
      language: String,
      count: { type: Number, default: 1 }
    }]
  },
  // Shopping behavior for ML recommendations
  shoppingBehavior: {
    viewedProducts: [{ 
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      viewedAt: { type: Date, default: Date.now },
      duration: Number // seconds
    }],
    searchedCategories: [String],
    averageOrderValue: { type: Number, default: 0 },
    purchaseFrequency: { type: String, enum: ['low', 'medium', 'high'], default: 'low' }
  },
  addresses: [{
    type: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    name: String,
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'India' },
    phone: String,
    isDefault: { type: Boolean, default: false }
  }],
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);
