import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Heart, ShieldAlert, Menu, X, ArrowLeft, Home, Percent, HelpCircle, PhoneCall, Info } from 'lucide-react';
import { Product, SystemSettings } from '../types.js';

interface HeaderProps {
  cartCount: number;
  wishlistCount: number;
  currentTab: string;
  onNavigate: (tab: string, arg?: any) => void | Promise<void>;
  products: Product[];
  settings: SystemSettings;
}

export default function Header({
  cartCount,
  wishlistCount,
  currentTab,
  onNavigate,
  products,
  settings
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update suggestions as search query changes
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const query = searchQuery.toLowerCase().trim();
      const filtered = products.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.brand.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        p.tags.some(t => t.toLowerCase().includes(query))
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, products]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('products', { search: searchQuery });
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (product: Product) => {
    onNavigate('product-details', product.id);
    setSearchQuery('');
    setShowSuggestions(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full shadow-md bg-slate-900 text-white" id="site-header">
      {/* Top bar with hotline and help links */}
      <div className="hidden md:flex justify-between items-center px-6 py-2 bg-slate-950 text-xs text-gray-300 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <PhoneCall className="w-3 h-3 text-amber-500" />
            الخط الساخن: <strong className="text-white font-semibold">{settings.contactPhone}</strong>
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">{settings.contactAddress}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('faq')} className="hover:text-amber-500 transition-colors">الأسئلة الشائعة</button>
          <button onClick={() => onNavigate('about')} className="hover:text-amber-500 transition-colors">عن الشركة</button>
          <button onClick={() => onNavigate('contact')} className="hover:text-amber-500 transition-colors">اتصل بنا</button>
          <button onClick={() => onNavigate('admin')} className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-xs font-semibold hover:bg-amber-400 transition-all">
            <ShieldAlert className="w-3 h-3" />
            لوحة الإدارة
          </button>
        </div>
      </div>

      {/* Main Amazon-inspired Header Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Mobile menu and logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-md hover:bg-slate-800 text-white focus:outline-none"
            aria-label="القائمة"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo */}
          <div
            onClick={() => onNavigate('home')}
            className="flex flex-col cursor-pointer select-none leading-none"
          >
            <span className="text-2xl font-black tracking-tight text-amber-500 font-sans flex items-center gap-1">
              {settings.logoText}
              <span className="text-xs font-normal text-white px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">جديد</span>
            </span>
            <span className="text-[10px] text-gray-300 tracking-wider pr-0.5 font-medium mt-1">{settings.logoSubtext}</span>
          </div>
        </div>

        {/* Smart Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-2xl relative"
          ref={searchRef}
        >
          <input
            type="text"
            placeholder="ابحث عن: شاشات، غسالات، تكييفات، خلاطات..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white text-slate-900 pl-12 pr-4 py-2.5 rounded-lg font-medium border-none focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
          />
          <button
            type="submit"
            className="absolute left-0 top-0 bottom-0 px-4 bg-amber-500 text-slate-950 rounded-l-lg hover:bg-amber-400 transition-colors flex items-center justify-center cursor-pointer"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Dynamic search suggestion dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white text-slate-900 border border-gray-200 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-gray-100">
              <div className="p-2 text-xs font-bold text-gray-500 bg-gray-50 flex justify-between items-center">
                <span>مقترحات البحث</span>
                <span className="text-[10px] text-amber-600 font-normal">عرض كل النتائج</span>
              </div>
              {suggestions.map((p) => (
                <div
                  key={p.id}
                  onClick={() => handleSuggestionClick(p)}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <img
                    src={p.mainImage}
                    alt={p.title}
                    className="w-10 h-10 object-cover rounded-md border border-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-slate-950">{p.title}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                      <span className="font-bold text-amber-600">{p.discountPrice || p.price} ج.م</span>
                      <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-600">{p.brand}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-1 md:gap-4 text-sm font-medium">
          {/* Track order */}
          <button
            onClick={() => onNavigate('track-order')}
            className="hidden lg:flex items-center gap-1 text-gray-300 hover:text-amber-500 transition-colors py-1.5 px-2 rounded-md hover:bg-slate-800"
          >
            تتبع طلبك
          </button>

          {/* Wishlist */}
          <button
            onClick={() => onNavigate('wishlist')}
            className="relative flex items-center gap-1.5 text-gray-300 hover:text-amber-500 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-850"
            aria-label="المفضلة"
          >
            <Heart className={`w-5.5 h-5.5 ${wishlistCount > 0 ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span className="hidden sm:inline">المفضلة</span>
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center border border-slate-900 animate-pulse">
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Shopping Cart */}
          <button
            onClick={() => onNavigate('cart')}
            className="relative flex items-center gap-1.5 text-amber-500 hover:text-amber-400 transition-colors py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20"
            aria-label="سلة التسوق"
          >
            <ShoppingCart className="w-5.5 h-5.5" />
            <span className="hidden sm:inline font-bold">السلة</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-white text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg border border-amber-500">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sub Header Navigation Menu */}
      <nav className="hidden md:flex bg-slate-800 py-2.5 border-t border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
          <div className="flex items-center gap-6 text-sm">
            <button
              onClick={() => onNavigate('home')}
              className={`flex items-center gap-1.5 pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'home' ? 'text-amber-500 border-amber-500 font-bold' : 'text-gray-300 border-transparent'}`}
            >
              <Home className="w-4 h-4" />
              الرئيسية
            </button>
            <button
              onClick={() => onNavigate('products')}
              className={`pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'products' ? 'text-amber-500 border-amber-500 font-bold' : 'text-gray-300 border-transparent'}`}
            >
              جميع المنتجات
            </button>
            <button
              onClick={() => onNavigate('products', { isOffer: true })}
              className={`flex items-center gap-1 pb-0.5 border-b-2 transition-colors hover:text-amber-500 text-amber-400 ${currentTab === 'offers' ? 'border-amber-500 font-bold' : 'border-transparent'}`}
            >
              <Percent className="w-3.5 h-3.5" />
              أقوى العروض
            </button>
            <button
              onClick={() => onNavigate('faq')}
              className={`pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'faq' ? 'text-amber-500 border-amber-500 font-bold' : 'text-gray-300 border-transparent'}`}
            >
              الأسئلة الشائعة
            </button>
            <button
              onClick={() => onNavigate('about')}
              className={`pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'about' ? 'text-amber-500 border-amber-500 font-bold' : 'text-gray-300 border-transparent'}`}
            >
              عن الشركة
            </button>
            <button
              onClick={() => onNavigate('contact')}
              className={`pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'contact' ? 'text-amber-500 border-amber-500 font-bold' : 'text-gray-300 border-transparent'}`}
            >
              اتصل بنا
            </button>
          </div>

          <div className="text-xs text-gray-400 flex items-center gap-1">
            <span>شحن موحد بقيمة <strong>{settings.shippingFlatRate} ج.م</strong> لجميع المحافظات 🚚</span>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end md:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Drawer content */}
          <div className="relative w-80 max-w-[85vw] h-full bg-slate-900 text-white flex flex-col justify-between shadow-2xl z-10 transition-transform duration-300">
            <div className="p-5 overflow-y-auto flex-1">
              {/* Header inside drawer */}
              <div className="flex justify-between items-center pb-5 border-b border-slate-800 mb-6">
                <span className="text-xl font-black text-amber-500 font-sans">تصفح الأقسام</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-800"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              </div>

              {/* Mobile Search input */}
              <form onSubmit={handleSearchSubmit} className="mb-6 relative">
                <input
                  type="text"
                  placeholder="ابحث هنا..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-850 border border-slate-700/50 rounded-lg py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 text-white"
                />
                <button type="submit" className="absolute left-3 top-2.5">
                  <Search className="w-4 h-4 text-gray-400" />
                </button>
              </form>

              {/* Navigation Links inside Drawer */}
              <div className="flex flex-col gap-1 text-base font-semibold">
                <button
                  onClick={() => { onNavigate('home'); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 ${currentTab === 'home' ? 'text-amber-500 bg-slate-850' : 'text-gray-100'}`}
                >
                  <Home className="w-5 h-5" />
                  الرئيسية
                </button>

                <button
                  onClick={() => { onNavigate('products'); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 ${currentTab === 'products' ? 'text-amber-500 bg-slate-850' : 'text-gray-100'}`}
                >
                  <Search className="w-5 h-5" />
                  تصفح كافة المنتجات
                </button>

                <button
                  onClick={() => { onNavigate('products', { isOffer: true }); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 text-amber-400"
                >
                  <Percent className="w-5 h-5" />
                  أقوى عروض التخفيضات
                </button>

                <button
                  onClick={() => { onNavigate('track-order'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 text-gray-100"
                >
                  <Home className="w-5 h-5" />
                  تتبع طلبي وشحنتي
                </button>

                <button
                  onClick={() => { onNavigate('faq'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 text-gray-100"
                >
                  <HelpCircle className="w-5 h-5" />
                  الأسئلة المتكررة
                </button>

                <button
                  onClick={() => { onNavigate('about'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 text-gray-100"
                >
                  <Info className="w-5 h-5" />
                  من نحن (عن الشركة)
                </button>

                <button
                  onClick={() => { onNavigate('contact'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 text-gray-100"
                >
                  <PhoneCall className="w-5 h-5" />
                  تواصل معنا
                </button>
              </div>
            </div>

            {/* Bottom Actions inside drawer */}
            <div className="p-5 border-t border-slate-800 bg-slate-950 flex flex-col gap-3">
              <button
                onClick={() => { onNavigate('admin'); setMobileMenuOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 text-slate-950 rounded-lg text-sm font-black hover:bg-amber-400 transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
                لوحة التحكم بالإدارة
              </button>
              <div className="text-[10px] text-gray-400 text-center">
                هاتف الدعم: {settings.contactPhone}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
