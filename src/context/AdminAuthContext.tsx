import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { CurrentAdmin } from '../types.js';
import api, { getFriendlyErrorMessage } from '../lib/api.js';

// Dedicated storage keys strictly isolated for Admin domain
export const ADMIN_STORAGE_KEYS = {
  TOKEN: 'admin_token',
  USER: 'admin_user',
  AUTHENTICATED: 'admin_authenticated',
  SIDEBAR_COLLAPSED: 'admin_sidebar_collapsed'
} as const;

export interface AdminAuthContextType {
  adminUser: CurrentAdmin | null;
  adminToken: string | null;
  isAdminLoggedIn: boolean;
  isLoading: boolean;
  unreadNotificationsCount: number;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; token: string; admin: CurrentAdmin }>;
  logoutAdmin: () => Promise<void>;
  updateAdminProfile: (data: { name?: string; phone?: string; email?: string }) => Promise<void>;
  changeAdminPassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  refreshAdmin: () => Promise<void>;
  hasTabPermission: (subTab: string) => boolean;
  isSuperAdmin: boolean;
  getFirstAllowedTab: () => string;
  setAdminUser: React.Dispatch<React.SetStateAction<CurrentAdmin | null>>;
  setUnreadNotificationsCount: React.Dispatch<React.SetStateAction<number>>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

// RBAC Permission Helper Functions
export const isSuperAdminUser = (admin: CurrentAdmin | null): boolean => {
  if (!admin) return false;
  if (admin.roleId === 'role-super-admin') return true;
  if (admin.role && (admin.role.toLowerCase().includes('super admin') || admin.role.toLowerCase() === 'admin' || admin.role.includes('الأعلى'))) return true;
  if (Array.isArray(admin.permissions) && (admin.permissions.includes('*') || admin.permissions.includes('all'))) return true;
  return false;
};

export const hasAdminTabPermission = (subTab: string, admin: CurrentAdmin | null): boolean => {
  if (!admin) return false;
  if (isSuperAdminUser(admin)) return true;

  // Profile/Account and notifications are always accessible to any authenticated admin
  if (subTab === 'account' || subTab === 'profile' || subTab === 'notifications') return true;

  const perms = Array.isArray(admin.permissions) ? admin.permissions : [];
  if (perms.length === 0) return false;

  switch (subTab) {
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
      return false;
  }
};

export const getFirstAllowedAdminTab = (admin: CurrentAdmin | null): string => {
  if (!admin) return 'overview';
  if (isSuperAdminUser(admin)) return 'overview';

  const orderedSubTabs = [
    'overview',
    'products',
    'orders',
    'returns',
    'inventory',
    'suppliers',
    'purchase_orders',
    'campaigns',
    'coupons',
    'media',
    'cms',
    'shipping',
    'customers',
    'reviews',
    'bi',
    'rbac',
    'notifications',
    'account'
  ];

  for (const tab of orderedSubTabs) {
    if (hasAdminTabPermission(tab, admin)) {
      return tab;
    }
  }
  return 'account';
};

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<CurrentAdmin | null>(() => {
    try {
      const cached = sessionStorage.getItem(ADMIN_STORAGE_KEYS.USER) || localStorage.getItem(ADMIN_STORAGE_KEYS.USER);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached admin_user:', e);
    }
    return null;
  });

  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(ADMIN_STORAGE_KEYS.TOKEN) || localStorage.getItem(ADMIN_STORAGE_KEYS.TOKEN);
    } catch {
      return null;
    }
  });

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(() => {
    try {
      return (sessionStorage.getItem(ADMIN_STORAGE_KEYS.AUTHENTICATED) === 'true' || !!sessionStorage.getItem(ADMIN_STORAGE_KEYS.TOKEN) || !!localStorage.getItem(ADMIN_STORAGE_KEYS.TOKEN));
    } catch {
      return false;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);

  // Validate admin token against /api/admin/me on mount or token change
  const refreshAdmin = useCallback(async () => {
    const currentToken = sessionStorage.getItem(ADMIN_STORAGE_KEYS.TOKEN) || localStorage.getItem(ADMIN_STORAGE_KEYS.TOKEN);
    if (!currentToken) {
      setAdminUser(null);
      setAdminToken(null);
      setIsAdminLoggedIn(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.getAdminMe();
      if (res && res.admin) {
        const adminPhone = res.admin.phone || '';

        const adminObj: CurrentAdmin = {
          id: res.admin.id,
          name: res.admin.name || res.admin.email || 'أحمد الإدريسي',
          email: res.admin.email || 'admin@store.com',
          phone: adminPhone,
          role: res.admin.role,
          roleId: res.admin.roleId,
          permissions: res.admin.permissions || [],
          active: res.admin.active !== false
        };

        setAdminUser(adminObj);
        setAdminToken(currentToken);
        setIsAdminLoggedIn(true);

        try {
          sessionStorage.setItem(ADMIN_STORAGE_KEYS.AUTHENTICATED, 'true');
          sessionStorage.setItem(ADMIN_STORAGE_KEYS.TOKEN, currentToken);
          sessionStorage.setItem(ADMIN_STORAGE_KEYS.USER, JSON.stringify(adminObj));
          localStorage.setItem(ADMIN_STORAGE_KEYS.TOKEN, currentToken);
          localStorage.setItem(ADMIN_STORAGE_KEYS.USER, JSON.stringify(adminObj));
        } catch (e) {
          console.warn('Storage sync error:', e);
        }
      } else {
        throw new Error('Invalid admin payload');
      }
    } catch (err) {
      console.warn('Admin token validation failed or expired:', err);
      // Purge invalid admin session
      setAdminUser(null);
      setAdminToken(null);
      setIsAdminLoggedIn(false);
      try {
        sessionStorage.removeItem(ADMIN_STORAGE_KEYS.AUTHENTICATED);
        sessionStorage.removeItem(ADMIN_STORAGE_KEYS.TOKEN);
        sessionStorage.removeItem(ADMIN_STORAGE_KEYS.USER);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.TOKEN);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.USER);
      } catch {}
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAdmin();
  }, [refreshAdmin]);

  // Handle Admin Login
  const loginAdmin = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.loginAdmin(email, password);
      if (res && res.success && res.token) {
        const token = res.token;
        const adminPhone = res.admin?.phone || '';

        const adminObj: CurrentAdmin = {
          id: res.admin?.id,
          name: res.admin?.name || res.admin?.email || 'أحمد الإدريسي',
          email: res.admin?.email || email || 'admin@store.com',
          phone: adminPhone,
          role: res.admin?.role,
          roleId: res.admin?.roleId,
          permissions: res.admin?.permissions || [],
          active: true
        };

        // Write strictly to Admin storage keys
        try {
          sessionStorage.setItem(ADMIN_STORAGE_KEYS.AUTHENTICATED, 'true');
          sessionStorage.setItem(ADMIN_STORAGE_KEYS.TOKEN, token);
          sessionStorage.setItem(ADMIN_STORAGE_KEYS.USER, JSON.stringify(adminObj));
          localStorage.setItem(ADMIN_STORAGE_KEYS.TOKEN, token);
          localStorage.setItem(ADMIN_STORAGE_KEYS.USER, JSON.stringify(adminObj));
        } catch (storageErr) {
          console.warn('Failed to write admin storage keys:', storageErr);
        }

        setAdminToken(token);
        setAdminUser(adminObj);
        setIsAdminLoggedIn(true);

        return {
          success: true,
          token,
          admin: adminObj
        };
      }
      throw new Error('فشل تسجيل الدخول. يرجى التحقق من بياناتك.');
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err, 'فشل تسجيل الدخول كمسؤول. يرجى التحقق من البريد وكلمة المرور.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Admin Logout
  const logoutAdmin = async () => {
    try {
      const token = sessionStorage.getItem(ADMIN_STORAGE_KEYS.TOKEN) || localStorage.getItem(ADMIN_STORAGE_KEYS.TOKEN);
      if (token) {
        await api.logoutAdmin().catch(() => {});
      }
    } catch (e) {
      console.warn('Server admin logout error:', e);
    } finally {
      // Purge strictly Admin keys
      try {
        sessionStorage.removeItem(ADMIN_STORAGE_KEYS.AUTHENTICATED);
        sessionStorage.removeItem(ADMIN_STORAGE_KEYS.TOKEN);
        sessionStorage.removeItem(ADMIN_STORAGE_KEYS.USER);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.TOKEN);
        localStorage.removeItem(ADMIN_STORAGE_KEYS.USER);
      } catch (e) {}

      setAdminUser(null);
      setAdminToken(null);
      setIsAdminLoggedIn(false);
      setUnreadNotificationsCount(0);
    }
  };

  // Handle Admin Profile Update
  const updateAdminProfile = async (data: { name?: string; phone?: string; email?: string }) => {
    try {
      const res = await api.updateAdminProfile(data);
      if (res && res.admin) {
        const updatedPhone = res.admin.phone !== undefined ? res.admin.phone : (data.phone !== undefined ? data.phone : (adminUser?.phone || ''));
        const updated: CurrentAdmin = {
          ...(adminUser || { name: '', email: '' }),
          ...res.admin,
          phone: updatedPhone
        };
        setAdminUser(updated);
        try {
          sessionStorage.setItem(ADMIN_STORAGE_KEYS.USER, JSON.stringify(updated));
          localStorage.setItem(ADMIN_STORAGE_KEYS.USER, JSON.stringify(updated));
        } catch (e) {}
      }
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err, 'فشل تحديث بيانات الحساب الإداري'));
    }
  };

  // Handle Admin Password Change
  const changeAdminPassword = async (data: { currentPassword: string; newPassword: string }) => {
    try {
      await api.changeAdminPassword(data.currentPassword, data.newPassword);
    } catch (err: any) {
      throw new Error(getFriendlyErrorMessage(err, 'فشل تغيير كلمة مرور المسؤول'));
    }
  };

  const isSuperAdmin = useMemo(() => isSuperAdminUser(adminUser), [adminUser]);

  const hasTabPermission = useCallback((subTab: string) => {
    return hasAdminTabPermission(subTab, adminUser);
  }, [adminUser]);

  const getFirstAllowedTab = useCallback(() => {
    return getFirstAllowedAdminTab(adminUser);
  }, [adminUser]);

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        adminToken,
        isAdminLoggedIn,
        isLoading,
        unreadNotificationsCount,
        loginAdmin,
        logoutAdmin,
        updateAdminProfile,
        changeAdminPassword,
        refreshAdmin,
        hasTabPermission,
        isSuperAdmin,
        getFirstAllowedTab,
        setAdminUser,
        setUnreadNotificationsCount
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
export default AdminAuthContext;
