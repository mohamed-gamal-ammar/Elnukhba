import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  Eye,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Briefcase,
  X,
  Copy,
  Check,
  PackageCheck
} from 'lucide-react';
import { Supplier, SupplierInput, SupplierStatus } from '../types.js';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { CustomSelect } from './CustomSelect.js';
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

interface AdminSuppliersProps {
  onRefreshAll?: () => void;
}

export default function AdminSuppliers({ onRefreshAll }: AdminSuppliersProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'companyAsc' | 'companyDesc'>('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [formData, setFormData] = useState<SupplierInput>({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    notes: '',
    status: 'active'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Copy state for supplier ID
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Load suppliers from API
  const loadSuppliers = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.getSuppliers({
        search: searchQuery,
        status: statusFilter === 'all' ? undefined : statusFilter
      });

      setSuppliers(res.suppliers || []);
      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err: any) {
      console.error('Failed to load suppliers:', err);
      setError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء تحميل بيانات الموردين'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter]);

  // Automatically reset to page 1 whenever search, status filter, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy]);

  // Client-side sorting & pagination
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      if (sortBy === 'oldest') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === 'companyAsc') {
        return (a.companyName || '').localeCompare(b.companyName || '', 'ar');
      }
      if (sortBy === 'companyDesc') {
        return (b.companyName || '').localeCompare(a.companyName || '', 'ar');
      }
      // Default 'newest'
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [suppliers, sortBy]);

  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return sortedSuppliers.slice(start, start + limit);
  }, [sortedSuppliers, currentPage, limit]);

  const totalPages = Math.ceil(sortedSuppliers.length / limit) || 1;

  // Handle Add/Edit Form Submit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('اسم مسئول الاتصال بالمورد مطلوب');
      return;
    }
    if (!formData.companyName.trim()) {
      setFormError('اسم الشركة أو المؤسسة مطلوب');
      return;
    }
    if (!formData.phone.trim()) {
      setFormError('رقم الهاتف مطلوب');
      return;
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        setFormError('يرجى إدخال بريد إلكتروني بصيغة صحيحة');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingSupplier) {
        const res = await api.updateSupplier(editingSupplier.id, formData);
        setSuccessMsg(res.message || 'تم تحديث بيانات المورد بنجاح');
      } else {
        const res = await api.createSupplier(formData);
        setSuccessMsg(res.message || 'تمت إضافة المورد بنجاح');
      }

      closeFormModal();
      loadSuppliers(true);
      if (onRefreshAll) onRefreshAll();

      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء حفظ بيانات المورد'));
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      companyName: s.companyName,
      phone: s.phone,
      email: s.email || '',
      address: s.address || '',
      taxNumber: s.taxNumber || '',
      notes: s.notes || '',
      status: s.status
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      companyName: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      notes: '',
      status: 'active'
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  // Close Add/Edit Modal
  const closeFormModal = () => {
    setIsAddModalOpen(false);
    setEditingSupplier(null);
    setFormError(null);
  };

  // Toggle Supplier Status
  const handleToggleStatus = async (supplier: Supplier) => {
    const newStatus: SupplierStatus = supplier.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateSupplier(supplier.id, { status: newStatus });
      setSuccessMsg(`تم ${newStatus === 'active' ? 'تنشيط' : 'تعطيل'} المورد ${supplier.companyName} بنجاح`);
      loadSuppliers(true);
      if (onRefreshAll) onRefreshAll();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تغيير حالة المورد'));
    }
  };

  // Delete/Deactivate Supplier
  const handleConfirmDelete = async () => {
    if (!deletingSupplier) return;
    setSubmitting(true);
    try {
      const res = await api.deleteSupplier(deletingSupplier.id);
      setSuccessMsg(res.message);
      setDeletingSupplier(null);
      loadSuppliers(true);
      if (onRefreshAll) onRefreshAll();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل عملية الحذف'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 dir-rtl font-sans" dir="rtl">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة الموردين والشركات"
        description="تسجيل ومتابعة شركاء التوريد والتجهيز لأوامر الشراء ومتابعة المخزون الوارد"
        icon={Building2}
        badge={<AdminBadge variant="amber">{stats.total} مورد</AdminBadge>}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadSuppliers(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              title="إعادة تحميل البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <AdminButton
              icon={UserPlus}
              onClick={handleOpenAdd}
            >
              إضافة مورد جديد
            </AdminButton>
          </div>
        }
      />

      {/* Alert Banners */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AdminStatCard
          title="إجمالي الموردين والشركات"
          value={stats.total}
          icon={Building2}
          subtitle="موردين مسجلين بالنظام"
        />
        <AdminStatCard
          title="الموردون النشطون"
          value={stats.active}
          icon={ShieldCheck}
          trend={{ value: `${stats.active} نشط`, isPositive: true, label: 'جاهزون لاستقبال الطلبات' }}
        />
        <AdminStatCard
          title="الحسابات الموقوفة / غير النشطة"
          value={stats.inactive}
          icon={XCircle}
          trend={{ value: `${stats.inactive} معطل`, isPositive: false, label: 'معطلة مؤقتاً' }}
        />
      </div>

      {/* 3, 4, 5. Main Card with Search, Filter & Content */}
      <AdminCard className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          {/* Search Box */}
          <AdminSearchInput
            placeholder="البحث باسم المورد، الشركة، رقم الهاتف، البريد أو السجل الضريبي..."
            value={searchQuery}
            onChange={(val) => setSearchQuery(val)}
            className="flex-1"
          />

          {/* Status Filter Tabs & Sort Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val as any)}
              size="sm"
              buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white rounded-xl py-2.5 px-3 focus:border-amber-500 shadow-sm"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[180px]"
              options={[
                { value: 'newest', label: 'الأحدث أولاً' },
                { value: 'oldest', label: 'الأقدم أولاً' },
                { value: 'companyAsc', label: 'اسم الشركة: أ - ي' },
                { value: 'companyDesc', label: 'اسم الشركة: ي - أ' }
              ]}
            />

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 self-start md:self-auto overflow-x-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-900'
                }`}
              >
                الكل ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-900'
                }`}
              >
                نشط ({stats.active})
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  statusFilter === 'inactive'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-900'
                }`}
              >
                غير نشط ({stats.inactive})
              </button>
            </div>
          </div>
        </div>

        {/* 6. Main Content */}
        {loading ? (
          <AdminLoading message="جاري تحميل قائمة الموردين والشركات..." />
        ) : suppliers.length === 0 ? (
          <AdminEmptyState
            icon={Building2}
            title="لا يوجد موردون مطابقون للبحث"
            description="جرب تغيير كلمات البحث أو قم بإضافة مورد جديد لمباشرة عمليات التوريد."
            action={
              <AdminButton icon={UserPlus} size="sm" onClick={handleOpenAdd}>
                إضافة مورد جديد
              </AdminButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 font-bold">
                  <th className="p-3.5">المورد والشركة</th>
                  <th className="p-3.5">بيانات الاتصال</th>
                  <th className="p-3.5">العنوان والرقم الضريبي</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5">تاريخ التسجيل</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedSuppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                    {/* Contact Person & Company Name */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shrink-0">
                          {s.companyName ? s.companyName.charAt(0) : 'م'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                            {s.companyName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <Users className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            <span>مسئول الاتصال: {s.name}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="p-3.5">
                      <div className="space-y-1 text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{s.phone}</span>
                        </div>
                        {s.email ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span className="truncate max-w-[160px]">{s.email}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-600 block">بدون بريد</span>
                        )}
                      </div>
                    </td>

                    {/* Address & Tax Number */}
                    <td className="p-3.5">
                      <div className="space-y-1">
                        {s.address ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
                            <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span className="truncate max-w-[180px]">{s.address}</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-slate-600 block">لم يحدد العنوان</span>
                        )}
                        {s.taxNumber ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            <FileText className="w-3 h-3 text-amber-500/70 shrink-0" />
                            <span>ضريبي: {s.taxNumber}</span>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    {/* Status Badge & Toggle */}
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        title="انقر لتغيير حالة المورد"
                        className="inline-flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
                      >
                        {s.status === 'active' ? (
                          <AdminBadge variant="success">نشط</AdminBadge>
                        ) : (
                          <AdminBadge variant="danger">غير نشط</AdminBadge>
                        )}
                      </button>
                    </td>

                    {/* Created Date */}
                    <td className="p-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(s.createdAt).toLocaleDateString('ar-EG')}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setViewingSupplier(s)}
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="عرض تفاصيل المورد"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg text-amber-500 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          title="تعديل بيانات المورد"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingSupplier(s)}
                          className="p-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="حذف المورد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {suppliers.length > 0 && !loading && (
          <div className="pt-2">
            <AdminTablePagination
              page={currentPage}
              totalPages={totalPages}
              total={sortedSuppliers.length}
              limit={limit}
              onPageChange={(p) => setCurrentPage(p)}
              onLimitChange={(l) => {
                setLimit(l);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </AdminCard>

      {/* MODAL 1: ADD / EDIT SUPPLIER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in dir-rtl">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-500/20">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد / شركة جديدة'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    أدخل تفاصيل الاتصال والبيانات الضريبية للمورد
                  </p>
                </div>
              </div>

              <button
                onClick={closeFormModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitForm} className="p-5 overflow-y-auto space-y-4 flex-1">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    اسم الشركة / المؤسسة <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="مثال: شركة العربي للتوزيع"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* Contact Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    اسم مسئول الاتصال <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Users className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="مثال: م. أحمد العربي"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    رقم الهاتف <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="010xxxxxxx"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">البريد الإلكتروني (اختياري)</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      placeholder="sales@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">العنوان التفصيلي (اختياري)</label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="المنطقة الصناعية، القاهرة..."
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Tax Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الرقم الضريبي / السجل التجاري</label>
                  <div className="relative">
                    <FileText className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="100-200-300"
                      value={formData.taxNumber}
                      onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                      className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">حالة الحساب</label>
                  <CustomSelect
                    value={formData.status}
                    onChange={(val) => setFormData({ ...formData, status: val as SupplierStatus })}
                    size="sm"
                    buttonClassName="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:border-amber-500"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    options={[
                      { value: 'active', label: 'نشط (مفعل للتوريد)' },
                      { value: 'inactive', label: 'غير نشط (معطل مؤقتاً)' }
                    ]}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ملاحظات وشروط التوريد</label>
                  <textarea
                    rows={3}
                    placeholder="ملاحظات حول المورد، فئات الأجهزة الموردة، وشروط الدفع والتسليم..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW SUPPLIER DETAILS */}
      {viewingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in dir-rtl">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
                  {viewingSupplier.companyName ? viewingSupplier.companyName.charAt(0) : 'م'}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {viewingSupplier.companyName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">بطاقة المورد وتفاصيل التوريد</p>
                </div>
              </div>

              <button
                onClick={() => setViewingSupplier(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Status and ID */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">معرف المورد (ID):</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{viewingSupplier.id}</span>
                  <button
                    onClick={() => copyToClipboard(viewingSupplier.id)}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="نسخ المعرف"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div>
                  {viewingSupplier.status === 'active' ? (
                    <span className="px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      نشط
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      غير نشط
                    </span>
                  )}
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">مسئول الاتصال</span>
                  <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    {viewingSupplier.name}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">رقم الهاتف</span>
                  <p className="font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-500" />
                    {viewingSupplier.phone}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">البريد الإلكتروني</span>
                  <p className="font-medium text-slate-700 dark:text-slate-300 truncate">
                    {viewingSupplier.email || 'غير مسجل'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">الرقم الضريبي</span>
                  <p className="font-mono font-bold text-amber-600 dark:text-amber-400">
                    {viewingSupplier.taxNumber || 'غير مسجل'}
                  </p>
                </div>
              </div>

              {/* Address */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-slate-500 text-[10px] block">العنوان والتواجد</span>
                <p className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {viewingSupplier.address || 'لم يحدد العنوان بعد'}
                </p>
              </div>

              {/* Notes */}
              {viewingSupplier.notes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] block">ملاحظات وشروط التوريد</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{viewingSupplier.notes}</p>
                </div>
              )}

              {/* PO Module Integration Notice */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                <PackageCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-xs">جاهز للربط مع نظام أوامر الشراء (Purchase Orders)</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400/80">
                    تم ربط المورد ببنية البيانات الأساسية، وسوف يظهر كخيار رئيسي عند إنشاء أمر شراء جديد وتوريد المخزون.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
              <span className="text-[10px] text-slate-500">
                تاريخ التسجيل: {new Date(viewingSupplier.createdAt).toLocaleString('ar-EG')}
              </span>
              <button
                onClick={() => setViewingSupplier(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRM DELETE / DEACTIVATE */}
      {deletingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in dir-rtl">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-500 dark:text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">تأكيد حذف / تعطيل المورد</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">حساب المورد: {deletingSupplier.companyName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              هل أنت تأكد من رغبتك في إزالة المورد <span className="font-bold text-slate-900 dark:text-white">{deletingSupplier.companyName}</span>؟
              <br />
              <span className="text-amber-600 dark:text-amber-400 font-medium block mt-1.5">
                تنويه: في حال وجود أوامر شراء أو حركات مخزون سابقة مرتبطة بهذا المورد، سيقوم النظام بتعطيل الحساب وحفظ التاريخ للحفاظ على سلامة القيود المالية.
              </span>
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingSupplier(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                تأكيد الحذف / التعطيل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
