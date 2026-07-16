import { useState, useEffect } from 'react';
import { ClipboardList, Printer, Check, RefreshCw, X, AlertCircle, Phone, Truck, FileText } from 'lucide-react';
import { api } from '../lib/api.js';
import { Order } from '../types.js';

interface AdminOrdersProps {
  onRefreshAll: () => void;
}

export default function AdminOrders({ onRefreshAll }: AdminOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Selected order details for active view / print invoice
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminOrders();
      setOrders(res);
    } catch (err: any) {
      setError('فشل تحميل سجل الطلبات والفواتير من المخدم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      setError('');
      setSuccess('');
      const updated = await api.updateAdminOrderStatus(orderId, newStatus, statusReason || undefined);
      setSuccess(`تم تحديث حالة الطلب #${orderId.slice(-6).toUpperCase()} بنجاح إلى ${newStatus}`);
      
      // Update local state lists
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(updated);
      }
      setStatusReason('');
      onRefreshAll();
    } catch (err) {
      setError('فشل تحديث حالة الشحنة، يرجى المحاولة لاحقاً');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <span className="text-xs">جارٍ تجميع طلبات الشحن النشطة من المخدم الرئيسي...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold">
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Orders list (takes 7 cols on lg) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <h3 className="text-sm font-black text-white mb-5 pb-3 border-b border-slate-800 flex items-center gap-2">
            <ClipboardList className="w-4.5 h-4.5 text-amber-500" />
            طلبات الشحن والطلبيات الواردة
          </h3>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {orders.length > 0 ? (
              orders.map((o) => {
                const isPending = o.status === 'Pending';
                const statusColor = o.status === 'Pending' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
                                    o.status === 'Confirmed' ? 'text-blue-500 bg-blue-500/10 border-blue-500/20' :
                                    o.status === 'Preparing' ? 'text-purple-500 bg-purple-500/10 border-purple-500/20' :
                                    o.status === 'Shipped' ? 'text-sky-500 bg-sky-500/10 border-sky-500/20' :
                                    o.status === 'Delivered' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
                                    'text-rose-500 bg-rose-500/10 border-rose-500/20';
                return (
                  <div
                    key={o.id}
                    onClick={() => { setSelectedOrder(o); setShowInvoice(false); }}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-right flex flex-col gap-2.5 ${selectedOrder?.id === o.id ? 'bg-slate-950 border-amber-500/40 shadow-lg' : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-950/70 hover:border-slate-700/80'}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white">كود الطلب: #{o.id.slice(-6).toUpperCase()}</span>
                        <span className={`text-[10px] font-bold border rounded px-2 py-0.5 ${statusColor}`}>
                          {o.status === 'Pending' ? 'بانتظار المراجعة (Pending)' :
                           o.status === 'Confirmed' ? 'مؤكد وبالمستودع (Confirmed)' :
                           o.status === 'Preparing' ? 'تحت التغليف والتحضير' :
                           o.status === 'Shipped' ? 'خارج للتوصيل بالطريق' :
                           o.status === 'Delivered' ? 'تم الاستلام والدفع بالكامل' : 'طلب ملغي'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{new Date(o.createdAt || o.date || new Date()).toLocaleDateString('ar-EG')}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                      <div>المشتري: <strong className="text-white font-bold">{o.customer.name}</strong></div>
                      <div>الهاتف: <strong className="text-white font-mono">{o.customer.phone}</strong></div>
                      <div>المحافظة: <strong className="text-white">{o.customer.governorate}</strong></div>
                      <div>قيمة الفاتورة: <strong className="text-amber-500 font-black">{(o as any).grandTotal || o.total} ج.م</strong></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-500 text-center py-12">لا توجد أية طلبات سابقة حتى الساعة.</p>
            )}
          </div>
        </div>

        {/* Right: Selected Order manager & Actions (takes 5 cols on lg) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {selectedOrder ? (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-right">
              {/* Header */}
              <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-4">
                <h3 className="text-sm font-black text-white">تفاصيل الطلب #{selectedOrder.id.slice(-6).toUpperCase()}</h3>
                <button
                  onClick={() => setShowInvoice(true)}
                  className="flex items-center gap-1 py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded"
                >
                  <Printer className="w-3.5 h-3.5" />
                  طباعة فاتورة COD
                </button>
              </div>

              {/* Status stepper advance buttons */}
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-850 mb-4 space-y-3">
                <span className="text-[10px] font-black text-slate-400 block mb-1">تحديث وتسيير مرحلة الشحن والتوصيل</span>
                <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                  {selectedOrder.status === 'Pending' && (
                    <button
                      onClick={() => handleStatusChange(selectedOrder.id, 'Confirmed')}
                      className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
                    >
                      تأكيد هاتفي (Confirmed)
                    </button>
                  )}
                  {selectedOrder.status === 'Confirmed' && (
                    <button
                      onClick={() => handleStatusChange(selectedOrder.id, 'Preparing')}
                      className="py-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded cursor-pointer"
                    >
                      تغليف وتحضير (Preparing)
                    </button>
                  )}
                  {selectedOrder.status === 'Preparing' && (
                    <button
                      onClick={() => handleStatusChange(selectedOrder.id, 'Shipped')}
                      className="py-1.5 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded cursor-pointer"
                    >
                      شحن وتسليم للمندوب (Shipped)
                    </button>
                  )}
                  {selectedOrder.status === 'Shipped' && (
                    <button
                      onClick={() => handleStatusChange(selectedOrder.id, 'Delivered')}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
                    >
                      تم تسليم الشحنة وتحصيل المال (Delivered)
                    </button>
                  )}
                  {selectedOrder.status !== 'Delivered' && selectedOrder.status !== 'Cancelled' && (
                    <button
                      onClick={() => handleStatusChange(selectedOrder.id, 'Cancelled')}
                      className="py-1.5 px-3 bg-rose-650 hover:bg-rose-600 text-white rounded cursor-pointer"
                    >
                      إلغاء الطلب (Cancelled)
                    </button>
                  )}
                </div>

                <div className="pt-2">
                  <span className="text-[9px] text-slate-500 block mb-1">سبب التحديث أو ملاحظات المندوب (اختياري)</span>
                  <input
                    type="text"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="مثل: المشتري مغلق الهاتف، يرجى إعادة الاتصال لاحقاً"
                    className="w-full text-[11px] bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              {/* Items Summary details */}
              <div className="space-y-2 mb-4">
                <span className="text-[10px] font-black text-slate-400 block mb-1">الأجهزة والقطع المطلوبة</span>
                {selectedOrder.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-950/60 p-2 rounded border border-slate-850">
                    <div className="text-right">
                      <span className="text-white font-bold block">{it.productTitle}</span>
                      <span className="text-[10px] text-slate-500">العدد: {it.quantity} حبة {it.variantInfo ? `| ${it.variantInfo}` : ''}</span>
                    </div>
                    <span className="font-bold text-amber-500">{it.price * it.quantity} ج.م</span>
                  </div>
                ))}
              </div>

              {/* Customer full details */}
              <div className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
                <span className="text-[10px] font-black text-slate-400 block mb-1">بيانات العميل وعنوان شحن البيت</span>
                <div>الاسم: <strong className="text-white font-bold">{selectedOrder.customer.name}</strong></div>
                <div>الهاتف: <strong className="text-white font-mono flex items-center gap-1"><Phone className="w-3 h-3 text-amber-500 inline" /> {selectedOrder.customer.phone}</strong></div>
                {selectedOrder.customer.altPhone && <div>هاتف بديل: <strong className="text-white font-mono">{selectedOrder.customer.altPhone}</strong></div>}
                <div>المحافظة والحي: <strong className="text-white">{selectedOrder.customer.governorate}، {selectedOrder.customer.city}</strong></div>
                <div>العنوان التفصيلي: <strong className="text-white leading-relaxed">{selectedOrder.customer.address}</strong></div>
                {selectedOrder.customer.notes && <div className="p-2 bg-amber-500/5 rounded border border-amber-500/10 text-[11px] text-amber-300 mt-2">ملاحظات العميل: {selectedOrder.customer.notes}</div>}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center text-slate-500 text-xs">
              الرجاء النقر فوق أحد الطلبات في القائمة الجانبية لعرض كافة تفاصيل الشحن والتحكم المالي بفاتورة COD.
            </div>
          )}
        </div>
      </div>

      {/* Printable commercial invoice overlay sheet */}
      {selectedOrder && showInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 print:p-0 overflow-y-auto" id="invoice-modal">
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
                  <div>رقم الفاتورة: #{selectedOrder.id.slice(-6).toUpperCase()}</div>
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
                  {selectedOrder.items.map((it, idx) => (
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
    </div>
  );
}
