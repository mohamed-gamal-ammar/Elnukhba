import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import sharp from 'sharp';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { routeCache, clearRouteCache } from './server/middleware/cache.js';
import { db, verifyPassword, hashPassword, getRatingDistribution, searchProducts, normalizeArabicText } from './server/db.js';
import { validateBackendNumeric, assertNumeric } from './server/numericValidation.js';
import { askAssistant } from './server/gemini.js';
import { Order, OrderStatus, Product, Coupon, Banner, ShippingProvince, Customer, StockMovement, StockMovementType, Campaign, AdminUser, Role, Permission, RolePermission, ReturnRequest, ReturnReason, ReturnStatus, RefundStatus } from './src/types.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // 1. Enable trust proxy for accurate client IP resolution behind GCP Cloud Run load balancer
  app.set('trust proxy', 1);

  // Compression middleware for high performance Gzip/Brotli compression
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    level: 6 // توازن مثالي بين السرعة ونسبة الضغط
  }));

  // Body parser middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ==========================================
  // 🛡️ SECURITY MIDDLEWARES & UTILITIES
  // ==========================================

  // 1. HTTP Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=()'
    );
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https: ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://ai.studio https://*.run.app https://*.google.com;"
    );
    res.removeHeader('X-Powered-By');
    next();
  });

  // 2. CORS Handling & Restricted Allowed Origins Setup
  const ALLOWED_ORIGINS = Array.from(new Set([
    process.env.CLIENT_URL,
    process.env.STORE_DOMAIN,
    'https://yourstore.com',
    'https://www.yourstore.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ].filter(Boolean)));

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    // 1. تقييد Access-Control-Allow-Origin للنطاقات المعتمدة أو استجابة نفس النطاق / preview
    if (origin) {
      if (
        ALLOWED_ORIGINS.includes(origin) ||
        origin.endsWith('.run.app') ||
        origin.endsWith('.google.com') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-idempotency-key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 3. معالجة طلبات الفحص المسبق (Preflight OPTIONS Requests)
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  });

  // 3. Rate Limiter implementation (In-Memory with periodic cleanup)
  const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
  
  // Periodic cleanup of expired rate limit keys to prevent memory leaks
  const gcInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitCache.entries()) {
      if (now > value.resetTime) {
        rateLimitCache.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (gcInterval && typeof gcInterval.unref === 'function') {
    gcInterval.unref();
  }
  
  const createRateLimiter = (limit: number, windowMs: number, message: string, keyExtractor?: (req: any) => string) => {
    return (req: any, res: any, next: any) => {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
      const customKey = keyExtractor ? keyExtractor(req) : '';
      const key = `${req.path}:${ip}${customKey ? `:${customKey}` : ''}`;
      const now = Date.now();
      
      let rateData = rateLimitCache.get(key);
      if (!rateData || now > rateData.resetTime) {
        rateData = { count: 1, resetTime: now + windowMs };
        rateLimitCache.set(key, rateData);
      } else {
        rateData.count++;
      }
      
      if (rateData.count > limit) {
        res.setHeader('Retry-After', Math.ceil((rateData.resetTime - now) / 1000));
        return res.status(429).json({ error: message });
      }
      
      next();
    };
  };

  // Production-grade Rate Limiters
  // Admin & customer login: 10 attempts per minute per IP + target account to protect against brute-force
  const loginRateLimiter = createRateLimiter(10, 60 * 1000, 'محاولات دخول كثيرة جداً. يرجى الانتظار لمدة دقيقة قبل المحاولة مجدداً.', (req) => {
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : '';
    return email;
  });
  const forgotPasswordRateLimiter = createRateLimiter(5, 60 * 1000, 'محاولات استعادة كلمة المرور كثيرة جداً. يرجى الانتظار دقيقة قبل المحاولة مجدداً.');
  const resetPasswordRateLimiter = createRateLimiter(5, 60 * 1000, 'محاولات إعادة تعيين كلمة المرور كثيرة جداً. يرجى الانتظار دقيقة قبل المحاولة مجدداً.');
  const assistRateLimiter = createRateLimiter(10, 60 * 1000, 'لقد تجاوزت الحد المسموح به لطلبات المساعد الذكي. يرجى المحاولة بعد دقيقة.');
  const checkoutRateLimiter = createRateLimiter(10, 5 * 60 * 1000, 'عدد طلبات شراء كثيرة جداً من هذا الجهاز. يرجى الانتظار قليلاً.');
  const reviewRateLimiter = createRateLimiter(5, 60 * 1000, 'لقد قمت بإضافة العديد من التقييمات مؤخراً. يرجى المحاولة لاحقاً.');

  // 4. Input Sanitization Utilities to prevent XSS and Proto-Pollution
  const sanitizeValue = (val: any): any => {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Safe URL / Path handling: preserve & and / in valid URLs and paths while blocking XSS/javascript: protocols
      if (
        (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('data:image/')) &&
        !trimmed.toLowerCase().includes('javascript:') &&
        !trimmed.includes('<') &&
        !trimmed.includes('>') &&
        !trimmed.includes('"') &&
        !trimmed.includes("'")
      ) {
        return trimmed;
      }
      return val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    } else if (Array.isArray(val)) {
      return val.map(sanitizeValue);
    } else if (val !== null && typeof val === 'object') {
      const cleanedObj: any = {};
      for (const [key, value] of Object.entries(val)) {
        if (key === '__proto__' || key === 'constructor') continue;
        cleanedObj[key] = sanitizeValue(value);
      }
      return cleanedObj;
    }
    return val;
  };

  const sanitizeText = (val: string): string => {
    return typeof val === 'string' ? val.trim() : '';
  };

  app.use((req, res, next) => {
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }
    next();
  });

  // 5. Dynamic Session Management for Admin
  const activeSessions = new Map<string, { email: string; expiresAt: number }>();
  const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours duration

  // ==========================================
  // 🛍️ STOREFRONT ENDPOINTS (REST API)
  // ==========================================

  // Get store settings / CMS details (cached for 60 seconds)
  app.get('/api/settings', routeCache(60), (req, res) => {
    try {
      const settings = db.getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve settings', message: err.message });
    }
  });

  // Get active social media links (public API)
  app.get('/api/social-links', (req, res) => {
    try {
      const links = db.getPublicSocialLinks();
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve social links', message: err.message });
    }
  });

  // Get all active categories (cached for 60 seconds)
  app.get('/api/categories', routeCache(60), (req, res) => {
    try {
      const products = db.getProducts();
      const categories = Array.from(new Set(products.map(p => p.category)));
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Get all active brands (cached for 60 seconds)
  app.get('/api/brands', routeCache(60), (req, res) => {
    try {
      const products = db.getProducts();
      const brands = Array.from(new Set(products.map(p => p.brand)));
      res.json(brands);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch brands' });
    }
  });

  // Get products with filters, search, and sorting (cached for 30 seconds)
  app.get('/api/products', routeCache(30), (req, res) => {
    try {
      let products = db.getProducts();
      const { category, brand, search, minPrice, maxPrice, rating, isFeatured, isBestSeller, isLatest, isOffer, sort } = req.query;

      // Filter by category
      if (category) {
        products = products.filter(p => p.category === category);
      }

      // Filter by brand
      if (brand) {
        products = products.filter(p => p.brand === brand);
      }

      // Enhanced Search Engine (Arabic normalization, tokenization, multi-field, relevance scoring)
      if (search && typeof search === 'string' && search.trim().length > 0) {
        products = searchProducts(products, search.trim(), sort as string | undefined);
      }

      // Filter by price range
      if (minPrice !== undefined && minPrice !== '') {
        const vMin = validateBackendNumeric(minPrice, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى للسعر' });
        if (!vMin.isValid) {
          return res.status(400).json({ error: vMin.error });
        }
        products = products.filter(p => (p.discountPrice || p.price) >= vMin.value);
      }
      if (maxPrice !== undefined && maxPrice !== '') {
        const vMax = validateBackendNumeric(maxPrice, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى للسعر' });
        if (!vMax.isValid) {
          return res.status(400).json({ error: vMax.error });
        }
        products = products.filter(p => (p.discountPrice || p.price) <= vMax.value);
      }

      // Filter by rating
      if (rating !== undefined && rating !== '') {
        const vRating = validateBackendNumeric(rating, 'rating', { fieldNameArabic: 'التقييم' });
        if (!vRating.isValid) {
          return res.status(400).json({ error: vRating.error });
        }
        products = products.filter(p => p.rating >= vRating.value);
      }

      // Special tags
      if (isFeatured === 'true') {
        products = products.filter(p => p.isFeatured);
      }
      if (isBestSeller === 'true') {
        products = products.filter(p => p.isBestSeller);
      }
      if (isLatest === 'true') {
        products = products.filter(p => p.isLatest);
      }
      if (isOffer === 'true') {
        products = products.filter(p => p.discountPrice !== undefined || p.isFlashSale);
      }

      // Sorters
      if (sort && sort !== 'relevance') {
        switch (sort) {
          case 'price_asc':
            products.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
            break;
          case 'price_desc':
            products.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
            break;
          case 'rating':
            products.sort((a, b) => b.rating - a.rating);
            break;
          case 'newest':
            products.sort((a, b) => (b.isLatest ? 1 : 0) - (a.isLatest ? 1 : 0));
            break;
          case 'alphabetical':
            products.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
            break;
          default:
            if (!search) {
              products.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
            }
        }
      } else if (!search) {
        products.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
      }

      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch products' });
    }
  });

  // Get best selling products
  app.get('/api/products/best-sellers', (req, res) => {
    try {
      let limit = 8;
      if (req.query.limit !== undefined && req.query.limit !== '') {
        const vLimit = validateBackendNumeric(req.query.limit, 'positive_integer', { min: 1, max: 100, fieldNameArabic: 'الحد الأقصى للنتائج' });
        if (!vLimit.isValid) {
          return res.status(400).json({ error: vLimit.error });
        }
        limit = vLimit.value;
      }
      const products = db.getBestSellingProducts(limit);
      res.json({
        success: true,
        products
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch best sellers', message: err.message });
    }
  });

  // Get trending products
  app.get('/api/products/trending', (req, res) => {
    try {
      let limit = 8;
      if (req.query.limit !== undefined && req.query.limit !== '') {
        const vLimit = validateBackendNumeric(req.query.limit, 'positive_integer', { min: 1, max: 100, fieldNameArabic: 'الحد الأقصى للنتائج' });
        if (!vLimit.isValid) {
          return res.status(400).json({ error: vLimit.error });
        }
        limit = vLimit.value;
      }
      const products = db.getTrendingProducts(limit);
      res.json({
        success: true,
        products
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch trending products', message: err.message });
    }
  });

  // Get new arrivals products
  app.get('/api/products/new-arrivals', (req, res) => {
    try {
      let limit = 8;
      if (req.query.limit !== undefined && req.query.limit !== '') {
        const vLimit = validateBackendNumeric(req.query.limit, 'positive_integer', { min: 1, max: 100, fieldNameArabic: 'الحد الأقصى للنتائج' });
        if (!vLimit.isValid) {
          return res.status(400).json({ error: vLimit.error });
        }
        limit = vLimit.value;
      }
      const products = db.getNewestProducts(limit);
      res.json({
        success: true,
        products
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch new arrivals', message: err.message });
    }
  });

  // Get details of a single product
  app.get('/api/products/:id', (req, res) => {
    try {
      const product = db.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(product);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch product details' });
    }
  });

  // Get product recommendations
  app.get('/api/products/:id/recommendations', (req, res) => {
    try {
      const product = db.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      let limit = 8;
      if (req.query.limit !== undefined && req.query.limit !== '') {
        const vLimit = validateBackendNumeric(req.query.limit, 'positive_integer', { min: 1, max: 100, fieldNameArabic: 'الحد الأقصى للنتائج' });
        if (!vLimit.isValid) {
          return res.status(400).json({ error: vLimit.error });
        }
        limit = vLimit.value;
      }
      const recommendations = db.getRecommendations(req.params.id, limit);
      res.json({
        success: true,
        recommendations
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch recommendations', message: err.message });
    }
  });

  // Get customers also bought products
  app.get('/api/products/:id/also-bought', (req, res) => {
    try {
      const product = db.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      let limit = 8;
      if (req.query.limit !== undefined && req.query.limit !== '') {
        const vLimit = validateBackendNumeric(req.query.limit, 'positive_integer', { min: 1, max: 100, fieldNameArabic: 'الحد الأقصى للنتائج' });
        if (!vLimit.isValid) {
          return res.status(400).json({ error: vLimit.error });
        }
        limit = vLimit.value;
      }
      const products = db.getCustomersAlsoBought(req.params.id, limit);
      res.json({
        success: true,
        products
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch co-purchased products', message: err.message });
    }
  });

  // Post a review for a product
  app.post('/api/products/:id/reviews', reviewRateLimiter, (req, res) => {
    try {
      const { userName, rating, comment } = req.body;
      if (!userName || !rating || !comment) {
        return res.status(400).json({ error: 'Missing required review fields' });
      }

      const vRating = validateBackendNumeric(rating, 'rating', { required: true, fieldNameArabic: 'تقييم المنتج' });
      if (!vRating.isValid) {
        return res.status(400).json({ error: vRating.error });
      }

      const product = db.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const newReview = {
        id: `rev-${Date.now()}`,
        userName,
        rating: vRating.value,
        comment,
        date: new Date().toISOString().split('T')[0]
      };

      const updatedReviews = [newReview, ...product.reviews];
      const avgRating = Number((updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length).toFixed(1));

      db.updateProduct(product.id, {
        reviews: updatedReviews,
        reviewsCount: updatedReviews.length,
        rating: avgRating
      });

      // System notification
      db.logAction('Review', 'إضافة تقييم', `قام العميل ${userName} بتقييم المنتج ${product.title} بـ ${vRating.value} نجوم`);

      res.status(201).json(newReview);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to submit review' });
    }
  });

  // Customer Sessions Store
  const customerSessions = new Map<string, { customerId: string; expiresAt: number; rememberMe?: boolean }>();

  // In-memory idempotency cache for order creations
  const orderIdempotencyCache = new Map<string, { order: Order; timestamp: number }>();

  // Helper to invalidate all sessions for a customer
  const invalidateCustomerSessions = (customerId: string) => {
    for (const [token, session] of customerSessions.entries()) {
      if (session.customerId === customerId) {
        customerSessions.delete(token);
      }
    }
  };

  // Validate discount coupon
  app.get('/api/coupons/validate', (req, res) => {
    try {
      const { code, cartTotal, email, phone, customerId, governorate } = req.query;
      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({
          valid: false,
          errorCode: 'COUPON_INVALID',
          error: 'كود الكوبون مطلوب',
          message: 'كود الكوبون مطلوب'
        });
      }

      const cleanCode = code.trim().toUpperCase();
      const coupons = db.getCoupons();
      const coupon = coupons.find(c => c.code.toUpperCase() === cleanCode);

      if (!coupon) {
        return res.status(404).json({
          valid: false,
          errorCode: 'COUPON_NOT_FOUND',
          error: 'الكوبون المدخل غير صحيح',
          message: 'الكوبون المدخل غير صحيح'
        });
      }

      if (!coupon.isActive) {
        return res.status(400).json({
          valid: false,
          errorCode: 'COUPON_DISABLED',
          error: 'هذا الكوبون غير فعال حالياً',
          message: 'هذا الكوبون غير فعال حالياً'
        });
      }

      // Check Expiry Date
      if (coupon.expiryDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (todayStr > coupon.expiryDate) {
          return res.status(400).json({
            valid: false,
            errorCode: 'COUPON_EXPIRED',
            error: 'عذراً، هذا الكوبون منتهي الصلاحية',
            message: 'عذراً، هذا الكوبون منتهي الصلاحية'
          });
        }
      }

      // Check Usage Limit Globally
      if (typeof coupon.usageLimit === 'number' && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({
          valid: false,
          errorCode: 'COUPON_USAGE_LIMIT_REACHED',
          error: 'عذراً، تم الوصول للحد الأقصى لاستخدام هذا الكوبون',
          message: 'عذراً، تم الوصول للحد الأقصى لاستخدام هذا الكوبون'
        });
      }

      // Extract Customer Identity from Authorization Header Token or Query Params
      let sessionCustomerId: string | undefined = undefined;
      let sessionCustomer: any = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const session = customerSessions.get(token);
        if (session && Date.now() <= session.expiresAt) {
          sessionCustomerId = session.customerId;
          sessionCustomer = db.getCustomerById(session.customerId);
        }
      }

      const resolvedEmail = (sessionCustomer?.email || (email as string) || '').toLowerCase().trim();
      const resolvedPhone = (sessionCustomer?.phone || (phone as string) || '').trim();
      const resolvedCustomerId = (sessionCustomerId || (customerId as string) || sessionCustomer?.id || '').trim();

      const customerIdentifiers = [
        resolvedCustomerId,
        resolvedEmail,
        resolvedPhone
      ].filter(Boolean);

      // Check Single-Use Per Customer Rule (once per user)
      if (coupon.oneUsePerUser) {
        // 1. Check coupon's recorded usedByUsers list
        const inUsedByUsers = customerIdentifiers.length > 0 && customerIdentifiers.some(id => 
          (coupon.usedByUsers || []).some(u => u && u.toLowerCase().trim() === id.toLowerCase())
        );

        // 2. Cross-check against completed past orders in database for airtight security
        const existingOrders = db.getOrders();
        const inPastOrders = customerIdentifiers.length > 0 && existingOrders.some(order => {
          if (!order.couponCode || order.couponCode.toUpperCase() !== cleanCode) return false;
          if (order.status === 'Cancelled') return false; // Cancelled orders do not block reuse
          const orderCust: any = order.customer || {};
          const pastOrderIdentifiers = [
            order.customerId,
            order.userId,
            (orderCust?.email || '').toLowerCase().trim(),
            (orderCust?.phone || '').trim()
          ].filter(Boolean);
          return customerIdentifiers.some(id => pastOrderIdentifiers.some(pId => pId.toLowerCase() === id.toLowerCase()));
        });

        if (inUsedByUsers || inPastOrders) {
          return res.status(400).json({
            valid: false,
            errorCode: 'COUPON_ALREADY_USED',
            error: 'لا يمكنك استخدام هذا الكود مرة أخرى، لقد سبق لك استخدامه.',
            message: 'لا يمكنك استخدام هذا الكود مرة أخرى، لقد سبق لك استخدامه.'
          });
        }
      }

      // Check Minimum Order Value
      let totalAmount = 0;
      if (cartTotal !== undefined && cartTotal !== '') {
        const vCartTotal = validateBackendNumeric(cartTotal, 'non_negative_decimal', { fieldNameArabic: 'إجمالي السلة' });
        if (!vCartTotal.isValid) {
          return res.status(400).json({
            valid: false,
            errorCode: 'COUPON_INVALID',
            error: vCartTotal.error,
            message: vCartTotal.error
          });
        }
        totalAmount = vCartTotal.value;
      }
      if (coupon.minOrderValue && totalAmount < coupon.minOrderValue) {
        return res.status(400).json({
          valid: false,
          errorCode: 'COUPON_MIN_ORDER_NOT_MET',
          error: `الحد الأدنى لتفعيل هذا الكوبون هو ${coupon.minOrderValue} ج.م`,
          message: `الحد الأدنى لتفعيل هذا الكوبون هو ${coupon.minOrderValue} ج.م`
        });
      }

      // Calculate discount amount for preview (DO NOT consume or increment usage count here)
      let discountAmount = 0;
      const rawVal = coupon.value ?? coupon.discountValue ?? 0;
      if (coupon.discountType === 'percentage') {
        discountAmount = (totalAmount * rawVal) / 100;
        if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
          discountAmount = coupon.maxDiscountAmount;
        }
        discountAmount = Math.min(discountAmount, totalAmount);
      } else if (coupon.discountType === 'fixed') {
        discountAmount = Math.min(rawVal, totalAmount);
      } else if (coupon.discountType === 'free_shipping') {
        const settings = db.getSettings();
        let shippingCost = settings.shippingFlatRate;
        if (governorate) {
          const provinces = db.getShippingProvinces();
          const selectedProvince = provinces.find(p => p.name === (governorate as string));
          if (selectedProvince && selectedProvince.isActive) {
            shippingCost = selectedProvince.price;
          }
        }
        discountAmount = shippingCost;
      }

      discountAmount = Math.max(0, Number(discountAmount.toFixed(2)));

      res.json({
        valid: true,
        ...coupon,
        code: coupon.code,
        discountType: coupon.discountType || 'fixed',
        discountValue: rawVal,
        discountAmount,
        computedDiscount: discountAmount
      });
    } catch (err: any) {
      res.status(500).json({
        valid: false,
        errorCode: 'COUPON_INVALID',
        error: 'فشل التحقق من الكوبون',
        message: 'فشل التحقق من الكوبون'
      });
    }
  });

  // Get storefront FAQs
  app.get('/api/faqs', (req, res) => {
    try {
      const faqs = db.getFaqs();
      res.json(faqs);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load FAQs' });
    }
  });

  // Track an order by ID AND Phone (Secure Verification - OWASP Anti-IDOR)
  app.get('/api/orders/track', (req, res) => {
    try {
      const { id, phone } = req.query;
      if (!id || typeof id !== 'string' || !id.trim() || !phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({ error: 'رقم الفاتورة ورقم الهاتف كلاهما مطلوب للتحقق من الطلب' });
      }

      const cleanId = id.trim();
      const normalizePhone = (p: any): string => {
        if (!p || typeof p !== 'string') return '';
        return p.replace(/\D/g, '').replace(/^(20|0020)/, '0');
      };

      const cleanPhone = normalizePhone(phone);
      if (!cleanPhone) {
        return res.status(400).json({ error: 'رقم الهاتف المدخل غير صالح' });
      }

      const order = db.getOrderById(cleanId);
      if (!order) {
        // Generic 404 response to prevent order ID enumeration
        return res.status(404).json({ error: 'لم نتمكن من العثور على الطلب أو بيانات التحقق غير صحيحة' });
      }

      const orderPhone = normalizePhone(order.customer?.phone);
      const orderAltPhone = normalizePhone(order.customer?.altPhone);

      const isMatch = (orderPhone && orderPhone === cleanPhone) || (orderAltPhone && orderAltPhone === cleanPhone);

      if (!isMatch) {
        // Return EXACT same 404 response to prevent order ID enumeration
        return res.status(404).json({ error: 'لم نتمكن من العثور على الطلب أو بيانات التحقق غير صحيحة' });
      }

      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل في استعلام الطلب' });
    }
  });

  // Checkout submit (Cash on Delivery)
  app.post('/api/orders', checkoutRateLimiter, (req, res) => {
    try {
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

      if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim()) {
        const cleanKey = idempotencyKey.trim();
        const cached = orderIdempotencyCache.get(cleanKey);
        if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
          return res.status(200).json(cached.order);
        }
      }

      const { customer, items, couponCode } = req.body;
      if (!customer || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'بيانات العميل أو السلة فارغة' });
      }

      // Pre-flight validation & authoritative server-side pricing calculation
      const settings = db.getSettings();
      const normalizedItems: any[] = [];

      for (const item of items) {
        if (!item || !item.productId) {
          return res.status(400).json({ error: 'بيانات المنتجات بسلة الشراء غير صالحة' });
        }

        const product = db.getProductById(item.productId);
        if (!product) {
          return res.status(400).json({ error: `عذراً، المنتج (${item.productTitle || item.productId}) غير موجود بالمتجر` });
        }

        let variant = undefined;
        let variantId = item.variantId;
        if (!variantId && item.variantSku && product.variants) {
          const vMatch = product.variants.find(v => v.sku === item.variantSku || v.id === item.variantSku);
          if (vMatch) variantId = vMatch.id;
        }

        if (variantId) {
          if (!product.variants || !Array.isArray(product.variants)) {
            return res.status(400).json({ error: `عذراً، المنتج "${product.title}" لا يحتوي على موديلات` });
          }
          variant = product.variants.find(v => v.id === variantId);
          if (!variant) {
            return res.status(400).json({ error: `عذراً، الموديل المحدد للمنتج "${product.title}" غير موجود` });
          }
        }

        const availableStock = variant ? (variant.stock || 0) : (product.stock || 0);
        const vQty = validateBackendNumeric(item.quantity, 'positive_integer', { required: true, min: 1, max: 9999, fieldNameArabic: `كمية المنتج (${product.title})` });
        if (!vQty.isValid) {
          return res.status(400).json({ error: vQty.error });
        }
        const reqQty = vQty.value;

        if (availableStock < reqQty) {
          const itemLabel = variant
            ? `الموديل (${variant.size || variant.color || variant.capacity || variant.sku}) للمنتج "${product.title}"`
            : `المنتج "${product.title}"`;
          return res.status(400).json({
            error: `عذراً، المخزون غير كافٍ لـ ${itemLabel}. المتاح حالياً: ${availableStock}، المطلوب: ${reqQty}`
          });
        }

        // Authoritative server-side price (ignore any client-supplied item.price!)
        const authoritativePrice = variant ? variant.price : (product.discountPrice || product.price);

        normalizedItems.push({
          productId: product.id,
          productTitle: product.title,
          variantId: variant ? variant.id : undefined,
          variantSku: variant ? variant.sku : product.sku,
          variantInfo: variant ? [variant.size, variant.color, variant.capacity].filter(Boolean).join(' / ') : undefined,
          quantity: reqQty,
          price: authoritativePrice
        });
      }

      const subtotal = normalizedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const taxAmount = Number((subtotal * settings.taxRate).toFixed(2));

      // Calculate dynamic shipping cost based on province
      const provinces = db.getShippingProvinces();
      const selectedProvince = provinces.find(p => p.name === customer.governorate);
      let shippingCost = settings.shippingFlatRate;

      if (selectedProvince) {
        if (!selectedProvince.isActive) {
          return res.status(400).json({ error: `عذراً، الشحن إلى محافظة ${customer.governorate} غير متاح حالياً` });
        }
        if (!selectedProvince.isCodAvailable) {
          return res.status(400).json({ error: `عذراً، الدفع عند الاستلام (COD) غير متاح حالياً لمحافظة ${customer.governorate}` });
        }
        shippingCost = selectedProvince.price;
        // Apply Free Shipping Threshold
        if (selectedProvince.freeShippingThreshold && subtotal >= selectedProvince.freeShippingThreshold) {
          shippingCost = 0;
        }
      }

      // Check if user is logged in (prior to coupon & cart evaluation)
      let orderUserId: string | undefined = undefined;
      let orderCustomerObj: any = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const session = customerSessions.get(token);
        if (session && Date.now() <= session.expiresAt) {
          orderUserId = session.customerId;
          orderCustomerObj = db.getCustomerById(session.customerId);
        }
      }

      // 1. Authoritative Campaign Pricing Evaluation
      const campaignEval = db.evaluateBestCampaign(normalizedItems, subtotal, shippingCost);
      const bestCampaign = campaignEval.bestCampaign;
      const campaignDiscountAmount = campaignEval.campaignDiscount;

      // 2. Authoritative Coupon Evaluation
      let couponDiscountAmount = 0;
      let appliedCoupon: any = null;

      if (couponCode) {
        const cleanCouponCode = String(couponCode).trim().toUpperCase();
        const coupons = db.getCoupons();
        const coupon = coupons.find(c => c.code.toUpperCase() === cleanCouponCode);
        if (coupon && coupon.isActive) {
          let isValid = true;

          // Verify Expiry
          if (coupon.expiryDate) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (todayStr > coupon.expiryDate) isValid = false;
          }

          // Verify usageLimit
          if (typeof coupon.usageLimit === 'number' && coupon.usedCount >= coupon.usageLimit) {
            isValid = false;
          }

          // Verify One Use Per User
          if (coupon.oneUsePerUser) {
            const orderCustomerIdentifiers = [
              orderUserId,
              orderCustomerObj?.id,
              orderCustomerObj?.email,
              orderCustomerObj?.phone,
              (customer.email || '').toLowerCase().trim(),
              (customer.phone || '').trim()
            ].filter(Boolean) as string[];

            const inUsedByUsers = orderCustomerIdentifiers.some(id => 
              (coupon.usedByUsers || []).some(u => u && u.toLowerCase().trim() === id.toLowerCase().trim())
            );

            const existingOrders = db.getOrders();
            const inPastOrders = existingOrders.some(pastOrder => {
              if (!pastOrder.couponCode || pastOrder.couponCode.toUpperCase() !== cleanCouponCode) return false;
              if (pastOrder.status === 'Cancelled') return false; // Cancelled orders do not block reuse
              const pastCust: any = pastOrder.customer || {};
              const pastOrderIdentifiers = [
                pastOrder.customerId,
                pastOrder.userId,
                (pastCust?.email || '').toLowerCase().trim(),
                (pastCust?.phone || '').trim()
              ].filter(Boolean) as string[];
              return orderCustomerIdentifiers.some(id => pastOrderIdentifiers.some(pId => pId.toLowerCase() === id.toLowerCase().trim()));
            });

            if (inUsedByUsers || inPastOrders) {
              isValid = false;
            }
          }

          // Verify Minimum Order
          if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
            isValid = false;
          }

          if (isValid) {
            const rawDiscountValue = coupon.value !== undefined ? coupon.value : (coupon.discountValue !== undefined ? coupon.discountValue : 0);
            if (coupon.discountType === 'percentage') {
              couponDiscountAmount = (subtotal * rawDiscountValue) / 100;
              if (coupon.maxDiscountAmount && couponDiscountAmount > coupon.maxDiscountAmount) {
                couponDiscountAmount = coupon.maxDiscountAmount;
              }
              couponDiscountAmount = Math.min(couponDiscountAmount, subtotal);
            } else if (coupon.discountType === 'fixed') {
              couponDiscountAmount = Math.min(rawDiscountValue, subtotal);
            } else if (coupon.discountType === 'free_shipping') {
              couponDiscountAmount = shippingCost;
            }
            couponDiscountAmount = Math.max(0, Number(couponDiscountAmount.toFixed(2)));
            appliedCoupon = coupon;
          }
        }
      }

      // 3. Compare Campaign vs Coupon: select highest customer benefit
      let finalDiscountAmount = 0;
      let finalAppliedCampaign = null;
      let finalAppliedCoupon = null;

      if (campaignDiscountAmount > couponDiscountAmount) {
        finalDiscountAmount = campaignDiscountAmount;
        finalAppliedCampaign = bestCampaign;
        finalAppliedCoupon = null;
      } else if (couponDiscountAmount > 0) {
        finalDiscountAmount = couponDiscountAmount;
        finalAppliedCoupon = appliedCoupon;
        finalAppliedCampaign = null;
      }

      const total = Number(Math.max(0, subtotal + taxAmount + shippingCost - finalDiscountAmount).toFixed(2));

      const newId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const newOrder: Order = {
        id: newId,
        userId: orderUserId,
        customerId: orderUserId,
        invoiceNumber: `INV-2026-${newId.split('-')[1]}`,
        date: new Date().toISOString(),
        customer,
        items: normalizedItems,
        couponCode: finalAppliedCoupon ? finalAppliedCoupon.code : undefined,
        discountType: finalAppliedCoupon ? (finalAppliedCoupon.discountType || 'fixed') : undefined,
        discountValue: finalAppliedCoupon ? (finalAppliedCoupon.value ?? finalAppliedCoupon.discountValue ?? 0) : undefined,
        appliedCampaignId: finalAppliedCampaign ? finalAppliedCampaign.id : undefined,
        appliedCampaignName: finalAppliedCampaign ? finalAppliedCampaign.name : undefined,
        campaignDiscount: finalAppliedCampaign ? finalDiscountAmount : undefined,
        subtotal: Number(subtotal.toFixed(2)),
        discountAmount: finalDiscountAmount,
        shippingCost,
        taxAmount,
        total,
        status: 'Pending',
        timeline: [
          {
            status: 'Pending',
            date: new Date().toISOString(),
            description: 'تم تسجيل الطلب في نظام متجر النخبة بنجاح وبانتظار مراجعة وتأكيد خدمة العملاء.'
          }
        ]
      };

      const savedOrder = db.createOrder(newOrder);

      // Clear customer's saved cart after successful order creation
      if (orderUserId) {
        try {
          db.updateCustomer(orderUserId, { savedCart: [] });
        } catch (e) {
          console.error('Failed to clear customer saved cart after order creation:', e);
        }
      }

      if (finalAppliedCoupon && appliedCoupon) {
        const userIdentifiers = [
          orderUserId,
          orderCustomerObj?.email,
          orderCustomerObj?.phone,
          (customer.email || '').toLowerCase().trim(),
          (customer.phone || '').trim()
        ].filter(Boolean) as string[];

        const updatedUsers = [...(appliedCoupon.usedByUsers || [])];
        userIdentifiers.forEach(id => {
          if (!updatedUsers.some(u => u && u.toLowerCase().trim() === id.toLowerCase().trim())) {
            updatedUsers.push(id);
          }
        });

        db.updateCoupon(appliedCoupon.code, {
          usedCount: (appliedCoupon.usedCount || 0) + 1,
          usedByUsers: updatedUsers,
          totalDiscountGenerated: Number(((appliedCoupon.totalDiscountGenerated || 0) + finalDiscountAmount).toFixed(2))
        });
      }

      const cleanKey = idempotencyKey && typeof idempotencyKey === 'string' ? idempotencyKey.trim() : null;
      if (cleanKey) {
        orderIdempotencyCache.set(cleanKey, { order: savedOrder, timestamp: Date.now() });
      }

      res.status(201).json(savedOrder);
    } catch (err: any) {
      console.error('Checkout error:', err);
      const isClientError = err.message && (
        err.message.includes('المخزون غير كافٍ') ||
        err.message.includes('غير موجود') ||
        err.message.includes('غير صالح')
      );
      res.status(isClientError ? 400 : 500).json({ error: err.message || 'فشلت عملية إنشاء الطلب', message: err.message });
    }
  });

  // ==========================================
  // 🧠 GEMINI SMART ASSISTANT ENDPOINT
  // ==========================================
  app.post('/api/gemini/assist', assistRateLimiter, async (req, res) => {
    try {
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const responseText = await askAssistant(message, history || []);
      res.json({ response: responseText });
    } catch (err: any) {
      console.error("Gemini route error:", err);
      res.status(500).json({ error: 'Gemini service failed', message: err.message });
    }
  });

  // ==========================================
  // 👤 CUSTOMER ACCOUNT SYSTEM ENDPOINTS
  // ==========================================

  const requireCustomer = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'غير مصرح بالدخول. يرجى تسجيل الدخول أولاً.' });
    }

    const token = authHeader.substring(7);
    const session = customerSessions.get(token);

    if (!session || Date.now() > session.expiresAt) {
      if (session) {
        customerSessions.delete(token);
      }
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.' });
    }

    const customer = db.getCustomerById(session.customerId);
    if (!customer) {
      customerSessions.delete(token);
      return res.status(401).json({ error: 'حساب العميل غير موجود.' });
    }

    if (customer.status === 'blocked') {
      customerSessions.delete(token);
      return res.status(403).json({ error: 'تم حظر هذا الحساب. يرجى التواصل مع الدعم الفني.' });
    }

    const sessionDuration = session.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    session.expiresAt = Date.now() + sessionDuration;
    req.customerId = session.customerId;
    next();
  };

  // GET /api/auth/me
  app.get('/api/auth/me', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      if (customer.status === 'blocked') {
        return res.status(403).json({ error: 'تم حظر هذا الحساب. يرجى التواصل مع الدعم الفني.' });
      }
      const { passwordHash, salt, verificationCode, resetToken, resetTokenExpiry, ...safeCustomer } = customer;
      res.json(safeCustomer);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch customer session' });
    }
  });

  // Register
  const handleRegister = (req: any, res: any) => {
    try {
      const { name, email, password, phone } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'الاسم، البريد الإلكتروني وكلمة المرور مطلوبة' });
      }

      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 8 أحرف' });
      }

      const existing = db.getCustomerByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
      }

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Hash password
      const { hash, salt } = hashPassword(password);

      const newCustomer: Customer = {
        id: `cust-${Date.now()}`,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        phone: phone ? phone.trim() : undefined,
        passwordHash: hash,
        salt: salt,
        status: 'active',
        isVerified: false,
        verificationCode: verificationCode,
        addresses: [],
        wishlist: [],
        savedCart: [],
        notifications: [
          {
            id: `cnot-${Date.now()}`,
            title: 'أهلاً بك في متجر النخبة!',
            message: 'تم إنشاء حسابك بنجاح. يرجى تفعيل حسابك باستخدام كود التفعيل.',
            isRead: false,
            timestamp: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString()
      };

      db.createCustomer(newCustomer);

      res.status(201).json({
        success: true,
        message: 'تم تسجيل الحساب بنجاح. يرجى تفعيل بريدك الإلكتروني.',
        customerId: newCustomer.id
      });
    } catch (err: any) {
      console.error('Customer register error:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الحساب' });
    }
  };

  app.post('/api/customer/register', handleRegister);
  app.post('/api/auth/register', handleRegister);

  // Login
  const handleLogin = (req: any, res: any) => {
    try {
      const { email, password, rememberMe } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
      }

      const customer = db.getCustomerByEmail(email);
      if (!customer || !customer.passwordHash || !customer.salt) {
        return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
      }

      if (customer.status === 'blocked') {
        return res.status(403).json({ error: 'تم حظر هذا الحساب. يرجى التواصل مع الدعم الفني.' });
      }

      const isValid = verifyPassword(password, customer.passwordHash, customer.salt);
      if (!isValid) {
        return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
      }

      // Transparently re-hash password if previously hashed using legacy hash algorithm
      const modernHashBuf = crypto.pbkdf2Sync(password, customer.salt, 100000, 64, 'sha512').toString('hex');
      if (customer.passwordHash !== modernHashBuf) {
        const { hash: newHash, salt: newSalt } = hashPassword(password);
        db.updateCustomer(customer.id, { passwordHash: newHash, salt: newSalt });
      }

      // Update last login timestamp
      const lastLoginAt = new Date().toISOString();
      db.updateCustomer(customer.id, { lastLoginAt });

      const isRemember = Boolean(rememberMe);
      const sessionDuration = isRemember ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

      // Generate session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      customerSessions.set(sessionToken, {
        customerId: customer.id,
        expiresAt: Date.now() + sessionDuration,
        rememberMe: isRemember
      });

      res.json({
        success: true,
        token: sessionToken,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          status: customer.status || 'active',
          isVerified: customer.isVerified,
          createdAt: customer.createdAt,
          lastLoginAt
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
    }
  };

  app.post('/api/customer/login', loginRateLimiter, handleLogin);
  app.post('/api/auth/login', loginRateLimiter, handleLogin);

  // Logout
  const handleLogout = (req: any, res: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        customerSessions.delete(token);
      }
      res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الخروج' });
    }
  };

  app.post('/api/customer/logout', handleLogout);
  app.post('/api/auth/logout', handleLogout);

  // Forgot password handler
  const handleForgotPassword = (req: any, res: any) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const customer = db.getCustomerByEmail(cleanEmail);

      if (customer && customer.status !== 'blocked') {
        const resetToken = crypto.randomInt(100000, 1000000).toString();
        const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 mins

        db.updateCustomer(customer.id, {
          resetToken: resetToken,
          resetTokenExpiry: expiry
        });
      }

      // Always return generic success response to prevent account enumeration
      res.json({
        success: true,
        message: 'إذا كان البريد الإلكتروني مسجلاً، فستصلك تعليمات استعادة كلمة المرور.'
      });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء طلب استعادة كلمة المرور' });
    }
  };

  app.post('/api/customer/forgot-password', forgotPasswordRateLimiter, handleForgotPassword);
  app.post('/api/auth/forgot-password', forgotPasswordRateLimiter, handleForgotPassword);

  // Reset password handler
  const handleResetPassword = (req: any, res: any) => {
    try {
      const { email, token, newPassword } = req.body;
      if (!email || !token || !newPassword) {
        return res.status(400).json({ error: 'البريد الإلكتروني، كود الاستعادة وكلمة المرور الجديدة مطلوبة' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور يجب ألا تقل عن 8 أحرف' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const customer = db.getCustomerByEmail(cleanEmail);

      if (!customer || !customer.resetToken || !customer.resetTokenExpiry) {
        return res.status(400).json({ error: 'كود استعادة كلمة المرور غير صالح أو منتهي الصلاحية' });
      }

      if (customer.status === 'blocked') {
        return res.status(403).json({ error: 'تم حظر هذا الحساب. يرجى التواصل مع الدعم الفني.' });
      }

      if (new Date().toISOString() > customer.resetTokenExpiry) {
        return res.status(400).json({ error: 'انتهت صلاحية كود الاستعادة' });
      }

      if (customer.resetToken !== token.toString().trim()) {
        return res.status(400).json({ error: 'كود الاستعادة غير صحيح' });
      }

      const { hash, salt } = hashPassword(newPassword);

      db.updateCustomer(customer.id, {
        passwordHash: hash,
        salt: salt,
        resetToken: undefined,
        resetTokenExpiry: undefined
      });

      // Invalidate all active customer sessions
      invalidateCustomerSessions(customer.id);

      res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.' });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء إعادة تعيين كلمة المرور' });
    }
  };

  app.post('/api/customer/reset-password', resetPasswordRateLimiter, handleResetPassword);
  app.post('/api/auth/reset-password', resetPasswordRateLimiter, handleResetPassword);

  // Profile (GET)
  app.get('/api/customer/profile', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      res.json({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        isVerified: customer.isVerified,
        createdAt: customer.createdAt,
        addresses: customer.addresses || [],
        wishlist: customer.wishlist || [],
        savedCart: customer.savedCart || [],
        notifications: customer.notifications || []
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch profile' });
    }
  });

  // Profile (PUT)
  app.put('/api/customer/profile', requireCustomer, (req: any, res) => {
    try {
      const { name, phone } = req.body;
      const updated = db.updateCustomer(req.customerId, {
        name: name ? name.trim() : undefined,
        phone: phone ? phone.trim() : undefined
      });

      if (!updated) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      res.json({
        success: true,
        message: 'تم تحديث الملف الشخصي بنجاح',
        customer: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          isVerified: updated.isVerified,
          createdAt: updated.createdAt
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Change Password
  app.put('/api/customer/change-password', requireCustomer, (req: any, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبة' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف' });
      }

      const customer = db.getCustomerById(req.customerId);
      if (!customer || !customer.passwordHash || !customer.salt) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      const isValid = verifyPassword(oldPassword, customer.passwordHash, customer.salt);
      if (!isValid) {
        return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      }

      if (verifyPassword(newPassword, customer.passwordHash, customer.salt)) {
        return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية' });
      }

      const { hash, salt } = hashPassword(newPassword);
      db.updateCustomer(req.customerId, {
        passwordHash: hash,
        salt: salt
      });

      // Invalidate all active customer sessions
      invalidateCustomerSessions(req.customerId);

      res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح. يرجى إعادة تسجيل الدخول.' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تغيير كلمة المرور' });
    }
  });

  // Delete Account
  app.delete('/api/customer/delete-account', requireCustomer, (req: any, res) => {
    try {
      const success = db.deleteCustomer(req.customerId);
      if (!success) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }
      res.json({ success: true, message: 'تم حذف الحساب بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete account' });
    }
  });

  // Addresses GET (all)
  app.get('/api/customer/addresses', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });
      res.json(customer.addresses || []);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch addresses' });
    }
  });

  // Addresses GET (single)
  app.get('/api/customer/addresses/:id', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      const addresses = customer.addresses || [];
      const addr = addresses.find(a => a.id === req.params.id);
      if (!addr) {
        return res.status(404).json({ error: 'العنوان غير موجود' });
      }

      res.json(addr);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch address' });
    }
  });

  // Addresses POST
  app.post('/api/customer/addresses', requireCustomer, (req: any, res) => {
    try {
      const { name, recipientName, phone, governorate, city, address, building, apartment, postalCode, additionalNotes, isDefault } = req.body;
      if (!name || !recipientName || !phone || !governorate || !city || !address) {
        return res.status(400).json({ error: 'جميع الحقول الأساسية للعنوان مطلوبة' });
      }

      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let currentAddresses = Array.isArray(customer.addresses) ? [...customer.addresses] : [];

      // Determine default flag logic
      const makeDefault = Boolean(isDefault) || currentAddresses.length === 0;

      if (makeDefault) {
        currentAddresses = currentAddresses.map(addr => ({ ...addr, isDefault: false }));
      }

      const now = new Date().toISOString();
      const newAddr = {
        id: `addr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerId: req.customerId,
        name: String(name).trim(),
        recipientName: String(recipientName).trim(),
        phone: String(phone).trim(),
        governorate: String(governorate).trim(),
        city: String(city).trim(),
        address: String(address).trim(),
        building: building ? String(building).trim() : undefined,
        apartment: apartment ? String(apartment).trim() : undefined,
        postalCode: postalCode ? String(postalCode).trim() : undefined,
        additionalNotes: additionalNotes ? String(additionalNotes).trim() : undefined,
        isDefault: makeDefault,
        createdAt: now,
        updatedAt: now
      };

      currentAddresses.push(newAddr);
      db.updateCustomer(req.customerId, { addresses: currentAddresses });

      res.status(201).json(newAddr);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create address' });
    }
  });

  // Addresses Handler for PUT/PATCH updates
  const handleAddressUpdate = (req: any, res: any) => {
    try {
      const { name, recipientName, phone, governorate, city, address, building, apartment, postalCode, additionalNotes, isDefault } = req.body;
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let currentAddresses = Array.isArray(customer.addresses) ? [...customer.addresses] : [];
      const idx = currentAddresses.findIndex(addr => addr.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: 'العنوان غير موجود' });
      }

      if (isDefault === true) {
        currentAddresses = currentAddresses.map(addr => ({ ...addr, isDefault: false }));
      }

      const now = new Date().toISOString();
      currentAddresses[idx] = {
        ...currentAddresses[idx],
        name: name !== undefined ? String(name).trim() : currentAddresses[idx].name,
        recipientName: recipientName !== undefined ? String(recipientName).trim() : currentAddresses[idx].recipientName,
        phone: phone !== undefined ? String(phone).trim() : currentAddresses[idx].phone,
        governorate: governorate !== undefined ? String(governorate).trim() : currentAddresses[idx].governorate,
        city: city !== undefined ? String(city).trim() : currentAddresses[idx].city,
        address: address !== undefined ? String(address).trim() : currentAddresses[idx].address,
        building: building !== undefined ? String(building).trim() : currentAddresses[idx].building,
        apartment: apartment !== undefined ? String(apartment).trim() : currentAddresses[idx].apartment,
        postalCode: postalCode !== undefined ? String(postalCode).trim() : currentAddresses[idx].postalCode,
        additionalNotes: additionalNotes !== undefined ? String(additionalNotes).trim() : currentAddresses[idx].additionalNotes,
        isDefault: isDefault !== undefined ? !!isDefault : currentAddresses[idx].isDefault,
        updatedAt: now
      };

      // Guarantee that if no address is set to default, set the first address as default
      const hasDefault = currentAddresses.some(addr => addr.isDefault);
      if (!hasDefault && currentAddresses.length > 0) {
        currentAddresses[0].isDefault = true;
      }

      db.updateCustomer(req.customerId, { addresses: currentAddresses });
      res.json(currentAddresses[idx]);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update address' });
    }
  };

  // Addresses PUT & PATCH
  app.put('/api/customer/addresses/:id', requireCustomer, handleAddressUpdate);
  app.patch('/api/customer/addresses/:id', requireCustomer, handleAddressUpdate);

  // Set Address as Default endpoint (PATCH /api/customer/addresses/:id/default)
  app.patch('/api/customer/addresses/:id/default', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let currentAddresses = Array.isArray(customer.addresses) ? [...customer.addresses] : [];
      const target = currentAddresses.find(addr => addr.id === req.params.id);
      if (!target) {
        return res.status(404).json({ error: 'العنوان غير موجود' });
      }

      const now = new Date().toISOString();
      currentAddresses = currentAddresses.map(addr => ({
        ...addr,
        isDefault: addr.id === req.params.id,
        updatedAt: addr.id === req.params.id ? now : addr.updatedAt
      }));

      db.updateCustomer(req.customerId, { addresses: currentAddresses });
      const updatedAddress = currentAddresses.find(addr => addr.id === req.params.id);
      res.json(updatedAddress);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to set default address' });
    }
  });

  // Addresses DELETE
  app.delete('/api/customer/addresses/:id', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let currentAddresses = Array.isArray(customer.addresses) ? [...customer.addresses] : [];
      const idx = currentAddresses.findIndex(addr => addr.id === req.params.id);
      if (idx === -1) {
        return res.status(404).json({ error: 'العنوان غير موجود' });
      }

      const wasDefault = currentAddresses[idx].isDefault;
      currentAddresses.splice(idx, 1);

      if (wasDefault && currentAddresses.length > 0) {
        currentAddresses[0].isDefault = true;
      }

      db.updateCustomer(req.customerId, { addresses: currentAddresses });
      res.json({ success: true, message: 'تم حذف العنوان بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete address' });
    }
  });

  // Wishlist GET
  app.get('/api/customer/wishlist', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      res.json(customer?.wishlist || []);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch wishlist' });
    }
  });

  // Wishlist Add POST (explicit add endpoint)
  app.post('/api/customer/wishlist', requireCustomer, (req: any, res) => {
    try {
      const { productId } = req.body;
      if (!productId || typeof productId !== 'string') {
        return res.status(400).json({ error: 'معرف المنتج مطلوب' });
      }

      const product = db.getProductById(productId);
      if (!product) {
        return res.status(404).json({ error: 'المنتج غير موجود بكتالوج المتجر' });
      }

      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let list = Array.isArray(customer.wishlist) ? customer.wishlist : [];
      if (!list.includes(productId)) {
        list.push(productId);
      }

      db.updateCustomer(req.customerId, { wishlist: list });
      res.status(201).json({ success: true, added: true, wishlist: list });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة المنتج لقائمة المفضلة' });
    }
  });

  // Wishlist Remove DELETE (explicit remove endpoint)
  app.delete('/api/customer/wishlist/:productId', requireCustomer, (req: any, res) => {
    try {
      const { productId } = req.params;
      if (!productId) {
        return res.status(400).json({ error: 'معرف المنتج مطلوب' });
      }

      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let list = Array.isArray(customer.wishlist) ? customer.wishlist : [];
      list = list.filter(id => id !== productId);

      db.updateCustomer(req.customerId, { wishlist: list });
      res.json({ success: true, removed: true, wishlist: list });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إزالة المنتج من قائمة المفضلة' });
    }
  });

  // Wishlist Toggle POST
  app.post('/api/customer/wishlist/toggle', requireCustomer, (req: any, res) => {
    try {
      const { productId } = req.body;
      if (!productId || typeof productId !== 'string') {
        return res.status(400).json({ error: 'معرف المنتج مطلوب' });
      }

      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let list = Array.isArray(customer.wishlist) ? customer.wishlist : [];
      const idx = list.indexOf(productId);
      let added = false;
      if (idx === -1) {
        const product = db.getProductById(productId);
        if (!product) {
          return res.status(404).json({ error: 'المنتج غير موجود بكتالوج المتجر' });
        }
        list.push(productId);
        added = true;
      } else {
        list.splice(idx, 1);
      }

      db.updateCustomer(req.customerId, { wishlist: list });
      res.json({ success: true, added, wishlist: list });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل قائمة المفضلة' });
    }
  });

  // Helper to enrich customer cart items with live product & variant data
  const enrichCustomerCart = (rawCart: any[]) => {
    if (!Array.isArray(rawCart)) return [];

    const enriched: any[] = [];
    for (const item of rawCart) {
      if (!item) continue;
      const productId = item.productId || item.product?.id;
      if (!productId) continue;

      const product = db.getProductById(productId);
      if (!product) continue; // Product deleted, skip gracefully

      const variantId = item.variantId || item.selectedVariant?.id;
      let variant = undefined;
      if (variantId && product.variants && Array.isArray(product.variants)) {
        variant = product.variants.find(v => v.id === variantId);
        // If specified variantId no longer exists, skip item gracefully
        if (!variant) continue;
      }

      const availableStock = variant ? (variant.stock || 0) : (product.stock || 0);
      const reqQty = Math.max(1, Number(item.quantity) || 1);
      const qty = availableStock > 0 ? Math.min(reqQty, availableStock) : reqQty;
      const currentPrice = variant ? variant.price : (product.discountPrice || product.price);

      enriched.push({
        productId: product.id,
        variantId: variant ? variant.id : undefined,
        quantity: qty,
        product,
        selectedVariant: variant,
        currentPrice,
        availableStock,
        isAvailable: availableStock > 0,
        isStockSufficient: availableStock >= qty,
        updatedAt: item.updatedAt || new Date().toISOString()
      });
    }
    return enriched;
  };

  // Customer Cart GET (Returns enriched live cart items)
  app.get('/api/customer/cart', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });
      const rawCart = Array.isArray(customer.savedCart) ? customer.savedCart : [];
      const enrichedCart = enrichCustomerCart(rawCart);
      res.json(enrichedCart);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب سلة التسوق' });
    }
  });

  // Customer Cart Add Item POST
  app.post('/api/customer/cart/items', requireCustomer, (req: any, res) => {
    try {
      const { productId, variantId, quantity = 1 } = req.body;
      if (!productId || typeof productId !== 'string') {
        return res.status(400).json({ error: 'معرف المنتج مطلوب' });
      }

      const product = db.getProductById(productId);
      if (!product) {
        return res.status(404).json({ error: 'المنتج غير موجود بكتالوج المتجر' });
      }

      let variant = undefined;
      if (variantId) {
        if (!product.variants || !Array.isArray(product.variants)) {
          return res.status(400).json({ error: 'المنتج لا يحتوي على موديلات' });
        }
        variant = product.variants.find(v => v.id === variantId);
        if (!variant) {
          return res.status(404).json({ error: 'الموديل المحدد غير موجود' });
        }
      }

      const availableStock = variant ? (variant.stock || 0) : (product.stock || 0);
      if (availableStock <= 0) {
        return res.status(400).json({ error: 'عذراً، هذا المنتج نفد من المخزون حالياً' });
      }

      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let rawCart: any[] = Array.isArray(customer.savedCart) ? [...customer.savedCart] : [];
      let qtyToAdd = 1;
      if (quantity !== undefined) {
        const vQty = validateBackendNumeric(quantity, 'positive_integer', { min: 1, max: 999, fieldNameArabic: 'الكمية المراد إضافتها' });
        if (!vQty.isValid) {
          return res.status(400).json({ error: vQty.error });
        }
        qtyToAdd = vQty.value;
      }

      const existingIdx = rawCart.findIndex(item => {
        const itemProdId = item.productId || item.product?.id;
        const itemVarId = item.variantId || item.selectedVariant?.id;
        return itemProdId === productId && (variantId ? itemVarId === variantId : !itemVarId);
      });

      if (existingIdx > -1) {
        const currentQty = Number(rawCart[existingIdx].quantity) || 0;
        const newQty = Math.min(currentQty + qtyToAdd, availableStock);
        rawCart[existingIdx] = {
          ...rawCart[existingIdx],
          productId,
          variantId: variantId || undefined,
          quantity: newQty,
          updatedAt: new Date().toISOString()
        };
      } else {
        const initialQty = Math.min(qtyToAdd, availableStock);
        rawCart.push({
          productId,
          variantId: variantId || undefined,
          quantity: initialQty,
          updatedAt: new Date().toISOString()
        });
      }

      db.updateCustomer(req.customerId, { savedCart: rawCart });
      const enriched = enrichCustomerCart(rawCart);
      res.status(201).json({ success: true, cart: enriched });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إضافة المنتج إلى السلة' });
    }
  });

  // Customer Cart Update Item Quantity PATCH
  app.patch('/api/customer/cart/items/:productId', requireCustomer, (req: any, res) => {
    try {
      const { productId } = req.params;
      const { variantId, quantity } = req.body;

      const vTargetQty = validateBackendNumeric(quantity, 'non_negative_integer', { required: true, min: 0, max: 999, fieldNameArabic: 'كمية المنتج بالسلة' });
      if (!vTargetQty.isValid) {
        return res.status(400).json({ error: vTargetQty.error });
      }
      const targetQty = vTargetQty.value;

      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let rawCart: any[] = Array.isArray(customer.savedCart) ? [...customer.savedCart] : [];
      const itemIdx = rawCart.findIndex(item => {
        const itemProdId = item.productId || item.product?.id;
        const itemVarId = item.variantId || item.selectedVariant?.id;
        return itemProdId === productId && (variantId ? itemVarId === variantId : !itemVarId);
      });

      if (itemIdx === -1) {
        return res.status(404).json({ error: 'المنتج غير موجود بسلة التسوق' });
      }

      if (targetQty <= 0) {
        rawCart.splice(itemIdx, 1);
      } else {
        const product = db.getProductById(productId);
        if (!product) {
          rawCart.splice(itemIdx, 1);
        } else {
          let variant = undefined;
          if (variantId && product.variants) {
            variant = product.variants.find(v => v.id === variantId);
          }
          const availableStock = variant ? (variant.stock || 0) : (product.stock || 0);
          const finalQty = Math.min(targetQty, availableStock);

          rawCart[itemIdx] = {
            ...rawCart[itemIdx],
            productId,
            variantId: variantId || undefined,
            quantity: finalQty,
            updatedAt: new Date().toISOString()
          };
        }
      }

      db.updateCustomer(req.customerId, { savedCart: rawCart });
      const enriched = enrichCustomerCart(rawCart);
      res.json({ success: true, cart: enriched });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحديث كمية المنتج بالسلة' });
    }
  });

  // Customer Cart Remove Item DELETE
  app.delete('/api/customer/cart/items/:productId', requireCustomer, (req: any, res) => {
    try {
      const { productId } = req.params;
      const variantId = (req.query.variantId as string) || req.body?.variantId;

      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let rawCart: any[] = Array.isArray(customer.savedCart) ? [...customer.savedCart] : [];
      rawCart = rawCart.filter(item => {
        const itemProdId = item.productId || item.product?.id;
        const itemVarId = item.variantId || item.selectedVariant?.id;
        if (itemProdId !== productId) return true;
        if (variantId) return itemVarId !== variantId;
        return false;
      });

      db.updateCustomer(req.customerId, { savedCart: rawCart });
      const enriched = enrichCustomerCart(rawCart);
      res.json({ success: true, cart: enriched });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إزالة المنتج من السلة' });
    }
  });

  // Customer Cart Merge Guest Cart POST
  app.post('/api/customer/cart/merge', requireCustomer, (req: any, res) => {
    try {
      const { guestCart } = req.body;
      if (!Array.isArray(guestCart)) {
        return res.status(400).json({ error: 'بيانات سلة الزائر غير صالحة' });
      }

      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      let rawCart: any[] = Array.isArray(customer.savedCart) ? [...customer.savedCart] : [];

      for (const guestItem of guestCart) {
        if (!guestItem) continue;
        const productId = guestItem.productId || guestItem.product?.id;
        if (!productId) continue;

        const product = db.getProductById(productId);
        if (!product) continue;

        const variantId = guestItem.variantId || guestItem.selectedVariant?.id;
        let variant = undefined;
        if (variantId && product.variants) {
          variant = product.variants.find(v => v.id === variantId);
        }

        const availableStock = variant ? (variant.stock || 0) : (product.stock || 0);
        if (availableStock <= 0) continue;

        const guestQty = Math.max(1, Number(guestItem.quantity) || 1);

        const existingIdx = rawCart.findIndex(item => {
          const itemProdId = item.productId || item.product?.id;
          const itemVarId = item.variantId || item.selectedVariant?.id;
          return itemProdId === productId && (variantId ? itemVarId === variantId : !itemVarId);
        });

        if (existingIdx > -1) {
          const currentQty = Number(rawCart[existingIdx].quantity) || 0;
          const mergedQty = Math.min(currentQty + guestQty, availableStock);
          rawCart[existingIdx] = {
            ...rawCart[existingIdx],
            productId,
            variantId: variantId || undefined,
            quantity: mergedQty,
            updatedAt: new Date().toISOString()
          };
        } else {
          const initialQty = Math.min(guestQty, availableStock);
          rawCart.push({
            productId,
            variantId: variantId || undefined,
            quantity: initialQty,
            updatedAt: new Date().toISOString()
          });
        }
      }

      db.updateCustomer(req.customerId, { savedCart: rawCart });
      const enriched = enrichCustomerCart(rawCart);
      res.json({ success: true, cart: enriched });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل دمج سلة التسوق' });
    }
  });

  // Customer Cart Clear DELETE
  app.delete('/api/customer/cart/clear', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'المستخدم غير موجود' });

      db.updateCustomer(req.customerId, { savedCart: [] });
      res.json({ success: true, message: 'تم تفريغ السلة بنجاح', cart: [] });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تفريغ السلة' });
    }
  });

  // Saved Cart PUT (Legacy compatibility)
  app.put('/api/customer/cart', requireCustomer, (req: any, res) => {
    try {
      const { cart } = req.body;
      if (!Array.isArray(cart)) {
        return res.status(400).json({ error: 'يجب أن تكون السلة مصفوفة صالحة' });
      }

      db.updateCustomer(req.customerId, { savedCart: cart });
      const enriched = enrichCustomerCart(cart);
      res.json({ success: true, savedCart: enriched });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save cart' });
    }
  });

  // Customer Notifications GET
  app.get('/api/customer/notifications', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      res.json(customer?.notifications || []);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  // Customer Notifications Read Mark (All)
  app.post('/api/customer/notifications/read', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'User not found' });

      const updatedNotifs = (customer.notifications || []).map(n => ({ ...n, isRead: true }));
      db.updateCustomer(req.customerId, { notifications: updatedNotifs });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to mark notifications read' });
    }
  });

  // Customer Notification Mark Single as Read
  app.post('/api/customer/notifications/:id/read', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'حساب العميل غير موجود' });

      const notifs = customer.notifications || [];
      const notifIndex = notifs.findIndex(n => n.id === req.params.id);
      if (notifIndex === -1) {
        return res.status(404).json({ error: 'الإشعار غير موجود' });
      }

      const updatedNotifs = notifs.map(n => n.id === req.params.id ? { ...n, isRead: true } : n);
      db.updateCustomer(req.customerId, { notifications: updatedNotifs });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to mark notification read' });
    }
  });

  // Customer Delete Single Notification
  app.delete('/api/customer/notifications/:id', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'حساب العميل غير موجود' });

      const notifs = customer.notifications || [];
      const notifExists = notifs.some(n => n.id === req.params.id);
      if (!notifExists) {
        return res.status(404).json({ error: 'الإشعار غير موجود' });
      }

      const updatedNotifs = notifs.filter(n => n.id !== req.params.id);
      db.updateCustomer(req.customerId, { notifications: updatedNotifs });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  // Customer Clear All Notifications
  app.post('/api/customer/notifications/clear', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'حساب العميل غير موجود' });

      db.updateCustomer(req.customerId, { notifications: [] });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to clear notifications' });
    }
  });

  // Customer Orders GET - All orders belonging to authenticated customer session
  app.get('/api/customer/orders', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'حساب العميل غير موجود' });

      const email = (customer.email || '').toLowerCase().trim();
      const phone = (customer.phone || '').trim();

      const allOrders = db.getOrders();
      const filtered = allOrders.filter(o => 
        (o.userId && o.userId === customer.id) ||
        (o.customerId && o.customerId === customer.id) ||
        (o.customer?.email && o.customer.email.toLowerCase().trim() === email) ||
        (phone && (o.customer?.phone === phone || o.customer?.altPhone === phone))
      );

      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب قائمة طلبات العميل' });
    }
  });

  // Customer Single Order GET - Detailed order by ID with strict session ownership verification
  app.get('/api/customer/orders/:id', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) return res.status(404).json({ error: 'حساب العميل غير موجود' });

      const { id } = req.params;
      const allOrders = db.getOrders();
      const order = allOrders.find(o => o.id === id || o.invoiceNumber === id);

      if (!order) {
        return res.status(404).json({ error: 'الطلب غير موجود' });
      }

      // Enforce strict ownership check
      const email = (customer.email || '').toLowerCase().trim();
      const phone = (customer.phone || '').trim();

      const belongsToCustomer = 
        (order.userId && order.userId === customer.id) ||
        (order.customerId && order.customerId === customer.id) ||
        (order.customer?.email && order.customer.email.toLowerCase().trim() === email) ||
        (phone && (order.customer?.phone === phone || order.customer?.altPhone === phone));

      if (!belongsToCustomer) {
        return res.status(403).json({ error: 'غير مصرح لك بالوصول لتفاصيل هذا الطلب' });
      }

      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب تفاصيل الطلب' });
    }
  });

  // ==========================================
  // 🔄 CUSTOMER RETURN REQUESTS API
  // ==========================================

  // Customer Submit Return Request POST
  app.post('/api/customer/returns', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) {
        return res.status(404).json({ error: 'حساب العميل غير موجود' });
      }

      const { orderId, productId, variantId, orderItemId, quantity, reason, otherReason, customerNote, images } = req.body;

      if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
        return res.status(400).json({ error: 'رقم الفاتورة أو معرف الطلب مطلوب' });
      }

      if (!productId || typeof productId !== 'string' || !productId.trim()) {
        return res.status(400).json({ error: 'معرف المنتج المطلوب إرجاعه مطلوب' });
      }

      const validReasons: ReturnReason[] = ['damaged', 'wrong_product', 'different_from_description', 'defective', 'unwanted', 'other'];
      if (!reason || !validReasons.includes(reason as ReturnReason)) {
        return res.status(400).json({ error: 'يرجى تحديد سبب إرجاع صحيح من القائمة المتاحة' });
      }

      if (reason === 'other' && (!otherReason || !otherReason.trim()) && (!customerNote || !customerNote.trim())) {
        return res.status(400).json({ error: 'يرجى كتابة تفاصيل السبب عند اختيار سبب إرجاع "آخر"' });
      }

      const vQty = validateBackendNumeric(quantity, 'positive_integer', { required: true, min: 1, max: 999, fieldNameArabic: 'كمية المنتج المراد إرجاعه' });
      if (!vQty.isValid) {
        return res.status(400).json({ error: vQty.error });
      }
      const reqQuantity = vQty.value;

      // Fetch order from DB
      const order = db.getOrderById(orderId.trim());
      if (!order) {
        return res.status(404).json({ error: 'الطلب المحدد غير موجود بالمتجر' });
      }

      // Check order ownership
      const email = (customer.email || '').toLowerCase().trim();
      const phone = (customer.phone || '').trim();
      const belongsToCustomer = 
        (order.userId && order.userId === customer.id) ||
        (order.customerId && order.customerId === customer.id) ||
        (order.customer?.email && order.customer.email.toLowerCase().trim() === email) ||
        (phone && (order.customer?.phone === phone || order.customer?.altPhone === phone));

      if (!belongsToCustomer) {
        return res.status(403).json({ error: 'غير مصرح لك بطلب إرجاع لطلب لا يخص حسابك' });
      }

      // Check order status eligibility (Must be Delivered or Completed)
      const allowedReturnStatuses = ['Delivered', 'Completed'];
      if (!allowedReturnStatuses.includes(order.status)) {
        return res.status(400).json({ error: 'عذراً، يمكنك طلب الإرجاع فقط للطلبات المكتملة أو المسلّمة للعميل' });
      }

      // Check orderItemId if provided
      if (orderItemId && typeof orderItemId === 'string' && orderItemId.trim()) {
        const itemByOrderItemId = order.items.find((i: any) => i.id === orderItemId.trim() || (i as any).orderItemId === orderItemId.trim());
        if (!itemByOrderItemId) {
          return res.status(400).json({ error: 'عنصر الطلب المحدد لا ينتمي لهذا الطلب أو لحسابك' });
        }
      }

      // Check if product / variant exists in order items
      const targetItem = order.items.find((i: any) => {
        if (orderItemId && (i.id === orderItemId.trim() || (i as any).orderItemId === orderItemId.trim())) return true;
        const pMatch = i.productId === productId;
        const vMatch = variantId ? (i.variantId === variantId || i.variantSku === variantId) : (!i.variantId && !i.variantSku);
        return pMatch && (variantId ? vMatch : true);
      }) || order.items.find((i: any) => i.productId === productId);

      if (!targetItem) {
        return res.status(400).json({ error: 'المنتج المحدد غير موجود ضمن عناصر هذا الطلب' });
      }

      if (productId && targetItem.productId !== productId) {
        return res.status(400).json({ error: 'معرف المنتج لا يتطابق مع عنصر الطلب المحدد' });
      }

      // Check return quantity against purchased quantity
      if (reqQuantity > targetItem.quantity) {
        return res.status(400).json({ error: `الكمية المطلوبة للإرجاع (${reqQuantity}) أكبر من الكمية التي تم شاؤها في هذا الطلب (${targetItem.quantity})` });
      }

      // Check duplicate return requests for this item in this order
      const alreadyReturnedQty = db.getReturnedQuantityForItem(order.id, targetItem.productId, targetItem.variantId);
      const remainingReturnableQty = targetItem.quantity - alreadyReturnedQty;

      if (remainingReturnableQty <= 0) {
        return res.status(400).json({ error: 'تم تقديم أو إكمال طلبات إرجاع لكامل كمية هذا المنتج في هذا الطلب مسبقاً' });
      }

      if (reqQuantity > remainingReturnableQty) {
        return res.status(400).json({
          error: `تم تقديم طلب إرجاع سابق لعدد ${alreadyReturnedQty} قطعة. الكمية المتبقية القابلة للإرجاع فقط هي ${remainingReturnableQty} قطعة`
        });
      }

      // Compute calculated refund amount for item
      const itemUnitPrice = targetItem.price || 0;
      const refundAmount = Number((itemUnitPrice * reqQuantity).toFixed(2));

      // Build return request
      const newReturn = db.createReturnRequest({
        orderId: order.id,
        customerId: customer.id,
        customerName: customer.name || order.customer.name,
        customerPhone: customer.phone || order.customer.phone,
        productId: targetItem.productId,
        productTitle: targetItem.productTitle,
        variantId: targetItem.variantId,
        variantSku: targetItem.variantSku,
        variantInfo: targetItem.variantInfo,
        quantity: reqQuantity,
        unitPrice: itemUnitPrice,
        reason: reason as ReturnReason,
        otherReason: otherReason ? sanitizeText(otherReason) : undefined,
        customerNote: customerNote ? sanitizeText(customerNote) : undefined,
        images: Array.isArray(images) ? images.slice(0, 5) : [],
        status: 'pending',
        refundStatus: 'pending',
        refundAmount
      });

      // System notification for admin
      db.addNotification({
        title: `طلب إرجاع جديد (${order.invoiceNumber || order.id})`,
        message: `قدم العميل ${customer.name} طلب إرجاع لمنتج "${targetItem.productTitle}" بقيمة استرداد ${refundAmount} ج.م`,
        type: 'order',
        priority: 'high',
        icon: 'rotate-ccw'
      });

      res.status(201).json({
        success: true,
        message: 'تم إرسال طلب الإرجاع بنجاح ومراجعته من قبل فريق الدعم الفني',
        returnRequest: newReturn
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تقديم طلب الإرجاع' });
    }
  });

  // Customer List Return Requests GET
  app.get('/api/customer/returns', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) {
        return res.status(404).json({ error: 'حساب العميل غير موجود' });
      }

      const returns = db.getReturnRequestsByCustomerId(customer.id, customer.email, customer.phone);
      res.json(returns);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب قائمة طلبات الإرجاع' });
    }
  });

  // Customer Single Return Request GET
  app.get('/api/customer/returns/:id', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) {
        return res.status(404).json({ error: 'حساب العميل غير موجود' });
      }

      const returnReq = db.getReturnRequestById(req.params.id);
      if (!returnReq) {
        return res.status(404).json({ error: 'طلب الإرجاع غير موجود' });
      }

      if (returnReq.customerId && returnReq.customerId !== customer.id) {
        return res.status(403).json({ error: 'غير مصرح لك بمشاهدة طلب الإرجاع هذا' });
      }

      res.json(returnReq);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب تفاصيل طلب الإرجاع' });
    }
  });

  // Customer Cancel Return Request POST
  app.post('/api/customer/returns/:id/cancel', requireCustomer, (req: any, res) => {
    try {
      const customer = db.getCustomerById(req.customerId);
      if (!customer) {
        return res.status(404).json({ error: 'حساب العميل غير موجود' });
      }

      const returnReq = db.getReturnRequestById(req.params.id);
      if (!returnReq) {
        return res.status(404).json({ error: 'طلب الإرجاع غير موجود' });
      }

      if (returnReq.customerId && returnReq.customerId !== customer.id) {
        return res.status(403).json({ error: 'غير مصرح لك بإلغاء طلب الإرجاع هذا' });
      }

      if (returnReq.status !== 'pending') {
        return res.status(400).json({ error: `لا يمكن إلغاء طلب إرجاع بالحالة الحالية (${returnReq.status})` });
      }

      const updated = db.updateReturnRequest(returnReq.id, {
        status: 'cancelled',
        refundStatus: 'rejected',
        adminNote: 'تم إلغاء الطلب بناءً على رغبة العميل'
      });

      res.json({
        success: true,
        message: 'تم إلغاء طلب الإرجاع بنجاح',
        returnRequest: updated
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إلغاء طلب الإرجاع' });
    }
  });

  // ==========================================
  // ⭐ CUSTOMER PRODUCT REVIEWS & RATINGS API
  // ==========================================

  // Helper function to verify customer purchase eligibility
  const checkCustomerPurchaseEligibility = (customerId: string, productId: string, variantId?: string): { isVerifiedPurchase: boolean; matchingOrder: Order | null } => {
    if (!customerId || !productId) {
      return { isVerifiedPurchase: false, matchingOrder: null };
    }

    const customer = db.getCustomerById(customerId);
    const email = (customer?.email || '').toLowerCase().trim();
    const phone = (customer?.phone || '').trim();

    const allOrders = db.getOrders() || [];

    // Find orders belonging to customer by direct ID, session customer ID, email, or phone
    const customerOrders = allOrders.filter(o => {
      const isDirectIdMatch = (o.userId && o.userId === customerId) || (o.customerId && o.customerId === customerId);
      const isUserMatch = customer && ((o.userId && o.userId === customer.id) || (o.customerId && o.customerId === customer.id));
      const isEmailMatch = email && o.customer?.email && o.customer.email.toLowerCase().trim() === email;
      const isPhoneMatch = phone && (o.customer?.phone === phone || o.customer?.altPhone === phone);
      return Boolean(isDirectIdMatch || isUserMatch || isEmailMatch || isPhoneMatch);
    });

    // Filter completed/delivered orders
    const completedOrders = customerOrders.filter(o => {
      const st = (o.status || '').toString().toLowerCase().trim();
      return st === 'delivered' || st === 'completed' || st === 'تم التوصيل' || st === 'مكتمل';
    });

    // Find if any completed order contains item for productId (and variantId if specified)
    for (const order of completedOrders) {
      if (!Array.isArray(order.items)) continue;
      const matchingItem = order.items.find((item: any) => {
        const pMatch = item.productId === productId;
        if (!pMatch) return false;
        if (variantId) {
          return item.variantId === variantId;
        }
        return true;
      });

      if (matchingItem) {
        return { isVerifiedPurchase: true, matchingOrder: order };
      }
    }

    return { isVerifiedPurchase: false, matchingOrder: null };
  };

  // 1. GET /api/customer/products/:productId/reviews
  // Publicly accessible reviews for a product (default: approved reviews)
  app.get('/api/customer/products/:productId/reviews', (req: any, res) => {
    try {
      const { productId } = req.params;
      const { variantId } = req.query;

      const product = db.getProductById(productId);
      if (!product) {
        return res.status(404).json({ error: 'المنتج غير موجود' });
      }

      // Check if caller is authenticated customer
      let currentCustomerId: string | undefined = undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const session = customerSessions.get(token);
        if (session && Date.now() <= session.expiresAt) {
          currentCustomerId = session.customerId;
        }
      }

      const allProductReviews = db.getReviews({ productId });

      // Public users see only approved reviews. Authenticated customer sees approved + their own pending/rejected.
      let visibleReviews = allProductReviews.filter(r => {
        if (r.status === 'approved') return true;
        if (currentCustomerId && r.customerId === currentCustomerId) return true;
        return false;
      });

      if (variantId && typeof variantId === 'string') {
        visibleReviews = visibleReviews.filter(r => r.variantId === variantId);
      }

      const approvedReviews = allProductReviews.filter(r => r.status === 'approved');
      const distribution = getRatingDistribution(approvedReviews);

      const summary = db.getProductRatingSummary(productId) || {
        productId,
        rating: product.rating || 0,
        reviewsCount: product.reviewsCount || 0,
        distribution
      };

      res.json({
        reviews: visibleReviews,
        summary: {
          productId,
          totalReviews: summary.reviewsCount,
          averageRating: summary.rating,
          ratingDistribution: distribution
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب مراجعات المنتج', message: err.message });
    }
  });

  // 2. GET /api/customer/products/:productId/review-eligibility
  // Check if customer can review this product (supports optional authentication)
  app.get('/api/customer/products/:productId/review-eligibility', (req: any, res) => {
    try {
      const { productId } = req.params;
      const variantId = (req.query.variantId as string) || undefined;

      const product = db.getProductById(productId);
      if (!product) {
        return res.status(404).json({ error: 'المنتج غير موجود' });
      }

      let customerId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const session = customerSessions.get(token);
        if (session && Date.now() <= session.expiresAt) {
          customerId = session.customerId;
        }
      }

      if (!customerId) {
        return res.json({
          productId,
          variantId: variantId || null,
          canReview: false,
          hasPurchased: false,
          hasExistingReview: false,
          isVerifiedPurchase: false,
          existingReview: null,
          reason: 'NOT_LOGGED_IN'
        });
      }

      const { isVerifiedPurchase } = checkCustomerPurchaseEligibility(customerId, productId, variantId);
      const hasPurchased = isVerifiedPurchase;

      const customerReviews = db.getReviews({ productId, customerId });
      const existingReview = customerReviews.find(r => variantId ? r.variantId === variantId : (!r.variantId || r.productId === productId));
      const hasExistingReview = !!existingReview;

      let reason: 'NOT_LOGGED_IN' | 'NOT_PURCHASED' | 'ALREADY_REVIEWED' | 'ELIGIBLE' = 'ELIGIBLE';
      if (hasExistingReview) {
        reason = 'ALREADY_REVIEWED';
      } else if (!hasPurchased) {
        reason = 'NOT_PURCHASED';
      } else {
        reason = 'ELIGIBLE';
      }

      const canReview = hasPurchased && !hasExistingReview;

      res.json({
        productId,
        variantId: variantId || null,
        canReview,
        hasPurchased,
        hasExistingReview,
        isVerifiedPurchase: hasPurchased,
        existingReview: existingReview || null,
        reason
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل التحقق من صلاحية تقييم المنتج', message: err.message });
    }
  });

  // 3. POST /api/customer/products/:productId/reviews
  // Submit a customer review with verified purchase check and rate limit
  app.post('/api/customer/products/:productId/reviews', requireCustomer, reviewRateLimiter, (req: any, res) => {
    try {
      const { productId } = req.params;
      const { rating, title, comment, variantId } = req.body;

      const product = db.getProductById(productId);
      if (!product) {
        return res.status(404).json({ error: 'المنتج المراد تقييمه غير موجود' });
      }

      const vRating = validateBackendNumeric(rating, 'rating', { required: true, fieldNameArabic: 'تقييم المنتج' });
      if (!vRating.isValid) {
        return res.status(400).json({ error: vRating.error });
      }
      const rNum = vRating.value;

      if (!comment || typeof comment !== 'string' || !comment.trim()) {
        return res.status(400).json({ error: 'التعليق لا يمكن أن يكون فارغاً' });
      }

      if (comment.trim().length > 2000) {
        return res.status(400).json({ error: 'التعليق طويل جداً (الحد الأقصى 2000 حرف)' });
      }

      const customer = db.getCustomerById(req.customerId);
      if (!customer) {
        return res.status(401).json({ error: 'حساب العميل غير موجود' });
      }

      // Check verified purchase eligibility on server
      const { isVerifiedPurchase, matchingOrder } = checkCustomerPurchaseEligibility(req.customerId, productId, variantId);

      if (!isVerifiedPurchase) {
        return res.status(403).json({ error: 'يمكنك تقييم هذا المنتج فقط بعد شرائه وتسليمه بنجاح.' });
      }

      // Prevent duplicate reviews for same product/variant by same customer
      const existingReviews = db.getReviews({ productId, customerId: req.customerId });
      const hasDuplicate = existingReviews.some(r => variantId ? r.variantId === variantId : (!r.variantId || r.productId === productId));

      if (hasDuplicate) {
        return res.status(400).json({ error: 'لقد قمت بتقييم هذا المنتج مسبقاً' });
      }

      let variantInfo: string | undefined = undefined;
      if (variantId && product.variants && Array.isArray(product.variants)) {
        const variant = product.variants.find(v => v.id === variantId);
        if (variant) {
          variantInfo = [variant.size, variant.color, variant.capacity].filter(Boolean).join(' / ') || undefined;
        }
      }

      const newReview = db.addReview({
        productId,
        variantId: variantId || undefined,
        variantInfo,
        customerId: req.customerId,
        customerName: customer.name || 'عميل المتجر',
        orderId: matchingOrder ? matchingOrder.id : undefined,
        rating: rNum,
        title: title ? String(title) : undefined,
        comment: String(comment),
        status: 'pending', // Default moderation status
        isVerifiedPurchase: true
      });

      db.logAction('Customer', 'إضافة تقييم', `قام العميل ${customer.name} بإضافة تقييم بـ ${rNum} نجوم للمنتج ${product.title}`);

      res.status(201).json(newReview);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل إرسال التقييم' });
    }
  });

  // 4. GET /api/customer/reviews/my
  // Get all reviews submitted by the authenticated customer
  app.get('/api/customer/reviews/my', requireCustomer, (req: any, res) => {
    try {
      const myReviews = db.getReviews({ customerId: req.customerId });

      const enriched = myReviews.map(r => {
        const product = db.getProductById(r.productId || '');
        return {
          ...r,
          productTitle: product ? product.title : 'منتج غير موجود',
          productMainImage: product ? (product.mainImage || product.images?.[0]) : ''
        };
      });

      enriched.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب تقييمات العميل' });
    }
  });

  // 5. PATCH /api/customer/reviews/:id
  // Customer edits their own existing review
  const handleCustomerUpdateReview = (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { rating, title, comment } = req.body;

      const updated = db.updateReview(
        id,
        {
          rating: rating !== undefined ? Number(rating) : undefined,
          title: title !== undefined ? String(title) : undefined,
          comment: comment !== undefined ? String(comment) : undefined
        },
        req.customerId
      );

      res.json(updated);
    } catch (err: any) {
      const isForbidden = err.message && err.message.includes('غير مصرح');
      const isNotFound = err.message && err.message.includes('غير موجودة');
      res.status(isForbidden ? 403 : isNotFound ? 404 : 400).json({ error: err.message || 'فشل تعديل التقييم' });
    }
  };
  app.patch('/api/customer/reviews/:id', requireCustomer, handleCustomerUpdateReview);
  app.put('/api/customer/reviews/:id', requireCustomer, handleCustomerUpdateReview);

  // 6. DELETE /api/customer/reviews/:id
  // Customer deletes their own review
  app.delete('/api/customer/reviews/:id', requireCustomer, (req: any, res) => {
    try {
      const { id } = req.params;
      db.deleteReview(id, req.customerId);
      res.json({ success: true, message: 'تم حذف التقييم بنجاح' });
    } catch (err: any) {
      const isForbidden = err.message && err.message.includes('غير مصرح');
      const isNotFound = err.message && err.message.includes('غير موجودة');
      res.status(isForbidden ? 403 : isNotFound ? 404 : 400).json({ error: err.message || 'فشل حذف التقييم' });
    }
  });

  // Helper: calculate effective permissions for an admin user based on roles and overrides
  function getAdminEffectivePermissions(user: AdminUser | null, role: Role | null, sysAdminEmail: string): string[] {
    const allActiveKeys = db.getPermissions().filter(p => !p.isDeleted).map(p => p.key);

    if (!user) {
      return allActiveKeys;
    }

    const cleanEmail = user.email ? user.email.trim().toLowerCase() : '';
    if (cleanEmail === sysAdminEmail.toLowerCase()) {
      return allActiveKeys;
    }

    if (user.roleId === 'role-super-admin') {
      return allActiveKeys;
    }

    if (role && (role.id === 'role-super-admin' || (role.isSystem && role.name && (role.name.toLowerCase().includes('super admin') || role.name.toLowerCase() === 'admin')))) {
      return allActiveKeys;
    }

    if (Array.isArray(user.permissions) && (user.permissions.includes('*') || user.permissions.includes('all'))) {
      return allActiveKeys;
    }

    if (!role || role.isDeleted || role.active === false) {
      return Array.isArray(user.permissions) ? user.permissions.filter(k => allActiveKeys.includes(k)) : [];
    }

    const rolePerms = db.getRolePermissions()
      .filter(rp => rp.roleId === role.id)
      .map(rp => rp.permissionKey);

    const directPerms = Array.isArray(user.permissions) ? user.permissions : [];
    const combined = Array.from(new Set([...rolePerms, ...directPerms])).filter(k => allActiveKeys.includes(k));
    return combined;
  }

  // ==========================================
  // 🛡️ ADMIN PANEL ENDPOINTS & AUTHENTICATION
  // ==========================================

  // Admin login endpoint with brute-force rate limit protection & full RBAC support
  app.post('/api/admin/login', loginRateLimiter, (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const sysAdmin = db.getAdmin();
      const adminUsers = db.getAdminUsers();

      // Check if matches system default admin account
      const isSysAdminEmail = sysAdmin && sysAdmin.email && sysAdmin.email.trim().toLowerCase() === cleanEmail;
      // Check if matches a registered AdminUser in database
      const matchedUser = adminUsers.find(u => !u.isDeleted && u.email && u.email.trim().toLowerCase() === cleanEmail);

      let authenticated = false;
      let authenticatedUser: AdminUser | null = null;

      if (matchedUser) {
        // Check if account is active or disabled
        const isUserActive = matchedUser.active !== undefined
          ? matchedUser.active
          : (matchedUser.isActive !== undefined ? matchedUser.isActive : true);

        if (!isUserActive) {
          return res.status(403).json({ error: 'تم تعطيل هذا الحساب الإداري من قبل إدارة النظام' });
        }

        // Verify password
        if (matchedUser.passwordHash && matchedUser.salt) {
          authenticated = verifyPassword(password, matchedUser.passwordHash, matchedUser.salt);
        } else if (isSysAdminEmail && sysAdmin) {
          authenticated = verifyPassword(password, sysAdmin.passwordHash, sysAdmin.salt);
        }

        if (authenticated) {
          authenticatedUser = matchedUser;
        }
      } else if (isSysAdminEmail && sysAdmin) {
        authenticated = verifyPassword(password, sysAdmin.passwordHash, sysAdmin.salt);
      }

      if (authenticated) {
        // Generate secure cryptographically random dynamic session token
        const sessionToken = crypto.randomBytes(32).toString('hex');
        activeSessions.set(sessionToken, {
          email: cleanEmail,
          expiresAt: Date.now() + SESSION_EXPIRY_MS
        });

        // Update lastLogin timestamp if matched registered user
        if (authenticatedUser) {
          try {
            db.updateAdminUser(authenticatedUser.id, {
              lastLogin: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            });
          } catch (e) {}
        }

        const role = authenticatedUser?.roleId ? db.getRoleById(authenticatedUser.roleId) : null;
        const effectivePermissions = getAdminEffectivePermissions(authenticatedUser, role, sysAdmin?.email || 'admin@store.com');

        const adminPayload = {
          id: authenticatedUser ? authenticatedUser.id : 'admin-system',
          name: authenticatedUser ? (authenticatedUser.name || authenticatedUser.username || authenticatedUser.email) : (sysAdmin?.name || 'أحمد الإدريسي'),
          email: authenticatedUser ? authenticatedUser.email : (sysAdmin?.email || cleanEmail),
          phone: authenticatedUser ? (authenticatedUser.phone || '') : (sysAdmin?.phone || ''),
          roleId: authenticatedUser ? authenticatedUser.roleId : 'role-super-admin',
          role: authenticatedUser ? (role?.name || authenticatedUser.role || 'مشرف') : 'مدير النظام الأعلى (Super Admin)',
          permissions: effectivePermissions,
          active: true
        };

        const loginReq = {
          admin: adminPayload,
          headers: req.headers,
          socket: req.socket
        };
        logAudit(loginReq, 'Login', 'AdminUser', adminPayload.email, `تسجيل دخول ناجح للوحة التحكم (${adminPayload.name})`);

        res.json({
          success: true,
          token: sessionToken,
          admin: adminPayload
        });
      } else {
        db.addNotification({
          title: 'تنبيه أمني: محاولة دخول فاشلة',
          message: `محاولة دخول فاشلة باستخدام البريد الإلكتروني (${email || 'غير معروف'}).`,
          type: 'security',
          priority: 'urgent',
          icon: 'shield-alert',
          metadata: {
            email: email || 'unknown',
            ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress
          }
        });
        res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء محاولة تسجيل الدخول' });
    }
  });

  // Protect Admin dashboard routes with sliding-window session checks & active status guard
  const requireAdmin = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'غير مصرح بالدخول. يرجى تسجيل الدخول كمسؤول.' });
    }

    const token = authHeader.substring(7);
    const session = activeSessions.get(token);

    if (!session || Date.now() > session.expiresAt) {
      if (session) {
        activeSessions.delete(token); // Clean up expired session token from registry
      }
      return res.status(401).json({ error: 'انتهت صلاحية الجلسة أو الجلسة غير صالحة. يرجى تسجيل الدخول مجدداً.' });
    }

    // Extend sliding window session duration on active admin request
    session.expiresAt = Date.now() + SESSION_EXPIRY_MS;

    const userEmail = session.email ? session.email.trim().toLowerCase() : '';
    const adminUsers = db.getAdminUsers();
    const matchedUser = adminUsers.find(u => !u.isDeleted && u.email && u.email.trim().toLowerCase() === userEmail);
    const sysAdmin = db.getAdmin();
    const isSysAdmin = sysAdmin && sysAdmin.email && sysAdmin.email.trim().toLowerCase() === userEmail;

    if (!matchedUser && !isSysAdmin) {
      return res.status(401).json({ error: 'الحساب الإداري غير موجود أو تم حذفه' });
    }

    if (matchedUser) {
      const isUserActive = matchedUser.active !== undefined
        ? matchedUser.active
        : (matchedUser.isActive !== undefined ? matchedUser.isActive : true);

      if (!isUserActive) {
        return res.status(403).json({ error: 'تم تعطيل هذا الحساب الإداري من قبل إدارة النظام' });
      }

      const role = matchedUser.roleId ? db.getRoleById(matchedUser.roleId) : null;
      const effectivePermissions = getAdminEffectivePermissions(matchedUser, role, sysAdmin?.email || 'admin@store.com');

      req.admin = {
        email: matchedUser.email,
        id: matchedUser.id,
        name: matchedUser.name || matchedUser.username || matchedUser.email,
        roleId: matchedUser.roleId,
        role: matchedUser.role
      };
      req.adminPermissions = effectivePermissions;
    } else {
      const allActiveKeys = db.getPermissions().filter(p => !p.isDeleted).map(p => p.key);
      req.admin = {
        email: session.email,
        id: 'admin-system',
        name: sysAdmin?.name || 'أحمد الإدريسي',
        roleId: 'role-super-admin',
        role: 'Super Admin'
      };
      req.adminPermissions = allActiveKeys;
    }
    next();
  };

  function logAudit(
    req: any,
    action: string,
    entityType: string,
    entityId: string | undefined,
    description: string
  ) {
    try {
      let adminId = 'system';
      let adminName = 'النظام';

      if (req && req.admin) {
        adminId = req.admin.id || req.admin.email || 'admin';
        adminName = req.admin.name || req.admin.email || 'أدمن النظام';
      }

      const rawIp = req && req.headers ? (req.headers['x-forwarded-for'] as string) || (req.socket ? req.socket.remoteAddress : undefined) : undefined;
      const ipAddress = rawIp ? String(rawIp).split(',')[0].trim() : undefined;
      const userAgent = req && req.headers ? (req.headers['user-agent'] as string) : undefined;

      db.addAuditLog({
        adminId,
        adminName,
        action,
        entityType,
        entityId,
        description,
        ipAddress,
        userAgent
      });
    } catch (e) {
      console.error('Failed to log audit entry:', e);
    }
  }

  // 🛡️ RBAC Enforcement Middleware (Sprint 10 - Strict & Comprehensive)
  const requirePermission = (permissionKey: string | string[]) => {
    return (req: any, res: any, next: any) => {
      try {
        if (!req.admin || !req.admin.email) {
          return res.status(401).json({ error: 'غير مصرح بالدخول. يرجى تسجيل الدخول كمسؤول.' });
        }

        const userEmail = req.admin.email.trim().toLowerCase();
        const requiredKeys = Array.isArray(permissionKey) ? permissionKey : [permissionKey];

        // 1. Main system admin account -> Super Admin bypass
        const sysAdmin = db.getAdmin();
        if (sysAdmin && sysAdmin.email && sysAdmin.email.trim().toLowerCase() === userEmail) {
          return next();
        }

        // 2. Look up current Admin User in adminUsers table
        const adminUsers = db.getAdminUsers();
        const currentUser = adminUsers.find(u =>
          !u.isDeleted &&
          u.email &&
          u.email.trim().toLowerCase() === userEmail
        );

        if (!currentUser) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', code: 'FORBIDDEN', requiredPermission: requiredKeys.join(', ') });
        }

        // Check if user is active
        const isUserActive = currentUser.active !== undefined
          ? currentUser.active
          : (currentUser.isActive !== undefined ? currentUser.isActive : true);

        if (!isUserActive) {
          return res.status(403).json({ error: 'تم تعطيل هذا الحساب الإداري من قبل إدارة النظام', code: 'FORBIDDEN', requiredPermission: requiredKeys.join(', ') });
        }

        // 3. Role check & Super Admin Bypass
        const roleId = currentUser.roleId;
        if (!roleId) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', code: 'FORBIDDEN', requiredPermission: requiredKeys.join(', ') });
        }

        if (roleId === 'role-super-admin') {
          return next();
        }

        const role = db.getRoleById(roleId);
        if (!role || role.isDeleted || role.active === false) {
          return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', code: 'FORBIDDEN', requiredPermission: requiredKeys.join(', ') });
        }

        if (
          role.id === 'role-super-admin' ||
          (role.isSystem && role.name && (role.name.toLowerCase().includes('super admin') || role.name.toLowerCase() === 'admin'))
        ) {
          return next();
        }

        // Direct wildcard permissions check
        if (Array.isArray(currentUser.permissions) && (currentUser.permissions.includes('*') || currentUser.permissions.includes('all'))) {
          return next();
        }

        // 4. Role Permissions Check -> Allow / Deny
        const rolePermissions = db.getRolePermissions().filter(rp => rp.roleId === role.id);
        const assignedKeys = rolePermissions.map(rp => rp.permissionKey);

        if (requiredKeys.some(k => assignedKeys.includes(k))) {
          return next();
        }

        // User direct permission overrides check
        if (Array.isArray(currentUser.permissions) && requiredKeys.some(k => currentUser.permissions.includes(k))) {
          return next();
        }

        // Deny with 403 status code
        return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', code: 'FORBIDDEN', requiredPermission: requiredKeys.join(', ') });
      } catch (err: any) {
        return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', code: 'FORBIDDEN', requiredPermission: Array.isArray(permissionKey) ? permissionKey.join(', ') : permissionKey });
      }
    };
  };

  // Admin change password endpoint (Supports both system admin and registered AdminUsers)
  app.put('/api/admin/change-password', requireAdmin, (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبة' });
      }

      if (typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف' });
      }

      const userEmail = req.admin?.email ? req.admin.email.trim().toLowerCase() : '';
      const adminUsers = db.getAdminUsers();
      const matchedUser = adminUsers.find(u => !u.isDeleted && u.email && u.email.trim().toLowerCase() === userEmail);
      const sysAdmin = db.getAdmin();

      if (matchedUser) {
        let isValid = false;
        if (matchedUser.passwordHash && matchedUser.salt) {
          isValid = verifyPassword(currentPassword, matchedUser.passwordHash, matchedUser.salt);
        } else if (sysAdmin && sysAdmin.passwordHash && sysAdmin.salt) {
          isValid = verifyPassword(currentPassword, sysAdmin.passwordHash, sysAdmin.salt);
        }

        if (!isValid) {
          return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
        }

        const hashed = hashPassword(newPassword);
        db.updateAdminUser(matchedUser.id, {
          passwordHash: hashed.hash,
          salt: hashed.salt
        });
      } else if (sysAdmin) {
        if (!verifyPassword(currentPassword, sysAdmin.passwordHash, sysAdmin.salt)) {
          return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
        }

        const hashed = hashPassword(newPassword);
        db.updateAdminPassword(hashed.hash, hashed.salt);
      } else {
        return res.status(404).json({ error: 'حساب المشرف غير موجود' });
      }

      logAudit(req, 'Update', 'AdminUser', req.admin?.email, 'تغيير كلمة مرور المشرف');

      res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
    } catch (err: any) {
      console.error('Error changing admin password:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء محاولة تغيير كلمة المرور' });
    }
  });

  // Get current authenticated admin session info & profile with RBAC details
  app.get('/api/admin/me', requireAdmin, (req: any, res) => {
    try {
      const userEmail = req.admin?.email ? req.admin.email.trim().toLowerCase() : '';
      const adminUsers = db.getAdminUsers();
      const matchedUser = adminUsers.find(u => !u.isDeleted && u.email && u.email.trim().toLowerCase() === userEmail);
      const sysAdmin = db.getAdmin();

      if (matchedUser) {
        const isUserActive = matchedUser.active !== undefined
          ? matchedUser.active
          : (matchedUser.isActive !== undefined ? matchedUser.isActive : true);

        if (!isUserActive) {
          return res.status(403).json({ error: 'تم تعطيل هذا الحساب الإداري من قبل إدارة النظام' });
        }

        const role = matchedUser.roleId ? db.getRoleById(matchedUser.roleId) : null;
        const effectivePermissions = getAdminEffectivePermissions(matchedUser, role, sysAdmin?.email || 'admin@store.com');

        return res.json({
          success: true,
          admin: {
            id: matchedUser.id,
            name: matchedUser.name || matchedUser.username || matchedUser.email,
            email: matchedUser.email,
            phone: matchedUser.phone || '',
            roleId: matchedUser.roleId,
            role: role?.name || matchedUser.role || 'مشرف',
            permissions: effectivePermissions,
            active: true
          }
        });
      }

      // Default system admin account
      const allActiveKeys = db.getPermissions().filter(p => !p.isDeleted).map(p => p.key);
      res.json({
        success: true,
        admin: {
          id: 'admin-system',
          name: sysAdmin?.name || 'أحمد الإدريسي',
          email: sysAdmin?.email || req.admin?.email || 'admin@store.com',
          phone: sysAdmin?.phone || '',
          roleId: 'role-super-admin',
          role: 'مدير النظام الأعلى (Super Admin)',
          permissions: allActiveKeys,
          active: true
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل التحقق من الجلسة الإدارية' });
    }
  });

  // Update admin profile (Name, Phone, Email)
  const handleUpdateAdminProfile = (req: any, res: any) => {
    try {
      const { name, phone, email } = req.body;
      const userEmail = req.admin?.email ? req.admin.email.trim().toLowerCase() : '';
      const adminUsers = db.getAdminUsers();
      const matchedUser = adminUsers.find(u => !u.isDeleted && u.email && u.email.trim().toLowerCase() === userEmail);

      let updatedAdmin;
      if (matchedUser) {
        const updates: any = {};
        if (name !== undefined) {
          updates.name = String(name).trim();
          updates.username = String(name).trim();
        }
        if (phone !== undefined) {
          updates.phone = String(phone).trim();
        }
        if (email !== undefined) {
          const cleanEmail = String(email).trim().toLowerCase();
          if (cleanEmail && cleanEmail !== matchedUser.email.toLowerCase()) {
            const isEmailTaken = adminUsers.some(u => u.id !== matchedUser.id && !u.isDeleted && u.email?.toLowerCase() === cleanEmail);
            if (isEmailTaken) {
              return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل لمشرف آخر' });
            }
            updates.email = cleanEmail;
          }
        }
        db.updateAdminUser(matchedUser.id, updates);

        const freshUser = db.getAdminUserById(matchedUser.id);
        const sysAdmin = db.getAdmin();
        const role = freshUser?.roleId ? db.getRoleById(freshUser.roleId) : null;
        const effectivePermissions = getAdminEffectivePermissions(freshUser || matchedUser, role, sysAdmin?.email || 'admin@store.com');

        updatedAdmin = {
          id: matchedUser.id,
          name: freshUser?.name || matchedUser.name || 'مشرف',
          email: freshUser?.email || matchedUser.email,
          phone: freshUser?.phone !== undefined ? freshUser.phone : '',
          roleId: freshUser?.roleId || matchedUser.roleId,
          role: role?.name || matchedUser.role || 'مشرف',
          permissions: effectivePermissions,
          active: true
        };
      } else {
        const sysAdminUpdates: any = {};
        if (name !== undefined) sysAdminUpdates.name = String(name).trim();
        if (phone !== undefined) sysAdminUpdates.phone = String(phone).trim();
        if (email !== undefined) sysAdminUpdates.email = String(email).trim().toLowerCase();

        const sysAdmin = db.updateAdminProfile(sysAdminUpdates);
        const allActiveKeys = db.getPermissions().filter(p => !p.isDeleted).map(p => p.key);

        updatedAdmin = {
          id: 'admin-system',
          name: sysAdmin?.name || name || 'أحمد الإدريسي',
          email: sysAdmin?.email || email || userEmail || 'admin@store.com',
          phone: sysAdmin?.phone || '',
          roleId: 'role-super-admin',
          role: 'مدير النظام الأعلى (Super Admin)',
          permissions: allActiveKeys,
          active: true
        };
      }

      logAudit(req, 'Update', 'AdminUser', req.admin?.email, `تحديث الملف الشخصي للمسؤول: ${updatedAdmin.name} - هاتف: ${updatedAdmin.phone}`);

      res.json({
        success: true,
        message: 'تم حفظ وتحديث بيانات الملف الشخصي لمسؤول النظام بنجاح',
        admin: updatedAdmin
      });
    } catch (err: any) {
      console.error('Error updating admin profile:', err);
      res.status(500).json({ error: 'حدث خطأ أثناء تحديث الملف الشخصي' });
    }
  };

  app.put('/api/admin/profile', requireAdmin, handleUpdateAdminProfile);
  app.patch('/api/admin/profile', requireAdmin, handleUpdateAdminProfile);

  // Admin session logout endpoint
  app.post('/api/admin/logout', requireAdmin, (req: any, res) => {
    try {
      logAudit(req, 'Logout', 'AdminUser', req.admin?.email, 'تسجيل خروج من لوحة التحكم');
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        activeSessions.delete(token); // Safely delete active session token from server
      }
      res.json({ success: true, message: 'تم تسجيل الخروج وإبطال الجلسة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء محاولة تسجيل الخروج' });
    }
  });

  // 🛡️ Audit Logs Endpoint (Sprint 8 - Phase 1)
  app.get('/api/admin/audit-logs', requireAdmin, requirePermission('admins.manage'), (req: any, res) => {
    try {
      const { search, admin, entityType, dateFrom, dateTo, page, limit } = req.query;
      const result = db.getAuditLogs({
        search: typeof search === 'string' ? search : undefined,
        admin: typeof admin === 'string' ? admin : undefined,
        entityType: typeof entityType === 'string' ? entityType : undefined,
        dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
        dateTo: typeof dateTo === 'string' ? dateTo : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20
      });

      res.json({
        success: true,
        ...result
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل استرجاع سجلات التدقيق', message: err.message });
    }
  });

  // 🔔 Notification Center Endpoints (Sprint 8 - Phase 2)
  app.get('/api/admin/notifications', requireAdmin, (req: any, res) => {
    try {
      const { search, priority, type, read, dateFrom, dateTo, page, limit } = req.query;
      const result = db.getAdminNotifications({
        search: typeof search === 'string' ? search : undefined,
        priority: typeof priority === 'string' ? priority : undefined,
        type: typeof type === 'string' ? type : undefined,
        read: typeof read === 'string' ? read : undefined,
        dateFrom: typeof dateFrom === 'string' ? dateFrom : undefined,
        dateTo: typeof dateTo === 'string' ? dateTo : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20
      });

      res.json({
        success: true,
        ...result
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل استرجاع التنبيهات', message: err.message });
    }
  });

  app.patch('/api/admin/notifications/read-all', requireAdmin, (req: any, res) => {
    try {
      db.markAllNotificationsRead();
      res.json({ success: true, message: 'تم تحديد جميع التنبيهات كمقروءة' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحديث التنبيهات', message: err.message });
    }
  });

  app.patch('/api/admin/notifications/:id/read', requireAdmin, (req: any, res) => {
    try {
      const { id } = req.params;
      const updated = db.markNotificationRead(id);
      if (!updated) {
        return res.status(404).json({ error: 'التنبيه غير موجود' });
      }
      res.json({ success: true, notification: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحديث حالة التنبيه', message: err.message });
    }
  });

  app.delete('/api/admin/notifications/:id', requireAdmin, (req: any, res) => {
    try {
      const { id } = req.params;
      const deleted = db.deleteNotification(id);
      if (!deleted) {
        return res.status(404).json({ error: 'التنبيه غير موجود' });
      }
      res.json({ success: true, message: 'تم حذف التنبيه بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف التنبيه', message: err.message });
    }
  });

  // ==========================================
  // 👥 ADMIN USERS MANAGEMENT ENDPOINTS (Sprint 7 - Phase 2)
  // ==========================================

  // Helper to sanitize AdminUser object and never expose password hashes
  const sanitizeAdminUser = (user: AdminUser) => {
    const activeVal = user.active !== undefined
      ? user.active
      : (user.isActive !== undefined ? user.isActive : true);

    return {
      id: user.id,
      name: user.name || user.username || '',
      email: user.email,
      phone: user.phone || '',
      roleId: user.roleId || '',
      active: activeVal,
      lastLogin: user.lastLogin || user.lastLoginAt || null,
      createdAt: user.createdAt || new Date().toISOString()
    };
  };

  // GET /api/admin/users - List all non-deleted admin users
  app.get('/api/admin/users', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const users = db.getAdminUsers();
      const activeUsers = users.filter(u => !u.isDeleted);
      const sanitized = activeUsers.map(sanitizeAdminUser);
      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب قائمة المستخدمين الإداريين', message: err.message });
    }
  });

  // POST /api/admin/users - Create new admin user
  app.post('/api/admin/users', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { name, email, roleId, active, password } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'اسم المشرف مطلوب' });
      }

      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صالحة' });
      }

      if (!roleId || typeof roleId !== 'string' || !roleId.trim()) {
        return res.status(400).json({ error: 'معرف الدور (roleId) مطلوب' });
      }

      const roles = db.getRoles();
      const roleExists = roles.some(r => r.id === roleId.trim());
      if (!roleExists) {
        return res.status(400).json({ error: 'الدور المحدد غير موجود بنظام الصلاحيات' });
      }

      // Check unique email against non-deleted users
      const existingUsers = db.getAdminUsers();
      const isEmailTaken = existingUsers.some(u => !u.isDeleted && u.email && u.email.trim().toLowerCase() === cleanEmail);
      const systemAdminEmail = db.getAdmin()?.email?.trim().toLowerCase();
      
      if (isEmailTaken || (systemAdminEmail && systemAdminEmail === cleanEmail && !existingUsers.some(u => u.email?.trim().toLowerCase() === cleanEmail))) {
        return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل لمشرف آخر' });
      }

      const isActiveVal = active !== undefined ? Boolean(active) : true;
      const passToHash = (password && typeof password === 'string' && password.trim()) ? password.trim() : crypto.randomBytes(16).toString('hex');
      const { hash, salt } = hashPassword(passToHash);

      const newUser: AdminUser = {
        id: `admin-${Date.now()}`,
        name: name.trim(),
        username: name.trim(),
        email: cleanEmail,
        roleId: roleId.trim(),
        active: isActiveVal,
        isActive: isActiveVal,
        isDeleted: false,
        passwordHash: hash,
        salt,
        lastLogin: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.createAdminUser(newUser);
      logAudit(req, 'Create', 'AdminUser', newUser.id, `إنشاء حساب مشرف جديد: ${newUser.name} (${newUser.email})`);
      res.status(201).json(sanitizeAdminUser(newUser));
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إنشاء حساب المشرف', message: err.message });
    }
  });

  // PATCH /api/admin/users/:id - Update admin user fields
  app.patch('/api/admin/users/:id', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const existingUser = db.getAdminUserById(id);

      if (!existingUser || existingUser.isDeleted) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      const { name, email, roleId, active, password } = req.body;
      const updates: Partial<AdminUser> = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'اسم المشرف لا يمكن أن يكون فارغاً' });
        }
        updates.name = name.trim();
        updates.username = name.trim();
      }

      if (email !== undefined) {
        if (typeof email !== 'string' || !email.trim()) {
          return res.status(400).json({ error: 'البريد الإلكتروني لا يمكن أن يكون فارغاً' });
        }
        const cleanEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صالحة' });
        }

        if (cleanEmail !== existingUser.email.toLowerCase()) {
          const existingUsers = db.getAdminUsers();
          const isEmailTaken = existingUsers.some(u => u.id !== id && !u.isDeleted && u.email && u.email.trim().toLowerCase() === cleanEmail);
          if (isEmailTaken) {
            return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل لمشرف آخر' });
          }
        }
        updates.email = cleanEmail;
      }

      if (roleId !== undefined) {
        if (typeof roleId !== 'string' || !roleId.trim()) {
          return res.status(400).json({ error: 'معرف الدور لا يمكن أن يكون فارغاً' });
        }
        const roles = db.getRoles();
        const roleExists = roles.some(r => r.id === roleId.trim());
        if (!roleExists) {
          return res.status(400).json({ error: 'الدور المحدد غير موجود بنظام الصلاحيات' });
        }
        updates.roleId = roleId.trim();
      }

      if (active !== undefined) {
        const activeBool = Boolean(active);
        updates.active = activeBool;
        updates.isActive = activeBool;
      }

      if (password && typeof password === 'string' && password.trim()) {
        const { hash, salt } = hashPassword(password.trim());
        updates.passwordHash = hash;
        updates.salt = salt;
      }

      const updatedUser = db.updateAdminUser(id, updates);
      if (!updatedUser) {
        return res.status(404).json({ error: 'فشل تحديث بيانات المشرف' });
      }

      logAudit(req, 'Update', 'AdminUser', id, `تعديل بيانات المشرف: ${updatedUser.name} (${updatedUser.email})`);

      res.json(sanitizeAdminUser(updatedUser));
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل بيانات المشرف', message: err.message });
    }
  });

  // DELETE /api/admin/users/:id - Soft delete admin user
  app.delete('/api/admin/users/:id', requireAdmin, requirePermission('admins.manage'), (req: any, res) => {
    try {
      const { id } = req.params;
      const userToDelete = db.getAdminUserById(id);

      if (!userToDelete || userToDelete.isDeleted) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      // 1. Prevent deleting currently logged-in admin
      const loggedInEmail = req.admin?.email?.trim().toLowerCase();
      if (loggedInEmail && userToDelete.email && userToDelete.email.trim().toLowerCase() === loggedInEmail) {
        return res.status(400).json({ error: 'لا يمكن حذف حساب المشرف القائم بتسجيل الدخول حالياً' });
      }

      // 2. Prevent deleting the last Super Admin
      const roles = db.getRoles();
      const superAdminRoleIds = new Set(
        roles.filter(r => r.id === 'role-super-admin' || (r.name && (r.name.toLowerCase().includes('super admin') || r.name.toLowerCase() === 'admin'))).map(r => r.id)
      );
      superAdminRoleIds.add('role-super-admin');

      const isSuperAdminUser = (u: AdminUser) => {
        if (u.roleId && superAdminRoleIds.has(u.roleId)) return true;
        if (u.role === 'Admin' || u.role === 'Super Admin') return true;
        return false;
      };

      if (isSuperAdminUser(userToDelete)) {
        const allUsers = db.getAdminUsers();
        const activeSuperAdmins = allUsers.filter(u => !u.isDeleted && isSuperAdminUser(u));
        if (activeSuperAdmins.length <= 1) {
          return res.status(400).json({ error: 'لا يمكن حذف آخر مسؤول نظام بأعلى الصلاحيات (Super Admin)' });
        }
      }

      const success = db.deleteAdminUser(id);
      if (!success) {
        return res.status(404).json({ error: 'المستخدم غير موجود' });
      }

      logAudit(req, 'Delete', 'AdminUser', id, `حذف المشرف: ${userToDelete.name} (${userToDelete.email})`);

      res.json({ success: true, message: 'تم حذف المشرف بنجاح (حذف مؤقت)' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف المشرف', message: err.message });
    }
  });

  // ==========================================
  // 🛡️ ROLES MANAGEMENT ENDPOINTS (Sprint 7 - Phase 3)
  // ==========================================

  // Helper to sanitize Role object
  const sanitizeRole = (role: Role) => {
    return {
      id: role.id,
      name: role.name,
      description: role.description || '',
      isSystem: Boolean(role.isSystem),
      active: role.active !== undefined ? Boolean(role.active) : true,
      isDeleted: Boolean(role.isDeleted),
      createdAt: role.createdAt || new Date().toISOString()
    };
  };

  // GET /api/admin/roles - List all non-deleted roles
  app.get('/api/admin/roles', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const roles = db.getRoles();
      const activeRoles = roles.filter(r => !r.isDeleted);
      const sanitized = activeRoles.map(sanitizeRole);
      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب قائمة الأدوار', message: err.message });
    }
  });

  // POST /api/admin/roles - Create new role
  app.post('/api/admin/roles', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { name, description, active } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'اسم الدور مطلوب' });
      }

      if (!description || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'وصف الدور مطلوب' });
      }

      const cleanName = name.trim();
      const roles = db.getRoles();
      const nameExists = roles.some(r => !r.isDeleted && r.name && r.name.trim().toLowerCase() === cleanName.toLowerCase());

      if (nameExists) {
        return res.status(400).json({ error: 'اسم الدور مستخدم بالفعل' });
      }

      const isActiveVal = active !== undefined ? Boolean(active) : true;

      const newRole: Role = {
        id: `role-${Date.now()}`,
        name: cleanName,
        description: description.trim(),
        isSystem: false,
        active: isActiveVal,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.createRole(newRole);
      logAudit(req, 'Create', 'Role', newRole.id, `إنشاء دور جديد: ${newRole.name}`);
      res.status(201).json(sanitizeRole(newRole));
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إنشاء الدور الجديد', message: err.message });
    }
  });

  // PATCH /api/admin/roles/:id - Update existing role
  app.patch('/api/admin/roles/:id', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const existingRole = db.getRoleById(id);

      if (!existingRole || existingRole.isDeleted) {
        return res.status(404).json({ error: 'الدور غير موجود' });
      }

      const { name, description, active } = req.body;
      const updates: Partial<Role> = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'اسم الدور لا يمكن أن يكون فارغاً' });
        }
        const cleanName = name.trim();
        if (cleanName.toLowerCase() !== existingRole.name.toLowerCase()) {
          const roles = db.getRoles();
          const nameExists = roles.some(r => r.id !== id && !r.isDeleted && r.name && r.name.trim().toLowerCase() === cleanName.toLowerCase());
          if (nameExists) {
            return res.status(400).json({ error: 'اسم الدور مستخدم بالفعل' });
          }
        }
        updates.name = cleanName;
      }

      if (description !== undefined) {
        if (typeof description !== 'string' || !description.trim()) {
          return res.status(400).json({ error: 'وصف الدور لا يمكن أن يكون فارغاً' });
        }
        updates.description = description.trim();
      }

      if (active !== undefined) {
        updates.active = Boolean(active);
      }

      const updatedRole = db.updateRole(id, updates);
      if (!updatedRole) {
        return res.status(404).json({ error: 'فشل تحديث بيانات الدور' });
      }

      logAudit(req, 'Update', 'Role', id, `تعديل بيانات الدور: ${updatedRole.name}`);

      res.json(sanitizeRole(updatedRole));
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل بيانات الدور', message: err.message });
    }
  });

  // DELETE /api/admin/roles/:id - Soft delete role
  app.delete('/api/admin/roles/:id', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const roleToDelete = db.getRoleById(id);

      if (!roleToDelete || roleToDelete.isDeleted) {
        return res.status(404).json({ error: 'الدور غير موجود' });
      }

      // 1. Prevent deleting system roles
      if (roleToDelete.isSystem || roleToDelete.id === 'role-super-admin') {
        return res.status(400).json({ error: 'لا يمكن حذف أدوار النظام الأساسية (System Roles)' });
      }

      // 2. Prevent deleting roles assigned to active Admin Users
      const adminUsers = db.getAdminUsers();
      const isAssigned = adminUsers.some(u => !u.isDeleted && u.roleId === id);
      if (isAssigned) {
        return res.status(400).json({ error: 'لا يمكن حذف الدور لأنه مرتبط بمستخدمين إداريين حالياً. يرجى إعادة تعيين أدوارهم أولاً.' });
      }

      const success = db.deleteRole(id);
      if (!success) {
        return res.status(404).json({ error: 'الدور غير موجود' });
      }

      logAudit(req, 'Delete', 'Role', id, `حذف الدور: ${roleToDelete.name}`);

      res.json({ success: true, message: 'تم حذف الدور بنجاح (حذف مؤقت)' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف الدور', message: err.message });
    }
  });

  // ==========================================
  // 🔑 PERMISSIONS MANAGEMENT ENDPOINTS (Sprint 7 - Phase 4)
  // ==========================================

  // Helper to sanitize Permission object
  const sanitizePermission = (perm: Permission) => {
    const grp = perm.group || perm.module || '';
    return {
      id: perm.id,
      key: perm.key,
      name: perm.name,
      description: perm.description || '',
      group: grp,
      isSystem: Boolean(perm.isSystem),
      active: perm.active !== undefined ? Boolean(perm.active) : true,
      isDeleted: Boolean(perm.isDeleted),
      createdAt: perm.createdAt || new Date().toISOString()
    };
  };

  // GET /api/admin/permissions - List all non-deleted permissions
  app.get('/api/admin/permissions', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const permissions = db.getPermissions();
      const activePerms = permissions.filter(p => !p.isDeleted);
      const sanitized = activePerms.map(sanitizePermission);
      res.json(sanitized);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب قائمة الصلاحيات', message: err.message });
    }
  });

  // POST /api/admin/permissions - Create new permission
  app.post('/api/admin/permissions', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { key, name, description, group, active } = req.body;

      if (!key || typeof key !== 'string' || !key.trim()) {
        return res.status(400).json({ error: 'مفتاح الصلاحية (key) مطلوب' });
      }

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'اسم الصلاحية مطلوب' });
      }

      if (!group || typeof group !== 'string' || !group.trim()) {
        return res.status(400).json({ error: 'مجموعة الصلاحية (group) مطلوبة' });
      }

      const cleanKey = key.trim().toLowerCase();
      const cleanName = name.trim();
      const cleanGroup = group.trim();

      const existingPermissions = db.getPermissions();

      // Validate unique key
      const keyExists = existingPermissions.some(p => !p.isDeleted && p.key && p.key.trim().toLowerCase() === cleanKey);
      if (keyExists) {
        return res.status(400).json({ error: 'مفتاح الصلاحية مستخدم بالفعل' });
      }

      // Validate unique name
      const nameExists = existingPermissions.some(p => !p.isDeleted && p.name && p.name.trim().toLowerCase() === cleanName.toLowerCase());
      if (nameExists) {
        return res.status(400).json({ error: 'اسم الصلاحية مستخدم بالفعل' });
      }

      const isActiveVal = active !== undefined ? Boolean(active) : true;

      const newPerm: Permission = {
        id: `perm-${Date.now()}`,
        key: cleanKey,
        name: cleanName,
        description: (description && typeof description === 'string') ? description.trim() : '',
        group: cleanGroup,
        module: cleanGroup,
        isSystem: false,
        active: isActiveVal,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      db.createPermission(newPerm);
      logAudit(req, 'Create', 'Permission', newPerm.id, `إضافة صلاحية جديدة: ${newPerm.name} (${newPerm.key})`);
      res.status(201).json(sanitizePermission(newPerm));
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إنشاء الصلاحية الجديدة', message: err.message });
    }
  });

  // PATCH /api/admin/permissions/:id - Update existing permission
  app.patch('/api/admin/permissions/:id', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const existingPerm = db.getPermissionById(id);

      if (!existingPerm || existingPerm.isDeleted) {
        return res.status(404).json({ error: 'الصلاحية غير موجودة' });
      }

      const { name, description, group, active } = req.body;
      const updates: Partial<Permission> = {};

      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ error: 'اسم الصلاحية لا يمكن أن يكون فارغاً' });
        }
        const cleanName = name.trim();
        if (cleanName.toLowerCase() !== existingPerm.name.toLowerCase()) {
          const allPerms = db.getPermissions();
          const nameExists = allPerms.some(p => p.id !== id && !p.isDeleted && p.name && p.name.trim().toLowerCase() === cleanName.toLowerCase());
          if (nameExists) {
            return res.status(400).json({ error: 'اسم الصلاحية مستخدم بالفعل' });
          }
        }
        updates.name = cleanName;
      }

      if (group !== undefined) {
        if (typeof group !== 'string' || !group.trim()) {
          return res.status(400).json({ error: 'مجموعة الصلاحية (group) لا يمكن أن تكون فارغة' });
        }
        updates.group = group.trim();
        updates.module = group.trim();
      }

      if (description !== undefined) {
        updates.description = typeof description === 'string' ? description.trim() : '';
      }

      if (active !== undefined) {
        updates.active = Boolean(active);
      }

      const updatedPerm = db.updatePermission(id, updates);
      if (!updatedPerm) {
        return res.status(404).json({ error: 'فشل تحديث بيانات الصلاحية' });
      }

      logAudit(req, 'Update', 'Permission', id, `تعديل بيانات الصلاحية: ${updatedPerm.name}`);

      res.json(sanitizePermission(updatedPerm));
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل بيانات الصلاحية', message: err.message });
    }
  });

  // DELETE /api/admin/permissions/:id - Soft delete permission
  app.delete('/api/admin/permissions/:id', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const permToDelete = db.getPermissionById(id);

      if (!permToDelete || permToDelete.isDeleted) {
        return res.status(404).json({ error: 'الصلاحية غير موجودة' });
      }

      // 1. Prevent deleting system permissions
      if (permToDelete.isSystem) {
        return res.status(400).json({ error: 'لا يمكن حذف صلاحيات النظام الأساسية (System Permissions)' });
      }

      // 2. Prevent deleting permissions assigned to any role in rolePermissions
      const rolePermissions = db.getRolePermissions();
      const isAssignedToRole = rolePermissions.some(rp => rp.permissionKey === permToDelete.key);
      if (isAssignedToRole) {
        return res.status(400).json({ error: 'لا يمكن حذف الصلاحية لأنها مرتبطة بأدوار حالية بنظام الصلاحيات.' });
      }

      const success = db.deletePermission(id);
      if (!success) {
        return res.status(404).json({ error: 'الصلاحية غير موجودة' });
      }

      logAudit(req, 'Delete', 'Permission', id, `حذف الصلاحية: ${permToDelete.name}`);

      res.json({ success: true, message: 'تم حذف الصلاحية بنجاح (حذف مؤقت)' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف الصلاحية', message: err.message });
    }
  });

  // ==========================================
  // 🔗 ROLE ↔ PERMISSION MATRIX ENDPOINTS (Sprint 7 - Phase 5)
  // ==========================================

  // GET /api/admin/roles/:id/permissions - Get role details, all active permissions, and assigned permission keys
  app.get('/api/admin/roles/:id/permissions', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const role = db.getRoleById(id);

      if (!role || role.isDeleted) {
        return res.status(404).json({ error: 'الدور غير موجود' });
      }

      const allPermissions = db.getPermissions();
      const activePermissions = allPermissions.filter(p => !p.isDeleted);
      const sanitizedPermissions = activePermissions.map(sanitizePermission);

      const rolePermissions = db.getRolePermissions();
      const assignedPermissions = rolePermissions
        .filter(rp => rp.roleId === id)
        .map(rp => rp.permissionKey);

      res.json({
        role: sanitizeRole(role),
        permissions: sanitizedPermissions,
        assignedPermissions
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب صلاحيات الدور', message: err.message });
    }
  });

  // PUT /api/admin/roles/:id/permissions - Replace permission set of selected role
  app.put('/api/admin/roles/:id/permissions', requireAdmin, requirePermission('admins.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const role = db.getRoleById(id);

      if (!role || role.isDeleted) {
        return res.status(404).json({ error: 'الدور غير موجود' });
      }

      // System protection: Prevent editing permissions of Super Admin role
      if (id === 'role-super-admin' || role.id === 'role-super-admin' || (role.isSystem && role.name && (role.name.toLowerCase().includes('super admin') || role.name.toLowerCase() === 'admin'))) {
        return res.status(400).json({ error: 'لا يمكن تعديل صلاحيات مدير النظام الأعلى (Super Admin)' });
      }

      const rawPermissions = req.body.permissions ?? req.body.permissionKeys ?? req.body.assignedPermissions;

      if (!Array.isArray(rawPermissions)) {
        return res.status(400).json({ error: 'قائمة الصلاحيات (permissions) يجب أن تكون مصفوفة' });
      }

      const permKeys: string[] = rawPermissions.map(k => String(k).trim());

      // Validate no duplicated permissions
      const uniqueKeys = new Set(permKeys);
      if (uniqueKeys.size !== permKeys.length) {
        return res.status(400).json({ error: 'توجد صلاحيات مكررة في القائمة' });
      }

      // Validate every permission key exists in active non-deleted permissions
      const activePerms = db.getPermissions().filter(p => !p.isDeleted);
      const validKeysSet = new Set(activePerms.map(p => p.key));

      for (const k of permKeys) {
        if (!validKeysSet.has(k)) {
          return res.status(400).json({ error: `الصلاحية (${k}) غير موجودة بنظام الصلاحيات` });
        }
      }

      // Atomic replace
      db.setRolePermissions(id, permKeys);

      logAudit(req, 'Permission Changes', 'Role', id, `تعديل صلاحيات الدور ${role.name}: تم تعيين ${permKeys.length} صلاحية`);

      res.json({
        success: true,
        message: 'تم تحديث صلاحيات الدور بنجاح',
        roleId: id,
        assignedPermissions: permKeys
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحديث صلاحيات الدور', message: err.message });
    }
  });

  // ==========================================
  // 📊 ADMIN ANALYTICS ENDPOINTS
  // ==========================================

  // GET /api/admin/analytics/sales
  app.get('/api/admin/analytics/sales', requireAdmin, requirePermission('analytics.view'), (req, res) => {
    try {
      const range = req.query.range as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const analytics = db.getSalesAnalytics({ range, startDate, endDate });
      res.json({
        success: true,
        analytics
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل تحليلات المبيعات', message: err.message });
    }
  });

  // GET /api/admin/analytics/top-products
  app.get('/api/admin/analytics/top-products', requireAdmin, requirePermission('analytics.view'), (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const topProducts = db.getTopProducts(limit);
      res.json({
        success: true,
        topProducts
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل أكثر المنتجات مبيعاً', message: err.message });
    }
  });

  // GET /api/admin/analytics/customers
  app.get('/api/admin/analytics/customers', requireAdmin, requirePermission('analytics.view'), (req, res) => {
    try {
      const analytics = db.getCustomerAnalytics();
      res.json({
        success: true,
        analytics
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل تحليلات العملاء', message: err.message });
    }
  });

  // GET /api/admin/analytics/inventory
  app.get('/api/admin/analytics/inventory', requireAdmin, requirePermission('analytics.view'), (req, res) => {
    try {
      const analytics = db.getInventoryAnalytics();
      res.json({
        success: true,
        analytics
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل تحليلات المخزون', message: err.message });
    }
  });

  // GET /api/admin/analytics/reviews
  app.get('/api/admin/analytics/reviews', requireAdmin, requirePermission('analytics.view'), (req, res) => {
    try {
      const analytics = db.getReviewAnalytics();
      res.json({
        success: true,
        analytics
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل تحليلات المراجعين والتقييمات', message: err.message });
    }
  });

  // GET /api/admin/analytics/returns
  app.get('/api/admin/analytics/returns', requireAdmin, (req: any, res) => {
    try {
      const userPermissions = req.adminPermissions || [];
      const isSuperAdmin = req.admin?.roleId === 'role-super-admin' || req.admin?.email === (db.getAdmin()?.email);
      const hasViewPerm = isSuperAdmin || userPermissions.includes('returns.view') || userPermissions.includes('analytics.view') || userPermissions.includes('*') || userPermissions.includes('all');
      if (!hasViewPerm) {
        return res.status(403).json({ error: 'غير مصرح لك بعرض تحليلات المرتجعات', code: 'FORBIDDEN', requiredPermission: 'returns.view' });
      }
      const range = req.query.range as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const analytics = db.getReturnsAnalytics({ range, startDate, endDate });
      res.json({
        success: true,
        analytics
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل تحليلات الإرجاع والاسترداد', message: err.message });
    }
  });

  // ==========================================
  // 🔄 ADMIN RETURN REQUESTS MANAGEMENT API
  // ==========================================

  // Admin GET List All Return Requests (with filters & pagination)
  app.get('/api/admin/returns', requireAdmin, (req: any, res) => {
    try {
      // Permission check: allow returns.view OR orders.view
      const userPermissions = req.adminPermissions || [];
      const isSuperAdmin = req.admin?.roleId === 'role-super-admin' || req.admin?.email === (db.getAdmin()?.email);
      const hasViewPerm = isSuperAdmin || userPermissions.includes('returns.view') || userPermissions.includes('orders.view') || userPermissions.includes('*') || userPermissions.includes('all');
      if (!hasViewPerm) {
        return res.status(403).json({ error: 'غير مصرح لك بعرض طلبات الإرجاع', code: 'FORBIDDEN', requiredPermission: 'returns.view' });
      }

      const allReturns = db.getReturnRequests();
      const { status, refundStatus, orderId, customerId, customer, dateFrom, dateTo, search, page, limit } = req.query;

      let filtered = [...allReturns];

      // Filter by return status
      if (status && typeof status === 'string' && status !== 'all') {
        filtered = filtered.filter(r => r.status === status);
      }

      // Filter by refund status
      if (refundStatus && typeof refundStatus === 'string' && refundStatus !== 'all') {
        filtered = filtered.filter(r => r.refundStatus === refundStatus);
      }

      // Filter by order ID
      if (orderId && typeof orderId === 'string' && orderId.trim()) {
        const cleanOrderId = orderId.trim().toLowerCase();
        filtered = filtered.filter(r => 
          r.orderId.toLowerCase().includes(cleanOrderId) ||
          (r.orderInvoiceNumber && r.orderInvoiceNumber.toLowerCase().includes(cleanOrderId))
        );
      }

      // Filter by customer (ID, name, or phone)
      if (customerId && typeof customerId === 'string' && customerId.trim()) {
        filtered = filtered.filter(r => r.customerId === customerId.trim());
      }
      if (customer && typeof customer === 'string' && customer.trim()) {
        const cleanCust = customer.trim().toLowerCase();
        filtered = filtered.filter(r => 
          (r.customerName && r.customerName.toLowerCase().includes(cleanCust)) ||
          (r.customerPhone && r.customerPhone.includes(cleanCust)) ||
          (r.customerEmail && r.customerEmail.toLowerCase().includes(cleanCust))
        );
      }

      // Filter by date range
      if (dateFrom && typeof dateFrom === 'string' && dateFrom.trim()) {
        const fromTime = new Date(dateFrom).getTime();
        if (!isNaN(fromTime)) {
          filtered = filtered.filter(r => new Date(r.createdAt).getTime() >= fromTime);
        }
      }
      if (dateTo && typeof dateTo === 'string' && dateTo.trim()) {
        const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
        if (!isNaN(toTime)) {
          filtered = filtered.filter(r => new Date(r.createdAt).getTime() <= toTime);
        }
      }

      // Search term filter (matches return ID, order ID, customer name, phone, email, or product title)
      if (search && typeof search === 'string' && search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(r => 
          r.id.toLowerCase().includes(q) ||
          r.orderId.toLowerCase().includes(q) ||
          (r.orderInvoiceNumber && r.orderInvoiceNumber.toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          (r.customerPhone && r.customerPhone.includes(q)) ||
          (r.customerEmail && r.customerEmail.toLowerCase().includes(q)) ||
          (r.productTitle && r.productTitle.toLowerCase().includes(q)) ||
          (r.variantSku && r.variantSku.toLowerCase().includes(q))
        );
      }

      // Sort by newest created first
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Compute KPI Metrics for Admin Header Cards
      const kpis = {
        totalCount: allReturns.length,
        pendingCount: allReturns.filter(r => r.status === 'pending').length,
        approvedCount: allReturns.filter(r => r.status === 'approved' || r.status === 'pickup_pending' || r.status === 'received').length,
        completedCount: allReturns.filter(r => r.status === 'completed').length,
        rejectedCount: allReturns.filter(r => r.status === 'rejected' || r.status === 'cancelled').length,
        totalRefundedAmount: allReturns
          .filter(r => r.status === 'completed' || r.refundStatus === 'processed')
          .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0)
      };

      // Pagination
      const pageNum = Math.max(1, parseInt(String(page || '1'), 10));
      const pageSize = Math.max(1, Math.min(100, parseInt(String(limit || '20'), 10)));
      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / pageSize) || 1;
      const startIndex = (pageNum - 1) * pageSize;
      const paginatedReturns = filtered.slice(startIndex, startIndex + pageSize);

      res.json({
        success: true,
        returns: paginatedReturns,
        pagination: {
          page: pageNum,
          limit: pageSize,
          totalItems,
          totalPages
        },
        kpis
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب قائمة طلبات الإرجاع', message: err.message });
    }
  });

  // Admin GET Single Return Request Details
  app.get('/api/admin/returns/:id', requireAdmin, (req: any, res) => {
    try {
      const userPermissions = req.adminPermissions || [];
      const isSuperAdmin = req.admin?.roleId === 'role-super-admin' || req.admin?.email === (db.getAdmin()?.email);
      const hasViewPerm = isSuperAdmin || userPermissions.includes('returns.view') || userPermissions.includes('orders.view') || userPermissions.includes('*') || userPermissions.includes('all');
      if (!hasViewPerm) {
        return res.status(403).json({ error: 'غير مصرح لك بعرض تفاصيل طلب الإرجاع', code: 'FORBIDDEN', requiredPermission: 'returns.view' });
      }

      const returnReq = db.getReturnRequestById(req.params.id);
      if (!returnReq) {
        return res.status(404).json({ error: 'طلب الإرجاع غير موجود' });
      }

      // Enrich with order and product details
      const order = db.getOrderById(returnReq.orderId);
      const product = db.getProductById(returnReq.productId);

      res.json({
        success: true,
        returnRequest: returnReq,
        order: order || null,
        product: product || null
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب تفاصيل طلب الإرجاع', message: err.message });
    }
  });

  // Admin PUT Update Return Request Status & Refund Status & Restock
  app.put('/api/admin/returns/:id/status', requireAdmin, (req: any, res) => {
    try {
      const userPermissions = req.adminPermissions || [];
      const isSuperAdmin = req.admin?.roleId === 'role-super-admin' || req.admin?.email === (db.getAdmin()?.email);
      const hasManagePerm = isSuperAdmin || userPermissions.includes('returns.manage') || userPermissions.includes('orders.edit') || userPermissions.includes('*') || userPermissions.includes('all');
      if (!hasManagePerm) {
        return res.status(403).json({ error: 'غير مصرح لك بإدارة حالة طلبات الإرجاع', code: 'FORBIDDEN', requiredPermission: 'returns.manage' });
      }

      const returnReq = db.getReturnRequestById(req.params.id);
      if (!returnReq) {
        return res.status(404).json({ error: 'طلب الإرجاع غير موجود' });
      }

      const {
        status,
        adminNote,
        refundStatus,
        refundAmount,
        refundMethod,
        refundReference,
        restockable
      } = req.body;

      const validStatuses: ReturnStatus[] = ['pending', 'approved', 'rejected', 'pickup_pending', 'received', 'completed', 'cancelled'];
      if (status && !validStatuses.includes(status as ReturnStatus)) {
        return res.status(400).json({ error: 'حالة طلب الإرجاع غير صالحة' });
      }

      const validRefundStatuses: RefundStatus[] = ['pending', 'approved', 'processed', 'rejected'];
      if (refundStatus && !validRefundStatuses.includes(refundStatus as RefundStatus)) {
        return res.status(400).json({ error: 'حالة استرداد الأموال غير صالحة' });
      }

      const newStatus = (status as ReturnStatus) || returnReq.status;
      let newRefundStatus = (refundStatus as RefundStatus) || returnReq.refundStatus;

      // Rejection Validation: Admin note is mandatory when rejecting
      if (newStatus === 'rejected' && (!adminNote || !adminNote.trim())) {
        return res.status(400).json({ error: 'يجب كتابة سبب الرفض في الملاحظات الإدارية عند رفض طلب الإرجاع' });
      }

      const updates: Partial<ReturnRequest> = {};
      const now = new Date().toISOString();
      const adminActor = req.admin?.name || req.admin?.email || 'المدير';

      if (adminNote !== undefined) {
        updates.adminNote = sanitizeText(adminNote);
      }

      if (refundAmount !== undefined && !isNaN(Number(refundAmount))) {
        updates.refundAmount = Math.max(0, Number(refundAmount));
      }

      if (refundMethod !== undefined) {
        updates.refundMethod = refundMethod;
      }

      if (refundReference !== undefined) {
        updates.refundReference = sanitizeText(refundReference);
      }

      // Automatically sync refundStatus based on status transitions if not explicitly passed
      if (!refundStatus) {
        if (newStatus === 'approved' && returnReq.refundStatus === 'pending') {
          newRefundStatus = 'approved';
        } else if (newStatus === 'completed' && returnReq.refundStatus !== 'processed') {
          newRefundStatus = 'processed';
        } else if ((newStatus === 'rejected' || newStatus === 'cancelled') && returnReq.refundStatus === 'pending') {
          newRefundStatus = 'rejected';
        }
      }

      updates.status = newStatus;
      updates.refundStatus = newRefundStatus;
      updates.reviewedAt = now;
      updates.reviewedBy = adminActor;

      // Status transition logic
      if (newStatus === 'received' && !returnReq.receivedAt) {
        updates.receivedAt = now;
      }

      if (newRefundStatus === 'processed' && !returnReq.refundedAt) {
        updates.refundedAt = now;
      }

      // Restock Logic: Determine restock behavior
      // When completing, if restockable is true (default true) and not already restocked
      const shouldRestock = (restockable === true || (restockable === undefined && newStatus === 'completed')) && !returnReq.restocked;

      if (shouldRestock) {
        updates.restocked = true;
        updates.restockQuantity = returnReq.quantity;

        // Add back to inventory safely
        db.adjustStock({
          productId: returnReq.productId,
          variantId: returnReq.variantId,
          type: 'in_return',
          quantity: returnReq.quantity,
          referenceId: returnReq.id,
          reason: `إرجاع مكتمل للطلب رقم ${returnReq.orderId}`,
          createdBy: adminActor
        });
      } else if (restockable === false) {
        updates.restocked = false;
      }

      // Build history timeline entry
      let actionLabel = 'تحديث الطلب';
      if (newStatus !== returnReq.status) {
        const statusMap: Record<ReturnStatus, string> = {
          pending: 'قيد المراجعة',
          approved: 'الموافقة على الإرجاع',
          pickup_pending: 'بانتظار استلام المندوب',
          received: 'تم استلام المنتج في المخزن',
          completed: 'اكتمال الإرجاع',
          rejected: 'رفض طلب الإرجاع',
          cancelled: 'إلغاء الطلب'
        };
        actionLabel = statusMap[newStatus] || 'تحديث الحالة';
      } else if (newRefundStatus !== returnReq.refundStatus) {
        actionLabel = `تحديث حالة الاسترداد إلى: ${newRefundStatus}`;
      }

      const existingHistory = Array.isArray(returnReq.history) ? [...returnReq.history] : [];
      const historyItem = {
        date: now,
        action: actionLabel,
        actor: adminActor,
        note: updates.adminNote || returnReq.adminNote || '',
        status: newStatus,
        refundStatus: newRefundStatus,
        restocked: updates.restocked ?? returnReq.restocked,
        refundAmount: updates.refundAmount ?? returnReq.refundAmount
      };

      updates.history = [...existingHistory, historyItem];

      const updated = db.updateReturnRequest(returnReq.id, updates);

      logAudit(
        req,
        'UpdateReturnStatus',
        'ReturnRequest',
        returnReq.id,
        `تحديث طلب الإرجاع ${returnReq.id}: الحالة (${returnReq.status} -> ${newStatus})، الاسترداد (${returnReq.refundStatus} -> ${newRefundStatus})${shouldRestock ? ' - تم إعادة الكمية للمخزون' : ''}`
      );

      res.json({
        success: true,
        message: 'تم تحديث حالة طلب الإرجاع بنجاح',
        returnRequest: updated
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحديث حالة طلب الإرجاع', message: err.message });
    }
  });

  // ==========================================
  // 🏷️ PROMOTIONAL CAMPAIGNS ENDPOINTS
  // ==========================================

  // Public: Get active promotional campaigns within valid date range
  app.get('/api/campaigns/active', (req, res) => {
    try {
      const campaigns = db.getActiveCampaigns();
      res.json({ success: true, campaigns });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب الحملات الترويجية النشطة', message: err.message });
    }
  });

  // Public: Evaluate active campaigns and pricing for a cart context
  app.post('/api/campaigns/evaluate', (req, res) => {
    try {
      const { items, couponCode, governorate } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.json({
          success: true,
          subtotal: 0,
          shippingCost: 0,
          taxAmount: 0,
          appliedCampaign: null,
          campaignDiscount: 0,
          appliedCoupon: null,
          couponDiscount: 0,
          finalDiscountAmount: 0,
          total: 0
        });
      }

      const settings = db.getSettings();
      const normalizedItems: any[] = [];

      for (const item of items) {
        if (!item || !item.productId) continue;
        const product = db.getProductById(item.productId);
        if (!product) continue;

        let variant = undefined;
        let variantId = item.variantId;
        if (variantId && product.variants && Array.isArray(product.variants)) {
          variant = product.variants.find(v => v.id === variantId);
        }

        const authoritativePrice = variant ? variant.price : (product.discountPrice || product.price);
        const reqQty = Math.max(1, Number(item.quantity) || 1);

        normalizedItems.push({
          productId: product.id,
          productTitle: product.title,
          quantity: reqQty,
          price: authoritativePrice
        });
      }

      const subtotal = normalizedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const taxAmount = Number((subtotal * settings.taxRate).toFixed(2));

      // Calculate dynamic shipping cost
      const provinces = db.getShippingProvinces();
      const selectedProvince = governorate ? provinces.find(p => p.name === governorate) : undefined;
      let shippingCost = settings.shippingFlatRate;

      if (selectedProvince && selectedProvince.isActive) {
        shippingCost = selectedProvince.price;
        if (selectedProvince.freeShippingThreshold && subtotal >= selectedProvince.freeShippingThreshold) {
          shippingCost = 0;
        }
      }

      const campaignEval = db.evaluateBestCampaign(normalizedItems, subtotal, shippingCost);
      const bestCampaign = campaignEval.bestCampaign;
      const campaignDiscountAmount = campaignEval.campaignDiscount;

      let couponDiscountAmount = 0;
      let appliedCoupon = null;

      if (couponCode) {
        const coupons = db.getCoupons();
        const coupon = coupons.find(c => c.code.toUpperCase() === String(couponCode).toUpperCase());
        if (coupon && coupon.isActive) {
          let isValid = true;
          if (coupon.expiryDate && new Date().toISOString().split('T')[0] > coupon.expiryDate) isValid = false;
          if (typeof coupon.usageLimit === 'number' && coupon.usedCount >= coupon.usageLimit) isValid = false;
          if (coupon.minOrderValue && subtotal < coupon.minOrderValue) isValid = false;

          if (isValid) {
            const rawDiscountValue = coupon.value !== undefined ? coupon.value : (coupon.discountValue !== undefined ? coupon.discountValue : 0);
            if (coupon.discountType === 'percentage') {
              couponDiscountAmount = (subtotal * rawDiscountValue) / 100;
              if (coupon.maxDiscountAmount && couponDiscountAmount > coupon.maxDiscountAmount) {
                couponDiscountAmount = coupon.maxDiscountAmount;
              }
              couponDiscountAmount = Math.min(couponDiscountAmount, subtotal);
            } else if (coupon.discountType === 'fixed') {
              couponDiscountAmount = Math.min(rawDiscountValue, subtotal);
            } else if (coupon.discountType === 'free_shipping') {
              couponDiscountAmount = shippingCost;
            }
            couponDiscountAmount = Math.max(0, Number(couponDiscountAmount.toFixed(2)));
            appliedCoupon = coupon;
          }
        }
      }

      let finalDiscountAmount = 0;
      let finalAppliedCampaign = null;
      let finalAppliedCoupon = null;

      if (campaignDiscountAmount > couponDiscountAmount) {
        finalDiscountAmount = campaignDiscountAmount;
        finalAppliedCampaign = bestCampaign;
      } else if (couponDiscountAmount > 0) {
        finalDiscountAmount = couponDiscountAmount;
        finalAppliedCoupon = appliedCoupon;
      }

      const total = Number(Math.max(0, subtotal + taxAmount + shippingCost - finalDiscountAmount).toFixed(2));

      res.json({
        success: true,
        subtotal: Number(subtotal.toFixed(2)),
        shippingCost: Number(shippingCost.toFixed(2)),
        taxAmount,
        appliedCampaign: finalAppliedCampaign ? {
          id: finalAppliedCampaign.id,
          name: finalAppliedCampaign.name,
          type: finalAppliedCampaign.type,
          value: finalAppliedCampaign.value
        } : null,
        campaignDiscount: campaignDiscountAmount,
        appliedCoupon: finalAppliedCoupon ? {
          code: finalAppliedCoupon.code,
          discountType: finalAppliedCoupon.discountType || 'fixed',
          value: finalAppliedCoupon.value ?? finalAppliedCoupon.discountValue ?? 0,
          discountValue: finalAppliedCoupon.value ?? finalAppliedCoupon.discountValue ?? 0
        } : null,
        couponDiscount: couponDiscountAmount,
        finalDiscountAmount,
        total
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل احتساب أسعار العروض الترويجية', message: err.message });
    }
  });

  // Admin: Get all promotional campaigns
  app.get('/api/admin/campaigns', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const campaigns = db.getCampaigns();
      res.json({ success: true, campaigns });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل الحملات الترويجية', message: err.message });
    }
  });

  // Admin: Create new promotional campaign
  app.post('/api/admin/campaigns', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const {
        name,
        type,
        value,
        startAt,
        endAt,
        active,
        productIds,
        categoryIds,
        minimumOrderValue,
        maximumDiscountAmount
      } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'اسم الحملة الترويجية مطلوب' });
      }

      if (!['percentage', 'fixed', 'free_shipping'].includes(type)) {
        return res.status(400).json({ error: 'نوع الحملة غير صالحة. الأنواع المتاحة: percentage, fixed, free_shipping' });
      }

      const vVal = validateBackendNumeric(value, 'non_negative_decimal', { required: true, fieldNameArabic: 'قيمة الخصم للحملة' });
      if (!vVal.isValid) {
        return res.status(400).json({ error: vVal.error });
      }
      const numValue = vVal.value;

      if (type === 'percentage' && numValue > 100) {
        return res.status(400).json({ error: 'نسبة الخصم يجب أن تكون بين 0 و 100' });
      }

      if (!startAt || !endAt) {
        return res.status(400).json({ error: 'تاريخ بداية ونهاية الحملة مطلوبان' });
      }

      const startTime = new Date(startAt).getTime();
      const endTime = new Date(endAt).getTime();

      if (isNaN(startTime) || isNaN(endTime)) {
        return res.status(400).json({ error: 'صيغة تاريخ البداية أو النهاية غير صالحة' });
      }

      if (endTime <= startTime) {
        return res.status(400).json({ error: 'تاريخ نهاية الحملة يجب أن يكون بعد تاريخ البداية' });
      }

      let parsedMinOrder: number | undefined = undefined;
      if (minimumOrderValue !== undefined && minimumOrderValue !== null && minimumOrderValue !== '') {
        const vMin = validateBackendNumeric(minimumOrderValue, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى لقيمة الطلب' });
        if (!vMin.isValid) {
          return res.status(400).json({ error: vMin.error });
        }
        parsedMinOrder = vMin.value;
      }

      let parsedMaxDiscount: number | undefined = undefined;
      if (maximumDiscountAmount !== undefined && maximumDiscountAmount !== null && maximumDiscountAmount !== '') {
        const vMax = validateBackendNumeric(maximumDiscountAmount, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى لمبلغ الخصم' });
        if (!vMax.isValid) {
          return res.status(400).json({ error: vMax.error });
        }
        parsedMaxDiscount = vMax.value;
      }

      const campaign = db.createCampaign({
        name: name.trim(),
        type,
        value: numValue,
        startAt,
        endAt,
        active: active !== undefined ? Boolean(active) : true,
        productIds: Array.isArray(productIds) ? productIds : [],
        categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
        minimumOrderValue: parsedMinOrder,
        maximumDiscountAmount: parsedMaxDiscount
      });

      db.logAction('Admin', 'إنشاء حملة ترويجية', `تم إنشاء الحملة الترويجية "${campaign.name}" بنجاح`);
      logAudit(req, 'Campaign Changes', 'Campaign', campaign.id, `إنشاء حملة ترويجية جديدة: ${campaign.name}`);

      res.status(201).json({ success: true, campaign });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إنشاء الحملة الترويجية', message: err.message });
    }
  });

  // Admin: Update existing promotional campaign
  app.patch('/api/admin/campaigns/:id', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const existing = db.getCampaignById(id);
      if (!existing) {
        return res.status(404).json({ error: 'الحملة الترويجية غير موجودة' });
      }

      const {
        name,
        type,
        value,
        startAt,
        endAt,
        active,
        productIds,
        categoryIds,
        minimumOrderValue,
        maximumDiscountAmount
      } = req.body;

      const mergedName = name !== undefined ? String(name).trim() : existing.name;
      if (!mergedName) {
        return res.status(400).json({ error: 'اسم الحملة الترويجية لا يمكن أن يكون فارغاً' });
      }

      const mergedType = type !== undefined ? type : existing.type;
      if (!['percentage', 'fixed', 'free_shipping'].includes(mergedType)) {
        return res.status(400).json({ error: 'نوع الحملة غير صالحة. الأنواع المتاحة: percentage, fixed, free_shipping' });
      }

      let mergedValue = existing.value;
      if (value !== undefined) {
        const vVal = validateBackendNumeric(value, 'non_negative_decimal', { fieldNameArabic: 'قيمة الخصم للحملة' });
        if (!vVal.isValid) {
          return res.status(400).json({ error: vVal.error });
        }
        mergedValue = vVal.value;
      }

      if (mergedType === 'percentage' && mergedValue > 100) {
        return res.status(400).json({ error: 'نسبة الخصم يجب أن تكون بين 0 و 100' });
      }

      const mergedStartAt = startAt !== undefined ? startAt : existing.startAt;
      const mergedEndAt = endAt !== undefined ? endAt : existing.endAt;

      const startTime = new Date(mergedStartAt).getTime();
      const endTime = new Date(mergedEndAt).getTime();

      if (isNaN(startTime) || isNaN(endTime)) {
        return res.status(400).json({ error: 'صيغة تاريخ البداية أو النهاية غير صالحة' });
      }

      if (endTime <= startTime) {
        return res.status(400).json({ error: 'تاريخ نهاية الحملة يجب أن يكون بعد تاريخ البداية' });
      }

      let mergedMinOrder = existing.minimumOrderValue;
      if (minimumOrderValue !== undefined) {
        if (minimumOrderValue === null || minimumOrderValue === '') {
          mergedMinOrder = undefined;
        } else {
          const vMin = validateBackendNumeric(minimumOrderValue, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى لقيمة الطلب' });
          if (!vMin.isValid) {
            return res.status(400).json({ error: vMin.error });
          }
          mergedMinOrder = vMin.value;
        }
      }

      let mergedMaxDiscount = existing.maximumDiscountAmount;
      if (maximumDiscountAmount !== undefined) {
        if (maximumDiscountAmount === null || maximumDiscountAmount === '') {
          mergedMaxDiscount = undefined;
        } else {
          const vMax = validateBackendNumeric(maximumDiscountAmount, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى لمبلغ الخصم' });
          if (!vMax.isValid) {
            return res.status(400).json({ error: vMax.error });
          }
          mergedMaxDiscount = vMax.value;
        }
      }

      const updated = db.updateCampaign(id, {
        name: mergedName,
        type: mergedType,
        value: mergedValue,
        startAt: mergedStartAt,
        endAt: mergedEndAt,
        active: active !== undefined ? Boolean(active) : existing.active,
        productIds: productIds !== undefined ? (Array.isArray(productIds) ? productIds : []) : existing.productIds,
        categoryIds: categoryIds !== undefined ? (Array.isArray(categoryIds) ? categoryIds : []) : existing.categoryIds,
        minimumOrderValue: mergedMinOrder,
        maximumDiscountAmount: mergedMaxDiscount
      });

      if (!updated) {
        return res.status(500).json({ error: 'فشل تحديث الحملة الترويجية' });
      }

      db.logAction('Admin', 'تعديل حملة ترويجية', `تم تعديل الحملة الترويجية "${updated.name}"`);
      logAudit(req, 'Campaign Changes', 'Campaign', id, `تعديل حملة ترويجية: ${updated.name}`);

      res.json({ success: true, campaign: updated });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل الحملة الترويجية', message: err.message });
    }
  });

  // Admin: Delete promotional campaign
  app.delete('/api/admin/campaigns/:id', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const campaign = db.getCampaignById(id);
      if (!campaign) {
        return res.status(404).json({ error: 'الحملة الترويجية غير موجودة' });
      }

      const success = db.deleteCampaign(id);
      if (!success) {
        return res.status(500).json({ error: 'فشل حذف الحملة الترويجية' });
      }

      db.logAction('Admin', 'حذف حملة ترويجية', `تم حذف الحملة الترويجية "${campaign.name}"`);
      logAudit(req, 'Campaign Changes', 'Campaign', id, `حذف حملة ترويجية: ${campaign.name}`);

      res.json({ success: true, message: 'تم حذف الحملة الترويجية بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف الحملة الترويجية', message: err.message });
    }
  });

  // Get Admin stats & analytics dashboard reports
  app.get('/api/admin/dashboard', requireAdmin, requirePermission('analytics.view'), (req, res) => {
    try {
      const orders = db.getOrders();
      const products = db.getProducts();
      const logs = db.getLogs();
      const notifications = db.getNotifications();
      const returns = db.getReturnRequests();

      // Basic totals
      const grossSales = orders
        .filter(o => o.status !== 'Cancelled')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      // Refunded amount: ONLY completed returns or refundStatus === 'processed'
      const totalRefunds = returns
        .filter(r => r.status === 'completed' || r.refundStatus === 'processed')
        .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);

      // Pending refund amount: active requests awaiting decision/fulfillment
      const pendingRefundAmount = returns
        .filter(r => r.status !== 'rejected' && r.status !== 'cancelled' && r.status !== 'completed' && r.refundStatus !== 'processed' && r.refundStatus !== 'rejected')
        .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);

      const netSales = Math.max(0, grossSales - totalRefunds);
      const totalReturnsCount = returns.length;
      const pendingReturnsCount = returns.filter(r => r.status === 'pending' || r.status === 'pickup_pending' || r.status === 'received').length;

      const totalRevenue = grossSales;
      const pendingOrdersCount = orders.filter(o => o.status === 'Pending').length;
      const lowStockProductsCount = products.filter(p => p.stock <= 5).length;
      const totalProductsCount = products.length;

      // Status breakdown
      const statusBreakdown = orders.reduce((acc: any, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {
        Pending: 0, Confirmed: 0, Preparing: 0, Shipped: 0, Delivered: 0, Cancelled: 0, Returned: 0
      });

      // Chart data: daily/weekly sales simulation based on loaded orders
      const dailySales = orders
        .filter(o => o.status !== 'Cancelled')
        .reduce((acc: any[], o) => {
          const dateStr = o.date.split('T')[0];
          const existing = acc.find(x => x.date === dateStr);
          if (existing) {
            existing.sales += o.total;
            existing.count += 1;
          } else {
            acc.push({ date: dateStr, sales: o.total, count: 1 });
          }
          return acc;
        }, [])
        .sort((a, b) => a.date.localeCompare(b.date));

      res.json({
        stats: {
          totalRevenue: Math.round(totalRevenue),
          grossSales: Math.round(grossSales),
          totalRefunds: Math.round(totalRefunds),
          netSales: Math.round(netSales),
          pendingRefundAmount: Math.round(pendingRefundAmount),
          totalReturnsCount,
          pendingReturnsCount,
          ordersCount: orders.length,
          pendingOrdersCount,
          lowStockProductsCount,
          totalProductsCount
        },
        returnsOverview: {
          totalReturns: totalReturnsCount,
          pendingReturns: returns.filter(r => r.status === 'pending').length,
          approvedReturns: returns.filter(r => r.status === 'approved').length,
          pickupPendingReturns: returns.filter(r => r.status === 'pickup_pending').length,
          receivedReturns: returns.filter(r => r.status === 'received').length,
          completedReturns: returns.filter(r => r.status === 'completed').length,
          rejectedReturns: returns.filter(r => r.status === 'rejected').length,
          cancelledReturns: returns.filter(r => r.status === 'cancelled').length,
          totalRefundedAmount: Math.round(totalRefunds),
          pendingRefundAmount: Math.round(pendingRefundAmount)
        },
        statusBreakdown,
        dailySales,
        recentLogs: logs.slice(0, 5),
        unreadNotificationsCount: notifications.filter(n => !n.isRead).length,
        recentNotifications: notifications.slice(0, 6)
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to compile dashboard reports' });
    }
  });

  // ==========================================
  // 📦 INVENTORY PRO API ENDPOINTS
  // ==========================================

  // GET /api/admin/inventory/summary
  app.get('/api/admin/inventory/summary', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const products = db.getProducts();
      let totalProducts = products.length;
      let totalVariants = 0;
      let totalStockItems = 0;
      let totalStockValue = 0;
      let totalCostValue = 0;
      let outOfStockCount = 0;
      let lowStockCount = 0;
      let healthyStockCount = 0;

      for (const p of products) {
        const pThreshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 5;
        const pPrice = p.discountPrice || p.price || 0;
        const pCost = p.costPrice || 0;

        if (p.variants && p.variants.length > 0) {
          totalVariants += p.variants.length;
          for (const v of p.variants) {
            const vStock = typeof v.stock === 'number' ? v.stock : 0;
            const vPrice = v.price || pPrice;
            const vCost = v.costPrice || pCost;
            const vThreshold = typeof v.lowStockThreshold === 'number' ? v.lowStockThreshold : pThreshold;

            totalStockItems += vStock;
            totalStockValue += vPrice * vStock;
            totalCostValue += vCost * vStock;

            if (vStock === 0) {
              outOfStockCount++;
            } else if (vStock <= vThreshold) {
              lowStockCount++;
            } else {
              healthyStockCount++;
            }
          }
        } else {
          const pStock = typeof p.stock === 'number' ? p.stock : 0;
          totalStockItems += pStock;
          totalStockValue += pPrice * pStock;
          totalCostValue += pCost * pStock;

          if (pStock === 0) {
            outOfStockCount++;
          } else if (pStock <= pThreshold) {
            lowStockCount++;
          } else {
            healthyStockCount++;
          }
        }
      }

      res.json({
        totalProducts,
        totalVariants,
        totalStockItems,
        totalStockValue: Math.round(totalStockValue * 100) / 100,
        totalCostValue: Math.round(totalCostValue * 100) / 100,
        totalValueSell: Math.round(totalStockValue * 100) / 100,
        totalValueCost: Math.round(totalCostValue * 100) / 100,
        outOfStockCount,
        lowStockCount,
        healthyStockCount
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل ملخص المخزون', message: err.message });
    }
  });

  // GET /api/admin/inventory/movements
  app.get('/api/admin/inventory/movements', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const { productId, variantId, type, search, page, limit } = req.query;
      let movements = db.getStockMovements();

      if (productId) {
        movements = movements.filter(m => m.productId === productId);
      }
      if (variantId) {
        movements = movements.filter(m => m.variantId === variantId);
      }
      if (type) {
        movements = movements.filter(m => m.type === type || (m as any).movementType === type);
      }
      if (search) {
        const q = (search as string).toLowerCase().trim();
        movements = movements.filter(m =>
          (m.productTitle && m.productTitle.toLowerCase().includes(q)) ||
          (m.productName && m.productName.toLowerCase().includes(q)) ||
          (m.variantInfo && m.variantInfo.toLowerCase().includes(q)) ||
          (m.variantSku && m.variantSku.toLowerCase().includes(q)) ||
          (m.referenceId && m.referenceId.toLowerCase().includes(q)) ||
          (m.reason && m.reason.toLowerCase().includes(q)) ||
          (m.createdBy && m.createdBy.toLowerCase().includes(q)) ||
          (m.performedBy && m.performedBy.toLowerCase().includes(q)) ||
          (m.performedByName && m.performedByName.toLowerCase().includes(q))
        );
      }

      const p = Math.max(1, Number(page) || 1);
      const l = Math.min(100, Math.max(1, Number(limit) || 20));
      const total = movements.length;
      const totalPages = Math.ceil(total / l) || 1;
      const startIndex = (p - 1) * l;
      const paginatedMovements = movements.slice(startIndex, startIndex + l);

      res.json({
        success: true,
        data: paginatedMovements,
        movements: paginatedMovements,
        pagination: {
          total,
          page: p,
          limit: l,
          totalPages
        },
        meta: {
          total,
          page: p,
          limit: l,
          totalPages
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل سجل حركة المخزون', message: err.message });
    }
  });

  // GET /api/admin/inventory/low-stock
  app.get('/api/admin/inventory/low-stock', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const { search, status } = req.query;
      const products = db.getProducts();
      const items: any[] = [];

      for (const p of products) {
        const pThreshold = typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 5;
        const pPrice = p.discountPrice || p.price || 0;

        if (p.variants && p.variants.length > 0) {
          for (const v of p.variants) {
            const vStock = typeof v.stock === 'number' ? v.stock : 0;
            const vThreshold = typeof v.lowStockThreshold === 'number' ? v.lowStockThreshold : pThreshold;

            if (vStock <= vThreshold) {
              const itemStatus = vStock === 0 ? 'out_of_stock' : 'low_stock';
              const parts = [v.size, v.color, v.capacity].filter(Boolean);
              const variantInfo = parts.join(' / ') || `موديل #${v.id}`;

              items.push({
                productId: p.id,
                productTitle: p.title,
                productMainImage: p.mainImage || p.images?.[0],
                category: p.category,
                sku: v.sku || p.sku,
                variantId: v.id,
                variantInfo,
                stock: vStock,
                lowStockThreshold: vThreshold,
                status: itemStatus,
                costPrice: v.costPrice || p.costPrice || 0,
                price: v.price || pPrice,
                location: v.location || p.location || ''
              });
            }
          }
        } else {
          const pStock = typeof p.stock === 'number' ? p.stock : 0;
          if (pStock <= pThreshold) {
            const itemStatus = pStock === 0 ? 'out_of_stock' : 'low_stock';
            items.push({
              productId: p.id,
              productTitle: p.title,
              productMainImage: p.mainImage || p.images?.[0],
              category: p.category,
              sku: p.sku,
              stock: pStock,
              lowStockThreshold: pThreshold,
              status: itemStatus,
              costPrice: p.costPrice || 0,
              price: pPrice,
              location: p.location || ''
            });
          }
        }
      }

      let filtered = items;
      if (status && status !== 'all') {
        filtered = filtered.filter(i => i.status === status);
      }
      if (search) {
        const q = (search as string).toLowerCase().trim();
        filtered = filtered.filter(i =>
          i.productTitle.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          (i.variantInfo && i.variantInfo.toLowerCase().includes(q)) ||
          i.category.toLowerCase().includes(q)
        );
      }

      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل قائمة المنتجات منخفضة المخزون', message: err.message });
    }
  });

  // POST /api/admin/inventory/adjust
  app.post('/api/admin/inventory/adjust', requireAdmin, requirePermission('inventory.manage'), (req: any, res) => {
    try {
      const { productId, variantId, type, quantity, referenceId, referenceType, reason, note } = req.body;

      if (!productId) {
        return res.status(400).json({ error: 'معرف المنتج (productId) مطلوب' });
      }

      const validTypes = ['in_purchase', 'in_adjustment', 'in_return', 'out_sale', 'out_damage', 'out_damaged', 'out_adjustment', 'manual_adjustment'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({ error: 'نوع تعديل المخزون غير صالح' });
      }

      const vQty = validateBackendNumeric(quantity, 'positive_integer', { required: true, min: 1, fieldNameArabic: 'كمية تعديل المخزون' });
      if (!vQty.isValid) {
        return res.status(400).json({ error: vQty.error });
      }
      const numQty = vQty.value;

      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ error: 'سبب تعديل المخزون مطلوب' });
      }

      const adminEmail = req.admin?.email || 'admin@store.com';
      const adminName = req.admin?.name || req.admin?.email || 'مسؤول النظام';
      const adminId = req.admin?.id || 'admin';

      const { product, movement } = db.adjustStock({
        productId,
        variantId,
        type,
        quantity: numQty,
        referenceId,
        referenceType,
        reason: reason.trim(),
        note: note ? String(note).trim() : reason.trim(),
        createdBy: adminName,
        adminId,
        adminName
      });

      db.logAction('Admin', 'تعديل مخزون', `تم تعديل مخزون المنتج ${product.title} بمقدار ${numQty} (${type})`);
      logAudit(req, 'Inventory Adjustments', 'Product', productId, `تعديل مخزون المنتج ${product.title} بمقدار ${numQty} (${type}) - السبب: ${reason}`);

      clearRouteCache('/api/products');
      clearRouteCache('/api/admin/inventory');

      res.json({
        success: true,
        message: 'تم تعديل المخزون وتوثيق حركة الجرد بنجاح',
        product,
        movement
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل تعديل المخزون' });
    }
  });

  // ==========================================
  // 🤝 SUPPLIERS MANAGEMENT API ENDPOINTS
  // ==========================================

  // GET /api/admin/suppliers
  app.get('/api/admin/suppliers', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const { search, status, page, limit } = req.query;
      const allSuppliers = db.getSuppliers({
        search: search ? String(search) : undefined,
        status: (status === 'active' || status === 'inactive') ? status : undefined
      });

      const totalSuppliersCount = (db.getSuppliers() || []).length;
      const activeSuppliersCount = (db.getSuppliers({ status: 'active' }) || []).length;
      const inactiveSuppliersCount = (db.getSuppliers({ status: 'inactive' }) || []).length;

      const p = Math.max(1, Number(page) || 1);
      const l = Math.min(100, Math.max(1, Number(limit) || 50));
      const totalFiltered = allSuppliers.length;
      const totalPages = Math.ceil(totalFiltered / l) || 1;
      const startIndex = (p - 1) * l;
      const paginatedSuppliers = allSuppliers.slice(startIndex, startIndex + l);

      res.json({
        suppliers: paginatedSuppliers,
        pagination: {
          total: totalFiltered,
          page: p,
          limit: l,
          totalPages
        },
        stats: {
          total: totalSuppliersCount,
          active: activeSuppliersCount,
          inactive: inactiveSuppliersCount
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل قائمة الموردين', message: err.message });
    }
  });

  // GET /api/admin/suppliers/:id
  app.get('/api/admin/suppliers/:id', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const { id } = req.params;
      const supplier = db.getSupplierById(id);
      if (!supplier) {
        return res.status(404).json({ error: 'المورد غير موجود' });
      }

      res.json({
        supplier,
        stats: {
          totalPurchaseOrders: 0,
          totalAmountSpent: 0,
          pendingDeliveries: 0
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل تفاصيل المورد', message: err.message });
    }
  });

  // POST /api/admin/suppliers
  app.post('/api/admin/suppliers', requireAdmin, requirePermission('inventory.manage'), (req, res) => {
    try {
      const { name, companyName, phone, email, address, taxNumber, notes, status } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'اسم مسئول الاتصال بالمورد مطلوب' });
      }

      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return res.status(400).json({ error: 'اسم الشركة أو المؤسسة مطلوب' });
      }

      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
      }

      if (email && typeof email === 'string' && email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
        }
      }

      const newSupplier = db.addSupplier({
        name: name.trim(),
        companyName: companyName.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : '',
        address: address ? address.trim() : '',
        taxNumber: taxNumber ? taxNumber.trim() : '',
        notes: notes ? notes.trim() : '',
        status: status === 'inactive' ? 'inactive' : 'active'
      });

      logAudit(req, 'Create', 'Supplier', newSupplier.id, `إضافة مورد جديد: ${newSupplier.companyName} (${newSupplier.name})`);

      res.status(201).json({
        success: true,
        message: 'تمت إضافة المورد بنجاح',
        supplier: newSupplier
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل إضافة المورد' });
    }
  });

  // PATCH /api/admin/suppliers/:id
  app.patch('/api/admin/suppliers/:id', requireAdmin, requirePermission('inventory.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const { name, companyName, phone, email, address, taxNumber, notes, status } = req.body;

      if (email && typeof email === 'string' && email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
        }
      }

      const updated = db.updateSupplier(id, {
        name,
        companyName,
        phone,
        email,
        address,
        taxNumber,
        notes,
        status
      });

      logAudit(req, 'Update', 'Supplier', id, `تحديث بيانات المورد: ${updated.companyName || id}`);

      res.json({
        success: true,
        message: 'تم تحديث بيانات المورد بنجاح',
        supplier: updated
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل تحديث المورد' });
    }
  });

  // DELETE /api/admin/suppliers/:id
  app.delete('/api/admin/suppliers/:id', requireAdmin, requirePermission('inventory.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const result = db.deleteSupplier(id);
      logAudit(req, 'Delete', 'Supplier', id, `حذف المورد ID: ${id}`);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل عملية حذف المورد' });
    }
  });

  // ==========================================
  // 🏷️ BARCODE MANAGEMENT API ENDPOINTS
  // ==========================================

  // GET /api/admin/generate-barcode
  app.get('/api/admin/generate-barcode', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const barcode = db.generateUniqueBarcode();
      res.json({ success: true, barcode });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل توليد الباركود', message: err.message });
    }
  });

  // GET /api/admin/barcode/:barcode
  app.get('/api/admin/barcode/:barcode', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const { barcode } = req.params;
      if (!barcode || !barcode.trim()) {
        return res.status(400).json({ error: 'يرجى تقديم رمز باركود صالح' });
      }

      const match = db.getProductByBarcode(barcode.trim());
      if (!match) {
        return res.status(404).json({ error: `لم يتم العثور على أي منتج أو موديل بالباركود (${barcode})` });
      }

      res.json({
        success: true,
        data: match
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل البحث عن الباركود', message: err.message });
    }
  });

  // ==========================================
  // 📱 QR CODE MANAGEMENT API ENDPOINTS
  // ==========================================

  // GET /api/admin/generate-qr
  app.get('/api/admin/generate-qr', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const productId = req.query.productId as string | undefined;
      const variantId = req.query.variantId as string | undefined;
      const qrCode = db.generateUniqueQrCode(productId, variantId);
      res.json({ success: true, qrCode });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل توليد رمز QR', message: err.message });
    }
  });

  // GET /api/admin/qr/:code
  app.get('/api/admin/qr/:code', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const { code } = req.params;
      if (!code || !code.trim()) {
        return res.status(400).json({ error: 'يرجى تقديم رمز QR صالح' });
      }

      const match = db.getProductByQrCode(code.trim());
      if (!match) {
        return res.status(404).json({ error: `لم يتم العثور على أي منتج أو موديل برمز الـ QR (${code})` });
      }

      res.json({
        success: true,
        data: match
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل البحث عن رمز الـ QR', message: err.message });
    }
  });

  // ==========================================
  // 📋 PURCHASE ORDERS MANAGEMENT API ENDPOINTS
  // ==========================================

  // GET /api/admin/purchase-orders
  app.get('/api/admin/purchase-orders', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const { search, supplierId, status, startDate, endDate, page, limit } = req.query;

      const allPOs = db.getPurchaseOrders({
        search: search ? String(search) : undefined,
        supplierId: supplierId ? String(supplierId) : undefined,
        status: status ? String(status) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined
      });

      const totalPOsCount = (db.getPurchaseOrders() || []).length;
      const draftCount = (db.getPurchaseOrders({ status: 'draft' }) || []).length;
      const orderedCount = (db.getPurchaseOrders({ status: 'ordered' }) || []).length;
      const partiallyReceivedCount = (db.getPurchaseOrders({ status: 'partially_received' }) || []).length;
      const receivedCount = (db.getPurchaseOrders({ status: 'received' }) || []).length;
      const cancelledCount = (db.getPurchaseOrders({ status: 'cancelled' }) || []).length;

      const totalValueCost = (db.getPurchaseOrders() || []).reduce((sum, po) => sum + (po.status !== 'cancelled' ? po.totalCost : 0), 0);

      const p = Math.max(1, Number(page) || 1);
      const l = Math.min(100, Math.max(1, Number(limit) || 50));
      const totalFiltered = allPOs.length;
      const totalPages = Math.ceil(totalFiltered / l) || 1;
      const startIndex = (p - 1) * l;
      const paginatedPOs = allPOs.slice(startIndex, startIndex + l);

      res.json({
        purchaseOrders: paginatedPOs,
        pagination: {
          total: totalFiltered,
          page: p,
          limit: l,
          totalPages
        },
        stats: {
          total: totalPOsCount,
          draft: draftCount,
          inTransit: orderedCount + partiallyReceivedCount,
          received: receivedCount,
          cancelled: cancelledCount,
          totalValueCost
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل قائمة أوامر الشراء', message: err.message });
    }
  });

  // GET /api/admin/purchase-orders/:id
  app.get('/api/admin/purchase-orders/:id', requireAdmin, requirePermission('inventory.view'), (req, res) => {
    try {
      const { id } = req.params;
      const po = db.getPurchaseOrderById(id);
      if (!po) {
        return res.status(404).json({ error: 'أمر الشراء غير موجود' });
      }

      const supplier = db.getSupplierById(po.supplierId);

      res.json({
        purchaseOrder: po,
        supplier
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل تفاصيل أمر الشراء', message: err.message });
    }
  });

  // POST /api/admin/purchase-orders
  app.post('/api/admin/purchase-orders', requireAdmin, requirePermission('inventory.manage'), (req, res) => {
    try {
      const userEmail = (req as any).admin?.email || 'admin@store.com';
      const newPO = db.addPurchaseOrder(req.body, userEmail);

      logAudit(req, 'Create', 'PurchaseOrder', newPO.id, `إنشاء أمر شراء جديد: ${newPO.poNumber}`);

      res.status(201).json({
        success: true,
        message: 'تم إنشاء أمر الشراء بنجاح',
        purchaseOrder: newPO
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل إنشاء أمر الشراء' });
    }
  });

  // PATCH /api/admin/purchase-orders/:id
  app.patch('/api/admin/purchase-orders/:id', requireAdmin, requirePermission('inventory.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const userEmail = (req as any).admin?.email || 'admin@store.com';
      const updated = db.updatePurchaseOrder(id, req.body, userEmail);

      logAudit(req, 'Update', 'PurchaseOrder', id, `تعديل أمر الشراء: ${updated.poNumber}`);

      res.json({
        success: true,
        message: 'تم تحديث أمر الشراء بنجاح',
        purchaseOrder: updated
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل تحديث أمر الشراء' });
    }
  });

  // POST /api/admin/purchase-orders/:id/status
  app.post('/api/admin/purchase-orders/:id/status', requireAdmin, requirePermission('inventory.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userEmail = (req as any).admin?.email || 'admin@store.com';

      if (!status) {
        return res.status(400).json({ error: 'حالة أمر الشراء مطلوبة' });
      }

      const updated = db.updatePurchaseOrderStatus(id, status, userEmail);

      logAudit(req, 'Status Change', 'PurchaseOrder', id, `تغيير حالة أمر الشراء ${updated.poNumber} إلى: ${status}`);

      res.json({
        success: true,
        message: `تم تغيير حالة أمر الشراء إلى ${status}`,
        purchaseOrder: updated
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل تغيير حالة أمر الشراء' });
    }
  });

  // POST /api/admin/purchase-orders/:id/receive
  app.post('/api/admin/purchase-orders/:id/receive', requireAdmin, requirePermission('inventory.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const { items } = req.body; // array of { itemId: string, quantityToReceive: number }
      const userEmail = (req as any).admin?.email || 'admin@store.com';

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد العناصر والكميات المراد استلامها' });
      }

      const updatedPO = db.receivePurchaseOrderItems(id, items, userEmail);

      logAudit(req, 'Inventory Adjustments', 'PurchaseOrder', id, `استلام شحنة أمر شراء: ${updatedPO.poNumber}`);

      res.json({
        success: true,
        message: 'تم تسجيل الشحنة المستلمة وتحديث بيانات المخزون وتكلفة المنتجات بنجاح',
        purchaseOrder: updatedPO
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل استلام الشحنة' });
    }
  });

  // ==========================================
  // 📊 BUSINESS INTELLIGENCE (BI) ANALYTICS
  // ==========================================
  app.get('/api/admin/bi-analytics', requireAdmin, requirePermission('analytics.view'), (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const orders = db.getOrders();
      const products = db.getProducts();

      // Convert date strings for accurate range checks
      const start = startDate ? new Date(startDate as string) : null;
      const end = endDate ? new Date(endDate as string) : null;

      // Filter orders by date range if provided
      let filteredOrders = orders;
      if (start) {
        filteredOrders = filteredOrders.filter(o => new Date(o.date) >= start);
      }
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        filteredOrders = filteredOrders.filter(o => new Date(o.date) <= endOfDay);
      }

      // 1. FINANCIAL METRICS (Only count successful/delivered or processing orders, exclude Cancelled/Returned for top-line revenue)
      const validOrders = filteredOrders.filter(o => o.status !== 'Cancelled' && o.status !== 'Returned');

      let totalRevenue = 0;
      let totalCogs = 0; // Cost of Goods Sold
      let totalShippingCollected = 0;
      let totalTaxCollected = 0;
      let totalDiscountsGiven = 0;

      validOrders.forEach(o => {
        totalRevenue += o.total;
        totalShippingCollected += o.shippingCost || 0;
        totalTaxCollected += o.taxAmount || 0;
        totalDiscountsGiven += o.discountAmount || 0;

        o.items.forEach(item => {
          const matchedProd = products.find(p => p.id === item.productId);
          const unitPrice = item.price;
          const costBasis = (matchedProd ? (matchedProd.price * 0.75) : (unitPrice * 0.75));
          totalCogs += costBasis * item.quantity;
        });
      });

      const totalProfit = Math.max(0, totalRevenue - totalCogs);
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      // 2. ORDER AND VOLUMES
      const totalOrdersCount = filteredOrders.length;
      const validOrdersCount = validOrders.length;
      const averageOrderValue = validOrdersCount > 0 ? (totalRevenue / validOrdersCount) : 0;

      const orderStatusDistribution = filteredOrders.reduce((acc: Record<string, number>, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, { Pending: 0, Confirmed: 0, Preparing: 0, Shipped: 0, Delivered: 0, Cancelled: 0, Returned: 0 });

      // 3. CUSTOMER INSIGHTS
      const customerMap = new Map<string, { name: string; totalSpent: number; orderCount: number }>();
      filteredOrders.forEach(o => {
        const key = o.customer.phone || o.customer.name;
        const existing = customerMap.get(key);
        const orderValue = o.status !== 'Cancelled' && o.status !== 'Returned' ? o.total : 0;
        
        if (existing) {
          existing.totalSpent += orderValue;
          existing.orderCount += 1;
        } else {
          customerMap.set(key, {
            name: o.customer.name,
            totalSpent: orderValue,
            orderCount: 1
          });
        }
      });

      const totalUniqueCustomers = customerMap.size;
      let returningCustomersCount = 0;
      let totalCustomerSpend = 0;

      customerMap.forEach(c => {
        if (c.orderCount > 1) returningCustomersCount++;
        totalCustomerSpend += c.totalSpent;
      });

      const repeatCustomerRate = totalUniqueCustomers > 0 ? (returningCustomersCount / totalUniqueCustomers) * 100 : 0;
      const customerLifetimeValue = totalUniqueCustomers > 0 ? (totalCustomerSpend / totalUniqueCustomers) : 0;

      // 4. INVENTORY ANALYSIS
      let totalStockOnHand = 0;
      let totalTiedCapital = 0; // Value of stock at cost
      let lowStockCount = 0;
      let outOfStockCount = 0;

      products.forEach(p => {
        const itemStock = p.stock || 0;
        totalStockOnHand += itemStock;
        totalTiedCapital += itemStock * (p.price * 0.75);

        if (itemStock === 0) {
          outOfStockCount++;
        } else if (itemStock <= 5) {
          lowStockCount++;
        }
      });

      // 5. TOP PERFORMING & SLOW MOVING PRODUCTS
      const salesVolumeMap = new Map<string, { title: string; category: string; brand: string; unitsSold: number; revenue: number }>();
      
      products.forEach(p => {
        salesVolumeMap.set(p.id, {
          title: p.title,
          category: p.category,
          brand: p.brand,
          unitsSold: 0,
          revenue: 0
        });
      });

      validOrders.forEach(o => {
        o.items.forEach(item => {
          const entry = salesVolumeMap.get(item.productId);
          if (entry) {
            entry.unitsSold += item.quantity;
            entry.revenue += item.price * item.quantity;
          } else {
            salesVolumeMap.set(item.productId, {
              title: item.productTitle,
              category: 'غير محدد',
              brand: 'غير معروف',
              unitsSold: item.quantity,
              revenue: item.price * item.quantity
            });
          }
        });
      });

      const productSalesArray = Array.from(salesVolumeMap.entries()).map(([id, info]) => ({
        id,
        ...info
      }));

      const bestSellers = [...productSalesArray]
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 10);

      const slowMoving = [...productSalesArray]
        .map(item => {
          const originalProd = products.find(p => p.id === item.id);
          return {
            ...item,
            currentStock: originalProd ? originalProd.stock : 0
          };
        })
        .sort((a, b) => {
          if (a.unitsSold !== b.unitsSold) {
            return a.unitsSold - b.unitsSold;
          }
          return b.currentStock - a.currentStock;
        })
        .slice(0, 10);

      const lowStockProducts = products
        .filter(p => p.stock <= 5)
        .map(p => ({
          id: p.id,
          title: p.title,
          brand: p.brand,
          category: p.category,
          stock: p.stock,
          price: p.price
        }))
        .sort((a, b) => a.stock - b.stock);

      // 6. TIMELINE CHARTS DATA
      const dailyTimelineMap = new Map<string, { revenue: number; profit: number; ordersCount: number }>();
      
      validOrders.forEach(o => {
        const dateKey = o.date.split('T')[0];
        const existing = dailyTimelineMap.get(dateKey);

        let orderCogs = 0;
        o.items.forEach(item => {
          const matchedProd = products.find(p => p.id === item.productId);
          const costBasis = (matchedProd ? (matchedProd.price * 0.75) : (item.price * 0.75));
          orderCogs += costBasis * item.quantity;
        });
        const orderProfit = Math.max(0, o.total - orderCogs);

        if (existing) {
          existing.revenue += o.total;
          existing.profit += orderProfit;
          existing.ordersCount += 1;
        } else {
          dailyTimelineMap.set(dateKey, {
            revenue: o.total,
            profit: orderProfit,
            ordersCount: 1
          });
        }
      });

      const timelineData = Array.from(dailyTimelineMap.entries())
        .map(([date, stats]) => ({
          date,
          revenue: Math.round(stats.revenue),
          profit: Math.round(stats.profit),
          ordersCount: stats.ordersCount
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 7. CATEGORY & BRAND DISTRIBUTION
      const categoryDistributionMap = new Map<string, { revenue: number; unitsSold: number; profit: number }>();
      const brandDistributionMap = new Map<string, { revenue: number; unitsSold: number; profit: number }>();

      validOrders.forEach(o => {
        o.items.forEach(item => {
          const matched = products.find(p => p.id === item.productId);
          const cat = matched ? matched.category : 'أخرى';
          const brand = matched ? matched.brand : 'أخرى';
          const itemRev = item.price * item.quantity;
          const costBasis = (matched ? (matched.price * 0.75) : (item.price * 0.75));
          const itemProfit = Math.max(0, itemRev - (costBasis * item.quantity));

          const existingCat = categoryDistributionMap.get(cat);
          if (existingCat) {
            existingCat.revenue += itemRev;
            existingCat.unitsSold += item.quantity;
            existingCat.profit += itemProfit;
          } else {
            categoryDistributionMap.set(cat, { revenue: itemRev, unitsSold: item.quantity, profit: itemProfit });
          }

          const existingBrand = brandDistributionMap.get(brand);
          if (existingBrand) {
            existingBrand.revenue += itemRev;
            existingBrand.unitsSold += item.quantity;
            existingBrand.profit += itemProfit;
          } else {
            brandDistributionMap.set(brand, { revenue: itemRev, unitsSold: item.quantity, profit: itemProfit });
          }
        });
      });

      const categoryData = Array.from(categoryDistributionMap.entries()).map(([name, stats]) => ({
        name,
        revenue: Math.round(stats.revenue),
        profit: Math.round(stats.profit),
        unitsSold: stats.unitsSold
      })).sort((a, b) => b.revenue - a.revenue);

      const brandData = Array.from(brandDistributionMap.entries()).map(([name, stats]) => ({
        name,
        revenue: Math.round(stats.revenue),
        profit: Math.round(stats.profit),
        unitsSold: stats.unitsSold
      })).sort((a, b) => b.revenue - a.revenue);

      // 8. GEOGRAPHIC ANALYSIS
      const geographicMap = new Map<string, { revenue: number; ordersCount: number }>();
      validOrders.forEach(o => {
        const province = o.customer.governorate || 'غير محدد';
        const existing = geographicMap.get(province);
        if (existing) {
          existing.revenue += o.total;
          existing.ordersCount += 1;
        } else {
          geographicMap.set(province, { revenue: o.total, ordersCount: 1 });
        }
      });

      const geographicData = Array.from(geographicMap.entries()).map(([name, stats]) => ({
        name,
        revenue: Math.round(stats.revenue),
        ordersCount: stats.ordersCount
      })).sort((a, b) => b.revenue - a.revenue);

      // 9. RETURNS & REFUNDS ANALYTICS
      const returns = db.getReturnRequests();
      let filteredReturns = returns;
      if (start) {
        filteredReturns = filteredReturns.filter(r => new Date(r.createdAt) >= start);
      }
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        filteredReturns = filteredReturns.filter(r => new Date(r.createdAt) <= endOfDay);
      }

      let totalRefundedAmount = 0;
      let pendingRefundAmount = 0;
      let returnedProductValue = 0;
      let damagedProductValue = 0;
      let restockedProductValue = 0;
      let restockedItemsCount = 0;

      const returnStatusDistribution = {
        pending: 0,
        approved: 0,
        pickup_pending: 0,
        received: 0,
        completed: 0,
        rejected: 0,
        cancelled: 0
      };

      const refundStatusDistribution = {
        pending: 0,
        approved: 0,
        processed: 0,
        rejected: 0
      };

      filteredReturns.forEach(r => {
        const anyR = r as any;
        const amt = Number(r.refundAmount) || 0;
        const qty = Number(r.quantity) || 1;
        const pVal = (Number(anyR.productPrice || anyR.unitPrice) || 0) * qty || amt;

        if (r.status in returnStatusDistribution) {
          (returnStatusDistribution as any)[r.status] = ((returnStatusDistribution as any)[r.status] || 0) + 1;
        }

        if (r.refundStatus in refundStatusDistribution) {
          (refundStatusDistribution as any)[r.refundStatus] = ((refundStatusDistribution as any)[r.refundStatus] || 0) + 1;
        }

        if (r.status === 'completed' || r.refundStatus === 'processed') {
          totalRefundedAmount += amt;
        } else if (r.status !== 'rejected' && r.status !== 'cancelled') {
          pendingRefundAmount += amt;
        }

        if (r.status !== 'rejected' && r.status !== 'cancelled') {
          returnedProductValue += pVal;
          if (anyR.restockable === true || anyR.restocked === true) {
            restockedProductValue += pVal;
            restockedItemsCount += qty;
          } else if (anyR.restockable === false || (r.reason && (r.reason.includes('damaged') || r.reason.includes('defective')))) {
            damagedProductValue += pVal;
          }
        }
      });

      const totalReturnsCount = filteredReturns.length;
      const returnRate = validOrdersCount > 0 ? (totalReturnsCount / validOrdersCount) * 100 : 0;
      const grossRevenue = totalRevenue;
      const netRevenue = Math.max(0, grossRevenue - totalRefundedAmount);

      res.json({
        financials: {
          totalRevenue: Math.round(totalRevenue),
          grossRevenue: Math.round(grossRevenue),
          totalRefunds: Math.round(totalRefundedAmount),
          netRevenue: Math.round(netRevenue),
          totalCogs: Math.round(totalCogs),
          totalProfit: Math.round(totalProfit),
          profitMargin: Number(profitMargin.toFixed(2)),
          totalShippingCollected: Math.round(totalShippingCollected),
          totalTaxCollected: Math.round(totalTaxCollected),
          totalDiscountsGiven: Math.round(totalDiscountsGiven)
        },
        orders: {
          totalOrdersCount,
          validOrdersCount,
          averageOrderValue: Math.round(averageOrderValue),
          orderStatusDistribution
        },
        returns: {
          totalReturnsCount,
          pendingReturnsCount: filteredReturns.filter(r => r.status === 'pending' || r.status === 'pickup_pending' || r.status === 'received').length,
          approvedReturnsCount: filteredReturns.filter(r => r.status === 'approved').length,
          completedReturnsCount: filteredReturns.filter(r => r.status === 'completed').length,
          rejectedReturnsCount: filteredReturns.filter(r => r.status === 'rejected').length,
          cancelledReturnsCount: filteredReturns.filter(r => r.status === 'cancelled').length,
          totalRefundedAmount: Math.round(totalRefundedAmount),
          pendingRefundAmount: Math.round(pendingRefundAmount),
          returnedProductValue: Math.round(returnedProductValue),
          damagedProductValue: Math.round(damagedProductValue),
          restockedProductValue: Math.round(restockedProductValue),
          restockedItemsCount,
          returnRate: Number(returnRate.toFixed(2)),
          statusDistribution: returnStatusDistribution,
          refundStatusDistribution
        },
        customers: {
          totalUniqueCustomers,
          returningCustomersCount,
          repeatCustomerRate: Number(repeatCustomerRate.toFixed(2)),
          customerLifetimeValue: Math.round(customerLifetimeValue)
        },
        inventory: {
          totalCatalogProducts: products.length,
          totalStockOnHand,
          totalTiedCapital: Math.round(totalTiedCapital),
          lowStockCount,
          outOfStockCount
        },
        bestSellers,
        slowMoving,
        lowStockProducts,
        timelineData,
        categoryData,
        brandData,
        geographicData
      });
    } catch (err: any) {
      console.error('BI Analytics compilation failed:', err);
      res.status(500).json({ error: 'فشل تجميع تقارير ذكاء الأعمال والتحليلات الإحصائية' });
    }
  });

  // Admin Manage products: ADD
  app.post('/api/admin/products', requireAdmin, requirePermission('products.create'), (req, res) => {
    try {
      const prodData = req.body;
      if (!prodData.title || prodData.price === undefined || prodData.price === null || !prodData.sku) {
        return res.status(400).json({ error: 'بيانات المنتج غير كافية (الاسم، السعر، ورمز SKU مطلوبة)' });
      }

      const vPrice = validateBackendNumeric(prodData.price, 'non_negative_decimal', { required: true, fieldNameArabic: 'سعر المنتج' });
      if (!vPrice.isValid) {
        return res.status(400).json({ error: vPrice.error });
      }

      let parsedDiscountPrice: number | undefined = undefined;
      if (prodData.discountPrice !== undefined && prodData.discountPrice !== null && prodData.discountPrice !== '') {
        const vDisc = validateBackendNumeric(prodData.discountPrice, 'non_negative_decimal', { fieldNameArabic: 'سعر الخصم' });
        if (!vDisc.isValid) {
          return res.status(400).json({ error: vDisc.error });
        }
        parsedDiscountPrice = vDisc.value;
      }

      let parsedStock = 10;
      if (prodData.stock !== undefined && prodData.stock !== null && prodData.stock !== '') {
        const vStock = validateBackendNumeric(prodData.stock, 'non_negative_integer', { fieldNameArabic: 'المخزون' });
        if (!vStock.isValid) {
          return res.status(400).json({ error: vStock.error });
        }
        parsedStock = vStock.value;
      }

      const brandSlug = (prodData.brand || 'general').toLowerCase().replace(/[^a-z0-9]/g, '');
      const id = `prod-${brandSlug || 'item'}-${Date.now()}`;
      const newProd: Product = {
        id,
        title: prodData.title,
        titleEn: prodData.titleEn || '',
        description: prodData.description || 'وصف المنتج التفصيلي قريباً...',
        brand: prodData.brand || 'عام',
        category: prodData.category || 'أخرى',
        mainImage: prodData.mainImage || 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=800',
        images: prodData.images || [prodData.mainImage],
        videoUrl: prodData.videoUrl || '',
        price: vPrice.value,
        discountPrice: parsedDiscountPrice,
        rating: 5.0,
        reviewsCount: 0,
        reviews: [],
        sku: prodData.sku,
        stock: parsedStock,
        variants: prodData.variants || [],
        specifications: prodData.specifications || [],
        features: prodData.features || [],
        tags: prodData.tags || [],
        isFeatured: prodData.isFeatured || false,
        isBestSeller: prodData.isBestSeller || false,
        isLatest: prodData.isLatest || true,
        isFlashSale: prodData.isFlashSale || false,
        flashSaleEnds: prodData.flashSaleEnds || ''
      };

      const added = db.addProduct(newProd);
      clearRouteCache('/api/products');
      clearRouteCache('/api/categories');
      clearRouteCache('/api/brands');
      res.status(201).json(added);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to add product' });
    }
  });

  // Admin Manage products: EDIT
  app.put('/api/admin/products/:id', requireAdmin, requirePermission('products.edit'), (req: any, res) => {
    try {
      const adminEmail = req.admin?.email || 'admin@store.com';
      const adminName = req.admin?.name || req.admin?.email || 'مسؤول النظام';
      const adminId = req.admin?.id || 'admin';

      const updated = db.updateProduct(
        req.params.id,
        req.body,
        { adminId, adminName, adminEmail },
        req.body.stockAdjustmentReason
      );
      if (!updated) {
        return res.status(404).json({ error: 'Product not found' });
      }
      clearRouteCache('/api/products');
      clearRouteCache('/api/categories');
      clearRouteCache('/api/brands');
      clearRouteCache('/api/admin/inventory');
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update product' });
    }
  });

  // Admin Manage products: DELETE
  app.delete('/api/admin/products/:id', requireAdmin, requirePermission('products.delete'), (req, res) => {
    try {
      const success = db.deleteProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Product not found' });
      }
      clearRouteCache('/api/products');
      clearRouteCache('/api/categories');
      clearRouteCache('/api/brands');
      res.json({ success: true, message: 'تم حذف المنتج بنجاح من قاعدة البيانات' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // ==========================================
  // 🎫 ADMIN COUPON MANAGEMENT ENDPOINTS
  // ==========================================

  // Admin Coupons: GET list
  app.get('/api/admin/coupons', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const coupons = db.getCoupons();
      res.json(coupons);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch coupons' });
    }
  });

  // Admin Coupons: CREATE
  app.post('/api/admin/coupons', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const { code, discountType, value, discountValue, minOrderValue, maxDiscountAmount, expiryDate, usageLimit, oneUsePerUser, isActive } = req.body;
      if (!code || !discountType) {
        return res.status(400).json({ error: 'كود الكوبون ونوع الخصم مطلوبان' });
      }

      const rawVal = value !== undefined ? value : (discountValue !== undefined ? discountValue : 0);
      let parsedValue = 0;

      if (discountType === 'percentage') {
        const vVal = validateBackendNumeric(rawVal, 'percentage', { min: 0.01, max: 100, fieldNameArabic: 'نسبة الخصم' });
        if (!vVal.isValid) {
          return res.status(400).json({ error: vVal.error });
        }
        parsedValue = vVal.value;
      } else if (discountType === 'fixed') {
        const vVal = validateBackendNumeric(rawVal, 'positive_decimal', { min: 0.01, fieldNameArabic: 'قيمة الخصم الثابت' });
        if (!vVal.isValid) {
          return res.status(400).json({ error: vVal.error });
        }
        parsedValue = vVal.value;
      } else if (discountType === 'free_shipping') {
        parsedValue = 0;
      } else {
        return res.status(400).json({ error: 'نوع الخصم غير صالح' });
      }

      let parsedMinOrder: number | undefined = undefined;
      if (minOrderValue !== undefined && minOrderValue !== null && minOrderValue !== '') {
        const vMin = validateBackendNumeric(minOrderValue, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى لقيمة الطلب' });
        if (!vMin.isValid) {
          return res.status(400).json({ error: vMin.error });
        }
        parsedMinOrder = vMin.value;
      }

      let parsedMaxDiscount: number | undefined = undefined;
      if (maxDiscountAmount !== undefined && maxDiscountAmount !== null && maxDiscountAmount !== '') {
        const vMax = validateBackendNumeric(maxDiscountAmount, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى للخصم' });
        if (!vMax.isValid) {
          return res.status(400).json({ error: vMax.error });
        }
        parsedMaxDiscount = vMax.value;
      }

      let parsedUsageLimit: number | undefined = undefined;
      if (usageLimit !== undefined && usageLimit !== null && usageLimit !== '') {
        const vUsage = validateBackendNumeric(usageLimit, 'positive_integer', { min: 1, fieldNameArabic: 'الحد الأقصى للاستخدام' });
        if (!vUsage.isValid) {
          return res.status(400).json({ error: vUsage.error });
        }
        parsedUsageLimit = vUsage.value;
      }

      const newCoupon: Coupon = {
        code: code.toUpperCase().trim(),
        discountType,
        value: parsedValue,
        discountValue: parsedValue,
        minOrderValue: parsedMinOrder,
        maxDiscountAmount: parsedMaxDiscount,
        expiryDate: expiryDate || undefined,
        usageLimit: parsedUsageLimit,
        usedCount: 0,
        oneUsePerUser: !!oneUsePerUser,
        usedByUsers: [],
        totalDiscountGenerated: 0,
        isActive: isActive !== false
      };

      const created = db.createCoupon(newCoupon);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create coupon' });
    }
  });

  // Admin Coupons: UPDATE
  app.put('/api/admin/coupons/:code', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const { discountType, value, discountValue, minOrderValue, maxDiscountAmount, expiryDate, usageLimit, oneUsePerUser, isActive } = req.body;
      
      const updatedFields: Partial<Coupon> = {};
      if (discountType) updatedFields.discountType = discountType;
      
      const rawVal = value !== undefined ? value : discountValue;
      if (rawVal !== undefined) {
        const effectiveType = discountType || 'fixed';
        if (effectiveType === 'percentage') {
          const vVal = validateBackendNumeric(rawVal, 'percentage', { min: 0.01, max: 100, fieldNameArabic: 'نسبة الخصم' });
          if (!vVal.isValid) {
            return res.status(400).json({ error: vVal.error });
          }
          updatedFields.value = vVal.value;
          updatedFields.discountValue = vVal.value;
        } else if (effectiveType === 'fixed') {
          const vVal = validateBackendNumeric(rawVal, 'positive_decimal', { min: 0.01, fieldNameArabic: 'قيمة الخصم الثابت' });
          if (!vVal.isValid) {
            return res.status(400).json({ error: vVal.error });
          }
          updatedFields.value = vVal.value;
          updatedFields.discountValue = vVal.value;
        } else {
          updatedFields.value = 0;
          updatedFields.discountValue = 0;
        }
      }
      
      if (minOrderValue !== undefined) {
        if (minOrderValue === null || minOrderValue === '') {
          updatedFields.minOrderValue = undefined;
        } else {
          const vMin = validateBackendNumeric(minOrderValue, 'non_negative_decimal', { fieldNameArabic: 'الحد الأدنى لقيمة الطلب' });
          if (!vMin.isValid) {
            return res.status(400).json({ error: vMin.error });
          }
          updatedFields.minOrderValue = vMin.value;
        }
      }

      if (maxDiscountAmount !== undefined) {
        if (maxDiscountAmount === null || maxDiscountAmount === '') {
          updatedFields.maxDiscountAmount = undefined;
        } else {
          const vMax = validateBackendNumeric(maxDiscountAmount, 'non_negative_decimal', { fieldNameArabic: 'الحد الأقصى للخصم' });
          if (!vMax.isValid) {
            return res.status(400).json({ error: vMax.error });
          }
          updatedFields.maxDiscountAmount = vMax.value;
        }
      }

      updatedFields.expiryDate = expiryDate || undefined;

      if (usageLimit !== undefined) {
        if (usageLimit === null || usageLimit === '') {
          updatedFields.usageLimit = undefined;
        } else {
          const vUsage = validateBackendNumeric(usageLimit, 'positive_integer', { min: 1, fieldNameArabic: 'الحد الأقصى للاستخدام' });
          if (!vUsage.isValid) {
            return res.status(400).json({ error: vUsage.error });
          }
          updatedFields.usageLimit = vUsage.value;
        }
      }
      
      if (typeof oneUsePerUser === 'boolean') updatedFields.oneUsePerUser = oneUsePerUser;
      if (typeof isActive === 'boolean') updatedFields.isActive = isActive;

      const updated = db.updateCoupon(req.params.code, updatedFields);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update coupon' });
    }
  });

  // Admin Coupons: DELETE
  app.delete('/api/admin/coupons/:code', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const success = db.deleteCoupon(req.params.code);
      if (!success) {
        return res.status(404).json({ error: 'الكوبون غير موجود' });
      }
      res.json({ success: true, message: 'تم حذف الكوبون بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete coupon' });
    }
  });

  // ==========================================
  // 🖼️ DYNAMIC BANNER CMS ENDPOINTS
  // ==========================================

  // Public: GET active, scheduled banners (with auto-deactivation)
  app.get('/api/banners', (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const activeBanners = db.getBanners().filter((b: any) => {
        if (!b.isActive) return false;
        if (b.startDate && today < b.startDate) return false;
        if (b.endDate && today > b.endDate) return false;
        return true;
      });
      // Sort by sortOrder
      activeBanners.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      res.json(activeBanners);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch public banners' });
    }
  });

  // Admin: GET all banners
  app.get('/api/admin/banners', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const banners = db.getBanners();
      // Sort by sortOrder
      banners.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
      res.json(banners);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch admin banners' });
    }
  });

  // Admin: CREATE banner
  app.post('/api/admin/banners', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const { title, subtitle, desktopImage, mobileImage, btnText, btnLink, badge, startDate, endDate, isActive, sortOrder } = req.body;
      if (!title || !desktopImage || !mobileImage) {
        return res.status(400).json({ error: 'العنوان وصورة الكمبيوتر وصورة الموبايل مطلوبة' });
      }

      const newBanner: Banner = {
        id: `banner-${Date.now()}`,
        title,
        subtitle: subtitle || '',
        desktopImage,
        mobileImage,
        btnText: btnText || 'تصفح العروض',
        btnLink: btnLink || 'products',
        badge: badge || '',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0
      };

      const banner = db.createBanner(newBanner);
      res.status(201).json(banner);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to create banner' });
    }
  });

  // Admin: UPDATE banner
  app.put('/api/admin/banners/:id', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const { title, subtitle, desktopImage, mobileImage, btnText, btnLink, badge, startDate, endDate, isActive, sortOrder } = req.body;
      const updatedFields: Partial<Banner> = {};
      
      if (title !== undefined) updatedFields.title = title;
      if (subtitle !== undefined) updatedFields.subtitle = subtitle;
      if (desktopImage !== undefined) updatedFields.desktopImage = desktopImage;
      if (mobileImage !== undefined) updatedFields.mobileImage = mobileImage;
      if (btnText !== undefined) updatedFields.btnText = btnText;
      if (btnLink !== undefined) updatedFields.btnLink = btnLink;
      if (badge !== undefined) updatedFields.badge = badge;
      
      updatedFields.startDate = startDate || undefined;
      updatedFields.endDate = endDate || undefined;
      
      if (typeof isActive === 'boolean') updatedFields.isActive = isActive;
      if (typeof sortOrder === 'number') updatedFields.sortOrder = sortOrder;

      const updated = db.updateBanner(req.params.id, updatedFields);
      if (!updated) {
        return res.status(404).json({ error: 'Banner not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update banner' });
    }
  });

  // Admin: DELETE banner
  app.delete('/api/admin/banners/:id', requireAdmin, requirePermission('campaigns.manage'), (req, res) => {
    try {
      const success = db.deleteBanner(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Banner not found' });
      }
      res.json({ success: true, message: 'تم حذف اللافتة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete banner' });
    }
  });

  // Public: GET enabled provinces
  app.get('/api/shipping-provinces', (req, res) => {
    try {
      const provinces = db.getShippingProvinces().filter(p => p.isActive);
      res.json(provinces);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load shipping provinces' });
    }
  });

  // Admin: GET all shipping provinces
  app.get('/api/admin/shipping-provinces', requireAdmin, requirePermission('settings.manage'), (req, res) => {
    try {
      res.json(db.getShippingProvinces());
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load admin shipping provinces' });
    }
  });

  // Admin: CREATE shipping province
  app.post('/api/admin/shipping-provinces', requireAdmin, requirePermission('settings.manage'), (req, res) => {
    try {
      const { name, nameEn, price, estimatedDays, isActive, isCodAvailable, freeShippingThreshold } = req.body;
      if (!name || !nameEn || price === undefined || price === null || !estimatedDays) {
        return res.status(400).json({ error: 'يرجى تقديم اسم المحافظة بالعربية والإنجليزية والسعر والمدة التقريبية' });
      }

      const vPrice = validateBackendNumeric(price, 'non_negative_decimal', { required: true, fieldNameArabic: 'سعر الشحن للمحافظة' });
      if (!vPrice.isValid) {
        return res.status(400).json({ error: vPrice.error });
      }

      let parsedThreshold: number | undefined = undefined;
      if (freeShippingThreshold !== undefined && freeShippingThreshold !== null && freeShippingThreshold !== '') {
        const vThresh = validateBackendNumeric(freeShippingThreshold, 'non_negative_decimal', { fieldNameArabic: 'حد الشحن المجاني' });
        if (!vThresh.isValid) {
          return res.status(400).json({ error: vThresh.error });
        }
        parsedThreshold = vThresh.value;
      }

      const newProvince: ShippingProvince = {
        id: `prov-${Date.now()}`,
        name: name.trim(),
        nameEn: nameEn.trim(),
        price: vPrice.value,
        estimatedDays: estimatedDays.trim(),
        isActive: typeof isActive === 'boolean' ? isActive : true,
        isCodAvailable: typeof isCodAvailable === 'boolean' ? isCodAvailable : true,
        freeShippingThreshold: parsedThreshold
      };

      const created = db.createShippingProvince(newProvince);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create shipping province' });
    }
  });

  // Admin: UPDATE shipping province
  app.put('/api/admin/shipping-provinces/:id', requireAdmin, requirePermission('settings.manage'), (req, res) => {
    try {
      const { name, nameEn, price, estimatedDays, isActive, isCodAvailable, freeShippingThreshold } = req.body;
      const updatedFields: Partial<ShippingProvince> = {};

      if (name !== undefined) updatedFields.name = name.trim();
      if (nameEn !== undefined) updatedFields.nameEn = nameEn.trim();
      
      if (price !== undefined) {
        const vPrice = validateBackendNumeric(price, 'non_negative_decimal', { fieldNameArabic: 'سعر الشحن' });
        if (!vPrice.isValid) {
          return res.status(400).json({ error: vPrice.error });
        }
        updatedFields.price = vPrice.value;
      }

      if (estimatedDays !== undefined) updatedFields.estimatedDays = estimatedDays.trim();
      if (isActive !== undefined) updatedFields.isActive = !!isActive;
      if (isCodAvailable !== undefined) updatedFields.isCodAvailable = !!isCodAvailable;
      
      // Handle free shipping threshold specifically (convert empty string or null to undefined/deleted)
      if (freeShippingThreshold !== undefined) {
        if (freeShippingThreshold === null || freeShippingThreshold === '') {
          updatedFields.freeShippingThreshold = undefined;
        } else {
          const vThresh = validateBackendNumeric(freeShippingThreshold, 'non_negative_decimal', { fieldNameArabic: 'حد الشحن المجاني' });
          if (!vThresh.isValid) {
            return res.status(400).json({ error: vThresh.error });
          }
          updatedFields.freeShippingThreshold = vThresh.value;
        }
      }

      const updated = db.updateShippingProvince(req.params.id, updatedFields);
      if (!updated) {
        return res.status(404).json({ error: 'Shipping province not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update shipping province' });
    }
  });

  // Admin: DELETE shipping province
  app.delete('/api/admin/shipping-provinces/:id', requireAdmin, requirePermission('settings.manage'), (req, res) => {
    try {
      const success = db.deleteShippingProvince(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Shipping province not found' });
      }
      res.json({ success: true, message: 'تم حذف المحافظة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete shipping province' });
    }
  });

  // ==========================================
  // 🛡️ ADMIN REVIEW MODERATION ENDPOINTS
  // ==========================================

  // Admin GET all reviews with filters, search, pagination & stats
  app.get('/api/admin/reviews', requireAdmin, requirePermission('reviews.manage'), (req, res) => {
    try {
      const { productId, status, rating, search, page, limit } = req.query;

      const validStatus = (status && ['pending', 'approved', 'rejected', 'hidden'].includes(status as string))
        ? (status as 'pending' | 'approved' | 'rejected' | 'hidden')
        : undefined;

      let reviews = db.getReviews({
        productId: productId ? String(productId) : undefined,
        status: validStatus,
        search: search ? String(search) : undefined
      });

      if (rating !== undefined && rating !== '') {
        const vRating = validateBackendNumeric(rating, 'rating', { fieldNameArabic: 'تصفية التقييم' });
        if (!vRating.isValid) {
          return res.status(400).json({ error: vRating.error });
        }
        reviews = reviews.filter(r => r.rating === vRating.value);
      }

      // Compute system-wide moderation stats
      const allSystemReviews = db.getReviews();
      const stats = {
        total: allSystemReviews.length,
        pending: allSystemReviews.filter(r => r.status === 'pending').length,
        approved: allSystemReviews.filter(r => r.status === 'approved').length,
        rejected: allSystemReviews.filter(r => r.status === 'rejected').length,
        hidden: allSystemReviews.filter(r => r.status === 'hidden').length
      };

      // Enrich reviews with product info
      const enriched = reviews.map(r => {
        const product = db.getProductById(r.productId || '');
        return {
          ...r,
          productTitle: product ? product.title : 'منتج غير معروف',
          productMainImage: product ? (product.mainImage || product.images?.[0]) : ''
        };
      });

      enriched.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      // Pagination
      let p = 1;
      if (page !== undefined && page !== '') {
        const vPage = validateBackendNumeric(page, 'positive_integer', { min: 1, fieldNameArabic: 'رقم الصفحة' });
        if (!vPage.isValid) {
          return res.status(400).json({ error: vPage.error });
        }
        p = vPage.value;
      }

      let l = 20;
      if (limit !== undefined && limit !== '') {
        const vLimit = validateBackendNumeric(limit, 'positive_integer', { min: 1, max: 100, fieldNameArabic: 'عدد العناصر بالصفحة' });
        if (!vLimit.isValid) {
          return res.status(400).json({ error: vLimit.error });
        }
        l = vLimit.value;
      }
      const totalFiltered = enriched.length;
      const totalPages = Math.ceil(totalFiltered / l) || 1;
      const paginated = enriched.slice((p - 1) * l, (p - 1) * l + l);

      res.json({
        reviews: paginated,
        pagination: {
          total: totalFiltered,
          page: p,
          limit: l,
          totalPages
        },
        stats
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل قائمة المراجعات', message: err.message });
    }
  });

  // Admin GET single review details
  app.get('/api/admin/reviews/:id', requireAdmin, requirePermission('reviews.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const review = db.getReviewById(id);
      if (!review) {
        return res.status(404).json({ error: 'المراجعة غير موجودة' });
      }

      const product = db.getProductById(review.productId || '');
      const enriched = {
        ...review,
        productTitle: product ? product.title : 'منتج غير معروف',
        productMainImage: product ? (product.mainImage || product.images?.[0]) : ''
      };

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تحميل تفاصيل المراجعة', message: err.message });
    }
  });

  // Admin UPDATE review status / admin response
  const handleAdminUpdateReviewStatus = (req: any, res: any) => {
    try {
      const { id } = req.params;
      const { status, adminResponse, reason, moderationReason } = req.body;

      if (!status || !['pending', 'approved', 'rejected', 'hidden'].includes(status)) {
        return res.status(400).json({ error: 'حالة المراجعة غير صالحة' });
      }

      const responseText = adminResponse || reason || moderationReason;
      const updated = db.updateReviewStatus(id, status, responseText);
      logAudit(req, 'Status Change', 'Review', id, `تعديل حالة المراجعة/التقييم إلى: ${status}`);
      res.json(updated);
    } catch (err: any) {
      const isNotFound = err.message && err.message.includes('غير موجودة');
      res.status(isNotFound ? 404 : 400).json({ error: err.message || 'فشل تحديث حالة المراجعة' });
    }
  };
  app.patch('/api/admin/reviews/:id/status', requireAdmin, requirePermission('reviews.manage'), handleAdminUpdateReviewStatus);
  app.put('/api/admin/reviews/:id/status', requireAdmin, requirePermission('reviews.manage'), handleAdminUpdateReviewStatus);
  app.patch('/api/admin/reviews/:id', requireAdmin, requirePermission('reviews.manage'), handleAdminUpdateReviewStatus);

  // Admin DELETE review
  app.delete('/api/admin/reviews/:id', requireAdmin, requirePermission('reviews.manage'), (req, res) => {
    try {
      const { id } = req.params;
      db.deleteReview(id);
      logAudit(req, 'Delete', 'Review', id, `حذف المراجعة ID: ${id}`);
      res.json({ success: true, message: 'تم حذف التقييم بنجاح' });
    } catch (err: any) {
      const isNotFound = err.message && err.message.includes('غير موجودة');
      res.status(isNotFound ? 404 : 400).json({ error: err.message || 'فشل حذف المراجعة' });
    }
  });

  // Admin Orders List
  app.get('/api/admin/orders', requireAdmin, requirePermission('orders.view'), (req, res) => {
    try {
      res.json(db.getOrders());
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load orders' });
    }
  });

  // ==========================================
  // 👥 ADMIN CUSTOMER MANAGEMENT ENDPOINTS
  // ==========================================

  // Admin GET all customers
  app.get('/api/admin/customers', requireAdmin, requirePermission('customers.view'), (req, res) => {
    try {
      const customers = db.getCustomers();
      const safeCustomers = customers.map(c => {
        const { passwordHash, salt, verificationCode, resetToken, resetTokenExpiry, ...safe } = c;
        return safe;
      });
      res.json(safeCustomers);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch admin customers' });
    }
  });

  // Admin GET single customer profile and orders
  app.get('/api/admin/customers/:id', requireAdmin, requirePermission('customers.view'), (req, res) => {
    try {
      const customer = db.getCustomerById(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: 'العميل غير موجود' });
      }
      const { passwordHash, salt, verificationCode, resetToken, resetTokenExpiry, ...safe } = customer;
      const orders = db.getOrders().filter(o => 
        (o.userId && o.userId === customer.id) ||
        (o.customerId && o.customerId === customer.id) ||
        (o.customer.email && o.customer.email.toLowerCase() === customer.email.toLowerCase())
      );
      res.json({
        customer: safe,
        orders
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch customer details' });
    }
  });

  // Admin UPDATE customer profile
  const handleAdminUpdateCustomer = (req: any, res: any) => {
    try {
      const { name, email, phone, status } = req.body;
      const existing = db.getCustomerById(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'العميل غير موجود' });
      }

      const updated = db.updateCustomer(req.params.id, {
        name: name !== undefined ? String(name).trim() : existing.name,
        email: email !== undefined ? String(email).trim().toLowerCase() : existing.email,
        phone: phone !== undefined ? String(phone).trim() : existing.phone,
        status: status !== undefined ? status : existing.status
      });

      if (!updated) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      logAudit(req, 'Customer Updates', 'Customer', req.params.id, `تحديث بيانات العميل: ${updated.name} (${updated.email})`);

      const { passwordHash, salt, verificationCode, resetToken, resetTokenExpiry, ...safe } = updated;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update customer' });
    }
  };
  app.patch('/api/admin/customers/:id', requireAdmin, requirePermission('customers.edit'), handleAdminUpdateCustomer);
  app.put('/api/admin/customers/:id', requireAdmin, requirePermission('customers.edit'), handleAdminUpdateCustomer);

  // Admin UPDATE customer status
  const handleAdminUpdateCustomerStatus = (req: any, res: any) => {
    try {
      const { status } = req.body;
      if (!status || !['active', 'inactive', 'blocked'].includes(status)) {
        return res.status(400).json({ error: 'حالة العميل غير صالحة' });
      }

      const updated = db.updateCustomer(req.params.id, { status });
      if (!updated) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      logAudit(req, 'Customer Updates', 'Customer', req.params.id, `تغيير حالة العميل ${updated.name} إلى: ${status}`);

      const { passwordHash, salt, verificationCode, resetToken, resetTokenExpiry, ...safe } = updated;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update customer status' });
    }
  };
  app.patch('/api/admin/customers/:id/status', requireAdmin, requirePermission('customers.edit'), handleAdminUpdateCustomerStatus);
  app.put('/api/admin/customers/:id/status', requireAdmin, requirePermission('customers.edit'), handleAdminUpdateCustomerStatus);

  // Admin Send Targeted Customer Notification
  app.post('/api/admin/customers/:id/notifications', requireAdmin, requirePermission('customers.edit'), (req, res) => {
    try {
      const customer = db.getCustomerById(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: 'حساب العميل غير موجود' });
      }

      const { title, message, type, metadata } = req.body;
      if (!title || typeof title !== 'string' || !title.trim() || !message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'عنوان ونص الإشعار مطلوبان ولا يمكن أن كلاهما فارغاً' });
      }

      if (title.trim().length > 150) {
        return res.status(400).json({ error: 'عنوان الإشعار يجب ألا يتجاوز 150 حرفاً' });
      }

      if (message.trim().length > 2000) {
        return res.status(400).json({ error: 'نص الإشعار يجب ألا يتجاوز 2000 حرف' });
      }

      const validTypes = ['system', 'promo', 'order'];
      const notifType = validTypes.includes(type) ? type : 'system';

      const newNotif = {
        id: `not-admin-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        title: title.trim(),
        message: message.trim(),
        type: notifType,
        isRead: false,
        timestamp: new Date().toISOString(),
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined
      };

      const updatedNotifs = [newNotif, ...(customer.notifications || [])];
      db.updateCustomer(customer.id, { notifications: updatedNotifs });

      logAudit(req, 'Customer Updates', 'Customer', customer.id, `إرسال إشعار موجه للعميل ${customer.name}: ${title.trim()}`);

      res.status(201).json({ success: true, notification: newNotif });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to send customer notification' });
    }
  });

  // Admin Broadcast Customer Notifications
  app.post('/api/admin/customers/notifications/broadcast', requireAdmin, requirePermission('customers.edit'), (req, res) => {
    try {
      const { title, message, type, targetStatus } = req.body;
      if (!title || typeof title !== 'string' || !title.trim() || !message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'عنوان ونص الإشعار الجماعي مطلوبان' });
      }

      if (title.trim().length > 150) {
        return res.status(400).json({ error: 'عنوان الإشعار يجب ألا يتجاوز 150 حرفاً' });
      }

      if (message.trim().length > 2000) {
        return res.status(400).json({ error: 'نص الإشعار يجب ألا يتجاوز 2000 حرف' });
      }

      const validTypes = ['system', 'promo', 'order'];
      const notifType = validTypes.includes(type) ? type : 'promo';
      const target = ['active', 'inactive', 'blocked', 'all'].includes(targetStatus) ? targetStatus : 'active';

      const allCustomers = db.getCustomers();
      let sentCount = 0;

      allCustomers.forEach(cust => {
        const cStatus = cust.status || 'active';
        let isMatch = false;

        if (target === 'all') {
          isMatch = cStatus !== 'blocked';
        } else if (target === 'blocked') {
          isMatch = cStatus === 'blocked';
        } else if (target === 'inactive') {
          isMatch = cStatus === 'inactive';
        } else {
          isMatch = cStatus === 'active';
        }

        if (isMatch) {
          const newNotif = {
            id: `not-bcast-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
            title: title.trim(),
            message: message.trim(),
            type: notifType,
            isRead: false,
            timestamp: new Date().toISOString()
          };
          const updatedNotifs = [newNotif, ...(cust.notifications || [])];
          db.updateCustomer(cust.id, { notifications: updatedNotifs });
          sentCount++;
        }
      });

      logAudit(req, 'Customer Updates', 'Customer', 'broadcast', `إرسال إشعار جماعي لـ ${sentCount} عميل: ${title.trim()}`);

      res.json({ success: true, count: sentCount });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to broadcast customer notifications' });
    }
  });

  // Admin Update order status
  app.put('/api/admin/orders/:id/status', requireAdmin, requirePermission('orders.edit'), (req, res) => {
    try {
      const { status, reason } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const updated = db.updateOrderStatus(req.params.id, status as OrderStatus, reason);
      if (!updated) {
        return res.status(404).json({ error: 'Order not found' });
      }

      logAudit(req, 'Order Status Changes', 'Order', req.params.id, `تغيير حالة الطلب ID ${req.params.id} إلى: ${status}`);

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // Admin CMS Settings Update
  app.put('/api/admin/settings', requireAdmin, requirePermission('settings.manage'), (req, res) => {
    try {
      const updated = db.updateSettings(req.body);
      logAudit(req, 'Settings Changes', 'Settings', 'global', 'تحديث إعدادات المتجر العامة والـ CMS');
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل حفظ الإعدادات' });
    }
  });

  // Admin Social Media Links Management (Dynamic Social Links System)
  app.get('/api/admin/social-links', requireAdmin, (req, res) => {
    try {
      const links = db.getSocialLinks();
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve social links', message: err.message });
    }
  });

  app.post('/api/admin/social-links', requireAdmin, requirePermission(['social.manage', 'settings.manage']), (req, res) => {
    try {
      const newLink = db.addSocialLink(req.body);
      logAudit(req, 'Social Links', 'SocialLink', newLink.id, `إضافة منصة تواصل اجتماعي: ${newLink.name} (${newLink.url})`);
      res.status(201).json(newLink);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل في إضافة منصة التواصل' });
    }
  });

  app.put('/api/admin/social-links/reorder', requireAdmin, requirePermission(['social.manage', 'settings.manage']), (req, res) => {
    try {
      const items = req.body.items || req.body;
      const updated = db.reorderSocialLinks(items);
      logAudit(req, 'Social Links', 'SocialLink', 'reorder', 'إعادة ترتيب منصات التواصل الاجتماعي');
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل في إعادة ترتيب منصات التواصل' });
    }
  });

  app.put('/api/admin/social-links/:id', requireAdmin, requirePermission(['social.manage', 'settings.manage']), (req, res) => {
    try {
      const updated = db.updateSocialLink(req.params.id, req.body);
      logAudit(req, 'Social Links', 'SocialLink', req.params.id, `تحديث منصة تواصل اجتماعي: ${updated.name}`);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل في تحديث منصة التواصل' });
    }
  });

  app.delete('/api/admin/social-links/:id', requireAdmin, requirePermission(['social.manage', 'settings.manage']), (req, res) => {
    try {
      const result = db.deleteSocialLink(req.params.id);
      logAudit(req, 'Delete', 'SocialLink', req.params.id, `حذف منصة تواصل اجتماعي ID: ${req.params.id}`);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل في حذف منصة التواصل' });
    }
  });

  // Mark all notifications as read
  app.post('/api/admin/notifications/read-all', requireAdmin, requirePermission('settings.manage'), (req, res) => {
    try {
      db.markAllNotificationsRead();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update notifications' });
    }
  });

  // Production Cleanup Endpoint (Store preparation for launch)
  app.post('/api/admin/cleanup', requireAdmin, requirePermission('settings.manage'), (req, res) => {
    try {
      const {
        deleteOrders,
        deleteCustomers,
        deleteNotifications,
        deleteLogs,
        deleteReviews,
        deleteCoupons,
        deleteProducts
      } = req.body;

      db.cleanupDb({
        deleteOrders: !!deleteOrders,
        deleteCustomers: !!deleteCustomers,
        deleteNotifications: !!deleteNotifications,
        deleteLogs: !!deleteLogs,
        deleteReviews: !!deleteReviews,
        deleteCoupons: !!deleteCoupons,
        deleteProducts: !!deleteProducts
      });

      logAudit(req, 'Delete', 'System', 'cleanup', 'تنفيذ عملية تهيئة وتطهير قاعدة البيانات للإنطلاق');

      res.json({ success: true, message: 'تم تهيئة وتطهير قاعدة البيانات بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشلت عملية تهيئة المتجر', message: err.message });
    }
  });

  // ==========================================
  // 📸 PROFESSIONAL IMAGE UPLOADER ENDPOINTS
  // ==========================================
  const UPLOAD_DIR = path.join(process.cwd(), 'public/uploads');
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // Serve uploads statically
  app.use('/uploads', express.static(UPLOAD_DIR));

  const storage = multer.memoryStorage();
  const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('نوع الملف غير مدعوم. يرجى رفع صور بصيغة jpg, jpeg, png, webp فقط.'));
      }
    }
  });

  // ==========================================
  // 📁 PROFESSIONAL MEDIA LIBRARY ENDPOINTS
  // ==========================================

  // 1. Get all media items with dynamic live usages
  app.get('/api/admin/media', requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const items = db.getMedia();
      const itemsWithUsages = items.map(item => {
        const usages = db.getImageUsage(item.url);
        return {
          ...item,
          usedBy: usages
        };
      });
      res.json({ success: true, media: itemsWithUsages });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب ملفات الوسائط', message: err.message });
    }
  });

  // 2. Upload media file securely with WebP conversion, thumbnailing, and duplicate hash check
  app.post('/api/admin/media/upload', requireAdmin, requirePermission('media.manage'), (req, res, next) => {
    upload.single('image')(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'فشل رفع الملف' });
      }

      try {
        if (!req.file) {
          return res.status(400).json({ error: 'لم يتم اختيار أي صورة للرفع' });
        }

        // Validate MIME type is definitely an image and not an executable
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          return res.status(400).json({ error: 'نوع الملف غير مدعوم. يرجى رفع صور صالحة فقط.' });
        }

        const fileBuffer = req.file.buffer;
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

        // Prevent duplicate uploads - detect duplicate hashes
        const existing = db.getMediaByHash(hash);
        if (existing) {
          // Check if file physically exists, if so return existing record
          const relativePath = existing.url.replace(/^\//, '');
          const fullPath = path.join(process.cwd(), 'public', relativePath);
          if (fs.existsSync(fullPath)) {
            const usages = db.getImageUsage(existing.url);
            return res.json({
              success: true,
              media: {
                ...existing,
                usedBy: usages
              },
              isDuplicate: true,
              message: 'تم التعرف على الصورة؛ هذه الصورة مرفوعة مسبقاً.'
            });
          }
        }

        // Process WebP conversion and fetch dimensions
        const webpBuffer = await sharp(fileBuffer).toFormat('webp').toBuffer();
        const imageMeta = await sharp(fileBuffer).metadata();
        const width = imageMeta.width || 0;
        const height = imageMeta.height || 0;

        // Generate thumbnail
        const thumbnailBuffer = await sharp(fileBuffer)
          .resize(150, 150, { fit: 'cover' })
          .toFormat('webp')
          .toBuffer();

        // Write files to public/uploads
        const filename = `${hash}.webp`;
        const destPath = path.join(UPLOAD_DIR, filename);
        fs.writeFileSync(destPath, webpBuffer);

        const thumbFilename = `${hash}_thumb.webp`;
        const thumbDestPath = path.join(UPLOAD_DIR, thumbFilename);
        fs.writeFileSync(thumbDestPath, thumbnailBuffer);

        // Save metadata
        const mediaItem = {
          id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          filename: req.file.originalname,
          url: `/uploads/${filename}`,
          thumbnailUrl: `/uploads/${thumbFilename}`,
          size: webpBuffer.length,
          type: 'image/webp',
          dimensions: { width, height },
          uploadDate: new Date().toISOString(),
          hash: hash,
          title: req.file.originalname.substring(0, req.file.originalname.lastIndexOf('.')) || req.file.originalname,
          folder: ''
        };

        db.addMedia(mediaItem);
        const usages = db.getImageUsage(mediaItem.url);

        logAudit(req, 'Media Operations', 'Media', mediaItem.id, `رفع ملف وسائط جديد: ${mediaItem.filename}`);

        res.json({
          success: true,
          media: {
            ...mediaItem,
            usedBy: usages
          }
        });
      } catch (uploadErr: any) {
        console.error('Image upload processor error:', uploadErr);
        res.status(500).json({ error: 'فشل معالجة وتخزين الصورة', message: uploadErr.message });
      }
    });
  });

  // 3. Rename media item title
  app.post('/api/admin/media/rename', requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const { id, title } = req.body;
      if (!id || !title) {
        return res.status(400).json({ error: 'معرف الملف والاسم الجديد مطلوبان' });
      }

      const updated = db.renameMedia(id, title);
      if (!updated) {
        return res.status(404).json({ error: 'الملف غير موجود' });
      }

      logAudit(req, 'Media Operations', 'Media', id, `تعديل اسم ملف وسائط إلى: ${title}`);

      const usages = db.getImageUsage(updated.url);
      res.json({
        success: true,
        media: {
          ...updated,
          usedBy: usages
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل تعديل الاسم', message: err.message });
    }
  });

  // 4. Replace media file contents while maintaining metadata ID
  app.post('/api/admin/media/replace', requireAdmin, requirePermission('media.manage'), (req, res, next) => {
    upload.single('image')(req, res, async (err: any) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'فشل رفع الملف' });
      }

      try {
        const { id } = req.body;
        if (!id) {
          return res.status(400).json({ error: 'معرف الملف المراد استبداله مطلوب' });
        }

        const mediaItem = db.getMediaById(id);
        if (!mediaItem) {
          return res.status(404).json({ error: 'الملف غير موجود' });
        }

        if (!req.file) {
          return res.status(400).json({ error: 'يرجى اختيار ملف جديد للاستبدال' });
        }

        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          return res.status(400).json({ error: 'نوع الملف غير مدعوم. يرجى رفع صور صالحة فقط.' });
        }

        const fileBuffer = req.file.buffer;
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');

        // Check if hash matches another existing media item
        const existing = db.getMediaByHash(hash);
        if (existing && existing.id !== id) {
          return res.status(400).json({ error: 'الملف الجديد متطابق تماماً مع ملف آخر مرفوع مسبقاً.' });
        }

        // Process WebP & Thumbnail
        const webpBuffer = await sharp(fileBuffer).toFormat('webp').toBuffer();
        const imageMeta = await sharp(fileBuffer).metadata();
        const width = imageMeta.width || 0;
        const height = imageMeta.height || 0;

        const thumbnailBuffer = await sharp(fileBuffer)
          .resize(150, 150, { fit: 'cover' })
          .toFormat('webp')
          .toBuffer();

        const filename = `${hash}.webp`;
        const destPath = path.join(UPLOAD_DIR, filename);
        fs.writeFileSync(destPath, webpBuffer);

        const thumbFilename = `${hash}_thumb.webp`;
        const thumbDestPath = path.join(UPLOAD_DIR, thumbFilename);
        fs.writeFileSync(thumbDestPath, thumbnailBuffer);

        // Unlink old files if different
        const oldRelativePath = mediaItem.url.replace(/^\//, '');
        const oldFullPath = path.join(process.cwd(), 'public', oldRelativePath);
        if (oldFullPath !== destPath && fs.existsSync(oldFullPath)) {
          try {
            fs.unlinkSync(oldFullPath);
          } catch (e) {
            console.error('Failed to unlink old file on replace:', e);
          }
        }

        const oldThumbRelativePath = mediaItem.thumbnailUrl.replace(/^\//, '');
        const oldThumbFullPath = path.join(process.cwd(), 'public', oldThumbRelativePath);
        if (oldThumbFullPath !== thumbDestPath && fs.existsSync(oldThumbFullPath)) {
          try {
            fs.unlinkSync(oldThumbFullPath);
          } catch (e) {
            console.error('Failed to unlink old thumb on replace:', e);
          }
        }

        // Update record
        const updated = db.updateMediaFields(id, {
          url: `/uploads/${filename}`,
          thumbnailUrl: `/uploads/${thumbFilename}`,
          size: webpBuffer.length,
          dimensions: { width, height },
          hash: hash,
          uploadDate: new Date().toISOString()
        });

        if (!updated) {
          return res.status(500).json({ error: 'فشل تحديث بيانات الملف في قاعدة البيانات' });
        }

        logAudit(req, 'Media Operations', 'Media', id, `استبدال محتوى ملف وسائط: ${updated.filename}`);

        const usages = db.getImageUsage(updated.url);
        res.json({
          success: true,
          media: {
            ...updated,
            usedBy: usages
          }
        });
      } catch (uploadErr: any) {
        console.error('Image replace error:', uploadErr);
        res.status(500).json({ error: 'فشل استبدال الصورة', message: uploadErr.message });
      }
    });
  });

  // 5. Delete single media item with usage validation
  app.post('/api/admin/media/delete', requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'معرف الملف مطلوب' });
      }

      const mediaItem = db.getMediaById(id);
      if (!mediaItem) {
        return res.status(404).json({ error: 'الملف غير موجود' });
      }

      db.deleteMedia(id);

      logAudit(req, 'Media Operations', 'Media', id, `حذف ملف وسائط: ${mediaItem.filename}`);

      res.json({ success: true, message: 'تم حذف الملف بنجاح' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل حذف الملف' });
    }
  });

  // 6. Bulk delete media items with individual checks
  app.post('/api/admin/media/bulk-delete', requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد ملفات للحذف' });
      }

      const errors: string[] = [];
      let deletedCount = 0;

      for (const id of ids) {
        try {
          const item = db.getMediaById(id);
          if (item) {
            db.deleteMedia(id);
            deletedCount++;
          }
        } catch (err: any) {
          const item = db.getMediaById(id);
          const name = item ? (item.title || item.filename) : id;
          errors.push(`الملف "${name}": ${err.message}`);
        }
      }

      logAudit(req, 'Media Operations', 'Media', 'bulk', `حذف جماعي لـ ${deletedCount} ملف وسائط`);

      if (errors.length > 0 && deletedCount === 0) {
        return res.status(400).json({ error: errors.join('\n') });
      }

      res.json({
        success: true,
        message: `تم حذف ${deletedCount} ملف بنجاح.`,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف الملفات المحددة', message: err.message });
    }
  });

  // 7. Bulk move/tag media items for folder organization
  app.post('/api/admin/media/bulk-move', requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const { ids, folder } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'يرجى تحديد الملفات المراد نقلها' });
      }

      let movedCount = 0;
      for (const id of ids) {
        const item = db.getMediaById(id);
        if (item) {
          db.updateMediaFields(id, { folder: folder || '' });
          movedCount++;
        }
      }

      res.json({ success: true, message: `تم نقل ${movedCount} ملف بنجاح` });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل نقل الملفات المحددة', message: err.message });
    }
  });

  // 8. Media Folders - Get all folders with counts
  app.get(['/api/admin/media/folders', '/api/media/folders'], requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const folders = db.getMediaFolders();
      const media = db.getMedia();
      const enrichedFolders = folders.map(f => ({
        ...f,
        count: media.filter(m => m.folderId === f.id || m.folder === f.name).length
      }));
      res.json({ success: true, folders: enrichedFolders });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل جلب مجلدات الوسائط', message: err.message });
    }
  });

  // 9. Media Folders - Create a new folder
  app.post(['/api/admin/media/folders', '/api/media/folders'], requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'اسم المجلد مطلوب' });
      }

      const trimmedName = name.trim();
      const existing = db.getMediaFolders().find(f => f.name.toLowerCase() === trimmedName.toLowerCase());
      if (existing) {
        return res.status(400).json({ error: 'يوجد مجلد آخر بنفس هذا الاسم بالفعل' });
      }

      const newFolder = {
        id: `folder_${Date.now()}`,
        name: trimmedName,
        count: 0,
        isSystem: false,
        createdAt: new Date().toISOString()
      };

      db.addMediaFolder(newFolder);
      logAudit(req, 'Media Operations', 'MediaFolder', newFolder.id, `إنشاء مجلد وسائط جديد: ${newFolder.name}`);
      res.status(201).json(newFolder);
    } catch (err: any) {
      res.status(500).json({ error: 'فشل إنشاء المجلد', message: err.message });
    }
  });

  // 10. Media Folders - Rename custom folder
  app.put(['/api/admin/media/folders/:id', '/api/media/folders/:id'], requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'معرف المجلد مطلوب' });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'اسم المجلد الجديد مطلوب' });
      }

      const result = db.renameMediaFolder(id, name.trim());
      if (!result.success && result.message) {
        return res.status(400).json({ error: result.message });
      }

      logAudit(req, 'Media Operations', 'MediaFolder', id, `إعادة تسمية مجلد الوسائط إلى: ${name.trim()}`);
      res.json({ success: true, folder: result.folder });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل تعديل اسم المجلد' });
    }
  });

  // 11. Media Folders - Delete custom folder (with safe check & moveToRoot)
  app.delete(['/api/admin/media/folders/:id', '/api/media/folders/:id'], requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const { id } = req.params;
      const moveToRoot = req.query.moveToRoot === 'true' || req.body?.moveToRoot === true;

      if (!id) {
        return res.status(400).json({ error: 'معرف المجلد مطلوب' });
      }

      const result = db.deleteMediaFolder(id, { moveToRoot });
      if (!result.success) {
        if ((result as any).blocked) {
          return res.status(409).json({
            error: result.message,
            blocked: true,
            itemCount: (result as any).itemCount
          });
        }
        return res.status(400).json({ error: result.message || 'فشل حذف المجلد' });
      }

      logAudit(req, 'Media Operations', 'MediaFolder', id, `حذف مجلد وسائط: ${id}`);
      res.json({ success: true, id, movedCount: (result as any).movedCount });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'فشل حذف المجلد' });
    }
  });

  // Image Upload Endpoint with error handling and robust logging (Hardened with Sharp)
  app.post('/api/admin/upload', requireAdmin, requirePermission('media.manage'), (req, res, next) => {
    try {
      upload.single('image')(req, res, async (multerErr: any) => {
        if (multerErr) {
          return res.status(400).json({ 
            success: false,
            error: multerErr.message || 'Multer file parsing failed'
          });
        }
        
        try {
          if (!req.file) {
            return res.status(400).json({ 
              success: false,
              error: 'لم يتم اختيار أي صورة للرفع'
            });
          }

          // Verify file size limit (5MB)
          const MAX_SIZE = 5 * 1024 * 1024;
          if (req.file.size > MAX_SIZE) {
            return res.status(400).json({
              success: false,
              error: `حجم الصورة كبير جداً (${req.file.size} bytes). الحد الأقصى المسموح به هو 5 ميجابايت.`
            });
          }

          const fileBuffer = req.file.buffer;

          // Validate actual image content with Sharp (rejects HTML, SVG, JS, Executables, Polyglots)
          let imageMeta;
          try {
            imageMeta = await sharp(fileBuffer).metadata();
          } catch (sharpErr) {
            return res.status(400).json({
              success: false,
              error: 'الملف المرفوع تالف أو ليس صورة صالحة'
            });
          }

          const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
          if (!imageMeta || !imageMeta.format || !allowedFormats.includes(imageMeta.format.toLowerCase())) {
            return res.status(400).json({
              success: false,
              error: 'صيغة الصورة غير مدعومة. يرجى رفع صور بصيغة jpg, jpeg, png, webp, gif فقط'
            });
          }

          // Re-encode to safe WebP to sanitize binary payload completely
          const webpBuffer = await sharp(fileBuffer).toFormat('webp', { quality: 90 }).toBuffer();
          const fileHash = crypto.createHash('md5').update(webpBuffer).digest('hex');
          const filename = `${fileHash}.webp`;
          const destPath = path.join(UPLOAD_DIR, filename);

          // Prevent duplicate uploads
          if (!fs.existsSync(destPath)) {
            fs.writeFileSync(destPath, webpBuffer);
          }

          // Generate thumbnail for media library consistency
          const thumbFilename = `${fileHash}_thumb.webp`;
          const thumbDestPath = path.join(UPLOAD_DIR, thumbFilename);
          if (!fs.existsSync(thumbDestPath)) {
            try {
              const thumbnailBuffer = await sharp(fileBuffer)
                .resize(150, 150, { fit: 'cover' })
                .toFormat('webp')
                .toBuffer();
              fs.writeFileSync(thumbDestPath, thumbnailBuffer);
            } catch (thumbErr) {}
          }

          // Auto-sync into media database if not present
          const existingMedia = db.getMediaByHash(fileHash);
          if (!existingMedia) {
            try {
              const width = imageMeta.width || 0;
              const height = imageMeta.height || 0;
              const mediaItem = {
                id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                filename: req.file.originalname || filename,
                url: `/uploads/${filename}`,
                thumbnailUrl: `/uploads/${thumbFilename}`,
                size: webpBuffer.length,
                type: 'image/webp',
                dimensions: { width, height },
                uploadDate: new Date().toISOString(),
                hash: fileHash,
                title: req.file.originalname?.substring(0, req.file.originalname.lastIndexOf('.')) || filename,
                folder: ''
              };
              db.addMedia(mediaItem);
            } catch (mediaErr) {}
          }

          const imageUrl = `/uploads/${filename}`;
          res.json({ success: true, url: imageUrl });
        } catch (uploadErr: any) {
          res.status(500).json({ 
            success: false,
            error: uploadErr.message || 'فشل تخزين الصورة المرفوعة'
          });
        }
      });
    } catch (outerErr: any) {
      res.status(500).json({
        success: false,
        error: outerErr.message || 'حدث خطأ غير متوقع أثناء معالجة الصورة'
      });
    }
  });

  // Image Delete Endpoint
  app.post('/api/admin/upload/delete', requireAdmin, requirePermission('media.manage'), (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.startsWith('/uploads/')) {
        return res.status(400).json({ error: 'مسار غير صالح لحذف الصورة' });
      }

      const relativePath = url.replace(/^\//, '');
      const fullPath = path.join(process.cwd(), 'public', relativePath);

      // Verify if the image is used by any product or setting before deleting
      const products = db.getProducts();
      const isUsed = products.some(p => p.mainImage === url || (Array.isArray(p.images) && p.images.includes(url)));
      const settings = db.getSettings();
      const isUsedInCMS = settings.bannerImage === url;

      if (isUsed || isUsedInCMS) {
        return res.json({ success: true, message: 'الصورة مستخدمة في منتج آخر، تم إلغاء ربطها فقط' });
      }

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      res.json({ success: true, message: 'تم حذف الصورة بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'فشل حذف الصورة من الخادم', message: err.message });
    }
  });

  // ==========================================
  // 📈 SEO ENGINE & WEB MASTER TOOLS
  // ==========================================

  // 1. Robots.txt Endpoint
  app.get('/robots.txt', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/admin

Sitemap: ${baseUrl}/sitemap.xml
`);
  });

  // 2. Dynamic XML Sitemap Endpoint
  app.get('/sitemap.xml', (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const products = db.getProducts();
      
      const staticPages = [
        '',
        '/products',
        '/cart',
        '/wishlist',
        '/track-order',
        '/faq',
        '/about',
        '/contact'
      ];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      // Static routes
      staticPages.forEach(routePath => {
        const priority = routePath === '' ? '1.0' : '0.8';
        const changefreq = 'daily';
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}${routePath}</loc>\n`;
        xml += `    <changefreq>${changefreq}</changefreq>\n`;
        xml += `    <priority>${priority}</priority>\n`;
        xml += `  </url>\n`;
      });

      // Product routes
      products.forEach(p => {
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/product/${p.id}</loc>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.9</priority>\n`;
        xml += `  </url>\n`;
      });

      xml += `</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch (err: any) {
      res.status(500).send('Sitemap generation failed');
    }
  });

  // 3. Dynamic HTML SEO Pre-renderer Middleware
  const handleSeoPageRequest = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Only handle GET requests accepting HTML, excluding api/assets/files
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api/') ||
      req.path.includes('.')
    ) {
      return next();
    }

    const acceptHeader = req.headers.accept || '';
    if (!acceptHeader.includes('text/html') && !acceptHeader.includes('*/*')) {
      return next();
    }

    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const currentUrl = `${baseUrl}${req.originalUrl}`;
      const settings = db.getSettings();
      const storeName = settings?.logoText || 'متجر النخبة';
      const storeSubtext = settings?.logoSubtext || 'للأجهزة المنزلية والكهربائية';
      const contactPhone = settings?.contactPhone || '';
      const contactEmail = settings?.contactEmail || '';
      const contactAddress = settings?.contactAddress || '';

      let title = `${storeName} | ${storeSubtext} - أفضل الأجهزة المنزلية في مصر`;
      let description = `تسوق من ${storeName} أحدث الأجهزة المنزلية والكهربائية، شاشات التلفزيون، التكييفات، وأجهزة المطبخ بأفضل الأسعار في مصر. شحن سريع لجميع المحافظات والدفع عند الاستلام مع ضمان حقيقي.`;
      let keywords = 'أجهزة منزلية, أجهزة كهربائية, تلفزيونات, غسالات, ثلاجات, تكييفات, خلاطات, متجر النخبة, مصر';
      let ogType = 'website';
      let ogImage = settings?.bannerImage || `${baseUrl}/logo.png`;
      const schemas: any[] = [];

      // Detect path matching
      const pathClean = req.path.toLowerCase().replace(/\/$/, '') || '/';
      
      if (pathClean === '/') {
        title = `${storeName} - ${storeSubtext} | أفضل العروض والأسعار في مصر`;
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'OnlineStore',
          '@id': `${baseUrl}/#store`,
          'name': storeName,
          'description': storeSubtext,
          'url': baseUrl,
          'logo': ogImage,
          'telephone': contactPhone,
          'email': contactEmail,
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': contactAddress,
            'addressCountry': 'EG'
          },
          'priceRange': '$$$'
        });
      } else if (pathClean === '/products') {
        title = `جميع الأجهزة المنزلية والكهربائية | عروض حصرية - ${storeName}`;
        description = `تصفح تشكيلة واسعة من الأجهزة الكهربائية والمنزلية من ماركات عالمية بأسعار منافسة وعروض يومية متجددة في مصر.`;
      } else if (pathClean.startsWith('/product/')) {
        const parts = req.path.split('/');
        const productId = parts[parts.length - 1];
        if (productId) {
          const product = db.getProductById(productId);
          if (product) {
            const currentPrice = product.discountPrice || product.price;
            const hasDiscount = !!product.discountPrice && product.discountPrice < product.price;
            title = `${product.title} - اشتري الآن بأفضل سعر في مصر | ${product.brand}`;
            description = `شراء ${product.title} من ماركة ${product.brand}. السعر الحالي: ${currentPrice} ج.م ${hasDiscount ? `(خصم من ${product.price} ج.م)` : ''}. تصفح ميزات الجهاز، التقييمات، المواصفات الفنية مع شحن لجميع محافظات مصر والدفع عند الاستلام.`;
            keywords = `${product.title}, ${product.titleEn || ''}, ${product.brand}, ${product.category}, ${product.tags ? product.tags.join(', ') : ''}`;
            ogType = 'product';
            ogImage = product.mainImage.startsWith('http') ? product.mainImage : `${baseUrl}${product.mainImage}`;
            
            schemas.push({
              '@context': 'https://schema.org',
              '@type': 'Product',
              'name': product.title,
              'image': [ogImage],
              'description': product.description,
              'sku': product.sku || `SKU-${product.id}`,
              'brand': {
                '@type': 'Brand',
                'name': product.brand
              },
              'offers': {
                '@type': 'Offer',
                'url': currentUrl,
                'priceCurrency': 'EGP',
                'price': currentPrice,
                'availability': product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
              }
            });
          }
        }
      } else if (pathClean === '/about') {
        title = `من نحن - قصة متجرنا ورؤيتنا 🌟 | ${storeName}`;
        description = `تعرف على ${storeName}، منصتك الموثوقة الأولى لشراء وتجهيز منزلك بأحدث الأجهزة الكهربائية والمنزلية الأصلية في مصر.`;
      } else if (pathClean === '/contact') {
        title = `اتصل بنا - خدمة العملاء والدعم المباشر 📞 | ${storeName}`;
        description = `تواصل مع فريق خدمة عملاء ${storeName} عبر الهاتف أو البريد الإلكتروني. يسعدنا الرد على جميع استفساراتكم ومساعدتكم.`;
      } else if (pathClean === '/faq') {
        title = `الأسئلة الشائعة والدعم الفني ❓ | كيف يمكننا مساعدتك - ${storeName}`;
        description = `إجابات شاملة لجميع استفساراتكم حول طرق الدفع، الشحن، التوصيل، سياسات الضمان والاسترجاع للأجهزة المنزلية بمتجرنا.`;
      }

      // Pre-build SEO head replacement string
      const seoHead = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="keywords" content="${keywords}" />
    <link rel="canonical" href="${currentUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:url" content="${currentUrl}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="${storeName}" />
    <meta property="og:locale" content="ar_EG" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${ogImage}" />
    ${schemas.map(s => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n')}
      `;

      // Read index.html
      let templatePath = '';
      if (process.env.NODE_ENV !== 'production') {
        templatePath = path.join(process.cwd(), 'index.html');
      } else {
        templatePath = path.join(process.cwd(), 'dist', 'index.html');
      }

      if (!fs.existsSync(templatePath)) {
        return next();
      }

      let html = fs.readFileSync(templatePath, 'utf-8');

      // If development, apply Vite HTML transformation
      if (process.env.NODE_ENV !== 'production' && (req as any).vite) {
        html = await (req as any).vite.transformIndexHtml(req.originalUrl, html);
      }

      // Perform replacement of title and injection of meta
      let processedHtml = html.replace(/<title>.*?<\/title>/gi, '');
      processedHtml = processedHtml.replace(/<head>/i, `<head>\n${seoHead}`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(processedHtml);
    } catch (err) {
      console.error('SEO pre-rendering failed:', err);
      next();
    }
  };

  // Bind SEO HTML pre-renderer to page wildcards
  app.get('*', handleSeoPageRequest);

  // ==========================================
  // ⚡ VITE MIDDLEWARE SETUP & STATIC SERVER
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    // Inject vite instance for transformIndexHtml in development
    app.use((req: any, res, next) => {
      req.vite = vite;
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express custom server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal dev server crash:', err);
});
