import { Product, Order, Coupon, SystemSettings, Supplier, SupplierInput, PurchaseOrder, PurchaseOrderInput, PurchaseOrderStatus, CustomerAddress, Campaign, ReturnRequest, ReturnReason, ReturnStatus, RefundStatus, MediaFolder, SocialLink } from '../types.js';
import { ApiError, getFriendlyErrorMessage } from './errorHandler.js';

export { ApiError, getFriendlyErrorMessage };

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {})
  };

  if (typeof window !== 'undefined' && !headers['Authorization']) {
    const adminToken = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
    const customerToken = sessionStorage.getItem('customer_token') || localStorage.getItem('customer_token');
    
    // Strict Scope Routing for API Auth tokens:
    if (path.startsWith('/api/admin')) {
      // Strictly Admin token only
      if (adminToken) {
        headers['Authorization'] = `Bearer ${adminToken}`;
      }
    } else if (path.startsWith('/api/customer') || path.startsWith('/api/auth') || path.startsWith('/api/coupons')) {
      // Strictly Customer token only
      if (customerToken) {
        headers['Authorization'] = `Bearer ${customerToken}`;
      }
    } else if (path === '/api/orders' || path.includes('/reviews')) {
      // Customer order placement / review submission
      if (customerToken) {
        headers['Authorization'] = `Bearer ${customerToken}`;
      }
    } else if (adminToken) {
      // Admin mutation fallback for generic routes
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
  }

  try {
    const res = await fetch(path, {
      ...options,
      headers
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData.error || errorData.message || `HTTP ${res.status}`;
      throw new ApiError(errorMsg, res.status, errorData);
    }
    return res.json() as Promise<T>;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Convert fetch/network failure to ApiError with friendly message capability
    throw new ApiError(err?.message || 'تعذر الاتصال بالخادم.', 0, err);
  }
}

export const api = {
  // Storefront CMS and taxonomies
  getSettings: () => fetchApi<SystemSettings>('/api/settings'),
  getSocialLinks: () => fetchApi<SocialLink[]>('/api/social-links'),
  getCategories: () => fetchApi<string[]>('/api/categories'),
  getBrands: () => fetchApi<string[]>('/api/brands'),

  // Products
  getProducts: (filters: {
    category?: string;
    brand?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    isFeatured?: boolean;
    isBestSeller?: boolean;
    isLatest?: boolean;
    isOffer?: boolean;
    sort?: string;
  } = {}) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.set(key, String(val));
      }
    });
    return fetchApi<Product[]>(`/api/products?${query.toString()}`);
  },

  getProductById: (id: string) => fetchApi<Product>(`/api/products/${id}`),

  submitReview: (productId: string, review: { userName: string; rating: number; comment: string }) =>
    fetchApi<any>(`/api/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(review)
    }),

  // Customer Reviews & Ratings (Phase 9.2 / 9.3)
  getProductReviews: (productId: string, variantId?: string) => {
    const query = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    return fetchApi<{
      reviews: any[];
      summary: {
        productId: string;
        totalReviews: number;
        averageRating: number;
        ratingDistribution: Record<number, number>;
      };
    }>(`/api/customer/products/${productId}/reviews${query}`);
  },

  getReviewEligibility: (productId: string, variantId?: string) => {
    const query = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    return fetchApi<{
      productId: string;
      variantId: string | null;
      canReview: boolean;
      hasPurchased: boolean;
      isVerifiedPurchase: boolean;
      hasExistingReview: boolean;
      existingReview: any | null;
      reason: 'NOT_LOGGED_IN' | 'NOT_PURCHASED' | 'ALREADY_REVIEWED' | 'ELIGIBLE' | string;
    }>(`/api/customer/products/${productId}/review-eligibility${query}`);
  },

  submitCustomerReview: (productId: string, review: { rating: number; title?: string; comment: string; variantId?: string }) =>
    fetchApi<any>(`/api/customer/products/${productId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(review)
    }),

  getCustomerReviews: () => fetchApi<any[]>('/api/customer/reviews/my'),

  updateCustomerReview: (reviewId: string, review: { rating?: number; title?: string; comment?: string }) =>
    fetchApi<any>(`/api/customer/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(review)
    }),

  deleteCustomerReview: (reviewId: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/customer/reviews/${reviewId}`, {
      method: 'DELETE'
    }),

  // Coupons & FAQs
  validateCoupon: (code: string, cartTotal: number, email?: string, phone?: string, customerId?: string) => {
    const params = new URLSearchParams({ code, cartTotal: cartTotal.toString() });
    if (email) params.set('email', email);
    if (phone) params.set('phone', phone);
    if (customerId) params.set('customerId', customerId);
    return fetchApi<Coupon & { valid: boolean; computedDiscount: number; discountAmount?: number; errorCode?: string }>(`/api/coupons/validate?${params.toString()}`);
  },

  getFaqs: () => fetchApi<any[]>('/api/faqs'),

  // Checkout and Tracking
  createOrder: (order: {
    customer: any;
    items: {
      productId: string;
      productTitle?: string;
      variantId?: string;
      variantSku?: string;
      variantInfo?: string;
      quantity: number;
      price?: number;
    }[];
    couponCode?: string;
    discountAmount?: number;
    idempotencyKey?: string;
  }, idempotencyKey?: string) => {
    const key = idempotencyKey || order.idempotencyKey;
    const headers: Record<string, string> = {};
    if (key) {
      headers['X-Idempotency-Key'] = key;
    }
    return fetchApi<Order>('/api/orders', {
      method: 'POST',
      headers,
      body: JSON.stringify(order)
    });
  },

  trackOrder: (id: string, phone?: string) => {
    const query = new URLSearchParams({ id });
    if (phone) query.set('phone', phone);
    return fetchApi<Order>(`/api/orders/track?${query.toString()}`);
  },

  // Gemini Assistant
  askAssistant: (message: string, history: { role: 'user' | 'model'; parts: { text: string }[] }[]) =>
    fetchApi<{ response: string }>('/api/gemini/assist', {
      method: 'POST',
      body: JSON.stringify({ message, history })
    }),

  // ==========================================
  // 🛡️ ADMIN SERVICES
  // ==========================================
  getAdminDashboard: () => fetchApi<any>('/api/admin/dashboard'),

  getAdminBIAnalytics: (startDate?: string, endDate?: string) =>
    fetchApi<any>(`/api/admin/bi-analytics?startDate=${startDate || ''}&endDate=${endDate || ''}`),

  getAdminMe: () => fetchApi<{ success: boolean; admin: any }>('/api/admin/me'),

  getAdminOrders: () => fetchApi<Order[]>('/api/admin/orders'),

  updateAdminOrderStatus: (orderId: string, status: string, reason?: string) =>
    fetchApi<Order>(`/api/admin/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason })
    }),

  createAdminProduct: (product: Partial<Product>) =>
    fetchApi<Product>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(product)
    }),

  updateAdminProduct: (id: string, product: Partial<Product>) =>
    fetchApi<Product>(`/api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    }),

  deleteAdminProduct: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/admin/products/${id}`, {
      method: 'DELETE'
    }),

  updateAdminSettings: (settings: Partial<SystemSettings>) =>
    fetchApi<SystemSettings>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  // Admin Social Links Management
  getAdminSocialLinks: () => fetchApi<SocialLink[]>('/api/admin/social-links'),
  createAdminSocialLink: (data: Partial<SocialLink>) =>
    fetchApi<SocialLink>('/api/admin/social-links', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateAdminSocialLink: (id: string, data: Partial<SocialLink>) =>
    fetchApi<SocialLink>(`/api/admin/social-links/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteAdminSocialLink: (id: string) =>
    fetchApi<{ success: boolean; id: string }>(`/api/admin/social-links/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),
  reorderAdminSocialLinks: (items: { id: string; order: number }[]) =>
    fetchApi<SocialLink[]>('/api/admin/social-links/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items })
    }),

  getAdminNotifications: (params?: {
    search?: string;
    priority?: string;
    type?: string;
    read?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.append('search', params.search);
      if (params.priority && params.priority !== 'all') query.append('priority', params.priority);
      if (params.type && params.type !== 'all') query.append('type', params.type);
      if (params.read !== undefined && params.read !== 'all') query.append('read', String(params.read));
      if (params.dateFrom) query.append('dateFrom', params.dateFrom);
      if (params.dateTo) query.append('dateTo', params.dateTo);
      if (params.page) query.append('page', String(params.page));
      if (params.limit) query.append('limit', String(params.limit));
    }
    const qStr = query.toString();
    return fetchApi<{
      success: boolean;
      notifications: any[];
      total: number;
      unreadCount: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/api/admin/notifications${qStr ? `?${qStr}` : ''}`);
  },

  markNotificationRead: (id: string) =>
    fetchApi<{ success: boolean; notification: any }>(`/api/admin/notifications/${id}/read`, {
      method: 'PATCH'
    }),

  markAllNotificationsRead: () =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/notifications/read-all', {
      method: 'PATCH'
    }),

  deleteNotification: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/admin/notifications/${id}`, {
      method: 'DELETE'
    }),

  readAllNotifications: () =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/notifications/read-all', {
      method: 'PATCH'
    }),

  loginAdmin: (email: string, password: string) =>
    fetchApi<{ success: boolean; token: string; admin: any }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  logoutAdmin: () =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/logout', {
      method: 'POST'
    }),

  changeAdminPassword: (currentPassword: string, newPassword: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    }),

  updateAdminProfile: (profile: { name?: string; phone?: string; email?: string }) =>
    fetchApi<{ success: boolean; message: string; admin?: any }>('/api/admin/profile', {
      method: 'PUT',
      body: JSON.stringify(profile)
    }),

  cleanupStore: (options: {
    deleteOrders: boolean;
    deleteCustomers: boolean;
    deleteNotifications: boolean;
    deleteLogs: boolean;
    deleteReviews: boolean;
    deleteCoupons: boolean;
    deleteProducts: boolean;
  }) =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/cleanup', {
      method: 'POST',
      body: JSON.stringify(options)
    }),

  // Media Library APIs
  getMedia: () => fetchApi<{ success: boolean; media: any[] }>('/api/admin/media'),
  
  uploadMediaItem: (file: File, onProgress?: (progress: number) => void) => {
    return new Promise<{ success: boolean; media: any; isDuplicate?: boolean; message?: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/media/upload');
      
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('رد غير صالح من خادم الرفع'));
          }
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            reject(new Error(response.error || 'فشل رفع الملف'));
          } catch (e) {
            reject(new Error(`فشل الرفع برمز الحالة ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('خطأ في الاتصال بالشبكة أثناء الرفع'));
      };

      const formData = new FormData();
      formData.append('image', file);
      xhr.send(formData);
    });
  },

  replaceMediaItem: (id: string, file: File, onProgress?: (progress: number) => void) => {
    return new Promise<{ success: boolean; media: any }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/media/replace');
      
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('رد غير صالح من خادم الرفع'));
          }
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            reject(new Error(response.error || 'فشل استبدال الملف'));
          } catch (e) {
            reject(new Error(`فشل الاستبدال برمز الحالة ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('خطأ في الاتصال بالشبكة أثناء الاستبدال'));
      };

      const formData = new FormData();
      formData.append('id', id);
      formData.append('image', file);
      xhr.send(formData);
    });
  },

  renameMediaItem: (id: string, title: string) =>
    fetchApi<{ success: boolean; media: any }>('/api/admin/media/rename', {
      method: 'POST',
      body: JSON.stringify({ id, title })
    }),

  deleteMediaItem: (id: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/media/delete', {
      method: 'POST',
      body: JSON.stringify({ id })
    }),

  bulkDeleteMediaItems: (ids: string[]) =>
    fetchApi<{ success: boolean; message: string; errors?: string[] }>('/api/admin/media/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids })
    }),

  bulkMoveMediaItems: (ids: string[], folder: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/media/bulk-move', {
      method: 'POST',
      body: JSON.stringify({ ids, folder })
    }),

  getMediaFolders: () =>
    fetchApi<{ success: boolean; folders: MediaFolder[] }>('/api/admin/media/folders'),

  createMediaFolder: (name: string) =>
    fetchApi<MediaFolder>('/api/admin/media/folders', {
      method: 'POST',
      body: JSON.stringify({ name })
    }),

  renameMediaFolder: (id: string, name: string) =>
    fetchApi<{ success: boolean; folder: MediaFolder }>(`/api/admin/media/folders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name })
    }),

  deleteMediaFolder: (id: string, options?: { moveToRoot?: boolean }) =>
    fetchApi<{ success: boolean; id: string; movedCount?: number; blocked?: boolean; itemCount?: number }>(
      `/api/admin/media/folders/${encodeURIComponent(id)}${options?.moveToRoot ? '?moveToRoot=true' : ''}`,
      {
        method: 'DELETE',
        body: options ? JSON.stringify(options) : undefined
      }
    ),

  uploadImage: (file: File, onProgress?: (progress: number) => void) => {
    return new Promise<{ success: boolean; url: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/upload');
      
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('رد غير صالح من خادم الرفع'));
          }
        } else {
          try {
            const response = JSON.parse(xhr.responseText);
            reject(new Error(response.error || `فشل الرفع برمز حالة ${xhr.status}`));
          } catch (e) {
            reject(new Error(`فشل الرفع برمز حالة ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('حدث خطأ في الشبكة أثناء رفع الصورة'));
      };

      const formData = new FormData();
      formData.append('image', file);
      xhr.send(formData);
    });
  },

  deleteImage: (url: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/upload/delete', {
      method: 'POST',
      body: JSON.stringify({ url })
    }),

  // Admin Coupons CRUD
  getAdminCoupons: () => fetchApi<Coupon[]>('/api/admin/coupons'),
  
  createAdminCoupon: (coupon: Partial<Coupon>) =>
    fetchApi<Coupon>('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(coupon)
    }),

  updateAdminCoupon: (code: string, coupon: Partial<Coupon>) =>
    fetchApi<Coupon>(`/api/admin/coupons/${code}`, {
      method: 'PUT',
      body: JSON.stringify(coupon)
    }),

  deleteAdminCoupon: (code: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/admin/coupons/${code}`, {
      method: 'DELETE'
    }),

  // Admin and Public Banners CRUD
  getBanners: () => fetchApi<any[]>('/api/banners'),
  getAdminBanners: () => fetchApi<any[]>('/api/admin/banners'),
  createAdminBanner: (banner: any) =>
    fetchApi<any>('/api/admin/banners', {
      method: 'POST',
      body: JSON.stringify(banner)
    }),
  updateAdminBanner: (id: string, banner: any) =>
    fetchApi<any>(`/api/admin/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(banner)
    }),
  deleteAdminBanner: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/admin/banners/${id}`, {
      method: 'DELETE'
    }),

  // Admin and Public Shipping Provinces CRUD
  getShippingProvinces: () => fetchApi<any[]>('/api/shipping-provinces'),
  getAdminShippingProvinces: () => fetchApi<any[]>('/api/admin/shipping-provinces'),
  createAdminShippingProvince: (province: any) =>
    fetchApi<any>('/api/admin/shipping-provinces', {
      method: 'POST',
      body: JSON.stringify(province)
    }),
  updateAdminShippingProvince: (id: string, province: any) =>
    fetchApi<any>(`/api/admin/shipping-provinces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(province)
    }),
  deleteAdminShippingProvince: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/admin/shipping-provinces/${id}`, {
      method: 'DELETE'
    }),

  // Customer Auth & Account System API
  registerCustomer: (data: any) =>
    fetchApi<{ success: boolean; message: string; verificationCode?: string; customerId: string }>('/api/customer/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  verifyCustomerEmail: (data: { email: string; code: string }) =>
    fetchApi<{ success: boolean; message: string }>('/api/customer/verify', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  resendCustomerVerification: (data: { email: string }) =>
    fetchApi<{ success: boolean; verificationCode?: string; message: string }>('/api/customer/resend-verification', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  loginCustomer: (data: any) =>
    fetchApi<{ success: boolean; token: string; customer: any }>('/api/customer/login', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  logoutCustomer: () =>
    fetchApi<{ success: boolean }>('/api/customer/logout', {
      method: 'POST'
    }),
  forgotCustomerPassword: (data: { email: string }) =>
    fetchApi<{ success: boolean; message: string; resetToken?: string }>('/api/customer/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  resetCustomerPassword: (data: any) =>
    fetchApi<{ success: boolean; message: string }>('/api/customer/reset-password', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getCustomerProfile: () => fetchApi<any>('/api/customer/profile'),
  updateCustomerProfile: (data: { name?: string; phone?: string }) =>
    fetchApi<{ success: boolean; message: string; customer: any }>('/api/customer/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  changeCustomerPassword: (data: any) =>
    fetchApi<{ success: boolean; message: string }>('/api/customer/change-password', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteCustomerAccount: () =>
    fetchApi<{ success: boolean; message: string }>('/api/customer/delete-account', {
      method: 'DELETE'
    }),
  getCustomerAddresses: () => fetchApi<CustomerAddress[]>('/api/customer/addresses'),
  getCustomerAddressById: (id: string) => fetchApi<CustomerAddress>(`/api/customer/addresses/${id}`),
  createCustomerAddress: (address: Partial<CustomerAddress>) =>
    fetchApi<CustomerAddress>('/api/customer/addresses', {
      method: 'POST',
      body: JSON.stringify(address)
    }),
  updateCustomerAddress: (id: string, address: Partial<CustomerAddress>) =>
    fetchApi<CustomerAddress>(`/api/customer/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(address)
    }),
  patchCustomerAddress: (id: string, address: Partial<CustomerAddress>) =>
    fetchApi<CustomerAddress>(`/api/customer/addresses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(address)
    }),
  setCustomerAddressDefault: (id: string) =>
    fetchApi<CustomerAddress>(`/api/customer/addresses/${id}/default`, {
      method: 'PATCH'
    }),
  deleteCustomerAddress: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/customer/addresses/${id}`, {
      method: 'DELETE'
    }),
  getCustomerWishlist: () => fetchApi<string[]>('/api/customer/wishlist'),
  addToWishlist: (productId: string) =>
    fetchApi<{ success: boolean; added: boolean; wishlist: string[] }>('/api/customer/wishlist', {
      method: 'POST',
      body: JSON.stringify({ productId })
    }),
  removeFromWishlist: (productId: string) =>
    fetchApi<{ success: boolean; removed: boolean; wishlist: string[] }>(`/api/customer/wishlist/${productId}`, {
      method: 'DELETE'
    }),
  toggleCustomerWishlist: (productId: string) =>
    fetchApi<{ success: boolean; added: boolean; wishlist: string[] }>('/api/customer/wishlist/toggle', {
      method: 'POST',
      body: JSON.stringify({ productId })
    }),
  getCustomerCart: () => fetchApi<any[]>('/api/customer/cart'),
  addCustomerCartItem: (data: { productId: string; variantId?: string; quantity?: number }) =>
    fetchApi<{ success: boolean; cart: any[] }>('/api/customer/cart/items', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateCustomerCartItem: (productId: string, data: { variantId?: string; quantity: number }) =>
    fetchApi<{ success: boolean; cart: any[] }>(`/api/customer/cart/items/${productId}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  removeCustomerCartItem: (productId: string, variantId?: string) => {
    const q = variantId ? `?variantId=${encodeURIComponent(variantId)}` : '';
    return fetchApi<{ success: boolean; cart: any[] }>(`/api/customer/cart/items/${productId}${q}`, {
      method: 'DELETE'
    });
  },
  mergeCustomerCart: (guestCart: any[]) =>
    fetchApi<{ success: boolean; cart: any[] }>('/api/customer/cart/merge', {
      method: 'POST',
      body: JSON.stringify({ guestCart })
    }),
  clearCustomerCart: () =>
    fetchApi<{ success: boolean; message: string; cart: any[] }>('/api/customer/cart/clear', {
      method: 'DELETE'
    }),
  updateCustomerCart: (cart: any[]) =>
    fetchApi<{ success: boolean; savedCart: any[] }>('/api/customer/cart', {
      method: 'PUT',
      body: JSON.stringify({ cart })
    }),
  getCustomerNotifications: () => fetchApi<any[]>('/api/customer/notifications'),
  markCustomerNotificationsRead: () =>
    fetchApi<{ success: boolean }>('/api/customer/notifications/read', {
      method: 'POST'
    }),
  markCustomerNotificationReadById: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/customer/notifications/${id}/read`, {
      method: 'POST'
    }),
  deleteCustomerNotification: (id: string) =>
    fetchApi<{ success: boolean }>(`/api/customer/notifications/${id}`, {
      method: 'DELETE'
    }),
  clearCustomerNotifications: () =>
    fetchApi<{ success: boolean }>('/api/customer/notifications/clear', {
      method: 'POST'
    }),
  sendAdminCustomerNotification: (customerId: string, notif: { title: string; message: string; type?: string; metadata?: any }) =>
    fetchApi<{ success: boolean; notification: any }>(`/api/admin/customers/${customerId}/notifications`, {
      method: 'POST',
      body: JSON.stringify(notif)
    }),
  sendAdminBroadcastNotification: (data: { title: string; message: string; type?: string; targetStatus?: string }) =>
    fetchApi<{ success: boolean; count: number }>('/api/admin/customers/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  getCustomerOrders: () => fetchApi<Order[]>('/api/customer/orders'),
  getCustomerOrderById: (id: string) => fetchApi<Order>(`/api/customer/orders/${id}`),

  // Inventory Pro APIs
  getInventorySummary: () => fetchApi<any>('/api/admin/inventory/summary'),
  getInventoryMovements: (params?: { productId?: string; variantId?: string; type?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          query.append(key, String(val));
        }
      });
    }
    const qStr = query.toString();
    return fetchApi<any>(`/api/admin/inventory/movements${qStr ? `?${qStr}` : ''}`);
  },
  getInventoryLowStock: (params?: { search?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.append('search', params.search);
      if (params.status) query.append('status', params.status);
    }
    const qStr = query.toString();
    return fetchApi<any[]>(`/api/admin/inventory/low-stock${qStr ? `?${qStr}` : ''}`);
  },
  adjustInventoryStock: (data: { productId: string; variantId?: string; type: string; quantity: number; referenceId?: string; reason: string }) =>
    fetchApi<any>('/api/admin/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Suppliers Management APIs
  getSuppliers: (params?: { search?: string; status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.append('search', params.search);
      if (params.status) query.append('status', params.status);
      if (params.page) query.append('page', String(params.page));
      if (params.limit) query.append('limit', String(params.limit));
    }
    const qStr = query.toString();
    return fetchApi<{
      suppliers: Supplier[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      stats: { total: number; active: number; inactive: number };
    }>(`/api/admin/suppliers${qStr ? `?${qStr}` : ''}`);
  },

  getSupplierById: (id: string) => fetchApi<{ supplier: Supplier; stats: any }>(`/api/admin/suppliers/${id}`),

  createSupplier: (data: SupplierInput) =>
    fetchApi<{ success: boolean; message: string; supplier: Supplier }>('/api/admin/suppliers', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateSupplier: (id: string, data: Partial<SupplierInput>) =>
    fetchApi<{ success: boolean; message: string; supplier: Supplier }>(`/api/admin/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  deleteSupplier: (id: string) =>
    fetchApi<{ success: boolean; action: 'deleted' | 'deactivated'; message: string }>(`/api/admin/suppliers/${id}`, {
      method: 'DELETE'
    }),

  // Purchase Orders Management APIs
  getPurchaseOrders: (params?: { search?: string; supplierId?: string; status?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.append('search', params.search);
      if (params.supplierId) query.append('supplierId', params.supplierId);
      if (params.status) query.append('status', params.status);
      if (params.startDate) query.append('startDate', params.startDate);
      if (params.endDate) query.append('endDate', params.endDate);
      if (params.page) query.append('page', String(params.page));
      if (params.limit) query.append('limit', String(params.limit));
    }
    const qStr = query.toString();
    return fetchApi<{
      purchaseOrders: PurchaseOrder[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      stats: { total: number; draft: number; inTransit: number; received: number; cancelled: number; totalValueCost: number };
    }>(`/api/admin/purchase-orders${qStr ? `?${qStr}` : ''}`);
  },

  getPurchaseOrderById: (id: string) => fetchApi<{ purchaseOrder: PurchaseOrder; supplier: Supplier }>(`/api/admin/purchase-orders/${id}`),

  createPurchaseOrder: (data: PurchaseOrderInput) =>
    fetchApi<{ success: boolean; message: string; purchaseOrder: PurchaseOrder }>('/api/admin/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updatePurchaseOrder: (id: string, data: Partial<PurchaseOrderInput>) =>
    fetchApi<{ success: boolean; message: string; purchaseOrder: PurchaseOrder }>(`/api/admin/purchase-orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  updatePurchaseOrderStatus: (id: string, status: PurchaseOrderStatus) =>
    fetchApi<{ success: boolean; message: string; purchaseOrder: PurchaseOrder }>(`/api/admin/purchase-orders/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status })
    }),

  receivePurchaseOrderItems: (id: string, items: { itemId: string; quantityToReceive: number }[]) =>
    fetchApi<{ success: boolean; message: string; purchaseOrder: PurchaseOrder }>(`/api/admin/purchase-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify({ items })
    }),

  // Barcode Management APIs
  generateBarcode: () => fetchApi<{ success: boolean; barcode: string }>('/api/admin/generate-barcode'),

  getBarcodeInfo: (barcode: string) => fetchApi<{
    success: boolean;
    data: {
      product: Product;
      variant?: any;
      productId: string;
      variantId?: string;
      title: string;
      sku: string;
      barcode: string;
      currentStock: number;
      price: number;
      location?: string;
    };
  }>(`/api/admin/barcode/${encodeURIComponent(barcode)}`),

  // QR Code Management APIs
  generateQrCode: (productId?: string, variantId?: string) => {
    const params = new URLSearchParams();
    if (productId) params.append('productId', productId);
    if (variantId) params.append('variantId', variantId);
    const q = params.toString();
    return fetchApi<{ success: boolean; qrCode: string }>(`/api/admin/generate-qr${q ? '?' + q : ''}`);
  },

  getQrCodeInfo: (code: string) => fetchApi<{
    success: boolean;
    data: {
      product: Product;
      variant?: any;
      productId: string;
      variantId?: string;
      title: string;
      sku: string;
      barcode?: string;
      qrCode?: string;
      currentStock: number;
      price: number;
      costPrice?: number;
      location?: string;
      mainImage?: string;
    };
  }>(`/api/admin/qr/${encodeURIComponent(code)}`),

  // Admin Customer Management APIs
  getAdminCustomers: () => fetchApi<any[]>('/api/admin/customers'),
  getAdminCustomerById: (id: string) => fetchApi<{ customer: any; orders: Order[] }>(`/api/admin/customers/${id}`),
  updateAdminCustomer: (id: string, data: { name?: string; email?: string; phone?: string; status?: 'active' | 'inactive' | 'blocked' }) =>
    fetchApi<any>(`/api/admin/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
  updateAdminCustomerStatus: (id: string, status: 'active' | 'inactive' | 'blocked') =>
    fetchApi<any>(`/api/admin/customers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    }),

  // Admin Analytics APIs (Sprint 5)
  getAnalyticsSales: (range?: string) => {
    const q = range ? `?range=${encodeURIComponent(range)}` : '';
    return fetchApi<{
      success: boolean;
      analytics: {
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
      };
    }>(`/api/admin/analytics/sales${q}`);
  },

  getAnalyticsReturns: (range?: string) => {
    const q = range ? `?range=${encodeURIComponent(range)}` : '';
    return fetchApi<{
      success: boolean;
      analytics: {
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
      };
    }>(`/api/admin/analytics/returns${q}`);
  },

  getAnalyticsTopProducts: (limit?: number) => {
    const q = limit ? `?limit=${limit}` : '';
    return fetchApi<{
      success: boolean;
      topProducts: Array<{
        productId: string;
        productTitle: string;
        quantitySold: number;
        revenue: number;
      }>;
    }>(`/api/admin/analytics/top-products${q}`);
  },

  getAnalyticsCustomers: () => fetchApi<{
    success: boolean;
    analytics: {
      totalCustomers: number;
      activeCustomers: number;
      blockedCustomers: number;
      newCustomers: number;
      repeatCustomers: number;
    };
  }>('/api/admin/analytics/customers'),

  getAnalyticsInventory: () => fetchApi<{
    success: boolean;
    analytics: {
      totalProducts: number;
      totalStock: number;
      lowStockItems: number;
      outOfStockItems: number;
      inventoryValue: number;
    };
  }>('/api/admin/analytics/inventory'),

  getAnalyticsReviews: () => fetchApi<{
    success: boolean;
    analytics: {
      totalReviews: number;
      approvedReviews: number;
      pendingReviews: number;
      rejectedReviews: number;
      averageRating: number;
    };
  }>('/api/admin/analytics/reviews'),

  // Admin Reviews Management APIs
  getAdminReviews: (params?: { status?: string; rating?: number | string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'all') query.append('status', params.status);
    if (params?.rating && params.rating !== 'all') query.append('rating', String(params.rating));
    if (params?.search) query.append('search', params.search);
    const qStr = query.toString();
    return fetchApi<{
      reviews: any[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      stats: { total: number; pending: number; approved: number; rejected: number; hidden: number };
    }>(`/api/admin/reviews${qStr ? `?${qStr}` : ''}`);
  },
  updateAdminReviewStatus: (id: string, status: string, adminResponse?: string) =>
    fetchApi<any>(`/api/admin/reviews/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminResponse })
    }),
  deleteAdminReview: (id: string) =>
    fetchApi<{ success: boolean; message: string }>(`/api/admin/reviews/${id}`, {
      method: 'DELETE'
    }),

  // Promotional Campaigns APIs
  getActiveCampaigns: () => fetchApi<{
    success: boolean;
    campaigns: Campaign[];
  }>('/api/campaigns/active'),

  evaluateCampaigns: (payload: {
    items: Array<{ productId: string; quantity: number; variantId?: string }>;
    couponCode?: string;
    governorate?: string;
  }) => fetchApi<{
    success: boolean;
    subtotal: number;
    shippingCost: number;
    taxAmount: number;
    appliedCampaign: { id: string; name: string; type: string; value: number } | null;
    campaignDiscount: number;
    appliedCoupon: { code: string; discountType: string; value: number } | null;
    couponDiscount: number;
    finalDiscountAmount: number;
    total: number;
  }>('/api/campaigns/evaluate', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  getAdminCampaigns: () => fetchApi<{
    success: boolean;
    campaigns: Campaign[];
  }>('/api/admin/campaigns'),

  createAdminCampaign: (data: Partial<Campaign>) => fetchApi<{
    success: boolean;
    campaign: Campaign;
  }>('/api/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  updateAdminCampaign: (id: string, data: Partial<Campaign>) => fetchApi<{
    success: boolean;
    campaign: Campaign;
  }>(`/api/admin/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  deleteAdminCampaign: (id: string) => fetchApi<{
    success: boolean;
    message: string;
  }>(`/api/admin/campaigns/${id}`, {
    method: 'DELETE'
  }),

  // RBAC Admin Users & Roles & Permissions (Sprint 7)
  getAdminUsers: () => fetchApi<any[]>('/api/admin/users'),
  createAdminUser: (data: any) => fetchApi<any>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateAdminUser: (id: string, data: any) => fetchApi<any>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteAdminUser: (id: string) => fetchApi<any>(`/api/admin/users/${id}`, {
    method: 'DELETE'
  }),

  getAdminRoles: () => fetchApi<any[]>('/api/admin/roles'),
  createAdminRole: (data: any) => fetchApi<any>('/api/admin/roles', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateAdminRole: (id: string, data: any) => fetchApi<any>(`/api/admin/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteAdminRole: (id: string) => fetchApi<any>(`/api/admin/roles/${id}`, {
    method: 'DELETE'
  }),

  getAdminPermissions: () => fetchApi<any[]>('/api/admin/permissions'),
  getRolePermissions: (roleId: string) => fetchApi<{
    role: any;
    permissions: any[];
    assignedPermissions: string[];
  }>(`/api/admin/roles/${roleId}/permissions`),
  updateRolePermissions: (roleId: string, permissions: string[]) => fetchApi<{
    success: boolean;
    message: string;
    roleId: string;
    assignedPermissions: string[];
  }>(`/api/admin/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions })
  }),

  // Customer Return Requests
  createReturnRequest: (data: {
    orderId: string;
    productId: string;
    variantId?: string;
    orderItemId?: string;
    quantity: number;
    reason: ReturnReason;
    otherReason?: string;
    customerNote?: string;
    images?: string[];
  }) => fetchApi<{
    success: boolean;
    message: string;
    returnRequest: ReturnRequest;
  }>('/api/customer/returns', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  getCustomerReturnRequests: () => fetchApi<ReturnRequest[]>('/api/customer/returns'),

  getCustomerReturnRequestById: (id: string) => fetchApi<ReturnRequest>(`/api/customer/returns/${id}`),

  cancelCustomerReturnRequest: (id: string) => fetchApi<{
    success: boolean;
    message: string;
    returnRequest: ReturnRequest;
  }>(`/api/customer/returns/${id}/cancel`, {
    method: 'POST'
  }),

  // Admin Return Requests Management
  getAdminReturnRequests: (params: {
    status?: string;
    refundStatus?: string;
    orderId?: string;
    customerId?: string;
    customer?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.set(key, String(val));
      }
    });
    return fetchApi<{
      success: boolean;
      returns: ReturnRequest[];
      pagination: { page: number; limit: number; totalItems: number; totalPages: number };
      kpis: {
        totalCount: number;
        pendingCount: number;
        approvedCount: number;
        completedCount: number;
        rejectedCount: number;
        totalRefundedAmount: number;
      };
    }>(`/api/admin/returns?${query.toString()}`);
  },

  getAdminReturnRequestById: (id: string) => fetchApi<{
    success: boolean;
    returnRequest: ReturnRequest;
    order: Order | null;
    product: Product | null;
  }>(`/api/admin/returns/${id}`),

  updateAdminReturnRequestStatus: (id: string, data: {
    status?: ReturnStatus;
    adminNote?: string;
    refundStatus?: RefundStatus;
    refundAmount?: number;
    refundMethod?: 'cash' | 'vodafone_cash' | 'instapay' | 'bank_transfer' | 'store_credit' | 'other';
    refundReference?: string;
    restockable?: boolean;
  }) => fetchApi<{
    success: boolean;
    message: string;
    returnRequest: ReturnRequest;
  }>(`/api/admin/returns/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
};
export default api;
