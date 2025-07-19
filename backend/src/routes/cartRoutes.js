const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cartController');
const { authenticateToken } = require('../middleware/auth');

// All cart routes require authentication
router.use(authenticateToken);

// @route   GET /api/cart
// @desc    Get user's cart with ML recommendations
// @access  Private
router.get('/', CartController.getCart);

// @route   POST /api/cart/add
// @desc    Add item to cart with ML tracking
// @access  Private
router.post('/add', CartController.addToCart);

// @route   DELETE /api/cart/remove/:productId
// @desc    Remove item from cart
// @access  Private
router.delete('/remove/:productId', CartController.removeFromCart);

// @route   PUT /api/cart/update/:productId
// @desc    Update item quantity in cart
// @access  Private
router.put('/update/:productId', CartController.updateQuantity);

// @route   DELETE /api/cart/clear
// @desc    Clear entire cart
// @access  Private
router.delete('/clear', CartController.clearCart);

// @route   GET /api/cart/recommendations
// @desc    Get ML-powered recommendations for user
// @access  Private
router.get('/recommendations', CartController.getRecommendations);

module.exports = router;
