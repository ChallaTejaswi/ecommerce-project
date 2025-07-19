
// const Product = require('../models/Product');
// const logger = require('../utils/logger');
// const axios = require('axios');

// class RecommendationService {

//   /**
//    * Get personalized recommendations using Dialogflow intent detection.
//    * Fallback to popular products if no recommendations found.
//    */
//   async getPersonalizedRecommendations(sessionId, parameters = {}) {
//     try {
//       // Use Dialogflow for intent detection and recommendation
//       const dialogflowService = require('./dialogflowService');
//       const result = await dialogflowService.detectIntent(sessionId, parameters.query || '', parameters.languageCode || 'en');
//       let recommendedProducts = [];
//       if (result && Array.isArray(result.recommendations) && result.recommendations.length > 0) {
//         // Dialogflow returns product IDs, fetch products from DB
//         const productIds = result.recommendations.map(rec => rec.product_id || rec.id || rec._id);
//         const products = await Product.find({ productId: { $in: productIds } });
//         recommendedProducts = products.map(product => ({
//           id: product.productId,
//           name: product.name,
//           price: product.salePrice || product.price,
//           images: product.images,
//           image: product.images && product.images.length > 0 ? product.images[0] : '',
//           brand: product.brand,
//           category: product.category,
//           rating: product.ratings?.average || 0,
//           inStock: product.inventory?.inStock,
//           confidence: 1.0,
//           predicted_rating: null
//         }));
//       }
//       // Fallback: popular products
//       if (recommendedProducts.length === 0) {
//         const recommendations = await Product.find({ inStock: true })
//           .sort({ 'rating.average': -1 })
//           .limit(5);
//         recommendedProducts = recommendations.map(product => ({
//           id: product.productId,
//           name: product.name,
//           price: product.salePrice || product.price,
//           images: product.images,
//           image: product.images && product.images.length > 0 ? product.images[0] : '',
//           brand: product.brand,
//           category: product.category,
//           rating: product.ratings?.average || 0,
//           inStock: product.inventory?.inStock,
//           confidence: 0.5,
//           predicted_rating: null
//         }));
//       }
//       return recommendedProducts;
//     } catch (error) {
//       logger.error('Get personalized recommendations error:', error);
//       return [];
//     }
//   }

//   async getSimilarProducts(productId, limit = 5) {
//     try {
//       const product = await Product.findById(productId);
//       if (!product) return [];
//       // Find similar products by category
//       const similar = await Product.find({
//         category: product.category,
//         _id: { $ne: productId },
//         inStock: true
//       }).limit(limit);
//       return similar;
//     } catch (error) {
//       logger.error('Get similar products error:', error);
//       return [];
//     }
//   }
// }

// module.exports = new RecommendationService();
