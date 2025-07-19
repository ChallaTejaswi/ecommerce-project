const jwt = require('jsonwebtoken');
const User = require('../../models/User');

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'meesho_ml_assistant_secret_key_2025';

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId, timestamp: Date.now() },
    JWT_SECRET,
    { expiresIn: '7d' } // 7 days expiration
  );
};

// Verify JWT Token Middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add user to request object
    req.user = user;
    req.userId = user._id.toString();
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Optional Authentication (for chat without requiring login)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user) {
        req.user = user;
        req.userId = user._id.toString();
      }
    }
    
    // Continue regardless of authentication status
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

// Rate limiting for authentication endpoints
const rateLimit = require('express-rate-limit');

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  authRateLimit,
  JWT_SECRET
};
