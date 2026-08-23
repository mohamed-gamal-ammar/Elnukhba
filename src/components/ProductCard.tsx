import React from 'react';
import { Heart, ShoppingCart, Star, Eye, Sparkles, Truck, Tag } from 'lucide-react';
import { Product, Campaign } from '../types.js';
import { getMatchingCampaign } from './CampaignBanner.js';

interface ProductCardProps {
  key?: any;
  product: Product;
  isWishlisted: boolean;
  onNavigate: any;
  onToggleWishlist: any;
  onAddToCart: any;
  activeCampaigns?: Campaign[];
}

export default function ProductCard({
  product,
  isWishlisted,
  onNavigate,
  onToggleWishlist,
  onAddToCart,
  activeCampaigns
}: ProductCardProps) {
  const isOutOfStock = product.stock === 0;
  const originalPrice = product.price;
  const currentPrice = product.discountPrice || product.price;
  const hasDiscount = product.discountPrice !== undefined && product.discountPrice < product.price;
  const discountPercent = hasDiscount ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

  const matchingCampaign = activeCampaigns ? getMatchingCampaign(product, activeCampaigns) : null;

  return (
    <div
      onClick={() => onNavigate('product-details', product.id)}
      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between group overflow-hidden cursor-pointer h-full relative"
      id={`product-card-${product.id}`}
    >
      {/* Badges row & Wishlist heart button */}
      <div className="absolute top-3.5 inset-x-3.5 z-10 flex justify-between items-start pointer-events-none">
        {/* Discount & Campaign badges */}
        <div className="flex flex-col gap-1.5 pointer-events-auto items-start">
          {matchingCampaign && (
            <span className="bg-slate-900/90 dark:bg-slate-950/90 text-amber-300 text-[9px] font-black px-2 py-1 rounded-md shadow-md border border-amber-500/40 flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              {matchingCampaign.type === 'percentage' && `عروض ${matchingCampaign.name}: خصم ${matchingCampaign.value}%`}
              {matchingCampaign.type === 'fixed' && `عروض ${matchingCampaign.name}: -${matchingCampaign.value} ج.م`}
              {matchingCampaign.type === 'free_shipping' && `عروض ${matchingCampaign.name}: شحن مجاني 🚚`}
            </span>
          )}
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
            <span className="bg-slate-900/90 dark:bg-slate-950/90 text-slate-200 border border-slate-700 text-[9px] font-black px-2 py-1 rounded-md shadow-md">
              الأكثر مبيعاً 🔥
            </span>
          )}
        </div>

        {/* Wishlist Heart Icon (Interactive) */}
        <button
          onClick={(e) => onToggleWishlist(product.id, e)}
          className="pointer-events-auto p-2 bg-white/90 dark:bg-slate-950/80 rounded-full border border-slate-200 dark:border-slate-800 shadow-md text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-110 active:scale-95 transition-all cursor-pointer"
          aria-label="أضف للمفضلة"
        >
          <Heart className={`w-4.5 h-4.5 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
        </button>
      </div>

      {/* Product Image section with zoom */}
      <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-950 overflow-hidden flex items-center justify-center">
        <img
          src={product.mainImage}
          alt={product.title}
          className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
          loading="lazy"
        />
        {/* Cover overlay show details */}
        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="bg-slate-900/95 text-white text-xs font-black px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xl border border-slate-700 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            <Eye className="w-4 h-4 text-amber-400" />
            عرض تفاصيل الجهاز
          </span>
        </div>
      </div>

      {/* Product Content Details */}
      <div className="p-4 flex flex-col flex-1">
        {/* Brand and Category tag */}
        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">
          <span className="text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">{product.brand}</span>
          <span className="text-slate-500 dark:text-slate-400">{product.category}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-2 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
          {product.title}
        </h3>

        {/* Rating stars */}
        <div className="flex items-center gap-1 mb-3">
          <div className="flex items-center text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">({product.reviewsCount})</span>
        </div>

        {/* Variants count indicator */}
        {product.variants && product.variants.length > 1 && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mb-3">
            يتوفر بـ <strong className="text-slate-800 dark:text-slate-200">{product.variants.length} خيارات بديلة</strong>
          </div>
        )}

        {/* Price Tag Row */}
        <div className="mt-auto flex flex-col gap-0.5 justify-end">
          {hasDiscount ? (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-slate-900 dark:text-white">{currentPrice} ج.م</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 line-through">{originalPrice} ج.م</span>
            </div>
          ) : (
            <span className="text-lg font-black text-slate-900 dark:text-white">{originalPrice} ج.م</span>
          )}
          {matchingCampaign && !isOutOfStock && (
            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded mt-0.5 self-start">
              مشمول بتخفيضات {matchingCampaign.name}
            </span>
          )}
          {isOutOfStock ? (
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-black mt-1">نفد المخزون مؤقتاً ⚠️</span>
          ) : product.stock <= 3 ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black mt-0.5">متبقي {product.stock} وحدات فقط!</span>
          ) : (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">متاح بالمخزن للتسليم الفوري ⚡</span>
          )}
        </div>
      </div>

      {/* Actions footer buttons */}
      <div className="px-4 pb-4 pt-1 flex gap-2">
        {isOutOfStock ? (
          <button
            disabled
            className="w-full py-2 bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-500 rounded-lg text-xs font-black border border-slate-200 dark:border-slate-800 cursor-not-allowed text-center"
          >
            طلب مسبق قريباً
          </button>
        ) : (
          <button
            onClick={(e) => onAddToCart(product, e)}
            className="w-full py-2 bg-slate-900 dark:bg-slate-950 hover:bg-amber-500 dark:hover:bg-amber-500 text-white dark:text-slate-100 hover:text-slate-950 dark:hover:text-slate-950 rounded-lg text-xs font-black transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm border border-slate-800 dark:border-slate-800 hover:border-amber-500 pointer-events-auto cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            أضف للسلة
          </button>
        )}
      </div>
    </div>
  );
}
