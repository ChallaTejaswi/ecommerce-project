const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    default: () => 'session_' + Date.now()
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  messages: [{
    type: {
      type: String,
      enum: ['user', 'bot'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    metadata: {
      intent: String,
      confidence: Number,
      entities: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
      }
    }
  }],
  context: {
    currentIntent: String,
    previousQueries: [String],
    recommendedProducts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    }]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ChatSession', chatSessionSchema);
