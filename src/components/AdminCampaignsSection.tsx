import React, { useState, useEffect, FormEvent, useMemo } from 'react';
import { Tag, Plus, Edit2, Trash2, CheckCircle2, XCircle, Calendar, Target, DollarSign, AlertCircle, RefreshCw, Eye, Percent, Truck, Gift, Search, RotateCcw, X } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { Campaign, Product } from '../types.js';
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

export default function AdminCampaignsSection() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState<'percentage' | 'fixed' | 'free_shipping'>('percentage');
  const [value, setValue] = useState<number | ''>(10);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [active, setActive] = useState(true);
  const [minimumOrderValue, setMinimumOrderValue] = useState<number | ''>('');
  const [maximumDiscountAmount, setMaximumDiscountAmount] = useState<number | ''>('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'upcoming' | 'expired'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'percentage' | 'fixed' | 'free_shipping'>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'nameAsc' | 'nameDesc' | 'valueDesc' | 'valueAsc'>('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cmpRes, prodRes] = await Promise.all([
        api.getAdminCampaigns(),
        api.getProducts()
      ]);

      if (cmpRes?.campaigns) {
        setCampaigns(cmpRes.campaigns);
      }

      if (Array.isArray(prodRes)) {
        setProducts(prodRes);
        const cats = Array.from(new Set(prodRes.map(p => p.category).filter(Boolean)));
        setCategories(cats);
      }
    } catch (err: any) {
      console.error('Failed to load campaigns:', err);
      setError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء تحميل البيانات'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Automatically reset to page 1 whenever search, status, type, date filters, or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, startDateFilter, endDateFilter, sortBy]);

  // Client-side filtering, sorting & pagination
  const filteredCampaigns = useMemo(() => {
    const now = Date.now();
    return campaigns.filter(cmp => {
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = cmp.name?.toLowerCase().includes(q);
        const matchId = cmp.id?.toLowerCase().includes(q);
        if (!matchName && !matchId) return false;
      }

      // Status Filter
      if (statusFilter !== 'all') {
        const start = new Date(cmp.startAt).getTime();
        const end = new Date(cmp.endAt).getTime();

        if (statusFilter === 'active') {
          if (!cmp.active || now < start || now > end) return false;
        } else if (statusFilter === 'inactive') {
          if (cmp.active) return false;
        } else if (statusFilter === 'upcoming') {
          if (!cmp.active || now >= start) return false;
        } else if (statusFilter === 'expired') {
          if (!cmp.active || now <= end) return false;
        }
      }

      // Type Filter
      if (typeFilter !== 'all' && cmp.type !== typeFilter) {
        return false;
      }

      // Date Filters
      if (startDateFilter) {
        const startFilterTime = new Date(startDateFilter).getTime();
        const cmpStartTime = new Date(cmp.startAt).getTime();
        if (cmpStartTime < startFilterTime) return false;
      }

      if (endDateFilter) {
        const endFilterTime = new Date(endDateFilter).getTime();
        const cmpEndTime = new Date(cmp.endAt).getTime();
        if (cmpEndTime > endFilterTime) return false;
      }

      return true;
    });
  }, [campaigns, searchQuery, statusFilter, typeFilter, startDateFilter, endDateFilter]);

  const sortedCampaigns = useMemo(() => {
    return [...filteredCampaigns].sort((a, b) => {
      if (sortBy === 'oldest') {
        const dateA = a.startAt ? new Date(a.startAt).getTime() : 0;
        const dateB = b.startAt ? new Date(b.startAt).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === 'nameAsc') {
        return (a.name || '').localeCompare(b.name || '', 'ar');
      }
      if (sortBy === 'nameDesc') {
        return (b.name || '').localeCompare(a.name || '', 'ar');
      }
      if (sortBy === 'valueDesc') {
        return (b.value || 0) - (a.value || 0);
      }
      if (sortBy === 'valueAsc') {
        return (a.value || 0) - (b.value || 0);
      }
      // Default 'newest'
      const dateA = a.startAt ? new Date(a.startAt).getTime() : 0;
      const dateB = b.startAt ? new Date(b.startAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredCampaigns, sortBy]);

  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return sortedCampaigns.slice(start, start + limit);
  }, [sortedCampaigns, currentPage, limit]);

  const totalPages = Math.ceil(sortedCampaigns.length / limit) || 1;

  const resetForm = () => {
    setName('');
    setType('percentage');
    setValue(10);

    // Default dates: start today, end in 7 days
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // Format YYYY-MM-DDTHH:mm for datetime-local input
    const formatForInput = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setStartAt(formatForInput(now));
    setEndAt(formatForInput(weekLater));
    setActive(true);
    setMinimumOrderValue('');
    setMaximumDiscountAmount('');
    setSelectedProductIds([]);
    setSelectedCategories([]);
    setEditingCampaign(null);
    setFormError(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cmp: Campaign) => {
    setEditingCampaign(cmp);
    setName(cmp.name);
    setType(cmp.type);
    setValue(cmp.type === 'free_shipping' ? 0 : cmp.value);
    
    const formatForInput = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch {
        return '';
      }
    };

    setStartAt(formatForInput(cmp.startAt));
    setEndAt(formatForInput(cmp.endAt));
    setActive(cmp.active);
    setMinimumOrderValue(cmp.minimumOrderValue !== undefined && cmp.minimumOrderValue !== null ? cmp.minimumOrderValue : '');
    setMaximumDiscountAmount(cmp.maximumDiscountAmount !== undefined && cmp.maximumDiscountAmount !== null ? cmp.maximumDiscountAmount : '');
    setSelectedProductIds(cmp.productIds || []);
    setSelectedCategories(cmp.categoryIds || []);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Form validations
    if (!name.trim()) {
      setFormError('يرجى إدخال اسم الحملة الترويجية');
      return;
    }

    let parsedVal = 0;
    if (type !== 'free_shipping') {
      const valRes = validateNumericValue(value, type === 'percentage' ? 'percentage' : 'non_negative_decimal', {
        required: true,
        min: 0,
        max: type === 'percentage' ? 100 : undefined,
        fieldNameArabic: type === 'percentage' ? 'نسبة الخصم المئوية' : 'قيمة الخصم'
      });
      if (!valRes.valid) {
        setFormError(valRes.error || 'قيمة الخصم غير صالحة');
        return;
      }
      parsedVal = valRes.value!;
    }

    if (!startAt || !endAt) {
      setFormError('يرجى تحديد تاريخ البداية وتاريخ النهاية');
      return;
    }

    const startTime = new Date(startAt).getTime();
    const endTime = new Date(endAt).getTime();

    if (isNaN(startTime) || isNaN(endTime)) {
      setFormError('صيغة التاريخ غير صالحة');
      return;
    }

    if (endTime <= startTime) {
      setFormError('تاريخ نهاية الحملة يجب أن يكون بعد تاريخ البداية');
      return;
    }

    let parsedMinOrder: number | undefined = undefined;
    if (minimumOrderValue !== '' && minimumOrderValue !== undefined && minimumOrderValue !== null) {
      const minRes = validateNumericValue(minimumOrderValue, 'non_negative_decimal', {
        min: 0,
        fieldNameArabic: 'الحد الأدنى لقيمة الطلب'
      });
      if (!minRes.valid) {
        setFormError(minRes.error || 'الحد الأدنى لقيمة الطلب غير صالح');
        return;
      }
      parsedMinOrder = minRes.value;
    }

    let parsedMaxDiscount: number | undefined = undefined;
    if (maximumDiscountAmount !== '' && maximumDiscountAmount !== undefined && maximumDiscountAmount !== null) {
      const maxRes = validateNumericValue(maximumDiscountAmount, 'non_negative_decimal', {
        min: 0,
        fieldNameArabic: 'الحد الأقصى لمبلغ الخصم'
      });
      if (!maxRes.valid) {
        setFormError(maxRes.error || 'الحد الأقصى لمبلغ الخصم غير صالح');
        return;
      }
      parsedMaxDiscount = maxRes.value;
    }

    setSubmitting(true);
    try {
      const payload: Partial<Campaign> = {
        name: name.trim(),
        type,
        value: type === 'free_shipping' ? 0 : parsedVal,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        active,
        productIds: selectedProductIds,
        categoryIds: selectedCategories,
        minimumOrderValue: parsedMinOrder,
        maximumDiscountAmount: parsedMaxDiscount
      };

      if (editingCampaign) {
        const res = await api.updateAdminCampaign(editingCampaign.id, payload);
        if (res?.success && res.campaign) {
          setCampaigns(prev => prev.map(c => c.id === editingCampaign.id ? res.campaign : c));
          setSuccessMsg(`تم تحديث الحملة "${res.campaign.name}" بنجاح`);
        }
      } else {
        const res = await api.createAdminCampaign(payload);
        if (res?.success && res.campaign) {
          setCampaigns(prev => [res.campaign, ...prev]);
          setSuccessMsg(`تم إنشاء الحملة "${res.campaign.name}" بنجاح`);
        }
      }

      setIsModalOpen(false);
      resetForm();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error saving campaign:', err);
      setFormError(getFriendlyErrorMessage(err, 'فشل حفظ الحملة الترويجية'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (cmp: Campaign) => {
    try {
      const newActive = !cmp.active;
      const res = await api.updateAdminCampaign(cmp.id, { active: newActive });
      if (res?.success && res.campaign) {
        setCampaigns(prev => prev.map(c => c.id === cmp.id ? res.campaign : c));
        setSuccessMsg(`تم ${newActive ? 'تفعيل' : 'إيقاف'} الحملة بنجاح`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err, 'فشل تغيير حالة الحملة'));
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      const res = await api.deleteAdminCampaign(id);
      if (res?.success) {
        setCampaigns(prev => prev.filter(c => c.id !== id));
        setSuccessMsg('تم حذف الحملة الترويجية بنجاح');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err, 'فشل حذف الحملة الترويجية'));
    } finally {
      setDeletingId(null);
    }
  };

  const formatDisplayDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dStr;
    }
  };

  const getCampaignStatusBadge = (cmp: Campaign) => {
    if (!cmp.active) {
      return (
        <AdminBadge variant="neutral">
          <XCircle className="w-3 h-3" /> غير نشطة
        </AdminBadge>
      );
    }

    const now = Date.now();
    const start = new Date(cmp.startAt).getTime();
    const end = new Date(cmp.endAt).getTime();

    if (now < start) {
      return (
        <AdminBadge variant="info">
          <Calendar className="w-3 h-3" /> قادمة
        </AdminBadge>
      );
    }

    if (now > end) {
      return (
        <AdminBadge variant="danger">
          <AlertCircle className="w-3 h-3" /> منتهية
        </AdminBadge>
      );
    }

    return (
      <AdminBadge variant="success">
        <CheckCircle2 className="w-3 h-3" /> جارية الآن
      </AdminBadge>
    );
  };

  const nowMs = Date.now();
  const activeCount = campaigns.filter(c => c.active && nowMs >= new Date(c.startAt).getTime() && nowMs <= new Date(c.endAt).getTime()).length;
  const upcomingCount = campaigns.filter(c => c.active && nowMs < new Date(c.startAt).getTime()).length;
  const expiredOrInactiveCount = campaigns.filter(c => !c.active || nowMs > new Date(c.endAt).getTime()).length;

  return (
    <div className="space-y-6 text-slate-100 dir-rtl font-sans">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة العروض والحملات الترويجية 🎯"
        description="إنشاء وتخصيص حملات الخصومات، التخفيضات والشحن المجاني لفترات زمنية محددة"
        icon={Tag}
        badge={<AdminBadge variant="amber">{campaigns.length} حملة</AdminBadge>}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchInitialData}
              disabled={loading}
              className="p-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
            <AdminButton icon={Plus} onClick={handleOpenCreateModal}>
              إضافة حملة جديدة
            </AdminButton>
          </div>
        }
      />

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="إجمالي الحملات"
          value={campaigns.length}
          icon={Tag}
          subtitle="جميع العروض والحملات المسجلة"
        />
        <AdminStatCard
          title="حملات جارية الآن"
          value={activeCount}
          icon={CheckCircle2}
          trend={{ value: `${campaigns.length ? Math.round((activeCount / campaigns.length) * 100) : 0}%`, isPositive: true, label: 'نشطة ومطبقة' }}
        />
        <AdminStatCard
          title="حملات قادمة"
          value={upcomingCount}
          icon={Calendar}
          subtitle="تبدأ تلقائياً في موعدها"
        />
        <AdminStatCard
          title="منتهية أو معطلة"
          value={expiredOrInactiveCount}
          icon={AlertCircle}
          trend={{ value: `${expiredOrInactiveCount} حملة`, isPositive: false, label: 'خارج النطاق' }}
        />
      </div>

      {/* 3, 4, 5. Main Card with Search, Filter & Content */}
      <AdminCard className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <AdminSearchInput
            placeholder="ابحث باسم الحملة أو المعرف..."
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            className="w-full"
          />

          {/* Status Filter */}
          <div className="min-w-[150px]">
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              size="sm"
              buttonClassName="bg-slate-900 border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              menuClassName="bg-slate-900 border-slate-700 min-w-[170px]"
              options={[
                { value: 'all', label: `جميع الحالات (${campaigns.length})` },
                { value: 'active', label: 'جارية الآن (نشطة)' },
                { value: 'upcoming', label: 'قادمة' },
                { value: 'expired', label: 'منتهية' },
                { value: 'inactive', label: 'غير نشطة (معطلة)' }
              ]}
            />
          </div>

          {/* Campaign Type Filter */}
          <div className="min-w-[140px]">
            <CustomSelect
              value={typeFilter}
              onChange={(val) => setTypeFilter(val as any)}
              size="sm"
              buttonClassName="bg-slate-900 border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              menuClassName="bg-slate-900 border-slate-700 min-w-[160px]"
              options={[
                { value: 'all', label: 'جميع أنواع الخصم' },
                { value: 'percentage', label: 'خصم مئوي (%)' },
                { value: 'fixed', label: 'خصم ثابت (مبلغ)' },
                { value: 'free_shipping', label: 'شحن مجاني' }
              ]}
            />
          </div>

          {/* Sort By */}
          <div className="min-w-[150px]">
            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val as any)}
              size="sm"
              buttonClassName="bg-slate-900 border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              menuClassName="bg-slate-900 border-slate-700 min-w-[170px]"
              options={[
                { value: 'newest', label: 'الأحدث أولاً' },
                { value: 'oldest', label: 'الأقدم أولاً' },
                { value: 'nameAsc', label: 'اسم الحملة: أ - ي' },
                { value: 'nameDesc', label: 'اسم الحملة: ي - أ' },
                { value: 'valueDesc', label: 'قيمة الخصم: الأعلى للأقل' },
                { value: 'valueAsc', label: 'قيمة الخصم: الأقل للأعلى' }
              ]}
            />
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800/60 text-xs">
          <span className="text-slate-400 font-bold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" /> تصفية بالتاريخ:
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">من:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">إلى:</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
          {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all' || startDateFilter || endDateFilter) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setTypeFilter('all');
                setStartDateFilter('');
                setEndDateFilter('');
              }}
              className="text-amber-400 hover:underline text-xs mr-auto font-bold cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>

        {/* 6. Content (Grid or Empty State) */}
        {loading ? (
          <AdminLoading message="جارٍ تحميل وتحديث بيانات الحملات الترويجية..." />
        ) : sortedCampaigns.length === 0 ? (
          <AdminEmptyState
            icon={Gift}
            title="لا توجد حملات ترويجية مطابقة"
            description={campaigns.length === 0 ? 'قم بإنشاء أول حملة ترويجية لتقديم خصومات وشحن مجاني لعملائك.' : 'لم نجد أي حملة تطابق خيارات البحث والفلترة المحددة.'}
            action={
              campaigns.length === 0 ? (
                <AdminButton icon={Plus} size="sm" onClick={handleOpenCreateModal}>
                  إنشاء حملة الآن
                </AdminButton>
              ) : (
                <AdminButton
                  variant="outline"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                >
                  إعادة ضبط الفلاتر
                </AdminButton>
              )
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedCampaigns.map(cmp => {
                const hasProducts = cmp.productIds && cmp.productIds.length > 0;
                const hasCategories = cmp.categoryIds && cmp.categoryIds.length > 0;

                return (
                  <div
                    key={cmp.id}
                    className="bg-slate-950/40 border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-4 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top Status & Type */}
                      <div className="flex items-center justify-between gap-2">
                        {getCampaignStatusBadge(cmp)}

                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                          {cmp.type === 'percentage' && <Percent className="w-3.5 h-3.5 text-amber-400" />}
                          {cmp.type === 'fixed' && <DollarSign className="w-3.5 h-3.5 text-emerald-400" />}
                          {cmp.type === 'free_shipping' && <Truck className="w-3.5 h-3.5 text-sky-400" />}
                          {cmp.type === 'percentage' ? 'خصم مئوي' : cmp.type === 'fixed' ? 'خصم ثابت' : 'شحن مجاني'}
                        </span>
                      </div>

                      {/* Title & Main Value */}
                      <div>
                        <h3 className="text-sm font-black text-white">{cmp.name}</h3>
                        <div className="text-base font-black text-amber-400 mt-1 font-mono">
                          {cmp.type === 'percentage' && `${cmp.value}% خصم`}
                          {cmp.type === 'fixed' && `${cmp.value.toLocaleString('ar-EG')} ج.م خصم`}
                          {cmp.type === 'free_shipping' && `شحن مجاني 🚚`}
                        </div>
                      </div>

                      {/* Dates */}
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 space-y-1 text-xs text-slate-300">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" /> البداية:
                          </span>
                          <span className="font-mono text-slate-200">{formatDisplayDate(cmp.startAt)}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-800/60 pt-1">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-rose-500" /> النهاية:
                          </span>
                          <span className="font-mono text-slate-200">{formatDisplayDate(cmp.endAt)}</span>
                        </div>
                      </div>

                      {/* Targeting details */}
                      <div className="space-y-1.5 text-xs">
                        <div className="text-slate-400 font-bold flex items-center gap-1">
                          <Target className="w-3.5 h-3.5 text-amber-500" /> النطاق المستهدف:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {!hasProducts && !hasCategories ? (
                            <span className="px-2 py-0.5 bg-slate-900 text-slate-300 rounded text-[11px] border border-slate-800">
                              جميع المنتجات والتصنيفات
                            </span>
                          ) : (
                            <>
                              {hasCategories && (
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[11px]">
                                  {cmp.categoryIds!.length} تصنيف
                                </span>
                              )}
                              {hasProducts && (
                                <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded text-[11px]">
                                  {cmp.productIds!.length} منتج
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Additional Constraints */}
                      {(cmp.minimumOrderValue || cmp.maximumDiscountAmount) && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          {cmp.minimumOrderValue ? (
                            <div>
                              <span className="text-slate-400 block">أدنى طلب:</span>
                              <span className="font-mono font-bold text-white">{cmp.minimumOrderValue} ج.م</span>
                            </div>
                          ) : null}
                          {cmp.maximumDiscountAmount ? (
                            <div>
                              <span className="text-slate-400 block">أقصى خصم:</span>
                              <span className="font-mono font-bold text-white">{cmp.maximumDiscountAmount} ج.م</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Actions bottom bar */}
                    <div className="border-t border-slate-800 pt-3 flex items-center justify-between gap-2 mt-2">
                      <button
                        onClick={() => handleToggleActive(cmp)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          cmp.active
                            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {cmp.active ? 'إيقاف 🔒' : 'تفعيل 🔓'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(cmp)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                          title="تعديل الحملة"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(cmp.id)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-lg border border-rose-500/20 transition-colors cursor-pointer"
                          title="حذف الحملة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 7. Pagination */}
            {sortedCampaigns.length > 0 && (
              <div className="pt-2">
                <AdminTablePagination
                  page={currentPage}
                  totalPages={totalPages}
                  total={sortedCampaigns.length}
                  limit={limit}
                  onPageChange={(p) => setCurrentPage(p)}
                  onLimitChange={(l) => {
                    setLimit(l);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </AdminCard>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                {editingCampaign ? 'تعديل الحملة الترويجية' : 'إضافة حملة ترويجية جديدة'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveCampaign} className="space-y-4">
              {/* Campaign Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  اسم الحملة الترويجية <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عروض الجمعة البيضاء 2026"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-colors"
                />
              </div>

              {/* Type & Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    نوع الخصم <span className="text-rose-500">*</span>
                  </label>
                  <CustomSelect
                    value={type}
                    onChange={val => setType(val as any)}
                    size="sm"
                    buttonClassName="w-full bg-slate-900 border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-amber-500"
                    menuClassName="bg-slate-900 border-slate-700"
                    options={[
                      { value: 'percentage', label: 'نسبة مئوية (%)' },
                      { value: 'fixed', label: 'مبلغ ثابت (ج.م)' },
                      { value: 'free_shipping', label: 'شحن مجاني (Free Shipping)' }
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    قيمة الخصم {type === 'percentage' ? '(%)' : type === 'fixed' ? '(ج.م)' : ''}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    disabled={type === 'free_shipping'}
                    value={type === 'free_shipping' ? 0 : (value !== undefined ? value : '')}
                    onKeyDown={(e) => handleNumericKeyDown(e, type === 'percentage' ? 'percentage' : 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, type === 'percentage' ? 'percentage' : 'non_negative_decimal')}
                    onChange={e => {
                      const clean = sanitizeNumericInput(e.target.value, type === 'percentage' ? 'percentage' : 'non_negative_decimal');
                      setValue(clean === '' ? '' : clean);
                    }}
                    placeholder={type === 'percentage' ? '10' : '50'}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 disabled:opacity-50 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Start & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    تاريخ ووقت البداية <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={e => setStartAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    تاريخ ووقت النهاية <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={e => setEndAt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Minimum order & Max Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    الحد الأدنى لقيمة الطلب (اختياري - ج.م)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={minimumOrderValue !== undefined ? minimumOrderValue : ''}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                    onChange={e => {
                      const clean = sanitizeNumericInput(e.target.value, 'non_negative_decimal');
                      setMinimumOrderValue(clean === '' ? '' : clean);
                    }}
                    placeholder="مثال: 500"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    الحد الأقصى لمبلغ الخصم (اختياري - ج.م)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={maximumDiscountAmount !== undefined ? maximumDiscountAmount : ''}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                    onChange={e => {
                      const clean = sanitizeNumericInput(e.target.value, 'non_negative_decimal');
                      setMaximumDiscountAmount(clean === '' ? '' : clean);
                    }}
                    placeholder="مثال: 200"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Target Categories */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  التصنيفات المستهدفة (إذا لم تحدد شيئاً تسري على الكل)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-slate-950 rounded-xl border border-slate-800">
                  {categories.length === 0 ? (
                    <span className="text-xs text-slate-500">لا توجد تصنيفات معرفة</span>
                  ) : (
                    categories.map(cat => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCategories(prev => prev.filter(c => c !== cat));
                            } else {
                              setSelectedCategories(prev => [...prev, cat]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Target Products */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  منتجات مخصصة (اختياري - تحديد منتجات معينة)
                </label>
                <div className="max-h-40 overflow-y-auto p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5">
                  {products.length === 0 ? (
                    <span className="text-xs text-slate-500">لا توجد منتجات</span>
                  ) : (
                    products.map(p => {
                      const isSelected = selectedProductIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none p-1 rounded hover:bg-slate-900"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedProductIds(prev => [...prev, p.id]);
                              } else {
                                setSelectedProductIds(prev => prev.filter(id => id !== p.id));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="truncate">{p.title}</span>
                          <span className="text-[10px] text-slate-500 font-mono ml-auto">({p.price} ج.م)</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="active-campaign-checkbox"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="active-campaign-checkbox" className="text-xs font-bold text-white cursor-pointer">
                  تفعيل الحملة فور الحفظ
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {editingCampaign ? 'تحديث الحملة' : 'إنشاء الحملة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">تأكيد حذف الحملة الترويجية</h3>
            <p className="text-xs text-slate-400">
              هل أنت أكتد من رغبتك في حذف هذه الحملة؟ لن تتمكن من استرجاع بياناتها بعد الحذف.
            </p>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleDeleteCampaign(deletingId)}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
