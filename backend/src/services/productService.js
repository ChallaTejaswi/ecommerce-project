const Product = require('../models/Product');
const logger = require('../utils/logger');

class ProductService {
  async searchProducts(searchParams) {
    try {
      const {
        query,
        category,
        subcategory,
        brand,
        color,
        size,
        min_price,
        max_price,
        sort_by = 'relevance',
        page = 1,
        limit = 20
      } = searchParams;

      let searchCriteria = { isActive: true };
      let sortOptions = {};

      // Text search
      if (query) {
        searchCriteria.$text = { $search: query };
        sortOptions.score = { $meta: 'textScore' };
      }

      // Category filters
      if (category) {
        searchCriteria.category = new RegExp(category, 'i');
      }
      if (subcategory) {
        searchCriteria.subcategory = new RegExp(subcategory, 'i');
      }
      if (brand) {
        searchCriteria.brand = new RegExp(brand, 'i');
      }

      // Attribute filters
      if (color) {
        searchCriteria['attributes.color'] = { $in: [new RegExp(color, 'i')] };
      }
      if (size) {
        searchCriteria['attributes.size'] = { $in: [new RegExp(size, 'i')] };
      }

      // Price range filter
      if (min_price || max_price) {
        searchCriteria.price = {};
        if (min_price) searchCriteria.price.$gte = parseFloat(min_price);
        if (max_price) searchCriteria.price.$lte = parseFloat(max_price);
      }

      // Sort options
      if (!query) {
        switch (sort_by) {
          case 'price_asc':
            sortOptions.price = 1;
            break;
          case 'price_desc':
            sortOptions.price = -1;
            break;
          case 'rating':
            sortOptions['ratings.average'] = -1;
            break;
          case 'newest':
            sortOptions.createdAt = -1;
            break;
          default:
            sortOptions.createdAt = -1;
        }
      }

      const skip = (page - 1) * limit;
      const products = await Product.find(searchCriteria)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Product.countDocuments(searchCriteria);

      return {
        products,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_items: total,
          items_per_page: parseInt(limit)
        },
        appliedFilters: {
          query,
          category,
          brand,
          price_range: { min: min_price, max: max_price },
          sort_by
        }
      };
    } catch (error) {
      logger.error('Product search error:', error);
      throw error;
    }
  }

  async advancedSearch(enhancedParams) {
    try {
      const { searchIntent, extractedFeatures, userContext } = enhancedParams;
      
      let searchCriteria = { isActive: true };
      
      // Apply ML-enhanced search logic
      if (searchIntent === 'budget_conscious') {
        searchCriteria.salePrice = { $exists: true };
      } else if (searchIntent === 'quality_focused') {
        searchCriteria['ratings.average'] = { $gte: 4.0 };
      }

      // Apply extracted features
      if (extractedFeatures.includes('trending')) {
        searchCriteria.isFeatured = true;
      }

      const products = await Product.find(searchCriteria)
        .sort({ 'ratings.average': -1, 'analytics.views': -1 })
        .limit(10);

      return { products };
    } catch (error) {
      logger.error('Advanced search error:', error);
      throw error;
    }
  }

  async getProductById(productId) {
    try {
      return await Product.findOne({ productId, isActive: true });
    } catch (error) {
      logger.error('Get product by ID error:', error);
      throw error;
    }
  }

  async getCategories() {
    try {
      return await Product.distinct('category', { isActive: true });
    } catch (error) {
      logger.error('Get categories error:', error);
      throw error;
    }
  }

  async getBrands() {
    try {
      return await Product.distinct('brand', { isActive: true });
    } catch (error) {
      logger.error('Get brands error:', error);
      throw error;
    }
  }

  async trackProductView(productId, userId) {
    try {
      await Product.findOneAndUpdate(
        { productId },
        { $inc: { 'analytics.views': 1 } }
      );
      logger.info(`Product view tracked: ${productId} by ${userId}`);
    } catch (error) {
      logger.error('Track product view error:', error);
    }
  }

  async trackAddToCart(productId, userId) {
    try {
      await Product.findOneAndUpdate(
        { productId },
        { $inc: { 'analytics.addToCart': 1 } }
      );
      logger.info(`Add to cart tracked: ${productId} by ${userId}`);
    } catch (error) {
      logger.error('Track add to cart error:', error);
    }
  }
}

module.exports = new ProductService();
