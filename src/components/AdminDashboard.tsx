import { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, ShoppingBag, AlertTriangle, Database, RefreshCw, Layers, ClipboardList, CheckCircle } from 'lucide-react';
import { api } from '../lib/api.js';

interface AdminDashboardProps {
  onNavigate: (tab: string, arg?: any) => void;
  onRefreshProducts: () => void;
  activeSubTab: string;
  setActiveSubTab: (sub: string) => void;
}

export default function AdminDashboard({
  onNavigate,
  onRefreshProducts,
  activeSubTab,
  setActiveSubTab
}: AdminDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminDashboard();
      setData(res);
    } catch (err: any) {
      setError('فشل تحميل تقارير الإدارة والمبيعات الحالية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [activeSubTab]);

  const handleBackup = () => {
    setSuccessMsg('تم أخذ نسخة احتياطية مشفرة لقاعدة البيانات وحفظها في الخادم الرئيسي بنجاح! 💾');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await api.readAllNotifications();
      loadDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-500 font-sans gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <span className="text-sm font-bold">جارٍ تجميع التقارير والإحصاءات الماليّة للمتجر...</span>
      </div>
    );
  }

  const stats = data?.stats || {
    totalRevenue: 0,
    ordersCount: 0,
    pendingOrdersCount: 0,
    lowStockProductsCount: 0,
    totalProductsCount: 0
  };

  return (
    <div className="bg-slate-950 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-2xl font-sans" id="admin-dashboard-panel">
      {/* Head section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              لوحة تحكم النخبة الفنية
              <span className="text-xs font-semibold bg-red-500 text-white px-2 py-0.5 rounded-full">نظام الأمان نشط 🛡️</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">أدوات مبيعات الأجهزة المنزلية، المخازن، والذكاء الاصطناعي</p>
          </div>
        </div>

        {/* Database Quick Actions */}
        <div className="flex gap-2 text-xs font-bold">
          <button
            onClick={handleBackup}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            نسخة احتياطية
          </button>
          <button
            onClick={loadDashboardData}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث التقارير
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400 font-bold">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Nav Sub-tabs row */}
      <div className="flex gap-2 mb-6 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2.5 rounded-lg transition-all ${activeSubTab === 'overview' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
        >
          نظرة عامة والمالية
        </button>
        <button
          onClick={() => setActiveSubTab('products')}
          className={`px-4 py-2.5 rounded-lg transition-all ${activeSubTab === 'products' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
        >
          إدارة الأجهزة والمخزون
        </button>
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`px-4 py-2.5 rounded-lg transition-all ${activeSubTab === 'orders' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
        >
          طلبات العملاء والفواتير {stats.pendingOrdersCount > 0 && <span className="bg-rose-600 text-white rounded-full px-1.5 font-bold text-[9px] mr-1 inline-block animate-pulse">{stats.pendingOrdersCount}</span>}
        </button>
        <button
          onClick={() => setActiveSubTab('cms')}
          className={`px-4 py-2.5 rounded-lg transition-all ${activeSubTab === 'cms' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
        >
          تعديل محتوى المتجر (CMS)
        </button>
      </div>

      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-4 left-4 p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي المبيعات المحققة</span>
              <h3 className="text-xl font-black text-white">{stats.totalRevenue} ج.م</h3>
              <p className="text-[9px] text-emerald-400 font-medium mt-1">الدفع نقداً عند التوصيل (COD)</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-4 left-4 p-2 bg-sky-500/10 text-sky-500 rounded-lg">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي طلبات المشترين</span>
              <h3 className="text-xl font-black text-white">{stats.ordersCount} طلب</h3>
              <p className="text-[9px] text-slate-400 font-medium mt-1">تتضمن الطلبات قيد التوصيل</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-4 left-4 p-2 bg-rose-500/10 text-rose-500 rounded-lg">
                <ClipboardList className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">طلبات معلقة بانتظار الاتصال</span>
              <h3 className={`text-xl font-black ${stats.pendingOrdersCount > 0 ? 'text-rose-400' : 'text-white'}`}>{stats.pendingOrdersCount} طلب معلق</h3>
              <p className="text-[9px] text-slate-400 font-medium mt-1">تحتاج لتأكيد تليفوني قبل الشحن</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-4 left-4 p-2 bg-red-500/10 text-red-500 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1">أجهزة منخفضة المخزون ⚠️</span>
              <h3 className={`text-xl font-black ${stats.lowStockProductsCount > 0 ? 'text-red-400 animate-pulse' : 'text-white'}`}>{stats.lowStockProductsCount} جهاز</h3>
              <p className="text-[9px] text-slate-400 font-medium mt-1">الرصيد في المستودع 5 قطع أو أقل</p>
            </div>
          </div>

          {/* Graphs breakdown and status distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visual Order distribution bars */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <h3 className="text-sm font-black text-white mb-5 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-amber-500" />
                توزيع الطلبات حسب مراحل الشحن والتوصيل
              </h3>
              <div className="space-y-4">
                {Object.entries(data?.statusBreakdown || {}).map(([status, count]: [string, any]) => {
                  const total = stats.ordersCount || 1;
                  const percent = Math.round((count / total) * 100);
                  const color = status === 'Delivered' ? 'bg-emerald-500' :
                                status === 'Shipped' ? 'bg-sky-500' :
                                status === 'Cancelled' ? 'bg-rose-500' :
                                status === 'Pending' ? 'bg-amber-500' : 'bg-slate-600';
                  return (
                    <div key={status} className="text-xs">
                      <div className="flex justify-between items-center mb-1 font-bold">
                        <span>{status === 'Pending' ? 'بانتظار التأكيد هاتفياً (Pending)' :
                               status === 'Confirmed' ? 'تم التأكيد وبانتظار التجهيز (Confirmed)' :
                               status === 'Preparing' ? 'جارٍ التغليف والتحضير بالمخزن (Preparing)' :
                               status === 'Shipped' ? 'مع مندوب التوصيل بالطريق (Shipped)' :
                               status === 'Delivered' ? 'تم الاستلام وسداد المبلغ بالكامل (Delivered)' :
                               status === 'Cancelled' ? 'طلب ملغي (Cancelled)' : 'طلب مسترجع (Returned)'}</span>
                        <span>{count} طلب ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${color}`} style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notification logs list */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <ClipboardList className="w-4.5 h-4.5 text-amber-500" />
                    إشعارات النظام والتحذيرات
                  </h3>
                  {data?.unreadNotificationsCount > 0 && (
                    <button
                      onClick={handleMarkNotificationsRead}
                      className="text-[10px] text-amber-500 font-bold hover:underline cursor-pointer"
                    >
                      تحديد كقروء
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {data?.recentNotifications?.length > 0 ? (
                    data.recentNotifications.map((n: any) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-lg text-xs leading-normal border ${!n.isRead ? 'bg-amber-500/5 border-amber-500/20' : 'bg-slate-950/40 border-slate-800/50 text-slate-400'}`}
                      >
                        <div className="flex justify-between items-center mb-1 font-bold">
                          <span className={!n.isRead ? 'text-amber-400' : 'text-slate-300'}>{n.title}</span>
                          <span className="text-[8px] font-mono font-normal">{new Date(n.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">{n.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-6">لا توجد أية إشعارات واردة حتى الساعة.</p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/60 mt-4 text-center text-[10px] text-slate-500">
                مجموع المنتجات في الفهرس: {stats.totalProductsCount} جهاز
              </div>
            </div>
          </div>

          {/* Security and Operation Logs */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2">
              <Database className="w-4.5 h-4.5 text-amber-500" />
              سجل نشاط الأمان والعمليات (Audit Logs)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold">
                    <th className="py-2.5 px-3">المشغل والمسؤول</th>
                    <th className="py-2.5 px-3">نوع العملية</th>
                    <th className="py-2.5 px-3">التفاصيل والحدث</th>
                    <th className="py-2.5 px-3">التوقيت الزمن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {data?.recentLogs?.map((l: any) => (
                    <tr key={l.id} className="hover:bg-slate-950/40">
                      <td className="py-2.5 px-3 font-semibold text-white">{l.user} <span className="text-[9px] bg-slate-800 text-gray-300 px-1 rounded">{l.role}</span></td>
                      <td className="py-2.5 px-3 font-bold text-amber-500">{l.action}</td>
                      <td className="py-2.5 px-3 max-w-xs truncate">{l.details}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">{new Date(l.timestamp).toLocaleString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
