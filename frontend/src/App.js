import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import OrdersPage from './pages/OrdersPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import ChatWindow from './components/ChatWindow';
import './App.css';

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <AuthProvider>
      <CartProvider>
        <div className="App">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Routes>
          </main>

          {/* ChatWindow Widget Integration */}
          <div className="chatbot-widget">
            {/* Render ChatWindow component only when isChatOpen is true */}
            {isChatOpen && <ChatWindow />}
            <button
              className="chatbot-toggle-button"
              onClick={() => setIsChatOpen(!isChatOpen)}
            >
              {isChatOpen ? '✖️' : '💬'}
            </button>
          </div>
        </div>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
