import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'all',
    search: '',
    page: 1
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState({
    status: '',
    note: ''
  });
  const navigate = useNavigate();

  const statusOptions = [
    { value: 'order_placed', label: 'Order Placed', color: '#007bff' },
    { value: 'confirmed', label: 'Confirmed', color: '#28a745' },
    { value: 'shipped', label: 'Shipped', color: '#ffc107' },
    { value: 'out_for_delivery', label: 'Out for Delivery', color: '#fd7e14' },
    { value: 'delivered', label: 'Delivered', color: '#28a745' },
    { value: 'cancelled', label: 'Cancelled', color: '#dc3545' }
  ];

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }
    
    fetchOrders();
    fetchAnalytics();
  }, [filters]);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get('http://localhost:7654/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` },
        params: filters
      });
      
      if (response.data.success) {
        setOrders(response.data.orders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      if (error.response?.status === 401) {
        navigate('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await axios.get('http://localhost:7654/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setAnalytics(response.data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const handleStatusUpdate = async (orderId) => {
    try {
      const token = localStorage.getItem('admin_token');
      await axios.put(`http://localhost:7654/api/admin/orders/${orderId}/status`, statusUpdate, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedOrder(null);
      setStatusUpdate({ status: '', note: '' });
      fetchOrders();
      fetchAnalytics();
      alert('Order status updated successfully!');
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update order status');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/admin/login');
  };

  const getStatusColor = (status) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return statusOption?.color || '#6c757d';
  };

  const getStatusLabel = (status) => {
    const statusOption = statusOptions.find(opt => opt.value === status);
    return statusOption?.label || status;
  };

  if (loading) {
    return <div className="admin-loading">Loading orders...</div>;
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>🛍️ Meesho Admin Dashboard</h1>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>

      {/* Analytics Cards */}
      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Total Orders</h3>
          <div className="analytics-number">{analytics.totalOrders || 0}</div>
        </div>
        <div className="analytics-card">
          <h3>Total Revenue</h3>
          <div className="analytics-number">₹{analytics.totalRevenue || 0}</div>
        </div>
        <div className="analytics-card">
          <h3>Pending Orders</h3>
          <div className="analytics-number">{analytics.ordersByStatus?.order_placed || 0}</div>
        </div>
        <div className="analytics-card">
          <h3>Delivered Orders</h3>
          <div className="analytics-number">{analytics.ordersByStatus?.delivered || 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Status Filter:</label>
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
          >
            <option value="all">All Orders</option>
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search by Order ID or Email"
            value={filters.search}
            onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="orders-section">
        <h2>Orders Management</h2>
        <div className="orders-table">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order._id}>
                  <td className="order-id">{order.orderId}</td>
                  <td>
                    <div className="customer-info">
                      <div>{order.userName}</div>
                      <div className="customer-email">{order.userEmail}</div>
                    </div>
                  </td>
                  <td>{order.items.length} items</td>
                  <td className="total">₹{order.pricing.total}</td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(order.status) }}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button 
                      className="update-btn"
                      onClick={() => {
                        setSelectedOrder(order);
                        setStatusUpdate({ status: order.status, note: '' });
                      }}
                    >
                      Update Status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Update Modal */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Update Order Status: {selectedOrder.orderId}</h3>
            
            <div className="form-group">
              <label>New Status:</label>
              <select 
                value={statusUpdate.status}
                onChange={(e) => setStatusUpdate({...statusUpdate, status: e.target.value})}
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Note (Optional):</label>
              <textarea
                value={statusUpdate.note}
                onChange={(e) => setStatusUpdate({...statusUpdate, note: e.target.value})}
                placeholder="Add a note about this status change..."
              />
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => handleStatusUpdate(selectedOrder.orderId)}
                className="save-btn"
              >
                Update Status
              </button>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
