const Order = require('../models/Order');
const logger = require('../utils/logger');

class OrderService {
  async getOrderById(orderId) {
    try {
      return await Order.findOne({ orderId });
    } catch (error) {
      logger.error('Get order by ID error:', error);
      throw error;
    }
  }

  async getOrdersByUserId(userId, limit = 20, skip = 0) {
    try {
      let orders = await Order.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      // Enrich each order's items with product images if missing
      const productService = require('./productService');
      for (const order of orders) {
        for (const item of order.items) {
          if (!item.image) {
            const product = await productService.getProductById(item.productId);
            if (product && product.images && product.images.length > 0) {
              item.image = product.images[0];
            }
          }
        }
      }
      return orders;
    } catch (error) {
      logger.error('Get orders by user ID error:', error);
      throw error;
    }
  }

  async createOrder(orderData) {
    try {
      const order = new Order(orderData);
      return await order.save();
    } catch (error) {
      logger.error('Create order error:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, status, note = '') {
    try {
      const order = await Order.findOne({ orderId });
      if (!order) {
        throw new Error('Order not found');
      }
      return await order.updateStatus(status, note);
    } catch (error) {
      logger.error('Update order status error:', error);
      throw error;
    }
  }
}

module.exports = new OrderService();
