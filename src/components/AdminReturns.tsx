import React, { useState, useEffect } from 'react';
import {
  RotateCcw, Search, Filter, RefreshCw, CheckCircle2, AlertCircle,
  XCircle, Clock, ChevronLeft, ChevronRight, Eye, DollarSign, Package,
  FileText, User, ArrowLeftRight, Check, X, Loader2, AlertTriangle,
  Image as ImageIcon, Calendar, ShieldAlert, CreditCard, History,
  Maximize2, Sparkles
} from 'lucide-react';
import { ReturnRequest, ReturnStatus, RefundStatus, ReturnHistoryItem } from '../types.js';
import api, { getFriendlyErrorMessage } from '../lib/api.js';
import { useAdminAuth } from '../context/AdminAuthContext.js';

interface AdminReturnsProps {
  onRefreshAll?: () => Promise<boolean | void>;
}

export default function AdminReturns({ onRefreshAll }: AdminReturnsProps) {
  const { adminUser, isSuperAdmin } = useAdminAuth();

  // RBAC Permission Check
  const canManageReturns = Boolean(
    isSuperAdmin ||
    (adminUser?.permissions && (
      adminUser.permissions.includes('returns.manage') ||
      adminUser.permissions.includes('orders.edit') ||
      adminUser.permissions.includes('*')
    ))
  );

  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filtering & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refundStatusFilter, setRefundStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFromFilter, setDateFromFilter] = useState<string>('');
  const [dateToFilter, setDateToFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1 });

  // KPI Metrics
  const [kpis, setKpis] = useState({
    totalCount: 0,
    pendingCount: 0,
    approvedCount: 0,
    completedCount: 0,
    rejectedCount: 0,
    totalRefundedAmount: 0
  });

  // Selected Return Detail Modal
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [productDetail, setProductDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Status Edit Form inside Modal
  const [editStatus, setEditStatus] = useState<ReturnStatus>('pending');
  const [editRefundStatus, setEditRefundStatus] = useState<RefundStatus>('pending');
  const [editRefundAmount, setEditRefundAmount] = useState<number>(0);
  const [editRefundMethod, setEditRefundMethod] = useState<'cash' | 'vodafone_cash' | 'instapay' | 'bank_transfer' | 'store_credit' | 'other'>('cash');
  const [editRefundReference, setEditRefundReference] = useState<string>('');
  const [editRestockable, setEditRestockable] = useState<boolean>(true);
  const [editAdminNote, setEditAdminNote] = useState<string>('');
  
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState('');
  const [updateError, setUpdateError] = useState('');

  const loadReturns = async (page = currentPage, limit = pageSize) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminReturnRequests({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        refundStatus: refundStatusFilter !== 'all' ? refundStatusFilter : undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
        dateFrom: dateFromFilter ? dateFromFilter : undefined,
        dateTo: dateToFilter ? dateToFilter : undefined,
        page,
        limit
      });

      if (res.success) {
        setReturns(res.returns || []);
        if (res.pagination) setPagination(res.pagination);
        if (res.kpis) setKpis(res.kpis);
      }
    } catch (err: any) {
      console.error('Failed to load admin returns:', err);
      setError(getFriendlyErrorMessage(err, 'تعذر تحميل قائمة طلبات الإرجاع.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns(1, pageSize);
    setCurrentPage(1);
  }, [statusFilter, refundStatusFilter, dateFromFilter, dateToFilter, pageSize]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReturns(1, pageSize);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setRefundStatusFilter('all');
    setSearchQuery('');
    setDateFromFilter('');
    setDateToFilter('');
    setCurrentPage(1);
    loadReturns(1, pageSize);
  };

  const handleOpenDetailModal = async (returnReq: ReturnRequest) => {
    setSelectedReturn(returnReq);
    setEditStatus(returnReq.status);
    setEditRefundStatus(returnReq.refundStatus);
    setEditRefundAmount(returnReq.refundAmount || (returnReq.unitPrice * returnReq.quantity));
    setEditRefundMethod(returnReq.refundMethod || 'cash');
    setEditRefundReference(returnReq.refundReference || '');
    setEditRestockable(returnReq.restocked !== undefined ? returnReq.restocked : true);
    setEditAdminNote(returnReq.adminNote || '');
    setUpdateSuccess('');
    setUpdateError('');

    setDetailLoading(true);
    try {
      const res = await api.getAdminReturnRequestById(returnReq.id);
      if (res.success) {
        setSelectedReturn(res.returnRequest);
        setOrderDetail(res.order);
        setProductDetail(res.product);
        setEditStatus(res.returnRequest.status);
        setEditRefundStatus(res.returnRequest.refundStatus);
        setEditRefundAmount(res.returnRequest.refundAmount || (res.returnRequest.unitPrice * res.returnRequest.quantity));
        setEditRefundMethod(res.returnRequest.refundMethod || 'cash');
        setEditRefundReference(res.returnRequest.refundReference || '');
        setEditRestockable(res.returnRequest.restocked !== undefined ? res.returnRequest.restocked : true);
        setEditAdminNote(res.returnRequest.adminNote || '');
      }
    } catch (err) {
      console.error('Failed to load return request details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateStatus = async (e?: React.FormEvent, directStatus?: ReturnStatus, directRefundStatus?: RefundStatus) => {
    if (e) e.preventDefault();
    if (!selectedReturn) return;

    if (!canManageReturns) {
      setUpdateError('ليس لديك صلاحية لتعديل أو إدارة طلبات الإرجاع (returns.manage)');
      return;
    }

    const targetStatus = directStatus || editStatus;
    const targetRefundStatus = directRefundStatus || editRefundStatus;

    if (targetStatus === 'rejected' && (!editAdminNote || !editAdminNote.trim())) {
      setUpdateError('يجب كتابة سبب الرفض في الملاحظات الإدارية عند رفض طلب الإرجاع.');
      return;
    }

    setUpdateLoading(true);
    setUpdateSuccess('');
    setUpdateError('');

    try {
      const res = await api.updateAdminReturnRequestStatus(selectedReturn.id, {
        status: targetStatus,
        refundStatus: targetRefundStatus,
        refundAmount: editRefundAmount,
        refundMethod: editRefundMethod,
        refundReference: editRefundReference,
        restockable: editRestockable,
        adminNote: editAdminNote
      });

      if (res.success) {
        setUpdateSuccess(res.message || 'تم تحديث حالة طلب الإرجاع بنجاح');
        setSelectedReturn(res.returnRequest);
        setEditStatus(res.returnRequest.status);
        setEditRefundStatus(res.returnRequest.refundStatus);
        // Refresh table in background
        loadReturns(currentPage, pageSize);
        if (onRefreshAll) onRefreshAll();
      }
    } catch (err: any) {
      console.error('Failed to update return status:', err);
      setUpdateError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء تحديث حالة طلب الإرجاع.'));
    } finally {
      setUpdateLoading(false);
    }
  };

  // Helper translations and badges
  const getReasonLabel = (reason: string) => {
    const map: Record<string, string> = {
      defective: 'المنتج به عيب تصنيع أو تالف ⚠️',
      wrong_item: 'استلام منتج مختلف عن المطلوب 📦',
      size_mismatch: 'مقاس أو حجم غير مناسب 📏',
      not_as_described: 'المنتج غير مطابق للمواصفات المعروضة 📝',
      changed_mind: 'تغيير الرأي أو إلغاء الحاجة 🔄',
      other: 'سبب آخر 💬'
    };
    return map[reason] || reason;
  };

  const getStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: 'بانتظار المراجعة',
          class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
          dotClass: 'bg-amber-400'
        };
      case 'pickup_pending':
        return {
          label: 'قيد ترتيب الاستلام',
          class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
          dotClass: 'bg-amber-400'
        };
      case 'approved':
        return {
          label: 'تمت الموافقة',
          class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
          dotClass: 'bg-emerald-400'
        };
      case 'received':
        return {
          label: 'تم استلام الشحنة بالمخزن',
          class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
          dotClass: 'bg-emerald-400'
        };
      case 'completed':
        return {
          label: 'مكتمل ومسترد بالمخزن',
          class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
          dotClass: 'bg-emerald-400'
        };
      case 'rejected':
        return {
          label: 'مرفوض',
          class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
          dotClass: 'bg-rose-400'
        };
      case 'cancelled':
        return {
          label: 'ملغى من العميل',
          class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
          dotClass: 'bg-rose-400'
        };
      default:
        return {
          label: status,
          class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
          dotClass: 'bg-slate-400'
        };
    }
  };

  const getRefundBadge = (status: RefundStatus) => {
    switch (status) {
      case 'pending':
        return {
          label: 'استرداد معلق',
          class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
          dotClass: 'bg-amber-400'
        };
      case 'approved':
        return {
          label: 'موافقة على الاسترداد',
          class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
          dotClass: 'bg-emerald-400'
        };
      case 'processed':
        return {
          label: 'تم تحويل المبلغ',
          class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
          dotClass: 'bg-emerald-400'
        };
      case 'rejected':
        return {
          label: 'استرداد مرفوض',
          class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
          dotClass: 'bg-rose-400'
        };
      default:
        return {
          label: status,
          class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20',
          dotClass: 'bg-slate-400'
        };
    }
  };

  const getRefundMethodLabel = (method?: string) => {
    const map: Record<string, string> = {
      cash: 'كاش نقدي',
      vodafone_cash: 'فودافون كاش / محفظة إلكترونية',
      instapay: 'انستاباي InstaPay',
      bank_transfer: 'تحويل بنكي',
      store_credit: 'رصيد مشتريات بالمتجر',
      other: 'أخرى'
    };
    return method ? map[method] || method : 'غير محدد';
  };

  return (
    <div className="space-y-6 font-sans" id="admin-returns-page">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 dark:text-white">إدارة طلبات إرجاع المنتجات</h1>
                {!canManageReturns && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    عرض فقط (Read-Only)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                مراجعة طلبات استرجاع المنتجات المقدمة من العملاء، التفتيش والفحص، تسوية المبالغ المستردة يدويًا، وإعادة إدراج المخزون.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadReturns(currentPage, pageSize)}
            disabled={loading}
            className="py-2 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-amber-500 ${loading ? 'animate-spin' : ''}`} />
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* Top KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold">إجمالي طلبات الإرجاع</span>
            <Package className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{kpis.totalCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-xs">
          <div className="flex justify-between items-center text-amber-700 dark:text-amber-400 mb-1">
            <span className="text-xs font-bold">بانتظار المراجعة</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{kpis.pendingCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/50 shadow-xs">
          <div className="flex justify-between items-center text-blue-700 dark:text-blue-400 mb-1">
            <span className="text-xs font-bold">مقبول / قيد الاستلام</span>
            <ArrowLeftRight className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{kpis.approvedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
          <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 mb-1">
            <span className="text-xs font-bold">مكتمل ومسترد</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{kpis.completedCount}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-bold">إجمالي المستردات المكتملة</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {kpis.totalRefundedAmount.toLocaleString('ar-EG')} <span className="text-xs font-bold">ج.م</span>
          </p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search form */}
          <form onSubmit={handleSearchSubmit} className="relative col-span-1 md:col-span-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الإرجاع، الفاتورة، العميل، الهاتف، أو اسم المنتج..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          </form>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-xs font-extrabold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer transition-colors"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">جميع حالات الإرجاع</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="pending">بانتظار المراجعة (Pending)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="approved">تمت الموافقة (Approved)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="pickup_pending">قيد ترتيب الاستلام (Pickup Pending)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="received">تم استلام الشحنة بالمخزن (Received)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="completed">مكتمل ومسترد (Completed)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="rejected">مرفوض (Rejected)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="cancelled">ملغى من العميل (Cancelled)</option>
            </select>
          </div>

          {/* Refund Status Filter */}
          <div>
            <select
              value={refundStatusFilter}
              onChange={(e) => setRefundStatusFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2.5 px-3 text-xs font-extrabold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer transition-colors"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="all">جميع حالات الاسترداد</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="pending">استرداد معلق (Pending)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="approved">موافق عليه (Approved)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="processed">تم التحويل (Processed)</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="rejected">مرفوض (Rejected)</option>
            </select>
          </div>
        </div>

        {/* Date Filter & Clear Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400">من تاريخ:</span>
              <input
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400">إلى تاريخ:</span>
              <input
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              />
            </div>

            {(statusFilter !== 'all' || refundStatusFilter !== 'all' || searchQuery || dateFromFilter || dateToFilter) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-amber-600 dark:text-amber-400 hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                مسح الفلاتر
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400">عدد العناصر بالصفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer transition-colors"
            >
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={10}>10</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={20}>20</option>
              <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Returns Table */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
            <p className="text-xs font-bold">جاري تحميل سجل طلبات الإرجاع...</p>
          </div>
        ) : returns.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400 space-y-2">
            <RotateCcw className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm font-black text-slate-800 dark:text-slate-200">لا توجد طلبات إرجاع مطابقة للبحث حالياً</p>
            <p className="text-xs">جرّب تغيير فلاتر البحث أو حدّث الصفحة لمتابعة أي طلبات جديدة.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 font-bold text-xs border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3.5">معرف الإرجاع</th>
                  <th className="p-3.5">الفاتورة والعميل</th>
                  <th className="p-3.5">المنتج والكمية</th>
                  <th className="p-3.5">سبب الإرجاع</th>
                  <th className="p-3.5">المبلغ المطلوب</th>
                  <th className="p-3.5">حالة الإرجاع</th>
                  <th className="p-3.5">حالة الاسترداد</th>
                  <th className="p-3.5">تاريخ الطلب</th>
                  <th className="p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-semibold">
                {returns.map((ret) => {
                  const statusBadge = getStatusBadge(ret.status);
                  const refundBadge = getRefundBadge(ret.refundStatus);
                  return (
                    <tr
                      key={ret.id}
                      className="bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 transition-colors"
                    >
                      {/* ID */}
                      <td className="p-3.5">
                        <span className="font-mono text-slate-900 dark:text-white font-extrabold block">{ret.id}</span>
                        {ret.restocked && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            <Check className="w-3 h-3" /> تم إعادة المخزون
                          </span>
                        )}
                      </td>

                      {/* Invoice & Customer */}
                      <td className="p-3.5">
                        <span className="font-extrabold text-amber-600 dark:text-amber-400 block">{ret.orderInvoiceNumber || ret.orderId}</span>
                        <span className="text-slate-800 dark:text-slate-200 font-bold block truncate max-w-[150px]">{ret.customerName}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{ret.customerPhone}</span>
                      </td>

                      {/* Product */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5 max-w-[220px]">
                          {ret.productImage ? (
                            <img src={ret.productImage} alt="" className="w-10 h-10 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 border border-slate-200 dark:border-slate-700">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white block truncate">{ret.productTitle}</span>
                            {ret.variantInfo && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">{ret.variantInfo}</span>
                            )}
                            <span className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 block">العدد: {ret.quantity} قطعة</span>
                          </div>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="p-3.5">
                        <span className="text-slate-800 dark:text-slate-200 font-bold block max-w-[180px] leading-snug">
                          {getReasonLabel(ret.reason)}
                        </span>
                        {ret.otherReason && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-[180px]">
                            {ret.otherReason}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-3.5">
                        <span className="font-black text-amber-600 dark:text-amber-400 text-sm block">
                          {(ret.refundAmount || (ret.unitPrice * ret.quantity)).toLocaleString('ar-EG')} ج.م
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                          (سعر القطعة: {ret.unitPrice.toLocaleString('ar-EG')} ج.م)
                        </span>
                      </td>

                      {/* Return Status */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap ${statusBadge.class}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotClass} shrink-0`} />
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Refund Status */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap ${refundBadge.class}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${refundBadge.dotClass} shrink-0`} />
                          {refundBadge.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="p-3.5">
                        <span className="text-slate-800 dark:text-slate-200 font-semibold block">
                          {new Date(ret.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(ret.createdAt).toLocaleTimeString('ar-EG', { timeStyle: 'short' })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleOpenDetailModal(ret)}
                          className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-xs transition-all shadow-xs flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          مراجعة وتفاصيل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>
              عرض الصفحة {pagination.page} من أصل {pagination.totalPages} (إجمالي {pagination.totalItems} طلب)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1 || loading}
                onClick={() => {
                  const p = currentPage - 1;
                  setCurrentPage(p);
                  loadReturns(p, pageSize);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
                title="الصفحة السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pNum = i + 1;
                  if (pagination.totalPages > 5 && currentPage > 3) {
                    pNum = Math.min(pagination.totalPages - 4 + i, Math.max(1, currentPage - 2 + i));
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => {
                        setCurrentPage(pNum);
                        loadReturns(pNum, pageSize);
                      }}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        currentPage === pNum
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={currentPage >= pagination.totalPages || loading}
                onClick={() => {
                  const p = currentPage + 1;
                  setCurrentPage(p);
                  loadReturns(p, pageSize);
                }}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
                title="الصفحة التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail and Update Status Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl relative flex flex-col justify-between">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                    <span>مراجعة وإدارة طلب الإرجاع #{selectedReturn.id}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap ${getStatusBadge(selectedReturn.status).class}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(selectedReturn.status).dotClass} shrink-0`} />
                      {getStatusBadge(selectedReturn.status).label}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    رقم الفاتورة الأصلية: <span className="font-extrabold text-amber-600 dark:text-amber-400">{selectedReturn.orderInvoiceNumber || selectedReturn.orderId}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedReturn(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 flex-1 text-xs font-semibold">
              {detailLoading && (
                <div className="p-3 text-center text-amber-500 font-bold flex items-center justify-center gap-2 bg-amber-500/5 rounded-xl border border-amber-500/20">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري جلب تفاصيل الفاتورة والمنتج الكاملة...
                </div>
              )}

              {/* Grid with 2 columns: Return Item Details + Customer/Order Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Item Details Box */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <Package className="w-4 h-4 text-amber-500" />
                    بيانات المنتج المراد استرجاعه
                  </h4>

                  <div className="flex items-center gap-3">
                    {selectedReturn.productImage ? (
                      <img src={selectedReturn.productImage} alt="" className="w-16 h-16 object-cover rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                        <Package className="w-7 h-7" />
                      </div>
                    )}
                    <div>
                      <span className="font-black text-slate-900 dark:text-white text-sm block leading-tight">{selectedReturn.productTitle}</span>
                      {selectedReturn.variantInfo && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">{selectedReturn.variantInfo}</span>
                      )}
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block mt-1">
                        سعر القطعة: {selectedReturn.unitPrice.toLocaleString('ar-EG')} ج.م
                      </span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 block">
                        الكمية المطلوبة للإرجاع: <strong className="text-slate-900 dark:text-white font-black">{selectedReturn.quantity} قطعة</strong>
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-bold">إجمالي قيمة المنتج المرتجع:</span>
                    <span className="font-black text-amber-600 dark:text-amber-400 text-sm">
                      {(selectedReturn.unitPrice * selectedReturn.quantity).toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>

                  {selectedReturn.restocked && (
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>تمت إضافة الكمية ({selectedReturn.quantity} قطعة) للمخزون الفعلي مسبقاً.</span>
                    </div>
                  )}
                </div>

                {/* Customer & Order Info Box */}
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <User className="w-4 h-4 text-amber-500" />
                    بيانات العميل والفاتورة
                  </h4>

                  <p><span className="text-slate-500 dark:text-slate-400">اسم العميل:</span> <strong className="text-slate-900 dark:text-white font-black">{selectedReturn.customerName}</strong></p>
                  <p><span className="text-slate-500 dark:text-slate-400">رقم الهاتف:</span> <strong className="text-slate-900 dark:text-white font-extrabold font-mono">{selectedReturn.customerPhone}</strong></p>
                  {selectedReturn.customerEmail && <p><span className="text-slate-500 dark:text-slate-400">البريد الإلكتروني:</span> <span className="text-slate-800 dark:text-slate-200">{selectedReturn.customerEmail}</span></p>}
                  <p><span className="text-slate-500 dark:text-slate-400">تاريخ إنشاء طلب الإرجاع:</span> <span className="text-slate-800 dark:text-slate-200">{new Date(selectedReturn.createdAt).toLocaleString('ar-EG')}</span></p>
                  {orderDetail && (
                    <>
                      <p><span className="text-slate-500 dark:text-slate-400">عنوان العميل بالفاتورة:</span> <span className="text-slate-800 dark:text-slate-200">{orderDetail.customer?.governorate} - {orderDetail.customer?.city} ({orderDetail.customer?.address})</span></p>
                      <p><span className="text-slate-500 dark:text-slate-400">طريقة الدفع الأصلية:</span> <span className="text-slate-800 dark:text-slate-200">{orderDetail.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : orderDetail.paymentMethod}</span></p>
                    </>
                  )}
                </div>
              </div>

              {/* Return Reason & Customer Note & Inspection Images */}
              <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-3">
                <h5 className="font-black text-amber-800 dark:text-amber-300 text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  سبب طلب الإرجاع وتفاصيل العميل:
                </h5>
                
                <div className="text-slate-900 dark:text-white font-bold text-xs bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-amber-500/20">
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold ml-1">السبب المختار:</span>
                  {getReasonLabel(selectedReturn.reason)}
                  {selectedReturn.otherReason && (
                    <span className="block text-xs font-normal text-slate-600 dark:text-slate-300 mt-1">
                      <strong className="font-bold text-slate-800 dark:text-slate-200">توضيح إضافي:</strong> {selectedReturn.otherReason}
                    </span>
                  )}
                </div>

                {selectedReturn.customerNote && (
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px] mb-1 font-bold">ملاحظات العميل المدونة:</span>
                    <p className="text-slate-800 dark:text-slate-200 text-xs italic bg-white dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 leading-relaxed">
                      "{selectedReturn.customerNote}"
                    </p>
                  </div>
                )}

                {/* Uploaded Inspection Images if any */}
                {selectedReturn.images && selectedReturn.images.length > 0 && (
                  <div className="pt-2 border-t border-amber-500/20">
                    <span className="text-slate-600 dark:text-slate-300 font-bold block text-[11px] mb-2 flex items-center gap-1">
                      <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                      صور الفحص المرفقة من قبل العميل ({selectedReturn.images.length}):
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      {selectedReturn.images.map((imgUrl, i) => (
                        <div
                          key={i}
                          onClick={() => setPreviewImage(imgUrl)}
                          className="relative group cursor-pointer"
                        >
                          <img
                            src={imgUrl}
                            alt={`Inspection Image ${i + 1}`}
                            className="w-20 h-20 object-cover rounded-2xl border-2 border-amber-500/30 group-hover:border-amber-500 transition-all shadow-xs"
                          />
                          <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                            <Maximize2 className="w-4 h-4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Actions Bar */}
              {canManageReturns && (
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    إجراءات سريعة بنقرة واحدة:
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedReturn.status === 'pending' && (
                      <button
                        type="button"
                        disabled={updateLoading}
                        onClick={() => handleUpdateStatus(undefined, 'approved', 'approved')}
                        className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        الموافقة المبدئية على الإرجاع
                      </button>
                    )}

                    {selectedReturn.status === 'approved' && (
                      <button
                        type="button"
                        disabled={updateLoading}
                        onClick={() => handleUpdateStatus(undefined, 'pickup_pending')}
                        className="py-2 px-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        تحديد حالة (بانتظار مندوب الاستلام)
                      </button>
                    )}

                    {(selectedReturn.status === 'pickup_pending' || selectedReturn.status === 'approved') && (
                      <button
                        type="button"
                        disabled={updateLoading}
                        onClick={() => handleUpdateStatus(undefined, 'received')}
                        className="py-2 px-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <Package className="w-3.5 h-3.5" />
                        تم استلام المنتج وفحصه بالمخزن
                      </button>
                    )}

                    {selectedReturn.status !== 'completed' && selectedReturn.status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={updateLoading}
                        onClick={() => handleUpdateStatus(undefined, 'completed', 'processed')}
                        className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        إكمال الإرجاع وتحويل المبلغ
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Action Form */}
              <form onSubmit={(e) => handleUpdateStatus(e)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl space-y-4 shadow-sm">
                <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <span>تعديل حالة الإرجاع والاسترداد والمخزون</span>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">لوحة التحكم والتنفيذ</span>
                </h4>

                {updateSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {updateSuccess}
                  </div>
                )}

                {updateError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {updateError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Return Status Select */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      حالة طلب الإرجاع <span className="text-red-500">*</span>
                    </label>
                    <select
                      disabled={!canManageReturns}
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as ReturnStatus)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50 transition-colors"
                    >
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="pending">بانتظار المراجعة (Pending)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="approved">تمت الموافقة وتأكيد الإرجاع (Approved)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="pickup_pending">قيد ترتيب الاستلام مع شركة الشحن (Pickup Pending)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="received">تم وصول الشحنة وفحصها بالمخزن (Received)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="completed">مكتمل ومسترد بالمخزن (Completed)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="rejected">مرفوض (Rejected)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="cancelled">ملغى من العميل (Cancelled)</option>
                    </select>
                  </div>

                  {/* Refund Status Select */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      حالة استرداد المبلغ للعميل <span className="text-red-500">*</span>
                    </label>
                    <select
                      disabled={!canManageReturns}
                      value={editRefundStatus}
                      onChange={(e) => setEditRefundStatus(e.target.value as RefundStatus)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-extrabold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50 transition-colors"
                    >
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="pending">استرداد معلق (Pending)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="approved">تمت الموافقة على تحويل المبلغ (Approved)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="processed">تم تحويل المبلغ بالفعل للعميل (Processed)</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="rejected">رفض استرداد المبلغ (Rejected)</option>
                    </select>
                  </div>

                  {/* Refund Amount Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      مبلغ الاسترداد الفعلي (ج.م)
                    </label>
                    <input
                      disabled={!canManageReturns}
                      type="number"
                      min={0}
                      value={editRefundAmount}
                      onChange={(e) => setEditRefundAmount(Number(e.target.value))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-mono font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50 transition-colors"
                    />
                  </div>

                  {/* Refund Method Select */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      طريقة تحويل المبلغ المسترد يدويًا:
                    </label>
                    <select
                      disabled={!canManageReturns}
                      value={editRefundMethod}
                      onChange={(e) => setEditRefundMethod(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50 transition-colors"
                    >
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="cash">كاش نقدي مع المندوب</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="vodafone_cash">فودافون كاش / محفظة إلكترونية</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="instapay">انستاباي InstaPay</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="bank_transfer">تحويل بنكي</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="store_credit">رصيد متجر</option>
                      <option className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" value="other">أخرى</option>
                    </select>
                  </div>

                  {/* Refund Reference Input */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      رقم العملية / الحوالة / الإيصال المرجعي للاسترداد:
                    </label>
                    <input
                      disabled={!canManageReturns}
                      type="text"
                      value={editRefundReference}
                      onChange={(e) => setEditRefundReference(e.target.value)}
                      placeholder="مثال: رقم تحويل فودافون كاش، رقم إيصال انستاباي..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                    />
                  </div>

                  {/* Restockable Toggle / Checkbox */}
                  <div className="col-span-1 md:col-span-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <span className="font-black text-slate-900 dark:text-white block text-xs">
                        إعادة المنتج إلى المخزون (Restock)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                        {selectedReturn.restocked
                          ? 'تمت إضافة هذه الكمية للمخزون مسبقاً، ولن يتم تكرار الإضافة لمنع ازدواجية المخزون.'
                          : 'عند تفعيل هذا الخيار واكتمال الإرجاع، ستتم زيادة مخزون المنتج تلقائيًا.'}
                      </span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canManageReturns || selectedReturn.restocked}
                        checked={editRestockable}
                        onChange={(e) => setEditRestockable(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-amber-500"></div>
                    </label>
                  </div>

                  {/* Admin Note Input */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ملاحظات الإدارة الرسمية (تظهر للعميل - إلزامية عند الرفض):
                    </label>
                    <textarea
                      disabled={!canManageReturns}
                      rows={2}
                      value={editAdminNote}
                      onChange={(e) => setEditAdminNote(e.target.value)}
                      placeholder="اكتب سبب الرفض أو أي تفاصيل خاصة بالمراجعة..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Form Buttons */}
                {canManageReturns && (
                  <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedReturn(null)}
                      className="py-2.5 px-5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
                    >
                      إغلاق
                    </button>
                    <button
                      type="submit"
                      disabled={updateLoading}
                      className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      {updateLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      حفظ وتطبيق التغييرات
                    </button>
                  </div>
                )}
              </form>

              {/* Audit History Timeline */}
              {selectedReturn.history && selectedReturn.history.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <h5 className="font-black text-slate-900 dark:text-white text-xs flex items-center gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <History className="w-4 h-4 text-amber-500" />
                    سجل التتبع والتدقيق لطلب الإرجاع (Audit Trail):
                  </h5>

                  <div className="space-y-2.5">
                    {selectedReturn.history.map((hItem, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 dark:text-white">{hItem.action}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                              بواسطة: {hItem.actor}
                            </span>
                          </div>
                          {hItem.note && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                              "{hItem.note}"
                            </p>
                          )}
                        </div>

                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-mono">
                          {new Date(hItem.date).toLocaleString('ar-EG')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Size Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] bg-slate-950 p-2 rounded-3xl border border-slate-800 shadow-2xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 shadow-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Full Preview"
              className="max-h-[80vh] w-auto object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
