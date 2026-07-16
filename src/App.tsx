import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Heart, Trash2, ArrowRight, Star, Plus, Minus,
  Tag, Check, HelpCircle, PhoneCall, Info, MapPin, Truck, ShieldCheck, Sparkles, ChevronLeft
} from 'lucide-react';
import { api } from './lib/api.js';
import { Product, CartItem, Order, Coupon, SystemSettings, ShippingDetails, ProductVariant } from './types.js';
import Header from './components/Header.js';
import Footer from './components/Footer.js';
import HeroSlider from './components/HeroSlider.js';
import ProductCard from './components/ProductCard.js';
import ProductFilters from './components/ProductFilters.js';
import CheckoutForm from './components/CheckoutForm.js';
import GeminiChatAssistant from './components/GeminiChatAssistant.js';
import AdminDashboard from './components/AdminDashboard.js';
import AdminProducts from './components/AdminProducts.js';
import AdminOrders from './components/AdminOrders.js';
import AdminCMS from './components/AdminCMS.js';

export default function App() {
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

  // Selected details tab states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);

  // Review form states
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

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

  // Admin authentication states
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_authenticated') === 'true';
  });
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

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
  const [filterSort, setFilterSort] = useState('featured');

  // Global loaders
  const [globalLoading, setGlobalLoading] = useState(true);

  // Initialize and load core endpoints from backend Express server
  const loadCoreData = async () => {
    try {
      const [settingsRes, categoriesRes, brandsRes, productsRes, faqsRes] = await Promise.all([
        api.getSettings(),
        api.getCategories(),
        api.getBrands(),
        api.getProducts(),
        api.getFaqs()
      ]);

      setSettings(settingsRes);
      setCategories(categoriesRes);
      setBrands(brandsRes);
      setProducts(productsRes);
      setFaqs(faqsRes);
    } catch (err) {
      console.error('Failed to load store catalog data:', err);
    } finally {
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    loadCoreData();

    // Recover Cart and Wishlist from localStorage
    const cachedCart = localStorage.getItem('cod_store_cart');
    if (cachedCart) {
      try { setCart(JSON.parse(cachedCart)); } catch (e) { console.error(e); }
    }
    const cachedWishlist = localStorage.getItem('cod_store_wishlist');
    if (cachedWishlist) {
      try { setWishlist(JSON.parse(cachedWishlist)); } catch (e) { console.error(e); }
    }
  }, []);

  // Save Cart to LocalStorage on changes
  useEffect(() => {
    localStorage.setItem('cod_store_cart', JSON.stringify(cart));
  }, [cart]);

  // Save Wishlist to LocalStorage on changes
  useEffect(() => {
    localStorage.setItem('cod_store_wishlist', JSON.stringify(wishlist));
  }, [wishlist]);

  // Handle direct custom navigation
  const handleNavigate = async (tab: string, arg?: any) => {
    setNavigationArg(arg);
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tab === 'product-details' && typeof arg === 'string') {
      try {
        const item = await api.getProductById(arg);
        setSelectedProduct(item);
        setSelectedVariant(item.variants && item.variants.length > 0 ? item.variants[0] : null);
        setActiveImage(item.mainImage);
        setQuantity(1);
        setReviewSuccess('');
        setReviewComment('');
      } catch (err) {
        console.error(err);
      }
    } else if (tab === 'products') {
      // Apply filters if passed via arg
      if (arg) {
        if (arg.category !== undefined) setFilterCategory(arg.category);
        if (arg.brand !== undefined) setFilterBrand(arg.brand);
        if (arg.search !== undefined) setFilterSearch(arg.search);
        if (arg.isOffer !== undefined) setFilterIsOffer(arg.isOffer);
      }
    }
  };

  // Toggle wishlist item
  const handleToggleWishlist = (productId: string, e: any) => {
    e.stopPropagation();
    setWishlist(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // Direct Cart additions
  const handleAddToCart = (product: Product, e: any) => {
    e.stopPropagation();
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

    // Success ripple UI feedback
    const btn = e.currentTarget as HTMLElement;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = 'تمت الإضافة للسلة! ✓';
    btn.classList.add('bg-amber-500', 'text-slate-950');
    setTimeout(() => {
      btn.innerHTML = oldHtml;
      btn.classList.remove('bg-amber-500', 'text-slate-950');
    }, 1500);
  };

  // Cart item modifier additions
  const handleDetailedAddToCart = () => {
    if (!selectedProduct) return;
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
    handleNavigate('cart');
  };

  const handleUpdateCartQty = (idx: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i === idx) {
        const newQty = item.quantity + delta;
        return { ...item, quantity: newQty < 1 ? 1 : newQty };
      }
      return item;
    }));
  };

  const handleRemoveCartItem = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  // Validate coupon codes
  const handleValidateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    if (!couponCodeInput.trim()) return;

    const cartTotal = cart.reduce((sum, item) => {
      const price = item.product.discountPrice || item.product.price;
      return sum + (price * item.quantity);
    }, 0);

    try {
      const res = await api.validateCoupon(couponCodeInput, cartTotal);
      setActiveCoupon(res);
      const discount = res.discountType === 'percentage'
        ? Math.round(cartTotal * (res.value / 100))
        : res.value;
      setCouponDiscount(discount);
    } catch (err: any) {
      setCouponError(err.message || 'الكوبون المدخل غير صالح أو انتهت صلاحيته');
      setCouponDiscount(0);
      setActiveCoupon(null);
    }
  };

  // Submit product review form
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !reviewName.trim() || !reviewComment.trim()) return;

    try {
      await api.submitReview(selectedProduct.id, {
        userName: reviewName.trim(),
        rating: reviewRating,
        comment: reviewComment.trim()
      });
      setReviewSuccess('تم إرسال مراجعتك بنجاح وسوف تظهر بعد المراجعة التدقيقية!');
      setReviewName('');
      setReviewComment('');
      setReviewRating(5);

      // Refresh product details
      const item = await api.getProductById(selectedProduct.id);
      setSelectedProduct(item);
    } catch (err) {
      setReviewSuccess('واجهنا خطأ أثناء رفع مراجعتك.');
    }
  };

  // Handle finalize order (Cash on Delivery)
  const handlePlaceOrderSubmit = async (shippingDetails: ShippingDetails) => {
    const orderItems = cart.map(item => ({
      productId: item.product.id,
      productTitle: item.product.title,
      variantSku: item.selectedVariant?.sku,
      variantInfo: item.selectedVariant
        ? `${item.selectedVariant.size || item.selectedVariant.color || item.selectedVariant.capacity || ''}`
        : undefined,
      quantity: item.quantity,
      price: item.product.discountPrice || item.product.price
    }));

    try {
      const order = await api.createOrder({
        customer: shippingDetails,
        items: orderItems,
        couponCode: activeCoupon?.code,
        discountAmount: couponDiscount
      });

      // Clear states
      setLastPlacedOrder(order);
      setCart([]);
      setCouponDiscount(0);
      setCouponCodeInput('');
      setActiveCoupon(null);
      setCurrentTab('order-success');
    } catch (err: any) {
      throw new Error(err.message || 'فشلت عملية إنشاء الطلب');
    }
  };

  // Track order state lookup
  const handleTrackOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackerError('');
    setTrackedOrder(null);

    if (!trackerOrderId.trim()) {
      setTrackerError('الرجاء إدخال كود الطلب المكون من 6 رموز أو الكود الكلي');
      return;
    }

    setTrackerLoading(true);
    try {
      const order = await api.trackOrder(trackerOrderId, trackerPhone ? trackerPhone : undefined);
      setTrackedOrder(order);
    } catch (err: any) {
      setTrackerError(err.message || 'لم نجد أي طلبات مطابقة للرمز المدخل، يرجى التحقق من الكود أو رقم الهاتف');
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
    setFilterSort('featured');
  };

  // Apply sorting and filtering client side
  const getFilteredProducts = () => {
    let list = [...products];

    if (filterCategory) {
      list = list.filter(p => p.category === filterCategory);
    }
    if (filterBrand) {
      list = list.filter(p => p.brand === filterBrand);
    }
    if (filterSearch) {
      const q = filterSearch.toLowerCase().trim();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
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
      list = list.filter(p => p.discountPrice !== undefined && p.discountPrice < p.price);
    }

    // Sort mappings
    if (filterSort === 'cheapest') {
      list.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
    } else if (filterSort === 'expensive') {
      list.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
    } else if (filterSort === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  };

  if (globalLoading || !settings) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center gap-4 font-sans">
        <Sparkles className="w-12 h-12 text-amber-500 animate-spin" />
        <h2 className="text-xl font-black">نخبة الأجهزة المنزلية الكبرى 🚚</h2>
        <p className="text-xs text-gray-400">يجري الآن تحميل وتجهيز فهارس المعرض العصري الفني المعتمد...</p>
      </div>
    );
  }

  const filteredList = getFilteredProducts();
  const flashSaleProduct = products.find(p => p.isFlashSale && p.stock > 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between" dir="rtl" id="app-root-direction">
      {/* 1. Header Navigation */}
      <Header
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        wishlistCount={wishlist.length}
        currentTab={currentTab}
        onNavigate={handleNavigate}
        products={products}
        settings={settings}
      />

      {/* 2. Main Page Views Routing Switcher */}
      <main className="flex-1 pb-16">
        
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

            {/* Quick categories circle layout */}
            <section className="max-w-7xl mx-auto px-4 md:px-6">
              <h2 className="text-lg font-black text-slate-900 mb-6 border-r-4 border-amber-500 pr-3">تصفح أجهزة المنزل والرفاهية بالأقسام</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat}
                    onClick={() => handleNavigate('products', { category: cat })}
                    className="bg-white border border-gray-100 hover:border-amber-500 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer shadow-xs hover:shadow-lg transition-all duration-300"
                  >
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                      <ShoppingCart className="w-5 h-5 text-amber-500" />
                    </div>
                    <span className="text-xs font-black text-slate-800 leading-tight">{cat}</span>
                    <span className="text-[10px] text-gray-400 font-bold mt-1.5">{products.filter(p => p.category === cat).length} جهاز متاح</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Featured Showcase grid */}
            <section className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-black text-slate-900 border-r-4 border-amber-500 pr-3">أجهزة مميزة وننصح بها (الوكلاء الرسميين) ⭐</h2>
                <button
                  onClick={() => handleNavigate('products')}
                  className="text-xs text-amber-600 font-black hover:underline flex items-center gap-1"
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
                    isWishlisted={wishlist.includes(p.id)}
                    onNavigate={handleNavigate}
                    onToggleWishlist={handleToggleWishlist}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            </section>

            {/* Premium visual banner between grids */}
            <section className="max-w-7xl mx-auto px-4 md:px-6">
              <div className="relative rounded-2xl overflow-hidden shadow-md bg-slate-900 text-white p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-6">
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
                  className="py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
                >
                  طلب صيانة منزلية
                </button>
              </div>
            </section>

            {/* Best Sellers and Offers lists split */}
            <section className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Best sellers */}
              <div>
                <h2 className="text-base font-black text-slate-900 mb-5 border-r-4 border-amber-500 pr-2.5">الأجهزة الأكثر طلباً في مصر 🔥</h2>
                <div className="space-y-4">
                  {products.filter(p => p.isBestSeller).slice(0, 3).map((p) => {
                    const price = p.discountPrice || p.price;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleNavigate('product-details', p.id)}
                        className="bg-white rounded-xl border border-gray-100 p-3 flex gap-4 hover:shadow-md cursor-pointer transition-all"
                      >
                        <img src={p.mainImage} alt={p.title} className="w-16 h-16 object-cover rounded-lg border" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{p.title}</h4>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs font-black text-amber-600">{price} ج.م</span>
                            <span className="text-[9px] bg-amber-500/15 text-amber-600 px-2 py-0.5 rounded-full font-bold">{p.brand}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Latest Arrivals */}
              <div>
                <h2 className="text-base font-black text-slate-900 mb-5 border-r-4 border-amber-500 pr-2.5">جديد الأجهزة الكهربائية الواردة حديثاً 🆕</h2>
                <div className="space-y-4">
                  {products.filter(p => p.isLatest).slice(0, 3).map((p) => {
                    const price = p.discountPrice || p.price;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleNavigate('product-details', p.id)}
                        className="bg-white rounded-xl border border-gray-100 p-3 flex gap-4 hover:shadow-md cursor-pointer transition-all"
                      >
                        <img src={p.mainImage} alt={p.title} className="w-16 h-16 object-cover rounded-lg border" />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{p.title}</h4>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-xs font-black text-amber-600">{price} ج.م</span>
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{p.category}</span>
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
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 animate-in fade-in-50 duration-300">
            {/* Header filters details */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="text-right">
                <span className="text-[10px] text-gray-400 font-bold">تصفح الفهرس الشامل</span>
                <h1 className="text-lg font-black text-slate-900 mt-0.5">كل الأجهزة والمعدات المنزلية المتاحة</h1>
                <p className="text-xs text-gray-500 mt-1">
                  وجدنا <strong className="text-amber-600">{filteredList.length} جهاز</strong> يطابق شروط تصفيتك الحالية
                </p>
              </div>

              {/* Sorting and quick search input bar */}
              <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
                <input
                  type="text"
                  placeholder="ابحث بالاسم هنا..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="text-xs border border-gray-150 rounded-lg py-2 px-3 focus:outline-none focus:border-amber-500 w-full sm:w-48 text-slate-900"
                />

                <select
                  value={filterSort}
                  onChange={(e) => setFilterSort(e.target.value)}
                  className="text-xs border border-gray-150 rounded-lg p-2 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="featured">المقترحة والمميزة</option>
                  <option value="cheapest">الأقل سعراً أولاً</option>
                  <option value="expensive">الأعلى سعراً أولاً</option>
                  <option value="rating">أعلى تقييم للعملاء</option>
                </select>
              </div>
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
                  selectedSort={filterSort}
                  onFilterChange={(newFilters) => {
                    if (newFilters.category !== undefined) setFilterCategory(newFilters.category);
                    if (newFilters.brand !== undefined) setFilterBrand(newFilters.brand);
                    if (newFilters.minPrice !== undefined) setFilterMinPrice(newFilters.minPrice);
                    if (newFilters.maxPrice !== undefined) setFilterMaxPrice(newFilters.maxPrice);
                    if (newFilters.rating !== undefined) setFilterRating(newFilters.rating);
                    if (newFilters.isOffer !== undefined) setFilterIsOffer(newFilters.isOffer);
                    if (newFilters.sort !== undefined) setFilterSort(newFilters.sort);
                  }}
                  onReset={handleResetFilters}
                />
              </div>

              {/* Products grid columns (3 cols on lg) */}
              <div className="lg:col-span-3">
                {filteredList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {filteredList.map((p) => (
                      <ProductCard
                        key={p.id}
                        product={p}
                        isWishlisted={wishlist.includes(p.id)}
                        onNavigate={handleNavigate}
                        onToggleWishlist={handleToggleWishlist}
                        onAddToCart={handleAddToCart}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center gap-3">
                    <HelpCircle className="w-10 h-10 text-amber-500 animate-bounce" />
                    <h3 className="font-extrabold text-slate-800 text-sm">لم نجد أي أجهزة تطابق شروط الفرز الخاصة بك!</h3>
                    <p className="text-xs text-gray-500">حاول تقليل محددات التصفية، أو اضغط زر إعادة الضبط لمشاهدة جميع الأجهزة المتوفرة.</p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-2 py-2 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
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
            <div className="flex gap-2 items-center text-xs text-gray-400 font-bold mb-6">
              <span className="hover:text-amber-500 cursor-pointer" onClick={() => handleNavigate('home')}>الرئيسية</span>
              <span>/</span>
              <span className="hover:text-amber-500 cursor-pointer" onClick={() => handleNavigate('products', { category: selectedProduct.category })}>{selectedProduct.category}</span>
              <span>/</span>
              <span className="text-slate-800">{selectedProduct.title}</span>
            </div>

            {/* Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
              {/* Product Images (takes 5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                <div className="aspect-square bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-center overflow-hidden shadow-xs">
                  <img src={activeImage} alt={selectedProduct.title} className="max-h-full max-w-full object-contain hover:scale-105 transition-transform duration-350" />
                </div>
                {/* Image Thumbnails carousel list */}
                {selectedProduct.images && selectedProduct.images.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {selectedProduct.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImage(img)}
                        className={`w-20 h-20 bg-white rounded-xl border p-2 flex items-center justify-center overflow-hidden shrink-0 transition-all cursor-pointer ${activeImage === img ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-gray-250 hover:border-gray-300'}`}
                      >
                        <img src={img} alt="نموذج" className="max-h-full max-w-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product details info (takes 7 cols) */}
              <div className="lg:col-span-7 bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm text-right flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-black text-amber-600 bg-amber-500/15 px-3 py-1 rounded-full">{selectedProduct.brand}</span>
                      <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-2.5 leading-snug">{selectedProduct.title}</h1>
                    </div>
                    {/* Wishlist Button */}
                    <button
                      onClick={(e) => handleToggleWishlist(selectedProduct.id, e)}
                      className="p-3 bg-slate-50 hover:bg-rose-50 border border-gray-100 text-gray-400 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
                    >
                      <Heart className={`w-5 h-5 ${wishlist.includes(selectedProduct.id) ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  </div>

                  {/* Rating summary */}
                  <div className="flex items-center gap-1.5 mb-6">
                    <div className="flex text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < Math.floor(selectedProduct.rating) ? 'fill-amber-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                    <span className="text-xs font-black text-slate-800">{selectedProduct.rating} من 5</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-xs text-slate-500 font-bold">{selectedProduct.reviewsCount} تقييم مكتوب</span>
                  </div>

                  {/* Description Paragraph */}
                  <p className="text-xs md:text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                    {selectedProduct.description}
                  </p>

                  {/* Technical specs table snippet */}
                  <div className="border border-gray-100 rounded-xl p-4 bg-slate-50/50 mb-6 space-y-2">
                    <h4 className="text-xs font-black text-slate-900 mb-3">أهم المواصفات الفنية</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {selectedProduct.specifications.slice(0, 3).map((spec, i) => (
                        <div key={i} className="flex flex-col gap-0.5">
                          <span className="text-gray-400 font-bold">{spec.key}</span>
                          <span className="text-slate-800 font-extrabold">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Variants Option selection */}
                  {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-black text-slate-950 mb-3">المقاس والخيارات المتاحة لهذا الموديل:</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.variants.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => {
                              setSelectedVariant(v);
                              if (v.price) {
                                // optional update if prices differ
                              }
                            }}
                            className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${selectedVariant?.id === v.id ? 'border-amber-500 bg-amber-500/5 text-amber-600 font-black ring-2 ring-amber-500/10' : 'border-gray-200 hover:border-gray-300 text-slate-600'}`}
                          >
                            {v.size || v.capacity || v.color || 'موديل إضافي'} - {v.price} ج.م
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pricing & Add to cart actions footer inside card */}
                <div className="border-t border-gray-100 pt-6 mt-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <span className="text-[10px] text-gray-400 font-black block">السعر النهائي للدفع كاش</span>
                      {selectedProduct.discountPrice ? (
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black text-slate-900">{selectedVariant ? selectedVariant.price : selectedProduct.discountPrice} ج.م</span>
                          <span className="text-xs text-gray-400 line-through">{selectedProduct.price} ج.م</span>
                        </div>
                      ) : (
                        <span className="text-2xl font-black text-slate-900 mt-1">{selectedVariant ? selectedVariant.price : selectedProduct.price} ج.م</span>
                      )}
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-1 bg-gray-50">
                      <button onClick={() => setQuantity(prev => prev > 1 ? prev - 1 : 1)} className="p-1 rounded-md hover:bg-gray-200 text-slate-600"><Minus className="w-4 h-4" /></button>
                      <span className="px-3 text-xs font-black text-slate-900 font-mono">{quantity}</span>
                      <button onClick={() => setQuantity(prev => prev + 1)} className="p-1 rounded-md hover:bg-gray-200 text-slate-600"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-4">
                    {selectedProduct.stock === 0 ? (
                      <button disabled className="flex-1 py-3 bg-gray-150 text-gray-400 font-black rounded-xl text-xs border cursor-not-allowed">نفد المخزون مؤقتاً ⚠️</button>
                    ) : (
                      <button
                        onClick={handleDetailedAddToCart}
                        className="flex-1 py-3 px-6 bg-slate-950 hover:bg-amber-500 text-white hover:text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer text-center flex justify-center items-center gap-1.5"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        أضف هذا الخيار لسلة التسوق
                      </button>
                    )}
                    <button
                      onClick={() => handleNavigate('products')}
                      className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      مواصلة التسوق
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Tabs details (Specifications, Reviews) */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-sm text-right">
              <h3 className="font-extrabold text-slate-900 text-sm pb-3 border-b-2 border-amber-500 inline-block mb-6 pr-1">المواصفات الفنية الفوقية والمراجعات</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Specs list */}
                <div>
                  <h4 className="font-black text-xs text-slate-900 mb-4">جدول المواصفات والخصائص (Datasheet)</h4>
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden text-xs">
                    {selectedProduct.specifications.map((spec, i) => (
                      <div key={i} className="grid grid-cols-3 gap-4 p-3 hover:bg-gray-50/50">
                        <span className="font-bold text-gray-500 col-span-1">{spec.key}</span>
                        <span className="font-extrabold text-slate-800 col-span-2">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reviews */}
                <div>
                  <h4 className="font-black text-xs text-slate-900 mb-4">آراء ومراجعات عملائنا ({selectedProduct.reviewsCount})</h4>
                  <div className="space-y-3 max-h-56 overflow-y-auto mb-6 pr-1">
                    {selectedProduct.reviews && selectedProduct.reviews.length > 0 ? (
                      selectedProduct.reviews.map((r, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-gray-50 text-right text-xs">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="font-black text-slate-900">{r.userName}</span>
                            <div className="flex text-amber-400">
                              {Array.from({ length: 5 }).map((_, st) => (
                                <Star key={st} className={`w-3 h-3 ${st < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                              ))}
                            </div>
                          </div>
                          <p className="text-slate-600 leading-normal">{r.comment}</p>
                          <span className="text-[9px] text-gray-400 mt-1 block font-mono">{new Date(r.createdAt).toLocaleDateString('ar-EG')}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-6">لا توجد مراجعات سابقة على هذا الجهاز بعد، كن أول من يضيف رأيه!</p>
                    )}
                  </div>

                  {/* Add review form */}
                  <form onSubmit={handleReviewSubmit} className="border-t border-gray-100 pt-4 text-xs">
                    <h5 className="font-black text-slate-900 mb-3">أضف مراجعتك الشخصية للجهاز</h5>
                    
                    {reviewSuccess && (
                      <div className="mb-3 p-2 bg-emerald-50 text-emerald-700 font-bold rounded">
                        {reviewSuccess}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-500 font-bold">الاسم الكريم</label>
                        <input
                          type="text"
                          required
                          value={reviewName}
                          onChange={(e) => setReviewName(e.target.value)}
                          placeholder="الاسم الكامل"
                          className="border border-gray-150 rounded p-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-slate-500 font-bold">التقييم بالنجوم</label>
                        <select
                          value={reviewRating}
                          onChange={(e) => setReviewRating(Number(e.target.value))}
                          className="border border-gray-150 rounded p-2 focus:outline-none font-bold text-amber-500"
                        >
                          <option value="5">⭐⭐⭐⭐⭐ ممتاز 5/5</option>
                          <option value="4">⭐⭐⭐⭐ جيد جداً 4/5</option>
                          <option value="3">⭐⭐⭐ مقبول 3/5</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 mb-3">
                      <label className="text-slate-500 font-bold">التعليق والملاحظات الفنية</label>
                      <textarea
                        required
                        rows={2}
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="ما رأيك في جودة تبريد الثلاجة، أو قوة غسيل هذه الغسالة؟"
                        className="border border-gray-150 rounded p-2 focus:outline-none focus:border-amber-500 resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="py-1.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold cursor-pointer"
                    >
                      إرسال المراجعة للمراجعة
                    </button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: CART PAGE                         */}
        {/* ======================================= */}
        {currentTab === 'cart' && (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 animate-in fade-in-50 duration-300">
            <h1 className="text-xl font-black text-slate-900 mb-6 border-r-4 border-amber-500 pr-3">محتويات سلة التسوق الخاصة بك 🛒</h1>

            {cart.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: list items (takes 8 cols) */}
                <div className="lg:col-span-8 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
                  {cart.map((item, idx) => {
                    const price = item.product.discountPrice || item.product.price;
                    return (
                      <div key={idx} className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-gray-100 last:border-none last:pb-0 text-right">
                        <img src={item.product.mainImage} alt={item.product.title} className="w-16 h-16 object-cover rounded-lg border border-gray-100 shrink-0" />
                        
                        <div className="flex-1 min-w-0 pr-1">
                          <span className="text-[10px] text-amber-600 font-black bg-amber-500/10 px-2 py-0.5 rounded-full">{item.product.brand}</span>
                          <h4 className="font-bold text-slate-950 text-sm truncate mt-1">{item.product.title}</h4>
                          {item.selectedVariant && (
                            <span className="text-[10px] text-slate-400 font-bold block mt-1">الموديل: {item.selectedVariant.size || item.selectedVariant.color || item.selectedVariant.capacity}</span>
                          )}
                        </div>

                        {/* Qty modifiers */}
                        <div className="flex items-center gap-2 border border-gray-150 rounded-lg p-1 bg-gray-50 shrink-0">
                          <button onClick={() => handleUpdateCartQty(idx, -1)} className="p-1 rounded hover:bg-gray-200 text-slate-600"><Minus className="w-3.5 h-3.5" /></button>
                          <span className="px-2 text-xs font-black font-mono text-slate-900">{item.quantity}</span>
                          <button onClick={() => handleUpdateCartQty(idx, 1)} className="p-1 rounded hover:bg-gray-200 text-slate-600"><Plus className="w-3.5 h-3.5" /></button>
                        </div>

                        {/* Prices */}
                        <div className="text-left shrink-0">
                          <span className="text-sm font-black text-slate-900 block">{price * item.quantity} ج.م</span>
                          <span className="text-[9px] text-gray-400 block mt-0.5">{price} ج.م للحبة الواحده</span>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={() => handleRemoveCartItem(idx)}
                          className="p-1.5 text-gray-400 hover:text-rose-500 rounded hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Calculations (takes 4 cols) */}
                <div className="lg:col-span-4 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm h-fit">
                  <h3 className="font-extrabold text-slate-950 text-xs pb-3 border-b border-gray-100 mb-4">ملخص السلة وتأكيد الأسعار</h3>
                  
                  {/* Coupon form */}
                  <form onSubmit={handleValidateCoupon} className="mb-6 pb-4 border-b border-gray-100">
                    <span className="text-[10px] text-gray-400 font-bold block mb-1.5">هل تملك كوبون خصم ترويجي؟</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="أدخل رمز الكوبون"
                        value={couponCodeInput}
                        onChange={(e) => setCouponCodeInput(e.target.value)}
                        className="flex-1 text-xs border border-gray-150 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-amber-500 uppercase"
                      />
                      <button type="submit" className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer">تطبيق</button>
                    </div>
                    {couponError && <p className="text-[10px] text-rose-500 font-bold mt-1.5">{couponError}</p>}
                    {activeCoupon && <p className="text-[10px] text-emerald-600 font-black mt-1.5 flex items-center gap-1">✓ تم التفعيل! وفّرت {couponDiscount} ج.م</p>}
                  </form>

                  {/* Pricing summaries */}
                  <div className="space-y-2 pb-4 mb-4 border-b border-gray-100 text-xs text-slate-600">
                    <div className="flex justify-between font-bold">
                      <span>إجمالي الأجهزة:</span>
                      <span className="text-slate-900">
                        {cart.reduce((sum, item) => sum + ((item.product.discountPrice || item.product.price) * item.quantity), 0)} ج.م
                      </span>
                    </div>
                    {couponDiscount > 0 && (
                      <div className="flex justify-between font-black text-green-600">
                        <span>الخصم المستقطع للكوبون:</span>
                        <span>-{couponDiscount} ج.م</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>الشحن الموحد للمحافظات:</span>
                      <span className="text-slate-900 font-bold">{settings.shippingFlatRate} ج.م</span>
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
              <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center gap-4 max-w-lg mx-auto">
                <ShoppingCart className="w-12 h-12 text-amber-500 animate-bounce" />
                <h3 className="font-extrabold text-slate-800 text-sm">سلة التسوق فارغة تماماً من الأجهزة!</h3>
                <p className="text-xs text-gray-500 leading-relaxed">ألقِ نظرة على أرقى شاشات OLED ثنائية الأبعاد، غسالات التعبئة الأمامية، أو تكييفات الهواء كاريير لإضافتها لسلتك!</p>
                <button
                  onClick={() => handleNavigate('products')}
                  className="mt-2 py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
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
            <h1 className="text-xl font-black text-slate-900 mb-6 border-r-4 border-amber-500 pr-3">قائمة المنتجات المفضلة لديك 💖</h1>

            {wishlist.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {products.filter(p => wishlist.includes(p.id)).map((p) => (
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
              <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center gap-4 max-w-lg mx-auto">
                <Heart className="w-12 h-12 text-rose-500 animate-pulse" />
                <h3 className="font-extrabold text-slate-800 text-sm">لا توجد أجهزة في المفضلة بعد!</h3>
                <p className="text-xs text-gray-500 leading-relaxed">عند تصفحك للموديلات، اضغط رمز القلب لحفظ الأجهزة التي تود مقارنتها أو شراؤها لاحقاً.</p>
                <button
                  onClick={() => handleNavigate('products')}
                  className="mt-2 py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl"
                >
                  تصفح المنتجات الآن
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: CHECKOUT FORM                     */}
        {/* ======================================= */}
        {currentTab === 'checkout' && (
          <CheckoutForm
            cart={cart}
            settings={settings}
            couponDiscount={couponDiscount}
            couponCode={activeCoupon?.code}
            onPlaceOrder={handlePlaceOrderSubmit}
            onBackToCart={() => handleNavigate('cart')}
          />
        )}

        {/* ======================================= */}
        {/* VIEW: ORDER SUCCESS LANDING CARD        */}
        {/* ======================================= */}
        {currentTab === 'order-success' && lastPlacedOrder && (
          <div className="max-w-md mx-auto px-4 py-16 animate-in fade-in-50 duration-300">
            <div className="bg-white border border-gray-150 rounded-2xl p-6 md:p-8 text-center shadow-xl flex flex-col items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center animate-bounce">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>

              <h1 className="text-xl font-black text-slate-900">تم تسجيل طلب شحن الأجهزة بنجاح! 🎉</h1>
              <p className="text-xs text-gray-500 leading-relaxed">
                شكراً لتسوقك من متجرنا يا فندم! كود الطلب الخاص بك هو <strong className="text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded font-mono select-all text-sm">{lastPlacedOrder.id.slice(-6).toUpperCase()}</strong>. يرجى حفظ هذا الكود لتتبع شحنتك لاحقاً.
              </p>

              {/* COD instructions */}
              <div className="w-full text-right bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs text-slate-700 leading-relaxed space-y-2.5">
                <h3 className="font-black text-slate-950 flex items-center gap-1.5"><Truck className="w-4 h-4 text-amber-500" /> إرشادات السداد والاستلام:</h3>
                <p>1. سيتصل بك فريق تأكيد المبيعات هاتفياً لمراجعة الأجهزة والعنوان قبل خروج الشحنة.</p>
                <p>2. يرجى إبقاء هاتفك المحمول <strong className="text-slate-950">({lastPlacedOrder.customer.phone})</strong> متاحاً لاستقبال مكالمة المندوب والتحقق الفني.</p>
                <p>3. الدفع نقداً بالكامل للمندوب بعد استلام وفحص عبوة الأجهزة المنزلية بسلام.</p>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    setTrackerOrderId(lastPlacedOrder.id);
                    handleNavigate('track-order');
                  }}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  تتبع طلبي وشحنتي الآن
                </button>
                <button
                  onClick={() => handleNavigate('home')}
                  className="py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
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
            <div className="bg-white border border-gray-100 rounded-2xl p-6 md:p-8 shadow-md text-right">
              <h1 className="text-lg font-black text-slate-900 mb-2 border-r-4 border-amber-500 pr-3">تتبع حالة شحنة الأجهزة الكهربائية 🚚</h1>
              <p className="text-xs text-gray-500 mb-6">أدخل كود طلبك المكون من 6 رموز لمراجعة مرحلة التحضير، الشحن، والتسليم الفوري</p>

              {/* Form query input */}
              <form onSubmit={handleTrackOrderSubmit} className="space-y-4 mb-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">كود الطلب (أو آخر 6 رموز) <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={trackerOrderId}
                      onChange={(e) => setTrackerOrderId(e.target.value)}
                      placeholder="مثال: AB34ED"
                      className="text-xs border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none uppercase font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">رقم الهاتف المحمول المسجل (اختياري)</label>
                    <input
                      type="tel"
                      value={trackerPhone}
                      onChange={(e) => setTrackerPhone(e.target.value)}
                      placeholder="مثال: 01012345678"
                      className="text-xs border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={trackerLoading}
                  className="w-full py-3 bg-slate-950 hover:bg-amber-500 text-white hover:text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer flex justify-center items-center gap-1.5"
                >
                  {trackerLoading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      التحقق والاستعلام الفوري عن الطلب
                    </>
                  )}
                </button>

                {trackerError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded p-2 text-right">⚠️ {trackerError}</p>
                )}
              </form>

              {/* Tracking timeline result card */}
              {trackedOrder && (
                <div className="border-t border-gray-100 pt-6 animate-in fade-in duration-300">
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl mb-6">
                    <div className="flex justify-between items-center text-xs">
                      <div>المشتري: <strong className="text-slate-950 font-bold">{trackedOrder.customer.name}</strong></div>
                      <div>القيمة الكلية: <strong className="text-amber-600 font-black">{trackedOrder.grandTotal} ج.م</strong></div>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-2 font-mono">تاريخ إنشاء الطلب: {new Date(trackedOrder.createdAt).toLocaleString('ar-EG')}</div>
                  </div>

                  {/* Stepper progress bars graphics */}
                  <div className="space-y-6 pt-2">
                    <span className="text-[10px] font-black text-slate-400 block mb-4">مسار شحن الطرد والأجهزة</span>
                    
                    {[
                      { state: 'Pending', label: 'تم تسجيل الطلب واستلامه بالمخزن', desc: 'نراجع البيانات وسيتصل بك موظف التأكيد المبيعات قريباً جداً.' },
                      { state: 'Confirmed', label: 'تم التحقق الهاتفي وتأكيد الطلب ✓', desc: 'أكدنا صحة الموديلات والعنوان، بانتظار إفراج الفحص الفني.' },
                      { state: 'Preparing', label: 'تحت التغليف والتحضير بالمخزن الرئيسي', desc: 'يقوم موظفو المستودع بفحص الجهاز جيداً، وتعبئته بالفلّ المعزز المضاد للصدمات.' },
                      { state: 'Shipped', label: 'خارج للتوصيل مع مندوب الشحن بالطريق 🚚', desc: 'الشحنة بحوزة شركة نقل الأجهزة الكبرى، سيتصل بك المندوب هاتفياً لتسليم البيت.' },
                      { state: 'Delivered', label: 'تم استلام الأجهزة وسداد المبلغ بالكامل', desc: 'تم التوصيل بنجاح للعنوان المفصل وسددت الفاتورة نقداً COD.' }
                    ].map((step, idx, arr) => {
                      // determine status indexing
                      const statesInOrder = ['Pending', 'Confirmed', 'Preparing', 'Shipped', 'Delivered'];
                      const currentStatusIdx = statesInOrder.indexOf(trackedOrder.status);
                      const stepIdx = statesInOrder.indexOf(step.state);

                      const isPassed = stepIdx <= currentStatusIdx;
                      const isCurrent = stepIdx === currentStatusIdx;

                      return (
                        <div key={idx} className="flex gap-4 relative">
                          {/* Line tracker */}
                          {idx < arr.length - 1 && (
                            <div className={`absolute right-3.5 top-8 w-0.5 h-12 -mr-0.25 ${stepIdx < currentStatusIdx ? 'bg-amber-500' : 'bg-gray-150'}`} />
                          )}

                          {/* Pin circle bubble */}
                          <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-xs border ${isPassed ? 'bg-amber-500 border-amber-500 text-slate-950 shadow' : 'bg-white border-gray-250 text-gray-400'}`}>
                            {isPassed ? '✓' : idx + 1}
                          </div>

                          {/* Desc details */}
                          <div className="text-right">
                            <h4 className={`text-xs font-black ${isPassed ? 'text-slate-950 font-extrabold' : 'text-gray-400'} ${isCurrent ? 'text-amber-600 font-extrabold' : ''}`}>{step.label}</h4>
                            <p className="text-[10px] text-gray-500 leading-normal mt-1">{step.desc}</p>
                            {isCurrent && trackedOrder.statusUpdateReason && (
                              <div className="p-2 bg-amber-500/5 rounded border border-amber-500/10 text-[10px] text-amber-600 mt-2">ملاحظة الخبير: {trackedOrder.statusUpdateReason}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: ABOUT / CONTACT / FAQ PAGES       */}
        {/* ======================================= */}
        {currentTab === 'faq' && (
          <div className="max-w-3xl mx-auto px-4 py-8 animate-in fade-in-50 duration-300">
            <h1 className="text-xl font-black text-slate-900 mb-2 border-r-4 border-amber-500 pr-3 text-right">الأسئلة الأكثر شيوعاً والمتكررة ❓</h1>
            <p className="text-xs text-gray-500 mb-8 text-right">كل ما تود معرفته عن ضمان الأجهزة المنزلية، رسوم شحن المحافظات، ومميزات السداد كاش عند الاستلام</p>

            <div className="space-y-4 text-right">
              {faqs.map((f, idx) => (
                <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs">
                  <h3 className="font-extrabold text-slate-950 text-xs mb-2.5 flex items-center gap-1.5"><Check className="w-4 h-4 text-amber-500 shrink-0" /> {f.question}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium pr-5">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'about' && (
          <div className="max-w-2xl mx-auto px-4 py-12 text-right animate-in fade-in-50 duration-300">
            <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="text-center">
                <span className="text-[10px] text-amber-500 font-black bg-amber-500/10 px-2.5 py-1 rounded-full">تاريخنا وقيمنا</span>
                <h1 className="text-xl font-black text-slate-900 mt-3">من نحن - نخبة الأجهزة المنزلية الكبرى</h1>
                <p className="text-xs text-gray-500 mt-1">نسعى لتجهيز البيوت بأرقى ماركات الأجهزة الاستهلاكية في مصر</p>
              </div>

              <p className="text-xs md:text-sm text-slate-650 leading-relaxed font-medium">
                تأسست شركتنا ككيان وطني رائد لتوفير كافة متطلبات البيت العصري من الأجهزة الكهربائية الكبرى (ثلاجات، ديب فريزر، غسالات ملابس وأطباق، بوتاجازات، أفران بيلت إن، تكييفات هواء) وأحدث الإلكترونيات الاستهلاكية وأقوى شاشات OLED بأسعار عادلة وتنافسية تناسب الجميع.
              </p>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <strong className="text-lg text-amber-600 font-black block">10,000+</strong>
                  <span className="text-[10px] text-gray-500 font-semibold block mt-1">عميل سعيد في كافة محافظات مصر</span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <strong className="text-lg text-amber-600 font-black block">2 سنة</strong>
                  <span className="text-[10px] text-gray-500 font-semibold block mt-1">ضمان معتمد على جميع الأجهزة على الأقل</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'contact' && (
          <div className="max-w-2xl mx-auto px-4 py-12 text-right animate-in fade-in-50 duration-300">
            <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <div className="text-center">
                <span className="text-[10px] text-amber-500 font-black bg-amber-500/10 px-2.5 py-1 rounded-full">مركز الدعم والاتصال</span>
                <h1 className="text-xl font-black text-slate-900 mt-3">تواصل معنا الآن</h1>
                <p className="text-xs text-gray-500 mt-1">يسعدنا تلقي طلباتكم واستفسارات الضمان والصيانة على مدار الساعة</p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 items-start">
                  <PhoneCall className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-slate-950 mb-1">الخط الساخن للمبيعات والاستفسار</h4>
                    <p className="text-xs text-gray-600">اتصل بنا تليفونياً لمراجعة الطلبات أو طلب عروض الجملة:</p>
                    <strong className="text-sm text-slate-950 font-mono mt-1 block" dir="ltr">{settings.contactPhone}</strong>
                  </div>
                </div>

                <div className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 items-start">
                  <MapPin className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-slate-950 mb-1">معرضنا ومقر الإدارة الرئيسي</h4>
                    <p className="text-xs text-gray-600">تفضل بزيارتنا لمشاهدة الموديلات حية وفحص التشغيل:</p>
                    <strong className="text-xs text-slate-950 mt-1 block">{settings.contactAddress}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* VIEW: ADMIN DESK DASHBOARD PANEL        */}
        {/* ======================================= */}
        {currentTab === 'admin' && (
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 animate-in fade-in-50 duration-300">
            {!isAdminLoggedIn ? (
              <div className="max-w-md mx-auto my-12 bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 text-center shadow-2xl flex flex-col gap-6 text-white font-sans">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-lg font-black text-white">بوابة تسجيل دخول مسؤول النظام 🛡️</h1>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    يرجى إدخال البريد الإلكتروني وكلمة المرور المعتمدة للوصول الآمن إلى لوحة التحكم والعمليات.
                  </p>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      const res = await api.loginAdmin(adminEmailInput, adminPasswordInput);
                      if (res && res.success) {
                        setIsAdminLoggedIn(true);
                        sessionStorage.setItem('admin_authenticated', 'true');
                        sessionStorage.setItem('admin_token', res.token);
                        setAdminAuthError('');
                        loadCoreData();
                      } else {
                        setAdminAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
                      }
                    } catch (err: any) {
                      setAdminAuthError(err.message || 'حدث خطأ أثناء الاتصال بالخادم.');
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="flex flex-col gap-1.5 text-right">
                    <label className="text-xs font-bold text-slate-300">البريد الإلكتروني <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      required
                      value={adminEmailInput}
                      onChange={(e) => setAdminEmailInput(e.target.value)}
                      placeholder="admin@store.com"
                      className="text-xs bg-slate-900 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 text-center font-mono placeholder:text-slate-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 text-right">
                    <label className="text-xs font-bold text-slate-300">كلمة المرور <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      required
                      value={adminPasswordInput}
                      onChange={(e) => setAdminPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="text-xs bg-slate-900 border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 text-center font-mono placeholder:text-slate-600"
                    />
                  </div>

                  {adminAuthError && (
                    <p className="text-xs text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5 text-right">⚠️ {adminAuthError}</p>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg"
                  >
                    تسجيل الدخول للمستودع الآمن
                  </button>
                </form>

                <div className="border-t border-slate-900 pt-4 flex flex-col gap-2.5">
                  <span className="text-[10px] text-slate-500 font-bold">البيانات الافتراضية: <code className="text-amber-500 bg-amber-500/5 px-1 py-0.5 rounded font-mono">admin@store.com</code> / <code className="text-amber-500 bg-amber-500/5 px-1 py-0.5 rounded font-mono">Admin@123456</code></span>
                  <button
                    onClick={() => handleNavigate('home')}
                    className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                  >
                    الرجوع للواجهة الرئيسية للمتجر
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Top Back Controller */}
                <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xs font-bold text-gray-300">مرحباً بالمدير المعتمد: أحمد الإدريسي 👋</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsAdminLoggedIn(false);
                        sessionStorage.removeItem('admin_authenticated');
                        sessionStorage.removeItem('admin_token');
                        setAdminEmailInput('');
                        setAdminPasswordInput('');
                      }}
                      className="py-1 px-3 bg-red-600/15 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white font-bold text-xs rounded transition-all cursor-pointer"
                    >
                      تسجيل الخروج الأمن 🔒
                    </button>
                    <button
                      onClick={() => handleNavigate('home')}
                      className="py-1 px-3 bg-slate-800 text-amber-500 hover:text-amber-400 font-black text-xs rounded transition-colors cursor-pointer"
                    >
                      العودة للواجهة الرئيسية للمتجر
                    </button>
                  </div>
                </div>

                <AdminDashboard
                  onNavigate={handleNavigate}
                  onRefreshProducts={loadCoreData}
                  activeSubTab={adminSubTab}
                  setActiveSubTab={setAdminSubTab}
                />

                {/* Render proper nested admin widgets depending on subtab */}
                {adminSubTab === 'products' && (
                  <div className="mt-6">
                    <AdminProducts onRefreshAll={loadCoreData} />
                  </div>
                )}

                {adminSubTab === 'orders' && (
                  <div className="mt-6">
                    <AdminOrders onRefreshAll={loadCoreData} />
                  </div>
                )}

                {adminSubTab === 'cms' && (
                  <div className="mt-6">
                    <AdminCMS onRefreshAll={loadCoreData} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </main>

      {/* 3. Smart floating chatbot trigger */}
      <GeminiChatAssistant onNavigate={handleNavigate} />

      {/* 4. Footer credits & navigation map */}
      <Footer settings={settings} onNavigate={handleNavigate} />
    </div>
  );
}
