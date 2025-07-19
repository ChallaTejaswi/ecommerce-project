const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticateToken, authRateLimit } = require('../middleware/auth');

// Apply rate limiting to auth endpoints
router.use(authRateLimit);

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', AuthController.register);

// @route   POST /api/auth/login  
// @desc    Login user
// @access  Public
router.post('/login', AuthController.login);

// @route   GET /api/auth/profile
// @desc    Get current user profile with ML analytics
// @access  Private
router.get('/profile', authenticateToken, AuthController.getProfile);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, AuthController.updateProfile);

// @route   POST /api/auth/logout
// @desc    Logout user  
// @access  Private
router.post('/logout', authenticateToken, AuthController.logout);

// @route   GET /api/auth/verify
// @desc    Verify JWT token
// @access  Private
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user,
      userId: req.userId
    }
  });
});

module.exports = router;
