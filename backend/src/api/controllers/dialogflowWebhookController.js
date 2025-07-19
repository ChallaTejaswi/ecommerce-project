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

      // 1. Detect user language (prefer frontend, else auto-detect)
      let userLang = languageCode && languageCode !== 'und' ? languageCode : null;
      if (!userLang) {
        userLang = await detectLanguage(queryText);
      }
      if (!userLang) userLang = 'en';

      // 2. Translate user input to English if needed
      let translatedQuery = queryText;
      console.log('🟢 [DF] About to call translate:', { queryText, userLang });
      if (userLang !== 'en') {
        try {
          translatedQuery = await translate(queryText, userLang, 'en');
        } catch (err) {
          logger.error('Translation to English failed, using original:', err);
          translatedQuery = queryText;
        }
      }
      console.log('🟢 [DF] Finished translate:', translatedQuery);

      // Extract session ID
      const sessionId = this.extractSessionId(session);

      // Analyze sentiment and context (use translated query for intent/sentiment)
      const sentiment = await nlpService.analyzeSentiment(translatedQuery);
      const conversationContext = await this.getConversationContext(sessionId);

      // Determine flow type based on complexity and context
      const flowType = await this.determineFlowType(
        intentName,
        parameters,
        conversationContext,
        sentiment
      );

      let response;

      // Recommendation intent handling
      if (intentName && intentName.toLowerCase().includes('recommend')) {
        // Get userId from request if available
        const userId = req.body.userId || parameters.userId || null;
        let recommendations = [];
        if (userId) {
          recommendations = await multiLayerRecommendationService.getRecommendations(userId, {
            cartProductIds: parameters.cartProductIds || [],
            sessionQueries: parameters.sessionQueries || []
          });
        }
        // Format as product cards for frontend
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
        let fulfillmentText = 'Here are your personalized recommendations:';
        // Translate response if needed
        if (userLang && userLang !== 'en' && fulfillmentText) {
          try {
            fulfillmentText = await translate(fulfillmentText, 'en', userLang);
          } catch (err) {
            logger.error('Translation to user language failed, using English:', err);
          }
        }
        res.json({
          fulfillmentText,
          fulfillmentMessages,
          products: recommendations
        });
        return;
      }

      if (flowType === 'ava_flow') {
        // Handle with Advanced Virtual Agent
        console.log('🟢 [DF] About to call avaFlowService.handleIntent');
        response = await avaFlowService.handleIntent(
          intentName,
          parameters,
          translatedQuery,
          sessionId,
          conversationContext,
          sentiment,
          userLang
        );
        console.log('🟢 [DF] Finished avaFlowService.handleIntent');
      } else {
        // Handle with Regular IVR Flow
        console.log('🟢 [DF] About to call ivrFlowService.handleIntent');
        response = await ivrFlowService.handleIntent(
          intentName,
          parameters,
          translatedQuery,
          sessionId,
          conversationContext,
          userLang
        );
        console.log('🟢 [DF] Finished ivrFlowService.handleIntent');
      }

      // 3. Translate bot response back to user's language if needed
      let fulfillmentText = response.fulfillmentText;
      console.log('🟢 [DF] About to call translate for response:', { fulfillmentText, userLang });
      if (userLang && userLang !== 'en' && fulfillmentText) {
        try {
          fulfillmentText = await translate(fulfillmentText, 'en', userLang);
        } catch (err) {
          logger.error('Translation to user language failed, using English:', err);
        }
      }
      console.log('🟢 [DF] Finished translate for response:', fulfillmentText);

      // Log conversation
      await this.logConversation(sessionId, intentName, queryText, response, sentiment, flowType);

      // --- BEGIN: Add products array for frontend chatbot if recommendations are present ---
      let products = null;
      // Check if the response contains recommendation cards in fulfillmentMessages
      if (response.fulfillmentMessages && Array.isArray(response.fulfillmentMessages)) {
        // Find card messages
        const cards = response.fulfillmentMessages.filter(msg => msg.card);
        if (cards.length > 0) {
          products = cards.map(cardMsg => {
            const card = cardMsg.card;
            // Try to extract productId from postback or fallback to title
            let productId = null;
            if (card.buttons && Array.isArray(card.buttons)) {
              const viewBtn = card.buttons.find(btn => btn.postback && btn.postback.startsWith('product_details_'));
              if (viewBtn) {
                productId = viewBtn.postback.replace('product_details_', '');
              }
            }
            return {
              id: productId || card.title,
              name: card.title,
              price: card.subtitle ? card.subtitle.split(' ')[0].replace('₹','') : '',
              image: card.imageUri,
              brand: card.subtitle && card.subtitle.includes('-') ? card.subtitle.split('-').slice(1).join('-').trim() : '',
            };
          });
        }
      }
      // --- END: Add products array for frontend chatbot ---

      console.log('🟢 [DF] About to send response');
      // Truncate fulfillmentText to 256 chars
      if (fulfillmentText && fulfillmentText.length > 256) {
        fulfillmentText = fulfillmentText.slice(0, 253) + '...';
      }
      // Truncate card fields in fulfillmentMessages
      let fulfillmentMessages = response.fulfillmentMessages || [];
      if (Array.isArray(fulfillmentMessages)) {
        fulfillmentMessages.forEach(msg => {
          if (msg.card) {
            if (msg.card.title && msg.card.title.length > 256)
              msg.card.title = msg.card.title.slice(0, 253) + '...';
            if (msg.card.subtitle && msg.card.subtitle.length > 256)
              msg.card.subtitle = msg.card.subtitle.slice(0, 253) + '...';
            if (Array.isArray(msg.card.buttons)) {
              msg.card.buttons.forEach(btn => {
                if (btn.text && btn.text.length > 256)
                  btn.text = btn.text.slice(0, 253) + '...';
              });
            }
          }
        });
      }
      // Minimal response for debugging
      res.json({
        fulfillmentText,
        fulfillmentMessages,
        products
      });

    } catch (error) {
      logger.error('Webhook error:', error);
      res.json({
        fulfillmentText: 'I apologize, but I\'m experiencing technical difficulties. Please try again in a moment.'
      });
    }
  }

  async handleVoiceWebhook(req, res) {
    try {
      const response = await this.handleWebhook(req, res);
      
      // Add SSML for voice responses
      if (response.fulfillmentText) {
        response.fulfillmentText = `<speak>${response.fulfillmentText}</speak>`;
      }

      return response;
    } catch (error) {
      logger.error('Voice webhook error:', error);
      res.json({
        fulfillmentText: '<speak>I apologize, but I\'m having trouble with voice processing right now.</speak>'
      });
    }
  }

  async determineFlowType(intentName, parameters, context, sentiment) {
    // Escalation triggers for AVA flow
    const avaFlowTriggers = [
      'support.escalate',
      'complaint.complex',
      'order.dispute',
      'payment.issue'
    ];

    // Check for explicit AVA triggers
    if (avaFlowTriggers.includes(intentName)) {
      return 'ava_flow';
    }

    // Check for negative sentiment patterns
    if (sentiment === 'very_negative' || sentiment === 'negative') {
      return 'ava_flow';
    }

    // Check for repeated failures in context
    if (context.failureCount >= 2) {
      return 'ava_flow';
    }

    // Check for complex parameters or multi-intent queries
    const complexityScore = this.calculateComplexityScore(parameters, context);
    if (complexityScore > 7) {
      return 'ava_flow';
    }

    return 'regular_ivr';
  }

  calculateComplexityScore(parameters, context) {
    let score = 0;
    
    // Count number of parameters
    score += Object.keys(parameters).length;
    
    // Add score for conversation length
    score += Math.min(context.conversationLength || 0, 5);
    
    // Add score for multiple intents in session
    score += (context.uniqueIntents?.length || 0);
    
    return score;
  }

  extractSessionId(session) {
    const sessionParts = session.split('/');
    return sessionParts[sessionParts.length - 1];
  }

  async getConversationContext(sessionId) {
    // This would fetch from user conversation history
    // For now, return mock context
    return {
      conversationLength: 3,
      failureCount: 0,
      uniqueIntents: ['greeting', 'product.search'],
      lastIntent: 'product.search',
      userPreferences: {}
    };
  }

  async logConversation(sessionId, intent, query, response, sentiment, flowType) {
    try {
      // Log conversation data
      logger.info('Conversation logged:', {
        sessionId,
        intent,
        query: query.substring(0, 100),
        responseType: response.fulfillmentText ? 'text' : 'rich',
        sentiment,
        flowType,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to log conversation:', error);
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
