import { useState, useEffect } from 'react';
import {
  TrendingUp, ShoppingBag, Package, AlertTriangle, RefreshCw,
  BarChart3, Users, Star, DollarSign, RotateCcw, XCircle, CheckCircle2,
  Clock, ShieldAlert, Award, ArrowUpRight, Percent, CheckCircle
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';

export default function AdminAnalyticsSection() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('all');

  const [salesData, setSalesData] = useState<{
    totalOrders: number;
    totalSales: number;
    grossSales?: number;
    totalRefunds?: number;
    netSales?: number;
    averageOrderValue: number;
    totalItemsSold: number;
    cancelledOrders: number;
    returnedOrders: number;
    returnsCount?: number;
    pendingRefundAmount?: number;
    returnRate?: number;
    trend?: Array<{ date: string; label: string; sales: number; orders: number }>;
  } | null>(null);

  const [returnsData, setReturnsData] = useState<{
    totalReturns: number;
    pendingReturns: number;
    approvedReturns: number;
    pickupPendingReturns: number;
    receivedReturns: number;
    completedReturns: number;
    rejectedReturns: number;
    cancelledReturns: number;
    totalRefundedAmount: number;
    pendingRefundAmount: number;
    returnedProductValue: number;
    damagedProductValue: number;
    restockedProductValue: number;
    restockedItemsCount: number;
    returnRate: number;
    grossSales: number;
    netSales: number;
    reasonsBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
    refundStatusBreakdown: Record<string, number>;
    topReturnedProducts: Array<{
      productId: string;
      productTitle: string;
      returnsCount: number;
      returnedQuantity: number;
      totalRefunded: number;
      mainReason: string;
    }>;
    recentReturns: any[];
  } | null>(null);

  const [trendMetric, setTrendMetric] = useState<'sales' | 'orders'>('sales');
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; label: string; sales: number; orders: number } | null>(null);

  const [topProducts, setTopProducts] = useState<Array<{
    productId: string;
    productTitle: string;
    quantitySold: number;
    revenue: number;
  }>>([]);

  const [customerData, setCustomerData] = useState<{
    totalCustomers: number;
    activeCustomers: number;
    blockedCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
  } | null>(null);

  const [inventoryData, setInventoryData] = useState<{
    totalProducts: number;
    totalStock: number;
    lowStockItems: number;
    outOfStockItems: number;
    inventoryValue: number;
  } | null>(null);

  const [reviewData, setReviewData] = useState<{
    totalReviews: number;
    approvedReviews: number;
    pendingReviews: number;
    rejectedReviews: number;
    averageRating: number;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const rangeParam = timeRange === 'all' ? undefined : timeRange;
      const [salesRes, topRes, custRes, invRes, revRes, retRes] = await Promise.all([
        api.getAnalyticsSales(rangeParam),
        api.getAnalyticsTopProducts(10),
        api.getAnalyticsCustomers(),
        api.getAnalyticsInventory(),
        api.getAnalyticsReviews(),
        api.getAnalyticsReturns(rangeParam).catch(() => ({ analytics: null }))
      ]);

      if (salesRes && salesRes.analytics) setSalesData(salesRes.analytics);
      if (topRes && topRes.topProducts) setTopProducts(topRes.topProducts);
      if (custRes && custRes.analytics) setCustomerData(custRes.analytics);
      if (invRes && invRes.analytics) setInventoryData(invRes.analytics);
      if (revRes && revRes.analytics) setReviewData(revRes.analytics);
      if (retRes && retRes.analytics) setReturnsData(retRes.analytics);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل بيانات التحليلات والإحصاءات'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const maxQtySold = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.quantitySold)) : 1;

  const getReasonLabel = (reason: string) => {
    const map: Record<string, string> = {
      damaged: 'تالف أثناء الشحن',
      defective: 'عيب مصنعي / لا يعمل',
      wrong_item: 'استلام منتج خطأ',
      changed_mind: 'تراجع عن الشراء',
      size_issue: 'المقاس/الموديل غير مناسب',
      late_delivery: 'تأخر التوصيل',
      not_as_described: 'غير مطابق للمواصفات',
      other: 'سبب آخر'
    };
    return map[reason] || reason;
  };

  return (
    <div className="space-y-8 font-sans text-right" dir="rtl">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            تحليلات وإحصاءات المتجر 📊
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            متابعة المبيعات، المنتجات الأكثر رواجاً، سلوك العملاء، حالة المخزون وتقييمات المنتجات
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                timeRange === '7d' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                timeRange === '30d' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              آخر 30 يوم
            </button>
            <button
              onClick={() => setTimeRange('90d')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                timeRange === '90d' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              آخر 90 يوم
            </button>
            <button
              onClick={() => setTimeRange('1y')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                timeRange === '1y' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              السنة
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                timeRange === 'all' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              الكل
            </button>
          </div>

          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-xl flex items-center justify-between text-xs text-rose-400 font-bold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* 1. SALES KPI CARDS */}
      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          مؤشرات أداء المبيعات والأرباح (Financial & Sales KPIs)
        </h3>

        {loading && !salesData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 animate-pulse space-y-3">
                <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                <div className="h-6 bg-slate-800 rounded w-3/4"></div>
                <div className="h-2 bg-slate-800 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Net Sales */}
            <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden bg-gradient-to-br from-slate-900 to-emerald-950/20">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-emerald-400 font-bold">صافي المبيعات المحققة (Net Sales)</span>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <h4 className="text-2xl font-black text-white font-mono">
                {((salesData?.netSales !== undefined ? salesData.netSales : (salesData?.totalSales || 0)) || 0).toLocaleString('ar-EG')} <span className="text-xs text-emerald-400 font-normal">ج.م</span>
              </h4>
              <p className="text-[10px] text-slate-400 font-medium mt-2">
                الإجمالي: {(salesData?.grossSales || salesData?.totalSales || 0).toLocaleString('ar-EG')} ج.م - المسترد: {(salesData?.totalRefunds || 0).toLocaleString('ar-EG')} ج.م
              </p>
            </div>

            {/* 2. Total Gross Sales */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-slate-400 font-bold">إجمالي المبيعات (Gross Sales)</span>
                <div className="p-2 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <h4 className="text-2xl font-black text-white font-mono">
                {(salesData?.grossSales || salesData?.totalSales || 0).toLocaleString('ar-EG')} <span className="text-xs text-sky-400 font-normal">ج.م</span>
              </h4>
              <p className="text-[10px] text-slate-500 font-medium mt-2">إجمالي قيمة كل الطلبات المباعة قبل الخصومات</p>
            </div>

            {/* 3. Total Refunds Processed */}
            <div className="bg-slate-900 border border-rose-500/20 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-rose-400 font-bold">إجمالي المبالغ المستردة (Refunds)</span>
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                  <RotateCcw className="w-5 h-5" />
                </div>
              </div>
              <h4 className="text-2xl font-black text-rose-400 font-mono">
                {((salesData?.totalRefunds ?? returnsData?.totalRefundedAmount) || 0).toLocaleString('ar-EG')} <span className="text-xs font-normal">ج.م</span>
              </h4>
              <p className="text-[10px] text-slate-500 font-medium mt-2">
                استردادات مكتملة ومخصومة من الإيرادات
              </p>
            </div>

            {/* 4. Return Rate */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-slate-400 font-bold">معدل الإرجاع (Return Rate)</span>
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Percent className="w-5 h-5" />
                </div>
              </div>
              <h4 className="text-2xl font-black text-amber-400 font-mono">
                {((salesData?.returnRate ?? returnsData?.returnRate) || 0).toFixed(1)} <span className="text-xs font-normal">%</span>
              </h4>
              <p className="text-[10px] text-slate-500 font-medium mt-2">
                نسبة طلبات المرتجعات ({salesData?.returnsCount ?? returnsData?.totalReturns ?? 0}) إلى إجمالي الطلبات
              </p>
            </div>

            {/* 5. Total Orders */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-slate-400 font-bold">عدد الطلبات الإجمالي</span>
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <ShoppingBag className="w-5 h-5" />
                </div>
              </div>
              <h4 className="text-2xl font-black text-white font-mono">
                {salesData?.totalOrders || 0} <span className="text-xs text-purple-400 font-normal">طلب</span>
              </h4>
              <p className="text-[10px] text-slate-500 font-medium mt-2">
                الطلبات الملغاة: {salesData?.cancelledOrders || 0} | المرتجعة: {salesData?.returnedOrders || 0}
              </p>
            </div>

            {/* 6. Average Order Value */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs text-slate-400 font-bold">متوسط قيمة الطلب (AOV)</span>
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <h4 className="text-2xl font-black text-white font-mono">
                {(salesData?.averageOrderValue || 0).toLocaleString('ar-EG')} <span className="text-xs text-indigo-400 font-normal">ج.م</span>
              </h4>
              <p className="text-[10px] text-slate-500 font-medium mt-2">معدل إنفاق العميل لكل طلب مؤكد</p>
            </div>
          </div>
        )}
      </div>

      {/* 1.5 SALES TREND VISUALIZATION CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              اتجاهات المبيعات والطلبات عبر الزمن (Sales & Orders Trend)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              مخطط بياني يوضح الأداء المالي وحجم الطلبات للفترة المحددة
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setTrendMetric('sales')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                trendMetric === 'sales' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              قيمة المبيعات (ج.م)
            </button>
            <button
              onClick={() => setTrendMetric('orders')}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                trendMetric === 'orders' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              عدد الطلبات
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading && !salesData?.trend ? (
          <div className="h-64 bg-slate-950 rounded-xl p-4 animate-pulse flex items-end gap-2 justify-between">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-800/60 rounded-t w-full"
                style={{ height: `${Math.floor(Math.random() * 60) + 20}%` }}
              ></div>
            ))}
          </div>
        ) : salesData?.trend && salesData.trend.length > 0 ? (
          (() => {
            const trend = salesData.trend;
            const maxVal = Math.max(
              ...trend.map(t => (trendMetric === 'sales' ? t.sales : t.orders)),
              1
            );

            // Peak sales & orders points
            const peakSalesPoint = [...trend].sort((a, b) => b.sales - a.sales)[0];
            const peakOrdersPoint = [...trend].sort((a, b) => b.orders - a.orders)[0];
            const avgSalesInTrend = trend.length > 0
              ? Math.round(trend.reduce((sum, t) => sum + t.sales, 0) / trend.length)
              : 0;

            const step = trend.length > 30 ? 5 : trend.length > 14 ? 2 : 1;

            return (
              <div className="space-y-4">
                {/* Visual Chart Canvas */}
                <div className="relative bg-slate-950 border border-slate-800/80 rounded-xl p-4 overflow-hidden">
                  {/* Guideline Grid background */}
                  <div className="absolute inset-x-4 top-4 bottom-10 flex flex-col justify-between pointer-events-none opacity-20 border-y border-dashed border-slate-700">
                    <div className="border-b border-dashed border-slate-700 w-full"></div>
                    <div className="border-b border-dashed border-slate-700 w-full"></div>
                  </div>

                  {/* Active Tooltip overlay */}
                  {hoveredPoint && (
                    <div className="mb-2 p-2.5 bg-slate-900 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-slate-200">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="font-bold text-white">{hoveredPoint.label} ({hoveredPoint.date})</span>
                      </div>
                      <div className="flex items-center gap-4 font-mono font-bold">
                        <span className="text-emerald-400">
                          المبيعات: {hoveredPoint.sales.toLocaleString('ar-EG')} ج.م
                        </span>
                        <span className="text-sky-400">
                          الطلبات: {hoveredPoint.orders}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Columns Bar Chart */}
                  <div className="h-56 flex items-end justify-between gap-1 sm:gap-2 pt-6 pb-2 px-1">
                    {trend.map((item, idx) => {
                      const val = trendMetric === 'sales' ? item.sales : item.orders;
                      const heightPercent = maxVal > 0 ? Math.max((val / maxVal) * 100, 3) : 3;
                      const isHovered = hoveredPoint?.date === item.date;
                      const isPeak = (trendMetric === 'sales' && item.date === peakSalesPoint?.date && item.sales > 0) ||
                                     (trendMetric === 'orders' && item.date === peakOrdersPoint?.date && item.orders > 0);

                      return (
                        <div
                          key={item.date || idx}
                          onMouseEnter={() => setHoveredPoint(item)}
                          onMouseLeave={() => setHoveredPoint(null)}
                          className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                        >
                          {/* Value popover on hover or peak */}
                          <div className={`absolute -top-6 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-all whitespace-nowrap z-10 ${
                            isHovered
                              ? 'bg-amber-500 text-slate-950 scale-110 shadow-lg'
                              : isPeak
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'opacity-0 group-hover:opacity-100 bg-slate-800 text-slate-200'
                          }`}>
                            {trendMetric === 'sales' ? `${val.toLocaleString('ar-EG')}` : `${val}`}
                          </div>

                          {/* Bar body */}
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 relative ${
                              isHovered
                                ? 'bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                                : isPeak
                                ? 'bg-gradient-to-t from-emerald-600 to-amber-500'
                                : trendMetric === 'sales'
                                ? 'bg-gradient-to-t from-amber-600/70 to-emerald-500/80 group-hover:from-amber-500 group-hover:to-emerald-400'
                                : 'bg-gradient-to-t from-amber-600/70 to-amber-400/80 group-hover:from-amber-500 group-hover:to-amber-300'
                            }`}
                          ></div>
                        </div>
                      );
                    })}
                  </div>

                  {/* X-Axis labels */}
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-800 pt-2 px-1">
                    {trend.map((item, idx) => {
                      if (idx % step !== 0 && idx !== trend.length - 1) {
                        return <div key={item.date || idx} className="flex-1 text-center opacity-0">.</div>;
                      }
                      return (
                        <div
                          key={item.date || idx}
                          className="flex-1 text-center truncate px-0.5 text-slate-400 hover:text-white"
                          title={item.label}
                        >
                          {item.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Summary Insights row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">أعلى يوم مبيعات</span>
                      <span className="text-xs font-black text-white">{peakSalesPoint?.label || '-'}</span>
                    </div>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      {(peakSalesPoint?.sales || 0).toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">أعلى يوم إقبال طلبات</span>
                      <span className="text-xs font-black text-white">{peakOrdersPoint?.label || '-'}</span>
                    </div>
                    <span className="text-sm font-black text-sky-400 font-mono">
                      {peakOrdersPoint?.orders || 0} <span className="text-[10px]">طلب</span>
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">متوسط المبيعات اليومي</span>
                      <span className="text-xs font-black text-white">طوال الفترة</span>
                    </div>
                    <span className="text-sm font-black text-amber-400 font-mono">
                      {avgSalesInTrend.toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="text-center py-10 text-slate-500 text-xs font-medium bg-slate-950 rounded-xl border border-slate-800">
            لا توجد بيانات اتجاهات مبيعات بالفترة المحددة.
          </div>
        )}
      </div>

      {/* 2. TOP PRODUCTS & CUSTOMER ANALYTICS (2 cols on lg) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Products Table (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              🔥 الأكثر مبيعاً (Top 10 Products)
            </h3>
            <span className="text-[10px] text-slate-500 font-medium">مرتبة حسب الوحدات المباعة</span>
          </div>

          {loading && topProducts.length === 0 ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-800/60 rounded animate-pulse"></div>
              ))}
            </div>
          ) : topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold text-[11px]">
                    <th className="py-2.5 px-2">#</th>
                    <th className="py-2.5 px-2">اسم المنتج</th>
                    <th className="py-2.5 px-2 text-center">المبيعات</th>
                    <th className="py-2.5 px-2 text-left">الإيرادات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {topProducts.map((p, index) => {
                    const percent = Math.round((p.quantitySold / maxQtySold) * 100);
                    return (
                      <tr key={p.productId || index} className="hover:bg-slate-950/40">
                        <td className="py-3 px-2 font-mono font-bold text-amber-500 w-6">
                          {index + 1}
                        </td>
                        <td className="py-3 px-2">
                          <div className="font-bold text-white max-w-xs truncate" title={p.productTitle}>
                            {p.productTitle}
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-1.5">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${percent}%` }}></div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center font-mono font-bold text-sky-400">
                          {p.quantitySold} <span className="text-[9px] text-slate-400 font-normal">قطعة</span>
                        </td>
                        <td className="py-3 px-2 text-left font-mono font-bold text-emerald-400">
                          {p.revenue.toLocaleString('ar-EG')} <span className="text-[9px] font-normal">ج.م</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-medium">
              لا توجد بيانات مبيعات للمنتجات بعد.
            </div>
          )}
        </div>

        {/* Customer Analytics (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                تحليلات العملاء (Customer Analytics)
              </h3>
            </div>

            {loading && !customerData ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-slate-800/60 rounded animate-pulse"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-slate-300 font-bold">إجمالي العملاء المسجلين</span>
                  <span className="text-sm font-black text-white font-mono">{customerData?.totalCustomers || 0}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    العملاء النشطون
                  </span>
                  <span className="text-sm font-black text-emerald-400 font-mono">{customerData?.activeCustomers || 0}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-sky-400 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    العملاء الجدد (آخر 30 يوم)
                  </span>
                  <span className="text-sm font-black text-sky-400 font-mono">{customerData?.newCustomers || 0}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-purple-400 font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    العملاء المتكررون (أكثر من طلب)
                  </span>
                  <span className="text-sm font-black text-purple-400 font-mono">{customerData?.repeatCustomers || 0}</span>
                </div>

                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="text-xs text-rose-400 font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    العملاء المحظورون
                  </span>
                  <span className="text-sm font-black text-rose-400 font-mono">{customerData?.blockedCustomers || 0}</span>
                </div>
              </div>
            )}
          </div>

          {/* Visual ratio */}
          {customerData && customerData.totalCustomers > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                <span>نسبة النشطين: {Math.round(((customerData.activeCustomers || 0) / customerData.totalCustomers) * 100)}%</span>
                <span>المحروقون/المحظورون: {Math.round(((customerData.blockedCustomers || 0) / customerData.totalCustomers) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${Math.round(((customerData.activeCustomers || 0) / customerData.totalCustomers) * 100)}%` }}
                ></div>
                <div
                  className="bg-rose-500 h-full"
                  style={{ width: `${Math.round(((customerData.blockedCustomers || 0) / customerData.totalCustomers) * 100)}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2.5 RETURNS & REFUNDS ANALYTICS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-300 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-amber-500" />
            تحليلات المرتجعات والاستردادات (Returns & Refunds Analytics)
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">
            معدل الإرجاع العام: <strong className="text-amber-400 font-mono">{((returnsData?.returnRate || 0)).toFixed(1)}%</strong>
          </span>
        </div>

        {/* Returns Financial & Status Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">إجمالي طلبات الإرجاع</span>
            <span className="text-xl font-black text-white font-mono">{returnsData?.totalReturns || 0}</span>
            <span className="text-[10px] text-slate-500 block mt-1">طلب إرجاع مسجل</span>
          </div>

          <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-xl bg-amber-500/5">
            <span className="text-[11px] text-amber-400 font-bold block mb-1">قيد الانتظار والمراجعة</span>
            <span className="text-xl font-black text-amber-400 font-mono">
              {(returnsData?.pendingReturns || 0) + (returnsData?.pickupPendingReturns || 0)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">
              مبالغ معلقة: {(returnsData?.pendingRefundAmount || 0).toLocaleString('ar-EG')} ج.م
            </span>
          </div>

          <div className="bg-slate-900 border border-emerald-500/30 p-4 rounded-xl bg-emerald-500/5">
            <span className="text-[11px] text-emerald-400 font-bold block mb-1">المرتجعات المكتملة</span>
            <span className="text-xl font-black text-emerald-400 font-mono">{returnsData?.completedReturns || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-1">تم تسويتها بالكامل</span>
          </div>

          <div className="bg-slate-900 border border-rose-500/30 p-4 rounded-xl">
            <span className="text-[11px] text-rose-400 font-bold block mb-1">إجمالي المبالغ المستردة</span>
            <span className="text-lg font-black text-rose-400 font-mono">
              {(returnsData?.totalRefundedAmount || 0).toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">مخصومة من المبيعات</span>
          </div>

          <div className="bg-slate-900 border border-teal-500/30 p-4 rounded-xl">
            <span className="text-[11px] text-teal-400 font-bold block mb-1">المعاد تخزينه بالمستودع</span>
            <span className="text-lg font-black text-teal-400 font-mono">
              {(returnsData?.restockedProductValue || 0).toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-1">{returnsData?.restockedItemsCount || 0} قطعة صالحة للبيع</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <span className="text-[11px] text-slate-400 font-bold block mb-1">المرتجعات المرفوضة</span>
            <span className="text-xl font-black text-slate-300 font-mono">{returnsData?.rejectedReturns || 0}</span>
            <span className="text-[10px] text-slate-500 block mt-1">لم تستوفِ الشروط</span>
          </div>
        </div>

        {/* Detailed Returns Breakdown: Top Returned Products + Reasons Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Top Returned Products Table (7 cols) */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-rose-400" />
                الأجهزة والمنتجات الأكثر طلباً للإرجاع
              </h4>
              <span className="text-[10px] text-slate-500 font-medium">أعلى معدلات استرجاع</span>
            </div>

            {loading && !returnsData ? (
              <div className="space-y-3 py-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-8 bg-slate-800/60 rounded animate-pulse"></div>
                ))}
              </div>
            ) : returnsData?.topReturnedProducts && returnsData.topReturnedProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-bold">
                      <th className="py-2.5 px-2">#</th>
                      <th className="py-2.5 px-2">المنتج</th>
                      <th className="py-2.5 px-2 text-center">الكمية</th>
                      <th className="py-2.5 px-2 text-center">السبب الشائع</th>
                      <th className="py-2.5 px-2 text-left">المسترد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {returnsData.topReturnedProducts.map((p, idx) => (
                      <tr key={p.productId || idx} className="hover:bg-slate-950/40">
                        <td className="py-2.5 px-2 font-mono font-bold text-amber-500 w-6">{idx + 1}</td>
                        <td className="py-2.5 px-2">
                          <div className="font-bold text-white max-w-[180px] truncate" title={p.productTitle}>
                            {p.productTitle}
                          </div>
                          <span className="text-[10px] text-slate-500">{p.returnsCount} طلب إرجاع</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-rose-400">
                          {p.returnedQuantity} <span className="text-[9px] text-slate-500 font-normal">قطعة</span>
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <span className="inline-block px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-medium border border-slate-700">
                            {getReasonLabel(p.mainReason)}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-left font-mono font-bold text-rose-400">
                          {(p.totalRefunded || 0).toLocaleString('ar-EG')} <span className="text-[9px] font-normal">ج.م</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs font-medium">
                لا توجد طلبات إرجاع مسجلة للمنتجات في هذه الفترة.
              </div>
            )}
          </div>

          {/* Reasons & Status Breakdown (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  أسباب الإرجاع الأكثر شيوعاً (Return Reasons)
                </h4>
              </div>

              {loading && !returnsData ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-6 bg-slate-800/60 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : returnsData?.reasonsBreakdown && Object.keys(returnsData.reasonsBreakdown).length > 0 ? (
                (() => {
                  const values = Object.values(returnsData.reasonsBreakdown).map(v => Number(v) || 0);
                  const totalReasons = values.reduce((a: number, b: number) => a + b, 0) || 1;
                  const entries = (Object.entries(returnsData.reasonsBreakdown) as [string, number][]).sort((a, b) => (b[1] || 0) - (a[1] || 0));

                  return (
                    <div className="space-y-3">
                      {entries.map(([reasonKey, count]) => {
                        const numericCount = Number(count) || 0;
                        const pct = Math.round((numericCount / totalReasons) * 100);
                        return (
                          <div key={reasonKey} className="space-y-1">
                            <div className="flex justify-between text-xs font-bold">
                              <span className="text-slate-300">{getReasonLabel(reasonKey)}</span>
                              <span className="text-amber-400 font-mono">{numericCount} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-8 text-slate-500 text-xs font-medium">
                  لا توجد إحصاءات كافية عن أسباب الإرجاع بعد.
                </div>
              )}
            </div>

            {/* Status Summary Pill Row */}
            {returnsData && (
              <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">معلقة</span>
                  <span className="font-mono font-bold text-amber-400 text-xs">{returnsData.pendingReturns || 0}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">مستلمة بالمخزن</span>
                  <span className="font-mono font-bold text-sky-400 text-xs">{returnsData.receivedReturns || 0}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">مكتملة</span>
                  <span className="font-mono font-bold text-emerald-400 text-xs">{returnsData.completedReturns || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. INVENTORY & REVIEWS ANALYTICS (2 cols on lg) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Analytics */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" />
              📦 تحليلات المخزون والمنتجات (Inventory Analytics)
            </h3>
          </div>

          {loading && !inventoryData ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-800/60 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي المنتجات</span>
                <span className="text-lg font-black text-white font-mono">{inventoryData?.totalProducts || 0}</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي المخزون الكلي</span>
                <span className="text-lg font-black text-amber-400 font-mono">{(inventoryData?.totalStock || 0).toLocaleString('ar-EG')} <span className="text-[10px]">قطعة</span></span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">منخفض المخزون</span>
                <span className={`text-lg font-black font-mono ${(inventoryData?.lowStockItems || 0) > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-300'}`}>
                  {inventoryData?.lowStockItems || 0}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">المنتجات النافدة</span>
                <span className={`text-lg font-black font-mono ${(inventoryData?.outOfStockItems || 0) > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {inventoryData?.outOfStockItems || 0}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl col-span-2 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">القيمة الإجمالية للمخزون</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {(inventoryData?.inventoryValue || 0).toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Review Analytics */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              ⭐ تحليلات التقييمات والمراجعين (Reviews Analytics)
            </h3>
          </div>

          {loading && !reviewData ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-800/60 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي التقييمات</span>
                <span className="text-lg font-black text-white font-mono">{reviewData?.totalReviews || 0}</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">التقييمات المعتمدة</span>
                <span className="text-lg font-black text-emerald-400 font-mono">{reviewData?.approvedReviews || 0}</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">قيد المراجعة</span>
                <span className={`text-lg font-black font-mono ${(reviewData?.pendingReviews || 0) > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {reviewData?.pendingReviews || 0}
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">المرفوضة/المخفية</span>
                <span className="text-lg font-black text-rose-400 font-mono">{reviewData?.rejectedReviews || 0}</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl col-span-2 sm:col-span-2">
                <span className="text-[10px] text-slate-400 font-bold block mb-1">متوسط التقييم العام</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-black text-amber-400 font-mono">{reviewData?.averageRating || 0}</span>
                  <span className="text-xs text-slate-400 font-bold">من 5.0</span>
                  <div className="flex text-amber-400 mr-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.round(reviewData?.averageRating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
