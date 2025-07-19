const axios = require('axios');
const logger = require('../utils/logger');

class NLPService {
  constructor() {
    this.sentimentServiceUrl = process.env.SENTIMENT_ANALYSIS_SERVICE_URL || 'http://localhost:5001';
  }

  async analyzeSentiment(text) {
    try {
      if (!text || text.trim().length === 0) {
        return 'neutral';
      }

      // Try external ML service first
      if (await this.isServiceAvailable(this.sentimentServiceUrl)) {
        const response = await axios.post(`${this.sentimentServiceUrl}/analyze`, {
          text: text
        }, { timeout: 3000 });
        return response.data.sentiment;
      }

      // Fallback to rule-based analysis
      return this.getRuleBasedSentiment(text);
    } catch (error) {
      logger.error('Sentiment analysis error:', error);
      return this.getRuleBasedSentiment(text);
    }
  }

  async analyzeEmotions(text) {
    try {
      const emotions = {
        anger: 0,
        joy: 0,
        fear: 0,
        sadness: 0,
        surprise: 0
      };

      // Simple emotion detection based on keywords
      const emotionKeywords = {
        anger: ['angry', 'furious', 'mad', 'frustrated', 'annoyed'],
        joy: ['happy', 'excited', 'great', 'awesome', 'wonderful'],
        fear: ['worried', 'scared', 'nervous', 'anxious'],
        sadness: ['sad', 'disappointed', 'upset', 'depressed'],
        surprise: ['surprised', 'amazing', 'unexpected', 'wow']
      };

      const lowerText = text.toLowerCase();
      
      for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        const matches = keywords.filter(keyword => lowerText.includes(keyword));
        emotions[emotion] = matches.length / keywords.length;
      }

      return emotions;
    } catch (error) {
      logger.error('Emotion analysis error:', error);
      return { anger: 0, joy: 0, fear: 0, sadness: 0, surprise: 0 };
    }
  }

  async extractEntities(text) {
    try {
      const entities = {
        products: [],
        brands: [],
        colors: [],
        sizes: [],
        prices: []
      };

      // Simple entity extraction using regex patterns
      const patterns = {
        prices: /₹\s*(\d+(?:,\d+)*(?:\.\d{2})?)/g,
        colors: /\b(red|blue|green|yellow|black|white|pink|purple|orange|grey|gray|brown)\b/gi,
        sizes: /\b(xs|s|m|l|xl|xxl|xxxl|\d+(?:\.\d+)?\s*(?:inch|cm|mm))\b/gi
      };

      // Extract price entities
      let match;
      while ((match = patterns.prices.exec(text)) !== null) {
        entities.prices.push(match[1].replace(/,/g, ''));
      }

      // Extract color entities
      while ((match = patterns.colors.exec(text)) !== null) {
        entities.colors.push(match[0].toLowerCase());
      }

      // Extract size entities
      while ((match = patterns.sizes.exec(text)) !== null) {
        entities.sizes.push(match[0].toLowerCase());
      }

      return entities;
    } catch (error) {
      logger.error('Entity extraction error:', error);
      return { products: [], brands: [], colors: [], sizes: [], prices: [] };
    }
  }

  async analyzeSearchIntent(queryText) {
    try {
      const intent = {
        intent: 'general_search',
        features: []
      };

      const lowerQuery = queryText.toLowerCase();

      // Intent classification
      if (this.containsWords(lowerQuery, ['cheap', 'budget', 'affordable', 'low price'])) {
        intent.intent = 'budget_conscious';
        intent.features.push('price_focused');
      } else if (this.containsWords(lowerQuery, ['best', 'quality', 'premium', 'high quality'])) {
        intent.intent = 'quality_focused';
        intent.features.push('quality_focused');
      } else if (this.containsWords(lowerQuery, ['trending', 'popular', 'latest', 'new'])) {
        intent.intent = 'trending_search';
        intent.features.push('trending');
      }

      // Feature extraction
      if (this.containsWords(lowerQuery, ['gift', 'present'])) {
        intent.features.push('gift_purpose');
      }
      if (this.containsWords(lowerQuery, ['urgent', 'asap', 'quickly'])) {
        intent.features.push('urgent_need');
      }

      return intent;
    } catch (error) {
      logger.error('Search intent analysis error:', error);
      return { intent: 'general_search', features: [] };
    }
  }

  getRuleBasedSentiment(text) {
    const lowerText = text.toLowerCase();

    const negativeKeywords = [
      'angry', 'frustrated', 'hate', 'terrible', 'awful', 'bad', 'worse', 'worst',
      'disappointed', 'annoyed', 'upset', 'problems', 'issue', 'complaint',
      'refund', 'cancel', 'broken', 'defective', 'wrong', 'error'
    ];

    const positiveKeywords = [
      'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
      'love', 'like', 'good', 'better', 'best', 'perfect', 'satisfied',
      'happy', 'pleased', 'thank'
    ];

    const escalationKeywords = [
      'manager', 'supervisor', 'legal', 'lawsuit', 'fraud', 'scam'
    ];

    let positiveScore = 0;
    let negativeScore = 0;
    let escalationScore = 0;

    positiveKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) positiveScore++;
    });

    negativeKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) negativeScore++;
    });

    escalationKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) escalationScore++;
    });

    if (escalationScore > 0) {
      return 'very_negative';
    } else if (negativeScore > positiveScore) {
      return 'negative';
    } else if (positiveScore > negativeScore) {
      return 'positive';
    } else {
      return 'neutral';
    }
  }

  containsWords(text, words) {
    return words.some(word => text.includes(word));
  }

  async isServiceAvailable(serviceUrl) {
    try {
      await axios.get(`${serviceUrl}/health`, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new NLPService();
