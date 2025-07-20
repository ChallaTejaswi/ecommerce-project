const ivrFlowService = require('../../services/ivrFlowService');
const avaFlowService = require('../../services/avaFlowService');
const nlpService = require('../../services/nlpService');
const customerSupportService = require('../../services/customerSupportService');
const multiLayerRecommendationService = require('../../services/multiLayerRecommendationService');
const logger = require('../../utils/logger');
const { detectLanguage, translate } = require('../../utils/googleTranslate');

class DialogflowWebhookController {
  async handleWebhook(req, res) {
    try {
      const { queryResult, session, originalDetectIntentRequest } = req.body;
      const { intent, parameters, queryText, languageCode } = queryResult;
      const intentName = intent.displayName;

      console.log('👉 Received intent from Dialogflow:', intentName);

      // Detect user language
      let userLang = languageCode && languageCode !== 'und' ? languageCode : null;
      if (!userLang) {
        userLang = await detectLanguage(queryText) || 'en';
      }

      // Translate query to English if needed
      let translatedQuery = queryText;
      if (userLang !== 'en') {
        try {
          translatedQuery = await translate(queryText, userLang, 'en');
        } catch (err) {
          logger.error('Translation to English failed:', err);
        }
      }

      const sessionId = this.extractSessionId(session);
      const sentiment = await nlpService.analyzeSentiment(translatedQuery);
      const conversationContext = await this.getConversationContext(sessionId);
      const flowType = await this.determineFlowType(intentName, parameters, conversationContext, sentiment);

      let response;

      // 🎯 Handle recommendation intent here
      if (intentName.toLowerCase().includes('recommend')) {
        const userId = req.body.userId || parameters.userId || null;
        let recommendations = [];
        if (userId) {
          recommendations = await multiLayerRecommendationService.getRecommendations(userId, {
            cartProductIds: parameters.cartProductIds || [],
            sessionQueries: parameters.sessionQueries || []
          });
        }

        let fulfillmentText = 'Here are your personalized recommendations:';
        if (userLang !== 'en') {
          fulfillmentText = await translate(fulfillmentText, 'en', userLang);
        }

        const fulfillmentMessages = recommendations.map(product => ({
          card: {
            title: product.name,
            subtitle: `₹${product.price} - ${product.brand}`,
            imageUri: product.image,
            buttons: [
              { text: 'View', postback: `product_details_${product.id}` },
              { text: 'Add to Cart', postback: `add_to_cart_${product.id}` }
            ]
          }
        }));

        return res.json({ fulfillmentText, fulfillmentMessages, products: recommendations });
      }

      // 🎯 Otherwise, delegate to flow services
      if (flowType === 'ava_flow') {
        response = await avaFlowService.handleIntent(intentName, parameters, translatedQuery, sessionId, conversationContext, sentiment, userLang);
      } else {
        response = await ivrFlowService.handleIntent(intentName, parameters, translatedQuery, sessionId, conversationContext, userLang);
      }

      // Fallback if service didn’t handle intent
      if (!response || !response.fulfillmentText) {
        response = {
          fulfillmentText: "Sorry, I couldn't understand that request.",
          fulfillmentMessages: []
        };
      }

      // Translate response back if needed
      let fulfillmentText = response.fulfillmentText;
      if (userLang !== 'en' && fulfillmentText) {
        try {
          fulfillmentText = await translate(fulfillmentText, 'en', userLang);
        } catch (err) {
          logger.error('Failed to translate response to user language:', err);
        }
      }

      //await this.logConversation(sessionId, intentName, queryText, response, sentiment, flowType);

      // If response contains orders (for order history), send them as a structured array for frontend
      let orders = null;
      if (response.fulfillmentMessages) {
        const ordersMsg = response.fulfillmentMessages.find(msg => msg.type === 'orders_list');
        if (ordersMsg && Array.isArray(ordersMsg.orders)) {
          orders = ordersMsg.orders;
        }
      }

      res.json({
        fulfillmentText,
        fulfillmentMessages: response.fulfillmentMessages || [],
        products: response.products || null,
        orders: orders // structured orders array for chat window
      });

    } catch (err) {
      logger.error('Webhook error:', err);
      res.json({
        fulfillmentText: "I apologize, but I'm experiencing technical difficulties. Please try again."
      });
    }
  }

  // 🩷 Voice webhook (optional)
  async handleVoiceWebhook(req, res) {
    try {
      const response = await this.handleWebhook(req, res);
      if (response?.fulfillmentText) {
        response.fulfillmentText = `<speak>${response.fulfillmentText}</speak>`;
      }
      return response;
    } catch (err) {
      logger.error('Voice webhook error:', err);
      res.json({
        fulfillmentText: "<speak>Sorry, I'm having trouble with voice processing at the moment.</speak>"
      });
    }
  }

  extractSessionId(session) {
    return session.split('/').pop();
  }

  async getConversationContext(sessionId) {
    return {
      conversationLength: 3,
      failureCount: 0,
      uniqueIntents: ['greeting', 'product.search'],
      lastIntent: 'product.search',
      userPreferences: {}
    };
  }

  async determineFlowType(intentName, parameters, context, sentiment) {
    const avaTriggers = ['support.escalate', 'complaint.complex', 'order.dispute', 'payment.issue'];
    if (avaTriggers.includes(intentName) || ['very_negative', 'negative'].includes(sentiment) || context.failureCount >= 2 || this.calculateComplexityScore(parameters, context) > 7) {
      return 'ava_flow';
    }
    return 'regular_ivr';
  }

  calculateComplexityScore(parameters, context) {
    let score = Object.keys(parameters).length;
    score += Math.min(context.conversationLength || 0, 5);
    score += (context.uniqueIntents?.length || 0);
    return score;
  }

  async logConversation(sessionId, intentName, query, response, sentiment, flowType) {
    try {
      logger.info('Conversation log:', {
        sessionId,
        intentName,
        query,
        responseType: response.fulfillmentText ? 'text' : 'rich',
        sentiment,
        flowType,
        timestamp: new Date()
      });
    } catch (err) {
      logger.error('Failed to log conversation:', err);
    }
  }

  healthCheck(req, res) {
    res.json({
      status: 'healthy',
      service: 'dialogflow-webhook',
      timestamp: new Date().toISOString(),
      flows: {
        regular_ivr: 'active',
        ava_flow: 'active'
      }
    });
  }
}

module.exports = new DialogflowWebhookController();