import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList, Printer, Check, RefreshCw, X, AlertCircle, Phone, Truck, FileText,
  Search, Filter, RotateCcw, Download, FileSpreadsheet, ChevronDown, Eye, User,
  MapPin, Calendar, Package, Receipt, ChevronRight, ChevronLeft, CreditCard,
  CheckCircle2, Clock, XCircle
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { Order } from '../types.js';
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
  AdminFilterButton,
  AdminTablePagination
} from './AdminUIComponents.js';

interface AdminOrdersProps {
  onRefreshAll: () => void;
}

function highlightText(text: string | undefined | null, query: string) {
  if (!text) return null;
  if (!query || !query.trim()) return text;

  const q = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let startIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, startIndex);

  if (matchIndex === -1) return text;

  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      parts.push(text.substring(startIndex, matchIndex));
    }
    const matchText = text.substring(matchIndex, matchIndex + q.length);
    parts.push(
      <mark key={startIndex} className="bg-amber-100 text-amber-900 dark:bg-amber-500/30 dark:text-amber-300 font-black px-0.5 rounded-xs">
        {matchText}
      </mark>
    );
    startIndex = matchIndex + q.length;
    matchIndex = lowerText.indexOf(lowerQuery, startIndex);
  }

  if (startIndex < text.length) {
    parts.push(text.substring(startIndex));
  }

  return <>{parts}</>;
}

export default function AdminOrders({ onRefreshAll }: AdminOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search state & 250ms Debounce
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Advanced Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [governorateFilter, setGovernorateFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [quickDateFilter, setQuickDateFilter] = useState<'today' | 'last7' | 'last30' | null>(null);

  // Filter Drawer & Draft states
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState('all');
  const [draftPaymentStatusFilter, setDraftPaymentStatusFilter] = useState('all');
  const [draftPaymentMethodFilter, setDraftPaymentMethodFilter] = useState('all');
  const [draftGovernorateFilter, setDraftGovernorateFilter] = useState('all');
  const [draftStartDateFilter, setDraftStartDateFilter] = useState('');
  const [draftEndDateFilter, setDraftEndDateFilter] = useState('');

  // Export dropdown state
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Selected order & Details Modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenDrawer = () => {
    setDraftStatusFilter(statusFilter);
    setDraftPaymentStatusFilter(paymentStatusFilter);
    setDraftPaymentMethodFilter(paymentMethodFilter);
    setDraftGovernorateFilter(governorateFilter);
    setDraftStartDateFilter(startDateFilter);
    setDraftEndDateFilter(endDateFilter);
    setIsFilterDrawerOpen(true);
  };

  const handleApplyDraftFilters = () => {
    setStatusFilter(draftStatusFilter);
    setPaymentStatusFilter(draftPaymentStatusFilter);
    setPaymentMethodFilter(draftPaymentMethodFilter);
    setGovernorateFilter(draftGovernorateFilter);
    setStartDateFilter(draftStartDateFilter);
    setEndDateFilter(draftEndDateFilter);
    if (draftStartDateFilter || draftEndDateFilter) {
      setQuickDateFilter(null);
    }
    setIsFilterDrawerOpen(false);
  };

  const handleResetDraftFilters = () => {
    setDraftStatusFilter('all');
    setDraftPaymentStatusFilter('all');
    setDraftPaymentMethodFilter('all');
    setDraftGovernorateFilter('all');
    setDraftStartDateFilter('');
    setDraftEndDateFilter('');
  };

  // Close filter drawer / modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFilterDrawerOpen) setIsFilterDrawerOpen(false);
        if (isDetailsModalOpen) setIsDetailsModalOpen(false);
        if (showInvoice) setShowInvoice(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFilterDrawerOpen, isDetailsModalOpen, showInvoice]);

  const renderFilterFormBody = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* 1. Order Status */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">حالة الطلب</label>
          <CustomSelect
            value={draftStatusFilter}
            onChange={(val) => setDraftStatusFilter(val)}
            size="sm"
            buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-2 px-3 focus:border-amber-500"
            menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            options={[
              { value: 'all', label: 'كل الحالات' },
              { value: 'Pending', label: 'بانتظار المراجعة (Pending)' },
              { value: 'Confirmed', label: 'مؤكد وبالمستودع (Confirmed)' },
              { value: 'Preparing', label: 'تحت التغليف والتحضير (Preparing)' },
              { value: 'Shipped', label: 'خارج للتوصيل بالطريق (Shipped)' },
              { value: 'Delivered', label: 'تم الاستلام والدفع (Delivered)' },
              { value: 'Cancelled', label: 'طلب ملغي (Cancelled)' }
            ]}
          />
        </div>

        {/* 2. Payment Status */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">حالة الدفع</label>
          <CustomSelect
            value={draftPaymentStatusFilter}
            onChange={(val) => setDraftPaymentStatusFilter(val)}
            size="sm"
            buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-2 px-3 focus:border-amber-500"
            menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            options={[
              { value: 'all', label: 'كل حالات الدفع' },
              { value: 'paid', label: 'مدفوع / تم التحصيل' },
              { value: 'pending', label: 'معلق / لم يدفع بعد' },
              { value: 'failed', label: 'فشل / ملغي' }
            ]}
          />
        </div>

        {/* 3. Payment Method */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">طريقة الدفع</label>
          <CustomSelect
            value={draftPaymentMethodFilter}
            onChange={(val) => setDraftPaymentMethodFilter(val)}
            size="sm"
            buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-2 px-3 focus:border-amber-500"
            menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            options={[
              { value: 'all', label: 'كل طرق الدفع' },
              { value: 'cod', label: 'الدفع عند الاستلام (COD)' },
              { value: 'vodafone', label: 'فودافون كاش' },
              { value: 'card', label: 'بطاقة ائتمان / فيزا' }
            ]}
          />
        </div>

        {/* 4. Governorate */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">المحافظة</label>
          <CustomSelect
            value={draftGovernorateFilter}
            onChange={(val) => setDraftGovernorateFilter(val)}
            size="sm"
            buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-2 px-3 focus:border-amber-500"
            menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            options={[
              { value: 'all', label: 'كل المحافظات' },
              ...uniqueGovernorates.map((gov) => ({ value: gov, label: gov }))
            ]}
          />
        </div>
      </div>

      {/* 5. Date Range */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80">
        <label className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-2">النطاق الزمني</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">من تاريخ</label>
            <input
              type="date"
              value={draftStartDateFilter}
              onChange={(e) => setDraftStartDateFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-right dir-rtl cursor-pointer"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={draftEndDateFilter}
              onChange={(e) => setDraftEndDateFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-right dir-rtl cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset page to 1 whenever search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, statusFilter, paymentStatusFilter, paymentMethodFilter, governorateFilter, startDateFilter, endDateFilter, quickDateFilter]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (paymentStatusFilter !== 'all') count++;
    if (paymentMethodFilter !== 'all') count++;
    if (governorateFilter !== 'all') count++;
    if (startDateFilter || endDateFilter || quickDateFilter) count++;
    return count;
  }, [statusFilter, paymentStatusFilter, paymentMethodFilter, governorateFilter, startDateFilter, endDateFilter, quickDateFilter]);

  const handleResetFilters = () => {
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setPaymentMethodFilter('all');
    setGovernorateFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    setQuickDateFilter(null);
    setSearchTerm('');
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminOrders();
      setOrders(res);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل سجل الطلبات والفواتير من المخدم'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status');
    if (statusParam) {
      const lower = statusParam.toLowerCase();
      if (lower === 'pending') setStatusFilter('Pending');
      else if (lower === 'confirmed') setStatusFilter('Confirmed');
      else if (lower === 'preparing') setStatusFilter('Preparing');
      else if (lower === 'shipped') setStatusFilter('Shipped');
      else if (lower === 'delivered') setStatusFilter('Delivered');
      else if (lower === 'cancelled') setStatusFilter('Cancelled');
      else setStatusFilter(statusParam);
    }
  }, []);

  const uniqueGovernorates = useMemo(() => {
    const govs = new Set<string>();
    orders.forEach((o) => {
      if (o.customer?.governorate) {
        govs.add(o.customer.governorate.trim());
      }
    });
    return Array.from(govs).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // 1. Live search filter
      if (debouncedSearchTerm.trim()) {
        const term = debouncedSearchTerm.trim().toLowerCase();
        const orderId = (o.id || '').toLowerCase();
        const invoiceNum = (o.invoiceNumber || '').toLowerCase();
        const shortCode = o.id ? o.id.slice(-6).toLowerCase() : '';
        const name = (o.customer?.name || '').toLowerCase();
        const phone = (o.customer?.phone || '').toLowerCase();
        const altPhone = (o.customer?.altPhone || '').toLowerCase();
        const email = (o.customer?.email || '').toLowerCase();

        const matchesSearch =
          orderId.includes(term) ||
          invoiceNum.includes(term) ||
          shortCode.includes(term) ||
          name.includes(term) ||
          phone.includes(term) ||
          altPhone.includes(term) ||
          email.includes(term);

        if (!matchesSearch) return false;
      }

      // 2. Order Status Filter
      if (statusFilter !== 'all') {
        if (o.status !== statusFilter) return false;
      }

      // 3. Payment Status Filter
      if (paymentStatusFilter !== 'all') {
        const rawPaymentStatus = ((o as any).paymentStatus || (o.status === 'Delivered' ? 'paid' : 'pending')).toLowerCase();
        if (paymentStatusFilter === 'paid' && !['paid', 'مدفوع', 'completed', 'success'].includes(rawPaymentStatus)) {
          return false;
        }
        if (paymentStatusFilter === 'pending' && !['pending', 'معلق', 'unpaid', 'awaiting'].includes(rawPaymentStatus)) {
          return false;
        }
        if (paymentStatusFilter === 'failed' && !['failed', 'فشل', 'cancelled', 'ملغي'].includes(rawPaymentStatus)) {
          return false;
        }
      }

      // 4. Payment Method Filter
      if (paymentMethodFilter !== 'all') {
        const rawMethod = ((o as any).paymentMethod || 'cod').toLowerCase();
        if (paymentMethodFilter === 'cod' && !(rawMethod.includes('cod') || rawMethod.includes('استلام') || rawMethod.includes('نقداً') || rawMethod.includes('cash'))) {
          return false;
        }
        if (paymentMethodFilter === 'vodafone' && !(rawMethod.includes('vodafone') || rawMethod.includes('فودافون') || rawMethod.includes('كاش'))) {
          return false;
        }
        if (paymentMethodFilter === 'card' && !(rawMethod.includes('card') || rawMethod.includes('visa') || rawMethod.includes('بطاقة') || rawMethod.includes('ائتمان'))) {
          return false;
        }
      }

      // 5. Governorate Filter
      if (governorateFilter !== 'all') {
        if (o.customer?.governorate !== governorateFilter) return false;
      }

      // 6. Date Range Filter
      const rawDateStr = o.createdAt || o.date;
      if (rawDateStr) {
        const orderTime = new Date(rawDateStr).getTime();
        if (!isNaN(orderTime)) {
          if (quickDateFilter === 'today') {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            if (orderTime < startOfToday) return false;
          } else if (quickDateFilter === 'last7') {
            const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            if (orderTime < sevenDaysAgo) return false;
          } else if (quickDateFilter === 'last30') {
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            if (orderTime < thirtyDaysAgo) return false;
          } else {
            if (startDateFilter) {
              const startTime = new Date(`${startDateFilter}T00:00:00`).getTime();
              if (orderTime < startTime) return false;
            }
            if (endDateFilter) {
              const endTime = new Date(`${endDateFilter}T23:59:59`).getTime();
              if (orderTime > endTime) return false;
            }
          }
        }
      }

      return true;
    });
  }, [orders, debouncedSearchTerm, statusFilter, paymentStatusFilter, paymentMethodFilter, governorateFilter, startDateFilter, endDateFilter, quickDateFilter]);

  // Paginated Orders
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredOrders.slice(start, start + limit);
  }, [filteredOrders, currentPage, limit]);

  const totalPages = Math.ceil(filteredOrders.length / limit) || 1;

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (isSubmitting) return;

    // Same-Status Guard
    const currentOrder = orders.find(o => o.id === orderId) || (selectedOrder?.id === orderId ? selectedOrder : null);
    if (currentOrder && currentOrder.status === newStatus) {
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setSuccess('');
      const updated = await api.updateAdminOrderStatus(orderId, newStatus, statusReason || undefined);
      setSuccess(`تم تحديث حالة الطلب #${updated.invoiceNumber || orderId.slice(-6).toUpperCase()} بنجاح إلى ${newStatus}`);
      
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
      setStatusReason('');
      onRefreshAll();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'فشل تحديث حالة الشحنة، يرجى المحاولة لاحقاً'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;

    const headers = [
      'كود الطلب',
      'رقم الفاتورة',
      'اسم العميل',
      'رقم الهاتف',
      'المحافظة',
      'عنوان التوصيل',
      'إجمالي المبلغ (ج.م)',
      'حالة الطلب',
      'طريقة الدفع',
      'تاريخ الطلب'
    ];

    const rows = filteredOrders.map(o => {
      const statusText = o.status === 'Pending' ? 'بانتظار المراجعة' :
                         o.status === 'Confirmed' ? 'مؤكد' :
                         o.status === 'Preparing' ? 'قيد التجهيز' :
                         o.status === 'Shipped' ? 'جاري الشحن' :
                         o.status === 'Delivered' ? 'تم الاستلام' : 'ملغي';

      const payMethod = (o as any).paymentMethod || 'الدفع عند الاستلام';
      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-EG') : (o.date || '');

      return [
        o.id ? o.id.slice(-6).toUpperCase() : '',
        o.invoiceNumber || '',
        o.customer?.name || '',
        o.customer?.phone || '',
        o.customer?.governorate || '',
        o.customer?.address || '',
        (o as any).grandTotal || o.total || 0,
        statusText,
        payMethod,
        dateStr
      ].map(escapeCsv).join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    if (filteredOrders.length === 0) return;

    const rowsHtml = filteredOrders.map(o => {
      const statusText = o.status === 'Pending' ? 'بانتظار المراجعة' :
                         o.status === 'Confirmed' ? 'مؤكد' :
                         o.status === 'Preparing' ? 'قيد التجهيز' :
                         o.status === 'Shipped' ? 'جاري الشحن' :
                         o.status === 'Delivered' ? 'تم الاستلام' : 'ملغي';
      const payMethod = (o as any).paymentMethod || 'الدفع عند الاستلام';
      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-EG') : (o.date || '');

      return `
        <tr>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; font-weight:bold;">#${o.id ? o.id.slice(-6).toUpperCase() : ''}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${o.invoiceNumber || '-'}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">${o.customer?.name || ''}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${o.customer?.phone || ''}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">${o.customer?.governorate || ''}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:right;">${o.customer?.address || ''}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center; font-weight:bold;">${(o as any).grandTotal || o.total || 0} ج.م</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${statusText}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${payMethod}</td>
          <td style="border:1px solid #cbd5e1; padding:8px; text-align:center;">${dateStr}</td>
        </tr>
      `;
    }).join('');

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>الطلبات والفوترة</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayRightToLeft/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; text-align: right; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #1e293b; color: #ffffff; border: 1px solid #0f172a; padding: 10px; text-align: center; font-weight: bold; }
        </style>
      </head>
      <body dir="rtl">
        <h2>تقرير الطلبات والفوترة - ${new Date().toLocaleDateString('ar-EG')}</h2>
        <table>
          <thead>
            <tr>
              <th>كود الطلب</th>
              <th>رقم الفاتورة</th>
              <th>اسم العميل</th>
              <th>رقم الهاتف</th>
              <th>المحافظة</th>
              <th>العنوان</th>
              <th>إجمالي المبلغ</th>
              <th>حالة الطلب</th>
              <th>طريقة الدفع</th>
              <th>تاريخ الطلب</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintFilteredOrders = () => {
    if (filteredOrders.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableRows = filteredOrders.map(o => {
      const statusText = o.status === 'Pending' ? 'بانتظار المراجعة' :
                         o.status === 'Confirmed' ? 'مؤكد' :
                         o.status === 'Preparing' ? 'قيد التجهيز' :
                         o.status === 'Shipped' ? 'جاري الشحن' :
                         o.status === 'Delivered' ? 'تم الاستلام' : 'ملغي';
      const payMethod = (o as any).paymentMethod || 'الدفع عند الاستلام';
      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-EG') : (o.date || '');

      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">#${o.id ? o.id.slice(-6).toUpperCase() : ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${o.invoiceNumber || '-'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${o.customer?.name || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${o.customer?.phone || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${o.customer?.governorate || ''}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #d97706;">${(o as any).grandTotal || o.total || 0} ج.م</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${statusText}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${payMethod}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: center;">${dateStr}</td>
        </tr>
      `;
    }).join('');

    const totalSum = filteredOrders.reduce((sum, o) => sum + ((o as any).grandTotal || o.total || 0), 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة قائمة الطلبات المفلترة</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Cairo, sans-serif; direction: rtl; text-align: right; margin: 20px; color: #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 20px; }
          .title { font-size: 18px; font-weight: bold; color: #0f172a; }
          .meta { font-size: 12px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th { background-color: #0f172a; color: #ffffff; padding: 10px; border: 1px solid #0f172a; text-align: center; font-weight: bold; }
          td { padding: 8px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .summary { margin-top: 20px; display: flex; justify-content: space-between; align-items: center; background-color: #fffbebf5; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: bold; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">تقرير الطلبات والفوترة - لوحة التحكم</div>
            <div class="meta">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</div>
          </div>
          <div class="meta" style="text-align: left;">
            <strong>إجمالي الطلبات المعروضة:</strong> ${filteredOrders.length} طلب
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>كود الطلب</th>
              <th>رقم الفاتورة</th>
              <th>اسم العميل</th>
              <th>رقم الهاتف</th>
              <th>المحافظة</th>
              <th>إجمالي المبلغ</th>
              <th>حالة الطلب</th>
              <th>طريقة الدفع</th>
              <th>تاريخ الطلب</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="summary">
          <span>إجمالي مبالغ الطلبات المفلترة:</span>
          <span style="color: #b45309; font-size: 15px;">${totalSum.toLocaleString('ar-EG')} ج.م</span>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrint = () => {
    window.print();
  };

  const getOrderStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Pending': return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30';
      case 'Confirmed': return 'text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/40';
      case 'Preparing': return 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30';
      case 'Shipped': return 'text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30';
      case 'Delivered': return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30';
      case 'Cancelled':
      default: return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30';
    }
  };

  const getOrderStatusLabel = (status: string) => {
    switch (status) {
      case 'Pending': return 'بانتظار المراجعة';
      case 'Confirmed': return 'مؤكد بالمستودع';
      case 'Preparing': return 'قيد التجهيز';
      case 'Shipped': return 'خارج للتوصيل';
      case 'Delivered': return 'تم الاستلام';
      case 'Cancelled': return 'طلب ملغي';
      default: return status;
    }
  };

  const getPaymentStatusBadgeClass = (order: Order) => {
    const rawPaymentStatus = ((order as any).paymentStatus || (order.status === 'Delivered' ? 'paid' : 'pending')).toLowerCase();
    if (['paid', 'مدفوع', 'completed', 'success'].includes(rawPaymentStatus)) {
      return 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30';
    }
    if (['failed', 'فشل', 'cancelled', 'ملغي'].includes(rawPaymentStatus)) {
      return 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30';
    }
    return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30';
  };

  const getPaymentStatusLabel = (order: Order) => {
    const rawPaymentStatus = ((order as any).paymentStatus || (order.status === 'Delivered' ? 'paid' : 'pending')).toLowerCase();
    if (['paid', 'مدفوع', 'completed', 'success'].includes(rawPaymentStatus)) {
      return 'مدفوع بالكامل';
    }
    if (['failed', 'فشل', 'cancelled', 'ملغي'].includes(rawPaymentStatus)) {
      return 'دفع ملغي';
    }
    return 'معلق (COD)';
  };

  if (loading) {
    return <AdminLoading message="جارٍ تجميع طلبات الشحن النشطة ومستندات الفوترة..." />;
  }

  const deliveredCount = orders.filter(o => o.status === 'Delivered').length;
  const inProgressCount = orders.filter(o => ['Pending', 'Confirmed', 'Preparing', 'Shipped'].includes(o.status)).length;
  const cancelledCount = orders.filter(o => o.status === 'Cancelled').length;

  return (
    <div className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-2xl font-sans space-y-6 dir-rtl text-right" dir="rtl" id="admin-orders-panel">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة الطلبات والشحن والفوترة"
        description="متابعة وتحديث حالات الطلبات، الفواتير، الشحن الميداني وطرق الدفع"
        icon={ClipboardList}
        badge={<AdminBadge variant="amber">{orders.length} طلب</AdminBadge>}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Button */}
            <AdminFilterButton
              onClick={() => {
                if (isFilterDrawerOpen) {
                  setIsFilterDrawerOpen(false);
                } else {
                  handleOpenDrawer();
                }
              }}
              active={activeFilterCount > 0}
              label={activeFilterCount > 0 ? `الفلاتر (${activeFilterCount})` : 'الفلاتر المتقدمة'}
            />

            {/* Export Dropdown */}
            <div className="relative">
              <AdminButton
                variant="secondary"
                size="sm"
                disabled={filteredOrders.length === 0}
                onClick={() => setShowExportMenu(!showExportMenu)}
                icon={Download}
              >
                <span>تصدير</span>
                <ChevronDown className="w-3.5 h-3.5 mr-0.5 text-slate-400" />
              </AdminButton>

              {showExportMenu && filteredOrders.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute left-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/20 rounded-xl shadow-xl dark:shadow-2xl shadow-slate-900/10 dark:shadow-slate-950/40 z-20 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        handleExportExcel();
                      }}
                      className="w-full text-right px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>تصدير إكسيل (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportMenu(false);
                        handleExportCSV();
                      }}
                      className="w-full text-right px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-2 font-medium cursor-pointer transition-colors border-t border-slate-100 dark:border-slate-800/80"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>تصدير CSV (.csv)</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Print Button */}
            <AdminButton
              variant="outline"
              size="sm"
              disabled={filteredOrders.length === 0}
              onClick={handlePrintFilteredOrders}
              icon={Printer}
            >
              طباعة
            </AdminButton>
          </div>
        }
      />

      {/* Notifications Toast */}
      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-400 font-bold flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-400 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-700 dark:text-rose-400 hover:text-rose-950 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="إجمالي الطلبات"
          value={orders.length}
          icon={Receipt}
          subtitle="كافة الطلبات المسجلة"
        />
        <AdminStatCard
          title="تم التوصيل والدفع"
          value={deliveredCount}
          icon={CheckCircle2}
          trend={{ value: `${orders.length ? Math.round((deliveredCount / orders.length) * 100) : 0}%`, isPositive: true, label: 'مكتمل' }}
        />
        <AdminStatCard
          title="قيد المعالجة والتجهيز"
          value={inProgressCount}
          icon={Clock}
          trend={{ value: `${inProgressCount} طلبات`, isPositive: true, label: 'نشطة' }}
        />
        <AdminStatCard
          title="طلبات ملغية"
          value={cancelledCount}
          icon={XCircle}
          trend={{ value: `${cancelledCount} طلبات`, isPositive: false, label: 'ملغي' }}
        />
      </div>

      {/* Main Orders Container */}
      <AdminCard className="space-y-4">
        {/* Live Search Input Bar */}
        <AdminSearchInput
          value={searchTerm}
          onChange={(val) => setSearchTerm(val)}
          placeholder="البحث الفوري برقم الفاتورة، كود الطلب، اسم العميل، الهاتف أو البريد..."
        />

        {/* Quick Filter Chips Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none dir-rtl">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-1">اختصارات:</span>
          
          <button
            type="button"
            onClick={() => {
              setStartDateFilter('');
              setEndDateFilter('');
              setQuickDateFilter(quickDateFilter === 'today' ? null : 'today');
            }}
            className={quickDateFilter === 'today'
              ? 'bg-amber-500 text-slate-950 border border-amber-400 font-black text-[11px] px-2.5 py-1 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap'
              : 'bg-white dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-xs'
            }
          >
            اليوم
          </button>

          <button
            type="button"
            onClick={() => {
              setStartDateFilter('');
              setEndDateFilter('');
              setQuickDateFilter(quickDateFilter === 'last7' ? null : 'last7');
            }}
            className={quickDateFilter === 'last7'
              ? 'bg-amber-500 text-slate-950 border border-amber-400 font-black text-[11px] px-2.5 py-1 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap'
              : 'bg-white dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-xs'
            }
          >
            آخر 7 أيام
          </button>

          <button
            type="button"
            onClick={() => {
              setStartDateFilter('');
              setEndDateFilter('');
              setQuickDateFilter(quickDateFilter === 'last30' ? null : 'last30');
            }}
            className={quickDateFilter === 'last30'
              ? 'bg-amber-500 text-slate-950 border border-amber-400 font-black text-[11px] px-2.5 py-1 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap'
              : 'bg-white dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-xs'
            }
          >
            آخر 30 يوم
          </button>

          <span className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-0.5 shrink-0"></span>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'Delivered' ? 'all' : 'Delivered')}
            className={statusFilter === 'Delivered'
              ? 'bg-amber-500 text-slate-950 border border-amber-400 font-black text-[11px] px-2.5 py-1 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap'
              : 'bg-white dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-xs'
            }
          >
            تم التوصيل
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'Cancelled' ? 'all' : 'Cancelled')}
            className={statusFilter === 'Cancelled'
              ? 'bg-amber-500 text-slate-950 border border-amber-400 font-black text-[11px] px-2.5 py-1 rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap'
              : 'bg-white dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200 text-[11px] font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-xs'
            }
          >
            ملغية
          </button>
        </div>

        {/* ORDERS CARD LIST */}
        {paginatedOrders.length > 0 ? (
          <div className="space-y-3.5">
            {paginatedOrders.map((o) => {
              const invoiceDisplay = o.invoiceNumber || o.id.slice(-6).toUpperCase();
              return (
                <div
                  key={o.id}
                  className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 hover:border-amber-500/40 bg-white dark:bg-slate-950/60 hover:bg-slate-50/50 dark:hover:bg-slate-950 transition-all shadow-xs flex flex-col gap-3"
                >
                  {/* Card Header Row: Invoice Number, Order Date, Status Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/70 pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Invoice Number */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg">
                        <Receipt className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500 shrink-0" />
                        <span className="text-xs font-black text-slate-900 dark:text-white font-mono">
                          #{highlightText(invoiceDisplay, debouncedSearchTerm)}
                        </span>
                      </div>

                      {/* Order Status badge */}
                      <span className={`text-[10px] font-bold border rounded-lg px-2.5 py-1 ${getOrderStatusBadgeClass(o.status)}`}>
                        {getOrderStatusLabel(o.status)}
                      </span>

                      {/* Payment Status badge */}
                      <span className={`text-[10px] font-bold border rounded-lg px-2.5 py-1 ${getPaymentStatusBadgeClass(o)}`}>
                        {getPaymentStatusLabel(o)}
                      </span>
                    </div>

                    {/* Order Date */}
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono" dir="ltr">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                      <span>
                        {new Date(o.createdAt || o.date || new Date()).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Main Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700 dark:text-slate-300 my-0.5">
                    {/* Customer Name */}
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">اسم العميل</span>
                        <strong className="text-slate-900 dark:text-white font-bold">{highlightText(o.customer?.name, debouncedSearchTerm) || 'غير محدد'}</strong>
                      </div>
                    </div>

                    {/* Governorate */}
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">المحافظة</span>
                        <strong className="text-slate-800 dark:text-slate-200 font-semibold">{o.customer?.governorate || 'غير محددة'}</strong>
                      </div>
                    </div>

                    {/* Order Total */}
                    <div className="flex items-center gap-2 sm:justify-end">
                      <div className="sm:text-left">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">إجمالي الطلب</span>
                        <strong className="text-amber-600 dark:text-amber-400 font-black text-sm">{(o as any).grandTotal || o.total || 0} ج.م</strong>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Row: Short Order Summary & View Details Button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/70">
                    {/* Short Order Summary */}
                    <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 min-w-0 flex-1">
                      <Package className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                      <p className="line-clamp-1 leading-relaxed text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-bold text-slate-800 dark:text-slate-200">ملخص الطلب: </span>
                        {o.items && o.items.length > 0
                          ? `${o.items.length} عنصر (${o.items.map(i => `${i.productTitle} × ${i.quantity}`).join('، ')})`
                          : 'لا توجد أجهزة مضافة'}
                      </p>
                    </div>

                    {/* View Details button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrder(o);
                        setIsDetailsModalOpen(true);
                      }}
                      className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 self-end sm:self-auto"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض التفاصيل</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (activeFilterCount > 0 || debouncedSearchTerm.trim()) ? (
          <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800/60 space-y-3">
            <Filter className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-300">لا توجد طلبات تطابق معايير البحث والفلترة المحددة</p>
            <p className="text-[11px] text-slate-500">جرب تغيير الفلاتر المختارة أو مسح كلمات البحث للوصول لنتائج أفضل.</p>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 mt-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 font-bold cursor-pointer underline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              مسح الفلاتر وإعادة الضبط
            </button>
          </div>
        ) : (
          <div className="text-center py-16 px-4 bg-slate-50 dark:bg-slate-950/30 rounded-2xl border border-slate-200 dark:border-slate-800/40 space-y-2">
            <ClipboardList className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
            <p className="text-xs text-slate-600 dark:text-slate-400 font-bold">لا توجد أية طلبات سابقة في النظام حتى الآن.</p>
          </div>
        )}

        {/* PAGINATION FOOTER */}
        <AdminTablePagination
          page={currentPage}
          totalPages={totalPages}
          total={filteredOrders.length}
          limit={limit}
          onPageChange={(p) => setCurrentPage(p)}
          onLimitChange={(l) => { setLimit(l); setCurrentPage(1); }}
        />
      </AdminCard>

      {/* FULL ORDER DETAILS MODAL */}
      {selectedOrder && isDetailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200 dir-rtl text-right">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    تفاصيل الطلب #{selectedOrder.invoiceNumber || selectedOrder.id.slice(-6).toUpperCase()}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  تاريخ الطلب: {new Date(selectedOrder.createdAt || selectedOrder.date || new Date()).toLocaleString('ar-EG')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoice(true)}
                  className="flex items-center gap-1.5 py-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة فاتورة COD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Status stepper advance buttons */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-black text-amber-700 dark:text-amber-400 block">تحديث وتسيير مرحلة الشحن والتوصيل</span>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  {selectedOrder.status === 'Pending' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange(selectedOrder.id, 'Confirmed')}
                      className="py-1.5 px-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl cursor-pointer transition-colors shadow-xs"
                    >
                      {isSubmitting ? 'جاري التحديث...' : 'تأكيد هاتفي (Confirmed)'}
                    </button>
                  )}
                  {selectedOrder.status === 'Confirmed' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange(selectedOrder.id, 'Preparing')}
                      className="py-1.5 px-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl cursor-pointer transition-colors"
                    >
                      {isSubmitting ? 'جاري التحديث...' : 'تغليف وتحضير (Preparing)'}
                    </button>
                  )}
                  {selectedOrder.status === 'Preparing' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange(selectedOrder.id, 'Shipped')}
                      className="py-1.5 px-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl cursor-pointer transition-colors"
                    >
                      {isSubmitting ? 'جاري التحديث...' : 'شحن وتسليم للمندوب (Shipped)'}
                    </button>
                  )}
                  {selectedOrder.status === 'Shipped' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange(selectedOrder.id, 'Delivered')}
                      className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl cursor-pointer transition-colors"
                    >
                      {isSubmitting ? 'جاري التحديث...' : 'تم تسليم الشحنة وتحصيل المال (Delivered)'}
                    </button>
                  )}
                  {selectedOrder.status !== 'Delivered' && selectedOrder.status !== 'Cancelled' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange(selectedOrder.id, 'Cancelled')}
                      className="py-1.5 px-3.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl cursor-pointer transition-colors"
                    >
                      {isSubmitting ? 'جاري التحديث...' : 'إلغاء الطلب (Cancelled)'}
                    </button>
                  )}
                </div>

                <div className="pt-2">
                  <label className="text-[10px] text-slate-600 dark:text-slate-400 block mb-1">سبب التحديث أو ملاحظات المندوب (اختياري)</label>
                  <input
                    type="text"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="مثل: المشتري مغلق الهاتف، يرجى إعادة الاتصال لاحقاً"
                    className="w-full text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Items Summary details */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-800 dark:text-slate-300 block">الأجهزة والقطع المطلوبة ({selectedOrder.items?.length || 0})</span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedOrder.items?.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="text-right">
                        <span className="text-slate-900 dark:text-white font-bold block">{it.productTitle}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">العدد: {it.quantity} حبة {it.variantInfo ? `| ${it.variantInfo}` : ''}</span>
                      </div>
                      <span className="font-bold text-amber-600 dark:text-amber-500">{it.price * it.quantity} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer full details */}
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-4">
                <span className="text-xs font-black text-amber-700 dark:text-amber-400 block">بيانات العميل وعنوان شحن البيت</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/80">
                  <div>اسم العميل: <strong className="text-slate-900 dark:text-white font-bold">{selectedOrder.customer.name}</strong></div>
                  <div>الهاتف: <strong className="text-slate-900 dark:text-white font-mono dir-ltr inline-block">{selectedOrder.customer.phone}</strong></div>
                  {selectedOrder.customer.altPhone && <div>هاتف بديل: <strong className="text-slate-900 dark:text-white font-mono dir-ltr inline-block">{selectedOrder.customer.altPhone}</strong></div>}
                  <div>المحافظة والحي: <strong className="text-slate-900 dark:text-white">{selectedOrder.customer.governorate}، {selectedOrder.customer.city}</strong></div>
                  <div className="col-span-1 sm:col-span-2">العنوان التفصيلي: <strong className="text-slate-900 dark:text-white leading-relaxed">{selectedOrder.customer.address}</strong></div>
                  {selectedOrder.customer.email && <div className="col-span-1 sm:col-span-2">البريد الإلكتروني: <strong className="text-slate-900 dark:text-white font-mono">{selectedOrder.customer.email}</strong></div>}
                  {selectedOrder.customer.notes && (
                    <div className="col-span-1 sm:col-span-2 p-2.5 bg-amber-50 dark:bg-amber-500/5 rounded-xl border border-amber-200 dark:border-amber-500/10 text-[11px] text-amber-900 dark:text-amber-300 mt-1">
                      ملاحظات العميل: {selectedOrder.customer.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable commercial invoice overlay sheet */}
      {selectedOrder && showInvoice && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 flex items-center justify-center p-4 print:p-0 overflow-y-auto" id="invoice-modal">
          <div className="bg-white text-slate-950 rounded-2xl w-full max-w-2xl p-8 shadow-2xl relative border border-gray-200 print:border-none print:shadow-none print:rounded-none">
            {/* Modal actions */}
            <div className="absolute top-4 left-4 flex gap-2 print:hidden">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 py-1.5 px-3 bg-amber-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-amber-400 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                تأكيد وطباعة الفاتورة الكلية
              </button>
              <button
                onClick={() => setShowInvoice(false)}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Printable Area content */}
            <div className="text-right font-sans" id="printable-invoice">
              {/* Invoice Brand header */}
              <div className="flex justify-between items-start border-b-2 border-gray-200 pb-5 mb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">نخبة الأجهزة المنزلية الكبرى</h1>
                  <p className="text-xs text-gray-500 mt-1">المنصة المعتمدة الموثوقة للأجهزة المنزلية في مصر</p>
                </div>
                <div className="text-left font-mono text-xs text-gray-500">
                  <div className="font-bold text-slate-900 text-sm">فاتورة بيع COD</div>
                  <div>التاريخ: {new Date(selectedOrder.createdAt || selectedOrder.date || new Date()).toLocaleDateString('ar-EG')}</div>
                  <div>رقم الفاتورة: #{selectedOrder.invoiceNumber || selectedOrder.id.slice(-6).toUpperCase()}</div>
                </div>
              </div>

              {/* Invoice Shipping address details */}
              <div className="grid grid-cols-2 gap-4 mb-6 text-xs border border-gray-100 p-4 rounded-xl bg-gray-50/50">
                <div>
                  <h4 className="font-black text-slate-950 mb-1.5">بيانات شحن وتوصيل الأجهزة</h4>
                  <p className="font-semibold">{selectedOrder.customer.name}</p>
                  <p className="mt-1">{selectedOrder.customer.governorate}، {selectedOrder.customer.city}</p>
                  <p className="mt-1">{selectedOrder.customer.address}</p>
                </div>
                <div className="text-left">
                  <h4 className="font-black text-slate-950 mb-1.5">طريقة الاتصال والتوصيل</h4>
                  <p className="font-mono">هاتف أساسي: {selectedOrder.customer.phone}</p>
                  {selectedOrder.customer.altPhone && <p className="font-mono mt-1">هاتف بديل: {selectedOrder.customer.altPhone}</p>}
                  <p className="mt-1 font-bold text-emerald-600">طريقة الدفع: نقداً عند الاستلام بالكامل</p>
                </div>
              </div>

              {/* Items Table list */}
              <table className="w-full text-xs text-right border-collapse border border-gray-150 mb-6">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-150 font-bold">
                    <th className="p-3">اسم الجهاز ومواصفاته</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3 text-left">السعر المفرد</th>
                    <th className="p-3 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150">
                  {selectedOrder.items?.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-3">
                        <span className="font-bold block text-slate-900">{it.productTitle}</span>
                        {it.variantInfo && <span className="text-[10px] text-gray-500">المواصفة: {it.variantInfo}</span>}
                      </td>
                      <td className="p-3 text-center font-bold">{it.quantity}</td>
                      <td className="p-3 text-left font-mono">{it.price} ج.م</td>
                      <td className="p-3 text-left font-mono font-bold">{it.price * it.quantity} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Invoice Calculations summary footer */}
              <div className="w-64 mr-auto flex flex-col gap-2 border border-gray-150 p-4 rounded-xl bg-gray-50 text-xs">
                {selectedOrder.couponCode && (
                  <div className="flex justify-between font-bold text-green-700">
                    <span>خصم الكوبون ({selectedOrder.couponCode}):</span>
                    <span>-{selectedOrder.discountAmount} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>تكلفة الشحن وتأمين النقل البري:</span>
                  <span>50.00 ج.م</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-gray-250">
                  <span>مجموع الفاتورة المطلوب سداده:</span>
                  <span>{(selectedOrder as any).grandTotal || selectedOrder.total} ج.م</span>
                </div>
              </div>

              {/* Signatures row */}
              <div className="flex justify-between items-center text-[10px] text-gray-500 mt-12 pt-6 border-t border-gray-150">
                <span>توقيع مندوب الشحن والتسليم: ...................................</span>
                <span>توقيع العميل المستلم للجهاز: ...................................</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters Drawer / Modal */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 dir-rtl">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setIsFilterDrawerOpen(false)}
          />

          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col z-10 text-right max-h-[90vh] overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
              <div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                  <h3 className="text-base font-black text-slate-900 dark:text-white">فلترة الطلبات المتقدمة</h3>
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  عدد الفلاتر المفعلة: <span className="text-amber-600 dark:text-amber-400 font-bold">{activeFilterCount}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-4 overflow-y-auto text-right">
              {renderFilterFormBody()}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handleApplyDraftFilters}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10 text-center"
              >
                تطبيق
              </button>
              <button
                type="button"
                onClick={handleResetDraftFilters}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer text-center"
              >
                مسح الكل
              </button>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer text-center"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
