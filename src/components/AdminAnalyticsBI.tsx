import React, { useState, useEffect } from 'react';
import {
  TrendingUp, ShoppingBag, Users, Layers, MapPin, Calendar,
  Download, Printer, AlertTriangle, ArrowUpRight, DollarSign,
  BarChart3, PieChart, Package, HelpCircle, Activity, Info, Sparkles, Check
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';

interface AdminAnalyticsBIProps {
  onRefreshAll?: () => void;
}

export default function AdminAnalyticsBI({ onRefreshAll }: AdminAnalyticsBIProps) {
  const [loading, setLoading] = useState(true);
  const [biData, setBiData] = useState<any>(null);
  const [error, setError] = useState('');
  
  // Date states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('30days'); // '7days', '30days', 'thismonth', 'alltime'

  // Sub-tabs in BI Dashboard
  const [biSubTab, setBiSubTab] = useState<'financials' | 'products' | 'customers' | 'export'>('financials');

  const fetchBIData = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminBIAnalytics(startDate, endDate);
      setBiData(res);
      setError('');
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل تقارير ذكاء الأعمال المتقدّمة'));
    } finally {
      setLoading(false);
    }
  };

  // Preset handlers
  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    const today = new Date();
    
    if (preset === '7days') {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === '30days') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'thismonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else if (preset === 'alltime') {
      setStartDate('');
      setEndDate('');
    }
  };

  useEffect(() => {
    applyPreset('30days');
  }, []);

  useEffect(() => {
    fetchBIData();
  }, [startDate, endDate]);

  const handleManualFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePreset('manual');
    fetchBIData();
  };

  // EXPORT ENGINE: Excel CSV (with UTF-8 BOM for perfect Excel Arabic loading)
  const handleExportCSV = () => {
    if (!biData) return;
    
    let csvContent = "\uFEFF"; // UTF-8 Byte Order Mark (BOM)
    
    // Title
    csvContent += "تقرير ذكاء الأعمال والتحليلات الإحصائية الفنية - النخبة للأجهزة المنزلية\n";
    csvContent += `تاريخ استخراج التقرير,${new Date().toLocaleDateString('ar-EG')} ${new Date().toLocaleTimeString('ar-EG')}\n`;
    csvContent += `الفترة الزمنية المحددة,من: ${startDate || 'البداية'} - إلى: ${endDate || 'اليوم'}\n`;
    csvContent += "\n";

    // 1. Financials
    csvContent += "1. الأداء المالي والمبيعات\n";
    csvContent += `إجمالي المبيعات الإجمالية (إيرادات),${biData.financials.totalRevenue} ج.م\n`;
    csvContent += `تكلفة البضائع المباعة (COGS),${biData.financials.totalCogs} ج.م\n`;
    csvContent += `صافي الأرباح التقديرية,${biData.financials.totalProfit} ج.م\n`;
    csvContent += `نسبة هامش الربح الإجمالي,${biData.financials.profitMargin}%\n`;
    csvContent += `قيمة الخصومات والكوبونات الممنوحة,${biData.financials.totalDiscountsGiven} ج.م\n`;
    csvContent += `رسوم شحن محصلة,${biData.financials.totalShippingCollected} ج.م\n`;
    csvContent += "\n";

    // 2. Volumes
    csvContent += "2. أحجام العمليات والطلبات\n";
    csvContent += `إجمالي عدد الطلبات المقدمة,${biData.orders.totalOrdersCount}\n`;
    csvContent += `عدد الطلبات النشطة (غير الملغاة/المسترجعة),${biData.orders.validOrdersCount}\n`;
    csvContent += `متوسط قيمة الطلب الفردي (AOV),${biData.orders.averageOrderValue} ج.م\n`;
    csvContent += "\n";

    // 3. Customers
    csvContent += "3. مؤشرات العملاء والتفاعل\n";
    csvContent += `عدد العملاء الفريدين,${biData.customers.totalUniqueCustomers}\n`;
    csvContent += `عدد العملاء المتكررين (اشتروا أكثر من مرة),${biData.customers.returningCustomersCount}\n`;
    csvContent += `معدل تكرار الشراء للعملاء,${biData.customers.repeatCustomerRate}%\n`;
    csvContent += `القيمة الزمنية التقديرية للعميل (CLV),${biData.customers.customerLifetimeValue} ج.م\n`;
    csvContent += "\n";

    // 4. Best Sellers
    csvContent += "4. المنتجات الأكثر مبيعاً ورواجاً (Top 10)\n";
    csvContent += "معرف المنتج,اسم المنتج,القسم,الماركة,الكمية المباعة (وحدات),العائدات المالية المحققة\n";
    biData.bestSellers.forEach((item: any) => {
      csvContent += `${item.id},"${item.title.replace(/"/g, '""')}",${item.category},${item.brand},${item.unitsSold},${item.revenue} ج.م\n`;
    });
    csvContent += "\n";

    // 5. Slow Moving
    csvContent += "5. المنتجات الراكدة وبطيئة الحركة (الأسوأ مبيعاً مع رصيد مخزني)\n";
    csvContent += "معرف المنتج,اسم المنتج,القسم,الماركة,الكمية المباعة,الرصيد المتاح بالمستودع\n";
    biData.slowMoving.forEach((item: any) => {
      csvContent += `${item.id},"${item.title.replace(/"/g, '""')}",${item.category},${item.brand},${item.unitsSold},${item.currentStock}\n`;
    });
    csvContent += "\n";

    // 6. Geographic Distribution
    csvContent += "6. مبيعات المحافظات والمناطق الجغرافية\n";
    csvContent += "المحافظة,العائدات المالية,عدد الطلبات المحققة\n";
    biData.geographicData.forEach((geo: any) => {
      csvContent += `${geo.name},${geo.revenue} ج.م,${geo.ordersCount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `النخبة_ذكاء_الأعمال_تقرير_شامل_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // HIGH FIDELITY EXECUTIVE PRINT TO PDF TRIGGER
  const handlePrintPDF = () => {
    window.print();
  };

  if (loading && !biData) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-500 dark:text-slate-400 font-sans gap-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <Activity className="w-10 h-10 animate-spin text-amber-500" />
        <span className="text-sm font-bold">جارٍ تجميع وتنقيب البيانات وتوليد مصفوفات الأعمال...</span>
      </div>
    );
  }

  // Fallback defaults
  const financials = biData?.financials || { totalRevenue: 0, totalCogs: 0, totalProfit: 0, profitMargin: 0, totalShippingCollected: 0, totalTaxCollected: 0, totalDiscountsGiven: 0 };
  const orders = biData?.orders || { totalOrdersCount: 0, validOrdersCount: 0, averageOrderValue: 0, orderStatusDistribution: {} };
  const customers = biData?.customers || { totalUniqueCustomers: 0, returningCustomersCount: 0, repeatCustomerRate: 0, customerLifetimeValue: 0 };
  const inventory = biData?.inventory || { totalCatalogProducts: 0, totalStockOnHand: 0, totalTiedCapital: 0, lowStockCount: 0, outOfStockCount: 0 };

  const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e'];

  return (
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100 print:bg-white print:text-black print:p-0" id="bi-dashboard-container">
      
      {/* 📊 BI DASHBOARD HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-[10px] text-amber-600 dark:text-amber-500 font-black flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              BI INSIGHTS ENGINE v2.5
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">مركز معلومات ذكاء الأعمال والتحليلات المالية</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            مؤشرات أداء متقدمة لمبيعات الأجهزة، تكاليف البضائع المباعة، كفاءة الأرباح، والمنتجات الراكدة
          </p>
        </div>

        {/* Dynamic Preset Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs font-bold">
          <button
            onClick={() => applyPreset('7days')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activePreset === '7days' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => applyPreset('30days')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activePreset === '30days' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          >
            آخر 30 يوم
          </button>
          <button
            onClick={() => applyPreset('thismonth')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activePreset === 'thismonth' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => applyPreset('alltime')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${activePreset === 'alltime' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          >
            كل الأوقات
          </button>
        </div>
      </div>

      {/* 📅 DATE FILTER & QUICK EXPORTS BAR */}
      <div className="bg-white dark:bg-slate-900/55 border border-slate-200 dark:border-slate-800/80 p-5 rounded-2xl flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 shadow-xs print:hidden">
        <form onSubmit={handleManualFilter} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-amber-500" />
            <span>فلترة مخصصة للفترة:</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setActivePreset('manual');
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 shadow-xs"
            />
            <span className="text-xs text-slate-500">إلى</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setActivePreset('manual');
              }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500 shadow-xs"
            />
          </div>

          <button
            type="submit"
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
          >
            تطبيق
          </button>
        </form>

        {/* Exports */}
        <div className="flex items-center gap-2 text-xs font-bold shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 dark:bg-emerald-600/10 border border-emerald-200 dark:border-emerald-500/25 hover:bg-emerald-600 hover:text-white dark:hover:text-slate-950 rounded-xl text-emerald-700 dark:text-emerald-400 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            تصدير ملف Excel (CSV)
          </button>
          
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 hover:bg-amber-500 hover:text-slate-950 rounded-xl text-amber-700 dark:text-amber-400 transition-all cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            طباعة تقرير PDF 📄
          </button>
        </div>
      </div>

      {/* 💼 BI MAIN SECTIONS NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 pb-0 overflow-x-auto text-xs font-bold gap-1 print:hidden">
        <button
          onClick={() => setBiSubTab('financials')}
          className={`flex items-center gap-1.5 px-4 py-3 border-b-2 transition-all cursor-pointer ${biSubTab === 'financials' ? 'border-amber-500 text-amber-600 dark:text-amber-500 bg-amber-50/50 dark:bg-slate-900/40 rounded-t-xl' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
        >
          <TrendingUp className="w-4 h-4" />
          الأداء المالي والمبيعات
        </button>
        <button
          onClick={() => setBiSubTab('products')}
          className={`flex items-center gap-1.5 px-4 py-3 border-b-2 transition-all cursor-pointer ${biSubTab === 'products' ? 'border-amber-500 text-amber-600 dark:text-amber-500 bg-amber-50/50 dark:bg-slate-900/40 rounded-t-xl' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
        >
          <Package className="w-4 h-4" />
          المنتجات والمخزون المتقدم
        </button>
        <button
          onClick={() => setBiSubTab('customers')}
          className={`flex items-center gap-1.5 px-4 py-3 border-b-2 transition-all cursor-pointer ${biSubTab === 'customers' ? 'border-amber-500 text-amber-600 dark:text-amber-500 bg-amber-50/50 dark:bg-slate-900/40 rounded-t-xl' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
        >
          <Users className="w-4 h-4" />
          مؤشرات وسلوك العملاء
        </button>
        <button
          onClick={() => setBiSubTab('export')}
          className={`flex items-center gap-1.5 px-4 py-3 border-b-2 transition-all cursor-pointer ${biSubTab === 'export' ? 'border-amber-500 text-amber-600 dark:text-amber-500 bg-amber-50/50 dark:bg-slate-900/40 rounded-t-xl' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
        >
          <Download className="w-4 h-4" />
          مركز تصدير التقارير التنفيذية
        </button>
      </div>

      {/* 📦 TAB VIEW 1: FINANCIALS & SALES */}
      {biSubTab === 'financials' && (
        <div className="space-y-6">
          
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="bi-financial-kpis">
            
            {/* KPI: Revenue */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <div className="absolute top-4 left-4 p-2.5 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-xl">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">إجمالي الإيرادات (المبيعات)</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{financials.totalRevenue.toLocaleString('ar-EG')} ج.م</h3>
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-2.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>إجمالي الطلبات الفعالة: {orders.validOrdersCount} طلب</span>
              </div>
            </div>

            {/* KPI: COGS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <div className="absolute top-4 left-4 p-2.5 bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-800">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">تكلفة البضاعة المباعة (COGS)</span>
              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-300">{financials.totalCogs.toLocaleString('ar-EG')} ج.م</h3>
              <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold mt-2.5">
                <Info className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                <span>مقدرة على أساس 75% من سعر العرض</span>
              </div>
            </div>

            {/* KPI: Profit */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <div className="absolute top-4 left-4 p-2.5 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">صافي الأرباح المقدرة</span>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{financials.totalProfit.toLocaleString('ar-EG')} ج.م</h3>
              <div className="flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold mt-2.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>عائد ربحي إضافي مستقر</span>
              </div>
            </div>

            {/* KPI: Margin */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <div className="absolute top-4 left-4 p-2.5 bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">نسبة هامش الأرباح</span>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">{financials.profitMargin}%</h3>
              <div className="flex items-center gap-1 text-[9px] text-slate-500 font-bold mt-2.5">
                <Info className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                <span>متوسط كفاءة العائد التشغيلي للمتجر</span>
              </div>
            </div>

          </div>

          {/* Secondary financial figures bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-xs print:hidden shadow-xs">
            <div className="flex justify-between items-center px-2 py-1 border-r border-slate-200 dark:border-slate-800/80 first:border-0">
              <span className="text-slate-600 dark:text-slate-400 font-medium">رسوم التوصيل المحصلة:</span>
              <span className="text-slate-900 dark:text-white font-bold">{financials.totalShippingCollected.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="flex justify-between items-center px-2 py-1 border-r border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-600 dark:text-slate-400 font-medium">الضرائب المضافة التقديرية (14%):</span>
              <span className="text-slate-900 dark:text-white font-bold">{financials.totalTaxCollected.toLocaleString('ar-EG')} ج.م</span>
            </div>
            <div className="flex justify-between items-center px-2 py-1 border-r border-slate-200 dark:border-slate-800/80">
              <span className="text-slate-600 dark:text-slate-400 font-medium">قيمة الخصومات والكوبونات المفعلة:</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">{financials.totalDiscountsGiven.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>

          {/* Dynamic Recharts Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Sales & Profit Timeline chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-4.5 h-4.5 text-amber-500" />
                  منحنى المبيعات وصافي الأرباح التقديرية عبر الزمن
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">تحديث فوري تلقائي</span>
              </div>

              <div className="h-72 w-full text-slate-500 dark:text-slate-400 text-xs">
                {biData.timelineData?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={biData.timelineData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                      <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--tooltip-bg, #0f172a)', borderColor: '#334155', borderRadius: 8, color: '#f8fafc', fontSize: 11, textAlign: 'right' }}
                        labelFormatter={(label) => `التاريخ: ${label}`}
                      />
                      <Legend style={{ fontSize: 11 }} />
                      <Area name="الإيرادات (ج.م)" type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                      <Area name="الأرباح الصافية (ج.م)" type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 font-bold">
                    لا تتوفر مبيعات مسجلة في النطاق الزمني المحدد لتصوير المنحنى البياني
                  </div>
                )}
              </div>
            </div>

            {/* Order status breakdown and ratios */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-xs">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <PieChart className="w-4.5 h-4.5 text-amber-500" />
                  تفصيل حالة وتوزيع الأوردرات (%)
                </h3>

                <div className="space-y-3.5">
                  {Object.entries(orders.orderStatusDistribution || {}).map(([status, count]: [string, any], idx) => {
                    const total = orders.totalOrdersCount || 1;
                    const percent = Math.round((count / total) * 100);
                    const colorClasses = [
                      'bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-rose-500', 'bg-slate-500'
                    ];
                    const activeColor = colorClasses[idx % colorClasses.length];

                    return (
                      <div key={status} className="text-xs">
                        <div className="flex justify-between items-center font-bold text-slate-700 dark:text-slate-300 mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${activeColor}`}></span>
                            {status === 'Pending' ? 'بانتظار التأكيد تليفونياً' :
                             status === 'Confirmed' ? 'مؤكدة وبانتظار التجهيز' :
                             status === 'Preparing' ? 'تجهيز وتعبئة بالمخازن' :
                             status === 'Shipped' ? 'مع المندوب للتوصيل' :
                             status === 'Delivered' ? 'تم الاستلام والدفع بالكامل' :
                             status === 'Cancelled' ? 'ملغية' : 'مسترجعة'}
                          </span>
                          <span className="text-slate-900 dark:text-white font-semibold">{count} طلب ({percent}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full ${activeColor}`} style={{ width: `${percent}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-4 text-center">
                <p className="text-[10px] text-slate-500 font-bold mb-1">معدل الإلغاء والاسترجاع العام</p>
                <p className="text-lg font-black text-rose-600 dark:text-rose-400">
                  {Math.round((((orders.orderStatusDistribution?.Cancelled || 0) + (orders.orderStatusDistribution?.Returned || 0)) / (orders.totalOrdersCount || 1)) * 100)}%
                </p>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 📦 TAB VIEW 2: PRODUCTS, CATEGORIES, & INVENTORY */}
      {biSubTab === 'products' && (
        <div className="space-y-6">
          
          {/* Inventory tied capital KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="bi-inventory-kpis">
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">إجمالي المنتجات في الفهرس</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{inventory.totalCatalogProducts} جهاز</h3>
              <p className="text-[9px] text-slate-500 mt-1">تتضمن كافة الفئات والماركات المفعّلة</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">الرصيد الكلي في المستودع</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{inventory.totalStockOnHand} قطعة</h3>
              <p className="text-[9px] text-amber-600 dark:text-amber-500 font-bold mt-1">المجموع الفعلي المتاح للشراء والطلب</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">رأس المال المخزّن (التكلفة)</span>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{inventory.totalTiedCapital.toLocaleString('ar-EG')} ج.م</h3>
              <p className="text-[9px] text-slate-500 mt-1">القيمة التقديرية الإجمالية للمخزون بسعر الجملة</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">نفاذ المخزون والتحذيرات</span>
              <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {inventory.outOfStockCount} نافذ / {inventory.lowStockCount} منخفض
              </h3>
              <p className="text-[9px] text-rose-600 dark:text-rose-400/80 mt-1">تحتاج لتوريد فوري من المصانع</p>
            </div>

          </div>

          {/* Category Revenue Contribution Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Category Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-amber-500" />
                توزيع المبيعات والإيرادات حسب فئة الجهاز (ج.م)
              </h3>
              <div className="h-64 text-slate-500 dark:text-slate-400 text-xs">
                {biData.categoryData?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={biData.categoryData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                      <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, color: '#f8fafc', fontSize: 11, textAlign: 'right' }}
                      />
                      <Bar name="الإيرادات" dataKey="revenue" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 font-bold">
                    لا تتوفر أي إحصاءات للفئات في المبيعات الحالية
                  </div>
                )}
              </div>
            </div>

            {/* Brand Sales Distribution */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                <BarChart3 className="w-4.5 h-4.5 text-amber-500" />
                تحليل مبيعات العلامات التجارية الكبرى (الماركة)
              </h3>
              <div className="h-64 text-slate-500 dark:text-slate-400 text-xs">
                {biData.brandData?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={biData.brandData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                      <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 10 }} />
                      <YAxis stroke="#64748b" style={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, color: '#f8fafc', fontSize: 11, textAlign: 'right' }}
                      />
                      <Bar name="الوحدات المباعة" dataKey="unitsSold" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 font-bold">
                    لا تتوفر مبيعات للماركات في النطاق الزمني المحدد
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Detailed Product Insight Lists: Best Sellers vs Slow Moving */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Best Sellers */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-500" />
                  الأجهزة الأكثر مبيعاً ورواجاً (Top Sellers)
                </h3>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full">الأعلى طلباً ⭐</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      <th className="pb-2">اسم الجهاز</th>
                      <th className="pb-2">الماركة</th>
                      <th className="pb-2 text-left">الوحدات المباعة</th>
                      <th className="pb-2 text-left">إجمالي الإيراد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                    {biData.bestSellers?.length > 0 ? (
                      biData.bestSellers.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40">
                          <td className="py-2 px-1 max-w-[200px] truncate font-semibold text-slate-900 dark:text-white">{item.title}</td>
                          <td className="py-2 text-slate-500 dark:text-slate-400">{item.brand}</td>
                          <td className="py-2 text-left font-bold text-slate-800 dark:text-slate-200">{item.unitsSold} قطعة</td>
                          <td className="py-2 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.revenue.toLocaleString('ar-EG')} ج.م</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">لا تتوفر أية بيانات لمبيعات الأجهزة حالياً.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Slow Moving Products with Stock */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                  المنتجات الراكدة أو بطيئة الحركة بالمخزن
                </h3>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-full">رأس مال معطل ⚠️</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      <th className="pb-2">اسم الجهاز</th>
                      <th className="pb-2">الماركة / الفئة</th>
                      <th className="pb-2 text-left">الوحدات المباعة</th>
                      <th className="pb-2 text-left">الرصيد الراكد بالمستودع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                    {biData.slowMoving?.length > 0 ? (
                      biData.slowMoving.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40">
                          <td className="py-2 px-1 max-w-[200px] truncate text-slate-900 dark:text-white font-medium">{item.title}</td>
                          <td className="py-2 text-slate-500 dark:text-slate-400 text-[10px]">{item.brand} / {item.category}</td>
                          <td className="py-2 text-left font-bold text-slate-500 dark:text-slate-400">{item.unitsSold} قطعة</td>
                          <td className={`py-2 text-left font-bold ${item.currentStock > 10 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                            {item.currentStock} قطعة متبقية
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">لا توجد منتجات راكدة مسجلة.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Low Stock List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4.5 h-4.5 text-red-500 animate-pulse" />
              التقرير الفوري للمنتجات منخفضة المخزون (تحت خط حد الأمان 5 قطع)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                    <th className="pb-2.5">اسم الجهاز في المستودع</th>
                    <th className="pb-2.5">الماركة</th>
                    <th className="pb-2.5">القسم</th>
                    <th className="pb-2.5 text-left">سعر العرض</th>
                    <th className="pb-2.5 text-left">الرصيد المتاح</th>
                    <th className="pb-2.5 text-left">الحالة التشغيلية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                  {biData.lowStockProducts?.length > 0 ? (
                    biData.lowStockProducts.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40">
                        <td className="py-2.5 font-semibold text-slate-900 dark:text-white">{p.title}</td>
                        <td className="py-2.5 text-slate-500 dark:text-slate-400">{p.brand}</td>
                        <td className="py-2.5 text-slate-500 dark:text-slate-400">{p.category}</td>
                        <td className="py-2.5 text-left font-mono text-slate-800 dark:text-slate-200">{p.price.toLocaleString('ar-EG')} ج.م</td>
                        <td className={`py-2.5 text-left font-black ${p.stock === 0 ? 'text-red-600 dark:text-red-500' : 'text-rose-600 dark:text-rose-400'}`}>
                          {p.stock === 0 ? 'نفذت الكمية ❌' : `${p.stock} أجهزة متبقية`}
                        </td>
                        <td className="py-2.5 text-left">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${p.stock === 0 ? 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-500' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                            {p.stock === 0 ? 'معطل مؤقتاً' : 'إعادة طلب عاجلة'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-emerald-600 dark:text-emerald-400 font-bold">جميع المنتجات المتوفرة بمخازنكم تزيد عن حد الأمان المستودعي! 👍</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 📦 TAB VIEW 3: CUSTOMERS & BEHAVIORS */}
      {biSubTab === 'customers' && (
        <div className="space-y-6">
          
          {/* Customer KPI Grids */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="bi-customer-kpis">
            
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">إجمالي عملاء المتجر الفريدين</span>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{customers.totalUniqueCustomers} عميل فريد</h3>
              <p className="text-[9px] text-slate-500 mt-1">تحديد الهوية مبني على الاسم ورقم الموبايل</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">عدد المشترين المتكررين</span>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-500">{customers.returningCustomersCount} مشترٍ</h3>
              <p className="text-[9px] text-amber-600 dark:text-amber-500 mt-1 font-semibold">قاموا بتقديم أوردرين أو أكثر بنجاح</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">نسبة تكرار شراء العملاء</span>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{customers.repeatCustomerRate}%</h3>
              <p className="text-[9px] text-slate-500 mt-1">أداة قياس الولاء التجاري ورضا العملاء</p>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">القيمة الزمنية للعميل (CLV)</span>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">{customers.customerLifetimeValue.toLocaleString('ar-EG')} ج.م</h3>
              <p className="text-[9px] text-slate-500 mt-1">متوسط إجمالي ما ينفقه المشتري الواحد بالمتجر</p>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Geographic distribution of orders */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <MapPin className="w-4.5 h-4.5 text-amber-500" />
                توزيع المبيعات الجغرافية والطلبات حسب المحافظة (الخريطة الإحصائية)
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                      <th className="pb-2">المحافظة / إقليم الشحن</th>
                      <th className="pb-2 text-center">عدد الأوردرات</th>
                      <th className="pb-2 text-left">قيمة الإيرادات المحققة</th>
                      <th className="pb-2 text-left">الحصة الإقليمية (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                    {biData.geographicData?.length > 0 ? (
                      biData.geographicData.map((geo: any) => {
                        const totalRev = financials.totalRevenue || 1;
                        const percent = Math.round((geo.revenue / totalRev) * 100);
                        return (
                          <tr key={geo.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/40">
                            <td className="py-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-amber-500" />
                              {geo.name}
                            </td>
                            <td className="py-2.5 text-center font-bold text-slate-700 dark:text-slate-300">{geo.ordersCount} طلبات</td>
                            <td className="py-2.5 text-left font-mono font-bold text-slate-900 dark:text-slate-100">{geo.revenue.toLocaleString('ar-EG')} ج.م</td>
                            <td className="py-2.5 text-left">
                              <div className="flex items-center justify-end gap-2">
                                <span className="font-bold text-amber-600 dark:text-amber-500">{percent}%</span>
                                <div className="w-16 bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500" style={{ width: `${percent}%` }}></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">لا تتوفر أية بيانات جغرافية للمبيعات بعد.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick business consulting panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between shadow-xs">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-4.5 h-4.5 text-amber-500" />
                  رؤية وتحليلات استشارية ذكية (AI Tips)
                </h3>
                <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/10 rounded-xl">
                    <p className="font-bold text-amber-700 dark:text-amber-400 mb-1">💡 سلوك الشراء المتكرر:</p>
                    <p>معدل ولائكم يبلغ <strong className="text-slate-900 dark:text-white">{customers.repeatCustomerRate}%</strong>. لزيادة هذا المؤشر، ننصح ببرمجة حملة تسويقية عبر الواتساب وتقديم عروض مخصصة وكوبونات خصم ترحيبية للعملاء بعد أول طلب لتشجيعهم على تجهيز بقية منزلهم.</p>
                  </div>
                  
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                    <p className="font-bold text-amber-700 dark:text-amber-400 mb-1">🚚 الكفاءة الإقليمية:</p>
                    <p>أغلب المبيعات تتركز في محافظات محددة. ننصح بتقديم حوافز "شحن مجاني لفترة محدودة" للمحافظات الأقل نشاطاً لتوسيع رقعتكم الجغرافية وتخفيض متوسط تكلفة الاستحواذ على العميل الفردي.</p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-4 text-[10px] text-slate-500 text-center font-bold">
                محرك التوصيات الاستشارية المتقدم للنخبة 📊
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 📦 TAB VIEW 4: COMPREHENSIVE EXPORT HUB */}
      {biSubTab === 'export' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl space-y-6 shadow-xs">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">مركز استخراج الفواتير والتقارير المالية التنفيذية الموحد</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              قم بتحميل واستخراج كافة البيانات الإحصائية وجداول حركة المبيعات وتوافر المخزون وصافي هوامش الأرباح بصيغ دولية قياسية.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* CSV Box */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between group hover:border-emerald-500/40 transition-all shadow-xs">
              <div>
                <span className="text-[9px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-500/20 px-2.5 py-0.5 rounded-full inline-block mb-3">EXCEL COMPATIBLE</span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white mb-2">استخراج ورقة العمل المالية التفاعلية (Excel / CSV)</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  ملف جدول بيانات يتضمن الإحصاءات المالية المباشرة، تكلفة البضائع، صافي الأرباح اليومية، وقائمة أفضل المنتجات مبيعاً وتواجدها المخزني. مدعوم بالكامل باللغة العربية.
                </p>
              </div>
              <button
                onClick={handleExportCSV}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                تحميل الملف المالي الآن (.CSV)
              </button>
            </div>

            {/* PDF Box */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl flex flex-col justify-between group hover:border-sky-500/40 transition-all shadow-xs">
              <div>
                <span className="text-[9px] bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold border border-sky-200 dark:border-sky-500/20 px-2.5 py-0.5 rounded-full inline-block mb-3">HIGH FIDELITY PRINTABLE</span>
                <h4 className="text-xs font-black text-slate-900 dark:text-white mb-2">توليد التقرير التنفيذي لمديري مجالس الإدارة (PDF)</h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  توليد مستند مالي فخم ومنسق للغاية جاهز للطباعة أو الحفظ كملف PDF. يتضمن توزيع الطلبات، الهوامش التشغيلية، ومبيعات الأقاليم، مهيأ تماماً لطباعة الورق دون أي زوائد للواجهة المظلمة.
                </p>
              </div>
              <button
                onClick={handlePrintPDF}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                توليد التقرير وطباعته الآن (.PDF)
              </button>
            </div>

          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-500 dark:text-slate-600 shrink-0" />
            <span>يتم استخراج البيانات مباشرة من قاعدة بيانات المتجر المحدثة للتأكد من تطابق الحسابات والمراجعات الضريبية بنسبة 100%.</span>
          </div>
        </div>
      )}

      {/* 📊 HIDDEN PRINT ONLY - EXECUTIVE PDF VIEW */}
      <div className="hidden print:block text-black bg-white p-8 font-sans" id="bi-print-executive-report" dir="rtl">
        <div className="text-center border-b-2 border-double border-slate-900 pb-5 mb-6">
          <h1 className="text-2xl font-black mb-1">التقرير التنفيذي لذكاء الأعمال والأداء المالي للمتجر</h1>
          <p className="text-xs text-slate-600">النخبة للأجهزة المنزلية ومستلزمات المعيشة الراقية</p>
          <div className="flex justify-between items-center text-[10px] text-slate-600 mt-4 px-2">
            <span>تاريخ توليد المستند: {new Date().toLocaleDateString('ar-EG')}</span>
            <span>الفترة المحددة: من {startDate || 'البداية'} إلى {endDate || 'اليوم'}</span>
          </div>
        </div>

        <div className="space-y-6">
          
          {/* Section: Financials */}
          <div>
            <h2 className="text-xs font-black bg-slate-100 p-1.5 border-r-4 border-slate-900 mb-3 text-slate-900">أولاً: الأداء التشغيلي والمالي للمتجر</h2>
            <div className="grid grid-cols-4 gap-4 text-right">
              <div className="border border-slate-300 p-2.5 rounded">
                <span className="text-[9px] text-slate-500 block">إجمالي الإيرادات</span>
                <span className="text-sm font-black">{financials.totalRevenue.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="border border-slate-300 p-2.5 rounded">
                <span className="text-[9px] text-slate-500 block">تكلفة البضائع المباعة</span>
                <span className="text-sm font-black">{financials.totalCogs.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="border border-slate-300 p-2.5 rounded">
                <span className="text-[9px] text-slate-500 block">صافي الأرباح المقدرة</span>
                <span className="text-sm font-black">{financials.totalProfit.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="border border-slate-300 p-2.5 rounded">
                <span className="text-[9px] text-slate-500 block">هامش الأرباح</span>
                <span className="text-sm font-black">{financials.profitMargin}%</span>
              </div>
            </div>
          </div>

          {/* Section: Volumes */}
          <div>
            <h2 className="text-xs font-black bg-slate-100 p-1.5 border-r-4 border-slate-900 mb-3 text-slate-900">ثانياً: أحجام العمليات وعدد المشترين</h2>
            <div className="grid grid-cols-4 gap-4 text-right">
              <div className="border border-slate-300 p-2.5 rounded">
                <span className="text-[9px] text-slate-500 block">إجمالي الأوردرات</span>
                <span className="text-sm font-black">{orders.totalOrdersCount} طلب</span>
              </div>
              <div className="border border-slate-300 p-2.5 rounded">
                <span className="text-[9px] text-slate-500 block">متوسط الفاتورة (AOV)</span>
                <span className="text-sm font-black">{orders.averageOrderValue.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="border border-slate-300 p-2.5 rounded">
                <span className="text-[9px] text-slate-500 block">العملاء الفريدين</span>
                <span className="text-sm font-black">{customers.totalUniqueCustomers} عميل</span>
              </div>
              <div className="border border-slate-300 p-2.5 rounded">
                <span className="text-[9px] text-slate-500 block">معدل تكرار الشراء</span>
                <span className="text-sm font-black">{customers.repeatCustomerRate}%</span>
              </div>
            </div>
          </div>

          {/* Section: Best Sellers list in Print */}
          <div>
            <h2 className="text-xs font-black bg-slate-100 p-1.5 border-r-4 border-slate-900 mb-3 text-slate-900">ثالثاً: قائمة المنتجات الأكثر مبيعاً (Top Sellers)</h2>
            <table className="w-full text-[10px] text-right border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 font-bold text-slate-700">
                  <th className="p-2 border-r border-slate-300">اسم المنتج</th>
                  <th className="p-2 border-r border-slate-300">الماركة</th>
                  <th className="p-2 border-r border-slate-300">القسم</th>
                  <th className="p-2 border-r border-slate-300 text-left">الكمية المباعة</th>
                  <th className="p-2 text-left">العائدات المحققة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {biData.bestSellers?.slice(0, 5).map((item: any) => (
                  <tr key={item.id}>
                    <td className="p-2 border-r border-slate-300 font-semibold">{item.title}</td>
                    <td className="p-2 border-r border-slate-300 text-slate-600">{item.brand}</td>
                    <td className="p-2 border-r border-slate-300 text-slate-600">{item.category}</td>
                    <td className="p-2 border-r border-slate-300 text-left font-bold">{item.unitsSold} قطعة</td>
                    <td className="p-2 text-left font-bold">{item.revenue.toLocaleString('ar-EG')} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section: Geographic list in Print */}
          <div>
            <h2 className="text-xs font-black bg-slate-100 p-1.5 border-r-4 border-slate-900 mb-3 text-slate-900">رابعاً: التوزيع الجغرافي للمبيعات والأقاليم</h2>
            <table className="w-full text-[10px] text-right border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 font-bold text-slate-700">
                  <th className="p-2 border-r border-slate-300">المحافظة</th>
                  <th className="p-2 border-r border-slate-300 text-center">عدد الأوردرات</th>
                  <th className="p-2 text-left">العائدات الجغرافية المحققة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {biData.geographicData?.slice(0, 5).map((geo: any) => (
                  <tr key={geo.name}>
                    <td className="p-2 border-r border-slate-300 font-bold">{geo.name}</td>
                    <td className="p-2 border-r border-slate-300 text-center">{geo.ordersCount} طلبات</td>
                    <td className="p-2 text-left font-bold">{geo.revenue.toLocaleString('ar-EG')} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Closing & Sign-off */}
          <div className="pt-8 border-t border-slate-300 mt-10 text-center text-[9px] text-slate-500">
            تمت مراجعة الحسابات وتصدير التقرير الكترونياً بنجاح بواسطة نظام النخبة لذكاء الأعمال والمحاسبة الفورية.
          </div>

        </div>
      </div>

    </div>
  );
}
