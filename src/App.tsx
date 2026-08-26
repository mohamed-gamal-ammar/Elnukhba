import React, { useState, useEffect, lazy, Suspense, useMemo, useRef } from 'react';
import {
  ShoppingCart, Heart, Trash2, ArrowRight, Star, Plus, Minus,
  Tag, Check, HelpCircle, PhoneCall, Info, MapPin, Truck, ShieldCheck, Sparkles, ChevronLeft,
  RotateCcw, X, Clock, Users, LogOut, Bell, Lock, AlertCircle, ShieldAlert, Share2, ExternalLink
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from './lib/api.js';
import { useCustomerAuth } from './context/CustomerAuthContext.js';
import { useAdminAuth, isSuperAdminUser, hasAdminTabPermission, getFirstAllowedAdminTab } from './context/AdminAuthContext.js';
import { Product, CartItem, Order, Coupon, SystemSettings, ShippingDetails, ProductVariant, Campaign, CurrentAdmin, getProductTimestamp } from './types.js';
import Header from './components/Header.js';
import Footer from './components/Footer.js';
import SEOManager from './components/SEOManager.js';
import HeroSlider from './components/HeroSlider.js';
import ProductCard from './components/ProductCard.js';
import ProductFilters from './components/ProductFilters.js';
import CampaignBanner, { getMatchingCampaign } from './components/CampaignBanner.js';
import { CustomSelect } from './components/CustomSelect.js';
import SocialIcon from './components/SocialIcon.js';

// Lazy load non-critical above-the-fold storefront components
const CheckoutForm = lazy(() => import('./components/CheckoutForm.js'));
const GeminiChatAssistant = lazy(() => import('./components/GeminiChatAssistant.js'));
const CustomerAccountSystem = lazy(() => import('./components/CustomerAccountSystem.js'));
const AdminLayout = lazy(() => import('./components/AdminLayout.js'));

const LoaderFallback = () => (
  <div className="flex items-center justify-center p-12 min-h-[300px]" id="app-loading-fallback">
    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
  </div>
);

const formatOrderDate = (rawDate?: string) => {
  if (!rawDate) return 'تاريخ غير متوفر';
  const parsed = new Date(rawDate);
  return isNaN(parsed.getTime())
    ? rawDate
    : parsed.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function App() {
  const {
    customer,
    wishlist: customerWishlist,
    toggleWishlist,
    refreshData,
    savedCart,
    addToCart: customerAddToCart,
    updateCartItem: customerUpdateCartItem,
    removeFromCart: customerRemoveCartItem,
    clearCart: customerClearCart
  } = useCustomerAuth();

  // Navigation Routing States
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [navigationArg, setNavigationArg] = useState<any>(null);

  // Core Data Lists State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [faqs, setFaqs] = useState<any[]>([]);

  // Cart & Wishlist persistence States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);

  // Sync authenticated customer savedCart to cart state
  useEffect(() => {
    if (customer && Array.isArray(savedCart)) {
      setCart(savedCart);
    }
  }, [customer, savedCart]);

  const activeWishlist = customer ? customerWishlist : wishlist;

  // Selected details tab states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Review form states
  const [reviewName, setReviewName] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewAlert, setReviewAlert] = useState<{ type: 'success' | 'error' | null; message: string | null }>({
    type: null,
    message: null,
  });
  const reviewAlertTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reviewSubmitLoading, setReviewSubmitLoading] = useState(false);

  // Product Details Reviews State
  const [productReviewsData, setProductReviewsData] = useState<{
    reviews: any[];
    summary: {
      productId: string;
      totalReviews: number;
      averageRating: number;
      ratingDistribution: Record<number, number>;
    };
  } | null>(null);
  const [productReviewsLoading, setProductReviewsLoading] = useState(false);
  const [productReviewsError, setProductReviewsError] = useState('');

  // Product Recommendations State
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState<boolean>(false);
  const [recommendationsError, setRecommendationsError] = useState<string>('');

  // Fetch product recommendations whenever selected product changes
  useEffect(() => {
    if (currentTab === 'product-details' && selectedProduct?.id) {
      setRecommendationsLoading(true);
      setRecommendationsError('');
      fetch(`/api/products/${selectedProduct.id}/recommendations?limit=8`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch recommendations');
          return res.json();
        })
        .then((data) => {
          if (data.success && Array.isArray(data.recommendations)) {
            setRecommendations(data.recommendations);
          } else {
            setRecommendations([]);
          }
        })
        .catch((err) => {
          console.error('Failed to load recommendations:', err);
          setRecommendationsError('تعذر تحميل المنتجات المشابهة.');
          setRecommendations([]);
        })
        .finally(() => {
          setRecommendationsLoading(false);
        });
    } else {
      setRecommendations([]);
    }
  }, [currentTab, selectedProduct?.id]);

  // Best Sellers Products State & Fetching
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [bestSellersLoading, setBestSellersLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setBestSellersLoading(true);
    fetch('/api/products/best-sellers?limit=8')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch best sellers');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data.success && Array.isArray(data.products)) {
            setBestSellers(data.products);
          } else {
            setBestSellers([]);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load best sellers:', err);
        if (isMounted) setBestSellers([]);
      })
      .finally(() => {
        if (isMounted) setBestSellersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Trending Products State & Fetching
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [trendingLoading, setTrendingLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setTrendingLoading(true);
    fetch('/api/products/trending?limit=8')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch trending products');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data.success && Array.isArray(data.products)) {
            setTrendingProducts(data.products);
          } else {
            setTrendingProducts([]);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load trending products:', err);
        if (isMounted) setTrendingProducts([]);
      })
      .finally(() => {
        if (isMounted) setTrendingLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // New Arrivals Products State & Fetching
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [newArrivalsLoading, setNewArrivalsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setNewArrivalsLoading(true);
    fetch('/api/products/new-arrivals?limit=8')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch new arrivals');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          if (data.success && Array.isArray(data.products)) {
            setNewArrivals(data.products);
          } else {
            setNewArrivals([]);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load new arrivals:', err);
        if (isMounted) setNewArrivals([]);
      })
      .finally(() => {
        if (isMounted) setNewArrivalsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Deduplicated Homepage Merchandising Lists
  const featuredProducts = useMemo(() => {
    return products.filter((p) => p.isFeatured).slice(0, 4);
  }, [products]);

  const displayBestSellers = useMemo(() => {
    const featuredIds = new Set(featuredProducts.map((p) => p.id));
    const unique = bestSellers.filter((p) => !featuredIds.has(p.id));
    return unique.length > 0 ? unique : bestSellers;
  }, [bestSellers, featuredProducts]);

  const displayTrending = useMemo(() => {
    const shownIds = new Set([
      ...featuredProducts.map((p) => p.id),
      ...displayBestSellers.map((p) => p.id),
    ]);
    const unique = trendingProducts.filter((p) => !shownIds.has(p.id));
    return unique.length > 0 ? unique : trendingProducts;
  }, [trendingProducts, featuredProducts, displayBestSellers]);

  const displayNewArrivals = useMemo(() => {
    const shownIds = new Set([
      ...featuredProducts.map((p) => p.id),
      ...displayBestSellers.map((p) => p.id),
      ...displayTrending.map((p) => p.id),
    ]);
    const unique = newArrivals.filter((p) => !shownIds.has(p.id));
    return unique.length > 0 ? unique : newArrivals;
  }, [newArrivals, featuredProducts, displayBestSellers, displayTrending]);

  // Customers Also Bought Products State & Fetching
  const [alsoBoughtProducts, setAlsoBoughtProducts] = useState<Product[]>([]);
  const [alsoBoughtLoading, setAlsoBoughtLoading] = useState<boolean>(false);
  const [alsoBoughtError, setAlsoBoughtError] = useState<string>('');

  useEffect(() => {
    if (currentTab === 'product-details' && selectedProduct?.id) {
      setAlsoBoughtLoading(true);
      setAlsoBoughtError('');
      fetch(`/api/products/${selectedProduct.id}/also-bought?limit=8`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch co-purchased products');
          return res.json();
        })
        .then((data) => {
          if (data.success && Array.isArray(data.products)) {
            setAlsoBoughtProducts(data.products);
          } else {
            setAlsoBoughtProducts([]);
          }
        })
        .catch((err) => {
          console.error('Failed to load co-purchased products:', err);
          setAlsoBoughtError('تعذر تحميل المنتجات التي اشتراها العملاء عادة.');
          setAlsoBoughtProducts([]);
        })
        .finally(() => {
          setAlsoBoughtLoading(false);
        });
    } else {
      setAlsoBoughtProducts([]);
    }
  }, [currentTab, selectedProduct?.id]);

  // Recently Viewed Products State & Persistence
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cod_recently_viewed');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track product view on product-details page
  useEffect(() => {
    if (currentTab === 'product-details' && selectedProduct?.id) {
      const pid = selectedProduct.id;
      setRecentlyViewedIds((prev) => {
        const filtered = prev.filter((id) => id !== pid);
        const updated = [pid, ...filtered].slice(0, 12);
        try {
          localStorage.setItem('cod_recently_viewed', JSON.stringify(updated));
        } catch (e) {
          console.error('Failed to save recently viewed to localStorage:', e);
        }
        return updated;
      });
    }
  }, [currentTab, selectedProduct?.id]);

  // Compute list of recently viewed product objects (excluding currently viewed product)
  const recentlyViewedProducts = useMemo(() => {
    if (!selectedProduct) return [];
    return recentlyViewedIds
      .filter((id) => id !== selectedProduct.id)
      .map((id) => products.find((p) => p.id === id))
      .filter((p): p is Product => p !== undefined)
      .slice(0, 8);
  }, [recentlyViewedIds, selectedProduct, products]);

  // Review Eligibility State
  const [reviewEligibility, setReviewEligibility] = useState<{
    productId: string;
    variantId: string | null;
    canReview: boolean;
    isVerifiedPurchase: boolean;
    hasExistingReview: boolean;
    existingReview: any | null;
    reason: string;
  } | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  // Fetch product reviews whenever selected product or variant changes
  useEffect(() => {
    if (currentTab === 'product-details' && selectedProduct?.id) {
      setProductReviewsLoading(true);
      setProductReviewsError('');
      api.getProductReviews(selectedProduct.id, selectedVariant?.id)
        .then(res => {
          setProductReviewsData(res);
          setProductReviewsError('');
        })
        .catch(err => {
          console.error('Failed to load product reviews:', err);
          setProductReviewsError('تعذر تحميل تقييمات المنتج.');
        })
        .finally(() => {
          setProductReviewsLoading(false);
        });
    } else {
      setProductReviewsError('');
    }
  }, [currentTab, selectedProduct?.id, selectedVariant?.id]);

  // Check review eligibility for customer
  useEffect(() => {
    if (currentTab === 'product-details' && selectedProduct?.id) {
      setEligibilityLoading(true);
      api.getReviewEligibility(selectedProduct.id, selectedVariant?.id)
        .then(res => setReviewEligibility(res))
        .catch(err => {
          console.error('Failed to check review eligibility:', err);
          setReviewEligibility(null);
        })
        .finally(() => setEligibilityLoading(false));
    } else {
      setReviewEligibility(null);
    }
  }, [currentTab, selectedProduct?.id, selectedVariant?.id, customer]);

  // Cart Coupon Code Discount states
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [activeCoupon, setActiveCoupon] = useState<Coupon | null>(null);

  // Live order tracker states
  const [trackerOrderId, setTrackerOrderId] = useState('');
  const [trackerPhone, setTrackerPhone] = useState('');
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);
  const [trackerError, setTrackerError] = useState('');
  const [trackerLoading, setTrackerLoading] = useState(false);

  // Completed successful Order State
  const [lastPlacedOrder, setLastPlacedOrder] = useState<Order | null>(null);

  // Active Promotional Campaigns State
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);

  // Admin authentication states from dedicated AdminAuthContext
  const {
    adminUser: currentAdmin,
    isAdminLoggedIn,
    logoutAdmin
  } = useAdminAuth();

  const [showAdminLogoutConfirm, setShowAdminLogoutConfirm] = useState<boolean>(false);

  const handleAdminLogout = async () => {
    try {
      await logoutAdmin();
    } catch (e) {
      console.error('Server admin logout failed:', e);
    } finally {
      setCurrentTab('home');
      setAdminSubTab('overview');
      window.history.pushState(null, '', '/');
    }
  };

  // Admin section sub-tabs state
  const [adminSubTab, setAdminSubTab] = useState<string>('overview');

  // Search and Filter constraints states
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterIsOffer, setFilterIsOffer] = useState(false);
  const [filterInStockOnly, setFilterInStockOnly] = useState(false);
  const [filterIsFeatured, setFilterIsFeatured] = useState(false);
  const [filterIsNewArrival, setFilterIsNewArrival] = useState(false);
  const [filterSort, setFilterSort] = useState('featured');
  const [filterPage, setFilterPage] = useState(1);

  const isSyncingFromUrlRef = useRef<boolean>(false);
  const productGridTopRef = useRef<HTMLDivElement>(null);

  // Global loaders
  const [globalLoading, setGlobalLoading] = useState(true);

  // URL Query Parameters Helper Functions
  const parseUrlParams = (searchString: string) => {
    const params = new URLSearchParams(searchString);
    return {
      search: params.get('search') || params.get('q') || '',
      category: params.get('category') || params.get('cat') || '',
      brand: params.get('brand') || '',
      rating: params.get('rating') || params.get('stars') || '',
      minPrice: params.get('minPrice') || params.get('min_price') || '',
      maxPrice: params.get('maxPrice') || params.get('max_price') || '',
      inStock: params.get('inStock') === 'true' || params.get('instock') === 'true',
      featured: params.get('featured') === 'true' || params.get('isFeatured') === 'true',
      onSale: params.get('onSale') === 'true' || params.get('isOffer') === 'true' || params.get('sale') === 'true',
      newArrivals: params.get('newArrivals') === 'true' || params.get('isNewArrival') === 'true' || params.get('latest') === 'true',
      sort: params.get('sort') || 'featured',
      page: Math.max(parseInt(params.get('page') || '1', 10) || 1, 1),
    };
  };

  const buildUrlQueryString = (filters: {
    search?: string;
    category?: string;
    brand?: string;
    rating?: string;
    minPrice?: string;
    maxPrice?: string;
    inStock?: boolean;
    featured?: boolean;
    onSale?: boolean;
    newArrivals?: boolean;
    sort?: string;
    page?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.category) params.set('category', filters.category);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.rating) params.set('rating', filters.rating);
    if (filters.minPrice) params.set('minPrice', filters.minPrice);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
    if (filters.inStock) params.set('inStock', 'true');
    if (filters.featured) params.set('featured', 'true');
    if (filters.onSale) params.set('onSale', 'true');
    if (filters.newArrivals) params.set('newArrivals', 'true');
    if (filters.sort && filters.sort !== 'featured') params.set('sort', filters.sort);
    if (filters.page && filters.page > 1) params.set('page', filters.page.toString());

    const str = params.toString();
    return str ? `?${str}` : '';
  };

  // Sync state based on URL
  const syncRouteWithUrl = (pathname: string, loggedIn: boolean, arg?: any) => {
    // Strip search parameters and trailing slashes for matching
    const rawPath = pathname.split('?')[0].split('#')[0] || '/';
    const path = rawPath.toLowerCase().replace(/\/$/, '') || '/';

    if (path === '/' || path === '/home') {
      setCurrentTab('home');
    } else if (path === '/products') {
      setCurrentTab('products');
      const parsed = parseUrlParams(window.location.search);

      if (arg && typeof arg === 'object') {
        if (arg.category !== undefined) parsed.category = arg.category;
        if (arg.brand !== undefined) parsed.brand = arg.brand;
        if (arg.search !== undefined) parsed.search = arg.search;
        if (arg.rating !== undefined) parsed.rating = arg.rating;
        if (arg.minPrice !== undefined) parsed.minPrice = arg.minPrice;
        if (arg.maxPrice !== undefined) parsed.maxPrice = arg.maxPrice;
        if (arg.isOffer !== undefined) parsed.onSale = arg.isOffer;
        if (arg.onSale !== undefined) parsed.onSale = arg.onSale;
        if (arg.inStock !== undefined) parsed.inStock = arg.inStock;
        if (arg.inStockOnly !== undefined) parsed.inStock = arg.inStockOnly;
        if (arg.featured !== undefined) parsed.featured = arg.featured;
        if (arg.isFeatured !== undefined) parsed.featured = arg.isFeatured;
        if (arg.newArrivals !== undefined) parsed.newArrivals = arg.newArrivals;
        if (arg.isNewArrival !== undefined) parsed.newArrivals = arg.isNewArrival;
        if (arg.sort !== undefined) parsed.sort = arg.sort;
        if (arg.page !== undefined) parsed.page = Number(arg.page) || 1;
      }

      isSyncingFromUrlRef.current = true;
      setFilterSearch(parsed.search);
      setFilterCategory(parsed.category);
      setFilterBrand(parsed.brand);
      setFilterRating(parsed.rating);
      setFilterMinPrice(parsed.minPrice);
      setFilterMaxPrice(parsed.maxPrice);
      setFilterInStockOnly(parsed.inStock);
      setFilterIsFeatured(parsed.featured);
      setFilterIsOffer(parsed.onSale);
      setFilterIsNewArrival(parsed.newArrivals);
      setFilterSort(parsed.sort);
      setFilterPage(parsed.page);
    } else if (path.startsWith('/product/')) {
      const id = rawPath.split('/').pop() || '';
      setCurrentTab('product-details');
      api.getProductById(id).then(item => {
        setSelectedProduct(item);
        setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
        setActiveImage(item.mainImage);
        setQuantity(1);
        if (reviewAlertTimeoutRef.current) {
          clearTimeout(reviewAlertTimeoutRef.current);
        }
        setReviewAlert({ type: null, message: null });
        setReviewComment('');
      }).catch(err => {
        console.error(err);
      });
    } else if (path === '/cart') {
      setCurrentTab('cart');
    } else if (path === '/wishlist') {
      setCurrentTab('wishlist');
    } else if (path === '/checkout') {
      setCurrentTab('checkout');
    } else if (path === '/order-success' || path.startsWith('/order-success')) {
      setCurrentTab('order-success');
      const orderIdFromUrl = rawPath.split('/order-success/')[1]?.trim();
      if (orderIdFromUrl) {
        setTrackerOrderId(orderIdFromUrl);
      }
      if (!lastPlacedOrder) {
        try {
          const cachedOrderRaw = sessionStorage.getItem('last_placed_order');
          if (cachedOrderRaw) {
            const cached = JSON.parse(cachedOrderRaw);
            if (cached) setLastPlacedOrder(cached);
          } else if (orderIdFromUrl) {
            api.trackOrder(orderIdFromUrl).then(fetched => {
              if (fetched) setLastPlacedOrder(fetched);
            }).catch(() => {});
          }
        } catch (e) {}
      }
    } else if (path === '/track-order') {
      setCurrentTab('track-order');
    } else if (path === '/faq') {
      setCurrentTab('faq');
    } else if (path === '/about') {
      setCurrentTab('about');
    } else if (path === '/contact') {
      setCurrentTab('contact');
    } else if (path === '/customer-account' || path === '/account' || path === '/customer' || path === '/login' || path === '/auth' || path === '/register') {
      setCurrentTab('customer-account');
    } else if (path === '/admin/login') {
      if (loggedIn) {
        window.history.replaceState(null, '', '/admin/dashboard');
        setCurrentTab('admin');
        setAdminSubTab('overview');
      } else {
        setCurrentTab('admin');
        setAdminSubTab('overview');
      }
    } else if (path === '/admin' || path.startsWith('/admin/')) {
      if (!loggedIn) {
        window.history.replaceState(null, '', '/admin/login');
        setCurrentTab('admin');
        setAdminSubTab('overview');
      } else {
        setCurrentTab('admin');
        if (arg && typeof arg === 'object' && arg.subTab) {
          const directSub = arg.subTab === 'profile' ? 'account' : arg.subTab;
          setAdminSubTab(directSub);
        } else if (path === '/admin' || path === '/admin/dashboard') {
          setAdminSubTab('overview');
        } else if (path === '/admin/suppliers') {
          setAdminSubTab('suppliers');
        } else if (path === '/admin/purchase-orders') {
          setAdminSubTab('purchase_orders');
        } else if (path === '/admin/inventory') {
          setAdminSubTab('inventory');
        } else if (path === '/admin/products') {
          setAdminSubTab('products');
        } else if (path === '/admin/orders') {
          setAdminSubTab('orders');
        } else if (path === '/admin/returns') {
          setAdminSubTab('returns');
        } else if (path === '/admin/cms') {
          setAdminSubTab('cms');
        } else if (path === '/admin/media') {
          setAdminSubTab('media');
        } else if (path === '/admin/campaigns') {
          setAdminSubTab('campaigns');
        } else if (path === '/admin/coupons') {
          setAdminSubTab('coupons');
        } else if (path === '/admin/shipping') {
          setAdminSubTab('shipping');
        } else if (path === '/admin/cleanup') {
          setAdminSubTab('cleanup');
        } else if (path === '/admin/bi' || path === '/admin/analytics') {
          setAdminSubTab('bi');
        } else if (path === '/admin/customers') {
          setAdminSubTab('customers');
        } else if (path === '/admin/reviews') {
          setAdminSubTab('reviews');
        } else if (path === '/admin/rbac') {
          setAdminSubTab('rbac');
        } else if (path === '/admin/notifications') {
          setAdminSubTab('notifications');
        } else if (path === '/admin/account' || path === '/admin/profile') {
          setAdminSubTab('account');
        } else {
          setAdminSubTab('overview');
        }
      }
    } else {
      setCurrentTab('home');
    }
  };

  // Initialize and load core endpoints from backend Express server
  const loadCoreData = async (): Promise<boolean> => {
    let loggedIn = false;
    try {
      const [settingsRes, categoriesRes, brandsRes, productsRes, faqsRes, campaignsRes] = await Promise.all([
        api.getSettings(),
        api.getCategories(),
        api.getBrands(),
        api.getProducts(),
        api.getFaqs(),
        api.getActiveCampaigns().catch(() => ({ success: false, campaigns: [] }))
      ]);

      setSettings(settingsRes);
      setCategories(categoriesRes);
      setBrands(brandsRes);
      setProducts(productsRes);
      setFaqs(faqsRes);
      if (campaignsRes && campaignsRes.campaigns) {
        setActiveCampaigns(campaignsRes.campaigns);
      }

      loggedIn = sessionStorage.getItem('admin_authenticated') === 'true' || !!sessionStorage.getItem('admin_token') || !!localStorage.getItem('admin_token');
    } catch (err) {
      console.error('Failed to load store catalog data:', err);
    } finally {
      setGlobalLoading(false);
    }
    return loggedIn;
  };

  useEffect(() => {
    const initApp = async () => {
      const loggedIn = await loadCoreData();
      syncRouteWithUrl(window.location.pathname + window.location.search, loggedIn);
    };
    initApp();

    const handlePopState = () => {
      const loggedIn = sessionStorage.getItem('admin_authenticated') === 'true' || !!sessionStorage.getItem('admin_token') || !!localStorage.getItem('admin_token');
      syncRouteWithUrl(window.location.pathname + window.location.search, loggedIn);
    };
    window.addEventListener('popstate', handlePopState);

    // Recover Cart and Wishlist from localStorage
    const cachedCart = localStorage.getItem('cod_store_cart');
    if (cachedCart) {
      try { setCart(JSON.parse(cachedCart)); } catch (e) { console.error(e); }
    }
    const cachedWishlist = localStorage.getItem('cod_store_wishlist');
    if (cachedWishlist) {
      try { setWishlist(JSON.parse(cachedWishlist)); } catch (e) { console.error(e); }
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Save Cart to LocalStorage on changes
  useEffect(() => {
    localStorage.setItem('cod_store_cart', JSON.stringify(cart));
  }, [cart]);

  // Save Wishlist to LocalStorage on changes
  useEffect(() => {
    localStorage.setItem('cod_store_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Synchronize catalog filter states to browser URL when on products tab
  useEffect(() => {
    if (currentTab !== 'products') return;

    if (isSyncingFromUrlRef.current) {
      isSyncingFromUrlRef.current = false;
      return;
    }

    const queryStr = buildUrlQueryString({
      search: filterSearch,
      category: filterCategory,
      brand: filterBrand,
      rating: filterRating,
      minPrice: filterMinPrice,
      maxPrice: filterMaxPrice,
      inStock: filterInStockOnly,
      featured: filterIsFeatured,
      onSale: filterIsOffer,
      newArrivals: filterIsNewArrival,
      sort: filterSort,
      page: filterPage,
    });

    const targetPath = `/products${queryStr}`;
    const currentPathWithSearch = `${window.location.pathname}${window.location.search}`;

    if (currentPathWithSearch !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    }
  }, [
    currentTab,
    filterSearch,
    filterCategory,
    filterBrand,
    filterRating,
    filterMinPrice,
    filterMaxPrice,
    filterInStockOnly,
    filterIsFeatured,
    filterIsOffer,
    filterIsNewArrival,
    filterSort,
    filterPage,
  ]);

  // Compute active filter chips for display
  const activeChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];

    if (filterCategory) {
      chips.push({
        id: 'category',
        label: `قسم: ${filterCategory}`,
        onRemove: () => { setFilterCategory(''); setFilterPage(1); },
      });
    }

    if (filterBrand) {
      chips.push({
        id: 'brand',
        label: filterBrand,
        onRemove: () => { setFilterBrand(''); setFilterPage(1); },
      });
    }

    if (filterRating) {
      chips.push({
        id: 'rating',
        label: `⭐ ${filterRating}+`,
        onRemove: () => { setFilterRating(''); setFilterPage(1); },
      });
    }

    if (filterMinPrice && filterMaxPrice) {
      chips.push({
        id: 'price',
        label: `السعر: ${filterMinPrice} - ${filterMaxPrice} ج.م`,
        onRemove: () => { setFilterMinPrice(''); setFilterMaxPrice(''); setFilterPage(1); },
      });
    } else if (filterMinPrice) {
      chips.push({
        id: 'price',
        label: `أكثر من ${filterMinPrice} ج.م`,
        onRemove: () => { setFilterMinPrice(''); setFilterPage(1); },
      });
    } else if (filterMaxPrice) {
      chips.push({
        id: 'price',
        label: `أقل من ${filterMaxPrice} ج.م`,
        onRemove: () => { setFilterMaxPrice(''); setFilterPage(1); },
      });
    }

    if (filterInStockOnly) {
      chips.push({
        id: 'inStockOnly',
        label: 'متوفر',
        onRemove: () => { setFilterInStockOnly(false); setFilterPage(1); },
      });
    }

    if (filterIsOffer) {
      chips.push({
        id: 'isOffer',
        label: 'عروض',
        onRemove: () => { setFilterIsOffer(false); setFilterPage(1); },
      });
    }

    if (filterIsFeatured) {
      chips.push({
        id: 'isFeatured',
        label: 'المميزة',
        onRemove: () => { setFilterIsFeatured(false); setFilterPage(1); },
      });
    }

    if (filterIsNewArrival) {
      chips.push({
        id: 'isNewArrival',
        label: 'جديد',
        onRemove: () => { setFilterIsNewArrival(false); setFilterPage(1); },
      });
    }

    return chips;
  }, [
    filterCategory,
    filterBrand,
    filterRating,
    filterMinPrice,
    filterMaxPrice,
    filterInStockOnly,
    filterIsOffer,
    filterIsFeatured,
    filterIsNewArrival,
  ]);

  // Handle direct custom navigation with real paths and history state
  const handleNavigate = async (tab: string, arg?: any) => {
    setNavigationArg(arg);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let path = '/';
    if (tab === 'home') {
      path = '/';
    } else if (tab === 'products') {
      if (arg && typeof arg === 'object') {
        const queryStr = buildUrlQueryString({
          search: arg.search,
          category: arg.category,
          brand: arg.brand,
          rating: arg.rating,
          minPrice: arg.minPrice,
          maxPrice: arg.maxPrice,
          inStock: arg.inStock ?? arg.inStockOnly,
          featured: arg.featured ?? arg.isFeatured,
          onSale: arg.onSale ?? arg.isOffer,
          newArrivals: arg.newArrivals ?? arg.isNewArrival,
          sort: arg.sort,
          page: arg.page,
        });
        path = `/products${queryStr}`;
      } else {
        path = `/products${window.location.search}`;
      }
    } else if (tab === 'product-details' && typeof arg === 'string') {
      path = `/product/${arg}`;
    } else if (tab === 'cart') {
      path = '/cart';
    } else if (tab === 'wishlist') {
      path = '/wishlist';
    } else if (tab === 'checkout') {
      path = '/checkout';
    } else if (tab === 'order-success') {
      path = (typeof arg === 'string' && arg.trim()) ? `/order-success/${arg.trim()}` : '/order-success';
    } else if (tab === 'track-order') {
      path = '/track-order';
    } else if (tab === 'faq') {
      path = '/faq';
    } else if (tab === 'about') {
      path = '/about';
    } else if (tab === 'contact') {
      path = '/contact';
    } else if (tab === 'customer-account' || tab === 'account' || tab === 'customer' || tab === 'login' || tab === 'auth' || tab === 'register') {
      path = '/customer-account';
    } else if (
      tab === 'admin' ||
      tab === 'orders' ||
      tab === 'inventory' ||
      tab === 'products' ||
      tab === 'suppliers' ||
      tab === 'purchase_orders' ||
      tab === 'campaigns' ||
      tab === 'coupons' ||
      tab === 'shipping' ||
      tab === 'cleanup' ||
      tab === 'bi' ||
      tab === 'analytics' ||
      tab === 'media' ||
      tab === 'customers' ||
      tab === 'reviews' ||
      tab === 'rbac' ||
      tab === 'notifications' ||
      tab === 'cms'
    ) {
      setCurrentTab('admin');
      const loggedIn = sessionStorage.getItem('admin_authenticated') === 'true' || !!sessionStorage.getItem('admin_token') || !!localStorage.getItem('admin_token');
      if (!loggedIn) {
        path = '/admin/login';
      } else {
        const rawSub = tab === 'admin' ? ((arg && typeof arg === 'object' && arg.subTab) ? arg.subTab : adminSubTab) : tab;
        const sub = rawSub === 'profile' ? 'account' : rawSub;
        setAdminSubTab(sub);

        if (sub === 'overview') path = '/admin/dashboard';
        else if (sub === 'suppliers') path = '/admin/suppliers';
        else if (sub === 'purchase_orders') path = '/admin/purchase-orders';
        else if (sub === 'inventory' || sub === 'inventory-pro') path = '/admin/inventory';
        else if (sub === 'products') path = '/admin/products';
        else if (sub === 'orders') path = '/admin/orders';
        else if (sub === 'cms') path = '/admin/cms';
        else if (sub === 'media') path = '/admin/media';
        else if (sub === 'campaigns') path = '/admin/campaigns';
        else if (sub === 'coupons') path = '/admin/coupons';
        else if (sub === 'shipping') path = '/admin/shipping';
        else if (sub === 'cleanup') path = '/admin/cleanup';
        else if (sub === 'bi' || sub === 'analytics') path = '/admin/bi';
        else if (sub === 'customers') path = '/admin/customers';
        else if (sub === 'reviews') path = '/admin/reviews';
        else if (sub === 'rbac') path = '/admin/rbac';
        else if (sub === 'notifications') path = '/admin/notifications';
        else if (sub === 'account' || sub === 'profile') path = '/admin/account';
        else path = '/admin/dashboard';

        if (arg && typeof arg === 'object') {
          if (arg.status) {
            path += `?status=${encodeURIComponent(arg.status)}`;
          } else if (arg.filter) {
            path += `?filter=${encodeURIComponent(arg.filter)}`;
          }
        }
      }
    }

    window.history.pushState(null, '', path);
    const loggedIn = sessionStorage.getItem('admin_authenticated') === 'true';
    syncRouteWithUrl(path, loggedIn, arg);
  };

  // Custom handler for updating admin subtabs with URL sync
  const handleAdminSubTabChange = (subTab: string) => {
    const targetSub = subTab === 'profile' ? 'account' : subTab;
    setAdminSubTab(targetSub);
    let path = '/admin/dashboard';
    if (targetSub === 'products') path = '/admin/products';
    else if (targetSub === 'suppliers') path = '/admin/suppliers';
    else if (targetSub === 'purchase_orders') path = '/admin/purchase-orders';
    else if (targetSub === 'inventory' || targetSub === 'inventory-pro') path = '/admin/inventory';
    else if (targetSub === 'orders') path = '/admin/orders';
    else if (targetSub === 'cms') path = '/admin/cms';
    else if (targetSub === 'media') path = '/admin/media';
    else if (targetSub === 'campaigns') path = '/admin/campaigns';
    else if (targetSub === 'coupons') path = '/admin/coupons';
    else if (targetSub === 'shipping') path = '/admin/shipping';
    else if (targetSub === 'cleanup') path = '/admin/cleanup';
    else if (targetSub === 'bi') path = '/admin/bi';
    else if (targetSub === 'customers') path = '/admin/customers';
    else if (targetSub === 'reviews') path = '/admin/reviews';
    else if (targetSub === 'rbac') path = '/admin/rbac';
    else if (targetSub === 'notifications') path = '/admin/notifications';
    else if (targetSub === 'account' || targetSub === 'profile') path = '/admin/account';
    
    window.history.pushState(null, '', path);
  };

  // Toggle wishlist item
  const handleToggleWishlist = async (productId: string, e: any) => {
    e.stopPropagation();
    if (customer) {
      await toggleWishlist(productId);
    } else {
      setWishlist(prev =>
        prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
      );
    }
  };

  // Direct Cart additions
  const handleAddToCart = async (product: Product, e: any) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const oldHtml = btn.innerHTML;

    try {
      if (customer) {
        await customerAddToCart(product.id);
      } else {
        const existing = cart.find(item => item.product.id === product.id && !item.selectedVariant);
        if (existing) {
          setCart(prev => prev.map(item =>
            (item.product.id === product.id && !item.selectedVariant)
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ));
        } else {
          setCart(prev => [...prev, { product, quantity: 1 }]);
        }
      }

      // Success ripple UI feedback
      btn.innerHTML = 'تمت الإضافة للسلة! ✓';
      btn.classList.add('bg-amber-500', 'text-slate-950');
      setTimeout(() => {
        btn.innerHTML = oldHtml;
        btn.classList.remove('bg-amber-500', 'text-slate-950');
      }, 1500);
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err, 'فشل إضافة المنتج إلى السلة'));
    }
  };

  // Cart item modifier additions
  const handleDetailedAddToCart = async () => {
    if (!selectedProduct) return;
    try {
      if (customer) {
        await customerAddToCart(selectedProduct.id, selectedVariant?.id, quantity);
      } else {
        const existingIndex = cart.findIndex(item =>
          item.product.id === selectedProduct.id &&
          (!selectedVariant || item.selectedVariant?.id === selectedVariant.id)
        );

        if (existingIndex > -1) {
          setCart(prev => prev.map((item, idx) =>
            idx === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
          ));
        } else {
          setCart(prev => [...prev, {
            product: selectedProduct,
            quantity,
            selectedVariant: selectedVariant || undefined
          }]);
        }
      }
      handleNavigate('cart');
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err, 'فشل إضافة المنتج إلى السلة'));
    }
  };

  const handleUpdateCartQty = async (idx: number, delta: number) => {
    const item = cart[idx];
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    if (customer) {
      try {
        await customerUpdateCartItem(item.product.id, newQty, item.selectedVariant?.id);
      } catch (err: any) {
        alert(getFriendlyErrorMessage(err, 'فشل تحديث الكمية'));
      }
    } else {
      setCart(prev => prev.map((it, i) => {
        if (i === idx) {
          return { ...it, quantity: newQty };
        }
        return it;
      }));
    }
  };

  const handleRemoveCartItem = async (idx: number) => {
    const item = cart[idx];
    if (!item) return;

    if (customer) {
      try {
        await customerRemoveCartItem(item.product.id, item.selectedVariant?.id);
      } catch (err: any) {
        alert(getFriendlyErrorMessage(err, 'فشل إزالة المنتج'));
      }
    } else {
      setCart(prev => prev.filter((_, i) => i !== idx));
    }
  };

  // Validate coupon codes
  const handleValidateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    const trimmedCode = couponCodeInput.trim();
    if (!trimmedCode) {
      setCouponError('يرجى إدخال رمز الكوبون أولاً');
      return;
    }

    const cartTotal = cart.reduce((sum, item) => {
      const price = item.selectedVariant ? item.selectedVariant.price : (item.product.discountPrice || item.product.price);
      return sum + (price * item.quantity);
    }, 0);

    try {
      const res = await api.validateCoupon(
        trimmedCode,
        cartTotal,
        customer?.email,
        customer?.phone,
        customer?.id
      );

      if (res && (res as any).valid !== false) {
        setActiveCoupon(res);
        let discount = 0;
        const rawVal = res.value !== undefined ? res.value : (res.discountValue !== undefined ? res.discountValue : 0);
        if (res.discountType === 'percentage') {
          discount = (cartTotal * rawVal) / 100;
          if (res.maxDiscountAmount && discount > res.maxDiscountAmount) {
            discount = res.maxDiscountAmount;
          }
          discount = Math.round(discount);
        } else if (res.discountType === 'fixed') {
          discount = Math.min(rawVal, cartTotal);
        } else if (res.discountType === 'free_shipping') {
          discount = settings?.shippingFlatRate || 0;
        }
        setCouponDiscount(discount);
        setCouponError('');
      } else {
        const errorMsg = (res as any)?.message || (res as any)?.error || 'الكوبون المدخل غير صالح أو تم استخدامه مسبقاً';
        setCouponError(errorMsg);
        setCouponDiscount(0);
        setActiveCoupon(null);
      }
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.data?.error || getFriendlyErrorMessage(err, 'الكوبون المدخل غير صالح أو انتهت صلاحيته');
      setCouponError(errMsg);
      setCouponDiscount(0);
      setActiveCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setActiveCoupon(null);
    setCouponDiscount(0);
    setCouponError('');
    setCouponCodeInput('');
  };

  // Auto-recalculate active coupon discount whenever cart, activeCoupon, or settings change
  useEffect(() => {
    if (!activeCoupon) return;

    if (cart.length === 0) {
      setActiveCoupon(null);
      setCouponDiscount(0);
      setCouponError('');
      return;
    }

    const cartTotal = cart.reduce((sum, item) => {
      const price = item.selectedVariant ? item.selectedVariant.price : (item.product.discountPrice || item.product.price);
      return sum + (price * item.quantity);
    }, 0);

    if (activeCoupon.minOrderValue && cartTotal < activeCoupon.minOrderValue) {
      setCouponError(`الحد الأدنى لتفعيل هذا الكوبون هو ${activeCoupon.minOrderValue} ج.م`);
      setCouponDiscount(0);
      return;
    }

    setCouponError('');
    let discount = 0;
    const rawVal = activeCoupon.value !== undefined ? activeCoupon.value : (activeCoupon.discountValue !== undefined ? activeCoupon.discountValue : 0);
    if (activeCoupon.discountType === 'percentage') {
      discount = (cartTotal * rawVal) / 100;
      if (activeCoupon.maxDiscountAmount && discount > activeCoupon.maxDiscountAmount) {
        discount = activeCoupon.maxDiscountAmount;
      }
      discount = Math.round(discount);
    } else if (activeCoupon.discountType === 'fixed') {
      discount = Math.min(rawVal, cartTotal);
    } else if (activeCoupon.discountType === 'free_shipping') {
      discount = settings?.shippingFlatRate || 0;
    }

    setCouponDiscount(discount);
  }, [cart, activeCoupon, settings?.shippingFlatRate]);

  // Submit product review form
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    // Purge Messages & timers on submission start
    if (reviewAlertTimeoutRef.current) {
      clearTimeout(reviewAlertTimeoutRef.current);
      reviewAlertTimeoutRef.current = null;
    }
    setReviewAlert({ type: null, message: null });

    if (!reviewComment.trim()) {
      setReviewAlert({ type: 'error', message: 'يرجى كتابة تعليقك قبل إرسال المراجعة' });
      return;
    }
    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      setReviewAlert({ type: 'error', message: 'يرجى تحديد التقييم بالنجوم' });
      return;
    }

    setReviewSubmitLoading(true);

    try {
      if (customer) {
        await api.submitCustomerReview(selectedProduct.id, {
          rating: reviewRating,
          title: reviewTitle.trim() || undefined,
          comment: reviewComment.trim(),
          variantId: selectedVariant?.id
        });
      } else {
        await api.submitReview(selectedProduct.id, {
          userName: reviewName.trim() || 'زائر',
          rating: reviewRating,
          comment: reviewComment.trim()
        });
      }

      // Success response (HTTP 200/201 treated as success)
      if (customer) {
        setReviewEligibility(prev => ({
          productId: selectedProduct.id,
          variantId: selectedVariant?.id || null,
          canReview: false,
          isVerifiedPurchase: prev?.isVerifiedPurchase ?? false,
          hasExistingReview: true,
          existingReview: {
            rating: reviewRating,
            title: reviewTitle.trim(),
            comment: reviewComment.trim(),
            status: 'pending'
          },
          reason: 'لقد قمت بتقييم هذا المنتج مسبقاً'
        }));
      }

      setReviewAlert({
        type: 'success',
        message: 'شكرًا لك! تم إرسال مراجعتك وستظهر بعد مراجعة الأدمن'
      });
      setReviewTitle('');
      setReviewComment('');
      setReviewName('');
      setReviewRating(5);

      // ONLY auto-dismiss success alerts after 4 seconds
      if (reviewAlertTimeoutRef.current) {
        clearTimeout(reviewAlertTimeoutRef.current);
      }
      reviewAlertTimeoutRef.current = setTimeout(() => {
        setReviewAlert({ type: null, message: null });
      }, 4000);

      // Immediate List Refresh on Success
      try {
        const updatedReviews = await api.getProductReviews(selectedProduct.id, selectedVariant?.id);
        setProductReviewsData(updatedReviews);
      } catch (refErr) {
        console.error('Failed to refresh product reviews list:', refErr);
      }

      // Refresh eligibility from server
      if (customer) {
        try {
          const updatedEligibility = await api.getReviewEligibility(selectedProduct.id, selectedVariant?.id);
          setReviewEligibility(updatedEligibility);
        } catch (refErr) {
          console.error('Failed to refresh review eligibility:', refErr);
        }
      }
    } catch (err: any) {
      console.error('Submit review error:', err);

      // Persistent error: do not set an auto-dismiss timer
      if (reviewAlertTimeoutRef.current) {
        clearTimeout(reviewAlertTimeoutRef.current);
        reviewAlertTimeoutRef.current = null;
      }

      // Extract exact server error message from backend (e.g. data.message, data.error, or fallback)
      const serverMsg = err?.data?.message || err?.data?.error || err?.response?.data?.message || err?.response?.data?.error || err?.message;
      const parsedError = getFriendlyErrorMessage(err, typeof serverMsg === 'string' ? serverMsg : 'حدث خطأ أثناء إرسال المراجعة. يرجى المحاولة مرة أخرى.');

      setReviewAlert({
        type: 'error',
        message: parsedError
      });
    } finally {
      setReviewSubmitLoading(false);
    }
  };

  // Handle finalize order (Cash on Delivery) - Atomic & Resilient Flow
  const handlePlaceOrderSubmit = async (shippingDetails: ShippingDetails, idempotencyKey?: string): Promise<Order> => {
    // 1. Validate & Map items
    const orderItems = cart.map(item => ({
      productId: item.product.id,
      productTitle: item.product.title,
      variantId: item.selectedVariant?.id,
      variantSku: item.selectedVariant?.sku,
      variantInfo: item.selectedVariant
        ? `${item.selectedVariant.size || item.selectedVariant.color || item.selectedVariant.capacity || ''}`
        : undefined,
      quantity: item.quantity,
      price: item.selectedVariant ? item.selectedVariant.price : (item.product.discountPrice || item.product.price)
    }));

    if (!orderItems.length) {
      throw new Error('سلة التسوق فارغة، يرجى إضافة أجهزة للسلة قبل إتمام الطلب');
    }

    // 2. Perform DB Order Creation via API
    let order: Order;
    try {
      order = await api.createOrder({
        customer: shippingDetails,
        items: orderItems,
        couponCode: activeCoupon?.code,
        discountAmount: couponDiscount,
        idempotencyKey
      }, idempotencyKey);
    } catch (apiErr: any) {
      // Direct API failure prior to creation
      throw new Error(getFriendlyErrorMessage(apiErr, 'فشلت عملية إنشاء الطلب'));
    }

    if (!order || !order.id) {
      throw new Error('لم نتمكن من تأكيد رقم الطلب من الخادم، يرجى المحاولة لاحقاً');
    }

    // 3. ATOMIC PRIMARY SUCCESS STATE UPDATES & IMMEDIATE NAVIGATION
    try {
      setLastPlacedOrder(order);
      try {
        sessionStorage.setItem('last_placed_order', JSON.stringify(order));
      } catch (storageErr) {
        console.warn('Session storage write error:', storageErr);
      }

      // Clear cart and checkout coupons
      setCart([]);
      try {
        localStorage.removeItem('cod_store_cart');
      } catch (e) {}
      setCouponDiscount(0);
      setCouponCodeInput('');
      setActiveCoupon(null);

      // Immediately navigate user to Order Success confirmation
      handleNavigate('order-success', order.id);
    } catch (navErr) {
      console.warn('Navigation state transition error:', navErr);
      setCurrentTab('order-success');
    }

    // 4. ISOLATED POST-CREATION BACKGROUND SYNC (Non-blocking & failure-isolated)
    (async () => {
      try {
        if (customer) {
          try {
            await customerClearCart();
          } catch (e) {
            console.warn('Silent customerClearCart error:', e);
          }
          try {
            if (typeof refreshData === 'function') {
              await refreshData();
            }
          } catch (e) {
            console.warn('Silent refreshData error:', e);
          }
        }
      } catch (postSyncErr) {
        console.warn('Non-critical post-checkout sync error:', postSyncErr);
      }
    })();

    return order;
  };

  // Track order state lookup
  const handleTrackOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackerError('');
    setTrackedOrder(null);

    if (!trackerOrderId.trim() || !trackerPhone.trim()) {
      setTrackerError('الرجاء إدخال كود الطلب ورقم الهاتف المحمول المسجل بالطلب للتحقق');
      return;
    }

    setTrackerLoading(true);
    try {
      const order = await api.trackOrder(trackerOrderId.trim(), trackerPhone.trim());
      setTrackedOrder(order);
    } catch (err: any) {
      setTrackerError(getFriendlyErrorMessage(err, 'لم نتمكن من العثور على الطلب أو بيانات التحقق غير صحيحة'));
    } finally {
      setTrackerLoading(false);
    }
  };

  // Filters Reset helper
  const handleResetFilters = () => {
    setFilterCategory('');
    setFilterBrand('');
    setFilterSearch('');
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterRating('');
    setFilterIsOffer(false);
    setFilterInStockOnly(false);
    setFilterIsFeatured(false);
    setFilterIsNewArrival(false);
    setFilterSort('featured');
    setFilterPage(1);
  };

  // Apply sorting and filtering client side (memoized for maximum rendering performance)
  const filteredList = useMemo(() => {
    let list = [...products];

    if (filterCategory) {
      list = list.filter(p => p.category === filterCategory);
    }
    if (filterBrand) {
      list = list.filter(p => p.brand === filterBrand);
    }
    if (filterSearch) {
      const normQuery = filterSearch
        .toLowerCase()
        .replace(/[\u064B-\u0652]/g, '')
        .replace(/\u0640/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .trim();

      const tokens = normQuery.split(/\s+/).filter(Boolean);

      list = list.filter(p => {
        const normTitle = (p.title || '').toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/\u0640/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
        const normBrand = (p.brand || '').toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/\u0640/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
        const normCat = (p.category || '').toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/\u0640/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
        const normSku = (p.sku || '').toLowerCase();
        const normBarcode = (p.barcode || '').toLowerCase();
        const normTags = (p.tags || []).map(t => t.toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/\u0640/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه'));
        const normDesc = (p.description || '').toLowerCase().replace(/[\u064B-\u0652]/g, '').replace(/\u0640/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');

        const combined = [normTitle, normBrand, normCat, normSku, normBarcode, ...normTags, normDesc].join(' ');
        return tokens.every(token => combined.includes(token));
      });
    }
    if (filterMinPrice) {
      list = list.filter(p => (p.discountPrice || p.price) >= Number(filterMinPrice));
    }
    if (filterMaxPrice) {
      list = list.filter(p => (p.discountPrice || p.price) <= Number(filterMaxPrice));
    }
    if (filterRating) {
      list = list.filter(p => p.rating >= Number(filterRating));
    }
    if (filterIsOffer) {
      list = list.filter(p => (p.discountPrice !== undefined && p.discountPrice < p.price) || p.isFlashSale);
    }
    if (filterInStockOnly) {
      list = list.filter(p => p.stock > 0);
    }
    if (filterIsFeatured) {
      list = list.filter(p => p.isFeatured === true);
    }
    if (filterIsNewArrival) {
      list = list.filter(p => p.isLatest === true);
    }

    // Sort mappings
    if (filterSort === 'cheapest' || filterSort === 'price_asc') {
      list.sort((a, b) => (Number(a?.discountPrice || a?.price) || 0) - (Number(b?.discountPrice || b?.price) || 0));
    } else if (filterSort === 'expensive' || filterSort === 'price_desc') {
      list.sort((a, b) => (Number(b?.discountPrice || b?.price) || 0) - (Number(a?.discountPrice || a?.price) || 0));
    } else if (filterSort === 'rating') {
      list.sort((a, b) => (Number(b?.rating) || 0) - (Number(a?.rating) || 0));
    } else if (filterSort === 'newest' || filterSort === 'latest') {
      list.sort((a, b) => {
        const timeA = getProductTimestamp(a);
        const timeB = getProductTimestamp(b);
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        const latestA = a?.isLatest ? 1 : 0;
        const latestB = b?.isLatest ? 1 : 0;
        if (latestB !== latestA) {
          return latestB - latestA;
        }
        const idA = String(a?.id || '');
        const idB = String(b?.id || '');
        return idB.localeCompare(idA);
      });
    } else if (filterSort === 'bestselling') {
      list.sort((a, b) => (b?.isBestSeller ? 1 : 0) - (a?.isBestSeller ? 1 : 0) || (Number(b?.reviewsCount) || 0) - (Number(a?.reviewsCount) || 0));
    } else if (filterSort === 'name_asc' || filterSort === 'title_asc') {
      list.sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || ''), 'ar'));
    } else if (filterSort === 'name_desc' || filterSort === 'title_desc') {
      list.sort((a, b) => String(b?.title || '').localeCompare(String(a?.title || ''), 'ar'));
    } else if (filterSort === 'featured') {
      list.sort((a, b) => (b?.isFeatured ? 1 : 0) - (a?.isFeatured ? 1 : 0) || String(b?.id || '').localeCompare(String(a?.id || '')));
    }

    return list;
  }, [products, filterCategory, filterBrand, filterSearch, filterMinPrice, filterMaxPrice, filterRating, filterIsOffer, filterInStockOnly, filterIsFeatured, filterIsNewArrival, filterSort]);

  // Catalog pagination calculation
  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.max(Math.ceil(filteredList.length / ITEMS_PER_PAGE), 1);
  const safeCurrentPage = Math.min(Math.max(filterPage, 1), totalPages);

  const handlePageChange = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === safeCurrentPage) return;
    setFilterPage(targetPage);
    productGridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getPaginationRange = (currentPage: number, totalPagesCount: number) => {
    const delta = 1;
    const range: (number | string)[] = [];
    if (totalPagesCount <= 7) {
      for (let i = 1; i <= totalPagesCount; i++) range.push(i);
      return range;
    }

    const left = currentPage - delta;
    const right = currentPage + delta;
    const rawRange: number[] = [];

    for (let i = 1; i <= totalPagesCount; i++) {
      if (i === 1 || i === totalPagesCount || (i >= left && i <= right)) {
        rawRange.push(i);
      }
    }

    let l: number | undefined;
    for (const i of rawRange) {
      if (l) {
        if (i - l === 2) {
          range.push(l + 1);
        } else if (i - l !== 1) {
          range.push('...');
        }
      }
      range.push(i);
      l = i;
    }

    return range;
  };

  const paginatedList = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredList.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredList, safeCurrentPage]);

  if (globalLoading || !settings) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center gap-4 font-sans">
        <Sparkles className="w-12 h-12 text-amber-500 animate-spin" />
        <h2 className="text-xl font-black">نخبة الأجهزة المنزلية الكبرى 🚚</h2>
        <p className="text-xs text-gray-400">يجري الآن تحميل وتجهيز فهارس المعرض العصري الفني المعتمد...</p>
      </div>
    );
  }

  const flashSaleProduct = products.find(p => p.isFlashSale && p.stock > 0);

  // If in Admin portal, render isolated AdminLayout (no storefront header/footer contamination)
  if (currentTab === 'admin') {
    return (
      <Suspense fallback={<LoaderFallback />}>
        <AdminLayout
          adminSubTab={adminSubTab}
          setAdminSubTab={setAdminSubTab}
          onNavigate={handleNavigate}
          onRefreshAll={loadCoreData}
          showAdminLogoutConfirm={showAdminLogoutConfirm}
          setShowAdminLogoutConfirm={setShowAdminLogoutConfirm}
          onAdminLogout={handleAdminLogout}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between transition-colors duration-200" dir="rtl" id="app-root-direction">
      {/* Dynamic SEO Optimizer */}
      <SEOManager
        currentTab={currentTab}
        selectedProduct={selectedProduct}
        settings={settings}
      />

      {/* 1. Header Navigation */}
      <Header
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        wishlistCount={activeWishlist.length}
        currentTab={currentTab}
        onNavigate={handleNavigate}
        products={products}
        settings={settings}
        isAdminLoggedIn={isAdminLoggedIn}
        onAdminLogout={() => setShowAdminLogoutConfirm(true)}
        currentAdmin={currentAdmin}
        adminSubTab={adminSubTab}
      />

      {/* 2. Main Page Views Routing Switcher */}
      <main className="flex-1 pb-16 transition-colors duration-200">
        
        {/* ======================================= */}
        {/* VIEW: HOME PAGE                         */}
        {/* ======================================= */}
        {currentTab === 'home' && (
          <div className="space-y-8 animate-in fade-in-50 duration-300">
            {/* Visual Promos & Slider */}
            <HeroSlider
              settings={settings}
              flashSaleProduct={flashSaleProduct}
              onNavigate={handleNavigate}
            />

            {/* Active Promotional Campaigns Banner */}
            <CampaignBanner
              campaigns={activeCampaigns}
              onNavigate={handleNavigate}
            />

            {/* Quick categories circle layout */}
            <section className="max-w-7xl mx-auto px-4 md:px-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white mb-6 border-r-4 border-amber-500 pr-3">تصفح أجهزة المنزل والرفاهية بالأقسام</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    onClick={() => handleNavigate('products', { category: cat })}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer shadow-xs hover:shadow-lg transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                      <ShoppingCart className="w-5 h-5 text-amber-500" />
                    </div>
                    <span className="text-xs font-black text-slate-800 dark:text-white leading-tight">{cat}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1.5">{products.filter(p => p.category === cat).length} جهاز متاح</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Featured Showcase grid */}
            <section className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-slate-900 dark:text-white border-r-4 border-amber-500 pr-3">أجهزة مميزة وننصح بها (الوكلاء الرسميين) ⭐</h2>
                <button
                  onClick={() => handleNavigate('products')}
                  className="text-xs text-amber-600 dark:text-amber-400 font-black hover:underline flex items-center gap-1 cursor-pointer"
                >
                  عرض جميع الأجهزة
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {products.filter(p => p.isFeatured).slice(0, 4).map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isWishlisted={activeWishlist.includes(p.id)}
                    onNavigate={handleNavigate}
                    onToggleWishlist={handleToggleWishlist}
                    onAddToCart={handleAddToCart}
                    activeCampaigns={activeCampaigns}
                  />
                ))}
              </div>
            </section>

            {/* Best Sellers Section: ⭐ الأكثر مبيعاً */}
            {(bestSellersLoading || displayBestSellers.length > 0) && (
              <section className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white border-r-4 border-amber-500 pr-3">⭐ الأكثر مبيعاً</h2>
                  <button
                    onClick={() => handleNavigate('products')}
                    className="text-xs text-amber-600 dark:text-amber-400 font-black hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    عرض جميع الأجهزة
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {bestSellersLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse space-y-3">
                        <div className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-lg w-full"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {displayBestSellers.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        isWishlisted={activeWishlist.includes(p.id)}
                        onNavigate={handleNavigate}
                        onToggleWishlist={handleToggleWishlist}
                        onAddToCart={handleAddToCart}
                        activeCampaigns={activeCampaigns}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Trending Products Section: 🔥 الأكثر رواجاً */}
            {(trendingLoading || displayTrending.length > 0) && (
              <section className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white border-r-4 border-amber-500 pr-3">🔥 الأكثر رواجاً</h2>
                  <button
                    onClick={() => handleNavigate('products')}
                    className="text-xs text-amber-600 dark:text-amber-400 font-black hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    عرض جميع الأجهزة
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {trendingLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse space-y-3">
                        <div className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-lg w-full"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {displayTrending.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        isWishlisted={activeWishlist.includes(p.id)}
                        onNavigate={handleNavigate}
                        onToggleWishlist={handleToggleWishlist}
                        onAddToCart={handleAddToCart}
                        activeCampaigns={activeCampaigns}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* New Arrivals Section: 🆕 أحدث المنتجات */}
            {(newArrivalsLoading || displayNewArrivals.length > 0) && (
              <section className="max-w-7xl mx-auto px-4 md:px-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white border-r-4 border-amber-500 pr-3">🆕 أحدث المنتجات</h2>
                  <button
                    onClick={() => handleNavigate('products')}
                    className="text-xs text-amber-600 dark:text-amber-400 font-black hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    عرض جميع الأجهزة
                    <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                {newArrivalsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse space-y-3">
                        <div className="aspect-square bg-slate-200 dark:bg-slate-800 rounded-lg w-full"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {displayNewArrivals.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        isWishlisted={activeWishlist.includes(p.id)}
                        onNavigate={handleNavigate}
                        onToggleWishlist={handleToggleWishlist}
                        onAddToCart={handleAddToCart}
                        activeCampaigns={activeCampaigns}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Premium visual banner between grids */}
            <section className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="relative rounded-2xl overflow-hidden shadow-md bg-slate-900 text-white p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-6 border border-slate-800">
                <div className="absolute inset-0 bg-radial-gradient from-amber-500/10 via-transparent to-transparent pointer-events-none" />
                <div className="text-right">
                  <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">دعم ما بعد البيع 🛠️</span>
                  <h3 className="text-xl md:text-2xl font-black mt-3 leading-snug">صيانة وتركيب مجاني لكافة الأجهزة المنزلية الكبرى</h3>
                  <p className="text-xs text-gray-400 mt-2 max-w-lg leading-relaxed">
                    لا تقلق بشأن التركيب بعد الشراء! نرسل فني صيانة من شركة الوكيل المعتمدة لموقعك للتركيب وتشغيل الضمان مجاناً بالكامل.
                  </p>
                </div>
                <button
                  onClick={() => handleNavigate('contact')}
                  className="py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  طلب صيانة منزلية
                </button>
              </div>
            </section>

            {/* Best Sellers and Offers lists split */}
            <section className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Best sellers */}
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white mb-5 border-r-4 border-amber-500 pr-2.5">الأجهزة الأكثر طلباً في مصر 🔥</h2>
                <div className="space-y-4">
                  {products.filter(p => p.isBestSeller).slice(0, 3).map((p) => {
                    const price = p.discountPrice || p.price;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleNavigate('product-details', p.id)}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex gap-4 hover:shadow-md cursor-pointer transition-all"
                      >
                        <img src={p.mainImage} alt={p.title} className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-800" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{p.title}</h4>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">{price} ج.م</span>
                            <span className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">{p.brand}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Latest Arrivals */}
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white mb-5 border-r-4 border-amber-500 pr-2.5">جديد الأجهزة الكهربائية الواردة حديثاً 🆕</h2>
                <div className="space-y-4">
                  {products.filter(p => p.isLatest).slice(0, 3).map((p) => {
                    const price = p.discountPrice || p.price;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleNavigate('product-details', p.id)}
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex gap-4 hover:shadow-md cursor-pointer transition-all"
                      >
                        <img src={p.mainImage} alt={p.title} className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-800" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{p.title}</h4>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">{price} ج.م</span>
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-bold">{p.category}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: PRODUCTS LISTING PAGE             */}
        {/* ======================================= */}
        {currentTab === 'products' && (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 animate-in fade-in-50 duration-300 space-y-6">
            {/* Active Promotional Campaigns Banner */}
            <CampaignBanner
              campaigns={activeCampaigns}
              onNavigate={handleNavigate}
            />

            {/* Header filters details */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">تصفح الفهرس الشامل</span>
                <h1 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">كل الأجهزة والمعدات المنزلية المتاحة</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  وجدنا <strong className="text-amber-600 dark:text-amber-400">{filteredList.length} جهاز</strong> يطابق شروط تصفيتك الحالية
                </p>
              </div>

              {/* Sorting and quick search input bar */}
              <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
                <input
                  type="text"
                  placeholder="ابحث بالاسم هنا..."
                  value={filterSearch}
                  onChange={(e) => {
                    setFilterSearch(e.target.value);
                    setFilterPage(1);
                  }}
                  className="text-xs border border-slate-200 dark:border-amber-500/20 bg-white dark:bg-slate-900 rounded-lg py-2 px-3 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 w-full sm:w-48 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />

                <div className="w-full sm:w-56">
                  <CustomSelect
                    value={filterSort}
                    onChange={(val) => {
                      setFilterSort(val);
                      setFilterPage(1);
                    }}
                    size="sm"
                    buttonClassName="w-full text-xs border border-slate-200 dark:border-amber-500/20 rounded-lg p-2 font-bold bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-amber-500"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 min-w-[200px]"
                    options={[
                      { value: 'featured', label: 'المقترحة والمميزة' },
                      { value: 'newest', label: 'وصل حديثاً (الأحدث)' },
                      { value: 'cheapest', label: 'السعر: من الأقل للأعلى' },
                      { value: 'expensive', label: 'السعر: من الأعلى للأقل' },
                      { value: 'rating', label: 'الأعلى تقييماً' },
                      { value: 'bestselling', label: 'الأكثر مبيعاً' },
                      { value: 'name_asc', label: 'الاسم: أ - ي' },
                      { value: 'name_desc', label: 'الاسم: ي - أ' }
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Active Filter Chips & Results Summary Bar */}
            <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Results Counter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">عدد النتائج:</span>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-800/60">
                    {filteredList.length} منتج
                  </span>
                </div>

                {/* Clear All Button */}
                {activeChips.length > 0 && (
                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 px-3.5 py-1.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>مسح جميع الفلاتر</span>
                  </button>
                )}
              </div>

              {/* Active Chips List */}
              {activeChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 pl-1">الفلاتر النشطة:</span>
                  {activeChips.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 font-bold text-xs px-3 py-1 rounded-full shadow-2xs animate-in fade-in duration-150"
                    >
                      <span>{chip.label}</span>
                      <button
                        onClick={chip.onRemove}
                        className="p-0.5 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-800 dark:text-amber-300 transition-colors cursor-pointer"
                        title="إزالة هذا الفلتر"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar Filters + Grid split */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Sidebar filter column (1 col on lg) */}
              <div className="lg:col-span-1">
                <ProductFilters
                  categories={categories}
                  brands={brands}
                  selectedCategory={filterCategory}
                  selectedBrand={filterBrand}
                  minPrice={filterMinPrice}
                  maxPrice={filterMaxPrice}
                  selectedRating={filterRating}
                  isOffer={filterIsOffer}
                  inStockOnly={filterInStockOnly}
                  isFeatured={filterIsFeatured}
                  isNewArrival={filterIsNewArrival}
                  selectedSort={filterSort}
                  totalResults={filteredList.length}
                  onFilterChange={(newFilters) => {
                    let changed = false;
                    if (newFilters.category !== undefined) { setFilterCategory(newFilters.category); changed = true; }
                    if (newFilters.brand !== undefined) { setFilterBrand(newFilters.brand); changed = true; }
                    if (newFilters.minPrice !== undefined) { setFilterMinPrice(newFilters.minPrice); changed = true; }
                    if (newFilters.maxPrice !== undefined) { setFilterMaxPrice(newFilters.maxPrice); changed = true; }
                    if (newFilters.rating !== undefined) { setFilterRating(newFilters.rating); changed = true; }
                    if (newFilters.isOffer !== undefined) { setFilterIsOffer(newFilters.isOffer); changed = true; }
                    if (newFilters.inStockOnly !== undefined) { setFilterInStockOnly(newFilters.inStockOnly); changed = true; }
                    if (newFilters.isFeatured !== undefined) { setFilterIsFeatured(newFilters.isFeatured); changed = true; }
                    if (newFilters.isNewArrival !== undefined) { setFilterIsNewArrival(newFilters.isNewArrival); changed = true; }
                    if (newFilters.sort !== undefined) { setFilterSort(newFilters.sort); changed = true; }
                    if (changed) {
                      setFilterPage(1);
                    }
                  }}
                  onReset={handleResetFilters}
                />
              </div>

              {/* Products grid columns (3 cols on lg) */}
              <div ref={productGridTopRef} className="lg:col-span-3 scroll-mt-24">
                {filteredList.length > 0 ? (
                  <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {paginatedList.map((p) => (
                        <ProductCard
                          key={p.id}
                          product={p}
                          isWishlisted={activeWishlist.includes(p.id)}
                          onNavigate={handleNavigate}
                          onToggleWishlist={handleToggleWishlist}
                          onAddToCart={handleAddToCart}
                          activeCampaigns={activeCampaigns}
                        />
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex flex-wrap items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs mt-2 gap-3">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          صفحة <strong className="text-slate-900 dark:text-white">{safeCurrentPage}</strong> من <strong className="text-slate-900 dark:text-white">{totalPages}</strong>
                        </span>

                        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                          {/* First Page */}
                          <button
                            disabled={safeCurrentPage <= 1}
                            onClick={() => handlePageChange(1)}
                            title="الصفحة الأولى"
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-amber-500 hover:border-amber-500 hover:text-slate-950 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 disabled:hover:border-slate-200 dark:disabled:hover:border-slate-700 disabled:hover:text-slate-800 dark:disabled:hover:text-slate-200 disabled:cursor-not-allowed cursor-pointer transition-all"
                          >
                            الأولى
                          </button>

                          {/* Previous Page */}
                          <button
                            disabled={safeCurrentPage <= 1}
                            onClick={() => handlePageChange(safeCurrentPage - 1)}
                            title="الصفحة السابقة"
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-amber-500 hover:border-amber-500 hover:text-slate-950 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 disabled:hover:border-slate-200 dark:disabled:hover:border-slate-700 disabled:hover:text-slate-800 dark:disabled:hover:text-slate-200 disabled:cursor-not-allowed cursor-pointer transition-all"
                          >
                            السابق
                          </button>

                          {/* Numbered Pages */}
                          {getPaginationRange(safeCurrentPage, totalPages).map((pItem, idx) => {
                            if (typeof pItem === 'string') {
                              return (
                                <span key={`ellipsis-${idx}`} className="px-1 text-xs text-slate-400 dark:text-slate-500 font-bold select-none">
                                  ...
                                </span>
                              );
                            }
                            const isCurrent = safeCurrentPage === pItem;
                            return (
                              <button
                                key={pItem}
                                onClick={() => handlePageChange(pItem)}
                                className={`w-8 h-8 text-xs font-bold rounded-xl cursor-pointer transition-all ${
                                  isCurrent
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                {pItem}
                              </button>
                            );
                          })}

                          {/* Next Page */}
                          <button
                            disabled={safeCurrentPage >= totalPages}
                            onClick={() => handlePageChange(safeCurrentPage + 1)}
                            title="الصفحة التالية"
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-amber-500 hover:border-amber-500 hover:text-slate-950 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 disabled:hover:border-slate-200 dark:disabled:hover:border-slate-700 disabled:hover:text-slate-800 dark:disabled:hover:text-slate-200 disabled:cursor-not-allowed cursor-pointer transition-all"
                          >
                            التالي
                          </button>

                          {/* Last Page */}
                          <button
                            disabled={safeCurrentPage >= totalPages}
                            onClick={() => handlePageChange(totalPages)}
                            title="الصفحة الأخيرة"
                            className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-amber-500 hover:border-amber-500 hover:text-slate-950 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 disabled:hover:border-slate-200 dark:disabled:hover:border-slate-700 disabled:hover:text-slate-800 dark:disabled:hover:text-slate-200 disabled:cursor-not-allowed cursor-pointer transition-all"
                          >
                            الأخيرة
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center gap-3">
                    <HelpCircle className="w-10 h-10 text-amber-500 animate-bounce" />
                    <h3 className="font-extrabold text-slate-800 dark:text-white text-base">لم يتم العثور على منتجات مطابقة.</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">جرب البحث باستخدام كلمات أخرى مثل اسم الماركة أو الفئة، أو اضغط زر إعادة الضبط لمشاهدة جميع الأجهزة المتوفرة.</p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-2 py-2 px-6 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                    >
                      إعادة تصفير المحددات
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: PRODUCT DETAILS PAGE              */}
        {/* ======================================= */}
        {currentTab === 'product-details' && selectedProduct && (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 animate-in fade-in-50 duration-300">
            {/* Breadcrumbs */}
            <div className="flex gap-2 items-center text-xs text-slate-500 dark:text-slate-400 font-bold mb-6">
              <span className="hover:text-amber-500 cursor-pointer" onClick={() => handleNavigate('home')}>الرئيسية</span>
              <span>/</span>
              <span className="hover:text-amber-500 cursor-pointer" onClick={() => handleNavigate('products', { category: selectedProduct.category })}>{selectedProduct.category}</span>
              <span>/</span>
              <span className="text-slate-800 dark:text-slate-200">{selectedProduct.title}</span>
            </div>

            {/* Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
              {/* Product Images (takes 5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="aspect-square bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex items-center justify-center overflow-hidden shadow-xs">
                  <img src={activeImage} alt={selectedProduct.title} className="max-h-full max-w-full object-contain hover:scale-105 transition-transform duration-350" />
                </div>
                {/* Image Thumbnails carousel list */}
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {selectedProduct.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(img)}
                        className={`w-20 h-20 bg-white dark:bg-slate-900 rounded-xl border p-2 flex items-center justify-center overflow-hidden shrink-0 transition-all cursor-pointer ${activeImage === img ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600'}`}
                      >
                        <img src={img} alt="نموذج" className="max-h-full max-w-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product details info (takes 7 cols) */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm text-right flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/15 px-3 py-1 rounded-full">{selectedProduct.brand}</span>
                      <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-2.5 leading-snug">{selectedProduct.title}</h1>
                    </div>
                    {/* Wishlist Button */}
                    <button
                      onClick={(e) => handleToggleWishlist(selectedProduct.id, e)}
                      className="p-3 bg-slate-50 dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-amber-500/20 text-slate-400 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
                    >
                      <Heart className={`w-5 h-5 ${activeWishlist.includes(selectedProduct.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>

                  {/* Rating summary */}
                  <div className="flex items-center gap-1.5 mb-6">
                    <div className="flex text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < Math.floor(selectedProduct.rating) ? 'fill-amber-400' : 'text-slate-300 dark:text-slate-700'}`} />
                      ))}
                    </div>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200">{selectedProduct.rating} من 5</span>
                    <span className="text-slate-400 dark:text-slate-600">|</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">{selectedProduct.reviewsCount} تقييم مكتوب</span>
                  </div>

                  {/* Description Paragraph */}
                  <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-medium">
                    {selectedProduct.description}
                  </p>

                  {/* Technical specs table snippet */}
                  <div className="border border-slate-200 dark:border-amber-500/20 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-900/60 mb-6 space-y-2">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white mb-3">أهم المواصفات الفنية</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {selectedProduct.specifications.slice(0, 3).map((spec, i) => (
                        <div key={i} className="flex flex-col gap-0.5">
                          <span className="text-slate-500 dark:text-slate-400 font-bold">{spec.key}</span>
                          <span className="text-slate-800 dark:text-slate-200 font-extrabold">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Variants Option selection */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white mb-3">المقاس والخيارات المتاحة لهذا الموديل:</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.variants.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => {
                              setSelectedVariant(v);
                            }}
                            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${selectedVariant?.id === v.id ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900'}`}
                          >
                            {v.size || v.capacity || v.color || 'موديل إضافي'} - {v.price} ج.م
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pricing & Add to cart actions footer inside card */}
                <div className="border-t border-slate-100 dark:border-slate-800 pt-6 mt-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black block">السعر النهائي للدفع كاش</span>
                      {selectedProduct.discountPrice ? (
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black text-slate-900 dark:text-white">{selectedVariant ? selectedVariant.price : selectedProduct.discountPrice} ج.م</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 line-through">{selectedProduct.price} ج.م</span>
                        </div>
                      ) : (
                        <span className="text-2xl font-black text-slate-900 dark:text-white mt-1">{selectedVariant ? selectedVariant.price : selectedProduct.price} ج.م</span>
                      )}
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2 border border-slate-200 dark:border-amber-500/20 rounded-lg p-1 bg-slate-50 dark:bg-slate-900">
                      <button onClick={() => setQuantity(prev => prev > 1 ? prev - 1 : 1)} className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"><Minus className="w-4 h-4" /></button>
                      <span className="px-3 text-xs font-black text-slate-900 dark:text-white font-mono">{quantity}</span>
                      <button onClick={() => setQuantity(prev => prev + 1)} className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-4">
                    {selectedProduct.stock === 0 ? (
                      <button disabled className="flex-1 py-3 bg-slate-150 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-black rounded-xl text-xs border border-slate-200 dark:border-slate-700 cursor-not-allowed">نفد المخزون مؤقتاً ⚠️</button>
                    ) : (
                      <button
                        onClick={handleDetailedAddToCart}
                        className="flex-1 py-3 px-6 bg-slate-950 dark:bg-amber-500 hover:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 hover:text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer text-center flex justify-center items-center gap-1.5 shadow-md"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        أضف هذا الخيار لسلة التسوق
                      </button>
                    )}
                    <button
                      onClick={() => handleNavigate('products')}
                      className="py-3 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      مواصلة التسوق
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Tabs details (Specifications, Reviews) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm text-right">
              <h3 className="font-extrabold text-slate-900 dark:text-white text-sm pb-3 border-b-2 border-amber-500 inline-block mb-6 pr-1">المواصفات الفنية الفوقية والمراجعات</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Specs list */}
                <div>
                  <h4 className="font-black text-xs text-slate-900 dark:text-white mb-4">جدول المواصفات والخصائص (Datasheet)</h4>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                    {selectedProduct.specifications.map((spec, i) => (
                      <div key={i} className="grid grid-cols-3 gap-4 p-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <span className="font-bold text-slate-500 dark:text-slate-400 col-span-1">{spec.key}</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 col-span-2">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reviews */}
                <div>
                  {(() => {
                    const avgRating = productReviewsData?.summary?.averageRating ? Number(productReviewsData.summary.averageRating) : (selectedProduct.rating || 0);
                    const totalRevCount = productReviewsData?.summary?.totalReviews ?? selectedProduct.reviewsCount ?? 0;
                    const reviewsList = productReviewsData?.reviews || selectedProduct.reviews || [];

                    return (
                      <>
                        <h4 className="font-black text-xs text-slate-900 dark:text-white mb-4">
                          آراء ومراجعات عملائنا ({totalRevCount})
                        </h4>

                        {/* Rating Summary & Distribution */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-5 text-xs">
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                            <div className="md:col-span-4 text-center md:border-l border-slate-200 dark:border-slate-700 pl-4">
                              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                {avgRating > 0 ? avgRating.toFixed(1) : '0.0'}
                              </div>
                              <div className="flex justify-center text-amber-400 my-1">
                                {Array.from({ length: 5 }).map((_, st) => (
                                  <Star key={st} className={`w-4 h-4 ${st < Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`} />
                                ))}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                بناءً على {totalRevCount} {totalRevCount === 1 ? 'تقييم' : 'تقييمات'}
                              </div>
                            </div>
                            <div className="md:col-span-8 space-y-1.5">
                              {[5, 4, 3, 2, 1].map((star) => {
                                const count = productReviewsData?.summary?.ratingDistribution?.[star] || 0;
                                const pct = totalRevCount > 0 ? Math.round((count / totalRevCount) * 100) : 0;
                                return (
                                  <div key={star} className="flex items-center gap-2">
                                    <div className="flex items-center gap-0.5 w-10 shrink-0 font-bold text-[11px] text-slate-700 dark:text-slate-300">
                                      <span>{star}</span>
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    </div>
                                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 w-8 text-left font-mono">({count})</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Reviews Section States */}
                        {productReviewsLoading ? (
                          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-amber-500 mx-auto mb-2"></div>
                            جاري تحميل مراجعات وتقييمات العملاء...
                          </div>
                        ) : reviewsList.length > 0 ? (
                          <div className="space-y-3 max-h-80 overflow-y-auto mb-6 pr-1">
                            {reviewsList.map((r: any, i: number) => {
                              const isVerified = r.isVerifiedPurchase === true || r.isVerifiedPurchase === 1;
                              const customerName = r.customerName || r.userName || 'عميل المتجر';
                              const variantTag = r.variantInfo || r.variantTitle || r.variantName;

                              return (
                                <div key={r.id || i} className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-right text-xs">
                                  <div className="flex justify-between items-start mb-2 gap-2">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-black text-slate-900 dark:text-white">{customerName}</span>
                                        {isVerified && (
                                          <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> مشتري مؤكد
                                          </span>
                                        )}
                                        {variantTag && (
                                          <span className="text-[10px] bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded">
                                            {variantTag}
                                          </span>
                                        )}
                                      </div>
                                      {r.title && <h5 className="font-bold text-slate-900 dark:text-white text-xs">{r.title}</h5>}
                                    </div>
                                    <div className="flex text-amber-400 shrink-0">
                                      {Array.from({ length: 5 }).map((_, st) => (
                                        <Star key={st} className={`w-3.5 h-3.5 ${st < r.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`} />
                                      ))}
                                    </div>
                                  </div>

                                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs">{r.comment}</p>

                                  {r.createdAt && (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 block font-mono">
                                      {new Date(r.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                  )}

                                  {/* Admin Response */}
                                  {r.adminResponse && (
                                    <div className="mt-2.5 p-2.5 bg-amber-50/80 dark:bg-amber-950/40 border-r-2 border-amber-500 rounded-l-lg text-right text-xs">
                                      <div className="font-black text-amber-900 dark:text-amber-300 text-[11px] mb-1 flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> رد إدارة المتجر
                                      </div>
                                      <p className="text-slate-700 dark:text-slate-300 leading-normal">{r.adminResponse}</p>
                                      {(r.adminRespondedAt || r.updatedAt) && (
                                        <span className="text-[9px] text-amber-800/60 dark:text-amber-400/60 mt-1 block font-mono">
                                          {new Date(r.adminRespondedAt || r.updatedAt).toLocaleDateString('ar-EG')}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : productReviewsError ? (
                          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 text-xs rounded-xl mb-4 text-right font-medium">
                            {productReviewsError}
                          </div>
                        ) : (
                          <div className="mb-6">
                            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                              لا توجد مراجعات سابقة على هذا الجهاز بعد، كن أول من يضيف رأيه!
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Review Submission Section */}
                  {eligibilityLoading ? (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-center text-slate-400 dark:text-slate-500 py-4">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-amber-500 mx-auto mb-1"></div>
                      جاري التحقق من إمكانية تقديم مراجعة...
                    </div>
                  ) : !customer || reviewEligibility?.reason === 'NOT_LOGGED_IN' ? (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl text-center space-y-2">
                        <p className="font-bold text-slate-800 dark:text-white">هل جربت هذا المنتج؟ شاركنا رأيك وتقييمك!</p>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px]">يرجى تسجيل الدخول لتقييم هذا المنتج.</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleNavigate('customer-account', { subTab: 'profile' });
                          }}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold rounded-lg transition-colors cursor-pointer text-xs shadow-sm active:scale-95"
                        >
                          تسجيل الدخول / إنشاء حساب <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : reviewEligibility?.reason === 'ALREADY_REVIEWED' || reviewEligibility?.hasExistingReview ? (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-xs space-y-3">
                      {reviewAlert.type === 'success' && reviewAlert.message && (
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-xs font-bold rounded-lg flex items-center gap-1.5 animate-in fade-in duration-200">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{reviewAlert.message}</span>
                        </div>
                      )}
                      <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-slate-800 dark:text-slate-200 text-right space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                          <Check className="w-4 h-4 text-amber-600 shrink-0" />
                          شكرًا لك! لقد قمت بتقييم هذا المنتج مسبقاً.
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          يمكنك الاطلاع على تقييمك السابق ضمن قائمة مراجعات المنتج أعلاه أو عبر صفحة حسابك.
                        </p>
                      </div>
                    </div>
                  ) : reviewEligibility?.reason === 'NOT_PURCHASED' || (!reviewEligibility?.hasPurchased && !reviewEligibility?.canReview) ? (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
                      <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-slate-800 dark:text-slate-200 text-right space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          عذرًا، التقييم متاح فقط للعملاء الذين قاموا بشراء هذا المنتج بنجاح.
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          تأكد من إتمام واستلام طلبك الذي يحتوي على هذا المنتج لتتمكن من إضافة مراجعتك وتقييمك.
                        </p>
                      </div>
                    </div>
                  ) : reviewEligibility?.reason === 'ELIGIBLE' || reviewEligibility?.canReview ? (
                    <form onSubmit={handleReviewSubmit} className="border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-black text-slate-900 dark:text-white">أضف مراجعتك الشخصية وتقييمك للمنتج</h5>
                        <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> مشتري مؤكد
                        </span>
                      </div>

                      {reviewAlert.type === 'success' && reviewAlert.message && (
                        <div className="mb-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-xs font-bold rounded-lg flex items-center gap-1.5 animate-in fade-in duration-200">
                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{reviewAlert.message}</span>
                        </div>
                      )}

                      {reviewAlert.type === 'error' && reviewAlert.message && (
                        <div className="mb-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 text-xs font-bold rounded-lg animate-in fade-in duration-200">
                          {reviewAlert.message}
                        </div>
                      )}

                      {/* Star Rating Picker */}
                      <div className="mb-3">
                        <label className="text-slate-600 dark:text-slate-300 font-bold block mb-1">التقييم بالنجوم *</label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => {
                                setReviewRating(star);
                                if (reviewAlert.type === 'error') {
                                  setReviewAlert({ type: null, message: null });
                                }
                              }}
                              className="p-1 hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                            >
                              <Star
                                className={`w-6 h-6 ${
                                  star <= reviewRating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-300 dark:text-slate-700 hover:text-amber-200'
                                }`}
                              />
                            </button>
                          ))}
                          <span className="mr-2 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                            {reviewRating} من 5
                          </span>
                        </div>
                      </div>

                      {/* Optional Review Title */}
                      <div className="mb-3">
                        <label className="text-slate-600 dark:text-slate-300 font-bold block mb-1">عنوان التقييم (اختياري)</label>
                        <input
                          type="text"
                          value={reviewTitle}
                          onChange={(e) => {
                            setReviewTitle(e.target.value);
                            if (reviewAlert.type === 'error') {
                              setReviewAlert({ type: null, message: null });
                            }
                          }}
                          placeholder="مثال: تجربة ممتازة وتبريد ممتاز"
                          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg p-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {/* Comment */}
                      <div className="mb-3">
                        <label className="text-slate-600 dark:text-slate-300 font-bold block mb-1">التعليق والملاحظات *</label>
                        <textarea
                          required
                          rows={3}
                          value={reviewComment}
                          onChange={(e) => {
                            setReviewComment(e.target.value);
                            if (reviewAlert.type === 'error') {
                              setReviewAlert({ type: null, message: null });
                            }
                          }}
                          placeholder="ما رأيك في جودة المنتج والأداء وملاحظاتك الفنية؟"
                          className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg p-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={reviewSubmitLoading}
                        className="w-full sm:w-auto py-2 px-5 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 disabled:opacity-50 text-white dark:text-slate-950 rounded-lg font-bold cursor-pointer transition-colors flex items-center justify-center gap-2"
                      >
                        {reviewSubmitLoading && <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white dark:border-slate-950"></div>}
                        إرسال المراجعة والتقييم
                      </button>
                    </form>
                  ) : (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 text-right">
                        <p className="font-medium text-[11px]">
                          لا يمكنك تقديم مراجعة لهذا المنتج حالياً.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* ======================================= */}
            {/* RECOMMENDATIONS SECTION: "منتجات مشابهة" */}
            {/* ======================================= */}
            <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm text-right">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base md:text-lg">منتجات مشابهة</h3>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">قد تعجبك أيضاً</span>
              </div>

              {recommendationsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse space-y-3">
                      <div className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-lg w-full"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              ) : recommendationsError ? (
                <div className="p-8 text-center text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-800/40 rounded-xl">
                  {recommendationsError}
                </div>
              ) : recommendations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {recommendations.map((rec) => (
                    <ProductCard
                      key={rec.id}
                      product={rec}
                      isWishlisted={activeWishlist.includes(rec.id)}
                      onNavigate={handleNavigate}
                      onToggleWishlist={handleToggleWishlist}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                  لا توجد منتجات مشابهة متاحة حالياً.
                </div>
              )}
            </div>

            {/* ======================================= */}
            {/* RECENTLY VIEWED SECTION: "شاهدتها مؤخراً" */}
            {/* ======================================= */}
            {recentlyViewedProducts.length > 0 && (
              <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm text-right">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base md:text-lg">شاهدتها مؤخراً</h3>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">منتجات قمت بتصفحها مسبقاً</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {recentlyViewedProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      isWishlisted={activeWishlist.includes(p.id)}
                      onNavigate={handleNavigate}
                      onToggleWishlist={handleToggleWishlist}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ================================================= */}
            {/* CUSTOMERS ALSO BOUGHT SECTION: "العملاء اشتروا أيضاً" */}
            {/* ================================================= */}
            {(alsoBoughtLoading || alsoBoughtProducts.length > 0) && (
              <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-sm text-right">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base md:text-lg">العملاء اشتروا أيضاً</h3>
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-bold">منتجات كثر شراؤها مع هذا المنتج</span>
                </div>

                {alsoBoughtLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 animate-pulse space-y-3">
                        <div className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-lg w-full"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {alsoBoughtProducts.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        isWishlisted={activeWishlist.includes(p.id)}
                        onNavigate={handleNavigate}
                        onToggleWishlist={handleToggleWishlist}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: CART PAGE                         */}
        {/* ======================================= */}
        {currentTab === 'cart' && (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 animate-in fade-in-50 duration-300">
            <h1 className="text-xl font-black text-slate-900 dark:text-white mb-6 border-r-4 border-amber-500 pr-3">محتويات سلة التسوق الخاصة بك 🛒</h1>

            {cart.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: list items (takes 8 cols) */}
                <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
                  {cart.map((item: any, idx) => {
                    const price = item.currentPrice || (item.selectedVariant ? item.selectedVariant.price : (item.product.discountPrice || item.product.price));
                    const availStock = item.availableStock !== undefined ? item.availableStock : (item.selectedVariant ? item.selectedVariant.stock : item.product.stock);
                    const isOut = availStock <= 0 || item.isAvailable === false;
                    const isExceeding = availStock > 0 && availStock < item.quantity;

                    return (
                      <div key={idx} className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-none last:pb-0 text-right">
                        <img src={item.product.mainImage} alt={item.product.title} className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700 shrink-0" />
                        
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black bg-amber-500/10 px-2 py-0.5 rounded-full">{item.product.brand}</span>
                            {isOut && (
                              <span className="text-[10px] text-rose-700 dark:text-rose-400 font-black bg-rose-100 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">غير متوفر حالياً</span>
                            )}
                            {isExceeding && (
                              <span className="text-[10px] text-amber-800 dark:text-amber-300 font-black bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">المتاح فقط {availStock} قطع</span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate mt-1">{item.product.title}</h4>
                          {item.selectedVariant && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mt-1">الموديل: {item.selectedVariant.size || item.selectedVariant.color || item.selectedVariant.capacity}</span>
                          )}
                        </div>

                        {/* Qty modifiers */}
                        <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-lg p-1 bg-slate-50 dark:bg-slate-800 shrink-0">
                          <button onClick={() => handleUpdateCartQty(idx, -1)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><Minus className="w-3.5 h-3.5" /></button>
                          <span className="px-2 text-xs font-black font-mono text-slate-900 dark:text-white">{item.quantity}</span>
                          <button onClick={() => handleUpdateCartQty(idx, 1)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"><Plus className="w-3.5 h-3.5" /></button>
                        </div>

                        {/* Prices */}
                        <div className="text-left shrink-0">
                          <span className="text-sm font-black text-slate-900 dark:text-white block">{price * item.quantity} ج.م</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 block mt-0.5">{price} ج.م للحبة الواحده</span>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => handleRemoveCartItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Calculations (takes 4 cols) */}
                <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm h-fit">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-xs pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">ملخص السلة وتأكيد الأسعار</h3>
                  
                  {/* Coupon form */}
                  <form onSubmit={handleValidateCoupon} className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mb-1.5">هل تملك كوبون خصم ترويجي؟</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="أدخل رمز الكوبون"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value)}
                        disabled={!!activeCoupon}
                        className="flex-1 text-xs border border-slate-200 dark:border-amber-500/20 bg-white dark:bg-slate-900 rounded-lg px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                      {activeCoupon ? (
                        <button
                          type="button"
                          onClick={handleRemoveCoupon}
                          className="py-2 px-4 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-lg transition-colors cursor-pointer border border-rose-200 dark:border-rose-800/40"
                        >
                          إلغاء
                        </button>
                      ) : (
                        <button
                          type="submit"
                          className="py-2 px-4 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          تطبيق
                        </button>
                      )}
                    </div>
                    {couponError && (
                      <div className="mt-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold leading-relaxed">{couponError}</p>
                      </div>
                    )}
                    {activeCoupon && (
                      <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between">
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                          ✓ تم تفعيل الكود ({activeCoupon.code}) - وفرت {couponDiscount} ج.م
                        </p>
                      </div>
                    )}
                  </form>

                  {/* Pricing summaries */}
                  <div className="space-y-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex justify-between font-bold">
                      <span>إجمالي الأجهزة:</span>
                      <span className="text-slate-900 dark:text-white">
                        {cart.reduce((sum, item: any) => {
                          const p = item.currentPrice || (item.selectedVariant ? item.selectedVariant.price : (item.product.discountPrice || item.product.price));
                          return sum + (p * item.quantity);
                        }, 0)} ج.م
                      </span>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between font-black text-emerald-600 dark:text-emerald-400">
                        <span>الخصم المستقطع للكوبون:</span>
                        <span>-{couponDiscount} ج.م</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>الشحن الموحد للمحافظات:</span>
                      <span className="text-slate-900 dark:text-white font-bold">{settings.shippingFlatRate} ج.م</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleNavigate('checkout')}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md hover:shadow-amber-500/10 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    تأكيد البيانات والانتقال للشحن
                    <ChevronLeft className="w-4.5 h-4.5 stroke-[3]" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center gap-4 max-w-lg mx-auto">
                <ShoppingCart className="w-12 h-12 text-amber-500 animate-bounce" />
                <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">سلة التسوق فارغة تماماً من الأجهزة!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">ألقِ نظرة على أرقى شاشات OLED ثنائية الأبعاد، غسالات التعبئة الأمامية، أو تكييفات الهواء كاريير لإضافتها لسلتك!</p>
                <button
                  onClick={() => handleNavigate('products')}
                  className="mt-2 py-2.5 px-6 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  تصفح فهارس الأجهزة المنزلية
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: WISHLIST PAGE                     */}
        {/* ======================================= */}
        {currentTab === 'wishlist' && (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 animate-in fade-in-50 duration-300">
            <h1 className="text-xl font-black text-slate-900 dark:text-white mb-6 border-r-4 border-amber-500 pr-3">قائمة المنتجات المفضلة لديك 💖</h1>

            {activeWishlist.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {products.filter(p => activeWishlist.includes(p.id)).map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isWishlisted={true}
                    onNavigate={handleNavigate}
                    onToggleWishlist={handleToggleWishlist}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center gap-4 max-w-lg mx-auto">
                <Heart className="w-12 h-12 text-rose-500 animate-pulse" />
                <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">لا توجد أجهزة في المفضلة بعد!</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">عند تصفحك للموديلات، اضغط رمز القلب لحفظ الأجهزة التي تود مقارنتها أو شراؤها لاحقاً.</p>
                <button
                  onClick={() => handleNavigate('products')}
                  className="mt-2 py-2.5 px-6 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 text-white dark:text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  تصفح المنتجات الآن
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: CUSTOMER ACCOUNT SYSTEM PANEL      */}
        {/* ======================================= */}
        {currentTab === 'customer-account' && (
          <div className="animate-in fade-in-50 duration-300">
            <Suspense fallback={<LoaderFallback />}>
              <CustomerAccountSystem
                products={products}
                onNavigate={handleNavigate}
                initialSubTab={navigationArg?.subTab || 'profile'}
                onAddToCart={handleAddToCart}
              />
            </Suspense>
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: CHECKOUT FORM                     */}
        {/* ======================================= */}
        {currentTab === 'checkout' && (
          <Suspense fallback={<LoaderFallback />}>
            <CheckoutForm
              cart={cart}
              settings={settings}
              couponDiscount={couponDiscount}
              couponCode={activeCoupon?.code}
              activeCoupon={activeCoupon}
              onPlaceOrder={handlePlaceOrderSubmit}
              onBackToCart={() => handleNavigate('cart')}
            />
          </Suspense>
        )}

        {/* ======================================= */}
        {/* VIEW: ORDER SUCCESS LANDING CARD        */}
        {/* ======================================= */}
        {currentTab === 'order-success' && (
          <div className="max-w-md mx-auto px-4 py-16 animate-in fade-in-50 duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 text-center shadow-xl flex flex-col items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center animate-bounce">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <h1 className="text-xl font-black text-slate-900 dark:text-white">تم تسجيل طلب شحن الأجهزة بنجاح! 🎉</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                شكراً لتسوقك من متجرنا يا فندم! كود الطلب الخاص بك هو <strong className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded font-mono select-all text-sm">{(lastPlacedOrder?.id ? lastPlacedOrder.id.slice(-6).toUpperCase() : (trackerOrderId ? trackerOrderId.slice(-6).toUpperCase() : 'INV-CONFIRMED'))}</strong>. يرجى حفظ هذا الكود لتتبع شحنتك لاحقاً.
              </p>

              {/* COD instructions */}
              <div className="w-full text-right bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-2.5">
                <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-1.5"><Truck className="w-4 h-4 text-amber-500" /> إرشادات السداد والاستلام:</h3>
                <p>1. سيتصل بك فريق تأكيد المبيعات هاتفياً لمراجعة الأجهزة والعنوان قبل خروج الشحنة.</p>
                {lastPlacedOrder?.customer?.phone && (
                  <p>2. يرجى إبقاء هاتفك المحمول <strong className="text-slate-900 dark:text-white">({lastPlacedOrder.customer.phone})</strong> متاحاً لاستقبال مكالمة المندوب والتحقق الفني.</p>
                )}
                <p>{lastPlacedOrder?.customer?.phone ? '3.' : '2.'} الدفع نقداً بالكامل للمندوب بعد استلام وفحص عبوة الأجهزة المنزلية بسلام.</p>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    if (lastPlacedOrder?.id) {
                      setTrackerOrderId(lastPlacedOrder.id);
                    }
                    handleNavigate('track-order');
                  }}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  تتبع طلبي وشحنتي الآن
                </button>
                <button
                  onClick={() => handleNavigate('home')}
                  className="py-3 px-6 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  الرجوع للرئيسية
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: TRACK ORDER STATUS PAGE           */}
        {/* ======================================= */}
        {currentTab === 'track-order' && (
          <div className="max-w-2xl mx-auto px-4 py-8 animate-in fade-in-50 duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-md text-right">
              <h1 className="text-lg font-black text-slate-900 dark:text-white mb-2 border-r-4 border-amber-500 pr-3">تتبع حالة شحنة الأجهزة الكهربائية 🚚</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">أدخل كود طلبك المكون من 6 رموز لمراجعة مرحلة التحضير، الشحن، والتسليم الفوري</p>

              {/* Form query input */}
              <form onSubmit={handleTrackOrderSubmit} className="space-y-4 mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">كود الطلب (أو آخر 6 رموز) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={trackerOrderId}
                      onChange={(e) => setTrackerOrderId(e.target.value)}
                      placeholder="مثال: AB34ED"
                      className="text-xs border border-slate-200 dark:border-amber-500/20 bg-white dark:bg-slate-900 rounded-lg p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 uppercase font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رقم الهاتف المحمول المسجل بالطلب <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      required
                      value={trackerPhone}
                      onChange={(e) => setTrackerPhone(e.target.value)}
                      placeholder="مثال: 01012345678"
                      className="text-xs border border-slate-200 dark:border-amber-500/20 bg-white dark:bg-slate-900 rounded-lg p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={trackerLoading}
                  className="w-full py-3 bg-slate-950 dark:bg-amber-500 hover:bg-amber-500 dark:hover:bg-amber-400 text-white dark:text-slate-950 hover:text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1.5 shadow-md"
                >
                  {trackerLoading ? (
                    <span className="w-5 h-5 border-2 border-white dark:border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      التحقق والاستعلام الفوري عن الطلب
                    </>
                  )}
                </button>

                {trackerError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded p-2 text-right">⚠️ {trackerError}</p>
                )}
              </form>

              {/* Tracking timeline result card */}
              {trackedOrder && (() => {
                const rawTotal = (trackedOrder as any)?.totalAmount ?? trackedOrder?.total ?? (trackedOrder as any)?.grandTotal ?? (trackedOrder as any)?.total_price ?? 0;
                const formattedTotal = Number(rawTotal).toLocaleString('ar-EG');
                const rawDate = trackedOrder?.createdAt || trackedOrder?.date || (trackedOrder as any)?.created_at || (trackedOrder as any)?.orderDate;
                const customerName = trackedOrder?.customer?.name || (trackedOrder as any)?.customerName || (trackedOrder as any)?.customer_name || 'عميل المتجر';

                return (
                  <div className="border-t border-slate-150 dark:border-slate-800 pt-6 animate-in fade-in duration-300">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl mb-6">
                      <div className="flex justify-between items-center text-xs">
                        <div className="text-slate-700 dark:text-slate-300">المشتري: <strong className="text-slate-900 dark:text-white font-bold">{customerName}</strong></div>
                        <div className="text-slate-700 dark:text-slate-300">القيمة الكلية: <strong className="text-amber-600 dark:text-amber-400 font-black">{formattedTotal} ج.م</strong></div>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-mono">تاريخ إنشاء الطلب: {formatOrderDate(rawDate)}</div>
                    </div>

                    {/* Stepper progress bars graphics */}
                    <div className="space-y-6 pt-2">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 block mb-4">مسار شحن الطرد والأجهزة</span>
                      
                      {[
                        { state: 'Pending', label: 'تم تسجيل الطلب واستلامه بالمخزن', desc: 'نراجع البيانات وسيتصل بك موظف التأكيد المبيعات قريباً جداً.' },
                        { state: 'Confirmed', label: 'تم التحقق الهاتفي وتأكيد الطلب ✓', desc: 'أكدنا صحة الموديلات والعنوان، بانتظار إفراج الفحص الفني.' },
                        { state: 'Preparing', label: 'تحت التغليف والتحضير بالمخزن الرئيسي', desc: 'يقوم موظفو المستودع بفحص الجهاز جيداً، وتعبئته بالفلّ المعزز المضاد للصدمات.' },
                        { state: 'Shipped', label: 'خارج للتوصيل مع مندوب الشحن بالطريق 🚚', desc: 'الشحنة بحوزة شركة نقل الأجهزة الكبرى، سيتصل بك المندوب هاتفياً لتسليم البيت.' },
                        { state: 'Delivered', label: 'تم استلام الأجهزة وسداد المبلغ بالكامل', desc: 'تم التوصيل بنجاح للعنوان المفصل وسددت الفاتورة نقداً COD.' }
                      ].map((step, idx, arr) => {
                        // determine status indexing
                        const statesInOrder = ['Pending', 'Confirmed', 'Preparing', 'Shipped', 'Delivered'];
                        const currentStatusIdx = statesInOrder.indexOf(trackedOrder?.status || 'Pending');
                        const stepIdx = statesInOrder.indexOf(step.state);

                        const isPassed = stepIdx <= currentStatusIdx;
                        const isCurrent = stepIdx === currentStatusIdx;

                        return (
                          <div key={idx} className="flex gap-4 relative">
                            {/* Line tracker */}
                            {idx < arr.length - 1 && (
                              <div className={`absolute right-3.5 top-8 w-0.5 h-12 -mr-0.25 ${stepIdx < currentStatusIdx ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                            )}

                            {/* Pin circle bubble */}
                            <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-xs border ${isPassed ? 'bg-amber-500 border-amber-500 text-slate-950 shadow' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}>
                              {isPassed ? '✓' : idx + 1}
                            </div>

                            {/* Desc details */}
                            <div className="text-right">
                              <h4 className={`text-xs font-black ${isPassed ? 'text-slate-900 dark:text-white font-extrabold' : 'text-slate-400 dark:text-slate-500'} ${isCurrent ? 'text-amber-600 dark:text-amber-400 font-extrabold' : ''}`}>{step.label}</h4>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal mt-1">{step.desc}</p>
                              {isCurrent && trackedOrder?.statusUpdateReason && (
                                <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400 mt-2">ملاحظة الخبير: {trackedOrder.statusUpdateReason}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: ABOUT / CONTACT / FAQ PAGES       */}
        {/* ======================================= */}
        {currentTab === 'faq' && (
          <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in-50 duration-300">
            <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2 border-r-4 border-amber-500 pr-3 text-right">الأسئلة الأكثر شيوعاً والمتكررة ❓</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 text-right">كل ما تود معرفته عن ضمان الأجهزة المنزلية، رسوم شحن المحافظات، ومميزات السداد كاش عند الاستلام</p>

            <div className="space-y-4 text-right">
              {faqs.map((f, idx) => (
                <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-xs mb-2.5 flex items-center gap-1.5"><Check className="w-4 h-4 text-amber-500 shrink-0" /> {f.question}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium pr-5">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'about' && (
          <div className="max-w-2xl mx-auto px-4 py-12 text-right animate-in fade-in-50 duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="text-center">
                <span className="text-[10px] text-amber-500 font-black bg-amber-500/10 px-2.5 py-1 rounded-full">تاريخنا وقيمنا</span>
                <h1 className="text-xl font-black text-slate-900 dark:text-white mt-3">من نحن - نخبة الأجهزة المنزلية الكبرى</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">نسعى لتجهيز البيوت بأرقى ماركات الأجهزة الاستهلاكية في مصر</p>
              </div>

              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                تأسست شركتنا ككيان وطني رائد لتوفير كافة متطلبات البيت العصري من الأجهزة الكهربائية الكبرى (ثلاجات، ديب فريزر، غسالات ملابس وأطباق، بوتاجازات، أفران بيلت إن، تكييفات هواء) وأحدث الإلكترونيات الاستهلاكية وأقوى شاشات OLED بأسعار عادلة وتنافسية تناسب الجميع.
              </p>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <strong className="text-lg text-amber-600 dark:text-amber-400 font-black block">10,000+</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block mt-1">عميل سعيد في كافة محافظات مصر</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <strong className="text-lg text-amber-600 dark:text-amber-400 font-black block">2 سنة</strong>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block mt-1">ضمان معتمد على جميع الأجهزة على الأقل</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'contact' && (
          <div className="max-w-2xl mx-auto px-4 py-12 text-right animate-in fade-in-50 duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="text-center">
                <span className="text-[10px] text-amber-500 font-black bg-amber-500/10 px-2.5 py-1 rounded-full">مركز الدعم والاتصال</span>
                <h1 className="text-xl font-black text-slate-900 dark:text-white mt-3">تواصل معنا الآن</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">يسعدنا تلقي طلباتكم واستفسارات الضمان والصيانة على مدار الساعة</p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 items-start">
                  <PhoneCall className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white mb-1">الخط الساخن للمبيعات والاستفسار</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300">اتصل بنا تليفونياً لمراجعة الطلبات أو طلب عروض الجملة:</p>
                    <strong className="text-sm text-slate-900 dark:text-white font-mono mt-1 block" dir="ltr">{settings.contactPhone}</strong>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 items-start">
                  <MapPin className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white mb-1">معرضنا ومقر الإدارة الرئيسي</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300">تفضل بزيارتنا لمشاهدة الموديلات حية وفحص التشغيل:</p>
                    <strong className="text-xs text-slate-900 dark:text-white mt-1 block">{settings.contactAddress}</strong>
                  </div>
                </div>

                {/* Dynamic Social Media Channels Section */}
                {(() => {
                  const activeSocial = Array.isArray(settings.socialLinks)
                    ? settings.socialLinks.filter(l => l.enabled !== false).sort((a, b) => (a.order || 0) - (b.order || 0))
                    : [
                        ...(settings.socialFacebook ? [{ id: 'facebook', name: 'Facebook', url: settings.socialFacebook, icon: 'facebook', enabled: true, order: 1, openInNewTab: true }] : []),
                        ...(settings.socialInstagram ? [{ id: 'instagram', name: 'Instagram', url: settings.socialInstagram, icon: 'instagram', enabled: true, order: 2, openInNewTab: true }] : []),
                        ...(settings.socialTwitter ? [{ id: 'twitter', name: 'Twitter', url: settings.socialTwitter, icon: 'twitter', enabled: true, order: 3, openInNewTab: true }] : [])
                      ];

                  if (activeSocial.length === 0) return null;

                  return (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3" id="contact-social-section">
                      <div className="flex items-center gap-2">
                        <Share2 className="w-5 h-5 text-amber-500 shrink-0" />
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">قنوات التواصل والمتابعة</h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">تابعنا على شبكات التواصل الاجتماعي للحصول على أحدث العروض والمسابقات</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {activeSocial.map(link => (
                          <a
                            key={link.id}
                            href={link.url}
                            target={link.openInNewTab !== false ? '_blank' : undefined}
                            rel={link.openInNewTab !== false ? 'noopener noreferrer' : undefined}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
                            id={`contact-social-link-${link.id}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                                <SocialIcon icon={link.icon} className="w-4 h-4" />
                              </div>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{link.name}</span>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0 transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 3. Smart floating chatbot trigger */}
      <Suspense fallback={null}>
        <GeminiChatAssistant onNavigate={handleNavigate} />
      </Suspense>

      {/* 4. Footer credits & navigation map */}
      <Footer settings={settings} onNavigate={handleNavigate} />
    </div>
  );
}
