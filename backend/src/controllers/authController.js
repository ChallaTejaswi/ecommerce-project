const User = require('../../models/User');
const { generateToken } = require('../middleware/auth');
const flowDecisionEngine = require('../ml/models/flowDecisionEngine');

class AuthController {
  // Register new user
  static async register(req, res) {
    try {
      const { name, email, password, phone, preferences } = req.body;

      // Validation
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create new user with ML analytics initialization
      const user = new User({
        name,
        email,
        password,
        phone,
        preferences: {
          ...preferences,
          language: preferences?.language || 'en'
        },
        conversationAnalytics: {
          totalInteractions: 0,
          averageSentiment: 0,
          preferredFlow: 'IVR',
          escalationHistory: [],
          searchHistory: [],
          languageUsage: [{ language: preferences?.language || 'en', count: 1 }]
        },
        shoppingBehavior: {
          viewedProducts: [],
          searchedCategories: [],
          averageOrderValue: 0,
          purchaseFrequency: 'low'
        }
      });

      await user.save();

      // Generate JWT token
      const token = generateToken(user._id);

      // Initialize ML conversation session
      flowDecisionEngine.resetUserSession(user._id.toString());

      console.log(`✅ New user registered: ${email}`);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: user.toJSON(),
          token,
          expiresIn: '7d'
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Login user
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log(`🔐 Login attempt for: ${email}`);

      // Validation
      if (!email || !password) {
        console.log('❌ Missing email or password');
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        console.log(`❌ User not found: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password. Please register first if you don\'t have an account.'
        });
      }

      console.log(`✅ User found: ${email}`);

      // Check if user is active
      if (!user.isActive) {
        console.log(`❌ User account deactivated: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }

      // Compare password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        console.log(`❌ Invalid password for: ${email}`);
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      console.log(`✅ Password valid for: ${email}`);

      // Generate JWT token
      const token = generateToken(user._id);

      // Get or create ML conversation session
      let userSession = flowDecisionEngine.getUserSession(user._id.toString());
      if (!userSession) {
        flowDecisionEngine.resetUserSession(user._id.toString());
      }

      console.log(`✅ User logged in: ${email}`);

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          token,
          expiresIn: '7d',
          mlSession: {
            conversationState: userSession?.messages?.length || 0,
            preferredFlow: user.conversationAnalytics.preferredFlow,
            averageSentiment: user.conversationAnalytics.averageSentiment
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.userId)
        .populate('shoppingBehavior.viewedProducts.productId', 'name price images');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get ML conversation analytics
      const userSession = flowDecisionEngine.getUserSession(req.userId);

      res.json({
        success: true,
        data: {
          user: user.toJSON(),
          mlAnalytics: {
            currentSession: userSession,
            totalInteractions: user.conversationAnalytics.totalInteractions,
            averageSentiment: user.conversationAnalytics.averageSentiment,
            preferredFlow: user.conversationAnalytics.preferredFlow,
            recentSearches: user.conversationAnalytics.searchHistory.slice(-5)
          }
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user profile'
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const { name, phone, preferences, addresses } = req.body;

      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Update fields
      if (name) user.name = name;
      if (phone) user.phone = phone;
      if (preferences) {
        user.preferences = { ...user.preferences, ...preferences };
        
        // Update language usage analytics
        if (preferences.language) {
          const langUsage = user.conversationAnalytics.languageUsage;
          const existingLang = langUsage.find(l => l.language === preferences.language);
          
          if (existingLang) {
            existingLang.count += 1;
          } else {
            langUsage.push({ language: preferences.language, count: 1 });
          }
        }
      }
      if (addresses) user.addresses = addresses;

      await user.save();

      console.log(`✅ User profile updated: ${user.email}`);

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toJSON()
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }

  // Update ML conversation analytics
  static async updateConversationAnalytics(userId, analysisData) {
    try {
      const user = await User.findById(userId);
      if (!user) return;

      const analytics = user.conversationAnalytics;
      
      // Update total interactions
      analytics.totalInteractions += 1;
      
      // Update average sentiment (rolling average)
      if (analysisData.sentiment && typeof analysisData.sentiment.score === 'number') {
        const currentAvg = analytics.averageSentiment;
        const newSentiment = analysisData.sentiment.score;
        analytics.averageSentiment = (currentAvg + newSentiment) / 2;
      }
      
      // Update preferred flow based on recent usage, mapping invalid values to 'IVR'
      if (analysisData.flow) {
        const validFlows = ['IVR', 'AVA', 'PRODUCT_SEARCH', 'ORDER_TRACKING', 'RECOMMENDATIONS'];
        analytics.preferredFlow = validFlows.includes(analysisData.flow) ? analysisData.flow : 'IVR';
      }
      
      // Add search history
      if (analysisData.intent && analysisData.query) {
        analytics.searchHistory.push({
          query: analysisData.query,
          intent: analysisData.intent,
          timestamp: new Date(),
          resultCount: analysisData.resultCount || 0
        });
        
        // Keep only last 50 searches
        if (analytics.searchHistory.length > 50) {
          analytics.searchHistory = analytics.searchHistory.slice(-50);
        }
      }
      
      // Add escalation if needed
      if (analysisData.shouldEscalate) {
        analytics.escalationHistory.push({
          date: new Date(),
          reason: analysisData.escalationReason || 'User complaint detected',
          resolved: false
        });
      }

      await user.save();
      
    } catch (error) {
      console.error('Error updating conversation analytics:', error);
    }
  }

  // Logout (client-side token removal, but we can log it)
  static async logout(req, res) {
    try {
      console.log(`✅ User logged out: ${req.user.email}`);
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
      
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }
}

module.exports = AuthController;
