const natural = require('natural');

class SentimentAnalyzer {
  constructor() {
    this.analyzer = new natural.SentimentAnalyzer('English',
      natural.PorterStemmer, 'afinn');
    
    // Positive and negative word dictionaries
    this.positiveWords = ['good', 'great', 'excellent', 'amazing', 'love', 'awesome', 'perfect', 'happy', 'satisfied', 'recommend'];
    this.negativeWords = ['bad', 'terrible', 'awful', 'hate', 'horrible', 'worst', 'disappointed', 'angry', 'frustrated', 'complain', 'problem', 'issue', 'wrong', 'broken', 'defective'];
    
    // Complaint indicators
    this.complaintIndicators = ['refund', 'return', 'cancel', 'complaint', 'dispute', 'fraud', 'scam', 'cheat', 'sue', 'legal'];
  }

  analyzeSentiment(text) {
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(text.toLowerCase());
    const stemmedTokens = tokens.map(token => natural.PorterStemmer.stem(token));
    
    // Use natural sentiment analyzer
    const score = this.analyzer.getSentiment(stemmedTokens);
    
    // Enhanced scoring with custom word matching
    let customScore = 0;
    let complaintScore = 0;
    
    tokens.forEach(token => {
      if (this.positiveWords.includes(token)) customScore += 1;
      if (this.negativeWords.includes(token)) customScore -= 1;
      if (this.complaintIndicators.includes(token)) complaintScore += 1;
    });
    
    // Final sentiment calculation
    const finalScore = (score + (customScore * 0.1)) / 2;
    
    return {
      score: finalScore,
      sentiment: this.categorizeSentiment(finalScore),
      isComplaint: complaintScore > 0,
      complaintIntensity: complaintScore,
      confidence: Math.abs(finalScore),
      analysis: {
        positiveWords: tokens.filter(token => this.positiveWords.includes(token)),
        negativeWords: tokens.filter(token => this.negativeWords.includes(token)),
        complaintWords: tokens.filter(token => this.complaintIndicators.includes(token))
      }
    };
  }

  categorizeSentiment(score) {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  }
}

module.exports = new SentimentAnalyzer();
