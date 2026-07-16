import React, { useState } from 'react';
import { CreditCard, Truck, Receipt, CheckCircle, MapPin, AlertCircle } from 'lucide-react';
import { CartItem, ShippingDetails, SystemSettings } from '../types.js';

interface CheckoutFormProps {
  cart: CartItem[];
  settings: SystemSettings;
  couponDiscount: number;
  couponCode?: string;
  onPlaceOrder: (shippingDetails: ShippingDetails) => Promise<void>;
  onBackToCart: () => void;
}

const governorates = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية', 'الشرقية', 'المنوفية', 
  'الغربية', 'البحيرة', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 
  'الأقصر', 'أسوان', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'البحر الأحمر'
];

export default function CheckoutForm({
  cart,
  settings,
  couponDiscount,
  couponCode,
  onPlaceOrder,
  onBackToCart
}: CheckoutFormProps) {
  const [formData, setFormData] = useState<ShippingDetails>({
    name: '',
    phone: '',
    altPhone: '',
    address: '',
    governorate: 'القاهرة',
    city: '',
    notes: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cartSubtotal = cart.reduce((sum, item) => {
    const price = item.product.discountPrice || item.product.price;
    return sum + (price * item.quantity);
  }, 0);

  const taxRate = settings.taxRate;
  const taxAmount = Number((cartSubtotal * taxRate).toFixed(2));
  const shippingCost = settings.shippingFlatRate;
  const grandTotal = Number((cartSubtotal + taxAmount + shippingCost - couponDiscount).toFixed(2));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!formData.address.trim()) {
      setError('يرجى كتابة العنوان بالتفصيل (اسم الشارع، رقم العمارة، رقم الشقة)');
      return;
    }
    if (!formData.city.trim()) {
      setError('يرجى إدخال اسم المدينة أو المنطقة السكنية');
      return;
    }

    setLoading(true);
    try {
      await onPlaceOrder(formData);
    } catch (err: any) {
      setError(err.message || 'فشلت عملية إرسال الطلب، يرجى المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8" id="checkout-container">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Shipping fields form (takes 7 cols on lg) */}
        <div className="lg:col-span-7 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-6">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">تفاصيل شحن الأجهزة</h2>
              <p className="text-xs text-gray-500">أدخل عنوانك بعناية لضمان سرعة توصيل الفني والمندوب</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Customer Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">اسم المستلم بالكامل (ثلاثي) <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="أدخل الاسم ثلاثياً كما بالبطاقة لسلامة الاستلام"
                className="w-full text-sm border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* Phones row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">رقم الهاتف المحمول الأساسي <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="مثال: 01012345678"
                  className="w-full text-sm border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">رقم هاتف محمول بديل (اختياري)</label>
                <input
                  type="tel"
                  name="altPhone"
                  value={formData.altPhone}
                  onChange={handleInputChange}
                  placeholder="رقم آخر للتواصل عند تعذر الأول"
                  className="w-full text-sm border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Governorate & City */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">المحافظة <span className="text-red-500">*</span></label>
                <select
                  name="governorate"
                  value={formData.governorate}
                  onChange={handleInputChange}
                  className="w-full text-sm border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                >
                  {governorates.map(gov => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">المدينة / المركز / المنطقة <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="أدخل اسم المدينة أو الحي"
                  className="w-full text-sm border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">العنوان بالتفصيل الممل <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="رقم العمارة، اسم الشارع، الطابق، رقم الشقة أو علامة مميزة"
                className="w-full text-sm border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* Delivery Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">ملاحظات التوصيل أو فك وتركيب الأجهزة (اختياري)</label>
              <textarea
                name="notes"
                rows={3}
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="أية تعليمات خاصة بالمندوب (مثال: موعد تسليم محدد، يرجى التوصيل في سيارة مغلقة، إلخ)"
                className="w-full text-sm border border-gray-150 rounded-lg p-3 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 resize-none"
              />
            </div>

            {/* Direct Warning about COD payment */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 flex gap-3 text-slate-800 text-xs leading-relaxed mt-2">
              <CreditCard className="w-8 h-8 text-amber-500 shrink-0" />
              <div>
                <strong className="text-slate-950 block mb-1">تنبيه هام لطريقة الدفع:</strong>
                نظام السداد المتاح لدينا هو **الدفع النقدي أو بالبطاقة عند الاستلام فقط**. سيتصل بك موظف تأكيد المبيعات هاتفياً قبل خروج الشحنة لمراجعة المنتجات وموعد التوصيل.
              </div>
            </div>

            {/* Submission buttons */}
            <div className="flex gap-4 mt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-lg shadow-md hover:shadow-amber-500/10 transition-colors cursor-pointer flex justify-center items-center gap-1.5"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
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
                className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-lg transition-colors cursor-pointer"
              >
                رجوع للسلة
              </button>
            </div>
          </form>
        </div>

        {/* Right column: Sticky Order summary (takes 5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <h3 className="font-extrabold text-slate-900 text-sm pb-3 border-b border-gray-100 mb-4 flex items-center gap-2">
              <Receipt className="w-4.5 h-4.5 text-amber-500" />
              ملخص الفاتورة الإجمالية
            </h3>

            {/* Cart Items Summary list */}
            <div className="flex flex-col gap-3.5 mb-5 max-h-56 overflow-y-auto pr-1">
              {cart.map((item, index) => {
                const price = item.product.discountPrice || item.product.price;
                return (
                  <div key={index} className="flex gap-3 justify-between items-start text-xs border-b border-gray-50/50 pb-3">
                    <img
                      src={item.product.mainImage}
                      alt={item.product.title}
                      className="w-11 h-11 object-cover rounded border border-gray-100"
                    />
                    <div className="flex-1 min-w-0 pr-1 text-right">
                      <h4 className="font-bold text-slate-900 truncate leading-tight">{item.product.title}</h4>
                      <p className="text-gray-400 font-medium text-[10px] mt-1">
                        العدد: {item.quantity} حبة
                        {item.selectedVariant && ` | ${item.selectedVariant.size || item.selectedVariant.color || item.selectedVariant.capacity}`}
                      </p>
                    </div>
                    <span className="font-black text-slate-900 shrink-0 text-left">
                      {price * item.quantity} ج.م
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Detailed math calculations */}
            <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-600 border-b border-gray-100 pb-4 mb-4">
              <div className="flex justify-between items-center">
                <span>المجموع الفرعي للأجهزة:</span>
                <span className="text-slate-900 font-bold">{cartSubtotal} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-green-600">
                <span>خصم الكوبون {couponCode ? `(${couponCode})` : ""}:</span>
                <span>-{couponDiscount} ج.م</span>
              </div>
              <div className="flex justify-between items-center">
                <span>ضريبة القيمة المضافة الإجبارية ({settings.taxRate * 100}%):</span>
                <span className="text-slate-900 font-bold">{taxAmount} ج.م</span>
              </div>
              <div className="flex justify-between items-center">
                <span>تكلفة شحن وتأمين النقل البري 🚚:</span>
                <span className="text-slate-900 font-bold">{shippingCost} ج.م</span>
              </div>
            </div>

            {/* Grand Total */}
            <div className="flex justify-between items-center text-sm font-black text-slate-900 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-800">إجمالي السداد المطلوب نقداً:</span>
              <span className="text-lg text-amber-600 font-black">{grandTotal} ج.م</span>
            </div>
          </div>

          {/* Secure delivery guarantees widget */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex items-start gap-3">
            <MapPin className="w-8 h-8 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-black text-white mb-1.5">الشحن والتغطية لجميع المحافظات</h4>
              <p className="text-[10px] text-gray-400 leading-normal">
                نقوم بشحن الأجهزة المنزلية الكبرى في سيارات مكيفة مغلقة ضد الصدمات، ومجاناً للفنيين المعتمدين لخدمات التركيب والتشغيل الأولي عند الطلب.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
