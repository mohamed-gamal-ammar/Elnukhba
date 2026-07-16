import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Product, Order, Coupon, ActivityLog, Notification, SystemSettings, FAQ, OrderStatus } from '../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  products: Product[];
  orders: Order[];
  coupons: Coupon[];
  faqs: FAQ[];
  logs: ActivityLog[];
  notifications: Notification[];
  settings: SystemSettings;
  admin?: {
    email: string;
    passwordHash: string;
    salt: string;
  };
}

export function hashPassword(password: string, salt: string = crypto.randomBytes(16).toString('hex')): { hash: string; salt: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return verifyHash === hash;
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
  { code: 'WELCOME10', discountType: 'percentage', value: 10, minOrderValue: 1000, isActive: true },
  { code: 'EGYPT500', discountType: 'fixed', value: 500, minOrderValue: 5000, isActive: true },
  { code: 'EID2026', discountType: 'percentage', value: 15, minOrderValue: 2000, isActive: true }
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
  { id: 'not-1', title: 'طلب جديد ORD-1004', message: 'طلب جديد من العميل هاني فريد بقيمة 6548 جنيه مصري في انتظار التأكيد.', type: 'order', isRead: false, timestamp: '2026-07-16T01:00:00.000Z' },
  { id: 'not-2', title: 'مخزون منخفض - تكييف كاريير', message: 'المخزن يحتوي على 5 وحدات فقط من تكييف كاريير إنفرتر 2.25 حصان.', type: 'stock', isRead: true, timestamp: '2026-07-15T15:30:00.000Z' },
  { id: 'not-3', title: 'تقييم إيجابي جديد', message: 'كتب العميل أحمد محمود مراجعة ممتازة من فئة 5 نجوم على شاشة إل جي OLED.', type: 'review', isRead: false, timestamp: '2026-07-15T12:10:00.000Z' }
];

// Initialize and Load DB helper
export function initDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const defaultAdmin = {
    email: 'admin@store.com',
    ...hashPassword('Admin@123456')
  };

  if (!fs.existsSync(DB_FILE)) {
    const defaultDb: DatabaseSchema = {
      products: seedProducts,
      orders: seedOrders,
      coupons: seedCoupons,
      faqs: seedFaqs,
      logs: seedLogs,
      notifications: seedNotifications,
      settings: seedSettings,
      admin: {
        email: defaultAdmin.email,
        passwordHash: defaultAdmin.hash,
        salt: defaultAdmin.salt
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
    return defaultDb;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content) as DatabaseSchema;
    if (!parsed.admin) {
      parsed.admin = {
        email: defaultAdmin.email,
        passwordHash: defaultAdmin.hash,
        salt: defaultAdmin.salt
      };
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
      admin: {
        email: defaultAdmin.email,
        passwordHash: defaultAdmin.hash,
        salt: defaultAdmin.salt
      }
    };
  }
}

// Save DB helper
export function saveDb(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to write database file', error);
  }
}

// Database helper functions for API
export const db = {
  getAdmin: () => {
    const data = initDb();
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
  addProduct: (product: Product) => {
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
    data.products[index] = { ...data.products[index], ...updatedFields };
    saveDb(data);
    db.logAction('Admin', 'تعديل منتج', `تم تعديل مواصفات المنتج: ${data.products[index].title}`);
    return data.products[index];
  },
  deleteProduct: (id: string) => {
    const data = initDb();
    const index = data.products.findIndex(p => p.id === id);
    if (index === -1) return false;
    const title = data.products[index].title;
    data.products.splice(index, 1);
    saveDb(data);
    db.logAction('Admin', 'حذف منتج', `تم حذف المنتج ${title} نهائياً من العرض`);
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
    data.orders.unshift(order); // Newest first

    // Deduct stock for products and variants
    order.items.forEach(item => {
      const prod = data.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.quantity);
        if (item.variantSku) {
          const variant = prod.variants.find(v => v.sku === item.variantSku);
          if (variant) {
            variant.stock = Math.max(0, variant.stock - item.quantity);
          }
        }
      }
    });

    // Create system notification
    const newNotification: Notification = {
      id: `not-${Date.now()}`,
      title: `طلب جديد ${order.id}`,
      message: `طلب جديد من العميل ${order.customer.name} بقيمة ${order.total} ج.م بانتظار تأكيد الشحن والاتصال الهاتفي.`,
      type: 'order',
      isRead: false,
      timestamp: new Date().toISOString()
    };
    data.notifications.unshift(newNotification);

    saveDb(data);
    db.logAction('Customer', 'تقديم طلب جديد', `تم تسجيل طلب بقيمة ${order.total} ج.م باسم العميل ${order.customer.name}`);
    return order;
  },
  updateOrderStatus: (id: string, status: OrderStatus, reason?: string) => {
    const data = initDb();
    const order = data.orders.find(o => o.id === id);
    if (!order) return null;

    order.status = status;
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
          data.notifications.push({
            id: `not-stock-${Date.now()}-${prod.id}`,
            title: `مخزون منخفض - ${prod.brand}`,
            message: `مخزون المنتج ${prod.title} منخفض للغاية (${prod.stock} حبة متبقية في المستودع).`,
            type: 'stock',
            isRead: false,
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    saveDb(data);
    db.logAction('Admin', 'تعديل حالة طلب', `تحديث حالة الطلب ${id} إلى [${status}]`);
    return order;
  },
  getCoupons: () => {
    const data = initDb();
    return data.coupons;
  },
  getCouponByCode: (code: string) => {
    const data = initDb();
    return data.coupons.find(c => c.code.toUpperCase() === code.toUpperCase() && c.isActive);
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
  getNotifications: () => {
    const data = initDb();
    return data.notifications;
  },
  markNotificationRead: (id: string) => {
    const data = initDb();
    const notif = data.notifications.find(n => n.id === id);
    if (notif) {
      notif.isRead = true;
      saveDb(data);
    }
    return true;
  },
  markAllNotificationsRead: () => {
    const data = initDb();
    data.notifications.forEach(n => n.isRead = true);
    saveDb(data);
    return true;
  },
  getSettings: () => {
    const data = initDb();
    return data.settings;
  },
  updateSettings: (newSettings: Partial<SystemSettings>) => {
    const data = initDb();
    data.settings = { ...data.settings, ...newSettings };
    saveDb(data);
    db.logAction('Admin', 'تحديث إعدادات المتجر', 'تم تعديل تفاصيل المتجر والأسعار الضريبية والشحن');
    return data.settings;
  }
};
