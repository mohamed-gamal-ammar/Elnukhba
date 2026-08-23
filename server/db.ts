import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Product, Order, Coupon, ActivityLog, AuditLog, Notification, SystemSettings, FAQ, OrderStatus, Banner, ShippingProvince, Customer, MediaItem, MediaUsage, StockMovement, AdjustStockParams, Supplier, SupplierInput, SupplierStatus, PurchaseOrder, PurchaseOrderItem, PurchaseOrderInput, PurchaseOrderStatus, Review, Role, Permission, AdminUser, RolePermission, AdminPermissionOverride, ReturnRequest, ReturnReason, ReturnStatus, RefundStatus } from '../src/types.js';
import { assertNumeric, validateBackendNumeric } from './numericValidation.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

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

export interface DatabaseSchema {
  products: Product[];
  orders: Order[];
  coupons: Coupon[];
  faqs: FAQ[];
  logs: ActivityLog[];
  auditLogs?: AuditLog[];
  notifications: Notification[];
  settings: SystemSettings;
  banners: Banner[];
  shippingProvinces: ShippingProvince[];
  customers?: Customer[];
  media?: MediaItem[];
  stockMovements?: StockMovement[];
  suppliers?: Supplier[];
  purchaseOrders?: PurchaseOrder[];
  reviews?: Review[];
  campaigns?: Campaign[];
  returns?: ReturnRequest[];
  roles?: Role[];
  permissions?: Permission[];
  adminUsers?: AdminUser[];
  rolePermissions?: RolePermission[];
  adminPermissionOverrides?: AdminPermissionOverride[];
  admin?: {
    email: string;
    passwordHash: string;
    salt: string;
    name?: string;
    phone?: string;
  };
}

export function sanitizeText(text?: string): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Normalizes Arabic text by removing diacritics, tatweel,
 * normalizing alef variations, alef maqsura, and teh marbuta.
 */
export function normalizeArabicText(text?: string | null): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '') // Remove diacritics
    .replace(/\u0640/g, '')          // Remove tatweel (ـ)
    .replace(/[أإآ]/g, 'ا')          // Normalize alef
    .replace(/ى/g, 'ي')              // Normalize alef maqsura to yaa
    .replace(/ة/g, 'ه')              // Normalize teh marbuta to heh
    .trim();
}

/**
 * Enhanced product search engine with tokenization and relevance scoring.
 */
export function searchProducts<T extends Product>(
  products: T[],
  searchQuery: string,
  sortParam?: string
): T[] {
  if (!searchQuery || !searchQuery.trim()) {
    return products;
  }

  const rawQuery = searchQuery.trim();
  const normalizedQuery = normalizeArabicText(rawQuery);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  if (queryTokens.length === 0) {
    return products;
  }

  const scoredProducts: { product: T; score: number }[] = [];

  for (const product of products) {
    const pTitle = normalizeArabicText(product.title);
    const pTitleEn = normalizeArabicText(product.titleEn);
    const pDesc = normalizeArabicText(product.description);
    const pBrand = normalizeArabicText(product.brand);
    const pCategory = normalizeArabicText(product.category);
    const pTags = (product.tags || []).map(t => normalizeArabicText(t));
    const pSku = normalizeArabicText(product.sku);
    const pBarcode = normalizeArabicText(product.barcode);

    const variantSkus = (product.variants || [])
      .map(v => normalizeArabicText(v.sku))
      .filter(Boolean);
    const variantBarcodes = (product.variants || [])
      .map(v => normalizeArabicText(v.barcode))
      .filter(Boolean);

    // Combine all searchable text fields
    const allSearchableFields = [
      pTitle,
      pTitleEn,
      pDesc,
      pBrand,
      pCategory,
      ...pTags,
      pSku,
      pBarcode,
      ...variantSkus,
      ...variantBarcodes
    ].join(' ');

    // Match logic: every query token must match at least one searchable field
    const allTokensMatch = queryTokens.every(token => allSearchableFields.includes(token));

    if (!allTokensMatch) {
      continue;
    }

    let score = 0;

    // 1. Exact SKU or Barcode Match (Priority 1)
    const isExactSkuBarcode =
      (pSku && (pSku === normalizedQuery || queryTokens.includes(pSku))) ||
      (pBarcode && (pBarcode === normalizedQuery || queryTokens.includes(pBarcode))) ||
      variantSkus.some(s => s === normalizedQuery || queryTokens.includes(s)) ||
      variantBarcodes.some(b => b === normalizedQuery || queryTokens.includes(b));

    if (isExactSkuBarcode) {
      score += 2000;
    }

    // Partial SKU/Barcode match
    if (
      (pSku && pSku.includes(normalizedQuery)) ||
      (pBarcode && pBarcode.includes(normalizedQuery)) ||
      variantSkus.some(s => s.includes(normalizedQuery)) ||
      variantBarcodes.some(b => b.includes(normalizedQuery))
    ) {
      score += 500;
    }

    // 2. Exact Title Match (Priority 2)
    if (pTitle === normalizedQuery || (pTitleEn && pTitleEn === normalizedQuery)) {
      score += 1500;
    }

    // 3. Title startsWith (Priority 3)
    else if (pTitle.startsWith(normalizedQuery) || (pTitleEn && pTitleEn.startsWith(normalizedQuery))) {
      score += 1000;
    }

    // 4. Title contains full normalized query (Priority 4)
    else if (pTitle.includes(normalizedQuery) || (pTitleEn && pTitleEn.includes(normalizedQuery))) {
      score += 700;
    }

    // Score based on token matches in title
    for (const token of queryTokens) {
      if (pTitle.includes(token)) score += 200;
      if (pTitleEn && pTitleEn.includes(token)) score += 200;
    }

    // 5. Brand match (Priority 5)
    if (pBrand === normalizedQuery) {
      score += 600;
    } else if (pBrand.includes(normalizedQuery) || queryTokens.some(t => pBrand.includes(t))) {
      score += 350;
    }

    // 6. Category match (Priority 6)
    if (pCategory === normalizedQuery) {
      score += 500;
    } else if (pCategory.includes(normalizedQuery) || queryTokens.some(t => pCategory.includes(t))) {
      score += 300;
    }

    // 7. Tags match (Priority 7)
    for (const tag of pTags) {
      if (tag === normalizedQuery) score += 400;
      else if (tag.includes(normalizedQuery) || queryTokens.some(t => tag.includes(t))) score += 200;
    }

    // 8. Description match (Priority 8)
    if (pDesc.includes(normalizedQuery)) {
      score += 100;
    } else if (queryTokens.some(t => pDesc.includes(t))) {
      score += 50;
    }

    scoredProducts.push({ product, score });
  }

  // If no explicit sort parameter or sort === 'relevance', sort by score descending
  if (!sortParam || sortParam === 'relevance' || sortParam === '') {
    scoredProducts.sort((a, b) => b.score - a.score);
  }

  return scoredProducts.map(sp => sp.product);
}

export function getRatingDistribution(approvedReviews: Review[]) {
  const distribution: { 1: number; 2: number; 3: number; 4: number; 5: number } = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  };
  for (const r of approvedReviews) {
    if (r.rating >= 1 && r.rating <= 5) {
      const star = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
      distribution[star] = (distribution[star] || 0) + 1;
    }
  }
  return distribution;
}

export function hashPassword(password: string, salt: string = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
  // Use PBKDF2-HMAC-SHA512 with 100,000 iterations (OWASP recommended)
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  if (!password || !storedHash || !salt) return false;
  try {
    const targetBuf = Buffer.from(storedHash, 'hex');

    // 1. Check modern PBKDF2-HMAC-SHA512 (100,000 iterations)
    const modernBuf = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
    if (targetBuf.length === modernBuf.length && crypto.timingSafeEqual(targetBuf, modernBuf)) {
      return true;
    }

    // 2. Check legacy PBKDF2 (1,000 iterations)
    const legacyPbkdf2Buf = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512');
    if (targetBuf.length === legacyPbkdf2Buf.length && crypto.timingSafeEqual(targetBuf, legacyPbkdf2Buf)) {
      return true;
    }

    // 3. Check legacy salted SHA-256 fallback
    const legacySha256Hex = crypto.createHash('sha256').update(password + salt).digest('hex');
    const legacySha256Buf = Buffer.from(legacySha256Hex, 'hex');
    if (targetBuf.length === legacySha256Buf.length && crypto.timingSafeEqual(targetBuf, legacySha256Buf)) {
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

// Initial seed products
const seedProducts: Product[] = [
  {
    id: 'prod-lg-oled-65',
    title: 'شاشة تلفزيون إل جي OLED65C3 65 بوصة ذكية 4K UHD',
    titleEn: 'LG OLED65C3 65 Inch Smart 4K UHD TV',
    description: 'استمتع بتجربة بصرية ثورية مع شاشة إل جي OLED قياس 65 بوصة. تتميز الشاشة بإضاءة ذاتية لوحدات البكسل تمنحك لونًا أسود مثاليًا وتباينًا لا نهائيًا. مع معالج α9 AI Gen6 المتطور، يتم تحسين كل مشهد بذكاء لتقديم تفاصيل سينمائية ومعدل تحديث 120 هرتز مثالي للألعاب الحديثة.',
    brand: 'LG',
    category: 'تلفزيونات وشاشات',
    mainImage: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1558882224-cca166733365?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1461151304267-38535e780c79?auto=format&fit=crop&q=80&w=800'
    ],
    price: 49999,
    discountPrice: 44999,
    rating: 4.8,
    reviewsCount: 3,
    sku: 'LG-OLED-65C3',
    stock: 14,
    tags: ['تلفزيون', 'سمارت', '4K', 'OLED', 'LG', 'ألعاب'],
    features: [
      'تقنية OLED مع وحدات بكسل ذاتية الإضاءة لتباين مثالي ولون أسود مطلق',
      'معالج α9 AI Gen6 من الجيل السادس يدعم ترقية جودة الصورة إلى 4K بذكاء',
      'دعم كامل لتقنيات Dolby Vision IQ و Dolby Atmos لتجربة سينمائية منزلية',
      'معدل تحديث 120 هرتز مع تقنيات G-Sync و FreeSync لضمان سلاسة فائقة للألعاب'
    ],
    specifications: [
      { key: 'الموديل', value: 'OLED65C3' },
      { key: 'حجم الشاشة', value: '65 بوصة' },
      { key: 'درجة الوضوح', value: '3840 * 2160 (4K UHD)' },
      { key: 'نوع الشاشة', value: 'OLED' },
      { key: 'معدل التحديث', value: '120 هرتز' },
      { key: 'نظام التشغيل', value: 'webOS Smart TV' },
      { key: 'الضمان', value: '3 سنوات' }
    ],
    variants: [
      {
        id: 'var-lg-55',
        size: '55 بوصة',
        warranty: '3 سنوات',
        price: 34999,
        stock: 8,
        sku: 'LG-OLED-55C3',
        barcode: '8806091234567'
      },
      {
        id: 'var-lg-65',
        size: '65 بوصة',
        warranty: '3 سنوات',
        price: 44999,
        stock: 6,
        sku: 'LG-OLED-65C3',
        barcode: '8806091234581'
      }
    ],
    reviews: [
      { id: 'r1', userName: 'أحمد محمود', rating: 5, comment: 'أفضل شاشة اشتريتها على الإطلاق! الألوان والتباين خيالية وتجربة البلايستيشن 5 معها لا توصف.', date: '2026-06-15' },
      { id: 'r2', userName: 'سارة خالد', rating: 4, comment: 'شاشة ممتازة جداً ونظام التشغيل سريع وسهل، لكن السعر مرتفع بعض الشيء.', date: '2026-07-02' },
      { id: 'r3', userName: 'عمرو دياب', rating: 5, comment: 'توصيل سريع وتغليف ممتاز. الشاشة تحفة فنية في الصالة.', date: '2026-07-10' }
    ],
    isFeatured: true,
    isBestSeller: true
  },
  {
    id: 'prod-samsung-ref-450',
    title: 'ثلاجة سامسونج ديجيتال إنفرتر نوفروست 450 لتر فضي',
    titleEn: 'Samsung No-Frost Digital Inverter Refrigerator 450L Silver',
    description: 'حافظ على نضارة طعامك لفترة أطول مع ثلاجة سامسونج المتطورة بسعة 450 لتر. بفضل تكنولوجيا الموتور ديجيتال إنفرتر الذكية، توفر الثلاجة في استهلاك الطاقة بنسبة تصل إلى 50٪ وتعمل بهدوء تام مع ضمان 10 سنوات على الموتور. نظام التبريد الشامل يضمن وصول الهواء البارد لكل زاوية بكفاءة متساوية.',
    brand: 'Samsung',
    category: 'ثلاجات وفريزرات',
    mainImage: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1571175432247-fe062a4b8989?auto=format&fit=crop&q=80&w=800'
    ],
    price: 28400,
    discountPrice: 26999,
    rating: 4.6,
    reviewsCount: 2,
    sku: 'SAM-REF-RT45',
    stock: 8,
    tags: ['ثلاجة', 'سامسونج', 'إنفرتر', 'نوفروست', 'مطبخ'],
    features: [
      'تكنولوجيا الضاغط الرقمي العاكس (Digital Inverter) الموفر للطاقة والذكي',
      'نظام نوفروست لمنع تراكم الثلج نهائياً في الفريزر أو كابينة الثلاجة',
      'نظام التبريد الشامل (All-around Cooling) للمحافظة على درجة الحرارة ثابتة',
      'إضاءة LED داخلية ساطعة وموفرة للكهرباء تكشف كل محتويات الثلاجة بسهولة'
    ],
    specifications: [
      { key: 'الموديل', value: 'RT45K6300S8' },
      { key: 'السعة الكلية', value: '450 لتر' },
      { key: 'اللون', value: 'فضي معدني مضاد للبصمات' },
      { key: 'تكنولوجيا موتور', value: 'ديجيتال إنفرتر' },
      { key: 'خاصية نوفروست', value: 'نعم' },
      { key: 'الضمان', value: '10 سنوات على الضاغط' }
    ],
    variants: [
      {
        id: 'var-sam-silver',
        color: 'فضي',
        capacity: '450 لتر',
        warranty: '10 سنوات',
        price: 26999,
        stock: 5,
        sku: 'SAM-REF-RT45-SL',
        barcode: '8806091244009'
      },
      {
        id: 'var-sam-black',
        color: 'أسود زجاجي',
        capacity: '450 لتر',
        warranty: '10 سنوات',
        price: 29500,
        stock: 3,
        sku: 'SAM-REF-RT45-BK',
        barcode: '8806091244016'
      }
    ],
    reviews: [
      { id: 'r4', userName: 'محمد علي', rating: 5, comment: 'صوتها هادئ جداً وتبريدها ممتاز ومساحتها الداخلية منظمة بطريقة رائعة.', date: '2026-05-20' },
      { id: 'r5', userName: 'منى السيد', rating: 4, comment: 'ممتازة واللون الفضي رائع لا يظهر البصمات، لكن الفريزر كان يمكن أن يكون أكبر قليلاً.', date: '2026-06-18' }
    ],
    isFeatured: true,
    isLatest: true
  },
  {
    id: 'prod-toshiba-wash-11',
    title: 'غسالة ملابس توشيبا فوق أوتوماتيك سعة 11 كيلو جرام',
    titleEn: 'Toshiba Top Loading Washing Machine 11kg',
    description: 'اجعل غسيلك اليومي سهلاً وسريعاً مع غسالة توشيبا ذات التحميل العلوي بسعة غسيل 11 كجم. تتميز الغسالة بمروحة هجينة متطورة تمنع تشابك الملابس، مع توفير ذكي ومتقدم في استهلاك المياه والكهرباء ومجموعة برامج متنوعة تناسب كافة أنواع الأقمشة.',
    brand: 'Toshiba',
    category: 'غسالات ومجففات',
    mainImage: 'https://images.unsplash.com/photo-1545173168-9f1947e8017e?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1545173168-9f1947e8017e?auto=format&fit=crop&q=80&w=800'
    ],
    price: 18500,
    discountPrice: 16800,
    rating: 4.5,
    reviewsCount: 2,
    sku: 'TOSH-WASH-11KG',
    stock: 22,
    tags: ['غسالة', 'توشيبا', 'فوق أوتوماتيك', 'غسيل', 'مطبخ'],
    features: [
      'سعة تحميل واسعة 11 كجم مناسبة للعائلات المتوسطة والكبيرة',
      'تصميم مروحة هجين لمنع تشابك وارتداء الملابس أثناء الغسيل المكثف',
      'هيكل معدني قوي مقاوم للصدأ والصدمات لضمان عمر تشغيلي طويل',
      'إيقاف وتوجيه أوتوماتيكي ذكي بعد انتهاء دورة الغسيل بالكامل للسلامة'
    ],
    specifications: [
      { key: 'الموديل', value: 'AEW-E1150UPSS' },
      { key: 'سعة الغسيل', value: '11 كجم' },
      { key: 'نوع التحميل', value: 'تحميل علوي (فوق أوتوماتيك)' },
      { key: 'عدد اللفات', value: '860 لفة في الدقيقة' },
      { key: 'اللون', value: 'فضي سيلفر' },
      { key: 'الضمان', value: '5 سنوات شامل' }
    ],
    variants: [
      {
        id: 'var-tosh-11',
        capacity: '11 كيلو',
        warranty: '5 سنوات',
        price: 16800,
        stock: 12,
        sku: 'TOSH-WASH-11KG',
        barcode: '4904530012345'
      },
      {
        id: 'var-tosh-13',
        capacity: '13 كيلو',
        warranty: '5 سنوات',
        price: 19200,
        stock: 10,
        sku: 'TOSH-WASH-13KG',
        barcode: '4904530012352'
      }
    ],
    reviews: [
      { id: 'r6', userName: 'خالد يوسف', rating: 4, comment: 'غسالة ممتازة وصوتها غير مزعج، تنظف بشكل جيد جداً.', date: '2026-04-10' },
      { id: 'r7', userName: 'هبة مجدي', rating: 5, comment: 'عملية جداً ومريحة في وضع الغسيل من الأعلى وتستوعب البطاطين الخفيفة بسهولة.', date: '2026-07-01' }
    ],
    isFeatured: false,
    isBestSeller: true
  },
  {
    id: 'prod-carrier-air-225',
    title: 'تكييف كاريير إنفرتر بارد/ساخن 2.25 حصان اوبتيماكس',
    titleEn: 'Carrier Optimax Inverter Cool/Heat Air Conditioner 2.25 HP',
    description: 'استمتع بجو مثالي صيفاً وشتاءً مع تكييف كاريير اوبتيماكس إنفرتر بقوة 2.25 حصان. يوفر التكييف حلاً تكنولوجياً متميزاً بتوفير يصل إلى 40% من الطاقة بفضل ضاغط الإنفرتر الذكي، كما يتميز بنظام فلاتر متطور لتنقية الهواء من الميكروبات والغبار والروائح الكريهة.',
    brand: 'Carrier',
    category: 'تكييفات ومراوح',
    mainImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=800'
    ],
    price: 32500,
    discountPrice: 29999,
    rating: 4.7,
    reviewsCount: 1,
    sku: 'CARR-AC-225HP',
    stock: 5,
    tags: ['تكييف', 'كاريير', 'إنفرتر', 'تبريد', 'تدفئة'],
    features: [
      'ضاغط انفرتر ذكي لتوفير استهلاك الكهرباء بنسبة تصل لـ 40٪',
      'فلاتر هواء متطورة لتنقية الأجواء من الفيروسات والميكروبات والغبار',
      'خاصية التشغيل الهادئ والتشخيص الذاتي للأعطال لتسهيل الصيانة',
      'شاشة عرض رقمية مخفية LED جذابة لعرض درجة الحرارة وتفاصيل التشغيل'
    ],
    specifications: [
      { key: 'القدرة حصان', value: '2.25 حصان (يغطي حتى 18 متر مربع)' },
      { key: 'نوع النظام', value: 'بارد وساخن' },
      { key: 'تكنولوجيا توفير', value: 'إنفرتر (Eco-Inverter)' },
      { key: 'نوع الفريون', value: 'R410A صديق البيئة' },
      { key: 'الضمان', value: '5 سنوات على الجهاز بالكامل' }
    ],
    variants: [
      {
        id: 'var-carr-15',
        power: '1.5 حصان',
        warranty: '5 سنوات',
        price: 21999,
        stock: 3,
        sku: 'CARR-AC-15HP',
        barcode: '7451234567891'
      },
      {
        id: 'var-carr-225',
        power: '2.25 حصان',
        warranty: '5 سنوات',
        price: 29999,
        stock: 2,
        sku: 'CARR-AC-225HP',
        barcode: '7451234567892'
      }
    ],
    reviews: [
      { id: 'r8', userName: 'طارق عزيز', rating: 5, comment: 'تبريد سريع جداً وتوفير الكهرباء ملحوظ في الفاتورة، ممتاز!', date: '2026-06-30' }
    ],
    isFeatured: false,
    isLatest: true
  },
  {
    id: 'prod-tornado-blend-15',
    title: 'خلاط كهربائي تورنيدو 1.5 لتر مع مطحنتين بقوة 500 وات',
    titleEn: 'Tornado Electric Blender 1.5L with 2 Grinders 500W',
    description: 'حضر أشهى العصائر والشوربات والصلصات بلمح البصر مع خلاط تورنيدو بقوة 500 وات. يأتي الخلاط بوعاء بلاستيكي متين غير قابل للكسر سعة 1.5 لتر مع شفرات حادة للغاية مصنوعة من الستانلس ستيل، بالإضافة لمطحنتين مخصصتين لطحن البهارات والمكسرات وحبوب القهوة.',
    brand: 'Tornado',
    category: 'أجهزة المطبخ الصغيرة',
    mainImage: 'https://images.unsplash.com/photo-1578643463396-0997cb5328c1?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1578643463396-0997cb5328c1?auto=format&fit=crop&q=80&w=800'
    ],
    price: 1250,
    discountPrice: 999,
    rating: 4.4,
    reviewsCount: 2,
    sku: 'TORN-BLND-500W',
    stock: 35,
    tags: ['خلاط', 'تورنيدو', 'مطبخ', 'أجهزة صغيرة', 'خلاطات'],
    features: [
      'موتور قوي وفعال بقدرة 500 وات مزود بـ 2 سرعات تشغيل وسرعة نبضية',
      'دورق بلاستيكي متين شفاف سعة 1.5 لتر مجهز بمقياس للمعايرة بدقة',
      'مطحنتين مدمجتين لطحن البهارات والمكسرات والبن بسهولة فائقة',
      'قاعدة ثابتة مانعة للانزلاق لضمان أقصى حماية وأمان أثناء الخلط المكثف'
    ],
    specifications: [
      { key: 'الموديل', value: 'MX-500/2' },
      { key: 'القدرة الكهربائية', value: '500 وات' },
      { key: 'سعة الدورق', value: '1.5 لتر' },
      { key: 'عدد المطاحن', value: '2 مطحنة' },
      { key: 'مادة الشفرات', value: 'ستانلس ستيل مضاد للصدأ' },
      { key: 'الضمان', value: 'سنة واحدة شامل' }
    ],
    variants: [
      {
        id: 'var-torn-white',
        color: 'أبيض',
        warranty: 'سنة واحدة',
        price: 999,
        stock: 25,
        sku: 'TORN-BLND-500W-W',
        barcode: '6221234567812'
      },
      {
        id: 'var-torn-black',
        color: 'أسود',
        warranty: 'سنة واحدة',
        price: 1100,
        stock: 10,
        sku: 'TORN-BLND-500W-B',
        barcode: '6221234567829'
      }
    ],
    reviews: [
      { id: 'r9', userName: 'أمل السيد', rating: 4, comment: 'خلاط بسيط وسعره مناسب جداً، المطاحن ممتازة لطحن التوابل.', date: '2026-05-11' },
      { id: 'r10', userName: 'مصطفى قمر', rating: 5, comment: 'ممتاز وعملي وقوي، ماركة تورنيدو دائماً يعتمد عليها.', date: '2026-07-05' }
    ],
    isFeatured: true,
    isFlashSale: true,
    flashSaleEnds: new Date(Date.now() + 86400000 * 3).toISOString() // 3 days from now
  },
  {
    id: 'prod-sharp-micro-25',
    title: 'مايكروويف شارب ديجيتال 25 لتر بالشواية فضي',
    titleEn: 'Sharp Digital Microwave 25L with Grill Silver',
    description: 'وفر وقتك وحضر وجباتك المفضلة وسخنها بسرعة مع مايكروويف شارب بسعة 25 لتر. يحتوي هذا المايكروويف الذكي على شواية مدمجة بقدرة 1000 وات تتيح لك شواء الأطعمة بكفاءة، مع 8 برامج طهي تلقائي معدة مسبقاً وشاشة عرض ديجيتال سهلة الاستخدام.',
    brand: 'Sharp',
    category: 'أجهزة المطبخ الصغيرة',
    mainImage: 'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&q=80&w=800',
    images: [
      'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&q=80&w=800'
    ],
    price: 6800,
    discountPrice: 6200,
    rating: 4.3,
    reviewsCount: 1,
    sku: 'SHRP-MIC-25L-GR',
    stock: 12,
    tags: ['مايكروويف', 'شارب', 'شواية', 'مطبخ', 'أجهزة صغيرة'],
    features: [
      'سعة 25 لتر وقدرة مايكروويف 900 وات مع شواية مدمجة بقدرة 1000 وات',
      '8 برامج طهي أوتوماتيكية مبرمجة مسبقاً (بيتزا، لحوم، خضروات، إلخ)',
      'لوحة تحكم ديجيتال تعمل باللمس بالكامل مع قفل أمان مخصص للأطفال',
      'إمكانية إذابة الثلج السريعة والآمنة حسب الوزن أو الوقت بدقة متناهية'
    ],
    specifications: [
      { key: 'الموديل', value: 'R-750(S)' },
      { key: 'السعة', value: '25 لتر' },
      { key: 'قدرة الشواية', value: '1000 وات' },
      { key: 'اللون', value: 'فضي سيلفر مع باب زجاجي مرآة' },
      { key: 'أبعاد الجهاز', value: '30.7 × 51.3 × 43.0 سم' },
      { key: 'الضمان', value: 'سنتان شامل' }
    ],
    variants: [
      {
        id: 'var-sharp-25',
        capacity: '25 لتر',
        warranty: 'سنتان',
        price: 6200,
        stock: 12,
        sku: 'SHRP-MIC-25L-GR',
        barcode: '4974019201234'
      }
    ],
    reviews: [
      { id: 'r11', userName: 'أحمد نبيل', rating: 4, comment: 'جهاز رائع وسريع في التسخين، الشواية جيدة جداً لعمل السندوتشات والبيتزا السريعة.', date: '2026-06-25' }
    ],
    isFeatured: false,
    isBestSeller: true
  }
];

const seedCoupons: Coupon[] = [
  { code: 'WELCOME10', discountType: 'percentage', value: 10, minOrderValue: 1000, maxDiscountAmount: 300, usedCount: 0, oneUsePerUser: false, usedByUsers: [], totalDiscountGenerated: 0, isActive: true },
  { code: 'EGYPT500', discountType: 'fixed', value: 500, minOrderValue: 5000, usedCount: 0, oneUsePerUser: false, usedByUsers: [], totalDiscountGenerated: 0, isActive: true },
  { code: 'EID2026', discountType: 'percentage', value: 15, minOrderValue: 2000, maxDiscountAmount: 500, usedCount: 0, oneUsePerUser: true, usedByUsers: [], totalDiscountGenerated: 0, isActive: true }
];

const seedFaqs: FAQ[] = [
  { question: 'ما هي طرق الدفع المتاحة في المتجر؟', answer: 'نوفر حالياً طريقة الدفع عند الاستلام (Cash on Delivery) فقط، حيث يمكنك الدفع نقداً أو ببطاقة الائتمان لمندوب الشحن عند استلام طلبك ومراجعته بالكامل.' },
  { question: 'ما هي تكلفة الشحن ومدة التوصيل؟', answer: 'نوفر شحناً سريعاً لجميع محافظات مصر. يستغرق التوصيل عادةً من 2 إلى 4 أيام عمل. تكلفة الشحن موحدة بقيمة 50 جنيهاً مصرياً لجميع المحافظات، وقد تكون مجانية خلال فترات العروض الخاصة.' },
  { question: 'كيف يمكنني تتبع حالة طلبي؟', answer: 'يمكنك تتبع طلبك بسهولة من خلال الضغط على صفحة "تتبع الطلب" في القائمة العلوية أو تذييل الصفحة، ثم إدخال رقم الطلب (Invoice ID) والبريد الإلكتروني أو رقم الهاتف المسجل بالطلب.' },
  { question: 'هل المنتجات المباعة أصلية وتحتوي على ضمان؟', answer: 'نعم، جميع الأجهزة الإلكترونية والمنزلية في متجرنا أصلية 100٪ ومستوردة من الوكلاء الرسميين للعلامات التجارية مباشرة، وتأتي مصحوبة بشهادة الضمان المعتمدة داخل مصر لمدة تتراوح بين سنة إلى 10 سنوات حسب المنتج.' },
  { question: 'ما هي سياسة الاسترجاع أو الاستبدال؟', answer: 'يمكنك استبدال أو استرجاع المنتج خلال 14 يوماً من تاريخ الاستلام بشرط أن يكون المنتج في حالته الأصلية، وفي غلافه الأصلي غير مفتوح ومع كافة ملحقاته وفاتورة الشراء.' }
];

const seedSettings: SystemSettings = {
  logoText: 'النخبة',
  logoSubtext: 'للأجهزة المنزلية والإلكترونيات',
  primaryColor: '#0f172a', // Slate 900
  secondaryColor: '#f59e0b', // Amber 500
  contactPhone: '19999',
  contactEmail: 'support@elite-appliances.com',
  contactAddress: 'شارع التسعين الشمالي، التجمع الخامس، القاهرة، مصر',
  socialFacebook: 'https://facebook.com',
  socialInstagram: 'https://instagram.com',
  socialTwitter: 'https://twitter.com',
  bannerTitle: 'عروض الصيف الكبرى على الأجهزة المنزلية',
  bannerSubtitle: 'وفر حتى 5000 جنيه مصري مع شحن سريع وضمان معتمد يصل إلى 10 سنوات',
  bannerImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=1200',
  footerText: 'جميع الحقوق محفوظة © 2026 شركة النخبة للتجارة والتوزيع. الأجهزة الذكية بين يديك بأفضل الأسعار الممكنة.',
  taxRate: 0.14, // 14% VAT
  shippingFlatRate: 50
};

// Seed historical orders to populate charts
const seedOrders: Order[] = [
  {
    id: 'ORD-1001',
    invoiceNumber: 'INV-2026-1001',
    date: '2026-07-10T14:30:00.000Z',
    customer: {
      name: 'محمود عبد الرحمن',
      phone: '01012345678',
      address: 'عمارة 24، الشارع التجاري، مصر الجديدة',
      governorate: 'القاهرة',
      city: 'مصر الجديدة',
      notes: 'يرجى الاتصال قبل الوصول بنصف ساعة'
    },
    items: [
      {
        productId: 'prod-lg-oled-65',
        productTitle: 'شاشة تلفزيون إل جي OLED65C3 65 بوصة ذكية 4K UHD',
        variantSku: 'LG-OLED-65C3',
        variantInfo: 'حجم الشاشة: 65 بوصة',
        quantity: 1,
        price: 44999
      },
      {
        productId: 'prod-tornado-blend-15',
        productTitle: 'خلاط كهربائي تورنيدو 1.5 لتر مع مطحنتين بقوة 500 وات',
        variantSku: 'TORN-BLND-500W-W',
        variantInfo: 'اللون: أبيض',
        quantity: 1,
        price: 999
      }
    ],
    couponCode: 'WELCOME10',
    discountAmount: 4599.8,
    shippingCost: 50,
    taxAmount: 5795.89,
    total: 47245.09,
    status: 'Delivered',
    timeline: [
      { status: 'Pending', date: '2026-07-10T14:30:00.000Z', description: 'تم استلام الطلب وبانتظار التأكيد' },
      { status: 'Confirmed', date: '2026-07-10T16:00:00.000Z', description: 'تم تأكيد الطلب هاتفياً من قبل خدمة العملاء' },
      { status: 'Preparing', date: '2026-07-11T09:00:00.000Z', description: 'يتم تجهيز المنتجات وتغليفها في المخزن الرئيسي' },
      { status: 'Shipped', date: '2026-07-11T13:45:00.000Z', description: 'تم تسليم الشحنة لشركة الشحن السريع للتوجه لعنوانكم' },
      { status: 'Delivered', date: '2026-07-12T17:30:00.000Z', description: 'تم تسليم الطلب للعميل بنجاح واستلام المبلغ المالي بالكامل' }
    ]
  },
  {
    id: 'ORD-1002',
    invoiceNumber: 'INV-2026-1002',
    date: '2026-07-13T10:15:00.000Z',
    customer: {
      name: 'مريم الصاوي',
      phone: '01234567890',
      address: 'فيلا 3، الحي المتميز، مدينة السادس من أكتوبر',
      governorate: 'الجيزة',
      city: '6 أكتوبر',
      notes: 'التسليم بعد الساعة 4 عصراً فقط'
    },
    items: [
      {
        productId: 'prod-samsung-ref-450',
        productTitle: 'ثلاجة سامسونج ديجيتال إنفرتر نوفروست 450 لتر فضي',
        variantSku: 'SAM-REF-RT45-BK',
        variantInfo: 'اللون: أسود زجاجي',
        quantity: 1,
        price: 29500
      }
    ],
    couponCode: undefined,
    discountAmount: 0,
    shippingCost: 50,
    taxAmount: 4130,
    total: 33680,
    status: 'Shipped',
    timeline: [
      { status: 'Pending', date: '2026-07-13T10:15:00.000Z', description: 'تم استلام الطلب وبانتظار التأكيد' },
      { status: 'Confirmed', date: '2026-07-13T11:30:00.000Z', description: 'تم مراجعة الطلب وتأكيده هاتفياً' },
      { status: 'Preparing', date: '2026-07-14T08:30:00.000Z', description: 'جارٍ تغليف الثلاجة وتحميلها على شاحنة النقل' },
      { status: 'Shipped', date: '2026-07-15T10:00:00.000Z', description: 'الشحنة مع مندوب التوصيل وسيتصل بكم قريباً' }
    ]
  },
  {
    id: 'ORD-1003',
    invoiceNumber: 'INV-2026-1003',
    date: '2026-07-15T18:22:00.000Z',
    customer: {
      name: 'ياسر الشريف',
      phone: '01511223344',
      address: 'شارع الإقبال، سيدي بشر، الإسكندرية',
      governorate: 'الإسكندرية',
      city: 'الإسكندرية',
    },
    items: [
      {
        productId: 'prod-toshiba-wash-11',
        productTitle: 'غسالة ملابس توشيبا فوق أوتوماتيك سعة 11 كيلو جرام',
        variantSku: 'TOSH-WASH-11KG',
        variantInfo: 'السعة: 11 كيلو',
        quantity: 1,
        price: 16800
      }
    ],
    couponCode: undefined,
    discountAmount: 0,
    shippingCost: 50,
    taxAmount: 2352,
    total: 19202,
    status: 'Confirmed',
    timeline: [
      { status: 'Pending', date: '2026-07-15T18:22:00.000Z', description: 'تم تقديم الطلب بنجاح' },
      { status: 'Confirmed', date: '2026-07-15T19:40:00.000Z', description: 'تم تأكيد طلبكم هاتفياً وجارِ تحويله للمخازن' }
    ]
  },
  {
    id: 'ORD-1004',
    invoiceNumber: 'INV-2026-1004',
    date: '2026-07-16T01:00:00.000Z',
    customer: {
      name: 'هاني فريد',
      phone: '01122334455',
      address: 'شارع الجمهورية، المنصورة',
      governorate: 'الدقهلية',
      city: 'المنصورة',
    },
    items: [
      {
        productId: 'prod-sharp-micro-25',
        productTitle: 'مايكروويف شارب ديجيتال 25 لتر بالشواية فضي',
        variantSku: 'SHRP-MIC-25L-GR',
        variantInfo: 'السعة: 25 لتر',
        quantity: 1,
        price: 6200
      }
    ],
    couponCode: 'EGYPT500',
    discountAmount: 500,
    shippingCost: 50,
    taxAmount: 798,
    total: 6548,
    status: 'Pending',
    timeline: [
      { status: 'Pending', date: '2026-07-16T01:00:00.000Z', description: 'تم استلام الطلب من الموقع وفي انتظار مراجعة خدمة العملاء والتأكيد الهاتفي' }
    ]
  }
];

const seedLogs: ActivityLog[] = [
  { id: 'log-1', user: 'أحمد الإدريسي', role: 'Admin', action: 'إنشاء قاعدة البيانات', details: 'تمت تهيئة وتهجير قاعدة بيانات الأجهزة والمنتجات بنجاح لمتجر النخبة الالكتروني', timestamp: '2026-07-10T12:00:00.000Z' },
  { id: 'log-2', user: 'رشا فكري', role: 'Customer Service', action: 'تأكيد طلب العميل', details: 'تم التواصل مع العميل محمود عبد الرحمن وتأكيد الطلب رقم ORD-1001', timestamp: '2026-07-10T16:00:00.000Z' },
  { id: 'log-3', user: 'مصطفى كامل', role: 'Inventory Manager', action: 'تعديل مخزون منتج', details: 'شاشة تلفزيون إل جي OLED65C3 65 بوصة: تم صرف عدد 1 قطعة للطلب ORD-1001 المتبقي: 14', timestamp: '2026-07-11T09:05:00.000Z' }
];

const seedNotifications: Notification[] = [
  { id: 'not-1', title: 'طلب جديد ORD-1004', message: 'طلب جديد من العميل هاني فريد بقيمة 6548 جنيه مصري في انتظار التأكيد.', type: 'order', priority: 'high', icon: 'shopping-cart', read: false, isRead: false, createdAt: '2026-07-16T01:00:00.000Z', timestamp: '2026-07-16T01:00:00.000Z' },
  { id: 'not-2', title: 'مخزون منخفض - تكييف كاريير', message: 'المخزن يحتوي على 5 وحدات فقط من تكييف كاريير إنفرتر 2.25 حصان.', type: 'stock', priority: 'medium', icon: 'package', read: true, isRead: true, createdAt: '2026-07-15T15:30:00.000Z', timestamp: '2026-07-15T15:30:00.000Z' },
  { id: 'not-3', title: 'تقييم إيجابي جديد', message: 'كتب العميل أحمد محمود مراجعة ممتازة من فئة 5 نجوم على شاشة إل جي OLED.', type: 'review', priority: 'low', icon: 'star', read: false, isRead: false, createdAt: '2026-07-15T12:10:00.000Z', timestamp: '2026-07-15T12:10:00.000Z' }
];

export const seedBanners: Banner[] = [
  {
    id: 'banner-1',
    title: 'عروض حصرية لفترة محدودة للأجهزة الكهربائية',
    subtitle: 'وفر لغاية 5,000 ج.م على تشكيلة بوتاجازات وشاشات OLED الكبرى بضمان معتمد',
    desktopImage: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=1200',
    mobileImage: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=800',
    btnText: 'تصفح العروض الآن',
    btnLink: 'products',
    badge: 'عروض حصرية لفترة محدودة',
    isActive: true,
    sortOrder: 1
  },
  {
    id: 'banner-2',
    title: 'جدد بيتك مع أرقى ثلاجات وشاشات OLED',
    subtitle: 'خصومات تصل إلى 15٪ مع ضمان رسمي معتمد وشحن سريع لكافة المحافظات مجاناً!',
    desktopImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=1200',
    mobileImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800',
    btnText: 'تصفح الشاشات الكبرى',
    btnLink: 'products',
    badge: 'أقوى الماركات العالمية (LG, Samsung)',
    isActive: true,
    sortOrder: 2
  },
  {
    id: 'banner-3',
    title: 'مساعد التسوق الذكي بالذكاء الاصطناعي',
    subtitle: 'استشر خبير مبيعاتنا الآلي المدعوم من نموذج Gemini لاختيار الأجهزة الكهربائية التي تلائم بيتك بالتمام!',
    desktopImage: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=1200',
    mobileImage: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=800',
    btnText: 'تحدث مع مساعدنا الذكي',
    btnLink: 'assistant',
    badge: 'ميزة ذكية فريدة',
    isActive: true,
    sortOrder: 3
  }
];

export const seedProvinces: ShippingProvince[] = [
  { id: 'prov-1', name: 'القاهرة', nameEn: 'Cairo', price: 50, estimatedDays: '1-2 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 5000 },
  { id: 'prov-2', name: 'الجيزة', nameEn: 'Giza', price: 50, estimatedDays: '1-2 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 5000 },
  { id: 'prov-3', name: 'الإسكندرية', nameEn: 'Alexandria', price: 70, estimatedDays: '2-3 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 6000 },
  { id: 'prov-4', name: 'القليوبية', nameEn: 'Qalyubia', price: 60, estimatedDays: '2-3 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 5000 },
  { id: 'prov-5', name: 'الدقهلية', nameEn: 'Dakahlia', price: 80, estimatedDays: '3-4 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 7000 },
  { id: 'prov-6', name: 'الشرقية', nameEn: 'Sharqia', price: 80, estimatedDays: '3-4 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 7000 },
  { id: 'prov-7', name: 'المنوفية', nameEn: 'Monufia', price: 70, estimatedDays: '2-3 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 6000 },
  { id: 'prov-8', name: 'الغربية', nameEn: 'Gharbia', price: 70, estimatedDays: '2-3 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 6000 },
  { id: 'prov-9', name: 'البحيرة', nameEn: 'Beheira', price: 80, estimatedDays: '3-4 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 7000 },
  { id: 'prov-10', name: 'الفيوم', nameEn: 'Fayoum', price: 80, estimatedDays: '3-4 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 7000 },
  { id: 'prov-11', name: 'بني سويف', nameEn: 'Beni Suef', price: 90, estimatedDays: '3-4 أيام', isActive: true, isCodAvailable: true },
  { id: 'prov-12', name: 'المنيا', nameEn: 'Minya', price: 90, estimatedDays: '3-4 أيام', isActive: true, isCodAvailable: true },
  { id: 'prov-13', name: 'أسيوط', nameEn: 'Asyut', price: 100, estimatedDays: '4-5 أيام', isActive: true, isCodAvailable: true },
  { id: 'prov-14', name: 'سوهاج', nameEn: 'Sohag', price: 100, estimatedDays: '4-5 أيام', isActive: true, isCodAvailable: true },
  { id: 'prov-15', name: 'قنا', nameEn: 'Qena', price: 110, estimatedDays: '4-5 أيام', isActive: true, isCodAvailable: true },
  { id: 'prov-16', name: 'الأقصر', nameEn: 'Luxor', price: 120, estimatedDays: '4-5 أيام', isActive: true, isCodAvailable: true },
  { id: 'prov-17', name: 'أسوان', nameEn: 'Aswan', price: 130, estimatedDays: '5-6 أيام', isActive: true, isCodAvailable: true },
  { id: 'prov-18', name: 'دمياط', nameEn: 'Damietta', price: 80, estimatedDays: '2-3 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 7000 },
  { id: 'prov-19', name: 'بورسعيد', nameEn: 'Port Said', price: 80, estimatedDays: '2-3 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 7000 },
  { id: 'prov-20', name: 'الإسماعيلية', nameEn: 'Ismailia', price: 80, estimatedDays: '2-3 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 7000 },
  { id: 'prov-21', name: 'السويس', nameEn: 'Suez', price: 80, estimatedDays: '2-3 أيام', isActive: true, isCodAvailable: true, freeShippingThreshold: 7000 },
  { id: 'prov-22', name: 'البحر الأحمر', nameEn: 'Red Sea', price: 150, estimatedDays: '5-6 أيام', isActive: true, isCodAvailable: false }
];

export const seedSuppliers: Supplier[] = [
  {
    id: 'sup-1',
    name: 'م. أحمد العربي',
    companyName: 'شركة العربي للتجارة والتوزيع',
    phone: '01012345678',
    email: 'contact@elarabygroup.com',
    address: 'المنطقة الصناعية، كفر الزيات، الغربية',
    taxNumber: '100-200-300',
    notes: 'مورد رئيسي لأجهزة توشيبا وتورنيدو وإل جي',
    status: 'active',
    createdAt: new Date('2026-01-10').toISOString(),
    updatedAt: new Date('2026-01-10').toISOString()
  },
  {
    id: 'sup-2',
    name: 'أ. محمود سامي',
    companyName: 'الشركة الدولية للأجهزة الكهربائية',
    phone: '01198765432',
    email: 'sales@inter-electric.eg',
    address: 'شارع التحرير، الدقي، الجيزة',
    taxNumber: '400-500-600',
    notes: 'مورد معتمد لشاشات سامسونج وأجهزة التكييف',
    status: 'active',
    createdAt: new Date('2026-02-01').toISOString(),
    updatedAt: new Date('2026-02-01').toISOString()
  }
];

export const seedRoles: Role[] = [
  {
    id: 'role-super-admin',
    name: 'Super Admin',
    description: 'مدير النظام الأعلى - كامل الصلاحيات والتحكم الإداري',
    isSystem: true,
    active: true,
    isDeleted: false,
    createdAt: new Date('2026-08-01').toISOString(),
    updatedAt: new Date('2026-08-01').toISOString()
  },
  {
    id: 'role-store-manager',
    name: 'Store Manager',
    description: 'مدير المتجر - إدارة المنتجات والطلبات والعملاء والخصومات',
    isSystem: true,
    active: true,
    isDeleted: false,
    createdAt: new Date('2026-08-01').toISOString(),
    updatedAt: new Date('2026-08-01').toISOString()
  },
  {
    id: 'role-inventory-manager',
    name: 'Inventory Manager',
    description: 'مدير المخزون - إدارة حركة المخزون والموردين وأوامر الشراء',
    isSystem: true,
    active: true,
    isDeleted: false,
    createdAt: new Date('2026-08-01').toISOString(),
    updatedAt: new Date('2026-08-01').toISOString()
  },
  {
    id: 'role-marketing',
    name: 'Marketing',
    description: 'التسويق - إدارة الحملات الترويجية والكوبونات والتحليلات',
    isSystem: true,
    active: true,
    isDeleted: false,
    createdAt: new Date('2026-08-01').toISOString(),
    updatedAt: new Date('2026-08-01').toISOString()
  },
  {
    id: 'role-customer-support',
    name: 'Customer Support',
    description: 'خدمة العملاء - متابعة الطلبات والعملاء والرد على التقييمات',
    isSystem: true,
    active: true,
    isDeleted: false,
    createdAt: new Date('2026-08-01').toISOString(),
    updatedAt: new Date('2026-08-01').toISOString()
  }
];

export const seedPermissions: Permission[] = [
  { id: 'perm-1', key: 'products.view', name: 'عرض المنتجات', group: 'products', module: 'products', description: 'عرض قائمة المنتجات وتفاصيلها', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-2', key: 'products.create', name: 'إضافة منتجات', group: 'products', module: 'products', description: 'إضافة منتجات جديدة للمتجر', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-3', key: 'products.edit', name: 'تعديل المنتجات', group: 'products', module: 'products', description: 'تعديل بيانات وأسعار ومخزون المنتجات', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-4', key: 'products.delete', name: 'حذف المنتجات', group: 'products', module: 'products', description: 'حذف المنتجات من المتجر', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-5', key: 'orders.view', name: 'عرض الطلبات', group: 'orders', module: 'orders', description: 'عرض الطلبات والفواتير', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-6', key: 'orders.edit', name: 'تعديل الطلبات', group: 'orders', module: 'orders', description: 'تحديث حالة الطلبات وتفاصيل الشحن', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-7', key: 'orders.cancel', name: 'إلغاء الطلبات', group: 'orders', module: 'orders', description: 'إلغاء الطلبات', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-8', key: 'customers.view', name: 'عرض العملاء', group: 'customers', module: 'customers', description: 'عرض بيانات وسجل العملاء', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-9', key: 'customers.edit', name: 'تعديل العملاء', group: 'customers', module: 'customers', description: 'تعديل وحظر حسابات العملاء', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-10', key: 'campaigns.manage', name: 'إدارة الحملات', group: 'campaigns', module: 'campaigns', description: 'إدارة الحملات الترويجية والكوبونات', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-11', key: 'analytics.view', name: 'عرض التحليلات', group: 'analytics', module: 'analytics', description: 'عرض التقارير والتحليلات المالية', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-12', key: 'settings.manage', name: 'إدارة الإعدادات', group: 'settings', module: 'settings', description: 'إدارة إعدادات النظام والشحن', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-13', key: 'admins.manage', name: 'إدارة المشرفين', group: 'admins', module: 'admins', description: 'إدارة المدراء والصلاحيات والأدوار', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-14', key: 'inventory.view', name: 'عرض المخزون', group: 'inventory', module: 'inventory', description: 'عرض حركة المخزون والموردين وأوامر الشراء', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-15', key: 'inventory.manage', name: 'إدارة المخزون', group: 'inventory', module: 'inventory', description: 'تسوية المخزون وإدارة الموردين وأوامر الشراء', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-16', key: 'reviews.manage', name: 'إدارة التقييمات', group: 'reviews', module: 'reviews', description: 'الموافقة على التقييمات وتعديلها وحذفها', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-17', key: 'media.manage', name: 'إدارة الوسائط', group: 'media', module: 'media', description: 'رفع وإدارة الصور والملفات', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-18', key: 'returns.view', name: 'عرض طلبات الإرجاع', group: 'returns', module: 'returns', description: 'عرض قائمة وحالة طلبات الإرجاع', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' },
  { id: 'perm-19', key: 'returns.manage', name: 'إدارة طلبات الإرجاع', group: 'returns', module: 'returns', description: 'الموافقة أو الرفض وتحديث حالة الإرجاع والاسترداد', isSystem: true, active: true, isDeleted: false, createdAt: '2026-08-01T00:00:00.000Z' }
];

export const seedRolePermissions: RolePermission[] = seedPermissions.map((p, idx) => ({
  id: `rp-super-${idx + 1}`,
  roleId: 'role-super-admin',
  permissionKey: p.key,
  grantedAt: new Date('2026-08-01').toISOString()
}));

export const seedAdminUsers: AdminUser[] = [
  {
    id: 'admin-1',
    name: 'أحمد الإدريسي',
    username: 'admin',
    email: 'admin@store.com',
    roleId: 'role-super-admin',
    role: 'Admin',
    permissions: seedPermissions.map(p => p.key),
    active: true,
    isActive: true,
    isDeleted: false,
    createdAt: new Date('2026-08-01').toISOString(),
    updatedAt: new Date('2026-08-01').toISOString()
  }
];

export const seedAdminPermissionOverrides: AdminPermissionOverride[] = [];

// Initialize and Load DB helper
export function initDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const defaultAdmin = {
    email: 'admin@store.com',
    ...hashPassword('Admin@123456')
  };

  const seedLegacyReviews: Review[] = [];
  for (const p of seedProducts) {
    if (Array.isArray(p.reviews)) {
      for (const rev of p.reviews) {
        seedLegacyReviews.push({
          id: rev.id || `legacy_${p.id}_${Math.random().toString(36).substring(2, 8)}`,
          productId: p.id,
          customerId: 'legacy_customer',
          customerName: rev.userName || 'عميل سابق',
          rating: Math.min(5, Math.max(1, Math.round(Number(rev.rating) || 5))),
          comment: rev.comment || '',
          status: 'approved',
          isVerifiedPurchase: false,
          createdAt: rev.date ? new Date(rev.date).toISOString() : new Date().toISOString(),
          userName: rev.userName,
          date: rev.date
        });
      }
    }
  }

  if (!fs.existsSync(DB_FILE)) {
    const defaultDb: DatabaseSchema = {
      products: seedProducts,
      orders: seedOrders,
      coupons: seedCoupons,
      faqs: seedFaqs,
      logs: seedLogs,
      auditLogs: [],
      notifications: seedNotifications,
      settings: seedSettings,
      banners: seedBanners,
      shippingProvinces: seedProvinces,
      customers: [],
      media: [],
      stockMovements: [],
      suppliers: seedSuppliers,
      purchaseOrders: [],
      reviews: seedLegacyReviews,
      campaigns: [],
      returns: [],
      roles: seedRoles,
      permissions: seedPermissions,
      adminUsers: seedAdminUsers,
      rolePermissions: seedRolePermissions,
      adminPermissionOverrides: seedAdminPermissionOverrides,
      admin: {
        email: defaultAdmin.email,
        passwordHash: defaultAdmin.hash,
        salt: defaultAdmin.salt,
        name: 'أحمد الإدريسي',
        phone: ''
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
    return defaultDb;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content) as DatabaseSchema;
    let modified = false;
    if (!parsed.admin) {
      parsed.admin = {
        email: defaultAdmin.email,
        passwordHash: defaultAdmin.hash,
        salt: defaultAdmin.salt,
        name: 'أحمد الإدريسي',
        phone: ''
      };
      modified = true;
    } else {
      if (parsed.admin.name === undefined) {
        parsed.admin.name = 'أحمد الإدريسي';
        modified = true;
      }
      if (parsed.admin.phone === undefined) {
        parsed.admin.phone = '';
        modified = true;
      }
    }
    if (!parsed.reviews) {
      parsed.reviews = [];
      modified = true;
    }
    if (!parsed.auditLogs) {
      parsed.auditLogs = [];
      modified = true;
    }
    if (!parsed.returns) {
      parsed.returns = [];
      modified = true;
    }
    if (parsed.reviews.length === 0 && Array.isArray(parsed.products)) {
      for (const prod of parsed.products) {
        if (Array.isArray(prod.reviews) && prod.reviews.length > 0) {
          for (const legacyRev of prod.reviews) {
            const legacyId = legacyRev.id || `legacy_${prod.id}_${Math.random().toString(36).substring(2, 8)}`;
            const migratedRev: Review = {
              id: legacyId,
              productId: prod.id,
              customerId: 'legacy_customer',
              customerName: legacyRev.userName || 'عميل سابق',
              rating: Math.min(5, Math.max(1, Math.round(Number(legacyRev.rating) || 5))),
              comment: legacyRev.comment || '',
              status: 'approved',
              isVerifiedPurchase: false,
              createdAt: legacyRev.date ? new Date(legacyRev.date).toISOString() : new Date().toISOString(),
              userName: legacyRev.userName,
              date: legacyRev.date
            };
            parsed.reviews.push(migratedRev);
            modified = true;
          }
        }
      }
    }
    if (!parsed.customers) {
      parsed.customers = [];
      modified = true;
    } else {
      parsed.customers = parsed.customers.map(c => {
        if (!Array.isArray(c.wishlist)) {
          c.wishlist = [];
          modified = true;
        }
        if (!Array.isArray(c.addresses)) {
          c.addresses = [];
          modified = true;
        }
        if (!Array.isArray(c.notifications)) {
          c.notifications = [];
          modified = true;
        }
        return c;
      });
    }
    if (!parsed.banners) {
      parsed.banners = seedBanners;
      modified = true;
    }
    if (!parsed.shippingProvinces || parsed.shippingProvinces.length === 0) {
      parsed.shippingProvinces = seedProvinces;
      modified = true;
    }
    if (!parsed.media) {
      parsed.media = [];
      modified = true;
    }
    if (!parsed.stockMovements) {
      parsed.stockMovements = [];
      modified = true;
    }
    if (!parsed.suppliers) {
      parsed.suppliers = seedSuppliers;
      modified = true;
    }
    if (!parsed.purchaseOrders) {
      parsed.purchaseOrders = [];
      modified = true;
    }
    if (!parsed.campaigns) {
      parsed.campaigns = [];
      modified = true;
    }
    if (!parsed.roles || parsed.roles.length === 0) {
      parsed.roles = seedRoles;
      modified = true;
    } else {
      const systemRoleIds = new Set(['role-super-admin', 'role-store-manager', 'role-inventory-manager', 'role-marketing', 'role-customer-support']);
      parsed.roles = parsed.roles.map(r => {
        const isSys = r.isSystem !== undefined ? r.isSystem : systemRoleIds.has(r.id);
        const act = r.active !== undefined ? r.active : true;
        const del = r.isDeleted !== undefined ? r.isDeleted : false;
        if (r.isSystem !== isSys || r.active !== act || r.isDeleted !== del) {
          modified = true;
        }
        return {
          ...r,
          isSystem: isSys,
          active: act,
          isDeleted: del
        };
      });
    }
    if (!parsed.permissions || parsed.permissions.length === 0) {
      parsed.permissions = seedPermissions;
      modified = true;
    } else {
      parsed.permissions = parsed.permissions.map(p => {
        const grp = p.group || p.module || '';
        const isSys = p.isSystem !== undefined ? p.isSystem : (p.id ? p.id.startsWith('perm-') : true);
        const act = p.active !== undefined ? p.active : true;
        const del = p.isDeleted !== undefined ? p.isDeleted : false;
        if (p.group !== grp || p.isSystem !== isSys || p.active !== act || p.isDeleted !== del) {
          modified = true;
        }
        return {
          ...p,
          group: grp,
          module: p.module || grp,
          isSystem: isSys,
          active: act,
          isDeleted: del
        };
      });

      // Ensure any newly added seed permissions (like returns.view & returns.manage) are synced in
      for (const sp of seedPermissions) {
        const exists = parsed.permissions.some(p => p.key === sp.key);
        if (!exists) {
          parsed.permissions.push(sp);
          modified = true;
        }
      }
    }
    if (!parsed.adminUsers || parsed.adminUsers.length === 0) {
      parsed.adminUsers = seedAdminUsers;
      modified = true;
    } else {
      parsed.adminUsers = parsed.adminUsers.map(u => {
        if (u.id === 'admin-1' || u.roleId === 'role-super-admin') {
          const currentPerms = Array.isArray(u.permissions) ? u.permissions : [];
          const missingPerms = seedPermissions.map(p => p.key).filter(k => !currentPerms.includes(k));
          if (missingPerms.length > 0) {
            u.permissions = [...currentPerms, ...missingPerms];
            modified = true;
          }
        }
        return u;
      });
    }
    if (!parsed.rolePermissions || parsed.rolePermissions.length === 0) {
      parsed.rolePermissions = seedRolePermissions;
      modified = true;
    } else {
      // Ensure super-admin role has all seed permissions
      const superAdminRPs = parsed.rolePermissions.filter(rp => rp.roleId === 'role-super-admin');
      for (const sp of seedPermissions) {
        if (!superAdminRPs.some(rp => rp.permissionKey === sp.key)) {
          parsed.rolePermissions.push({
            id: `rp-super-${sp.key.replace('.', '-')}`,
            roleId: 'role-super-admin',
            permissionKey: sp.key,
            grantedAt: new Date().toISOString()
          });
          modified = true;
        }
      }
    }
    if (!parsed.adminPermissionOverrides) {
      parsed.adminPermissionOverrides = seedAdminPermissionOverrides;
      modified = true;
    }
    if (parsed.products) {
      parsed.products = parsed.products.map(p => {
        let pModified = false;
        let mainImage = p.mainImage;
        if (typeof mainImage === 'string' && mainImage.includes('&#x2F;')) {
          mainImage = mainImage.replace(/&#x2F;/g, '/');
          pModified = true;
        }
        let images = p.images;
        if (Array.isArray(images)) {
          const cleanedImages = images.map(img => typeof img === 'string' && img.includes('&#x2F;') ? img.replace(/&#x2F;/g, '/') : img);
          if (JSON.stringify(cleanedImages) !== JSON.stringify(images)) {
            images = cleanedImages;
            pModified = true;
          }
        }

        const variants = (p.variants || []).map(v => {
          const vStock = typeof v.stock === 'number' ? v.stock : 0;
          if (v.stock !== vStock) pModified = true;
          return {
            ...v,
            stock: vStock,
            lowStockThreshold: typeof v.lowStockThreshold === 'number' ? v.lowStockThreshold : 5
          };
        });
        
        let calculatedStock = typeof p.stock === 'number' ? p.stock : 0;
        if (variants.length > 0) {
          const sumVarStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
          if (calculatedStock !== sumVarStock) {
            calculatedStock = sumVarStock;
            pModified = true;
          }
        }
        if (pModified) modified = true;
        
        return {
          ...p,
          mainImage,
          images,
          stock: calculatedStock,
          variants,
          lowStockThreshold: typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 5,
          trackStock: typeof p.trackStock === 'boolean' ? p.trackStock : true
        };
      });
    }
    if (parsed.banners) {
      parsed.banners = parsed.banners.map(b => {
        let bMod = false;
        let desktopImage = b.desktopImage;
        let mobileImage = b.mobileImage;
        if (typeof desktopImage === 'string' && desktopImage.includes('&#x2F;')) {
          desktopImage = desktopImage.replace(/&#x2F;/g, '/');
          bMod = true;
        }
        if (typeof mobileImage === 'string' && mobileImage.includes('&#x2F;')) {
          mobileImage = mobileImage.replace(/&#x2F;/g, '/');
          bMod = true;
        }
        if (bMod) {
          modified = true;
          return { ...b, desktopImage, mobileImage };
        }
        return b;
      });
    }
    if (parsed.media) {
      parsed.media = parsed.media.map(m => {
        if (typeof m.url === 'string' && m.url.includes('&#x2F;')) {
          modified = true;
          return { ...m, url: m.url.replace(/&#x2F;/g, '/') };
        }
        return m;
      });
    }
    if (parsed.settings) {
      if (typeof parsed.settings.bannerImage === 'string' && parsed.settings.bannerImage.includes('&#x2F;')) {
        parsed.settings.bannerImage = parsed.settings.bannerImage.replace(/&#x2F;/g, '/');
        modified = true;
      }
      const anySettings = parsed.settings as any;
      if (typeof anySettings.logoUrl === 'string' && anySettings.logoUrl.includes('&#x2F;')) {
        anySettings.logoUrl = anySettings.logoUrl.replace(/&#x2F;/g, '/');
        modified = true;
      }
      if (typeof anySettings.faviconUrl === 'string' && anySettings.faviconUrl.includes('&#x2F;')) {
        anySettings.faviconUrl = anySettings.faviconUrl.replace(/&#x2F;/g, '/');
        modified = true;
      }
    }
    if (parsed.coupons) {
      parsed.coupons = parsed.coupons.map(c => {
        const updated = {
          ...c,
          discountType: c.discountType || 'percentage',
          value: typeof c.value === 'number' ? c.value : 0,
          usedCount: typeof c.usedCount === 'number' ? c.usedCount : 0,
          usedByUsers: Array.isArray(c.usedByUsers) ? c.usedByUsers : [],
          totalDiscountGenerated: typeof c.totalDiscountGenerated === 'number' ? c.totalDiscountGenerated : 0,
          oneUsePerUser: typeof c.oneUsePerUser === 'boolean' ? c.oneUsePerUser : false,
          isActive: typeof c.isActive === 'boolean' ? c.isActive : true
        };
        if (JSON.stringify(updated) !== JSON.stringify(c)) {
          modified = true;
        }
        return updated;
      });
    }
    if (modified) {
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    }
    return parsed;
  } catch (error) {
    console.error('Failed to read database, returning default', error);
    return {
      products: seedProducts,
      orders: seedOrders,
      coupons: seedCoupons,
      faqs: seedFaqs,
      logs: seedLogs,
      notifications: seedNotifications,
      settings: seedSettings,
      banners: seedBanners,
      shippingProvinces: seedProvinces,
      customers: [],
      media: [],
      stockMovements: [],
      suppliers: seedSuppliers,
      purchaseOrders: [],
      reviews: [],
      campaigns: [],
      roles: seedRoles,
      permissions: seedPermissions,
      adminUsers: seedAdminUsers,
      rolePermissions: seedRolePermissions,
      adminPermissionOverrides: seedAdminPermissionOverrides,
      admin: {
        email: defaultAdmin.email,
        passwordHash: defaultAdmin.hash,
        salt: defaultAdmin.salt
      }
    };
  }
}

// Save DB helper with safe atomic writing to prevent partial writes
export function saveDb(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempFile, payload, 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Failed to write database file', error);
  }
}

// Database helper functions for API
export const db = {
  getRoles: () => {
    const data = initDb();
    return data.roles || [];
  },
  getRoleById: (id: string) => {
    const data = initDb();
    return (data.roles || []).find(r => r.id === id);
  },
  getRoleByName: (name: string) => {
    const data = initDb();
    const cleanName = name.trim().toLowerCase();
    return (data.roles || []).find(r => !r.isDeleted && r.name && r.name.trim().toLowerCase() === cleanName);
  },
  createRole: (role: Role) => {
    const data = initDb();
    if (!data.roles) data.roles = [];
    data.roles.push(role);
    saveDb(data);
    return role;
  },
  updateRole: (id: string, updates: Partial<Role>) => {
    const data = initDb();
    if (!data.roles) data.roles = [];
    const idx = data.roles.findIndex(r => r.id === id);
    if (idx === -1) return null;
    data.roles[idx] = {
      ...data.roles[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveDb(data);
    return data.roles[idx];
  },
  deleteRole: (id: string) => {
    const data = initDb();
    if (!data.roles) data.roles = [];
    const idx = data.roles.findIndex(r => r.id === id);
    if (idx === -1) return false;
    data.roles[idx].isDeleted = true;
    data.roles[idx].active = false;
    data.roles[idx].updatedAt = new Date().toISOString();
    saveDb(data);
    return true;
  },
  getPermissions: () => {
    const data = initDb();
    return data.permissions || [];
  },
  getPermissionById: (id: string) => {
    const data = initDb();
    return (data.permissions || []).find(p => p.id === id);
  },
  getPermissionByKey: (key: string) => {
    const data = initDb();
    const cleanKey = key.trim().toLowerCase();
    return (data.permissions || []).find(p => !p.isDeleted && p.key && p.key.trim().toLowerCase() === cleanKey);
  },
  getPermissionByName: (name: string) => {
    const data = initDb();
    const cleanName = name.trim().toLowerCase();
    return (data.permissions || []).find(p => !p.isDeleted && p.name && p.name.trim().toLowerCase() === cleanName);
  },
  createPermission: (perm: Permission) => {
    const data = initDb();
    if (!data.permissions) data.permissions = [];
    data.permissions.push(perm);
    saveDb(data);
    return perm;
  },
  updatePermission: (id: string, updates: Partial<Permission>) => {
    const data = initDb();
    if (!data.permissions) data.permissions = [];
    const idx = data.permissions.findIndex(p => p.id === id);
    if (idx === -1) return null;
    data.permissions[idx] = {
      ...data.permissions[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveDb(data);
    return data.permissions[idx];
  },
  deletePermission: (id: string) => {
    const data = initDb();
    if (!data.permissions) data.permissions = [];
    const idx = data.permissions.findIndex(p => p.id === id);
    if (idx === -1) return false;
    data.permissions[idx].isDeleted = true;
    data.permissions[idx].active = false;
    data.permissions[idx].updatedAt = new Date().toISOString();
    saveDb(data);
    return true;
  },
  getAdminUsers: () => {
    const data = initDb();
    return data.adminUsers || [];
  },
  getAdminUserById: (id: string) => {
    const data = initDb();
    return (data.adminUsers || []).find(u => u.id === id);
  },
  getAdminUserByEmail: (email: string) => {
    const data = initDb();
    const cleanEmail = email.toLowerCase().trim();
    return (data.adminUsers || []).find(u => u.email && u.email.toLowerCase().trim() === cleanEmail);
  },
  createAdminUser: (user: AdminUser) => {
    const data = initDb();
    if (!data.adminUsers) data.adminUsers = [];
    data.adminUsers.push(user);
    saveDb(data);
    return user;
  },
  updateAdminUser: (id: string, updates: Partial<AdminUser>) => {
    const data = initDb();
    if (!data.adminUsers) data.adminUsers = [];
    const idx = data.adminUsers.findIndex(u => u.id === id);
    if (idx === -1) return null;
    data.adminUsers[idx] = {
      ...data.adminUsers[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    saveDb(data);
    return data.adminUsers[idx];
  },
  deleteAdminUser: (id: string) => {
    const data = initDb();
    if (!data.adminUsers) data.adminUsers = [];
    const idx = data.adminUsers.findIndex(u => u.id === id);
    if (idx === -1) return false;
    data.adminUsers[idx].isDeleted = true;
    data.adminUsers[idx].active = false;
    data.adminUsers[idx].isActive = false;
    data.adminUsers[idx].updatedAt = new Date().toISOString();
    saveDb(data);
    return true;
  },
  getRolePermissions: () => {
    const data = initDb();
    return data.rolePermissions || [];
  },
  setRolePermissions: (roleId: string, permissionKeys: string[]) => {
    const data = initDb();
    if (!data.rolePermissions) data.rolePermissions = [];
    data.rolePermissions = data.rolePermissions.filter(rp => rp.roleId !== roleId);
    
    const now = new Date().toISOString();
    const newMappings: RolePermission[] = permissionKeys.map((key, index) => ({
      id: `rp-${roleId}-${index}-${Date.now()}`,
      roleId,
      permissionKey: key,
      grantedAt: now
    }));

    data.rolePermissions.push(...newMappings);
    saveDb(data);
    return newMappings;
  },
  getAdminPermissionOverrides: () => {
    const data = initDb();
    return data.adminPermissionOverrides || [];
  },
  getAdmin: () => {
    const data = initDb();
    return data.admin;
  },
  updateAdminProfile: (updates: { name?: string; email?: string; phone?: string }) => {
    const data = initDb();
    if (!data.admin) {
      data.admin = {
        email: 'admin@store.com',
        passwordHash: '',
        salt: '',
        name: 'أحمد الإدريسي',
        phone: ''
      };
    }
    if (updates.name !== undefined) {
      data.admin.name = updates.name.trim();
    }
    if (updates.email !== undefined) {
      data.admin.email = updates.email.trim();
    }
    if (updates.phone !== undefined) {
      data.admin.phone = updates.phone.trim();
    }
    saveDb(data);
    return data.admin;
  },
  updateAdminPassword: (newPasswordHash: string, newSalt: string) => {
    const data = initDb();
    if (!data.admin) {
      data.admin = {
        email: 'admin@store.com',
        passwordHash: newPasswordHash,
        salt: newSalt
      };
    } else {
      data.admin.passwordHash = newPasswordHash;
      data.admin.salt = newSalt;
    }
    saveDb(data);
    db.logAction('Admin', 'تغيير كلمة المرور', 'تم تحديث كلمة مرور مدير النظام بنجاح');
    return true;
  },
  getProducts: () => {
    const data = initDb();
    return data.products;
  },
  getProductById: (id: string) => {
    const data = initDb();
    return data.products.find(p => p.id === id);
  },
  getRecommendations: (productId: string, limit: number = 8): Product[] => {
    const data = initDb();
    const target = data.products.find(p => p.id === productId);
    if (!target) return [];

    const targetPrice = target.discountPrice || target.price || 0;
    const minPrice = targetPrice * 0.7;
    const maxPrice = targetPrice * 1.3;

    // Filter out target product & hidden products
    const candidates = data.products.filter(p => {
      if (p.id === productId) return false;
      if ((p as any).isHidden === true || (p as any).status === 'hidden') return false;
      return true;
    });

    const scoreProduct = (p: Product): number => {
      let score = 0;
      // 1. Same category (highest priority)
      if (p.category && target.category && p.category.toLowerCase().trim() === target.category.toLowerCase().trim()) {
        score += 1000;
      }
      // 2. Same brand
      if (p.brand && target.brand && p.brand.toLowerCase().trim() === target.brand.toLowerCase().trim()) {
        score += 500;
      }
      // 3. Similar price range (±30%)
      const pPrice = p.discountPrice || p.price || 0;
      if (pPrice >= minPrice && pPrice <= maxPrice) {
        score += 300;
      }
      // 4. Higher rating
      score += (p.rating || 0) * 20;
      // 5. Featured products as tie-breaker
      if (p.isFeatured) {
        score += 50;
      }
      return score;
    };

    // Separate in-stock and out-of-stock
    const inStockCandidates = candidates.filter(p => p.stock > 0);
    const outOfStockCandidates = candidates.filter(p => p.stock <= 0);

    const sortedInStock = [...inStockCandidates].sort((a, b) => scoreProduct(b) - scoreProduct(a));
    const sortedOutOfStock = [...outOfStockCandidates].sort((a, b) => scoreProduct(b) - scoreProduct(a));

    let result = sortedInStock.slice(0, limit);
    if (result.length < limit) {
      const remainingNeeded = limit - result.length;
      result = [...result, ...sortedOutOfStock.slice(0, remainingNeeded)];
    }

    return result;
  },
  getCustomersAlsoBought: (productId: string, limit: number = 8): Product[] => {
    const data = initDb();
    const target = data.products.find(p => p.id === productId);
    if (!target) return [];

    // 1. Analyze completed/delivered orders containing the target product
    const relevantOrders = (data.orders || []).filter(order => {
      const statusStr = (order.status as string || '').toLowerCase();
      if (statusStr !== 'completed' && statusStr !== 'delivered') return false;
      const items = order.items || (order as any).cartItems || [];
      return items.some((item: any) => (item.productId || item.id) === productId);
    });

    // 2. Count frequency of all other products purchased together with it
    const freqMap = new Map<string, number>();
    for (const order of relevantOrders) {
      const items = order.items || (order as any).cartItems || [];
      const seenInOrder = new Set<string>();
      for (const item of items) {
        const pId = item.productId || item.id;
        if (pId && pId !== productId && !seenInOrder.has(pId)) {
          seenInOrder.add(pId);
          freqMap.set(pId, (freqMap.get(pId) || 0) + 1);
        }
      }
    }

    // 3. Collect candidate products from database (excluding target & hidden)
    const validCandidates = data.products.filter(p => {
      if (p.id === productId) return false;
      if ((p as any).isHidden === true || (p as any).status === 'hidden') return false;
      return true;
    });

    // Separate co-bought candidates (frequency > 0) and remaining candidates
    const coBoughtList: { product: Product; freq: number }[] = [];
    const remainingList: Product[] = [];

    for (const p of validCandidates) {
      const freq = freqMap.get(p.id) || 0;
      if (freq > 0) {
        coBoughtList.push({ product: p, freq });
      } else {
        remainingList.push(p);
      }
    }

    // Sort co-bought products by:
    // 1. Frequency descending
    // 2. In-stock preferred (stock > 0)
    // 3. Higher rating
    coBoughtList.sort((a, b) => {
      if (b.freq !== a.freq) return b.freq - a.freq;
      const aInStock = a.product.stock > 0 ? 1 : 0;
      const bInStock = b.product.stock > 0 ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;
      return (b.product.rating || 0) - (a.product.rating || 0);
    });

    // Sort remaining candidates by:
    // 1. In-stock preferred (stock > 0)
    // 2. Higher rating
    remainingList.sort((a, b) => {
      const aInStock = a.stock > 0 ? 1 : 0;
      const bInStock = b.stock > 0 ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;
      return (b.rating || 0) - (a.rating || 0);
    });

    const resultProducts = coBoughtList.map(item => item.product);

    if (resultProducts.length < limit) {
      const needed = limit - resultProducts.length;
      resultProducts.push(...remainingList.slice(0, needed));
    }

    return resultProducts.slice(0, limit);
  },
  getBestSellingProducts: (limit: number = 8): Product[] => {
    const data = initDb();

    // 1. Calculate total quantity sold for each product across completed/delivered orders
    const quantitySoldMap = new Map<string, number>();
    const completedOrders = (data.orders || []).filter(order => {
      const statusStr = (order.status as string || '').toLowerCase();
      return statusStr === 'completed' || statusStr === 'delivered';
    });

    for (const order of completedOrders) {
      const items = order.items || (order as any).cartItems || [];
      for (const item of items) {
        const pId = item.productId || item.id;
        const qty = Number(item.quantity) || 1;
        if (pId) {
          quantitySoldMap.set(pId, (quantitySoldMap.get(pId) || 0) + qty);
        }
      }
    }

    // 2. Filter out hidden or deleted products
    const validProducts = data.products.filter(p => {
      if ((p as any).isHidden === true || (p as any).status === 'hidden' || (p as any).isDeleted === true) return false;
      return true;
    });

    // 3. Rank products by TOTAL quantity sold, preferring products in stock, then highest rated
    const bestSellersList: { product: Product; qtySold: number }[] = [];
    const fallbackList: Product[] = [];

    for (const p of validProducts) {
      const qtySold = quantitySoldMap.get(p.id) || 0;
      if (qtySold > 0) {
        bestSellersList.push({ product: p, qtySold });
      } else {
        fallbackList.push(p);
      }
    }

    bestSellersList.sort((a, b) => {
      // 1. Total quantity sold descending
      if (b.qtySold !== a.qtySold) return b.qtySold - a.qtySold;
      // 2. Prefer products currently in stock
      const aInStock = a.product.stock > 0 ? 1 : 0;
      const bInStock = b.product.stock > 0 ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;
      // 3. Higher rating
      return (b.product.rating || 0) - (a.product.rating || 0);
    });

    fallbackList.sort((a, b) => {
      // 1. Prefer products currently in stock
      const aInStock = a.stock > 0 ? 1 : 0;
      const bInStock = b.stock > 0 ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;
      // 2. Higher rating
      return (b.rating || 0) - (a.rating || 0);
    });

    const result = bestSellersList.map(item => item.product);

    if (result.length < limit) {
      const needed = limit - result.length;
      result.push(...fallbackList.slice(0, needed));
    }

    return result.slice(0, limit);
  },
  getTrendingProducts: (limit: number = 8): Product[] => {
    const data = initDb();

    // 1. Analyze completed/delivered orders from the last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentOrders = (data.orders || []).filter(order => {
      const statusStr = (order.status as string || '').toLowerCase();
      if (statusStr !== 'completed' && statusStr !== 'delivered') return false;
      const dateStr = (order as any).createdAt || order.date;
      const orderTime = dateStr ? new Date(dateStr).getTime() : 0;
      return orderTime >= thirtyDaysAgo;
    });

    const recentQtyMap = new Map<string, number>();
    for (const order of recentOrders) {
      const items = order.items || (order as any).cartItems || [];
      for (const item of items) {
        const pId = item.productId || item.id;
        const qty = Number(item.quantity) || 1;
        if (pId) {
          recentQtyMap.set(pId, (recentQtyMap.get(pId) || 0) + qty);
        }
      }
    }

    // 2. Filter out hidden or deleted products
    const validProducts = data.products.filter(p => {
      if ((p as any).isHidden === true || (p as any).status === 'hidden' || (p as any).isDeleted === true) return false;
      return true;
    });

    // 3. Score products: recent sales quantity + small boost for new arrivals
    const trendingList: { product: Product; score: number }[] = [];
    const fallbackList: Product[] = [];

    for (const p of validProducts) {
      const recentQty = recentQtyMap.get(p.id) || 0;
      const isNew = p.isLatest || (p as any).isNewArrival || (p as any).isNew;
      const boost = isNew ? 2 : 0;
      const score = recentQty + boost;

      if (recentQty > 0 || isNew) {
        trendingList.push({ product: p, score });
      } else {
        fallbackList.push(p);
      }
    }

    trendingList.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aInStock = a.product.stock > 0 ? 1 : 0;
      const bInStock = b.product.stock > 0 ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;
      return (b.product.rating || 0) - (a.product.rating || 0);
    });

    fallbackList.sort((a, b) => {
      const aInStock = a.stock > 0 ? 1 : 0;
      const bInStock = b.stock > 0 ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;
      return (b.rating || 0) - (a.rating || 0);
    });

    const result = trendingList.map(item => item.product);

    if (result.length < limit) {
      const needed = limit - result.length;
      result.push(...fallbackList.slice(0, needed));
    }

    return result.slice(0, limit);
  },
  getNewestProducts: (limit: number = 8): Product[] => {
    const data = initDb();

    // 1. Filter out hidden or deleted products
    const validProducts = data.products.filter(p => {
      if ((p as any).isHidden === true || (p as any).status === 'hidden' || (p as any).isDeleted === true) return false;
      return true;
    });

    // 2. Rank products:
    // a. In-stock preferred (stock > 0)
    // b. Newest createdAt / date timestamp
    // c. isLatest / isNewArrival / isNew boolean flag
    // d. Rating as tie-breaker
    const sorted = [...validProducts].sort((a, b) => {
      const aInStock = a.stock > 0 ? 1 : 0;
      const bInStock = b.stock > 0 ? 1 : 0;
      if (bInStock !== aInStock) return bInStock - aInStock;

      const aTimeStr = (a as any).createdAt || (a as any).date;
      const bTimeStr = (b as any).createdAt || (b as any).date;
      const aTime = aTimeStr ? new Date(aTimeStr).getTime() : 0;
      const bTime = bTimeStr ? new Date(bTimeStr).getTime() : 0;

      if (aTime !== bTime) {
        return bTime - aTime;
      }

      const aIsNew = (a.isLatest || (a as any).isNewArrival || (a as any).isNew) ? 1 : 0;
      const bIsNew = (b.isLatest || (b as any).isNewArrival || (b as any).isNew) ? 1 : 0;
      if (bIsNew !== aIsNew) return bIsNew - aIsNew;

      return (b.rating || 0) - (a.rating || 0);
    });

    return sorted.slice(0, limit);
  },
  validateBarcodeUniqueness: (barcode: string, excludeProductId?: string, excludeVariantId?: string): { isValid: boolean; errorMessage?: string } => {
    if (!barcode || !barcode.trim()) {
      return { isValid: true };
    }
    const cleanBarcode = barcode.trim();
    const data = initDb();

    for (const product of data.products) {
      // Check main product barcode
      if (product.barcode && product.barcode.trim() === cleanBarcode) {
        if (product.id !== excludeProductId) {
          return {
            isValid: false,
            errorMessage: `الباركود مستخدم بالفعل بواسطة منتج آخر: "${product.title}"`
          };
        }
      }

      // Check variant barcodes
      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          if (variant.barcode && variant.barcode.trim() === cleanBarcode) {
            if (product.id !== excludeProductId || variant.id !== excludeVariantId) {
              const vInfo = [variant.size, variant.color, variant.capacity, variant.model].filter(Boolean).join(' - ') || variant.id;
              return {
                isValid: false,
                errorMessage: `الباركود مستخدم بالفعل بواسطة متغير آخر للمنتج "${product.title}" (${vInfo})`
              };
            }
          }
        }
      }
    }

    return { isValid: true };
  },
  generateUniqueBarcode: (): string => {
    const data = initDb();
    const existingBarcodes = new Set<string>();

    for (const p of data.products) {
      if (p.barcode) existingBarcodes.add(p.barcode.trim());
      if (p.variants) {
        for (const v of p.variants) {
          if (v.barcode) existingBarcodes.add(v.barcode.trim());
        }
      }
    }

    let barcode = '';
    do {
      const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
      barcode = `200${randomDigits}`;
      let sum = 0;
      for (let i = 0; i < barcode.length; i++) {
        const digit = parseInt(barcode[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      barcode += checkDigit.toString();
    } while (existingBarcodes.has(barcode));

    return barcode;
  },
  getProductByBarcode: (barcode: string) => {
    if (!barcode || !barcode.trim()) return null;
    const clean = barcode.trim();
    const data = initDb();

    for (const product of data.products) {
      // Check main product barcode
      if (product.barcode && product.barcode.trim().toLowerCase() === clean.toLowerCase()) {
        return {
          product,
          variant: undefined,
          productId: product.id,
          variantId: undefined,
          title: product.title,
          sku: product.sku,
          barcode: product.barcode,
          qrCode: product.qrCode || `QR-${product.id}`,
          currentStock: product.stock,
          price: product.discountPrice || product.price,
          costPrice: product.costPrice || 0,
          location: product.location || 'المستودع الرئيسي'
        };
      }

      // Check variants
      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          if (variant.barcode && variant.barcode.trim().toLowerCase() === clean.toLowerCase()) {
            const parts = [variant.size, variant.color, variant.capacity, variant.model].filter(Boolean);
            const variantInfo = parts.join(' / ') || `موديل #${variant.id}`;
            return {
              product,
              variant,
              productId: product.id,
              variantId: variant.id,
              title: `${product.title} (${variantInfo})`,
              sku: variant.sku || product.sku,
              barcode: variant.barcode,
              qrCode: variant.qrCode || `QR-${product.id}-${variant.id}`,
              currentStock: variant.stock,
              price: variant.price,
              costPrice: variant.costPrice || product.costPrice || 0,
              location: variant.location || product.location || 'المستودع الرئيسي'
            };
          }
        }
      }
    }

    return null;
  },

  validateQrCodeUniqueness: (qrCode: string, excludeProductId?: string, excludeVariantId?: string): { isValid: boolean; errorMessage?: string } => {
    if (!qrCode || !qrCode.trim()) {
      return { isValid: true };
    }
    const cleanQr = qrCode.trim();
    const data = initDb();

    for (const product of data.products) {
      if (product.qrCode && product.qrCode.trim() === cleanQr) {
        if (product.id !== excludeProductId) {
          return {
            isValid: false,
            errorMessage: `رمز الـ QR مستخدم بالفعل بواسطة منتج آخر: "${product.title}"`
          };
        }
      }

      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          if (variant.qrCode && variant.qrCode.trim() === cleanQr) {
            if (product.id !== excludeProductId || variant.id !== excludeVariantId) {
              const vInfo = [variant.size, variant.color, variant.capacity, variant.model].filter(Boolean).join(' - ') || variant.id;
              return {
                isValid: false,
                errorMessage: `رمز الـ QR مستخدم بالفعل بواسطة متغير آخر للمنتج "${product.title}" (${vInfo})`
              };
            }
          }
        }
      }
    }

    return { isValid: true };
  },

  generateUniqueQrCode: (productId?: string, variantId?: string): string => {
    const data = initDb();
    const existingQrs = new Set<string>();

    for (const p of data.products) {
      if (p.qrCode) existingQrs.add(p.qrCode.trim());
      if (p.variants) {
        for (const v of p.variants) {
          if (v.qrCode) existingQrs.add(v.qrCode.trim());
        }
      }
    }

    let code = '';
    const prefix = variantId ? `QR-${productId || 'P'}-${variantId}` : `QR-${productId || 'P'}`;
    let attempts = 0;
    do {
      attempts++;
      const rand = Math.floor(100000 + Math.random() * 900000);
      code = attempts === 1 && productId ? `${prefix}` : `${prefix}-${rand}`;
    } while (existingQrs.has(code));

    return code;
  },

  getProductByQrCode: (qrCode: string) => {
    if (!qrCode || !qrCode.trim()) return null;
    const clean = qrCode.trim().toLowerCase();
    const data = initDb();

    // 1. Direct match on qrCode
    for (const product of data.products) {
      if (product.qrCode && product.qrCode.trim().toLowerCase() === clean) {
        return {
          product,
          variant: undefined,
          productId: product.id,
          variantId: undefined,
          title: product.title,
          sku: product.sku,
          barcode: product.barcode,
          qrCode: product.qrCode,
          currentStock: product.stock,
          price: product.discountPrice || product.price,
          costPrice: product.costPrice || 0,
          location: product.location || 'المستودع الرئيسي',
          mainImage: product.mainImage
        };
      }

      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          if (variant.qrCode && variant.qrCode.trim().toLowerCase() === clean) {
            const parts = [variant.size, variant.color, variant.capacity, variant.model].filter(Boolean);
            const variantInfo = parts.join(' / ') || `موديل #${variant.id}`;
            return {
              product,
              variant,
              productId: product.id,
              variantId: variant.id,
              title: `${product.title} (${variantInfo})`,
              sku: variant.sku || product.sku,
              barcode: variant.barcode,
              qrCode: variant.qrCode,
              currentStock: variant.stock,
              price: variant.price,
              costPrice: variant.costPrice || product.costPrice || 0,
              location: variant.location || product.location || 'المستودع الرئيسي',
              mainImage: product.mainImage
            };
          }
        }
      }
    }

    // 2. Fallback: match by barcode, sku, or ID
    const barcodeMatch = db.getProductByBarcode(qrCode);
    if (barcodeMatch) {
      return {
        ...barcodeMatch,
        qrCode: barcodeMatch.variant?.qrCode || barcodeMatch.product.qrCode || `QR-${barcodeMatch.productId}${barcodeMatch.variantId ? '-' + barcodeMatch.variantId : ''}`,
        mainImage: barcodeMatch.product.mainImage
      };
    }

    // 3. Fallback search by ID or SKU
    for (const product of data.products) {
      if (product.id.toLowerCase() === clean || product.sku.toLowerCase() === clean) {
        return {
          product,
          variant: undefined,
          productId: product.id,
          variantId: undefined,
          title: product.title,
          sku: product.sku,
          barcode: product.barcode,
          qrCode: product.qrCode || `QR-${product.id}`,
          currentStock: product.stock,
          price: product.discountPrice || product.price,
          costPrice: product.costPrice || 0,
          location: product.location || 'المستودع الرئيسي',
          mainImage: product.mainImage
        };
      }

      if (product.variants && Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          if (variant.id.toLowerCase() === clean || (variant.sku && variant.sku.toLowerCase() === clean)) {
            const parts = [variant.size, variant.color, variant.capacity, variant.model].filter(Boolean);
            const variantInfo = parts.join(' / ') || `موديل #${variant.id}`;
            return {
              product,
              variant,
              productId: product.id,
              variantId: variant.id,
              title: `${product.title} (${variantInfo})`,
              sku: variant.sku || product.sku,
              barcode: variant.barcode,
              qrCode: variant.qrCode || `QR-${product.id}-${variant.id}`,
              currentStock: variant.stock,
              price: variant.price,
              costPrice: variant.costPrice || product.costPrice || 0,
              location: variant.location || product.location || 'المستودع الرئيسي',
              mainImage: product.mainImage
            };
          }
        }
      }
    }

    return null;
  },
  addProduct: (product: Product) => {
    // Strict Numeric Assertions
    product.price = assertNumeric(product.price, 'positive_decimal', { required: true, fieldNameArabic: 'سعر المنتج' })!;
    if (product.discountPrice !== undefined && product.discountPrice !== null) {
      product.discountPrice = assertNumeric(product.discountPrice, 'non_negative_decimal', { fieldNameArabic: 'سعر الخصم' });
      if (product.discountPrice !== undefined && product.discountPrice > product.price) {
        throw new Error('سعر الخصم لا يمكن أن يكون أكبر من السعر الأصلي');
      }
    }
    product.stock = assertNumeric(product.stock ?? 0, 'non_negative_integer', { required: true, fieldNameArabic: 'كمية المخزون' })!;
    if (product.rating !== undefined && product.rating !== null) {
      product.rating = assertNumeric(product.rating, 'non_negative_decimal', { min: 0, max: 5, fieldNameArabic: 'التقييم' })!;
    }
    if (product.reviewsCount !== undefined && product.reviewsCount !== null) {
      product.reviewsCount = assertNumeric(product.reviewsCount, 'non_negative_integer', { fieldNameArabic: 'عدد التقييمات' })!;
    }

    if (product.barcode) {
      product.barcode = product.barcode.trim();
      const v = db.validateBarcodeUniqueness(product.barcode);
      if (!v.isValid) throw new Error(v.errorMessage);
    }
    if (product.qrCode) {
      product.qrCode = product.qrCode.trim();
      const v = db.validateQrCodeUniqueness(product.qrCode);
      if (!v.isValid) throw new Error(v.errorMessage);
    } else {
      product.qrCode = db.generateUniqueQrCode(product.id);
    }

    if (product.variants && Array.isArray(product.variants)) {
      product.variants.forEach(v => {
        v.price = assertNumeric(v.price, 'positive_decimal', { required: true, fieldNameArabic: 'سعر الموديل' })!;
        v.stock = assertNumeric(v.stock, 'non_negative_integer', { required: true, fieldNameArabic: 'مخزون الموديل' })!;
        if (v.originalPrice !== undefined && v.originalPrice !== null) {
          v.originalPrice = assertNumeric(v.originalPrice, 'non_negative_decimal', { fieldNameArabic: 'السعر قبل الخصم للموديل' });
        }
        if (v.costPrice !== undefined && v.costPrice !== null) {
          v.costPrice = assertNumeric(v.costPrice, 'non_negative_decimal', { fieldNameArabic: 'سعر التكلفة للموديل' });
        }

        if (v.barcode) {
          v.barcode = v.barcode.trim();
          const check = db.validateBarcodeUniqueness(v.barcode, undefined, v.id);
          if (!check.isValid) throw new Error(check.errorMessage);
        }
        if (v.qrCode) {
          v.qrCode = v.qrCode.trim();
          const check = db.validateQrCodeUniqueness(v.qrCode, undefined, v.id);
          if (!check.isValid) throw new Error(check.errorMessage);
        } else {
          v.qrCode = db.generateUniqueQrCode(product.id, v.id);
        }
      });
    }

    const data = initDb();
    data.products.push(product);
    saveDb(data);
    db.logAction('Admin', 'إضافة منتج جديد', `تمت إضافة المنتج ${product.title} بنجاح`);
    return product;
  },
  updateProduct: (id: string, updatedFields: Partial<Product>) => {
    const data = initDb();
    const index = data.products.findIndex(p => p.id === id);
    if (index === -1) return null;

    // Strict Numeric Assertions for Updated Fields
    if (updatedFields.price !== undefined) {
      updatedFields.price = assertNumeric(updatedFields.price, 'positive_decimal', { required: true, fieldNameArabic: 'سعر المنتج' })!;
    }
    if (updatedFields.discountPrice !== undefined) {
      if (updatedFields.discountPrice === null || (updatedFields.discountPrice as any) === '') {
        updatedFields.discountPrice = undefined;
      } else {
        updatedFields.discountPrice = assertNumeric(updatedFields.discountPrice, 'non_negative_decimal', { fieldNameArabic: 'سعر الخصم' });
        const effectivePrice = updatedFields.price !== undefined ? updatedFields.price : data.products[index].price;
        if (updatedFields.discountPrice !== undefined && updatedFields.discountPrice > effectivePrice) {
          throw new Error('سعر الخصم لا يمكن أن يكون أكبر من السعر الأصلي');
        }
      }
    }
    if (updatedFields.stock !== undefined) {
      updatedFields.stock = assertNumeric(updatedFields.stock, 'non_negative_integer', { required: true, fieldNameArabic: 'كمية المخزون' })!;
    }
    if (updatedFields.rating !== undefined) {
      updatedFields.rating = assertNumeric(updatedFields.rating, 'non_negative_decimal', { min: 0, max: 5, fieldNameArabic: 'التقييم' })!;
    }
    if (updatedFields.reviewsCount !== undefined) {
      updatedFields.reviewsCount = assertNumeric(updatedFields.reviewsCount, 'non_negative_integer', { fieldNameArabic: 'عدد التقييمات' })!;
    }

    const existingProduct = data.products[index];
    const newBarcode = updatedFields.barcode !== undefined ? updatedFields.barcode?.trim() : existingProduct.barcode;
    const newQrCode = updatedFields.qrCode !== undefined ? updatedFields.qrCode?.trim() : existingProduct.qrCode;
    const newVariants = updatedFields.variants !== undefined ? updatedFields.variants : existingProduct.variants;

    if (newBarcode) {
      const v = db.validateBarcodeUniqueness(newBarcode, id);
      if (!v.isValid) throw new Error(v.errorMessage);
    }

    if (newQrCode) {
      const v = db.validateQrCodeUniqueness(newQrCode, id);
      if (!v.isValid) throw new Error(v.errorMessage);
    }

    if (newVariants && Array.isArray(newVariants)) {
      for (const variant of newVariants) {
        if (variant.price !== undefined) {
          variant.price = assertNumeric(variant.price, 'positive_decimal', { required: true, fieldNameArabic: 'سعر الموديل' })!;
        }
        if (variant.stock !== undefined) {
          variant.stock = assertNumeric(variant.stock, 'non_negative_integer', { required: true, fieldNameArabic: 'مخزون الموديل' })!;
        }
        if (variant.originalPrice !== undefined && variant.originalPrice !== null) {
          variant.originalPrice = assertNumeric(variant.originalPrice, 'non_negative_decimal', { fieldNameArabic: 'السعر قبل الخصم للموديل' });
        }
        if (variant.costPrice !== undefined && variant.costPrice !== null) {
          variant.costPrice = assertNumeric(variant.costPrice, 'non_negative_decimal', { fieldNameArabic: 'سعر التكلفة للموديل' });
        }

        if (variant.barcode) {
          const v = db.validateBarcodeUniqueness(variant.barcode, id, variant.id);
          if (!v.isValid) throw new Error(v.errorMessage);
        }
        if (variant.qrCode) {
          const v = db.validateQrCodeUniqueness(variant.qrCode, id, variant.id);
          if (!v.isValid) throw new Error(v.errorMessage);
        }
      }
    }

    if (updatedFields.barcode !== undefined) {
      updatedFields.barcode = updatedFields.barcode ? updatedFields.barcode.trim() : undefined;
    }
    if (updatedFields.qrCode !== undefined) {
      updatedFields.qrCode = updatedFields.qrCode ? updatedFields.qrCode.trim() : undefined;
    }

    if (updatedFields.variants && Array.isArray(updatedFields.variants)) {
      updatedFields.variants.forEach(v => {
        if (v.barcode) v.barcode = v.barcode.trim();
        if (v.qrCode) v.qrCode = v.qrCode.trim();
      });
    }

    data.products[index] = { ...data.products[index], ...updatedFields };
    saveDb(data);
    db.logAction('Admin', 'تعديل منتج', `تم تعديل مواصفات المنتج: ${data.products[index].title}`);
    return data.products[index];
  },
  deleteProduct: (id: string) => {
    const data = initDb();
    const index = data.products.findIndex(p => p.id === id);
    if (index === -1) return false;
    const prod = data.products[index];
    const title = prod.title;

    // Collect all local uploaded image paths of this product
    const imagesToDelete = new Set<string>();
    if (prod.mainImage && prod.mainImage.startsWith('/uploads/')) {
      imagesToDelete.add(prod.mainImage);
    }
    if (Array.isArray(prod.images)) {
      prod.images.forEach(img => {
        if (img && img.startsWith('/uploads/')) {
          imagesToDelete.add(img);
        }
      });
    }

    // Now remove the product from list
    data.products.splice(index, 1);

    // Clean up deleted product ID from all customers' wishlists
    if (Array.isArray(data.customers)) {
      data.customers.forEach(cust => {
        if (Array.isArray(cust.wishlist) && cust.wishlist.includes(id)) {
          cust.wishlist = cust.wishlist.filter(wId => wId !== id);
        }
      });
    }

    // Filter out images that are still used by other products
    data.products.forEach(p => {
      if (p.mainImage) imagesToDelete.delete(p.mainImage);
      if (Array.isArray(p.images)) {
        p.images.forEach(img => imagesToDelete.delete(img));
      }
    });

    // Delete unused files
    imagesToDelete.forEach(imgUrl => {
      const relativePath = imgUrl.replace(/^\//, ''); // e.g. "uploads/abc.jpg"
      const fullPath = path.join(process.cwd(), 'public', relativePath);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log('Deleted unused image:', fullPath);
        }
      } catch (err) {
        console.error('Failed to delete unused image file:', fullPath, err);
      }
    });

    saveDb(data);
    db.logAction('Admin', 'حذف منتج', `تم حذف المنتج ${title} نهائياً من العرض وتنظيف الصور غير المستخدمة`);
    return true;
  },
  getOrders: () => {
    const data = initDb();
    return data.orders;
  },
  getOrderById: (id: string) => {
    const data = initDb();
    return data.orders.find(o => o.id === id || o.invoiceNumber === id);
  },
  createOrder: (order: Order) => {
    const data = initDb();

    // Strict Numeric Assertions on Order totals and Items
    order.total = assertNumeric(order.total, 'non_negative_decimal', { required: true, fieldNameArabic: 'إجمالي الطلب' })!;
    if (order.subtotal !== undefined) {
      order.subtotal = assertNumeric(order.subtotal, 'non_negative_decimal', { fieldNameArabic: 'المجموع الفرعي للطلب' });
    }
    if (order.shippingCost !== undefined) {
      order.shippingCost = assertNumeric(order.shippingCost, 'non_negative_decimal', { fieldNameArabic: 'تكلفة الشحن للطلب' });
    }
    if (order.discount !== undefined) {
      order.discount = assertNumeric(order.discount, 'non_negative_decimal', { fieldNameArabic: 'مبلغ الخصم' });
    }
    if (order.tax !== undefined) {
      order.tax = assertNumeric(order.tax, 'non_negative_decimal', { fieldNameArabic: 'مبلغ الضريبة' });
    }

    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      throw new Error('الطلب يجب أن يحتوي على عنصر واحد على الأقل');
    }

    // 1. Validate stock availability for all items before making any mutations
    for (const item of order.items) {
      item.quantity = assertNumeric(item.quantity, 'positive_integer', { required: true, min: 1, fieldNameArabic: 'كمية المنتج بالطلب' })!;
      item.price = assertNumeric(item.price, 'non_negative_decimal', { required: true, fieldNameArabic: 'سعر المنتج بالطلب' })!;

      const prod = data.products.find(p => p.id === item.productId);
      if (!prod) {
        throw new Error(`المنتج غير موجود: ${item.productTitle || item.productId}`);
      }

      let targetVariantId = item.variantId;
      if (!targetVariantId && item.variantSku && prod.variants) {
        const vMatch = prod.variants.find(v => v.sku === item.variantSku || v.id === item.variantSku);
        if (vMatch) targetVariantId = vMatch.id;
      }

      if (targetVariantId) {
        const variant = prod.variants?.find(v => v.id === targetVariantId);
        if (!variant) {
          throw new Error(`الموديل المحدد غير موجود للمنتج "${prod.title}"`);
        }
        if ((variant.stock || 0) < item.quantity) {
          throw new Error(`المخزون غير كافٍ للموديل في المنتج "${prod.title}". المتاح: ${variant.stock || 0}، المطلوب: ${item.quantity}`);
        }
      } else {
        if ((prod.stock || 0) < item.quantity) {
          throw new Error(`المخزون غير كافٍ للمنتج "${prod.title}". المتاح: ${prod.stock || 0}، المطلوب: ${item.quantity}`);
        }
      }
    }

    // 2. Perform actual stock deduction via db.adjustStock if not already deducted
    if (!order.stockDeducted) {
      for (const item of order.items) {
        const prod = data.products.find(p => p.id === item.productId);
        let targetVariantId = item.variantId;
        if (!targetVariantId && item.variantSku && prod?.variants) {
          const vMatch = prod.variants.find(v => v.sku === item.variantSku || v.id === item.variantSku);
          if (vMatch) targetVariantId = vMatch.id;
        }

        db.adjustStock({
          productId: item.productId,
          variantId: targetVariantId || undefined,
          type: 'out_sale',
          quantity: item.quantity,
          referenceId: order.id,
          reason: 'طلب عميل',
          createdBy: 'النظام'
        });
      }
      order.stockDeducted = true;
    }

    // 3. Save order & system notification
    const freshDb = initDb();
    freshDb.orders.unshift(order);

    const nowIso = new Date().toISOString();
    const newNotification: Notification = {
      id: `not-${Date.now()}`,
      title: `طلب جديد ${order.id}`,
      message: `طلب جديد من العميل ${order.customer.name} بقيمة ${order.total} ج.م بانتظار تأكيد الشحن والاتصال الهاتفي.`,
      type: 'order',
      priority: 'high',
      icon: 'shopping-cart',
      read: false,
      isRead: false,
      createdAt: nowIso,
      timestamp: nowIso,
      metadata: { orderId: order.id, customerName: order.customer.name, total: order.total }
    };
    freshDb.notifications.unshift(newNotification);

    // 4. Send customer notification if linked to registered customer
    if (freshDb.customers) {
      const email = (order.customer?.email || '').toLowerCase().trim();
      const phone = (order.customer?.phone || '').trim();
      let targetCust = freshDb.customers.find(c =>
        (order.userId && c.id === order.userId) ||
        (order.customerId && c.id === order.customerId)
      );
      if (!targetCust && email) {
        targetCust = freshDb.customers.find(c => c.email && c.email.toLowerCase().trim() === email);
      }
      if (!targetCust && phone) {
        targetCust = freshDb.customers.find(c => c.phone && c.phone.trim() === phone);
      }

      if (targetCust) {
        const notifs = targetCust.notifications || [];
        const notifId = `not-order-confirm-${order.id}`;
        const existing = notifs.find(n => n.id === notifId);
        if (!existing) {
          const updated = [
            {
              id: notifId,
              title: 'تم تأكيد طلبك بنجاح',
              message: `تم استلام طلبك رقم ${order.invoiceNumber || order.id} بنجاح. إجمالي الطلب: ${order.total} ج.م. سنبدأ تجهيز طلبك قريبًا.`,
              type: 'order' as const,
              isRead: false,
              timestamp: new Date().toISOString(),
              metadata: { orderId: order.id, invoiceNumber: order.invoiceNumber }
            },
            ...notifs
          ];
          const cIdx = freshDb.customers.findIndex(c => c.id === targetCust.id);
          if (cIdx !== -1) {
            freshDb.customers[cIdx] = {
              ...freshDb.customers[cIdx],
              notifications: updated
            };
          }
        }
      }
    }

    saveDb(freshDb);
    db.logAction('Customer', 'تقديم طلب جديد', `تم تسجيل طلب بقيمة ${order.total} ج.م باسم العميل ${order.customer.name}`);
    return order;
  },
  updateOrderStatus: (id: string, status: OrderStatus, reason?: string) => {
    const data = initDb();
    const orderIndex = data.orders.findIndex(o => o.id === id);
    if (orderIndex === -1) return null;

    const order = data.orders[orderIndex];
    const oldStatus = order.status;

    // Idempotency check: if order.status === status OR the last timeline entry matches new status
    const lastTimelineEntry = Array.isArray(order.timeline) && order.timeline.length > 0 ? order.timeline[order.timeline.length - 1] : null;
    if (order.status === status || (lastTimelineEntry && lastTimelineEntry.status === status)) {
      // Ensure order status is set to status in case of minor discrepancy
      order.status = status;
      return order;
    }

    const isTargetCancelledOrReturned = status === 'Cancelled' || status === 'Returned';
    const isOldCancelledOrReturned = oldStatus === 'Cancelled' || oldStatus === 'Returned';

    // Treat legacy orders without stockDeducted as stockDeducted: true if old status was active
    const wasStockDeducted = order.stockDeducted !== undefined ? order.stockDeducted : !isOldCancelledOrReturned;

    if (isTargetCancelledOrReturned && wasStockDeducted) {
      // Restore stock for all items
      for (const item of order.items) {
        const prod = data.products.find(p => p.id === item.productId);
        let targetVariantId = item.variantId;
        if (!targetVariantId && item.variantSku && prod?.variants) {
          const vMatch = prod.variants.find(v => v.sku === item.variantSku || v.id === item.variantSku);
          if (vMatch) targetVariantId = vMatch.id;
        }

        const actionText = status === 'Cancelled' ? 'إلغاء الطلب' : 'إرجاع الطلب';
        const movementReason = reason ? `${actionText}: ${reason}` : actionText;

        db.adjustStock({
          productId: item.productId,
          variantId: targetVariantId || undefined,
          type: 'in_return',
          quantity: item.quantity,
          referenceId: order.id,
          reason: movementReason,
          createdBy: 'النظام'
        });
      }

      // Re-fetch orders from db after adjustStock updates
      const updatedData = initDb();
      const updatedOrder = updatedData.orders.find(o => o.id === id);
      if (updatedOrder) {
        updatedOrder.status = status;
        updatedOrder.stockDeducted = false;
        const desc = status === 'Cancelled' ? `تم إلغاء الطلب. ${reason || ''}` : `تم استرجاع الطلب. ${reason || ''}`;
        updatedOrder.timeline.push({
          status,
          date: new Date().toISOString(),
          description: desc
        });
        saveDb(updatedData);
        db.logAction('Admin', 'تعديل حالة طلب', `تحديث حالة الطلب ${id} إلى [${status}] وإعادة المخزون`);
        return updatedOrder;
      }
    } else if (!isTargetCancelledOrReturned && !wasStockDeducted) {
      // Order is being re-activated from Cancelled/Returned back to an active state
      // Validate stock availability first
      for (const item of order.items) {
        const prod = data.products.find(p => p.id === item.productId);
        if (!prod) {
          throw new Error(`المنتج غير موجود: ${item.productTitle || item.productId}`);
        }
        let targetVariantId = item.variantId;
        if (!targetVariantId && item.variantSku && prod.variants) {
          const vMatch = prod.variants.find(v => v.sku === item.variantSku || v.id === item.variantSku);
          if (vMatch) targetVariantId = vMatch.id;
        }

        if (targetVariantId) {
          const variant = prod.variants?.find(v => v.id === targetVariantId);
          if (!variant || (variant.stock || 0) < item.quantity) {
            throw new Error(`تعذر إعادة تفعيل الطلب: المخزون غير كافٍ للموديل في المنتج "${prod.title}". المتاح: ${variant?.stock || 0}، المطلوب: ${item.quantity}`);
          }
        } else {
          if ((prod.stock || 0) < item.quantity) {
            throw new Error(`تعذر إعادة تفعيل الطلب: المخزون غير كافٍ للمنتج "${prod.title}". المتاح: ${prod.stock || 0}، المطلوب: ${item.quantity}`);
          }
        }
      }

      // Deduct stock again
      for (const item of order.items) {
        const prod = data.products.find(p => p.id === item.productId);
        let targetVariantId = item.variantId;
        if (!targetVariantId && item.variantSku && prod?.variants) {
          const vMatch = prod.variants.find(v => v.sku === item.variantSku || v.id === item.variantSku);
          if (vMatch) targetVariantId = vMatch.id;
        }

        db.adjustStock({
          productId: item.productId,
          variantId: targetVariantId || undefined,
          type: 'out_sale',
          quantity: item.quantity,
          referenceId: order.id,
          reason: 'إعادة تفعيل الطلب',
          createdBy: 'النظام'
        });
      }

      const updatedData = initDb();
      const updatedOrder = updatedData.orders.find(o => o.id === id);
      if (updatedOrder) {
        updatedOrder.status = status;
        updatedOrder.stockDeducted = true;
        const desc = status === 'Confirmed' ? 'تم تأكيد طلبكم هاتفياً وجارِ تحضيره في مخازننا' :
                     status === 'Preparing' ? 'يتم تغليف وتجهيز أجهزتكم للشحن حالياً' :
                     status === 'Shipped' ? 'خرجت شحنتكم مع مندوب الشحن السريع ومتوجهة لعنوانكم' :
                     status === 'Delivered' ? 'تم تسليم الشحنة وتحصيل القيمة المالية نقداً بنجاح' : 'تم إعادة تفعيل وتحديث حالة الطلب';
        updatedOrder.timeline.push({
          status,
          date: new Date().toISOString(),
          description: desc
        });
        saveDb(updatedData);
        db.logAction('Admin', 'تعديل حالة طلب', `إعادة تفعيل الطلب ${id} إلى [${status}] وخصم المخزون`);
        return updatedOrder;
      }
    } else {
      // Standard status transition (e.g. Pending -> Confirmed -> Shipped -> Delivered)
      order.status = status;
      order.stockDeducted = wasStockDeducted;
      const desc = status === 'Confirmed' ? 'تم تأكيد طلبكم هاتفياً وجارِ تحضيره في مخازننا' :
                   status === 'Preparing' ? 'يتم تغليف وتجهيز أجهزتكم للشحن حالياً' :
                   status === 'Shipped' ? 'خرجت شحنتكم مع مندوب الشحن السريع ومتوجهة لعنوانكم' :
                   status === 'Delivered' ? 'تم تسليم الشحنة وتحصيل القيمة المالية نقداً بنجاح' :
                   status === 'Cancelled' ? `تم إلغاء الطلب. ${reason || ''}` :
                   status === 'Returned' ? `تم استرجاع الطلب. ${reason || ''}` : 'تم تحديث حالة الطلب';

      order.timeline.push({
        status,
        date: new Date().toISOString(),
        description: desc
      });

      // Notify about low stock if delivered/shipped
      if (status === 'Confirmed' || status === 'Shipped') {
        order.items.forEach(item => {
          const prod = data.products.find(p => p.id === item.productId);
          if (prod && prod.stock <= 5) {
            const nowIso = new Date().toISOString();
            data.notifications.push({
              id: `not-stock-${Date.now()}-${prod.id}`,
              title: `مخزون منخفض - ${prod.brand}`,
              message: `مخزون المنتج ${prod.title} منخفض للغاية (${prod.stock} حبة متبقية في المستودع).`,
              type: 'stock',
              priority: 'high',
              icon: 'package',
              read: false,
              isRead: false,
              createdAt: nowIso,
              timestamp: nowIso
            });
          }
        });
      }

      // Notify customer of order status update
      if (data.customers) {
        const statusArabicMap: Record<string, string> = {
          Pending: 'قيد المراجعة والتحقق',
          Confirmed: 'تم التأكيد وجاري التجهيز',
          Preparing: 'تحت التغليف والتحضير',
          Shipped: 'خرجت الشحنة للتوصيل مع المندوب',
          Delivered: 'تم تسليم الشحنة بنجاح',
          Cancelled: 'تم إلغاء الطلب',
          Returned: 'تم استرجاع الطلب'
        };
        const email = (order.customer?.email || '').toLowerCase().trim();
        const phone = (order.customer?.phone || '').trim();
        const altPhone = (order.customer?.altPhone || '').trim();
        const matchedCust = data.customers.find(c =>
          (order.userId && c.id === order.userId) ||
          (order.customerId && c.id === order.customerId) ||
          (email && c.email.toLowerCase().trim() === email) ||
          (phone && c.phone && (c.phone === phone || c.phone === altPhone))
        );
        if (matchedCust) {
          if (!matchedCust.notifications) matchedCust.notifications = [];
          matchedCust.notifications.unshift({
            id: `not-ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: `تحديث حالة الطلب (${order.invoiceNumber || order.id})`,
            message: `تغيرت حالة طلبكم رقم ${order.invoiceNumber || order.id} إلى [${statusArabicMap[status] || status}]. ${reason ? 'ملاحظة: ' + reason : ''}`,
            type: 'order',
            isRead: false,
            timestamp: new Date().toISOString()
          });
        }
      }

      saveDb(data);
      db.logAction('Admin', 'تعديل حالة طلب', `تحديث حالة الطلب ${id} إلى [${status}]`);
      return order;
    }
    return null;
  },
  getCoupons: () => {
    const data = initDb();
    return data.coupons;
  },
  getCouponByCode: (code: string) => {
    const data = initDb();
    return data.coupons.find(c => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
  },
  createCoupon: (coupon: Coupon) => {
    const data = initDb();
    const exists = data.coupons.find(c => c.code.toUpperCase() === coupon.code.toUpperCase());
    if (exists) {
      throw new Error('كود الكوبون هذا موجود بالفعل مسبقاً');
    }

    // Strict Numeric Assertions
    if (coupon.discountType === 'percentage') {
      coupon.value = assertNumeric(coupon.value, 'percentage', { required: true, fieldNameArabic: 'نسبة الخصم' })!;
    } else if (coupon.discountType === 'fixed') {
      coupon.value = assertNumeric(coupon.value, 'positive_decimal', { required: true, fieldNameArabic: 'قيمة الخصم الثابت' })!;
    } else {
      coupon.value = assertNumeric(coupon.value ?? 0, 'non_negative_decimal', { fieldNameArabic: 'قيمة الخصم' })!;
    }

    if (coupon.minOrderValue !== undefined && coupon.minOrderValue !== null) {
      coupon.minOrderValue = assertNumeric(coupon.minOrderValue, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى لقيمة الطلب' });
    }
    if (coupon.maxDiscountAmount !== undefined && coupon.maxDiscountAmount !== null) {
      coupon.maxDiscountAmount = assertNumeric(coupon.maxDiscountAmount, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى للخصم' });
    }
    if (coupon.usageLimit !== undefined && coupon.usageLimit !== null) {
      coupon.usageLimit = assertNumeric(coupon.usageLimit, 'positive_integer', { fieldNameArabic: 'الحد الأقصى للاستخدام' });
    }
    if (coupon.usedCount !== undefined && coupon.usedCount !== null) {
      coupon.usedCount = assertNumeric(coupon.usedCount, 'non_negative_integer', { fieldNameArabic: 'عدد مرات الاستخدام' });
    }

    data.coupons.push(coupon);
    saveDb(data);
    db.logAction('Admin', 'إنشاء كوبون خصم', `تم إنشاء كوبون جديد [${coupon.code}] بنوع خصم [${coupon.discountType}] وقيمة [${coupon.value}]`);
    return coupon;
  },
  updateCoupon: (code: string, updatedFields: Partial<Coupon>) => {
    const data = initDb();
    const index = data.coupons.findIndex(c => c.code.toUpperCase() === code.toUpperCase());
    if (index === -1) {
      throw new Error('الكوبون غير موجود');
    }

    const effectiveType = updatedFields.discountType || data.coupons[index].discountType;
    if (updatedFields.value !== undefined) {
      if (effectiveType === 'percentage') {
        updatedFields.value = assertNumeric(updatedFields.value, 'percentage', { required: true, fieldNameArabic: 'نسبة الخصم' })!;
      } else if (effectiveType === 'fixed') {
        updatedFields.value = assertNumeric(updatedFields.value, 'positive_decimal', { required: true, fieldNameArabic: 'قيمة الخصم الثابت' })!;
      } else {
        updatedFields.value = assertNumeric(updatedFields.value, 'non_negative_decimal', { fieldNameArabic: 'قيمة الخصم' })!;
      }
    }

    if (updatedFields.minOrderValue !== undefined && updatedFields.minOrderValue !== null) {
      updatedFields.minOrderValue = assertNumeric(updatedFields.minOrderValue, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى لقيمة الطلب' });
    }
    if (updatedFields.maxDiscountAmount !== undefined && updatedFields.maxDiscountAmount !== null) {
      updatedFields.maxDiscountAmount = assertNumeric(updatedFields.maxDiscountAmount, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى للخصم' });
    }
    if (updatedFields.usageLimit !== undefined && updatedFields.usageLimit !== null) {
      updatedFields.usageLimit = assertNumeric(updatedFields.usageLimit, 'positive_integer', { fieldNameArabic: 'الحد الأقصى للاستخدام' });
    }
    if (updatedFields.usedCount !== undefined && updatedFields.usedCount !== null) {
      updatedFields.usedCount = assertNumeric(updatedFields.usedCount, 'non_negative_integer', { fieldNameArabic: 'عدد مرات الاستخدام' });
    }

    data.coupons[index] = { ...data.coupons[index], ...updatedFields };
    saveDb(data);
    db.logAction('Admin', 'تعديل كوبون خصم', `تم تعديل إعدادات الكوبون [${code}]`);
    return data.coupons[index];
  },
  deleteCoupon: (code: string) => {
    const data = initDb();
    const index = data.coupons.findIndex(c => c.code.toUpperCase() === code.toUpperCase());
    if (index === -1) {
      return false;
    }
    data.coupons.splice(index, 1);
    saveDb(data);
    db.logAction('Admin', 'حذف كوبون خصم', `تم حذف الكوبون [${code}] من النظام نهائياً`);
    return true;
  },
  getBanners: () => {
    const data = initDb();
    return data.banners || [];
  },
  createBanner: (banner: Banner) => {
    const data = initDb();
    data.banners = data.banners || [];
    data.banners.push(banner);
    saveDb(data);
    db.logAction('Admin', 'إنشاء لافتة إعلانية', `تم إضافة لافتة ترويجية جديدة: ${banner.title}`);
    return banner;
  },
  updateBanner: (id: string, updatedFields: Partial<Banner>) => {
    const data = initDb();
    data.banners = data.banners || [];
    const idx = data.banners.findIndex(b => b.id === id);
    if (idx === -1) return null;
    data.banners[idx] = { ...data.banners[idx], ...updatedFields };
    saveDb(data);
    db.logAction('Admin', 'تعديل لافتة إعلانية', `تم تعديل لافتة ترويجية: ${data.banners[idx].title}`);
    return data.banners[idx];
  },
  deleteBanner: (id: string) => {
    const data = initDb();
    data.banners = data.banners || [];
    const idx = data.banners.findIndex(b => b.id === id);
    if (idx === -1) return false;
    const title = data.banners[idx].title;
    data.banners.splice(idx, 1);
    saveDb(data);
    db.logAction('Admin', 'حذف لافتة إعلانية', `تم حذف لافتة ترويجية: ${title}`);
    return true;
  },
  getShippingProvinces: () => {
    const data = initDb();
    return data.shippingProvinces || [];
  },
  createShippingProvince: (province: ShippingProvince) => {
    const data = initDb();
    data.shippingProvinces = data.shippingProvinces || [];
    if (!province.name || !province.nameEn) {
      throw new Error('بيانات المحافظة غير صالحة');
    }
    province.price = assertNumeric(province.price, 'non_negative_decimal', { required: true, fieldNameArabic: 'سعر الشحن' })!;
    if (province.freeShippingThreshold !== undefined && province.freeShippingThreshold !== null) {
      province.freeShippingThreshold = assertNumeric(province.freeShippingThreshold, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى للشحن المجاني' });
    }

    data.shippingProvinces.push(province);
    saveDb(data);
    db.logAction('Admin', 'إضافة مقاطعة شحن', `تم إضافة محافظة شحن جديدة: ${province.name}`);
    return province;
  },
  updateShippingProvince: (id: string, updatedFields: Partial<ShippingProvince>) => {
    const data = initDb();
    data.shippingProvinces = data.shippingProvinces || [];
    const idx = data.shippingProvinces.findIndex(p => p.id === id);
    if (idx === -1) return null;

    if (updatedFields.price !== undefined) {
      updatedFields.price = assertNumeric(updatedFields.price, 'non_negative_decimal', { required: true, fieldNameArabic: 'سعر الشحن' })!;
    }
    if (updatedFields.freeShippingThreshold !== undefined && updatedFields.freeShippingThreshold !== null) {
      updatedFields.freeShippingThreshold = assertNumeric(updatedFields.freeShippingThreshold, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى للشحن المجاني' });
    }

    data.shippingProvinces[idx] = { ...data.shippingProvinces[idx], ...updatedFields };
    saveDb(data);
    db.logAction('Admin', 'تعديل أسعار الشحن', `تم تعديل أسعار/خيارات شحن محافظة: ${data.shippingProvinces[idx].name}`);
    return data.shippingProvinces[idx];
  },
  deleteShippingProvince: (id: string) => {
    const data = initDb();
    data.shippingProvinces = data.shippingProvinces || [];
    const idx = data.shippingProvinces.findIndex(p => p.id === id);
    if (idx === -1) return false;
    const name = data.shippingProvinces[idx].name;
    data.shippingProvinces.splice(idx, 1);
    saveDb(data);
    db.logAction('Admin', 'حذف محافظة شحن', `تم حذف محافظة الشحن: ${name}`);
    return true;
  },
  getFaqs: () => {
    const data = initDb();
    return data.faqs;
  },
  addFaq: (faq: FAQ) => {
    const data = initDb();
    data.faqs.push(faq);
    saveDb(data);
    return faq;
  },
  getLogs: () => {
    const data = initDb();
    return data.logs;
  },
  addAuditLog: (entry: {
    adminId?: string;
    adminName?: string;
    action: string;
    entityType: string;
    entityId?: string;
    description: string;
    ipAddress?: string;
    userAgent?: string;
  }) => {
    const data = initDb();
    if (!data.auditLogs) {
      data.auditLogs = [];
    }
    const rawDesc = sanitizeText(entry.description || '');
    const cleanDescription = rawDesc
      .replace(/(password|passwordHash|salt|token|session|secret)[=:\s]+[^\s,;]+/gi, '$1=***');

    const newLog: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      adminId: entry.adminId ? sanitizeText(entry.adminId) : 'system',
      adminName: entry.adminName ? sanitizeText(entry.adminName) : 'النظام',
      action: sanitizeText(entry.action),
      entityType: sanitizeText(entry.entityType),
      entityId: entry.entityId ? sanitizeText(entry.entityId) : undefined,
      description: cleanDescription,
      ipAddress: entry.ipAddress ? sanitizeText(entry.ipAddress) : undefined,
      userAgent: entry.userAgent ? sanitizeText(entry.userAgent) : undefined,
      createdAt: new Date().toISOString()
    };

    data.auditLogs.unshift(newLog);
    if (data.auditLogs.length > 10000) {
      data.auditLogs.pop();
    }
    saveDb(data);
    return newLog;
  },
  getAuditLogs: (params?: {
    search?: string;
    admin?: string;
    entityType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => {
    const data = initDb();
    let logs = [...(data.auditLogs || [])];

    if (params) {
      const { search, admin, entityType, dateFrom, dateTo } = params;

      if (search && search.trim()) {
        const q = normalizeArabicText(search.trim());
        logs = logs.filter(l =>
          normalizeArabicText(l.action).includes(q) ||
          normalizeArabicText(l.description).includes(q) ||
          normalizeArabicText(l.entityType).includes(q) ||
          (l.entityId && normalizeArabicText(l.entityId).includes(q)) ||
          normalizeArabicText(l.adminName).includes(q) ||
          normalizeArabicText(l.adminId).includes(q)
        );
      }

      if (admin && admin.trim()) {
        const adminQ = normalizeArabicText(admin.trim());
        logs = logs.filter(l =>
          normalizeArabicText(l.adminId).includes(adminQ) ||
          normalizeArabicText(l.adminName).includes(adminQ)
        );
      }

      if (entityType && entityType.trim()) {
        const et = entityType.trim().toLowerCase();
        logs = logs.filter(l => l.entityType.toLowerCase() === et || normalizeArabicText(l.entityType) === normalizeArabicText(et));
      }

      if (dateFrom && dateFrom.trim()) {
        const fromTime = new Date(dateFrom).getTime();
        if (!isNaN(fromTime)) {
          logs = logs.filter(l => new Date(l.createdAt).getTime() >= fromTime);
        }
      }

      if (dateTo && dateTo.trim()) {
        let toTime = new Date(dateTo).getTime();
        if (!isNaN(toTime)) {
          if (dateTo.trim().length === 10) {
            toTime += 24 * 60 * 60 * 1000 - 1;
          }
          logs = logs.filter(l => new Date(l.createdAt).getTime() <= toTime);
        }
      }
    }

    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params?.limit) || 20));
    const total = logs.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedLogs = logs.slice(startIndex, startIndex + limit);

    return {
      logs: paginatedLogs,
      total,
      page,
      limit,
      totalPages
    };
  },
  logAction: (role: string, action: string, details: string) => {
    const data = initDb();
    const newLog: ActivityLog = {
      id: `log-${Date.now()}`,
      user: role === 'Admin' ? 'أحمد الإدريسي (أدمن)' : role === 'Customer' ? 'العميل من الموقع' : 'نظام المتجر الآلي',
      role,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    data.logs.unshift(newLog);
    // limit logs to 100 entries
    if (data.logs.length > 100) {
      data.logs.pop();
    }
    saveDb(data);
    return newLog;
  },
  addNotification: (entry: {
    title: string;
    message: string;
    type?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    icon?: string;
    adminId?: string | null;
    expiresAt?: string | null;
    metadata?: Record<string, any>;
    read?: boolean;
  }) => {
    const data = initDb();
    if (!data.notifications) {
      data.notifications = [];
    }
    const cleanTitle = sanitizeText(entry.title || '');
    const cleanMessage = sanitizeText(entry.message || '');
    const now = new Date().toISOString();
    const isRead = entry.read ?? false;

    const newNotif: Notification = {
      id: `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      title: cleanTitle,
      message: cleanMessage,
      type: entry.type || 'system',
      priority: entry.priority || 'medium',
      icon: entry.icon || (entry.type === 'order' ? 'shopping-cart' : entry.type === 'stock' ? 'package' : entry.type === 'review' ? 'star' : entry.type === 'supplier' ? 'truck' : entry.type === 'security' ? 'shield-alert' : entry.type === 'backup' ? 'database' : 'bell'),
      read: isRead,
      isRead: isRead,
      adminId: entry.adminId ?? null,
      createdAt: now,
      timestamp: now,
      expiresAt: entry.expiresAt ?? null,
      metadata: entry.metadata
    };

    data.notifications.unshift(newNotif);
    if (data.notifications.length > 2000) {
      data.notifications.pop();
    }
    saveDb(data);
    return newNotif;
  },

  checkCampaignNotifications: () => {
    const data = initDb();
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    // Check Coupons
    if (data.coupons && Array.isArray(data.coupons)) {
      for (const c of data.coupons) {
        if (!c.expiryDate || c.isActive === false) continue;
        const expTime = new Date(c.expiryDate).getTime();
        if (isNaN(expTime)) continue;

        if (expTime < now) {
          const exists = (data.notifications || []).some(n =>
            n.type === 'campaign' &&
            n.metadata?.couponCode === c.code &&
            n.metadata?.event === 'expired'
          );
          if (!exists) {
            db.addNotification({
              title: `انتهت صلاحية حملة الكوبون [${c.code}]`,
              message: `انتهت صلاحية كوبون الخصم (${c.code}) بتاريخ ${c.expiryDate}.`,
              type: 'campaign',
              priority: 'high',
              icon: 'clock',
              metadata: { couponCode: c.code, event: 'expired', expiryDate: c.expiryDate }
            });
          }
        } else if (expTime - now <= oneDayMs) {
          const exists = (data.notifications || []).some(n =>
            n.type === 'campaign' &&
            n.metadata?.couponCode === c.code &&
            n.metadata?.event === 'ending_soon'
          );
          if (!exists) {
            db.addNotification({
              title: `حملة الكوبون [${c.code}] تنتهي قريباً`,
              message: `الكوبون (${c.code}) سينتهي خلال أقل من 24 ساعة (${c.expiryDate}).`,
              type: 'campaign',
              priority: 'medium',
              icon: 'clock',
              metadata: { couponCode: c.code, event: 'ending_soon', expiryDate: c.expiryDate }
            });
          }
        }
      }
    }

    // Check Product Flash Sales
    if (data.products && Array.isArray(data.products)) {
      for (const p of data.products) {
        if (!p.isFlashSale || !p.flashSaleEnds) continue;
        const expTime = new Date(p.flashSaleEnds).getTime();
        if (isNaN(expTime)) continue;

        if (expTime < now) {
          const exists = (data.notifications || []).some(n =>
            n.type === 'campaign' &&
            n.metadata?.productId === p.id &&
            n.metadata?.event === 'flash_expired'
          );
          if (!exists) {
            db.addNotification({
              title: `انتهى الخصم السريع للمنتج: ${p.title}`,
              message: `انتهت مدة العرض السريع المخصص للمنتج (${p.title}).`,
              type: 'campaign',
              priority: 'high',
              icon: 'clock',
              metadata: { productId: p.id, event: 'flash_expired' }
            });
          }
        } else if (expTime - now <= oneDayMs) {
          const exists = (data.notifications || []).some(n =>
            n.type === 'campaign' &&
            n.metadata?.productId === p.id &&
            n.metadata?.event === 'flash_ending_soon'
          );
          if (!exists) {
            db.addNotification({
              title: `عروض الخصم السريع تنتهي قريباً: ${p.title}`,
              message: `الخصم السريع للمنتج (${p.title}) سينتهي خلال أقل من 24 ساعة.`,
              type: 'campaign',
              priority: 'medium',
              icon: 'clock',
              metadata: { productId: p.id, event: 'flash_ending_soon' }
            });
          }
        }
      }
    }
  },

  getAdminNotifications: (params?: {
    search?: string;
    priority?: string;
    type?: string;
    read?: string | boolean;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => {
    // Dynamically check campaign expirations
    db.checkCampaignNotifications();

    const data = initDb();
    let list = data.notifications || [];

    // Filter out expired notifications if expiresAt is set and passed
    const nowTime = Date.now();
    list = list.filter(n => !n.expiresAt || new Date(n.expiresAt).getTime() > nowTime);

    // Normalize notification properties
    list = list.map(n => {
      const readVal = n.read !== undefined ? n.read : (n.isRead !== undefined ? n.isRead : false);
      const createdVal = n.createdAt || n.timestamp || new Date().toISOString();
      return {
        ...n,
        read: readVal,
        isRead: readVal,
        priority: n.priority || 'medium',
        createdAt: createdVal,
        timestamp: createdVal
      };
    });

    const unreadCount = list.filter(n => !n.read).length;

    if (params?.search && params.search.trim()) {
      const q = normalizeArabicText(params.search.trim());
      list = list.filter(n =>
        normalizeArabicText(n.title).includes(q) ||
        normalizeArabicText(n.message).includes(q)
      );
    }

    if (params?.priority && params.priority.trim() && params.priority !== 'all') {
      const p = params.priority.trim().toLowerCase();
      list = list.filter(n => (n.priority || 'medium').toLowerCase() === p);
    }

    if (params?.type && params.type.trim() && params.type !== 'all') {
      const t = params.type.trim().toLowerCase();
      list = list.filter(n => (n.type || 'system').toLowerCase() === t);
    }

    if (params?.read !== undefined && params.read !== 'all' && params.read !== '') {
      const isReadBool = String(params.read) === 'true' || String(params.read) === 'read';
      list = list.filter(n => n.read === isReadBool);
    }

    if (params?.dateFrom && params.dateFrom.trim()) {
      const fromTime = new Date(params.dateFrom.trim()).getTime();
      if (!isNaN(fromTime)) {
        list = list.filter(n => new Date(n.createdAt).getTime() >= fromTime);
      }
    }

    if (params?.dateTo && params.dateTo.trim()) {
      const toTime = new Date(params.dateTo.trim()).getTime();
      if (!isNaN(toTime)) {
        const adjustedToTime = params.dateTo.trim().length === 10 ? toTime + 86400000 - 1 : toTime;
        list = list.filter(n => new Date(n.createdAt).getTime() <= adjustedToTime);
      }
    }

    const total = list.length;
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params?.limit) || 20));
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedList = list.slice(offset, offset + limit);

    return {
      notifications: paginatedList,
      total,
      unreadCount,
      page,
      limit,
      totalPages
    };
  },

  getNotifications: () => {
    const data = initDb();
    return data.notifications || [];
  },

  markNotificationRead: (id: string) => {
    const data = initDb();
    const notif = data.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      notif.isRead = true;
      saveDb(data);
      return notif;
    }
    return null;
  },

  markAllNotificationsRead: () => {
    const data = initDb();
    (data.notifications || []).forEach(n => {
      n.read = true;
      n.isRead = true;
    });
    saveDb(data);
    return true;
  },

  deleteNotification: (id: string) => {
    const data = initDb();
    const idx = (data.notifications || []).findIndex(n => n.id === id);
    if (idx !== -1) {
      data.notifications.splice(idx, 1);
      saveDb(data);
      return true;
    }
    return false;
  },
  getSettings: () => {
    const data = initDb();
    return data.settings;
  },
  updateSettings: (newSettings: Partial<SystemSettings>) => {
    const data = initDb();

    if (newSettings.shippingFlatRate !== undefined && newSettings.shippingFlatRate !== null) {
      newSettings.shippingFlatRate = assertNumeric(newSettings.shippingFlatRate, 'non_negative_decimal', { fieldNameArabic: 'سعر الشحن الافتراضي' });
    }
    if (newSettings.taxRate !== undefined && newSettings.taxRate !== null) {
      newSettings.taxRate = assertNumeric(newSettings.taxRate, 'non_negative_decimal', { fieldNameArabic: 'نسبة الضريبة' });
    }
    if (newSettings.freeShippingThreshold !== undefined && newSettings.freeShippingThreshold !== null) {
      newSettings.freeShippingThreshold = assertNumeric(newSettings.freeShippingThreshold, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى للشحن المجاني' });
    }
    if (newSettings.minOrderAmount !== undefined && newSettings.minOrderAmount !== null) {
      newSettings.minOrderAmount = assertNumeric(newSettings.minOrderAmount, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى لقيمة الطلب' });
    }
    if (newSettings.loyaltyPointsPerEGP !== undefined && newSettings.loyaltyPointsPerEGP !== null) {
      newSettings.loyaltyPointsPerEGP = assertNumeric(newSettings.loyaltyPointsPerEGP, 'non_negative_decimal', { fieldNameArabic: 'نقاط الولاء لكل جنيه' });
    }
    if (newSettings.loyaltyRedeemRate !== undefined && newSettings.loyaltyRedeemRate !== null) {
      newSettings.loyaltyRedeemRate = assertNumeric(newSettings.loyaltyRedeemRate, 'non_negative_decimal', { fieldNameArabic: 'معدل استبدال نقاط الولاء' });
    }

    data.settings = { ...data.settings, ...newSettings };
    saveDb(data);
    db.logAction('Admin', 'تحديث إعدادات المتجر', 'تم تعديل تفاصيل المتجر والأسعار الضريبية والشحن');
    return data.settings;
  },
  cleanupDb: (options: {
    deleteOrders: boolean;
    deleteCustomers: boolean;
    deleteNotifications: boolean;
    deleteLogs: boolean;
    deleteReviews: boolean;
    deleteCoupons: boolean;
    deleteProducts: boolean;
  }) => {
    const data = initDb();
    let actionsPerformed: string[] = [];

    if (options.deleteOrders) {
      data.orders = [];
      actionsPerformed.push('حذف الطلبات التجريبية');
    }
    if (options.deleteCustomers) {
      data.customers = [];
      actionsPerformed.push('حذف حسابات العملاء التجريبية');
    }
    if (options.deleteNotifications) {
      data.notifications = [];
      actionsPerformed.push('حذف التنبيهات التجريبية');
    }
    if (options.deleteCoupons) {
      data.coupons = [];
      actionsPerformed.push('حذف كوبونات الخصم التجريبية');
    }
    if (options.deleteReviews) {
      data.products.forEach(p => {
        p.reviews = [];
        p.reviewsCount = 0;
        p.rating = 5.0;
      });
      actionsPerformed.push('حذف تقييمات العملاء التجريبية');
    }
    if (options.deleteProducts) {
      data.products = [];
      actionsPerformed.push('حذف المنتجات التجريبية');
    }
    if (options.deleteLogs) {
      data.logs = [];
      actionsPerformed.push('حذف سجلات النشاط التجريبية');
    }

    saveDb(data);

    // Log the cleanup action itself so it exists even if logs were cleared
    db.logAction('Admin', 'تهيئة المتجر وإطلاق الإنتاج', `تمت تهيئة المتجر وحذف البيانات التجريبية: ${actionsPerformed.join('، ')}`);

    return true;
  },
  getCustomers: () => {
    const data = initDb();
    return data.customers || [];
  },
  getCustomerByEmail: (email: string) => {
    const data = initDb();
    const customers = data.customers || [];
    return customers.find(c => c.email.toLowerCase() === email.toLowerCase()) || null;
  },
  getCustomerById: (id: string) => {
    const data = initDb();
    const customers = data.customers || [];
    return customers.find(c => c.id === id) || null;
  },
  createCustomer: (customer: Customer) => {
    const data = initDb();
    data.customers = data.customers || [];
    data.customers.push(customer);
    saveDb(data);
    db.logAction('Customer', 'تسجيل حساب جديد', `تم تسجيل حساب عميل جديد: ${customer.name} (${customer.email})`);
    return customer;
  },
  updateCustomer: (id: string, updatedFields: Partial<Customer>) => {
    const data = initDb();
    data.customers = data.customers || [];
    const idx = data.customers.findIndex(c => c.id === id);
    if (idx === -1) return null;
    data.customers[idx] = {
      ...data.customers[idx],
      ...updatedFields,
      updatedAt: new Date().toISOString()
    };
    saveDb(data);
    return data.customers[idx];
  },
  deleteCustomer: (id: string) => {
    const data = initDb();
    data.customers = data.customers || [];
    const idx = data.customers.findIndex(c => c.id === id);
    if (idx === -1) return false;
    const name = data.customers[idx].name;
    const email = data.customers[idx].email;
    data.customers.splice(idx, 1);
    saveDb(data);
    db.logAction('Admin', 'حذف حساب عميل', `تم حذف حساب العميل: ${name} (${email})`);
    return true;
  },
  
  getImageUsage: (url: string) => {
    const data = initDb();
    const usages: MediaUsage[] = [];
    
    // Check products
    data.products.forEach(p => {
      if (p.mainImage === url) {
        usages.push({ type: 'product', id: p.id, name: p.title });
      } else if (Array.isArray(p.images) && p.images.includes(url)) {
        usages.push({ type: 'product', id: p.id, name: p.title });
      }
    });

    // Check banners
    data.banners.forEach(b => {
      if (b.desktopImage === url || b.mobileImage === url) {
        usages.push({ type: 'banner', id: b.id, name: b.title });
      }
    });

    // Check system settings
    if (data.settings) {
      if (data.settings.bannerImage === url) {
        usages.push({ type: 'settings_banner', id: 'banner', name: 'لافتة العرض الرئيسية' });
      }
      if ((data.settings as any).logoImage === url) {
        usages.push({ type: 'settings_logo', id: 'logo', name: 'شعار المتجر' });
      }
    }

    return usages;
  },
  
  getMedia: () => {
    const data = initDb();
    return data.media || [];
  },
  
  getMediaById: (id: string) => {
    const data = initDb();
    return (data.media || []).find(m => m.id === id) || null;
  },
  
  getMediaByHash: (hash: string) => {
    const data = initDb();
    return (data.media || []).find(m => m.hash === hash) || null;
  },
  
  addMedia: (item: MediaItem) => {
    const data = initDb();
    data.media = data.media || [];
    data.media.push(item);
    saveDb(data);
    db.logAction('Admin', 'إضافة ملف وسائط', `تم رفع ملف الوسائط ${item.filename} بنجاح`);
    return item;
  },
  
  renameMedia: (id: string, newTitle: string) => {
    const data = initDb();
    data.media = data.media || [];
    const index = data.media.findIndex(m => m.id === id);
    if (index === -1) return null;
    const oldTitle = data.media[index].title || data.media[index].filename;
    data.media[index].title = newTitle;
    saveDb(data);
    db.logAction('Admin', 'تعديل اسم ملف وسائط', `تم تغيير اسم الملف من ${oldTitle} إلى ${newTitle}`);
    return data.media[index];
  },
  
  updateMediaFields: (id: string, updatedFields: Partial<MediaItem>) => {
    const data = initDb();
    data.media = data.media || [];
    const index = data.media.findIndex(m => m.id === id);
    if (index === -1) return null;
    data.media[index] = { ...data.media[index], ...updatedFields };
    saveDb(data);
    return data.media[index];
  },
  
  deleteMedia: (id: string) => {
    const data = initDb();
    data.media = data.media || [];
    const index = data.media.findIndex(m => m.id === id);
    if (index === -1) return false;
    
    const item = data.media[index];
    const usages = db.getImageUsage(item.url);
    if (usages.length > 0) {
      throw new Error(`لا يمكن حذف هذه الصورة لأنها مستخدمة في: ${usages.map(u => u.name).join('، ')}`);
    }

    const relativePath = item.url.replace(/^\//, '');
    const fullPath = path.join(process.cwd(), 'public', relativePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error('Failed to unlink file:', err);
      }
    }

    if (item.thumbnailUrl) {
      const thumbRelativePath = item.thumbnailUrl.replace(/^\//, '');
      const thumbFullPath = path.join(process.cwd(), 'public', thumbRelativePath);
      if (fs.existsSync(thumbFullPath)) {
        try {
          fs.unlinkSync(thumbFullPath);
        } catch (err) {
          console.error('Failed to unlink thumbnail:', err);
        }
      }
    }

    const filename = item.filename;
    data.media.splice(index, 1);
    saveDb(data);
    db.logAction('Admin', 'حذف ملف وسائط', `تم حذف ملف الوسائط: ${filename}`);
    return true;
  },

  getStockMovements: (filter?: { productId?: string; variantId?: string; type?: string }) => {
    const data = initDb();
    let movements = data.stockMovements || [];
    if (filter) {
      if (filter.productId) {
        movements = movements.filter(m => m.productId === filter.productId);
      }
      if (filter.variantId) {
        movements = movements.filter(m => m.variantId === filter.variantId);
      }
      if (filter.type) {
        movements = movements.filter(m => m.type === filter.type);
      }
    }
    return movements;
  },

  addStockMovement: (movement: StockMovement) => {
    const data = initDb();
    data.stockMovements = data.stockMovements || [];
    data.stockMovements.unshift(movement); // Most recent first
    saveDb(data);
    return movement;
  },

  saveStockMovements: (movements: StockMovement[]) => {
    const data = initDb();
    data.stockMovements = movements;
    saveDb(data);
  },

  adjustStock: (params: AdjustStockParams): { product: Product; movement: StockMovement } => {
    const { productId, variantId, type, quantity: rawQuantity, referenceId, reason, createdBy } = params;

    const quantity = assertNumeric(rawQuantity, 'positive_integer', { required: true, min: 1, fieldNameArabic: 'كمية تعديل المخزون' })!;

    const isIncrement = ['in_purchase', 'in_adjustment', 'in_return'].includes(type);
    const isDecrement = ['out_sale', 'out_damage', 'out_adjustment'].includes(type);

    if (!isIncrement && !isDecrement) {
      throw new Error(`نوع حركة المخزون غير صالحة: ${type}`);
    }

    const data = initDb();
    const productIndex = data.products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      throw new Error('المنتج غير موجود.');
    }

    const product = { ...data.products[productIndex] };
    let previousStock = 0;
    let newStock = 0;
    let variantInfo = '';

    const qtyChange = isIncrement ? Math.round(quantity) : -Math.round(quantity);

    if (variantId) {
      if (!product.variants || product.variants.length === 0) {
        throw new Error('المنتج لا يحتوي على موديلات.');
      }
      const variantIndex = product.variants.findIndex(v => v.id === variantId);
      if (variantIndex === -1) {
        throw new Error('الموديل المحدد غير موجود.');
      }

      const variantsCopy = [...product.variants];
      const variant = { ...variantsCopy[variantIndex] };
      previousStock = typeof variant.stock === 'number' ? variant.stock : 0;
      newStock = previousStock + qtyChange;

      if (newStock < 0) {
        throw new Error(`المخزون غير كافٍ للموديل. المخزون الحالي: ${previousStock}، المطلوب خصمه: ${quantity}`);
      }

      variant.stock = newStock;
      variantsCopy[variantIndex] = variant;
      product.variants = variantsCopy;

      // Recalculate parent product stock as the sum of all variants' stocks
      product.stock = variantsCopy.reduce((sum, v) => sum + (typeof v.stock === 'number' ? v.stock : 0), 0);

      const parts = [
        variant.size,
        variant.color,
        variant.capacity,
        variant.sku ? `SKU: ${variant.sku}` : ''
      ].filter(Boolean);
      variantInfo = parts.join(' / ') || `موديل #${variantId}`;
    } else {
      if (product.variants && product.variants.length > 0) {
        throw new Error('هذا المنتج يحتوي على موديلات متعددة، يرجى تحديد الموديل المطلوب تعديل مخزونه.');
      }

      previousStock = typeof product.stock === 'number' ? product.stock : 0;
      newStock = previousStock + qtyChange;

      if (newStock < 0) {
        throw new Error(`المخزون غير كافٍ للمنتج. المخزون الحالي: ${previousStock}، المطلوب خصمه: ${quantity}`);
      }

      product.stock = newStock;
    }

    const movement: StockMovement = {
      id: 'sm_' + crypto.randomBytes(8).toString('hex'),
      productId: product.id,
      productTitle: product.title,
      variantId: variantId || undefined,
      variantInfo: variantInfo || undefined,
      type,
      quantity: Math.round(quantity),
      previousStock,
      newStock,
      referenceId: referenceId || undefined,
      reason: reason || undefined,
      createdBy: createdBy || 'النظام',
      createdAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    };

    data.products[productIndex] = product;
    data.stockMovements = data.stockMovements || [];
    data.stockMovements.unshift(movement);

    saveDb(data);

    // Trigger stock level notification automatically
    if (product.stock <= 0) {
      db.addNotification({
        title: `نفاد المخزون: ${product.title}`,
        message: `نفدت جميع الكميات المتاحة للمنتج "${product.title}" في المستودع.`,
        type: 'stock',
        priority: 'urgent',
        icon: 'alert-triangle',
        metadata: { productId: product.id, stock: 0 }
      });
    } else if (product.stock <= (product.lowStockThreshold || 5)) {
      db.addNotification({
        title: `مخزون منخفض: ${product.title}`,
        message: `المتبقي في المخزن فقط ${product.stock} قطع للمنتج "${product.title}".`,
        type: 'stock',
        priority: 'high',
        icon: 'package',
        metadata: { productId: product.id, stock: product.stock }
      });
    }

    return { product, movement };
  },

  getSuppliers: (filters?: { search?: string; status?: 'active' | 'inactive' }) => {
    const data = initDb();
    let suppliers = data.suppliers || [];

    if (filters?.status) {
      suppliers = suppliers.filter(s => s.status === filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      suppliers = suppliers.filter(s =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.companyName && s.companyName.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.taxNumber && s.taxNumber.toLowerCase().includes(q))
      );
    }

    return suppliers;
  },

  getSupplierById: (id: string) => {
    const data = initDb();
    const suppliers = data.suppliers || [];
    return suppliers.find(s => s.id === id) || null;
  },

  addSupplier: (input: SupplierInput) => {
    const data = initDb();
    data.suppliers = data.suppliers || [];

    if (!input.name || !input.name.trim()) {
      throw new Error('اسم مسئول الاتصال مطلوب');
    }

    if (!input.companyName || !input.companyName.trim()) {
      throw new Error('اسم الشركة / المؤسسة مطلوب');
    }

    if (!input.phone || !input.phone.trim()) {
      throw new Error('رقم الهاتف مطلوب');
    }

    const exists = data.suppliers.some(s =>
      s.companyName.trim().toLowerCase() === input.companyName.trim().toLowerCase() ||
      s.phone.trim() === input.phone.trim()
    );

    if (exists) {
      throw new Error('يوجد مورد مسجل بالفعل بنفس اسم الشركة أو رقم الهاتف');
    }

    const now = new Date().toISOString();
    const newSupplier: Supplier = {
      id: 'sup-' + crypto.randomBytes(6).toString('hex'),
      name: input.name.trim(),
      companyName: input.companyName.trim(),
      phone: input.phone.trim(),
      email: (input.email || '').trim(),
      address: (input.address || '').trim(),
      taxNumber: (input.taxNumber || '').trim(),
      notes: (input.notes || '').trim(),
      status: input.status || 'active',
      createdAt: now,
      updatedAt: now
    };

    data.suppliers.unshift(newSupplier);
    saveDb(data);
    db.logAction('Admin', 'إضافة مورد جديد', `تمت إضافة المورد ${newSupplier.companyName} (${newSupplier.name})`);
    return newSupplier;
  },

  updateSupplier: (id: string, fields: Partial<SupplierInput>) => {
    const data = initDb();
    data.suppliers = data.suppliers || [];

    const index = data.suppliers.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error('المورد غير موجود');
    }

    if (fields.companyName || fields.phone) {
      const existing = data.suppliers.find(s =>
        s.id !== id && (
          (fields.companyName && s.companyName.trim().toLowerCase() === fields.companyName.trim().toLowerCase()) ||
          (fields.phone && s.phone.trim() === fields.phone.trim())
        )
      );
      if (existing) {
        throw new Error('يوجد مورد آخر مسجل بنفس اسم الشركة أو رقم الهاتف');
      }
    }

    const updatedSupplier: Supplier = {
      ...data.suppliers[index],
      ...fields,
      name: fields.name !== undefined ? fields.name.trim() : data.suppliers[index].name,
      companyName: fields.companyName !== undefined ? fields.companyName.trim() : data.suppliers[index].companyName,
      phone: fields.phone !== undefined ? fields.phone.trim() : data.suppliers[index].phone,
      updatedAt: new Date().toISOString()
    };

    data.suppliers[index] = updatedSupplier;
    saveDb(data);
    db.logAction('Admin', 'تحديث بيانات مورد', `تم تحديث بيانات المورد ${updatedSupplier.companyName}`);
    return updatedSupplier;
  },

  deleteSupplier: (id: string) => {
    const data = initDb();
    data.suppliers = data.suppliers || [];

    const index = data.suppliers.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error('المورد غير موجود');
    }

    const supplier = data.suppliers[index];

    const hasPurchaseOrders = (data as any).purchaseOrders?.some((po: any) => po.supplierId === id);
    const hasStockMovements = (data.stockMovements || []).some(sm => (sm as any).supplierId === id);

    if (hasPurchaseOrders || hasStockMovements) {
      supplier.status = 'inactive';
      supplier.updatedAt = new Date().toISOString();
      data.suppliers[index] = supplier;
      saveDb(data);
      db.logAction('Admin', 'تعطيل مورد', `تم تعطيل المورد ${supplier.companyName} بدلاً من الحذف لوجود سجلات مرتبطة`);
      return { success: true, action: 'deactivated', message: 'تعذر الحذف الكلي لوجود سجلات مرتبطة بالمورد، تم تحويل حسابه إلى غير نشط.' };
    }

    data.suppliers.splice(index, 1);
    saveDb(data);
    db.logAction('Admin', 'حذف مورد', `تم حذف المورد ${supplier.companyName}`);
    return { success: true, action: 'deleted', message: 'تم حذف المورد بنجاح' };
  },

  // ==========================================
  // 📋 PURCHASE ORDERS MANAGEMENT
  // ==========================================

  getPurchaseOrders: (filters?: { search?: string; supplierId?: string; status?: string; startDate?: string; endDate?: string }) => {
    const data = initDb();
    let pos = data.purchaseOrders || [];

    if (filters?.supplierId) {
      pos = pos.filter(p => p.supplierId === filters.supplierId);
    }

    if (filters?.status) {
      pos = pos.filter(p => p.status === filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      pos = pos.filter(p =>
        p.poNumber.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        (p.supplierCompanyName && p.supplierCompanyName.toLowerCase().includes(q)) ||
        p.items.some(i => i.productTitle.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q))
      );
    }

    if (filters?.startDate) {
      const start = new Date(filters.startDate).getTime();
      pos = pos.filter(p => new Date(p.createdAt).getTime() >= start);
    }

    if (filters?.endDate) {
      const end = new Date(filters.endDate).getTime();
      pos = pos.filter(p => new Date(p.createdAt).getTime() <= end);
    }

    return pos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getPurchaseOrderById: (id: string) => {
    const data = initDb();
    const pos = data.purchaseOrders || [];
    return pos.find(p => p.id === id) || null;
  },

  addPurchaseOrder: (input: PurchaseOrderInput, userEmail: string) => {
    const data = initDb();
    data.purchaseOrders = data.purchaseOrders || [];

    if (!input.supplierId) {
      throw new Error('يرجى تحديد المورد');
    }

    const supplier = db.getSupplierById(input.supplierId);
    if (!supplier) {
      throw new Error('المورد المحدد غير موجود');
    }
    if (supplier.status !== 'active') {
      throw new Error('المورد المحدد غير نشط، لا يمكن إنشاء أوامر شراء جديدة له');
    }

    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('أمر الشراء يجب أن يحتوي على منتج واحد على الأقل');
    }

    const poItems: PurchaseOrderItem[] = [];
    let subtotal = 0;

    for (const item of input.items) {
      item.quantityOrdered = assertNumeric(item.quantityOrdered, 'positive_integer', { required: true, min: 1, fieldNameArabic: 'كمية التوريد' })!;
      item.unitCost = assertNumeric(item.unitCost, 'non_negative_decimal', { required: true, fieldNameArabic: 'تكلفة الوحدة' })!;

      const product = db.getProductById(item.productId);
      if (!product) {
        throw new Error(`المنتج المحدد غير موجود (معرف: ${item.productId})`);
      }

      let variantInfo: string | undefined = undefined;
      let sku = product.sku || '';

      if (product.variants && product.variants.length > 0) {
        const variantId = item.variantId || product.variants[0].id;
        const variant = product.variants.find(v => v.id === variantId);
        if (!variant) {
          throw new Error(`الموديل المحدد غير موجود للمنتج "${product.title}"`);
        }
        const parts = [variant.size, variant.color, variant.capacity].filter(Boolean);
        variantInfo = parts.join(' / ') || `موديل #${variant.id}`;
        if (variant.sku) sku = variant.sku;
        item.variantId = variant.id;
      } else if (item.variantId) {
        throw new Error(`المنتج "${product.title}" لا يحتوي على موديلات`);
      }

      const itemTotalCost = item.quantityOrdered * item.unitCost;
      subtotal += itemTotalCost;

      poItems.push({
        id: 'poi_' + crypto.randomBytes(4).toString('hex'),
        productId: product.id,
        variantId: item.variantId || undefined,
        productTitle: product.title,
        variantInfo,
        sku,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: 0,
        unitCost: item.unitCost,
        totalCost: itemTotalCost
      });
    }

    const discount = Math.max(0, input.discount || 0);
    const shippingCost = Math.max(0, input.shippingCost || 0);
    const totalCost = Math.max(0, subtotal - discount + shippingCost);

    const year = new Date().getFullYear();
    const count = data.purchaseOrders.length + 1;
    const poNumber = `PO-${year}-${String(count).padStart(4, '0')}`;

    const newPO: PurchaseOrder = {
      id: 'po_' + crypto.randomBytes(6).toString('hex'),
      poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierCompanyName: supplier.companyName,
      status: 'draft',
      items: poItems,
      subtotal,
      discount,
      shippingCost,
      totalCost,
      notes: input.notes ? input.notes.trim() : '',
      expectedDate: input.expectedDate || undefined,
      createdBy: userEmail || 'المسؤول',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.purchaseOrders.unshift(newPO);
    saveDb(data);
    db.logAction(userEmail || 'Admin', 'إنشاء أمر شراء', `تم إنشاء أمر الشراء مسودة رقم ${poNumber} للمورد ${supplier.companyName}`);

    return newPO;
  },

  updatePurchaseOrder: (id: string, input: Partial<PurchaseOrderInput>, userEmail: string) => {
    const data = initDb();
    data.purchaseOrders = data.purchaseOrders || [];

    const poIndex = data.purchaseOrders.findIndex(p => p.id === id);
    if (poIndex === -1) {
      throw new Error('أمر الشراء غير موجود');
    }

    const po = data.purchaseOrders[poIndex];
    if (po.status !== 'draft') {
      throw new Error('يمكن تعديل مسودة أمر الشراء فقط. لا يمكن تعديل أوامر الشراء المؤكدة أو المستلمة أو الملياة');
    }

    let supplierId = po.supplierId;
    let supplierName = po.supplierName;
    let supplierCompanyName = po.supplierCompanyName;

    if (input.supplierId && input.supplierId !== po.supplierId) {
      const supplier = db.getSupplierById(input.supplierId);
      if (!supplier || supplier.status !== 'active') {
        throw new Error('المورد المحدد غير موجود أو غير نشط');
      }
      supplierId = supplier.id;
      supplierName = supplier.name;
      supplierCompanyName = supplier.companyName;
    }

    let poItems = po.items;
    let subtotal = po.subtotal;

    if (input.items && Array.isArray(input.items)) {
      if (input.items.length === 0) {
        throw new Error('أمر الشراء يجب أن يحتوي على منتج واحد على الأقل');
      }

      poItems = [];
      subtotal = 0;

      for (const item of input.items) {
        item.quantityOrdered = assertNumeric(item.quantityOrdered, 'positive_integer', { required: true, min: 1, fieldNameArabic: 'كمية التوريد' })!;
        item.unitCost = assertNumeric(item.unitCost, 'non_negative_decimal', { required: true, fieldNameArabic: 'تكلفة الوحدة' })!;

        const product = db.getProductById(item.productId);
        if (!product) {
          throw new Error(`المنتج المحدد غير موجود (معرف: ${item.productId})`);
        }

        let variantInfo: string | undefined = undefined;
        let sku = product.sku || '';

        if (product.variants && product.variants.length > 0) {
          const variantId = item.variantId || product.variants[0].id;
          const variant = product.variants.find(v => v.id === variantId);
          if (!variant) {
            throw new Error(`الموديل المحدد غير موجود للمنتج "${product.title}"`);
          }
          const parts = [variant.size, variant.color, variant.capacity].filter(Boolean);
          variantInfo = parts.join(' / ') || `موديل #${variant.id}`;
          if (variant.sku) sku = variant.sku;
          item.variantId = variant.id;
        } else if (item.variantId) {
          throw new Error(`المنتج "${product.title}" لا يحتوي على موديلات`);
        }

        const itemTotalCost = item.quantityOrdered * item.unitCost;
        subtotal += itemTotalCost;

        poItems.push({
          id: 'poi_' + crypto.randomBytes(4).toString('hex'),
          productId: product.id,
          variantId: item.variantId || undefined,
          productTitle: product.title,
          variantInfo,
          sku,
          quantityOrdered: item.quantityOrdered,
          quantityReceived: 0,
          unitCost: item.unitCost,
          totalCost: itemTotalCost
        });
      }
    }

    const discount = input.discount !== undefined ? Math.max(0, input.discount) : (po.discount || 0);
    const shippingCost = input.shippingCost !== undefined ? Math.max(0, input.shippingCost) : (po.shippingCost || 0);
    const totalCost = Math.max(0, subtotal - discount + shippingCost);

    const updatedPO: PurchaseOrder = {
      ...po,
      supplierId,
      supplierName,
      supplierCompanyName,
      items: poItems,
      subtotal,
      discount,
      shippingCost,
      totalCost,
      notes: input.notes !== undefined ? input.notes.trim() : po.notes,
      expectedDate: input.expectedDate !== undefined ? input.expectedDate : po.expectedDate,
      updatedAt: new Date().toISOString()
    };

    data.purchaseOrders[poIndex] = updatedPO;
    saveDb(data);
    db.logAction(userEmail || 'Admin', 'تعديل أمر شراء', `تم تعديل مسودة أمر الشراء رقم ${po.poNumber}`);

    return updatedPO;
  },

  updatePurchaseOrderStatus: (id: string, newStatus: PurchaseOrderStatus, userEmail: string) => {
    const data = initDb();
    data.purchaseOrders = data.purchaseOrders || [];

    const poIndex = data.purchaseOrders.findIndex(p => p.id === id);
    if (poIndex === -1) {
      throw new Error('أمر الشراء غير موجود');
    }

    const po = data.purchaseOrders[poIndex];
    const currentStatus = po.status;

    if (currentStatus === newStatus) {
      return po;
    }

    const allowedTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      draft: ['ordered', 'cancelled'],
      ordered: ['partially_received', 'received', 'cancelled'],
      partially_received: ['received', 'cancelled'],
      received: [],
      cancelled: []
    };

    if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`لا يمكن تغيير حالة أمر الشراء من "${currentStatus}" إلى "${newStatus}"`);
    }

    po.status = newStatus;
    po.updatedAt = new Date().toISOString();

    data.purchaseOrders[poIndex] = po;
    saveDb(data);
    db.logAction(userEmail || 'Admin', 'تغيير حالة أمر شراء', `تم تغيير حالة أمر الشراء رقم ${po.poNumber} إلى ${newStatus}`);

    return po;
  },

  receivePurchaseOrderItems: (id: string, itemsToReceive: { itemId: string; quantityToReceive: number }[], userEmail: string) => {
    const data = initDb();
    data.purchaseOrders = data.purchaseOrders || [];

    const poIndex = data.purchaseOrders.findIndex(p => p.id === id);
    if (poIndex === -1) {
      throw new Error('أمر الشراء غير موجود');
    }

    const po = data.purchaseOrders[poIndex];

    if (po.status !== 'ordered' && po.status !== 'partially_received') {
      throw new Error('يمكن استلام شحنات لأوامر الشراء المؤكدة أو المستلمة جزئياً فقط');
    }

    if (!itemsToReceive || !Array.isArray(itemsToReceive) || itemsToReceive.length === 0) {
      throw new Error('يرجى تحديد عنصر واحد على الأقل للتمكن من الاستلام');
    }

    const validReceives: { itemIndex: number; qty: number }[] = [];

    for (const rec of itemsToReceive) {
      const qty = assertNumeric(rec.quantityToReceive, 'positive_integer', { required: true, min: 1, fieldNameArabic: 'كمية الاستلام' })!;

      const itemIdx = po.items.findIndex(it => it.id === rec.itemId);
      if (itemIdx === -1) {
        throw new Error(`الصنف المورد غير موجود بجدول أمر الشراء (${rec.itemId})`);
      }

      const item = po.items[itemIdx];
      const remainingQty = item.quantityOrdered - item.quantityReceived;

      if (qty > remainingQty) {
        throw new Error(`الكمية المدخلة للصنف (${item.productTitle}) تزيد عن المتبقي للتوريد (${remainingQty})`);
      }

      validReceives.push({ itemIndex: itemIdx, qty });
    }

    if (validReceives.length === 0) {
      throw new Error('لم يتم إدخال كميات استلام صالحة أكبر من الصفر');
    }

    for (const { itemIndex, qty } of validReceives) {
      const item = po.items[itemIndex];

      // Centralized adjustStock
      db.adjustStock({
        productId: item.productId,
        variantId: item.variantId,
        type: 'in_purchase',
        quantity: qty,
        reason: `استلام أمر شراء #${po.poNumber}`,
        referenceId: po.id,
        createdBy: userEmail || 'المسؤول'
      });

      // Update product or variant costPrice if unitCost > 0
      if (item.unitCost > 0) {
        const prodData = initDb();
        const pIdx = prodData.products.findIndex(p => p.id === item.productId);
        if (pIdx !== -1) {
          const product = prodData.products[pIdx];
          if (item.variantId && product.variants) {
            const vIdx = product.variants.findIndex(v => v.id === item.variantId);
            if (vIdx !== -1) {
              product.variants[vIdx].costPrice = item.unitCost;
            }
          } else {
            product.costPrice = item.unitCost;
          }
          prodData.products[pIdx] = product;
          saveDb(prodData);
        }
      }
    }

    const freshData = initDb();
    const freshPo = freshData.purchaseOrders![poIndex];

    for (const { itemIndex, qty } of validReceives) {
      freshPo.items[itemIndex].quantityReceived += qty;
    }

    const totalOrdered = freshPo.items.reduce((sum, it) => sum + it.quantityOrdered, 0);
    const totalReceived = freshPo.items.reduce((sum, it) => sum + it.quantityReceived, 0);

    if (totalReceived >= totalOrdered) {
      freshPo.status = 'received';
      freshPo.receivedAt = new Date().toISOString();
      freshPo.receivedBy = userEmail || 'المسؤول';
    } else {
      freshPo.status = 'partially_received';
    }

    freshPo.updatedAt = new Date().toISOString();
    freshData.purchaseOrders![poIndex] = freshPo;
    saveDb(freshData);

    db.logAction(userEmail || 'Admin', 'استلام توريدات أمر شراء', `تم استلام كميات جديدة لأمر الشراء رقم ${freshPo.poNumber}`);

    db.addNotification({
      title: `استلام شحنة أمر شراء ${freshPo.poNumber}`,
      message: `تم استلام توريدات جديدة لأمر الشراء رقم ${freshPo.poNumber} وتحديث كميات المخزن.`,
      type: 'supplier',
      priority: 'medium',
      icon: 'truck',
      metadata: { poId: freshPo.id, poNumber: freshPo.poNumber }
    });

    return freshPo;
  },

  getReviews: (filters?: {
    productId?: string;
    customerId?: string;
    status?: 'pending' | 'approved' | 'rejected' | 'hidden';
    search?: string;
  }) => {
    const data = initDb();
    let reviews = data.reviews || [];

    if (filters) {
      if (filters.productId) {
        reviews = reviews.filter(r => r.productId === filters.productId);
      }
      if (filters.customerId) {
        reviews = reviews.filter(r => r.customerId === filters.customerId);
      }
      if (filters.status) {
        reviews = reviews.filter(r => r.status === filters.status);
      }
      if (filters.search && filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        reviews = reviews.filter(r =>
          (r.comment && r.comment.toLowerCase().includes(q)) ||
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          (r.adminResponse && r.adminResponse.toLowerCase().includes(q))
        );
      }
    }

    return reviews;
  },

  getReviewById: (id: string) => {
    const data = initDb();
    return (data.reviews || []).find(r => r.id === id);
  },

  recalculateProductRating: (productId: string) => {
    const data = initDb();
    const productIdx = data.products.findIndex(p => p.id === productId);
    if (productIdx === -1) return null;

    const allReviews = data.reviews || [];
    const approved = allReviews.filter(r => r.productId === productId && r.status === 'approved');

    let avgRating = 0;
    let reviewsCount = approved.length;

    if (reviewsCount > 0) {
      const totalRating = approved.reduce((sum, r) => sum + Number(r.rating || 0), 0);
      avgRating = Number((totalRating / reviewsCount).toFixed(1));
    }

    const product = data.products[productIdx];
    product.rating = avgRating;
    product.reviewsCount = reviewsCount;

    product.reviews = approved.map(r => ({
      id: r.id,
      productId: r.productId,
      customerId: r.customerId,
      customerName: r.customerName || r.userName || 'عميل',
      userName: r.userName || r.customerName || 'عميل',
      rating: r.rating,
      comment: r.comment,
      status: r.status,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt,
      date: r.date || (r.createdAt ? r.createdAt.substring(0, 10) : new Date().toISOString().substring(0, 10))
    }));

    data.products[productIdx] = product;
    saveDb(data);

    return {
      rating: avgRating,
      reviewsCount,
      distribution: getRatingDistribution(approved)
    };
  },

  getProductRatingSummary: (productId: string) => {
    const data = initDb();
    const product = data.products.find(p => p.id === productId);
    if (!product) return null;

    const allReviews = data.reviews || [];
    const approved = allReviews.filter(r => r.productId === productId && r.status === 'approved');

    return {
      productId,
      rating: product.rating,
      reviewsCount: product.reviewsCount,
      distribution: getRatingDistribution(approved)
    };
  },

  addReview: (reviewInput: {
    productId: string;
    variantId?: string;
    variantInfo?: string;
    customerId: string;
    customerName: string;
    orderId?: string;
    orderItemId?: string;
    rating: number;
    title?: string;
    comment: string;
    status?: 'pending' | 'approved' | 'rejected' | 'hidden';
    isVerifiedPurchase?: boolean;
  }) => {
    const data = initDb();

    const product = data.products.find(p => p.id === reviewInput.productId);
    if (!product) {
      throw new Error('المنتج المراد تقييمه غير موجود');
    }

    const ratingNum = assertNumeric(reviewInput.rating, 'rating', { required: true, fieldNameArabic: 'تقييم المنتج' })!;

    const sanitizedComment = sanitizeText(reviewInput.comment);
    if (!sanitizedComment) {
      throw new Error('التعليق لا يمكن أن يكون فارغاً');
    }
    if (sanitizedComment.length > 2000) {
      throw new Error('التعليق طويل جداً (الحد الأقصى 2000 حرف)');
    }

    const sanitizedTitle = reviewInput.title ? sanitizeText(reviewInput.title).substring(0, 150) : undefined;

    if (!reviewInput.customerId || !reviewInput.customerName) {
      throw new Error('بيانات العميل مطلوبة لإضافة التقييم');
    }

    const now = new Date().toISOString();
    const newReview: Review = {
      id: `rev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      productId: reviewInput.productId,
      variantId: reviewInput.variantId,
      variantInfo: reviewInput.variantInfo,
      customerId: reviewInput.customerId,
      customerName: reviewInput.customerName,
      orderId: reviewInput.orderId,
      orderItemId: reviewInput.orderItemId,
      rating: ratingNum,
      title: sanitizedTitle,
      comment: sanitizedComment,
      status: reviewInput.status || 'pending',
      isVerifiedPurchase: !!reviewInput.isVerifiedPurchase,
      createdAt: now,
      userName: reviewInput.customerName,
      date: now.substring(0, 10)
    };

    if (!data.reviews) {
      data.reviews = [];
    }
    data.reviews.push(newReview);
    saveDb(data);

    if (newReview.status === 'pending') {
      db.addNotification({
        title: 'تقييم جديد بانتظار المراجعة',
        message: `قام العميل ${reviewInput.customerName} بإضافة تقييم جديد (${ratingNum} نجوم) للمنتج "${product.title}"`,
        type: 'review',
        priority: 'medium',
        icon: 'star',
        metadata: { reviewId: newReview.id, productId: product.id }
      });
    }

    if (newReview.status === 'approved') {
      db.recalculateProductRating(newReview.productId);
    }

    return newReview;
  },

  updateReview: (
    id: string,
    updates: {
      rating?: number;
      title?: string;
      comment?: string;
      variantId?: string;
      variantInfo?: string;
    },
    requestingCustomerId?: string
  ) => {
    const data = initDb();
    if (!data.reviews) data.reviews = [];

    const idx = data.reviews.findIndex(r => r.id === id);
    if (idx === -1) {
      throw new Error('المراجعة غير موجودة');
    }

    const existing = data.reviews[idx];

    if (requestingCustomerId && existing.customerId !== requestingCustomerId) {
      throw new Error('غير مصرح بتعديل هذه المراجعة');
    }

    let ratingToSet = existing.rating;
    if (updates.rating !== undefined) {
      ratingToSet = assertNumeric(updates.rating, 'rating', { required: true, fieldNameArabic: 'تقييم المنتج' })!;
    }

    let commentToSet = existing.comment;
    if (updates.comment !== undefined) {
      const sanitized = sanitizeText(updates.comment);
      if (!sanitized) {
        throw new Error('التعليق لا يمكن أن يكون فارغاً');
      }
      if (sanitized.length > 2000) {
        throw new Error('التعليق طويل جداً (الحد الأقصى 2000 حرف)');
      }
      commentToSet = sanitized;
    }

    let titleToSet = existing.title;
    if (updates.title !== undefined) {
      titleToSet = updates.title ? sanitizeText(updates.title).substring(0, 150) : undefined;
    }

    const updatedReview: Review = {
      ...existing,
      rating: ratingToSet,
      comment: commentToSet,
      title: titleToSet,
      variantId: updates.variantId !== undefined ? updates.variantId : existing.variantId,
      variantInfo: updates.variantInfo !== undefined ? updates.variantInfo : existing.variantInfo,
      updatedAt: new Date().toISOString()
    };

    data.reviews[idx] = updatedReview;
    saveDb(data);

    db.recalculateProductRating(updatedReview.productId);

    return updatedReview;
  },

  deleteReview: (id: string, requestingCustomerId?: string) => {
    const data = initDb();
    if (!data.reviews) data.reviews = [];

    const idx = data.reviews.findIndex(r => r.id === id);
    if (idx === -1) {
      throw new Error('المراجعة غير موجودة');
    }

    const existing = data.reviews[idx];

    if (requestingCustomerId && existing.customerId !== requestingCustomerId) {
      throw new Error('غير مصرح بحذف هذه المراجعة');
    }

    data.reviews.splice(idx, 1);
    saveDb(data);

    db.recalculateProductRating(existing.productId);
    return true;
  },

  updateReviewStatus: (
    id: string,
    status: 'pending' | 'approved' | 'rejected' | 'hidden',
    adminResponse?: string
  ) => {
    const data = initDb();
    if (!data.reviews) data.reviews = [];

    const idx = data.reviews.findIndex(r => r.id === id);
    if (idx === -1) {
      throw new Error('المراجعة غير موجودة');
    }

    const allowedStatuses = ['pending', 'approved', 'rejected', 'hidden'];
    if (!allowedStatuses.includes(status)) {
      throw new Error('حالة المراجعة غير صالحة');
    }

    const existing = data.reviews[idx];
    const oldStatus = existing.status;

    existing.status = status;
    if (adminResponse !== undefined) {
      existing.adminResponse = sanitizeText(adminResponse);
      existing.adminRespondedAt = new Date().toISOString();
    }
    existing.updatedAt = new Date().toISOString();

    data.reviews[idx] = existing;
    saveDb(data);

    db.recalculateProductRating(existing.productId);

    db.logAction(
      'Admin',
      'تعديل حالة مراجعة',
      `تم تغيير حالة مراجعة للمنتج ${existing.productId} من "${oldStatus}" إلى "${status}"`
    );

    return existing;
  },

  getSalesAnalytics: (rangeParam?: string | { range?: string; startDate?: string; endDate?: string }): {
    totalOrders: number;
    totalSales: number;
    grossSales: number;
    totalRefunds: number;
    netSales: number;
    averageOrderValue: number;
    totalItemsSold: number;
    cancelledOrders: number;
    returnedOrders: number;
    returnsCount: number;
    pendingRefundAmount: number;
    returnRate: number;
    trend: Array<{ date: string; label: string; sales: number; orders: number }>;
  } => {
    const data = initDb();
    const orders = data.orders || [];
    const returns = data.returns || [];

    const range = typeof rangeParam === 'string' ? rangeParam : rangeParam?.range;
    const startDate = typeof rangeParam === 'object' ? rangeParam?.startDate : undefined;
    const endDate = typeof rangeParam === 'object' ? rangeParam?.endDate : undefined;

    let startMs = 0;
    let endMs = Infinity;

    if (startDate) {
      const s = new Date(startDate).getTime();
      if (!isNaN(s)) startMs = s;
    }
    if (endDate) {
      const e = new Date(endDate).getTime();
      if (!isNaN(e)) {
        endMs = endDate.includes('T') ? e : e + 24 * 60 * 60 * 1000 - 1;
      }
    }

    if (!startDate && !endDate && range) {
      const now = Date.now();
      if (range === '7d') startMs = now - 7 * 24 * 60 * 60 * 1000;
      else if (range === '30d') startMs = now - 30 * 24 * 60 * 60 * 1000;
      else if (range === '90d') startMs = now - 90 * 24 * 60 * 60 * 1000;
      else if (range === '1y' || range === 'year') startMs = now - 365 * 24 * 60 * 60 * 1000;
    }

    const filteredOrders = orders.filter(o => {
      const dateStr = (o as any).createdAt || o.date;
      const oTime = dateStr ? new Date(dateStr).getTime() : 0;
      if (startMs > 0 && oTime < startMs) return false;
      if (endMs < Infinity && oTime > endMs) return false;
      return true;
    });

    const filteredReturns = returns.filter(r => {
      const rTime = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      if (startMs > 0 && rTime < startMs) return false;
      if (endMs < Infinity && rTime > endMs) return false;
      return true;
    });

    let grossSales = 0;
    let validOrdersCount = 0;
    let totalItemsSold = 0;
    let cancelledOrders = 0;
    let returnedOrders = 0;

    for (const order of filteredOrders) {
      const st = (order.status || '').toLowerCase().trim();
      const isCancelled = (st === 'cancelled' || st === 'canceled' || st === 'ملغى' || st === 'ملغاة');
      const isReturned = (st === 'returned' || st === 'مسترجع' || st === 'مسترجعة');

      if (!isCancelled) {
        validOrdersCount++;
        grossSales += Number(order.total) || 0;
        const items = order.items || (order as any).cartItems || [];
        for (const item of items) {
          totalItemsSold += Number(item.quantity) || 1;
        }
      } else {
        cancelledOrders++;
      }

      if (isReturned) {
        returnedOrders++;
      }
    }

    // Calculate processed refunds strictly from real returns data
    let totalRefunds = 0;
    let pendingRefundAmount = 0;
    for (const r of filteredReturns) {
      const isProcessed = r.refundStatus === 'processed' || r.status === 'completed';
      const isRejectedOrCancelled = r.status === 'rejected' || r.status === 'cancelled' || r.refundStatus === 'rejected';

      if (isProcessed) {
        totalRefunds += Number(r.refundAmount || 0);
      } else if (!isRejectedOrCancelled) {
        pendingRefundAmount += Number(r.refundAmount || 0);
      }
    }

    grossSales = Math.round(grossSales * 100) / 100;
    totalRefunds = Math.round(totalRefunds * 100) / 100;
    const netSales = Math.max(0, Math.round((grossSales - totalRefunds) * 100) / 100);
    const returnsCount = filteredReturns.length;
    const returnRate = validOrdersCount > 0
      ? Number(((Math.min(validOrdersCount, returnsCount) / validOrdersCount) * 100).toFixed(1))
      : 0;

    const averageOrderValue = validOrdersCount > 0
      ? Math.round((grossSales / validOrdersCount) * 100) / 100
      : 0;

    // Generate trend buckets
    const trendBucketsMap = new Map<string, { date: string; label: string; sales: number; orders: number }>();

    const formatDateKey = (d: Date, type: 'day' | 'month') => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      if (type === 'month') {
        return `${year}-${month}`;
      }
      return `${year}-${month}-${day}`;
    };

    const formatDateLabel = (d: Date, type: 'day' | 'month') => {
      const monthName = d.toLocaleDateString('ar-EG', { month: 'short' });
      const dayNum = d.getDate();
      if (type === 'month') {
        return `${monthName} ${d.getFullYear()}`;
      }
      return `${dayNum} ${monthName}`;
    };

    const bucketType = (range === '1y' || range === 'year' || range === 'all') ? 'month' : 'day';
    const now = Date.now();

    if (range === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const key = formatDateKey(d, 'day');
        const label = formatDateLabel(d, 'day');
        trendBucketsMap.set(key, { date: key, label, sales: 0, orders: 0 });
      }
    } else if (range === '30d') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const key = formatDateKey(d, 'day');
        const label = formatDateLabel(d, 'day');
        trendBucketsMap.set(key, { date: key, label, sales: 0, orders: 0 });
      }
    } else if (range === '90d') {
      for (let i = 89; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const key = formatDateKey(d, 'day');
        const label = formatDateLabel(d, 'day');
        trendBucketsMap.set(key, { date: key, label, sales: 0, orders: 0 });
      }
    } else if (range === '1y' || range === 'year') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = formatDateKey(d, 'month');
        const label = formatDateLabel(d, 'month');
        trendBucketsMap.set(key, { date: key, label, sales: 0, orders: 0 });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = formatDateKey(d, 'month');
        const label = formatDateLabel(d, 'month');
        trendBucketsMap.set(key, { date: key, label, sales: 0, orders: 0 });
      }
    }

    for (const order of filteredOrders) {
      const st = (order.status || '').toLowerCase().trim();
      const isCancelled = (st === 'cancelled' || st === 'canceled' || st === 'ملغى' || st === 'ملغاة');

      const dateStr = (order as any).createdAt || order.date;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;

      const key = formatDateKey(d, bucketType);
      let bucket = trendBucketsMap.get(key);
      if (!bucket) {
        const label = formatDateLabel(d, bucketType);
        bucket = { date: key, label, sales: 0, orders: 0 };
        trendBucketsMap.set(key, bucket);
      }

      bucket.orders += 1;
      if (!isCancelled) {
        bucket.sales += Number(order.total) || 0;
      }
    }

    const trend = Array.from(trendBucketsMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(b => ({
        ...b,
        sales: Math.round(b.sales * 100) / 100
      }));

    return {
      totalOrders: filteredOrders.length,
      totalSales: grossSales,
      grossSales,
      totalRefunds,
      netSales,
      averageOrderValue,
      totalItemsSold,
      cancelledOrders,
      returnedOrders,
      returnsCount,
      pendingRefundAmount: Math.round(pendingRefundAmount * 100) / 100,
      returnRate,
      trend
    };
  },

  getTopProducts: (limit: number = 10): Array<{
    productId: string;
    productTitle: string;
    quantitySold: number;
    revenue: number;
  }> => {
    const data = initDb();
    const orders = data.orders || [];

    const productMap = new Map<string, { productId: string; productTitle: string; quantitySold: number; revenue: number }>();

    for (const order of orders) {
      const st = (order.status || '').toLowerCase().trim();
      if (st !== 'completed' && st !== 'delivered' && st !== 'مكتمل' && st !== 'تم التسليم') {
        continue;
      }

      const items = order.items || (order as any).cartItems || [];
      for (const item of items) {
        const pId = item.productId || item.id;
        if (!pId) continue;

        const qty = Number(item.quantity) || 1;
        const price = Number(item.price) || 0;
        const rev = qty * price;

        const existing = productMap.get(pId);
        if (existing) {
          existing.quantitySold += qty;
          existing.revenue += rev;
        } else {
          const product = data.products.find(p => p.id === pId);
          const pTitle = product ? product.title : (item.productTitle || item.title || 'منتج غير معروف');
          productMap.set(pId, {
            productId: pId,
            productTitle: pTitle,
            quantitySold: qty,
            revenue: rev
          });
        }
      }
    }

    const sorted = Array.from(productMap.values()).sort((a, b) => {
      if (b.quantitySold !== a.quantitySold) {
        return b.quantitySold - a.quantitySold;
      }
      return b.revenue - a.revenue;
    });

    return sorted.map(item => ({
      ...item,
      revenue: Math.round(item.revenue * 100) / 100
    })).slice(0, limit);
  },

  getCustomerAnalytics: (): {
    totalCustomers: number;
    activeCustomers: number;
    blockedCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
  } => {
    const data = initDb();
    const customers = data.customers || [];
    const orders = data.orders || [];

    const totalCustomers = customers.length;
    let blockedCustomers = 0;
    let newCustomers = 0;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const c of customers) {
      if (c.status === 'blocked' || (c as any).isBlocked === true) {
        blockedCustomers++;
      }
      const cTime = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      if (cTime >= thirtyDaysAgo) {
        newCustomers++;
      }
    }

    const activeCustomers = totalCustomers - blockedCustomers;

    const customerOrderCounts = new Map<string, number>();
    for (const o of orders) {
      const cKey = o.userId || o.customerId || o.customer?.email || o.customer?.phone;
      if (cKey) {
        customerOrderCounts.set(cKey, (customerOrderCounts.get(cKey) || 0) + 1);
      }
    }

    let repeatCustomers = 0;
    for (const count of customerOrderCounts.values()) {
      if (count > 1) {
        repeatCustomers++;
      }
    }

    return {
      totalCustomers,
      activeCustomers,
      blockedCustomers,
      newCustomers,
      repeatCustomers
    };
  },

  getInventoryAnalytics: (): {
    totalProducts: number;
    totalStock: number;
    lowStockItems: number;
    outOfStockItems: number;
    inventoryValue: number;
  } => {
    const data = initDb();
    const products = data.products || [];

    const validProducts = products.filter(p => {
      if ((p as any).isHidden === true || (p as any).status === 'hidden' || (p as any).isDeleted === true) return false;
      return true;
    });

    let totalStock = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    let inventoryValue = 0;

    for (const p of validProducts) {
      const threshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 5;
      const pPrice = p.discountPrice || p.price || 0;

      if (p.variants && p.variants.length > 0) {
        for (const v of p.variants) {
          const vStock = typeof v.stock === 'number' ? v.stock : 0;
          const vThreshold = typeof v.lowStockThreshold === 'number' ? v.lowStockThreshold : threshold;
          const vPrice = v.price || pPrice;

          totalStock += vStock;
          inventoryValue += vStock * vPrice;

          if (vStock <= 0) {
            outOfStockItems++;
          } else if (vStock <= vThreshold) {
            lowStockItems++;
          }
        }
      } else {
        const pStock = typeof p.stock === 'number' ? p.stock : 0;

        totalStock += pStock;
        inventoryValue += pStock * pPrice;

        if (pStock <= 0) {
          outOfStockItems++;
        } else if (pStock <= threshold) {
          lowStockItems++;
        }
      }
    }

    return {
      totalProducts: validProducts.length,
      totalStock,
      lowStockItems,
      outOfStockItems,
      inventoryValue: Math.round(inventoryValue * 100) / 100
    };
  },

  getReviewAnalytics: (): {
    totalReviews: number;
    approvedReviews: number;
    pendingReviews: number;
    rejectedReviews: number;
    averageRating: number;
  } => {
    const data = initDb();
    const reviews = data.reviews || [];

    let approvedReviews = 0;
    let pendingReviews = 0;
    let rejectedReviews = 0;
    let approvedRatingSum = 0;

    for (const r of reviews) {
      if (r.status === 'approved') {
        approvedReviews++;
        approvedRatingSum += Number(r.rating) || 0;
      } else if (r.status === 'pending') {
        pendingReviews++;
      } else if (r.status === 'rejected' || r.status === 'hidden') {
        rejectedReviews++;
      }
    }

    const averageRating = approvedReviews > 0
      ? Math.round((approvedRatingSum / approvedReviews) * 10) / 10
      : 0;

    return {
      totalReviews: reviews.length,
      approvedReviews,
      pendingReviews,
      rejectedReviews,
      averageRating
    };
  },

  getCampaigns: (): Campaign[] => {
    const data = initDb();
    return data.campaigns || [];
  },

  getCampaignById: (id: string): Campaign | undefined => {
    const data = initDb();
    return (data.campaigns || []).find(c => c.id === id);
  },

  getActiveCampaigns: (): Campaign[] => {
    const data = initDb();
    const now = Date.now();
    return (data.campaigns || []).filter(c => {
      if (!c.active) return false;
      const start = new Date(c.startAt).getTime();
      const end = new Date(c.endAt).getTime();
      return !isNaN(start) && !isNaN(end) && now >= start && now <= end;
    });
  },

  createCampaign: (input: {
    name: string;
    type: 'percentage' | 'fixed' | 'free_shipping';
    value: number;
    startAt: string;
    endAt: string;
    active?: boolean;
    productIds?: string[];
    categoryIds?: string[];
    minimumOrderValue?: number;
    maximumDiscountAmount?: number;
  }): Campaign => {
    const data = initDb();
    if (!data.campaigns) data.campaigns = [];

    const now = new Date().toISOString();
    const id = `cmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const campaign: Campaign = {
      id,
      name: input.name,
      type: input.type,
      value: Number(input.value) || 0,
      startAt: new Date(input.startAt).toISOString(),
      endAt: new Date(input.endAt).toISOString(),
      active: input.active !== undefined ? Boolean(input.active) : true,
      productIds: Array.isArray(input.productIds) ? input.productIds : [],
      categoryIds: Array.isArray(input.categoryIds) ? input.categoryIds : [],
      minimumOrderValue: input.minimumOrderValue !== undefined && input.minimumOrderValue !== null ? Number(input.minimumOrderValue) : undefined,
      maximumDiscountAmount: input.maximumDiscountAmount !== undefined && input.maximumDiscountAmount !== null ? Number(input.maximumDiscountAmount) : undefined,
      createdAt: now,
      updatedAt: now
    };

    data.campaigns.push(campaign);
    saveDb(data);
    return campaign;
  },

  updateCampaign: (id: string, updates: Partial<Campaign>): Campaign | undefined => {
    const data = initDb();
    if (!data.campaigns) return undefined;

    const index = data.campaigns.findIndex(c => c.id === id);
    if (index === -1) return undefined;

    const current = data.campaigns[index];
    const updated: Campaign = {
      ...current,
      ...updates,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString()
    };

    if (updates.type !== undefined) updated.type = updates.type;
    if (updates.value !== undefined) updated.value = Number(updates.value);
    if (updates.startAt !== undefined) updated.startAt = new Date(updates.startAt).toISOString();
    if (updates.endAt !== undefined) updated.endAt = new Date(updates.endAt).toISOString();
    if (updates.active !== undefined) updated.active = Boolean(updates.active);

    data.campaigns[index] = updated;
    saveDb(data);
    return updated;
  },

  deleteCampaign: (id: string): boolean => {
    const data = initDb();
    if (!data.campaigns) return false;

    const initialLength = data.campaigns.length;
    data.campaigns = data.campaigns.filter(c => c.id !== id);

    if (data.campaigns.length !== initialLength) {
      saveDb(data);
      return true;
    }
    return false;
  },

  evaluateBestCampaign: (
    items: Array<{ productId: string; quantity: number; price: number }>,
    subtotal: number,
    shippingCost: number
  ): { bestCampaign: Campaign | null; campaignDiscount: number } => {
    const activeCampaigns = db.getActiveCampaigns();
    if (!activeCampaigns || activeCampaigns.length === 0) {
      return { bestCampaign: null, campaignDiscount: 0 };
    }

    let bestCampaign: Campaign | null = null;
    let maxDiscount = 0;

    for (const campaign of activeCampaigns) {
      if (campaign.minimumOrderValue !== undefined && campaign.minimumOrderValue !== null && subtotal < campaign.minimumOrderValue) {
        continue;
      }

      const hasProductTargets = Array.isArray(campaign.productIds) && campaign.productIds.length > 0;
      const hasCategoryTargets = Array.isArray(campaign.categoryIds) && campaign.categoryIds.length > 0;

      let eligibleSubtotal = 0;

      if (!hasProductTargets && !hasCategoryTargets) {
        eligibleSubtotal = subtotal;
      } else {
        for (const item of items) {
          const product = db.getProductById(item.productId);
          if (!product) continue;

          const isProductTargeted = hasProductTargets && campaign.productIds!.includes(item.productId);
          const isCategoryTargeted = hasCategoryTargets && !!product.category && campaign.categoryIds!.includes(product.category);

          if (isProductTargeted || isCategoryTargeted) {
            eligibleSubtotal += item.price * item.quantity;
          }
        }
      }

      let discount = 0;

      if (campaign.type === 'percentage') {
        if (eligibleSubtotal > 0) {
          discount = (eligibleSubtotal * campaign.value) / 100;
          if (campaign.maximumDiscountAmount !== undefined && campaign.maximumDiscountAmount !== null && discount > campaign.maximumDiscountAmount) {
            discount = campaign.maximumDiscountAmount;
          }
        }
      } else if (campaign.type === 'fixed') {
        if (eligibleSubtotal > 0) {
          discount = Math.min(campaign.value, eligibleSubtotal);
        }
      } else if (campaign.type === 'free_shipping') {
        discount = shippingCost;
      }

      discount = Math.max(0, Number(discount.toFixed(2)));

      if (discount > maxDiscount) {
        maxDiscount = discount;
        bestCampaign = campaign;
      }
    }

    return {
      bestCampaign: maxDiscount > 0 ? bestCampaign : null,
      campaignDiscount: maxDiscount
    };
  },

  // ==========================================
  // 🔄 RETURN REQUESTS DB DATA ACCESS LAYER
  // ==========================================

  getReturnRequests: (): ReturnRequest[] => {
    const data = initDb();
    return Array.isArray(data.returns) ? data.returns : [];
  },

  getReturnRequestById: (id: string): ReturnRequest | undefined => {
    const returns = db.getReturnRequests();
    return returns.find(r => r.id === id);
  },

  getReturnRequestsByCustomerId: (customerId: string, email?: string, phone?: string): ReturnRequest[] => {
    const returns = db.getReturnRequests();
    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const cleanPhone = phone ? phone.trim() : '';

    return returns.filter(r => {
      const isCustomerMatch = r.customerId && r.customerId === customerId;
      const isPhoneMatch = cleanPhone && r.customerPhone && r.customerPhone.trim() === cleanPhone;
      return Boolean(isCustomerMatch || isPhoneMatch);
    });
  },

  getReturnRequestsByOrderId: (orderId: string): ReturnRequest[] => {
    const returns = db.getReturnRequests();
    return returns.filter(r => r.orderId === orderId);
  },

  getReturnedQuantityForItem: (orderId: string, productId: string, variantId?: string): number => {
    const returns = db.getReturnRequestsByOrderId(orderId);
    let returnedCount = 0;

    for (const r of returns) {
      // Exclude cancelled and rejected return requests when calculating active returned quantity
      if (r.status === 'cancelled' || r.status === 'rejected') {
        continue;
      }

      const isProductMatch = r.productId === productId;
      const isVariantMatch = variantId ? r.variantId === variantId : !r.variantId;

      if (isProductMatch && isVariantMatch) {
        returnedCount += r.quantity || 0;
      }
    }

    return returnedCount;
  },

  createReturnRequest: (dataInput: Omit<ReturnRequest, 'id' | 'createdAt' | 'updatedAt'>): ReturnRequest => {
    const data = initDb();
    if (!data.returns) {
      data.returns = [];
    }

    const now = new Date().toISOString();
    const history = dataInput.history || [
      {
        date: now,
        action: 'إنشاء طلب الإرجاع',
        actor: dataInput.customerName || 'العميل',
        status: dataInput.status,
        refundStatus: dataInput.refundStatus,
        note: dataInput.customerNote || 'تم تقديم طلب الإرجاع من قبل العميل'
      }
    ];

    const newReturn: ReturnRequest = {
      ...dataInput,
      history,
      id: `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: now,
      updatedAt: now
    };

    data.returns.unshift(newReturn);
    saveDb(data);
    return newReturn;
  },

  updateReturnRequest: (id: string, updates: Partial<ReturnRequest>): ReturnRequest | undefined => {
    const data = initDb();
    if (!data.returns) return undefined;

    const index = data.returns.findIndex(r => r.id === id);
    if (index === -1) return undefined;

    const now = new Date().toISOString();
    const updated: ReturnRequest = {
      ...data.returns[index],
      ...updates,
      updatedAt: now
    };

    data.returns[index] = updated;
    saveDb(data);
    return updated;
  },

  getReturnsAnalytics: (params?: { range?: string; startDate?: string; endDate?: string }): {
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
    recentReturns: ReturnRequest[];
  } => {
    const data = initDb();
    const allReturns = data.returns || [];
    const allOrders = data.orders || [];

    const range = params?.range;
    const startDate = params?.startDate;
    const endDate = params?.endDate;

    let startMs = 0;
    let endMs = Infinity;

    if (startDate) {
      const s = new Date(startDate).getTime();
      if (!isNaN(s)) startMs = s;
    }
    if (endDate) {
      const e = new Date(endDate).getTime();
      if (!isNaN(e)) {
        // Include full day if only date is passed
        endMs = endDate.includes('T') ? e : e + 24 * 60 * 60 * 1000 - 1;
      }
    }

    if (!startDate && !endDate && range) {
      const now = Date.now();
      if (range === '7d') startMs = now - 7 * 24 * 60 * 60 * 1000;
      else if (range === '30d') startMs = now - 30 * 24 * 60 * 60 * 1000;
      else if (range === '90d') startMs = now - 90 * 24 * 60 * 60 * 1000;
      else if (range === '1y' || range === 'year') startMs = now - 365 * 24 * 60 * 60 * 1000;
    }

    const filteredReturns = allReturns.filter(r => {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      if (startMs > 0 && t < startMs) return false;
      if (endMs < Infinity && t > endMs) return false;
      return true;
    });

    const filteredOrders = allOrders.filter(o => {
      const dateStr = (o as any).createdAt || o.date;
      const t = dateStr ? new Date(dateStr).getTime() : 0;
      if (startMs > 0 && t < startMs) return false;
      if (endMs < Infinity && t > endMs) return false;
      return true;
    });

    let pendingReturns = 0;
    let approvedReturns = 0;
    let pickupPendingReturns = 0;
    let receivedReturns = 0;
    let completedReturns = 0;
    let rejectedReturns = 0;
    let cancelledReturns = 0;

    let totalRefundedAmount = 0;
    let pendingRefundAmount = 0;
    let returnedProductValue = 0;
    let damagedProductValue = 0;
    let restockedProductValue = 0;
    let restockedItemsCount = 0;

    const reasonsBreakdown: Record<string, number> = {
      damaged: 0,
      wrong_product: 0,
      different_from_description: 0,
      defective: 0,
      unwanted: 0,
      other: 0
    };

    const statusBreakdown: Record<string, number> = {
      pending: 0,
      approved: 0,
      pickup_pending: 0,
      received: 0,
      completed: 0,
      rejected: 0,
      cancelled: 0
    };

    const refundStatusBreakdown: Record<string, number> = {
      pending: 0,
      approved: 0,
      processed: 0,
      rejected: 0
    };

    const productReturnMap = new Map<string, {
      productId: string;
      productTitle: string;
      returnsCount: number;
      returnedQuantity: number;
      totalRefunded: number;
      reasonsCount: Record<string, number>;
    }>();

    for (const r of filteredReturns) {
      const st = r.status;
      if (statusBreakdown[st] !== undefined) statusBreakdown[st]++;
      else statusBreakdown[st] = 1;

      if (st === 'pending') pendingReturns++;
      else if (st === 'approved') approvedReturns++;
      else if (st === 'pickup_pending') pickupPendingReturns++;
      else if (st === 'received') receivedReturns++;
      else if (st === 'completed') completedReturns++;
      else if (st === 'rejected') rejectedReturns++;
      else if (st === 'cancelled') cancelledReturns++;

      const rSt = r.refundStatus || 'pending';
      if (refundStatusBreakdown[rSt] !== undefined) refundStatusBreakdown[rSt]++;
      else refundStatusBreakdown[rSt] = 1;

      const itemVal = Number(r.unitPrice || 0) * Number(r.quantity || 1);
      const isProcessed = rSt === 'processed' || st === 'completed';
      const isRefRejectedOrCancelled = st === 'rejected' || st === 'cancelled' || rSt === 'rejected';

      if (isProcessed) {
        totalRefundedAmount += Number(r.refundAmount || 0);
      } else if (!isRefRejectedOrCancelled) {
        pendingRefundAmount += Number(r.refundAmount || 0);
      }

      if (!isRefRejectedOrCancelled) {
        returnedProductValue += itemVal;
        if (r.restocked === true) {
          restockedProductValue += itemVal;
          restockedItemsCount += Number(r.restockQuantity || r.quantity || 0);
        } else if (r.restocked === false || r.reason === 'damaged' || r.reason === 'defective') {
          damagedProductValue += itemVal;
        }
      }

      if (r.reason) {
        if (reasonsBreakdown[r.reason] !== undefined) reasonsBreakdown[r.reason]++;
        else reasonsBreakdown[r.reason] = 1;
      }

      // Group per product
      const pId = r.productId || 'unknown';
      const existing = productReturnMap.get(pId) || {
        productId: pId,
        productTitle: r.productTitle || 'منتج غير معروف',
        returnsCount: 0,
        returnedQuantity: 0,
        totalRefunded: 0,
        reasonsCount: {}
      };
      existing.returnsCount++;
      existing.returnedQuantity += Number(r.quantity || 1);
      if (isProcessed) {
        existing.totalRefunded += Number(r.refundAmount || 0);
      }
      if (r.reason) {
        existing.reasonsCount[r.reason] = (existing.reasonsCount[r.reason] || 0) + 1;
      }
      productReturnMap.set(pId, existing);
    }

    // Top returned products
    const topReturnedProducts = Array.from(productReturnMap.values())
      .map(p => {
        let maxReason = 'other';
        let maxCount = 0;
        Object.entries(p.reasonsCount).forEach(([reason, count]) => {
          if (count > maxCount) {
            maxCount = count;
            maxReason = reason;
          }
        });
        return {
          productId: p.productId,
          productTitle: p.productTitle,
          returnsCount: p.returnsCount,
          returnedQuantity: p.returnedQuantity,
          totalRefunded: Math.round(p.totalRefunded * 100) / 100,
          mainReason: maxReason
        };
      })
      .sort((a, b) => b.returnsCount - a.returnsCount)
      .slice(0, 10);

    // Calculate gross and net sales for the matching period
    let grossSales = 0;
    let validOrdersCount = 0;
    for (const order of filteredOrders) {
      const st = (order.status || '').toLowerCase().trim();
      const isCancelled = (st === 'cancelled' || st === 'canceled' || st === 'ملغى' || st === 'ملغاة');
      if (!isCancelled) {
        validOrdersCount++;
        grossSales += Number(order.total) || 0;
      }
    }

    grossSales = Math.round(grossSales * 100) / 100;
    totalRefundedAmount = Math.round(totalRefundedAmount * 100) / 100;
    pendingRefundAmount = Math.round(pendingRefundAmount * 100) / 100;
    returnedProductValue = Math.round(returnedProductValue * 100) / 100;
    damagedProductValue = Math.round(damagedProductValue * 100) / 100;
    restockedProductValue = Math.round(restockedProductValue * 100) / 100;
    const netSales = Math.max(0, Math.round((grossSales - totalRefundedAmount) * 100) / 100);

    const totalOrdersCount = filteredOrders.length;
    const totalReturns = filteredReturns.length;
    const returnRate = validOrdersCount > 0
      ? Number(((Math.min(validOrdersCount, totalReturns) / validOrdersCount) * 100).toFixed(1))
      : 0;

    return {
      totalReturns,
      pendingReturns,
      approvedReturns,
      pickupPendingReturns,
      receivedReturns,
      completedReturns,
      rejectedReturns,
      cancelledReturns,
      totalRefundedAmount,
      pendingRefundAmount,
      returnedProductValue,
      damagedProductValue,
      restockedProductValue,
      restockedItemsCount,
      returnRate,
      grossSales,
      netSales,
      reasonsBreakdown,
      statusBreakdown,
      refundStatusBreakdown,
      topReturnedProducts,
      recentReturns: filteredReturns.slice(0, 5)
    };
  }

};
