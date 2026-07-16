import { Product, Order, Coupon, SystemSettings } from '../types.js';

export async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {})
  };

  if (typeof window !== 'undefined') {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(path, {
    ...options,
    headers
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `API request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Storefront CMS and taxonomies
  getSettings: () => fetchApi<SystemSettings>('/api/settings'),
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

  // Coupons & FAQs
  validateCoupon: (code: string, cartTotal: number) =>
    fetchApi<Coupon>(`/api/coupons/validate?code=${encodeURIComponent(code)}&cartTotal=${cartTotal}`),

  getFaqs: () => fetchApi<any[]>('/api/faqs'),

  // Checkout and Tracking
  createOrder: (order: {
    customer: any;
    items: {
      productId: string;
      productTitle: string;
      variantSku?: string;
      variantInfo?: string;
      quantity: number;
      price: number;
    }[];
    couponCode?: string;
    discountAmount: number;
  }) =>
    fetchApi<Order>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order)
    }),

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

  readAllNotifications: () =>
    fetchApi<{ success: boolean }>('/api/admin/notifications/read-all', {
      method: 'POST'
    }),

  loginAdmin: (email: string, password: string) =>
    fetchApi<{ success: boolean; token: string; admin: any }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  changeAdminPassword: (currentPassword: string, newPassword: string) =>
    fetchApi<{ success: boolean; message: string }>('/api/admin/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    })
};
export default api;
