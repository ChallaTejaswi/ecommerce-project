const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const { translate } = require('./src/utils/translate');

const app = express();
const PORT = process.env.PORT || 7654; // Port set to 7654 as per your code

// Database connection
const connectDB = async () => {
  try {
    if (process.env.MONGODB_URI) {
      console.log('🔄 Attempting to connect to MongoDB Atlas...');
      
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 15000, // Match test settings - 15 seconds
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4, skip trying IPv6
        maxPoolSize: 10,
        retryWrites: true,
        w: 'majority',
        connectTimeoutMS: 15000 // Add connection timeout
      });
      
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      console.log(`📊 Database: ${conn.connection.name}`);
      
      // Test database access safely
      try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`📁 Found ${collections.length} collections`);
      } catch (dbError) {
        console.log('⚠️ Could not list collections, but connection is established');
      }
      
      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected. Attempting to reconnect...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected successfully');
      });

    } else {
      console.log('⚠️  No MongoDB URI provided, running without database');
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // If it's a network timeout, suggest potential solutions
    if (error.message.includes('ETIMEOUT') || error.message.includes('querySrv')) {
      console.log('🔧 Network connection troubleshooting:');
      console.log('   1. Check your internet connection');
      console.log('   2. Verify Atlas cluster is running (not paused)');
      console.log('   3. Check IP whitelist in Atlas dashboard');
      console.log('   4. Verify network firewall settings');
    }
    
    console.log('⚠️  Continuing without database in development mode');
  }
};

// Don't connect immediately - will connect later with server start

// Multilingual pattern matching function
function getMultilingualPatterns(languageCode) {
  const patterns = {
    'en': {
      orderTracking: /track.*order|order.*status|where.*order|check.*order|my.*order|show.*my.*order|order.*history|all.*my.*order|where.*are.*my.*order/i,
      productSearch: /show.*me|find|search|looking.*for|want|need/i,
      greeting: /hello|hi|hey|good morning|good afternoon|good evening/i,
      help: /help|what can you do|assistance/i,
      complaint: /terrible|awful|bad|horrible|worst|complain|refund|return|cancel|problem|issue|angry|frustrated/i
    },
    'hi': {
      orderTracking: /ऑर्डर.*ट्रैक|ऑर्डर.*स्थिति|मेरा.*ऑर्डर|ऑर्डर.*कहाँ|ऑर्डर.*देखो/i,
      productSearch: /दिखाओ|खोजो|चाहिए|ढूंढो|देखना.*चाहते/i,
      greeting: /नमस्ते|हैलो|हाय|नमस्कार/i,
      help: /मदद|सहायता|क्या.*कर.*सकते/i,
      complaint: /बुरा|खराब|समस्या|शिकायत|रिफंड|वापसी/i
    },
    'gu': {
      orderTracking: /ઓર્ડર.*ટ્રેક|ઓર્ડર.*સ્થિતિ|મારો.*ઓર્ડર/i,
      productSearch: /બતાવો|શોધો|જોઈએ|ખોજો/i,
      greeting: /નમસ્તે|હેલો|નમસ્કાર/i,
      help: /મદદ|સહાય/i,
      complaint: /ખરાબ|સમસ્યા|ફરિયાદ/i
    },
    'ta': {
      orderTracking: /ஆர்டர்.*ட்ராக்|ஆர்டர்.*நிலை|என்.*ஆர்டர்/i,
      productSearch: /காட்டு|தேடு|வேண்டும்|கண்டுபிடி/i,
      greeting: /வணக்கம்|ஹலோ/i,
      help: /உதவி|என்ன.*செய்ய.*முடியும்/i,
      complaint: /மோசமான|பிரச்சனை|புகார்/i
    },
    'te': {
      orderTracking: /ఆర్డర్.*ట్రాక్|ఆర్డర్.*స్థితి|నా.*ఆర్డర్/i,
      productSearch: /చూపించు|వెతకు|కావాలి|కనుగొను/i,
      greeting: /నమస్తే|హలో/i,
      help: /సహాయం|ఏమి.*చేయగలరు/i,
      complaint: /చెడ్డ|సమస్య|ఫిర్యాదు/i
    },
    'mr': {
      orderTracking: /ऑर्डर.*ट्रॅक|ऑर्डर.*स्थिती|माझा.*ऑर्डर/i,
      productSearch: /दाखवा|शोधा|हवे|शोधून काढा/i,
      greeting: /नमस्कार|हॅलो/i,
      help: /मदत|काय.*करू शकता/i,
      complaint: /वाईट|समस्या|तक्रार/i
    }
  };
  
  return patterns[languageCode] || patterns['en']; // Default to English
}

// Localized responses function
function getLocalizedResponse(type, languageCode) {
  const responses = {
    'complaint': {
      'en': `🤝 I understand your concern and I want to help resolve this immediately. 

Your feedback is important to us, and I'm here to personally assist you. 

Here's what I can do right away:
• Connect you with our senior support team
• Process any returns or refunds if needed
• Escalate this to a manager for priority handling

How would you prefer to resolve this issue?`,
      'hi': `🤝 मैं आपकी चिंता समझता हूं और तुरंत इसे हल करने में मदद करना चाहता हूं।

आपकी प्रतिक्रिया हमारे लिए महत्वपूर्ण है, और मैं व्यक्तिगत रूप से आपकी सहायता करने के लिए यहां हूं।

मैं तुरंत यह कर सकता हूं:
• आपको हमारी वरिष्ठ सहायता टीम से जोड़ना
• कोई भी रिटर्न या रिफंड प्रोसेस करना
• इसे प्राथमिकता के लिए मैनेजर तक पहुंचाना

आप इस मुद्दे को कैसे हल करना पसंद करेंगे?`,
      'gu': `🤝 હું તમારી ચિંતા સમજું છું અને તરત જ આને ઉકેલવામાં મદદ કરવા માંગુ છું।

તમારો પ્રતિભાવ અમારા માટે મહત્વપૂર્ણ છે, અને હું વ્યક્તિગત રૂપે તમારી સહાય કરવા માટે અહીં છું।

હું તરત જ આ કરી શકું છું:
• તમને અમારી વરિષ્ઠ સહાય ટીમ સાથે જોડવું
• કોઈપણ રિટર્ન અથવા રિફંડ પ્રોસેસ કરવું
• પ્રાથમિકતા માટે મેનેજર સુધી પહોંચાડવું

તમે આ મુદ્દાને કેવી રીતે હલ કરવાનું પસંદ કરશો?`
    },
    'greeting': {
      'en': `👋 Hello! Welcome to Meesho! I'm your AI shopping assistant.

🔍 Try saying: "Show me dresses" or "Find phones under 20000"
📦 Track orders: "Track my order ORD123456"
💡 Get help: "What can you do?"

What would you like to find today?`,
      'hi': `👋 नमस्ते! मीशो में आपका स्वागत है! मैं आपका एआई शॉपिंग असिस्टेंट हूं।

🔍 कहकर देखें: "मुझे ड्रेसेस दिखाओ" या "20000 के नीचे फोन ढूंढो"
📦 ऑर्डर ट्रैक करें: "मेरा ऑर्डर ट्रैक करो ORD123456"
💡 मदद पाएं: "आप क्या कर सकते हैं?"

आज आप क्या ढूंढना चाहेंगे?`,
      'gu': `👋 નમસ્તે! મીશોમાં આપનું સ્વાગત છે! હું તમારો AI શોપિંગ સહાયક છું।

🔍 કહીને જુઓ: "મને ડ્રેસ બતાવો" અથવા "20000 નીચે ફોન શોધો"
📦 ઓર્ડર ટ્રેક કરો: "મારો ઓર્ડર ટ્રેક કરો ORD123456"
💡 મદદ મેળવો: "તમે શું કરી શકો છો?"

આજે તમે શું શોધવા માંગો છો?`
    },
    'help': {
      'en': `🤖 I'm your Meesho Shopping Assistant! Here's what I can do:

🔍 **Order Tracking:**
• "Track my order ORD123456"
• "Where is my order?"

🛍️ **Product Search:**
• "Show me dresses"
• "Find phones under 20000"
• "Search for laptops"

💡 **Smart Search:**
• "Show me red dresses under 3000"
• "Find headphones"

Just speak naturally and I'll help you! 🎙️`,
      'hi': `🤖 मैं आपका मीशो शॉपिंग असिस्टेंट हूं! यहाँ है जो मैं कर सकता हूं:

🔍 **ऑर्डर ट्रैकिंग:**
• "मेरा ऑर्डर ट्रैक करो ORD123456"
• "मेरा ऑर्डर कहाँ है?"

🛍️ **प्रोडक्ट सर्च:**
• "मुझे ड्रेसेस दिखाओ"
• "20000 के नीचे फोन ढूंढो"
• "लैपटॉप खोजो"

💡 **स्मार्ट सर्च:**
• "मुझे 3000 के नीचे लाल ड्रेसेस दिखाओ"
• "हेडफोन ढूंढो"

बस प्राकृतिक रूप से बात करें और मैं आपकी मदद करूंगा! 🎙️`,
      'gu': `🤖 હું તમારો મીશો શોપિંગ સહાયક છું! અહીં છે જે હું કરી શકું છું:

🔍 **ઓર્ડર ટ્રેકિંગ:**
• "મારો ઓર્ડર ટ્રેક કરો ORD123456"
• "મારો ઓર્ડર ક્યાં છે?"

🛍️ **પ્રોડક્ટ સર્ચ:**
• "મને ડ્રેસ બતાવો"
• "20000 નીચે ફોન શોધો"
• "લેપટોપ શોધો"

💡 **સ્માર્ટ સર્ચ:**
• "મને 3000 નીચે લાલ ડ્રેસ બતાવો"
• "હેડફોન શોધો"

ફક્ત કુદરતી રીતે વાત કરો અને હું તમારી મદદ કરીશ! 🎙️`
    }
  };
  
  return responses[type]?.[languageCode] || responses[type]?.['en'] || 'Hello! How can I help you?';
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001','https://ecommerce-project-x8jv.vercel.app'],
  credentials: true
}));
app.use(express.json());

// Import routes
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const adminRouter = require('./routes/admin');
const authRoutesNew = require('./src/routes/authRoutes');
const cartRoutes = require('./src/routes/cartRoutes');
const agentHandoffRoutes = require('./src/routes/agentHandoffRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes'); // New recommendation routes

// API routes
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/auth', authRoutesNew); // New ML-integrated auth routes
app.use('/api/cart', cartRoutes); // ML-integrated cart routes
app.use('/api/recommendations', recommendationRoutes); // New recommendations endpoint
app.use('/api/agent-handoff', agentHandoffRoutes); // ML-based agent handoff system

// Add favicon route to prevent proxy errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Meesho Shopping Assistant Backend is running!',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    service: 'Meesho Shopping Assistant API',
    status: 'healthy',
    version: '1.0.0'
  });
});

// ML service removed; using Dialogflow only for intent detection and recommendations

// Import required services
const dialogflowService = require('./src/services/dialogflowService');
const AuthController = require('./src/controllers/authController');
const { optionalAuth } = require('./src/middleware/auth');

// Enhanced webhook route with ML-based flow decision engine and user authentication
app.post('/api/webhook', optionalAuth, async (req, res) => {
  try {
    const { queryResult, session, userId: requestUserId, languageCode: requestLanguageCode } = req.body;
    const userMessage = queryResult?.queryText || req.body?.message || 'Hello';
    const userId = req.userId || requestUserId || session?.split('/').pop() || 'anonymous';
    const languageCode = requestLanguageCode || queryResult?.languageCode || req.user?.preferences?.language || 'en';
    
    console.log('🤖 Chat message received:', userMessage);
    console.log('👤 User ID:', userId);
    console.log('🌐 Language:', languageCode);
    console.log('🔐 Authenticated:', req.user ? 'Yes' : 'No');

    let responseText = '';
    let fulfillmentMessages = [];
    let productResults = null;

    // Detect intent using Dialogflow
    const dialogflowResult = await dialogflowService.detectIntent(userId, userMessage, languageCode);
    const { intent, confidence, parameters, flowDecision } = dialogflowResult;

    const normalizedIntent = (intent || '').toLowerCase().replace(/\s+/g, '');
    if (normalizedIntent === 'product.search' || normalizedIntent === 'product_search' || normalizedIntent === 'productsearchintent') {
      try {
        // Use enhanced product search logic
        const { handleProductSearch } = require('./services/enhancedWebhook');
        const searchResult = await handleProductSearch(userMessage, { languageCode });
        productResults = searchResult.products;
        responseText = searchResult.responseText;
      } catch (error) {
        console.error('Product search error:', error);
        responseText = `❌ Sorry, I'm having trouble searching products right now. Please try browsing our Products page directly.`;
        productResults = [];
      }
    } else if (normalizedIntent === 'ordertrackingintent' || normalizedIntent === 'order_tracking' || normalizedIntent === 'ordertracking') {
      try {
        const orderTrackingService = require('./services/orderTrackingService');
        // Check authentication
        if (!req.user || !userId || userId === 'anonymous') {
          responseText = '� Please log in to view your order details.';
          productResults = null;
        } else {
          const orderId = orderTrackingService.extractOrderId(userMessage);
          if (orderId) {
            // Specific order ID provided
            const result = await orderTrackingService.trackOrderById(orderId);
            responseText = result.message;
            productResults = null;
          } else {
            // No valid order ID, list all user's orders
            const result = await orderTrackingService.getUserOrders(userId, 5);
            responseText = result.message;
            productResults = null;
          }
        }
      } catch (error) {
        console.error('Order tracking error:', error);
        responseText = `❌ Sorry, I'm having trouble accessing order information right now. Please try again later.`;
        productResults = null;
      }
    } else {
      // Handle other intents here (complaint, etc.)
      responseText = 'Intent not handled in this patch.';
    }

    // Update user conversation analytics if authenticated
    if (req.user) {
      await AuthController.updateConversationAnalytics(req.userId, {
        query: userMessage,
        intent: intent,
        sentiment: flowDecision?.sentiment,
        resultCount: productResults?.length || 0
      });
    }

    res.json({
      fulfillmentText: responseText,
      fulfillmentMessages: fulfillmentMessages,
      products: productResults,
      mlAnalysis: {
        flow: flowDecision?.flow,
        sentiment: flowDecision?.sentiment?.sentiment || 'neutral',
        intent: intent,
        confidence: confidence,
        shouldEscalate: flowDecision?.shouldEscalate,
        escalationScore: flowDecision?.escalationScore,
        flowRecommendations: flowDecision?.recommendations
      },
      session: {
        userId: userId,
        conversationState: flowDecision?.userSession,
        authenticated: !!req.user
      },
      userProfile: req.user ? {
        name: req.user.name,
        preferences: req.user.preferences,
        averageSentiment: req.user.conversationAnalytics?.averageSentiment,
        preferredFlow: req.user.conversationAnalytics?.preferredFlow
      } : null
    });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.json({
      fulfillmentText: 'Hello! Welcome to Meesho Shopping Assistant. How can I help you today?'
    });
  }
});

// AVA Flow Handler - Advanced Virtual Agent
app.handleAVAFlow = async function(userMessage, analysis, userId) {
  const sentiment = analysis?.sentiment;
  const intent = analysis?.intent;
  
  console.log('🔥 AVA Flow Processing:', { sentiment: sentiment?.sentiment, intent: intent?.intent });
  
  // Handle different types of escalated scenarios
  if (sentiment?.isComplaint) {
    return `🤝 I understand you have a concern, and I want to help resolve this personally. 

${sentiment.analysis.complaintWords.length > 0 ? 
  `I noticed you mentioned: ${sentiment.analysis.complaintWords.join(', ')}` : ''}

Here's what I can do right away:
• Escalate to our senior support team
• Arrange immediate callback from a manager
• Process any returns/refunds if applicable
• Create a priority support ticket

Would you like me to connect you with a human agent, or can I help resolve this directly?`;
  }

  if (intent?.intent === 'order_tracking' && sentiment?.sentiment === 'negative') {
    const orderIdPattern = /\bORD[A-Z0-9]+/i;
    const orderIdMatch = userMessage.match(orderIdPattern);
    
    if (orderIdMatch) {
      // Enhanced order tracking for frustrated customers
      return `🚨 I understand your concern about order ${orderIdMatch[0]}. Let me prioritize this for you.

I'm escalating this to our senior team who will:
• Investigate immediately 
• Provide real-time updates
• Ensure priority handling
• Contact you within 30 minutes

Is there anything urgent I should flag for immediate attention?`;
    }
  }

  return `🤝 I sense this is important to you, and I want to give you my full attention. 

Let me connect you with our specialized support team who can provide personalized assistance. 

In the meantime, is there anything urgent I can help you with right now?`;
};

// IVR Flow Handler - Standard responses
app.handleIVRFlow = async function(userMessage, userId) {
  // ...existing product search and order tracking logic...
  const orderTrackingPattern = /track.*order|order.*status|where.*order|order.*(\bORD\w+)/i;
  const orderIdPattern = /\bORD[A-Z0-9]+/i;
  const productSearchPattern = /show.*me|find|search|looking.*for|want|need/i;
  const pricePattern = /under\s+(\d+)|below\s+(\d+)|less.*than\s+(\d+)/i;

  let responseText = '';
  let productResults = null;

  if (orderTrackingPattern.test(userMessage)) {
    // ...existing order tracking code...
    const orderIdMatch = userMessage.match(orderIdPattern);
    
    if (orderIdMatch) {
      const orderId = orderIdMatch[0];
      
      try {
        const Order = require('./models/Order');
        const order = await Order.findOne({ orderId: orderId });
        
        if (order) {
          const statusMessages = {
            'order_placed': '📦 Your order has been placed successfully',
            'confirmed': '✅ Your order has been confirmed and is being prepared',
            'shipped': '🚚 Your order has been shipped and is on its way',
            'out_for_delivery': '🛵 Your order is out for delivery',
            'delivered': '✅ Your order has been delivered',
            'cancelled': '❌ Your order has been cancelled'
          };
          
          const lastUpdate = order.timeline[order.timeline.length - 1];
          const estimatedDelivery = order.estimatedDelivery ? 
            new Date(order.estimatedDelivery).toLocaleDateString() : 'TBD';
          
          responseText = `🔍 Order Status for ${orderId}

${statusMessages[order.status]}

📊 Details:
• Items: ${order.items.length} items
• Total: ₹${order.pricing.total}
• Status: ${order.status.replace('_', ' ').toUpperCase()}
• Estimated Delivery: ${estimatedDelivery}

${order.status === 'delivered' ? '🎉 Thank you for shopping with Meesho!' : ''}`;
        } else {
          responseText = `❌ Sorry, I couldn't find order ${orderId}. Please check your order ID and try again.`;
        }
      } catch (error) {
        console.error('Order tracking error:', error);
        responseText = `❌ Sorry, I'm having trouble accessing order information right now. Please try again later.`;
      }
    } else {
      responseText = `🔍 I can help you track your order! Please provide your order ID (e.g., "Track order ORD123456") and I'll get the latest status for you.`;
    }
  }
  else if (productSearchPattern.test(userMessage)) {
    // ...existing product search code...
    try {
      const Product = require('./models/Product');
      
      // Extract search terms and price limit
      let searchTerms = [];
      let maxPrice = null;
      
      const priceMatch = userMessage.match(pricePattern);
      if (priceMatch) {
        maxPrice = parseInt(priceMatch[1] || priceMatch[2] || priceMatch[3]);
      }
      
      const keywords = ['dress', 'dresses', 'shirt', 'shirts', 'phone', 'phones', 'laptop', 'laptops', 
                       'headphone', 'headphones', 'shoes', 'jeans', 'jacket', 'watch', 'bag', 'bags'];
      
      keywords.forEach(keyword => {
        if (userMessage.toLowerCase().includes(keyword)) {
          searchTerms.push(keyword);
        }
      });
      
      let searchQuery = {};
      
      if (searchTerms.length > 0) {
        searchQuery.$or = searchTerms.map(term => ({
          $or: [
            { name: { $regex: term, $options: 'i' } },
            { category: { $regex: term, $options: 'i' } }
          ]
        }));
      }
      
      if (maxPrice) {
        searchQuery.price = { $lte: maxPrice };
      }
      
      searchQuery.inStock = true;
      
      const products = await Product.find(searchQuery).limit(8);
      
      if (products.length > 0) {
        productResults = products.map(product => ({
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          image: product.images?.[0] || product.image || '',
          rating: product.rating?.average || 0,
          inStock: product.inStock
        }));
        
        responseText = `🛍️ Found ${products.length} products for "${userMessage}". Check them out below!`;
      } else {
        responseText = `😔 I couldn't find any products matching "${userMessage}". Try searching for specific items like "dresses", "phones", or "laptops"!`;
      }
    } catch (error) {
      console.error('Product search error:', error);
      responseText = `❌ Sorry, I'm having trouble searching products right now. Please try browsing our Products page directly.`;
    }
  }
  else {
    responseText = `I understand you said: "${userMessage}". Try asking me to "Show me dresses" or "Track order ORD123456"!`;
  }

  return { responseText, productResults };
};

// Error handling (for general application errors)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// 404 handler (for unmatched routes)
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const startServer = () => {
  try {
    const server = app.listen(PORT, '0.0.0.0', () => { // Listening on 0.0.0.0 makes it accessible from network
      console.log(`🚀 Meesho Shopping Assistant Backend running on port ${PORT}`);
      console.log(`📱 Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 API health: http://localhost:${PORT}/api/health`);
      console.log(`🛍️ Orders API: http://localhost:${PORT}/api/orders`);
      console.log(`👨‍💼 Admin Panel: http://localhost:${PORT}/api/admin`);
      console.log(`🌐 Server listening on all interfaces (0.0.0.0:${PORT})`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please use a different port or stop the process using this port.`);
        console.log('To find what\'s using the port, run: netstat -ano | findstr :' + PORT);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1); // Exit if port is in use, or other critical server error
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1); // Exit if an error occurs during server initialization
  }
};

// Connect to database and then start server
connectDB().then(() => {
  startServer();
}).catch(error => {
  console.error('❌ Failed to initialize (database connection or server start):', error);
  // Optional: If database connection is not critical for dev, you could still try startServer()
  // startServer(); // Uncomment if you want the server to try starting even if DB connection fails
  process.exit(1); // Exit if the entire initialization process fails
});

module.exports = app; // Export the app instance for testing or other modules if needed
