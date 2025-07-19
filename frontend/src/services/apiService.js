import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7654/api';

class ApiService {
  constructor() {
    this.axios = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        console.log('API Request:', config.method?.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        return response.data;
      },
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  // Webhook endpoint for Dialogflow
  async sendMessage(messageData) {
    try {
      const response = await this.axios.post('/webhook', messageData);
      return response;
    } catch (error) {
      throw new Error('Failed to send message');
    }
  }

  async getProducts() {
    try {
      const response = await this.axios.get('/products');
      return response.data;
    } catch (error) {
      console.error('Products API Error:', error);
      throw new Error('Failed to fetch products');
    }
  }

  // Product endpoints
  async searchProducts(params) {
    try {
      const response = await this.axios.get('/products', { params });
      return response;
    } catch (error) {
      throw new Error('Failed to search products');
    }
  }

  async getProduct(productId) {
    try {
      const response = await this.axios.get(`/products/${productId}`);
      return response;
    } catch (error) {
      throw new Error('Failed to get product details');
    }
  }

  // Order endpoints
  async createOrder(orderData) {
    try {
      const response = await this.axios.post('/orders', orderData);
      return response;
    } catch (error) {
      throw new Error('Failed to create order');
    }
  }

  async getOrderStatus(orderId) {
    try {
      const response = await this.axios.get(`/orders/${orderId}/status`);
      return response;
    } catch (error) {
      throw new Error('Failed to get order status');
    }
  }

  // Recommendation endpoints
  async getRecommendations(userId, params = {}) {
    try {
      const response = await this.axios.get(`/recommendations/${userId}`, { params });
      return response;
    } catch (error) {
      throw new Error('Failed to get recommendations');
    }
  }

  // Analytics
  async trackInteraction(interactionData) {
    try {
      await this.axios.post('/analytics/interaction', interactionData);
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }
}

export default new ApiService();
