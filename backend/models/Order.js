const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  image: String,
  subtotal: { type: Number, required: true }
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

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    sparse: true // This allows multiple documents with null/undefined orderId
    // Remove index: true since unique already creates an index
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
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
    enum: ['order_placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
    default: 'order_placed',
    index: true
  },
  shippingAddress: shippingAddressSchema,
  paymentMethod: {
    type: String,
    enum: ['cod', 'card', 'upi', 'netbanking'],
    default: 'cod'
  },
  notes: String,
  estimatedDelivery: Date,
  timeline: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    note: String,
    updatedBy: { type: String, default: 'system' }
  }]
}, {
  timestamps: true
});

// Pre-save middleware to generate orderId and calculate totals
orderSchema.pre('save', function(next) {
  // Always generate orderId if not exists (even for existing docs)
  if (!this.orderId || this.orderId === null) {
    this.orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
    console.log('🆔 Generated new orderId:', this.orderId);
  }
  
  // Calculate pricing if items exist
  if (this.items && this.items.length > 0) {
    this.pricing.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.pricing.total = this.pricing.subtotal + this.pricing.tax + this.pricing.shippingCost - this.pricing.discount;
  }
  
  // Add timeline entry for status changes (only if status was modified and not new document)
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
      note: `Order status changed to ${this.status}`,
      updatedBy: this.updatedBy || 'system'
    });
  }
  
  next();
});

// Method to update status
orderSchema.methods.updateStatus = function(newStatus, note = '', updatedBy = 'admin') {
  this.status = newStatus;
  this.updatedBy = updatedBy;
  this.timeline.push({
    status: newStatus,
    timestamp: new Date(),
    note: note || `Order status changed to ${newStatus}`,
    updatedBy
  });
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema);
