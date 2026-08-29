import React, { useState, useEffect, useMemo } from 'react';
import {
  Package, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw,
  Search, Filter, Plus, Minus, CheckCircle, ChevronDown, ChevronUp,
  History, Box, DollarSign, Layers, ShieldAlert, FileText, Check, X, Sliders, ScanLine, QrCode
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { Product, InventorySummary, StockMovement, StockMovementType } from '../types.js';
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
  AdminButton,
  AdminBadge,
  AdminEmptyState,
  AdminLoading,
  AdminSearchInput,
  AdminTablePagination
} from './AdminUIComponents.js';

interface AdminInventoryProps {
  onRefreshAll?: () => void;
}

export default function AdminInventory({ onRefreshAll }: AdminInventoryProps) {
  // Navigation tabs inside Inventory Pro
  const [activeTab, setActiveTab] = useState<'overview' | 'adjust' | 'movements' | 'lowstock'>('overview');

  // Summary & Product list state
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Live Inventory Table Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'instock' | 'lowstock' | 'outofstock'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'nameAsc' | 'nameDesc' | 'stockAsc' | 'stockDesc'>('newest');
  const [expandedProductIds, setExpandedProductIds] = useState<Set<string>>(new Set());

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Stock Adjustment Form / Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustVariantId, setAdjustVariantId] = useState('');
  const [adjustType, setAdjustType] = useState<StockMovementType>('in_purchase');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustReferenceId, setAdjustReferenceId] = useState('');
  const [adjustConfirmOpen, setAdjustConfirmOpen] = useState(false);
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Movements History state
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsMeta, setMovementsMeta] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementPage, setMovementPage] = useState(1);

  // Low Stock List state
  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [loadingLowStock, setLoadingLowStock] = useState(false);
  const [lowStockSearch, setLowStockSearch] = useState('');
  const [lowStockStatusFilter, setLowStockStatusFilter] = useState<'all' | 'out_of_stock' | 'low_stock'>('all');

  // Barcode Scanner State
  const [barcodeScanInput, setBarcodeScanInput] = useState('');
  const [scanResultModal, setScanResultModal] = useState<any | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Toasts / Notifications
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleBarcodeScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = barcodeScanInput.trim();
    if (!query) return;

    setIsScanning(true);
    try {
      // Check if it looks like a QR code or try QR info first, then fallback to barcode
      if (query.toUpperCase().startsWith('QR-')) {
        try {
          const qrRes = await api.getQrCodeInfo(query);
          if (qrRes && qrRes.success && qrRes.data) {
            setScanResultModal(qrRes.data);
            showSuccess(`تم العثور على الصنف بواسطة رمز الـ QR: ${qrRes.data.title}`);
            setIsScanning(false);
            return;
          }
        } catch (_) {
          // fallback
        }
      }

      // Try Barcode lookup first
      try {
        const res = await api.getBarcodeInfo(query);
        if (res && res.success && res.data) {
          setScanResultModal(res.data);
          showSuccess(`تم العثور على الصنف بالباركود: ${res.data.title}`);
          setIsScanning(false);
          return;
        }
      } catch (_) {
        // Fallback to QR lookup
        const qrRes = await api.getQrCodeInfo(query);
        if (qrRes && qrRes.success && qrRes.data) {
          setScanResultModal(qrRes.data);
          showSuccess(`تم العثور على الصنف بواسطة رمز الـ QR: ${qrRes.data.title}`);
          setIsScanning(false);
          return;
        }
      }
    } catch (err: any) {
      showError(getFriendlyErrorMessage(err, `لم يتم العثور على أي صنف مطلي بباركود أو QR (${query})`));
    } finally {
      setIsScanning(false);
    }
  };

  // -------------------------------------------------------------
  // Loaders
  // -------------------------------------------------------------
  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.getInventorySummary();
      setSummary(res);
    } catch (e: any) {
      console.error('Failed to load summary:', e);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await api.getProducts();
      setProducts(res);
    } catch (e: any) {
      console.error('Failed to load products:', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadMovements = async (page = movementPage) => {
    setLoadingMovements(true);
    try {
      const res = await api.getInventoryMovements({
        page,
        limit: 15,
        type: movementTypeFilter || undefined,
        search: movementSearch || undefined
      });
      setMovements(res.data || []);
      setMovementsMeta(res.meta || { total: 0, page: 1, limit: 15, totalPages: 1 });
    } catch (e: any) {
      console.error('Failed to load movements:', e);
    } finally {
      setLoadingMovements(false);
    }
  };

  const loadLowStock = async () => {
    setLoadingLowStock(true);
    try {
      const res = await api.getInventoryLowStock({
        search: lowStockSearch || undefined,
        status: lowStockStatusFilter !== 'all' ? lowStockStatusFilter : undefined
      });
      setLowStockList(res || []);
    } catch (e: any) {
      console.error('Failed to load low stock list:', e);
    } finally {
      setLoadingLowStock(false);
    }
  };

  const refreshAllData = () => {
    loadSummary();
    loadProducts();
    loadMovements(1);
    loadLowStock();
    if (onRefreshAll) onRefreshAll();
  };

  useEffect(() => {
    refreshAllData();

    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter') || params.get('status');
    if (filterParam && (filterParam.toLowerCase() === 'lowstock' || filterParam.toLowerCase() === 'low_stock')) {
      setActiveTab('lowstock');
      setStatusFilter('lowstock');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'movements') {
      loadMovements(movementPage);
    }
  }, [movementPage, movementTypeFilter, activeTab]);

  useEffect(() => {
    if (activeTab === 'lowstock') {
      loadLowStock();
    }
  }, [lowStockStatusFilter, activeTab]);

  // Toast auto-clear
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 5000);
  };

  // Automatically reset to page 1 whenever search, category, status, warehouse, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, statusFilter, warehouseFilter, sortBy]);

  // Derived filter options
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  const availableWarehouses = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      const loc = p.location || 'الفرع الرئيسي';
      set.add(loc);
    });
    return Array.from(set);
  }, [products]);

  // -------------------------------------------------------------
  // Filtered, Sorted & Paginated Products for Live Inventory Table
  // -------------------------------------------------------------
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // Search match (Title, SKU, Barcode, Brand)
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || (
        (p.title && p.title.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.variants && p.variants.some(v => (v.sku && v.sku.toLowerCase().includes(q)) || (v.barcode && v.barcode.toLowerCase().includes(q))))
      );

      // Status match
      const thresh = p.lowStockThreshold || 5;
      let matchStatus = true;

      if (statusFilter === 'instock') {
        matchStatus = p.stock > thresh;
      } else if (statusFilter === 'lowstock') {
        matchStatus = p.stock > 0 && p.stock <= thresh;
      } else if (statusFilter === 'outofstock') {
        matchStatus = p.stock === 0;
      }

      // Category match
      let matchCategory = true;
      if (categoryFilter !== 'all') {
        matchCategory = p.category === categoryFilter;
      }

      // Warehouse match
      let matchWarehouse = true;
      if (warehouseFilter !== 'all') {
        const loc = p.location || 'الفرع الرئيسي';
        matchWarehouse = loc === warehouseFilter;
      }

      return matchSearch && matchStatus && matchCategory && matchWarehouse;
    });
  }, [products, searchQuery, statusFilter, categoryFilter, warehouseFilter]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      if (sortBy === 'oldest') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === 'nameAsc') {
        return (a.title || '').localeCompare(b.title || '', 'ar');
      }
      if (sortBy === 'nameDesc') {
        return (b.title || '').localeCompare(a.title || '', 'ar');
      }
      if (sortBy === 'stockDesc') {
        return (b.stock || 0) - (a.stock || 0);
      }
      if (sortBy === 'stockAsc') {
        return (a.stock || 0) - (b.stock || 0);
      }
      // Default 'newest'
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [filteredProducts, sortBy]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return sortedProducts.slice(start, start + limit);
  }, [sortedProducts, currentPage, limit]);

  const totalPages = Math.ceil(sortedProducts.length / limit) || 1;

  // -------------------------------------------------------------
  // Stock Adjustment Handlers
  // -------------------------------------------------------------
  const selectedAdjustProduct = useMemo(() => {
    return products.find(p => p.id === adjustProductId) || null;
  }, [products, adjustProductId]);

  const selectedAdjustVariant = useMemo(() => {
    if (!selectedAdjustProduct || !adjustVariantId) return null;
    return selectedAdjustProduct.variants?.find(v => v.id === adjustVariantId) || null;
  }, [selectedAdjustProduct, adjustVariantId]);

  const currentStockForAdjustment = useMemo(() => {
    if (selectedAdjustVariant) return selectedAdjustVariant.stock || 0;
    if (selectedAdjustProduct) return selectedAdjustProduct.stock || 0;
    return 0;
  }, [selectedAdjustProduct, selectedAdjustVariant]);

  const isDeductionType = adjustType === 'out_adjustment' || adjustType === 'out_damaged';
  const isDirectManualType = adjustType === 'manual_adjustment';

  const projectedNewStock = useMemo(() => {
    const qty = Number(adjustQuantity) || 0;
    if (isDirectManualType) {
      return qty; // adjustQuantity represents new target stock in direct manual mode
    }
    if (isDeductionType) {
      return currentStockForAdjustment - qty;
    } else {
      return currentStockForAdjustment + qty;
    }
  }, [currentStockForAdjustment, adjustQuantity, isDeductionType, isDirectManualType]);

  const openAdjustModal = (productId?: string, variantId?: string) => {
    let initialStock = 0;
    if (productId) {
      setAdjustProductId(productId);
      const prod = products.find(p => p.id === productId);
      if (variantId) {
        setAdjustVariantId(variantId);
        const v = prod?.variants?.find(v => v.id === variantId);
        initialStock = v?.stock || 0;
      } else if (prod?.variants && prod.variants.length > 0) {
        setAdjustVariantId(prod.variants[0].id);
        initialStock = prod.variants[0].stock || 0;
      } else {
        setAdjustVariantId('');
        initialStock = prod?.stock || 0;
      }
    } else if (products.length > 0) {
      setAdjustProductId(products[0].id);
      if (products[0].variants && products[0].variants.length > 0) {
        setAdjustVariantId(products[0].variants[0].id);
        initialStock = products[0].variants[0].stock || 0;
      } else {
        setAdjustVariantId('');
        initialStock = products[0].stock || 0;
      }
    }
    setAdjustType('in_purchase');
    setAdjustQuantity(1);
    setAdjustReason('');
    setAdjustReferenceId('');
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSubmit = async () => {
    if (!adjustProductId) {
      showError('يرجى اختيار المنتج المطلوب تعديله');
      return;
    }
    if (!adjustReason.trim()) {
      showError('سبب تعديل المخزون مطلوب حتماً لأسباب الرقابة والجودة');
      return;
    }

    const qtyValType = isDirectManualType ? 'non_negative_integer' : 'positive_integer';
    const qtyVal = validateNumericValue(adjustQuantity, qtyValType, {
      required: true,
      min: 0,
      fieldNameArabic: isDirectManualType ? 'الرصيد الفعلي الجديد' : 'كمية الجرد'
    });
    if (!qtyVal.valid) {
      showError(qtyVal.error || 'يرجى إدخال قيمة صحيحة');
      return;
    }

    if (projectedNewStock < 0) {
      showError('لا يمكن إتمام العملية: الكمية المطلوبة تتجاوز المخزون الحالي وترفع الرصيد للقيم السالبة');
      return;
    }

    const calculatedDelta = isDirectManualType 
      ? qtyVal.value! - currentStockForAdjustment 
      : (isDeductionType ? -qtyVal.value! : qtyVal.value!);

    if (isDirectManualType && calculatedDelta === 0) {
      showError('الرصيد الجديد مطابق للرصيد الحالي، لم يتم إجراء أي تغيير');
      return;
    }

    // Require confirmation before deduction or direct manual reduction
    const isDecreasing = calculatedDelta < 0;
    if (isDecreasing && !adjustConfirmOpen) {
      setAdjustConfirmOpen(true);
      return;
    }

    setSubmittingAdjust(true);
    try {
      if (isDirectManualType) {
        await api.adjustInventoryStock({
          productId: adjustProductId,
          variantId: adjustVariantId || undefined,
          type: 'manual_adjustment',
          quantity: Math.abs(calculatedDelta),
          targetStock: qtyVal.value!,
          reason: adjustReason.trim(),
          referenceId: adjustReferenceId.trim() || undefined
        });
      } else {
        await api.adjustInventoryStock({
          productId: adjustProductId,
          variantId: adjustVariantId || undefined,
          type: adjustType,
          quantity: qtyVal.value!,
          reason: adjustReason.trim(),
          referenceId: adjustReferenceId.trim() || undefined
        });
      }

      showSuccess('تمت عملية تعديل المخزون وتسجيل حركة الجرد بنجاح! 📦');
      setIsAdjustModalOpen(false);
      setAdjustConfirmOpen(false);
      refreshAllData();
    } catch (err: any) {
      showError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء تعديل المخزون'));
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const toggleExpandProduct = (id: string) => {
    const next = new Set(expandedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedProductIds(next);
  };

  // Helper for Movement Type Badge Styling
  const renderMovementTypeBadge = (type: StockMovementType) => {
    switch (type) {
      case 'in_purchase':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> توريد / شراء</span>;
      case 'in_adjustment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 inline-flex items-center gap-1"><Plus className="w-3 h-3" /> تسوية (+)</span>;
      case 'in_return':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 inline-flex items-center gap-1"><RefreshCw className="w-3 h-3" /> مرتجع طلب</span>;
      case 'out_sale':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1"><ArrowDownRight className="w-3 h-3" /> مبيعات طلب</span>;
      case 'out_adjustment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1"><Minus className="w-3 h-3" /> تسوية (-)</span>;
      case 'out_damage':
      case 'out_damaged':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600/20 text-red-600 dark:text-red-400 border border-red-500/30 inline-flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> تالف / مفقود</span>;
      case 'manual_adjustment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 inline-flex items-center gap-1"><Sliders className="w-3 h-3" /> تعديل يدوي</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">{type}</span>;
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100" id="admin-inventory-module">
      
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة المخزون والمستودعات"
        description="الرقابة الحية على المخزون، التسويات الجردية، وتتبع حركة المنتجات والموديلات"
        icon={Package}
        badge={<AdminBadge variant="amber">المركز المعتمد</AdminBadge>}
        actions={
          <div className="flex gap-2">
            <AdminButton
              icon={Plus}
              onClick={() => openAdjustModal()}
            >
              إجراء حركة / تعديل مخزون
            </AdminButton>

            <button
              onClick={refreshAllData}
              className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer shadow-sm"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loadingSummary || loadingProducts ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Toast Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-600 dark:text-rose-400 font-bold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* 🏷️ Quick Barcode & QR Code Scanner Banner */}
      <AdminCard className="p-4">
        <form onSubmit={handleBarcodeScanSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0 text-amber-600 dark:text-amber-500 font-bold text-xs">
            <ScanLine className="w-5 h-5 text-amber-500 animate-pulse" />
            <span>ماسح الباركود ورمز الـ QR:</span>
          </div>
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={barcodeScanInput}
              onChange={(e) => setBarcodeScanInput(e.target.value)}
              placeholder="امسح الباركود أو كود الـ QR بجهاز المسح الضوئي أو اكتب الرمز هنا واضغط Enter..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
            />
            <QrCode className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
          </div>
          <AdminButton
            type="submit"
            disabled={isScanning || !barcodeScanInput.trim()}
            loading={isScanning}
            icon={ScanLine}
          >
            فحص الصنف
          </AdminButton>
        </form>
      </AdminCard>

      {/* 🏷️ Scan Result Quick Action Modal */}
      {scanResultModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500 rounded-lg">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-sm">نتيجة مسح الباركود</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">BC: {scanResultModal.barcode}</p>
                </div>
              </div>
              <button
                onClick={() => setScanResultModal(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-3 items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <img
                src={scanResultModal.product?.mainImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30'}
                alt={scanResultModal.title}
                className="w-14 h-14 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
              />
              <div className="space-y-1 text-xs">
                <h4 className="font-bold text-slate-900 dark:text-white line-clamp-2">{scanResultModal.title}</h4>
                <div className="flex gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  <span>SKU: {scanResultModal.sku}</span>
                  <span>| الموقع: {scanResultModal.location}</span>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-amber-600 dark:text-amber-500 font-bold">{scanResultModal.price.toLocaleString('ar-EG')} ج.م</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${scanResultModal.currentStock === 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'}`}>
                    المخزون: {scanResultModal.currentStock} قطعة
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const pId = scanResultModal.productId;
                  const vId = scanResultModal.variantId;
                  setScanResultModal(null);
                  openAdjustModal(pId, vId);
                }}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                تعديل / تسوية مخزون الصنف
              </button>
              <button
                onClick={() => setScanResultModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'overview' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <Box className="w-4 h-4" />
          جدول المخزون والمؤشرات
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'movements' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <History className="w-4 h-4" />
          سجل الحركات والجرد
        </button>

        <button
          onClick={() => setActiveTab('lowstock')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${activeTab === 'lowstock' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'}`}
        >
          <AlertTriangle className="w-4 h-4" />
          مركز التنبيهات والمخزون المنخفض
          {summary && (summary.lowStockCount > 0 || summary.outOfStockCount > 0) && (
            <span className="bg-rose-600 text-white rounded-full px-2 py-0.5 text-[10px] font-black mr-1 animate-pulse">
              {summary.lowStockCount + summary.outOfStockCount}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW & LIVE INVENTORY TABLE                    */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">إجمالي المنتجات</span>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">{summary ? (summary.totalProducts ?? 0) : '--'}</h3>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">أصناف رئيسية</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">وحدات بالمخزن</span>
              <h3 className="text-lg font-black text-amber-600 dark:text-amber-400">{summary ? (summary.totalStockItems ?? 0) : '--'}</h3>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">إجمالي القطع المتوفرة</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">مخزون منخفض ⚠️</span>
              <h3 className="text-lg font-black text-amber-600 dark:text-amber-500">{summary ? (summary.lowStockCount ?? 0) : '--'}</h3>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">أقل من الحد الأدنى</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-sm">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">نفد المخزون ❌</span>
              <h3 className="text-lg font-black text-rose-600 dark:text-rose-500">{summary ? (summary.outOfStockCount ?? 0) : '--'}</h3>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">رصيد صفري</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">قيمة بسعر البيع</span>
              <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {summary ? `${(summary.totalValueSell ?? summary.totalStockValue ?? 0).toLocaleString('ar-EG')} ج.م` : '--'}
              </h3>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">القيمة السوقية</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 relative overflow-hidden shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">قيمة بسعر التكلفة</span>
              <h3 className="text-lg font-black text-sky-600 dark:text-sky-400">
                {summary ? `${(summary.totalValueCost ?? summary.totalCostValue ?? 0).toLocaleString('ar-EG')} ج.م` : '--'}
              </h3>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">رأس المال المستثمر</span>
            </div>
          </div>

          {/* Live Inventory Table Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم المنتج، SKU، أو الباركوم..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 font-sans shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">حالة المخزون:</span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${statusFilter === 'all' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  الكل ({products.length})
                </button>

                <button
                  onClick={() => setStatusFilter('instock')}
                  className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${statusFilter === 'instock' ? 'bg-emerald-500 text-slate-950 border-emerald-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  متوفر
                </button>

                <button
                  onClick={() => setStatusFilter('lowstock')}
                  className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${statusFilter === 'lowstock' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30' : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  منخفض المخزون
                </button>

                <button
                  onClick={() => setStatusFilter('outofstock')}
                  className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${statusFilter === 'outofstock' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30' : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  نافد المخزون
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5 min-w-[170px]">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">التصنيف:</span>
                <CustomSelect
                  value={categoryFilter}
                  onChange={(val) => setCategoryFilter(val)}
                  size="sm"
                  buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-500"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[180px]"
                  options={[
                    { value: 'all', label: 'جميع التصنيفات' },
                    ...availableCategories.map(cat => ({ value: cat, label: cat }))
                  ]}
                />
              </div>

              {/* Warehouse / Location Filter */}
              <div className="flex items-center gap-1.5 min-w-[180px]">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">موقع التخزين:</span>
                <CustomSelect
                  value={warehouseFilter}
                  onChange={(val) => setWarehouseFilter(val)}
                  size="sm"
                  buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-500"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[190px]"
                  options={[
                    { value: 'all', label: 'جميع الفروع والمخازن' },
                    ...availableWarehouses.map(wh => ({ value: wh, label: wh }))
                  ]}
                />
              </div>

              {/* Sorting */}
              <div className="flex items-center gap-1.5 min-w-[200px]">
                <span className="text-slate-500 dark:text-slate-400 shrink-0">الترتيب:</span>
                <CustomSelect
                  value={sortBy}
                  onChange={(val) => setSortBy(val as any)}
                  size="sm"
                  buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-amber-500"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[210px]"
                  options={[
                    { value: 'newest', label: 'الأحدث أولاً' },
                    { value: 'oldest', label: 'الأقدم أولاً' },
                    { value: 'nameAsc', label: 'الاسم: أ - ي' },
                    { value: 'nameDesc', label: 'الاسم: ي - أ' },
                    { value: 'stockDesc', label: 'كمية المخزون: الأعلى إلى الأقل' },
                    { value: 'stockAsc', label: 'كمية المخزون: الأقل إلى الأعلى' }
                  ]}
                />
              </div>

              {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || warehouseFilter !== 'all' || sortBy !== 'newest') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setCategoryFilter('all');
                    setWarehouseFilter('all');
                    setSortBy('newest');
                  }}
                  className="text-amber-600 dark:text-amber-400 hover:underline text-xs mr-auto font-bold cursor-pointer"
                >
                  إعادة ضبط الفلاتر
                </button>
              )}
            </div>
          </div>

          {/* Live Inventory Products Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {loadingProducts ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span>جارِ تحميل سجلات المخزون والأجهزة...</span>
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                لا توجد منتجات تطابق معايير البحث والفلترة.
              </div>
            ) : (
              <div className="space-y-4 p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-3.5">المنتج / الجهاز</th>
                        <th className="p-3.5">SKU / الباركود</th>
                        <th className="p-3.5">الماركة والتصنيف</th>
                        <th className="p-3.5">سعر التكلفة</th>
                        <th className="p-3.5">سعر البيع</th>
                        <th className="p-3.5">المخزون الحالي</th>
                        <th className="p-3.5">الحد الأدنى</th>
                        <th className="p-3.5">موقع التخزين</th>
                        <th className="p-3.5 text-center">إجراءات الجرد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {paginatedProducts.map((p) => {
                      const thresh = p.lowStockThreshold || 5;
                      const hasVariants = p.variants && p.variants.length > 0;
                      const isExpanded = expandedProductIds.has(p.id);

                      let stockBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                      let stockBadgeText = 'متوفر';
                      if (p.stock === 0) {
                        stockBadgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
                        stockBadgeText = 'نفد المخزون ❌';
                      } else if (p.stock <= thresh) {
                        stockBadgeClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
                        stockBadgeText = 'مخزون منخفض ⚠️';
                      }

                      return (
                        <React.Fragment key={p.id}>
                          <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-bold">
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={p.mainImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30'}
                                  alt={p.title}
                                  className="w-10 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
                                />
                                <div>
                                  <span className="text-slate-900 dark:text-white block font-bold">{p.title}</span>
                                  {hasVariants && (
                                    <button
                                      onClick={() => toggleExpandProduct(p.id)}
                                      className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 mt-0.5 cursor-pointer font-bold"
                                    >
                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                      عرض الموديلات والأنواع ({p.variants.length})
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                              <div>{p.sku || '--'}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">{p.barcode || ''}</div>
                            </td>

                            <td className="p-3.5 text-slate-700 dark:text-slate-300">
                              <div>{p.brand || 'عام'}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">{p.category}</div>
                            </td>

                            <td className="p-3.5 text-sky-600 dark:text-sky-400 font-mono font-bold">
                              {p.costPrice ? `${p.costPrice.toLocaleString('ar-EG')} ج.م` : '--'}
                            </td>

                            <td className="p-3.5 text-slate-900 dark:text-white font-mono font-bold">
                              {p.price.toLocaleString('ar-EG')} ج.م
                            </td>

                            <td className="p-3.5 font-bold">
                              <div className="flex items-center gap-2">
                                <span className="text-base text-slate-900 dark:text-white font-mono">{p.stock}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] border font-bold ${stockBadgeClass}`}>
                                  {stockBadgeText}
                                </span>
                              </div>
                            </td>

                            <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400">
                              {thresh} قطعة
                            </td>

                            <td className="p-3.5 text-slate-600 dark:text-slate-400 text-[11px]">
                              {p.location || 'الفرع الرئيسي'}
                            </td>

                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => openAdjustModal(p.id)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 dark:hover:bg-amber-500 dark:hover:text-slate-950 border border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 font-bold rounded-lg transition-all cursor-pointer text-xs inline-flex items-center gap-1 shadow-sm"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                                تعديل الرصيد
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Variant Sub-rows */}
                          {hasVariants && isExpanded && p.variants.map((v) => {
                            let vBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
                            let vBadgeText = 'متوفر';
                            if (v.stock === 0) {
                              vBadgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
                              vBadgeText = 'نفد ❌';
                            } else if (v.stock <= thresh) {
                              vBadgeClass = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
                              vBadgeText = 'منخفض ⚠️';
                            }

                            const variantLabel = [v.capacity, v.color].filter(Boolean).join(' - ') || v.id;

                            return (
                              <tr key={v.id} className="bg-slate-50/70 dark:bg-slate-950/60 text-xs border-t border-slate-100 dark:border-slate-800/40">
                                <td className="p-3 pr-12 text-slate-700 dark:text-slate-300 font-bold">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span>موديل: <strong className="text-slate-900 dark:text-white">{variantLabel}</strong></span>
                                  </div>
                                </td>

                                <td className="p-3 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                                  {v.sku || '--'}
                                </td>

                                <td className="p-3 text-slate-400 dark:text-slate-500 text-[11px]">
                                  فرعي
                                </td>

                                <td className="p-3 text-sky-600 dark:text-sky-400/80 font-mono">
                                  {v.costPrice ? `${v.costPrice.toLocaleString('ar-EG')} ج.م` : '--'}
                                </td>

                                <td className="p-3 text-slate-700 dark:text-slate-300 font-mono">
                                  {v.price ? `${v.price.toLocaleString('ar-EG')} ج.م` : '--'}
                                </td>

                                <td className="p-3 font-bold">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-900 dark:text-slate-200 font-mono">{v.stock}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] border font-bold ${vBadgeClass}`}>
                                      {vBadgeText}
                                    </span>
                                  </div>
                                </td>

                                <td className="p-3 font-mono text-slate-400 dark:text-slate-500 text-[11px]">
                                  {thresh}
                                </td>

                                <td className="p-3 text-slate-500 dark:text-slate-500 text-[11px]">
                                  {v.location || p.location || 'الفرع الرئيسي'}
                                </td>

                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => openAdjustModal(p.id, v.id)}
                                    className="px-2.5 py-1 bg-white hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-900 dark:hover:bg-amber-500 dark:hover:text-slate-950 border border-slate-200 dark:border-slate-800 text-amber-700 dark:text-amber-400 text-[11px] font-bold rounded transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                                  >
                                    <Sliders className="w-3 h-3" />
                                    تعديل الموديل
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {sortedProducts.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <AdminTablePagination
                    page={currentPage}
                    totalPages={totalPages}
                    total={sortedProducts.length}
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
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: MOVEMENTS HISTORY LOG                              */}
      {/* ========================================================= */}
      {activeTab === 'movements' && (
        <div className="space-y-6">

          {/* Movements Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={movementSearch}
                onChange={(e) => {
                  setMovementSearch(e.target.value);
                  setMovementPage(1);
                }}
                placeholder="بحث في الحركات بالسبب أو المرجع..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs font-bold min-w-[200px]">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">نوع الحركة:</span>
              <CustomSelect
                value={movementTypeFilter}
                onChange={(val) => {
                  setMovementTypeFilter(val);
                  setMovementPage(1);
                }}
                size="sm"
                buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-white text-xs rounded-lg px-3 py-2 focus:border-amber-500 shadow-sm"
                menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[230px]"
                options={[
                  { value: '', label: 'جميع الحركات' },
                  { value: 'in_purchase', label: 'توريد / شراء جديدة (In Purchase)' },
                  { value: 'in_adjustment', label: 'تسوية بالإيجاب (In Adjustment)' },
                  { value: 'in_return', label: 'مرتجع طلب عميل (In Return)' },
                  { value: 'out_sale', label: 'مبيعات طلب (Out Sale)' },
                  { value: 'out_adjustment', label: 'تسوية بالسلب (Out Adjustment)' },
                  { value: 'out_damaged', label: 'تالف / مفقود (Out Damaged)' },
                  { value: 'manual_adjustment', label: 'تعديل يدوي (Manual Adjustment)' }
                ]}
              />

              <button
                onClick={() => loadMovements(1)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition-colors shadow-sm"
                title="تحديث السجل"
              >
                <RefreshCw className={`w-4 h-4 ${loadingMovements ? 'animate-spin text-amber-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Movements Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            {loadingMovements ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span>جارِ تحميل سجل حركات الجرد والمستودع...</span>
              </div>
            ) : movements.length === 0 ? (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                لا توجد حركات مخزون مسجلة تطابق الشروط.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3.5">التاريخ والوقت</th>
                      <th className="p-3.5">المنتج والموديل</th>
                      <th className="p-3.5">نوع الحركة</th>
                      <th className="p-3.5">الكمية</th>
                      <th className="p-3.5">تغير الرصيد</th>
                      <th className="p-3.5">السبب / البيان</th>
                      <th className="p-3.5">المرجع</th>
                      <th className="p-3.5">بواسطة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {movements.map((m) => {
                      const delta = m.quantityDelta !== undefined ? m.quantityDelta : (m.type.startsWith('in_') ? m.quantity : -m.quantity);
                      const isAddition = delta > 0;
                      const actor = m.performedByName || m.performedBy || m.createdBy || 'النظام';
                      return (
                        <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                            {new Date(m.timestamp || m.createdAt || Date.now()).toLocaleString('ar-EG')}
                          </td>

                          <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                            <div>{m.productTitle || m.productName || m.productId}</div>
                            {m.variantInfo && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                {m.variantInfo}
                              </div>
                            )}
                            {m.variantSku && (
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                                SKU: {m.variantSku}
                              </div>
                            )}
                          </td>

                          <td className="p-3.5">
                            {renderMovementTypeBadge(m.type)}
                          </td>

                          <td className={`p-3.5 font-mono font-bold text-sm ${isAddition ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isAddition ? `+${Math.abs(delta)}` : `-${Math.abs(delta)}`}
                          </td>

                          <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300">
                            <span className="text-slate-500 dark:text-slate-400">{m.previousStock}</span>
                            <span className="text-slate-400 dark:text-slate-500 mx-1">→</span>
                            <strong className="text-slate-900 dark:text-white font-bold">{m.newStock}</strong>
                          </td>

                          <td className="p-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {m.reason || m.note || '--'}
                          </td>

                          <td className="p-3.5 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                            {m.reference || m.referenceId || '--'}
                          </td>

                          <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                            {actor}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {movementsMeta.totalPages > 1 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400">
                  عرض الصفحة {movementsMeta.page} من {movementsMeta.totalPages} (إجمالي {movementsMeta.total} حركة)
                </span>

                <div className="flex gap-2">
                  <button
                    disabled={movementsMeta.page <= 1}
                    onClick={() => setMovementPage(p => p - 1)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-sm"
                  >
                    السابق
                  </button>

                  <button
                    disabled={movementsMeta.page >= movementsMeta.totalPages}
                    onClick={() => setMovementPage(p => p + 1)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shadow-sm"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: LOW STOCK CENTER                                   */}
      {/* ========================================================= */}
      {activeTab === 'lowstock' && (
        <div className="space-y-6">

          {/* Low Stock Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                value={lowStockSearch}
                onChange={(e) => setLowStockSearch(e.target.value)}
                placeholder="بحث في المنتجات المنخفضة..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto text-xs font-bold">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">الحالة:</span>
              <button
                onClick={() => setLowStockStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${lowStockStatusFilter === 'all' ? 'bg-amber-500 text-slate-950 border-amber-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                الكل
              </button>

              <button
                onClick={() => setLowStockStatusFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${lowStockStatusFilter === 'out_of_stock' ? 'bg-rose-500 text-white border-rose-500' : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                نافد المخزون (0)
              </button>

              <button
                onClick={() => setLowStockStatusFilter('low_stock')}
                className={`px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${lowStockStatusFilter === 'low_stock' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30' : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                منخفض المخزون (≤5)
              </button>
            </div>
          </div>

          {/* Low Stock List */}
          {loadingLowStock ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
              <span>جارِ فحص قائمة المخزون المنخفض بالمستودع...</span>
            </div>
          ) : lowStockList.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-col items-center gap-3 shadow-sm">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
              <span>جميع المنتجات والموديلات بحالة ممتازة ومتوفرة بمخزون كافٍ! 🎉</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStockList.map((item, idx) => {
                const isOutOfStock = item.status === 'out_of_stock' || item.currentStock === 0;

                return (
                  <div key={idx} className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between gap-4 relative shadow-sm ${isOutOfStock ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/50 dark:bg-rose-500/5' : 'border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5'}`}>
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${isOutOfStock ? 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30' : 'bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500/30'}`}>
                          {isOutOfStock ? 'نفد المخزون ❌' : 'مخزون منخفض ⚠️'}
                        </span>

                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          الحد: {item.lowStockThreshold || 5} قطع
                        </span>
                      </div>

                      <div className="flex gap-3 items-center">
                        <img
                          src={item.mainImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30'}
                          alt={item.productTitle}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                        />
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">{item.productTitle}</h4>
                          {item.variantName && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5">
                              موديل: {item.variantName}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block mt-0.5">
                            SKU: {item.sku || '--'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">الرصيد المتبقي:</span>
                        <strong className={`text-lg font-black font-mono ${isOutOfStock ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {item.currentStock} قطعة
                        </strong>
                      </div>

                      <button
                        onClick={() => openAdjustModal(item.productId, item.variantId)}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        إعادة التوريد
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* STOCK ADJUSTMENT MODAL                                    */}
      {/* ========================================================= */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl text-right font-sans space-y-5 animate-in fade-in-50">
            
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                تعديل وحركة مخزون حية
              </h3>
              <button
                onClick={() => {
                  setIsAdjustModalOpen(false);
                  setAdjustConfirmOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Product Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">المنتج <span className="text-rose-500">*</span></label>
                <CustomSelect
                  value={adjustProductId}
                  onChange={(pid) => {
                    setAdjustProductId(pid);
                    const prod = products.find(p => p.id === pid);
                    if (prod?.variants && prod.variants.length > 0) {
                      setAdjustVariantId(prod.variants[0].id);
                    } else {
                      setAdjustVariantId('');
                    }
                  }}
                  size="sm"
                  buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl p-3 focus:border-amber-500 shadow-sm"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  options={products.map(p => ({
                    value: p.id,
                    label: `${p.title} (المخزون: ${p.stock})`
                  }))}
                />
              </div>

              {/* Variant Selector if applicable */}
              {selectedAdjustProduct && selectedAdjustProduct.variants && selectedAdjustProduct.variants.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-amber-700 dark:text-amber-400">الموديل / النوع الفرعي <span className="text-rose-500">*</span></label>
                  <CustomSelect
                    value={adjustVariantId}
                    onChange={(val) => setAdjustVariantId(val)}
                    size="sm"
                    buttonClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs rounded-xl p-3 focus:border-amber-500 shadow-sm"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    options={selectedAdjustProduct.variants.map(v => ({
                      value: v.id,
                      label: `${[v.capacity, v.color].filter(Boolean).join(' - ') || v.id} (المخزون: ${v.stock})`
                    }))}
                  />
                </div>
              )}

              {/* Adjustment Type Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">نوع الحركة والجرد <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('in_purchase');
                      setAdjustQuantity(1);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer text-xs ${adjustType === 'in_purchase' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-black' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    توريد / شراء جديد (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('in_adjustment');
                      setAdjustQuantity(1);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer text-xs ${adjustType === 'in_adjustment' ? 'bg-teal-500/20 border-teal-500 text-teal-700 dark:text-teal-400 font-black' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    تسوية جردية (+ إيجاب)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('out_adjustment');
                      setAdjustQuantity(1);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer text-xs ${adjustType === 'out_adjustment' ? 'bg-rose-500/20 border-rose-500 text-rose-700 dark:text-rose-400 font-black' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    تسوية جردية (- سلب)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('out_damaged');
                      setAdjustQuantity(1);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer text-xs ${adjustType === 'out_damaged' ? 'bg-red-600/20 border-red-500 text-red-700 dark:text-red-400 font-black' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    تالف / مفقود (- سلب)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('manual_adjustment');
                      setAdjustQuantity(currentStockForAdjustment);
                    }}
                    className={`p-2.5 rounded-xl border text-center font-bold transition-all cursor-pointer text-xs col-span-2 sm:col-span-2 ${adjustType === 'manual_adjustment' ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-black' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                    تعديل يدوي مباشر (تحديد الرصيد الفعلي الجديد)
                  </button>
                </div>
              </div>

              {/* Quantity Input & Projected stock preview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    {isDirectManualType ? 'الرصيد الفعلي بعد الجرد' : 'الكمية المطلوبة'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={adjustQuantity !== undefined ? adjustQuantity : ''}
                    onKeyDown={(e) => handleNumericKeyDown(e, isDirectManualType ? 'non_negative_integer' : 'positive_integer')}
                    onPaste={(e) => handleNumericPaste(e, isDirectManualType ? 'non_negative_integer' : 'positive_integer')}
                    onChange={(e) => {
                      const clean = sanitizeNumericInput(e.target.value, isDirectManualType ? 'non_negative_integer' : 'positive_integer');
                      setAdjustQuantity(clean === '' ? ('' as any) : Number(clean));
                    }}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500 text-center font-bold shadow-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5 justify-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center shadow-sm">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">
                    {isDirectManualType ? 'فارق الحركة (Delta)' : 'الرصيد المتوقع بعد الحركة'}
                  </span>
                  <div className="text-base font-black font-mono mt-0.5">
                    {isDirectManualType ? (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-xs">{currentStockForAdjustment} الحالي → </span>
                        <strong className={projectedNewStock < currentStockForAdjustment ? 'text-rose-600 dark:text-rose-400' : projectedNewStock > currentStockForAdjustment ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600'}>
                          {projectedNewStock - currentStockForAdjustment >= 0 ? `+${projectedNewStock - currentStockForAdjustment}` : `${projectedNewStock - currentStockForAdjustment}`}
                        </strong>
                      </div>
                    ) : (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">{currentStockForAdjustment}</span>
                        <span className="text-slate-400 dark:text-slate-500 mx-1">→</span>
                        <strong className={projectedNewStock < 0 ? 'text-rose-600 dark:text-rose-500 animate-pulse' : 'text-emerald-600 dark:text-emerald-400'}>
                          {projectedNewStock} قطعة
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reason input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">سبب الحركة / البيان المعتمد <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="مثال: توريد شحنة جديدة، تلف أثناء الشحن، عجز جردي..."
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                />

                {/* Quick preset reasons */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 self-center font-bold">أسباب شائعة:</span>
                  {[
                    'استلام شحنة جديدة',
                    'تصحيح جرد',
                    'تالف',
                    'خطأ إدخال',
                    'مرتجع',
                    'تسوية مخزنية'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjustReason(preset)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${adjustReason === preset ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold' : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'}`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reference ID optional */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300">رقم المرجع / الفاتورة / أمر الشراء (اختياري)</label>
                <input
                  type="text"
                  value={adjustReferenceId}
                  onChange={(e) => setAdjustReferenceId(e.target.value)}
                  placeholder="PO-2026-9901 أو INV-882"
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-amber-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                />
              </div>

              {/* Confirmation warning before deduction */}
              {adjustConfirmOpen && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 space-y-2">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    تأكيد خصم المخزون
                  </p>
                  <p className="text-[11px] text-slate-700 dark:text-slate-300">
                    أنت على وشك خصم <strong>{adjustQuantity} قطعة</strong> من المخزون. هل أنت متأكد من تنفيذ الحركة؟
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button
                type="button"
                onClick={handleAdjustSubmit}
                disabled={submittingAdjust}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingAdjust ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {adjustConfirmOpen ? 'تأكيد وحفظ التغيير' : 'حفظ حركة الجرد'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAdjustModalOpen(false);
                  setAdjustConfirmOpen(false);
                }}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer"
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
