const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  variantId: String,
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  salePrice: Number,
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  attributes: {
    color: String,
    size: String,
    material: String
  },
  image: String,
  subtotal: { type: Number, required: true }
});

const paymentInfoSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: ['card', 'upi', 'netbanking', 'wallet', 'cod'],
    required: true
  },
  transactionId: String,
  paymentGateway: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  amount: Number,
  currency: { type: String, default: 'INR' },
  paidAt: Date,
  refundId: String,
  refundAmount: Number,
  refundedAt: Date
});

const shippingAddressSchema = new mongoose.Schema({
  name: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'India' },
  phoneNumber: String
});

const trackingSchema = new mongoose.Schema({
  carrier: String,
  trackingNumber: String,
  trackingUrl: String,
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception'],
    default: 'pending'
  },
  estimatedDelivery: Date,
  actualDelivery: Date,
  updates: [{
    status: String,
    location: String,
    timestamp: { type: Date, default: Date.now },
    description: String
  }]
});

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  items: [orderItemSchema],
  pricing: {
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending',
    index: true
  },
  shippingAddress: shippingAddressSchema,
  billingAddress: shippingAddressSchema,
  paymentInfo: paymentInfoSchema,
  tracking: trackingSchema,
  notes: String,
  customerNotes: String,
  conversationSessionId: String,
  source: {
    type: String,
    enum: ['web', 'mobile', 'chatbot', 'voice'],
    default: 'chatbot'
  },
  promotions: [{
    code: String,
    description: String,
    discountAmount: Number,
    discountType: { type: String, enum: ['percentage', 'fixed'] }
  }],
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String,
    updatedBy: String
  }],
  analytics: {
    conversionSource: String,
    sessionDuration: Number,
    touchpoints: [String]
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'paymentInfo.status': 1 });
orderSchema.index({ conversationSessionId: 1 });

// Pre-save middleware to generate orderId and calculate totals
orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
  }
  
  // Calculate pricing
  this.pricing.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.pricing.total = this.pricing.subtotal + this.pricing.tax + this.pricing.shippingCost - this.pricing.discount;
  
  // Add timeline entry for status changes
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      note: `Order status changed to ${this.status}`
    });
  }
  
  next();
});

// Methods
orderSchema.methods.updateStatus = function(newStatus, note = '', updatedBy = 'system') {
  this.status = newStatus;
  this.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || `Order status changed to ${newStatus}`,
    updatedBy
  });
  return this.save();
};

orderSchema.methods.addTrackingUpdate = function(updateData) {
  this.tracking.updates.push({
    ...updateData,
    timestamp: new Date()
  });
  
  if (updateData.status) {
    this.tracking.status = updateData.status;
  }
  
  return this.save();
};

orderSchema.methods.calculateTotal = function() {
  this.pricing.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  this.pricing.total = this.pricing.subtotal + this.pricing.tax + this.pricing.shippingCost - this.pricing.discount;
  return this.pricing.total;
};

// Static methods
orderSchema.statics.findByUserId = function(userId, limit = 20, skip = 0) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate('items.productId');
};

orderSchema.statics.findByStatus = function(status, limit = 50) {
  return this.find({ status })
    .sort({ createdAt: -1 })
    .limit(limit);
};

module.exports = mongoose.model('Order', orderSchema);
