const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const admin = await Admin.findOne({ email, isActive: true });
    
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { 
        adminId: admin.adminId,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      },
      process.env.JWT_SECRET || 'meesho_super_secret_jwt_key_2024',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      admin: {
        adminId: admin.adminId,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Middleware to verify admin token
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'meesho_super_secret_jwt_key_2024');
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid admin token' });
  }
};

// Get all orders for admin
router.get('/orders', verifyAdminToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    
    let query = {};
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Search by order ID or user email
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalOrders = await Order.countDocuments(query);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNext: page < Math.ceil(totalOrders / limit),
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Admin orders fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    });
  }
});

// Update order status
router.put('/orders/:orderId/status', verifyAdminToken, async (req, res) => {
  try {
    const { status, note } = req.body;
    
    const validStatuses = ['order_placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const order = await Order.findOne({ orderId: req.params.orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    await order.updateStatus(status, note || `Status updated by admin: ${req.admin.email}`, req.admin.email);

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        orderId: order.orderId,
        status: order.status,
        timeline: order.timeline
      }
    });

  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });
  }
});

// Get order analytics
router.get('/analytics', verifyAdminToken, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderId userEmail status pricing.total createdAt');

    const totalRevenue = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } }
    ]);

    res.json({
      success: true,
      analytics: {
        totalOrders,
        ordersByStatus: ordersByStatus.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        recentOrders,
        totalRevenue: totalRevenue[0]?.total || 0
      }
    });

  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
});

module.exports = router;
