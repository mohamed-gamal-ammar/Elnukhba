import React, { useState } from 'react';
import { Trash2, ShieldAlert, AlertTriangle, CheckCircle, RefreshCw, CheckSquare, Square, X } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import {
  AdminPageHeader,
  AdminCard,
  AdminButton,
  AdminBadge
} from './AdminUIComponents.js';

interface AdminCleanupProps {
  onRefreshAll: () => void;
}

export default function AdminCleanup({ onRefreshAll }: AdminCleanupProps) {
  const [deleteOrders, setDeleteOrders] = useState(true);
  const [deleteCustomers, setDeleteCustomers] = useState(true);
  const [deleteNotifications, setDeleteNotifications] = useState(true);
  const [deleteLogs, setDeleteLogs] = useState(true);
  const [deleteReviews, setDeleteReviews] = useState(true);
  const [deleteCoupons, setDeleteCoupons] = useState(true);
  const [deleteProducts, setDeleteProducts] = useState(false); // Optional, default to false

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleCleanupSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.cleanupStore({
        deleteOrders,
        deleteCustomers,
        deleteNotifications,
        deleteLogs,
        deleteReviews,
        deleteCoupons,
        deleteProducts
      });
      if (res && res.success) {
        setSuccess('تم تهيئة وتطهير قاعدة البيانات وتجهيز المتجر للإطلاق بنجاح! 🚀✨');
        onRefreshAll();
        setShowConfirmModal(false);
      } else {
        setError(getFriendlyErrorMessage(res?.message, 'فشلت عملية تهيئة المتجر.'));
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء محاولة الاتصال بالخادم وإجراء التطهير.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 dir-rtl font-sans" id="admin-cleanup-module">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="تهيئة المتجر للإطلاق وإنتاجية العمليات"
        description="قم بإفراغ وتنظيف الجداول وتطهير البيانات التجريبية قبل توجيه الحركة الفعلية للموقع"
        icon={ShieldAlert}
        badge={<AdminBadge variant="danger">منطقة حساسة</AdminBadge>}
      />

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-white cursor-pointer font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-700 dark:text-rose-400 font-bold shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-white cursor-pointer font-bold">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <AdminCard className="space-y-6">
        <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 flex gap-3 text-xs leading-relaxed text-amber-900 dark:text-amber-200 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-800 dark:text-amber-400 block mb-1">تنبيه أمان في غاية الأهمية ⚠️</strong>
            هذه العملية مصممة لحذف البيانات التجريبية وتهيئة متجر النخبة للإطلاق الفعلي. تلتزم الأداة بشكل كامل بعدم مساس:
            <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-700 dark:text-slate-300 font-medium">
              <li>حسابات مديري النظام ومسؤولي التسيير الفني</li>
              <li>الفئات والبراندات الأساسية النشطة</li>
              <li>إعدادات وهوية وتذييل صفحات المتجر (CMS)</li>
              <li>تسعير الشحن الموحد وضريبة القيمة المضافة</li>
              <li>تكوينات المتجر وهيكلية التشغيل</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-black text-slate-900 dark:text-white">حدد البيانات التي تود تطهيرها وإزالتها نهائياً:</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Option 1 */}
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors shadow-xs">
              <input
                type="checkbox"
                checked={deleteOrders}
                onChange={(e) => setDeleteOrders(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">حذف الطلبات التجريبية (Demo Orders)</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 block font-medium">سيتم إفراغ كافة طلبات الشراء الحالية وسجل مبيعات الفواتير</span>
              </div>
            </label>

            {/* Option 2 */}
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors shadow-xs">
              <input
                type="checkbox"
                checked={deleteCustomers}
                onChange={(e) => setDeleteCustomers(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">حذف بيانات العملاء (Demo Customers)</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 block font-medium">سيتم تنظيف عناوين الشحن وأرقام هواتف المشترين المسجلين بالطلبات</span>
              </div>
            </label>

            {/* Option 3 */}
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors shadow-xs">
              <input
                type="checkbox"
                checked={deleteNotifications}
                onChange={(e) => setDeleteNotifications(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">حذف الإشعارات التجريبية (Demo Notifications)</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 block font-medium">إفراغ مركز تنبيهات المبيعات وإشعارات المخزون المنخفض والتقييمات</span>
              </div>
            </label>

            {/* Option 4 */}
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors shadow-xs">
              <input
                type="checkbox"
                checked={deleteLogs}
                onChange={(e) => setDeleteLogs(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">حذف سجل الأنشطة والأمان (Demo Audit Logs)</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 block font-medium">تنظيف سجل الأمان والعمليات (Audit Logs) للبدء بسجل نظيف وخاص بالإنتاج</span>
              </div>
            </label>

            {/* Option 5 */}
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors shadow-xs">
              <input
                type="checkbox"
                checked={deleteReviews}
                onChange={(e) => setDeleteReviews(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">حذف تقييمات العملاء التجريبية (Demo Reviews)</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 block font-medium">تطهير وإعادة ضبط كافة المراجعات وتقييمات النجوم على المنتجات للصفر</span>
              </div>
            </label>

            {/* Option 6 */}
            <label className="flex items-start gap-3 p-3.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-colors shadow-xs">
              <input
                type="checkbox"
                checked={deleteCoupons}
                onChange={(e) => setDeleteCoupons(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white block">حذف كوبونات الخصم التجريبية (Demo Coupons)</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 block font-medium">مسح كافة أكواد وكوبونات الخصم والبدء بكوبونات إنتاج جديدة</span>
              </div>
            </label>

            {/* Option 7 (Optional) */}
            <label className="flex items-start gap-3 p-3.5 bg-rose-50 hover:bg-rose-100/70 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl cursor-pointer transition-colors md:col-span-2 shadow-xs">
              <input
                type="checkbox"
                checked={deleteProducts}
                onChange={(e) => setDeleteProducts(e.target.checked)}
                className="mt-0.5 rounded border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-rose-500 focus:ring-0 w-4 h-4 cursor-pointer"
              />
              <div>
                <span className="text-xs font-black text-rose-600 dark:text-rose-400 block">حذف فهرس المنتجات التجريبية (Demo Products - اختياري)</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 block font-medium">تنبيه: سيؤدي هذا لتفريغ كتالوج الأجهزة بالكامل والبدء برصيد فارغ للربط أو الإدخال اليدوي للمنتجات</span>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-start pt-4 border-t border-slate-200 dark:border-slate-800">
          <AdminButton
            variant="danger"
            icon={Trash2}
            onClick={() => setShowConfirmModal(true)}
            disabled={!deleteOrders && !deleteCustomers && !deleteNotifications && !deleteLogs && !deleteReviews && !deleteCoupons && !deleteProducts}
          >
            تهيئة المتجر وحذف البيانات المحددة
          </AdminButton>
        </div>
      </AdminCard>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 text-right shadow-2xl font-sans animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800 mb-4 text-rose-600 dark:text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0 animate-bounce" />
              <h3 className="text-sm font-black">تحذير أخير: تأكيد الإجراء غير القابل للتراجع!</h3>
            </div>
            
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-5 font-medium">
              هل أنت متأكد تماماً من رغبتك في تهيئة وتطهير قاعدة البيانات؟ سيتم حذف البيانات المحددة نهائياً من خادم التطبيق ولا يمكن استرجاعها بأي وسيلة.
            </p>

            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-lg p-3 text-[11px] text-slate-600 dark:text-slate-400 mb-5 leading-normal space-y-1 border border-slate-200 dark:border-slate-800/60">
              <span className="font-bold text-slate-900 dark:text-white block mb-1">العمليات التي سيتم تنفيذها حالاً:</span>
              {deleteOrders && <div>• حذف وإفراغ سجل طلبات المبيعات كاملاً</div>}
              {deleteCustomers && <div>• إزالة وتطهير بيانات وهواتف العملاء المسجلة</div>}
              {deleteNotifications && <div>• إفراغ وتنظيف مركز الإشعارات والتنبيهات</div>}
              {deleteLogs && <div>• تطهير وإعادة ضبط سجل الأنشطة والعمليات (مع الاحتفاظ بهذا الإجراء)</div>}
              {deleteReviews && <div>• إزالة وإعادة تصفير مراجعات وتقييمات المنتجات</div>}
              {deleteCoupons && <div>• مسح وتطهير كوبونات وأكواد الخصم التجريبية</div>}
              {deleteProducts && <div className="text-rose-600 dark:text-rose-400 font-bold">• تنبيه: سيتم حذف كافة المنتجات والأجهزة من الكتالوج نهائياً!</div>}
            </div>

            <div className="flex gap-3 justify-end text-xs font-bold">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer font-bold shadow-xs"
              >
                إلغاء التراجع
              </button>
              <button
                onClick={handleCleanupSubmit}
                disabled={loading}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-lg font-bold"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    جارٍ تهيئة المتجر...
                  </>
                ) : (
                  <>
                    تأكيد الحذف والتهيئة 🚀
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
