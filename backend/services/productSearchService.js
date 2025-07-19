// Enhanced Product Search Service for Large Datasets
const Product = require('../models/Product');

class ProductSearchService {
  
  // High-performance text search for large datasets
  static async searchProducts(query, options = {}) {
    const {
      page = 1,
      limit = 20,
      maxPrice,
      category,
      sortBy = 'relevance'
    } = options;
    
    const skip = (page - 1) * limit;
    let searchQuery = { inStock: true };
    let sortQuery = {};
    
    // Use MongoDB text search instead of regex for better performance
    if (query) {
      // MongoDB text search is much faster than regex
      searchQuery.$text = { $search: query };
      sortQuery.score = { $meta: 'textScore' };
    }
    
    // Add filters
    if (maxPrice) {
      searchQuery.price = { $lte: maxPrice };
    }
    
    if (category) {
      searchQuery.category = category;
    }
    
    // Sorting options
    switch (sortBy) {
      case 'price_low':
        sortQuery.price = 1;
        break;
      case 'price_high':
        sortQuery.price = -1;
        break;
      case 'rating':
        sortQuery['rating.average'] = -1;
        break;
      case 'newest':
        sortQuery.createdAt = -1;
        break;
      default:
        // Relevance (text score) is default
        break;
    }
    
    console.log(`🔍 Searching with query:`, searchQuery);
    
    try {
      // Execute search with pagination and projection for performance
      const [products, totalCount] = await Promise.all([
        Product
          .find(searchQuery, { score: { $meta: 'textScore' } })
          .sort(sortQuery)
          .skip(skip)
          .limit(limit)
          .select('name price category images rating inStock discount')
          .lean(), // Use lean() for better performance
        
        Product.countDocuments(searchQuery)
      ]);
      
      return {
        products,
        pagination: {
          current: page,
          total: Math.ceil(totalCount / limit),
          count: totalCount,
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      };
      
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }
  
  // Fallback search using regex (for when text search fails)
  static async fallbackSearch(query, options = {}) {
    const { limit = 6 } = options;
    
    const searchQuery = {
      inStock: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };
    
    return await Product
      .find(searchQuery)
      .limit(limit)
      .select('name price category images rating inStock')
      .lean();
  }
  
  // Get trending/popular products (cached results)
  static async getTrendingProducts(limit = 20) {
    return await Product
      .find({ inStock: true })
      .sort({ 'rating.average': -1, 'rating.count': -1 })
      .limit(limit)
      .select('name price category images rating inStock discount')
      .lean();
  }
  
  // Category-based search (very fast with indexes)
  static async getProductsByCategory(category, options = {}) {
    const { page = 1, limit = 20, sortBy = 'rating' } = options;
    const skip = (page - 1) * limit;
    
    let sortQuery = {};
    switch (sortBy) {
      case 'price_low':
        sortQuery.price = 1;
        break;
      case 'price_high':
        sortQuery.price = -1;
        break;
      default:
        sortQuery['rating.average'] = -1;
    }
    
    return await Product
      .find({ category, inStock: true })
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .select('name price category images rating inStock discount')
      .lean();
  }
}

module.exports = ProductSearchService;
