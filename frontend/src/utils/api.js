import axios from 'axios';

const API_BASE_URL = 'http://localhost:7654/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('meesho_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('meesho_token');
      localStorage.removeItem('meesho_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
