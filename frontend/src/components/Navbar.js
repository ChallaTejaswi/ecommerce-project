import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { cartItems } = useCart();
  const { user, isAuthenticated, logout } = useAuth();
  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleLogout = () => {
    logout();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          🛍️ Meesho
        </Link>
        <ul className="nav-menu">
          <li className="nav-item">
            <Link to="/" className="nav-links">Home</Link>
          </li>
          <li className="nav-item">
            <Link to="/products" className="nav-links">Products</Link>
          </li>
          <li className="nav-item">
            <Link to="/cart" className="nav-links cart-link">
              Cart
              {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
            </Link>
          </li>
          {isAuthenticated && (
            <li className="nav-item">
              <Link to="/orders" className="nav-links">Orders</Link>
            </li>
          )}
          {isAuthenticated ? (
            <>
              <li className="nav-item">
                <span className="user-greeting">Hi, {user?.name || 'User'}!</span>
              </li>
              <li className="nav-item">
                <button onClick={handleLogout} className="logout-btn">Logout</button>
              </li>
            </>
          ) : (
            <>
              <li className="nav-item">
                <Link to="/login" className="nav-links">Login</Link>
              </li>
              <li className="nav-item">
                <Link to="/signup" className="nav-links signup-link">Sign Up</Link>
              </li>
            </>
          )}
          {/* Admin Panel Link */}
          <li className="nav-item">
            <Link to="/admin/login" className="nav-links admin-link">Admin</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;