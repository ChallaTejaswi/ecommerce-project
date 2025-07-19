import React, { useState } from 'react';
import './ProductCard.css';

const ProductCard = ({ product, onAddToCart, compact = false }) => {
  const [isAdded, setIsAdded] = useState(false);

  const handleAddToCart = () => {
    if (onAddToCart) {
      onAddToCart(product);
      setIsAdded(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setIsAdded(false);
      }, 2000);
    }
  };

  // Use different styles based on where it's being used
  const cardClass = compact ? 'product-card-chat' : 'product-card';
  const imageClass = compact ? 'product-image-chat' : 'product-image';
  const detailsClass = compact ? 'product-details-chat' : 'product-info';
  const nameClass = compact ? 'product-name-chat' : 'product-name';
  const categoryClass = compact ? 'product-category-chat' : 'product-category';
  const priceClass = compact ? 'product-price-chat' : 'product-price';
  const ratingClass = compact ? 'product-rating-chat' : 'product-rating';
  const buttonClass = compact ? 'add-to-cart-btn-chat' : 'add-to-cart-btn';

  return (
    <div className={`${cardClass} ${compact ? 'compact' : ''}`}>
      <img 
        src={product.image || product.images?.[0]} 
        alt={product.name} 
        className={imageClass}
        onError={(e) => {
          e.target.src = 'https://via.placeholder.com/150x150?text=No+Image';
        }}
      />
      <div className={detailsClass}>
        <h3 className={nameClass}>{product.name}</h3>
        {product.category && <p className={categoryClass}>{product.category}</p>}
        <div className={priceClass}>₹{product.price}</div>
        {product.rating > 0 && (
          <div className={ratingClass}>
            ⭐ {product.rating}
          </div>
        )}
        <button 
          onClick={handleAddToCart}
          className={`${buttonClass} ${isAdded ? 'added' : ''}`}
          disabled={!product.inStock}
        >
          {isAdded 
            ? '✓ Added' 
            : product.inStock 
              ? 'Add to Cart' 
              : 'Out of Stock'
          }
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
//     >
//       {card.imageUri && (
//         <CardMedia
//           component="img"
//           height="180"
//           image={card.imageUri}
//           alt={card.title}
//           sx={{ objectFit: 'cover' }}
//         />
//       )}
      
//       <CardContent sx={{ pb: 1 }}>
//         <Typography 
//           variant="h6" 
//           component="h3"
//           sx={{ 
//             fontWeight: 600,
//             fontSize: '1rem',
//             lineHeight: 1.3,
//             mb: 1
//           }}
//         >
//           {card.title}
//         </Typography>
        
//         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
//           <Typography 
//             variant="h6" 
//             color="primary"
//             sx={{ fontWeight: 700 }}
//           >
//             {price}
//           </Typography>
//           {brand && (
//             <Chip 
//               label={brand} 
//               size="small" 
//               variant="outlined"
//               sx={{ fontSize: '0.7rem' }}
//             />
//           )}
//         </Box>

//         {/* Mock rating */}
//         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//           <Rating value={4.2} precision={0.1} size="small" readOnly />
//           <Typography variant="caption" color="text.secondary">
//             (4.2)
//           </Typography>
//         </Box>
//       </CardContent>

//       <CardActions sx={{ pt: 0, px: 2, pb: 2 }}>
//         {card.buttons?.map((button, index) => (
//           <Button
//             key={index}
//             variant={button.text.includes('Add') ? 'contained' : 'outlined'}
//             size="small"
//             startIcon={
//               button.text.includes('Add') ? <ShoppingCart /> : <Visibility />
//             }
//             onClick={() => handleAction(button.postback)}
//             sx={{ 
//               borderRadius: 20,
//               textTransform: 'none',
//               fontSize: '0.8rem'
//             }}
//           >
//             {button.text}
//           </Button>
//         ))}
//       </CardActions>
//     </Card>
//   );
// };

//export default ProductCard;
