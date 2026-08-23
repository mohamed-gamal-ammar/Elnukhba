import React, { useState, useEffect } from 'react';
import { CreditCard, Truck, Receipt, CheckCircle, MapPin, AlertCircle } from 'lucide-react';
import { CartItem, ShippingDetails, SystemSettings, Coupon } from '../types.js';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { useCustomerAuth } from '../context/CustomerAuthContext.js';
import { CustomSelect } from './CustomSelect.js';

interface CheckoutFormProps {
  cart: CartItem[];
  settings: SystemSettings;
  couponDiscount: number;
  couponCode?: string;
  activeCoupon?: Coupon | null;
  onPlaceOrder: (shippingDetails: ShippingDetails, idempotencyKey?: string) => Promise<any>;
  onBackToCart: () => void;
}

export default function CheckoutForm({
  cart,
  settings,
  couponDiscount,
  couponCode,
  activeCoupon,
  onPlaceOrder,
  onBackToCart
}: CheckoutFormProps) {
  const { customer, addresses, addAddress } = useCustomerAuth();
  const [saveAddress, setSaveAddress] = useState(false);
  const idempotencyKeyRef = React.useRef<string>(`idempotency_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const isSubmittingRef = React.useRef(false);

  const [formData, setFormData] = useState<ShippingDetails>({
    name: '',
    phone: '',
    altPhone: '',
    address: '',
    governorate: '',
    city: '',
    notes: ''
  });

  // Autofill form if customer is logged in
  useEffect(() => {
    if (customer) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || customer.name,
        phone: prev.phone || customer.phone || '',
        email: customer.email
      }));
      
      const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
      if (defaultAddr) {
        setFormData(prev => ({
          ...prev,
          address: defaultAddr.address,
          governorate: defaultAddr.governorate,
          city: defaultAddr.city,
          phone: defaultAddr.phone || prev.phone
        }));
      }
    }
  }, [customer, addresses]);

  const [provinces, setProvinces] = useState<any[]>([]);
  const [provincesLoading, setProvincesLoading] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch enabled provinces from database
  useEffect(() => {
    let active = true;
    api.getShippingProvinces()
      .then(data => {
        if (active) {
          // Only show enabled provinces
          const activeProvs = data.filter((p: any) => p.isActive);
          setProvinces(activeProvs);
          if (activeProvs.length > 0) {
            setFormData(prev => ({ ...prev, governorate: activeProvs[0].name }));
          }
          setProvincesLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to load shipping provinces', err);
        setProvincesLoading(false);
      });
    return () => { active = false; };
  }, []);

  const cartSubtotal = cart.reduce((sum, item) => {
    const price = item.selectedVariant ? item.selectedVariant.price : (item.product.discountPrice || item.product.price);
    return sum + (price * item.quantity);
  }, 0);

  const taxRate = settings.taxRate;
  const taxAmount = Number((cartSubtotal * taxRate).toFixed(2));

  // Determine dynamic shipping cost
  const selectedProvince = provinces.find(p => p.name === formData.governorate);
  let shippingCost = settings.shippingFlatRate;
  let estimatedDays = '';
  let freeShippingApplied = false;
  let isCodAvailable = true;

  if (selectedProvince) {
    shippingCost = selectedProvince.price;
    estimatedDays = selectedProvince.estimatedDays;
    isCodAvailable = selectedProvince.isCodAvailable;
    
    if (selectedProvince.freeShippingThreshold && cartSubtotal >= selectedProvince.freeShippingThreshold) {
      shippingCost = 0;
      freeShippingApplied = true;
    }
  }

  // Calculate dynamic coupon discount based on cart subtotal, shipping cost, and active coupon
  let effectiveCouponDiscount = couponDiscount;
  if (activeCoupon) {
    if (activeCoupon.minOrderValue && cartSubtotal < activeCoupon.minOrderValue) {
      effectiveCouponDiscount = 0;
    } else if (activeCoupon.discountType === 'percentage') {
      let d = (cartSubtotal * activeCoupon.value) / 100;
      if (activeCoupon.maxDiscountAmount && d > activeCoupon.maxDiscountAmount) {
        d = activeCoupon.maxDiscountAmount;
      }
      effectiveCouponDiscount = Math.round(d);
    } else if (activeCoupon.discountType === 'fixed') {
      effectiveCouponDiscount = Math.min(activeCoupon.value, cartSubtotal);
    } else if (activeCoupon.discountType === 'free_shipping') {
      effectiveCouponDiscount = shippingCost;
    }
  }

  const grandTotal = Math.max(0, Number((cartSubtotal + taxAmount + shippingCost - effectiveCouponDiscount).toFixed(2)));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || loading || isSuccess) {
      return;
    }
    setError('');

    // Field validation
    if (!formData.name.trim()) {
      setError('يرجى إدخال اسم المستلم بالكامل');
      return;
    }
    if (formData.name.trim().split(' ').length < 3) {
      setError('يرجى إدخال الاسم ثلاثياً على الأقل لضمان تسليم الشحنة');
      return;
    }
    if (!formData.phone.trim()) {
      setError('يرجى إدخال رقم الهاتف للتواصل');
      return;
    }
    const phoneRegex = /^01[0125]\d{8}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      setError('يرجى إدخال رقم هاتف محمول مصري صحيح (مثال: 01012345678)');
      return;
    }
    if (formData.altPhone && !phoneRegex.test(formData.altPhone.trim())) {
      setError('رقم الهاتف البديل غير صحيح، يجب أن يكون رقم محمول مصري صحيح');
      return;
    }
    if (!formData.governorate) {
      setError('يرجى اختيار محافظة الشحن');
      return;
    }
    if (!isCodAvailable) {
      setError('عذراً، الدفع عند الاستلام غير متاح حالياً للمحافظة المحددة');
      return;
    }
    if (!formData.address.trim()) {
      setError('يرجى كتابة العنوان بالتفصيل (اسم الشارع، رقم العمارة، رقم الشقة)');
      return;
    }
    if (!formData.city.trim()) {
      setError('يرجى إدخال اسم المدينة أو المنطقة السكنية');
      return;
    }

    setLoading(true);
    isSubmittingRef.current = true;

    try {
      // 1. Isolated address save if requested by logged-in customer
      if (customer && saveAddress) {
        try {
          await addAddress({
            name: `عنوان ${formData.city || 'الشراء'}`,
            recipientName: formData.name,
            phone: formData.phone,
            governorate: formData.governorate,
            city: formData.city,
            address: formData.address,
            additionalNotes: formData.notes,
            isDefault: addresses.length === 0
          });
        } catch (addrErr) {
          console.warn('Non-blocking save address error during checkout:', addrErr);
        }
      }

      // 2. Submit order creation to backend
      await onPlaceOrder(formData, idempotencyKeyRef.current);
      
      // Mark as succeeded so UI stays in a clean loading/transitioning state
      setIsSuccess(true);
    } catch (err: any) {
      isSubmittingRef.current = false;
      setLoading(false);
      // Reset idempotency key for user retry
      idempotencyKeyRef.current = `idempotency_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setError(getFriendlyErrorMessage(err, 'فشلت عملية إنشاء طلبك، يرجى مراجعة البيانات والمحاولة مجدداً'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8" id="checkout-container">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Shipping fields form (takes 7 cols on lg) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 dark:text-amber-400">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">تفاصيل شحن الأجهزة</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">أدخل عنوانك بعناية لضمان سرعة توصيل الفني والمندوب</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-400 font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Quick address selection for logged-in customer */}
            {customer && addresses.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 block mb-2 flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  اختر من عناوينك المحفوظة للملء السريع:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {addresses.map((addr) => {
                    const isSelected = formData.address === addr.address && formData.city === addr.city && formData.governorate === addr.governorate;
                    return (
                      <button
                        type="button"
                        key={addr.id}
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            address: addr.address,
                            governorate: addr.governorate,
                            city: addr.city,
                            phone: addr.phone || prev.phone,
                            name: addr.recipientName || prev.name
                          }));
                        }}
                        className={`text-right p-3 rounded-xl border text-xs transition-all flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/15 ring-2 ring-amber-500/20 text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full mb-1">
                          <span className="font-extrabold text-slate-900 dark:text-white">{addr.name}</span>
                          {addr.isDefault && <span className="text-[9px] font-bold text-amber-600 dark:text-amber-300 bg-amber-500/10 dark:bg-amber-500/20 px-1.5 py-0.5 rounded-md border border-amber-500/30">الافتراضي</span>}
                        </div>
                        <span className="text-slate-500 dark:text-slate-400 truncate w-full">{addr.address}، {addr.city}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Customer Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم المستلم بالكامل (ثلاثي) <span className="text-rose-500">*</span></label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="أدخل الاسم ثلاثياً كما بالبطاقة لسلامة الاستلام"
                className="w-full text-sm border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Phones row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رقم الهاتف المحمول الأساسي <span className="text-rose-500">*</span></label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="مثال: 01012345678"
                  className="w-full text-sm border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">رقم هاتف محمول بديل (اختياري)</label>
                <input
                  type="tel"
                  name="altPhone"
                  value={formData.altPhone}
                  onChange={handleInputChange}
                  placeholder="رقم آخر للتواصل عند تعذر الأول"
                  className="w-full text-sm border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Governorate & City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">المحافظة <span className="text-rose-500">*</span></label>
                {provincesLoading ? (
                  <div className="w-full h-[46px] rounded-xl border border-slate-300 dark:border-slate-800 p-3 bg-white dark:bg-slate-950 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                  </div>
                ) : (
                  <CustomSelect
                    name="governorate"
                    value={formData.governorate}
                    onChange={(val) => setFormData(prev => ({ ...prev, governorate: val }))}
                    placeholder="اختر المحافظة..."
                    buttonClassName="w-full text-sm border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-xl p-3 focus:border-amber-500 hover:border-slate-400 dark:hover:border-slate-700"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    options={provinces.map(prov => ({
                      value: prov.name,
                      label: prov.name,
                      description: prov.price === 0 ? 'شحن مجاني' : `تكلفة الشحن: ${prov.price} ج.م`,
                      badge: prov.isCodAvailable ? 'متاح كاش' : 'دفع إلكتروني'
                    }))}
                    searchable
                    searchPlaceholder="ابحث عن المحافظة..."
                  />
                )}
                {selectedProvince && (
                  <div className="flex flex-col gap-1 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-bold">
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      زمن التوصيل المقدر: {estimatedDays || 'خلال أيام عمل قليلة'}
                    </span>
                    {!isCodAvailable && (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">
                        ⚠️ الدفع عند الاستلام غير متاح لهذه المحافظة حالياً
                      </span>
                    )}
                    {selectedProvince.freeShippingThreshold && (
                      <span className="text-slate-500 dark:text-slate-400 mt-0.5">
                        {freeShippingApplied ? (
                          <strong className="text-emerald-600 dark:text-emerald-400">✓ تهانينا! الشحن مجاني لتخطيك حد {selectedProvince.freeShippingThreshold} ج.م</strong>
                        ) : (
                          `شحن مجاني عند الطلب بقيمة ${selectedProvince.freeShippingThreshold} ج.م أو أكثر`
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">المدينة / المركز / المنطقة <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="أدخل اسم المدينة أو الحي"
                  className="w-full text-sm border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">العنوان بالتفصيل الممل <span className="text-rose-500">*</span></label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="رقم العمارة، اسم الشارع، الطابق، رقم الشقة أو علامة مميزة"
                className="w-full text-sm border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Delivery Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">ملاحظات التوصيل أو فك وتركيب الأجهزة (اختياري)</label>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="أية تعليمات خاصة بالمندوب (مثال: موعد تسليم محدد، يرجى التوصيل في سيارة مغلقة، إلخ)"
                className="w-full text-sm border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl p-3 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>

            {/* Save address checkbox for logged-in user */}
            {customer && (
              <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors text-xs font-bold text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="w-4 h-4 text-amber-500 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-amber-500"
                />
                <span>حفظ هذا العنوان في قائمة عناوينك لسرعة الشراء في المرات القادمة</span>
              </label>
            )}

            {/* Direct Warning about COD payment */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 text-slate-700 dark:text-slate-300 text-xs leading-relaxed mt-2">
              <CreditCard className="w-8 h-8 text-amber-500 dark:text-amber-400 shrink-0" />
              <div>
                <strong className="text-slate-900 dark:text-white block mb-1">تنبيه هام لطريقة الدفع:</strong>
                نظام السداد المتاح لدينا هو <span className="text-amber-600 dark:text-amber-300 font-bold">الدفع النقدي أو بالبطاقة عند الاستلام فقط</span>. سيتصل بك موظف تأكيد المبيعات هاتفياً قبل خروج الشحنة لمراجعة المنتجات وموعد التوصيل.
              </div>
            </div>

            {/* Submission buttons */}
            <div className="flex gap-4 mt-4">
              <button
                type="submit"
                disabled={loading || isSuccess || !isCodAvailable}
                className="flex-1 py-3.5 px-6 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm rounded-xl shadow-md transition-colors cursor-pointer flex justify-center items-center gap-2"
              >
                {loading || isSuccess ? (
                  <>
                    <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                    <span>جاري معالجة وتأكيد طلبك...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    تأكيد الطلب وشحن الأجهزة الآن
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onBackToCart}
                disabled={loading || isSuccess}
                className="py-3.5 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                رجوع للسلة
              </button>
            </div>
          </form>
        </div>

        {/* Right column: Sticky Order summary (takes 5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm pb-3 border-b border-slate-200 dark:border-slate-800 mb-4 flex items-center gap-2">
              <Receipt className="w-4.5 h-4.5 text-amber-500 dark:text-amber-400" />
              ملخص الفاتورة الإجمالية
            </h3>

            {/* Cart Items Summary list */}
            <div className="flex flex-col gap-3.5 mb-5 max-h-56 overflow-y-auto pr-1 divide-y divide-slate-100 dark:divide-slate-800/60">
              {cart.map((item, index) => {
                const price = item.product.discountPrice || item.product.price;
                return (
                  <div key={index} className="flex gap-3 justify-between items-start text-xs pt-3 first:pt-0">
                    <img
                      src={item.product.mainImage}
                      alt={item.product.title}
                      className="w-11 h-11 object-cover rounded-lg border border-slate-200 dark:border-slate-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0 pr-1 text-right">
                      <h4 className="font-bold text-slate-900 dark:text-white truncate leading-tight">{item.product.title}</h4>
                      <p className="text-slate-500 dark:text-slate-400 font-medium text-[10px] mt-1">
                        العدد: {item.quantity} حبة
                        {item.selectedVariant && ` | ${item.selectedVariant.size || item.selectedVariant.color || item.selectedVariant.capacity}`}
                      </p>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white shrink-0 text-left">
                      {price * item.quantity} ج.م
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Detailed math calculations */}
            <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
              <div className="flex justify-between items-center">
                <span>المجموع الفرعي للأجهزة:</span>
                <span className="text-slate-900 dark:text-white font-bold">{cartSubtotal} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                <span>خصم الكوبون {couponCode ? `(${couponCode})` : ""}:</span>
                <span>-{effectiveCouponDiscount} ج.م</span>
              </div>
              <div className="flex justify-between items-center">
                <span>ضريبة القيمة المضافة الإجبارية ({settings.taxRate * 100}%):</span>
                <span className="text-slate-900 dark:text-white font-bold">{taxAmount} ج.م</span>
              </div>
              <div className="flex justify-between items-center">
                <span>تكلفة شحن وتأمين النقل البري 🚚:</span>
                <span className={`font-bold ${freeShippingApplied ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {freeShippingApplied ? 'مجاني بالكامل 🎉' : `${shippingCost} ج.م`}
                </span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between items-center text-sm font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300">إجمالي السداد المطلوب نقداً:</span>
              <span className="text-lg text-amber-600 dark:text-amber-400 font-black">{grandTotal} ج.م</span>
            </div>
          </div>

          {/* Secure delivery guarantees widget */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-5 shadow-md flex items-start gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900 dark:text-white mb-1.5">الشحن والتغطية لجميع المحافظات</h4>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-normal">
                نقوم بشحن الأجهزة المنزلية الكبرى في سيارات مكيفة مغلقة ضد الصدمات، ومجاناً للفنيين المعتمدين لخدمات التركيب والتشغيل الأولي عند الطلب.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
