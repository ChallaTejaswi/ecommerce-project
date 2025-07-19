// Helper: Extract likely product keyword from query
function extractProductKeyword(query) {
  if (!query || typeof query !== 'string') return '';
  // Remove common generic words
  const genericWords = ['product', 'products', 'item', 'items', 'thing', 'things'];
  let cleaned = query.toLowerCase();
  for (const word of genericWords) {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  }
  // Remove extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // If cleaned is empty, fallback to original query
  return cleaned.length > 0 ? cleaned : query;
}
const productService = require('./productService');
const orderService = require('./orderService');
const customerSupportService = require('./customerSupportService');
const nlpService = require('./nlpService');
const logger = require('../utils/logger');
const { translate } = require('../utils/googleTranslate');

class AVAFlowService {
  async handleIntent(intentName, parameters, queryText, sessionId, context, sentiment, languageCode = 'en') {
    logger.info(`AVA Flow handling intent: ${intentName} with sentiment: ${sentiment}`);

    // Advanced context analysis
    const enhancedContext = await this.analyzeAdvancedContext(queryText, context, sentiment);
    
    let response = await this._handleIntentLogic(intentName, parameters, queryText, sessionId, enhancedContext);
    // Translate fulfillmentText if needed
    if (response && response.fulfillmentText && languageCode && languageCode !== 'en') {
      try {
        response.fulfillmentText = await translate(response.fulfillmentText, 'en', languageCode);
      } catch (err) {
        // Log but fallback to English
        console.error('AVAFlowService translation error:', err);
      }
    }
    return response;
  }

  async _handleIntentLogic(intentName, parameters, queryText, sessionId, context, sentiment) {
    switch (intentName) {
      case 'support.escalate':
      case 'complaint.complex':
        return this.handleComplexComplaint(parameters, queryText, sessionId, context);
      
      case 'order.dispute':
        return this.handleOrderDispute(parameters, queryText, sessionId, context);
      
      case 'payment.issue':
        return this.handlePaymentIssue(parameters, queryText, sessionId, context);
      
      case 'product.search':
        return this.handleAdvancedProductSearch(parameters, queryText, sessionId, context);
      
      case 'refund.request':
        return this.handleRefundRequest(parameters, queryText, sessionId, context);
      
      default:
        return this.handleComplexQuery(intentName, parameters, queryText, sessionId, context);
    }
  }

  async analyzeAdvancedContext(queryText, context, sentiment) {
    // Extract entities and emotions using advanced NLP
    const entities = await nlpService.extractEntities(queryText);
    const emotions = await nlpService.analyzeEmotions(queryText);
    const urgency = this.calculateUrgencyScore(queryText, sentiment, context);
    
    return {
      ...context,
      entities,
      emotions,
      urgency,
      requiresHuman: urgency > 8 || sentiment === 'very_negative'
    };
  }

  calculateUrgencyScore(queryText, sentiment, context) {
    let score = 0;
    
    // Sentiment scoring
    const sentimentScores = {
      'very_negative': 8,
      'negative': 5,
      'neutral': 2,
      'positive': 1
    };
    score += sentimentScores[sentiment] || 2;
    
    // Urgency keywords
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'critical', 'serious'];
    const hasUrgentKeywords = urgentKeywords.some(keyword => 
      queryText.toLowerCase().includes(keyword)
    );
    if (hasUrgentKeywords) score += 3;
    
    // Escalation keywords
    const escalationKeywords = ['manager', 'supervisor', 'complaint', 'legal', 'fraud'];
    const hasEscalationKeywords = escalationKeywords.some(keyword => 
      queryText.toLowerCase().includes(keyword)
    );
    if (hasEscalationKeywords) score += 4;
    
    // Conversation context
    score += Math.min(context.failureCount || 0, 3);
    
    return Math.min(score, 10);
  }

  async handleComplexComplaint(parameters, queryText, sessionId, context) {
    try {
      const complaintType = await this.classifyComplaint(queryText);
      const priority = context.urgency > 7 ? 'high' : 'medium';
      
      // Create support ticket
      const ticket = await customerSupportService.createSupportTicket({
        sessionId,
        type: 'complaint',
        priority,
        description: queryText,
        complaintType,
        sentiment: context.emotions
      });

      if (context.requiresHuman) {
        // Immediate human escalation
        const escalationResult = await customerSupportService.escalateToHuman({
          ticketId: ticket.id,
          urgency: context.urgency,
          reason: 'Complex complaint requiring immediate attention'
        });

        return {
          fulfillmentText: `I understand this is frustrating. I've immediately escalated your concern to our senior support team. Your ticket ID is ${ticket.id}. A specialist will contact you within the next 15 minutes. Is there anything urgent I can help with right now?`,
          fulfillmentMessages: [{
            quickReplies: {
              title: 'Immediate assistance:',
              quickReplies: ['Cancel recent order', 'Process refund', 'Update contact info']
            }
          }]
        };
      }

      // Intelligent resolution attempt
      const resolutionSuggestion = await this.suggestResolution(complaintType, parameters);
      
      return {
        fulfillmentText: `I sincerely apologize for the inconvenience. I've created ticket ${ticket.id} for your complaint. ${resolutionSuggestion.message}`,
        fulfillmentMessages: [{
          card: {
            title: 'Suggested Resolution',
            subtitle: resolutionSuggestion.description,
            buttons: [
              { text: 'Accept Resolution', postback: `accept_resolution_${ticket.id}` },
              { text: 'Talk to Human', postback: `escalate_human_${ticket.id}` },
              { text: 'More Options', postback: `more_options_${ticket.id}` }
            ]
          }
        }]
      };

    } catch (error) {
      logger.error('Complex complaint handling error:', error);
      return this.getEmergencyEscalationResponse();
    }
  }

  async handleOrderDispute(parameters, queryText, sessionId, context) {
    try {
      const { orderId } = parameters;
      
      if (!orderId) {
        return {
          fulfillmentText: 'I need your order ID to help resolve this dispute. Please provide your order ID, and I\'ll investigate the issue immediately.'
        };
      }

      const order = await orderService.getOrderById(orderId);
      
      if (!order) {
        return {
          fulfillmentText: `I couldn't find order ${orderId}. Please verify the order ID. If this is correct, I'm escalating this to our fraud prevention team immediately.`,
          fulfillmentMessages: [{
            quickReplies: {
              title: 'Next steps:',
              quickReplies: ['Verify order ID', 'Check email for correct ID', 'Talk to specialist']
            }
          }]
        };
      }

      // Analyze dispute type
      const disputeType = await this.classifyDispute(queryText, order);
      
      // Create high-priority ticket
      const ticket = await customerSupportService.createSupportTicket({
        sessionId,
        orderId,
        type: 'dispute',
        priority: 'high',
        description: queryText,
        disputeType,
        orderDetails: order
      });

      const resolutionActions = await this.getDisputeResolutionActions(disputeType, order);

      return {
        fulfillmentText: `I've found your order ${orderId} and created urgent ticket ${ticket.id} for this dispute. ${resolutionActions.message}`,
        fulfillmentMessages: [{
          card: {
            title: `Order ${orderId} - ${disputeType}`,
            subtitle: `Status: ${order.status} | Total: ₹${order.pricing.total}`,
            buttons: resolutionActions.buttons
          }
        }]
      };

    } catch (error) {
      logger.error('Order dispute handling error:', error);
      return this.getEmergencyEscalationResponse();
    }
  }

  async handleAdvancedProductSearch(parameters, queryText, sessionId, context) {
    try {
      logger.info('Dialogflow parameters:', parameters);
      logger.info('[AVA] Translated queryText:', queryText);
      // Prefer productName entity, fallback to product, then extract from queryText
      let productQuery = parameters.productName;
      if (!productQuery || typeof productQuery !== 'string' || !productQuery.trim() || ['product', 'products', 'item', 'items'].includes(productQuery.toLowerCase())) {
        productQuery = parameters.product;
      }
      if (!productQuery || typeof productQuery !== 'string' || !productQuery.trim() || ['product', 'products', 'item', 'items'].includes(productQuery?.toLowerCase())) {
        // Try to extract a likely keyword from the queryText
        productQuery = extractProductKeyword(queryText);
      }
      logger.info('[AVA] Extracted product keyword:', productQuery);
      // Enhanced search with NLP understanding
      logger.info('[AVA] Final search term sent to DB:', productQuery);
      const searchIntent = await nlpService.analyzeSearchIntent(productQuery);
      const enhancedParams = {
        ...parameters,
        query: productQuery,
        searchIntent: searchIntent.intent,
        extractedFeatures: searchIntent.features,
        userContext: context.entities
      };
      const results = await productService.advancedSearch(enhancedParams);
      if (results.products.length === 0) {
        // Intelligent fallback suggestions
        const suggestions = await this.getIntelligentSuggestions(productQuery, context);
        return {
          fulfillmentText: `I couldn't find exact matches for "${productQuery}", but I have some intelligent suggestions based on your query:`,
          fulfillmentMessages: suggestions.map(suggestion => ({
            card: {
              title: suggestion.title,
              subtitle: suggestion.description,
              imageUri: suggestion.image,
              buttons: [{ text: 'View Products', postback: suggestion.action }]
            }
          }))
        };
      }
      // Enhanced product presentation with reasoning
      const productCards = results.products.map(product => {
        const matchReason = this.getMatchReason(product, searchIntent);
        return {
          card: {
            title: product.name,
            subtitle: `₹${product.salePrice || product.price} - ${matchReason}`,
            imageUri: product.images[0],
            buttons: [
              { text: 'Perfect Match!', postback: `view_product_${product.productId}` },
              { text: 'Add to Cart', postback: `add_to_cart_${product.productId}` }
            ]
          }
        };
      });
      return {
        fulfillmentText: `Great! I found ${results.products.length} products that match your specific requirements:`,
        fulfillmentMessages: productCards
      };
    } catch (error) {
      logger.error('Advanced product search error:', error);
      return {
        fulfillmentText: 'I\'m having trouble with advanced search right now. Let me connect you with a product specialist who can help you find exactly what you\'re looking for.'
      };
    }
  }

  async getDisputeResolutionActions(disputeType, order) {
    const actions = {
      'wrong_item': {
        message: 'For wrong item delivery, I can process an immediate return and replacement.',
        buttons: [
          { text: 'Return & Replace', postback: `return_replace_${order.orderId}` },
          { text: 'Full Refund', postback: `full_refund_${order.orderId}` }
        ]
      },
      'damaged_item': {
        message: 'For damaged items, I can offer immediate replacement or full refund.',
        buttons: [
          { text: 'Replace Item', postback: `replace_${order.orderId}` },
          { text: 'Full Refund', postback: `refund_${order.orderId}` }
        ]
      },
      'not_delivered': {
        message: 'I\'ll investigate the delivery issue and provide resolution within 24 hours.',
        buttons: [
          { text: 'Track Investigation', postback: `track_investigation_${order.orderId}` },
          { text: 'Immediate Refund', postback: `immediate_refund_${order.orderId}` }
        ]
      },
      'billing_error': {
        message: 'I\'ll review the billing and process any necessary adjustments immediately.',
        buttons: [
          { text: 'Review Billing', postback: `review_billing_${order.orderId}` },
          { text: 'Process Adjustment', postback: `billing_adjustment_${order.orderId}` }
        ]
      }
    };

    return actions[disputeType] || {
      message: 'I\'ll escalate this unique case to our specialized team.',
      buttons: [{ text: 'Escalate Now', postback: `escalate_specialist_${order.orderId}` }]
    };
  }

  async classifyComplaint(queryText) {
    const complaintTypes = {
      'service_quality': ['service', 'support', 'help', 'assistance'],
      'product_quality': ['quality', 'defective', 'broken', 'damaged'],
      'delivery_issue': ['delivery', 'shipping', 'late', 'delayed'],
      'billing_issue': ['charge', 'billing', 'payment', 'refund'],
      'website_issue': ['website', 'app', 'technical', 'bug']
    };

    for (const [type, keywords] of Object.entries(complaintTypes)) {
      if (keywords.some(keyword => queryText.toLowerCase().includes(keyword))) {
        return type;
      }
    }

    return 'general_complaint';
  }

  async classifyDispute(queryText, order) {
    const disputePatterns = {
      'wrong_item': ['wrong', 'incorrect', 'different', 'not what'],
      'damaged_item': ['damaged', 'broken', 'defective', 'torn'],
      'not_delivered': ['not delivered', 'missing', 'lost', 'stolen'],
      'billing_error': ['charged', 'billing', 'amount', 'price']
    };

    for (const [type, patterns] of Object.entries(disputePatterns)) {
      if (patterns.some(pattern => queryText.toLowerCase().includes(pattern))) {
        return type;
      }
    }

    return 'other_dispute';
  }

  getMatchReason(product, searchIntent) {
    if (searchIntent.features.includes('price_focused')) {
      return `Great value at this price`;
    }
    if (searchIntent.features.includes('quality_focused')) {
      return `High quality - ${product.ratings.average}★ rated`;
    }
    return `Matches your requirements`;
  }

  getEmergencyEscalationResponse() {
    return {
      fulfillmentText: 'I apologize for the technical difficulty. I\'m immediately connecting you with our senior support team. Please hold on while I transfer your conversation.',
      fulfillmentMessages: [{
        quickReplies: {
          title: 'Emergency contact:',
          quickReplies: ['Call support now', 'Email complaint', 'Live chat']
        }
      }]
    };
  }
}

module.exports = new AVAFlowService();
