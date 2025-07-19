const express = require('express');
const router = express.Router();
const recommendationController = require('../controllers/recommendationController');

// GET /recommendations/:userId - Get personalized recommendations
router.get('/:userId', recommendationController.getPersonalizedRecommendations);

// GET /recommendations/:userId/similar/:productId - Get similar products
router.get('/:userId/similar/:productId', recommendationController.getSimilarProducts);

// GET /recommendations/trending - Get trending products
router.get('/trending', recommendationController.getTrendingProducts);

// POST /recommendations/interaction - Track user interaction
router.post('/interaction', recommendationController.trackInteraction);

module.exports = router;
