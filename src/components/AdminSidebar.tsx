import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, Package, Image, FileText, ShoppingCart,
  Boxes, Truck, FileCheck, Ticket, Sparkles, MapPin, Users,
  BarChart3, Settings, Bell, LogOut, ChevronLeft, ChevronRight,
  ShieldCheck, Menu, X, Home, Star, User, RotateCcw
} from 'lucide-react';
import { CurrentAdmin } from '../types.js';
import { useAdminAuth } from '../context/AdminAuthContext.js';
import { ThemeToggle } from './ThemeToggle.js';

interface AdminSidebarProps {
  activeSubTab: string;
  setActiveSubTab: (subTab: string) => void;
  onLogoutRequest: () => void;
  onNavigate: (tab: string, arg?: any) => void;
  pendingOrdersCount?: number;
  adminInfo?: CurrentAdmin | null;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function AdminSidebar({
  activeSubTab,
  setActiveSubTab,
  onLogoutRequest,
  onNavigate,
  pendingOrdersCount = 0,
  adminInfo
}: AdminSidebarProps) {
  const { adminUser } = useAdminAuth();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [fetchedAdmin, setFetchedAdmin] = useState<CurrentAdmin | null>(null);

  useEffect(() => {
    if (!adminInfo && !adminUser) {
      // Try to fetch admin info if token exists
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
      if (token) {
        fetch('/api/admin/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.admin) {
              setFetchedAdmin(data.admin);
            }
          })
          .catch(() => {});
      }
    }
  }, [adminInfo, adminUser]);

  const currentAdmin = adminInfo || adminUser || fetchedAdmin;
  const adminDisplayName = currentAdmin?.name || 'مدير النظام';
  const adminDisplayEmail = currentAdmin?.email || 'admin@store.com';
  const adminInitials = adminDisplayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('') || 'أ';

  useEffect(() => {
    try {
      localStorage.setItem('admin_sidebar_collapsed', String(collapsed));
    } catch (e) {
      console.error(e);
    }
  }, [collapsed]);

  const isSuperAdminUser = (admin: CurrentAdmin | null) => {
    if (!admin) return false;
    if (admin.roleId === 'role-super-admin') return true;
    if (admin.role && (admin.role.toLowerCase().includes('super admin') || admin.role.toLowerCase() === 'admin' || admin.role.includes('الأعلى'))) return true;
    if (Array.isArray(admin.permissions) && (admin.permissions.includes('*') || admin.permissions.includes('all'))) return true;
    return false;
  };

  const hasPermissionForItem = (itemId: string, admin: CurrentAdmin | null) => {
    if (!admin) return false;
    if (isSuperAdminUser(admin)) return true;

    // Profile / Account and notifications are always accessible to any authenticated admin
    if (itemId === 'account' || itemId === 'profile' || itemId === 'notifications') return true;

    const perms = Array.isArray(admin.permissions) ? admin.permissions : [];
    if (perms.length === 0) return false;

    switch (itemId) {
      case 'overview':
        return perms.includes('analytics.view');
      case 'products':
        return perms.some((p: string) => p.startsWith('products.'));
      case 'media':
        return perms.includes('media.manage');
      case 'cms':
        return perms.includes('settings.manage');
      case 'orders':
        return perms.some((p: string) => p.startsWith('orders.'));
      case 'returns':
        return perms.includes('returns.view') || perms.includes('returns.manage') || perms.some((p: string) => p.startsWith('orders.'));
      case 'inventory':
      case 'inventory-pro':
      case 'suppliers':
      case 'purchase_orders':
        return perms.includes('inventory.view') || perms.includes('inventory.manage');
      case 'coupons':
      case 'campaigns':
        return perms.includes('campaigns.manage');
      case 'shipping':
      case 'cleanup':
        return perms.includes('settings.manage');
      case 'customers':
        return perms.includes('customers.view') || perms.includes('customers.edit');
      case 'reviews':
        return perms.includes('reviews.manage');
      case 'bi':
      case 'analytics':
        return perms.includes('analytics.view');
      case 'rbac':
        return perms.includes('admins.manage');
      default:
        return true;
    }
  };

  const groups: NavGroup[] = useMemo(() => [
    {
      title: 'إدارة المتجر',
      items: [
        { id: 'overview', label: 'الرئيسية', icon: LayoutDashboard },
        { id: 'products', label: 'المنتجات والأجهزة', icon: Package },
        { id: 'media', label: 'مكتبة الوسائط', icon: Image },
        { id: 'cms', label: 'محتوى المتجر (CMS)', icon: FileText }
      ]
    },
    {
      title: 'المبيعات والمخزون',
      items: [
        {
          id: 'orders',
          label: 'الطلبات والفواتير',
          icon: ShoppingCart,
          badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined
        },
        { id: 'returns', label: 'إدارة مرتجعات المنتجات', icon: RotateCcw },
        { id: 'inventory', label: 'المخزون (Inventory Pro)', icon: Boxes },
        { id: 'suppliers', label: 'إدارة الموردين', icon: Truck },
        { id: 'purchase_orders', label: 'أوامر الشراء', icon: FileCheck },
        { id: 'coupons', label: 'الكوبونات', icon: Ticket },
        { id: 'campaigns', label: 'الحملات والعروض', icon: Sparkles },
        { id: 'shipping', label: 'أسعار الشحن', icon: MapPin }
      ]
    },
    {
      title: 'العملاء',
      items: [
        { id: 'customers', label: 'إدارة العملاء', icon: Users },
        { id: 'reviews', label: 'مراجعات وتقييمات العملاء', icon: Star }
      ]
    },
    {
      title: 'التقارير',
      items: [
        { id: 'bi', label: 'التحليلات (BI)', icon: BarChart3 }
      ]
    },
    {
      title: 'النظام',
      items: [
        { id: 'account', label: 'الملف الشخصي / حسابي', icon: User },
        { id: 'rbac', label: 'المستخدمون والصلاحيات', icon: ShieldCheck },
        { id: 'cleanup', label: 'تهيئة المتجر للإطلاق', icon: Settings },
        { id: 'notifications', label: 'الإشعارات', icon: Bell }
      ]
    }
  ], [pendingOrdersCount]);

  const visibleGroups = useMemo(() => {
    return groups
      .map(group => ({
        ...group,
        items: group.items.filter(item => hasPermissionForItem(item.id, currentAdmin))
      }))
      .filter(group => group.items.length > 0);
  }, [groups, currentAdmin]);

  const isItemActive = (itemId: string) => {
    if (itemId === 'bi' && (activeSubTab === 'bi' || activeSubTab === 'analytics')) return true;
    if (itemId === 'inventory' && (activeSubTab === 'inventory' || activeSubTab === 'inventory-pro')) return true;
    return activeSubTab === itemId;
  };

  const handleSelectTab = (tabId: string) => {
    setActiveSubTab(tabId);
    setMobileOpen(false);
  };

  const activeItemLabel = groups
    .flatMap(g => g.items)
    .find(i => isItemActive(i.id))?.label || 'لوحة الإدارة';

  return (
    <>
      {/* Mobile Top Header Toggle Bar (Visible only on < lg screens) */}
      <div className="lg:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 mb-4 flex items-center justify-between text-slate-900 dark:text-white shadow-sm dark:shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
            title="افتح القائمة"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">قسم الإدارة الحالي</div>
            <div className="text-sm font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span>{activeItemLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('home')}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            title="الرجوع للمتجر"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            onClick={onLogoutRequest}
            className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs lg:hidden animate-in fade-in-50 duration-200"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 shadow-2xl flex flex-col justify-between overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile Drawer Top Header */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">لوحة الإدارة النخبة</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">نظام إدارة المتجر</p>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items in Drawer */}
              <div className="space-y-5">
                {visibleGroups.map((group, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider px-2 pb-1 text-right">
                      {group.title}
                    </div>
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const active = isItemActive(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            active
                              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-slate-950' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </div>
                          {item.badge !== undefined && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-slate-950 text-amber-400' : 'bg-rose-600 text-white'}`}>
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Profile & Logout in Mobile Drawer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-6 space-y-3">
              {/* Theme Switcher in Mobile Drawer */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">مظهر لوحة التحكم</span>
                <ThemeToggle variant="admin" showLabel />
              </div>

              <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                <div className="relative w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                  {adminInitials}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"></span>
                </div>
                <div className="min-w-0 text-right flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{adminDisplayName}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded font-bold truncate max-w-[140px]">
                      {currentAdmin?.role || 'مشرف'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onLogoutRequest}
                  className="flex-1 py-2 px-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل الخروج</span>
                </button>
                <button
                  onClick={() => onNavigate('home')}
                  className="py-2 px-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
                  title="العودة للمتجر"
                >
                  <Home className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Left Sidebar (Visible on lg+ screens) */}
      <aside
        className={`hidden lg:flex flex-col justify-between bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-2xl transition-all duration-300 sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto shrink-0 select-none ${
          collapsed ? 'w-20' : 'w-64'
        }`}
        id="admin-desktop-sidebar"
      >
        <div>
          {/* Top Brand & Collapse Toggle */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
            {!collapsed ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 text-right">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">النخبة الفنية</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">لوحة تحكم المتجر</p>
                </div>
              </div>
            ) : (
              <div className="mx-auto p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500" title="لوحة تحكم المتجر">
                <ShieldCheck className="w-5 h-5" />
              </div>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shrink-0"
              title={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
            >
              {collapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Items Grouped */}
          <div className="space-y-4">
            {visibleGroups.map((group, idx) => (
              <div key={idx} className="space-y-1">
                {!collapsed && (
                  <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider px-3 pb-1 text-right">
                    {group.title}
                  </div>
                )}
                {group.items.map(item => {
                  const Icon = item.icon;
                  const active = isItemActive(item.id);

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-2.5 text-right'
                      } rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-slate-950' : 'text-slate-400'}`} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {item.badge !== undefined && (
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                            active ? 'bg-slate-950 text-amber-400' : 'bg-rose-600 text-white'
                          } ${collapsed ? 'absolute -top-1 -right-1' : ''}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Area: Admin Profile & Logout */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 mt-6 space-y-3">
          {!collapsed ? (
            <>
              {/* Theme Toggle Pill in Sidebar */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">المظهر</span>
                <ThemeToggle variant="admin" showLabel />
              </div>

              {/* Profile Card */}
              <div
                onClick={() => handleSelectTab('account')}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition-colors cursor-pointer"
                title="تعديل الملف الشخصي"
              >
                <div className="relative w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center shrink-0">
                  {adminInitials}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-950"></span>
                </div>
                <div className="min-w-0 text-right flex-1">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{adminDisplayName}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded font-bold truncate max-w-[140px]">
                      {currentAdmin?.role || 'مشرف'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={onLogoutRequest}
                  className="flex-1 py-2 px-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل الخروج</span>
                </button>
                <button
                  onClick={() => onNavigate('home')}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                  title="العودة للواجهة الرئيسية"
                >
                  <Home className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => handleSelectTab('account')}
                className="relative w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center cursor-pointer hover:border-amber-500 transition-colors"
                title="تعديل الملف الشخصي"
              >
                {adminInitials}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-950"></span>
              </button>
              <ThemeToggle variant="compact" />
              <button
                onClick={onLogoutRequest}
                className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl transition-colors cursor-pointer"
                title="تسجيل الخروج الأمن"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('home')}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
                title="العودة للواجهة الرئيسية"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
