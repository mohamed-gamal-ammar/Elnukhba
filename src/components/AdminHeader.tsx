import React, { useState } from 'react';
import {
  ShieldCheck,
  Bell,
  Home,
  LogOut,
  User,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Menu
} from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext.js';
import { ThemeToggle } from './ThemeToggle.js';

interface AdminHeaderProps {
  activeSubTab: string;
  setActiveSubTab: (subTab: string) => void;
  onLogoutRequest: () => void;
  onNavigate: (tab: string, arg?: any) => void;
  onToggleMobileSidebar?: () => void;
}

const TAB_TITLES: Record<string, { title: string; category: string }> = {
  overview: { title: 'لوحة المؤشرات والعمليات', category: 'الرئيسية' },
  products: { title: 'إدارة المنتجات والمواصفات', category: 'الكتالوج' },
  media: { title: 'مكتبة الوسائط والصور', category: 'الكتالوج' },
  cms: { title: 'محتوى وبنرات المتجر (CMS)', category: 'الواجهة' },
  orders: { title: 'إدارة ومتابعة طلبات الشراء', category: 'المبيعات' },
  inventory: { title: 'المخزون وجرد الأجهزة (Inventory Pro)', category: 'المستودع' },
  'inventory-pro': { title: 'المخزون وجرد الأجهزة (Inventory Pro)', category: 'المستودع' },
  suppliers: { title: 'إدارة الموردين والشركاء', category: 'المستودع' },
  purchase_orders: { title: 'أوامر الشراء والتوريد', category: 'المستودع' },
  coupons: { title: 'كوبونات الخصم وقسائم الشراء', category: 'التسويق' },
  campaigns: { title: 'الحملات الترويجية والعروض', category: 'التسويق' },
  shipping: { title: 'إعدادات وأسعار الشحن للمحافظات', category: 'اللوجستيات' },
  cleanup: { title: 'تهيئة وإطلاق المتجر', category: 'النظام' },
  bi: { title: 'تحليلات ذكاء الأعمال المتقدمة (BI)', category: 'التقارير' },
  analytics: { title: 'التقارير الإحصائية والتحليلات', category: 'التقارير' },
  customers: { title: 'دليل وحسابات العملاء', category: 'العملاء' },
  reviews: { title: 'مراجعات وتقييمات المنتجات', category: 'العملاء' },
  rbac: { title: 'المستخدمون والصلاحيات (RBAC)', category: 'الأمان' },
  notifications: { title: 'مركز التنبيهات والإشعارات', category: 'النظام' },
  account: { title: 'الملف الشخصي والحساب الإداري', category: 'حسابي' }
};

export default function AdminHeader({
  activeSubTab,
  setActiveSubTab,
  onLogoutRequest,
  onNavigate,
  onToggleMobileSidebar
}: AdminHeaderProps) {
  const { adminUser, unreadNotificationsCount } = useAdminAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const adminDisplayName = adminUser?.name || 'مسؤول النظام';
  const adminDisplayEmail = adminUser?.email || 'admin@store.com';
  const adminRole = adminUser?.role || 'مسؤول معتمد';

  const adminInitials = adminDisplayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('') || 'م';

  const tabInfo = TAB_TITLES[activeSubTab] || {
    title: 'لوحة الإدارة التنفيذية',
    category: 'النظام'
  };

  return (
    <header
      className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 transition-colors"
      dir="rtl"
      id="admin-top-header"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-4">
        {/* Left: Mobile trigger & Active Route title */}
        <div className="flex items-center gap-3 min-w-0">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="القائمة الجانبية"
              aria-label="القائمة الجانبية"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {tabInfo.category}
                </span>
                <span className="hidden sm:inline-block text-[11px] text-slate-400 dark:text-slate-500">/</span>
                <h1 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                  {tabInfo.title}
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls, Theme Toggle, Profile and Logout */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Visit Store Button */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            title="الانتقال إلى واجهة متجر العملاء"
          >
            <Home className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">زيارة المتجر</span>
          </button>

          {/* Notifications Shortcut */}
          <button
            onClick={() => setActiveSubTab('notifications')}
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            title="مركز الإشعارات والتنبيهات"
            aria-label="مركز الإشعارات"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center font-mono">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <ThemeToggle variant="compact" />

          {/* Admin User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer text-right"
              id="admin-header-profile-btn"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-black flex items-center justify-center shrink-0">
                {adminInitials}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-black text-slate-900 dark:text-white leading-none">
                  {adminDisplayName}
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  {adminRole}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setProfileDropdownOpen(false)}
                />
                <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-3 z-40 animate-in fade-in-50 duration-150">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-800 text-right mb-2">
                    <p className="text-xs font-black text-slate-900 dark:text-white">{adminDisplayName}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">{adminDisplayEmail}</p>
                    <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 mt-1.5 border border-amber-500/20">
                      {adminRole}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      setActiveSubTab('account');
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-right cursor-pointer"
                  >
                    <User className="w-4 h-4 text-amber-500" />
                    <span>الملف الشخصي وكلمة المرور</span>
                  </button>

                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onNavigate('home');
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-right cursor-pointer"
                  >
                    <Home className="w-4 h-4 text-slate-500" />
                    <span>واجهة المتجر الرئيسية</span>
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1.5" />

                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      onLogoutRequest();
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-right cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>تسجيل الخروج الآمن</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
