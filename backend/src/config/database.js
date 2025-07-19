const mongoose = require('mongoose');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.connection = null;
  }

  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/meesho_shopping_assistant';
      
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 15000, // Match working settings
        socketTimeoutMS: 45000,
        connectTimeoutMS: 15000,
        family: 4, // Force IPv4
        retryWrites: true,
        w: 'majority'
      };

      this.connection = await mongoose.connect(mongoUri, options);
      
      logger.info('✅ MongoDB connected successfully');
      
      // Connection event listeners
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
      });

    } catch (error) {
      logger.error('❌ MongoDB connection failed:', error.message);
      process.exit(1);
    }
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed');
    } catch (error) {
      logger.error('Error closing MongoDB connection:', error);
    }
  }

  getConnection() {
    return this.connection;
  }
}

module.exports = new Database();
