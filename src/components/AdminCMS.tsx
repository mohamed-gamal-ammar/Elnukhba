import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, RefreshCw, BadgePercent } from 'lucide-react';
import { api } from '../lib/api.js';
import { SystemSettings } from '../types.js';

interface AdminCMSProps {
  onRefreshAll: () => void;
}

export default function AdminCMS({ onRefreshAll }: AdminCMSProps) {
  const [settings, setSettings] = useState<Partial<SystemSettings> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changing, setChanging] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('يرجى ملء جميع حقول كلمة المرور');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('يجب أن لا تقل كلمة المرور الجديدة عن 6 أحرف');
      return;
    }

    setChanging(true);
    try {
      const res = await api.changeAdminPassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordSuccess('تم تغيير كلمة مرور المسؤول بنجاح 🎉');
        setCurrentPassword('');
        newPassword && setNewPassword('');
        confirmPassword && setConfirmPassword('');
      } else {
        setPasswordError((res as any).error || 'فشلت عملية تغيير كلمة المرور');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'حدث خطأ غير متوقع أثناء تغيير كلمة المرور');
    } finally {
      setChanging(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      setSettings(res);
    } catch (err: any) {
      setError('فشل تحميل الإعدادات الرئيسية للمتجر');
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

    try {
      await api.updateAdminSettings(settings);
      setSuccess('تم حفظ إعدادات وخصائص المتجر والـ CMS بنجاح 🎉');
      onRefreshAll();
    } catch (err: any) {
      setError('فشلت عملية حفظ تعديلات الإعدادات، يرجى مراجعة قيم المدخلات');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        <span className="text-xs">جارٍ جلب إعدادات المبيعات والبيانات الترويجية الحالية...</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 font-sans text-right" id="admin-cms-panel">
      <div className="flex justify-between items-center pb-4 border-b border-slate-800 mb-6">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Settings className="w-4.5 h-4.5 text-amber-500" />
          تعديل محتوى وإعدادات مبيعات المتجر
        </h3>
      </div>

      {/* Notifications */}
      {success && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold">
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {settings && (
        <form onSubmit={handleSettingsSubmit} className="space-y-6">
          {/* Section 1: Store naming & Logos */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-black text-amber-500 pb-2 border-b border-slate-850">العلامة والشعارات (Identity)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">اسم المتجر / اللوجو الرئيسي بالعربية</label>
                <input
                  type="text"
                  value={settings.logoText || ''}
                  onChange={(e) => setSettings({ ...settings, logoText: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">الشعار الفرعي المساعد (Slogan)</label>
                <input
                  type="text"
                  value={settings.logoSubtext || ''}
                  onChange={(e) => setSettings({ ...settings, logoSubtext: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact info */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-black text-amber-500 pb-2 border-b border-slate-850">بيانات الاتصال السريع وخدمة العملاء</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">الخط الساخن أو الهاتف</label>
                <input
                  type="text"
                  value={settings.contactPhone || ''}
                  onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">البريد الإلكتروني للدعم</label>
                <input
                  type="email"
                  value={settings.contactEmail || ''}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">العنوان الجغرافي للمقر الرئيسي</label>
                <input
                  type="text"
                  value={settings.contactAddress || ''}
                  onChange={(e) => setSettings({ ...settings, contactAddress: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Financials & Shipping costs */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-black text-amber-500 pb-2 border-b border-slate-850">القيم المالية وتكلفة الشحن</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">تكلفة نقل شحن الأجهزة الموحدة (جنيه مصري) 🚚</label>
                <input
                  type="number"
                  value={settings.shippingFlatRate === undefined ? '' : settings.shippingFlatRate}
                  onChange={(e) => setSettings({ ...settings, shippingFlatRate: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">نسبة ضريبة القيمة المضافة العشرية (مثال: 0.14 تعني 14%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.taxRate === undefined ? '' : settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Promo banners */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-black text-amber-500 pb-2 border-b border-slate-850">الترويج ولافتة العروض الرئيسية (Promo Banner)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">عنوان اللافتة الترويجية بالصفحة الرئيسية</label>
                <input
                  type="text"
                  value={settings.bannerTitle || ''}
                  onChange={(e) => setSettings({ ...settings, bannerTitle: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">صورة لافتة العرض الرئيسية</label>
                <input
                  type="text"
                  value={settings.bannerImage || ''}
                  onChange={(e) => setSettings({ ...settings, bannerImage: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-300">الوصف الفرعي للافتة الترويجية</label>
              <input
                type="text"
                value={settings.bannerSubtitle || ''}
                onChange={(e) => setSettings({ ...settings, bannerSubtitle: e.target.value })}
                className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Section 5: Social media */}
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80 space-y-4">
            <h4 className="text-xs font-black text-amber-500 pb-2 border-b border-slate-850">روابط منصات التواصل الاجتماعي للمتجر</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">فيسبوك</label>
                <input
                  type="text"
                  value={settings.socialFacebook || ''}
                  onChange={(e) => setSettings({ ...settings, socialFacebook: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">إنستغرام</label>
                <input
                  type="text"
                  value={settings.socialInstagram || ''}
                  onChange={(e) => setSettings({ ...settings, socialInstagram: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">تويتر / X</label>
                <input
                  type="text"
                  value={settings.socialTwitter || ''}
                  onChange={(e) => setSettings({ ...settings, socialTwitter: e.target.value })}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-4 pt-4 border-t border-slate-800">
            <button
              type="submit"
              className="flex-1 py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4.5 h-4.5" />
              حفظ وتطبيق تغييرات إعدادات المتجر
            </button>
          </div>
        </form>
      )}

      {/* قسم حماية وتغيير كلمة مرور المسؤول */}
      <hr className="my-8 border-slate-800" />
      
      <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800/80 space-y-4 text-right" id="admin-change-password-panel" dir="rtl">
        <h4 className="text-xs font-black text-amber-500 pb-2 border-b border-slate-800 flex items-center gap-2">
          <Settings className="w-4 h-4 text-amber-500 font-bold" />
          تأمين لوحة التحكم - تغيير كلمة مرور المشرف (Administrator)
        </h4>

        {passwordSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 font-bold">
            {passwordSuccess}
          </div>
        )}
        {passwordError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-400 font-bold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {passwordError}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="flex flex-col gap-1.5 text-right">
            <label className="text-xs font-bold text-slate-300">كلمة المرور الحالية</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5 text-right">
            <label className="text-xs font-bold text-slate-300">كلمة المرور الجديدة</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5 text-right">
            <label className="text-xs font-bold text-slate-300">تأكيد كلمة المرور الجديدة</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
              dir="ltr"
            />
          </div>
          <div className="md:col-span-3 flex justify-end pt-2">
            <button
              type="submit"
              disabled={changing}
              className="w-full md:w-auto py-2.5 px-6 bg-slate-800 hover:bg-slate-750 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex justify-center items-center gap-1.5 cursor-pointer"
            >
              {changing ? 'جاري الحفظ والتشفير...' : 'تحديث كلمة المرور المشفرة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
