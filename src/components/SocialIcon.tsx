import React from 'react';
import {
  Facebook,
  Instagram,
  Twitter,
  Youtube,
  Linkedin,
  Github,
  Globe,
  Link as LinkIcon,
  Phone,
  Mail,
  Send,
  Music2,
  Share2,
  ExternalLink,
  MessageCircle,
  Pin,
  AtSign,
  Radio,
  Tv,
  Store
} from 'lucide-react';

export interface SocialIconOption {
  key: string;
  name: string;
  nameAr: string;
  category: 'social' | 'messaging' | 'media' | 'professional' | 'other';
  colorClass?: string;
  bgColorClass?: string;
}

export const POPULAR_SOCIAL_PLATFORMS: SocialIconOption[] = [
  { key: 'facebook', name: 'Facebook', nameAr: 'فيسبوك', category: 'social', colorClass: 'text-blue-600', bgColorClass: 'bg-blue-500/10 hover:bg-blue-600 hover:text-white' },
  { key: 'instagram', name: 'Instagram', nameAr: 'إنستغرام', category: 'social', colorClass: 'text-pink-600', bgColorClass: 'bg-pink-500/10 hover:bg-pink-600 hover:text-white' },
  { key: 'twitter', name: 'X / Twitter', nameAr: 'إكس (تويتر)', category: 'social', colorClass: 'text-slate-800 dark:text-slate-200', bgColorClass: 'bg-slate-500/10 hover:bg-slate-900 hover:text-white' },
  { key: 'tiktok', name: 'TikTok', nameAr: 'تيك توك', category: 'media', colorClass: 'text-rose-500', bgColorClass: 'bg-rose-500/10 hover:bg-rose-600 hover:text-white' },
  { key: 'whatsapp', name: 'WhatsApp', nameAr: 'واتساب', category: 'messaging', colorClass: 'text-emerald-600', bgColorClass: 'bg-emerald-500/10 hover:bg-emerald-600 hover:text-white' },
  { key: 'youtube', name: 'YouTube', nameAr: 'يوتيوب', category: 'media', colorClass: 'text-red-600', bgColorClass: 'bg-red-500/10 hover:bg-red-600 hover:text-white' },
  { key: 'telegram', name: 'Telegram', nameAr: 'تيليجرام', category: 'messaging', colorClass: 'text-sky-500', bgColorClass: 'bg-sky-500/10 hover:bg-sky-500 hover:text-white' },
  { key: 'snapchat', name: 'Snapchat', nameAr: 'سناب شات', category: 'social', colorClass: 'text-amber-500', bgColorClass: 'bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950' },
  { key: 'linkedin', name: 'LinkedIn', nameAr: 'لينكد إن', category: 'professional', colorClass: 'text-blue-700', bgColorClass: 'bg-blue-700/10 hover:bg-blue-700 hover:text-white' },
  { key: 'threads', name: 'Threads', nameAr: 'ثريدز', category: 'social', colorClass: 'text-slate-900 dark:text-slate-100', bgColorClass: 'bg-slate-500/10 hover:bg-slate-800 hover:text-white' },
  { key: 'pinterest', name: 'Pinterest', nameAr: 'بينتيريست', category: 'media', colorClass: 'text-red-500', bgColorClass: 'bg-red-500/10 hover:bg-red-600 hover:text-white' },
  { key: 'github', name: 'GitHub', nameAr: 'جيت هاب', category: 'professional', colorClass: 'text-slate-800 dark:text-slate-200', bgColorClass: 'bg-slate-500/10 hover:bg-slate-900 hover:text-white' },
  { key: 'discord', name: 'Discord', nameAr: 'ديسكورد', category: 'messaging', colorClass: 'text-indigo-600', bgColorClass: 'bg-indigo-500/10 hover:bg-indigo-600 hover:text-white' },
  { key: 'phone', name: 'Phone', nameAr: 'الهاتف / الاتصال', category: 'messaging', colorClass: 'text-emerald-600', bgColorClass: 'bg-emerald-500/10 hover:bg-emerald-600 hover:text-white' },
  { key: 'email', name: 'Email', nameAr: 'البريد الإلكتروني', category: 'messaging', colorClass: 'text-amber-600', bgColorClass: 'bg-amber-500/10 hover:bg-amber-600 hover:text-white' },
  { key: 'website', name: 'Website / Store', nameAr: 'الموقع الإلكتروني', category: 'other', colorClass: 'text-slate-600 dark:text-slate-300', bgColorClass: 'bg-slate-500/10 hover:bg-amber-500 hover:text-slate-950' },
  { key: 'link', name: 'Direct Link', nameAr: 'رابط مباشر', category: 'other', colorClass: 'text-slate-600 dark:text-slate-300', bgColorClass: 'bg-slate-500/10 hover:bg-amber-500 hover:text-slate-950' },
];

interface SocialIconProps {
  icon?: string;
  className?: string;
}

export const SocialIcon: React.FC<SocialIconProps> = ({ icon, className = 'w-5 h-5' }) => {
  const normalized = (icon || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  switch (normalized) {
    case 'facebook':
    case 'fb':
      return <Facebook className={className} />;

    case 'instagram':
    case 'ig':
    case 'insta':
      return <Instagram className={className} />;

    case 'twitter':
    case 'x':
    case 'twitterx':
      return <Twitter className={className} />;

    case 'youtube':
    case 'yt':
      return <Youtube className={className} />;

    case 'linkedin':
    case 'in':
      return <Linkedin className={className} />;

    case 'github':
    case 'git':
      return <Github className={className} />;

    case 'tiktok':
    case 'tik-tok':
      return <Music2 className={className} />;

    case 'telegram':
    case 'tg':
      return <Send className={className} />;

    case 'whatsapp':
    case 'wa':
      return <MessageCircle className={className} />;

    case 'snapchat':
    case 'snap':
      return <Radio className={className} />;

    case 'pinterest':
    case 'pin':
      return <Pin className={className} />;

    case 'threads':
      return <AtSign className={className} />;

    case 'phone':
    case 'tel':
    case 'call':
      return <Phone className={className} />;

    case 'email':
    case 'mail':
      return <Mail className={className} />;

    case 'website':
    case 'web':
    case 'store':
      return <Store className={className} />;

    case 'globe':
      return <Globe className={className} />;

    case 'link':
    case 'external':
      return <LinkIcon className={className} />;

    default:
      return <Globe className={className} />;
  }
};

export default SocialIcon;
