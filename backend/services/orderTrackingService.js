// Enhanced Order Tracking Service
const Order = require('../models/Order');

class OrderTrackingService {

  // Track specific order by ID
  static async trackOrderById(orderId, languageCode = 'en') {
    try {
      console.log(`🔍 Searching for order: ${orderId}`);

      // Build search query - only include _id if it's a valid ObjectId format
      const searchQuery = {
        $or: [
          { orderId: orderId },
          { orderId: orderId.toUpperCase() }
        ]
      };

      // Only add _id search if the orderId looks like a valid MongoDB ObjectId
      if (/^[0-9a-fA-F]{24}$/.test(orderId)) {
        searchQuery.$or.push({ _id: orderId });
      }

      const order = await Order.findOne(searchQuery).lean();
      const { translate } = require('../src/utils/googleTranslate');

      if (!order) {
        let msg = `❌ Sorry, I couldn't find order ${orderId}. Please check your order ID and try again.`;
        if (languageCode && languageCode !== 'en') {
          try { msg = await translate(msg, 'en', languageCode); } catch {}
        }
        return { found: false, message: msg };
      }

      let details = this.formatOrderDetails(order);
      if (languageCode && languageCode !== 'en') {
        try { details = await translate(details, 'en', languageCode); } catch {}
      }
      return { found: true, order: order, message: details };

    } catch (error) {
      console.error('Order tracking error:', error);
      let msg = '❌ Sorry, I\'m having trouble tracking your order right now. Please try again later.';
      if (languageCode && languageCode !== 'en') {
        try {
          const { translate } = require('../src/utils/googleTranslate');
          msg = await translate(msg, 'en', languageCode);
        } catch {}
      }
      return { found: false, message: msg };
    }
  }

  // Get all orders for a user
  static async getUserOrders(userId, limit = 5, languageCode = 'en') {
    try {
      console.log(`📋 Fetching orders for user: ${userId}`);

      const orders = await Order.find({ userId })
        .sort({ createdAt: -1 }) // Most recent first
        .limit(limit)
        .lean();

      console.log(`📦 Found ${orders.length} orders for user ${userId}`);

      const { translate } = require('../src/utils/googleTranslate');

      if (orders.length === 0) {
        let msg = `📭 You don't have any orders yet! 

🛍 *Start Shopping:*
• Browse our products by saying "Show me dresses"
• Check out deals with "Find phones under 20000"
• Ask for recommendations!

Ready to find something amazing?`;
        if (languageCode && languageCode !== 'en') {
          try { msg = await translate(msg, 'en', languageCode); } catch {}
        }
        return { found: false, message: msg };
      }

      let details = this.formatMultipleOrders(orders);
      if (languageCode && languageCode !== 'en') {
        try { details = await translate(details, 'en', languageCode); } catch {}
      }
      return { found: true, orders: orders, message: details };

    } catch (error) {
      console.error('User orders fetch error:', error);
      let msg = `❌ Sorry, I'm having trouble accessing your order history right now.`;
      if (languageCode && languageCode !== 'en') {
        try {
          const { translate } = require('../src/utils/googleTranslate');
          msg = await translate(msg, 'en', languageCode);
        } catch {}
      }
      return { found: false, message: msg };
    }
  }

  // Format order details for a single order
  static formatOrderDetails(order) {
    const statusMessages = {
      'order_placed': '🟢 Your order has been placed!',
      'confirmed': '✅ Your order is confirmed.',
      'shipped': '🚚 Your order has been shipped.',
      'out_for_delivery': '🏃‍♂ Your order is out for delivery.',
      'delivered': '🎉 Your order has been delivered!',
      'cancelled': '❌ Your order was cancelled.'
    };

    const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const estimatedDelivery = order.estimatedDelivery
      ? new Date(order.estimatedDelivery).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'N/A';

    // Calculate days until delivery
    let deliveryInfo = '';
    if (order.estimatedDelivery && order.status !== 'delivered') {
      const daysUntilDelivery = Math.ceil((new Date(order.estimatedDelivery) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDelivery > 0) {
        deliveryInfo = `\n⏰ Expected in ${daysUntilDelivery} day${daysUntilDelivery > 1 ? 's' : ''}`;
      } else if (daysUntilDelivery === 0) {
        deliveryInfo = `\n⏰ Expected today!`;
      }
    }

    return `🔍 *Order Status for ${order.orderId}*

${statusMessages[order.status] || '📦 Order is being processed'}

📊 *Order Details:*
• Items: ${order.items?.length || 1} item${order.items?.length > 1 ? 's' : ''}
• Total: ₹${order.pricing?.total || order.total || 'N/A'}
• Status: ${order.status.replace(/_/g, ' ').toUpperCase()}
• Order Date: ${orderDate}
• Expected Delivery: ${estimatedDelivery}${deliveryInfo}
${order.trackingNumber ? `• Tracking Number: ${order.trackingNumber}` : ''}

${order.items && order.items.length > 0 ? 
  `📦 *Items Ordered:*\n${order.items.map(item => `• ${item.name} (Qty: ${item.quantity})`).join('\n')}` : 
  ''
}

${order.status === 'delivered' ? 
  '🎉 Thank you for shopping with Meesho! Hope you love your purchase!' : 
  '📱 Need help? Contact our support team anytime!'}
`;
  }

  // Format multiple orders summary
  static formatMultipleOrders(orders) {
    const summary = orders.map((order, index) => {
      const status = order.status.replace(/_/g, ' ').toUpperCase();
      const statusEmoji = this.getStatusEmoji(order.status);
      const orderDate = new Date(order.createdAt).toLocaleDateString('en-IN');

      return `${index + 1}. *${order.orderId}* ${statusEmoji}
   • Status: ${status}
   • Total: ₹${order.pricing?.total || order.total || 'N/A'}
   • Date: ${orderDate}
   • Items: ${order.items?.length || 1} item${order.items?.length > 1 ? 's' : ''}`;
    }).join('\n\n');

    return `📋 *Your Recent Orders* (${orders.length} orders)

${summary}

💡 *For detailed tracking:* Say "Track order [ORDER_ID]" (e.g., "Track order ${orders[0].orderId}")
🛍 *Need help?* Contact our support team anytime!`;
  }

  // Get status emoji
  static getStatusEmoji(status) {
    const emojiMap = {
      'order_placed': '📦',
      'confirmed': '✅',
      'shipped': '🚚',
      'out_for_delivery': '🏃‍♂',
      'delivered': '🎉',
      'cancelled': '❌'
    };
    return emojiMap[status] || '📦';
  }

  // Extract order ID from message (robust)
  static extractOrderId(message) {
    // Only match order IDs that start with ORD and have at least 6 digits/letters after
    const pattern = /\bORD[A-Z0-9]{6,}/i;
    const match = message.match(pattern);
    if (match && /^ORD[A-Z0-9]{6,}$/i.test(match[0])) {
      return match[0].toUpperCase();
    }
    return null;
  }

  // Determine if message is asking for general order history
  static isGeneralOrderQuery(message) {
    const generalPatterns = [
      /track.*my.*orders?/i,
      /show.*my.*orders?/i,
      /my.*order.*history/i,
      /all.*my.*orders?/i,
      /order.*status/i,
      /where.*are.*my.*orders?/i,
      /check.*orders?/i
    ];

    return generalPatterns.some(pattern => pattern.test(message));
  }
}

module.exports = OrderTrackingService;