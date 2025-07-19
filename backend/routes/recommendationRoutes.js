// API route for recommendations
const express = require('express');
const router = express.Router();
const { getRecommendations } = require('../services/recommendationService');

// GET /api/recommendations/:userId
router.post('/:userId', async (req, res) => {
  const userId = req.params.userId;
  const sessionContext = req.body || {};
  try {
    const recommendations = await getRecommendations(userId, sessionContext);
    // Format for frontend/chatbot
    const formatted = recommendations.map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.images?.[0] || '',
      rating: product.rating?.average || 0,
      inStock: product.inStock,
      discount: product.discount || 0
    }));
    res.json({ recommendations: formatted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

module.exports = router;
