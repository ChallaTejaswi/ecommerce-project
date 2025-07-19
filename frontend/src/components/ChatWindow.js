import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import VoiceToggle from './VoiceToggle';
import ProductCard from './ProductCard';
import './ChatWindow.css';

const ChatWindow = () => {
  const defaultWelcomeMessage = "👋 Hi! I'm your Meesho shopping assistant. I can help you track orders, find products, and get personalized recommendations. Try saying 'Show me dresses', 'Recommend products for me', or 'Track my order'!";
  const [selectedLanguage, setSelectedLanguage] = useState('en'); // Add language state
  const [translatedWelcomeMessage, setTranslatedWelcomeMessage] = useState(defaultWelcomeMessage);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: defaultWelcomeMessage,
      sender: 'bot',
      timestamp: new Date()
    }
  ]);

  // Update welcome message when translation changes
  useEffect(() => {
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[0].text = translatedWelcomeMessage;
      }
      return updated;
    });
  }, [translatedWelcomeMessage]);

  useEffect(() => {
    async function translateWelcome() {
      if (selectedLanguage !== 'en') {
        try {
          const res = await fetch(`/api/translate?text=${encodeURIComponent(defaultWelcomeMessage)}&target=${selectedLanguage}`);
          const data = await res.json();
          setTranslatedWelcomeMessage(data.translatedText || defaultWelcomeMessage);
        } catch (err) {
          setTranslatedWelcomeMessage(defaultWelcomeMessage);
        }
      } else {
        setTranslatedWelcomeMessage(defaultWelcomeMessage);
      }
    }
    translateWelcome();
  }, [selectedLanguage]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { user, isAuthenticated } = useAuth();

  // Language options - more compact display
  const languages = [
    { code: 'en', name: 'EN', fullName: 'English', flag: '🇺🇸' },
    { code: 'hi', name: 'हि', fullName: 'हिंदी', flag: '🇮🇳' },
    { code: 'gu', name: 'ગુ', fullName: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'te', name: 'తె', fullName: 'తెలుగు', flag: '🇮🇳' }
  ];

  // Map language code to browser speech recognition language
  const speechRecognitionLangs = {
    en: 'en-US',
    hi: 'hi-IN',
    gu: 'gu-IN',
    te: 'te-IN'
  };

  // Initialize language from user preferences, localStorage, or browser
  useEffect(() => {
    const storedLang = localStorage.getItem('meesho_selected_language');
    if (storedLang) {
      setSelectedLanguage(storedLang);
    } else if (user?.preferences?.language) {
      setSelectedLanguage(user.preferences.language);
      localStorage.setItem('meesho_selected_language', user.preferences.language);
    } else {
      // Auto-detect browser language if not set
      const browserLang = navigator.language ? navigator.language.split('-')[0] : 'en';
      setSelectedLanguage(browserLang);
      localStorage.setItem('meesho_selected_language', browserLang);
    }
  }, [user]);

  // Update localStorage when language changes
  const handleLanguageChange = (e) => {
    setSelectedLanguage(e.target.value);
    localStorage.setItem('meesho_selected_language', e.target.value);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText) => {
    if (!messageText.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Check if user is asking for recommendations
      const recommendationKeywords = [
        'recommend', 'recommendation', 'suggest', 'suggestion', 
        'what should i buy', 'show me products', 'for me',
        'recommended products', 'personal recommendations',
      ];
      
      const isRecommendationRequest = recommendationKeywords.some(keyword => 
        messageText.toLowerCase().includes(keyword.toLowerCase())
      );

      // If it's a recommendation request and user is authenticated, fetch ML recommendations
      if (isRecommendationRequest && isAuthenticated && user) {
        try {
          const token = localStorage.getItem('meesho_token');
          // Use the same endpoint as the cart page to get recommendations
          const recommendationsResponse = await axios.get(
            'http://localhost:7654/api/cart',
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );

          // Extract recommendations from the cart API response
          const recommendedProducts = recommendationsResponse.data?.data?.recommendations || [];
          if (recommendedProducts.length > 0) {
            const botMessage = {
              id: Date.now() + 1,
              text: `🎯 Here are my personalized recommendations for you based on your shopping behavior and preferences:`,
              sender: 'bot',
              timestamp: new Date(),
              products: recommendedProducts,
              recommendations: true
            };

            setMessages(prev => [...prev, botMessage]);
            setIsLoading(false);
            return;
          }
        } catch (recommendationError) {
          console.error('Failed to fetch recommendations:', recommendationError);
          // Continue with normal chat flow if recommendations fail
        }
      }

      // Input length validation for Dialogflow
      if (typeof messageText === 'string' && messageText.length > 256) {
        const errorMessage = {
          id: Date.now() + 1,
          text: 'Your message is too long for processing. Please send a shorter query (max 256 characters).',
          sender: 'bot',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsLoading(false);
        return;
      }

      // Send to our enhanced webhook with language support
      // Send to webhook with authentication headers
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add authorization header if user is authenticated
      const token = localStorage.getItem('meesho_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post('http://localhost:7654/api/webhook', {
        queryResult: {
          queryText: messageText,
          languageCode: selectedLanguage // Always include selected language
        },
        userId: user?.id || 'anonymous',
        languageCode: selectedLanguage
      }, { headers });

      // If backend returns a translated error message, show it
      let botMessageText = response.data.fulfillmentText;
      if (response.data.success === false && response.data.error && response.data.error.includes('256 character')) {
        botMessageText = response.data.fulfillmentText || 'Your message is too long for processing. Please send a shorter query (max 256 characters).';
      } else if (response.data.success === false && response.data.message) {
        botMessageText = response.data.message;
      }

      const botMessage = {
        id: Date.now() + 1,
        text: botMessageText,
        sender: 'bot',
        timestamp: new Date(),
        products: response.data.products || null,
        orders: response.data.fulfillmentMessages?.find(msg => msg.type === 'orders_list')?.orders || null,
        orderDetails: response.data.fulfillmentMessages?.find(msg => msg.type === 'order_details')?.order || null,
        mlAnalysis: response.data.mlAnalysis || null, // Add ML analysis data
        userProfile: response.data.userProfile || null, // Add user profile data
        session: response.data.session || null // Add session data
      };

      setMessages(prev => [...prev, botMessage]);

      // Text-to-speech for voice mode
      if (isVoiceMode && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(botMessageText);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        text: (error.response && error.response.data && error.response.data.message) ? error.response.data.message : "Sorry, I'm having trouble connecting. Please try again.",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = (product) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image
    });
    
    // Add confirmation message
    const confirmMessage = {
      id: Date.now(),
      text: `✅ Added "${product.name}" to your cart! You can continue shopping or go to cart to checkout.`,
      sender: 'bot',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, confirmMessage]);
  };

  const handleViewAllProducts = (searchTerm) => {
    // Navigate to products page with search filter
    if (searchTerm && searchTerm.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchTerm)}`);
    } else {
      navigate('/products');
    }
  };

  const handleSend = () => {
    sendMessage(inputText);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceResult = (transcript) => {
    console.log('Voice input received:', transcript);
    sendMessage(transcript);
  };

  const quickActions = [
    { text: "Show me dresses", action: () => sendMessage("Show me dresses") },
    { text: "Find phones", action: () => sendMessage("Find phones under 20000") },
    { text: "Recommend for me", action: () => sendMessage("Recommend products for me") },
    { text: "Track order", action: () => sendMessage("Track my order") },
    { text: "Help", action: () => sendMessage("I need help") }
  ];

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>🛍️ Meesho Assistant</h3>
        <div className="chat-header-controls">
          {/* Language Selector */}
          <div className="language-selector">
            <select 
              value={selectedLanguage} 
              onChange={handleLanguageChange}
              className="language-dropdown"
              title="Select Language"
            >
              {languages.map(lang => (
                <option key={lang.code} value={lang.code} title={lang.fullName}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>
          <div className="voice-indicator">
            {isVoiceMode && <span className="voice-active">🎙️ Voice Active</span>}
          </div>
        </div>
      </div>

      <div className="messages-container">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              <div className="message-text">{message.text}</div>
              
              {/* ML Analysis Indicator */}
              {message.mlAnalysis && (
                <div className="ml-analysis">
                  <small>
                    Flow: {message.mlAnalysis.flow} | 
                    Sentiment: {message.mlAnalysis.sentiment} | 
                    Intent: {message.mlAnalysis.intent}
                  </small>
                </div>
              )}
              
              {/* Product Cards Display */}
              {message.products && message.products.length > 0 && (
                <div className={`products-grid-chat ${message.recommendations ? 'recommendations-grid' : ''}`}>
                  {message.recommendations && (
                    <div className="recommendations-header">
                      <span className="ml-badge">🎯 ML Powered</span>
                      <small>Personalized based on your shopping behavior</small>
                    </div>
                  )}
                  {message.products.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      compact={true}
                    />
                  ))}
                  {!message.recommendations && (
                    <button 
                      className="view-all-products-btn"
                      onClick={() => navigate('/products')}
                    >
                      View All Products →
                    </button>
                  )}
                </div>
              )}
              
              {/* Order Details Display */}
              {message.orderDetails && (
                <div className="order-details-card">
                  <div className="order-header">
                    <h4>📦 Order Details</h4>
                    <span className={`order-status ${message.orderDetails.status}`}>
                      {message.orderDetails.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="order-info">
                    <p><strong>Order ID:</strong> {message.orderDetails.orderId}</p>
                    <p><strong>Total:</strong> ₹{message.orderDetails.pricing?.total || message.orderDetails.total}</p>
                    <p><strong>Items:</strong> {message.orderDetails.items?.length || 1} item{message.orderDetails.items?.length > 1 ? 's' : ''}</p>
                    {message.orderDetails.estimatedDelivery && (
                      <p><strong>Expected Delivery:</strong> {new Date(message.orderDetails.estimatedDelivery).toLocaleDateString('en-IN')}</p>
                    )}
                  </div>
                  {message.orderDetails.items && message.orderDetails.items.length > 0 && (
                    <div className="order-items">
                      <h5>Items:</h5>
                      {message.orderDetails.items.map((item, index) => (
                        <div key={index} className="order-item">
                          {item.image && <img src={item.image} alt={item.name} className="item-image" />}
                          <div className="item-details">
                            <span className="item-name">{item.name}</span>
                            <span className="item-quantity">Qty: {item.quantity}</span>
                            <span className="item-price">₹{item.price}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Orders List Display */}
              {message.orders && message.orders.length > 0 && (
                <div className="orders-list-card">
                  <div className="orders-header">
                    <h4>📋 Your Recent Orders</h4>
                    <span className="orders-count">{message.orders.length} orders</span>
                  </div>
                  <div className="orders-list">
                    {message.orders.map((order, index) => (
                      <div key={order._id} className="order-summary">
                        <div className="order-summary-header">
                          <span className="order-id">{order.orderId}</span>
                          <span className={`order-status-badge ${order.status}`}>
                            {order.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </div>
                        <div className="order-summary-details">
                          <span className="order-total">₹{order.pricing?.total || order.total}</span>
                          <span className="order-date">{new Date(order.createdAt).toLocaleDateString('en-IN')}</span>
                          <span className="order-items-count">{order.items?.length || 1} items</span>
                        </div>
                        <button 
                          className="track-order-btn"
                          onClick={() => sendMessage(`Track order ${order.orderId}`)}
                        >
                          Track Order
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="message-time">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="message bot">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="quick-actions">
        {quickActions.map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            className="quick-action-btn"
            disabled={isLoading}
          >
            {action.text}
          </button>
        ))}
      </div>

      <div className="chat-input">
        <div className="input-row">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message or try 'Show me dresses'..."
            disabled={isLoading}
            className="chat-input-field"
          />
          <button 
            onClick={handleSend} 
            disabled={isLoading || !inputText.trim()}
            className="send-btn"
          >
            Send
          </button>
        </div>
        
        <VoiceToggle 
          onVoiceResult={handleVoiceResult}
          onVoiceModeChange={setIsVoiceMode}
          disabled={isLoading}
          language={speechRecognitionLangs[selectedLanguage]}
        />
      </div>
    </div>
  );
};

export default ChatWindow;

