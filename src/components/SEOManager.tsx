import { useEffect } from 'react';
import { Product, SystemSettings } from '../types.js';

interface SEOManagerProps {
  currentTab: string;
  selectedProduct: Product | null;
  settings: SystemSettings | null;
}

export default function SEOManager({ currentTab, selectedProduct, settings }: SEOManagerProps) {
  useEffect(() => {
    // 1. Resolve Store Base Info
    const storeName = settings?.logoText || 'متجر النخبة';
    const storeSubtext = settings?.logoSubtext || 'للأجهزة المنزلية والكهربائية';
    const contactPhone = settings?.contactPhone || '';
    const contactEmail = settings?.contactEmail || '';
    const contactAddress = settings?.contactAddress || '';
    
    const baseUrl = window.location.origin;
    const currentUrl = window.location.href;

    // Default Fallbacks
    let title = `${storeName} | ${storeSubtext} - أفضل الأجهزة المنزلية في مصر`;
    let description = `تسوق من ${storeName} أحدث الأجهزة المنزلية والكهربائية، شاشات التلفزيون، التكييفات، وأجهزة المطبخ بأفضل الأسعار في مصر. شحن سريع لجميع المحافظات والدفع عند الاستلام مع ضمان حقيقي.`;
    let keywords = 'أجهزة منزلية, أجهزة كهربائية, تلفزيونات, غسالات, ثلاجات, تكييفات, خلاطات, متجر النخبة, مصر, شراء أجهزة كهربائية, الدفع عند الاستلام, عروض الأجهزة';
    let ogType = 'website';
    let ogImage = settings?.bannerImage || `${baseUrl}/logo.png`;

    // Breadcrumb array to build JSON-LD
    const breadcrumbItems = [
      { name: 'الرئيسية', item: baseUrl }
    ];

    // JSON-LD schemas holder
    const schemas: any[] = [];

    // 2. Generate Dynamic Metadata based on routing tab
    switch (currentTab) {
      case 'home':
        title = `${storeName} - ${storeSubtext} | أفضل العروض والأسعار في مصر`;
        description = `تسوق من ${storeName} الأجهزة المنزلية، شاشات التلفزيون، أجهزة المطبخ، والتكييفات بأفضل الأسعار في مصر. شحن سريع لجميع المحافظات والدفع عند الاستلام مع ضمان حقيقي.`;
        
        // Organization Schema for Homepage
        schemas.push({
          '@context': 'https://schema.org',
          '@type': 'OnlineStore',
          '@id': `${baseUrl}/#store`,
          'name': storeName,
          'description': storeSubtext,
          'url': baseUrl,
          'logo': ogImage,
          'image': ogImage,
          'telephone': contactPhone,
          'email': contactEmail,
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': contactAddress,
            'addressCountry': 'EG'
          },
          'sameAs': (
            Array.isArray(settings?.socialLinks)
              ? settings.socialLinks.filter(l => l.enabled !== false && l.url).map(l => l.url)
              : []
          ).filter(Boolean),
          'priceRange': '$$$'
        });
        break;

      case 'products':
        title = `جميع الأجهزة المنزلية والكهربائية | عروض حصرية - ${storeName}`;
        description = `تصفح تشكيلة واسعة من الأجهزة الكهربائية والمنزلية من ماركات عالمية بأسعار منافسة وعروض يومية متجددة في مصر. شحن سريع وضمان معتمد.`;
        keywords = 'منتجات كهربائية, شاشات للبيع, تكييفات مصر, أجهزة مطبخ, غسالات ملابس, ثلاجات نوفرست, عروض متجر النخبة';
        
        breadcrumbItems.push({ name: 'المنتجات', item: `${baseUrl}/products` });
        break;

      case 'product-details':
        if (selectedProduct) {
          const currentPrice = selectedProduct.discountPrice || selectedProduct.price;
          const originalPrice = selectedProduct.price;
          const hasDiscount = !!selectedProduct.discountPrice && selectedProduct.discountPrice < selectedProduct.price;
          
          // Highly optimized Arabic title and Description
          title = `${selectedProduct.title} - اشتري الآن بأفضل سعر في مصر | ${selectedProduct.brand}`;
          description = `شراء ${selectedProduct.title} من ماركة ${selectedProduct.brand}. السعر الحالي: ${currentPrice} ج.م ${hasDiscount ? `(خصم من ${originalPrice} ج.م)` : ''}. تصفح ميزات الجهاز، التقييمات، المواصفات الفنية مع شحن لجميع محافظات مصر والدفع عند الاستلام.`;
          
          // Gather custom keywords
          const customKeywords = [
            selectedProduct.title,
            selectedProduct.titleEn,
            selectedProduct.brand,
            selectedProduct.category,
            ...(selectedProduct.tags || [])
          ].filter(Boolean).join(', ');
          if (customKeywords) {
            keywords = `${customKeywords}, ${keywords}`;
          }

          ogType = 'product';
          ogImage = selectedProduct.mainImage;

          // Product Breadcrumb hierarchy
          breadcrumbItems.push({ 
            name: selectedProduct.category, 
            item: `${baseUrl}/products?category=${encodeURIComponent(selectedProduct.category)}` 
          });
          breadcrumbItems.push({ 
            name: selectedProduct.title, 
            item: currentUrl 
          });

          // Product Schema.org structured data
          schemas.push({
            '@context': 'https://schema.org',
            '@type': 'Product',
            'name': selectedProduct.title,
            'image': selectedProduct.images && selectedProduct.images.length > 0 ? selectedProduct.images : [selectedProduct.mainImage],
            'description': selectedProduct.description,
            'sku': selectedProduct.sku || `SKU-${selectedProduct.id}`,
            'mpn': selectedProduct.sku || selectedProduct.id,
            'brand': {
              '@type': 'Brand',
              'name': selectedProduct.brand
            },
            'offers': {
              '@type': 'Offer',
              'url': currentUrl,
              'priceCurrency': 'EGP',
              'price': currentPrice,
              'priceValidUntil': '2027-12-31',
              'itemCondition': 'https://schema.org/NewCondition',
              'availability': selectedProduct.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              'seller': {
                '@type': 'Organization',
                'name': storeName
              }
            },
            ...(selectedProduct.reviewsCount > 0 ? {
              'aggregateRating': {
                '@type': 'AggregateRating',
                'ratingValue': selectedProduct.rating,
                'reviewCount': selectedProduct.reviewsCount,
                'bestRating': '5',
                'worstRating': '1'
              }
            } : {})
          });
        }
        break;

      case 'cart':
        title = `سلة المشتريات | راجع أجهزتك المفضلة - ${storeName}`;
        description = `راجع سلة مشترياتك في ${storeName} وأكمل طلبك للحصول على أفضل الخصومات الحصرية وتوصيل سريع لباب بيتك بجميع أنحاء مصر.`;
        breadcrumbItems.push({ name: 'سلة المشتريات', item: `${baseUrl}/cart` });
        break;

      case 'wishlist':
        title = `قائمة أجهزتك المفضلة 💖 | الأجهزة المحفوظة - ${storeName}`;
        description = `قائمة الأجهزة الكهربائية والمنزلية التي قمت بحفظها في متجرنا. قارن الأسعار والخيارات وأكمل عملية الشراء بسهولة تامة.`;
        breadcrumbItems.push({ name: 'المفضلة', item: `${baseUrl}/wishlist` });
        break;

      case 'checkout':
        title = `إتمام الشراء الآمن 🛒 | الدفع عند الاستلام - ${storeName}`;
        description = `أدخل بيانات الشحن والتوصيل لإتمام طلبك والحصول على الأجهزة الكهربائية بأسرع وقت مع ميزة الدفع الآمن عند الاستلام.`;
        breadcrumbItems.push({ name: 'إتمام الشراء', item: `${baseUrl}/checkout` });
        break;

      case 'track-order':
        title = `تتبع حالة طلبك بالتفصيل 📦 | خدمة العملاء - ${storeName}`;
        description = `تتبع شحنتك وحالة طلب الأجهزة الكهربائية والمنزلية من خلال إدخال رقم الفاتورة أو رقم الهاتف بسهولة تامة وعلى مدار الساعة.`;
        breadcrumbItems.push({ name: 'تتبع الطلب', item: `${baseUrl}/track-order` });
        break;

      case 'faq':
        title = `الأسئلة الشائعة والدعم الفني ❓ | كيف يمكننا مساعدتك - ${storeName}`;
        description = `إجابات شاملة لجميع استفساراتكم حول طرق الدفع، الشحن، التوصيل، سياسات الضمان والاسترجاع للأجهزة المنزلية بمتجرنا.`;
        breadcrumbItems.push({ name: 'الأسئلة الشائعة', item: `${baseUrl}/faq` });
        break;

      case 'about':
        title = `من نحن - قصة متجرنا ورؤيتنا 🌟 | ${storeName}`;
        description = `تعرف على ${storeName}، منصتك الموثوقة الأولى لشراء وتجهيز منزلك بأحدث الأجهزة الكهربائية والمنزلية الأصلية في مصر مع خدمة عملاء احترافية.`;
        breadcrumbItems.push({ name: 'من نحن', item: `${baseUrl}/about` });
        break;

      case 'contact':
        title = `اتصل بنا - خدمة العملاء والدعم المباشر 📞 | ${storeName}`;
        description = `تواصل مع فريق خدمة عملاء ${storeName} عبر الهاتف، البريد الإلكتروني أو زيارة مقرنا. يسعدنا الرد على جميع استفساراتكم ومساعدتكم.`;
        breadcrumbItems.push({ name: 'اتصل بنا', item: `${baseUrl}/contact` });
        break;

      case 'admin':
        title = `لوحة التحكم الإدارية 🔐 | ${storeName}`;
        description = `بوابة إدارة المتجر لمسؤولي النظام - تتبع المبيعات، تحديث المنتجات، إدارة الطلبات وصيانة الأكواد التسويقية.`;
        break;

      default:
        break;
    }

    // 3. Dynamic Meta Elements update logic (Vanilla JS for perfect compatibility)
    document.title = title;

    const updateMetaTag = (attrName: string, attrVal: string, contentVal: string) => {
      let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', contentVal);
    };

    const updateLinkTag = (relVal: string, hrefVal: string) => {
      let el = document.querySelector(`link[rel="${relVal}"]`);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', relVal);
        document.head.appendChild(el);
      }
      el.setAttribute('href', hrefVal);
    };

    const updateJSONLD = (id: string, schemaData: any) => {
      let el = document.getElementById(id) as HTMLScriptElement | null;
      if (!el) {
        el = document.createElement('script');
        el.type = 'application/ld+json';
        el.id = id;
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(schemaData);
    };

    // Standard Tags
    updateMetaTag('name', 'description', description);
    updateMetaTag('name', 'keywords', keywords);

    // Open Graph Tags
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', description);
    updateMetaTag('property', 'og:image', ogImage);
    updateMetaTag('property', 'og:url', currentUrl);
    updateMetaTag('property', 'og:type', ogType);
    updateMetaTag('property', 'og:site_name', storeName);
    updateMetaTag('property', 'og:locale', 'ar_EG');

    // Twitter Cards Tags
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', description);
    updateMetaTag('name', 'twitter:image', ogImage);

    // Canonical link
    updateLinkTag('canonical', currentUrl);

    // Breadcrumb JSON-LD List Schema
    const breadcrumbSchema = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': breadcrumbItems.map((item, index) => ({
        '@type': 'ListItem',
        'position': index + 1,
        'name': item.name,
        'item': item.item
      }))
    };
    schemas.push(breadcrumbSchema);

    // Inject all compiled Schema.org JSON-LD scripts
    updateJSONLD('seo-schema-markup', schemas);

    // Cleanup logic (optional, we leave them since standard index.html needs them)
  }, [currentTab, selectedProduct, settings]);

  return null;
}
