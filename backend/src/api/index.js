const express = require('express');
const router = express.Router();

// Import route modules
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userRoutes = require('./routes/userRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const dialogflowWebhookRoutes = require('./routes/dialogflowWebhookRoutes');

// API versioning middleware
router.use((req, res, next) => {
  req.apiVersion = req.headers['api-version'] || 'v1';
  next();
});

// Route mounting
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/users', userRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/webhook', dialogflowWebhookRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    title: 'Meesho Conversational Shopping Assistant API',
    version: '1.0.0',
    description: 'RESTful API for conversational shopping assistant',
    endpoints: {
      products: '/api/products',
      orders: '/api/orders',
      users: '/api/users',
      recommendations: '/api/recommendations',
      webhook: '/api/webhook'
    },
    documentation: 'https://docs.example.com/api'
  });
});

// Health check for API
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      dialogflow: 'available',
      ml_services: 'available'
    }
  });
});

module.exports = router;
