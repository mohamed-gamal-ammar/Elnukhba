import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ShoppingCart, Heart, ShieldAlert, Menu, X, ArrowLeft, Home, Percent, HelpCircle, PhoneCall, Info, User, LogOut, Bell, Loader2 } from 'lucide-react';
import { Product, SystemSettings } from '../types.js';
import { useCustomerAuth } from '../context/CustomerAuthContext.js';
import { ThemeToggle } from './ThemeToggle.js';

interface HeaderProps {
  cartCount: number;
  wishlistCount: number;
  currentTab: string;
  onNavigate: (tab: string, arg?: any) => void | Promise<void>;
  products: Product[];
  settings: SystemSettings;
  isAdminLoggedIn?: boolean;
  onAdminLogout?: () => void;
  adminUnreadNotificationsCount?: number;
  currentAdmin?: { name: string; email: string } | null;
  adminSubTab?: string;
}

/**
 * Normalizes Arabic text for flexible client-side matching.
 */
function normalizeText(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

/**
 * Component to highlight matching text query within search suggestions.
 */
function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim() || !text) return <>{text}</>;
  const rawQuery = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = rawQuery.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    // Try normalized match fallback
    const normText = normalizeText(text);
    const normQuery = normalizeText(rawQuery);
    const normIdx = normText.indexOf(normQuery);
    if (normIdx === -1) return <>{text}</>;

    const before = text.slice(0, normIdx);
    const match = text.slice(normIdx, normIdx + rawQuery.length);
    const after = text.slice(normIdx + rawQuery.length);
    return (
      <>
        {before}
        <mark className="bg-amber-500/30 text-amber-300 font-bold px-1 py-0.5 rounded-sm">{match}</mark>
        {after}
      </>
    );
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + rawQuery.length);
  const after = text.slice(index + rawQuery.length);

  return (
    <>
      {before}
      <mark className="bg-amber-500/30 text-amber-300 font-bold px-1 py-0.5 rounded-sm">{match}</mark>
      {after}
    </>
  );
}

export default function Header({
  cartCount,
  wishlistCount,
  currentTab,
  onNavigate,
  products,
  settings,
  isAdminLoggedIn = false,
  onAdminLogout,
  adminUnreadNotificationsCount = 0,
  currentAdmin = null,
  adminSubTab = 'overview'
}: HeaderProps) {
  const { customer, logout, notifications } = useCustomerAuth();
  const unreadNotificationsCount = (notifications || []).filter(n => !n.isRead).length;

  const handleLogoutClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await logout();
    onNavigate('home');
  }, [logout, onNavigate]);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [showCustomerLogoutConfirm, setShowCustomerLogoutConfirm] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const adminDropdownRef = useRef<HTMLDivElement>(null);

  // Close search suggestions and admin dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node)) {
        setAdminDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search suggestions calculation (250ms)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      setIsSearching(true);
      setShowSuggestions(true);

      const timer = setTimeout(() => {
        const normQuery = normalizeText(trimmed);
        const queryTokens = normQuery.split(/\s+/).filter(Boolean);

        const scoredProducts = products.map(p => {
          const pTitle = normalizeText(p.title);
          const pTitleEn = normalizeText(p.titleEn);
          const pBrand = normalizeText(p.brand);
          const pCategory = normalizeText(p.category);
          const pTags = (p.tags || []).map(t => normalizeText(t));
          const pDesc = normalizeText(p.description);

          const allFields = [pTitle, pTitleEn, pBrand, pCategory, ...pTags, pDesc].join(' ');
          const matches = queryTokens.every(token => allFields.includes(token));

          if (!matches) return { product: p, score: -1 };

          let score = 0;

          // Priority 1: Title
          if (pTitle === normQuery || pTitleEn === normQuery) score += 1000;
          else if (pTitle.startsWith(normQuery) || pTitleEn.startsWith(normQuery)) score += 800;
          else if (pTitle.includes(normQuery) || pTitleEn.includes(normQuery)) score += 500;

          for (const token of queryTokens) {
            if (pTitle.includes(token)) score += 150;
            if (pTitleEn.includes(token)) score += 150;
          }

          // Priority 2: Brand
          if (pBrand === normQuery) score += 400;
          else if (pBrand.includes(normQuery) || queryTokens.some(t => pBrand.includes(t))) score += 250;

          // Priority 3: Category
          if (pCategory === normQuery) score += 300;
          else if (pCategory.includes(normQuery) || queryTokens.some(t => pCategory.includes(t))) score += 200;

          // Priority 4: Tags & Description
          for (const tag of pTags) {
            if (tag.includes(normQuery)) score += 100;
          }
          if (pDesc.includes(normQuery)) score += 50;

          return { product: p, score };
        })
        .filter(item => item.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map(item => item.product);

        setSuggestions(scoredProducts);
        setIsSearching(false);
      }, 250);

      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSearching(false);
    }
  }, [searchQuery, products]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onNavigate('products', { search: searchQuery.trim() });
      setShowSuggestions(false);
    }
  }, [searchQuery, onNavigate]);

  const handleSuggestionClick = useCallback((product: Product) => {
    onNavigate('product-details', product.id);
    setSearchQuery('');
    setShowSuggestions(false);
  }, [onNavigate]);

  return (
    <header className="sticky top-0 z-50 w-full shadow-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 transition-colors" id="site-header">
      {/* Top bar with hotline and help links */}
      <div className="hidden md:flex justify-between items-center px-6 py-2 bg-slate-100 dark:bg-slate-950 text-xs text-slate-600 dark:text-gray-300 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <PhoneCall className="w-3 h-3 text-amber-500" />
            الخط الساخن: <strong className="text-slate-900 dark:text-white font-semibold">{settings.contactPhone}</strong>
          </span>
          <span className="text-slate-300 dark:text-gray-500">|</span>
          <span className="text-slate-600 dark:text-gray-300">{settings.contactAddress}</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('faq')} className="hover:text-amber-500 transition-colors">الأسئلة الشائعة</button>
          <button onClick={() => onNavigate('about')} className="hover:text-amber-500 transition-colors">عن الشركة</button>
          <button onClick={() => onNavigate('contact')} className="hover:text-amber-500 transition-colors">اتصل بنا</button>
          {customer && (
            <>
              <span className="text-slate-300 dark:text-gray-500">|</span>
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-500 font-semibold">مرحباً، {customer.name}</span>
                <span className="text-slate-300 dark:text-gray-500">|</span>
                <button onClick={() => onNavigate('customer-account')} className="hover:text-amber-500 transition-colors">لوحة حسابي</button>
                <span className="text-slate-300 dark:text-gray-500">|</span>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomerLogoutConfirm(true); }} className="text-slate-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">خروج</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main Amazon-inspired Header Bar */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Mobile menu and logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white focus:outline-none"
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
              <span className="text-xs font-normal text-slate-800 dark:text-white px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">جديد</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-gray-300 tracking-wider pr-0.5 font-medium mt-1">{settings.logoSubtext}</span>
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
            className="w-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-12 pr-4 py-2.5 rounded-lg font-medium border border-slate-200 dark:border-amber-500/20 hover:border-slate-300 dark:hover:border-amber-500/40 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 text-sm transition-colors"
          />
          <button
            type="submit"
            className="absolute left-0 top-0 bottom-0 px-4 bg-amber-500 text-slate-950 rounded-l-lg hover:bg-amber-400 transition-colors flex items-center justify-center cursor-pointer font-bold"
            aria-label="بحث"
          >
            {isSearching ? (
              <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>

          {/* Dynamic search suggestion dropdown */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-amber-500/20 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 animate-in fade-in-50 duration-150">
              <div className="p-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/90 flex justify-between items-center border-b border-slate-200 dark:border-amber-500/10">
                <span>مقترحات البحث الذكي</span>
                {isSearching ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-amber-500 font-normal">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري البحث...
                  </span>
                ) : suggestions.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-normal cursor-pointer"
                  >
                    عرض كل النتائج ({suggestions.length})
                  </button>
                ) : null}
              </div>

              {isSearching ? (
                <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span>جاري تطبيق البحث الذكي...</span>
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSuggestionClick(p)}
                    className="flex items-center gap-3 p-3 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 cursor-pointer transition-colors"
                  >
                    <img
                      src={p.mainImage}
                      alt={p.title}
                      className="w-10 h-10 object-cover rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                        <HighlightText text={p.title} query={searchQuery} />
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-black text-amber-600 dark:text-amber-400">{p.discountPrice || p.price} ج.م</span>
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300 font-medium border border-slate-200 dark:border-slate-700">
                          <HighlightText text={p.brand} query={searchQuery} />
                        </span>
                        <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400 font-medium">
                          <HighlightText text={p.category} query={searchQuery} />
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-5 text-center text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">لم يتم العثور على منتجات مطابقة.</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">جرب البحث عن كلمات أخرى مثل اسم الماركة أو الفئة.</p>
                </div>
              )}
            </div>
          )}
        </form>

        {/* Navigation Action Buttons */}
        <div className="flex items-center gap-1 md:gap-3 text-sm font-medium">
          {/* Track order */}
          <button
            onClick={() => onNavigate('track-order')}
            className="hidden lg:flex items-center gap-1 text-slate-700 dark:text-gray-300 hover:text-amber-500 transition-colors py-1.5 px-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            تتبع طلبك
          </button>

          {/* Customer / Admin Account Button */}
          {customer ? (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800/80 rounded-lg p-1 border border-slate-200 dark:border-slate-700/30 transition-all">
              <button
                onClick={() => onNavigate('customer-account')}
                className="flex items-center gap-1 text-slate-700 dark:text-gray-300 hover:text-amber-500 transition-colors py-1 px-2 rounded-md"
                title="لوحة حسابي"
              >
                <User className="w-5 h-5 text-amber-500" />
                <span className="hidden xl:inline text-xs truncate max-w-[80px] font-semibold">{customer.name}</span>
              </button>
              
              {unreadNotificationsCount > 0 && (
                <button
                  onClick={() => onNavigate('customer-account', { subTab: 'notifications' })}
                  className="relative p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-500 dark:text-amber-400"
                  title="الإشعارات غير المقروءة"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                </button>
              )}

              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCustomerLogoutConfirm(true); }}
                className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : isAdminLoggedIn ? (
            <div className="flex items-center gap-2">
              {/* Admin Notification Bell Icon */}
              <button
                onClick={() => onNavigate('admin', { subTab: 'notifications' })}
                className="relative p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-amber-500 dark:text-amber-400 cursor-pointer"
                title="إشعارات الأدمن"
              >
                <Bell className="w-4 h-4" />
                {adminUnreadNotificationsCount > 0 && (
                  <>
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                  </>
                )}
              </button>

              <div className="relative group" ref={adminDropdownRef}>
                <button
                  onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                  className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 font-bold text-xs cursor-pointer"
                  title="حساب الأدمن"
                >
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>{currentAdmin?.name || 'حساب الأدمن'}</span>
                </button>

                {/* Admin Dropdown Menu */}
                <div className={`absolute left-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/20 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80 text-xs ${adminDropdownOpen ? 'block' : 'hidden group-hover:block'}`}>
                  <button
                    onClick={() => {
                      setAdminDropdownOpen(false);
                      onNavigate('admin');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 text-right font-semibold transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span>لوحة الإدارة</span>
                  </button>
                  <button
                    onClick={() => {
                      setAdminDropdownOpen(false);
                      onNavigate('admin', { subTab: 'account' });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-slate-700 dark:text-slate-200 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 text-right font-semibold transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span>الملف الشخصي ({currentAdmin?.name || 'الأدمن'})</span>
                  </button>
                  <button
                    onClick={() => {
                      setAdminDropdownOpen(false);
                      onAdminLogout?.();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300 text-right font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('customer-account')}
              className="flex items-center gap-1.5 text-slate-700 dark:text-gray-300 hover:text-amber-500 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
              title="حسابي"
            >
              <User className="w-5 h-5 text-slate-700 dark:text-gray-300" />
              <span className="hidden sm:inline">حسابي</span>
            </button>
          )}

          {/* Wishlist */}
          <button
            onClick={() => onNavigate('wishlist')}
            className="relative flex items-center gap-1.5 text-slate-700 dark:text-gray-300 hover:text-amber-500 transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="المفضلة"
          >
            <Heart className={`w-5.5 h-5.5 ${wishlistCount > 0 ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span className="hidden sm:inline">المفضلة</span>
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center justify-center border border-white dark:border-slate-900 animate-pulse">
                {wishlistCount}
              </span>
            )}
          </button>

          {/* Shopping Cart */}
          <button
            onClick={() => onNavigate('cart')}
            className="relative flex items-center gap-1.5 text-amber-600 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20"
            aria-label="سلة التسوق"
          >
            <ShoppingCart className="w-5.5 h-5.5" />
            <span className="hidden sm:inline font-bold">السلة</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-lg border border-white dark:border-slate-900">
                {cartCount}
              </span>
            )}
          </button>

          {/* Theme Toggle Switcher */}
          <ThemeToggle variant="header" />
        </div>
      </div>

      {/* Sub Header Navigation Menu */}
      <nav className="hidden md:flex bg-slate-50 dark:bg-slate-800 py-2.5 border-t border-slate-200 dark:border-slate-700/50 transition-colors">
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
          <div className="flex items-center gap-6 text-sm">
            <button
              onClick={() => onNavigate('home')}
              className={`flex items-center gap-1.5 pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'home' ? 'text-amber-600 dark:text-amber-500 border-amber-500 font-bold' : 'text-slate-600 dark:text-gray-300 border-transparent'}`}
            >
              <Home className="w-4 h-4" />
              الرئيسية
            </button>
            <button
              onClick={() => onNavigate('products')}
              className={`pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'products' ? 'text-amber-600 dark:text-amber-500 border-amber-500 font-bold' : 'text-slate-600 dark:text-gray-300 border-transparent'}`}
            >
              جميع المنتجات
            </button>
            <button
              onClick={() => onNavigate('products', { isOffer: true })}
              className={`flex items-center gap-1 pb-0.5 border-b-2 transition-colors hover:text-amber-500 text-amber-600 dark:text-amber-400 ${currentTab === 'offers' ? 'border-amber-500 font-bold' : 'border-transparent'}`}
            >
              <Percent className="w-3.5 h-3.5" />
              أقوى العروض
            </button>
            <button
              onClick={() => onNavigate('faq')}
              className={`pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'faq' ? 'text-amber-600 dark:text-amber-500 border-amber-500 font-bold' : 'text-slate-600 dark:text-gray-300 border-transparent'}`}
            >
              الأسئلة الشائعة
            </button>
            <button
              onClick={() => onNavigate('about')}
              className={`pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'about' ? 'text-amber-600 dark:text-amber-500 border-amber-500 font-bold' : 'text-slate-600 dark:text-gray-300 border-transparent'}`}
            >
              عن الشركة
            </button>
            <button
              onClick={() => onNavigate('contact')}
              className={`pb-0.5 border-b-2 transition-colors hover:text-amber-500 ${currentTab === 'contact' ? 'text-amber-600 dark:text-amber-500 border-amber-500 font-bold' : 'text-slate-600 dark:text-gray-300 border-transparent'}`}
            >
              اتصل بنا
            </button>
          </div>

          <div className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1">
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
          <div className="relative w-80 max-w-[85vw] h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col justify-between shadow-2xl z-10 transition-transform duration-300">
            <div className="p-5 overflow-y-auto flex-1">
              {/* Header inside drawer */}
              <div className="flex justify-between items-center pb-5 border-b border-slate-200 dark:border-slate-800 mb-6">
                <span className="text-xl font-black text-amber-500 font-sans">تصفح الأقسام</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Mobile Search input */}
              <form onSubmit={handleSearchSubmit} className="mb-6 relative">
                <input
                  type="text"
                  placeholder="ابحث هنا..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/50 rounded-lg py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900 dark:text-white"
                />
                <button type="submit" className="absolute left-3 top-2.5">
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </form>

              {/* Navigation Links inside Drawer */}
              <div className="flex flex-col gap-1 text-base font-semibold">
                <button
                  onClick={() => { onNavigate('home'); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${currentTab === 'home' ? 'text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-slate-850' : 'text-slate-800 dark:text-gray-100'}`}
                >
                  <Home className="w-5 h-5" />
                  الرئيسية
                </button>

                <button
                  onClick={() => { onNavigate('products'); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${currentTab === 'products' ? 'text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-slate-850' : 'text-slate-800 dark:text-gray-100'}`}
                >
                  <Search className="w-5 h-5" />
                  تصفح كافة المنتجات
                </button>

                <button
                  onClick={() => { onNavigate('products', { isOffer: true }); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400"
                >
                  <Percent className="w-5 h-5" />
                  أقوى عروض التخفيضات
                </button>

                <button
                  onClick={() => { onNavigate('track-order'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-gray-100"
                >
                  <Home className="w-5 h-5" />
                  تتبع طلبي وشحنتي
                </button>

                <button
                  onClick={() => { onNavigate('faq'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-gray-100"
                >
                  <HelpCircle className="w-5 h-5" />
                  الأسئلة المتكررة
                </button>

                <button
                  onClick={() => { onNavigate('about'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-gray-100"
                >
                  <Info className="w-5 h-5" />
                  من نحن (عن الشركة)
                </button>

                <button
                  onClick={() => { onNavigate('contact'); setMobileMenuOpen(false); }}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-gray-100"
                >
                  <PhoneCall className="w-5 h-5" />
                  تواصل معنا
                </button>

                {/* Mobile Customer / Admin Account */}
                {customer ? (
                  <button
                    onClick={() => { onNavigate('customer-account'); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${currentTab === 'customer-account' ? 'text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-slate-850' : 'text-slate-800 dark:text-gray-100'}`}
                  >
                    <User className="w-5 h-5 text-amber-500" />
                    حسابي ({customer.name})
                  </button>
                ) : isAdminLoggedIn ? (
                  <div className="flex flex-col gap-1 p-2 bg-slate-100 dark:bg-slate-850/80 rounded-lg border border-amber-500/20 my-1">
                    <div className="flex items-center justify-between px-2 py-1 text-amber-600 dark:text-amber-400 font-bold text-xs border-b border-slate-200 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-amber-500" />
                        <span>حساب الأدمن</span>
                      </div>
                      {adminUnreadNotificationsCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                          {adminUnreadNotificationsCount}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => { onNavigate('admin'); setMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 p-2.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-sm font-semibold ${currentTab === 'admin' ? 'text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-slate-800' : 'text-slate-800 dark:text-gray-100'}`}
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      لوحة الإدارة
                    </button>
                    <button
                      onClick={() => { onNavigate('admin', { subTab: 'account' }); setMobileMenuOpen(false); }}
                      className={`flex items-center gap-3 p-2.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-sm font-semibold ${currentTab === 'admin' && adminSubTab === 'account' ? 'text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-slate-800' : 'text-slate-800 dark:text-gray-100'}`}
                    >
                      <User className="w-4 h-4 text-amber-500" />
                      الملف الشخصي ({currentAdmin?.name || 'الأدمن'})
                    </button>
                    <button
                      onClick={() => { onNavigate('admin', { subTab: 'notifications' }); setMobileMenuOpen(false); }}
                      className="flex items-center justify-between p-2.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-gray-100"
                    >
                      <div className="flex items-center gap-3">
                        <Bell className="w-4 h-4 text-amber-500" />
                        <span>الإشعارات</span>
                      </div>
                      {adminUnreadNotificationsCount > 0 && (
                        <span className="text-xs text-red-500 dark:text-red-400 font-bold">({adminUnreadNotificationsCount})</span>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onAdminLogout?.();
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-sm font-semibold text-red-500 dark:text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      تسجيل الخروج
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { onNavigate('customer-account'); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 ${currentTab === 'customer-account' ? 'text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-slate-850' : 'text-slate-800 dark:text-gray-100'}`}
                  >
                    <User className="w-5 h-5 text-amber-500" />
                    تسجيل الدخول / إنشاء حساب
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Actions inside drawer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col gap-3">
              {/* Theme Switcher in Mobile Drawer */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">مظهر التطبيق</span>
                <ThemeToggle variant="admin" showLabel />
              </div>

              {customer && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowCustomerLogoutConfirm(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-red-50 dark:bg-slate-850 text-red-600 dark:text-red-400 border border-red-200 dark:border-slate-800 rounded-lg text-sm font-bold hover:bg-red-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج من الحساب
                </button>
              )}
              <div className="text-[10px] text-slate-500 dark:text-gray-400 text-center">
                هاتف الدعم: {settings.contactPhone}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Customer Logout Confirmation Modal */}
      {showCustomerLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-50 duration-200" id="customer-logout-modal">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4 text-slate-900 dark:text-white">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">هل تريد تسجيل الخروج؟</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">سيتم الخروج من حسابك واستكمال التصفح كزائر.</p>
            </div>
            <div className="flex items-center gap-3 w-full mt-2">
              <button
                onClick={async () => {
                  setShowCustomerLogoutConfirm(false);
                  await logout();
                  onNavigate('home');
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                تأكيد
              </button>
              <button
                onClick={() => setShowCustomerLogoutConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
