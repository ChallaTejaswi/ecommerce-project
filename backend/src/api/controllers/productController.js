const productService = require('../../services/productService');
const logger = require('../../utils/logger');
const { detectLanguage, translate } = require('../../utils/googleTranslate');

class ProductController {
  async searchProducts(req, res) {
    try {
      let searchParams = { ...req.query };
      let userLang = searchParams.languageCode || 'en';
      let originalQuery = searchParams.query;

      // 1. Translate query to English if needed
      if (originalQuery && userLang !== 'en') {
        searchParams.query = await translate(originalQuery, userLang, 'en');
      }

      const result = await productService.searchProducts(searchParams);

      // 2. If no products found, translate error message back to user's language
      if (!result.products || result.products.length === 0) {
        let msg = 'Sorry, no products found matching your search.';
        if (userLang !== 'en') {
          msg = await translate(msg, 'en', userLang);
        }
        return res.json({
          success: false,
          message: msg,
          data: [],
          pagination: result.pagination,
          filters: result.appliedFilters
        });
      }

      res.json({
        success: true,
        data: result.products,
        pagination: result.pagination,
        filters: result.appliedFilters
      });
    } catch (error) {
      logger.error('Product search error:', error);
      let msg = 'Failed to search products';
      let userLang = req.query.languageCode || 'en';
      if (userLang !== 'en') {
        msg = await translate(msg, 'en', userLang);
      }
      res.status(500).json({
        success: false,
        message: msg,
        error: error.message
      });
    }
  }

  async getProductById(req, res) {
    try {
      const { productId } = req.params;
      const product = await productService.getProductById(productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      res.json({
        success: true,
        data: product
      });
    } catch (error) {
      logger.error('Get product error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get product details',
        error: error.message
      });
    }
  }

  async getCategories(req, res) {
    try {
      const categories = await productService.getCategories();
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Get categories error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get categories',
        error: error.message
      });
    }
  }

  async getBrands(req, res) {
    try {
      const brands = await productService.getBrands();
      res.json({
        success: true,
        data: brands
      });
    } catch (error) {
      logger.error('Get brands error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get brands',
        error: error.message
      });
    }
  }

  async trackProductView(req, res) {
    try {
      const { productId } = req.params;
      const { userId } = req.body;
      
      await productService.trackProductView(productId, userId);
      
      res.json({
        success: true,
        message: 'Product view tracked'
      });
    } catch (error) {
      logger.error('Track product view error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track product view',
        error: error.message
      });
    }
  }

  async trackAddToCart(req, res) {
    try {
      const { productId } = req.params;
      const { userId } = req.body;
      
      await productService.trackAddToCart(productId, userId);
      
      res.json({
        success: true,
        message: 'Add to cart tracked'
      });
    } catch (error) {
      logger.error('Track add to cart error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to track add to cart',
        error: error.message
      });
    }
  }
}

module.exports = new ProductController();
