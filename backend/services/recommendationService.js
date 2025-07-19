// Multi-layered personalized recommendation service for Meesho
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

// Helper: Get user's purchased products
async function getUserPurchases(userId) {
  const orders = await Order.find({ userId });
  return orders.flatMap(order => order.products.map(p => p.productId));
}

// Helper: Get user's viewed products (implement if you log views)
async function getUserViews(userId) {
  // Example: return array of productIds
  return [];
}

// Helper: Get user's average order value
async function getUserAvgOrderValue(userId) {
  const orders = await Order.find({ userId });
  if (!orders.length) return null;
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  return total / orders.length;
}

// Helper: Get popular products
async function getPopularProducts(limit = 10) {
  return await Product.find().sort({ purchaseCount: -1 }).limit(limit);
}

// Main recommendation function
async function getRecommendations(userId, sessionContext = {}) {
  // 1. Behavior-based (views/purchases)
  const purchased = await getUserPurchases(userId);
  const viewed = await getUserViews(userId);
  const behaviorIds = [...new Set([...purchased, ...viewed])];
  let behaviorProducts = await Product.find({ _id: { $in: behaviorIds } });

  // 2. Category-based (searches/cart)
  const preferredCategories = sessionContext.categories || [];
  let categoryProducts = [];
  if (preferredCategories.length) {
    categoryProducts = await Product.find({ category: { $in: preferredCategories } }).sort({ purchaseCount: -1 }).limit(10);
  }

  // 3. Price-based (order value)
  const avgOrderValue = await getUserAvgOrderValue(userId);
  let priceProducts = [];
  if (avgOrderValue) {
    priceProducts = await Product.find({ price: { $gte: avgOrderValue * 0.7, $lte: avgOrderValue * 1.3 } }).limit(10);
  }

  // 4. Popularity fallback
  const popularProducts = await getPopularProducts(10);

  // Weighted scoring
  const scores = {};
  const addScore = (products, weight) => {
    products.forEach(p => {
      const id = p._id.toString();
      scores[id] = (scores[id] || 0) + weight;
    });
  };
  addScore(behaviorProducts, 0.5);
  addScore(categoryProducts, 0.25);
  addScore(priceProducts, 0.15);
  addScore(popularProducts, 0.1);

  // Deduplicate and filter
  const exclude = new Set(purchased); // Don't recommend already purchased
  let allProductIds = Object.keys(scores).filter(id => !exclude.has(id));

  // Sort by score
  allProductIds.sort((a, b) => scores[b] - scores[a]);

  // Fetch product details
  const recommended = await Product.find({ _id: { $in: allProductIds.slice(0, 10) } });

  return recommended;
}

module.exports = { getRecommendations };
