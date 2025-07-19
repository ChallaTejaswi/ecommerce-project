const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { validateProductSearch } = require('../../utils/validation');

// GET /products - Search products with filters
router.get('/', validateProductSearch, productController.searchProducts);

// GET /products/:productId - Get specific product details
router.get('/:productId', productController.getProductById);

// GET /categories - Get all product categories
router.get('/meta/categories', productController.getCategories);

// GET /brands - Get all brands
router.get('/meta/brands', productController.getBrands);

// POST /products/:productId/view - Track product view
router.post('/:productId/view', productController.trackProductView);

// POST /products/:productId/add-to-cart - Track add to cart
router.post('/:productId/add-to-cart', productController.trackAddToCart);

module.exports = router;
