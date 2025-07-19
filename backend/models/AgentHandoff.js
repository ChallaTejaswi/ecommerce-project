const mongoose = require('mongoose');

const agentHandoffSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  
  // Escalation details
  escalationReason: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['complaint', 'order_issue', 'product_issue', 'billing', 'technical', 'other'],
    required: true
  },
  
  // ML Analysis data
  mlAnalysis: {
    sentimentScore: Number, // -1 to 1
    escalationScore: Number, // 0 to 10
    urgencyLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    detectedEmotions: [String], // ['frustration', 'anger', 'disappointment']
    conversationComplexity: {
      type: String,
      enum: ['simple', 'moderate', 'complex'],
      default: 'moderate'
    },
    recommendedAgent: String, // 'senior', 'technical', 'billing', 'general'
  },
  
  // Conversation history
  conversationHistory: [{
    message: String,
    sender: { type: String, enum: ['user', 'bot'] },
    timestamp: { type: Date, default: Date.now },
    sentiment: String,
    intent: String
  }],
  
  // Current status
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'resolved', 'closed'],
    default: 'pending'
  },
  assignedAgent: {
    agentId: String,
    agentName: String,
    assignedAt: Date,
    department: String
  },
  
  // Resolution details
  resolution: {
    resolvedAt: Date,
    resolvedBy: String,
    resolutionNotes: String,
    customerSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    },
    resolutionTime: Number // minutes
  },
  
  // Follow-up
  followUp: {
    required: { type: Boolean, default: false },
    scheduledAt: Date,
    completed: { type: Boolean, default: false },
    notes: String
  },
  
  // System metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    sessionId: String,
    referrerPage: String,
    deviceType: String
  }
}, {
  timestamps: true
});

// Generate ticket ID before saving
agentHandoffSchema.pre('save', function(next) {
  if (!this.ticketId) {
    this.ticketId = 'TKT' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  next();
});

// Calculate resolution time when resolving
agentHandoffSchema.methods.resolve = function(resolvedBy, resolutionNotes, satisfaction) {
  this.status = 'resolved';
  this.resolution.resolvedAt = new Date();
  this.resolution.resolvedBy = resolvedBy;
  this.resolution.resolutionNotes = resolutionNotes;
  this.resolution.customerSatisfaction = satisfaction;
  
  // Calculate resolution time in minutes
  this.resolution.resolutionTime = Math.round(
    (this.resolution.resolvedAt - this.createdAt) / (1000 * 60)
  );
  
  return this.save();
};

// Static method to get priority queue
agentHandoffSchema.statics.getPriorityQueue = function() {
  return this.find({ 
    status: { $in: ['pending', 'assigned'] } 
  }).sort({ 
    priority: -1, // critical, high, medium, low
    'mlAnalysis.escalationScore': -1, 
    createdAt: 1 
  });
};

module.exports = mongoose.model('AgentHandoff', agentHandoffSchema);
