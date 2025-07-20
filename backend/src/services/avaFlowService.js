const customerSupportService = require('./customerSupportService');
const nlpService = require('./nlpService');
const logger = require('../utils/logger');
const { translate } = require('../utils/googleTranslate');

class AVAFlowService {
  /**
   * Handles an incoming intent for the Advanced Virtual Assistant (AVA).
   * It analyzes context, routes to specific intent logic, and translates responses.
   * @param {string} intentName - The name of the detected intent.
   * @param {object} parameters - Parameters extracted from the intent.
   * @param {string} queryText - The original query text from the user.
   * @param {string} sessionId - The unique session ID for the conversation.
   * @param {object} context - The current conversation context.
   * @param {string} sentiment - The sentiment of the user's query (e.g., 'positive', 'negative', 'neutral').
   * @param {string} languageCode - The target language code for translation (defaults to 'en').
   * @returns {Promise<object>} The fulfillment response object.
   */
  async handleIntent(intentName, parameters, queryText, sessionId, context, sentiment, languageCode = 'en') {
    // Corrected string interpolation for logger
    logger.info(`AVA Flow handling intent: ${intentName} with sentiment: ${sentiment}`);

    const enhancedContext = await this.analyzeAdvancedContext(queryText, context, sentiment);

    let response = await this._handleIntentLogic(
      intentName,
      parameters,
      queryText,
      sessionId,
      enhancedContext, // Pass the enhanced context
      sentiment,
      languageCode
    );

    // Translate fulfillmentText if the target language is not English
    if (response?.fulfillmentText && languageCode !== 'en') {
      try {
        response.fulfillmentText = await translate(response.fulfillmentText, 'en', languageCode);
      } catch (err) {
        // Corrected error logging
        logger.error(`AVAFlowService translation error for fulfillmentText: ${err.message}`, err);
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
            logger.error(`AVAFlowService translation error for quickReplies: ${err.message}`, err);
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
            logger.error(`AVAFlowService translation error for card: ${err.message}`, err);
          }
        }

        if (message.text?.text?.length) {
          try {
            message.text.text = await Promise.all(
              message.text.text.map(async (t) => await translate(t, 'en', languageCode))
            );
          } catch (err) {
            logger.error(`AVAFlowService translation error for text message: ${err.message}`, err);
          }
        }
      }
    }

    return response;
  }

  /**
   * Internal method to handle the core logic for specific intents within AVA.
   * @param {string} intentName - The name of the detected intent.
   * @param {object} parameters - Parameters extracted from the intent.
   * @param {string} queryText - The original query text from the user.
   * @param {string} sessionId - The unique session ID.
   * @param {object} context - The current conversation context.
   * @param {string} sentiment - The sentiment of the user's query.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response object.
   */
  async _handleIntentLogic(intentName, parameters, queryText, sessionId, context, sentiment, languageCode) {
    switch (intentName) {
      case 'support.escalate':
        // You might want to use customerSupportService here, e.g., await customerSupportService.escalateIssue(...)
        return await this.handleEscalation(languageCode); // Added await

      case 'complaint.complex':
        // You might want to use customerSupportService here, e.g., await customerSupportService.logComplaint(...)
        return await this.handleComplexComplaint(languageCode); // Added await

      case 'order.dispute':
        // You might want to use customerSupportService here, e.g., await customerSupportService.createOrderDispute(...)
        return await this.handleOrderDispute(languageCode); // Added await

      case 'payment.issue':
        // You might want to use customerSupportService here, e.g., await customerSupportService.handlePaymentProblem(...)
        return await this.handlePaymentIssue(languageCode); // Added await

      default:
        // Log unhandled intent for debugging/monitoring
        logger.warn(`Unhandled intent in AVAFlowService: ${intentName}. Query: "${queryText}". Sentiment: ${sentiment}.`);
        let msg = "Let me connect you to a human representative.";
        if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
        return { fulfillmentText: msg };
    }
  }

  /**
   * Analyzes advanced context including entities, emotions, and urgency.
   * @param {string} queryText - The user's query text.
   * @param {object} context - The existing conversation context.
   * @param {string} sentiment - The sentiment of the query.
   * @returns {Promise<object>} An enhanced context object.
   */
  async analyzeAdvancedContext(queryText, context, sentiment) {
    // Ensure nlpService methods are awaited as they return Promises
    const entities = await nlpService.extractEntities(queryText);
    const emotions = await nlpService.analyzeEmotions(queryText);
    const urgency = this.calculateUrgencyScore(queryText, sentiment, context);

    return {
      ...context, // Spread existing context
      entities,
      emotions,
      urgency,
      requiresHuman: urgency > 8 || sentiment === 'very_negative'
    };
  }

  /**
   * Calculates an urgency score based on query text, sentiment, and context.
   * @param {string} queryText - The user's query text.
   * @param {string} sentiment - The sentiment of the query.
   * @param {object} context - The current conversation context.
   * @returns {number} The calculated urgency score (0-10).
   */
  calculateUrgencyScore(queryText, sentiment, context) {
    let score = 0;
    const sentimentScores = {
      very_negative: 8,
      negative: 5,
      neutral: 2,
      positive: 1
    };
    // Add score based on sentiment, default to 2 for unknown/neutral
    score += sentimentScores[sentiment] || 2;

    // Enhanced urgent keywords
    const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'critical', 'serious', 'now'];
    if (urgentKeywords.some(word => queryText.toLowerCase().includes(word))) {
      score += 3;
    }

    // Add score based on previous interaction failures, up to a max of 3
    // Use optional chaining with nullish coalescing for robustness
    score += Math.min(context?.failureCount || 0, 3);

    // Cap the score at 10
    return Math.min(score, 10);
  }

  /**
   * Handles the 'support.escalate' intent.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleEscalation(languageCode) {
    // In a real scenario, you'd call customerSupportService here:
    // const escalationResult = await customerSupportService.escalateIssue(sessionId, context);
    let msg = "Your issue has been escalated to a senior representative.";
    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
    return { fulfillmentText: msg };
  }

  /**
   * Handles the 'complaint.complex' intent.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleComplexComplaint(languageCode) {
    // In a real scenario, you'd call customerSupportService here:
    // const complaintResult = await customerSupportService.logComplaint(sessionId, context);
    let msg = "We’ve logged your complaint and our team will review it.";
    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
    return { fulfillmentText: msg };
  }

  /**
   * Handles the 'order.dispute' intent.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handleOrderDispute(languageCode) {
    // In a real scenario, you'd call customerSupportService here:
    // const disputeResult = await customerSupportService.createOrderDispute(sessionId, context);
    let msg = "We’ve noted your dispute and will get back to you shortly.";
    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
    return { fulfillmentText: msg };
  }

  /**
   * Handles the 'payment.issue' intent.
   * @param {string} languageCode - The target language code.
   * @returns {Promise<object>} The fulfillment response.
   */
  async handlePaymentIssue(languageCode) {
    // In a real scenario, you'd call customerSupportService here:
    // const paymentIssueResult = await customerSupportService.investigatePaymentIssue(sessionId, context);
    let msg = "We are investigating your payment issue.";
    if (languageCode !== 'en') msg = await translate(msg, 'en', languageCode);
    return { fulfillmentText: msg };
  }
}

module.exports = new AVAFlowService();