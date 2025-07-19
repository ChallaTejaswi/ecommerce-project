const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: String,
  helpful: { type: Number, default: 0 },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

const variantSchema = new mongoose.Schema({
  variantId: { type: String, required: true },
  attributes: {
    color: String,
    size: String,
    material: String
  },
  price: { type: Number, required: true },
  salePrice: Number,
  inventory: {
    quantity: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 }
  },
  images: [String]
});

const productSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    text: true
  },
  description: {
    type: String,
    required: true,
    text: true
  },
  shortDescription: String,
  category: {
    type: String,
    required: true,
    index: true
  },
  subcategory: {
    type: String,
    index: true
  },
  brand: {
    type: String,
    required: true,
    index: true
  },
  price: {
    type: Number,
    required: true,
    index: true
  },
  salePrice: Number,
  currency: {
    type: String,
    default: 'INR'
  },
  images: [String],
  variants: [variantSchema],
  attributes: {
    color: [String],
    size: [String],
    material: String,
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    }
  },
  inventory: {
    inStock: {
      type: Boolean,
      default: true
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0
    },
    lowStockThreshold: {
      type: Number,
      default: 10
    }
  },
  ratings: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    },
    distribution: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    }
  },
  reviews: [reviewSchema],
  tags: [String],
  searchKeywords: [String],
  seo: {
    metaTitle: String,
    metaDescription: String,
    slug: String
  },
  shipping: {
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    freeShipping: { type: Boolean, default: false },
    shippingCost: Number
  },
  analytics: {
    views: { type: Number, default: 0 },
    addToCart: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    conversions: { type: Number, default: 0 }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for search optimization
productSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
  'attributes.material': 'text'
});

productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ price: 1 });
productSchema.index({ 'ratings.average': -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ isActive: 1, isFeatured: 1 });

// Virtual for discounted price
productSchema.virtual('discountPercentage').get(function() {
  if (this.salePrice && this.salePrice < this.price) {
    return Math.round(((this.price - this.salePrice) / this.price) * 100);
  }
  return 0;
});

// Method to update analytics
productSchema.methods.incrementView = function() {
  this.analytics.views += 1;
  return this.save();
};

productSchema.methods.incrementAddToCart = function() {
  this.analytics.addToCart += 1;
  return this.save();
};

productSchema.methods.incrementPurchase = function() {
  this.analytics.purchases += 1;
  this.analytics.conversions = this.analytics.addToCart > 0 
    ? (this.analytics.purchases / this.analytics.addToCart) * 100 
    : 0;
  return this.save();
};

// Method to add review and update ratings
productSchema.methods.addReview = function(reviewData) {
  this.reviews.push(reviewData);
  
  // Recalculate ratings
  const totalReviews = this.reviews.length;
  const sumRatings = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.ratings.average = sumRatings / totalReviews;
  this.ratings.count = totalReviews;
  
  // Update distribution
  this.ratings.distribution[reviewData.rating] += 1;
  
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);
