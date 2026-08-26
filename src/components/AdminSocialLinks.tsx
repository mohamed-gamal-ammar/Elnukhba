import React, { useState, useEffect } from 'react';
import {
  Share2, Plus, Edit2, Trash2, ArrowUp, ArrowDown, ExternalLink,
  CheckCircle2, AlertCircle, RefreshCw, X, Globe, Eye,
  Sliders, Link2, Check, Sparkles
} from 'lucide-react';
import { SocialLink } from '../types.js';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { SocialIcon, POPULAR_SOCIAL_PLATFORMS, SocialIconOption } from './SocialIcon.js';
import {
  AdminPageHeader,
  AdminCard,
  AdminButton,
  AdminBadge,
  AdminEmptyState,
  AdminLoading
} from './AdminUIComponents.js';

interface AdminSocialLinksProps {
  onUpdated?: () => void;
}

export const AdminSocialLinks: React.FC<AdminSocialLinksProps> = ({ onUpdated }) => {
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formIcon, setFormIcon] = useState('facebook');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formOpenInNewTab, setFormOpenInNewTab] = useState(true);
  const [formError, setFormError] = useState('');

  // Delete Confirmation Modal
  const [deletingItem, setDeletingItem] = useState<SocialLink | null>(null);

  const fetchLinks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminSocialLinks();
      setSocialLinks(data);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحميل روابط التواصل الاجتماعي'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const showNotification = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormIcon('facebook');
    setFormEnabled(true);
    setFormOrder((socialLinks.length > 0 ? Math.max(...socialLinks.map(s => s.order || 0)) : 0) + 1);
    setFormOpenInNewTab(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (link: SocialLink) => {
    setEditingId(link.id);
    setFormName(link.name);
    setFormUrl(link.url);
    setFormIcon(link.icon || 'link');
    setFormEnabled(link.enabled !== false);
    setFormOrder(link.order || 1);
    setFormOpenInNewTab(link.openInNewTab !== false);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSelectPresetPlatform = (preset: SocialIconOption) => {
    setFormIcon(preset.key);
    if (!formName || POPULAR_SOCIAL_PLATFORMS.some(p => p.nameAr === formName || p.name === formName)) {
      setFormName(preset.nameAr);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('يرجى إدخال اسم منصة التواصل');
      return;
    }

    const cleanUrl = formUrl.trim();
    if (!cleanUrl) {
      setFormError('يرجى إدخال الرابط');
      return;
    }

    if (/^(javascript|data|vbscript|file):/i.test(cleanUrl) || /<[^>]*>/g.test(cleanUrl) || /on\w+\s*=/i.test(cleanUrl)) {
      setFormError('الرابط المدخل غير صالح أو يحتوي على بروتوكول غير آمن');
      return;
    }

    let finalUrl = cleanUrl;
    if (!/^https?:\/\//i.test(finalUrl) && !/^mailto:/i.test(finalUrl) && !/^tel:/i.test(finalUrl)) {
      if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      } else {
        setFormError('يرجى إدخال رابط يبدأ بـ https:// أو بريد mailto: أو هاتف tel:');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Partial<SocialLink> = {
        name: cleanName,
        url: finalUrl,
        icon: (formIcon || 'link').toLowerCase().trim(),
        enabled: formEnabled,
        order: Number(formOrder) || 1,
        openInNewTab: formOpenInNewTab
      };

      if (editingId) {
        await api.updateAdminSocialLink(editingId, payload);
        showNotification('تم تحديث منصة التواصل الاجتماعي بنجاح ✅');
      } else {
        await api.createAdminSocialLink(payload);
        showNotification('تمت إضافة منصة التواصل الاجتماعي بنجاح ✅');
      }

      setIsModalOpen(false);
      await fetchLinks();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setFormError(getFriendlyErrorMessage(err, 'فشل حفظ منصة التواصل'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (link: SocialLink) => {
    try {
      const newStatus = !link.enabled;
      await api.updateAdminSocialLink(link.id, { enabled: newStatus });
      setSocialLinks(prev => prev.map(s => s.id === link.id ? { ...s, enabled: newStatus } : s));
      showNotification(newStatus ? `تم تفعيل "${link.name}" بنجاح 🟢` : `تم تعطيل "${link.name}" بنجاح ⚪`);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تغيير حالة المنصة'));
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setSaving(true);
    try {
      await api.deleteAdminSocialLink(deletingItem.id);
      showNotification(`تم حذف "${deletingItem.name}" بنجاح 🗑️`);
      setDeletingItem(null);
      await fetchLinks();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حذف منصة التواصل'));
    } finally {
      setSaving(false);
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= socialLinks.length) return;

    const newLinks = [...socialLinks];
    const temp = newLinks[index];
    newLinks[index] = newLinks[targetIndex];
    newLinks[targetIndex] = temp;

    // Reassign orders
    const items = newLinks.map((item, idx) => ({
      id: item.id,
      order: idx + 1
    }));

    setSocialLinks(newLinks.map((item, idx) => ({ ...item, order: idx + 1 })));

    try {
      await api.reorderAdminSocialLinks(items);
      showNotification('تم تحديث ترتيب المنصات بنجاح 🔄');
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حفظ الترتيب الجديد'));
      fetchLinks();
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" id="admin-social-links-manager" dir="rtl">
      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="p-1 hover:bg-red-500/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-500/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-amber-500" />
            إدارة روابط وقنوات التواصل الاجتماعي (Dynamic Social Links)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            أضف وعدّل قنوات التواصل التي تظهر في تذييل الموقع (Footer)، صفحة التواصل (Contact Us)، وبيانات محركات البحث (SEO).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <AdminButton
            variant="secondary"
            onClick={fetchLinks}
            disabled={loading}
            className="text-xs"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </AdminButton>

          <AdminButton
            variant="primary"
            onClick={handleOpenAddModal}
            className="text-xs font-black"
            id="btn-add-social-link"
          >
            <Plus className="w-4 h-4" />
            إضافة منصة تواصل
          </AdminButton>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <AdminLoading message="جارٍ تحميل منصات التواصل الاجتماعي..." />
      ) : socialLinks.length === 0 ? (
        <AdminEmptyState
          icon={Share2}
          title="لا توجد منصات تواصل اجتماعي مضافة"
          description="قم بإضافة روابط صفحاتك على فيسبوك، إنستغرام، واتساب، أو أي منصة أخرى لعرضها لعملائك"
          action={
            <AdminButton variant="primary" onClick={handleOpenAddModal}>
              <Plus className="w-4 h-4" />
              إضافة منصة الآن
            </AdminButton>
          }
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                <tr>
                  <th className="p-3.5 w-16 text-center">الترتيب</th>
                  <th className="p-3.5">المنصة والأيقونة</th>
                  <th className="p-3.5">الرابط الوجهة (URL)</th>
                  <th className="p-3.5 text-center w-28">تبويب جديد</th>
                  <th className="p-3.5 text-center w-28">الحالة</th>
                  <th className="p-3.5 text-center w-36">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {socialLinks.map((link, index) => (
                  <tr
                    key={link.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                      !link.enabled ? 'opacity-60 bg-slate-50/50 dark:bg-slate-900/40' : ''
                    }`}
                    id={`social-row-${link.id}`}
                  >
                    {/* Order Controls */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded text-slate-400 hover:text-amber-500 disabled:opacity-20 transition-colors cursor-pointer"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 w-5">
                          {link.order || index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleMoveOrder(index, 'down')}
                          disabled={index === socialLinks.length - 1}
                          className="p-1 rounded text-slate-400 hover:text-amber-500 disabled:opacity-20 transition-colors cursor-pointer"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Platform & Icon */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                          <SocialIcon icon={link.icon} className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {link.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            رمز الأيقونة: {link.icon || 'link'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* URL */}
                    <td className="p-3 max-w-xs">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1.5 font-mono text-[11px] truncate"
                        dir="ltr"
                        title={link.url}
                      >
                        <span className="truncate">{link.url}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>

                    {/* Open in New Tab */}
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        link.openInNewTab !== false
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {link.openInNewTab !== false ? 'نعم (_blank)' : 'نفس النافذة'}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(link)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                          link.enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 hover:bg-slate-300'
                        }`}
                        title={link.enabled ? 'اضغط للتعطيل' : 'اضغط للتفعيل'}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${link.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {link.enabled ? 'نشط' : 'معطل'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(link)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
                          title="تعديل المنصة"
                          id={`btn-edit-social-${link.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingItem(link)}
                          className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="حذف المنصة"
                          id={`btn-delete-social-${link.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 📝 Modal: Add / Edit Social Link */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden text-right shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                {editingId ? <Edit2 className="w-4 h-4 text-amber-500" /> : <Plus className="w-4 h-4 text-amber-500" />}
                {editingId ? 'تعديل منصة التواصل الاجتماعي' : 'إضافة منصة تواصل اجتماعي جديدة'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Preset Icon Selector Grid */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>اختر المنصة أو الأيقونة:</span>
                  <span className="text-[11px] text-amber-500 font-normal">اختر من النماذج الجاهزة</span>
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
                  {POPULAR_SOCIAL_PLATFORMS.map((preset) => {
                    const isSelected = formIcon.toLowerCase() === preset.key.toLowerCase();
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handleSelectPresetPlatform(preset)}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400 font-bold shadow-xs scale-105'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-500/40'
                        }`}
                      >
                        <SocialIcon icon={preset.key} className="w-4.5 h-4.5 mb-1" />
                        <span className="text-[10px] truncate max-w-full">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Platform Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  اسم المنصة <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: صفحتنا على فيسبوك، حساب إنستغرام، قناة واتساب"
                  className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              {/* Platform URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  رابط المنصة (URL) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://facebook.com/your-store"
                  className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                  dir="ltr"
                  required
                />
              </div>

              {/* Custom Icon Key & Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    مفتاح الأيقونة (Icon Key)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
                      <SocialIcon icon={formIcon} className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      value={formIcon}
                      onChange={(e) => setFormIcon(e.target.value.toLowerCase().trim())}
                      placeholder="facebook, instagram, tiktok..."
                      className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    الترتيب التسلسلي
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formOrder}
                    onChange={(e) => setFormOrder(parseInt(e.target.value) || 1)}
                    className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formEnabled}
                    onChange={(e) => setFormEnabled(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">تفعيل المنصة</span>
                    <span className="text-[10px] text-slate-400">إظهار الرابط للزوار</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formOpenInNewTab}
                    onChange={(e) => setFormOpenInNewTab(e.target.checked)}
                    className="w-4 h-4 text-amber-500 rounded focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">فتح في تبويب جديد</span>
                    <span className="text-[10px] text-slate-400">_blank مع حماية noopener</span>
                  </div>
                </label>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                    <SocialIcon icon={formIcon} className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      {formName || 'اسم المنصة'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px] block" dir="ltr">
                      {formUrl || 'https://...'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-bold">
                  معاينة حية
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-colors flex justify-center items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {saving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {editingId ? 'حفظ التعديلات' : 'إضافة المنصة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🗑️ Modal: Delete Confirmation */}
      {/* ========================================================================= */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 text-center shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                تأكيد حذف منصة التواصل
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                هل أنت متأكد من حذف منصة <strong className="text-slate-900 dark:text-white">"{deletingItem.name}"</strong> نهائياً من المتجر؟
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={saving}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl transition-colors flex justify-center items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSocialLinks;
