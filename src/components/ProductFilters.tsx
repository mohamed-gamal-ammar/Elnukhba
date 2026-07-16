import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Star, RotateCcw, ShieldCheck } from 'lucide-react';

interface ProductFiltersProps {
  categories: string[];
  brands: string[];
  selectedCategory: string;
  selectedBrand: string;
  minPrice: string;
  maxPrice: string;
  selectedRating: string;
  isOffer: boolean;
  selectedSort: string;
  onFilterChange: (filters: {
    category?: string;
    brand?: string;
    minPrice?: string;
    maxPrice?: string;
    rating?: string;
    isOffer?: boolean;
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
  selectedSort,
  onFilterChange,
  onReset
}: ProductFiltersProps) {
  const [localMin, setLocalMin] = useState(minPrice);
  const [localMax, setLocalMax] = useState(maxPrice);

  useEffect(() => {
    setLocalMin(minPrice);
  }, [minPrice]);

  useEffect(() => {
    setLocalMax(maxPrice);
  }, [maxPrice]);

  const handlePriceApply = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ minPrice: localMin, maxPrice: localMax });
  };

  return (
    <aside className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm divide-y divide-gray-100 flex flex-col gap-5 sticky top-28" id="store-filters-sidebar">
      {/* Title Header */}
      <div className="flex justify-between items-center pb-2">
        <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-amber-500" />
          تصفية المنتجات ومواصفاتها
        </h3>
        <button
          onClick={() => {
            setLocalMin('');
            setLocalMax('');
            onReset();
          }}
          className="text-xs text-amber-600 font-bold hover:text-amber-500 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          إعادة ضبط
        </button>
      </div>

      {/* Categories filter */}
      <div className="pt-4">
        <h4 className="font-bold text-slate-900 text-xs mb-3">الأقسام والفئات</h4>
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
          <button
            onClick={() => onFilterChange({ category: '' })}
            className={`text-right text-xs py-1 px-2.5 rounded-lg font-semibold transition-all ${selectedCategory === '' ? 'text-slate-950 bg-slate-100 font-bold' : 'text-gray-500 hover:text-slate-950 hover:bg-slate-50'}`}
          >
            عرض كافة الأقسام
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onFilterChange({ category: cat })}
              className={`text-right text-xs py-1 px-2.5 rounded-lg font-semibold transition-all ${selectedCategory === cat ? 'text-slate-950 bg-slate-100 font-bold' : 'text-gray-500 hover:text-slate-950 hover:bg-slate-50'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Brands filter */}
      <div className="pt-4">
        <h4 className="font-bold text-slate-900 text-xs mb-3">الماركات التجارية</h4>
        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
          <button
            onClick={() => onFilterChange({ brand: '' })}
            className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all border ${selectedBrand === '' ? 'text-slate-950 bg-slate-100 border-slate-300 font-black shadow-xs' : 'text-gray-500 border-gray-100 hover:border-gray-200'}`}
          >
            جميع الماركات
          </button>
          {brands.map((b) => (
            <button
              key={b}
              onClick={() => onFilterChange({ brand: b })}
              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all border ${selectedBrand === b ? 'text-slate-950 bg-slate-100 border-slate-300 font-black shadow-xs' : 'text-gray-500 border-gray-100 hover:border-gray-200'}`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Price filter manual input bounds */}
      <div className="pt-4">
        <h4 className="font-bold text-slate-900 text-xs mb-3">نطاق السعر (جنيه مصري)</h4>
        <form onSubmit={handlePriceApply} className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold">من</span>
              <input
                type="number"
                placeholder="أدنى"
                value={localMin}
                onChange={(e) => setLocalMin(e.target.value)}
                className="w-full text-xs border border-gray-150 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-gray-400 font-bold">إلى</span>
              <input
                type="number"
                placeholder="أقصى"
                value={localMax}
                onChange={(e) => setLocalMax(e.target.value)}
                className="w-full text-xs border border-gray-150 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            تطبيق الفرز المالي
          </button>
        </form>
      </div>

      {/* Stars filter */}
      <div className="pt-4">
        <h4 className="font-bold text-slate-900 text-xs mb-3">تقييم العملاء</h4>
        <div className="flex flex-col gap-2">
          {['5', '4', '3'].map((star) => (
            <button
              key={star}
              onClick={() => onFilterChange({ rating: selectedRating === star ? '' : star })}
              className={`flex items-center gap-1.5 text-xs text-right py-1 px-1.5 rounded-md transition-colors ${selectedRating === star ? 'bg-amber-500/15 font-bold text-slate-950' : 'text-gray-500 hover:text-slate-950 hover:bg-gray-50'}`}
            >
              <div className="flex text-amber-400">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${i < Number(star) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                  />
                ))}
              </div>
              <span>أو أعلى ({star} نجوم)</span>
            </button>
          ))}
        </div>
      </div>

      {/* Special checkbox filters */}
      <div className="pt-4 flex items-center justify-between">
        <label htmlFor="filter-is-offer" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-2">
          <input
            id="filter-is-offer"
            type="checkbox"
            checked={isOffer}
            onChange={(e) => onFilterChange({ isOffer: e.target.checked })}
            className="w-4 h-4 rounded text-amber-500 border-gray-300 focus:ring-amber-500"
          />
          عرض المنتجات المخفضة والعروض فقط 🏷️
        </label>
      </div>

      {/* Guarantee Badge */}
      <div className="pt-4 text-center">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center gap-2 text-right">
          <ShieldCheck className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <h5 className="text-[10px] font-black text-slate-900">أجهزة أصلية معتمدة</h5>
            <p className="text-[9px] text-gray-500 leading-normal">تأتي كافة المنتجات بعبوتها الأصلية وعليها ختم الضمان الرسمي.</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
