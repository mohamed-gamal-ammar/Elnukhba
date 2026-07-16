import React from 'react';
import { Heart, ShoppingCart, Star, Eye } from 'lucide-react';
import { Product } from '../types.js';

interface ProductCardProps {
  key?: any;
  product: Product;
  isWishlisted: boolean;
  onNavigate: any;
  onToggleWishlist: any;
  onAddToCart: any;
}

export default function ProductCard({
  product,
  isWishlisted,
  onNavigate,
  onToggleWishlist,
  onAddToCart
}: ProductCardProps) {
  const isOutOfStock = product.stock === 0;
  const originalPrice = product.price;
  const currentPrice = product.discountPrice || product.price;
  const hasDiscount = product.discountPrice !== undefined && product.discountPrice < product.price;
  const discountPercent = hasDiscount ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

  return (
    <div
      onClick={() => onNavigate('product-details', product.id)}
      className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-amber-500/30 transition-all duration-300 flex flex-col justify-between group overflow-hidden cursor-pointer h-full relative"
      id={`product-card-${product.id}`}
    >
      {/* Badges row & Wishlist heart button */}
      <div className="absolute top-3.5 inset-x-3.5 z-10 flex justify-between items-start pointer-events-none">
        {/* Discount badge */}
        <div className="flex flex-col gap-1.5 pointer-events-auto">
          {hasDiscount && (
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-1 rounded-md shadow-md">
              وفر {discountPercent}%
            </span>
          )}
          {product.isFlashSale && (
            <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded-md shadow-md animate-pulse">
              فلاش سيل ⚡
            </span>
          )}
          {product.isBestSeller && (
            <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-md shadow-md">
              الأكثر مبيعاً 🔥
            </span>
          )}
        </div>

        {/* Wishlist Heart Icon (Interactive) */}
        <button
          onClick={(e) => onToggleWishlist(product.id, e)}
          className="pointer-events-auto p-2 bg-white/90 rounded-full border border-gray-100 shadow-md text-gray-400 hover:text-rose-500 hover:bg-white hover:scale-110 active:scale-95 transition-all cursor-pointer"
          aria-label="أضف للمفضلة"
        >
          <Heart className={`w-4.5 h-4.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>

      {/* Product Image section with zoom */}
      <div className="relative aspect-square w-full bg-gray-50 overflow-hidden">
        <img
          src={product.mainImage}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
          loading="lazy"
        />
        {/* Cover overlay show details */}
        <div className="absolute inset-0 bg-slate-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-slate-900/90 text-white text-xs font-black px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            <Eye className="w-4 h-4" />
            عرض تفاصيل الجهاز
          </span>
        </div>
      </div>

      {/* Product Content Details */}
      <div className="p-4 flex flex-col flex-1">
        {/* Brand and Category tag */}
        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mb-1.5">
          <span className="text-amber-600 bg-amber-500/15 px-2 py-0.5 rounded-full">{product.brand}</span>
          <span>{product.category}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 mb-2 group-hover:text-amber-600 transition-colors">
          {product.title}
        </h3>

        {/* Rating stars */}
        <div className="flex items-center gap-1 mb-3">
          <div className="flex items-center text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-amber-400' : 'text-gray-200'}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-gray-500 font-bold">({product.reviewsCount})</span>
        </div>

        {/* Variants count indicator */}
        {product.variants && product.variants.length > 1 && (
          <div className="text-[10px] text-gray-400 font-medium mb-3">
            يتوفر بـ <strong className="text-slate-600">{product.variants.length} خيارات بديلة</strong>
          </div>
        )}

        {/* Price Tag Row */}
        <div className="mt-auto flex flex-col gap-0.5 justify-end">
          {hasDiscount ? (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-slate-900">{currentPrice} ج.م</span>
              <span className="text-xs text-gray-400 line-through">{originalPrice} ج.م</span>
            </div>
          ) : (
            <span className="text-lg font-black text-slate-900">{originalPrice} ج.م</span>
          )}
          {isOutOfStock ? (
            <span className="text-[10px] text-red-500 font-black mt-1">نفد المخزون مؤقتاً ⚠️</span>
          ) : product.stock <= 3 ? (
            <span className="text-[10px] text-amber-600 font-black mt-0.5">متبقي {product.stock} وحدات فقط!</span>
          ) : (
            <span className="text-[10px] text-green-600 font-bold mt-0.5">متاح بالمخزن للتسليم الفوري ⚡</span>
          )}
        </div>
      </div>

      {/* Actions footer buttons */}
      <div className="px-4 pb-4 pt-1 flex gap-2">
        {isOutOfStock ? (
          <button
            disabled
            className="w-full py-2 bg-gray-150 text-gray-400 rounded-lg text-xs font-black border border-gray-200/50 cursor-not-allowed text-center"
          >
            طلب مسبق قريباً
          </button>
        ) : (
          <button
            onClick={(e) => onAddToCart(product, e)}
            className="w-full py-2 bg-slate-900 hover:bg-amber-500 text-white hover:text-slate-950 rounded-lg text-xs font-black transition-all duration-350 flex items-center justify-center gap-1.5 shadow-xs border border-slate-900/10 hover:border-amber-500 pointer-events-auto cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            أضف للسلة
          </button>
        )}
      </div>
    </div>
  );
}
