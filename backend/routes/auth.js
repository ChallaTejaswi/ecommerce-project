const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const router = express.Router();

// Generate JWT token with userId, name, and email
const generateToken = (user) => {
  // Ensure name and email are present, fallback to empty string if missing
  const name = user.name || (user.get && user.get('name')) || '';
  const email = user.email || (user.get && user.get('email')) || '';
  const payload = {
    userId: user._id ? String(user._id) : '',
    name,
    email
  };
  console.log('🔒 JWT payload before signing:', payload);
  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'meesho_super_secret_jwt_key_2024',
    { expiresIn: '7d' }
  );
};

// Register new user
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new user
    const user = new User({ name, email, password });
    await user.save();

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during signup'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }


    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Debug: print user object before token generation (login)
    console.log('🧑‍💻 User object before token (login):', user);
    // Ensure plain object for JWT generation
    const userObj = (typeof user.toObject === 'function') ? user.toObject() : user;
    // Debug: print userObj before token generation
    console.log('🧑‍💻 userObj for JWT:', userObj);
    // Generate JWT token
    const token = generateToken(userObj);
    // Debug: print the generated JWT and its decoded payload
    console.log('🔑 Generated JWT:', token);
    try {
      const decoded = jwt.decode(token);
      console.log('🪪 Decoded JWT payload (login):', decoded);
    } catch (err) {
      console.error('❌ Error decoding JWT:', err);
    }

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'meesho_secret_key');
    console.log('🪪 /me decoded JWT:', decoded);
    const user = await User.findById(decoded.userId);
    console.log('🧑‍💻 /me user from DB:', user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences,
        addresses: user.addresses
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});


module.exports = router;
