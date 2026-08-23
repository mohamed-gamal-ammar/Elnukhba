import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Search, Filter, CheckCheck, Trash2, CheckCircle2,
  AlertTriangle, ShoppingCart, Package, Star, Sparkles, Clock,
  Truck, ShieldAlert, Database, RefreshCw, X, ChevronRight,
  ChevronLeft, Calendar, Tag, AlertOctagon, Eye, RotateCcw
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import {
  AdminCard,
  AdminPageHeader,
  AdminEmptyState,
  AdminLoading,
  AdminBadge,
  AdminStatCard,
  AdminButton,
  AdminSearchInput
} from './AdminUIComponents.js';
import { AdminTablePagination } from './AdminTableComponents.js';
import { CustomSelect } from './CustomSelect.js';

interface AdminNotificationsProps {
  setActiveSubTab?: (tab: string) => void;
  onRefreshAll?: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  icon?: string;
  read: boolean;
  isRead?: boolean;
  adminId?: string | null;
  createdAt: string;
  timestamp?: string;
  expiresAt?: string | null;
  metadata?: Record<string, any>;
}

export default function AdminNotifications({ setActiveSubTab, onRefreshAll }: AdminNotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Pagination & Counts
  const [total, setTotal] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(15);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Confirm delete modal
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminNotifications({
        search,
        priority: priorityFilter,
        type: typeFilter,
        read: readFilter,
        dateFrom,
        dateTo,
        page,
        limit
      });

      if (res && res.success) {
        setNotifications(res.notifications || []);
        setTotal(res.total || 0);
        setUnreadCount(res.unreadCount || 0);
        setTotalPages(res.totalPages || 1);
      } else {
        setError(getFriendlyErrorMessage((res as any)?.message, 'فشل استرجاع قائمة الإشعارات.'));
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء تحميل الإشعارات'));
    } finally {
      setLoading(false);
    }
  }, [search, priorityFilter, typeFilter, readFilter, dateFrom, dateTo, page, limit]);

  useEffect(() => {
    fetchNotifications();
  }, [page, limit, priorityFilter, typeFilter, readFilter, dateFrom, dateTo]);

  // Debounced search trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      fetchNotifications();
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      showSuccess('تم تحديث حالة الإشعار كـ مقروء');
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحديث حالة الإشعار'));
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true, isRead: true })));
      setUnreadCount(0);
      showSuccess('تم تحديد جميع الإشعارات كمقروءة بنجاح');
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحديث الإشعارات'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(true);
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setTotal(prev => Math.max(0, prev - 1));
      showSuccess('تم حذف الإشعار بنجاح');
      setDeletingId(null);
      if (onRefreshAll) onRefreshAll();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حذف الإشعار'));
    } finally {
      setActionLoading(false);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setPriorityFilter('all');
    setTypeFilter('all');
    setReadFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Helper for rendering dynamic icon based on type or icon key
  const renderIcon = (type: string, iconName?: string) => {
    const iconClass = "w-5 h-5 shrink-0";
    if (iconName === 'shopping-cart' || type === 'order') {
      return <ShoppingCart className={`${iconClass} text-sky-400`} />;
    }
    if (iconName === 'package' || type === 'stock') {
      return <Package className={`${iconClass} text-amber-400`} />;
    }
    if (iconName === 'star' || type === 'review') {
      return <Star className={`${iconClass} text-yellow-400`} />;
    }
    if (iconName === 'clock' || type === 'campaign') {
      return <Sparkles className={`${iconClass} text-purple-400`} />;
    }
    if (iconName === 'truck' || type === 'supplier') {
      return <Truck className={`${iconClass} text-emerald-400`} />;
    }
    if (iconName === 'shield-alert' || type === 'security') {
      return <ShieldAlert className={`${iconClass} text-rose-500 animate-pulse`} />;
    }
    if (iconName === 'database' || type === 'backup') {
      return <Database className={`${iconClass} text-amber-400`} />;
    }
    if (iconName === 'alert-triangle') {
      return <AlertTriangle className={`${iconClass} text-rose-400`} />;
    }
    return <Bell className={`${iconClass} text-amber-400`} />;
  };

  // Priority Label and Styling Helpers
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <AdminBadge variant="danger">
            <AlertOctagon className="w-3 h-3" /> عاجل جداً
          </AdminBadge>
        );
      case 'high':
        return (
          <AdminBadge variant="warning">
            <AlertTriangle className="w-3 h-3" /> عالية
          </AdminBadge>
        );
      case 'medium':
        return (
          <AdminBadge variant="amber">
            متوسطة
          </AdminBadge>
        );
      case 'low':
      default:
        return (
          <AdminBadge variant="neutral">
            منخفضة
          </AdminBadge>
        );
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'order': return 'الطلبات والمبيعات';
      case 'stock': return 'تنبيهات المخزون';
      case 'campaign': return 'الحملات والعروض';
      case 'review': return 'مراجعات العملاء';
      case 'supplier': return 'الموردين والشحنات';
      case 'backup': return 'نسخ احتياطي';
      case 'security': return 'الأمان والحماية';
      case 'system':
      default: return 'تنبيهات النظام';
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (isNaN(diffSec) || diffSec < 0) return 'الآن';
    if (diffSec < 60) return 'منذ لحظات';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 dir-rtl font-sans" dir="rtl" id="admin-notifications-module">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="مركز إشعارات وتنبيهات الإدارة"
        description="متابعة تنبيهات المبيعات، حركات المخزون، العروض الترويجية، ومحاولات الأمان"
        icon={Bell}
        badge={
          unreadCount > 0 ? (
            <AdminBadge variant="amber">
              {unreadCount} غير مقروء
            </AdminBadge>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <AdminButton
                icon={CheckCheck}
                onClick={handleMarkAllRead}
                disabled={actionLoading}
              >
                تحديد الكل كمقروء
              </AdminButton>
            )}

            <button
              onClick={fetchNotifications}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer shadow-xs"
              title="إعادة تحميل"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>
        }
      />

      {/* Toast Feedback Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-400 font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl flex items-center justify-between text-xs text-rose-800 dark:text-rose-400 font-bold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-700 dark:text-rose-400 hover:text-rose-950 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="إجمالي الإشعارات"
          value={total}
          icon={Bell}
          subtitle="سجل التنبيهات المسجل في النظام"
        />
        <AdminStatCard
          title="إشعارات غير مقروءة"
          value={unreadCount}
          icon={AlertOctagon}
          trend={{ value: `${unreadCount} تنبيه`, isPositive: unreadCount === 0, label: 'تتطلب الانتباه' }}
        />
        <AdminStatCard
          title="إشعارات مقروءة"
          value={Math.max(0, total - unreadCount)}
          icon={CheckCircle2}
          subtitle="تمت مراجعتها مسبقاً"
        />
        <AdminStatCard
          title="الصفحة الحالية"
          value={`${page} / ${totalPages}`}
          icon={Clock}
          subtitle={`عرض ${limit} إشعار لكل صفحة`}
        />
      </div>

      {/* 3, 4, 5. Main Card with Search, Filter & Content */}
      <AdminCard className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <AdminSearchInput
            placeholder="بحث بالكلمة المفتاحية أو العنوان..."
            value={search}
            onChange={(val) => setSearch(val)}
            className="w-full"
          />

          {/* Priority filter */}
          <div className="min-w-[140px]">
            <CustomSelect
              value={priorityFilter}
              onChange={(val) => { setPriorityFilter(val); setPage(1); }}
              size="sm"
              buttonClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white shadow-xs"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[160px]"
              options={[
                { value: 'all', label: 'جميع الأولويات' },
                { value: 'urgent', label: '🔴 عاجل جداً (Urgent)' },
                { value: 'high', label: '🟠 عالية (High)' },
                { value: 'medium', label: '🟡 متوسطة (Medium)' },
                { value: 'low', label: '⚪ منخفضة (Low)' }
              ]}
            />
          </div>

          {/* Type filter */}
          <div className="min-w-[170px]">
            <CustomSelect
              value={typeFilter}
              onChange={(val) => { setTypeFilter(val); setPage(1); }}
              size="sm"
              buttonClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white shadow-xs"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[180px]"
              options={[
                { value: 'all', label: 'جميع الأنواع' },
                { value: 'order', label: '🛒 الطلبات والمبيعات' },
                { value: 'stock', label: '📦 تنبيهات المخزون' },
                { value: 'campaign', label: '✨ الحملات والعروض' },
                { value: 'review', label: '⭐ مراجعات العملاء' },
                { value: 'supplier', label: '🚚 الموردين والشحنات' },
                { value: 'security', label: '🛡️ الأمان والحماية' },
                { value: 'backup', label: '💾 نسخ احتياطي' },
                { value: 'system', label: '⚙️ تنبيهات النظام' }
              ]}
            />
          </div>

          {/* Read status filter */}
          <div className="min-w-[180px]">
            <CustomSelect
              value={readFilter}
              onChange={(val) => { setReadFilter(val); setPage(1); }}
              size="sm"
              buttonClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white shadow-xs"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[190px]"
              options={[
                { value: 'all', label: 'الكل (مقروء وغير مقروء)' },
                { value: 'unread', label: '🔔 غير مقروء فقط' },
                { value: 'read', label: '✅ مقروء فقط' }
              ]}
            />
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/60 text-xs">
          <span className="text-slate-600 dark:text-slate-400 font-bold flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-amber-500" /> تصفية بالتاريخ:
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">من:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">إلى:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>
          {(search || priorityFilter !== 'all' || typeFilter !== 'all' || readFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={resetFilters}
              className="text-amber-600 dark:text-amber-400 hover:underline text-xs mr-auto font-bold cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              إعادة ضبط الفلاتر
            </button>
          )}
        </div>

        {/* 6. Notifications List Section */}
        {loading ? (
          <AdminLoading message="جارٍ تحميل سجل الإشعارات والتنبيهات..." />
        ) : notifications.length === 0 ? (
          <AdminEmptyState
            icon={Bell}
            title="لا توجد إشعارات تطابق خيارات البحث"
            description="لم نجد أية إشعارات مطابقة للفلاتر المحددة حالياً. يمكنك إعادة ضبط الفلاتر لاستعراض المزيد."
            action={
              <AdminButton
                variant="outline"
                size="sm"
                icon={RotateCcw}
                onClick={resetFilters}
              >
                إعادة ضبط جميع البحث والفلاتر
              </AdminButton>
            }
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const isUnread = !(notif.read || notif.isRead);
              const isUrgent = notif.priority === 'urgent';
              const isHigh = notif.priority === 'high';

              let cardBorder = 'border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950/40 shadow-xs';
              if (isUnread) {
                if (isUrgent) cardBorder = 'border-rose-300 dark:border-rose-500/60 bg-rose-50/60 dark:bg-rose-500/5 shadow-md shadow-rose-500/5';
                else if (isHigh) cardBorder = 'border-amber-300 dark:border-amber-500/50 bg-amber-50/60 dark:bg-amber-500/5 shadow-xs';
                else cardBorder = 'border-amber-200 dark:border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5 shadow-xs';
              }

              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border transition-all duration-200 relative group flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${cardBorder}`}
                >
                  <div className="flex items-start gap-3.5 w-full min-w-0">
                    {/* Icon Badge */}
                    <div className={`p-2.5 rounded-xl shrink-0 ${isUnread ? 'bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20' : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'}`}>
                      {renderIcon(notif.type, notif.icon)}
                    </div>

                    {/* Body Content */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Priority Badge */}
                        {getPriorityBadge(notif.priority)}

                        {/* Type Badge */}
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2 py-0.5 rounded-md">
                          {getTypeLabel(notif.type)}
                        </span>

                        {/* Unread indicator */}
                        {isUnread ? (
                          <AdminBadge variant="amber">جديد</AdminBadge>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">مقروء</span>
                        )}

                        {/* Relative Time */}
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mr-auto" dir="ltr">
                          <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          {formatRelativeTime(notif.createdAt || notif.timestamp || '')}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className={`text-xs font-bold ${isUnread ? 'text-slate-900 dark:text-white font-black' : 'text-slate-800 dark:text-slate-200'}`}>
                        {notif.title}
                      </h4>

                      {/* Message */}
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        {notif.message}
                      </p>

                      {/* Metadata details if available */}
                      {notif.metadata && Object.keys(notif.metadata).length > 0 && (
                        <div className="pt-1 flex flex-wrap gap-2">
                          {Object.entries(notif.metadata).map(([k, v]) => (
                            <span key={k} className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                              {k}: <strong className="text-amber-600 dark:text-amber-400">{String(v)}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions button column */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 dark:bg-slate-900 dark:hover:bg-amber-500/20 border border-slate-200 dark:border-slate-800 dark:hover:border-amber-500/40 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-xs"
                        title="تحديد كمقروء"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        تحديد كمقروء
                      </button>
                    )}

                    <button
                      onClick={() => setDeletingId(notif.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title="حذف الإشعار"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* 7. Pagination */}
            {total > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <AdminTablePagination
                  page={page}
                  totalPages={totalPages}
                  total={total}
                  limit={limit}
                  onPageChange={(p) => setPage(p)}
                  onLimitChange={(l) => {
                    setLimit(l);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </div>
        )}
      </AdminCard>

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-xs p-4 animate-in fade-in-50 duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4 text-slate-900 dark:text-white">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">هل أنت متأكد من حذف هذا الإشعار؟</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">لا يمكن التراجع عن إجراء الحذف بعد إتمامه.</p>
            </div>
            <div className="flex items-center gap-3 w-full mt-2">
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={actionLoading}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                حذف نهائي
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
