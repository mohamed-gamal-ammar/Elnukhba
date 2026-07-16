import React from 'react';
import { ShieldCheck, Truck, RefreshCw, BadgePercent, Facebook, Instagram, Twitter, PhoneCall, Mail, MapPin } from 'lucide-react';
import { SystemSettings } from '../types.js';

interface FooterProps {
  settings: SystemSettings;
  onNavigate: (tab: string, arg?: any) => void | Promise<void>;
}

export default function Footer({ settings, onNavigate }: FooterProps) {
  return (
    <footer className="bg-slate-900 text-white pt-12 pb-6 border-t border-slate-800" id="site-footer">
      {/* Visual core values icons row */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-2xl bg-slate-950/60 border border-slate-800/60 text-center">
          <div className="flex flex-col items-center p-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-amber-500" />
            </div>
            <h4 className="font-black text-sm text-white mb-1">ضمان معتمد 100%</h4>
            <p className="text-xs text-gray-400">جميع أجهزتنا تأتي بضمان رسمي من الوكلاء المعتمدين</p>
          </div>

          <div className="flex flex-col items-center p-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <Truck className="w-6 h-6 text-amber-500" />
            </div>
            <h4 className="font-black text-sm text-white mb-1">شحن سريع وآمن</h4>
            <p className="text-xs text-gray-400">توصيل سريع لباب بيتك مغلف ومؤمن بالكامل خلال 2-4 أيام</p>
          </div>

          <div className="flex flex-col items-center p-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <RefreshCw className="w-6 h-6 text-amber-500" />
            </div>
            <h4 className="font-black text-sm text-white mb-1">دفع عند الاستلام</h4>
            <p className="text-xs text-gray-400">لا حاجة للدفع مقدماً، افحص جهازك بالكامل ثم ادفع للمندوب</p>
          </div>

          <div className="flex flex-col items-center p-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-3">
              <BadgePercent className="w-6 h-6 text-amber-500" />
            </div>
            <h4 className="font-black text-sm text-white mb-1">عروض وتخفيضات دورية</h4>
            <p className="text-xs text-gray-400">أقوى أسعار الأجهزة الكهربائية في مصر مع كوبونات حصرية</p>
          </div>
        </div>
      </div>

      {/* Main footer contents */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        {/* About column */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col leading-none">
            <span className="text-2xl font-black tracking-tight text-amber-500 font-sans">{settings.logoText}</span>
            <span className="text-[10px] text-gray-400 tracking-wider font-semibold mt-1">{settings.logoSubtext}</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            المنصة العربية الأولى المتخصصة في بيع وتوزيع الأجهزة المنزلية الكبرى والصغرى وأرقى الإلكترونيات الاستهلاكية. نجمع لك الجودة، الضمان الطويل والأسعار التنافسية.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <a href={settings.socialFacebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-slate-800 text-gray-300 hover:bg-amber-500 hover:text-slate-950 transition-all">
              <Facebook className="w-4 h-4" />
            </a>
            <a href={settings.socialInstagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-slate-800 text-gray-300 hover:bg-amber-500 hover:text-slate-950 transition-all">
              <Instagram className="w-4 h-4" />
            </a>
            <a href={settings.socialTwitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-slate-800 text-gray-300 hover:bg-amber-500 hover:text-slate-950 transition-all">
              <Twitter className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Navigation column */}
        <div>
          <h4 className="text-sm font-black text-white border-r-2 border-amber-500 pr-2.5 mb-5 uppercase tracking-wider">خريطة الموقع</h4>
          <ul className="flex flex-col gap-2.5 text-xs text-gray-400 font-medium">
            <li><button onClick={() => onNavigate('home')} className="hover:text-amber-500 transition-colors text-right w-full">الصفحة الرئيسية</button></li>
            <li><button onClick={() => onNavigate('products')} className="hover:text-amber-500 transition-colors text-right w-full">جميع منتجات الأجهزة</button></li>
            <li><button onClick={() => onNavigate('products', { isOffer: true })} className="hover:text-amber-500 transition-colors text-right w-full">أحدث عروض التوفير</button></li>
            <li><button onClick={() => onNavigate('track-order')} className="hover:text-amber-500 transition-colors text-right w-full">تتبع حالة شحنتك</button></li>
            <li><button onClick={() => onNavigate('faq')} className="hover:text-amber-500 transition-colors text-right w-full">مركز الأسئلة الشائعة</button></li>
          </ul>
        </div>

        {/* Policies and legal column */}
        <div>
          <h4 className="text-sm font-black text-white border-r-2 border-amber-500 pr-2.5 mb-5 uppercase tracking-wider">سياسات وقوانين</h4>
          <ul className="flex flex-col gap-2.5 text-xs text-gray-400 font-medium">
            <li><button onClick={() => onNavigate('privacy')} className="hover:text-amber-500 transition-colors text-right w-full">سياسة الخصوصية وسرية البيانات</button></li>
            <li><button onClick={() => onNavigate('terms')} className="hover:text-amber-500 transition-colors text-right w-full">الشروط والأحكام العامة للاستخدام</button></li>
            <li><button onClick={() => onNavigate('faq')} className="hover:text-amber-500 transition-colors text-right w-full">سياسات الضمان والوكلاء المعتمدين</button></li>
            <li><button onClick={() => onNavigate('contact')} className="hover:text-amber-500 transition-colors text-right w-full">طلب الدعم والصيانة المنزلية</button></li>
          </ul>
        </div>

        {/* Contact information column */}
        <div>
          <h4 className="text-sm font-black text-white border-r-2 border-amber-500 pr-2.5 mb-5 uppercase tracking-wider">بيانات الاتصال الدائم</h4>
          <ul className="flex flex-col gap-4 text-xs text-gray-400 font-medium">
            <li className="flex items-start gap-2.5">
              <MapPin className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <span>{settings.contactAddress}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <PhoneCall className="w-4 h-4 text-amber-500 shrink-0" />
              <span dir="ltr">{settings.contactPhone}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{settings.contactEmail}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Underbar footer credit */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 border-t border-slate-800 text-center flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
        <span>{settings.footerText}</span>
        <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-full border border-slate-800/80">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          <span className="text-[10px] text-gray-400 font-mono">طريقة السداد النشطة: الدفع نقداً بالكامل عند الاستلام (COD)</span>
        </div>
      </div>
    </footer>
  );
}
