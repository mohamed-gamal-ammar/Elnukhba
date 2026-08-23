import React, { useState, useEffect } from 'react';
import { Tag, Clock, Sparkles, Truck, ChevronLeft, Percent, Gift, AlertCircle } from 'lucide-react';
import { Campaign, Product } from '../types.js';

interface CampaignBannerProps {
  campaigns: Campaign[];
  onNavigate: (tab: string, arg?: any) => void;
}

export function getMatchingCampaign(product: Product, campaigns: Campaign[]): Campaign | null {
  if (!campaigns || campaigns.length === 0) return null;
  const now = new Date();

  for (const c of campaigns) {
    if (!c.active) continue;
    if (c.startAt && new Date(c.startAt) > now) continue;
    if (c.endAt && new Date(c.endAt) < now) continue;

    const hasProductTargets = Array.isArray(c.productIds) && c.productIds.length > 0;
    const hasCategoryTargets = Array.isArray(c.categoryIds) && c.categoryIds.length > 0;

    const matchesProduct = hasProductTargets && c.productIds!.includes(product.id);
    const matchesCategory = hasCategoryTargets && c.categoryIds!.includes(product.category);

    // Specific target match takes priority
    if (matchesProduct || matchesCategory) {
      return c;
    }

    // Global campaign (no specific product/category restrictions)
    if (!hasProductTargets && !hasCategoryTargets) {
      return c;
    }
  }

  return null;
}

function CampaignCountdown({ endAt }: { endAt: string }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    if (!endAt) return;

    const calculateTimeLeft = () => {
      const diff = new Date(endAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [endAt]);

  if (!timeLeft) return null;

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs font-bold bg-slate-950/40 text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30 backdrop-blur-xs">
      <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
      <span className="text-[10px] text-slate-300 font-sans ml-1">ينتهي خلال:</span>
      {timeLeft.days > 0 && <span>{timeLeft.days}ي </span>}
      <span>{String(timeLeft.hours).padStart(2, '0')}س:</span>
      <span>{String(timeLeft.minutes).padStart(2, '0')}د:</span>
      <span>{String(timeLeft.seconds).padStart(2, '0')}ث</span>
    </div>
  );
}

export default function CampaignBanner({ campaigns, onNavigate }: CampaignBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Filter out inactive and expired campaigns
  const validCampaigns = React.useMemo(() => {
    if (!Array.isArray(campaigns)) return [];
    const now = new Date();
    return campaigns.filter(c => {
      if (!c.active) return false;
      if (c.startAt && new Date(c.startAt) > now) return false;
      if (c.endAt && new Date(c.endAt) < now) return false;
      return true;
    });
  }, [campaigns]);

  useEffect(() => {
    if (validCampaigns.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % validCampaigns.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [validCampaigns.length]);

  if (validCampaigns.length === 0) {
    return null;
  }

  const campaign = validCampaigns[activeIndex] || validCampaigns[0];

  const handleBannerAction = () => {
    if (campaign.categoryIds && campaign.categoryIds.length > 0) {
      onNavigate('products', { category: campaign.categoryIds[0] });
    } else {
      onNavigate('products');
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 md:px-6 my-6" id="storefront-campaign-banner">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-slate-900 via-amber-950/80 to-slate-900 border border-amber-500/30 p-6 md:p-8 text-white shadow-xl">
        {/* Background Decorative Glow */}
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-10 w-48 h-48 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Left / Info Side */}
          <div className="flex-1 text-right space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                حملة ترويجية خاصة
              </span>

              {campaign.type === 'percentage' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                  <Percent className="w-3 h-3" />
                  خصم {campaign.value}%
                </span>
              )}

              {campaign.type === 'fixed' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs">
                  <Tag className="w-3 h-3" />
                  خصم بقيمة {campaign.value} ج.م
                </span>
              )}

              {campaign.type === 'free_shipping' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs">
                  <Truck className="w-3.5 h-3.5" />
                  شحن مجاني لكافة الطلبات
                </span>
              )}

              {campaign.endAt && <CampaignCountdown endAt={campaign.endAt} />}
            </div>

            <h2 className="text-xl md:text-3xl font-black text-white leading-tight tracking-tight">
              {campaign.name}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-medium">
              {campaign.minimumOrderValue !== undefined && campaign.minimumOrderValue > 0 && (
                <span className="flex items-center gap-1 text-amber-200">
                  • الحد الأدنى للطلب: <strong className="text-amber-400">{campaign.minimumOrderValue} ج.م</strong>
                </span>
              )}
              {campaign.maximumDiscountAmount !== undefined && campaign.maximumDiscountAmount > 0 && (
                <span className="flex items-center gap-1 text-amber-200">
                  • أقصى قيمة للخصم: <strong className="text-amber-400">{campaign.maximumDiscountAmount} ج.م</strong>
                </span>
              )}
              <span className="text-slate-400">• يتم تطبيق التخفيض تلقائياً عند صفحة إتمام الشراء</span>
            </div>
          </div>

          {/* Right / CTA Side */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={handleBannerAction}
              className="w-full sm:w-auto px-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg hover:shadow-amber-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer group"
            >
              <span>تسوق منتجات العرض الآن</span>
              <ChevronLeft className="w-4 h-4 stroke-[3] group-hover:-translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Multi-campaign indicators if more than one campaign is active */}
        {validCampaigns.length > 1 && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold ml-2">عروض نشطة أخرى:</span>
            {validCampaigns.map((c, idx) => (
              <button
                key={c.id || idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === activeIndex
                    ? 'w-6 bg-amber-400'
                    : 'w-2 bg-slate-700 hover:bg-slate-500'
                }`}
                title={c.name}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
