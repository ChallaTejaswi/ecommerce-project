import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './OrdersPage.css';

const OrdersPage = () => {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('meesho_token');
      const response = await axios.get('http://localhost:7654/api/orders', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setOrders(response.data.orders);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'order_placed': '#007bff',
      'confirmed': '#28a745',
      'shipped': '#ffc107',
      'out_for_delivery': '#fd7e14',
      'delivered': '#28a745',
      'cancelled': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'order_placed': 'Order Placed',
      'confirmed': 'Confirmed',
      'shipped': 'Shipped',
      'out_for_delivery': 'Out for Delivery',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  };

  if (!isAuthenticated) {
    return (
      <div className="orders-page">
        <div className="auth-required">
          <h2>Please login to view your orders</h2>
          <p>You need to be logged in to access your order history.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="orders-page">
        <div className="loading">Loading your orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orders-page">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>My Orders</h1>
        <p>Track and manage your orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="no-orders">
          <h3>No orders yet</h3>
          <p>When you place orders, they will appear here.</p>
        </div>
      ) : (
          <div className="orders-list">
            {orders.map(order => (
  <div key={order.orderId} className="order-card">
    <div className="order-header">
      <div className="order-id">
        <strong>Order #{order.orderId}</strong>
      </div>
      <div 
        className="order-status"
        style={{ backgroundColor: getStatusColor(order.status) }}
      >
        {getStatusLabel(order.status)}
      </div>
    </div>
    
    <div className="order-details">
      <div className="order-items">
        <h4>Items ({order.items.length})</h4>
        {order.items.map((item, index) => (
          <div key={index} className="order-item">
            <img
              src={item.image || 'https://via.placeholder.com/60'}
              alt={item.name}
              className="item-image"
              width={60}
              height={60}
              style={{ borderRadius: '8px', marginRight: '12px', objectFit: 'cover' }}
            />
            <div className="item-info">
              <span className="item-name">{item.name}</span>
              <span className="item-qty">Qty: {item.quantity}</span>
            </div>
            <div className="item-price">₹{item.subtotal}</div>
          </div>
        ))}
      </div>
      
      <div className="order-summary">
        <div className="order-total">
          <strong>Total: ₹{order.total}</strong>
        </div>
        <div className="order-date">
          Ordered on {new Date(order.createdAt).toLocaleDateString()}
        </div>
        {order.estimatedDelivery && (
          <div className="estimated-delivery">
            Expected delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  </div>
))}
  
          
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
