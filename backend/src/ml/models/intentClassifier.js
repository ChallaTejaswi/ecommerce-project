class IntentClassifier {
  constructor() {
    this.intents = {
      'order_tracking': {
        patterns: ['track', 'order', 'status', 'where', 'delivery', 'shipped', 'ORD'],
        examples: ['track my order', 'order status', 'where is my order']
      },
      'product_search': {
        patterns: ['show', 'find', 'search', 'looking', 'want', 'need', 'buy'],
        examples: ['show me dresses', 'find phones', 'looking for laptops']
      },
      'complaint': {
        patterns: ['complain', 'problem', 'issue', 'wrong', 'bad', 'terrible', 'refund', 'return'],
        examples: ['this is terrible', 'i want refund', 'product is defective']
      },
      'recommendation': {
        patterns: ['recommend', 'suggest', 'best', 'top', 'good'],
        examples: ['recommend phones', 'best dresses', 'suggest laptops']
      },
      'greeting': {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good evening'],
        examples: ['hello', 'hi there', 'good morning']
      },
      'help': {
        patterns: ['help', 'assist', 'support', 'what can you do'],
        examples: ['help me', 'what can you do', 'need assistance']
      }
    };
  }

  classifyIntent(text) {
    const normalizedText = text.toLowerCase();
    const words = normalizedText.split(/\s+/);
    
    const intentScores = {};
    
    // Calculate scores for each intent
    Object.keys(this.intents).forEach(intent => {
      let score = 0;
      const patterns = this.intents[intent].patterns;
      
      patterns.forEach(pattern => {
        if (normalizedText.includes(pattern)) {
          score += 1;
        }
      });
      
      // Boost score if multiple keywords found
      const keywordCount = patterns.filter(pattern => 
        normalizedText.includes(pattern)
      ).length;
      
      if (keywordCount > 1) {
        score *= 1.5;
      }
      
      intentScores[intent] = score;
    });
    
    // Find highest scoring intent
    const topIntent = Object.keys(intentScores).reduce((a, b) => 
      intentScores[a] > intentScores[b] ? a : b
    );
    
    const confidence = intentScores[topIntent] / Math.max(1, words.length / 3);
    
    return {
      intent: topIntent,
      confidence: Math.min(confidence, 1.0),
      allScores: intentScores,
      isHighConfidence: confidence > 0.3
    };
  }
}

module.exports = new IntentClassifier();
