import React, { useState, useEffect, useMemo } from 'react';
import {
  Star, Search, Filter, CheckCircle2, XCircle, Trash2, MessageSquare,
  RefreshCw, AlertCircle, RotateCcw, Eye, Clock, ShieldCheck, CornerDownLeft, X
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminBadge,
  AdminEmptyState,
  AdminLoading,
  AdminSearchInput,
  AdminButton
} from './AdminUIComponents.js';
import { AdminTablePagination } from './AdminTableComponents.js';
import { CustomSelect } from './CustomSelect.js';

export default function AdminReviews() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    hidden: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Reply modal state
  const [replyModalReview, setReplyModalReview] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const loadReviews = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAdminReviews();
      if (res && Array.isArray(res.reviews)) {
        setReviews(res.reviews);
      } else if (Array.isArray(res)) {
        setReviews(res);
      } else {
        setReviews([]);
      }
      if (res?.stats) {
        setStats(res.stats);
      }
    } catch (err: any) {
      console.error('Failed to load admin reviews:', err);
      setError(getFriendlyErrorMessage(err, 'فشل تحميل قائمة التقييمات والمراجعات'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  // Reset page to 1 automatically when search, filters, or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, ratingFilter, statusFilter, sortBy]);

  // Client-side filtering & sorting
  const filteredReviews = useMemo(() => {
    return reviews.filter((r) => {
      // 1. Search Filter
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const userName = (r.userName || '').toLowerCase();
        const userEmail = (r.userEmail || '').toLowerCase();
        const title = (r.title || '').toLowerCase();
        const comment = (r.comment || '').toLowerCase();
        const productTitle = (r.productTitle || '').toLowerCase();

        const matches =
          userName.includes(term) ||
          userEmail.includes(term) ||
          title.includes(term) ||
          comment.includes(term) ||
          productTitle.includes(term);

        if (!matches) return false;
      }

      // 2. Rating Filter
      if (ratingFilter !== 'all') {
        if (String(r.rating) !== String(ratingFilter)) return false;
      }

      // 3. Status Filter
      if (statusFilter !== 'all') {
        const rStatus = r.status || 'approved';
        if (rStatus !== statusFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'ratingDesc') return (b.rating || 0) - (a.rating || 0);
      if (sortBy === 'ratingAsc') return (a.rating || 0) - (b.rating || 0);
      if (sortBy === 'oldest') {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateA - dateB;
      }
      // Default 'newest'
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [reviews, search, ratingFilter, statusFilter, sortBy]);

  const paginatedReviews = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredReviews.slice(start, start + limit);
  }, [filteredReviews, currentPage, limit]);

  const totalPages = Math.ceil(filteredReviews.length / limit) || 1;

  // Handle Approve / Reject
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setError('');
    setSuccess('');
    try {
      await api.updateAdminReviewStatus(id, newStatus);
      setSuccess(`تم تغيير حالة التقييم بنجاح إلى "${newStatus === 'approved' ? 'معتمد' : newStatus === 'rejected' ? 'مرفوض' : newStatus}"`);
      loadReviews();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحديث حالة التقييم'));
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المراجعة والتقييم نهائياً؟')) return;
    setError('');
    setSuccess('');
    try {
      await api.deleteAdminReview(id);
      setSuccess('تم حذف التقييم بنجاح');
      loadReviews();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حذف التقييم'));
    }
  };

  // Handle Submit Admin Reply
  const handleOpenReplyModal = (r: any) => {
    setReplyModalReview(r);
    setReplyText(r.adminResponse || '');
  };

  const handleSaveReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyModalReview) return;
    setReplying(true);
    setError('');
    setSuccess('');
    try {
      await api.updateAdminReviewStatus(
        replyModalReview.id,
        replyModalReview.status || 'approved',
        replyText
      );
      setSuccess('تم حفظ رد الإدارة على التقييم بنجاح');
      setReplyModalReview(null);
      setReplyText('');
      loadReviews();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل حفظ رد الإدارة'));
    } finally {
      setReplying(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <AdminBadge variant="success">معتمد</AdminBadge>;
      case 'pending':
        return <AdminBadge variant="warning">قيد المراجعة</AdminBadge>;
      case 'rejected':
        return <AdminBadge variant="danger">مرفوض</AdminBadge>;
      case 'hidden':
        return <AdminBadge variant="neutral">مخفي</AdminBadge>;
      default:
        return <AdminBadge variant="neutral">{status}</AdminBadge>;
    }
  };

  return (
    <div className="space-y-6 font-sans text-right dir-rtl" dir="rtl" id="admin-reviews-panel">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة مراجعات وتقييمات العملاء"
        description="مراجعة، اعتماد، والرد على تقييمات العملاء للمنتجات مع التحكم المباشر بالحالة"
        icon={Star}
        badge={
          (stats.pending || reviews.filter(r => r.status === 'pending').length) > 0 ? (
            <AdminBadge variant="amber">
              {stats.pending || reviews.filter(r => r.status === 'pending').length} بانتظار الاعتماد
            </AdminBadge>
          ) : undefined
        }
        actions={
          <button
            type="button"
            onClick={loadReviews}
            disabled={loading}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </button>
        }
      />

      {/* Notifications */}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between">
          <span>{success}</span>
          <button type="button" onClick={() => setSuccess('')} className="cursor-pointer text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-white">
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
          <button type="button" onClick={() => setError('')} className="cursor-pointer text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Summary Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="إجمالي التقييمات"
          value={stats.total || reviews.length}
          icon={Star}
          subtitle="جميع تقييمات المتجر"
        />
        <AdminStatCard
          title="بانتظار الاعتماد"
          value={stats.pending || reviews.filter(r => r.status === 'pending').length}
          icon={Clock}
          trend={{
            value: `${stats.pending || reviews.filter(r => r.status === 'pending').length} تقييم`,
            isPositive: (stats.pending || reviews.filter(r => r.status === 'pending').length) === 0,
            label: 'تتطلب المراجعة'
          }}
        />
        <AdminStatCard
          title="التقييمات المعتمدة"
          value={stats.approved || reviews.filter(r => (r.status || 'approved') === 'approved').length}
          icon={CheckCircle2}
          subtitle="منشورة وظاهرة للزوار"
        />
        <AdminStatCard
          title="المرفوضة والمخفية"
          value={(stats.rejected + stats.hidden) || reviews.filter(r => r.status === 'rejected' || r.status === 'hidden').length}
          icon={XCircle}
          subtitle="غير منشورة بالمتجر"
        />
      </div>

      {/* 3, 4, 5, 6. Main Card with Search, Filter & Content */}
      <AdminCard className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <AdminSearchInput
            value={search}
            onChange={(val) => setSearch(val)}
            placeholder="بحث بالعميل، المنتج، أو التقييم..."
          />

          {/* Rating Filter */}
          <div className="min-w-[160px]">
            <CustomSelect
              value={ratingFilter}
              onChange={(val) => setRatingFilter(val)}
              size="sm"
              buttonClassName="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-white"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[180px]"
              options={[
                { value: 'all', label: 'كل التقييمات بالنجوم' },
                { value: '5', label: '⭐⭐⭐⭐⭐ 5 نجوم' },
                { value: '4', label: '⭐⭐⭐⭐ 4 نجوم' },
                { value: '3', label: '⭐⭐⭐ 3 نجوم' },
                { value: '2', label: '⭐⭐ 2 نجوم' },
                { value: '1', label: '⭐ 1 نجمة' }
              ]}
            />
          </div>

          {/* Status Filter */}
          <div className="min-w-[180px]">
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              size="sm"
              buttonClassName="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-white"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[190px]"
              options={[
                { value: 'all', label: 'كل الحالات' },
                { value: 'pending', label: 'بانتظار المراجعة (Pending)' },
                { value: 'approved', label: 'معتمدة (Approved)' },
                { value: 'rejected', label: 'مرفوضة (Rejected)' },
                { value: 'hidden', label: 'مخفية (Hidden)' }
              ]}
            />
          </div>

          {/* Sort */}
          <div className="min-w-[170px]">
            <CustomSelect
              value={sortBy}
              onChange={(val) => setSortBy(val)}
              size="sm"
              buttonClassName="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-white"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[180px]"
              options={[
                { value: 'newest', label: 'الأحدث أولاً' },
                { value: 'oldest', label: 'الأقدم أولاً' },
                { value: 'ratingDesc', label: 'التقييم: الأعلى أولاً' },
                { value: 'ratingAsc', label: 'التقييم: الأقل أولاً' }
              ]}
            />
          </div>
        </div>

        {/* Reviews Table */}
        {loading ? (
          <AdminLoading message="جاري تحميل تقييمات ومراجعات العملاء..." />
        ) : filteredReviews.length === 0 ? (
          <AdminEmptyState
            icon={Star}
            title="لا توجد مراجعات تقييم تطابق خيارات البحث والفلترة"
            description="لم يتم العثور على أي تقييمات تطابق الفلاتر المحددة حالياً."
            action={
              (search || ratingFilter !== 'all' || statusFilter !== 'all') ? (
                <AdminButton
                  variant="outline"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => {
                    setSearch('');
                    setRatingFilter('all');
                    setStatusFilter('all');
                    setSortBy('newest');
                  }}
                >
                  إعادة ضبط البحث والفلاتر
                </AdminButton>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[11px]">
                    <th className="py-3 px-3">المنتج</th>
                    <th className="py-3 px-3">صاحب التقييم</th>
                    <th className="py-3 px-3">التقييم والملاحظات</th>
                    <th className="py-3 px-3">الحالة</th>
                    <th className="py-3 px-3">التاريخ</th>
                    <th className="py-3 px-3 text-left pl-6">إجراءات تحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                  {paginatedReviews.map((r) => {
                    const status = r.status || 'approved';
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-950/20">
                        {/* Product Info */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5 max-w-xs">
                            {r.productMainImage ? (
                              <img
                                src={r.productMainImage}
                                alt={r.productTitle || ''}
                                className="w-9 h-9 object-cover rounded border border-slate-200 dark:border-slate-800 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-400 dark:text-slate-500">
                                <Star className="w-4 h-4" />
                              </div>
                            )}
                            <div className="truncate">
                              <span className="font-bold text-slate-900 dark:text-white block truncate">{r.productTitle || 'منتج غير معروف'}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">ID: {r.productId}</span>
                            </div>
                          </div>
                        </td>

                        {/* Customer Info */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{r.userName || 'زائر / عميل'}</div>
                          {r.userEmail && <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{r.userEmail}</div>}
                          {r.isVerifiedPurchase && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded mt-0.5">
                              <ShieldCheck className="w-2.5 h-2.5" /> شراء مؤكد
                            </span>
                          )}
                        </td>

                        {/* Rating & Review Details */}
                        <td className="py-3 px-3 max-w-md">
                          <div className="flex items-center gap-1 mb-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3.5 h-3.5 ${
                                  star <= (r.rating || 5)
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-200 dark:text-slate-700'
                                }`}
                              />
                            ))}
                            <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 font-mono mr-1">{r.rating || 5}/5</span>
                          </div>
                          {r.title && <div className="font-bold text-slate-900 dark:text-white text-xs mb-0.5">{r.title}</div>}
                          {r.comment && <p className="text-slate-600 dark:text-slate-300 text-xs leading-normal line-clamp-2">{r.comment}</p>}

                          {/* Admin Response inside table row */}
                          {r.adminResponse && (
                            <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg text-[11px] text-amber-900 dark:text-amber-300 flex items-start gap-1.5">
                              <CornerDownLeft className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-bold text-amber-700 dark:text-amber-400 block text-[10px]">رد الإدارة:</span>
                                <span>{r.adminResponse}</span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {renderStatusBadge(status)}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' }) : '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-left pl-6 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(r.id, 'approved')}
                                className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="اعتماد المراجعة"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(r.id, 'rejected')}
                                className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                title="رفض المراجعة"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenReplyModal(r)}
                              className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-400 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              title="إضافة أو تعديل رد الإدارة"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r.id)}
                              className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              title="حذف نهائي"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 7. Pagination */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <AdminTablePagination
                page={currentPage}
                totalPages={totalPages}
                total={filteredReviews.length}
                limit={limit}
                onPageChange={(p) => setCurrentPage(p)}
                onLimitChange={(l) => {
                  setLimit(l);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </AdminCard>

      {/* Reply Modal */}
      {replyModalReview && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full text-right shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                رد الإدارة على التقييم
              </h4>
              <button
                type="button"
                onClick={() => setReplyModalReview(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">{replyModalReview.userName} - {replyModalReview.productTitle}</div>
              <div className="text-amber-500 dark:text-amber-400 font-mono font-bold">التقييم: {replyModalReview.rating}/5 ⭐</div>
              <p className="text-slate-500 dark:text-slate-400 italic">"{replyModalReview.comment || replyModalReview.title}"</p>
            </div>

            <form onSubmit={handleSaveReply} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  نص رد إدارة المتجر (سيظهر علناً للعملاء):
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  placeholder="مثال: شكرًا لك على تقييمك الرائع! نحن سعداء بخدمتك وسعداء بتجربتك الإيجابية للأجهزة."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500/60 leading-relaxed text-right"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReplyModalReview(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={replying}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {replying && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>حفظ الرد</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
