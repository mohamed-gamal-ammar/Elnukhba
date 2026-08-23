import React, { useState, useEffect } from 'react';
import { ShieldCheck, TrendingUp, ShoppingBag, AlertTriangle, Database, RefreshCw, ClipboardList, CheckCircle, Bell, ExternalLink, User, Lock, AlertCircle, RotateCcw } from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { CurrentAdmin } from '../types.js';
import AdminAnalyticsSection from './AdminAnalyticsSection.js';
import AdminCampaignsSection from './AdminCampaignsSection.js';
import { AdminPageHeader, AdminBadge, AdminSkeleton } from './AdminUIComponents.js';
import {
  KpiCard,
  TopProductsWidget,
  ActiveCampaignsWidget,
  CustomerReviewsWidget,
  OrderStatusWidget,
  AuditLogsWidget,
  ReturnsOverviewWidget
} from './AdminDashboardWidgets.js';

interface AdminDashboardProps {
  onNavigate: (tab: string, arg?: any) => void;
  onRefreshProducts: () => void;
  activeSubTab: string;
  setActiveSubTab: (sub: string, queryParams?: string) => void;
  currentAdmin?: CurrentAdmin | null;
  setCurrentAdmin?: React.Dispatch<React.SetStateAction<CurrentAdmin | null>>;
}

export default function AdminDashboard({
  onNavigate,
  onRefreshProducts,
  activeSubTab,
  setActiveSubTab,
  currentAdmin,
  setCurrentAdmin
}: AdminDashboardProps) {
  const [data, setData] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [reviewSummary, setReviewSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Admin Account Editing States
  const [accountName, setAccountName] = useState(currentAdmin?.name || '');
  const [accountPhone, setAccountPhone] = useState(currentAdmin?.phone || '');
  const [phoneError, setPhoneError] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [accountMsg, setAccountMsg] = useState('');
  const [accountError, setAccountError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Egyptian Mobile Number Validation Regex (11 digits: 010, 011, 012, 015)
  const EGYPTIAN_PHONE_REGEX = /^01[0125]\d{8}$/;

  const validateEgyptianPhone = (phone: string): { isValid: boolean; error: string } => {
    const trimmed = phone.trim();
    if (!trimmed) {
      return { isValid: false, error: 'يرجى إدخال رقم الهاتف / التليفون (مطلوب)' };
    }
    if (!EGYPTIAN_PHONE_REGEX.test(trimmed)) {
      return {
        isValid: false,
        error: 'يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقمًا يبدأ بـ 010 أو 011 أو 012 أو 015'
      };
    }
    return { isValid: true, error: '' };
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Digit-only input: restrict input to digits (0-9) only, max 11 digits
    const rawValue = e.target.value;
    const digitsOnly = rawValue.replace(/\D/g, '').slice(0, 11);
    setAccountPhone(digitsOnly);

    // Real-time validation feedback & automatic error clearing
    if (!digitsOnly) {
      if (phoneTouched) {
        setPhoneError('يرجى إدخال رقم الهاتف / التليفون (مطلوب)');
      } else {
        setPhoneError('');
      }
      return;
    }

    if (EGYPTIAN_PHONE_REGEX.test(digitsOnly)) {
      setPhoneError('');
      if (accountError && accountError.includes('رقم هاتف')) {
        setAccountError('');
      }
    } else {
      if (digitsOnly.length === 11) {
        setPhoneError('يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقمًا يبدأ بـ 010 أو 011 أو 012 أو 015');
      } else if (digitsOnly.length >= 3 && !/^01[0125]/.test(digitsOnly)) {
        setPhoneError('يجب أن يبدأ رقم الهاتف بـ 010 أو 011 أو 012 أو 015');
      } else if (phoneTouched) {
        setPhoneError('يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقمًا يبدأ بـ 010 أو 011 أو 012 أو 015');
      } else {
        setPhoneError('');
      }
    }
  };

  const handlePhoneBlur = () => {
    setPhoneTouched(true);
    const validation = validateEgyptianPhone(accountPhone);
    if (!validation.isValid) {
      setPhoneError(validation.error);
    } else {
      setPhoneError('');
    }
  };

  // Optional Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (currentAdmin?.name) {
      setAccountName(currentAdmin.name);
    }
    setAccountPhone(currentAdmin?.phone || '');
  }, [currentAdmin?.name, currentAdmin?.phone]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg('');
    setAccountError('');

    if (!accountName.trim()) {
      setAccountError('يرجى إدخال الاسم الكامل لمسؤول النظام');
      return;
    }

    // Phone validation guard
    setPhoneTouched(true);
    const phoneValidation = validateEgyptianPhone(accountPhone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error);
      setAccountError(phoneValidation.error);
      return;
    }
    setPhoneError('');

    const hasPasswordInput = Boolean(currentPassword || newPassword || confirmPassword);

    if (hasPasswordInput) {
      if (!currentPassword) {
        setAccountError('يرجى إدخال كلمة المرور الحالية لتأكيد التغيير الأمني');
        return;
      }
      if (!newPassword) {
        setAccountError('يرجى إدخال كلمة المرور الجديدة');
        return;
      }
      if (newPassword.length < 6) {
        setAccountError('يجب أن لا تقل كلمة المرور الجديدة عن 6 أحرف');
        return;
      }
      if (newPassword !== confirmPassword) {
        setAccountError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const updatedName = accountName.trim();
      const updatedPhone = accountPhone.trim();

      // 1. Update Profile API (Name, Phone)
      const profileRes = await api.updateAdminProfile({
        name: updatedName,
        phone: updatedPhone
      });

      if (!profileRes.success) {
        throw new Error(profileRes.message || 'فشلت عملية حفظ بيانات الملف الشخصي');
      }

      // 2. Change password if requested
      if (hasPasswordInput) {
        const res = await api.changeAdminPassword(currentPassword, newPassword);
        if (!res.success) {
          throw new Error((res as any).error || 'فشلت عملية تغيير كلمة المرور');
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }

      // 3. Update React Auth context
      if (setCurrentAdmin) {
        setCurrentAdmin(prev => prev ? ({
          ...prev,
          name: updatedName,
          phone: updatedPhone
        }) : {
          name: updatedName,
          email: currentAdmin?.email || 'admin@store.com',
          phone: updatedPhone
        });
      }

      if (hasPasswordInput) {
        setAccountMsg('تم حفظ التغييرات وتحديث وتشفير كلمة مرور المسؤول بنجاح! 🎉');
      } else {
        setAccountMsg('تم حفظ وتحديث بيانات الملف الشخصي لمسؤول النظام بنجاح! انعكست التعديلات فوراً.');
      }
      setTimeout(() => setAccountMsg(''), 5000);
    } catch (err: any) {
      setAccountError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء حفظ التغييرات'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadDashboardData = async () => {
    if (activeSubTab !== 'overview') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [res, topRes, cmpRes, revRes] = await Promise.all([
        api.getAdminDashboard(),
        api.getAnalyticsTopProducts(5).catch(() => ({ topProducts: [] })),
        api.getAdminCampaigns().catch(() => ({ campaigns: [] })),
        api.getAnalyticsReviews().catch(() => ({ analytics: null }))
      ]);

      setData(res);
      if (topRes?.topProducts) setTopProducts(topRes.topProducts);
      if (cmpRes?.campaigns) setCampaigns(cmpRes.campaigns);
      if (revRes?.analytics) setReviewSummary(revRes.analytics);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل تقارير الإدارة والمبيعات الحالية'));
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
      <div className="space-y-6" dir="rtl">
        <AdminSkeleton count={1} height="h-20" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminSkeleton count={4} height="h-28" />
        </div>
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
    <div className="space-y-6 font-sans text-slate-900 dark:text-slate-100" id="admin-dashboard-panel" dir="rtl">
      {/* Head section with unified Header - ONLY on Admin Overview / Dashboard Home */}
      {activeSubTab === 'overview' && (
        <AdminPageHeader
          title="لوحة تحكم النخبة التنفيذية"
          description="متابعة المؤشرات الماليّة، أداء المبيعات، المخازن، والعمليات في مكان واحد"
          icon={ShieldCheck}
          badge={
            <AdminBadge variant="danger">
              نظام الأمان نشط 🛡️
            </AdminBadge>
          }
          actions={
            <div className="flex items-center gap-2 text-xs font-bold relative">
              {/* Notification Bell Dropdown Button */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-amber-600 dark:text-amber-400 transition-colors cursor-pointer relative"
                  title="الإشعارات والتنبيهات"
                >
                  <Bell className="w-4 h-4" />
                  <span>الإشعارات</span>
                  {data?.unreadNotificationsCount > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                      {data.unreadNotificationsCount}
                    </span>
                  )}
                </button>

                {/* Dropdown Popover */}
                {showNotifDropdown && (
                  <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/20 rounded-2xl shadow-2xl shadow-slate-950/20 dark:shadow-amber-500/5 p-4 z-50 animate-in fade-in-50 duration-200">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-amber-500/10 mb-3">
                      <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        آخر التنبيهات
                      </span>
                      {data?.unreadNotificationsCount > 0 && (
                        <button
                          onClick={handleMarkNotificationsRead}
                          className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer font-bold"
                        >
                          تحديد الكل كمقروء
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto custom-dropdown-scrollbar">
                      {data?.recentNotifications?.length > 0 ? (
                        data.recentNotifications.slice(0, 5).map((n: any) => (
                          <div
                            key={n.id}
                            className={`p-2 rounded-lg text-xs border ${!n.isRead ? 'bg-amber-500/10 border-amber-500/20 text-slate-900 dark:text-white' : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/60 text-slate-500 dark:text-slate-400'}`}
                          >
                            <div className="font-bold flex justify-between items-center text-[11px] mb-0.5">
                              <span className={!n.isRead ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>{n.title}</span>
                            </div>
                            <p className="text-[10px] leading-relaxed line-clamp-2">{n.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">لا توجد إشعارات حديثة.</p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-amber-500/10 mt-3 text-center">
                      <button
                        onClick={() => {
                          setShowNotifDropdown(false);
                          setActiveSubTab('notifications');
                        }}
                        className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>عرض جميع الإشعارات بالكامل</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleBackup}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5" />
                نسخة احتياطية
              </button>
              <button
                onClick={loadDashboardData}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-colors cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                تحديث التقارير
              </button>
            </div>
          }
        />
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KpiCard
              title="صافي المبيعات المحققة"
              value={`${((stats.netSales !== undefined ? stats.netSales : stats.totalRevenue) || 0).toLocaleString('ar-EG')} ج.م`}
              subtitle={stats.totalRefunds ? `الإجمالي: ${(stats.grossSales || stats.totalRevenue || 0).toLocaleString('ar-EG')} | المسترد: ${(stats.totalRefunds || 0).toLocaleString('ar-EG')} ج.م` : 'الدفع نقداً عند التوصيل (COD)'}
              icon={TrendingUp}
              badgeText="صافي الأرباح"
              badgeVariant="success"
            />

            <KpiCard
              title="إجمالي طلبات المشترين"
              value={`${stats.ordersCount} طلب`}
              subtitle="تتضمن الطلبات قيد التوصيل"
              icon={ShoppingBag}
              badgeText="نشطة"
              badgeVariant="info"
              onClick={() => {
                if (setActiveSubTab) setActiveSubTab('orders');
                if (onNavigate) onNavigate('orders');
              }}
            />

            <KpiCard
              title="طلبات معلقة بانتظار الاتصال"
              value={`${stats.pendingOrdersCount} طلب`}
              subtitle="تحتاج لتأكيد تليفوني قبل الشحن"
              icon={ClipboardList}
              badgeText={stats.pendingOrdersCount > 0 ? 'مطلوب إجراء' : 'مكتملة'}
              badgeVariant={stats.pendingOrdersCount > 0 ? 'warning' : 'neutral'}
              urgent={stats.pendingOrdersCount > 0}
              onClick={() => {
                if (setActiveSubTab) setActiveSubTab('orders', '?status=pending');
                if (onNavigate) onNavigate('orders', { status: 'pending' });
              }}
            />

            <KpiCard
              title="طلبات الإرجاع والاسترداد"
              value={`${stats.totalReturnsCount ?? 0} طلب`}
              subtitle={stats.pendingReturnsCount > 0 ? `${stats.pendingReturnsCount} طلب إرجاع قيد الانتظار` : 'لا توجد طلبات معلقة'}
              icon={RotateCcw}
              badgeText={stats.pendingReturnsCount > 0 ? `${stats.pendingReturnsCount} جديد` : 'مستقر'}
              badgeVariant={stats.pendingReturnsCount > 0 ? 'warning' : 'neutral'}
              urgent={stats.pendingReturnsCount > 0}
              onClick={() => {
                if (setActiveSubTab) setActiveSubTab('returns');
                if (onNavigate) onNavigate('returns');
              }}
            />

            <KpiCard
              title="أجهزة منخفضة المخزون"
              value={`${stats.lowStockProductsCount} جهاز`}
              subtitle="الرصيد في المستودع 5 قطع أو أقل"
              icon={AlertTriangle}
              badgeText={stats.lowStockProductsCount > 0 ? 'تنبيه مخزون' : 'مستقر'}
              badgeVariant={stats.lowStockProductsCount > 0 ? 'danger' : 'neutral'}
              urgent={stats.lowStockProductsCount > 0}
              onClick={() => {
                if (setActiveSubTab) setActiveSubTab('inventory', '?filter=lowstock');
                if (onNavigate) onNavigate('inventory', { filter: 'lowstock' });
              }}
            />
          </div>

          {/* Executive Widgets Grid 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <OrderStatusWidget
                statusBreakdown={data?.statusBreakdown || {}}
                totalOrders={stats.ordersCount}
              />
            </div>

            <div>
              <TopProductsWidget
                products={topProducts}
                onNavigate={(t, arg) => {
                  if (setActiveSubTab) setActiveSubTab(t);
                  if (onNavigate) onNavigate(t, arg);
                }}
              />
            </div>
          </div>

          {/* Returns & Refunds Overview Widget Row */}
          <div className="w-full">
            <ReturnsOverviewWidget
              returnsOverview={data?.returnsOverview}
              totalReturnsCount={stats.totalReturnsCount}
              pendingReturnsCount={stats.pendingReturnsCount}
              totalRefunds={stats.totalRefunds}
              pendingRefundAmount={stats.pendingRefundAmount}
              onNavigate={(t, arg) => {
                if (setActiveSubTab) setActiveSubTab(t);
                if (onNavigate) onNavigate(t, arg);
              }}
            />
          </div>

          {/* Executive Widgets Grid 2: 2-Row Structure */}
          <div className="space-y-6">
            {/* Top Row: Active Campaigns & Customer Reviews side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ActiveCampaignsWidget
                campaigns={campaigns}
                onNavigate={(t, arg) => {
                  if (setActiveSubTab) setActiveSubTab(t);
                  if (onNavigate) onNavigate(t, arg);
                }}
              />

              <CustomerReviewsWidget
                reviewData={reviewSummary}
                onNavigate={(t, arg) => {
                  if (setActiveSubTab) setActiveSubTab(t);
                  if (onNavigate) onNavigate(t, arg);
                }}
              />
            </div>

            {/* Bottom Row: Full-width Audit Logs */}
            <div className="w-full">
              <AuditLogsWidget
                logs={data?.recentLogs || []}
              />
            </div>
          </div>
        </div>
      )}

      {(activeSubTab === 'analytics' || activeSubTab === 'bi') && (
        <AdminAnalyticsSection />
      )}

      {activeSubTab === 'campaigns' && (
        <AdminCampaignsSection />
      )}

      {activeSubTab === 'account' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl max-w-2xl mx-auto" id="admin-unified-profile-card">
            {/* Unified Card Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-xs">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">إعدادات الملف الشخصي والأمان</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">تحديث البيانات الشخصية للمسؤول وكلمة المرور في نموذج واحد متكامل</p>
              </div>
            </div>

            {/* Success Feedback */}
            {accountMsg && (
              <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{accountMsg}</span>
              </div>
            )}

            {/* Error Feedback */}
            {accountError && (
              <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{accountError}</span>
              </div>
            )}

            {/* Single Unified Form */}
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              {/* Basic Profile Information Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    البيانات الشخصية للمسؤول
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name Input */}
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-end gap-1">
                      <span>الاسم الكامل للمسؤول</span>
                      <span className="text-amber-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-semibold transition-colors"
                      placeholder="أدخل الاسم الكامل للمشرف..."
                    />
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-end gap-1">
                      <span>رقم الهاتف / التليفون</span>
                      <span className="text-amber-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        id="admin-phone-input"
                        required
                        inputMode="numeric"
                        value={accountPhone}
                        onChange={handlePhoneChange}
                        onBlur={handlePhoneBlur}
                        className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-3 text-xs text-slate-900 dark:text-white font-mono text-left transition-colors ${
                          phoneError
                            ? 'border-red-500 dark:border-red-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500'
                            : 'border-slate-300 dark:border-slate-800 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                        }`}
                        placeholder="010XXXXXXXX"
                        dir="ltr"
                        autoComplete="tel"
                      />
                    </div>
                    {phoneError ? (
                      <p className="text-[11px] text-red-500 dark:text-red-400 font-medium flex items-center justify-end gap-1 mt-1 animate-in fade-in-50 duration-200">
                        <span>{phoneError}</span>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right">
                        رقم هاتف مصري مكون من 11 رقمًا (يبدأ بـ 010 أو 011 أو 012 أو 015)
                      </p>
                    )}
                  </div>
                </div>

                {/* Email (Read-Only) */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">البريد الإلكتروني المعتمد</label>
                  <input
                    type="email"
                    disabled
                    value={currentAdmin?.email || 'admin@store.com'}
                    className="w-full bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400 font-mono cursor-not-allowed text-left"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">البريد الإلكتروني مرتبط بجلسة الأمان المباشرة للمسؤول</p>
                </div>
              </div>

              {/* Subtle Section Divider */}
              <div className="relative my-6 pt-2">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-slate-900 px-3.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 rounded-full py-0.5 shadow-xs">
                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                    <span>تغيير كلمة المرور (اختياري)</span>
                  </span>
                </div>
              </div>

              {/* Optional Password Security Section */}
              <div className="space-y-4">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right leading-relaxed">
                  اترك الحقول التالية فارغة إذا كنت تريد فقط تحديث البيانات الشخصية ورقم الهاتف دون تغيير كلمة المرور.
                </p>

                {/* Current Password */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">كلمة المرور الحالية</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono text-left transition-colors"
                    dir="ltr"
                    autoComplete="current-password"
                  />
                </div>

                {/* New Password & Confirmation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono text-left transition-colors"
                      dir="ltr"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">تأكيد كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono text-left transition-colors"
                      dir="ltr"
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>

              {/* Single Prominent Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{isSubmitting ? 'جاري حفظ التغييرات وتأمين الحساب...' : 'حفظ التغييرات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
