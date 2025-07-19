const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { validateCreateOrder, validateOrderStatus } = require('../../utils/validation');

// POST /orders - Create new order
router.post('/', validateCreateOrder, orderController.createOrder);

// GET /orders/:orderId - Get specific order details
router.get('/:orderId', orderController.getOrderById);

// GET /orders/:orderId/status - Get order status
router.get('/:orderId/status', orderController.getOrderStatus);

// GET /users/:userId/orders - Get user's orders
router.get('/users/:userId/orders', orderController.getUserOrders);

// PUT /orders/:orderId/status - Update order status
router.put('/:orderId/status', validateOrderStatus, orderController.updateOrderStatus);

// POST /orders/:orderId/tracking - Add tracking update
router.post('/:orderId/tracking', orderController.addTrackingUpdate);

module.exports = router;
