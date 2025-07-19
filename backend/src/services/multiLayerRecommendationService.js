const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const logger = require('../utils/logger');

/**
 * Multi-layered personalized recommendation system
 * Combines behavior, category, price, and popularity-based recommendations
 */
class MultiLayerRecommendationService {
  /**
   * Get recommendations for a user
   * @param {String} userId
   * @param {Object} options - { cartProductIds: [], sessionQueries: [] }
   * @returns {Array} recommended products
   */
  async getRecommendations(userId, options = {}) {
    try {
      // 1. Fetch user and history
      const user = await User.findOne({ userId });
      if (!user) return [];
      const purchaseHistory = user.purchaseHistory || [];
      const viewedProducts = this._getViewedProducts(user);
      const addedToCart = options.cartProductIds || [];
      const searchedQueries = options.sessionQueries || [];
      const categories = user.preferences?.categories || [];
      const brands = user.preferences?.brands || [];
      const priceRange = user.preferences?.priceRange || { min: 0, max: 10000 };
      const averageOrderValue = this._getAverageOrderValue(purchaseHistory);

      // 2. Behavior-based (collaborative/content filtering)
      let behaviorProductIds = [...viewedProducts, ...purchaseHistory.flatMap(ph => ph.items.map(i => i.productId)), ...addedToCart];
      behaviorProductIds = [...new Set(behaviorProductIds)].filter(Boolean);
      let behaviorProducts = [];
      if (behaviorProductIds.length > 0) {
        behaviorProducts = await Product.find({ productId: { $in: behaviorProductIds }, inStock: true });
      }

      // 3. Category-based
      let categoryProducts = [];
      if (categories.length > 0) {
        categoryProducts = await Product.find({ category: { $in: categories }, inStock: true });
      }
      // Complementary categories (simple demo: fetch other popular categories)
      const complementaryCategories = await Product.aggregate([
        { $match: { inStock: true } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
      const complementaryCategoryNames = complementaryCategories.map(c => c._id).filter(c => !categories.includes(c));
      let complementaryProducts = [];
      if (complementaryCategoryNames.length > 0) {
        complementaryProducts = await Product.find({ category: { $in: complementaryCategoryNames }, inStock: true }).limit(5);
      }

      // 4. Price-based
      let priceProducts = [];
      if (averageOrderValue > 0) {
        priceProducts = await Product.find({
          price: { $gte: Math.max(0, averageOrderValue - 500), $lte: averageOrderValue + 1000 },
          inStock: true
        }).limit(10);
      }

      // 5. Popularity-based (fallback)
      const popularProducts = await Product.find({ inStock: true })
        .sort({ 'analytics.purchases': -1, 'ratings.average': -1 })
        .limit(10);

      // 6. Combine and score
      const scored = {};
      behaviorProducts.forEach(p => scored[p.productId] = { product: p, score: 1.0 });
      categoryProducts.forEach(p => {
        if (!scored[p.productId]) scored[p.productId] = { product: p, score: 0.8 };
      });
      complementaryProducts.forEach(p => {
        if (!scored[p.productId]) scored[p.productId] = { product: p, score: 0.7 };
      });
      priceProducts.forEach(p => {
        if (!scored[p.productId]) scored[p.productId] = { product: p, score: 0.6 };
      });
      popularProducts.forEach(p => {
        if (!scored[p.productId]) scored[p.productId] = { product: p, score: 0.4 };
      });

      // Remove already purchased items
      const purchasedIds = purchaseHistory.flatMap(ph => ph.items.map(i => i.productId));
      Object.keys(scored).forEach(pid => {
        if (purchasedIds.includes(pid)) delete scored[pid];
      });

      // Final sorted list
      const recommendations = Object.values(scored)
        .sort((a, b) => b.score - a.score)
        .map(({ product, score }) => ({
          id: product.productId,
          name: product.name,
          price: product.salePrice || product.price,
          image: product.images?.[0] || '',
          brand: product.brand,
          category: product.category,
          rating: product.ratings?.average || 0,
          inStock: product.inventory?.inStock,
          score
        }));
      return recommendations.slice(0, 10);
    } catch (error) {
      logger.error('Multi-layer recommendation error:', error);
      return [];
    }
  }

  _getViewedProducts(user) {
    // Example: extract productIds from conversationHistory queries
    const queries = user.conversationHistory?.map(c => c.query) || [];
    // Simple keyword extraction: look for productId patterns
    const productIds = [];
    queries.forEach(q => {
      if (typeof q === 'string' && q.startsWith('view_product_')) {
        const pid = q.replace('view_product_', '').trim();
        if (pid) productIds.push(pid);
      }
    });
    return productIds;
  }

  _getAverageOrderValue(purchaseHistory) {
    if (!purchaseHistory || purchaseHistory.length === 0) return 0;
    const total = purchaseHistory.reduce((sum, ph) => sum + (ph.totalAmount || 0), 0);
    return Math.round(total / purchaseHistory.length);
  }
}

module.exports = new MultiLayerRecommendationService();
