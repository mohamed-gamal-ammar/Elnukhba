import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api, { getFriendlyErrorMessage } from '../lib/api.js';
import { CustomerAddress } from '../types.js';

interface CustomerNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  timestamp: string;
  metadata?: any;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isVerified: boolean;
  createdAt: string;
}

interface CustomerAuthContextType {
  customer: Customer | null;
  token: string | null;
  isLoading: boolean;
  addresses: CustomerAddress[];
  wishlist: string[];
  savedCart: any[];
  notifications: CustomerNotification[];
  orders: any[];
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<any>;
  register: (data: any) => Promise<any>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<any>;
  forgotPassword: (email: string) => Promise<any>;
  resetPassword: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<void>;
  changePassword: (data: any) => Promise<void>;
  deleteAccount: () => Promise<void>;
  loadAddresses: () => Promise<void>;
  addAddress: (address: Omit<CustomerAddress, 'id'>) => Promise<void>;
  updateAddress: (id: string, address: Partial<CustomerAddress>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
  addToWishlist: (productId: string) => Promise<boolean>;
  removeFromWishlist: (productId: string) => Promise<boolean>;
  toggleWishlist: (productId: string) => Promise<boolean>;
  loadCart: () => Promise<any[]>;
  addToCart: (productId: string, variantId?: string, quantity?: number) => Promise<any[]>;
  updateCartItem: (productId: string, quantity: number, variantId?: string) => Promise<any[]>;
  removeFromCart: (productId: string, variantId?: string) => Promise<any[]>;
  clearCart: () => Promise<void>;
  mergeGuestCart: (guestCartItems: any[]) => Promise<any[]>;
  saveCart: (cartItems: any[]) => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationsAsRead: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearNotifications: () => Promise<void>;
  loadOrders: () => Promise<void>;
  refreshData: () => Promise<void>;
  clearError: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

// Dedicated storage keys strictly isolated for Customer domain
export const CUSTOMER_STORAGE_KEYS = {
  TOKEN: 'customer_token',
  USER: 'customer_user'
} as const;

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(() => {
    try {
      const cached = localStorage.getItem(CUSTOMER_STORAGE_KEYS.USER) || sessionStorage.getItem(CUSTOMER_STORAGE_KEYS.USER);
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CUSTOMER_STORAGE_KEYS.TOKEN) || sessionStorage.getItem(CUSTOMER_STORAGE_KEYS.TOKEN);
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [savedCart, setSavedCart] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initial load
    const storedToken = localStorage.getItem(CUSTOMER_STORAGE_KEYS.TOKEN) || sessionStorage.getItem(CUSTOMER_STORAGE_KEYS.TOKEN);
    if (storedToken) {
      setToken(storedToken);
      fetchProfile(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchProfile = async (authToken: string) => {
    try {
      setIsLoading(true);
      // Temporarily write token to sessionStorage so api.ts fetchApi can pick it up
      sessionStorage.setItem(CUSTOMER_STORAGE_KEYS.TOKEN, authToken);
      const profile = await api.getCustomerProfile();
      const customerData: Customer = {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        isVerified: profile.isVerified,
        createdAt: profile.createdAt
      };
      setCustomer(customerData);
      try {
        const hasLocalStorageToken = Boolean(localStorage.getItem(CUSTOMER_STORAGE_KEYS.TOKEN));
        if (hasLocalStorageToken) {
          localStorage.setItem(CUSTOMER_STORAGE_KEYS.USER, JSON.stringify(customerData));
          sessionStorage.setItem(CUSTOMER_STORAGE_KEYS.USER, JSON.stringify(customerData));
        } else {
          sessionStorage.setItem(CUSTOMER_STORAGE_KEYS.USER, JSON.stringify(customerData));
          localStorage.removeItem(CUSTOMER_STORAGE_KEYS.USER);
        }
      } catch (e) {}
      setAddresses(profile.addresses || []);
      setWishlist(profile.wishlist || []);
      setNotifications(profile.notifications || []);

      // Load enriched live cart concurrent with orders
      try {
        const enrichedCart = await api.getCustomerCart();
        setSavedCart(enrichedCart);
      } catch (err) {
        setSavedCart(profile.savedCart || []);
      }
      
      // Load orders concurrently
      try {
        const oList = await api.getCustomerOrders();
        setOrders(oList);
      } catch (err) {
        console.error('Failed to load orders', err);
      }
    } catch (err: any) {
      console.error('Failed to fetch customer profile', err);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      setError(null);
      const res = await api.loginCustomer({ email, password, rememberMe });
      setToken(res.token);

      if (rememberMe) {
        localStorage.setItem(CUSTOMER_STORAGE_KEYS.TOKEN, res.token);
        sessionStorage.setItem(CUSTOMER_STORAGE_KEYS.TOKEN, res.token);
      } else {
        sessionStorage.setItem(CUSTOMER_STORAGE_KEYS.TOKEN, res.token);
        localStorage.removeItem(CUSTOMER_STORAGE_KEYS.TOKEN);
        localStorage.removeItem(CUSTOMER_STORAGE_KEYS.USER);
      }

      await fetchProfile(res.token);

      // Detect and merge guest cart from localStorage if present
      const guestCartRaw = localStorage.getItem('cod_store_cart');
      if (guestCartRaw) {
        try {
          const guestCart = JSON.parse(guestCartRaw);
          if (Array.isArray(guestCart) && guestCart.length > 0) {
            const mergedRes = await api.mergeCustomerCart(guestCart);
            setSavedCart(mergedRes.cart || []);
            localStorage.removeItem('cod_store_cart');
          }
        } catch (e) {
          console.error('Failed to parse guest cart on login merge', e);
        }
      }

      return res;
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل تسجيل الدخول. يرجى التحقق من بياناتك.');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const register = async (data: any) => {
    try {
      setError(null);
      if (data.password && data.password.length < 8) {
        throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف');
      }
      const res = await api.registerCustomer(data);
      return res;
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل تسجيل الحساب.');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const verifyEmail = async (email: string, code: string) => {
    try {
      setError(null);
      await api.verifyCustomerEmail({ email, code });
      if (customer && customer.email === email) {
        setCustomer(prev => prev ? { ...prev, isVerified: true } : null);
      }
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'كود التفعيل غير صحيح');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const resendVerification = async (email: string) => {
    try {
      setError(null);
      return await api.resendCustomerVerification({ email });
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل إعادة إرسال الكود');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setError(null);
      return await api.forgotCustomerPassword({ email });
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل إرسال كود استعادة كلمة المرور');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const resetPassword = async (data: any) => {
    try {
      setError(null);
      if (data.newPassword && data.newPassword.length < 8) {
        throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف');
      }
      await api.resetCustomerPassword(data);
      await logout();
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل تعيين كلمة المرور الجديدة');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const logout = async () => {
    try {
      await api.logoutCustomer().catch(() => {});
    } catch (e) {}
    setCustomer(null);
    setToken(null);
    setAddresses([]);
    setWishlist([]);
    setSavedCart([]);
    setNotifications([]);
    setOrders([]);
    try {
      localStorage.removeItem(CUSTOMER_STORAGE_KEYS.TOKEN);
      localStorage.removeItem(CUSTOMER_STORAGE_KEYS.USER);
      sessionStorage.removeItem(CUSTOMER_STORAGE_KEYS.TOKEN);
      sessionStorage.removeItem(CUSTOMER_STORAGE_KEYS.USER);
    } catch (e) {}
    setIsLoading(false);
  };

  const updateProfile = async (data: { name?: string; phone?: string }) => {
    try {
      setError(null);
      const res = await api.updateCustomerProfile(data);
      setCustomer(prev => {
        const updated = prev ? { ...prev, ...res.customer } : null;
        if (updated) {
          try {
            localStorage.setItem(CUSTOMER_STORAGE_KEYS.USER, JSON.stringify(updated));
            sessionStorage.setItem(CUSTOMER_STORAGE_KEYS.USER, JSON.stringify(updated));
          } catch (e) {}
        }
        return updated;
      });
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل تحديث الحساب');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const changePassword = async (data: any) => {
    try {
      setError(null);
      if (data.newPassword && data.newPassword.length < 8) {
        throw new Error('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف');
      }
      await api.changeCustomerPassword(data);
      await logout();
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل تغيير كلمة المرور');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const deleteAccount = async () => {
    try {
      setError(null);
      await api.deleteCustomerAccount();
      await logout();
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل حذف الحساب');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const loadAddresses = async () => {
    try {
      const list = await api.getCustomerAddresses();
      setAddresses(list);
    } catch (err: any) {
      console.error('Failed to load addresses', err);
    }
  };

  const addAddress = async (address: Omit<CustomerAddress, 'id'>) => {
    try {
      setError(null);
      const newAddr = await api.createCustomerAddress(address);
      setAddresses(prev => [...prev.map(a => newAddr.isDefault ? { ...a, isDefault: false } : a), newAddr]);
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل إضافة العنوان');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const updateAddress = async (id: string, address: Partial<CustomerAddress>) => {
    try {
      setError(null);
      const updated = await api.updateCustomerAddress(id, address);
      setAddresses(prev => prev.map(a => {
        if (a.id === id) return updated;
        if (address.isDefault) return { ...a, isDefault: false };
        return a;
      }));
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل تحديث العنوان');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const deleteAddress = async (id: string) => {
    try {
      setError(null);
      await api.deleteCustomerAddress(id);
      setAddresses(prev => {
        const filtered = prev.filter(a => a.id !== id);
        // If the deleted address was default, set the first of remaining as default
        const wasDefault = prev.find(a => a.id === id)?.isDefault;
        if (wasDefault && filtered.length > 0) {
          filtered[0].isDefault = true;
        }
        return filtered;
      });
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل حذف العنوان');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const setDefaultAddress = async (id: string) => {
    try {
      setError(null);
      await api.setCustomerAddressDefault(id);
      setAddresses(prev => prev.map(a => ({
        ...a,
        isDefault: a.id === id
      })));
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل تعيين العنوان الافتراضي');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const addToWishlist = async (productId: string) => {
    try {
      setError(null);
      const res = await api.addToWishlist(productId);
      setWishlist(res.wishlist);
      return res.added;
    } catch (err: any) {
      console.error('Failed to add to wishlist', err);
      return false;
    }
  };

  const removeFromWishlist = async (productId: string) => {
    try {
      setError(null);
      const res = await api.removeFromWishlist(productId);
      setWishlist(res.wishlist);
      return true;
    } catch (err: any) {
      console.error('Failed to remove from wishlist', err);
      return false;
    }
  };

  const toggleWishlist = async (productId: string) => {
    try {
      setError(null);
      const res = await api.toggleCustomerWishlist(productId);
      setWishlist(res.wishlist);
      return res.added;
    } catch (err: any) {
      console.error('Failed to toggle wishlist', err);
      return false;
    }
  };

  const loadCart = async (): Promise<any[]> => {
    try {
      if (!token) return [];
      const enrichedCart = await api.getCustomerCart();
      setSavedCart(enrichedCart);
      return enrichedCart;
    } catch (err: any) {
      console.error('Failed to load cart', err);
      return [];
    }
  };

  const addToCart = async (productId: string, variantId?: string, quantity: number = 1): Promise<any[]> => {
    try {
      setError(null);
      const res = await api.addCustomerCartItem({ productId, variantId, quantity });
      setSavedCart(res.cart || []);
      return res.cart || [];
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل إضافة المنتج إلى السلة');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const updateCartItem = async (productId: string, quantity: number, variantId?: string): Promise<any[]> => {
    try {
      setError(null);
      const res = await api.updateCustomerCartItem(productId, { variantId, quantity });
      setSavedCart(res.cart || []);
      return res.cart || [];
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل تحديث الكمية');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const removeFromCart = async (productId: string, variantId?: string): Promise<any[]> => {
    try {
      setError(null);
      const res = await api.removeCustomerCartItem(productId, variantId);
      setSavedCart(res.cart || []);
      return res.cart || [];
    } catch (err: any) {
      const friendlyMsg = getFriendlyErrorMessage(err, 'فشل إزالة المنتج من السلة');
      setError(friendlyMsg);
      throw new Error(friendlyMsg);
    }
  };

  const clearCart = async (): Promise<void> => {
    try {
      setError(null);
      await api.clearCustomerCart();
      setSavedCart([]);
    } catch (err: any) {
      console.error('Failed to clear cart', err);
    }
  };

  const mergeGuestCart = async (guestCartItems: any[]): Promise<any[]> => {
    try {
      setError(null);
      const res = await api.mergeCustomerCart(guestCartItems);
      setSavedCart(res.cart || []);
      localStorage.removeItem('cod_store_cart');
      return res.cart || [];
    } catch (err: any) {
      console.error('Failed to merge guest cart', err);
      return [];
    }
  };

  const saveCart = async (cartItems: any[]) => {
    try {
      if (!token) return;
      await api.updateCustomerCart(cartItems);
      setSavedCart(cartItems);
    } catch (err: any) {
      console.error('Failed to save cart', err);
    }
  };

  const loadNotifications = async () => {
    try {
      const list = await api.getCustomerNotifications();
      setNotifications(list);
    } catch (err: any) {
      console.error('Failed to load notifications', err);
    }
  };

  const markNotificationsAsRead = async () => {
    try {
      await api.markCustomerNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err: any) {
      console.error('Failed to mark notifications read', err);
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await api.markCustomerNotificationReadById(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err: any) {
      console.error('Failed to mark notification read', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.deleteCustomerNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err: any) {
      console.error('Failed to delete notification', err);
    }
  };

  const clearNotifications = async () => {
    try {
      await api.clearCustomerNotifications();
      setNotifications([]);
    } catch (err: any) {
      console.error('Failed to clear notifications', err);
    }
  };

  // Phase 5.6: Auto-refresh polling for notifications when customer is logged in
  useEffect(() => {
    if (!customer || !token) return;
    const intervalId = setInterval(() => {
      loadNotifications();
    }, 45000);
    return () => clearInterval(intervalId);
  }, [customer, token]);

  const loadOrders = async () => {
    try {
      const oList = await api.getCustomerOrders();
      setOrders(oList);
    } catch (err: any) {
      console.error('Failed to load orders', err);
    }
  };

  const refreshData = async () => {
    const currentToken = token || localStorage.getItem(CUSTOMER_STORAGE_KEYS.TOKEN) || sessionStorage.getItem(CUSTOMER_STORAGE_KEYS.TOKEN);
    if (currentToken) {
      try {
        await fetchProfile(currentToken);
      } catch (e) {
        console.warn('Customer refreshData error:', e);
      }
    }
  };

  const clearError = () => setError(null);

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        token,
        isLoading,
        addresses,
        wishlist,
        savedCart,
        notifications,
        orders,
        error,
        login,
        register,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        logout,
        updateProfile,
        changePassword,
        deleteAccount,
        loadAddresses,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        loadCart,
        addToCart,
        updateCartItem,
        removeFromCart,
        clearCart,
        mergeGuestCart,
        saveCart,
        loadNotifications,
        markNotificationsAsRead,
        markNotificationAsRead,
        deleteNotification,
        clearNotifications,
        loadOrders,
        refreshData,
        clearError
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
