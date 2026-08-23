import React from 'react';
import {
  TrendingUp, ShoppingBag, ClipboardList, AlertTriangle, Layers,
  Bell, Database, Tag, Star, Package, RefreshCw, ChevronRight,
  ExternalLink, BarChart3, CheckCircle2, Clock, AlertOctagon, DollarSign,
  TrendingDown, ShieldAlert, RotateCcw, ArrowUpRight
} from 'lucide-react';
import { AdminCard, AdminBadge, AdminSkeleton, AdminEmptyState } from './AdminUIComponents.js';

interface ExecutiveWidgetsProps {
  onNavigate?: (tab: string, arg?: any) => void;
  dashboardData?: any;
  onRefresh?: () => void;
}

// 1. KPI Metric Widget Card
export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  badgeText?: string;
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info' | 'amber' | 'neutral';
  trend?: string;
  onClick?: () => void;
  urgent?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = React.memo(({
  title,
  value,
  subtitle,
  icon: Icon,
  badgeText,
  badgeVariant = 'neutral',
  trend,
  onClick,
  urgent = false
}) => {
  return (
    <AdminCard
      hoverEffect={!!onClick}
      onClick={onClick}
      className={`relative overflow-hidden ${urgent ? 'border-rose-500/50 bg-rose-500/5' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
          <Icon className="w-5 h-5" />
        </div>
        {badgeText && (
          <AdminBadge variant={badgeVariant}>
            {badgeText}
          </AdminBadge>
        )}
      </div>
      <div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block mb-1">{title}</span>
        <h3 className={`text-2xl font-black text-slate-900 dark:text-white tracking-tight ${urgent ? 'text-rose-500 dark:text-rose-400 animate-pulse' : ''}`}>
          {value}
        </h3>
        {(subtitle || trend) && (
          <div className="flex items-center gap-1.5 mt-2 text-[10px]">
            {trend && <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center">{trend}</span>}
            {subtitle && <span className="text-slate-500 dark:text-slate-400">{subtitle}</span>}
          </div>
        )}
      </div>
    </AdminCard>
  );
});

// 2. Top Selling Products Widget
export const TopProductsWidget: React.FC<{ products: any[]; loading?: boolean; onNavigate?: (tab: string) => void }> = React.memo(({
  products,
  loading = false,
  onNavigate
}) => {
  if (loading) return <AdminSkeleton count={4} height="h-12" />;

  return (
    <AdminCard>
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Package className="w-4 h-4 text-amber-500" />
          المنتجات الأكثر مبيعاً
        </h3>
        {onNavigate && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigate('products');
            }}
            className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
          >
            <span>فهرس الأجهزة</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {(!products || products.length === 0) ? (
        <AdminEmptyState
          icon={Package}
          title="لا توجد بيانات مبيعات للمنتجات"
          description="لم يتم تسجيل مبيعات كافية لعرض قائمة المنتجات الأكثر رواجاً حتى الآن."
          action={
            onNavigate && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigate('products');
                }}
                className="mt-2 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>تصفح فهرس الأجهزة</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {products.slice(0, 5).map((prod: any, idx: number) => {
            const qty = prod.quantitySold || prod.quantity || 0;
            const rev = prod.revenue || (prod.price * qty) || 0;
            return (
              <div key={prod.productId || idx} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-black text-xs flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{prod.productTitle || prod.name || 'جهاز بدون عنوان'}</h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono">تم بيع {qty} وحدة</span>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 block font-mono">{rev.toLocaleString('ar-EG')} ج.م</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminCard>
  );
});

// 3. Active Campaigns Widget
export const ActiveCampaignsWidget: React.FC<{ campaigns: any[]; loading?: boolean; onNavigate?: (tab: string) => void }> = React.memo(({
  campaigns,
  loading = false,
  onNavigate
}) => {
  if (loading) return <AdminSkeleton count={3} height="h-14" />;

  const activeCmp = (campaigns || []).filter((c: any) => c.active);

  return (
    <AdminCard>
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Tag className="w-4 h-4 text-amber-500" />
          الحملات والعروض الترويجية النشطة
        </h3>
        {onNavigate && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigate('campaigns');
            }}
            className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
          >
            <span>إدارة العروض</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {activeCmp.length === 0 ? (
        <AdminEmptyState
          icon={Tag}
          title="لا توجد حملات ترويجية نشطة"
          description="يمكنك إنشاء خصومات وعروض شحن مجاني جديدة لتنشيط المبيعات."
          action={
            onNavigate && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onNavigate('campaigns');
                }}
                className="mt-2 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <span>إنشاء حملة جديدة</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {activeCmp.slice(0, 4).map((cmp: any) => (
            <div key={cmp.id} className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-all">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{cmp.name}</span>
                <AdminBadge variant="success">نشطة الان</AdminBadge>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span>الخصم: <strong className="text-amber-600 dark:text-amber-400">{cmp.type === 'percentage' ? `${cmp.value}%` : `${cmp.value} ج.م`}</strong></span>
                {cmp.endAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    تنتهي: {new Date(cmp.endAt).toLocaleDateString('ar-EG')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
});

// 4. Customer Feedback & Pending Reviews Widget
export const CustomerReviewsWidget: React.FC<{ reviewData?: any; loading?: boolean; onNavigate?: (tab: string) => void }> = React.memo(({
  reviewData,
  loading = false,
  onNavigate
}) => {
  if (loading) return <AdminSkeleton count={2} height="h-20" />;

  const summary = reviewData || {
    totalReviews: 0,
    approvedReviews: 0,
    pendingReviews: 0,
    averageRating: 4.8
  };

  return (
    <AdminCard>
      <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          مراجعات وتقييمات العملاء
        </h3>
        {onNavigate && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigate('reviews');
            }}
            className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
          >
            <span>إدارة التقييمات</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">متوسط التقييم العام</span>
          <div className="text-xl font-black text-amber-500 dark:text-amber-400 flex items-center justify-center gap-1 font-mono">
            <span>{summary.averageRating || 4.8}</span>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">بانتظار الاعتماد</span>
          <div className={`text-xl font-black font-mono ${summary.pendingReviews > 0 ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-slate-700 dark:text-slate-200'}`}>
            {summary.pendingReviews || 0}
          </div>
        </div>
      </div>
    </AdminCard>
  );
});

// 5. Order Status Breakdown Widget
export const OrderStatusWidget: React.FC<{ statusBreakdown: Record<string, number>; totalOrders: number }> = React.memo(({
  statusBreakdown = {},
  totalOrders = 1
}) => {
  return (
    <AdminCard>
      <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <Layers className="w-4 h-4 text-amber-500" />
        توزيع الطلبات حسب مراحل الشحن والتوصيل
      </h3>
      <div className="space-y-3.5">
        {Object.entries(statusBreakdown).map(([status, count]) => {
          const cnt = Number(count) || 0;
          const tot = Number(totalOrders) || 1;
          const percent = Math.round((cnt / tot) * 100);
          const color = status === 'Delivered' ? 'bg-emerald-500' :
                        status === 'Shipped' ? 'bg-sky-500' :
                        status === 'Cancelled' ? 'bg-rose-500' :
                        status === 'Pending' ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-600';

          const labelMap: Record<string, string> = {
            Pending: 'بانتظار التأكيد هاتفياً (Pending)',
            Confirmed: 'تم التأكيد وبانتظار التجهيز (Confirmed)',
            Preparing: 'جارٍ التغليف والتحضير بالمخزن (Preparing)',
            Shipped: 'مع مندوب التوصيل بالطريق (Shipped)',
            Delivered: 'تم الاستلام وسداد المبلغ (Delivered)',
            Cancelled: 'طلب ملغي (Cancelled)',
            Returned: 'طلب مسترجع (Returned)'
          };

          return (
            <div key={status} className="text-xs">
              <div className="flex justify-between items-center mb-1 font-bold">
                <span className="text-slate-700 dark:text-slate-300">{labelMap[status] || status}</span>
                <span className="text-slate-500 dark:text-slate-400 font-mono">{count} طلب ({percent}%)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-300/60 dark:border-slate-800/80">
                <div className={`h-full ${color}`} style={{ width: `${percent}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </AdminCard>
  );
});

// 6. Recent Audit Logs Widget
export const AuditLogsWidget: React.FC<{ logs: any[]; loading?: boolean }> = React.memo(({
  logs = [],
  loading = false
}) => {
  if (loading) return <AdminSkeleton count={4} height="h-10" />;

  const getRoleBadge = (role: string) => {
    const r = (role || '').toLowerCase();
    if (r.includes('admin') || r.includes('مدير') || r.includes('مسؤول')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono">
          {role || 'Admin'}
        </span>
      );
    }
    if (r.includes('customer') || r.includes('عميل') || r.includes('زبون')) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono">
          {role || 'Customer'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
        {role || 'System'}
      </span>
    );
  };

  return (
    <AdminCard>
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-500" />
          سجل نشاط الأمان والعمليات (Audit Logs)
        </h3>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          آخر العمليات المسجلة في النظام
        </span>
      </div>

      {(!logs || logs.length === 0) ? (
        <AdminEmptyState
          icon={Database}
          title="لا توجد سجلات أمان حديثة"
          description="يتم تسجيل جميع عمليات المسؤولين والعملاء تلقائياً في قاعدة البيانات."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 font-bold">
                <th className="py-3 px-4">المسؤول / المستخدم</th>
                <th className="py-3 px-4">الحدث</th>
                <th className="py-3 px-4">التفاصيل</th>
                <th className="py-3 px-4 text-left">التاريخ والتوقيت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
              {logs.slice(0, 8).map((l: any) => {
                const dateObj = new Date(l.timestamp);
                const isValidDate = !isNaN(dateObj.getTime());
                const formattedDate = isValidDate
                  ? dateObj.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
                  : l.timestamp;

                return (
                  <tr key={l.id} className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{l.user}</span>
                        {getRoleBadge(l.role)}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md">
                      <p className="line-clamp-2 leading-relaxed">{l.details}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-500 dark:text-slate-400 text-[11px] text-left" dir="ltr">
                      {formattedDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
});

// 7. Returns & Refunds Overview Widget
export const ReturnsOverviewWidget: React.FC<{
  returnsOverview?: {
    totalReturns?: number;
    pendingReturns?: number;
    approvedReturns?: number;
    pickupPendingReturns?: number;
    receivedReturns?: number;
    completedReturns?: number;
    rejectedReturns?: number;
    cancelledReturns?: number;
    totalRefundedAmount?: number;
    pendingRefundAmount?: number;
  };
  totalReturnsCount?: number;
  pendingReturnsCount?: number;
  totalRefunds?: number;
  pendingRefundAmount?: number;
  loading?: boolean;
  onNavigate?: (tab: string, arg?: any) => void;
}> = React.memo(({
  returnsOverview,
  totalReturnsCount = 0,
  pendingReturnsCount = 0,
  totalRefunds = 0,
  pendingRefundAmount = 0,
  loading = false,
  onNavigate
}) => {
  if (loading) return <AdminSkeleton count={3} height="h-16" />;

  const overview = returnsOverview || {
    totalReturns: totalReturnsCount,
    pendingReturns: pendingReturnsCount,
    approvedReturns: 0,
    pickupPendingReturns: 0,
    receivedReturns: 0,
    completedReturns: 0,
    rejectedReturns: 0,
    cancelledReturns: 0,
    totalRefundedAmount: totalRefunds,
    pendingRefundAmount: pendingRefundAmount
  };

  const total = overview.totalReturns ?? totalReturnsCount;
  const pending = overview.pendingReturns ?? pendingReturnsCount;
  const refunded = overview.totalRefundedAmount ?? totalRefunds;
  const pendingRefund = overview.pendingRefundAmount ?? pendingRefundAmount;

  return (
    <AdminCard>
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              ملخص المرتجعات والاستردادات
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              متابعة طلبات الإرجاع الفعالة والمبالغ المستردة
            </p>
          </div>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onNavigate('returns');
            }}
            className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
          >
            <span>إدارة المرتجعات</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Total Returns */}
        <div
          onClick={() => onNavigate && onNavigate('returns')}
          className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 cursor-pointer hover:border-amber-500/30 transition-all"
        >
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-0.5">إجمالي الطلبات</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{total}</span>
            <span className="text-[10px] text-slate-500">طلب</span>
          </div>
        </div>

        {/* Pending Returns (Urgent) */}
        <div
          onClick={() => onNavigate && onNavigate('returns', { status: 'pending' })}
          className={`p-3 rounded-xl border cursor-pointer transition-all ${
            pending > 0
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80'
          }`}
        >
          <span className="text-[10px] font-bold block mb-0.5 text-slate-500 dark:text-slate-400">قيد الانتظار (جديد)</span>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-black font-mono ${pending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {pending}
            </span>
            <span className="text-[10px] text-slate-500">طلب</span>
          </div>
        </div>

        {/* Total Refunded Amount */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-0.5">تم استرداده فعلياً</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {refunded.toLocaleString('ar-EG')}
            </span>
            <span className="text-[10px] text-slate-500">ج.م</span>
          </div>
        </div>

        {/* Pending Refund Amount */}
        <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-0.5">استرداد معلق</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
              {pendingRefund.toLocaleString('ar-EG')}
            </span>
            <span className="text-[10px] text-slate-500">ج.م</span>
          </div>
        </div>
      </div>

      {/* Mini status pills */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-[11px]">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('returns', { status: 'approved' })}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold hover:bg-sky-500/20 cursor-pointer"
        >
          <span>موافق عليه:</span>
          <span className="font-mono">{overview.approvedReturns || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('returns', { status: 'pickup_pending' })}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold hover:bg-purple-500/20 cursor-pointer"
        >
          <span>بانتظار المندوب:</span>
          <span className="font-mono">{overview.pickupPendingReturns || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('returns', { status: 'received' })}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold hover:bg-indigo-500/20 cursor-pointer"
        >
          <span>تم الاستلام بالمخزن:</span>
          <span className="font-mono">{overview.receivedReturns || 0}</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate && onNavigate('returns', { status: 'completed' })}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold hover:bg-emerald-500/20 cursor-pointer"
        >
          <span>مكتمل ومغلق:</span>
          <span className="font-mono">{overview.completedReturns || 0}</span>
        </button>
      </div>
    </AdminCard>
  );
});

