const Cart = require('../../models/Cart');
const Product = require('../../models/Product');
const User = require('../../models/User');
const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const path = require('path');

// Path to your Dialogflow service account key
const keyFilePath = path.resolve(__dirname, '../../config/dialogflow-service-account.json');
const projectId = 'shoppingassistant-pstu';

class CartController {
  static async getCart(req, res) {
    try {
      const userId = req.userId;
      console.log('🛒 Getting cart for user:', userId);

      let cart = await Cart.getCartWithProducts(userId);
      console.log('📦 Cart found:', cart ? 'Yes' : 'No');

      if (!cart) {
        console.log('🆕 Creating new cart for user:', userId);
        cart = new Cart({
          userId,
          items: [],
          cartAnalytics: {
            averageItemPrice: 0,
            chatDrivenItems: 0,
            recommendationDrivenItems: 0,
            conversionSources: [],
            lastActivity: new Date(),
            abandonmentRisk: 'low',
            mostAddedCategory: null
          },
          sessionData: {
            sessionId: `session_${Date.now()}`,
            startTime: new Date(),
            lastUpdated: new Date(),
            interactions: 0
          }
        });
        await cart.save();
        console.log('✅ New cart created');
      }

      // Use Dialogflow to get recommendations based on cart contents
      let recommendations = [];
      if (cart.items.length > 0) {
        const sessionId = uuid.v4();
        const sessionClient = new dialogflow.SessionsClient({ keyFilename: keyFilePath });
        const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
        let cartSummary = cart.items.map(item => item.name).join(', ');
        // Truncate cartSummary to avoid exceeding Dialogflow's 256 char limit
        if (cartSummary.length > 200) cartSummary = cartSummary.slice(0, 197) + '...';
        const request = {
          session: sessionPath,
          queryInput: {
            text: {
              text: `Recommend products for cart: ${cartSummary}`,
              languageCode: 'en',
            },
          },
        };
        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;
        if (result.parameters && result.parameters.fields && result.parameters.fields.recommendations) {
          recommendations = result.parameters.fields.recommendations.listValue.values.map(v => v.stringValue);
        } else if (result.fulfillmentText) {
          recommendations = [result.fulfillmentText];
        }
      }

      // Fetch full product details for recommendations
      let formattedRecommendations = [];
      if (Array.isArray(recommendations) && recommendations.length > 0) {
        // Try to find by name or productId
        const products = await Product.find({
          $or: [
            { name: { $in: recommendations } },
            { productId: { $in: recommendations } }
          ]
        });
        formattedRecommendations = products.map(product => ({
          id: product._id,
          name: product.name,
          image: product.images?.[0] || '',
          price: product.price,
          category: product.category,
          brand: product.brand,
          rating: product.rating?.average || 0,
          inStock: product.inStock
        }));
      }

      const responseData = {
        cart: cart,
        analytics: cart.cartAnalytics || {
          averageItemPrice: 0,
          chatDrivenItems: 0,
          recommendationDrivenItems: 0,
          lastActivity: new Date(),
          abandonmentRisk: 'low',
          mostAddedCategory: null
        },
        recommendations: formattedRecommendations,
        summary: {
          totalItems: cart.totalItems || 0,
          totalAmount: cart.totalAmount || 0,
          averageItemPrice: cart.cartAnalytics?.averageItemPrice || 0,
          chatDrivenPercentage: cart.totalItems > 0 ?
            Math.round((cart.cartAnalytics.chatDrivenItems / cart.totalItems) * 100) : 0
        }
      };

      console.log('📊 Detailed analytics being sent:', {
        cartItems: responseData.cart.items.length,
        analyticsExists: !!responseData.analytics,
        analyticsData: responseData.analytics,
        recommendations: recommendations.length,
        summary: responseData.summary
      });

      // Fallback: if no recommendations found, return top 5 popular products
      if (formattedRecommendations.length === 0) {
        const fallbackProducts = await Product.find({ inStock: true }).sort({ 'rating.average': -1 }).limit(5);
        formattedRecommendations = fallbackProducts.map(product => ({
          id: product._id,
          name: product.name,
          image: product.images?.[0] || '',
          price: product.price,
          category: product.category,
          brand: product.brand,
          rating: product.rating?.average || 0,
          inStock: product.inStock
        }));
        responseData.recommendations = formattedRecommendations;
      }
      res.json({
        success: true,
        data: responseData
      });

    } catch (error) {
      console.error('❌ Get cart error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get cart',
        error: error.message
      });
    }
  }

  // Add item to cart with ML tracking
  static async addToCart(req, res) {
    try {
      const userId = req.userId;
      const { 
        productId, 
        quantity = 1, 
        addedVia = 'manual',
        chatInteractionId,
        mlRecommendationScore
      } = req.body;

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Product ID is required'
        });
      }

      // Get product details
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      if (!product.inStock) {
        return res.status(400).json({
          success: false,
          message: 'Product is out of stock'
        });
      }

      // Get or create cart
      let cart = await Cart.findOne({ userId });
      if (!cart) {
        cart = new Cart({ userId, items: [] });
      }

      // Check if product already in cart
      const existingItemIndex = cart.items.findIndex(
        item => item.productId.toString() === productId
      );

      if (existingItemIndex > -1) {
        // Update quantity
        cart.items[existingItemIndex].quantity += quantity;
        cart.items[existingItemIndex].addedAt = new Date();
        
        // Update ML tracking if this was added via chat/recommendation
        if (addedVia !== 'manual') {
          cart.items[existingItemIndex].addedVia = addedVia;
          cart.items[existingItemIndex].chatInteractionId = chatInteractionId;
          cart.items[existingItemIndex].mlRecommendationScore = mlRecommendationScore;
        }
      } else {
        // Add new item with product details for faster access
        cart.items.push({
          productId: productId,
          name: product.name,
          price: product.price,
          images: product.images || [],
          category: product.category,
          quantity: quantity,
          addedVia: addedVia,
          chatInteractionId: chatInteractionId,
          mlRecommendationScore: mlRecommendationScore,
          addedAt: new Date()
        });
      }

      // Update conversion sources analytics
      const sourceIndex = cart.cartAnalytics.conversionSources.findIndex(
        source => source.source === addedVia
      );
      
      if (sourceIndex > -1) {
        cart.cartAnalytics.conversionSources[sourceIndex].count += 1;
      } else {
        cart.cartAnalytics.conversionSources.push({
          source: addedVia,
          count: 1
        });
      }

      await cart.save();

      // Update user shopping behavior for ML
      await CartController.updateUserShoppingBehavior(userId, product, addedVia);

      console.log(`✅ Product added to cart: ${product.name} (via ${addedVia})`);

      res.json({
        success: true,
        message: 'Product added to cart successfully',
        data: {
          cart: cart,
          addedItem: {
            productId: productId,
            name: product.name,
            quantity: quantity,
            addedVia: addedVia
          }
        }
      });

    } catch (error) {
      console.error('Add to cart error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add product to cart'
      });
    }
  }

  // Remove item from cart
  static async removeFromCart(req, res) {
    try {
      const userId = req.userId;
      const { productId } = req.params;

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({
          success: false,
          message: 'Cart not found'
        });
      }

      const itemIndex = cart.items.findIndex(
        item => item.productId.toString() === productId
      );

      if (itemIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Product not found in cart'
        });
      }

      const removedItem = cart.items[itemIndex];
      cart.items.splice(itemIndex, 1);
      await cart.save();

      console.log(`✅ Product removed from cart: ${removedItem.name}`);

      res.json({
        success: true,
        message: 'Product removed from cart successfully',
        data: {
          cart: cart,
          removedItem: removedItem
        }
      });

    } catch (error) {
      console.error('Remove from cart error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove product from cart'
      });
    }
  }

  // Update item quantity
  static async updateQuantity(req, res) {
    try {
      const userId = req.userId;
      const { productId } = req.params;
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1'
        });
      }

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({
          success: false,
          message: 'Cart not found'
        });
      }

      const itemIndex = cart.items.findIndex(
        item => item.productId.toString() === productId
      );

      if (itemIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Product not found in cart'
        });
      }

      cart.items[itemIndex].quantity = quantity;
      await cart.save();

      console.log(`✅ Cart quantity updated: ${cart.items[itemIndex].name} x${quantity}`);

      res.json({
        success: true,
        message: 'Quantity updated successfully',
        data: {
          cart: cart,
          updatedItem: cart.items[itemIndex]
        }
      });

    } catch (error) {
      console.error('Update quantity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update quantity'
      });
    }
  }

  // Clear entire cart
  static async clearCart(req, res) {
    try {
      const userId = req.userId;

      const cart = await Cart.findOne({ userId });
      if (!cart) {
        return res.status(404).json({
          success: false,
          message: 'Cart not found'
        });
      }

      cart.items = [];
      cart.totalItems = 0;
      cart.totalAmount = 0;
      await cart.save();

      console.log(`✅ Cart cleared for user: ${userId}`);

      res.json({
        success: true,
        message: 'Cart cleared successfully',
        data: {
          cart: cart
        }
      });

    } catch (error) {
      console.error('Clear cart error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cart'
      });
    }
  }

  
  // Fallback recommendation method when ML service is unavailable
  static async generateFallbackRecommendations(userId, cart) {
    try {
      console.log('🔄 Generating fallback recommendations...');
      
      const cartProductIds = cart.items.map(item => item.productId);
      const recommendations = [];

      // Popular products
      const popularProducts = await Product.find({
        inStock: true,
        _id: { $nin: cartProductIds }
      }).sort({ 'rating.average': -1 }).limit(5);

      popularProducts.forEach(product => {
        recommendations.push({
          product: product,
          reason: 'Popular choice among our customers',
          type: 'popular',
          mlScore: 0.6,
          source: 'basic_fallback',
          mlPowered: false
        });
      });

      return recommendations;
      
    } catch (error) {
      console.error('❌ Even fallback recommendations failed:', error);
      return [];
    }
  }

  // Update user shopping behavior for ML
  static async updateUserShoppingBehavior(userId, product, addedVia) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      // Add to viewed products
      const existingView = user.shoppingBehavior.viewedProducts.find(
        view => view.productId.toString() === product._id.toString()
      );

      if (!existingView) {
        user.shoppingBehavior.viewedProducts.push({
          productId: product._id,
          viewedAt: new Date(),
          duration: addedVia === 'chat' ? 30 : 15 // Chat interactions indicate more engagement
        });
      }

      // Add to searched categories
      if (product.category && !user.shoppingBehavior.searchedCategories.includes(product.category)) {
        user.shoppingBehavior.searchedCategories.push(product.category);
      }

      // Update purchase frequency based on cart activity
      const cartCount = await Cart.countDocuments({ userId, 'items.0': { $exists: true } });
      if (cartCount > 5) {
        user.shoppingBehavior.purchaseFrequency = 'high';
      } else if (cartCount > 2) {
        user.shoppingBehavior.purchaseFrequency = 'medium';
      }

      // Keep only last 50 viewed products
      if (user.shoppingBehavior.viewedProducts.length > 50) {
        user.shoppingBehavior.viewedProducts = user.shoppingBehavior.viewedProducts.slice(-50);
      }

      await user.save();

    } catch (error) {
      console.error('Error updating user shopping behavior:', error);
    }
  }

  static async getRecommendations(req, res) {
    try {
      const userId = req.user.id;
      console.log('🎯 Fetching recommendations for user:', userId);

      const cart = await Cart.findOne({ userId }).populate('items.productId');
      let recommendations = [];

      if (cart && cart.items.length > 0) {
        const sessionId = uuid.v4();
        const sessionClient = new dialogflow.SessionsClient({ keyFilename: keyFilePath });
        const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
        let cartSummary = cart.items.map(item => item.productId.name).join(', ');
        if (cartSummary.length > 200) cartSummary = cartSummary.slice(0, 197) + '...';
        let dialogflowText = `Recommend products for cart: ${cartSummary}`;
        if (dialogflowText.length > 256) {
          dialogflowText = 'Recommend products for me';
        }
        const request = {
          session: sessionPath,
          queryInput: {
            text: {
              text: dialogflowText,
              languageCode: 'en',
            },
          },
        };
        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;
        let recommendedNames = [];
        if (result.parameters && result.parameters.fields && result.parameters.fields.recommendations) {
          recommendedNames = result.parameters.fields.recommendations.listValue.values.map(v => v.stringValue);
        } else if (result.fulfillmentText) {
          recommendedNames = [result.fulfillmentText];
        }
        // Fetch full product details for recommendations
        if (Array.isArray(recommendedNames) && recommendedNames.length > 0) {
          const products = await Product.find({
            $or: [
              { name: { $in: recommendedNames } },
              { productId: { $in: recommendedNames } }
            ]
          });
          recommendations = products.map(product => ({
            id: product._id,
            name: product.name,
            image: product.images?.[0] || '',
            price: product.price,
            category: product.category,
            brand: product.brand,
            rating: product.rating?.average || 0,
            inStock: product.inStock
          }));
        }
      }

      // Fallback: if no recommendations found, return top 5 popular products
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        const fallbackProducts = await Product.find({ inStock: true }).sort({ 'rating.average': -1 }).limit(5);
        recommendations = fallbackProducts.map(product => ({
          id: product._id,
          name: product.name,
          image: product.images?.[0] || '',
          price: product.price,
          category: product.category,
          brand: product.brand,
          rating: product.rating?.average || 0,
          inStock: product.inStock
        }));
      }

      res.status(200).json({
        success: true,
        recommendations,
        count: recommendations.length,
        dialogflowPowered: true
      });

    } catch (error) {
      console.error('❌ Error fetching recommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recommendations',
        error: error.message
      });
    }
  }
  // Get Dialogflow-powered product recommendations for user
  static async getRecommendations(req, res) {
    try {
      const userId = req.user.id;
      console.log('🎯 Fetching recommendations for user:', userId);

      const cart = await Cart.findOne({ userId }).populate('items.productId');
      let recommendations = [];

      if (cart && cart.items.length > 0) {
        const sessionId = uuid.v4();
        const sessionClient = new dialogflow.SessionsClient({ keyFilename: keyFilePath });
        const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
        let cartSummary = cart.items.map(item => item.productId.name).join(', ');
        if (cartSummary.length > 200) cartSummary = cartSummary.slice(0, 197) + '...';
        const request = {
          session: sessionPath,
          queryInput: {
            text: {
              text: `Recommend products for cart: ${cartSummary}`,
              languageCode: 'en',
            },
          },
        };
        const responses = await sessionClient.detectIntent(request);
        const result = responses[0].queryResult;
        if (result.parameters && result.parameters.fields && result.parameters.fields.recommendations) {
          recommendations = result.parameters.fields.recommendations.listValue.values.map(v => v.stringValue);
        } else if (result.fulfillmentText) {
          recommendations = [result.fulfillmentText];
        }
      } else {
        // General recommendations fallback
        recommendations = await CartController.generateGeneralRecommendations(userId);
      }

      res.status(200).json({
        success: true,
        recommendations,
        count: recommendations.length,
        dialogflowPowered: true
      });

    } catch (error) {
      console.error('❌ Error fetching recommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recommendations',
        error: error.message
      });
    }
  }

  // Generate general recommendations when no cart data available
  static async generateGeneralRecommendations(userId) {
    try {
      console.log('🌟 Generating general recommendations for user:', userId);
      const user = await User.findById(userId);
      const recommendations = [];

      // 1. Behavior-based recommendations (if user has viewing history)
      if (user.shoppingBehavior.viewedProducts.length > 0) {
        console.log('👁️ Finding behavior-based recommendations');
        const viewedProductIds = user.shoppingBehavior.viewedProducts.map(vp => vp.productId);
        const viewedProducts = await Product.find({ _id: { $in: viewedProductIds } });
        
        // Get products from same categories as viewed products
        const viewedCategories = [...new Set(viewedProducts.map(p => p.category))];
        const categoryProducts = await Product.find({
          category: { $in: viewedCategories },
          inStock: true,
          _id: { $nin: viewedProductIds }
        }).limit(3);

        categoryProducts.forEach(product => {
          recommendations.push({
            product: product,
            reason: `Based on your browsing history`,
            type: 'behavior_based',
            mlScore: 0.9,
            source: 'viewing_history'
          });
        });
      }

      // 2. Category preference based recommendations
      if (user.shoppingBehavior.searchedCategories.length > 0) {
        console.log('🏷️ Finding category preference recommendations');
        const preferredCategories = user.shoppingBehavior.searchedCategories;
        const categoryProducts = await Product.find({
          category: { $in: preferredCategories },
          inStock: true
        }).limit(2);

        categoryProducts.forEach(product => {
          if (!recommendations.find(r => r.product._id.equals(product._id))) {
            recommendations.push({
              product: product,
              reason: `Matches your preferred categories`,
              type: 'category_preference',
              mlScore: 0.8,
              source: 'search_history'
            });
          }
        });
      }

      // 3. Price range based on user's average order value
      if (user.shoppingBehavior.averageOrderValue > 0) {
        console.log('💰 Finding price-appropriate recommendations');
        const minPrice = user.shoppingBehavior.averageOrderValue * 0.5;
        const maxPrice = user.shoppingBehavior.averageOrderValue * 1.5;

        const priceProducts = await Product.find({
          price: { $gte: minPrice, $lte: maxPrice },
          inStock: true
        }).limit(2);

        priceProducts.forEach(product => {
          if (!recommendations.find(r => r.product._id.equals(product._id))) {
            recommendations.push({
              product: product,
              reason: `Within your preferred price range`,
              type: 'price_based',
              mlScore: 0.7,
              source: 'spending_pattern'
            });
          }
        });
      }

      // 4. Popular products fallback
      console.log('🔥 Adding popular product recommendations');
      const popularProducts = await Product.find({
        inStock: true,
        rating: { $gte: 4.0 }
      }).sort({ rating: -1 }).limit(5);

      popularProducts.forEach(product => {
        if (!recommendations.find(r => r.product._id.equals(product._id))) {
          recommendations.push({
            product: product,
            reason: `Highly rated and popular`,
            type: 'popularity_based',
            mlScore: 0.6,
            source: 'trending'
          });
        }
      });

      console.log(`✅ Generated ${recommendations.length} general recommendations`);
      return recommendations;

    } catch (error) {
      console.error('❌ Error generating general recommendations:', error);
      return [];
    }
  }
}

module.exports = CartController;
