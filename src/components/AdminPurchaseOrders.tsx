import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Truck,
  DollarSign,
  Calendar,
  Edit,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  X,
  Copy,
  Check,
  PackageCheck,
  ChevronRight,
  ArrowRight,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  Send,
  Boxes,
  ScanLine
} from 'lucide-react';
import { PurchaseOrder, PurchaseOrderInput, PurchaseOrderItem, PurchaseOrderStatus, Supplier, Product } from '../types.js';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { CustomSelect } from './CustomSelect.js';
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
  AdminBadge,
  AdminEmptyState,
  AdminLoading,
  AdminSearchInput,
  AdminButton
} from './AdminUIComponents.js';
import { AdminTablePagination } from './AdminTableComponents.js';

interface AdminPurchaseOrdersProps {
  onRefreshAll?: () => void;
}

export default function AdminPurchaseOrders({ onRefreshAll }: AdminPurchaseOrdersProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'costDesc' | 'costAsc'>('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    inTransit: 0,
    received: 0,
    cancelled: 0,
    totalValueCost: 0
  });

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);

  // Form State for Create / Edit
  const [formData, setFormData] = useState<PurchaseOrderInput>({
    supplierId: '',
    items: [],
    discount: 0,
    shippingCost: 0,
    notes: '',
    expectedDate: ''
  });

  // Items State in Form
  const [formItems, setFormItems] = useState<{
    productId: string;
    variantId?: string;
    quantityOrdered: number;
    unitCost: number;
  }[]>([]);

  // Receiving Quantities State
  const [receiveInputs, setReceiveInputs] = useState<Record<string, number>>({});

  // Copy PO Number State
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Barcode Scan Quick Add in PO Modal
  const [scanPoBarcode, setScanPoBarcode] = useState('');
  const [scanPoError, setScanPoError] = useState('');

  const handleScanBarcodeToPO = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = scanPoBarcode.trim();
    if (!clean) return;
    setScanPoError('');

    try {
      let matchedData: any = null;

      if (clean.toUpperCase().startsWith('QR-')) {
        try {
          const qrRes = await api.getQrCodeInfo(clean);
          if (qrRes && qrRes.success && qrRes.data) {
            matchedData = qrRes.data;
          }
        } catch (_) {}
      }

      if (!matchedData) {
        try {
          const bcRes = await api.getBarcodeInfo(clean);
          if (bcRes && bcRes.success && bcRes.data) {
            matchedData = bcRes.data;
          }
        } catch (_) {
          const qrRes = await api.getQrCodeInfo(clean);
          if (qrRes && qrRes.success && qrRes.data) {
            matchedData = qrRes.data;
          }
        }
      }

      if (matchedData) {
        const pId = matchedData.productId;
        const vId = matchedData.variantId;
        const unitCost = matchedData.costPrice || matchedData.product?.costPrice || matchedData.price || 0;

        // Check if existing item in formItems
        const existingIdx = formItems.findIndex(i => i.productId === pId && (vId ? i.variantId === vId : !i.variantId));
        if (existingIdx !== -1) {
          const updated = [...formItems];
          updated[existingIdx].quantityOrdered += 1;
          setFormItems(updated);
        } else {
          setFormItems([
            ...formItems,
            {
              productId: pId,
              variantId: vId,
              quantityOrdered: 1,
              unitCost: unitCost
            }
          ]);
        }
        setScanPoBarcode('');
      } else {
        setScanPoError(`لم يتم العثور على الصنف بالباركود أو QR (${clean})`);
      }
    } catch (err: any) {
      setScanPoError(getFriendlyErrorMessage(err, 'لم يتم العثور على المنتج بالباركود أو QR'));
    }
  };

  // Load Data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [poRes, supRes, prodRes] = await Promise.all([
        api.getPurchaseOrders({
          search: searchQuery,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          supplierId: supplierFilter !== 'all' ? supplierFilter : undefined,
          startDate: startDateFilter || undefined,
          endDate: endDateFilter || undefined
        }),
        api.getSuppliers({ status: 'active' }),
        api.getProducts()
      ]);

      setPurchaseOrders(poRes.purchaseOrders || []);
      setStats(poRes.stats || {
        total: 0,
        draft: 0,
        inTransit: 0,
        received: 0,
        cancelled: 0,
        totalValueCost: 0
      });
      setSuppliers(supRes.suppliers || []);
      setProducts(prodRes || []);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء تحميل بيانات أوامر الشراء'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchQuery, statusFilter, supplierFilter, startDateFilter, endDateFilter]);

  // Automatically reset to page 1 whenever search, status, supplier, date filters, or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, supplierFilter, startDateFilter, endDateFilter, sortBy]);

  // Client-side sorting & pagination
  const sortedPurchaseOrders = useMemo(() => {
    return [...purchaseOrders].sort((a, b) => {
      if (sortBy === 'oldest') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === 'costDesc') {
        return (b.totalCost || 0) - (a.totalCost || 0);
      }
      if (sortBy === 'costAsc') {
        return (a.totalCost || 0) - (b.totalCost || 0);
      }
      // Default 'newest'
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [purchaseOrders, sortBy]);

  const paginatedPurchaseOrders = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return sortedPurchaseOrders.slice(start, start + limit);
  }, [sortedPurchaseOrders, currentPage, limit]);

  const totalPages = Math.ceil(sortedPurchaseOrders.length / limit) || 1;

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
    if (onRefreshAll) onRefreshAll();
  };

  const handleCopyPoNumber = (poNumber: string, id: string) => {
    navigator.clipboard.writeText(poNumber);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const activeSuppliers = suppliers.filter(s => s.status === 'active');
    setFormData({
      supplierId: activeSuppliers.length > 0 ? activeSuppliers[0].id : '',
      items: [],
      discount: 0,
      shippingCost: 0,
      notes: '',
      expectedDate: ''
    });
    setFormItems([
      {
        productId: products.length > 0 ? products[0].id : '',
        variantId: products.length > 0 && products[0].variants && products[0].variants.length > 0 ? products[0].variants[0].id : undefined,
        quantityOrdered: 1,
        unitCost: products.length > 0 ? (products[0].costPrice || 0) : 0
      }
    ]);
    setEditingPO(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal (for Draft)
  const handleOpenEditModal = (po: PurchaseOrder) => {
    if (po.status !== 'draft') {
      alert('يمكن تعديل مسودة أمر الشراء فقط');
      return;
    }
    setEditingPO(po);
    setFormData({
      supplierId: po.supplierId,
      items: po.items.map(i => ({
        productId: i.productId,
        variantId: i.variantId,
        quantityOrdered: i.quantityOrdered,
        unitCost: i.unitCost
      })),
      discount: po.discount || 0,
      shippingCost: po.shippingCost || 0,
      notes: po.notes || '',
      expectedDate: po.expectedDate || ''
    });
    setFormItems(po.items.map(i => ({
      productId: i.productId,
      variantId: i.variantId,
      quantityOrdered: i.quantityOrdered,
      unitCost: i.unitCost
    })));
    setIsCreateModalOpen(true);
  };

  // Form Item Row Handlers
  const handleAddItemRow = () => {
    if (products.length === 0) return;
    const defaultProd = products[0];
    const defaultVar = defaultProd.variants && defaultProd.variants.length > 0 ? defaultProd.variants[0].id : undefined;
    setFormItems([
      ...formItems,
      {
        productId: defaultProd.id,
        variantId: defaultVar,
        quantityOrdered: 1,
        unitCost: defaultProd.costPrice || 0
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (formItems.length <= 1) {
      alert('أمر الشراء يجب أن يحتوي على صنف واحد على الأقل');
      return;
    }
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...formItems];
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      const defaultVar = prod && prod.variants && prod.variants.length > 0 ? prod.variants[0].id : undefined;
      const defaultCost = prod ? (prod.costPrice || 0) : 0;
      updated[index] = {
        productId: value,
        variantId: defaultVar,
        quantityOrdered: updated[index].quantityOrdered || 1,
        unitCost: defaultCost
      };
    } else if (field === 'variantId') {
      const prod = products.find(p => p.id === updated[index].productId);
      const v = prod?.variants?.find(v => v.id === value);
      const vCost = v?.costPrice !== undefined ? v.costPrice : (prod?.costPrice || 0);
      updated[index] = {
        ...updated[index],
        variantId: value || undefined,
        unitCost: vCost
      };
    } else if (field === 'quantityOrdered') {
      const clean = sanitizeNumericInput(String(value), 'positive_integer');
      updated[index] = {
        ...updated[index],
        quantityOrdered: clean === '' ? ('' as any) : Number(clean)
      };
    } else if (field === 'unitCost') {
      const clean = sanitizeNumericInput(String(value), 'non_negative_decimal');
      updated[index] = {
        ...updated[index],
        unitCost: clean === '' ? ('' as any) : Number(clean)
      };
    }
    setFormItems(updated);
  };

  // Calculate Form Totals
  const calculateFormTotals = () => {
    const subtotal = formItems.reduce((sum, item) => {
      const q = Number(item.quantityOrdered) || 0;
      const c = Number(item.unitCost) || 0;
      return sum + (q * c);
    }, 0);
    const discount = Math.max(0, Number(formData.discount) || 0);
    const shippingCost = Math.max(0, Number(formData.shippingCost) || 0);
    const totalCost = Math.max(0, subtotal - discount + shippingCost);
    return { subtotal, totalCost };
  };

  // Save PO (Create or Edit)
  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierId) {
      alert('يرجى تحديد المورد');
      return;
    }
    if (formItems.length === 0) {
      alert('يرجى إضافة صنف واحد على الأقل لأمر الشراء');
      return;
    }

    // Strict validation for all PO items
    for (let i = 0; i < formItems.length; i++) {
      const item = formItems[i];
      if (!item.productId) {
        alert(`يرجى تحديد المنتج للصنف رقم ${i + 1}`);
        return;
      }
      const qtyRes = validateNumericValue(item.quantityOrdered, 'positive_integer', {
        required: true,
        min: 1,
        fieldNameArabic: `كمية الصنف رقم ${i + 1}`
      });
      if (!qtyRes.valid) {
        alert(qtyRes.error || `كمية الصنف رقم ${i + 1} غير صالحة`);
        return;
      }
      const costRes = validateNumericValue(item.unitCost, 'non_negative_decimal', {
        required: true,
        min: 0,
        fieldNameArabic: `سعر تكلفة الصنف رقم ${i + 1}`
      });
      if (!costRes.valid) {
        alert(costRes.error || `سعر تكلفة الصنف رقم ${i + 1} غير صالح`);
        return;
      }
    }

    // Strict validation for discount and shipping
    if (formData.discount !== undefined && formData.discount !== null && String(formData.discount).trim() !== '') {
      const discRes = validateNumericValue(formData.discount, 'non_negative_decimal', {
        min: 0,
        fieldNameArabic: 'الخصم الإجمالي'
      });
      if (!discRes.valid) {
        alert(discRes.error || 'الخصم الإجمالي غير صالح');
        return;
      }
    }

    if (formData.shippingCost !== undefined && formData.shippingCost !== null && String(formData.shippingCost).trim() !== '') {
      const shipRes = validateNumericValue(formData.shippingCost, 'non_negative_decimal', {
        min: 0,
        fieldNameArabic: 'مصاريف الشحن'
      });
      if (!shipRes.valid) {
        alert(shipRes.error || 'مصاريف الشحن غير صالحة');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const poData: PurchaseOrderInput = {
        supplierId: formData.supplierId,
        items: formItems.map(i => ({
          productId: i.productId,
          variantId: i.variantId,
          quantityOrdered: Number(i.quantityOrdered) || 1,
          unitCost: Number(i.unitCost) || 0
        })),
        discount: Number(formData.discount) || 0,
        shippingCost: Number(formData.shippingCost) || 0,
        notes: formData.notes ? formData.notes.trim() : '',
        expectedDate: formData.expectedDate || undefined
      };

      if (editingPO) {
        const res = await api.updatePurchaseOrder(editingPO.id, poData);
        setSuccessMsg(res.message || 'تم تحديث أمر الشراء بنجاح');
      } else {
        const res = await api.createPurchaseOrder(poData);
        setSuccessMsg(res.message || 'تم إنشاء أمر الشراء بنجاح');
      }

      setIsCreateModalOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حفظ أمر الشراء'));
    } finally {
      setLoading(false);
    }
  };

  // Status Change Handler
  const handleStatusChange = async (poId: string, newStatus: PurchaseOrderStatus) => {
    const statusLabels: Record<string, string> = {
      ordered: 'تأكيد وإرسال الطلب للمورد',
      cancelled: 'إلغاء أمر الشراء'
    };

    if (!confirm(`هل أنت تأكد من ${statusLabels[newStatus] || newStatus}؟`)) return;

    try {
      setLoading(true);
      const res = await api.updatePurchaseOrderStatus(poId, newStatus);
      setSuccessMsg(res.message || 'تم تحديث حالة أمر الشراء');
      fetchData();
      if (viewingPO?.id === poId) {
        setViewingPO(res.purchaseOrder);
      }
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err, 'فشل تغيير حالة أمر الشراء'));
    } finally {
      setLoading(false);
    }
  };

  // Open Receive Modal
  const handleOpenReceiveModal = (po: PurchaseOrder) => {
    if (po.status !== 'ordered' && po.status !== 'partially_received') {
      alert('يمكن استلام أوامر الشراء المؤكدة أو المستلمة جزئياً فقط');
      return;
    }
    setReceivingPO(po);

    // Initialize receiveInputs with remaining quantities
    const initialInputs: Record<string, number> = {};
    po.items.forEach(item => {
      const remaining = item.quantityOrdered - item.quantityReceived;
      initialInputs[item.id] = remaining > 0 ? remaining : 0;
    });
    setReceiveInputs(initialInputs);
  };

  // Quick Set All Remaining
  const handleSetAllRemaining = () => {
    if (!receivingPO) return;
    const inputs: Record<string, number> = {};
    receivingPO.items.forEach(item => {
      const remaining = item.quantityOrdered - item.quantityReceived;
      inputs[item.id] = remaining > 0 ? remaining : 0;
    });
    setReceiveInputs(inputs);
  };

  // Clear All Receive Inputs
  const handleClearReceiveInputs = () => {
    if (!receivingPO) return;
    const inputs: Record<string, number> = {};
    receivingPO.items.forEach(item => {
      inputs[item.id] = 0;
    });
    setReceiveInputs(inputs);
  };

  // Submit Receive Items
  const handleSubmitReceive = async () => {
    if (!receivingPO) return;

    // Validate all receive inputs strictly
    for (const item of receivingPO.items) {
      const remaining = item.quantityOrdered - item.quantityReceived;
      const rawVal = receiveInputs[item.id];
      if (rawVal !== undefined && rawVal !== null && rawVal !== 0) {
        const valRes = validateNumericValue(rawVal, 'non_negative_integer', {
          min: 0,
          max: remaining,
          fieldNameArabic: `كمية استلام ${item.productTitle}`
        });
        if (!valRes.valid) {
          alert(valRes.error || `كمية استلام ${item.productTitle} غير صالحة`);
          return;
        }
      }
    }

    const itemsToSubmit = Object.entries(receiveInputs)
      .map(([itemId, qty]) => ({ itemId, quantityToReceive: Number(qty) || 0 }))
      .filter(i => i.quantityToReceive > 0);

    if (itemsToSubmit.length === 0) {
      alert('يرجى إدخال كمية استلام أكبر من الصفر لصنف واحد على الأقل');
      return;
    }

    try {
      setLoading(true);
      const res = await api.receivePurchaseOrderItems(receivingPO.id, itemsToSubmit);
      setSuccessMsg(res.message || 'تم تسجيل الشحنة وتحديث المخزون بنجاح');
      setReceivingPO(null);
      fetchData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(getFriendlyErrorMessage(err, 'فشل تسجيل الشحنة المستلمة'));
    } finally {
      setLoading(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'draft':
        return <AdminBadge variant="amber" icon={Clock}>مسودة</AdminBadge>;
      case 'ordered':
        return <AdminBadge variant="info" icon={Truck}>مؤكد / قيد الشحن</AdminBadge>;
      case 'partially_received':
        return <AdminBadge variant="purple" icon={Package}>مستلم جزئياً</AdminBadge>;
      case 'received':
        return <AdminBadge variant="success" icon={CheckCircle2}>مكتمل الاستلام</AdminBadge>;
      case 'cancelled':
        return <AdminBadge variant="danger" icon={XCircle}>ملغي</AdminBadge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 font-sans text-right dir-rtl" dir="rtl">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة أوامر الشراء والتوريد (PO)"
        description="ربط المشتريات بالموردين وتأكيد طلبات التوريد وتحديث المخزون التلقائي عند الاستلام"
        icon={FileText}
        badge={<AdminBadge variant="amber">{stats.total} أمر شراء</AdminBadge>}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <AdminButton
              variant="primary"
              size="md"
              icon={Plus}
              onClick={handleOpenCreateModal}
            >
              أمر شراء جديد
            </AdminButton>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-500 dark:text-amber-400' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 rounded-xl flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-400 rounded-xl flex items-center justify-between text-xs font-bold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Stats Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminStatCard
          title="إجمالي الأوامر"
          value={stats.total}
          icon={FileText}
          subtitle="كل أوامر الشراء المسجلة"
        />
        <AdminStatCard
          title="مسودة"
          value={stats.draft}
          icon={Clock}
          subtitle="قيد المراجعة والإعداد"
        />
        <AdminStatCard
          title="قيد الشحن / جزئي"
          value={stats.inTransit}
          icon={Truck}
          subtitle="في الطريق أو استلام جزئي"
        />
        <AdminStatCard
          title="مكتمل الاستلام"
          value={stats.received}
          icon={CheckCircle2}
          subtitle="تمت مطابقة المخزون"
        />
        <AdminStatCard
          title="إجمالي التكلفة"
          value={`${stats.totalValueCost.toLocaleString()} ج.م`}
          icon={DollarSign}
          subtitle="القيمة الإجمالية للمشتريات"
        />
      </div>

      {/* 3, 4, 5, 6. Main Card with Search, Filter & Content */}
      <AdminCard className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="md:col-span-1">
            <AdminSearchInput
              value={searchQuery}
              onChange={(val) => setSearchQuery(val)}
              placeholder="البحث برقم أمر الشراء أو المورد أو المنتج..."
            />
          </div>

          {/* Status Filter */}
          <div>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              size="sm"
              buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-2.5 px-3 focus:border-amber-500"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
              options={[
                { value: 'all', label: 'جميع الحالات' },
                { value: 'draft', label: 'مسودة (Draft)' },
                { value: 'ordered', label: 'مؤكد / قيد التوريد (Ordered)' },
                { value: 'partially_received', label: 'مستلم جزئياً (Partially Received)' },
                { value: 'received', label: 'مكتمل الاستلام (Received)' },
                { value: 'cancelled', label: 'ملغي (Cancelled)' }
              ]}
            />
          </div>

          {/* Supplier Filter */}
          <div>
            <CustomSelect
              value={supplierFilter}
              onChange={(val) => setSupplierFilter(val)}
              size="sm"
              buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-2.5 px-3 focus:border-amber-500"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
              options={[
                { value: 'all', label: 'جميع الموردين' },
                ...suppliers.map((s) => ({
                  value: s.id,
                  label: `${s.companyName} (${s.name})`
                }))
              ]}
            />
          </div>

          {/* Sort By */}
          <div>
            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val as any)}
              size="sm"
              buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-2.5 px-3 focus:border-amber-500"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
              options={[
                { value: 'newest', label: 'الأحدث أولاً' },
                { value: 'oldest', label: 'الأقدم أولاً' },
                { value: 'costDesc', label: 'التكلفة: الأعلى إلى الأقل' },
                { value: 'costAsc', label: 'التكلفة: الأقل إلى الأعلى' }
              ]}
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <AdminLoading message="جاري تحميل أوامر الشراء والتوريد..." />
        ) : sortedPurchaseOrders.length === 0 ? (
          <AdminEmptyState
            icon={FileText}
            title="لا توجد أوامر شراء مطابقة"
            description="لم يتم العثور على أي أوامر شراء تطابق محددات التصفية الحالية."
            action={
              <AdminButton
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={handleOpenCreateModal}
              >
                إنشاء أمر شراء جديد
              </AdminButton>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[11px] select-none bg-slate-50 dark:bg-slate-900/50">
                    <th className="py-3 px-4">رقم أمر الشراء</th>
                    <th className="py-3 px-4">المورد والشركة</th>
                    <th className="py-3 px-4">عدد الأصناف</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4">التاريخ المتوقع</th>
                    <th className="py-3 px-4">إجمالي التكلفة</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                  {paginatedPurchaseOrders.map((po) => {
                    const totalOrdered = po.items.reduce((s, i) => s + i.quantityOrdered, 0);
                    const totalReceived = po.items.reduce((s, i) => s + i.quantityReceived, 0);

                    return (
                      <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/20 transition-colors">
                        {/* PO Number */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-slate-950 px-2 py-1 rounded text-xs border border-amber-200 dark:border-slate-800">
                              #{po.poNumber}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPoNumber(po.poNumber, po.id)}
                              className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer"
                              title="نسخ رقم أمر الشراء"
                            >
                              {copiedId === po.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {new Date(po.createdAt).toLocaleDateString('ar-EG')}
                          </div>
                        </td>

                        {/* Supplier */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{po.supplierCompanyName}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{po.supplierName}</div>
                        </td>

                        {/* Items */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {po.items.length} أصناف
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            مستلم: ({totalReceived} / {totalOrdered})
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">{renderStatusBadge(po.status)}</td>

                        {/* Expected Date */}
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          {po.expectedDate ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                              <span>{po.expectedDate}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600 text-[10px]">غير محدد</span>
                          )}
                        </td>

                        {/* Total Cost */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white font-mono">
                            {po.totalCost.toLocaleString()} <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400">ج.م</span>
                          </div>
                          {po.discount && po.discount > 0 ? (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">خصم: {po.discount} ج.م</div>
                          ) : null}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setViewingPO(po)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit (Draft only) */}
                            {po.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(po)}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-slate-800 dark:hover:bg-amber-500/20 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 rounded-lg transition-colors cursor-pointer border border-amber-200 dark:border-transparent"
                                title="تعديل المسودة"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Confirm PO (Draft -> Ordered) */}
                            {po.status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(po.id, 'ordered')}
                                className="px-2.5 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="تأكيد الطلب المعتمد"
                              >
                                <Send className="w-3 h-3" />
                                تأكيد
                              </button>
                            )}

                            {/* Receive Items (Ordered or Partially Received) */}
                            {(po.status === 'ordered' || po.status === 'partially_received') && (
                              <button
                                type="button"
                                onClick={() => handleOpenReceiveModal(po)}
                                className="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title="استلام شحنة جديدة"
                              >
                                <PackageCheck className="w-3 h-3" />
                                استلام
                              </button>
                            )}

                            {/* Cancel PO */}
                            {(po.status === 'draft' || po.status === 'ordered') && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(po.id, 'cancelled')}
                                className="p-1.5 bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                title="إلغاء أمر الشراء"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 7. Pagination */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <AdminTablePagination
                page={currentPage}
                totalPages={totalPages}
                total={sortedPurchaseOrders.length}
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

      {/* CREATE / EDIT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto dir-rtl">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto my-8 border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white/95 dark:bg-slate-950/80 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingPO ? `تعديل أمر الشراء #${editingPO.poNumber}` : 'إنشاء أمر شراء جديد (PO)'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    تحديد المورد، المنتجات المطلوبة، الكميات وتكلفة الشراء
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePO} className="p-6 space-y-6">
              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  المورد <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                {suppliers.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span>لا يوجد موردين نشطين بالمنظومة! يرجى إضافة موردين من قائمة "الموردين" أولاً.</span>
                  </div>
                ) : (
                  <CustomSelect
                    value={formData.supplierId}
                    onChange={(val) => setFormData({ ...formData, supplierId: val })}
                    placeholder="-- اختر المورد --"
                    size="sm"
                    buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-2 px-3 focus:border-amber-500"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
                    options={[
                      { value: '', label: '-- اختر المورد --' },
                      ...suppliers.map((s) => ({
                        value: s.id,
                        label: `${s.companyName} - مسؤول الاتصال: ${s.name} (${s.phone})`
                      }))
                    ]}
                  />
                )}
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    قائمة المنتجات والأصناف المطلوبة
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    إضافة صنف آخر
                  </button>
                </div>

                {/* Quick Barcode & QR Scan Add */}
                <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    <ScanLine className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    <span>إضافة سريعة بالباركود أو QR:</span>
                  </div>
                  <div className="flex-1 w-full flex gap-2">
                    <input
                      type="text"
                      value={scanPoBarcode}
                      onChange={(e) => setScanPoBarcode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleScanBarcodeToPO();
                        }
                      }}
                      placeholder="امسح الباركود أو رمز الـ QR واضغط Enter لإدراج الصنف فوراً..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleScanBarcodeToPO()}
                      className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shrink-0 transition-colors cursor-pointer"
                    >
                      إضافة
                    </button>
                  </div>
                </div>
                {scanPoError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-bold px-1">{scanPoError}</p>
                )}

                <div className="space-y-3">
                  {formItems.map((item, idx) => {
                    const selectedProd = products.find(p => p.id === item.productId);
                    const hasVariants = selectedProd && selectedProd.variants && selectedProd.variants.length > 0;

                    return (
                      <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        {/* Product Picker */}
                        <div className="md:col-span-5">
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المنتج</label>
                          <CustomSelect
                            value={item.productId}
                            onChange={(val) => handleItemChange(idx, 'productId', val)}
                            size="sm"
                            buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-1.5 px-3 focus:border-amber-500"
                            menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
                            options={products.map((p) => ({
                              value: p.id,
                              label: `${p.title} (${p.sku || 'بدون SKU'})`
                            }))}
                          />
                        </div>

                        {/* Variant Picker (if exists) */}
                        {hasVariants && (
                          <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الموديل / الخيار</label>
                            <CustomSelect
                              value={item.variantId || ''}
                              onChange={(val) => handleItemChange(idx, 'variantId', val)}
                              size="sm"
                              buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl py-1.5 px-3 focus:border-amber-500"
                              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
                              options={selectedProd.variants!.map((v) => ({
                                value: v.id,
                                label: [v.size, v.color, v.capacity].filter(Boolean).join(' / ') || `موديل #${v.id}`
                              }))}
                            />
                          </div>
                        )}

                        {/* Quantity */}
                        <div className={hasVariants ? "md:col-span-2" : "md:col-span-3"}>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الكمية المطلوبة</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.quantityOrdered !== undefined ? item.quantityOrdered : ''}
                            onKeyDown={(e) => handleNumericKeyDown(e, 'positive_integer')}
                            onPaste={(e) => handleNumericPaste(e, 'positive_integer')}
                            onChange={(e) => handleItemChange(idx, 'quantityOrdered', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                          />
                        </div>

                        {/* Unit Cost */}
                        <div className={hasVariants ? "md:col-span-2" : "md:col-span-3"}>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">تكلفة الوحدة (ج.م)</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.unitCost !== undefined ? item.unitCost : ''}
                            onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                            onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                            onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                          />
                        </div>

                        {/* Item Total & Delete */}
                        <div className="md:col-span-12 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                          <span className="text-slate-600 dark:text-slate-400">
                            إجمالي الصنف: <strong className="text-slate-900 dark:text-white font-bold">{((Number(item.quantityOrdered) || 0) * (Number(item.unitCost) || 0)).toLocaleString()} ج.م</strong>
                          </span>
                          {formItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              حذف الصنف
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Financial Calculation Bar */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المجموع الفرعي (Subtotal)</label>
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {calculateFormTotals().subtotal.toLocaleString()} ج.م
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الخصم الإجمالي (ج.م)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.discount !== undefined ? formData.discount : ''}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                    onChange={(e) => {
                      const clean = sanitizeNumericInput(e.target.value, 'non_negative_decimal');
                      setFormData({ ...formData, discount: clean === '' ? ('' as any) : Number(clean) });
                    }}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">مصاريف الشحن (ج.م)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.shippingCost !== undefined ? formData.shippingCost : ''}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                    onChange={(e) => {
                      const clean = sanitizeNumericInput(e.target.value, 'non_negative_decimal');
                      setFormData({ ...formData, shippingCost: clean === '' ? ('' as any) : Number(clean) });
                    }}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">الصافي الإجمالي (Total Cost)</label>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {calculateFormTotals().totalCost.toLocaleString()} ج.م
                  </div>
                </div>
              </div>

              {/* Notes & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ التسليم المتوقع</label>
                  <input
                    type="date"
                    value={formData.expectedDate || ''}
                    onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات وشروط التوريد</label>
                  <input
                    type="text"
                    placeholder="مثال: التوريد لمخزن القاهرة الرئيسي، الدفع عند الاستلام..."
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Submit Controls */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading || suppliers.length === 0}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingPO ? 'حفظ التعديلات' : 'إنشاء أمر الشراء (مسودة)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PO DETAILS MODAL */}
      {viewingPO && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto dir-rtl">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl my-8 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-white dark:bg-slate-950/80 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-200 dark:border-amber-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">أمر شراء #{viewingPO.poNumber}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">تاريخ الإنشاء: {new Date(viewingPO.createdAt).toLocaleString('ar-EG')}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingPO(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status and Supplier Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">المورد والشركة:</div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">{viewingPO.supplierCompanyName}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{viewingPO.supplierName}</div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">الحالة ومسؤول الطلب:</div>
                  <div className="mb-1">{renderStatusBadge(viewingPO.status)}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">بواسطة: {viewingPO.createdBy}</div>
                </div>
              </div>

              {/* Items List Table */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">الأصناف الموردة:</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3">المنتج والموديل</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3 text-center">المطلوب</th>
                        <th className="p-3 text-center">المستلم</th>
                        <th className="p-3">تكلفة الوحدة</th>
                        <th className="p-3">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                      {viewingPO.items.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{it.productTitle}</div>
                            {it.variantInfo && <div className="text-[11px] text-slate-500 dark:text-slate-400">{it.variantInfo}</div>}
                          </td>
                          <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{it.sku || '-'}</td>
                          <td className="p-3 text-center font-bold text-slate-900 dark:text-white">{it.quantityOrdered}</td>
                          <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{it.quantityReceived}</td>
                          <td className="p-3 font-mono">{it.unitCost.toLocaleString()} ج.م</td>
                          <td className="p-3 font-bold text-slate-900 dark:text-white font-mono">{it.totalCost.toLocaleString()} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary Breakdown */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">المجموع الفرعي:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{viewingPO.subtotal.toLocaleString()} ج.م</span>
                </div>
                {viewingPO.discount ? (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>الخصم:</span>
                    <span className="font-bold">- {viewingPO.discount.toLocaleString()} ج.م</span>
                  </div>
                ) : null}
                {viewingPO.shippingCost ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">مصاريف الشحن:</span>
                    <span className="font-bold text-slate-900 dark:text-white">+ {viewingPO.shippingCost.toLocaleString()} ج.م</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>إجمالي تكلفة أمر الشراء:</span>
                  <span className="text-amber-600 dark:text-amber-400">{viewingPO.totalCost.toLocaleString()} ج.م</span>
                </div>
              </div>

              {/* Notes */}
              {viewingPO.notes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <strong className="block mb-0.5 text-amber-700 dark:text-amber-400 font-bold">ملاحظات أمر الشراء:</strong>
                  {viewingPO.notes}
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setViewingPO(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  إغلاق
                </button>

                <div className="flex items-center gap-2">
                  {viewingPO.status === 'draft' && (
                    <button
                      onClick={() => {
                        setViewingPO(null);
                        handleStatusChange(viewingPO.id, 'ordered');
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      تأكيد أمر الشراء
                    </button>
                  )}

                  {(viewingPO.status === 'ordered' || viewingPO.status === 'partially_received') && (
                    <button
                      onClick={() => {
                        const poToReceive = viewingPO;
                        setViewingPO(null);
                        handleOpenReceiveModal(poToReceive);
                      }}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <PackageCheck className="w-4 h-4" />
                      استلام توريدات الآن
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RECEIVE SHIPMENT MODAL */}
      {receivingPO && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto dir-rtl">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl my-8 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="bg-white dark:bg-slate-950/80 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">تسجيل شحنة استلام لـ #{receivingPO.poNumber}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">المورد: {receivingPO.supplierCompanyName}</p>
                </div>
              </div>
              <button
                onClick={() => setReceivingPO(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs">
                💡 <strong className="text-emerald-700 dark:text-emerald-400 font-bold">ملاحظة هامة:</strong> إدخال كميات الاستلام يؤدي تلقائياً لإضافة حركات مخزنية من نوع "توريد مشتريات (in_purchase)"، وزيادة أرصدة المنتجات فوراً وتحديث أسعار التكلفة بدون المساس بأسعار البيع.
              </div>

              {/* Quick Actions */}
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">حدد الكميات المستلمة في هذه الشحنة:</h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSetAllRemaining}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-500/20 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    استلام كل المتبقي
                  </button>
                  <button
                    onClick={handleClearReceiveInputs}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    تصفير
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">المنتج والموديل</th>
                      <th className="p-3 text-center">المطلوب</th>
                      <th className="p-3 text-center">المستلم سابقاً</th>
                      <th className="p-3 text-center">المتبقي</th>
                      <th className="p-3 text-center w-36">الكمية المستلمة الآن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {receivingPO.items.map((it) => {
                      const remaining = it.quantityOrdered - it.quantityReceived;
                      const inputVal = receiveInputs[it.id] ?? 0;

                      return (
                        <tr key={it.id} className={remaining === 0 ? "bg-slate-50/50 dark:bg-slate-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"}>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{it.productTitle}</div>
                            {it.variantInfo && <div className="text-[11px] text-slate-500 dark:text-slate-400">{it.variantInfo}</div>}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-900 dark:text-white">{it.quantityOrdered}</td>
                          <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{it.quantityReceived}</td>
                          <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">{remaining}</td>
                          <td className="p-3">
                            {remaining > 0 ? (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={inputVal !== undefined ? inputVal : ''}
                                onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_integer')}
                                onPaste={(e) => handleNumericPaste(e, 'non_negative_integer')}
                                onChange={(e) => {
                                  const clean = sanitizeNumericInput(e.target.value, 'non_negative_integer');
                                  const num = clean === '' ? 0 : Math.min(remaining, Math.max(0, parseInt(clean, 10)));
                                  setReceiveInputs({ ...receiveInputs, [it.id]: num });
                                }}
                                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-center font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
                              />
                            ) : (
                              <span className="text-center block text-emerald-600 dark:text-emerald-400 font-bold">مكتمل</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Submit Controls */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReceivingPO(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  onClick={handleSubmitReceive}
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black transition-all shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>تأكيد وتسجيل الشحنة المستلمة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
