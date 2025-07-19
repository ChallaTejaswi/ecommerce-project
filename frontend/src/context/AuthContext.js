import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:7654/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing token/user in localStorage on component mount
  useEffect(() => {
    const token = localStorage.getItem('meesho_token');
    const storedUser = localStorage.getItem('meesho_user');

    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Failed to parse stored user data:", e);
        // Clear invalid data
        localStorage.removeItem('meesho_token');
        localStorage.removeItem('meesho_user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      });

      if (response.data.success) {
        const { user: userData, token, mlSession } = response.data.data;
        
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('meesho_token', token);
        localStorage.setItem('meesho_user', JSON.stringify(userData));
        
        // Set axios default authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        console.log('✅ Login successful with ML analytics:', mlSession);
        setLoading(false);
        return { success: true, user: userData, mlSession };
      }
      
      throw new Error(response.data.message || 'Login failed');
    } catch (error) {
      setLoading(false);
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Login failed'
      };
    }
  };

  const signup = async (name, email, password, preferences = {}) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, {
        name,
        email,
        password,
        preferences: {
          language: 'en',
          voiceEnabled: true,
          ...preferences
        }
      });

      if (response.data.success) {
        const { user: userData, token } = response.data.data;
        
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('meesho_token', token);
        localStorage.setItem('meesho_user', JSON.stringify(userData));
        
        // Set axios default authorization header
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        console.log('✅ Registration successful');
        setLoading(false);
        return { success: true, user: userData };
      }
      
      throw new Error(response.data.message || 'Registration failed');
    } catch (error) {
      setLoading(false);
      console.error('Signup error:', error);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Registration failed'
      };
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('meesho_token');
    localStorage.removeItem('meesho_user');
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    signup,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#667eea'
        }}>
          Loading...
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};