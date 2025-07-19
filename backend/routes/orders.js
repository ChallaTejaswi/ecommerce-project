const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');

// Real JWT authentication middleware
const authenticateUser = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'meesho_super_secret_jwt_key_2024');
    console.log('🪪 Decoded JWT payload:', decoded);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      name: decoded.name
    };
    console.log('🔐 Authenticated user:', req.user);
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Create new order (checkout)
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, notes } = req.body;
    
    console.log('📦 Creating new order:', {
      userId: req.user.userId,
      itemCount: items?.length,
      paymentMethod
    });
    
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Order must contain at least one item'
      });
    }

    // Validate required shipping address fields
    if (!shippingAddress.name || !shippingAddress.street || !shippingAddress.city) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required shipping address fields'
      });
    }

    // Calculate item subtotals
    const processedItems = items.map(item => ({
      productId: item.productId || item.id,
      name: item.name,
      price: Number(item.price),
      quantity: Number(item.quantity || 1),
      image: item.image || '',
      subtotal: Number(item.price) * Number(item.quantity || 1)
    }));

    const subtotal = processedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = Math.round(subtotal * 0.18); // 18% GST
    const shippingCost = subtotal > 500 ? 0 : 50; // Free shipping above ₹500
    const total = subtotal + tax + shippingCost;

    // Generate unique orderId
    const orderId = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();

    // If name/email missing in req.user, fetch from DB
    let userEmail = req.user.email;
    let userName = req.user.name;
    if (!userEmail || !userName) {
      const userDoc = await require('../models/User').findById(req.user.userId);
      if (userDoc) {
        userEmail = userDoc.email;
        userName = userDoc.name;
      }
    }

    const orderData = {
      orderId: orderId,
      userId: req.user.userId,
      userEmail,
      userName,
      items: processedItems,
      pricing: {
        subtotal,
        tax,
        shippingCost,
        discount: 0,
        total
      },
      shippingAddress: {
        name: shippingAddress.name,
        street: shippingAddress.street,
        city: shippingAddress.city,
        state: shippingAddress.state,
        zipCode: shippingAddress.zipCode,
        country: 'India',
        phoneNumber: shippingAddress.phoneNumber
      },
      paymentMethod: paymentMethod || 'cod',
      notes: notes || '',
      estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'order_placed',
      timeline: [{
        status: 'order_placed',
        timestamp: new Date(),
        note: 'Order placed successfully',
        updatedBy: 'customer'
      }]
    };

    const order = new Order(orderData);
    const savedOrder = await order.save();
    
    console.log('✅ Order created successfully:', savedOrder.orderId);

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        orderId: savedOrder.orderId,
        total: savedOrder.pricing.total,
        status: savedOrder.status,
        estimatedDelivery: savedOrder.estimatedDelivery
      }
    });

  } catch (error) {
    console.error('❌ Order creation error:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Order ID conflict. Please try again.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create order. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user's orders
router.get('/', authenticateUser, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(`📋 Fetching orders for user: ${req.user.userId}, found: ${orders.length}`);

    res.json({
      success: true,
      orders: orders.map(order => ({
        orderId: order.orderId,
        items: order.items,
        total: order.pricing.total,
        status: order.status,
        createdAt: order.createdAt,
        estimatedDelivery: order.estimatedDelivery
      }))
    });

  } catch (error) {
    console.error('❌ Orders fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Track specific order
router.get('/:orderId', async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log(`🔍 Tracking order: ${req.params.orderId}`);

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        status: order.status,
        items: order.items,
        pricing: order.pricing,
        shippingAddress: order.shippingAddress,
        timeline: order.timeline,
        estimatedDelivery: order.estimatedDelivery,
        createdAt: order.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track order'
    });
  }
});

module.exports = router;
