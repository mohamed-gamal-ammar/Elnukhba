import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Star, RotateCcw, ShieldCheck, ArrowUpDown, X, AlertCircle } from 'lucide-react';
import { CustomSelect } from './CustomSelect.js';
import {
  handleNumericKeyDown,
  handleNumericPaste,
  sanitizeNumericInput,
  validateNumericValue
} from '../lib/numericValidation.js';

interface ProductFiltersProps {
  categories: string[];
  brands: string[];
  selectedCategory: string;
  selectedBrand: string;
  minPrice: string;
  maxPrice: string;
  selectedRating: string;
  isOffer: boolean;
  inStockOnly?: boolean;
  isFeatured?: boolean;
  isNewArrival?: boolean;
  selectedSort: string;
  totalResults?: number;
  onFilterChange: (filters: {
    category?: string;
    brand?: string;
    minPrice?: string;
    maxPrice?: string;
    rating?: string;
    isOffer?: boolean;
    inStockOnly?: boolean;
    isFeatured?: boolean;
    isNewArrival?: boolean;
    sort?: string;
  }) => void;
  onReset: () => void;
}

export default function ProductFilters({
  categories,
  brands,
  selectedCategory,
  selectedBrand,
  minPrice,
  maxPrice,
  selectedRating,
  isOffer,
  inStockOnly = false,
  isFeatured = false,
  isNewArrival = false,
  selectedSort,
  totalResults,
  onFilterChange,
  onReset
}: ProductFiltersProps) {
  const [localMin, setLocalMin] = useState(minPrice);
  const [localMax, setLocalMax] = useState(maxPrice);
  const [desktopPriceError, setDesktopPriceError] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Draft state for mobile filter drawer
  const [draftCategory, setDraftCategory] = useState(selectedCategory);
  const [draftBrand, setDraftBrand] = useState(selectedBrand);
  const [draftMinPrice, setDraftMinPrice] = useState(minPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(maxPrice);
  const [mobilePriceError, setMobilePriceError] = useState<string | null>(null);
  const [draftRating, setDraftRating] = useState(selectedRating);
  const [draftIsOffer, setDraftIsOffer] = useState(isOffer);
  const [draftInStockOnly, setDraftInStockOnly] = useState(inStockOnly);
  const [draftIsFeatured, setDraftIsFeatured] = useState(isFeatured);
  const [draftIsNewArrival, setDraftIsNewArrival] = useState(isNewArrival);
  const [draftSort, setDraftSort] = useState(selectedSort);

  useEffect(() => {
    setLocalMin(minPrice);
    setDesktopPriceError(null);
  }, [minPrice]);

  useEffect(() => {
    setLocalMax(maxPrice);
    setDesktopPriceError(null);
  }, [maxPrice]);

  // Sync draft filters whenever mobile drawer opens
  useEffect(() => {
    if (isMobileDrawerOpen) {
      setDraftCategory(selectedCategory);
      setDraftBrand(selectedBrand);
      setDraftMinPrice(minPrice);
      setDraftMaxPrice(maxPrice);
      setMobilePriceError(null);
      setDraftRating(selectedRating);
      setDraftIsOffer(isOffer);
      setDraftInStockOnly(inStockOnly);
      setDraftIsFeatured(isFeatured);
      setDraftIsNewArrival(isNewArrival);
      setDraftSort(selectedSort);
    }
  }, [
    isMobileDrawerOpen,
    selectedCategory,
    selectedBrand,
    minPrice,
    maxPrice,
    selectedRating,
    isOffer,
    inStockOnly,
    isFeatured,
    isNewArrival,
    selectedSort,
  ]);

  const activeFilterCount = [
    !!selectedCategory,
    !!selectedBrand,
    !!selectedRating,
    !!(minPrice || maxPrice),
    isOffer,
    inStockOnly,
    isFeatured,
    isNewArrival,
  ].filter(Boolean).length;

  const draftActiveCount = [
    !!draftCategory,
    !!draftBrand,
    !!draftRating,
    !!(draftMinPrice || draftMaxPrice),
    draftIsOffer,
    draftInStockOnly,
    draftIsFeatured,
    draftIsNewArrival,
  ].filter(Boolean).length;

  const handlePriceApply = (e: React.FormEvent) => {
    e.preventDefault();
    setDesktopPriceError(null);

    // Strict validation
    if (localMin) {
      const minVal = validateNumericValue(localMin, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى للسعر' });
      if (!minVal.valid) {
        setDesktopPriceError(minVal.error || 'الحد الأدنى للسعر غير صالح');
        return;
      }
    }
    if (localMax) {
      const maxVal = validateNumericValue(localMax, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى للسعر' });
      if (!maxVal.valid) {
        setDesktopPriceError(maxVal.error || 'الحد الأقصى للسعر غير صالح');
        return;
      }
    }
    if (localMin && localMax) {
      const nMin = Number(localMin);
      const nMax = Number(localMax);
      if (nMin > nMax) {
        setDesktopPriceError('الحد الأدنى للسعر لا يمكن أن يتجاوز الحد الأقصى');
        return;
      }
    }

    onFilterChange({ minPrice: localMin, maxPrice: localMax });
  };

  const handleApplyMobile = () => {
    setMobilePriceError(null);

    // Strict validation
    if (draftMinPrice) {
      const minVal = validateNumericValue(draftMinPrice, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى للسعر' });
      if (!minVal.valid) {
        setMobilePriceError(minVal.error || 'الحد الأدنى للسعر غير صالح');
        return;
      }
    }
    if (draftMaxPrice) {
      const maxVal = validateNumericValue(draftMaxPrice, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى للسعر' });
      if (!maxVal.valid) {
        setMobilePriceError(maxVal.error || 'الحد الأقصى للسعر غير صالح');
        return;
      }
    }
    if (draftMinPrice && draftMaxPrice) {
      const nMin = Number(draftMinPrice);
      const nMax = Number(draftMaxPrice);
      if (nMin > nMax) {
        setMobilePriceError('الحد الأدنى للسعر لا يمكن أن يتجاوز الحد الأقصى');
        return;
      }
    }

    onFilterChange({
      category: draftCategory,
      brand: draftBrand,
      minPrice: draftMinPrice,
      maxPrice: draftMaxPrice,
      rating: draftRating,
      isOffer: draftIsOffer,
      inStockOnly: draftInStockOnly,
      isFeatured: draftIsFeatured,
      isNewArrival: draftIsNewArrival,
      sort: draftSort,
    });
    setIsMobileDrawerOpen(false);
  };

  const handleCancelMobile = () => {
    setIsMobileDrawerOpen(false);
  };

  const handleClearDraftMobile = () => {
    setDraftCategory('');
    setDraftBrand('');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setMobilePriceError(null);
    setDraftRating('');
    setDraftIsOffer(false);
    setDraftInStockOnly(false);
    setDraftIsFeatured(false);
    setDraftIsNewArrival(false);
    setDraftSort('featured');
  };

  return (
    <>
      {/* Mobile Filter Button Trigger */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="w-full flex items-center justify-between bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold text-xs px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>تصفية الفهرس والمواصفات</span>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 ? (
              <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full">
                الفلاتر ({activeFilterCount})
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">تعديل الخيارات</span>
            )}
          </div>
        </button>
      </div>

      {/* Mobile Filter Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            onClick={handleCancelMobile}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-800">
            {/* Sticky Drawer Header */}
            <div className="sticky top-0 bg-white dark:bg-slate-900 z-20 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 dark:text-amber-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    تصفية المنتجات
                    {draftActiveCount > 0 && (
                      <span className="text-xs bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full">
                        ({draftActiveCount})
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">حدد المواصفات ونطاق الأسعار المناسب</p>
                </div>
              </div>

              <button
                onClick={handleCancelMobile}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 divide-y divide-slate-150 dark:divide-slate-800 space-y-5">
              {/* Sorting Option */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-2.5 flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  ترتيب العرض
                </h4>
                <CustomSelect
                  value={draftSort}
                  onChange={(val) => setDraftSort(val)}
                  size="sm"
                  buttonClassName="border-slate-200 dark:border-amber-500/20 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl py-2 px-3 text-xs font-semibold hover:border-slate-300 dark:hover:border-amber-500/40"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-amber-500/20"
                  options={[
                    { value: 'featured', label: 'المقترحة والمميزة' },
                    { value: 'newest', label: 'وصل حديثاً (الأحدث)' },
                    { value: 'cheapest', label: 'السعر: من الأقل للأعلى' },
                    { value: 'expensive', label: 'السعر: من الأعلى للأقل' },
                    { value: 'rating', label: 'الأعلى تقييماً' },
                    { value: 'bestselling', label: 'الأكثر مبيعاً' },
                    { value: 'name_asc', label: 'الاسم: أ - ي' },
                    { value: 'name_desc', label: 'الاسم: ي - أ' },
                  ]}
                />
              </div>

              {/* Status Toggles */}
              <div className="pt-4 flex flex-col gap-2.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">حالة المنتج وتصنيفه</h4>

                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2.5 hover:text-slate-950 dark:hover:text-white bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-amber-500/20">
                  <input
                    type="checkbox"
                    checked={draftInStockOnly}
                    onChange={(e) => setDraftInStockOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                  />
                  <span>متوفر بالمخزون فقط 📦</span>
                </label>

                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2.5 hover:text-slate-950 dark:hover:text-white bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-amber-500/20">
                  <input
                    type="checkbox"
                    checked={draftIsOffer}
                    onChange={(e) => setDraftIsOffer(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                  />
                  <span>العروض والخصومات فقط 🏷️</span>
                </label>

                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2.5 hover:text-slate-950 dark:hover:text-white bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-amber-500/20">
                  <input
                    type="checkbox"
                    checked={draftIsFeatured}
                    onChange={(e) => setDraftIsFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                  />
                  <span>المنتجات المميزة ⭐</span>
                </label>

                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2.5 hover:text-slate-950 dark:hover:text-white bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-amber-500/20">
                  <input
                    type="checkbox"
                    checked={draftIsNewArrival}
                    onChange={(e) => setDraftIsNewArrival(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 accent-amber-500 border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
                  />
                  <span>وصل حديثاً 🆕</span>
                </label>
              </div>

              {/* Rating Filters */}
              <div className="pt-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">تقييم العملاء</h4>
                <div className="flex flex-col gap-2">
                  {[
                    { value: '4', label: '4 نجوم وأعلى' },
                    { value: '3', label: '3 نجوم وأعلى' },
                    { value: '2', label: 'نجمتان وأعلى' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDraftRating(draftRating === item.value ? '' : item.value)}
                      className={`flex items-center justify-between text-xs py-2 px-3 rounded-xl transition-colors cursor-pointer ${
                        draftRating === item.value
                          ? 'bg-amber-500/15 border border-amber-500/40 font-bold text-amber-600 dark:text-amber-300 shadow-2xs'
                          : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i < Number(item.value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
                          />
                        ))}
                      </div>
                      <span className="font-semibold">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Categories Filter */}
              <div className="pt-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">الأقسام والفئات</h4>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setDraftCategory('')}
                    className={`text-right text-xs py-1.5 px-3 rounded-xl font-semibold transition-all cursor-pointer ${draftCategory === '' ? 'text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-950'}`}
                  >
                    عرض كافة الأقسام
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setDraftCategory(cat)}
                      className={`text-right text-xs py-1.5 px-3 rounded-xl font-semibold transition-all cursor-pointer ${draftCategory === cat ? 'text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-950'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brands Filter */}
              <div className="pt-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">الماركات التجارية</h4>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setDraftBrand('')}
                    className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all border cursor-pointer ${draftBrand === '' ? 'text-slate-950 bg-amber-500 border-amber-500 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'}`}
                  >
                    جميع الماركات
                  </button>
                  {brands.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setDraftBrand(b)}
                      className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all border cursor-pointer ${draftBrand === b ? 'text-slate-950 bg-amber-500 border-amber-500 font-bold shadow-2xs' : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Bounds */}
              <div className="pt-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">نطاق السعر (جنيه مصري)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">من</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="أدنى"
                      value={draftMinPrice}
                      onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                      onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                      onChange={(e) => {
                        setDraftMinPrice(sanitizeNumericInput(e.target.value, 'non_negative_decimal'));
                        setMobilePriceError(null);
                      }}
                      className="w-full text-xs border border-slate-200 dark:border-amber-500/20 bg-slate-50 dark:bg-slate-900 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">إلى</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="أقصى"
                      value={draftMaxPrice}
                      onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                      onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                      onChange={(e) => {
                        setDraftMaxPrice(sanitizeNumericInput(e.target.value, 'non_negative_decimal'));
                        setMobilePriceError(null);
                      }}
                      className="w-full text-xs border border-slate-200 dark:border-amber-500/20 bg-slate-50 dark:bg-slate-900 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>
                </div>
                {mobilePriceError && (
                  <p className="text-[11px] text-rose-500 dark:text-rose-400 font-bold flex items-center gap-1 mt-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{mobilePriceError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Sticky Drawer Footer */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-amber-500/20 p-4 shadow-lg flex items-center justify-between gap-3 z-20">
              <button
                type="button"
                onClick={handleClearDraftMobile}
                className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:text-amber-500 transition-colors px-2 py-1 cursor-pointer"
              >
                مسح الكل
              </button>

              <div className="flex items-center gap-2 flex-1 justify-end">
                <button
                  type="button"
                  onClick={handleCancelMobile}
                  className="px-4 py-2.5 border border-slate-200 dark:border-amber-500/20 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={handleApplyMobile}
                  className="flex-1 max-w-[160px] py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer text-center"
                >
                  تطبيق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/20 rounded-2xl p-5 shadow-sm divide-y divide-slate-150 dark:divide-slate-800 flex-col gap-5 sticky top-28" id="store-filters-sidebar">
        {/* Title Header */}
        <div className="flex justify-between items-center pb-2">
          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            تصفية المنتجات ومواصفاتها
          </h3>
          <button
            onClick={() => {
              setLocalMin('');
              setLocalMax('');
              onReset();
            }}
            className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:text-amber-500 dark:hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            إعادة ضبط
          </button>
        </div>

        {/* Sorting dropdown in sidebar */}
        <div className="pt-4">
          <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-2.5 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            ترتيب العرض
          </h4>
          <CustomSelect
            value={selectedSort}
            onChange={(val) => onFilterChange({ sort: val })}
            size="sm"
            buttonClassName="border-slate-200 dark:border-amber-500/20 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl py-2 px-3 text-xs font-semibold hover:border-slate-300 dark:hover:border-amber-500/40"
            menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-amber-500/20"
            options={[
              { value: 'featured', label: 'المقترحة والمميزة' },
              { value: 'newest', label: 'وصل حديثاً (الأحدث)' },
              { value: 'cheapest', label: 'السعر: من الأقل للأعلى' },
              { value: 'expensive', label: 'السعر: من الأعلى للأقل' },
              { value: 'rating', label: 'الأعلى تقييماً' },
              { value: 'bestselling', label: 'الأكثر مبيعاً' },
              { value: 'name_asc', label: 'الاسم: أ - ي' },
              { value: 'name_desc', label: 'الاسم: ي - أ' },
            ]}
          />
        </div>

        {/* Status & Badge Toggles */}
        <div className="pt-4 flex flex-col gap-2.5">
          <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">حالة المنتج وتصنيفه</h4>

          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2.5 hover:text-slate-950 dark:hover:text-white">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => onFilterChange({ inStockOnly: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500 accent-amber-500 border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
            />
            <span>متوفر بالمخزون فقط 📦</span>
          </label>

          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2.5 hover:text-slate-950 dark:hover:text-white">
            <input
              type="checkbox"
              checked={isOffer}
              onChange={(e) => onFilterChange({ isOffer: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500 accent-amber-500 border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
            />
            <span>العروض والخصومات فقط 🏷️</span>
          </label>

          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2.5 hover:text-slate-950 dark:hover:text-white">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => onFilterChange({ isFeatured: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500 accent-amber-500 border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
            />
            <span>المنتجات المميزة ⭐</span>
          </label>

          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-2.5 hover:text-slate-950 dark:hover:text-white">
            <input
              type="checkbox"
              checked={isNewArrival}
              onChange={(e) => onFilterChange({ isNewArrival: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500 accent-amber-500 border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-amber-500/30 cursor-pointer"
            />
            <span>وصل حديثاً 🆕</span>
          </label>
        </div>

        {/* Rating Filters */}
        <div className="pt-4">
          <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">تقييم العملاء</h4>
          <div className="flex flex-col gap-2">
            {[
              { value: '4', label: '4 نجوم وأعلى' },
              { value: '3', label: '3 نجوم وأعلى' },
              { value: '2', label: 'نجمتان وأعلى' },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => onFilterChange({ rating: selectedRating === item.value ? '' : item.value })}
                className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer ${
                  selectedRating === item.value
                    ? 'bg-amber-500/10 border border-amber-500/30 font-bold text-amber-600 dark:text-amber-300 shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < Number(item.value) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`}
                    />
                  ))}
                </div>
                <span className="font-semibold">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Categories filter */}
        <div className="pt-4">
          <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">الأقسام والفئات</h4>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            <button
              onClick={() => onFilterChange({ category: '' })}
              className={`text-right text-xs py-1 px-2.5 rounded-lg font-semibold transition-all cursor-pointer ${selectedCategory === '' ? 'text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              عرض كافة الأقسام
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => onFilterChange({ category: cat })}
                className={`text-right text-xs py-1 px-2.5 rounded-lg font-semibold transition-all cursor-pointer ${selectedCategory === cat ? 'text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Brands filter */}
        <div className="pt-4">
          <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">الماركات التجارية</h4>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            <button
              onClick={() => onFilterChange({ brand: '' })}
              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all border cursor-pointer ${selectedBrand === '' ? 'text-slate-950 bg-amber-500 border-amber-500 font-black shadow-xs' : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'}`}
            >
              جميع الماركات
            </button>
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => onFilterChange({ brand: b })}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all border cursor-pointer ${selectedBrand === b ? 'text-slate-950 bg-amber-500 border-amber-500 font-black shadow-xs' : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700'}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Price filter manual input bounds */}
        <div className="pt-4">
          <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">نطاق السعر (جنيه مصري)</h4>
          <form onSubmit={handlePriceApply} className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">من</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="أدنى"
                  value={localMin}
                  onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                  onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                  onChange={(e) => {
                    setLocalMin(sanitizeNumericInput(e.target.value, 'non_negative_decimal'));
                    setDesktopPriceError(null);
                  }}
                  className="w-full text-xs border border-slate-200 dark:border-amber-500/20 bg-slate-50 dark:bg-slate-900 rounded-lg p-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">إلى</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="أقصى"
                  value={localMax}
                  onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                  onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                  onChange={(e) => {
                    setLocalMax(sanitizeNumericInput(e.target.value, 'non_negative_decimal'));
                    setDesktopPriceError(null);
                  }}
                  className="w-full text-xs border border-slate-200 dark:border-amber-500/20 bg-slate-50 dark:bg-slate-900 rounded-lg p-2 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>
            {desktopPriceError && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 font-bold flex items-center gap-1 my-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{desktopPriceError}</span>
              </p>
            )}
            <button
              type="submit"
              className="w-full py-1.5 bg-slate-900 dark:bg-slate-900 hover:bg-amber-500 dark:hover:bg-amber-500 text-white dark:text-slate-200 hover:text-slate-950 dark:hover:text-slate-950 border border-slate-800 dark:border-amber-500/20 hover:border-amber-500 font-bold text-xs rounded-lg transition-colors cursor-pointer"
            >
              تطبيق الفرز المالي
            </button>
          </form>
        </div>

        {/* Guarantee Badge */}
        <div className="pt-4 text-center">
          <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex items-center gap-2 text-right">
            <ShieldCheck className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <h5 className="text-[10px] font-black text-slate-900 dark:text-white">أجهزة أصلية معتمدة</h5>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 leading-normal">تأتي كافة المنتجات بعبوتها الأصلية وعليها ختم الضمان الرسمي.</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

