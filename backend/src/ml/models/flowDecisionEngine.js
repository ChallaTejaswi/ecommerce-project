const sentimentAnalyzer = require('./sentimentAnalyzer');
const intentClassifier = require('./intentClassifier');

class FlowDecisionEngine {
  constructor() {
    this.conversationHistory = new Map(); // Store user conversation history
    this.escalationThreshold = {
      negativeSentimentScore: -0.3,
      complaintIndicators: 1,
      failureCount: 2,
      frustrationKeywords: 3
    };
  }

  analyzeMessage(userId, message, conversationContext = {}) {
    // Get or create user session
    if (!this.conversationHistory.has(userId)) {
      this.conversationHistory.set(userId, {
        messages: [],
        failureCount: 0,
        lastIntent: null,
        escalated: false,
        sentiment: 'neutral'
      });
    }

    const userSession = this.conversationHistory.get(userId);
    
    // Analyze current message
    const sentiment = sentimentAnalyzer.analyzeSentiment(message);
    const intent = intentClassifier.classifyIntent(message);
    
    // Update session
    userSession.messages.push({
      text: message,
      sentiment: sentiment.sentiment,
      intent: intent.intent,
      timestamp: new Date()
    });
    
    // Determine flow routing
    const flowDecision = this.determineFlow(sentiment, intent, userSession, conversationContext);
    
    // Update user session based on decision
    if (flowDecision.flow === 'AVA') {
      userSession.escalated = true;
    }
    
    if (!flowDecision.success) {
      userSession.failureCount += 1;
    }

    return {
      flow: flowDecision.flow,
      reason: flowDecision.reason,
      confidence: flowDecision.confidence,
      shouldEscalate: flowDecision.shouldEscalate,
      sentiment: sentiment,
      intent: intent,
      userSession: userSession,
      recommendations: this.getFlowRecommendations(flowDecision.flow, intent, sentiment)
    };
  }

  determineFlow(sentiment, intent, userSession, context) {
    const reasons = [];
    let escalationScore = 0;
    
    // 1. Check for negative sentiment
    if (sentiment.score < this.escalationThreshold.negativeSentimentScore) {
      escalationScore += 3;
      reasons.push('Negative sentiment detected');
    }
    
    // 2. Check for complaint indicators
    if (sentiment.isComplaint) {
      escalationScore += 2;
      reasons.push('Complaint indicators found');
    }
    
    // 3. Check failure count
    if (userSession.failureCount >= this.escalationThreshold.failureCount) {
      escalationScore += 2;
      reasons.push('Multiple failed attempts');
    }
    
    // 4. Check for specific complaint intents
    if (intent.intent === 'complaint') {
      escalationScore += 3;
      reasons.push('Direct complaint intent');
    }
    
    // 5. Check for escalation keywords
    const escalationKeywords = ['manager', 'supervisor', 'human', 'agent', 'speak to someone'];
    const hasEscalationKeyword = escalationKeywords.some(keyword => 
      context.originalMessage?.toLowerCase().includes(keyword)
    );
    
    if (hasEscalationKeyword) {
      escalationScore += 4;
      reasons.push('Escalation keyword detected');
    }
    
    // 6. Check for order issues
    if (intent.intent === 'order_tracking' && sentiment.sentiment === 'negative') {
      escalationScore += 2;
      reasons.push('Order tracking with negative sentiment');
    }

    // Decision logic
    const shouldEscalate = escalationScore >= 3;
    
    // Route based on intent for better user experience
    let flow;
    if (shouldEscalate) {
      flow = 'AVA';
    } else if (intent.intent === 'product_search' || intent.intent === 'product.search') {
      flow = 'PRODUCT_SEARCH'; // Better routing for product searches
    } else if (intent.intent === 'order_tracking') {
      flow = 'ORDER_TRACKING';
    } else if (intent.intent === 'recommendations') {
      flow = 'RECOMMENDATIONS';
    } else {
      flow = 'IVR';
    }
    
    return {
      flow,
      shouldEscalate,
      escalationScore,
      reason: reasons.join(', ') || 'Standard query',
      confidence: Math.min(escalationScore / 5, 1.0),
      success: intent.isHighConfidence && sentiment.sentiment !== 'negative'
    };
  }

  getFlowRecommendations(flow, intent, sentiment) {
    const recommendations = {
      responseStyle: flow === 'AVA' ? 'empathetic' : 'efficient',
      urgency: flow === 'AVA' ? 'high' : 'normal',
      suggestions: []
    };

    if (flow === 'AVA') {
      recommendations.suggestions = [
        'Use empathetic language',
        'Acknowledge frustration',
        'Offer immediate solutions',
        'Provide escalation options',
        'Create support ticket if needed'
      ];
    } else if (flow === 'PRODUCT_SEARCH') {
      recommendations.suggestions = [
        'Search product database',
        'Show relevant products',
        'Offer alternatives if no results',
        'Provide filtering options',
        'Include product recommendations'
      ];
    } else if (flow === 'ORDER_TRACKING') {
      recommendations.suggestions = [
        'Request order ID',
        'Check order status',
        'Provide tracking information',
        'Offer support if issues'
      ];
    } else if (flow === 'RECOMMENDATIONS') {
      recommendations.suggestions = [
        'Analyze user preferences',
        'Show personalized products',
        'Include trending items',
        'Offer category suggestions'
      ];
    } else {
      recommendations.suggestions = [
        'Provide quick solutions',
        'Use helpful tone',
        'Offer related suggestions',
        'Guide to self-service options'
      ];
    }

    return recommendations;
  }

  getUserSession(userId) {
    return this.conversationHistory.get(userId) || null;
  }

  resetUserSession(userId) {
    this.conversationHistory.delete(userId);
  }
}

module.exports = new FlowDecisionEngine();
