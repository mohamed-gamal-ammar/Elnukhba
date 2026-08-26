import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit3, Trash2, Copy, Percent, Save, X, Layers, RefreshCw, AlertCircle, QrCode, Printer, Search, Filter, RotateCcw, Package, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { Product, ProductVariant, getProductTimestamp } from '../types.js';
import ImageUploader from './ImageUploader.js';
import { QrCodeLabelModal } from './QrCodeLabelModal.js';
import { CustomSelect } from './CustomSelect.js';
import {
  handleNumericKeyDown,
  handleNumericPaste,
  sanitizeNumericInput,
  validateNumericValue,
  parseStrictNumber,
  parseStrictInteger
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
  AdminTableToolbar,
  AdminTablePagination
} from './AdminUIComponents.js';

interface AdminProductsProps {
  onRefreshAll: () => void;
}

export default function AdminProducts({ onRefreshAll }: AdminProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search, Filters & Pagination States
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Reset page to 1 automatically when search, filters, or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, statusFilter, sortBy]);

  // Editing form states
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Specifications builder temporary states
  const [specKey, setSpecKey] = useState('');
  const [specVal, setSpecVal] = useState('');

  // Variants builder temporary states
  const [varSize, setVarSize] = useState('');
  const [varColor, setVarColor] = useState('');
  const [varCapacity, setVarCapacity] = useState('');
  const [varPrice, setVarPrice] = useState('');
  const [varStock, setVarStock] = useState('');
  const [varSku, setVarSku] = useState('');
  const [varBarcode, setVarBarcode] = useState('');
  const [varQrCode, setVarQrCode] = useState('');

  // QR Modal State
  const [qrLabelData, setQrLabelData] = useState<{
    isOpen: boolean;
    title: string;
    sku: string;
    price: number;
    qrCodeValue: string;
    barcodeValue?: string;
    location?: string;
    productId: string;
    variantId?: string;
    variantInfo?: string;
  } | null>(null);

  const handleGenerateBarcodeForProduct = async () => {
    try {
      const res = await api.generateBarcode();
      if (res.barcode && editingProduct) {
        setEditingProduct({ ...editingProduct, barcode: res.barcode });
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل توليد الباركود'));
    }
  };

  const handleGenerateBarcodeForVariant = async () => {
    try {
      const res = await api.generateBarcode();
      if (res.barcode) {
        setVarBarcode(res.barcode);
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل توليد الباركود'));
    }
  };

  const handleGenerateQrForProduct = async () => {
    try {
      const pId = editingProduct?.id;
      const res = await api.generateQrCode(pId);
      if (res.qrCode && editingProduct) {
        setEditingProduct({ ...editingProduct, qrCode: res.qrCode });
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل توليد رمز الـ QR'));
    }
  };

  const handleGenerateQrForVariant = async () => {
    try {
      const pId = editingProduct?.id;
      const res = await api.generateQrCode(pId, `var-${Date.now().toString().slice(-4)}`);
      if (res.qrCode) {
        setVarQrCode(res.qrCode);
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل توليد رمز الـ QR للموديل'));
    }
  };

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts();
      setProducts(res);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل المنتجات المخزنية الحالية'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();

    const params = new URLSearchParams(window.location.search);
    const statusParam = params.get('status') || params.get('filter');
    if (statusParam && (statusParam === 'lowStock' || statusParam.toLowerCase() === 'lowstock' || statusParam.toLowerCase() === 'low_stock')) {
      setStatusFilter('lowStock');
    }
  }, []);

  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.category) cats.add(p.category.trim());
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Filter
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const title = (p.title || '').toLowerCase();
        const titleEn = (p.titleEn || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();
        const barcode = (p.barcode || '').toLowerCase();
        const brand = (p.brand || '').toLowerCase();
        const category = (p.category || '').toLowerCase();

        const matches =
          title.includes(term) ||
          titleEn.includes(term) ||
          sku.includes(term) ||
          barcode.includes(term) ||
          brand.includes(term) ||
          category.includes(term);

        if (!matches) return false;
      }

      // 2. Category Filter
      if (categoryFilter !== 'all') {
        if (p.category !== categoryFilter) return false;
      }

      // 3. Status Filter (Stock status / Featured)
      if (statusFilter !== 'all') {
        if (statusFilter === 'inStock' && p.stock <= 0) return false;
        if (statusFilter === 'lowStock' && (p.stock <= 0 || p.stock > 5)) return false;
        if (statusFilter === 'outOfStock' && p.stock > 0) return false;
        if (statusFilter === 'featured' && !p.isFeatured) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'priceAsc') return (Number(a?.discountPrice || a?.price) || 0) - (Number(b?.discountPrice || b?.price) || 0);
      if (sortBy === 'priceDesc') return (Number(b?.discountPrice || b?.price) || 0) - (Number(a?.discountPrice || a?.price) || 0);
      if (sortBy === 'title') return String(a?.title || '').localeCompare(String(b?.title || ''), 'ar');
      if (sortBy === 'stockAsc') return (Number(a?.stock) || 0) - (Number(b?.stock) || 0);
      if (sortBy === 'stockDesc') return (Number(b?.stock) || 0) - (Number(a?.stock) || 0);
      // Default 'newest'
      const timeA = getProductTimestamp(a);
      const timeB = getProductTimestamp(b);
      if (timeB !== timeA) return timeB - timeA;
      const latestA = a?.isLatest ? 1 : 0;
      const latestB = b?.isLatest ? 1 : 0;
      if (latestB !== latestA) return latestB - latestA;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });
  }, [products, search, categoryFilter, statusFilter, sortBy]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredProducts.slice(start, start + limit);
  }, [filteredProducts, currentPage, limit]);

  const totalPages = Math.ceil(filteredProducts.length / limit) || 1;

  const handleEditClick = (product: Product) => {
    setEditingProduct({ ...product });
    setShowAddForm(false);
  };

  const handleAddNewClick = () => {
    setEditingProduct({
      title: '',
      titleEn: '',
      description: '',
      brand: '',
      category: 'أجهزة المطبخ الصغيرة',
      mainImage: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=800',
      images: ['https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=800'],
      price: 1000,
      discountPrice: undefined,
      sku: `PROD-${Math.floor(10000 + Math.random() * 90000)}`,
      stock: 10,
      variants: [],
      specifications: [],
      features: [],
      tags: [],
      isFeatured: false,
      isBestSeller: false,
      isLatest: true,
      isFlashSale: false
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`هل أنت متأكد تماماً من رغبتك في حذف المنتج: [${title}] نهائياً من العرض وقاعدة البيانات؟`)) {
      return;
    }
    try {
      await api.deleteAdminProduct(id);
      setSuccess('تم حذف المنتج بنجاح وتحديث جداول المخازن');
      loadProducts();
      onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حذف المنتج من الخادم'));
    }
  };

  const handleDuplicate = async (product: Product) => {
    try {
      const duplicated: Partial<Product> = {
        ...product,
        id: undefined, // let server generate it
        title: `${product.title} (نسخة مكررة)`,
        sku: `${product.sku}-DUP-${Math.floor(100 + Math.random() * 900)}`,
        stock: product.stock,
        rating: 5.0,
        reviewsCount: 0,
        reviews: []
      };
      await api.createAdminProduct(duplicated);
      setSuccess('تم تكرار المنتج بنجاح، يمكنك الآن تعديله لتغيير السعر أو الخصائص');
      loadProducts();
      onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تكرار منتج الأجهزة'));
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editingProduct) return;
    if (!editingProduct.title || editingProduct.price === undefined || !editingProduct.sku) {
      setError('يرجى ملء الحقول الأساسية الإجبارية: اسم المنتج، السعر، وكود الـ SKU');
      return;
    }

    // Strict validation for Price
    const priceVal = validateNumericValue(editingProduct.price, 'non_negative_decimal', {
      required: true,
      min: 0,
      fieldNameArabic: 'سعر المنتج الأساسي'
    });
    if (!priceVal.valid) {
      setError(priceVal.error || 'سعر المنتج غير صالح');
      return;
    }

    // Strict validation for Discount Price (if provided)
    if (editingProduct.discountPrice !== undefined && editingProduct.discountPrice !== null && String(editingProduct.discountPrice).trim() !== '') {
      const discountVal = validateNumericValue(editingProduct.discountPrice, 'non_negative_decimal', {
        min: 0,
        fieldNameArabic: 'سعر العرض/الخصم'
      });
      if (!discountVal.valid) {
        setError(discountVal.error || 'سعر العرض/الخصم غير صالح');
        return;
      }
      if (Number(editingProduct.discountPrice) >= Number(editingProduct.price)) {
        setError('سعر العرض/الخصم يجب أن يكون أقل من السعر الأساسي للمنتج');
        return;
      }
    }

    // Strict validation for Stock
    const stockVal = validateNumericValue(editingProduct.stock, 'non_negative_integer', {
      required: true,
      min: 0,
      fieldNameArabic: 'كمية المخزون'
    });
    if (!stockVal.valid) {
      setError(stockVal.error || 'كمية المخزون غير صالحة');
      return;
    }

    // Strict validation for variants if present
    if (editingProduct.variants && editingProduct.variants.length > 0) {
      for (let i = 0; i < editingProduct.variants.length; i++) {
        const v = editingProduct.variants[i];
        const vPrice = validateNumericValue(v.price, 'non_negative_decimal', {
          required: true,
          min: 0,
          fieldNameArabic: `سعر الخيار رقم ${i + 1}`
        });
        if (!vPrice.valid) {
          setError(vPrice.error || `سعر الخيار رقم ${i + 1} غير صالح`);
          return;
        }
        const vStock = validateNumericValue(v.stock, 'non_negative_integer', {
          required: true,
          min: 0,
          fieldNameArabic: `مخزون الخيار رقم ${i + 1}`
        });
        if (!vStock.valid) {
          setError(vStock.error || `مخزون الخيار رقم ${i + 1} غير صالح`);
          return;
        }
      }
    }

    try {
      if (showAddForm) {
        // Create
        await api.createAdminProduct(editingProduct);
        setSuccess('تم تسجيل المنتج الجديد في مستودع المتجر بنجاح 📦');
      } else {
        // Update
        await api.updateAdminProduct(editingProduct.id!, editingProduct);
        setSuccess('تم تعديل مواصفات وبيانات المنتج بنجاح');
      }
      setEditingProduct(null);
      setShowAddForm(false);
      loadProducts();
      onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشلت عملية الحفظ على الخادم'));
    }
  };

  // Add Spec Helper
  const addSpec = () => {
    if (!specKey.trim() || !specVal.trim() || !editingProduct) return;
    const currentSpecs = editingProduct.specifications || [];
    setEditingProduct({
      ...editingProduct,
      specifications: [...currentSpecs, { key: specKey.trim(), value: specVal.trim() }]
    });
    setSpecKey('');
    setSpecVal('');
  };

  // Remove Spec Helper
  const removeSpec = (idx: number) => {
    if (!editingProduct) return;
    const currentSpecs = [...(editingProduct.specifications || [])];
    currentSpecs.splice(idx, 1);
    setEditingProduct({ ...editingProduct, specifications: currentSpecs });
  };

  // Add Variant Helper
  const addVariant = () => {
    if (!editingProduct || !varSku.trim()) return;

    const vPriceRes = validateNumericValue(varPrice, 'non_negative_decimal', {
      required: true,
      min: 0,
      fieldNameArabic: 'سعر الخيار'
    });
    if (!vPriceRes.valid) {
      setError(vPriceRes.error || 'يرجى إدخال سعر صحيح للخيار');
      return;
    }

    const vStockRes = validateNumericValue(varStock, 'non_negative_integer', {
      required: true,
      min: 0,
      fieldNameArabic: 'مخزون الخيار'
    });
    if (!vStockRes.valid) {
      setError(vStockRes.error || 'يرجى إدخال مخزون صحيح للخيار (عدد صحيح >= 0)');
      return;
    }

    const newVar: ProductVariant = {
      id: `var-${Date.now()}`,
      size: varSize.trim() || undefined,
      color: varColor.trim() || undefined,
      capacity: varCapacity.trim() || undefined,
      price: vPriceRes.value!,
      stock: vStockRes.value!,
      sku: varSku.trim(),
      barcode: varBarcode.trim() || `200${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      qrCode: varQrCode.trim() || `QR-${editingProduct.id || 'P'}-var-${Date.now().toString().slice(-6)}`,
      warranty: 'سنتان شامل'
    };
    const currentVars = editingProduct.variants || [];
    setEditingProduct({ ...editingProduct, variants: [...currentVars, newVar] });

    // Reset variant fields
    setVarSize('');
    setVarColor('');
    setVarCapacity('');
    setVarPrice('');
    setVarStock('');
    setVarSku('');
    setVarBarcode('');
    setVarQrCode('');
  };

  // Remove Variant Helper
  const removeVariant = (idx: number) => {
    if (!editingProduct) return;
    const currentVars = [...(editingProduct.variants || [])];
    currentVars.splice(idx, 1);
    setEditingProduct({ ...editingProduct, variants: currentVars });
  };

  if (loading) {
    return <AdminLoading message="جارٍ جلب وتحديث مستندات المستودعات والمنتجات الرئيسية..." />;
  }

  const inStockCount = products.filter(p => p.stock > 5).length;
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 5).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100" id="admin-products-view">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة المنتجات والأجهزة"
        description="إدارة ومتابعة كتالوج الأجهزة الكهربائية والمواصفات والموديلات والباركود"
        icon={Layers}
        badge={<AdminBadge variant="amber">{products.length} منتج</AdminBadge>}
        actions={
          !editingProduct && (
            <AdminButton icon={Plus} onClick={handleAddNewClick}>
              إضافة جهاز جديد
            </AdminButton>
          )
        }
      />

      {/* Messages row */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between shadow-xs">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="text-emerald-600 dark:text-emerald-400 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 dark:text-rose-400 hover:opacity-75 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Statistics Cards */}
      {!editingProduct && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            title="إجمالي المنتجات"
            value={products.length}
            icon={Package}
            subtitle="العدد الكلي للأجهزة المسجلة"
          />
          <AdminStatCard
            title="متوفر بالمخزون"
            value={inStockCount}
            icon={CheckCircle2}
            trend={{ value: `${products.length ? Math.round((inStockCount / products.length) * 100) : 0}%`, isPositive: true, label: 'من الإجمالي' }}
          />
          <AdminStatCard
            title="مخزون منخفض"
            value={lowStockCount}
            icon={AlertTriangle}
            trend={{ value: `${lowStockCount} أجهزة`, isPositive: false, label: 'بحاجة للتوريد' }}
          />
          <AdminStatCard
            title="نفد المخزون"
            value={outOfStockCount}
            icon={XCircle}
            trend={{ value: `${outOfStockCount} أجهزة`, isPositive: false, label: 'غير متاح للطلب' }}
          />
        </div>
      )}

      {/* Main product management toggle panel */}
      {!editingProduct ? (
        <AdminCard className="space-y-4">
          {/* 3, 4, 5. Search Bar, Filter Controls & Toolbar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <AdminSearchInput
              value={search}
              onChange={(val) => setSearch(val)}
              placeholder="بحث بالاسم، SKU، الباركود..."
              className="col-span-1 sm:col-span-2 lg:col-span-1"
            />

            {/* Category Filter */}
            <div>
              <CustomSelect
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val)}
                size="sm"
                buttonClassName="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-800 dark:text-white text-xs rounded-xl py-2.5 px-3 focus:border-amber-500 shadow-xs"
                menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
                options={[
                  { value: 'all', label: `كل الأقسام (${products.length})` },
                  ...categoriesList.map((cat) => ({ value: cat, label: cat }))
                ]}
              />
            </div>

            {/* Stock / Status Filter */}
            <div>
              <CustomSelect
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
                size="sm"
                buttonClassName="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-800 dark:text-white text-xs rounded-xl py-2.5 px-3 focus:border-amber-500 shadow-xs"
                menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
                options={[
                  { value: 'all', label: 'كل حالات المخزون' },
                  { value: 'inStock', label: 'متوفر بالمخزون' },
                  { value: 'lowStock', label: 'مخزون منخفض (≤ 5)' },
                  { value: 'outOfStock', label: 'نفد المخزون' },
                  { value: 'featured', label: 'منتجات مميزة ⭐' }
                ]}
              />
            </div>

            {/* Sorting */}
            <div>
              <CustomSelect
                value={sortBy}
                onChange={(val) => setSortBy(val)}
                size="sm"
                buttonClassName="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-800 dark:text-white text-xs rounded-xl py-2.5 px-3 focus:border-amber-500 shadow-xs"
                menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
                options={[
                  { value: 'newest', label: 'الأحدث أولاً' },
                  { value: 'priceAsc', label: 'السعر: من الأقل للأعلى' },
                  { value: 'priceDesc', label: 'السعر: من الأعلى للأقل' },
                  { value: 'title', label: 'حسب الاسم (أبجدي)' },
                  { value: 'stockAsc', label: 'المخزون: الأقل أولاً' },
                  { value: 'stockDesc', label: 'المخزون: الأكثر أولاً' }
                ]}
              />
            </div>
          </div>

          {/* 6. Content (Table or Empty State) */}
          {filteredProducts.length === 0 ? (
            <AdminEmptyState
              icon={Package}
              title="لا توجد منتجات تطابق خيارات البحث والفلترة"
              description="لم نجد أي جهاز يطابق معايير البحث أو القسم المحدد، جرب إعادة تعيين الفلاتر."
              action={
                (search || categoryFilter !== 'all' || statusFilter !== 'all') && (
                  <AdminButton
                    variant="outline"
                    size="sm"
                    icon={RotateCcw}
                    onClick={() => {
                      setSearch('');
                      setCategoryFilter('all');
                      setStatusFilter('all');
                      setSortBy('newest');
                    }}
                  >
                    إعادة ضبط البحث والفلاتر
                  </AdminButton>
                )
              }
            />
          ) : (
            <>
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3.5 px-3">صورة</th>
                      <th className="py-3.5 px-3">اسم الجهاز وموديله</th>
                      <th className="py-3.5 px-3">القسم</th>
                      <th className="py-3.5 px-3">الماركة</th>
                      <th className="py-3.5 px-3">سعر البيع</th>
                      <th className="py-3.5 px-3">المخزون الحالي</th>
                      <th className="py-3.5 px-3 text-left pl-6">إجراءات تحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {paginatedProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <img
                            src={p.mainImage}
                            alt={p.title}
                            className="w-10 h-10 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 dark:text-white max-w-sm truncate">{p.title}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 flex flex-wrap items-center gap-2">
                            <span>SKU: {p.sku}</span>
                            {p.barcode && <span className="text-amber-600 dark:text-amber-400 font-mono">| 🏷️ {p.barcode}</span>}
                            <span className="text-emerald-600 dark:text-emerald-400 font-mono">| 📱 {p.qrCode || `QR-${p.id}`}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-semibold">{p.category}</td>
                        <td className="py-3 px-3">
                          <AdminBadge variant="neutral">{p.brand}</AdminBadge>
                        </td>
                        <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400 font-mono">
                          {p.discountPrice ? (
                            <div className="flex flex-col">
                              <span>{p.discountPrice} ج.م</span>
                              <span className="line-through text-slate-400 dark:text-slate-500 text-[10px]">{p.price} ج.م</span>
                            </div>
                          ) : (
                            <span>{p.price} ج.م</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {p.stock === 0 ? (
                            <AdminBadge variant="danger">نفد المخزون</AdminBadge>
                          ) : p.stock <= 5 ? (
                            <AdminBadge variant="warning">{p.stock} متبقي</AdminBadge>
                          ) : (
                            <AdminBadge variant="success">{p.stock} وحدة</AdminBadge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-left pl-6">
                          <div className="inline-flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setQrLabelData({
                                isOpen: true,
                                title: p.title,
                                sku: p.sku,
                                price: p.discountPrice || p.price,
                                qrCodeValue: p.qrCode || `QR-${p.id}`,
                                barcodeValue: p.barcode,
                                location: p.location || 'المستودع الرئيسي',
                                productId: p.id
                              })}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                              title="عرض وطباعة ملصق الـ QR"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditClick(p)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                              title="تعديل الجهاز"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(p)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                              title="تكرار / نسخ"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id, p.title)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                              title="حذف نهائي"
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
              <AdminTablePagination
                page={currentPage}
                totalPages={totalPages}
                total={filteredProducts.length}
                limit={limit}
                onPageChange={(p) => setCurrentPage(p)}
                onLimitChange={(l) => {
                  setLimit(l);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </AdminCard>
      ) : (
        /* CRUD Adding / Editing form */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4.5 h-4.5 text-amber-500" />
              {showAddForm ? 'إدراج جهاز منزلي جديد للفهرس المبيعات' : `تعديل مواصفات وبيانات: [ ${editingProduct.title} ]`}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditingProduct(null);
                setShowAddForm(false);
              }}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          <form onSubmit={handleSaveSubmit} className="space-y-6">
            {/* Core Titles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم الجهاز بالعربية <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingProduct.title || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                  placeholder="مثال: شاشة سامسونج OLED كيرف 55 بوصة"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الاسم الإنجليزي (اختياري)</label>
                <input
                  type="text"
                  value={editingProduct.titleEn || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, titleEn: e.target.value })}
                  placeholder="e.g. Samsung OLED 55 Inch TV"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 text-left transition-colors"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Price and Stock row */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">السعر الأصلي (ج.م) <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingProduct.price !== undefined ? editingProduct.price : ''}
                  onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                  onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                  onChange={(e) => {
                    const clean = sanitizeNumericInput(e.target.value, 'non_negative_decimal');
                    setEditingProduct({ ...editingProduct, price: clean === '' ? ('' as any) : Number(clean) });
                  }}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">سعر العرض/الخصم</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingProduct.discountPrice !== undefined ? editingProduct.discountPrice : ''}
                  onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                  onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                  onChange={(e) => {
                    const clean = sanitizeNumericInput(e.target.value, 'non_negative_decimal');
                    setEditingProduct({ ...editingProduct, discountPrice: clean ? Number(clean) : undefined });
                  }}
                  placeholder="سعر مخفض"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">كود SKU <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingProduct.sku || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 font-mono transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الباركود (Barcode)</label>
                  <button
                    type="button"
                    onClick={handleGenerateBarcodeForProduct}
                    className="text-[9px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 cursor-pointer"
                    title="توليد باركود تلقائي فريد"
                  >
                    ⚡ توليد
                  </button>
                </div>
                <input
                  type="text"
                  value={editingProduct.barcode || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                  placeholder="مثال: 6221234567890"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 font-mono transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رمز الـ QR</label>
                  <button
                    type="button"
                    onClick={handleGenerateQrForProduct}
                    className="text-[9px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30 cursor-pointer"
                    title="توليد رمز QR فريد"
                  >
                    ⚡ QR
                  </button>
                </div>
                <input
                  type="text"
                  value={editingProduct.qrCode || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, qrCode: e.target.value })}
                  placeholder="مثال: QR-P123"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 font-mono transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">المخزن <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editingProduct.stock === undefined ? '' : editingProduct.stock}
                  onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_integer')}
                  onPaste={(e) => handleNumericPaste(e, 'non_negative_integer')}
                  onChange={(e) => {
                    const clean = sanitizeNumericInput(e.target.value, 'non_negative_integer');
                    setEditingProduct({ ...editingProduct, stock: clean === '' ? ('' as any) : Number(clean) });
                  }}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition-colors"
                />
              </div>
            </div>

            {/* Optional Stock Adjustment Reason when editing existing product */}
            {!showAddForm && (
              <div className="flex flex-col gap-1.5 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>سبب أو بيان تعديل المخزون (اختياري - يوثق في سجل حركات الجرد)</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">Audit Ledger Enabled</span>
                </label>
                <input
                  type="text"
                  value={(editingProduct as any).stockAdjustmentReason || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stockAdjustmentReason: e.target.value } as any)}
                  placeholder="مثال: تصحيح جرد فعلي، بضاعة تالفة، استلام شحنة إضافية..."
                  className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-sans"
                />
              </div>
            )}

            {/* Brand, Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الماركة التجارية <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingProduct.brand || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                  placeholder="مثل: LG، سامسونج، كاريير، توشيبا"
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">القسم الفني <span className="text-red-500">*</span></label>
                <CustomSelect
                  value={editingProduct.category || 'أجهزة المطبخ الصغيرة'}
                  onChange={(val) => setEditingProduct({ ...editingProduct, category: val })}
                  size="sm"
                  buttonClassName="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-lg p-3 focus:border-amber-500"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg"
                  options={[
                    { value: 'تلفزيونات وشاشات', label: 'تلفزيونات وشاشات' },
                    { value: 'ثلاجات وفريزرات', label: 'ثلاجات وفريزرات' },
                    { value: 'غسالات ومجففات', label: 'غسالات ومجففات' },
                    { value: 'تكييفات ومراوح', label: 'تكييفات ومراوح' },
                    { value: 'أجهزة المطبخ الصغيرة', label: 'أجهزة المطبخ الصغيرة' }
                  ]}
                />
              </div>
            </div>

            {/* Product Image Uploader */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 space-y-2">
              <ImageUploader
                label="صور الأجهزة والمنتجات"
                multiple={true}
                images={editingProduct.images || []}
                mainImage={editingProduct.mainImage || ''}
                onImagesChange={(updatedImages, updatedMain) => {
                  setEditingProduct(prev => ({
                    ...prev,
                    images: updatedImages,
                    mainImage: updatedMain
                  }));
                }}
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">وصف تفصيلي كامل للجهاز ومميزاته <span className="text-red-500">*</span></label>
              <textarea
                rows={5}
                value={editingProduct.description || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-950 leading-relaxed resize-none transition-colors"
                placeholder="اكتب مميزات الجهاز التشغيلية، ومجالات استخدامه لمساعدة العميل في الاختيار..."
              />
            </div>

            {/* Feature lists tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
              {/* Add Key Specifications list */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">المواصفات التقنية الفنية (الخصائص)</h4>
                <div className="space-y-2 mb-3">
                  {(editingProduct.specifications || []).map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 px-3 py-1.5 rounded-lg text-xs shadow-xs">
                      <span className="text-amber-600 dark:text-amber-500 font-semibold">{s.key}</span>
                      <span className="text-slate-700 dark:text-slate-300">{s.value}</span>
                      <button
                        type="button"
                        onClick={() => removeSpec(idx)}
                        className="text-rose-600 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 font-bold text-xs"
                      >
                        إزالة
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="اسم الخاصية (مثال: السعة)"
                    value={specKey}
                    onChange={(e) => setSpecKey(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2 text-xs rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  <input
                    type="text"
                    placeholder="القيمة (مثال: 500 لتر)"
                    value={specVal}
                    onChange={(e) => setSpecVal(e.target.value)}
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2 text-xs rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={addSpec}
                    className="px-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    إدراج
                  </button>
                </div>
              </div>

              {/* Add Variants list */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-3">الموديلات والخيارات البديلة (Variants)</h4>
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto pr-1">
                  {(editingProduct.variants || []).map((v, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 px-3 py-1.5 rounded-lg text-[10px] shadow-xs">
                      <span className="text-slate-800 dark:text-slate-300 font-bold">{v.size || v.color || v.capacity || 'موديل بديل'}</span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono text-[9px]">SKU: {v.sku}</span>
                      {v.barcode && <span className="text-amber-600 dark:text-amber-400 font-mono text-[9px]">BC: {v.barcode}</span>}
                      <span className="text-amber-600 dark:text-amber-500 font-bold">{v.price} ج.م</span>
                      <span className="text-slate-600 dark:text-slate-400">المخزون: {v.stock}</span>
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="text-rose-600 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 font-bold text-[10px]"
                      >
                        إزالة
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="الحجم/سعة"
                    value={varSize}
                    onChange={(e) => setVarSize(e.target.value)}
                    className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2 text-[10px] rounded text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  <input
                    type="text"
                    placeholder="اللون"
                    value={varColor}
                    onChange={(e) => setVarColor(e.target.value)}
                    className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2 text-[10px] rounded text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="سعر الخيار"
                    value={varPrice}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                    onChange={(e) => setVarPrice(sanitizeNumericInput(e.target.value, 'non_negative_decimal'))}
                    className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2 text-[10px] rounded text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="المخزون"
                    value={varStock}
                    onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_integer')}
                    onPaste={(e) => handleNumericPaste(e, 'non_negative_integer')}
                    onChange={(e) => setVarStock(sanitizeNumericInput(e.target.value, 'non_negative_integer'))}
                    className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2 text-[10px] rounded text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  />
                  <input
                    type="text"
                    placeholder="كود SKU"
                    value={varSku}
                    onChange={(e) => setVarSku(e.target.value)}
                    className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2 text-[10px] rounded text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
                  />
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="الباركود"
                      value={varBarcode}
                      onChange={(e) => setVarBarcode(e.target.value)}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 p-2 text-[10px] rounded text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateBarcodeForVariant}
                      className="px-1.5 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 dark:border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 rounded text-[9px] font-bold shrink-0 cursor-pointer"
                      title="توليد باركود تلقائي"
                    >
                      ⚡
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="bg-amber-500 hover:bg-amber-600 dark:hover:bg-amber-400 text-slate-950 rounded text-[10px] font-black py-1.5 cursor-pointer shadow-xs"
                  >
                    إدراج موديل
                  </button>
                </div>
              </div>
            </div>

            {/* Campaign flags */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProduct.isFeatured || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                />
                مميز بالرئيسية ⭐
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProduct.isBestSeller || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isBestSeller: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                />
                الأكثر مبيعاً 🔥
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProduct.isLatest || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isLatest: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                />
                وصول جديد 🆕
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProduct.isFlashSale || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isFlashSale: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800"
                />
                عرض فلاش ترويجي ⚡
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                type="submit"
                className="flex-1 py-3 px-6 bg-amber-500 hover:bg-amber-600 dark:hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-4.5 h-4.5" />
                حفظ تفاصيل الجهاز والخيارات
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setShowAddForm(false);
                }}
                className="py-3 px-6 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
              >
                إلغاء التراجع
              </button>
            </div>

          </form>
        </div>
      )}

      {/* 📱 QR Code Label Printable Modal */}
      {qrLabelData && (
        <QrCodeLabelModal
          isOpen={qrLabelData.isOpen}
          onClose={() => setQrLabelData(null)}
          title={qrLabelData.title}
          sku={qrLabelData.sku}
          price={qrLabelData.price}
          qrCodeValue={qrLabelData.qrCodeValue}
          barcodeValue={qrLabelData.barcodeValue}
          location={qrLabelData.location}
          productId={qrLabelData.productId}
          variantId={qrLabelData.variantId}
          variantInfo={qrLabelData.variantInfo}
          onQrUpdated={(newQr) => {
            setQrLabelData(prev => prev ? { ...prev, qrCodeValue: newQr } : null);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}
