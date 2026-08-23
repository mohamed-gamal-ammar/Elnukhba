import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, Save, AlertCircle, RefreshCw, FileText, Plus, Edit, Trash2, 
  Eye, Search, CheckCircle, Calendar, User, BookOpen, 
  HelpCircle, Megaphone, ShieldCheck, X, Layers,
  Sparkles
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { SystemSettings } from '../types.js';
import {
  handleNumericKeyDown,
  handleNumericPaste,
  sanitizeNumericInput,
  validateNumericValue
} from '../lib/numericValidation.js';
import ImageUploader from './ImageUploader.js';
import AdminBanners from './AdminBanners.js';
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminButton,
  AdminBadge,
  AdminEmptyState,
  AdminLoading,
  AdminSearchInput,
  AdminTablePagination
} from './AdminUIComponents.js';
import { CustomSelect } from './CustomSelect.js';

export interface CMSItem {
  id: string;
  title: string;
  slug: string;
  type: 'page' | 'article' | 'announcement' | 'faq' | 'policy';
  status: 'published' | 'draft' | 'archived';
  author?: string;
  summary?: string;
  content: string;
  featuredImage?: string;
  viewsCount?: number;
  publishedAt?: string;
  updatedAt?: string;
  createdAt: string;
}

const INITIAL_CMS_ITEMS: CMSItem[] = [
  {
    id: 'cms-1',
    title: 'عن متجر الأجهزة الكهربائية (من نحن)',
    slug: 'about-us',
    type: 'page',
    status: 'published',
    author: 'فريق التحرير',
    summary: 'نبذة عن تاريخ المتجر وخدماتنا المعتمدة للأجهزة المنزلية والكهربائية الأصلية.',
    content: 'نحن الوجهة الأولى المعتمدة لتسوق الأجهزة المنزلية والكهربائية الأصلية بأفضل الأسعار مع خدمات التوصيل والتركيب والضمان المعتمد في جميع محافظات مصر. نقدم تشكيلة واسعة من كبرى الماركات العالمية والمحلية.',
    featuredImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80',
    viewsCount: 1420,
    publishedAt: '2026-01-10',
    createdAt: '2026-01-10'
  },
  {
    id: 'cms-2',
    title: 'الشروط والأحكام وسياسة الاستخدام',
    slug: 'terms-and-conditions',
    type: 'policy',
    status: 'published',
    author: 'الشؤون القانونية',
    summary: 'الشروط الرسمية للطلب والضمان وخدمات التوصيل والتركيب المعتمدة.',
    content: 'تنظم هذه الوثيقة كافة عمليات الشراء والدفع والتوصيل عبر المنصة. يلتزم المتجر بتقديم فواتير ضريبية رسمية وتوفير شهادات الضمان المعتمدة لكافة المنتجات المباعة.',
    viewsCount: 980,
    publishedAt: '2026-01-12',
    createdAt: '2026-01-12'
  },
  {
    id: 'cms-3',
    title: 'سياسة الاستبدال والاسترجاع والضمان',
    slug: 'return-policy',
    type: 'policy',
    status: 'published',
    author: 'خدمة العملاء',
    summary: 'حقوق المستهلك في استرجاع أو استبدال الأجهزة خلال 14-30 يوماً طبقاً لقانون حماية المستهلك.',
    content: 'يحق للعميل استبدال أو استرجاع المنتج خلال 14 يوماً من تاريخ الاستلام في حالته الأصلية، وخلال 30 يوماً في حال وجود عيب صناعة مثبت بتقرير فني من مركز الصيانة المعتمد.',
    viewsCount: 2150,
    publishedAt: '2026-01-15',
    createdAt: '2026-01-15'
  },
  {
    id: 'cms-4',
    title: 'الأسئلة الشائعة حول الشحن والضمان وطرق الدفع',
    slug: 'faq',
    type: 'faq',
    status: 'published',
    author: 'فريق الدعم الفني',
    summary: 'إجابات شاملة عن مواعيد التوصيل، طرق الدفع عند الاستلام، وتفعيل شهادات الضمان.',
    content: 'تجد هنا إجابات مفصلة حول كيفية تتبع الطلبات، مدة الشحن لمحافظات الصعيد والدلتا، إمكانية المعاينة قبل الاستلام، وطرق تفعيل الضمان مع التوكيل.',
    viewsCount: 3400,
    publishedAt: '2026-01-20',
    createdAt: '2026-01-20'
  },
  {
    id: 'cms-5',
    title: 'دليل اختيار أفضل تكييف موفر للكهرباء لعام 2026',
    slug: 'air-conditioner-buying-guide-2026',
    type: 'article',
    status: 'published',
    author: 'م. أحمد الشناوي',
    summary: 'مقارنة شاملة بين تقنيات الإنفرتر والأنظمة التقليدية مع نصائح حساب المساحة والأداء.',
    content: 'استعراض لأفضل تقنيات توفير الطاقة في التكييفات الحديثة، مع معادلة حساب القوة الحصانية المناسبة لحجم الغرفة ونوع العزل الحراري لتفادي استهلاك الطاقة المرتفع.',
    featuredImage: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80',
    viewsCount: 4890,
    publishedAt: '2026-02-01',
    createdAt: '2026-02-01'
  },
  {
    id: 'cms-6',
    title: 'إعلان عروض الصيف والتخفيضات الكبرى على الأجهزة المنزلية',
    slug: 'summer-sale-announcement',
    type: 'announcement',
    status: 'published',
    author: 'إدارة التسويق',
    summary: 'خصومات تصل إلى 35% على جميع الغسالات والثلاجات مع شحن مجاني لكافة المحافظات.',
    content: 'يسر متجرنا إطلاق مهرجان الصيف للأجهزة الكهربائية بخصومات حصرية وأنظمة تقسيط بدون فوائد بالتعاون مع كبرى البنوك، مع هدايا فورية وتركيب مجاني.',
    viewsCount: 5120,
    publishedAt: '2026-02-10',
    createdAt: '2026-02-10'
  },
  {
    id: 'cms-7',
    title: 'كيف تحافظ على الثلاجة المنزلية وتوفر استهلاك الطاقة',
    slug: 'refrigerator-maintenance-tips',
    type: 'article',
    status: 'published',
    author: 'فريق الصيانة',
    summary: 'نصائح دورية لتنظيف المكثف وضبط درجات الحرارة المناسبة لحفظ الأطعمة.',
    content: 'طرق بسيطة لزيادة كفاءة الثلاجة المنزلية وتجنب تراكم الثلج، وفحص جوان الباب لضمان الإغلاق المحكم وتوفير حتى 25% من استهلاك الكهرباء الشهري.',
    featuredImage: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&q=80',
    viewsCount: 1650,
    publishedAt: '2026-02-15',
    createdAt: '2026-02-15'
  },
  {
    id: 'cms-8',
    title: 'شروط الشحن السريع والتوصيل للمحافظات',
    slug: 'shipping-info',
    type: 'page',
    status: 'published',
    author: 'إدارة العمليات',
    summary: 'تفاصيل التوصيل خلال 24 إلى 48 ساعة لكافة أنحاء الجمهورية مع الفحص قبل الاستلام.',
    content: 'نوفر أسطول سيارات مجهز لنقل الأجهزة الحساسة والثقيلة مع فنيين لرفع الأجهزة حتى باب المنزل وتأكيد السلامة قبل التوقيع على إذن الاستلام.',
    viewsCount: 1200,
    publishedAt: '2026-02-20',
    createdAt: '2026-02-20'
  },
  {
    id: 'cms-9',
    title: 'دليل الشراء لأفران البلت إن والمسطحات الحديثة',
    slug: 'built-in-ovens-guide',
    type: 'article',
    status: 'draft',
    author: 'م. حسام الدين',
    summary: 'معايير اختيار أفران الغاز والكهرباء مع ميزات الأمان والإشعال الذاتي والتنظيف الحراري.',
    content: 'مقارنة فنية بين أفران البلت إن مقاس 60 سم و 90 سم وخامات الاستانلس والزجاج المقاوم للحرارة وتقنيات توزيع الهواء بمروحة التوربو.',
    viewsCount: 310,
    publishedAt: '',
    createdAt: '2026-03-01'
  },
  {
    id: 'cms-10',
    title: 'خدمة الصيانة المعتمدة وقطع الغيار الأصلية',
    slug: 'maintenance-services',
    type: 'page',
    status: 'published',
    author: 'إدارة الضمان',
    summary: 'حجز مواعيد الصيانة الدورية للأجهزة المنزلية عبر فنيين معتمدين وقطع غيار بضمان معتمد.',
    content: 'نوفر مراكز خدمة معتمدة مع فنيين مدربين من الشركات المصنعة لتقديم الصيانة المنزلية السريعة وقطع غيار أصلية 100% مع ضمان على الإصلاح.',
    viewsCount: 2890,
    publishedAt: '2026-03-05',
    createdAt: '2026-03-05'
  },
  {
    id: 'cms-11',
    title: 'سياسة الخصوصية وأمن البيانات وحماية المستهلك',
    slug: 'privacy-policy',
    type: 'policy',
    status: 'published',
    author: 'أمن المعلومات',
    summary: 'كيف نحمي بياناتك الشخصية ومعلومات الدفع عند التسوق في متجرنا الإلكتروني.',
    content: 'نحن نلتزم بأعلى معايير التشفير وأمن المعلومات لحماية خصوصيتك ومعلومات بطاقات الدفع. لا نقوم بمشاركة أي بيانات مع أي أطراف غير مصرح لها.',
    viewsCount: 750,
    publishedAt: '2026-03-10',
    createdAt: '2026-03-10'
  },
  {
    id: 'cms-12',
    title: 'تنويه هام بشأن تحديث أسعار الشحن للأجهزة الثقيلة',
    slug: 'heavy-appliances-shipping-update',
    type: 'announcement',
    status: 'archived',
    author: 'إدارة اللوجستيات',
    summary: 'تحديث رسوم النقل والتركيب للأجهزة فائقة الحجم وتكييفات الكونسيلد للمناطق النائية.',
    content: 'تنويه لعملائنا الكرام بخصوص تحديث تعريفات النقل للأجهزة التي تزيد عن 100 كجم في محافظات البحر الأحمر وجنوب سيناء والوادي الجديد.',
    viewsCount: 620,
    publishedAt: '2026-03-12',
    createdAt: '2026-03-12'
  },
  {
    id: 'cms-13',
    title: 'أفضل 5 غسالات ملابس أوتوماتيك لعام 2026',
    slug: 'top-5-washing-machines-2026',
    type: 'article',
    status: 'published',
    author: 'م. رانيا محمود',
    summary: 'مراجعة لأحدث موديلات الغسالات ذات التحميل الأمامي والعلوي مع مقارنة البرامج الذكية ومعدل استهلاك المياه.',
    content: 'تحليل ومراجعة تفصيلية لأفضل غسالات الملابس سعة 8 إلى 12 كجم المزودة بمحركات إنفرتر بدون سير وتقنية البخار لتعقيم الملابس.',
    featuredImage: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&q=80',
    viewsCount: 3740,
    publishedAt: '2026-03-18',
    createdAt: '2026-03-18'
  },
  {
    id: 'cms-14',
    title: 'طرق الدفع والتقسيط المتاحة بدون فوائد وبدون مقدم',
    slug: 'installment-plans',
    type: 'page',
    status: 'published',
    author: 'الإدارة المالية',
    summary: 'تفاصيل برامج التقسيط البنكي وأنظمة الدفع اللاحق المعتمدة مع البنوك والشركات.',
    content: 'تعرف على خيارات التقسيط بدون فوائد حتى 24 شهراً مع بطاقات الائتمان لكافة البنوك المصرية، بالإضافة لخدمات فاليو وسهولة وفرصة وأمان.',
    viewsCount: 4200,
    publishedAt: '2026-03-22',
    createdAt: '2026-03-22'
  },
  {
    id: 'cms-15',
    title: 'نصائح لتمديد العمر الافتراضي لغسالات الأطباق',
    slug: 'dishwasher-care-guide',
    type: 'article',
    status: 'draft',
    author: 'فريق الصيانة',
    summary: 'كيفية استخدام الملح ومساعد الشطف وتنظيف الفلاتر لتفادي الأعطال الشائعة وضمان نظافة الأواني.',
    content: 'إرشادات عملية لاستخدام أقراص الغسيل المناسبة وضبط عسر الماء وتنظيف الرشاشات الدوارة بانتظام لمنع انسداد مجاري التصريف.',
    viewsCount: 190,
    publishedAt: '',
    createdAt: '2026-03-25'
  },
  {
    id: 'cms-16',
    title: 'الأسئلة المتكررة حول تركيب التكييفات وشحنات الفريون',
    slug: 'ac-installation-faq',
    type: 'faq',
    status: 'published',
    author: 'قسم التركيبات',
    summary: 'كل ما تحتاج لمعرفته عن أطوال مواسير النحاس المسموحة ورسوم التركيب والضمان بعد التشغيل.',
    content: 'إجابات دقيقة حول متطلبات تجهيز الكهرباء وموقع الوحدة الخارجية ورسوم الأمتار الإضافية لمواسير النحاس المعزولة.',
    viewsCount: 2600,
    publishedAt: '2026-03-28',
    createdAt: '2026-03-28'
  }
];

interface AdminCMSProps {
  onRefreshAll: () => void;
}

export default function AdminCMS({ onRefreshAll }: AdminCMSProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'banners' | 'settings'>('content');
  
  // CMS Items Management State
  const [items, setItems] = useState<CMSItem[]>(() => {
    try {
      const saved = localStorage.getItem('admin_cms_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_CMS_ITEMS;
  });

  // Search, Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CMSItem | null>(null);
  const [previewItem, setPreviewItem] = useState<CMSItem | null>(null);

  // Form Fields State
  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formType, setFormType] = useState<'page' | 'article' | 'announcement' | 'faq' | 'policy'>('page');
  const [formStatus, setFormStatus] = useState<'published' | 'draft' | 'archived'>('published');
  const [formAuthor, setFormAuthor] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formFeaturedImage, setFormFeaturedImage] = useState('');
  const [formError, setFormError] = useState('');

  // Settings tab states
  const [settings, setSettings] = useState<Partial<SystemSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Helper to persist CMS items
  const persistItems = (updated: CMSItem[]) => {
    setItems(updated);
    try {
      localStorage.setItem('admin_cms_items', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const showNotification = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      setSettings(res);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل الإعدادات الرئيسية للمتجر'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!settings) return;

    if (settings.shippingFlatRate !== undefined && settings.shippingFlatRate !== null && String(settings.shippingFlatRate).trim() !== '') {
      const shipRes = validateNumericValue(settings.shippingFlatRate, 'non_negative_decimal', {
        min: 0,
        fieldNameArabic: 'تكلفة شحن الأجهزة الموحدة'
      });
      if (!shipRes.valid) {
        setError(shipRes.error || 'تكلفة شحن الأجهزة الموحدة غير صالحة');
        return;
      }
    }

    if (settings.taxRate !== undefined && settings.taxRate !== null && String(settings.taxRate).trim() !== '') {
      const taxRes = validateNumericValue(settings.taxRate, 'non_negative_decimal', {
        min: 0,
        max: 1,
        fieldNameArabic: 'نسبة ضريبة القيمة المضافة'
      });
      if (!taxRes.valid) {
        setError(taxRes.error || 'نسبة ضريبة القيمة المضافة غير صالحة (يجب أن تكون بين 0 و 1)');
        return;
      }
    }

    try {
      await api.updateAdminSettings(settings);
      setSuccess('تم حفظ إعدادات وخصائص المتجر والـ CMS بنجاح 🎉');
      onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشلت عملية حفظ تعديلات الإعدادات، يرجى مراجعة قيم المدخلات'));
    }
  };

  // Reset to page 1 automatically when search, content type, status, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus, sortBy]);

  // Search, Filter & Sort Logic
  const filteredAndSortedItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search filter
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || (
          item.title.toLowerCase().includes(term) ||
          item.slug.toLowerCase().includes(term) ||
          (item.summary && item.summary.toLowerCase().includes(term)) ||
          (item.content && item.content.toLowerCase().includes(term)) ||
          (item.author && item.author.toLowerCase().includes(term))
        );

        // Content Type filter
        const matchesType = filterType === 'all' || item.type === filterType;

        // Status filter
        const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

        return matchesSearch && matchesType && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.createdAt || b.publishedAt || '2026-01-01').getTime() - 
                 new Date(a.createdAt || a.publishedAt || '2026-01-01').getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.createdAt || a.publishedAt || '2026-01-01').getTime() - 
                 new Date(b.createdAt || b.publishedAt || '2026-01-01').getTime();
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title, 'ar');
        }
        if (sortBy === 'type') {
          return a.type.localeCompare(b.type, 'ar');
        }
        return 0;
      });
  }, [items, searchTerm, filterType, filterStatus, sortBy]);

  // Client-Side Pagination Calculations
  const totalItems = filteredAndSortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedItems = filteredAndSortedItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // CRUD Handlers
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormSlug('');
    setFormType('page');
    setFormStatus('published');
    setFormAuthor('إدارة المتجر');
    setFormSummary('');
    setFormContent('');
    setFormFeaturedImage('');
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: CMSItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormSlug(item.slug);
    setFormType(item.type);
    setFormStatus(item.status);
    setFormAuthor(item.author || '');
    setFormSummary(item.summary || '');
    setFormContent(item.content || '');
    setFormFeaturedImage(item.featuredImage || '');
    setFormError('');
    setShowModal(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formTitle.trim()) {
      setFormError('عنوان المحتوى مطلوب');
      return;
    }

    if (!formSlug.trim()) {
      setFormError('المسار التعريفي (Slug) مطلوب لروابط الـ SEO');
      return;
    }

    if (!formContent.trim()) {
      setFormError('تفاصيل ونص المحتوى مطلوبة');
      return;
    }

    const cleanSlug = formSlug.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u0621-\u064A-]/gi, '');
    const today = new Date().toISOString().split('T')[0];

    if (editingItem) {
      const updated = items.map((it) => {
        if (it.id === editingItem.id) {
          return {
            ...it,
            title: formTitle.trim(),
            slug: cleanSlug,
            type: formType,
            status: formStatus,
            author: formAuthor.trim() || 'إدارة المتجر',
            summary: formSummary.trim(),
            content: formContent.trim(),
            featuredImage: formFeaturedImage.trim(),
            updatedAt: today,
            publishedAt: formStatus === 'published' && !it.publishedAt ? today : it.publishedAt
          };
        }
        return it;
      });
      persistItems(updated);
      showNotification(`تم تحديث محتوى "${formTitle}" بنجاح!`);
    } else {
      const newItem: CMSItem = {
        id: `cms-${Date.now()}`,
        title: formTitle.trim(),
        slug: cleanSlug,
        type: formType,
        status: formStatus,
        author: formAuthor.trim() || 'إدارة المتجر',
        summary: formSummary.trim(),
        content: formContent.trim(),
        featuredImage: formFeaturedImage.trim(),
        viewsCount: 0,
        createdAt: today,
        publishedAt: formStatus === 'published' ? today : ''
      };
      persistItems([newItem, ...items]);
      showNotification(`تم نشر وإضافة محتوى "${formTitle}" بنجاح!`);
    }

    setShowModal(false);
    if (onRefreshAll) onRefreshAll();
  };

  const handleDeleteItem = (item: CMSItem) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف محتوى "${item.title}" نهائياً من الـ CMS؟`)) return;
    const updated = items.filter((it) => it.id !== item.id);
    persistItems(updated);
    showNotification(`تم حذف المحتوى "${item.title}" بنجاح.`);
    if (onRefreshAll) onRefreshAll();
  };

  const handleTogglePublish = (item: CMSItem) => {
    const newStatus = item.status === 'published' ? 'draft' : 'published';
    const today = new Date().toISOString().split('T')[0];
    const updated = items.map((it) => {
      if (it.id === item.id) {
        return {
          ...it,
          status: newStatus as 'published' | 'draft',
          publishedAt: newStatus === 'published' && !it.publishedAt ? today : it.publishedAt,
          updatedAt: today
        };
      }
      return it;
    });
    persistItems(updated);
    showNotification(newStatus === 'published' ? `تم نشر "${item.title}" بنجاح 🟢` : `تم تحويل "${item.title}" إلى مسودة 🔒`);
    if (onRefreshAll) onRefreshAll();
  };

  const getTypeBadge = (type: CMSItem['type']) => {
    switch (type) {
      case 'page':
        return <span className="bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1"><BookOpen className="w-3 h-3" /> صفحة رئيسية</span>;
      case 'article':
        return <span className="bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1"><FileText className="w-3 h-3" /> مقال / دليل</span>;
      case 'announcement':
        return <span className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1"><Megaphone className="w-3 h-3" /> إعلان ترويجي</span>;
      case 'faq':
        return <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1"><HelpCircle className="w-3 h-3" /> أسئلة شائعة</span>;
      case 'policy':
        return <span className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> سياسة وشروط</span>;
      default:
        return <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded text-[10px]">{type}</span>;
    }
  };

  const getStatusBadge = (status: CMSItem['status']) => {
    switch (status) {
      case 'published':
        return (
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            منشور
          </span>
        );
      case 'draft':
        return (
          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            مسودة
          </span>
        );
      case 'archived':
        return (
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
            مؤرشف
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <span className="text-xs">جارٍ جلب إعدادات المبيعات وبيانات الـ CMS الحالية...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right font-sans" id="admin-cms-panel" dir="rtl">
      {/* 1. Master Page Header */}
      <AdminPageHeader
        title="نظام إدارة محتوى المتجر والصفحات (Store CMS & Content Hub)"
        description="إنشاء وتحرير صفحات المتجر، المقالات، السياسات والأسئلة الشائعة مع تحكم كامل بالنشر والترتيب"
        icon={FileText}
        badge={<AdminBadge variant="amber">{items.length} عنصر محتوى</AdminBadge>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'content' && (
              <AdminButton
                onClick={handleOpenCreate}
                icon={Plus}
              >
                إنشاء محتوى جديد
              </AdminButton>
            )}
          </div>
        }
      />

      {/* 2. Sub-Navigation Tabs */}
      <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl gap-1 overflow-x-auto shadow-sm">
        <button
          type="button"
          onClick={() => {
            setActiveTab('content');
            setError('');
            setSuccess('');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'content'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>صفحات ومقالات المحتوى (CMS Content)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('banners');
            setError('');
            setSuccess('');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'banners'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>بنرات السلايدر الترويجي (Hero Slider)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('settings');
            setError('');
            setSuccess('');
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-amber-500 text-slate-950 font-black shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>إعدادات المتجر العامة والمالية</span>
        </button>
      </div>

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-600 dark:text-emerald-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 dark:text-rose-400 hover:text-slate-900 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab 1: CMS Content Items Management */}
      {activeTab === 'content' && (
        <div className="space-y-6" id="admin-cms-content-section">
          {/* Quick Stats KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminStatCard
              title="إجمالي عناصر الـ CMS"
              value={items.length}
              icon={FileText}
              subtitle="صفحات، مقالات وسياسات"
            />
            <AdminStatCard
              title="المحتوى المنشور"
              value={items.filter(i => i.status === 'published').length}
              icon={CheckCircle}
              trend={{ value: `${items.filter(i => i.status === 'published').length} عنصر`, isPositive: true, label: 'متاح للزوار والعملاء' }}
            />
            <AdminStatCard
              title="المسودات قيد التجهيز"
              value={items.filter(i => i.status === 'draft').length}
              icon={Edit}
              subtitle="غير ظاهرة على الموقع"
            />
            <AdminStatCard
              title="المقالات ودلائل الشراء"
              value={items.filter(i => i.type === 'article').length}
              icon={BookOpen}
              subtitle="مدونة المتجر والمقالات"
            />
          </div>

          {/* Search, Filter & Content Card */}
          <AdminCard className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search input */}
              <div className="flex-1 max-w-md">
                <AdminSearchInput
                  value={searchTerm}
                  onChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
                  placeholder="البحث بالعنوان، المسار (Slug)، أو الملخص..."
                />
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Content Type Filter */}
                <div className="min-w-[150px]">
                  <CustomSelect
                    value={filterType}
                    onChange={(val) => { setFilterType(val); setCurrentPage(1); }}
                    size="sm"
                    buttonClassName="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-300 font-bold focus:border-amber-500"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[180px]"
                    options={[
                      { value: 'all', label: 'كل أنواع المحتوى' },
                      { value: 'page', label: 'صفحات رئيسية (Pages)' },
                      { value: 'article', label: 'مقالات ودلائل (Articles)' },
                      { value: 'announcement', label: 'إعلانات ترويجية (Announcements)' },
                      { value: 'faq', label: 'أسئلة شائعة (FAQ)' },
                      { value: 'policy', label: 'سياسات وشروط (Policies)' }
                    ]}
                  />
                </div>

                {/* Status Filter */}
                <div className="min-w-[140px]">
                  <CustomSelect
                    value={filterStatus}
                    onChange={(val) => { setFilterStatus(val); setCurrentPage(1); }}
                    size="sm"
                    buttonClassName="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-300 font-bold focus:border-amber-500"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[160px]"
                    options={[
                      { value: 'all', label: 'جميع الحالات' },
                      { value: 'published', label: 'منشور (Published)' },
                      { value: 'draft', label: 'مسودة (Draft)' },
                      { value: 'archived', label: 'مؤرشف (Archived)' }
                    ]}
                  />
                </div>

                {/* Sorting Filter */}
                <div className="min-w-[130px]">
                  <CustomSelect
                    value={sortBy}
                    onChange={(val) => setSortBy(val)}
                    size="sm"
                    buttonClassName="text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-300 font-bold focus:border-amber-500"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[150px]"
                    options={[
                      { value: 'newest', label: 'الأحدث أولاً' },
                      { value: 'oldest', label: 'الأقدم أولاً' },
                      { value: 'title', label: 'العنوان أبجدياً' },
                      { value: 'type', label: 'نوع المحتوى' }
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* CMS Items Data Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-700 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-3.5">عنوان المحتوى والمسار (Slug)</th>
                    <th className="p-3.5">نوع المحتوى</th>
                    <th className="p-3.5">حالة النشر</th>
                    <th className="p-3.5">الكاتب / المسؤول</th>
                    <th className="p-3.5">تاريخ النشر</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-semibold text-slate-900 dark:text-slate-200">
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        {/* Title & Slug */}
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1 max-w-sm">
                            <span className="font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors line-clamp-1">
                              {item.title}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                              <span className="text-amber-600 dark:text-amber-500 font-semibold">/{item.slug}</span>
                              {item.viewsCount !== undefined && (
                                <span className="text-slate-500 dark:text-slate-400 mr-2">👁️ {item.viewsCount.toLocaleString()} مشاهدة</span>
                              )}
                            </div>
                            {item.summary && (
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">{item.summary}</p>
                            )}
                          </div>
                        </td>

                        {/* Content Type */}
                        <td className="p-3.5 whitespace-nowrap">
                          {getTypeBadge(item.type)}
                        </td>

                        {/* Status */}
                        <td className="p-3.5 whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>

                        {/* Author */}
                        <td className="p-3.5 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            <span>{item.author || 'إدارة المتجر'}</span>
                          </div>
                        </td>

                        {/* Date */}
                        <td className="p-3.5 text-slate-500 dark:text-slate-400 text-[11px] font-mono whitespace-nowrap">
                          {item.publishedAt || item.createdAt || '—'}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Preview Button */}
                            <button
                              type="button"
                              onClick={() => setPreviewItem(item)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                              title="معاينة المحتوى"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Publish/Unpublish toggle */}
                            <button
                              type="button"
                              onClick={() => handleTogglePublish(item)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                item.status === 'published' 
                                  ? 'bg-emerald-500/10 hover:bg-amber-500/20 text-emerald-600 dark:text-emerald-400 hover:text-amber-600 dark:hover:text-amber-400 border-emerald-500/30'
                                  : 'bg-amber-500/10 hover:bg-emerald-500/20 text-amber-600 dark:text-amber-400 hover:text-emerald-600 dark:hover:text-emerald-400 border-amber-500/30'
                              }`}
                              title={item.status === 'published' ? 'تحويل لمسودة' : 'نشر فوري'}
                            >
                              {item.status === 'published' ? 'إلغاء النشر' : 'نشر الآن'}
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer"
                              title="تعديل المحتوى"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-500/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                              title="حذف المحتوى"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <AdminEmptyState
                          icon={FileText}
                          title="لم يتم العثور على أي عناصر محتوى"
                          description="جرب تعديل كلمات البحث أو تصفية نوع المحتوى أو أنشئ صفحة جديدة."
                          action={
                            <AdminButton icon={Plus} onClick={handleOpenCreate}>
                              إنشاء محتوى جديد
                            </AdminButton>
                          }
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Pagination Component */}
            {totalItems > 0 && (
              <AdminTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                limit={itemsPerPage}
                onPageChange={(newPage) => setCurrentPage(newPage)}
                onLimitChange={(newLimit) => {
                  setItemsPerPage(newLimit);
                  setCurrentPage(1);
                }}
              />
            )}
          </AdminCard>
        </div>
      )}

      {/* Tab 2: Hero Slider Banners CMS */}
      {activeTab === 'banners' && (
        <AdminBanners onRefreshAll={onRefreshAll} />
      )}

      {/* Tab 3: General Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {settings && (
            <form onSubmit={handleSettingsSubmit} className="space-y-6">
              {/* Section 1: Store naming & Logos */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-amber-600 dark:text-amber-500 pb-2 border-b border-slate-200 dark:border-slate-800">العلامة والشعارات (Identity)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">اسم المتجر / اللوجو الرئيسي بالعربية</label>
                    <input
                      type="text"
                      value={settings.logoText || ''}
                      onChange={(e) => setSettings({ ...settings, logoText: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الشعار الفرعي المساعد (Slogan)</label>
                    <input
                      type="text"
                      value={settings.logoSubtext || ''}
                      onChange={(e) => setSettings({ ...settings, logoSubtext: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Contact info */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-amber-600 dark:text-amber-500 pb-2 border-b border-slate-200 dark:border-slate-800">بيانات الاتصال السريع وخدمة العملاء</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الخط الساخن أو الهاتف</label>
                    <input
                      type="text"
                      value={settings.contactPhone || ''}
                      onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">البريد الإلكتروني للدعم</label>
                    <input
                      type="email"
                      value={settings.contactEmail || ''}
                      onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">العنوان الجغرافي للمقر الرئيسي</label>
                    <input
                      type="text"
                      value={settings.contactAddress || ''}
                      onChange={(e) => setSettings({ ...settings, contactAddress: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Financials & Shipping costs */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-amber-600 dark:text-amber-500 pb-2 border-b border-slate-200 dark:border-slate-800">القيم المالية وتكلفة الشحن</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">تكلفة نقل شحن الأجهزة الموحدة (جنيه مصري) 🚚</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={settings.shippingFlatRate === undefined ? '' : settings.shippingFlatRate}
                      onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                      onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                      onChange={(e) => {
                        const clean = sanitizeNumericInput(e.target.value, 'non_negative_decimal');
                        setSettings({ ...settings, shippingFlatRate: clean === '' ? ('' as any) : Number(clean) });
                      }}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">نسبة ضريبة القيمة المضافة العشرية (مثال: 0.14 تعني 14%)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={settings.taxRate === undefined ? '' : settings.taxRate}
                      onKeyDown={(e) => handleNumericKeyDown(e, 'non_negative_decimal')}
                      onPaste={(e) => handleNumericPaste(e, 'non_negative_decimal')}
                      onChange={(e) => {
                        const clean = sanitizeNumericInput(e.target.value, 'non_negative_decimal');
                        setSettings({ ...settings, taxRate: clean === '' ? ('' as any) : Number(clean) });
                      }}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Promo banners */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-amber-600 dark:text-amber-500 pb-2 border-b border-slate-200 dark:border-slate-800">الترويج ولافتة العروض الرئيسية (Promo Banner)</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">عنوان اللافتة الترويجية بالصفحة الرئيسية</label>
                    <input
                      type="text"
                      value={settings.bannerTitle || ''}
                      onChange={(e) => setSettings({ ...settings, bannerTitle: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <ImageUploader
                    label="صورة لافتة العرض الرئيسية"
                    value={settings.bannerImage || ''}
                    onChange={(url) => setSettings({ ...settings, bannerImage: url })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الوصف الفرعي للافتة الترويجية</label>
                  <input
                    type="text"
                    value={settings.bannerSubtitle || ''}
                    onChange={(e) => setSettings({ ...settings, bannerSubtitle: e.target.value })}
                    className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Section 5: Social media */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-4">
                <h4 className="text-xs font-black text-amber-600 dark:text-amber-500 pb-2 border-b border-slate-200 dark:border-slate-800">روابط منصات التواصل الاجتماعي للمتجر</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">فيسبوك</label>
                    <input
                      type="text"
                      value={settings.socialFacebook || ''}
                      onChange={(e) => setSettings({ ...settings, socialFacebook: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">إنستغرام</label>
                    <input
                      type="text"
                      value={settings.socialInstagram || ''}
                      onChange={(e) => setSettings({ ...settings, socialInstagram: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">تويتر / X</label>
                    <input
                      type="text"
                      value={settings.socialTwitter || ''}
                      onChange={(e) => setSettings({ ...settings, socialTwitter: e.target.value })}
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-colors flex justify-center items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Save className="w-4.5 h-4.5" />
                  حفظ وتطبيق تغييرات إعدادات المتجر
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📝 Modal: Create / Edit CMS Item */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 text-right shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800 mb-5">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                {editingItem ? <Edit className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4 text-amber-500" />}
                {editingItem ? 'تعديل محتوى الصفحة / المقال' : 'إنشاء ونشر محتوى جديد في الـ CMS'}
              </h4>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveItem} className="space-y-4">
              
              {/* Row 1: Title & Slug */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">عنوان المحتوى / المقال *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => {
                      setFormTitle(e.target.value);
                      if (!editingItem && !formSlug) {
                        setFormSlug(e.target.value.trim().toLowerCase().replace(/\s+/g, '-'));
                      }
                    }}
                    placeholder="مثال: دليل شراء التكييفات لعام 2026"
                    className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">المسار التعريفي (Slug / URL) *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="ac-buying-guide-2026"
                      className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-amber-600 dark:text-amber-400 font-mono focus:outline-none focus:border-amber-500 text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Type, Status, Author */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">نوع المحتوى</label>
                  <CustomSelect
                    value={formType}
                    onChange={(val) => setFormType(val as any)}
                    size="sm"
                    buttonClassName="w-full text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-bold focus:border-amber-500"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    options={[
                      { value: 'page', label: 'صفحة رئيسية (Page)' },
                      { value: 'article', label: 'مقال / دليل شراء (Article)' },
                      { value: 'announcement', label: 'إعلان ترويجي (Announcement)' },
                      { value: 'faq', label: 'أسئلة شائعة (FAQ)' },
                      { value: 'policy', label: 'سياسة وشروط (Policy)' }
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">حالة النشر</label>
                  <CustomSelect
                    value={formStatus}
                    onChange={(val) => setFormStatus(val as any)}
                    size="sm"
                    buttonClassName="w-full text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white font-bold focus:border-amber-500"
                    menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                    options={[
                      { value: 'published', label: 'منشور للعامة (Published)' },
                      { value: 'draft', label: 'مسودة خاصة (Draft)' },
                      { value: 'archived', label: 'مؤرشف (Archived)' }
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الكاتب / المصدر</label>
                  <input
                    type="text"
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="فريق التحرير"
                    className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Row 3: Summary */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">الملخص القصير (وصف الـ SEO ومقتطف البطاقة)</label>
                <textarea
                  rows={2}
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="نبذة سريعة تظهر في محركات البحث وبطاقات العرض..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Row 4: Main Content */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">تفاصيل المحتوى الكاملة *</label>
                <textarea
                  rows={6}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="اكتب تفاصيل المحتوى والفقرات هنا..."
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                />
              </div>

              {/* Row 5: Featured Image */}
              <div className="flex flex-col gap-1.5">
                <ImageUploader
                  label="الصورة البارزة للمحتوى (اختياري)"
                  value={formFeaturedImage}
                  onChange={(url) => setFormFeaturedImage(url)}
                />
              </div>

              {/* Form Action buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <Save className="w-4 h-4" />
                  {editingItem ? 'حفظ التعديلات' : 'نشر المحتوى الجديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 👁️ Modal: Preview CMS Item */}
      {/* ========================================================================= */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 text-right shadow-2xl">
            
            {/* Preview Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-200 dark:border-slate-800 mb-5 gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {getTypeBadge(previewItem.type)}
                  {getStatusBadge(previewItem.status)}
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white leading-snug">{previewItem.title}</h3>
                <span className="text-[11px] text-amber-600 dark:text-amber-500 font-mono mt-0.5 block">/{previewItem.slug}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Featured Image */}
            {previewItem.featuredImage && (
              <div className="mb-5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-56 bg-slate-100 dark:bg-slate-950">
                <img
                  src={previewItem.featuredImage}
                  alt={previewItem.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Metadata bar */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400 mb-5 p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>الكاتب: <strong className="text-slate-900 dark:text-slate-200">{previewItem.author || 'إدارة المتجر'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>تاريخ النشر: <strong className="text-slate-900 dark:text-slate-200 font-mono">{previewItem.publishedAt || previewItem.createdAt || '—'}</strong></span>
              </div>
              {previewItem.viewsCount !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>المشاهدات: <strong className="text-amber-600 dark:text-amber-400 font-mono">{previewItem.viewsCount.toLocaleString()}</strong></span>
                </div>
              )}
            </div>

            {/* Summary */}
            {previewItem.summary && (
              <div className="mb-5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
                <strong className="block text-amber-700 dark:text-amber-400 font-bold mb-1">الملخص التعريفي:</strong>
                {previewItem.summary}
              </div>
            )}

            {/* Body Content */}
            <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed space-y-3 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 font-sans whitespace-pre-wrap">
              {previewItem.content}
            </div>

            {/* Footer actions */}
            <div className="flex justify-between items-center pt-5 mt-5 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-500">معاينة مباشرة كما تظهر للمستخدمين والزوار</span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
