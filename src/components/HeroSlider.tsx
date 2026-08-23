import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Percent, Clock, ChevronLeft } from 'lucide-react';
import { Product, SystemSettings, Banner } from '../types.js';

interface HeroSliderProps {
  settings: SystemSettings;
  flashSaleProduct?: Product;
  onNavigate: (tab: string, arg?: any) => void;
}

export default function HeroSlider({ settings, flashSaleProduct, onNavigate }: HeroSliderProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/banners')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBanners(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load active banners:', err);
        setLoading(false);
      });
  }, []);

  const staticBanners = [
    {
      id: 'static-1',
      title: settings.bannerTitle,
      subtitle: settings.bannerSubtitle,
      desktopImage: settings.bannerImage,
      mobileImage: settings.bannerImage,
      badge: 'عروض حصرية لفترة محدودة',
      btnLink: 'products',
      btnText: 'تصفح العروض الآن'
    },
    {
      id: 'static-2',
      title: 'جدد بيتك مع أرقى ثلاجات وشاشات OLED',
      subtitle: 'خصومات تصل إلى 15٪ مع ضمان رسمي معتمد وشحن سريع لكافة المحافظات مجاناً!',
      desktopImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=1200',
      mobileImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800',
      badge: 'أقوى الماركات العالمية (LG, Samsung)',
      btnLink: 'products',
      btnText: 'تصفح الشاشات الكبرى'
    },
    {
      id: 'static-3',
      title: 'مساعد التسوق الذكي بالذكاء الاصطناعي',
      subtitle: 'استشر خبير مبيعاتنا الآلي المدعوم من نموذج Gemini لاختيار الأجهزة الكهربائية التي تلائم بيتك بالتمام!',
      desktopImage: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=1200',
      mobileImage: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=800',
      badge: 'ميزة ذكية فريدة',
      btnLink: 'assistant',
      btnText: 'تحدث مع مساعدنا الذكي'
    }
  ];

  const slides = banners.length > 0 ? banners : staticBanners;

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const prevSlide = () => {
    setActiveSlide(prev => (prev - 1 + slides.length) % slides.length);
  };

  const nextSlide = () => {
    setActiveSlide(prev => (prev + 1) % slides.length);
  };

  const handleSlideClick = (slide: any) => {
    const link = slide.btnLink || slide.linkTab || 'products';
    const arg = slide.linkArg;
    
    if (link === 'assistant' || arg === 'assistant') {
      const btn = document.getElementById('floating-chat-trigger');
      if (btn) btn.click();
    } else {
      if (typeof link === 'string' && link === 'products' && arg) {
        onNavigate('products', arg);
      } else {
        onNavigate(link, arg);
      }
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6" id="hero-banner-section">
      {/* Dynamic Slide Carousel (takes 2 cols on lg) */}
      <div className="lg:col-span-2 relative h-[320px] md:h-[420px] rounded-2xl overflow-hidden shadow-lg group">
        {slides.map((slide: any, index) => (
          <div
            key={slide.id || index}
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${index === activeSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
          >
            {/* Slide Image Backdrop */}
            <div className="absolute inset-0 bg-gradient-to-l from-slate-950/90 via-slate-900/60 to-transparent z-10" />
            <picture className="absolute inset-0 w-full h-full">
              <source media="(max-width: 768px)" srcSet={slide.mobileImage || slide.image} />
              <img
                src={slide.desktopImage || slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover scale-102 group-hover:scale-105 transition-transform duration-10000"
              />
            </picture>

            {/* Slide text details */}
            <div className="absolute inset-0 z-20 flex flex-col justify-center items-start p-8 md:p-12 text-right">
              {slide.badge && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-500 text-slate-950 text-xs font-black rounded-full mb-4 shadow-md animate-bounce">
                  <Percent className="w-3.5 h-3.5" />
                  {slide.badge}
                </span>
              )}
              <h1 className="text-2xl md:text-4xl font-extrabold text-white leading-tight mb-4 max-w-lg drop-shadow-md">
                {slide.title}
              </h1>
              <p className="text-sm md:text-base text-gray-200 max-w-md leading-relaxed mb-6">
                {slide.subtitle}
              </p>
              <button
                onClick={() => handleSlideClick(slide)}
                className="inline-flex items-center gap-2 py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-lg shadow-lg hover:shadow-amber-500/25 transition-all duration-300 cursor-pointer"
              >
                {slide.btnText || 'تصفح العروض'}
                <ChevronLeft className="w-4 h-4 text-slate-950 stroke-[3]" />
              </button>
            </div>
          </div>
        ))}

        {/* Carousel Arrow controllers */}
        {slides.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-slate-900/40 text-white hover:bg-amber-500 hover:text-slate-950 opacity-0 group-hover:opacity-100 transition-all duration-300 focus:outline-none cursor-pointer"
              aria-label="السابق"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-slate-900/40 text-white hover:bg-amber-500 hover:text-slate-950 opacity-0 group-hover:opacity-100 transition-all duration-300 focus:outline-none cursor-pointer"
              aria-label="التالي"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Indicator dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={`w-2.5 h-2.5 rounded-full border border-white/50 transition-all ${i === activeSlide ? 'bg-amber-500 w-6 border-amber-500' : 'bg-white/30'}`}
                aria-label={`شريحة ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Side Promotion Card / Dynamic Flash Sale (takes 1 col on lg) */}
      <div className="h-[320px] md:h-[420px] rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 text-white p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-36 h-36 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        {flashSaleProduct ? (
          <>
            {/* Flash sale exists */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <span className="flex items-center gap-1 text-xs text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  <Clock className="w-3.5 h-3.5" />
                  عرض فلاش سريع!
                </span>
                <span className="text-[10px] text-gray-400 font-mono">ينتهي قريباً</span>
              </div>

              <div className="flex gap-4 items-start mb-4">
                <img
                  src={flashSaleProduct.mainImage}
                  alt={flashSaleProduct.title}
                  className="w-20 h-20 object-cover rounded-lg border border-slate-800 shrink-0 group-hover:scale-105 transition-transform duration-300"
                />
                <div>
                  <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded uppercase">{flashSaleProduct.brand}</span>
                  <h3 className="text-sm font-black text-white mt-1.5 line-clamp-2 leading-snug">{flashSaleProduct.title}</h3>
                </div>
              </div>

              {/* Price details */}
              <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">سعر الفلاش الحالي</span>
                  <span className="text-xl font-black text-amber-500">{flashSaleProduct.discountPrice} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                  <span>السعر الأصلي</span>
                  <span className="line-through">{flashSaleProduct.price} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-xs text-green-500 mt-1 font-bold">
                  <span>نسبة وفرك اليوم</span>
                  <span>خصم {Math.round(((flashSaleProduct.price - (flashSaleProduct.discountPrice || 0)) / flashSaleProduct.price) * 100)}%</span>
                </div>
              </div>
            </div>

            {/* Countdown placeholder animation */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold font-mono">
              <div className="bg-slate-900 py-1.5 rounded-lg border border-slate-800">
                <div className="text-base text-amber-500 font-black animate-pulse">02</div>
                <div className="text-[9px] text-gray-400 font-sans">ساعة</div>
              </div>
              <div className="bg-slate-900 py-1.5 rounded-lg border border-slate-800">
                <div className="text-base text-amber-500 font-black animate-pulse">45</div>
                <div className="text-[9px] text-gray-400 font-sans">دقيقة</div>
              </div>
              <div className="bg-slate-900 py-1.5 rounded-lg border border-slate-800">
                <div className="text-base text-amber-500 font-black animate-pulse">12</div>
                <div className="text-[9px] text-gray-400 font-sans">ثانية</div>
              </div>
            </div>

            <button
              onClick={() => onNavigate('product-details', flashSaleProduct.id)}
              className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              اقتنص الفرصة واشترِ الآن
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
            </button>
          </>
        ) : (
          <>
            {/* Fallback generic promo card */}
            <div>
              <span className="text-xs text-amber-500 font-bold bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">تجهيزات الزفاف</span>
              <h3 className="text-xl font-extrabold text-white mt-4 leading-tight">عروض باقات العروسة للأجهزة المنزلية الكبرى</h3>
              <p className="text-xs text-gray-400 mt-2.5 leading-relaxed">
                وفر الكثير عند شراء طقم أجهزة المنزل الكامل (ثلاجة + غسالة + بوتاجاز + شاشة) مع هدايا قيمة مجانية فورا عند الاستلام.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 flex items-center gap-3">
              <span className="text-3xl font-black text-amber-500">20%</span>
              <span className="text-xs font-bold leading-normal text-gray-300">خصم إضافي عند إدخال الكوبون: <strong className="text-white block mt-1 text-sm bg-slate-800 px-2 py-0.5 rounded font-mono select-all inline-block">WELCOME10</strong></span>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-slate-950 border border-amber-500/20 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              تصفح العروض الحالية
            </button>
          </>
        )}
      </div>
    </section>
  );
}
