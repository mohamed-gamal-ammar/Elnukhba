import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Search, Edit2, Trash2, Save, Download, Upload, 
  ToggleLeft, ToggleRight, AlertCircle, RefreshCw, CheckCircle, 
  ChevronDown, ChevronUp, DollarSign, Clock, Check, HelpCircle, Eye, EyeOff, X
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { ShippingProvince } from '../types.js';
import {
  handleNumericKeyDown,
  handleNumericPaste,
  sanitizeNumericInput,
  validateNumericValue
} from '../lib/numericValidation.js';
import { CustomSelect } from './CustomSelect.js';
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminBadge,
  AdminEmptyState,
  AdminLoading,
  AdminSearchInput,
  AdminButton
} from './AdminUIComponents.js';
import { AdminTablePagination } from './AdminTableComponents.js';

interface AdminShippingProps {
  onRefreshAll?: () => void;
}

export default function AdminShipping({ onRefreshAll }: AdminShippingProps) {
  const [provinces, setProvinces] = useState<ShippingProvince[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [codFilter, setCodFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [sortField, setSortField] = useState<keyof ShippingProvince>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // Bulk Edit selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkEstimatedDays, setBulkEstimatedDays] = useState('');
  const [bulkIsActive, setBulkIsActive] = useState<string>('keep');
  const [bulkIsCodAvailable, setBulkIsCodAvailable] = useState<string>('keep');
  const [bulkFreeShippingThreshold, setBulkFreeShippingThreshold] = useState('');

  // Add/Edit Form Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProvince, setEditingProvince] = useState<ShippingProvince | null>(null);
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formEstimatedDays, setFormEstimatedDays] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsCodAvailable, setFormIsCodAvailable] = useState(true);
  const [formFreeShippingThreshold, setFormFreeShippingThreshold] = useState('');

  // Load Provinces
  const loadProvinces = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminShippingProvinces();
      setProvinces(data);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل المحافظات وأسعار الشحن من الخادم.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProvinces();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Sorting Handler
  const handleSort = (field: keyof ShippingProvince) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Form submission (Create or Update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!formName.trim()) return setError('اسم المحافظة بالعربية مطلوب');
    if (!formNameEn.trim()) return setError('اسم المحافظة بالإنجليزية مطلوب');

    const priceRes = validateNumericValue(formPrice, 'non_negative_decimal', {
      required: true,
      min: 0,
      fieldNameArabic: 'سعر وتكلفة الشحن'
    });
    if (!priceRes.valid) {
      return setError(priceRes.error || 'سعر الشحن غير صالح');
    }

    if (!formEstimatedDays.trim()) return setError('زمن التوصيل التقريبي مطلوب (مثال: 1-2 أيام)');

    let threshold: number | undefined = undefined;
    if (formFreeShippingThreshold !== '' && formFreeShippingThreshold !== undefined && formFreeShippingThreshold !== null) {
      const threshRes = validateNumericValue(formFreeShippingThreshold, 'non_negative_decimal', {
        min: 0,
        fieldNameArabic: 'حد الشراء للشحن المجاني'
      });
      if (!threshRes.valid) {
        return setError(threshRes.error || 'حد الشحن المجاني غير صالح');
      }
      threshold = threshRes.value;
    }

    const payload = {
      name: formName.trim(),
      nameEn: formNameEn.trim(),
      price: priceRes.value!,
      estimatedDays: formEstimatedDays.trim(),
      isActive: formIsActive,
      isCodAvailable: formIsCodAvailable,
      freeShippingThreshold: threshold
    };

    try {
      if (editingProvince) {
        await api.updateAdminShippingProvince(editingProvince.id, payload);
        triggerSuccess(`تم تحديث بيانات المحافظة "${formName}" بنجاح!`);
      } else {
        // Prevent duplicate names
        const duplicate = provinces.find(p => p.name.toLowerCase() === payload.name.toLowerCase());
        if (duplicate) {
          return setError('هذه المحافظة مضافة بالفعل بقاعدة البيانات');
        }
        await api.createAdminShippingProvince(payload);
        triggerSuccess(`تم إضافة المحافظة الجديدة "${formName}" بنجاح!`);
      }
      setShowFormModal(false);
      loadProvinces();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشلت عملية حفظ التعديلات'));
    }
  };

  // Delete Handler
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف محافظة (${name}) نهائياً؟`)) return;
    try {
      await api.deleteAdminShippingProvince(id);
      triggerSuccess(`تم حذف محافظة ${name} بنجاح.`);
      loadProvinces();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حذف المحافظة'));
    }
  };

  // Toggle quick status
  const handleToggleStatus = async (prov: ShippingProvince, type: 'active' | 'cod') => {
    const payload: Partial<ShippingProvince> = {};
    if (type === 'active') {
      payload.isActive = !prov.isActive;
    } else {
      payload.isCodAvailable = !prov.isCodAvailable;
    }

    try {
      await api.updateAdminShippingProvince(prov.id, payload);
      triggerSuccess(`تم تحديث الحالة بنجاح.`);
      loadProvinces();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تعديل الحالة السريعة.'));
    }
  };

  // Bulk Edit action
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedIds.length === 0) {
      setError('يرجى تحديد محافظة واحدة على الأقل للتعديل الجماعي');
      return;
    }

    const payload: any = {};
    if (bulkPrice !== '') {
      const bPriceRes = validateNumericValue(bulkPrice, 'non_negative_decimal', {
        fieldNameArabic: 'سعر الشحن الموحد'
      });
      if (!bPriceRes.valid) {
        setError(bPriceRes.error || 'سعر الشحن الموحد غير صالح');
        return;
      }
      payload.price = bPriceRes.value;
    }
    if (bulkEstimatedDays !== '') payload.estimatedDays = bulkEstimatedDays.trim();
    if (bulkFreeShippingThreshold !== '') {
      payload.freeShippingThreshold = bulkFreeShippingThreshold === 'clear' ? null : Number(bulkFreeShippingThreshold);
    }
    if (bulkIsActive !== 'keep') payload.isActive = bulkIsActive === 'true';
    if (bulkIsCodAvailable !== 'keep') payload.isCodAvailable = bulkIsCodAvailable === 'true';

    setLoading(true);
    try {
      let count = 0;
      for (const id of selectedIds) {
        await api.updateAdminShippingProvince(id, payload);
        count++;
      }
      triggerSuccess(`تم تعديل عدد ${count} محافظة بنجاح بالجملة!`);
      setSelectedIds([]);
      setShowBulkModal(false);
      setBulkPrice('');
      setBulkEstimatedDays('');
      setBulkFreeShippingThreshold('');
      setBulkIsActive('keep');
      setBulkIsCodAvailable('keep');
      loadProvinces();
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تعديل بعض المحافظات أثناء التحديث الجماعي'));
    } finally {
      setLoading(false);
    }
  };

  // Export as JSON
  const handleExport = () => {
    try {
      const dataStr = JSON.stringify(provinces, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      const exportFileDefaultName = 'shipping_provinces_backup.json';

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      triggerSuccess('تم تصدير ملف المحافظات وأسعار الشحن بنجاح 📥');
    } catch (e) {
      setError(getFriendlyErrorMessage(e, 'فشلت عملية التصدير'));
    }
  };

  // Import JSON
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!Array.isArray(parsed)) {
            setError('ملف الاستيراد غير صالح، يجب أن يحتوي على مصفوفة من المحافظات');
            return;
          }

          if (!window.confirm(`أنت على وشك استيراد ${parsed.length} محافظة. سيتم الكتابة فوق المحافظات الموجودة بنفس الاسم أو إضافتها. هل ترغب بالاستمرار؟`)) {
            return;
          }

          setLoading(true);
          for (const item of parsed) {
            if (!item.name || typeof item.price !== 'number') continue;
            // Check if name already exists
            const existing = provinces.find(p => p.name === item.name);
            if (existing) {
              await api.updateAdminShippingProvince(existing.id, {
                nameEn: item.nameEn || existing.nameEn,
                price: item.price,
                estimatedDays: item.estimatedDays || existing.estimatedDays,
                isActive: item.isActive !== undefined ? item.isActive : existing.isActive,
                isCodAvailable: item.isCodAvailable !== undefined ? item.isCodAvailable : existing.isCodAvailable,
                freeShippingThreshold: item.freeShippingThreshold !== undefined ? item.freeShippingThreshold : existing.freeShippingThreshold
              });
            } else {
              await api.createAdminShippingProvince({
                name: item.name,
                nameEn: item.nameEn || item.name,
                price: item.price,
                estimatedDays: item.estimatedDays || '2-3 أيام',
                isActive: item.isActive !== undefined ? item.isActive : true,
                isCodAvailable: item.isCodAvailable !== undefined ? item.isCodAvailable : true,
                freeShippingThreshold: item.freeShippingThreshold
              });
            }
          }
          triggerSuccess('تم استيراد ودمج ملف المحافظات بنجاح 🎉');
          loadProvinces();
          if (onRefreshAll) onRefreshAll();
        } catch (e) {
          setError(getFriendlyErrorMessage(e, 'فشل تحليل وقراءة ملف الاستيراد، تأكد من كونه بصيغة JSON سليمة'));
        } finally {
          setLoading(false);
        }
      };
    }
  };

  // Open Add Form
  const openAddModal = () => {
    setEditingProvince(null);
    setFormName('');
    setFormNameEn('');
    setFormPrice('50');
    setFormEstimatedDays('1-3 أيام');
    setFormIsActive(true);
    setFormIsCodAvailable(true);
    setFormFreeShippingThreshold('');
    setShowFormModal(true);
  };

  // Open Edit Form
  const openEditModal = (prov: ShippingProvince) => {
    setEditingProvince(prov);
    setFormName(prov.name);
    setFormNameEn(prov.nameEn);
    setFormPrice(String(prov.price));
    setFormEstimatedDays(prov.estimatedDays);
    setFormIsActive(prov.isActive);
    setFormIsCodAvailable(prov.isCodAvailable);
    setFormFreeShippingThreshold(prov.freeShippingThreshold !== undefined ? String(prov.freeShippingThreshold) : '');
    setShowFormModal(true);
  };

  // Multi-select toggle
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProvinces.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProvinces.map(p => p.id));
    }
  };

  // Stats calculation
  const totalCount = provinces.length;
  const activeCount = provinces.filter(p => p.isActive).length;
  const codEnabledCount = provinces.filter(p => p.isCodAvailable).length;
  const freeShippingThresholdCount = provinces.filter(p => typeof p.freeShippingThreshold === 'number').length;
  const averagePrice = totalCount > 0 
    ? Math.round(provinces.reduce((sum, p) => sum + p.price, 0) / totalCount) 
    : 0;

  // Filter & Search Logic
  const filteredProvinces = provinces.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.nameEn.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && p.isActive) || 
      (statusFilter === 'inactive' && !p.isActive);

    const matchesCod = 
      codFilter === 'all' || 
      (codFilter === 'available' && p.isCodAvailable) || 
      (codFilter === 'unavailable' && !p.isCodAvailable);

    return matchesSearch && matchesStatus && matchesCod;
  });

  // Reset pagination on filter/search/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, codFilter, sortField, sortDirection]);

  // Sort Logic
  const sortedProvinces = [...filteredProvinces].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (aVal === undefined) return 1;
    if (bVal === undefined) return -1;

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal, 'ar') 
        : bVal.localeCompare(aVal, 'ar');
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
      return sortDirection === 'asc' 
        ? (aVal === bVal ? 0 : aVal ? -1 : 1) 
        : (aVal === bVal ? 0 : aVal ? 1 : -1);
    }

    return 0;
  });

  const totalPages = Math.ceil(sortedProvinces.length / limit) || 1;
  const paginatedProvinces = sortedProvinces.slice((currentPage - 1) * limit, currentPage * limit);

  return (
    <div className="space-y-6 font-sans text-right dir-rtl text-slate-900 dark:text-slate-100" id="admin-shipping-panel" dir="rtl">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة تسعير ومناطق شحن المحافظات"
        description="تحديد أسعار الشحن ومواعيد التسليم وخيارات الدفع عند الاستلام وحساب الشحن المجاني"
        icon={Truck}
        badge={<AdminBadge variant="amber">{totalCount} محافظة</AdminBadge>}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <AdminButton
              variant="primary"
              size="md"
              icon={Plus}
              onClick={openAddModal}
            >
              إضافة محافظة جديدة
            </AdminButton>
            
            <AdminButton
              variant="outline"
              size="md"
              icon={Download}
              onClick={handleExport}
              title="تصدير قائمة الشحن كملف JSON"
            >
              تصدير JSON
            </AdminButton>

            <label className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer relative shadow-xs">
              <Upload className="w-4 h-4 text-amber-500" />
              <span>استيراد JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </label>

            <button
              type="button"
              onClick={loadProvinces}
              disabled={loading}
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess('')} className="cursor-pointer text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-400 font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="cursor-pointer text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminStatCard
          title="إجمالي المحافظات"
          value={totalCount}
          icon={Truck}
          subtitle="تغطية جمهورية مصر"
        />
        <AdminStatCard
          title="الشحن نشط حالياً"
          value={activeCount}
          icon={CheckCircle}
          trend={{
            value: `${Math.round((activeCount / (totalCount || 1)) * 100)}%`,
            isPositive: activeCount > 0,
            label: 'من المحافظات'
          }}
        />
        <AdminStatCard
          title="متوسط تكلفة الشحن"
          value={`${averagePrice} ج.م`}
          icon={DollarSign}
          subtitle="لكافة مناطق التوصيل"
        />
        <AdminStatCard
          title="الدفع عند الاستلام (COD)"
          value={codEnabledCount}
          icon={Clock}
          subtitle="محافظة تدعم الكاش"
        />
        <AdminStatCard
          title="عروض الشحن المجاني"
          value={freeShippingThresholdCount}
          icon={Check}
          subtitle="لها حد أدنى للشحن المجاني"
        />
      </div>

      {/* 3, 4, 5, 6. Main Card with Search, Filter & Content */}
      <AdminCard className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <div className="md:col-span-1">
            <AdminSearchInput
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="ابحث باسم المحافظة بالعربية أو الإنجليزية..."
            />
          </div>

          {/* Status Filters */}
          <div>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              size="sm"
              buttonClassName="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl py-2 px-3 focus:border-amber-500 shadow-xs"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              options={[
                { value: 'all', label: 'كل حالات التغطية' },
                { value: 'active', label: 'نشط ومتاح للتوصيل' },
                { value: 'inactive', label: 'معطل مؤقتاً' }
              ]}
            />
          </div>

          <div>
            <CustomSelect
              value={codFilter}
              onChange={(val) => setCodFilter(val as any)}
              size="sm"
              buttonClassName="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl py-2 px-3 focus:border-amber-500 shadow-xs"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              options={[
                { value: 'all', label: 'كل خيارات الدفع عند الاستلام' },
                { value: 'available', label: 'الدفع عند الاستلام متاح' },
                { value: 'unavailable', label: 'الدفع المسبق فقط (غير متاح)' }
              ]}
            />
          </div>
        </div>

        {/* Bulk actions and selections header */}
        {selectedIds.length > 0 && (
          <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex justify-between items-center text-xs shadow-xs">
            <span className="font-bold text-amber-800 dark:text-amber-400">لقد حددت عدد {selectedIds.length} محافظة للتعديل الجماعي</span>
            <div className="flex gap-2">
              <AdminButton
                variant="primary"
                size="sm"
                icon={Edit2}
                onClick={() => setShowBulkModal(true)}
              >
                تحرير جماعي
              </AdminButton>
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds([])}
              >
                إلغاء التحديد
              </AdminButton>
            </div>
          </div>
        )}

        {/* Provinces Table */}
        {loading && provinces.length === 0 ? (
          <AdminLoading message="جارٍ جلب إحصاءات وأسعار شحن المحافظات..." />
        ) : sortedProvinces.length === 0 ? (
          <AdminEmptyState
            icon={Truck}
            title="لا توجد محافظات تطابق معايير البحث"
            description="لم يتم العثور على أي نتائج تطابق خيارات التصفية الحالية."
            action={
              (searchQuery || statusFilter !== 'all' || codFilter !== 'all') ? (
                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setCodFilter('all');
                  }}
                >
                  إعادة ضبط البحث والفلاتر
                </AdminButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px] select-none bg-slate-50/50 dark:bg-transparent">
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === filteredProvinces.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 dark:border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSort('name')}>
                      اسم المحافظة بالعربية {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline mr-0.5" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-0.5" />)}
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors" onClick={() => handleSort('nameEn')}>
                      الاسم بالإنجليزي {sortField === 'nameEn' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline mr-0.5" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-0.5" />)}
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-center" onClick={() => handleSort('price')}>
                      سعر الشحن {sortField === 'price' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline mr-0.5" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-0.5" />)}
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-center" onClick={() => handleSort('estimatedDays')}>
                      زمن التوصيل {sortField === 'estimatedDays' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline mr-0.5" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-0.5" />)}
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-center" onClick={() => handleSort('freeShippingThreshold')}>
                      حد الشحن المجاني {sortField === 'freeShippingThreshold' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline mr-0.5" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-0.5" />)}
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-center" onClick={() => handleSort('isActive')}>
                      حالة الشحن {sortField === 'isActive' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline mr-0.5" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-0.5" />)}
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors text-center" onClick={() => handleSort('isCodAvailable')}>
                      الدفع عند الاستلام {sortField === 'isCodAvailable' && (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5 inline mr-0.5" /> : <ChevronDown className="w-3.5 h-3.5 inline mr-0.5" />)}
                    </th>
                    <th className="py-3 px-3 text-center w-28">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                  {paginatedProvinces.map(prov => (
                    <tr key={prov.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-950/20 transition-colors ${selectedIds.includes(prov.id) ? 'bg-amber-50/60 dark:bg-amber-500/[0.03]' : ''}`}>
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(prov.id)}
                          onChange={() => toggleSelect(prov.id)}
                          className="rounded border-slate-300 dark:border-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{prov.name}</td>
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400" dir="ltr">{prov.nameEn}</td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-black text-amber-600 dark:text-amber-400">{prov.price} ج.م</span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-700 dark:text-slate-300 font-medium">{prov.estimatedDays}</td>
                      <td className="py-3 px-3 text-center text-sky-600 dark:text-sky-400 font-semibold font-mono">
                        {prov.freeShippingThreshold !== undefined ? (
                          <span>{prov.freeShippingThreshold} ج.م</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 text-[10px] font-sans">غير محدد</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(prov, 'active')}
                          className="focus:outline-none cursor-pointer"
                          title={prov.isActive ? 'تعطيل الشحن مؤقتاً' : 'تفعيل الشحن إلى المحافظة'}
                        >
                          {prov.isActive ? (
                            <AdminBadge variant="success">مفعلة ومتاحة</AdminBadge>
                          ) : (
                            <AdminBadge variant="neutral">معطل مؤقتاً</AdminBadge>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(prov, 'cod')}
                          className="focus:outline-none cursor-pointer"
                          title={prov.isCodAvailable ? 'إيقاف الدفع عند الاستلام' : 'تفعيل الدفع عند الاستلام'}
                        >
                          {prov.isCodAvailable ? (
                            <AdminBadge variant="amber">متاح (COD)</AdminBadge>
                          ) : (
                            <AdminBadge variant="danger">الدفع المسبق فقط</AdminBadge>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button
                            onClick={() => openEditModal(prov)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                            title="تعديل تفاصيل المحافظة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(prov.id, prov.name)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer shadow-xs"
                            title="حذف المحافظة نهائياً"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 7. Pagination */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <AdminTablePagination
                page={currentPage}
                totalPages={totalPages}
                total={sortedProvinces.length}
                limit={limit}
                onPageChange={(p) => setCurrentPage(p)}
                onLimitChange={(l) => {
                  setLimit(l);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </AdminCard>

      {/* ========================================== */}
      {/* MODAL: CREATE OR EDIT PROVINCE             */}
      {/* ========================================== */}
      {showFormModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 text-right shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 mb-5">
              <Truck className="w-5 h-5 text-amber-500" />
              {editingProvince ? `تعديل محافظة: ${formName}` : 'إضافة محافظة وتكلفة شحن جديدة'}
            </h4>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">اسم المحافظة بالعربية <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: الغربية"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">اسم المحافظة بالإنجليزية <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formNameEn}
                    onChange={(e) => setFormNameEn(e.target.value)}
                    placeholder="مثال: Gharbia"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono text-left placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">سعر وتكلفة شحن الأجهزة (جنيه) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={formPrice}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                    onChange={(e) => setFormPrice(sanitizeNumericInput(e.target.value, 'non_negative_decimal'))}
                    placeholder="مثال: 120"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">زمن التوصيل التقريبي المتوقع <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formEstimatedDays}
                    onChange={(e) => setFormEstimatedDays(e.target.value)}
                    placeholder="مثال: 1-2 أيام عمل"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">حد الشراء للشحن المجاني (اختياري - جنيه مصري)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formFreeShippingThreshold}
                  onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                  onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                  onChange={(e) => setFormFreeShippingThreshold(sanitizeNumericInput(e.target.value, 'non_negative_decimal'))}
                  placeholder="مثال: 5000 (اتركه فارغاً لتعطيل ميزة الشحن المجاني)"
                  className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">إذا تجاوزت السلة الإجمالية هذه القيمة، تصبح تكلفة التوصيل 0 جنيه تلقائياً.</p>
              </div>

              {/* Status toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-lg border border-slate-200 dark:border-slate-850">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">تفعيل الشحن والتوصيل:</span>
                  <button
                    type="button"
                    onClick={() => setFormIsActive(prev => !prev)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    {formIsActive ? <ToggleRight className="w-10 h-10 text-amber-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-650" />}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">الدفع عند الاستلام (COD):</span>
                  <button
                    type="button"
                    onClick={() => setFormIsCodAvailable(prev => !prev)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    {formIsCodAvailable ? <ToggleRight className="w-10 h-10 text-amber-500" /> : <ToggleLeft className="w-10 h-10 text-slate-300 dark:text-slate-650" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-colors cursor-pointer flex justify-center items-center gap-1.5 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  حفظ المحافظة في قاعدة البيانات
                </button>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: BULK EDIT                           */}
      {/* ========================================== */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 text-right shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 mb-5">
              <Edit2 className="w-5 h-5 text-amber-500" />
              تعديل جماعي بالجملة (عدد {selectedIds.length} محافظة)
            </h4>

            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <p className="text-[11px] text-amber-900 dark:text-slate-400 bg-amber-50 dark:bg-amber-500/5 p-3 rounded-lg border border-amber-200 dark:border-amber-500/10 leading-relaxed font-medium">
                ملاحظة: سيتم فقط تطبيق الحقول التي تقوم بتعبئة قيمها وتجاهل الحقول الفارغة، مع الإبقاء على القيم القديمة لبقية خصائص المحافظات المحددة.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">سعر الشحن الموحد الجديد (جنيه) (اختياري)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={bulkPrice}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                    onChange={(e) => setBulkPrice(sanitizeNumericInput(e.target.value, 'non_negative_decimal'))}
                    placeholder="اتركه فارغاً للتجاهل"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">زمن التوصيل الموحد الجديد (اختياري)</label>
                  <input
                    type="text"
                    value={bulkEstimatedDays}
                    onChange={(e) => setBulkEstimatedDays(e.target.value)}
                    placeholder="مثال: 2-3 أيام (أو فارغ لتجاهل)"
                    className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <CustomSelect
                  label="حد الشراء للشحن المجاني الجديد (اختياري)"
                  value={bulkFreeShippingThreshold}
                  onChange={(val) => setBulkFreeShippingThreshold(val)}
                  size="sm"
                  buttonClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  options={[
                    { value: '', label: 'لا تقم بتعديل هذا الخيار (الإبقاء على القديم)' },
                    { value: 'clear', label: 'مسح وإلغاء الشحن المجاني (تعطيله)' },
                    { value: '3000', label: '3000 ج.م' },
                    { value: '5000', label: '5000 ج.م' },
                    { value: '7000', label: '7000 ج.م' },
                    { value: '10000', label: '10000 ج.م' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <CustomSelect
                    label="تعديل حالة التغطية للكل"
                    value={bulkIsActive}
                    onChange={(val) => setBulkIsActive(val)}
                    size="sm"
                    buttonClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-amber-500 shadow-xs"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    options={[
                      { value: 'keep', label: 'الإبقاء على الحالة الحالية لكل محافظة' },
                      { value: 'true', label: 'تفعيل الشحن والتغطية (نشط)' },
                      { value: 'false', label: 'تعطيل الشحن مؤقتاً (معطل)' }
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <CustomSelect
                    label="تعديل خيار كاش الاستلام (COD)"
                    value={bulkIsCodAvailable}
                    onChange={(val) => setBulkIsCodAvailable(val)}
                    size="sm"
                    buttonClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white focus:border-amber-500 shadow-xs"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    options={[
                      { value: 'keep', label: 'الإبقاء على الحالة الحالية لكل محافظة' },
                      { value: 'true', label: 'تفعيل كاش عند الاستلام' },
                      { value: 'false', label: 'تعطيل كاش عند الاستلام (الدفع المسبق فقط)' }
                    ]}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-colors cursor-pointer flex justify-center items-center gap-1.5 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  تطبيق التحديث الجماعي الفوري
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
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
