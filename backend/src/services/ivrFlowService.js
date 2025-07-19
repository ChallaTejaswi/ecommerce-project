const axios = require('axios');
// Helper: Call Python ML microservice for product keyword extraction
async function extractProductKeyword(query) {
  if (!query || typeof query !== 'string') return '';
  try {
    const { data } = await axios.post('http://127.0.0.1:5005/extract', { query });
    if (data.matches && data.matches.length > 0) {
      return data.matches[0][0]; // best match
    }
    return '';
  } catch (err) {
    logger.error('ML keyword extractor error:', err.message);
    return '';
  }
}
const productService = require('./productService');
const orderService = require('./orderService');
const recommendationService = require('./recommendationService');
const logger = require('../utils/logger');
const { translate } = require('../utils/googleTranslate');

class IVRFlowService {
  async handleIntent(intentName, parameters, queryText, sessionId, context, languageCode = 'en') {
    logger.info(`IVR Flow handling intent: ${intentName}`);

    let response = await this._handleIntentLogic(intentName, parameters, queryText, sessionId, context);

    // Translate fulfillmentText if needed
    if (response && response.fulfillmentText && languageCode && languageCode !== 'en') {
      try {
        response.fulfillmentText = await translate(response.fulfillmentText, 'en', languageCode);
      } catch (err) {
        // Log but fallback to English
        console.error('IVRFlowService translation error:', err);
      }
    }
    return response;
  }

  async _handleIntentLogic(intentName, parameters, queryText, sessionId, context) {
    switch (intentName) {
      case 'Default Welcome Intent':
        return this.handleWelcome(sessionId);
      
      case 'product.search':
        return this.handleProductSearch(parameters, sessionId);
      
      case 'order.status':
        return this.handleOrderStatus(parameters, sessionId);
      
      case 'product.recommendation':
        return this.handleProductRecommendation(parameters, sessionId);
      
      case 'order.place':
        return this.handleOrderPlacement(parameters, sessionId);
      
      case 'customer_support':
      case 'help':
        return this.handleCustomerSupport(sessionId);
      
      case 'Default Fallback Intent':
        return this.handleFallback(queryText, context);
      
      default:
        return this.handleUnknownIntent(intentName);
    }
  }

  async handleWelcome(sessionId) {
    const quickReplies = [
      'Find products',
      'Track my order',
      'Get recommendations',
      'Customer support'
    ];

    return {
      fulfillmentText: 'Hello! Welcome to Meesho! I\'m here to help you find great products and manage your orders. How can I assist you today?',
      fulfillmentMessages: [{
        quickReplies: {
          title: 'How can I help?',
          quickReplies: quickReplies
        }
      }]
    };
  }

  async handleProductSearch(parameters, sessionId) {
    try {
      // Step 1: Translate queryText to English if needed
      let originalQuery = parameters.queryText;
      let userLang = parameters.languageCode || 'en';
      let translatedQuery = originalQuery;
      if (userLang && userLang !== 'en' && originalQuery) {
        try {
          translatedQuery = await translate(originalQuery, userLang, 'en');
          logger.info(`[IVR] Translated queryText to English: ${translatedQuery}`);
        } catch (err) {
          logger.error('[IVR] Translation to English failed:', err);
          translatedQuery = originalQuery;
        }
      }

      // Step 2: Extract product keyword from translated query
      let productQuery = parameters.productName;
      if (!productQuery || typeof productQuery !== 'string' || !productQuery.trim() || ['product', 'products', 'item', 'items'].includes(productQuery.toLowerCase())) {
        productQuery = parameters.product;
      }
      if (!productQuery || typeof productQuery !== 'string' || !productQuery.trim() || ['product', 'products', 'item', 'items'].includes(productQuery?.toLowerCase())) {
        // Use ML microservice for keyword extraction on translated query
        if (translatedQuery) {
          productQuery = await extractProductKeyword(translatedQuery);
          logger.info(`[IVR] Extracted product keyword from translated query: ${productQuery}`);
        } else {
          productQuery = '';
        }
      }

      // Step 3: Fallback mapping for common Indian language product terms
      const productTermMap = {
        // Telugu
        'దుస్తులు': 'dress',
        'చొక్కా': 'shirt',
        'ప్యాంటు': 'pants',
        'జుట్టు': 'hair',
        // Hindi
        'कपड़े': 'dress',
        'शर्ट': 'shirt',
        'पैंट': 'pants',
        'जूते': 'shoes',
        // Add more as needed
      };
      if (!productQuery || ['product', 'products', 'item', 'items'].includes(productQuery.toLowerCase())) {
        for (const [native, english] of Object.entries(productTermMap)) {
          if (originalQuery && originalQuery.includes(native)) {
            productQuery = english;
            logger.info(`[IVR] Used fallback mapping for product term: ${productQuery}`);
            break;
          }
        }
      }

      logger.info('[IVR] Final search term sent to DB:', productQuery);
      const { category, color, priceRange } = parameters;
      const searchParams = {
        query: productQuery,
        category: category,
        color: color,
        min_price: priceRange?.min,
        max_price: priceRange?.max,
        limit: 5
      };
      const result = await productService.searchProducts(searchParams);
      if (result.products.length === 0) {
        return {
          fulfillmentText: `I couldn't find any products matching "${productQuery || 'your criteria'}". Would you like me to suggest some popular items or try a different search?`,
          fulfillmentMessages: [{
            quickReplies: {
              title: 'Try these options:',
              quickReplies: ['Show popular items', 'Try different search', 'Get recommendations']
            }
          }]
        };
      }
      const productCards = result.products.map(product => ({
        card: {
          title: product.name,
          subtitle: `₹${product.salePrice || product.price}`,
          imageUri: product.images[0],
          buttons: [
            { text: 'View', postback: `view_product_${product.productId}` },
            { text: 'Add to Cart', postback: `add_to_cart_${product.productId}` }
          ]
        }
      }));
      return {
        fulfillmentText: `Here are some products matching "${productQuery}":`,
        fulfillmentMessages: productCards
      };
    } catch (error) {
      logger.error('Product search error:', error);
      return {
        fulfillmentText: 'I\'m having trouble searching for products right now. Please try again later.'
      };
    }
  }

  async handleOrderStatus(parameters, sessionId) {
    try {
      const { orderId } = parameters;
      
      if (!orderId) {
        return {
          fulfillmentText: 'Please provide your order ID so I can check the status for you. You can find it in your order confirmation email.'
        };
      }

      const order = await orderService.getOrderById(orderId);
      
      if (!order) {
        return {
          fulfillmentText: `I couldn't find an order with ID "${orderId}". Please check the order ID and try again, or contact customer support for assistance.`
        };
      }

      let statusMessage = `Your order ${orderId} is currently ${order.status}.`;
      
      if (order.tracking?.trackingNumber) {
        statusMessage += ` Tracking number: ${order.tracking.trackingNumber}`;
      }
      
      if (order.tracking?.estimatedDelivery) {
        const deliveryDate = new Date(order.tracking.estimatedDelivery).toLocaleDateString();
        statusMessage += ` Estimated delivery: ${deliveryDate}`;
      }

      const quickReplies = ['Track package', 'Order details', 'Contact support'];

      return {
        fulfillmentText: statusMessage,
        fulfillmentMessages: [{
          quickReplies: {
            title: 'What would you like to do?',
            quickReplies: quickReplies
          }
        }]
      };

    } catch (error) {
      logger.error('Order status error in IVR flow:', error);
      return {
        fulfillmentText: 'I\'m having trouble checking order status right now. Please try again later or contact customer support.'
      };
    }
  }

  async handleProductRecommendation(parameters, sessionId) {
    try {
      const recommendations = await recommendationService.getPersonalizedRecommendations(sessionId, parameters);
      
      if (recommendations.length === 0) {
        return {
          fulfillmentText: 'Let me show you some popular products instead!',
          fulfillmentMessages: [{
            quickReplies: {
              title: 'Browse categories:',
              quickReplies: ['Fashion', 'Electronics', 'Home & Kitchen', 'Beauty']
            }
          }]
        };
      }

      const recommendationCards = recommendations.slice(0, 3).map(product => ({
        card: {
          title: product.name,
          subtitle: `₹${product.salePrice || product.price} - ${product.brand}`,
          imageUri: product.images[0] || '',
          buttons: [
            {
              text: 'View Product',
              postback: `product_details_${product.productId}`
            },
            {
              text: 'Add to Cart',
              postback: `add_to_cart_${product.productId}`
            }
          ]
        }
      }));

      return {
        fulfillmentText: 'Based on your preferences, here are some products I recommend:',
        fulfillmentMessages: recommendationCards
      };

    } catch (error) {
      logger.error('Recommendation error in IVR flow:', error);
      return {
        fulfillmentText: 'I\'m having trouble getting recommendations right now. Let me show you some popular categories instead.',
        fulfillmentMessages: [{
          quickReplies: {
            title: 'Popular categories:',
            quickReplies: ['Fashion', 'Electronics', 'Home & Kitchen', 'Beauty']
          }
        }]
      };
    }
  }

  async handleOrderPlacement(parameters, sessionId) {
    try {
      const { productId, quantity = 1, color, size } = parameters;
      
      if (!productId) {
        return {
          fulfillmentText: 'Please specify which product you\'d like to order. You can search for products or browse our categories.'
        };
      }

      const product = await productService.getProductById(productId);
      
      if (!product) {
        return {
          fulfillmentText: 'I couldn\'t find that product. Please try searching again or browse our product categories.'
        };
      }

      if (!product.inventory.inStock || product.inventory.quantity < quantity) {
        return {
          fulfillmentText: `Sorry, ${product.name} is currently out of stock. Would you like me to show you similar products?`,
          fulfillmentMessages: [{
            quickReplies: {
              title: 'Options:',
              quickReplies: ['Show similar products', 'Notify when available', 'Browse categories']
            }
          }]
        };
      }

      const total = (product.salePrice || product.price) * quantity;
      
      return {
        fulfillmentText: `Great choice! I've added ${quantity} ${product.name} to your cart. Total: ₹${total.toFixed(2)}. Would you like to proceed to checkout or continue shopping?`,
        fulfillmentMessages: [{
          quickReplies: {
            title: 'Next steps:',
            quickReplies: ['Proceed to checkout', 'Continue shopping', 'View cart']
          }
        }]
      };

    } catch (error) {
      logger.error('Order placement error in IVR flow:', error);
      return {
        fulfillmentText: 'I\'m having trouble processing your order right now. Please try again later or contact customer support.'
      };
    }
  }

  async handleCustomerSupport(sessionId) {
    return {
      fulfillmentText: "Thank you for reaching out! We have notified our administration about your request. Our support team will get in touch with you soon if needed. If you have a specific issue (like returns, refunds, or order problems), please mention it, or type 'Talk to human' to connect with a support agent.",
      fulfillmentMessages: [{
        quickReplies: {
          title: 'Support options:',
          quickReplies: [
            'Return an item',
            'Refund status',
            'Order issue',
            'Talk to human',
            'Contact support'
          ]
        }
      }]
    };
  }

  async handleFallback(queryText, context) {
    const fallbackResponses = [
      'I didn\'t quite understand that. Could you please rephrase your question?',
      'I\'m not sure how to help with that. Try asking about products, orders, or recommendations.',
      'Let me help you find what you\'re looking for. You can search for products, check order status, or ask for recommendations.'
    ];

    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

    return {
      fulfillmentText: randomResponse,
      fulfillmentMessages: [{
        quickReplies: {
          title: 'I can help you with:',
          quickReplies: ['Find products', 'Track orders', 'Get recommendations', 'Contact support']
        }
      }]
    };
  }

  async handleUnknownIntent(intentName) {
    logger.warn(`Unknown intent in IVR flow: ${intentName}`);
    
    return {
      fulfillmentText: 'I\'m still learning how to handle that request. Is there something else I can help you with?',
      fulfillmentMessages: [{
        quickReplies: {
          title: 'Try these options:',
          quickReplies: ['Search products', 'Check order status', 'Get help', 'Talk to human']
        }
      }]
    };
  }
}

module.exports = new IVRFlowService();
