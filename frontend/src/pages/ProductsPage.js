import React, { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import axios from 'axios';
import './ProductsPage.css';

// Define your API base URL here, similar to what we did in AuthContext
const API_BASE_URL = 'http://localhost:7654/api'; // Adjust if your backend API path changes

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showSearchOptions, setShowSearchOptions] = useState(false);
  const [addedItems, setAddedItems] = useState(new Set()); // Track added items
  const { addToCart } = useCart();

  const categories = [
    'All', 'Fashion', 'Electronics', 'Home & Kitchen', 'Beauty & Personal Care',
    'Books', 'Sports & Fitness', 'Toys & Games', 'Groceries', 'Automotive',
    'Health & Wellness', 'Jewelry', 'Bags & Luggage', 'Pet Supplies',
    'Office Products', 'Musical Instruments'
  ];

  // Effect to fetch products on component mount
  useEffect(() => {
    fetchProducts();
  }, []); // Empty dependency array means it runs once on mount

  // Effect to filter products whenever products, searchQuery, or selectedCategory changes
  useEffect(() => {
    filterProducts();
  }, [products, searchQuery, selectedCategory]);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/products`); // Use API_BASE_URL
      if (response.data.success) {
        setProducts(response.data.products);
        setFilteredProducts(response.data.products); // Initialize filtered products
      } else {
        // Handle case where API returns success: false but no error
        setError(response.data.message || 'Failed to fetch products');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      // More detailed error message from Axios if available
      setError(err.response?.data?.message || 'Failed to load products. Please try again later.');
    } finally {
      // Ensure loading is set to false regardless of success or error
      setLoading(false);
    }
  };

  const filterProducts = () => {
    let currentFiltered = products; // Start with all products

    // Filter by search query
    if (searchQuery.trim()) {
      currentFiltered = currentFiltered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      currentFiltered = currentFiltered.filter(product => product.category === selectedCategory);
    }

    setFilteredProducts(currentFiltered); // Update the state with filtered results
  };

  const handleSearch = () => {
    // This button toggles the visibility of search options and then triggers filter
    setShowSearchOptions(!showSearchOptions);
    // filterProducts() is already called by the useEffect when searchQuery/selectedCategory changes
    // so no need to call it directly here unless you want immediate filtering on button click
    // even if query/category haven't changed.
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setShowSearchOptions(false); // Close dropdown after selection
  };

  const handleAddToCart = (product) => {
    addToCart({
      id: product.id, // Use product.id consistently, not _id
      name: product.name,
      price: product.price,
      image: product.image
    });

    // Add visual feedback for the specific product only
    setAddedItems(prev => new Set([...prev, product.id]));
    
    // Remove the visual feedback after 2 seconds
    setTimeout(() => {
      setAddedItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(product.id);
        return newSet;
      });
    }, 2000);
  };

  // Conditional rendering for loading, error, and main content
  if (loading) {
    return (
      <div className="products-page">
        <div className="loading">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="products-page">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="products-page">
      <div className="products-header">
        <h1>All Products</h1>
        <p>Discover amazing deals and quality products</p>
      </div>

      {/* Search Section */}
      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search for products, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-btn">
            🔍 Search
          </button>
        </div>

        {/* Selected Category Display */}
        {selectedCategory !== 'All' && (
          <div className="selected-category">
            <span>Category: {selectedCategory}</span>
            <button onClick={() => setSelectedCategory('All')} className="clear-filter">
              ✕ Clear
            </button>
          </div>
        )}

        {/* Search Options Dropdown */}
        {showSearchOptions && (
          <div className="search-options">
            <h4>Filter by Category:</h4>
            <div className="category-grid">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => handleCategorySelect(category)}
                  className={`category-option ${selectedCategory === category ? 'active' : ''}`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results Info */}
      <div className="results-info">
        <p>Showing {filteredProducts.length} products</p>
      </div>

      <div className="products-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <img src={product.image} alt={product.name} className="product-image" />
              <div className="product-details">
                <h3 className="product-name">{product.name}</h3>
                <p className="product-category">{product.category}</p>
                <div className="product-price">₹{product.price}</div>
                {/* Remove the rating display that shows "0" */}
                <button
                  onClick={() => handleAddToCart(product)}
                  className={`add-to-cart-btn ${addedItems.has(product.id) ? 'added' : ''}`}
                  disabled={!product.inStock}
                >
                  {addedItems.has(product.id)
                    ? '✓ Added to Cart'
                    : product.inStock
                      ? 'Add to Cart'
                      : 'Out of Stock'
                  }
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="no-results">
            <h3>No products found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;