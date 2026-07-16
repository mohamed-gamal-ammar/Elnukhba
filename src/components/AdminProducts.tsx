import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Copy, Percent, Save, X, Layers, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { Product, ProductVariant } from '../types.js';

interface AdminProductsProps {
  onRefreshAll: () => void;
}

export default function AdminProducts({ onRefreshAll }: AdminProductsProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts();
      setProducts(res);
    } catch (err: any) {
      setError('فشل تحميل المنتجات المخزنية الحالية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

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
    } catch (err) {
      setError('فشل حذف المنتج من الخادم');
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
    } catch (err) {
      setError('فشل تكرار منتج الأجهزة');
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!editingProduct) return;
    if (!editingProduct.title || !editingProduct.price || !editingProduct.sku) {
      setError('يرجى ملء الحقول الأساسية الإجبارية: اسم المنتج، السعر، وكود الـ SKU');
      return;
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
      setError(err.message || 'فشلت عملية الحفظ على الخادم');
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
    if (!editingProduct || !varPrice || !varStock || !varSku) return;
    const newVar: ProductVariant = {
      id: `var-${Date.now()}`,
      size: varSize.trim() || undefined,
      color: varColor.trim() || undefined,
      capacity: varCapacity.trim() || undefined,
      price: Number(varPrice),
      stock: Number(varStock),
      sku: varSku.trim(),
      barcode: `BC-${Date.now().toString().slice(-8)}`,
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
  };

  // Remove Variant Helper
  const removeVariant = (idx: number) => {
    if (!editingProduct) return;
    const currentVars = [...(editingProduct.variants || [])];
    currentVars.splice(idx, 1);
    setEditingProduct({ ...editingProduct, variants: currentVars });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <span className="text-xs">جارٍ جلب وتحديث مستندات المستودعات الرئيسية...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Messages row */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold flex items-center gap-2">
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main product management toggle panel */}
      {!editingProduct ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Layers className="w-4.5 h-4.5 text-amber-500" />
              قائمة المخزون والأجهزة الكهربائية
            </h3>
            <button
              onClick={handleAddNewClick}
              className="flex items-center gap-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة جهاز جديد للمتجر
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold">
                  <th className="py-3 px-3">صورة</th>
                  <th className="py-3 px-3">اسم الجهاز وموديله</th>
                  <th className="py-3 px-3">القسم</th>
                  <th className="py-3 px-3">الماركة</th>
                  <th className="py-3 px-3">سعر البيع</th>
                  <th className="py-3 px-3">المخزون الحالي</th>
                  <th className="py-3 px-3 text-left pl-6">إجراءات تحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-950/20">
                    <td className="py-3 px-3">
                      <img
                        src={p.mainImage}
                        alt={p.title}
                        className="w-10 h-10 object-cover rounded border border-slate-800"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white max-w-sm truncate">{p.title}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1">SKU: {p.sku}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold">{p.category}</td>
                    <td className="py-3 px-3"><span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-bold">{p.brand}</span></td>
                    <td className="py-3 px-3 font-bold text-amber-500">
                      {p.discountPrice ? (
                        <div className="flex flex-col">
                          <span>{p.discountPrice} ج.م</span>
                          <span className="line-through text-slate-500 text-[10px]">{p.price} ج.م</span>
                        </div>
                      ) : (
                        <span>{p.price} ج.م</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-black ${p.stock <= 3 ? 'text-rose-400 animate-pulse' : 'text-slate-200'}`}>
                        {p.stock} وحدة
                      </span>
                    </td>
                    <td className="py-3 px-3 text-left pl-6">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => handleEditClick(p)}
                          className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                          title="تعديل الجهاز"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicate(p)}
                          className="p-1.5 rounded bg-slate-800 text-amber-400 hover:bg-slate-700 transition-colors"
                          title="تكرار / نسخ"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.title)}
                          className="p-1.5 rounded bg-slate-800 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
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
        </div>
      ) : (
        /* CRUD Adding / Editing form */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Layers className="w-4.5 h-4.5 text-amber-500" />
              {showAddForm ? 'إدراج جهاز منزلي جديد للفهرس المبيعات' : `تعديل مواصفات وبيانات: [ ${editingProduct.title} ]`}
            </h3>
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowAddForm(false);
              }}
              className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          <form onSubmit={handleSaveSubmit} className="space-y-6">
            {/* Core Titles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">اسم الجهاز بالعربية <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingProduct.title || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                  placeholder="مثال: شاشة سامسونج OLED كيرف 55 بوصة"
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">الاسم الإنجليزي (اختياري)</label>
                <input
                  type="text"
                  value={editingProduct.titleEn || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, titleEn: e.target.value })}
                  placeholder="e.g. Samsung OLED 55 Inch TV"
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Price and Stock row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">السعر الأصلي (ج.م) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={editingProduct.price || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">سعر العرض/الخصم (اختياري)</label>
                <input
                  type="number"
                  value={editingProduct.discountPrice || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, discountPrice: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="سعر مخفض"
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">رمز المنتج الكودي SKU <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingProduct.sku || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">الرصيد المتاح بالمخزن <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={editingProduct.stock === undefined ? '' : editingProduct.stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stock: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Brand, Category and Image */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">الماركة التجارية <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingProduct.brand || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })}
                  placeholder="مثل: LG، سامسونج، كاريير، توشيبا"
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">القسم الفني <span className="text-red-500">*</span></label>
                <select
                  value={editingProduct.category || 'أجهزة المطبخ الصغيرة'}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="تلفزيونات وشاشات">تلفزيونات وشاشات</option>
                  <option value="ثلاجات وفريزرات">ثلاجات وفريزرات</option>
                  <option value="غسالات ومجففات">غسالات ومجففات</option>
                  <option value="تكييفات ومراوح">تكييفات ومراوح</option>
                  <option value="أجهزة المطبخ الصغيرة">أجهزة المطبخ الصغيرة</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">رابط الصورة الرئيسية للمنتج</label>
                <input
                  type="text"
                  value={editingProduct.mainImage || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, mainImage: e.target.value, images: [e.target.value] })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">وصف تفصيلي كامل للجهاز ومميزاته <span className="text-red-500">*</span></label>
              <textarea
                rows={5}
                value={editingProduct.description || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
                placeholder="اكتب مميزات الجهاز التشغيلية، ومجالات استخدامه لمساعدة العميل في الاختيار..."
              />
            </div>

            {/* Feature lists tags */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-slate-950/40 border border-slate-800">
              {/* Add Key Specifications list */}
              <div>
                <h4 className="font-bold text-white text-xs mb-3">المواصفات التقنية الفنية (الخصائص)</h4>
                <div className="space-y-2 mb-3">
                  {(editingProduct.specifications || []).map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-950 px-3 py-1.5 rounded-lg text-xs">
                      <span className="text-amber-500 font-semibold">{s.key}</span>
                      <span className="text-slate-300">{s.value}</span>
                      <button
                        type="button"
                        onClick={() => removeSpec(idx)}
                        className="text-rose-500 hover:text-rose-400 font-bold text-xs"
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
                    className="flex-1 bg-slate-950 border border-slate-800 p-2 text-xs rounded-lg text-white"
                  />
                  <input
                    type="text"
                    placeholder="القيمة (مثال: 500 لتر)"
                    value={specVal}
                    onChange={(e) => setSpecVal(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 p-2 text-xs rounded-lg text-white"
                  />
                  <button
                    type="button"
                    onClick={addSpec}
                    className="px-3 bg-slate-800 text-slate-200 hover:text-white rounded-lg text-xs font-bold"
                  >
                    إدراج
                  </button>
                </div>
              </div>

              {/* Add Variants list */}
              <div>
                <h4 className="font-bold text-white text-xs mb-3">الموديلات والخيارات البديلة (Variants)</h4>
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto pr-1">
                  {(editingProduct.variants || []).map((v, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-slate-950 px-3 py-1.5 rounded-lg text-[10px]">
                      <span className="text-slate-300">{v.size || v.color || v.capacity || 'موديل بديل'}</span>
                      <span className="text-amber-500 font-bold">{v.price} ج.م</span>
                      <span className="text-slate-400">المخزون: {v.stock}</span>
                      <button
                        type="button"
                        onClick={() => removeVariant(idx)}
                        className="text-rose-500 hover:text-rose-400 font-bold text-[10px]"
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
                    className="bg-slate-950 border border-slate-800 p-2 text-[10px] rounded text-white"
                  />
                  <input
                    type="text"
                    placeholder="اللون"
                    value={varColor}
                    onChange={(e) => setVarColor(e.target.value)}
                    className="bg-slate-950 border border-slate-800 p-2 text-[10px] rounded text-white"
                  />
                  <input
                    type="text"
                    placeholder="سعر الخيار"
                    value={varPrice}
                    onChange={(e) => setVarPrice(e.target.value)}
                    className="bg-slate-950 border border-slate-800 p-2 text-[10px] rounded text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    placeholder="مخزون الخيار"
                    value={varStock}
                    onChange={(e) => setVarStock(e.target.value)}
                    className="bg-slate-950 border border-slate-800 p-2 text-[10px] rounded text-white"
                  />
                  <input
                    type="text"
                    placeholder="كود SKU خيار"
                    value={varSku}
                    onChange={(e) => setVarSku(e.target.value)}
                    className="bg-slate-950 border border-slate-800 p-2 text-[10px] rounded text-white"
                  />
                  <button
                    type="button"
                    onClick={addVariant}
                    className="bg-slate-800 text-slate-200 hover:text-white rounded text-[10px] font-bold py-1.5"
                  >
                    إدراج موديل
                  </button>
                </div>
              </div>
            </div>

            {/* Campaign flags */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={editingProduct.isFeatured || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isFeatured: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800"
                />
                مميز بالرئيسية ⭐
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={editingProduct.isBestSeller || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isBestSeller: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800"
                />
                الأكثر مبيعاً 🔥
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={editingProduct.isLatest || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isLatest: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800"
                />
                وصول جديد 🆕
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={editingProduct.isFlashSale || false}
                  onChange={(e) => setEditingProduct({ ...editingProduct, isFlashSale: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-800"
                />
                عرض فلاش ترويجي ⚡
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="flex-1 py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
                className="py-3 px-6 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                إلغاء التراجع
              </button>
            </div>

          </form>
        </div>
      )}
    </div>
  );
}
