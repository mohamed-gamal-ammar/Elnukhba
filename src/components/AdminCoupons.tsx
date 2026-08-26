import React, { useState, useEffect, useMemo } from 'react';
import { Tag, Plus, Trash2, Edit, Search, Calendar, TrendingUp, Percent, Truck, Coins, Users, RefreshCw, Check, X, Ban, Sparkles } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { Coupon } from '../types.js';
import {
  handleNumericKeyDown,
  handleNumericPaste,
  sanitizeNumericInput,
  validateNumericValue
} from '../lib/numericValidation.js';
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminButton,
  AdminBadge,
  AdminEmptyState,
  AdminLoading,
  AdminSearchInput,
  AdminTablePagination
} from './AdminUIComponents.js';
import { CustomSelect } from './CustomSelect.js';

interface AdminCouponsProps {
  onRefreshAll?: () => void;
}

export default function AdminCoupons({ onRefreshAll }: AdminCouponsProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search, filter, and sorting states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('code');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formError, setFormError] = useState('');

  // Form field states
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage');
  const [value, setValue] = useState<number>(10);
  const [minOrderValue, setMinOrderValue] = useState<string>('');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [oneUsePerUser, setOneUsePerUser] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const fetchCoupons = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminCoupons();
      setCoupons(data || []);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل الكوبونات من قاعدة البيانات'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleOpenCreate = () => {
    setEditingCoupon(null);
    setCode('');
    setDiscountType('percentage');
    setValue(10);
    setMinOrderValue('');
    setMaxDiscountAmount('');
    setExpiryDate('');
    setUsageLimit('');
    setOneUsePerUser(false);
    setIsActive(true);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    const type = coupon.discountType || 'fixed';
    setDiscountType(type);
    const rawVal = coupon.value !== undefined ? coupon.value : (coupon.discountValue !== undefined ? coupon.discountValue : 0);
    setValue(rawVal);
    setMinOrderValue(coupon.minOrderValue ? coupon.minOrderValue.toString() : '');
    setMaxDiscountAmount(coupon.maxDiscountAmount ? coupon.maxDiscountAmount.toString() : '');
    setExpiryDate(coupon.expiryDate || '');
    setUsageLimit(coupon.usageLimit ? coupon.usageLimit.toString() : '');
    setOneUsePerUser(coupon.oneUsePerUser || false);
    setIsActive(coupon.isActive);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validations
    if (!code.trim()) {
      setFormError('كود الكوبون مطلوب');
      return;
    }

    let parsedValue = 0;
    if (discountType !== 'free_shipping') {
      const valRes = validateNumericValue(value, discountType === 'percentage' ? 'percentage' : 'positive_decimal', {
        required: true,
        min: 0.01,
        max: discountType === 'percentage' ? 100 : 50000,
        fieldNameArabic: discountType === 'percentage' ? 'نسبة الخصم المئوية' : 'مبلغ الخصم'
      });
      if (!valRes.valid) {
        setFormError(valRes.error || 'قيمة الخصم غير صالحة');
        return;
      }
      parsedValue = valRes.value!;
    }

    let parsedMinOrder: number | undefined = undefined;
    if (minOrderValue !== undefined && minOrderValue !== null && String(minOrderValue).trim() !== '') {
      const minRes = validateNumericValue(minOrderValue, 'non_negative_decimal', {
        min: 0,
        fieldNameArabic: 'الحد الأدنى لقيمة السلة'
      });
      if (!minRes.valid) {
        setFormError(minRes.error || 'الحد الأدنى لقيمة السلة غير صالح');
        return;
      }
      parsedMinOrder = minRes.value!;
    }

    let parsedMaxDiscount: number | undefined = undefined;
    if (discountType === 'percentage' && maxDiscountAmount !== undefined && maxDiscountAmount !== null && String(maxDiscountAmount).trim() !== '') {
      const maxRes = validateNumericValue(maxDiscountAmount, 'positive_decimal', {
        min: 1,
        fieldNameArabic: 'الحد الأقصى للخصم'
      });
      if (!maxRes.valid) {
        setFormError(maxRes.error || 'الحد الأقصى للخصم غير صالح');
        return;
      }
      parsedMaxDiscount = maxRes.value!;
    }

    let parsedUsageLimit: number | undefined = undefined;
    if (usageLimit !== undefined && usageLimit !== null && String(usageLimit).trim() !== '') {
      const limitRes = validateNumericValue(usageLimit, 'positive_integer', {
        min: 1,
        fieldNameArabic: 'الحد الأقصى للاستخدام'
      });
      if (!limitRes.valid) {
        setFormError(limitRes.error || 'الحد الأقصى للاستخدام غير صالح');
        return;
      }
      parsedUsageLimit = limitRes.value!;
    }

    const payload: Partial<Coupon> = {
      discountType,
      value: parsedValue,
      discountValue: parsedValue,
      minOrderValue: parsedMinOrder,
      maxDiscountAmount: discountType === 'percentage' ? parsedMaxDiscount : undefined,
      expiryDate: expiryDate || undefined,
      usageLimit: parsedUsageLimit,
      oneUsePerUser,
      isActive
    };

    try {
      if (editingCoupon) {
        // Update
        await api.updateAdminCoupon(editingCoupon.code, payload);
        setSuccess(`تم تحديث الكوبون [${editingCoupon.code}] بنجاح`);
      } else {
        // Create
        await api.createAdminCoupon({
          ...payload,
          code: code.trim().toUpperCase()
        });
        setSuccess(`تم إنشاء الكوبون الجديد [${code.trim().toUpperCase()}] بنجاح`);
      }
      setIsFormOpen(false);
      fetchCoupons();
      if (onRefreshAll) onRefreshAll();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setFormError(getFriendlyErrorMessage(err, 'فشلت العملية، يرجى التحقق من البيانات والمحاولة مرة أخرى'));
    }
  };

  const handleDelete = async (couponCode: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف الكوبون [${couponCode}] نهائياً؟`)) {
      return;
    }

    try {
      await api.deleteAdminCoupon(couponCode);
      setSuccess(`تم حذف الكوبون [${couponCode}] بنجاح`);
      fetchCoupons();
      if (onRefreshAll) onRefreshAll();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حذف الكوبون المحدد'));
    }
  };

  // Stats Calculations
  const activeCouponsCount = coupons.filter(c => c.isActive).length;
  const totalUsesCount = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
  const totalDiscountEgp = coupons.reduce((sum, c) => sum + (c.totalDiscountGenerated || 0), 0);
  const topCoupon = coupons.length > 0 
    ? [...coupons].sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0))[0] 
    : null;

  // Automatically reset to page 1 whenever search, status filter, type filter, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus, sortBy]);

  // Search, Filtering & Sorting
  const sortedCoupons = useMemo(() => {
    return coupons
      .filter(c => {
        // Search code
        const matchesSearch = c.code.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Filter Type
        const matchesType = filterType === 'all' || c.discountType === filterType;
        
        // Filter Status
        let matchesStatus = true;
        if (filterStatus === 'active') {
          matchesStatus = c.isActive;
        } else if (filterStatus === 'inactive') {
          matchesStatus = !c.isActive;
        } else if (filterStatus === 'expired') {
          if (c.expiryDate) {
            const today = new Date().toISOString().split('T')[0];
            matchesStatus = today > c.expiryDate;
          } else {
            matchesStatus = false;
          }
        }

        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'code') {
          return a.code.localeCompare(b.code, 'ar');
        } else if (sortBy === 'uses') {
          return (b.usedCount || 0) - (a.usedCount || 0);
        } else if (sortBy === 'discount') {
          return (b.totalDiscountGenerated || 0) - (a.totalDiscountGenerated || 0);
        } else if (sortBy === 'expiry') {
          const dateA = a.expiryDate || '9999-99-99';
          const dateB = b.expiryDate || '9999-99-99';
          return dateA.localeCompare(dateB);
        }
        return 0;
      });
  }, [coupons, searchTerm, filterType, filterStatus, sortBy]);

  const paginatedCoupons = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return sortedCoupons.slice(start, start + limit);
  }, [sortedCoupons, currentPage, limit]);

  const totalPages = Math.ceil(sortedCoupons.length / limit) || 1;

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl" id="admin-coupons-manager">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="نظام الكوبونات والعروض الترويجية"
        description="توليد خصومات مخصصة، فرض القيود الأمنية، وتحليل أرقام التوفير للمشترين"
        icon={Tag}
        badge={<AdminBadge variant="amber">{coupons.length} كود خصم</AdminBadge>}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCoupons}
              disabled={loading}
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <AdminButton icon={Plus} onClick={handleOpenCreate}>
              إنشاء كوبون جديد
            </AdminButton>
          </div>
        }
      />

      {/* Messages */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-400 font-bold">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-400 font-bold">
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="الكوبونات النشطة"
          value={`${activeCouponsCount} كود`}
          icon={Tag}
          subtitle={`من إجمالي ${coupons.length} كود ترويجي`}
        />
        <AdminStatCard
          title="إجمالي الاستخدامات"
          value={totalUsesCount}
          icon={Users}
          trend={{ value: `${totalUsesCount} طلب`, isPositive: true, label: 'طلب ناجح' }}
        />
        <AdminStatCard
          title="إجمالي الخصم المولد"
          value={`${totalDiscountEgp.toLocaleString()} ج.م`}
          icon={Coins}
          subtitle="توفير مباشر للعملاء"
        />
        <AdminStatCard
          title="الكوبون الأكثر استخداماً"
          value={topCoupon ? topCoupon.code : '—'}
          icon={Sparkles}
          trend={{ value: topCoupon ? `${topCoupon.usedCount} مرة` : 'لا يوجد', isPositive: true, label: 'مرات الاستخدام' }}
        />
      </div>

      {/* 3, 4, 5. Main Card with Search, Filters & Table */}
      <AdminCard className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <AdminSearchInput
            placeholder="البحث بكود الكوبون تليفونياً أو ترويجياً..."
            value={searchTerm}
            onChange={(val) => setSearchTerm(val)}
            className="w-full md:w-80"
          />

          <div className="flex flex-wrap gap-2.5 w-full md:w-auto text-xs font-bold justify-end">
            <div className="flex items-center gap-1.5 min-w-[130px]">
              <span className="text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap shrink-0">نوع الخصم:</span>
              <CustomSelect
                value={filterType}
                onChange={(val) => setFilterType(val)}
                size="sm"
                buttonClassName="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs"
                menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white min-w-[150px] shadow-lg"
                options={[
                  { value: 'all', label: 'الكل' },
                  { value: 'percentage', label: 'نسبة مئوية (%)' },
                  { value: 'fixed', label: 'مبلغ ثابت (ج.م)' },
                  { value: 'free_shipping', label: 'شحن مجاني 🚚' }
                ]}
              />
            </div>

            <div className="flex items-center gap-1.5 min-w-[130px]">
              <span className="text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap shrink-0">الحالة:</span>
              <CustomSelect
                value={filterStatus}
                onChange={(val) => setFilterStatus(val)}
                size="sm"
                buttonClassName="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs"
                menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white min-w-[150px] shadow-lg"
                options={[
                  { value: 'all', label: 'الكل' },
                  { value: 'active', label: 'نشط وفعال' },
                  { value: 'inactive', label: 'معطل' },
                  { value: 'expired', label: 'منتهي الصلاحية ⏱️' }
                ]}
              />
            </div>

            <div className="flex items-center gap-1.5 min-w-[150px]">
              <span className="text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap shrink-0">الترتيب:</span>
              <CustomSelect
                value={sortBy}
                onChange={(val) => setSortBy(val)}
                size="sm"
                buttonClassName="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs"
                menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white min-w-[170px] shadow-lg"
                options={[
                  { value: 'code', label: 'الكود (أبجدي)' },
                  { value: 'uses', label: 'مرات الاستخدام الأكثر' },
                  { value: 'discount', label: 'إجمالي الخصم المولّد' },
                  { value: 'expiry', label: 'تاريخ الانتهاء' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* 6. Content (Table or Empty State) */}
        {loading ? (
          <AdminLoading message="جارٍ سحب سجلات الكوبونات الحالية..." />
        ) : sortedCoupons.length === 0 ? (
          <AdminEmptyState
            icon={Tag}
            title="لا توجد كوبونات تطابق فلاتر البحث الحالية"
            description="جرب البحث بكلمات مختلفة أو تغيير فلاتر نوع الخصم أو الحالة."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-3">كود الكوبون</th>
                    <th className="py-3 px-3">نوع الخصم والقيمة</th>
                    <th className="py-3 px-3">شروط التفعيل</th>
                    <th className="py-3 px-3">حد الاستخدام</th>
                    <th className="py-3 px-3">صلاحية العرض</th>
                    <th className="py-3 px-3 text-center">الاستخدامات</th>
                    <th className="py-3 px-3 text-center">إجمالي التوفير</th>
                    <th className="py-3 px-3 text-center">الحالة</th>
                    <th className="py-3 px-3 text-center">التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-slate-800 dark:text-slate-300">
                  {paginatedCoupons.map((coupon) => {
                    const today = new Date().toISOString().split('T')[0];
                    const isExpired = coupon.expiryDate && today > coupon.expiryDate;
                    
                    return (
                      <tr key={coupon.code} className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-3 font-mono font-black text-amber-600 dark:text-amber-400 text-sm select-all">
                          {coupon.code}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                            {coupon.discountType === 'percentage' && (
                              <>
                                <Percent className="w-3.5 h-3.5 text-amber-500" />
                                <span>خصم نسبة {coupon.value}%</span>
                              </>
                            )}
                            {coupon.discountType === 'fixed' && (
                              <>
                                <Coins className="w-3.5 h-3.5 text-amber-500" />
                                <span>خصم مباشر {coupon.value} ج.م</span>
                              </>
                            )}
                            {coupon.discountType === 'free_shipping' && (
                              <>
                                <Truck className="w-3.5 h-3.5 text-sky-500" />
                                <span className="text-sky-600 dark:text-sky-400">شحن مجاني بالكامل 🚚</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-medium">
                          <div className="space-y-1">
                            {coupon.minOrderValue ? (
                              <div className="text-[10px] text-slate-600 dark:text-slate-400">حد أدنى للطلب: <strong className="text-slate-900 dark:text-white font-black">{coupon.minOrderValue} ج.م</strong></div>
                            ) : (
                              <div className="text-[10px] text-slate-600 dark:text-slate-400">بدون حد أدنى للطلب</div>
                            )}
                            {coupon.maxDiscountAmount ? (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400">الحد الأقصى للخصم: <strong className="font-bold">{coupon.maxDiscountAmount} ج.م</strong></div>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 font-bold text-[11px]">
                          <div className="space-y-1">
                            {coupon.usageLimit ? (
                              <div className="text-slate-600 dark:text-slate-400">أقصى عدد: <strong className="text-slate-900 dark:text-white font-mono">{coupon.usageLimit} مرة</strong></div>
                            ) : (
                              <div className="text-slate-600 dark:text-slate-400 text-[10px]">استخدام غير محدود عالمياً</div>
                            )}
                            <div className="text-[10px] flex items-center gap-1">
                              {coupon.oneUsePerUser ? (
                                <span className="text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1 rounded">مرة واحدة للعميل 👤</span>
                              ) : (
                                <span className="text-slate-600 dark:text-slate-400">متعدد للعميل الواحد</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          {coupon.expiryDate ? (
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              <span className={isExpired ? 'text-rose-500 line-through' : 'text-slate-700 dark:text-slate-300'}>{coupon.expiryDate}</span>
                              {isExpired && <span className="text-[9px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1 rounded mr-1">منتهي</span>}
                            </div>
                          ) : (
                            <span className="text-slate-600 dark:text-slate-400 text-[10px]">مستمر بدون انتهاء</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-black text-sm text-slate-900 dark:text-slate-200">
                          {coupon.usedCount || 0}
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {(coupon.totalDiscountGenerated || 0).toLocaleString()} ج.م
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {isExpired ? (
                            <AdminBadge variant="danger">منتهي</AdminBadge>
                          ) : coupon.isActive ? (
                            <AdminBadge variant="success">نشط</AdminBadge>
                          ) : (
                            <AdminBadge variant="neutral">معطل</AdminBadge>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex gap-1.5 justify-center">
                            <button
                              onClick={() => handleOpenEdit(coupon)}
                              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="تعديل الكوبون"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(coupon.code)}
                              className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="حذف الكوبون"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sortedCoupons.length > 0 && (
              <div className="pt-2">
                <AdminTablePagination
                  page={currentPage}
                  totalPages={totalPages}
                  total={sortedCoupons.length}
                  limit={limit}
                  onPageChange={(p) => setCurrentPage(p)}
                  onLimitChange={(l) => {
                    setLimit(l);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </AdminCard>

      {/* Edit/Create overlay Drawer/Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 text-right shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <button
              onClick={() => setIsFormOpen(false)}
              className="absolute left-4 top-4 p-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="text-sm font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
              <Tag className="w-5 h-5 text-amber-500" />
              {editingCoupon ? `تعديل الكوبون الترويجي [${editingCoupon.code}]` : 'توليد كود خصم ترويجي جديد'}
            </h4>

            {formError && (
              <p className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold">⚠️ {formError}</p>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">كود الكوبون الترويجي <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  disabled={!!editingCoupon}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="EGYPT2026"
                  className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-mono font-bold uppercase focus:outline-none focus:border-amber-500 disabled:opacity-50 text-center tracking-wider"
                />
                {!editingCoupon && <p className="text-[9px] text-slate-500 dark:text-slate-400">يفضل استعمال أحرف وأرقام إنجليزية لكود ترويجي واضح وسهل الحفظ</p>}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">نوع الخصم <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      discountType === 'percentage'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Percent className="w-4 h-4 mb-1" />
                    <span>نسبة مئوية (%)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      discountType === 'fixed'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Coins className="w-4 h-4 mb-1" />
                    <span>مبلغ ثابت (ج.م)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDiscountType('free_shipping');
                      setValue(0);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      discountType === 'free_shipping'
                        ? 'bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-400 ring-1 ring-sky-500/30'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <Truck className="w-4 h-4 mb-1" />
                    <span>شحن مجاني 🚚</span>
                  </button>
                </div>
              </div>

              {discountType !== 'free_shipping' ? (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>
                      {discountType === 'percentage' ? 'نسبة الخصم المئوية (%)' : 'مبلغ الخصم النقدي المباشر (بالجنيه المصري)'} <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                      {discountType === 'percentage' ? 'بين 0.01% و 100%' : 'قيمة نقدية تخصم بالجنيه'}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={value !== undefined ? value : ''}
                      onKeyDown={(e) => handleNumericKeyDown(e, discountType === 'percentage' ? 'percentage' : 'positive_decimal')}
                      onPaste={(e) => handleNumericPaste(e, discountType === 'percentage' ? 'percentage' : 'positive_decimal')}
                      onChange={(e) => {
                        const clean = sanitizeNumericInput(e.target.value, discountType === 'percentage' ? 'percentage' : 'positive_decimal');
                        setValue(clean === '' ? ('' as any) : Number(clean));
                      }}
                      placeholder={discountType === 'percentage' ? '15' : '200'}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">
                      {discountType === 'percentage' ? '%' : 'ج.م'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-700 dark:text-sky-400 font-medium flex items-center gap-2">
                  <Truck className="w-4 h-4 shrink-0 text-sky-500" />
                  <span>هذا الكوبون يعفي العميل من رسوم الشحن والتوصيل البري تلقائياً عند إتمام الطلب.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الحد الأدنى لقيمة السلة (ج.م)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={minOrderValue}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                    onChange={(e) => setMinOrderValue(sanitizeNumericInput(e.target.value, 'non_negative_decimal'))}
                    placeholder="مثال: 1000"
                    className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">لا يفعل الخصم إلا إذا تخطى العميل هذا المجموع</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الحد الأقصى للخصم (ج.م)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={discountType !== 'percentage'}
                    value={maxDiscountAmount}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'positive_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'positive_decimal')}
                    onChange={(e) => setMaxDiscountAmount(sanitizeNumericInput(e.target.value, 'positive_decimal'))}
                    placeholder="مثال: 500"
                    className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 disabled:opacity-50 font-bold"
                  />
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">سقف الخصم (لنسبة الخصم فقط)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">تاريخ انتهاء الصلاحية</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold text-right"
                  />
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">ينتهي مفعول الكوبون بنهاية هذا اليوم</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الحد الأقصى الإجمالي للاستخدام</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={usageLimit}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'positive_integer')}
                    onPaste={(e) => handleNumericPaste(e, 'positive_integer')}
                    onChange={(e) => setUsageLimit(sanitizeNumericInput(e.target.value, 'positive_integer'))}
                    placeholder="مثال: 100"
                    className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <span className="text-[9px] text-slate-500 dark:text-slate-400">عدد مرات الاستخدام المسموح بها عالمياً</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5">
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={oneUsePerUser}
                    onChange={(e) => setOneUsePerUser(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                  <span>تقييد الاستخدام بـ (مرة واحدة لكل عميل) 👤</span>
                </label>
                <p className="text-[9.5px] text-slate-500 dark:text-slate-400 mr-6 leading-relaxed">
                  عند تفعيل هذا الخيار، سيقوم الخادم تلقائياً بفحص البريد الإلكتروني ورقم هاتف المشتري لمنع تكرار استعمال الكوبون من نفس الشخص.
                </p>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 mt-2">
                <div className="text-right">
                  <span className="text-xs text-slate-900 dark:text-white font-bold block">تنشيط الكوبون للاستخدام</span>
                  <span className="text-[9.5px] text-slate-500 dark:text-slate-400">يمكنك تعطيل الكوبون مؤقتاً بأي وقت دون حذفه</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white dark:after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500 peer-checked:after:bg-slate-950"></div>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-5">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg"
                >
                  {editingCoupon ? 'حفظ تعديلات الكوبون' : 'توليد الكوبون ونشره فورا'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-5 py-3 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
