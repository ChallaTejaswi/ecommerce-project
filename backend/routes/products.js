const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const path = require('path');

// Path to your Dialogflow service account key
const keyFilePath = path.resolve(__dirname, '../../config/dialogflow-service-account.json');
const projectId = 'shoppingassistant-pstu';

// Get all products from database
router.get('/', async (req, res) => {
  try {
    console.log('📦 Products API called');
    
    const products = await Product.find({ inStock: true }).select({
      name: 1,
      price: 1,
      category: 1,
      images: 1,
      inStock: 1,
      'rating.average': 1
    });

    const formattedProducts = products.map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.images[0] || '',
      inStock: product.inStock,
      rating: product.rating.average
    }));

    console.log('✅ Sending products from database:', formattedProducts.length);

    res.json({
      success: true,
      products: formattedProducts,
      total: formattedProducts.length
    });
  } catch (error) {
    console.error('❌ Products fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// Get product by ID from database
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const formattedProduct = {
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.images[0] || '',
      inStock: product.inStock,
      rating: product.rating.average,
      description: product.description
    };

    res.json({
      success: true,
      product: formattedProduct
    });
  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product'
    });
  }
});

// Dialogflow-powered product search
router.post('/search', async (req, res) => {
  try {
    const { query, userId } = req.body;
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    console.log(`🔍 Dialogflow-powered search for: "${query}"`);

    // Dialogflow session setup
    const sessionId = uuid.v4();
    const sessionClient = new dialogflow.SessionsClient({ keyFilename: keyFilePath });
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

    // Truncate query to avoid exceeding Dialogflow's 256 char limit
    let safeQuery = query;
    if (typeof safeQuery === 'string' && safeQuery.length > 200) safeQuery = safeQuery.slice(0, 197) + '...';
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: safeQuery,
          languageCode: 'en',
        },
      },
    };
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;
    const intent = result.intent ? result.intent.displayName : 'unknown';
    const fulfillmentText = result.fulfillmentText;

    // Search products in database
    const searchRegex = new RegExp(query, 'i');
    const products = await Product.find({
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex }
      ],
      inStock: true
    }).select({
      name: 1,
      price: 1,
      category: 1,
      images: 1,
      inStock: 1,
      'rating.average': 1,
      description: 1
    });

    const formattedProducts = products.map(product => ({
      id: product._id,
      name: product.name,
      price: product.price,
      category: product.category,
      image: product.images[0] || '',
      inStock: product.inStock,
      rating: product.rating.average,
      description: product.description
    }));

    // Recommendations: You can use fulfillmentText or custom payload from Dialogflow for recommendations
    let recommendations = [];
    if (result.parameters && result.parameters.fields && result.parameters.fields.recommendations) {
      recommendations = result.parameters.fields.recommendations.listValue.values.map(v => v.stringValue);
    }

    res.json({
      success: true,
      query,
      intent,
      fulfillmentText,
      products: formattedProducts,
      recommendations,
      total: formattedProducts.length,
      dialogflowPowered: true
    });
  } catch (error) {
    console.error('❌ Dialogflow search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error performing search',
      error: error.message
    });
  }
});

// Get categories from database
router.get('/categories/all', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    
    const formattedCategories = categories.map((cat, index) => ({
      id: `cat_${index + 1}`,
      name: cat,
      isActive: true
    }));

    res.json({
      success: true,
      categories: formattedCategories
    });
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
});

module.exports = router;