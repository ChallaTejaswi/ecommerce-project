const axios = require('axios');
const productService = require('./productService');
const orderService = require('./orderService');
const recommendationService = require('./recommendationService');
const logger = require('../utils/logger');
const { translate } = require('../utils/googleTranslate');

class IVRFlowService {
  /**
   * Extracts a product keyword from a given query using an external ML service.
   * @param {string} query - The input query string.
   * @returns {Promise<string>} The extracted product keyword or an empty string if not found/error.
   */
  async extractProductKeyword(query) {
    if (!query || typeof query !== 'string') return '';
    try {
      // Assuming the ML service extracts the most relevant keyword
      const { data } = await axios.post('http://127.0.0.1:5005/extract', { query });
      if (data.matches && data.matches.length > 0) {
        return data.matches[0][0]; // Assuming the first match's first element is the keyword
      }
      return '';
    } catch (err) {
      logger.error(`ML keyword extractor error: ${err.message}`, err); // Corrected string interpolation and error logging
      return '';
    }
  }

  /**
   * Handles an incoming intent by routing it to the appropriate logic and translating responses if needed.
   * @param {string} intentName - The name of the detected intent.
   * @param {object} parameters - Parameters extracted from the intent.
   * @param {string} queryText - The original query text from the user.
   * @param {string} sessionId - The unique session ID for the conversation.
   * @param {object} context - The current conversation context.
   * @param {string} languageCode - The target language code for translation (defaults to 'en').
   * @returns {Promise<object>} The fulfillment response object.
   */
  async handleIntent(intentName, parameters, queryText, sessionId, context, languageCode = 'en') {
    logger.info(`IVR Flow handling intent: ${intentName}`); // Corrected string interpolation

    const response = await this._handleIntentLogic(intentName, parameters, queryText, sessionId, context, languageCode);

    // Translate fulfillmentText if the target language is not English
    if (response?.fulfillmentText && languageCode !== 'en') {
      try {
        response.fulfillmentText = await translate(response.fulfillmentText, 'en', languageCode);
      } catch (err) {
        logger.error(`IVRFlowService translation error for fulfillmentText: ${err.message}`, err);
      }
    }

    // 🪄 Translate fulfillmentMessages too (restored comprehensive translation logic)
    if (response.fulfillmentMessages?.length && languageCode !== 'en') {
      for (const message of response.fulfillmentMessages) {
        if (message.quickReplies) {
          try {
            message.quickReplies.title = await translate(message.quickReplies.title, 'en', languageCode);
            message.quickReplies.quickReplies = await Promise.all(
              message.quickReplies.quickReplies.map(async (text) => await translate(text, 'en', languageCode))
            );
          } catch (err) {
            logger.error(`IVRFlowService translation error for quickReplies: ${err.message}`, err);
          }
        }

        if (message.card) {
          try {
            message.card.title = await translate(message.card.title, 'en', languageCode);
            message.card.subtitle = await translate(message.card.subtitle, 'en', languageCode);
            if (message.card.buttons) {
              for (const btn of message.card.buttons) {
                btn.text = await translate(btn.text, 'en', languageCode);
              }
            }
          } catch (err) {
            logger.error(`IVRFlowService translation error for card: ${err.message}`, err);
          }
        }

        if (message.text?.text?.length) {
          try {
            message.text.text = await Promise.all(
              message.text.text.map(async (t) => await translate(t, 'en', languageCode))
            );
          } catch (err) {
            logger.error(`IVRFlowService translation error for text message: ${err.message}`, err);
          }
        }
      }
    }

    return response;
  }

  /**
   * Internal method to handle the core logic for each intent.
   * @param {string} intentName - The name of the detected intent.
   * @param {object} parameters - Parameters extracted from the intent.
   * @param {string} queryText - The original query text from the user.
   * @param {string} sessionId - The unique session ID for the conversation.
   * @param {object} context - The current conversation context.
   * @param {string} languageCode - The target language code for translation.
   * @returns {Promise<object>} The fulfillment response object.
   */
  async _handleIntentLogic(intentName, parameters, queryText, sessionId, context, languageCode) {
    switch (intentName) {
      case 'Default Welcome Intent':
        return await this.handleWelcome(languageCode); // Added await

      case 'product.search':
        return await this.handleProductSearch(parameters, queryText, languageCode); // Added await

      case 'order.status':
        return await this.handleOrderStatus(parameters, languageCode); // Added await

      case 'product.recommendation':
        return await this.handleProductRecommendation(parameters, sessionId, languageCode); // Added await

      case 'order.place':
        return await this.handleOrderPlacement(parameters, languageCode); // Added await

      case 'customer_support':
      case 'help':
        return await this.handleCustomerSupport(languageCode); // Added await

      case 'Default Fallback Intent':
        return await this.handleFallback(languageCode); // Added await

      default:
        return await this.handleUnknownIntent(intentName, languageCode); // Added await
    }
  }

  /**
   * Handles the 'Default Welcome Intent'.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleWelcome(languageCode) {
    let text = "Hello! Welcome to Meesho! I'm here to help you find great products and manage your orders. How can I assist you today?";
    let title = 'How can I help?';
    let quickReplies = ['Find products', 'Track my order', 'Get recommendations', 'Customer support'];

    if (languageCode !== 'en') {
      text = await translate(text, 'en', languageCode);
      title = await translate(title, 'en', languageCode);
      quickReplies = await Promise.all(quickReplies.map(qr => translate(qr, 'en', languageCode)));
    }

    return {
      fulfillmentText: text,
      fulfillmentMessages: [{
        quickReplies: {
          title: title,
          quickReplies: quickReplies
        }
      }]
    };
  }

  /**
   * Handles the 'product.search' intent.
   * @param {object} parameters - Parameters including productName or product.
   * @param {string} queryText - The original query text.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleProductSearch(parameters, queryText, languageCode) {
    let productQuery = parameters.productName; // Prefer parameter-extracted name
    let translatedQueryForML = queryText;

    // Translate query for ML model if not English, to ensure the ML model receives an English query
    if (languageCode !== 'en' && queryText) {
      try {
        translatedQueryForML = await translate(queryText, languageCode, 'en');
      } catch (err) {
        logger.warn(`Failed to translate query for ML: ${err.message}. Using original query.`);
        translatedQueryForML = queryText; // Fallback to original if translation fails
      }
    }

    // If productName parameter is not present, try extracting from the translated query
    if (!productQuery && translatedQueryForML) {
      productQuery = await this.extractProductKeyword(translatedQueryForML);
    }

    // Fallback to original queryText if no specific productQuery is found
    if (!productQuery) {
        productQuery = queryText;
    }


    try {
      const result = await productService.searchProducts({ query: productQuery, limit: 5 });

      if (!result.products || result.products.length === 0) {
        let text = `I couldn't find products matching "${productQuery}". Want to see popular items or search differently?`;
        if (languageCode !== 'en') text = await translate(text, 'en', languageCode);
        return { fulfillmentText: text };
      }

      const cards = await Promise.all(result.products.map(async p => { // Translate card elements
        let title = p.name;
        let subtitle = `₹${p.salePrice || p.price}`; // Use salePrice if available
        let viewButtonText = 'View';
        let addToCartButtonText = 'Add to Cart'; // Added Add to Cart button

        if (languageCode !== 'en') {
          title = await translate(title, 'en', languageCode);
          // Subtitle is price, usually not translated, but could be formatted for locale if needed.
          viewButtonText = await translate(viewButtonText, 'en', languageCode);
          addToCartButtonText = await translate(addToCartButtonText, 'en', languageCode);
        }

        return {
          card: {
            title: title,
            subtitle: subtitle,
            imageUri: p.images?.[0],
            buttons: [
              { text: viewButtonText, postback: `view_product_${p.productId}` },
              { text: addToCartButtonText, postback: `add_to_cart_${p.productId}` } // Corrected postback for add to cart
            ]
          }
        };
      }));

      let fulfillmentText = `Here are some products matching "${productQuery}":`;
      if (languageCode !== 'en') fulfillmentText = await translate(fulfillmentText, 'en', languageCode);

      return {
        fulfillmentText: fulfillmentText,
        fulfillmentMessages: cards
      };

    } catch (err) {
      logger.error(`Product search error: ${err.message}`, err);
      let text = "I'm unable to search products right now. Please try again later.";
      if (languageCode !== 'en') text = await translate(text, 'en', languageCode);
      return { fulfillmentText: text };
    }
  }

  /**
   * Handles the 'order.status' intent.
   * @param {object} parameters - Parameters including orderId.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleOrderStatus({ orderId }, languageCode) {
    let msg;
    if (!orderId) {
      msg = "Please provide your order ID so I can check its status.";
      if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
      return { fulfillmentText: msg };
    }

    const order = await orderService.getOrderById(orderId);
    if (!order) {
      msg = `I couldn't find an order with ID "${orderId}".`;
      if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
      return { fulfillmentText: msg };
    }

    // Enrich items with images if missing
    const productService = require('./productService');
    for (const item of order.items) {
      if (!item.image) {
        const product = await productService.getProductById(item.productId);
        if (product && product.images && product.images.length > 0) {
          item.image = product.images[0];
        }
      }
    }

    // Build structured order details for chat window
    const orderDetails = {
      orderId: order.orderId,
      status: order.status,
      pricing: order.pricing,
      items: order.items,
      estimatedDelivery: order.estimatedDelivery,
      createdAt: order.createdAt,
      trackingNumber: order.tracking?.trackingNumber || null
    };

    msg = `Your order ${orderId} is currently ${order.status}.`;
    if (order.tracking?.trackingNumber) {
      msg += ` Tracking number: ${order.tracking.trackingNumber}.`;
    }
    if (order.tracking?.estimatedDelivery) {
      const deliveryDate = new Date(order.tracking.estimatedDelivery).toLocaleDateString(languageCode);
      msg += ` Estimated delivery: ${deliveryDate}.`;
    }
    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);

    return {
      fulfillmentText: msg,
      fulfillmentMessages: [
        { type: 'order_details', order: orderDetails }
      ],
      orderDetails
    };
  }

  /**
   * Handles the 'product.recommendation' intent.
   * @param {object} parameters - Parameters for recommendations.
   * @param {string} sessionId - The session ID for personalized recommendations.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleProductRecommendation(parameters, sessionId, languageCode) {
    const recommendations = await recommendationService.getPersonalizedRecommendations(sessionId, parameters);
    if (!recommendations || recommendations.length === 0) { // Added null/undefined check
      let text = "Couldn't find personalized recommendations. Want to browse popular categories?";
      if (languageCode !== 'en') text = await translate(text, 'en', languageCode);
      return { fulfillmentText: text };
    }

    const cards = await Promise.all(recommendations.slice(0, 3).map(async p => { // Translate card elements
      let title = p.name;
      let subtitle = `₹${p.salePrice || p.price}`;
      let viewButtonText = 'View';
      let addToCartButtonText = 'Add to Cart'; // Added Add to Cart button

      if (languageCode !== 'en') {
        title = await translate(title, 'en', languageCode);
        viewButtonText = await translate(viewButtonText, 'en', languageCode);
        addToCartButtonText = await translate(addToCartButtonText, 'en', languageCode);
      }

      return {
        card: {
          title: title,
          subtitle: subtitle,
          imageUri: p.images?.[0],
          buttons: [
            { text: viewButtonText, postback: `product_details_${p.productId}` }, // Corrected postback
            { text: addToCartButtonText, postback: `add_to_cart_${p.productId}` } // Corrected postback for add to cart
          ]
        }
      };
    }));

    let fulfillmentText = "Here are some products I recommend:";
    if (languageCode !== 'en') fulfillmentText = await translate(fulfillmentText, 'en', languageCode);

    return {
      fulfillmentText: fulfillmentText,
      fulfillmentMessages: cards
    };
  }

  /**
   * Handles the 'order.place' intent.
   * This is a simplified example; actual order placement would involve
   * more complex logic (e.g., checking inventory, user authentication, payment).
   * @param {object} parameters - Parameters including productId and quantity.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleOrderPlacement({ productId, quantity = 1 }, languageCode) {
    let msg;
    if (!productId) {
      msg = "Please specify which product you'd like to order.";
    } else {
      const product = await productService.getProductById(productId);

      if (!product || !product.inventory?.inStock) {
        msg = "That product is unavailable or out of stock. Want to see similar items?";
      } else {
        // In a real scenario, you'd integrate with an actual order creation API
        // const order = await orderService.createOrder({ productId, quantity });
        const total = (product.salePrice || product.price) * quantity;
        msg = `Added ${quantity} ${product.name} to your cart. Total: ₹${total.toFixed(2)}. Ready to checkout?`;
      }
    }

    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
    return { fulfillmentText: msg };
  }

  /**
   * Handles 'customer_support' and 'help' intents.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleCustomerSupport(languageCode) {
    let msg = "I've notified our support team. If you'd like to talk to a human right away, type 'Talk to human'.";
    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
    return { fulfillmentText: msg };
  }

  /**
   * Handles the 'Default Fallback Intent'.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleFallback(languageCode) {
    let msg = "I didn't quite understand that. Try asking about products, orders, or support.";
    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
    return { fulfillmentText: msg };
  }

  /**
   * Handles an unknown intent.
   * @param {string} intentName - The name of the unknown intent.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleUnknownIntent(intentName, languageCode) {
    logger.warn(`Unknown intent: ${intentName}`); // Corrected string interpolation
    let msg = "I'm still learning how to handle that. Can I help you with something else?";
    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
    return { fulfillmentText: msg };
  }
}

module.exports = new IVRFlowService();