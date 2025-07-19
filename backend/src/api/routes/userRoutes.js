const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validateUserRegistration, validateUserLogin } = require('../../utils/validation');
const User = require('../../models/User');

// Test endpoint to check if users exist in database
router.get('/test-users', async (req, res) => {
  try {
    const users = await User.find({}, 'email isActive createdAt');
    res.json({
      success: true,
      count: users.length,
      users: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
});

// POST /users/register - User registration
router.post('/register', validateUserRegistration, userController.register);

// POST /users/login - User login
router.post('/login', validateUserLogin, userController.login);

// GET /users/:userId/profile - Get user profile
router.get('/:userId/profile', userController.getUserProfile);

// PUT /users/:userId/preferences - Update user preferences
router.put('/:userId/preferences', userController.updatePreferences);

// POST /users/:userId/addresses - Add shipping address
router.post('/:userId/addresses', userController.addShippingAddress);

// GET /users/:userId/conversation-history - Get conversation history
router.get('/:userId/conversation-history', userController.getConversationHistory);

module.exports = router;
