import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  body: any;
  expiry: number;
}

const cacheStore = new Map<string, CacheEntry>();

/**
 * وسيط التخزين المؤقت لاستجابات GET في الذاكرة (In-Memory Response Caching)
 * @param durationInSeconds مدة الصلاحية بالثواني
 */
export const routeCache = (durationInSeconds: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // تطبيق التخزين على طلبات GET فقط
    if (req.method !== 'GET') {
      return next();
    }

    const key = req.originalUrl || req.url;
    const cachedResponse = cacheStore.get(key);

    if (cachedResponse && cachedResponse.expiry > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      return res.send(cachedResponse.body);
    }

    res.setHeader('X-Cache', 'MISS');

    // اعتراض res.send لتخزين النتيجة قبل إرسالها
    const originalSend = res.send.bind(res);
    res.send = (body: any): Response => {
      if (res.statusCode === 200) {
        cacheStore.set(key, {
          body,
          expiry: Date.now() + durationInSeconds * 1000
        });
      }
      return originalSend(body);
    };

    next();
  };
};

/**
 * تفريغ الذاكرة المؤقتة عند إضافة أو تعديل أو حذف منتج
 */
export const clearRouteCache = (pattern?: string) => {
  if (!pattern) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.includes(pattern)) {
      cacheStore.delete(key);
    }
  }
};
