import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Search, Shield, ShieldOff, CheckCircle2, AlertTriangle,
  Mail, Phone, Calendar, Clock, ShoppingBag, MapPin, Eye, Filter, RefreshCw, X,
  Bell, Send, MessageSquare, Tag, UserCheck, UserX
} from 'lucide-react';
import api, { getFriendlyErrorMessage } from '../lib/api.js';
import { CustomSelect } from './CustomSelect.js';
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

export default function AdminCustomers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Selected customer for modal
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerData, setSelectedCustomerData] = useState<{ customer: any; orders: any[] } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Status updating state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Notification Modal States
  const [sendNotifCustomer, setSendNotifCustomer] = useState<{ id: string; name: string } | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'system' | 'promo' | 'order'>('system');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [notifError, setNotifError] = useState('');

  // Broadcast Modal States
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [bcastTitle, setBcastTitle] = useState('');
  const [bcastMessage, setBcastMessage] = useState('');
  const [bcastType, setBcastType] = useState<'system' | 'promo'>('promo');
  const [bcastTargetStatus, setBcastTargetStatus] = useState<'active' | 'inactive' | 'blocked' | 'all'>('active');
  const [sendingBcast, setSendingBcast] = useState(false);
  const [bcastError, setBcastError] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminCustomers();
      setCustomers(data || []);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل جلب قائمة العملاء'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSelectCustomer = async (id: string) => {
    setSelectedCustomerId(id);
    setLoadingDetails(true);
    try {
      const data = await api.getAdminCustomerById(id);
      setSelectedCustomerData(data);
    } catch (err: any) {
      console.error('Failed to load customer details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'active' | 'inactive' | 'blocked') => {
    setUpdatingId(id);
    try {
      await api.updateAdminCustomerStatus(id, newStatus);
      setSuccessMsg(`تم تحديث حالة العميل بنجاح إلى: ${newStatus === 'active' ? 'نشط' : newStatus === 'blocked' ? 'محظور' : 'غير نشط'}`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadCustomers();
      if (selectedCustomerId === id) {
        handleSelectCustomer(id);
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'فشل تحديث حالة العميل'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendTargetedNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendNotifCustomer) return;
    if (!notifTitle.trim() || !notifMessage.trim()) {
      setNotifError('يرجى كتابة عنوان ورسالة الإشعار');
      return;
    }
    setSendingNotif(true);
    setNotifError('');
    try {
      await api.sendAdminCustomerNotification(sendNotifCustomer.id, {
        title: notifTitle,
        message: notifMessage,
        type: notifType
      });
      setSuccessMsg(`تم إرسال الإشعار للعميل (${sendNotifCustomer.name}) بنجاح`);
      setTimeout(() => setSuccessMsg(''), 4000);
      setSendNotifCustomer(null);
      setNotifTitle('');
      setNotifMessage('');
    } catch (err: any) {
      setNotifError(getFriendlyErrorMessage(err, 'فشل إرسال الإشعار'));
    } finally {
      setSendingNotif(false);
    }
  };

  const handleSendBroadcastNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcastTitle.trim() || !bcastMessage.trim()) {
      setBcastError('يرجى كتابة عنوان ورسالة الإشعار الجماعي');
      return;
    }
    setSendingBcast(true);
    setBcastError('');
    try {
      const res = await api.sendAdminBroadcastNotification({
        title: bcastTitle,
        message: bcastMessage,
        type: bcastType,
        targetStatus: bcastTargetStatus
      });
      setSuccessMsg(`تم إرسال الإشعار الجماعي بنجاح إلى ${res.count} عميل`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setShowBroadcastModal(false);
      setBcastTitle('');
      setBcastMessage('');
    } catch (err: any) {
      setBcastError(getFriendlyErrorMessage(err, 'فشل إرسال الإشعار الجماعي'));
    } finally {
      setSendingBcast(false);
    }
  };

  // Filter logic
  const filteredCustomers = customers.filter(c => {
    const matchesSearch =
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search);
    
    const matchesStatus =
      statusFilter === 'all' || (c.status || 'active') === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Reset page to 1 automatically when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * limit;
    return filteredCustomers.slice(start, start + limit);
  }, [filteredCustomers, currentPage, limit]);

  const totalPages = Math.ceil(filteredCustomers.length / limit) || 1;

  const totalCustomers = customers.length;
  const activeCount = customers.filter(c => (c.status || 'active') === 'active').length;
  const blockedCount = customers.filter(c => c.status === 'blocked').length;

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans text-right" dir="rtl" id="admin-customers-module">
      {/* 1. Page Header */}
      <AdminPageHeader
        title="إدارة حسابات العملاء"
        description="متابعة حسابات المسجلين، إرسال إشعارات مخصصة، وإدارة حالة الحسابات والتراخيص"
        icon={Users}
        badge={<AdminBadge variant="amber">{totalCustomers} عميل</AdminBadge>}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadCustomers}
              disabled={loading}
              className="p-2.5 bg-white hover:bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl transition-colors cursor-pointer shadow-xs"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <AdminButton
              icon={Send}
              onClick={() => {
                setBcastError('');
                setShowBroadcastModal(true);
              }}
            >
              إشعار جماعي
            </AdminButton>
          </div>
        }
      />

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-700 dark:text-rose-400 hover:text-rose-950 dark:hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminStatCard
          title="إجمالي العملاء المسجلين"
          value={totalCustomers}
          icon={Users}
          subtitle="حسابات فردية موثوقة"
        />
        <AdminStatCard
          title="الحسابات النشطة"
          value={activeCount}
          icon={UserCheck}
          trend={{ value: `${activeCount} عميل`, isPositive: true, label: 'متاح لهم الشراء' }}
        />
        <AdminStatCard
          title="الحسابات المحظورة"
          value={blockedCount}
          icon={UserX}
          trend={{ value: `${blockedCount} محظور`, isPositive: false, label: 'ممنوعون من الدخول' }}
        />
      </div>

      {/* 3, 4, 5. Main Card with Search, Filter & Content */}
      <AdminCard className="space-y-4">
        <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
          <AdminSearchInput
            placeholder="بحث باسم العميل، البريد، أو الهاتف..."
            value={search}
            onChange={(val) => setSearch(val)}
            className="flex-1"
          />

          <div className="flex items-center gap-2 w-full md:w-auto min-w-[200px]">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-400 font-bold whitespace-nowrap">حالة الحساب:</span>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              size="sm"
              buttonClassName="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-xl py-2 px-3 focus:border-amber-500 shadow-xs"
              menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[160px]"
              options={[
                { value: 'all', label: 'جميع الحالات' },
                { value: 'active', label: 'نشط فقط' },
                { value: 'inactive', label: 'غير نشط' },
                { value: 'blocked', label: 'محظور فقط' }
              ]}
            />
          </div>
        </div>

        {/* 6. Customer List Table */}
        {loading ? (
          <AdminLoading message="جارٍ تحميل حسابات العملاء..." />
        ) : filteredCustomers.length === 0 ? (
          <AdminEmptyState
            icon={Users}
            title="لا توجد حسابات عملاء تطابق خيارات البحث"
            description="جرب البحث بكلمات مختلفة أو تغيير فلتر حالة الحساب."
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 shadow-xs">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 uppercase font-bold text-[11px]">
                  <tr>
                    <th className="p-4">العميل</th>
                    <th className="p-4">بيانات التواصل</th>
                    <th className="p-4">الحالة والتأكيد</th>
                    <th className="p-4">تاريخ التسجيل</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                  {paginatedCustomers.map((c) => {
                    const status = c.status || 'active';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-black flex items-center justify-center text-sm border border-amber-500/30">
                              {c.name ? c.name.charAt(0).toUpperCase() : 'ع'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block text-sm">{c.name}</span>
                              <span className="text-[10px] text-slate-500 block font-mono">ID: {c.id}</span>
                            </div>
                          </div>
                        </td>

                        <td className="p-4 space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{c.email}</span>
                          </div>
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                              <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                        </td>

                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-start">
                            {status === 'active' && (
                              <AdminBadge variant="success">نشط</AdminBadge>
                            )}
                            {status === 'blocked' && (
                              <AdminBadge variant="danger">محظور</AdminBadge>
                            )}
                            {status === 'inactive' && (
                              <AdminBadge variant="neutral">غير نشط</AdminBadge>
                            )}

                            {c.isVerified ? (
                              <span className="text-sky-600 dark:text-sky-400 text-[10px] flex items-center gap-1 font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> بريد مؤكد
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 text-[10px] flex items-center gap-1 font-semibold">
                                <AlertTriangle className="w-3 h-3" /> غير مؤكد
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="p-4 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                          <div>{c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-EG') : '-'}</div>
                          {c.lastLoginAt && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                              آخر دخول: {new Date(c.lastLoginAt).toLocaleDateString('ar-EG')}
                            </div>
                          )}
                        </td>

                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleSelectCustomer(c.id)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                              title="عرض التفاصيل والطلبات"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => {
                                setNotifError('');
                                setNotifTitle('');
                                setNotifMessage('');
                                setNotifType('system');
                                setSendNotifCustomer({ id: c.id, name: c.name });
                              }}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
                              title="إرسال إشعار خاص للعميل"
                            >
                              <Bell className="w-4 h-4" />
                            </button>

                            {status === 'blocked' ? (
                              <button
                                onClick={() => handleUpdateStatus(c.id, 'active')}
                                disabled={updatingId === c.id}
                                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                إلغاء الحظر
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateStatus(c.id, 'blocked')}
                                disabled={updatingId === c.id}
                                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                              >
                                حظر الحساب
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredCustomers.length > 0 && (
              <div className="pt-2">
                <AdminTablePagination
                  page={currentPage}
                  totalPages={totalPages}
                  total={filteredCustomers.length}
                  limit={limit}
                  onPageChange={(p) => setCurrentPage(p)}
                  onLimitChange={(l) => {
                    setLimit(l);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </AdminCard>

      {/* Customer Details & Order History Modal */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-2xl p-6 text-slate-900 dark:text-slate-100 space-y-6 shadow-2xl relative my-8">
            <button
              onClick={() => {
                setSelectedCustomerId(null);
                setSelectedCustomerData(null);
              }}
              className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-amber-600 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              تفاصيل ملف العميل وسجل الطلبات
            </h3>

            {loadingDetails || !selectedCustomerData ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-bold flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                <span>جاري تحميل بيانات العميل...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Profile Overview Card */}
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">اسم العميل:</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{selectedCustomerData.customer.name}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">البريد الإلكتروني:</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedCustomerData.customer.email}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">رقم الهاتف:</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedCustomerData.customer.phone || 'غير محدد'}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block mb-0.5">حالة الحساب:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{selectedCustomerData.customer.status || 'active'}</span>
                  </div>
                </div>

                {/* Send Notification Button in Details Modal */}
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setNotifError('');
                      setNotifTitle('');
                      setNotifMessage('');
                      setNotifType('system');
                      setSendNotifCustomer({ id: selectedCustomerData.customer.id, name: selectedCustomerData.customer.name });
                    }}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10"
                  >
                    <Bell className="w-4 h-4" />
                    إرسال إشعار لهذا العميل
                  </button>
                </div>

                {/* Addresses List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-500" />
                    العناوين المسجلة ({selectedCustomerData.customer.addresses?.length || 0}):
                  </h4>
                  {selectedCustomerData.customer.addresses?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {selectedCustomerData.customer.addresses.map((addr: any) => (
                        <div key={addr.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3">
                          <span className="font-bold text-amber-600 dark:text-amber-400 block mb-1">{addr.name}</span>
                          <p className="text-slate-700 dark:text-slate-300 text-[11px]">{addr.governorate} - {addr.city} - {addr.address}</p>
                          <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1">المستلم: {addr.recipientName} ({addr.phone})</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">لا توجد عناوين شحن مسجلة للعميل.</p>
                  )}
                </div>

                {/* Customer Orders History */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-amber-500" />
                    سجل الطلبات للفاتورة ({selectedCustomerData.orders?.length || 0}):
                  </h4>
                  {selectedCustomerData.orders?.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {selectedCustomerData.orders.map((ord: any) => (
                        <div key={ord.id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 block">#{ord.id}</span>
                            <span className="text-[10px] text-slate-500">{new Date(ord.createdAt).toLocaleDateString('ar-EG')}</span>
                          </div>
                          <div className="text-slate-700 dark:text-slate-300">
                            <span>{ord.items?.length || 0} منتجات</span>
                          </div>
                          <div>
                            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{ord.total} ج.م</span>
                          </div>
                          <div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {ord.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">لا توجد طلبات شراء سابقة لهذا العميل.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Targeted Notification Modal */}
      {sendNotifCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl p-6 text-slate-900 dark:text-slate-100 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSendNotifCustomer(null)}
              className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-amber-600 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              إرسال إشعار مباشر للعميل: {sendNotifCustomer.name}
            </h3>

            {notifError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{notifError}</span>
              </div>
            )}

            <form onSubmit={handleSendTargetedNotif} className="space-y-4">
              <div>
                <CustomSelect
                  label="نوع الإشعار"
                  value={notifType}
                  onChange={(val) => setNotifType(val as any)}
                  size="sm"
                  buttonClassName="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  options={[
                    { value: 'system', label: 'إشعار نظام (System)' },
                    { value: 'promo', label: 'عروض وترويج (Promo)' },
                    { value: 'order', label: 'تحديث طلب (Order)' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان الإشعار</label>
                <input
                  type="text"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="مثال: خصم خاص 20% على طلبك القادم"
                  maxLength={150}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-400 shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نص الرسالة</label>
                <textarea
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  placeholder="اكتب تفاصيل الإشعار هنا..."
                  rows={4}
                  maxLength={2000}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 resize-none placeholder-slate-400 shadow-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSendNotifCustomer(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={sendingNotif}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {sendingNotif ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال الإشعار
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Notification Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl p-6 text-slate-900 dark:text-slate-100 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowBroadcastModal(false)}
              className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-black text-amber-600 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Send className="w-5 h-5" />
              إرسال إشعار جماعي لعملاء المتجر (Broadcast)
            </h3>

            {bcastError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{bcastError}</span>
              </div>
            )}

            <form onSubmit={handleSendBroadcastNotif} className="space-y-4">
              <div>
                <CustomSelect
                  label="الفئة المستهدفة من العملاء"
                  value={bcastTargetStatus}
                  onChange={(val) => setBcastTargetStatus(val as any)}
                  size="sm"
                  buttonClassName="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  options={[
                    { value: 'active', label: 'العملاء النشطون فقط (Active)' },
                    { value: 'inactive', label: 'العملاء غير النشطين فقط (Inactive)' },
                    { value: 'all', label: 'جميع الحسابات النشطة وغير النشطة (الاستثناء: المحظورون)' },
                    { value: 'blocked', label: 'الحسابات المحظورة فقط (Blocked)' }
                  ]}
                />
              </div>

              <div>
                <CustomSelect
                  label="نوع الإشعار الجماعي"
                  value={bcastType}
                  onChange={(val) => setBcastType(val as any)}
                  size="sm"
                  buttonClassName="w-full bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                  options={[
                    { value: 'promo', label: 'عرض ترويجي وخاص (Promo)' },
                    { value: 'system', label: 'تنبيه نظام هامة (System)' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان الإشعار</label>
                <input
                  type="text"
                  value={bcastTitle}
                  onChange={(e) => setBcastTitle(e.target.value)}
                  placeholder="مثال: مفاجأة متجر النخبة! خصم 15% على جميع الشاشات"
                  maxLength={150}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-400 shadow-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">نص الرسالة</label>
                <textarea
                  value={bcastMessage}
                  onChange={(e) => setBcastMessage(e.target.value)}
                  placeholder="اكتب تفاصيل العرض أو الرسالة العامة..."
                  rows={4}
                  maxLength={2000}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 resize-none placeholder-slate-400 shadow-xs"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={sendingBcast}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {sendingBcast ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال للجميع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
