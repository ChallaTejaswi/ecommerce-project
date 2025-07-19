// Enhanced webhook with production optimizations
const ProductSearchService = require('./productSearchService');
const cacheService = require('./cacheService');

// Enhanced product search with caching and performance optimizations
async function handleProductSearch(userMessage, options = {}) {
  try {
    // Extract search parameters
    const priceMatch = userMessage.match(/under\s+(\d+)|below\s+(\d+)|less.*than\s+(\d+)/i);
    const maxPrice = priceMatch ? parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3]) : null;
    
    // Clean the search query
    const cleanQuery = userMessage
      .replace(/show me|find|search|looking for|want|need|under\s+\d+|below\s+\d+|less.*than\s+\d+/gi, '')
      .trim();
    
    if (!cleanQuery) {
      let msg = "What specific products are you looking for?";
      if (options.languageCode && options.languageCode !== 'en') {
        const { translate } = require('../src/utils/googleTranslate');
        try { msg = await translate(msg, 'en', options.languageCode); } catch {}
      }
      return { responseText: msg, products: [] };
    }
    
    // Check cache first
    const cacheKey = cacheService.generateKey(cleanQuery, { maxPrice });
    let cachedResult = cacheService.get(cacheKey);
    
    if (cachedResult) {
      return {
        responseText: `🛍 Found ${cachedResult.length} ${cleanQuery} for you! (from cache)`,
        products: cachedResult
      };
    }
    
    // Search database with high-performance method
    const searchResult = await ProductSearchService.searchProducts(cleanQuery, {
      page: 1,
      limit: 6,
      maxPrice,
      sortBy: 'relevance'
    });

    console.log(`🔍 Database search for "${cleanQuery}": found ${searchResult.products.length} products`);

    let products = searchResult.products;
    
    // If no results, try fallback search
    if (products.length === 0) {
      console.log('🔄 Trying fallback search method');
      products = await ProductSearchService.fallbackSearch(cleanQuery, { limit: 6 });
    }
    
    // If still no results, try category search
    if (products.length === 0) {
      console.log('🔄 Trying category-based search');
      const categories = ['Fashion', 'Electronics', 'Beauty & Personal Care', 'Home & Kitchen'];
      const matchingCategory = categories.find(cat => 
        cat.toLowerCase().includes(cleanQuery.toLowerCase()) ||
        cleanQuery.toLowerCase().includes(cat.toLowerCase())
      );
      
      if (matchingCategory) {
        const categoryResult = await ProductSearchService.getProductsByCategory(matchingCategory, { limit: 6 });
        products = categoryResult;
      }
    }
    
    // Format products for frontend
    const formattedProducts = products.map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.images?.[0] || '',
      rating: product.rating?.average || 0,
      inStock: product.inStock,
      discount: product.discount || 0
    }));
    
    // Cache the results
    if (formattedProducts.length > 0) {
      cacheService.set(cacheKey, formattedProducts);
    }
    
    if (formattedProducts.length > 0) {
      let msg = `🛍 Found ${formattedProducts.length} ${cleanQuery} for you!`;
      if (options.languageCode && options.languageCode !== 'en') {
        const { translate } = require('../src/utils/googleTranslate');
        try { msg = await translate(msg, 'en', options.languageCode); } catch {}
      }
      return { responseText: msg, products: formattedProducts };
    } else {
      let fallbackMsg = `😔 No products found for "${cleanQuery}". Try searching for categories like Fashion, Electronics, or Beauty!`;
      if (options.languageCode && options.languageCode !== 'en') {
        const { translate } = require('../src/utils/googleTranslate');
        try { fallbackMsg = await translate(fallbackMsg, 'en', options.languageCode); } catch {}
      }
      return { responseText: fallbackMsg, products: [] };
    }
    
  } catch (error) {
    console.error('Enhanced product search error:', error);
    return {
      responseText: `❌ Sorry, I'm having trouble searching products right now. Please try again later.`,
      products: []
    };
  }
}

// Add recommendation logic for chatbot intents
async function handleRecommendations(userId, sessionContext = {}) {
  const axios = require('axios');
  try {
    // Call backend recommendation API
    const res = await axios.post(
      `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/recommendations/${userId}`,
      sessionContext
    );
    const products = res.data.recommendations || [];
    let summaryText = products.length > 0
      ? `Here are some suggestions: ${products.slice(0, 5).map(p => p.name).join(', ')}`
      : `No recommendations found. Try browsing popular categories!`;
    // Truncate to 256 chars
    if (summaryText.length > 256) summaryText = summaryText.slice(0, 253) + '...';
    if (sessionContext.languageCode && sessionContext.languageCode !== 'en') {
      const { translate } = require('../src/utils/googleTranslate');
      try { summaryText = await translate(summaryText, 'en', sessionContext.languageCode); } catch {}
    }
    return {
      responseText: summaryText,
      payload: { recommendations: products },
      products
    };
  } catch (err) {
    console.error('Recommendation API error:', err);
    return {
      responseText: `❌ Sorry, I couldn't fetch recommendations right now.`,
      payload: { recommendations: [] },
      products: []
    };
  }
}

module.exports = { handleProductSearch, handleRecommendations };