import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { db, verifyPassword, hashPassword } from './server/db.js';
import { askAssistant } from './server/gemini.js';
import { Order, OrderStatus, Product } from './src/types.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ==========================================
  // 🛡️ SECURITY MIDDLEWARES & UTILITIES
  // ==========================================

  // 1. HTTP Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' https://ai.studio https://*.run.app https://*.google.com;");
    res.removeHeader('X-Powered-By');
    next();
  });

  // 2. CORS Handling
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // 3. Rate Limiter implementation (In-Memory)
  const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
  
  const createRateLimiter = (limit: number, windowMs: number, message: string) => {
    return (req: any, res: any, next: any) => {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const key = `${req.path}:${ip}`;
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

  const loginRateLimiter = createRateLimiter(5, 60 * 1000, 'محاولات دخول كثيرة جداً. يرجى الانتظار لمدة دقيقة قبل المحاولة مجدداً.');
  const assistRateLimiter = createRateLimiter(10, 60 * 1000, 'لقد تجاوزت الحد المسموح به لطلبات المساعد الذكي. يرجى المحاولة بعد دقيقة.');
  const checkoutRateLimiter = createRateLimiter(10, 5 * 60 * 1000, 'عدد طلبات شراء كثيرة جداً من هذا الجهاز. يرجى الانتظار قليلاً.');
  const reviewRateLimiter = createRateLimiter(5, 60 * 1000, 'لقد قمت بإضافة العديد من التقييمات مؤخراً. يرجى المحاولة لاحقاً.');

  // 4. Input Sanitization Utilities to prevent XSS and Proto-Pollution
  const sanitizeValue = (val: any): any => {
    if (typeof val === 'string') {
      return val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
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

  // Get store settings / CMS details
  app.get('/api/settings', (req, res) => {
    try {
      const settings = db.getSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve settings', message: err.message });
    }
  });

  // Get all active categories
  app.get('/api/categories', (req, res) => {
    try {
      const products = db.getProducts();
      const categories = Array.from(new Set(products.map(p => p.category)));
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  });

  // Get all active brands
  app.get('/api/brands', (req, res) => {
    try {
      const products = db.getProducts();
      const brands = Array.from(new Set(products.map(p => p.brand)));
      res.json(brands);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch brands' });
    }
  });

  // Get products with filters, search, and sorting
  app.get('/api/products', (req, res) => {
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

      // Filter by search query (Smart Search: title, brand, sku, tags)
      if (search) {
        const query = (search as string).toLowerCase().trim();
        products = products.filter(p => 
          p.title.toLowerCase().includes(query) || 
          p.brand.toLowerCase().includes(query) || 
          p.sku.toLowerCase().includes(query) ||
          p.tags.some(t => t.toLowerCase().includes(query)) ||
          (p.titleEn && p.titleEn.toLowerCase().includes(query))
        );
      }

      // Filter by price range
      if (minPrice) {
        products = products.filter(p => (p.discountPrice || p.price) >= Number(minPrice));
      }
      if (maxPrice) {
        products = products.filter(p => (p.discountPrice || p.price) <= Number(maxPrice));
      }

      // Filter by rating
      if (rating) {
        products = products.filter(p => p.rating >= Number(rating));
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
      if (sort) {
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
            // Best selling / Featured first
            products.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        }
      }

      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch products' });
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

  // Post a review for a product
  app.post('/api/products/:id/reviews', reviewRateLimiter, (req, res) => {
    try {
      const { userName, rating, comment } = req.body;
      if (!userName || !rating || !comment) {
        return res.status(400).json({ error: 'Missing required review fields' });
      }

      const product = db.getProductById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const newReview = {
        id: `rev-${Date.now()}`,
        userName,
        rating: Number(rating),
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
      db.logAction('Review', 'إضافة تقييم', `قام العميل ${userName} بتقييم المنتج ${product.title} بـ ${rating} نجوم`);

      res.status(201).json(newReview);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to submit review' });
    }
  });

  // Validate discount coupon
  app.get('/api/coupons/validate', (req, res) => {
    try {
      const { code, cartTotal } = req.query;
      if (!code) {
        return res.status(400).json({ error: 'Coupon code is required' });
      }

      const coupon = db.getCouponByCode(code as string);
      if (!coupon) {
        return res.status(404).json({ error: 'الكوبون المدخل غير صحيح أو انتهت صلاحيته' });
      }

      if (cartTotal && coupon.minOrderValue && Number(cartTotal) < coupon.minOrderValue) {
        return res.status(400).json({ error: `الحد الأدنى لتفعيل الكوبون هو ${coupon.minOrderValue} ج.م` });
      }

      res.json(coupon);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to validate coupon' });
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

  // Track an order by ID or Phone
  app.get('/api/orders/track', (req, res) => {
    try {
      const { id, phone } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'رقم الفاتورة أو معرف الطلب مطلوب' });
      }

      const order = db.getOrderById(id as string);
      if (!order) {
        return res.status(404).json({ error: 'عذراً، لم نجد أي طلب مطابق للبيانات المدخلة' });
      }

      // If phone is provided, double check it matches for security
      if (phone && order.customer.phone !== phone && order.customer.altPhone !== phone) {
        return res.status(403).json({ error: 'رقم الهاتف المدخل لا يتطابق مع هذا الطلب' });
      }

      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to track order' });
    }
  });

  // Checkout submit (Cash on Delivery)
  app.post('/api/orders', checkoutRateLimiter, (req, res) => {
    try {
      const { customer, items, couponCode, discountAmount } = req.body;
      if (!customer || !items || !items.length) {
        return res.status(400).json({ error: 'بيانات العميل أو السلة فارغة' });
      }

      const settings = db.getSettings();
      const taxAmount = Number((items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0) * settings.taxRate).toFixed(2));
      const subtotal = items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
      const shippingCost = settings.shippingFlatRate;
      const total = Number((subtotal + taxAmount + shippingCost - (discountAmount || 0)).toFixed(2));

      const newId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const newOrder: Order = {
        id: newId,
        invoiceNumber: `INV-2026-${newId.split('-')[1]}`,
        date: new Date().toISOString(),
        customer,
        items,
        couponCode,
        discountAmount: discountAmount || 0,
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
      res.status(201).json(savedOrder);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create order', message: err.message });
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
  // 🛡️ ADMIN PANEL ENDPOINTS & AUTHENTICATION
  // ==========================================

  // Admin login endpoint with brute-force rate limit protection
  app.post('/api/admin/login', loginRateLimiter, (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
      }

      const admin = db.getAdmin();
      if (!admin) {
        return res.status(500).json({ error: 'لم يتم العثور على حساب مسؤول النظام في قاعدة البيانات' });
      }

      if (email.trim().toLowerCase() === admin.email.toLowerCase() && verifyPassword(password, admin.passwordHash, admin.salt)) {
        // Generate secure cryptographically random dynamic session token
        const sessionToken = crypto.randomBytes(32).toString('hex');
        activeSessions.set(sessionToken, {
          email: admin.email,
          expiresAt: Date.now() + SESSION_EXPIRY_MS
        });

        res.json({
          success: true,
          token: sessionToken,
          admin: {
            name: 'أحمد الإدريسي',
            email: admin.email
          }
        });
      } else {
        res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
      }
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء محاولة تسجيل الدخول' });
    }
  });

  // Protect Admin dashboard routes with cryptographically secure sliding-window session checks
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
    next();
  };

  // Admin change password endpoint
  app.put('/api/admin/change-password', requireAdmin, (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبة' });
      }

      const admin = db.getAdmin();
      if (!admin) {
        return res.status(500).json({ error: 'حساب المدير غير موجود' });
      }

      if (!verifyPassword(currentPassword, admin.passwordHash, admin.salt)) {
        return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
      }

      // Hash the new password
      const hashed = hashPassword(newPassword);
      db.updateAdminPassword(hashed.hash, hashed.salt);

      res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
    } catch (err: any) {
      res.status(500).json({ error: 'حدث خطأ أثناء محاولة تغيير كلمة المرور', message: err.message });
    }
  });

  // Admin session logout endpoint
  app.post('/api/admin/logout', (req, res) => {
    try {
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

  // Get Admin stats & analytics dashboard reports
  app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
    try {
      const orders = db.getOrders();
      const products = db.getProducts();
      const logs = db.getLogs();
      const notifications = db.getNotifications();

      // Basic totals
      const totalRevenue = orders
        .filter(o => o.status !== 'Cancelled' && o.status !== 'Returned')
        .reduce((sum, o) => sum + o.total, 0);

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
          ordersCount: orders.length,
          pendingOrdersCount,
          lowStockProductsCount,
          totalProductsCount
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

  // Admin Manage products: ADD
  app.post('/api/admin/products', requireAdmin, (req, res) => {
    try {
      const prodData = req.body;
      if (!prodData.title || !prodData.price || !prodData.sku) {
        return res.status(400).json({ error: 'بيانات المنتج غير كافية' });
      }

      const id = `prod-${prodData.brand.toLowerCase()}-${Date.now()}`;
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
        price: Number(prodData.price),
        discountPrice: prodData.discountPrice ? Number(prodData.discountPrice) : undefined,
        rating: 5.0,
        reviewsCount: 0,
        reviews: [],
        sku: prodData.sku,
        stock: Number(prodData.stock || 10),
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
      res.status(201).json(added);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to add product' });
    }
  });

  // Admin Manage products: EDIT
  app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
    try {
      const updated = db.updateProduct(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update product' });
    }
  });

  // Admin Manage products: DELETE
  app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    try {
      const success = db.deleteProduct(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ success: true, message: 'تم حذف المنتج بنجاح من قاعدة البيانات' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  // Admin Orders List
  app.get('/api/admin/orders', requireAdmin, (req, res) => {
    try {
      res.json(db.getOrders());
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to load orders' });
    }
  });

  // Admin Update order status
  app.put('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
    try {
      const { status, reason } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const updated = db.updateOrderStatus(req.params.id, status as OrderStatus, reason);
      if (!updated) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // Admin CMS Settings Update
  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    try {
      const updated = db.updateSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  // Mark all notifications as read
  app.post('/api/admin/notifications/read-all', requireAdmin, (req, res) => {
    try {
      db.markAllNotificationsRead();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to update notifications' });
    }
  });

  // ==========================================
  // ⚡ VITE MIDDLEWARE SETUP & STATIC SERVER
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
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
