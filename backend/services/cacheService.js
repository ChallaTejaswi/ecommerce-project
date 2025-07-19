// Cache Service for better performance
class CacheService {
  constructor() {
    this.cache = new Map();
    this.ttl = 5 * 60 * 1000; // 5 minutes TTL
  }
  
  // Generate cache key
  generateKey(query, filters = {}) {
    return `search_${query}_${JSON.stringify(filters)}`;
  }
  
  // Get from cache
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`📦 Cache HIT for key: ${key}`);
    return item.data;
  }
  
  // Set cache
  set(key, data) {
    console.log(`💾 Cache SET for key: ${key}`);
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }
  
  // Clear cache
  clear() {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }
  
  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
