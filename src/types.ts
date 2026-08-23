export interface Campaign {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  startAt: string;
  endAt: string;
  active: boolean;
  productIds?: string[];
  categoryIds?: string[];
  minimumOrderValue?: number;
  maximumDiscountAmount?: number;
  createdAt: string;
  updatedAt: string;
}

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
  originalPrice?: number;
  discountPrice?: number;
  stock: number;
  sku: string;
  barcode: string;
  qrCode?: string;
  costPrice?: number;
  lowStockThreshold?: number;
  location?: string;
}

export type StockMovementType =
  | 'in_purchase'
  | 'in_adjustment'
  | 'in_return'
  | 'out_sale'
  | 'out_damage'
  | 'out_damaged'
  | 'out_adjustment';

export interface StockMovement {
  id: string;
  productId: string;
  productTitle?: string;
  variantId?: string;
  variantInfo?: string;
  variantSku?: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceId?: string;
  reason?: string;
  createdBy?: string;
  createdAt: string;
  timestamp?: string;
}

export interface AdjustStockParams {
  productId: string;
  variantId?: string;
  type: StockMovementType;
  quantity: number;
  referenceId?: string;
  reason?: string;
  createdBy?: string;
}

export interface Review {
  id: string;
  productId?: string;
  variantId?: string;
  variantInfo?: string;

  customerId?: string;
  customerName?: string;

  orderId?: string;
  orderItemId?: string;

  rating: number; // strictly 1 to 5 integer
  title?: string;
  comment: string;

  status?: 'pending' | 'approved' | 'rejected' | 'hidden';

  isVerifiedPurchase?: boolean;

  adminResponse?: string;
  adminRespondedAt?: string;

  createdAt?: string;
  updatedAt?: string;

  // Legacy fallback fields for backward compatibility
  userName?: string;
  date?: string;
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
  barcode?: string;
  qrCode?: string;
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
  costPrice?: number;
  lowStockThreshold?: number;
  location?: string;
  trackStock?: boolean;
  isReturnable?: boolean;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  date?: string;
  timestamp?: number | string;
}

/**
 * Robust product timestamp resolver.
 * Handles ISO strings, timestamps, various candidate date field names,
 * and falls back safely to 0 or isLatest indicator without throwing errors or mutating items.
 */
export function getProductTimestamp(product?: any): number {
  if (!product || typeof product !== 'object') return 0;

  // 1. Direct valid numeric timestamp
  if (typeof product.timestamp === 'number' && !isNaN(product.timestamp) && isFinite(product.timestamp)) {
    return product.timestamp;
  }

  // 2. Candidate date fields in priority order (parsed strictly as dates)
  const candidateDates = [
    product.createdAt,
    product.created_at,
    product.date,
    product.updatedAt,
    product.updated_at,
    product.timestamp
  ];

  for (const candidate of candidateDates) {
    if (!candidate) continue;
    if (typeof candidate === 'number' && !isNaN(candidate) && isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      const parsed = Date.parse(candidate);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
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
  email?: string;
  altPhone?: string;
  address: string;
  governorate: string; // Governorate in Arabic
  city: string;
  notes?: string;
}

export interface Order {
  id: string;
  userId?: string;
  customerId?: string;
  invoiceNumber: string;
  date: string;
  customer: ShippingDetails;
  items: {
    productId: string;
    productTitle: string;
    variantId?: string;
    variantSku?: string;
    variantInfo?: string;
    quantity: number;
    price: number;
  }[];
  couponCode?: string;
  appliedCampaignId?: string;
  appliedCampaignName?: string;
  campaignDiscount?: number;
  subtotal?: number;
  discount?: number;
  discountAmount: number;
  shippingCost: number;
  tax?: number;
  taxAmount: number;
  total: number;
  status: OrderStatus;
  timeline: OrderTimelineEvent[];
  stockDeducted?: boolean;
}

export type ReturnReason =
  | 'damaged'
  | 'wrong_product'
  | 'different_from_description'
  | 'defective'
  | 'unwanted'
  | 'other';

export type ReturnStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'pickup_pending'
  | 'received'
  | 'completed'
  | 'cancelled';

export type RefundStatus =
  | 'pending'
  | 'approved'
  | 'processed'
  | 'rejected';

export interface ReturnHistoryItem {
  date: string;
  action: string;
  actor: string;
  note?: string;
  status?: ReturnStatus;
  refundStatus?: RefundStatus;
  restocked?: boolean;
  refundAmount?: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderInvoiceNumber?: string;
  customerId?: string;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  orderItemId?: string;
  productId: string;
  productTitle?: string;
  productImage?: string;
  variantId?: string;
  variantSku?: string;
  variantInfo?: string;
  quantity: number;
  unitPrice: number;
  reason: ReturnReason;
  otherReason?: string;
  customerNote?: string;
  images?: string[];
  status: ReturnStatus;
  adminNote?: string;
  refundStatus: RefundStatus;
  refundAmount: number;
  refundMethod?: 'cash' | 'vodafone_cash' | 'instapay' | 'bank_transfer' | 'store_credit' | 'other';
  refundReference?: string;
  restocked?: boolean;
  restockQuantity?: number;
  history?: ReturnHistoryItem[];
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  receivedAt?: string;
  refundedAt?: string;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed' | 'free_shipping';
  value: number; // For percentage or fixed value, 0 for free_shipping
  minOrderValue?: number;
  maxDiscountAmount?: number; // Cap for percentage discounts
  expiryDate?: string; // YYYY-MM-DD
  usageLimit?: number; // Max uses globally
  usedCount: number; // Number of times used
  oneUsePerUser: boolean; // Limit to one use per customer phone/email
  usedByUsers: string[]; // List of customer emails/phones who redeemed this coupon
  totalDiscountGenerated: number; // Analytics total discount EGP generated
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
  type: 'order' | 'stock' | 'campaign' | 'review' | 'supplier' | 'backup' | 'system' | 'security' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  icon?: string;
  read: boolean;
  isRead?: boolean;
  adminId?: string | null;
  createdAt: string;
  timestamp?: string;
  expiresAt?: string | null;
  metadata?: Record<string, any>;
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
  freeShippingThreshold?: number;
  minOrderAmount?: number;
  loyaltyPointsPerEGP?: number;
  loyaltyRedeemRate?: number;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  active?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Permission {
  id: string;
  key: string;
  name: string;
  description?: string;
  group?: string;
  module?: string;
  isSystem?: boolean;
  active?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'Admin' | 'Manager' | 'Employee' | 'Customer Service' | 'Inventory Manager' | string;

export interface CurrentAdmin {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  roleId?: string;
  role?: string;
  permissions?: string[];
  active?: boolean;
}

export interface AdminUser {
  id: string;
  name?: string;
  username?: string;
  email: string;
  phone?: string;
  roleId?: string;
  role?: UserRole;
  permissions?: string[];
  active?: boolean;
  isActive?: boolean;
  isDeleted?: boolean;
  passwordHash?: string;
  salt?: string;
  lastLogin?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionKey: string;
  grantedAt?: string;
}

export interface AdminPermissionOverride {
  id: string;
  adminUserId: string;
  permissionKey: string;
  type: 'allow' | 'deny';
  createdAt?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  desktopImage: string;
  mobileImage: string;
  btnText: string;
  btnLink: string;
  badge?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  isActive: boolean;
  sortOrder: number;
}

export interface ShippingProvince {
  id: string;
  name: string; // Arabic name
  nameEn: string; // English name
  price: number;
  estimatedDays: string;
  isActive: boolean;
  isCodAvailable: boolean;
  freeShippingThreshold?: number;
}

export interface CustomerAddress {
  id: string;
  customerId?: string;
  name: string; // e.g., 'منزل', 'عمل'
  recipientName: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  building?: string;
  apartment?: string;
  postalCode?: string;
  additionalNotes?: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  passwordHash?: string;
  salt?: string;
  status?: 'active' | 'inactive' | 'blocked';
  isVerified: boolean;
  verificationCode?: string;
  resetToken?: string;
  resetTokenExpiry?: string;
  addresses: CustomerAddress[];
  wishlist: string[]; // product IDs
  savedCart: CartItem[]; // saved cart items
  notifications: CustomerNotification[];
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface MediaUsage {
  type: 'product' | 'banner' | 'settings_logo' | 'settings_banner';
  id: string;
  name: string;
}

export interface MediaItem {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl: string;
  size: number;
  type: string;
  dimensions: {
    width: number;
    height: number;
  };
  uploadDate: string;
  hash: string;
  folder?: string;
  title?: string;
  usedBy?: MediaUsage[];
}

export interface InventorySummary {
  totalProducts?: number;
  totalVariants?: number;
  totalStockItems?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  totalValueSell?: number;
  totalValueCost?: number;
  totalStockValue?: number;
  totalCostValue?: number;
}

export type SupplierStatus = 'active' | 'inactive';

export interface Supplier {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  email: string;
  address: string;
  taxNumber?: string;
  notes?: string;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  companyName: string;
  phone: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  notes?: string;
  status?: SupplierStatus;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  variantId?: string;
  productTitle: string;
  variantInfo?: string;
  sku: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierCompanyName?: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  discount?: number;
  shippingCost?: number;
  totalCost: number;
  notes?: string;
  expectedDate?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  receivedBy?: string;
}

export interface PurchaseOrderInput {
  supplierId: string;
  items: {
    productId: string;
    variantId?: string;
    quantityOrdered: number;
    unitCost: number;
  }[];
  discount?: number;
  shippingCost?: number;
  notes?: string;
  expectedDate?: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

