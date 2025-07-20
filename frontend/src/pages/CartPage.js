import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CartPage.css';

const CartPage = () => {
  const { cartItems, updateQuantity, removeFromCart, clearCart, addToCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const [mlCartData, setMlCartData] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Fetch ML-enhanced cart data
  useEffect(() => {
    if (isAuthenticated) {
      syncCartWithBackend();
      fetchMLCartData();
    }
  }, [isAuthenticated, cartItems]);

  // Fetch top 5 recommended products for cart page
  useEffect(() => {
    async function fetchRecommendations() {
      if (!isAuthenticated || !user?.id) return;
      try {
        // Fetch recommendations from cart API
        const response = await axios.get('https://ecommerce-project-1-gm35.onrender.com/api/cart');
        // Use response.data.data.recommendations for both fallback and ML recommendations
        const recs = response.data?.data?.recommendations || [];
        setRecommendations(recs.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch recommendations:', err);
      }
    }
    fetchRecommendations();
  }, [isAuthenticated, user, cartItems]);

  // Sync frontend cart with backend
  const syncCartWithBackend = async () => {
    try {
      const token = localStorage.getItem('meesho_token');
      if (!token || cartItems.length === 0) return;

      console.log('🔄 Syncing cart with backend...');
      
      // Add each cart item to backend if not already there
      for (const item of cartItems) {
        await axios.post('https://ecommerce-project-1-gm35.onrender.com/api/cart/add', {
          productId: item.id,
          quantity: item.quantity,
          addedVia: 'manual', // Use valid enum value
          mlRecommendationScore: 0.5
        }, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(error => {
          // Ignore errors for items already in cart
          console.log(`Item ${item.name} already in backend cart or error:`, error.response?.data?.message);
        });
      }
      
      console.log('✅ Cart sync completed');
    } catch (error) {
      console.error('❌ Cart sync failed:', error);
    }
  };

  const fetchMLCartData = async () => {
    try {
      const token = localStorage.getItem('meesho_token');
      if (!token) {
        console.log('❌ No token found for ML cart data');
        return;
      }

      console.log('🔄 Fetching ML cart data...');
      const response = await axios.get('https://ecommerce-project-1-gm35.onrender.com/api/cart', {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('📊 ML Cart API Response:', response.data);

      if (response.data.success) {
        const data = response.data.data;
        setMlCartData(data);
        // Always use data.recommendations for display, fallback or ML
        setRecommendations(data.recommendations || []);
        // Ensure analytics has default values
        const analyticsData = data.analytics || {};
        setAnalytics({
          averageItemPrice: analyticsData.averageItemPrice || 0,
          chatDrivenItems: analyticsData.chatDrivenItems || 0,
          recommendationDrivenItems: analyticsData.recommendationDrivenItems || 0,
          abandonmentRisk: analyticsData.abandonmentRisk || 'low',
          lastActivity: analyticsData.lastActivity || new Date(),
          mostAddedCategory: analyticsData.mostAddedCategory || null
        });
        console.log('✅ ML Cart Data loaded:', {
          cart: !!data.cart,
          analytics: analyticsData,
          recommendations: data.recommendations?.length || 0,
          summary: data.summary
        });
        console.log('🔍 Analytics state set to:', analyticsData);
      } else {
        console.log('❌ ML Cart API failed:', response.data.message);
      }
    } catch (error) {
      console.error('❌ Failed to fetch ML cart data:', error.response?.data || error.message);
      // If cart API fails, create fallback analytics
      setAnalytics({
        averageItemPrice: cartItems.length > 0 ? cartItems.reduce((sum, item) => sum + item.price, 0) / cartItems.length : 0,
        chatDrivenItems: 0,
        recommendationDrivenItems: 0,
        abandonmentRisk: 'low',
        lastActivity: new Date()
      });
    }
  };

  const [shippingDetails, setShippingDetails] = useState({
    name: user?.name || '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    phoneNumber: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('cod');

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = Math.round(subtotal * 0.18); // 18% GST
  const shipping = subtotal > 500 ? 0 : 50; // Free shipping above ₹500
  const total = subtotal + tax + shipping;

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleCheckout = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setShowCheckout(true);
    setError('');
  };

  const handleAddRecommendation = async (product) => {
    try {
      const token = localStorage.getItem('meesho_token');
      if (!token) return;

      // Add to backend cart with ML tracking
      await axios.post('https://ecommerce-project-1-gm35.onrender.com/api/cart/add', {
        productId: product.id,
        quantity: 1,
        addedVia: 'recommendation', // Use valid enum value
        mlRecommendationScore: 0.9
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Add to frontend cart context
      const cartItem = {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image || product.images?.[0] || '/api/placeholder/200/200',
        quantity: 1
      };
      // Use the cart context's addToCart if available, otherwise use updateQuantity
      if (typeof addToCart === 'function') {
        addToCart(cartItem);
      } else {
        updateQuantity(product.id, 1);
      }

      // Refresh ML data
      fetchMLCartData();
      
      console.log('✅ Added recommendation to cart:', product.name);
    } catch (error) {
      console.error('Failed to add recommendation:', error);
    }
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🛒 Placing order with data:', {
        itemCount: cartItems.length,
        total,
        shippingDetails,
        paymentMethod
      });

      const orderData = {
        items: cartItems.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image || ''
        })),
        shippingAddress: shippingDetails,
        paymentMethod,
        notes: '',
        userEmail: user?.email || '',
        userName: user?.name || ''
      };

      const token = localStorage.getItem('meesho_token') || 'dummy_token';
      const response = await axios.post('https://ecommerce-project-1-gm35.onrender.com/api/orders', orderData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Order response:', response.data);

      if (response.data.success) {
        setOrderDetails(response.data.order);
        setOrderPlaced(true);
        clearCart();
        setShowCheckout(false);
      } else {
        setError(response.data.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('❌ Order placement error:', error);
      setError(error.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setShippingDetails({
      ...shippingDetails,
      [e.target.name]: e.target.value
    });
  };

  if (orderPlaced) {
    return (
      <div className="cart-page">
        <div className="order-success">
          <div className="success-icon">✅</div>
          <h2>Order Placed Successfully!</h2>
          <div className="order-details">
            <p><strong>Order ID:</strong> {orderDetails?.orderId}</p>
            <p><strong>Total Amount:</strong> ₹{orderDetails?.total}</p>
            <p><strong>Status:</strong> {orderDetails?.status?.replace('_', ' ').toUpperCase()}</p>
            <p><strong>Estimated Delivery:</strong> {orderDetails?.estimatedDelivery ? new Date(orderDetails.estimatedDelivery).toLocaleDateString() : '7-10 days'}</p>
          </div>
          <div className="success-actions">
            <button onClick={() => navigate('/orders')} className="view-orders-btn">
              View My Orders
            </button>
            <button onClick={() => navigate('/products')} className="continue-shopping-btn">
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="cart-page">
        <div className="empty-cart">
          <h2>Your cart is empty</h2>
          <p>Add some products to get started!</p>
          <button onClick={() => navigate('/products')} className="shop-now-btn">
            Shop Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-header">
        <h1>Shopping Cart</h1>
        <p>{cartItems.length} items in your cart</p>
      </div>

      <div className="cart-content">
        <div className="cart-items">
          {cartItems.map(item => (
            <div key={item.id} className="cart-item">
              <img src={item.image} alt={item.name} className="item-image" />
              <div className="item-details">
                <h3>{item.name}</h3>
                <p className="item-price">₹{item.price}</p>
                <div className="quantity-controls">
                  <button 
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    className="qty-btn"
                  >
                    -
                  </button>
                  <span className="quantity">{item.quantity}</span>
                  <button 
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                    className="qty-btn"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="item-total">
                <p>₹{item.price * item.quantity}</p>
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="remove-btn"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <h3>Order Summary</h3>
          <div className="summary-line">
            <span>Subtotal:</span>
            <span>₹{subtotal}</span>
          </div>
          <div className="summary-line">
            <span>Tax (18% GST):</span>
            <span>₹{tax}</span>
          </div>
          <div className="summary-line">
            <span>Shipping:</span>
            <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
          </div>
          <div className="summary-total">
            <span>Total:</span>
            <span>₹{total}</span>
          </div>
          {error && <div className="error-message">{error}</div>}
          <button onClick={handleCheckout} className="checkout-btn" disabled={loading}>
            {loading ? 'Processing...' : 'Proceed to Checkout'}
          </button>
        </div>
      </div>



      {/* ML Recommendations */}
      <div className="ml-recommendations">
        <h2>🎯 Recommended for You</h2>
        <p className="recommendations-subtitle">Based on your cart and browsing behavior</p>
        {recommendations.length > 0 ? (
          <div className="recommendations-grid">
            {recommendations.map((rec, index) => (
              <div key={index} className="recommendation-card">
                <img src={rec.image || '/api/placeholder/200/200'} alt={rec.name} />
                <div className="rec-details">
                  <h4>{rec.name}</h4>
                  <p className="rec-price">₹{rec.price}</p>
                  <p className="rec-category">{rec.category}</p>
                  <div className="rec-meta">
                    <span className="rec-rating">Rating: {rec.rating}</span>
                  </div>
                  <button 
                    className="add-rec-btn"
                    onClick={() => handleAddRecommendation(rec)}
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-recommendations">
            <p>🤔 Add more items to your cart to get personalized recommendations!</p>
            <p>Our engine learns from your shopping patterns to suggest perfect products.</p>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="checkout-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Checkout</h2>
              <button 
                onClick={() => setShowCheckout(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="checkout-form">
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-section">
                <h3>Shipping Address</h3>
                <div className="form-row">
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={shippingDetails.name}
                    onChange={handleInputChange}
                    required
                  />
                  <input
                    type="tel"
                    name="phoneNumber"
                    placeholder="Phone Number"
                    value={shippingDetails.phoneNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <input
                  type="text"
                  name="street"
                  placeholder="Street Address"
                  value={shippingDetails.street}
                  onChange={handleInputChange}
                  required
                />
                <div className="form-row">
                  <input
                    type="text"
                    name="city"
                    placeholder="City"
                    value={shippingDetails.city}
                    onChange={handleInputChange}
                    required
                  />
                  <input
                    type="text"
                    name="state"
                    placeholder="State"
                    value={shippingDetails.state}
                    onChange={handleInputChange}
                    required
                  />
                  <input
                    type="text"
                    name="zipCode"
                    placeholder="ZIP Code"
                    value={shippingDetails.zipCode}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Payment Method</h3>
                <div className="payment-options">
                  <label>
                    <input
                      type="radio"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    Cash on Delivery
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    Credit/Debit Card
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    />
                    UPI Payment
                  </label>
                </div>
              </div>

              <div className="form-section">
                <h3>Order Summary</h3>
                <div className="checkout-summary">
                  <div className="summary-line">
                    <span>Subtotal:</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="summary-line">
                    <span>Tax:</span>
                    <span>₹{tax}</span>
                  </div>
                  <div className="summary-line">
                    <span>Shipping:</span>
                    <span>{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
                  </div>
                  <div className="summary-total">
                    <span>Total:</span>
                    <span>₹{total}</span>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="cancel-btn"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="place-order-btn"
                >
                  {loading ? 'Placing Order...' : 'Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
