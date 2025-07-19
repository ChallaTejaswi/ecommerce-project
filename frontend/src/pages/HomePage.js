import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { useCart } from '../context/CartContext';
import './HomePage.css';

const HomePage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axios.get('http://localhost:7654/api/products');
        if (response.data.success) {
          setProducts(response.data.products);
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  return (
    <div className="homepage">
      <header className="hero-section">
        <h1>Welcome to Meesho</h1>
        <p>Discover the best products at unbeatable prices.</p>
        <Link to="/products" className="hero-button">Shop Now</Link>
      </header>

      <main className="featured-products">
        <h2>Featured Products</h2>
        {loading ? (
          <p>Loading products...</p>
        ) : (
          <div className="product-grid">
            {products.slice(0, 3).map(product => (
              <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
            ))}
          </div>
        )}
        <div className="view-all-container">
          <Link to="/products" className="view-all-link">View All Products</Link>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
