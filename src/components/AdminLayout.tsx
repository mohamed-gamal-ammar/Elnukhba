import React, { useState, Suspense, lazy } from 'react';
import {
  ShieldCheck,
  Lock,
  LogOut,
  Sparkles,
  Loader2
} from 'lucide-react';
import { CurrentAdmin } from '../types.js';
import { useAdminAuth, hasAdminTabPermission, getFirstAllowedAdminTab } from '../context/AdminAuthContext.js';
import { getFriendlyErrorMessage } from '../lib/api.js';
import AdminHeader from './AdminHeader.js';
import AdminSidebar from './AdminSidebar.js';

// Lazy loaded sub-panels
const AdminDashboard = lazy(() => import('./AdminDashboard.js'));
const AdminProducts = lazy(() => import('./AdminProducts.js'));
const AdminInventory = lazy(() => import('./AdminInventory.js'));
const AdminOrders = lazy(() => import('./AdminOrders.js'));
const AdminCoupons = lazy(() => import('./AdminCoupons.js'));
const AdminCampaignsSection = lazy(() => import('./AdminCampaignsSection.js'));
const AdminCMS = lazy(() => import('./AdminCMS.js'));
const AdminShipping = lazy(() => import('./AdminShipping.js'));
const AdminCleanup = lazy(() => import('./AdminCleanup.js'));
const AdminMediaLibrary = lazy(() => import('./AdminMediaLibrary.js'));
const AdminCustomers = lazy(() => import('./AdminCustomers.js'));
const AdminReviews = lazy(() => import('./AdminReviews.js'));
const AdminSuppliers = lazy(() => import('./AdminSuppliers.js'));
const AdminPurchaseOrders = lazy(() => import('./AdminPurchaseOrders.js'));
const AdminUsersPermissions = lazy(() => import('./AdminUsersPermissions.js'));
const AdminNotifications = lazy(() => import('./AdminNotifications.js'));
const AdminAnalyticsBI = lazy(() => import('./AdminAnalyticsBI.js'));
const AdminReturns = lazy(() => import('./AdminReturns.js'));

function LoaderFallback() {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 dark:text-slate-400 space-y-3">
      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      <span className="text-xs font-bold">جاري تحميل بيانات لوحة التحكم...</span>
    </div>
  );
}

interface AdminLayoutProps {
  adminSubTab: string;
  setAdminSubTab: (subTab: string) => void;
  onNavigate: (tab: string, arg?: any) => void;
  onRefreshAll: () => Promise<boolean | void>;
  showAdminLogoutConfirm: boolean;
  setShowAdminLogoutConfirm: (show: boolean) => void;
  onAdminLogout: () => Promise<void>;
}

export default function AdminLayout({
  adminSubTab,
  setAdminSubTab,
  onNavigate,
  onRefreshAll,
  showAdminLogoutConfirm,
  setShowAdminLogoutConfirm,
  onAdminLogout
}: AdminLayoutProps) {
  const { adminUser, isAdminLoggedIn, loginAdmin, setAdminUser } = useAdminAuth();

  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleAdminSubTabChange = (sub: string, queryParams?: string) => {
    setAdminSubTab(sub);
    const urlMap: Record<string, string> = {
      overview: '/admin/dashboard',
      products: '/admin/products',
      orders: '/admin/orders',
      returns: '/admin/returns',
      inventory: '/admin/inventory',
      suppliers: '/admin/suppliers',
      purchase_orders: '/admin/purchase-orders',
      campaigns: '/admin/campaigns',
      coupons: '/admin/coupons',
      shipping: '/admin/shipping',
      cleanup: '/admin/cleanup',
      bi: '/admin/bi',
      analytics: '/admin/bi',
      media: '/admin/media',
      customers: '/admin/customers',
      reviews: '/admin/reviews',
      rbac: '/admin/rbac',
      notifications: '/admin/notifications',
      account: '/admin/account',
      profile: '/admin/account',
      cms: '/admin/cms',
      'no-permission': '/admin'
    };
    let targetUrl = urlMap[sub] || '/admin/dashboard';
    if (queryParams) {
      targetUrl += queryParams.startsWith('?') ? queryParams : `?${queryParams}`;
    }
    window.history.pushState(null, '', targetUrl);
  };

  // Keep adminSubTab in sync with browser URL pathname
  React.useEffect(() => {
    const syncSubTabFromUrl = () => {
      const rawPath = window.location.pathname.split('?')[0].toLowerCase().replace(/\/$/, '') || '/';
      if (rawPath === '/admin/orders') setAdminSubTab('orders');
      else if (rawPath === '/admin/inventory') setAdminSubTab('inventory');
      else if (rawPath === '/admin/products') setAdminSubTab('products');
      else if (rawPath === '/admin/suppliers') setAdminSubTab('suppliers');
      else if (rawPath === '/admin/purchase-orders') setAdminSubTab('purchase_orders');
      else if (rawPath === '/admin/campaigns') setAdminSubTab('campaigns');
      else if (rawPath === '/admin/coupons') setAdminSubTab('coupons');
      else if (rawPath === '/admin/shipping') setAdminSubTab('shipping');
      else if (rawPath === '/admin/cleanup') setAdminSubTab('cleanup');
      else if (rawPath === '/admin/bi' || rawPath === '/admin/analytics') setAdminSubTab('bi');
      else if (rawPath === '/admin/media') setAdminSubTab('media');
      else if (rawPath === '/admin/customers') setAdminSubTab('customers');
      else if (rawPath === '/admin/reviews') setAdminSubTab('reviews');
      else if (rawPath === '/admin/rbac') setAdminSubTab('rbac');
      else if (rawPath === '/admin/notifications') setAdminSubTab('notifications');
      else if (rawPath === '/admin/account' || rawPath === '/admin/profile') setAdminSubTab('account');
      else if (rawPath === '/admin/cms') setAdminSubTab('cms');
      else if (rawPath === '/admin' || rawPath === '/admin/dashboard') setAdminSubTab('overview');
    };

    syncSubTabFromUrl();
    window.addEventListener('popstate', syncSubTabFromUrl);
    return () => window.removeEventListener('popstate', syncSubTabFromUrl);
  }, [setAdminSubTab]);

  // 1. Admin Login View when unauthenticated
  if (!isAdminLoggedIn) {
    return (
      <div
        className="min-h-screen bg-slate-900 dark:bg-slate-950 text-white flex flex-col justify-between py-12 px-4 select-none"
        dir="rtl"
        id="admin-login-portal"
      >
        <div className="max-w-md w-full mx-auto my-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 text-center shadow-2xl flex flex-col gap-6 text-slate-900 dark:text-white font-sans animate-in fade-in-50 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              بوابة مسؤول النظام 🛡️
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              يرجى إدخال بيانات الدخول المعتمدة للوصول الآمن إلى لوحة الإدارة والعمليات المركزية.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsLoggingIn(true);
              setAdminAuthError('');
              try {
                const res = await loginAdmin(adminEmailInput, adminPasswordInput);
                if (res && res.success) {
                  setAdminAuthError('');
                  setAdminEmailInput('');
                  setAdminPasswordInput('');
                  await onRefreshAll();

                  const initialTab = getFirstAllowedAdminTab(res.admin);
                  handleAdminSubTabChange(initialTab);
                } else {
                  setAdminAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
                }
              } catch (err: any) {
                setAdminAuthError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء الاتصال بالخادم.'));
              } finally {
                setIsLoggingIn(false);
              }
            }}
            className="space-y-4 text-right"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                البريد الإلكتروني <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={adminEmailInput}
                onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="admin@store.com"
                className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-center font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                كلمة المرور <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-center font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
              />
            </div>

            {adminAuthError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
                ⚠️ {adminAuthError}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>تسجيل الدخول للمستودع الآمن</span>
              )}
            </button>
          </form>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col gap-2.5">
            <span className="text-[10px] text-slate-500 font-bold">
              البيانات الافتراضية:{' '}
              <code className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded font-mono">
                admin@store.com
              </code>{' '}
              /{' '}
              <code className="text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded font-mono">
                Admin@123456
              </code>
            </span>
            <button
              onClick={() => onNavigate('home')}
              className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              الرجوع للواجهة الرئيسية للمتجر
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-400">
          نظام الإدارة والتحكم المركزي المعتمد • جميع الحقوق محفوظة
        </div>
      </div>
    );
  }

  // 2. Authenticated Admin Dashboard Workspace with dedicated AdminHeader & AdminSidebar
  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors"
      dir="rtl"
      id="admin-workspace-root"
    >
      {/* Top Admin Header */}
      <AdminHeader
        activeSubTab={adminSubTab}
        setActiveSubTab={handleAdminSubTabChange}
        onLogoutRequest={() => setShowAdminLogoutConfirm(true)}
        onNavigate={onNavigate}
        onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      {/* Main Admin Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Admin Sidebar Navigation */}
          <AdminSidebar
            activeSubTab={adminSubTab}
            setActiveSubTab={handleAdminSubTabChange}
            onLogoutRequest={() => setShowAdminLogoutConfirm(true)}
            onNavigate={onNavigate}
            adminInfo={adminUser}
          />

          {/* Admin Workspace Content */}
          <div className="flex-1 w-full min-w-0">
            <Suspense fallback={<LoaderFallback />}>
              {!hasAdminTabPermission(adminSubTab, adminUser) ? (
                <div
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 md:p-12 text-center shadow-xl flex flex-col items-center gap-5 max-w-lg mx-auto my-12"
                  id="admin-access-guard"
                >
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                    <Lock className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">
                      ليس لديك صلاحية للوصول إلى هذه الصفحة
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                      دورك الحالي ({adminUser?.role || 'مشرف'}) لا يمتلك الصلاحيات الكافية لعرض هذا القسم ({adminSubTab}).
                    </p>
                  </div>
                  {getFirstAllowedAdminTab(adminUser) !== 'no-permission' ? (
                    <button
                      onClick={() => handleAdminSubTabChange(getFirstAllowedAdminTab(adminUser))}
                      className="py-2.5 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      الانتقال إلى أول قسم مصرح لك به
                    </button>
                  ) : (
                    <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 font-bold">
                      ⚠️ لا توجد أقسام إدارية مخصصة لحسابك حالياً. يرجى مراجعة المسؤول الرئيسي (Super Admin).
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {['overview', 'account'].includes(adminSubTab) && (
                    <AdminDashboard
                      onNavigate={onNavigate}
                      onRefreshProducts={onRefreshAll}
                      activeSubTab={adminSubTab}
                      setActiveSubTab={handleAdminSubTabChange}
                      currentAdmin={adminUser}
                      setCurrentAdmin={setAdminUser}
                    />
                  )}

                  {adminSubTab === 'campaigns' && <AdminCampaignsSection />}

                  {adminSubTab === 'products' && <AdminProducts onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'inventory' && <AdminInventory onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'suppliers' && <AdminSuppliers onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'purchase_orders' && <AdminPurchaseOrders onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'orders' && <AdminOrders onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'returns' && <AdminReturns onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'cms' && <AdminCMS onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'coupons' && <AdminCoupons onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'shipping' && <AdminShipping onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'cleanup' && <AdminCleanup onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'bi' && <AdminAnalyticsBI onRefreshAll={onRefreshAll} />}

                  {adminSubTab === 'media' && <AdminMediaLibrary />}

                  {adminSubTab === 'customers' && <AdminCustomers />}

                  {adminSubTab === 'reviews' && <AdminReviews />}

                  {adminSubTab === 'rbac' && (
                    <AdminUsersPermissions currentAdmin={adminUser} setCurrentAdmin={setAdminUser} />
                  )}

                  {adminSubTab === 'notifications' && (
                    <AdminNotifications setActiveSubTab={handleAdminSubTabChange} onRefreshAll={onRefreshAll} />
                  )}
                </>
              )}
            </Suspense>
          </div>
        </div>
      </main>

      {/* Admin Logout Confirmation Modal */}
      {showAdminLogoutConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-50 duration-200"
          id="admin-logout-modal"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4 text-slate-900 dark:text-white">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">هل تريد تسجيل الخروج؟</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                سيتم إنهاء جلسة الإدارة والعودة إلى متجر الزوار.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full mt-2">
              <button
                onClick={async () => {
                  setShowAdminLogoutConfirm(false);
                  await onAdminLogout();
                }}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
              >
                تأكيد الخروج
              </button>
              <button
                onClick={() => setShowAdminLogoutConfirm(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
