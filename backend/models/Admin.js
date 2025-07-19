const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema({
  adminId: {
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
  role: {
    type: String,
    enum: ['super_admin', 'order_manager'],
    default: 'order_manager'
  },
  permissions: [{
    type: String,
    enum: ['view_orders', 'update_orders', 'cancel_orders', 'view_analytics']
  }],
  isActive: { type: Boolean, default: true },
  lastLogin: Date
}, {
  timestamps: true
});

// Password hashing middleware
adminSchema.pre('save', async function(next) {
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
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Set default permissions based on role
adminSchema.pre('save', function(next) {
  if (this.isModified('role') || this.isNew) {
    if (this.role === 'super_admin') {
      this.permissions = ['view_orders', 'update_orders', 'cancel_orders', 'view_analytics'];
    } else if (this.role === 'order_manager') {
      this.permissions = ['view_orders', 'update_orders'];
    }
  }
  next();
});

module.exports = mongoose.model('Admin', adminSchema);
