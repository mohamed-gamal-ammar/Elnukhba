import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, Save, Calendar, Eye, Image, 
  ToggleLeft, ToggleRight, ArrowRight, RefreshCw, CheckCircle, 
  AlertCircle, Link2, ArrowUp, ArrowDown, Sparkles, X, Check, Search, Filter, RotateCcw
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { Banner } from '../types.js';
import {
  handleNumericKeyDown,
  handleNumericPaste,
  sanitizeNumericInput,
  validateNumericValue
} from '../lib/numericValidation.js';
import ImageUploader from './ImageUploader.js';
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

interface AdminBannersProps {
  onRefreshAll?: () => void;
}

export default function AdminBanners({ onRefreshAll }: AdminBannersProps) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search, Filter & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Form states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formDesktopImage, setFormDesktopImage] = useState('');
  const [formMobileImage, setFormMobileImage] = useState('');
  const [formBtnText, setFormBtnText] = useState('تصفح العروض');
  const [formBtnLink, setFormBtnLink] = useState('products');
  const [formBadge, setFormBadge] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState('0');

  // Preview Mode state
  const [previewBanner, setPreviewBanner] = useState<Partial<Banner> | null>(null);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

  const loadBanners = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminBanners();
      setBanners(data);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل لافتات وبنرات الـ CMS من الخادم الرئيسي.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!formTitle.trim()) return setError('عنوان اللافتة الرئيسي مطلوب');
    if (!formDesktopImage.trim()) return setError('صورة البنر للكمبيوتر (Desktop) مطلوبة لسلامة التصميم');
    if (!formMobileImage.trim()) return setError('صورة البنر للموبايل (Mobile) مطلوبة لسلامة التصميم المستجيب');

    let sortOrderVal = 0;
    if (formSortOrder !== '' && formSortOrder !== undefined && formSortOrder !== null) {
      const sortRes = validateNumericValue(formSortOrder, 'non_negative_integer', {
        min: 0,
        fieldNameArabic: 'رقم ترتيب العرض'
      });
      if (!sortRes.valid) {
        return setError(sortRes.error || 'رقم ترتيب العرض غير صالح');
      }
      sortOrderVal = sortRes.value!;
    }

    const payload = {
      title: formTitle.trim(),
      subtitle: formSubtitle.trim(),
      desktopImage: formDesktopImage.trim(),
      mobileImage: formMobileImage.trim(),
      btnText: formBtnText.trim() || 'تصفح العروض',
      btnLink: formBtnLink.trim() || 'products',
      badge: formBadge.trim(),
      startDate: formStartDate || undefined,
      endDate: formEndDate || undefined,
      isActive: formIsActive,
      sortOrder: sortOrderVal
    };

    try {
      if (editingBanner) {
        await api.updateAdminBanner(editingBanner.id, payload);
        triggerSuccess(`تم تحديث اللافتة الترويجية "${formTitle}" بنجاح!`);
      } else {
        await api.createAdminBanner(payload);
        triggerSuccess(`تم تدوين ونشر البنر الترويجي الجديد "${formTitle}" بنجاح!`);
      }
      setShowFormModal(false);
      loadBanners();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشلت عملية توثيق البنر'));
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف لافتة العرض الترويجي (${title}) نهائياً؟`)) return;
    try {
      await api.deleteAdminBanner(id);
      triggerSuccess(`تم إزالة وحذف البنر بنجاح.`);
      loadBanners();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حذف البنر الترويجي'));
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      await api.updateAdminBanner(banner.id, { isActive: !banner.isActive });
      triggerSuccess('تم تعديل حالة تفعيل البنر بنجاح.');
      loadBanners();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشلت محاولة تغيير نشاط البنر'));
    }
  };

  const openAddModal = () => {
    setEditingBanner(null);
    setFormTitle('');
    setFormSubtitle('');
    setFormDesktopImage('');
    setFormMobileImage('');
    setFormBtnText('تصفح العروض');
    setFormBtnLink('products');
    setFormBadge('');
    setFormStartDate('');
    setFormEndDate('');
    setFormIsActive(true);
    setFormSortOrder('0');
    setPreviewBanner(null);
    setShowFormModal(true);
  };

  const openEditModal = (banner: Banner) => {
    setEditingBanner(banner);
    setFormTitle(banner.title);
    setFormSubtitle(banner.subtitle || '');
    setFormDesktopImage(banner.desktopImage);
    setFormMobileImage(banner.mobileImage);
    setFormBtnText(banner.btnText || 'تصفح العروض');
    setFormBtnLink(banner.btnLink || 'products');
    setFormBadge(banner.badge || '');
    setFormStartDate(banner.startDate || '');
    setFormEndDate(banner.endDate || '');
    setFormIsActive(banner.isActive);
    setFormSortOrder(String(banner.sortOrder || 0));
    setPreviewBanner(null);
    setShowFormModal(true);
  };

  const handleOpenPreview = (b: Partial<Banner>) => {
    setPreviewBanner(b);
  };

  const now = new Date().toISOString().split('T')[0];

  // Stats calculation
  const activeCount = banners.filter(b => b.isActive && (!b.endDate || now <= b.endDate) && (!b.startDate || now >= b.startDate)).length;
  const scheduledCount = banners.filter(b => b.isActive && b.startDate && now < b.startDate).length;
  const expiredCount = banners.filter(b => b.endDate && now > b.endDate).length;
  const inactiveCount = banners.filter(b => !b.isActive).length;

  // Filtered & Paginated banners
  const filteredBanners = useMemo(() => {
    return banners.filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.subtitle && b.subtitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (b.badge && b.badge.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchesStatus = true;
      const isExpired = b.endDate && now > b.endDate;
      const isFuture = b.startDate && now < b.startDate;
      const isActiveNow = b.isActive && !isExpired && !isFuture;

      if (filterStatus === 'active') matchesStatus = isActiveNow;
      else if (filterStatus === 'scheduled') matchesStatus = isFuture;
      else if (filterStatus === 'expired') matchesStatus = isExpired;
      else if (filterStatus === 'inactive') matchesStatus = !b.isActive;

      return matchesSearch && matchesStatus;
    });
  }, [banners, searchTerm, filterStatus, now]);

  const paginatedBanners = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredBanners.slice(start, start + limit);
  }, [filteredBanners, currentPage, limit]);

  const totalPages = Math.ceil(filteredBanners.length / limit) || 1;

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl" id="admin-banners-cms-panel">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة لافتات السلايدر الترويجي (Hero Slider CMS)"
        description="إضافة وتعديل وجدولة بنرات الشاشة الرئيسية للمتجر بالتفصيل الكامل"
        icon={Image}
        badge={<AdminBadge variant="amber">{banners.length} بنر</AdminBadge>}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadBanners}
              disabled={loading}
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <AdminButton icon={Plus} onClick={openAddModal}>
              إضافة بنر جديد
            </AdminButton>
          </div>
        }
      />

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
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
          title="إجمالي البنرات"
          value={banners.length}
          icon={Image}
          subtitle="جميع لافتات السلايدر المسجلة"
        />
        <AdminStatCard
          title="نشطة حالياً"
          value={activeCount}
          icon={CheckCircle}
          trend={{ value: `${banners.length ? Math.round((activeCount / banners.length) * 100) : 0}%`, isPositive: true, label: 'تظهر للزوار' }}
        />
        <AdminStatCard
          title="مجدولة مستقبلاً"
          value={scheduledCount}
          icon={Calendar}
          subtitle="تبدأ تلقائياً في موعدها"
        />
        <AdminStatCard
          title="منتهية أو معطلة"
          value={expiredCount + inactiveCount}
          icon={AlertCircle}
          trend={{ value: `${expiredCount} منتهي / ${inactiveCount} معطل`, isPositive: false, label: 'خارج العرض' }}
        />
      </div>

      {/* 3, 4, 5. Main Card with Search, Filter & Content */}
      <AdminCard className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <AdminSearchInput
            placeholder="البحث بالعنوان، الوصف، أو الشعار..."
            value={searchTerm}
            onChange={(val) => setSearchTerm(val)}
            className="w-full md:w-80"
          />

          <div className="flex items-center gap-2 w-full md:w-auto justify-end min-w-[170px]">
            <span className="text-slate-600 dark:text-slate-400 text-xs font-bold whitespace-nowrap shrink-0">الحالة:</span>
            <CustomSelect
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              size="sm"
              buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[190px]"
              options={[
                { value: 'all', label: `كل الحالات (${banners.length})` },
                { value: 'active', label: 'نشط الآن على الرئيسية' },
                { value: 'scheduled', label: 'مجدول مستقبلاً' },
                { value: 'expired', label: 'منتهي الصلاحية' },
                { value: 'inactive', label: 'معطل مؤقتاً' }
              ]}
            />
          </div>
        </div>

        {/* 6. Content (Grid or Empty State) */}
        {loading ? (
          <AdminLoading message="جارٍ تحميل لافتات السلايدر..." />
        ) : filteredBanners.length === 0 ? (
          <AdminEmptyState
            icon={Image}
            title="لا توجد بنرات ترويجية تطابق البحث"
            description="جرب البحث بكلمات مختلفة أو تغيير فلتر الحالة."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedBanners.map((b) => {
                const isScheduled = b.startDate || b.endDate;
                const isExpired = b.endDate && now > b.endDate;
                const isFuture = b.startDate && now < b.startDate;

                return (
                  <div 
                    key={b.id} 
                    className={`bg-white dark:bg-slate-900/60 rounded-xl border p-5 relative overflow-hidden flex flex-col justify-between transition-all hover:border-slate-400 dark:hover:border-slate-700 ${b.isActive && !isExpired && !isFuture ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800/60 opacity-70'}`}
                  >
                    {/* Badge top corner */}
                    <div className="absolute top-4 left-4 flex gap-1.5">
                      <span className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded text-[9px]">
                        الترتيب: {b.sortOrder || 0}
                      </span>
                      
                      {b.isActive ? (
                        isExpired ? (
                          <AdminBadge variant="danger">منتهي الصلاحية ⏰</AdminBadge>
                        ) : isFuture ? (
                          <AdminBadge variant="info">مجدول مستقبلاً 📅</AdminBadge>
                        ) : (
                          <AdminBadge variant="success">نشط الآن</AdminBadge>
                        )
                      ) : (
                        <AdminBadge variant="neutral">معطل مؤقتاً</AdminBadge>
                      )}
                    </div>

                    {/* Banner identity */}
                    <div className="space-y-2 pt-4">
                      {b.badge && (
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black">{b.badge}</span>
                      )}
                      <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">{b.title}</h4>
                      {b.subtitle && <p className="text-xs text-slate-600 dark:text-slate-400 font-medium line-clamp-2 leading-relaxed">{b.subtitle}</p>}
                    </div>

                    {/* Banner Thumbnail Previews */}
                    <div className="grid grid-cols-2 gap-3.5 my-4 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="text-center">
                        <span className="text-[9px] text-slate-600 dark:text-slate-400 font-bold block mb-1">صورة الكمبيوتر (Desktop)</span>
                        <img 
                          src={b.desktopImage} 
                          alt="Desktop Banner" 
                          className="w-full h-16 object-cover rounded border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-[9px] text-slate-600 dark:text-slate-400 font-bold block mb-1">صورة الموبايل (Mobile)</span>
                        <img 
                          src={b.mobileImage} 
                          alt="Mobile Banner" 
                          className="w-full h-16 object-cover rounded border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    </div>

                    {/* Action details */}
                    <div className="flex flex-col gap-2 border-t border-slate-200 dark:border-slate-800/50 pt-3">
                      <div className="flex justify-between items-center text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
                        <span>الرابط: <code className="text-amber-600 dark:text-amber-400 font-mono bg-slate-100 dark:bg-slate-950 px-1 py-0.5 rounded">{b.btnLink}</code></span>
                        <span>الزر: <strong className="text-slate-800 dark:text-slate-200">{b.btnText}</strong></span>
                      </div>

                      {isScheduled && (
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>الصلاحية: </span>
                          {b.startDate && <span>من {b.startDate}</span>}
                          {b.endDate && <span> إلى {b.endDate}</span>}
                        </div>
                      )}

                      {/* Operational controls */}
                      <div className="flex gap-2 justify-end pt-2 border-t border-slate-200 dark:border-slate-800 mt-1">
                        <button
                          onClick={() => handleOpenPreview(b)}
                          className="py-1 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] rounded transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          معاينة
                        </button>
                        <button
                          onClick={() => handleToggleActive(b)}
                          className="py-1 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] rounded transition-colors cursor-pointer"
                        >
                          {b.isActive ? 'تعطيل 🔒' : 'تفعيل 🔓'}
                        </button>
                        <button
                          onClick={() => openEditModal(b)}
                          className="py-1 px-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold text-[11px] rounded transition-colors cursor-pointer"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => handleDelete(b.id, b.title)}
                          className="py-1 px-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white font-bold text-[11px] rounded transition-colors cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 7. Pagination */}
            {filteredBanners.length > 0 && (
              <div className="pt-2">
                <AdminTablePagination
                  page={currentPage}
                  totalPages={totalPages}
                  total={filteredBanners.length}
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

      {/* ========================================== */}
      {/* LIVE BANNER PREVIEW BLOCK (Live rendering) */}
      {/* ========================================== */}
      {previewBanner && (
        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-amber-500/20 rounded-xl p-5 mb-6 animate-in slide-in-from-bottom-2 duration-300 shadow-sm">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800 mb-4">
            <span className="text-xs font-black text-amber-600 dark:text-amber-500 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-500" />
              معاينة فورية تفاعلية للبنر قبل نشره للعملاء
            </span>
            <button 
              onClick={() => setPreviewBanner(null)} 
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline cursor-pointer"
            >
              إغلاق المعاينة ×
            </button>
          </div>

          {/* Desktop Slider View Simulation */}
          <div className="relative w-full h-44 md:h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow bg-slate-900">
            <img 
              src={previewBanner.desktopImage} 
              alt="Simulated Slider background" 
              className="absolute inset-0 w-full h-full object-cover opacity-80"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/60 to-transparent flex items-center">
              <div className="p-6 md:p-8 text-right max-w-md space-y-2 md:space-y-3">
                {previewBanner.badge && (
                  <span className="inline-block px-2.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black tracking-wider uppercase">
                    {previewBanner.badge}
                  </span>
                )}
                <h1 className="text-lg md:text-xl font-black text-white leading-tight">{previewBanner.title}</h1>
                <p className="text-[10px] md:text-xs text-slate-300 leading-normal line-clamp-2">{previewBanner.subtitle}</p>
                
                <button className="py-2 px-4 bg-amber-500 text-slate-950 font-black text-[10px] md:text-xs rounded-lg transition-colors flex items-center gap-1 mt-2 cursor-default">
                  {previewBanner.btnText || 'تصفح العروض'}
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 rotate-180" />
                </button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center mt-2">
            تمت محاكاة العرض كما سيظهر للعميل في السلايدر الرئيسي لمتجر النخبة.
          </p>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CREATE OR EDIT BANNER FORM          */}
      {/* ========================================== */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-right shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 mb-5">
              <Image className="w-5 h-5 text-amber-500" />
              {editingBanner ? `تعديل لافتة السلايدر: ${formTitle}` : 'نشر وتصميم لافتة سلايدر جديدة'}
            </h4>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Badge & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">عنوان اللافتة الرئيسي باللغة العربية <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="مثال: خصومات كبرى على ثلاجات ومبردات إل جي"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">شعار الزاوية الفرعي (Badge)</label>
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="مثال: عرض محدود"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Subtitle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">الوصف الفرعي الداعم للافتة الترويجية</label>
                <textarea
                  rows={2}
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="مثال: احصل على ثلاجة أحلامك بضمان 5 سنوات مع خدمات شحن مجاني وفك وتركيب فوري ومجاني لجميع المحافظات."
                  className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Desktop and Mobile Images Uploaders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <ImageUploader
                    label="صورة بنر سطح المكتب (أبعاد عريضة 1920x600) *"
                    value={formDesktopImage}
                    onChange={(url) => setFormDesktopImage(url)}
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <ImageUploader
                    label="صورة بنر الهواتف الذكية (أبعاد طولية 800x600) *"
                    value={formMobileImage}
                    onChange={(url) => setFormMobileImage(url)}
                  />
                </div>
              </div>

              {/* Scheduling dates & Order */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">تاريخ بدء النشر والظهور</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-center font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">تاريخ انتهاء النشر (حذف تلقائي)</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-center font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">رقم ترتيب العرض (Sort Index)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formSortOrder}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_integer')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_integer')}
                    onChange={(e) => setFormSortOrder(sanitizeNumericInput(e.target.value, 'non_negative_integer'))}
                    placeholder="مثال: 0 (للظهور أولاً)"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-center font-mono"
                  />
                </div>
              </div>

              {/* CTA configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">نص زر الدعوة للإجراء (CTA Button Text)</label>
                  <input
                    type="text"
                    value={formBtnText}
                    onChange={(e) => setFormBtnText(e.target.value)}
                    placeholder="مثال: احجز الآن"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">رابط توجيه الزر (CTA Button Link)</label>
                  <input
                    type="text"
                    value={formBtnLink}
                    onChange={(e) => setFormBtnLink(e.target.value)}
                    placeholder="مثال: products?category=Fridges (أو اكتب products)"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-left font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Status active and live preview trigger */}
              <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">حالة نشاط البنر الترويجي:</span>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(prev => !prev)}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    {formIsActive ? <ToggleRight className="w-10 h-10 text-amber-500" /> : <ToggleLeft className="w-10 h-10 text-slate-400 dark:text-slate-600" />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenPreview({
                    title: formTitle,
                    subtitle: formSubtitle,
                    badge: formBadge,
                    btnText: formBtnText,
                    desktopImage: formDesktopImage || 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&q=80&w=1200'
                  })}
                  className="text-xs text-amber-600 dark:text-amber-500 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  محاكاة ومعاينة البنر قبل الحفظ
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-colors cursor-pointer flex justify-center items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  توثيق ونشر البنر للجمهور
                </button>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="py-2.5 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء التراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
