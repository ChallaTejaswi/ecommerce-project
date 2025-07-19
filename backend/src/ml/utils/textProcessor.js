const natural = require('natural');

class TextProcessor {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.stopwords = natural.stopwords;
  }

  processText(text) {
    // Convert to lowercase and clean
    const cleaned = text.toLowerCase().replace(/[^\w\s]/gi, '');
    
    // Tokenize
    const tokens = this.tokenizer.tokenize(cleaned);
    
    // Remove stopwords
    const filtered = tokens.filter(token => !this.stopwords.includes(token));
    
    // Stem words
    const stemmed = filtered.map(token => this.stemmer.stem(token));
    
    return {
      original: text,
      cleaned,
      tokens,
      filtered,
      stemmed
    };
  }

  extractKeywords(text, limit = 5) {
    const processed = this.processText(text);
    // Simple keyword extraction (could be enhanced with TF-IDF)
    return processed.filtered.slice(0, limit);
  }
}

module.exports = new TextProcessor();
