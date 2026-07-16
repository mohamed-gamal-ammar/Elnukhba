export interface ProductVariant {
  id: string;
  color?: string;
  size?: string;
  capacity?: string; // e.g., "500 Liters", "12 kg"
  voltage?: string; // e.g., "220V"
  power?: string; // e.g., "1500W"
  model?: string;
  warranty: string; // e.g., "2 Years"
  price: number;
  stock: number;
  sku: string;
  barcode: string;
}

export interface Review {
  id: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  date: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface Product {
  id: string;
  title: string; // Arabic Title
  titleEn?: string;
  description: string; // Rich detailed description
  brand: string;
  category: string;
  mainImage: string;
  images: string[];
  videoUrl?: string;
  price: number; // Base price
  discountPrice?: number; // Offer price if any
  rating: number;
  reviewsCount: number;
  reviews: Review[];
  sku: string;
  stock: number;
  variants: ProductVariant[];
  specifications: { key: string; value: string }[];
  features: string[]; // Key feature bullets
  tags: string[];
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isLatest?: boolean;
  isFlashSale?: boolean;
  flashSaleEnds?: string; // ISO String
}

export interface CartItem {
  product: Product;
  selectedVariant?: ProductVariant;
  quantity: number;
}

export type OrderStatus = 'Pending' | 'Confirmed' | 'Preparing' | 'Shipped' | 'Delivered' | 'Cancelled' | 'Returned';

export interface OrderTimelineEvent {
  status: OrderStatus;
  date: string;
  description: string;
}

export interface ShippingDetails {
  name: string;
  phone: string;
  altPhone?: string;
  address: string;
  governorate: string; // Governorate in Arabic
  city: string;
  notes?: string;
}

export interface Order {
  id: string;
  invoiceNumber: string;
  date: string;
  customer: ShippingDetails;
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
  shippingCost: number;
  taxAmount: number;
  total: number;
  status: OrderStatus;
  timeline: OrderTimelineEvent[];
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  minOrderValue?: number;
  isActive: boolean;
}

export interface ActivityLog {
  id: string;
  user: string;
  role: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'stock' | 'review' | 'system';
  isRead: boolean;
  timestamp: string;
}

export interface SystemSettings {
  logoText: string;
  logoSubtext: string;
  primaryColor: string; // hex
  secondaryColor: string; // hex
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTwitter: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImage: string;
  footerText: string;
  taxRate: number; // e.g. 0.14 for 14%
  shippingFlatRate: number; // in EGP or local currency
}

export type UserRole = 'Admin' | 'Manager' | 'Employee' | 'Customer Service' | 'Inventory Manager';

export interface AdminUser {
  id: string;
  username: string;
  role: UserRole;
  permissions: string[];
}
