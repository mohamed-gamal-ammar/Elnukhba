import React, { useState, useEffect } from 'react';
import {
  User, MapPin, Heart, ShoppingBag, Package, Bell, Shield, ShieldCheck, Lock, Trash2, Edit2,
  Plus, CheckCircle, AlertTriangle, Key, Loader2, X, ExternalLink,
  Calendar, RefreshCw, Send, Mail, Check, Phone, ChevronRight, Eye, EyeOff,
  Truck, CreditCard, Tag, Star, MessageSquare, RotateCcw, ArrowLeftRight,
  CheckCircle2, Clock, AlertCircle, FileText, Image as ImageIcon
} from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext.js';
import { Product, ReturnRequest, ReturnReason, ReturnStatus } from '../types.js';
import api, { getFriendlyErrorMessage } from '../lib/api.js';
import { CustomSelect } from './CustomSelect.js';

interface CustomerAccountSystemProps {
  products: Product[];
  onNavigate: (tab: string, arg?: any) => void;
  initialSubTab?: string;
  onAddToCart?: (product: Product, variant?: any) => void;
}

export default function CustomerAccountSystem({
  products,
  onNavigate,
  initialSubTab = 'profile',
  onAddToCart
}: CustomerAccountSystemProps) {
  const {
    customer,
    isLoading,
    addresses,
    wishlist,
    savedCart,
    notifications,
    orders,
    error,
    login,
    register,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    updateProfile,
    changePassword,
    deleteAccount,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
    toggleWishlist,
    markNotificationsAsRead,
    markNotificationAsRead,
    deleteNotification,
    clearNotifications,
    clearError
  } = useCustomerAuth();

  // Authentication sub-views: 'login', 'register', 'forgot', 'reset', 'verify'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'reset' | 'verify'>('login');
  
  // Dashboard active sub-tab: 'profile', 'addresses', 'wishlist', 'orders', 'notifications', 'security'
  const [activeTab, setActiveTab] = useState<string>(initialSubTab);

  // Notification category filter
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread' | 'order' | 'system' | 'promo'>('all');

  // Form Fields State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMeInput, setRememberMeInput] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  // Password Reset State
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Email Verification State
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');

  // Sandbox demo helper (displays the verification/reset code inside a helper banner for seamless local previewing)
  const [sandboxCode, setSandboxCode] = useState<string | null>(null);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');

  // Change Password State
  const [oldPassword, setOldPassword] = useState('');
  const [changeNewPassword, setChangeNewPassword] = useState('');
  const [changeConfirmPassword, setChangeConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Address Modal / Form State
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressName, setAddressName] = useState('');
  const [addressRecipient, setAddressRecipient] = useState('');
  const [addressPhone, setAddressPhone] = useState('');
  const [addressGovernorate, setAddressGovernorate] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [addressBuilding, setAddressBuilding] = useState('');
  const [addressApartment, setAddressApartment] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressNotes, setAddressNotes] = useState('');
  const [addressIsDefault, setAddressIsDefault] = useState(false);

  // Action feedback states
  const [actionLoading, setActionLoading] = useState(false);
  const [localSuccess, setLocalSuccess] = useState('');
  const [localError, setLocalError] = useState('');

  // Customer Reviews State (Phase 9.3)
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [myReviewsLoading, setMyReviewsLoading] = useState(false);
  const [myReviewsError, setMyReviewsError] = useState('');

  // Editing Review State
  const [editingReview, setEditingReview] = useState<any | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editTitle, setEditTitle] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Deleting Review State
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  // Customer Product Returns State
  const [customerReturns, setCustomerReturns] = useState<ReturnRequest[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsError, setReturnsError] = useState('');

  // Submit Return Modal State
  const [returnModalItem, setReturnModalItem] = useState<{ order: any; item: any } | null>(null);
  const [returnReason, setReturnReason] = useState<ReturnReason>('defective');
  const [returnOtherReason, setReturnOtherReason] = useState('');
  const [returnCustomerNote, setReturnCustomerNote] = useState('');
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnImageUrlInput, setReturnImageUrlInput] = useState('');
  const [returnImages, setReturnImages] = useState<string[]>([]);
  const [returnSubmitLoading, setReturnSubmitLoading] = useState(false);
  const [returnSubmitSuccess, setReturnSubmitSuccess] = useState('');
  const [returnSubmitError, setReturnSubmitError] = useState('');

  const loadCustomerReturns = async () => {
    setReturnsLoading(true);
    setReturnsError('');
    try {
      const res = await api.getCustomerReturnRequests();
      setCustomerReturns(res || []);
    } catch (err: any) {
      console.error('Failed to load customer return requests:', err);
      setReturnsError(getFriendlyErrorMessage(err, 'تعذر تحميل طلبات الإرجاع الخاصة بك.'));
    } finally {
      setReturnsLoading(false);
    }
  };

  useEffect(() => {
    if ((activeTab === 'returns' || activeTab === 'orders') && customer) {
      loadCustomerReturns();
    }
  }, [activeTab, customer]);

  const handleOpenReturnModal = (order: any, item: any) => {
    setReturnModalItem({ order, item });
    setReturnReason('defective');
    setReturnOtherReason('');
    setReturnCustomerNote('');
    setReturnQuantity(1);
    setReturnImages([]);
    setReturnImageUrlInput('');
    setReturnSubmitSuccess('');
    setReturnSubmitError('');
  };

  const handleAddReturnImage = () => {
    if (returnImageUrlInput.trim()) {
      setReturnImages(prev => [...prev, returnImageUrlInput.trim()]);
      setReturnImageUrlInput('');
    }
  };

  const handleRemoveReturnImage = (index: number) => {
    setReturnImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReturnRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalItem) return;

    setReturnSubmitLoading(true);
    setReturnSubmitSuccess('');
    setReturnSubmitError('');

    try {
      const res = await api.createReturnRequest({
        orderId: returnModalItem.order.id,
        productId: returnModalItem.item.productId || returnModalItem.item.id,
        variantId: returnModalItem.item.variantId || returnModalItem.item.variantSku || returnModalItem.item.variant?.id,
        orderItemId: returnModalItem.item.id || returnModalItem.item.orderItemId,
        quantity: returnQuantity,
        reason: returnReason,
        otherReason: returnOtherReason,
        customerNote: returnCustomerNote,
        images: returnImages
      });

      if (res.success) {
        setReturnSubmitSuccess('تم إرسال طلب الإرجاع بنجاح وسيتواصل معك فريق خدمة العملاء قريباً.');
        setTimeout(() => {
          setReturnModalItem(null);
          setActiveTab('returns');
          loadCustomerReturns();
        }, 1500);
      }
    } catch (err: any) {
      console.error('Failed to submit return request:', err);
      setReturnSubmitError(getFriendlyErrorMessage(err, 'تعذر إرسال طلب الإرجاع.'));
    } finally {
      setReturnSubmitLoading(false);
    }
  };

  const handleCancelReturnRequest = async (id: string) => {
    if (!confirm('هل أنت متأكد من إيقاف وإلغاء طلب الإرجاع هذا؟')) return;
    try {
      setLocalError('');
      await api.cancelCustomerReturnRequest(id);
      setLocalSuccess('تم إلغاء طلب الإرجاع بنجاح.');
      await loadCustomerReturns();
    } catch (err: any) {
      console.error('Failed to cancel return request:', err);
      setLocalError(getFriendlyErrorMessage(err, 'فشل إلغاء طلب الإرجاع.'));
    }
  };

  const loadMyReviews = async () => {
    setMyReviewsLoading(true);
    setMyReviewsError('');
    try {
      const res = await api.getCustomerReviews();
      setMyReviews(res || []);
    } catch (err: any) {
      console.error('Failed to load customer reviews:', err);
      setMyReviewsError(getFriendlyErrorMessage(err, 'تعذر تحميل قائمة تقييماتك الشخصية.'));
    } finally {
      setMyReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reviews' && customer) {
      loadMyReviews();
    }
  }, [activeTab, customer]);

  const handleOpenEditReview = (review: any) => {
    setEditingReview(review);
    setEditRating(review.rating || 5);
    setEditTitle(review.title || '');
    setEditComment(review.comment || '');
    setEditError('');
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;

    if (!editComment.trim()) {
      setEditError('يرجى كتابة تعليقك قبل التحديث');
      return;
    }
    if (!editRating || editRating < 1 || editRating > 5) {
      setEditError('يرجى تحديد التقييم بالنجوم من 1 إلى 5');
      return;
    }

    setEditLoading(true);
    setEditError('');
    try {
      await api.updateCustomerReview(editingReview.id, {
        rating: editRating,
        title: editTitle.trim() || undefined,
        comment: editComment.trim()
      });
      setLocalSuccess('تم تحديث مراجعتك وتقييمك بنجاح');
      setEditingReview(null);
      await loadMyReviews();
    } catch (err: any) {
      setEditError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء تحديث التقييم'));
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteReviewConfirm = async (reviewId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المراجعة والتقييم بالكامل؟')) return;
    setDeletingReviewId(reviewId);
    try {
      await api.deleteCustomerReview(reviewId);
      setLocalSuccess('تم حذف تقييمك ومراجعتك بنجاح');
      await loadMyReviews();
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'فشل حذف المراجعة'));
    } finally {
      setDeletingReviewId(null);
    }
  };

  const getModerationStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'معتمد', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
      case 'rejected':
        return { label: 'مرفوض', color: 'bg-rose-50 text-rose-800 border-rose-200' };
      case 'hidden':
        return { label: 'مخفي', color: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'pending':
      default:
        return { label: 'قيد المراجعة', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
  };

  // Selected Order details modal state
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [fetchingOrderDetail, setFetchingOrderDetail] = useState(false);

  const handleViewOrderDetails = async (orderId: string) => {
    try {
      setFetchingOrderDetail(true);
      setLocalError('');
      const freshOrder = await api.getCustomerOrderById(orderId);
      setSelectedOrder(freshOrder);
    } catch (err: any) {
      const fallback = orders.find(o => o.id === orderId || o.invoiceNumber === orderId);
      if (fallback) {
        setSelectedOrder(fallback);
      } else {
        setLocalError(getFriendlyErrorMessage(err, 'فشل تحميل تفاصيل الفاتورة وتتبع الشحنة'));
      }
    } finally {
      setFetchingOrderDetail(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return { label: 'قيد المراجعة والتحقق', color: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' };
      case 'Confirmed':
        return { label: 'تم التأكيد - جاري التجهيز', color: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' };
      case 'Preparing':
        return { label: 'قيد التغليف والتحضير', color: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' };
      case 'Shipped':
        return { label: 'تم الشحن مع المندوب', color: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800' };
      case 'Delivered':
        return { label: 'تم التوصيل بنجاح', color: 'bg-green-50 text-green-800 border-green-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' };
      case 'Cancelled':
        return { label: 'ملغي', color: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' };
      case 'Returned':
        return { label: 'مرتجع', color: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800' };
      default:
        return { label: status, color: 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700' };
    }
  };

  const getTimelineStatusText = (status: string) => {
    switch (status) {
      case 'Pending': return 'تم استلام وتسجيل الطلب بنجاح';
      case 'Confirmed': return 'تم تأكيد الطلب وجاري تجهيز المنتجات';
      case 'Preparing': return 'تحت التغليف والتحضير الفني بالمستودع';
      case 'Shipped': return 'خرجت الشحنة مع مندوب التوصيل السريع';
      case 'Delivered': return 'تم تسليم الشحنة للمستلم وتحصيل المبلغ';
      case 'Cancelled': return 'تم إلغاء الطلب وإرجاع المخزون';
      case 'Returned': return 'تم استرجاع الطلب للمستودع';
      default: return status;
    }
  };

  // Sync state from context when customer changes
  useEffect(() => {
    if (customer) {
      setProfileName(customer.name);
      setProfilePhone(customer.phone || '');
      // If customer is registered but not verified, redirect to verify
      if (!customer.isVerified) {
        setVerificationEmail(customer.email);
        setAuthMode('verify');
      }
    }
  }, [customer]);

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  // Read notifications on tab mount
  useEffect(() => {
    if (customer && activeTab === 'notifications') {
      markNotificationsAsRead();
    }
  }, [activeTab, customer]);

  // Governorate list for address select
  const governorates = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "البحر الأحمر", "البحيرة", "الفيوم",
    "الغربية", "الإسماعيلية", "المنوفية", "المنيا", "القليوبية", "الوادي الجديد", "السويس",
    "أسوان", "أسيوط", "بني سويف", "بورسعيد", "دمياط", "الشرقية", "جنوب سيناء", "كفر الشيخ",
    "مطروح", "الأقصر", "قنا", "شمال سيناء", "سوهـاج"
  ];

  // Submit login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      setLocalError('يرجى ملء جميع الحقول الإلزامية');
      return;
    }
    try {
      setActionLoading(true);
      setLocalError('');
      const res = await login(emailInput, passwordInput, rememberMeInput);
      setLocalSuccess('تم تسجيل الدخول بنجاح!');
      if (!res.customer.isVerified) {
        setVerificationEmail(emailInput);
        setAuthMode('verify');
      }
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'فشل تسجيل الدخول. يرجى التحقق من بياناتك.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Submit registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput || !emailInput || !passwordInput) {
      setLocalError('يرجى ملء جميع الحقول الإلزامية');
      return;
    }
    if (passwordInput.length < 8) {
      setLocalError('كلمة المرور يجب ألا تقل عن 8 أحرف');
      return;
    }
    try {
      setActionLoading(true);
      setLocalError('');
      const res = await register({
        name: nameInput,
        email: emailInput,
        password: passwordInput,
        phone: phoneInput || undefined
      });
      setVerificationEmail(emailInput);
      setAuthMode('verify');
      if (res.verificationCode) {
        setSandboxCode(res.verificationCode); // Save for quick demo entry!
      }
      setLocalSuccess(res.message);
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء إنشاء الحساب.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Resend verification code
  const handleResendCode = async () => {
    if (!verificationEmail) return;
    try {
      setActionLoading(true);
      setLocalError('');
      const res = await resendVerification(verificationEmail);
      if (res.verificationCode) {
        setSandboxCode(res.verificationCode);
      }
      setLocalSuccess('تم إرسال كود تفعيل جديد بنجاح.');
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'فشل إعادة إرسال الكود'));
    } finally {
      setActionLoading(false);
    }
  };

  // Submit email verification
  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCodeInput) return;
    try {
      setActionLoading(true);
      setLocalError('');
      await verifyEmail(verificationEmail, verificationCodeInput);
      setLocalSuccess('تم تفعيل الحساب بنجاح!');
      setSandboxCode(null);
      // Log them in immediately by typing their details or reload context
      await login(emailInput || verificationEmail, passwordInput);
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'كود التفعيل غير صحيح'));
    } finally {
      setActionLoading(false);
    }
  };

  // Submit forgot password
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) {
      setLocalError('البريد الإلكتروني مطلوب');
      return;
    }
    try {
      setActionLoading(true);
      setLocalError('');
      const res = await forgotPassword(emailInput);
      setLocalSuccess(res.message || 'إذا كان البريد الإلكتروني مسجلاً، فستصلك تعليمات استعادة كلمة المرور.');
      setVerificationEmail(emailInput);
      if (res.resetToken) {
        setSandboxCode(res.resetToken);
      } else {
        setSandboxCode(null);
      }
      setAuthMode('reset');
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'إذا كان البريد الإلكتروني مسجلاً، فستصلك تعليمات استعادة كلمة المرور.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Submit reset password
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationEmail || !resetToken || !newPassword) {
      setLocalError('جميع الحقول مطلوبة');
      return;
    }
    if (newPassword.length < 8) {
      setLocalError('كلمة المرور يجب ألا تقل عن 8 أحرف');
      return;
    }
    try {
      setActionLoading(true);
      setLocalError('');
      await resetPassword({
        email: verificationEmail,
        token: resetToken,
        newPassword: newPassword
      });
      setLocalSuccess('تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مجدداً.');
      setSandboxCode(null);
      setAuthMode('login');
      setNewPassword('');
      setResetToken('');
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'كود الاستعادة غير صحيح أو منتهي الصلاحية'));
    } finally {
      setActionLoading(false);
    }
  };

  // Submit profile edit
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setLocalError('');
      await updateProfile({ name: profileName, phone: profilePhone });
      setIsEditingProfile(false);
      setLocalSuccess('تم تحديث الملف الشخصي بنجاح');
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'فشل تحديث البيانات'));
    } finally {
      setActionLoading(false);
    }
  };

  // Submit password change
  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !changeNewPassword || !changeConfirmPassword) {
      setPasswordError('يرجى ملء جميع الحقول الإلزامية');
      return;
    }
    if (changeNewPassword.length < 8) {
      setPasswordError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف');
      return;
    }
    if (changeNewPassword !== changeConfirmPassword) {
      setPasswordError('كلمتا المرور الجديدتان غير متطابقتين');
      return;
    }
    if (changeNewPassword === oldPassword) {
      setPasswordError('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية');
      return;
    }
    try {
      setActionLoading(true);
      setPasswordError('');
      setPasswordSuccess('');
      await changePassword({ oldPassword, newPassword: changeNewPassword });
      setPasswordSuccess('تم تغيير كلمة المرور بنجاح. يرجى تسجيل الدخول مجدداً.');
      setOldPassword('');
      setChangeNewPassword('');
      setChangeConfirmPassword('');
    } catch (err: any) {
      setPasswordError(getFriendlyErrorMessage(err, 'فشل تغيير كلمة المرور. يرجى التحقق من كلمة المرور الحالية.'));
    } finally {
      setActionLoading(false);
    }
  };

  // Delete account click
  const handleDeleteAccountClick = async () => {
    if (confirm('تنبيه هام جداً: سيتم حذف حسابك بالكامل وبشكل نهائي بما في ذلك العناوين، وسجل المشتريات، وقائمة المفضلة بشكل لا يمكن استرجاعه. هل أنت متأكد تماماً من هذه الخطوة؟')) {
      try {
        setActionLoading(true);
        await deleteAccount();
      } catch (err: any) {
        setLocalError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء حذف الحساب'));
      } finally {
        setActionLoading(false);
      }
    }
  };

  // Address Submit (Add/Update)
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressName || !addressRecipient || !addressPhone || !addressGovernorate || !addressCity || !addressDetail) {
      setLocalError('يرجى ملء كافة حقول العنوان الأساسية');
      return;
    }

    try {
      setActionLoading(true);
      setLocalError('');
      const data = {
        name: addressName,
        recipientName: addressRecipient,
        phone: addressPhone,
        governorate: addressGovernorate,
        city: addressCity,
        address: addressDetail,
        building: addressBuilding || undefined,
        apartment: addressApartment || undefined,
        postalCode: addressPostalCode || undefined,
        additionalNotes: addressNotes || undefined,
        isDefault: addressIsDefault
      };

      if (editingAddressId) {
        await updateAddress(editingAddressId, data);
      } else {
        await addAddress(data);
      }

      // Reset Form
      setShowAddressForm(false);
      setEditingAddressId(null);
      setAddressName('');
      setAddressRecipient('');
      setAddressPhone('');
      setAddressGovernorate('');
      setAddressCity('');
      setAddressDetail('');
      setAddressBuilding('');
      setAddressApartment('');
      setAddressPostalCode('');
      setAddressNotes('');
      setAddressIsDefault(false);
      setLocalSuccess('تم حفظ العنوان بنجاح');
    } catch (err: any) {
      setLocalError(getFriendlyErrorMessage(err, 'فشل حفظ العنوان'));
    } finally {
      setActionLoading(false);
    }
  };

  // Start editing address
  const startEditAddress = (addr: any) => {
    setEditingAddressId(addr.id);
    setAddressName(addr.name || '');
    setAddressRecipient(addr.recipientName || '');
    setAddressPhone(addr.phone || '');
    setAddressGovernorate(addr.governorate || '');
    setAddressCity(addr.city || '');
    setAddressDetail(addr.address || '');
    setAddressBuilding(addr.building || '');
    setAddressApartment(addr.apartment || '');
    setAddressPostalCode(addr.postalCode || '');
    setAddressNotes(addr.additionalNotes || '');
    setAddressIsDefault(!!addr.isDefault);
    setShowAddressForm(true);
  };

  // Clear success messages after timeout
  useEffect(() => {
    if (localSuccess) {
      const timer = setTimeout(() => setLocalSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [localSuccess]);

  // Loading indicator for global bootstrap
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 transition-colors duration-200">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">جاري تحميل بيانات حسابك...</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">يرجى الانتظار لحين مزامنة البيانات المشفرة</p>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATION SCREEN (LOGIN / REGISTER / FORGOT / RESET / VERIFY)
  // =========================================================================
  if (!customer) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 font-sans transition-colors duration-200">
        <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-amber-500/20 relative overflow-hidden transition-colors duration-200">
          
          {/* Brand Accent */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 to-amber-600" />

          {/* Verification Banner helper for sandbox simulator */}
          {sandboxCode && (
            <div className="p-4 mb-4 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200/50 dark:border-amber-700/50 leading-relaxed font-mono">
              <strong className="block text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">🔐 محاكي الرسائل القصيرة (Sandbox Demo):</strong>
              تم توليد الرمز السري من النظام بنجاح: <span className="text-base font-black px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-slate-900 dark:text-amber-100 select-all">{sandboxCode}</span>
            </div>
          )}

          {/* Feedback messages */}
          {localError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm rounded-lg flex items-center gap-2 border border-red-200/50 dark:border-red-800/50">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{localError}</span>
            </div>
          )}
          {localSuccess && (
            <div className="p-3 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 text-sm rounded-lg flex items-center gap-2 border border-green-200/50 dark:border-green-800/50">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{localSuccess}</span>
            </div>
          )}

          {/* ==================== VIEW: LOGIN ==================== */}
          {authMode === 'login' && (
            <div>
              <div className="text-center">
                <div className="inline-flex p-3 rounded-full bg-amber-500/10 dark:bg-amber-500/20 mb-4 text-amber-600 dark:text-amber-400">
                  <User className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">تسجيل الدخول للحساب</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                  سجل دخولك لتتمكن من تتبع طلباتك ومزامنة سلتك وعناوينك المفضلة.
                </p>
              </div>

              <form className="mt-8 space-y-6" onSubmit={handleLoginSubmit}>
                <div className="space-y-4 rounded-md">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">البريد الإلكتروني</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full pr-10 pl-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                        placeholder="yourname@domain.com"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">كلمة المرور</label>
                      <button
                        type="button"
                        onClick={() => setAuthMode('forgot')}
                        className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        className="w-full pr-10 pl-10 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMeInput}
                        onChange={(e) => setRememberMeInput(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">تذكرني على هذا الجهاز</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-black rounded-lg text-slate-950 bg-amber-500 hover:bg-amber-450 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 shadow-md transition-colors"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  تسجيل الدخول الكلي الموحد
                </button>

                <div className="text-center mt-4">
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    ليس لديك حساب مسجل؟{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('register'); clearError(); setLocalError(''); }}
                      className="font-black text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300"
                    >
                      إنشاء حساب جديد مجاناً
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* ==================== VIEW: REGISTER ==================== */}
          {authMode === 'register' && (
            <div>
              <div className="text-center">
                <div className="inline-flex p-3 rounded-full bg-amber-500/10 dark:bg-amber-500/20 mb-4 text-amber-600 dark:text-amber-400">
                  <User className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">إنشاء حساب جديد</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                  سجل الآن للحصول على سلة محفوظات مشفرة تتيح لك الوصول إليها من أي جهاز.
                </p>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleRegisterSubmit}>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم الكامل <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                    placeholder="مثال: أحمد عبد الله"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">البريد الإلكتروني <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pr-10 pl-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                      placeholder="yourname@domain.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف (اختياري)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="w-full pr-10 pl-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور الجديدة <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pr-10 pl-10 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-black rounded-lg text-slate-950 bg-amber-500 hover:bg-amber-450 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 shadow-md transition-colors mt-6"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  تسجيل حسابي الجديد
                </button>

                <div className="text-center mt-4">
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    لديك حساب بالفعل؟{' '}
                    <button
                      type="button"
                      onClick={() => { setAuthMode('login'); clearError(); setLocalError(''); }}
                      className="font-black text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300"
                    >
                      تسجيل الدخول الآن
                    </button>
                  </p>
                </div>
              </form>
            </div>
          )}

          {/* ==================== VIEW: FORGOT PASSWORD ==================== */}
          {authMode === 'forgot' && (
            <div>
              <div className="text-center">
                <div className="inline-flex p-3 rounded-full bg-amber-500/10 dark:bg-amber-500/20 mb-4 text-amber-600 dark:text-amber-400">
                  <Key className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">استعادة كلمة المرور</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                  أدخل بريدك الإلكتروني وسيقوم النظام فوراً بتوليد كود أمان فريد لاستعادة حسابك.
                </p>
              </div>

              <form className="mt-8 space-y-6" onSubmit={handleForgotSubmit}>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">البريد الإلكتروني المسجل</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-slate-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full pr-10 pl-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold"
                      placeholder="yourname@domain.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-black rounded-lg text-slate-950 bg-amber-500 hover:bg-amber-450 shadow-md transition-colors"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  إرسال كود استعادة الحساب
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); clearError(); setLocalError(''); }}
                    className="text-sm font-bold text-gray-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                  >
                    ← العودة لصفحة تسجيل الدخول
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================== VIEW: RESET PASSWORD ==================== */}
          {authMode === 'reset' && (
            <div>
              <div className="text-center">
                <div className="inline-flex p-3 rounded-full bg-amber-500/10 dark:bg-amber-500/20 mb-4 text-amber-600 dark:text-amber-400">
                  <Lock className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">تعيين كلمة المرور الجديدة</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                  يرجى إدخال كود الأمان المرسل إليك وكلمة المرور الجديدة لإعادة تأمين الحساب.
                </p>
              </div>

              <form className="mt-8 space-y-4" onSubmit={handleResetSubmit}>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">البريد الإلكتروني للتحقق</label>
                  <input
                    type="email"
                    required
                    readOnly
                    value={verificationEmail}
                    className="w-full px-3 py-2.5 border border-gray-250 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 rounded-lg text-gray-500 dark:text-slate-400 text-sm font-semibold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">كود استعادة كلمة المرور (6 أرقام)</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white tracking-widest text-center text-lg font-black focus:ring-amber-500 focus:outline-none"
                    placeholder="xxxxxx"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:ring-amber-500 focus:outline-none placeholder-gray-400 dark:placeholder-slate-500"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-black rounded-lg text-slate-950 bg-amber-500 hover:bg-amber-450 shadow-md transition-colors mt-6"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  تأكيد وتغيير كلمة المرور
                </button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); clearError(); setLocalError(''); }}
                    className="text-sm font-bold text-gray-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                  >
                    ← العودة لصفحة تسجيل الدخول
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================== VIEW: EMAIL VERIFICATION ==================== */}
          {authMode === 'verify' && (
            <div>
              <div className="text-center">
                <div className="inline-flex p-3 rounded-full bg-amber-500/10 dark:bg-amber-500/20 mb-4 text-amber-600 dark:text-amber-400">
                  <Mail className="w-10 h-10 animate-bounce" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">تفعيل حسابك الشخصي</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
                  تم إرسال كود تفعيل مكون من 6 أرقام إلى بريدك الإلكتروني: <strong className="text-slate-800 dark:text-slate-200 block">{verificationEmail}</strong>
                </p>
              </div>

              <form className="mt-8 space-y-6" onSubmit={handleVerifySubmit}>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5 text-center">أدخل رمز التفعيل المؤلف من 6 أرقام</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verificationCodeInput}
                    onChange={(e) => setVerificationCodeInput(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-slate-700 rounded-xl text-slate-950 dark:text-white tracking-[0.5em] text-center text-xl font-black focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 dark:bg-slate-900"
                    placeholder="xxxxxx"
                  />
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-sm font-black rounded-lg text-slate-950 bg-amber-500 hover:bg-amber-450 shadow-md transition-colors"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                    تفعيل الحساب الآن
                  </button>

                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={actionLoading}
                    className="w-full text-center py-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    إعادة إرسال كود التفعيل مجدداً
                  </button>
                </div>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setAuthMode('login'); clearError(); setLocalError(''); }}
                    className="text-xs font-bold text-gray-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    ← العودة لصفحة الدخول
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    );
  }

  // =========================================================================
  // LOGGED-IN CUSTOMER DASHBOARD PANEL LAYOUT
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 font-sans text-right" dir="rtl">
      
      {/* Toast Feedback notifications */}
      {localSuccess && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-xl shadow-2xl flex items-center gap-3 border border-slate-800 dark:border-amber-500/30 animate-slide-in text-sm font-semibold">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-slate-950">
            <Check className="w-4 h-4" />
          </div>
          <span>{localSuccess}</span>
        </div>
      )}

      {/* Overview Card header */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-6 md:p-8 rounded-3xl mb-8 border border-slate-200 dark:border-slate-800 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-600" />
        
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              {customer.name}
              {customer.isVerified && (
                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-400/10 border border-green-200 dark:border-green-400/20 px-2 py-0.5 rounded-full flex items-center gap-1 leading-none">
                  <Check className="w-2.5 h-2.5" />
                  حساب مفعل
                </span>
              )}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 flex items-center gap-1.5">
              <span>{customer.email}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>عضو منذ {new Date(customer.createdAt).toLocaleDateString('ar-EG')}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-4 w-full md:w-auto">
          <button
            onClick={() => onNavigate('home')}
            className="flex-1 md:flex-none py-2.5 px-5 text-sm font-bold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-950/40 rounded-xl transition-all cursor-pointer"
          >
            تصفح المتجر الرئيسي
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* RIGHT DRAWER / SIDE NAVIGATION BAR */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-3 flex flex-col gap-1 transition-colors duration-200">
            <button
              onClick={() => { setActiveTab('profile'); clearError(); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <User className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <span>الملف الشخصي والبيانات</span>
            </button>

            <button
              onClick={() => { setActiveTab('addresses'); clearError(); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-3">
                <MapPin className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                <span>دفتر العناوين المحفوظة</span>
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'addresses'
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {addresses.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('wishlist'); clearError(); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${
                activeTab === 'wishlist'
                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-3">
                <Heart className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                <span>قائمة المنتجات المفضلة</span>
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'wishlist'
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {wishlist.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('orders'); clearError(); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-3">
                <Package className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                <span>سجل الطلبات وتتبع الشحنات</span>
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'orders'
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {orders.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('returns'); clearError(); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${
                activeTab === 'returns'
                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-3">
                <RotateCcw className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                <span>طلبات إرجاع المنتجات</span>
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'returns'
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {customerReturns.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('notifications'); clearError(); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-3">
                <Bell className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                <span>مركز التنبيهات والإشعارات</span>
              </span>
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-black">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('reviews'); clearError(); }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${
                activeTab === 'reviews'
                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="flex items-center gap-3">
                <Star className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                <span>تقييماتي وآرائي</span>
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'reviews'
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {myReviews.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('security'); clearError(); }}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all font-bold text-sm cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <ShieldCheck className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              <span>أمان وحماية الحساب الشخصي</span>
            </button>
          </div>
        </div>

        {/* LEFT COMPONENT CONTENT AREA */}
        <div className="lg:col-span-3 space-y-6">

          {/* Core Error/Success Feedback banner in view */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl border border-red-200/50 dark:border-red-800/50 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* =================================================================
              DASHBOARD TAB: PROFILE DETAILS
              ================================================================= */}
          {activeTab === 'profile' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-amber-500/20 p-6 md:p-8 transition-colors duration-200">
              <div className="flex justify-between items-center pb-6 border-b border-gray-100 dark:border-amber-500/20 mb-6">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">الملف الشخصي والبيانات العامة</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">تعديل بيانات حسابك الشخصي والتحكم في إعدادات الاتصال.</p>
                </div>
                {!isEditingProfile && (
                  <button
                    onClick={() => { setIsEditingProfile(true); setProfileName(customer.name); setProfilePhone(customer.phone || ''); }}
                    className="flex items-center gap-1.5 py-2 px-4 rounded-xl border border-gray-300 dark:border-amber-500/30 hover:border-gray-400 dark:hover:border-amber-500/50 text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4 text-amber-500" />
                    تعديل البيانات
                  </button>
                )}
              </div>

              {isEditingProfile ? (
                <form onSubmit={handleProfileSave} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">الاسم بالكامل</label>
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-350 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">البريد الإلكتروني (غير قابل للتعديل)</label>
                    <input
                      type="email"
                      readOnly
                      value={customer.email}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/60 rounded-xl text-gray-500 dark:text-slate-400 text-sm font-semibold focus:outline-none"
                    />
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">البريد الإلكتروني مرتبط بهويتك الأساسية ولا يمكن تغييره لأسباب أمنية.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-350 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                      placeholder="01xxxxxxxxx"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      حفظ التغييرات
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="py-2.5 px-6 rounded-xl border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 block mb-1">الاسم بالكامل</span>
                    <span className="font-bold text-slate-900 dark:text-white text-base">{customer.name}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/80">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 block mb-1">البريد الإلكتروني المعتمد</span>
                    <span className="font-bold text-slate-950 dark:text-white text-base">{customer.email}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/80 col-span-1 md:col-span-2">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400 block mb-1">رقم الهاتف المحمول</span>
                    <span className="font-bold text-slate-900 dark:text-white text-base">{customer.phone || 'غير محدد بعد'}</span>
                  </div>

                  {savedCart.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 col-span-1 md:col-span-2 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-300 block mb-1">📦 ميزة السلة السحابية الاحتياطية</span>
                        <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">سلة مشترياتك محفوظة ومحمية حالياً على خوادم متجر النخبة!</span>
                      </div>
                      <span className="text-xs font-black text-amber-700 dark:text-amber-300 px-2 py-1 rounded-md bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/25">نشط</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              DASHBOARD TAB: ADDRESS BOOK
              ================================================================= */}
          {activeTab === 'addresses' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-amber-500/20 p-6 md:p-8 transition-colors duration-200">
              <div className="flex justify-between items-center pb-6 border-b border-gray-100 dark:border-amber-500/20 mb-6">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">دفتر العناوين المحفوظة للشحن</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">احفظ عناوين متعددة لاختيارها بلمسة واحدة في صفحة الشراء السريعة.</p>
                </div>
                {!showAddressForm && (
                  <button
                    onClick={() => {
                      setEditingAddressId(null);
                      setAddressName('');
                      setAddressRecipient('');
                      setAddressPhone('');
                      setAddressGovernorate(governorates[0]);
                      setAddressCity('');
                      setAddressDetail('');
                      setAddressIsDefault(addresses.length === 0);
                      setShowAddressForm(true);
                    }}
                    className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-450 text-slate-950 text-sm font-black transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    عنوان جديد
                  </button>
                )}
              </div>

              {showAddressForm ? (
                <form onSubmit={handleAddressSubmit} className="space-y-4 max-w-xl">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white pb-2 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                    <span>{editingAddressId ? 'تعديل بيانات العنوان الحالي' : 'إضافة تفاصيل عنوان جديد'}</span>
                    <button
                      type="button"
                      onClick={() => setShowAddressForm(false)}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم مستعار للعنوان <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={addressName}
                        onChange={(e) => setAddressName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="مثال: المنزل، العمل، الشاليه..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم مستلم الشحنة بالكامل <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={addressRecipient}
                        onChange={(e) => setAddressRecipient(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="الاسم الثلاثي للمستلم"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم هاتف المستلم <span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        required
                        value={addressPhone}
                        onChange={(e) => setAddressPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="01xxxxxxxxx"
                      />
                    </div>

                    <div>
                      <CustomSelect
                        label="المحافظة"
                        required
                        value={addressGovernorate}
                        onChange={(val) => setAddressGovernorate(val)}
                        placeholder="اختر المحافظة..."
                        options={governorates}
                        searchable
                        searchPlaceholder="ابحث عن المحافظة..."
                        buttonClassName="px-3 py-2 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-sm"
                        menuClassName="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المدينة / المركز / المنطقة <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={addressCity}
                        onChange={(e) => setAddressCity(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="مثال: مدينة نصر، المعادي، مركز طنطا..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الرمز البريدي (اختياري)</label>
                      <input
                        type="text"
                        value={addressPostalCode}
                        onChange={(e) => setAddressPostalCode(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="11511"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اسم الشارع تفصيلياً <span className="text-red-500">*</span></label>
                      <textarea
                        required
                        rows={2}
                        value={addressDetail}
                        onChange={(e) => setAddressDetail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="مثال: 15 شارع الثورة متفرع من شارع الميرغني..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم العمارة / اسم البرج (اختياري)</label>
                      <input
                        type="text"
                        value={addressBuilding}
                        onChange={(e) => setAddressBuilding(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="عمارة 12 أ"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الدور والشقة (اختياري)</label>
                      <input
                        type="text"
                        value={addressApartment}
                        onChange={(e) => setAddressApartment(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="الدور 4 - شقة 14"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات إضافية للتوصيل (اختياري)</label>
                      <input
                        type="text"
                        value={addressNotes}
                        onChange={(e) => setAddressNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        placeholder="مثال: بجوار مسجد الفاروق، الاتصال قبل الوصول بـ 30 دقيقة"
                      />
                    </div>

                    <div className="md:col-span-2 flex items-center gap-2 py-2">
                      <input
                        type="checkbox"
                        id="addressIsDefault"
                        checked={addressIsDefault}
                        onChange={(e) => setAddressIsDefault(e.target.checked)}
                        disabled={addresses.length === 0 || (editingAddressId !== null && addresses.find(a => a.id === editingAddressId)?.isDefault)}
                        className="w-4.5 h-4.5 rounded border-gray-300 dark:border-slate-600 text-amber-500 focus:ring-amber-500 cursor-pointer dark:bg-slate-900"
                      />
                      <label htmlFor="addressIsDefault" className="text-xs font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                        تعيين كعنوان افتراضي للشراء المباشر
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-gray-50 dark:border-slate-700">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      حفظ العنوان
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddressForm(false)}
                      className="py-2.5 px-6 rounded-xl border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-all cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {addresses.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-gray-250 dark:border-slate-700 rounded-2xl">
                      <MapPin className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">لم تقم بإضافة أي عناوين شحن حتى الآن.</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">أضف عنوان شحن ليسهل عليك إتمام الطلبات القادمة بنقرة واحدة.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {addresses.map(addr => (
                        <div
                          key={addr.id}
                          className={`relative border rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all ${addr.isDefault ? 'border-amber-500 dark:border-amber-500/80 bg-amber-500/5 dark:bg-amber-500/10' : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900/60'}`}
                        >
                          {addr.isDefault && (
                            <span className="absolute top-4 left-4 text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-500/15 dark:bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              الافتراضي
                            </span>
                          )}

                          <div className="space-y-2">
                            <h4 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                              {addr.name}
                            </h4>
                            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1 pt-1.5">
                              <p className="font-semibold text-slate-950 dark:text-slate-100">المستلم: {addr.recipientName}</p>
                              <p className="font-medium text-slate-600 dark:text-slate-400">الهاتف: {addr.phone}</p>
                              <p className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed pt-1">
                                {addr.address}، {addr.city}، {addr.governorate}
                              </p>
                              {(addr.building || addr.apartment) && (
                                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                                  {[addr.building && `المبنى: ${addr.building}`, addr.apartment && `الوحدة/الدور: ${addr.apartment}`].filter(Boolean).join(' - ')}
                                </p>
                              )}
                              {addr.additionalNotes && (
                                <p className="text-amber-700 dark:text-amber-300 text-[11px] bg-amber-50/80 dark:bg-amber-950/40 p-1.5 rounded-lg border border-amber-100/80 dark:border-amber-900/50 mt-1">
                                  ملاحظات: {addr.additionalNotes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t border-gray-100/50 dark:border-slate-700/50">
                            {!addr.isDefault ? (
                              <button
                                onClick={async () => {
                                  try {
                                    setActionLoading(true);
                                    await setDefaultAddress(addr.id);
                                    setLocalSuccess('تم تعيين العنوان كافتراضي');
                                  } catch (err: any) {
                                    setLocalError(getFriendlyErrorMessage(err, 'فشل تغيير العنوان الافتراضي'));
                                  } finally {
                                    setActionLoading(false);
                                  }
                                }}
                                disabled={actionLoading}
                                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                تعيين كافتراضي
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" />
                                العنوان الرئيسي
                              </span>
                            )}

                            <div className="flex gap-3 items-center">
                              <button
                                onClick={() => startEditAddress(addr)}
                                className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                تعديل
                              </button>
                              <button
                                onClick={async () => {
                                  if (confirm('هل أنت متأكد من حذف هذا العنوان؟')) {
                                    try {
                                      setActionLoading(true);
                                      await deleteAddress(addr.id);
                                      setLocalSuccess('تم حذف العنوان بنجاح');
                                    } catch (err: any) {
                                      setLocalError(getFriendlyErrorMessage(err, 'فشل حذف العنوان'));
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }
                                }}
                                className="text-xs font-bold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                حذف
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              DASHBOARD TAB: WISHLIST
              ================================================================= */}
          {activeTab === 'wishlist' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-amber-500/20 p-6 md:p-8 transition-colors duration-200">
              <div className="pb-6 border-b border-gray-100 dark:border-amber-500/20 mb-6">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">قائمة المنتجات المفضلة</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">تضم كافة المنتجات التي قمت بحفظها للرجوع إليها لاحقاً.</p>
              </div>

              {wishlist.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
                  <Heart className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">قائمة المفضلة لديك فارغة.</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">تصفح منتجاتنا الممتازة وقم بإضافتها لقائمة المفضلة الخاصة بك.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {wishlist.map(id => {
                    const product = products.find(p => p.id === id);
                    if (!product) {
                      return (
                        <div key={id} className="flex gap-4 p-4 border border-dashed border-red-200 dark:border-red-800/60 bg-red-50/30 dark:bg-red-950/20 rounded-2xl">
                          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/40 rounded-xl border border-red-200 dark:border-red-800 shrink-0 flex items-center justify-center text-red-400">
                            <AlertTriangle className="w-8 h-8" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-black text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full">
                                غير متاح بالعرض
                              </span>
                              <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mt-1">هذا الجهاز لم يعد متوفراً بالمتجر</h4>
                              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">تم إزالة هذا المنتج من الكتالوج العام للمتجر.</p>
                            </div>
                            <div className="flex justify-end mt-3 pt-2 border-t border-red-100 dark:border-red-900/40">
                              <button
                                onClick={async () => {
                                  await toggleWishlist(id);
                                  setLocalSuccess('تمت إزالة المنتج غير المتوفر من المفضلة');
                                }}
                                className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                إزالة من المفضلة
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isOutOfStock = product.stock <= 0;
                    return (
                      <div key={product.id} className="flex gap-4 p-4 border border-gray-150 dark:border-slate-700 bg-white dark:bg-slate-900/60 rounded-2xl hover:shadow-md transition-all relative">
                        <img
                          src={product.mainImage}
                          alt={product.title}
                          onClick={() => onNavigate('product-details', product.id)}
                          className="w-20 h-20 object-cover rounded-xl border border-gray-100 dark:border-slate-700 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <h4
                                onClick={() => onNavigate('product-details', product.id)}
                                className="font-bold text-slate-950 dark:text-white text-sm truncate hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer transition-colors"
                              >
                                {product.title}
                              </h4>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{product.brand}</p>
                            
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm font-black text-amber-600 dark:text-amber-400">{product.discountPrice || product.price} ج.م</span>
                              {product.discountPrice && product.discountPrice < product.price && (
                                <span className="text-xs text-gray-400 dark:text-slate-500 line-through">{product.price} ج.م</span>
                              )}
                            </div>

                            {/* Stock Badge */}
                            <div className="mt-1">
                              {isOutOfStock ? (
                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 px-2 py-0.5 rounded-full inline-block">
                                  نفد المخزون مؤقتاً ⚠️
                                </span>
                              ) : product.stock <= 3 ? (
                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full inline-block">
                                  متبقي {product.stock} قطع فقط! 🔥
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full inline-block">
                                  متوفر بالمخزن ⚡
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/80">
                            {onAddToCart && (
                              <button
                                onClick={() => !isOutOfStock && onAddToCart(product)}
                                disabled={isOutOfStock}
                                className={`text-xs font-black py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                                  isOutOfStock
                                    ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed'
                                    : 'bg-amber-500 text-slate-950 hover:bg-amber-450'
                                }`}
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                {isOutOfStock ? 'نفد المخزون' : 'أضف للسلة'}
                              </button>
                            )}
                            <button
                              onClick={async () => {
                                await toggleWishlist(product.id);
                                setLocalSuccess('تمت إزالة المنتج من المفضلة');
                              }}
                              className="text-xs font-bold text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              إزالة
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              DASHBOARD TAB: ORDERS & TRACKING
              ================================================================= */}
          {activeTab === 'orders' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-amber-500/20 p-6 md:p-8 transition-colors duration-200">
              <div className="pb-6 border-b border-gray-100 dark:border-amber-500/20 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">سجل طلباتي وتتبع الشحنات</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">راجع تفاصيل جميع مشترياتك السابقة وتتبع حالة الشحن مباشرة.</p>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
                  <ShoppingBag className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">لم تقم بإجراء أي طلبات حتى الآن.</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">عند قيامك بالشراء، سيتم تجميع كافة طلباتك ومتابعتها من هنا.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map(order => {
                    const badge = getStatusBadge(order.status);
                    return (
                      <div
                        key={order.id}
                        className="border border-gray-150 dark:border-slate-700 bg-white dark:bg-slate-900/60 rounded-2xl hover:shadow-sm transition-all overflow-hidden"
                      >
                        {/* Header row of order banner card */}
                        <div className="bg-slate-50 dark:bg-slate-900/90 p-4 border-b border-gray-150 dark:border-slate-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-xs">
                          <div className="flex flex-wrap gap-4 font-semibold text-slate-600 dark:text-slate-300">
                            <div>
                              <span className="text-gray-400 dark:text-slate-400 font-bold block mb-0.5">رقم الفاتورة</span>
                              <span className="text-slate-900 dark:text-white font-extrabold">{order.invoiceNumber}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 dark:text-slate-400 font-bold block mb-0.5">تاريخ الطلب</span>
                              <span className="text-slate-900 dark:text-slate-100">{new Date(order.date).toLocaleDateString('ar-EG', { dateStyle: 'long' })}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 dark:text-slate-400 font-bold block mb-0.5">إجمالي المبلغ</span>
                              <span className="text-amber-600 dark:text-amber-400 font-black">{order.total} ج.م</span>
                            </div>
                          </div>

                          <div>
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-xs border ${badge.color}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {badge.label}
                            </span>
                          </div>
                        </div>

                        {/* Content block of order banner card */}
                        <div className="p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
                          <div className="flex -space-x-4 space-x-reverse overflow-hidden">
                            {order.items.slice(0, 4).map((item: any, idx: number) => {
                              const p = products.find(prod => prod.id === (item.productId || item.id));
                              return (
                                <img
                                  key={idx}
                                  src={p?.mainImage || item.image || 'https://via.placeholder.com/60'}
                                  alt="Product thumbnail"
                                  className="w-12 h-12 object-cover rounded-lg border-2 border-white dark:border-slate-800 shadow-sm shrink-0"
                                  title={item.productTitle || item.title}
                                />
                              );
                            })}
                            {order.items.length > 4 && (
                              <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-xs font-black text-slate-600 dark:text-slate-300 shrink-0">
                                +{order.items.length - 4}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-4 items-center self-end md:self-center">
                            <button
                              onClick={() => handleViewOrderDetails(order.id)}
                              disabled={fetchingOrderDetail}
                              className="py-2 px-4 rounded-xl border border-gray-350 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-black text-slate-800 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              {fetchingOrderDetail ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-slate-400 rotate-180" />
                              )}
                              تفاصيل الفاتورة والتتبع
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              DASHBOARD TAB: PRODUCT RETURNS
              ================================================================= */}
          {activeTab === 'returns' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-amber-500/20 p-6 md:p-8 transition-colors duration-200">
              <div className="pb-6 border-b border-gray-100 dark:border-amber-500/20 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <RotateCcw className="w-5 h-5 text-amber-500" />
                    طلبات إرجاع المنتجات
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">تابع حالة طلبات الإرجاع المقدمة ومبالغ الاسترداد والقرارات المعتمدة.</p>
                </div>

                <button
                  onClick={loadCustomerReturns}
                  disabled={returnsLoading}
                  className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${returnsLoading ? 'animate-spin' : ''}`} />
                  تحديث الطلبات
                </button>
              </div>

              {returnsError && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  {returnsError}
                </div>
              )}

              {returnsLoading ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-2" />
                  <p className="text-xs font-bold">جاري تحميل قائمة طلبات الإرجاع...</p>
                </div>
              ) : customerReturns.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
                  <RotateCcw className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">لم تقم بتقديم أي طلبات إرجاع حتى الآن.</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">يمكنك طلب إرجاع أي منتج من خلال صفحة (سجل الطلبات وتتبع الشحنات) للطلبات المُسلمة.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {customerReturns.map((ret) => {
                    const statusBadgeMap: Record<string, { label: string; color: string; dot: string }> = {
                      pending: { label: 'قيد المراجعة', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
                      approved: { label: 'تمت الموافقة', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
                      pickup_pending: { label: 'قيد ترتيب الاستلام', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
                      received: { label: 'تم الاستلام بالفحص', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
                      completed: { label: 'مكتمل ومسترد', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
                      rejected: { label: 'مرفوض', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', dot: 'bg-rose-400' },
                      cancelled: { label: 'ملغى من قبلك', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', dot: 'bg-rose-400' }
                    };
                    const badge = statusBadgeMap[ret.status] || { label: ret.status, color: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20', dot: 'bg-slate-400' };

                    return (
                      <div
                        key={ret.id}
                        className="border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/60 rounded-2xl p-4 md:p-5 hover:shadow-sm transition-all space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs">
                          <div>
                            <span className="font-mono text-slate-900 dark:text-white font-extrabold text-sm ml-2">#{ret.id}</span>
                            <span className="text-slate-500 dark:text-slate-400 font-bold">الفاتورة الأصلي: <strong className="text-amber-600 dark:text-amber-400">{ret.orderInvoiceNumber}</strong></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap ${badge.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} shrink-0`} />
                              {badge.label}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">
                              {new Date(ret.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'medium' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs">
                          <div className="flex items-center gap-3">
                            {ret.productImage && (
                              <img src={ret.productImage} alt="" className="w-12 h-12 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0" />
                            )}
                            <div>
                              <h4 className="font-black text-slate-900 dark:text-white text-sm leading-snug">{ret.productTitle}</h4>
                              <p className="text-slate-500 dark:text-slate-400 mt-0.5 font-bold">الكمية: {ret.quantity} قطعة • المبلغ المطلوب: <span className="text-amber-600 dark:text-amber-400 font-black">{(ret.refundAmount || ret.unitPrice * ret.quantity).toLocaleString('ar-EG')} ج.م</span></p>
                            </div>
                          </div>

                          {ret.status === 'pending' && (
                            <button
                              onClick={() => handleCancelReturnRequest(ret.id)}
                              className="py-1.5 px-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors self-end md:self-center cursor-pointer"
                            >
                              إلغاء طلب الإرجاع
                            </button>
                          )}
                        </div>

                        {/* Admin note block if provided */}
                        {ret.adminNote && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                            <span className="font-black text-amber-800 dark:text-amber-300 block mb-0.5">رد فريق الإدارة والدعم:</span>
                            <p className="text-slate-800 dark:text-slate-200 font-semibold">{ret.adminNote}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              DASHBOARD TAB: NOTIFICATIONS
              ================================================================= */}
          {activeTab === 'notifications' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-amber-500/20 p-6 md:p-8 space-y-6 transition-colors duration-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-100 dark:border-amber-500/20">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">مركز التنبيهات والإشعارات</h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">تابع إشعارات الطلبات وتحديثات الحساب والعروض الخاصة أولاً بأول.</p>
                </div>

                {notifications.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => markNotificationsAsRead()}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                      تحديد الكل كمقروء
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('هل أنت تأكد من رغبتك في مسح كافة الإشعارات؟')) {
                          clearNotifications();
                        }
                      }}
                      className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/60 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                      مسح الكل
                    </button>
                  </div>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-2 pb-2">
                {[
                  { id: 'all', label: 'الكل', count: notifications.length },
                  { id: 'unread', label: 'غير مقروءة', count: notifications.filter(n => !n.isRead).length },
                  { id: 'order', label: 'الطلبات', count: notifications.filter(n => n.type === 'order').length },
                  { id: 'system', label: 'النظام', count: notifications.filter(n => n.type === 'system').length },
                  { id: 'promo', label: 'العروض', count: notifications.filter(n => n.type === 'promo').length }
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setNotifFilter(filter.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      notifFilter === filter.id
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-700/70 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span>{filter.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                      notifFilter === filter.id ? 'bg-slate-950/10 text-slate-950 font-black' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                    }`}>
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Notification Items List */}
              {(() => {
                const filteredNotifs = notifications.filter(n => {
                  if (notifFilter === 'unread') return !n.isRead;
                  if (notifFilter === 'order') return n.type === 'order';
                  if (notifFilter === 'system') return n.type === 'system';
                  if (notifFilter === 'promo') return n.type === 'promo';
                  return true;
                });

                if (filteredNotifs.length === 0) {
                  return (
                    <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-2xl">
                      <Bell className="w-12 h-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">لا توجد إشعارات ضمن هذه الفئة.</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">سيقوم النظام بإخطارك فوراً فور تلقي أي تحديثات جديدة.</p>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {filteredNotifs.map(notif => {
                      const isOrder = notif.type === 'order';
                      const isPromo = notif.type === 'promo';
                      const isSystem = notif.type === 'system';

                      return (
                        <div key={notif.id} className={`py-4 flex gap-4 items-start rounded-xl p-3 transition-colors ${!notif.isRead ? 'bg-amber-50/40 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            isOrder ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                            isPromo ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                            isSystem ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            {isOrder ? <ShoppingBag className="w-5 h-5" /> :
                             isPromo ? <Tag className="w-5 h-5" /> :
                             isSystem ? <Shield className="w-5 h-5" /> :
                             <Bell className="w-5 h-5" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <div className="flex items-center gap-2">
                                <h4 className={`text-sm ${!notif.isRead ? 'font-black text-slate-950 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-200'}`}>
                                  {notif.title}
                                </h4>
                                {!notif.isRead && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                )}
                              </div>
                              <span className="text-[10px] font-medium text-gray-400 dark:text-slate-400">
                                {new Date(notif.timestamp).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">{notif.message}</p>

                            <div className="flex items-center gap-3 mt-3">
                              {!notif.isRead && (
                                <button
                                  onClick={() => markNotificationAsRead(notif.id)}
                                  className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  تحديد كمقروء
                                </button>
                              )}
                              <button
                                onClick={() => deleteNotification(notif.id)}
                                className="text-[11px] font-medium text-slate-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                حذف الإشعار
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* =================================================================
              DASHBOARD TAB: CUSTOMER REVIEWS (⭐ تقييماتي)
              ================================================================= */}
          {activeTab === 'reviews' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-amber-500/20 p-6 md:p-8 space-y-6 font-sans transition-colors duration-200">
              <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-gray-100 dark:border-amber-500/20">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    تقييماتي ومراجعاتي للمنتجات
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    إدارة وتعديل تقييماتك وملاحظاتك الشخصية على المنتجات التي قمت بشرائها أو تجربتها
                  </p>
                </div>
                <button
                  onClick={loadMyReviews}
                  disabled={myReviewsLoading}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ${myReviewsLoading ? 'animate-spin' : ''}`} />
                  تحديث القائمة
                </button>
              </div>

              {myReviewsLoading ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-3" />
                  <p className="text-xs font-bold">جاري تحميل تقييماتك ومراجعاتك...</p>
                </div>
              ) : myReviewsError ? (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl flex items-center justify-between">
                  <span>{myReviewsError}</span>
                  <button
                    onClick={loadMyReviews}
                    className="underline text-rose-900 dark:text-rose-200 font-extrabold hover:text-rose-950 dark:hover:text-rose-100 cursor-pointer"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              ) : myReviews.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl p-6 space-y-3">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
                    <Star className="w-6 h-6" />
                  </div>
                  <h3 className="font-black text-slate-800 dark:text-white text-sm">لم تقم بإضافة أي تقييم أو مراجعة حتى الآن</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
                    شاركنا رأيك في الأجهزة والمنتجات التي قمت بشرائها لمساعدة المشترين الآخرين في اتخاذ القرار المناسب.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('home')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-450 text-slate-950 font-black rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    تصفح منتجات المتجر الآن
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myReviews.map((rev: any) => {
                    const prod = products.find(p => p.id === rev.productId);
                    const prodImage = rev.productMainImage || prod?.mainImage || 'https://via.placeholder.com/80';
                    const prodTitle = rev.productTitle || prod?.title || 'منتج من المتجر';
                    const badge = getModerationStatusBadge(rev.status);

                    return (
                      <div
                        key={rev.id}
                        className="bg-white dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 md:p-5 shadow-xs hover:border-gray-300 dark:hover:border-slate-600 transition-all space-y-4"
                      >
                        {/* Header: Product info + Moderation badge */}
                        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-gray-100 dark:border-slate-700">
                          <div className="flex items-center gap-3">
                            <img
                              src={prodImage}
                              alt={prodTitle}
                              className="w-14 h-14 object-cover rounded-xl border border-gray-200 dark:border-slate-700 shrink-0"
                            />
                            <div>
                              <h4 className="font-black text-slate-950 dark:text-white text-sm">{prodTitle}</h4>
                              {rev.variantInfo && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                                  المواصفة: {rev.variantInfo}
                                </p>
                              )}
                              <p className="text-[10px] text-gray-400 dark:text-slate-400 font-medium mt-1">
                                تاريخ التقييم: {new Date(rev.createdAt).toLocaleDateString('ar-EG', { dateStyle: 'long' })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {rev.isVerifiedPurchase && (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> مشتري مؤكد
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${badge.color}`}>
                              حالة المراجعة: {badge.label}
                            </span>
                          </div>
                        </div>

                        {/* Rating stars & Review body */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= rev.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-slate-200 dark:text-slate-600'
                                }`}
                              />
                            ))}
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mr-2">
                              {rev.rating} من 5
                            </span>
                          </div>

                          {rev.title && (
                            <h5 className="font-black text-slate-900 dark:text-white text-xs pt-1">
                              {rev.title}
                            </h5>
                          )}

                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                            {rev.comment}
                          </p>
                        </div>

                        {/* Admin Response if available */}
                        {rev.adminResponse && (
                          <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-xl p-3 text-xs space-y-1">
                            <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                              <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              رد إدارة المتجر:
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed pr-5">
                              {rev.adminResponse}
                            </p>
                          </div>
                        )}

                        {/* Actions: Edit & Delete */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                          <button
                            type="button"
                            onClick={() => handleOpenEditReview(rev)}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                            تعديل المراجعة
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteReviewConfirm(rev.id)}
                            disabled={deletingReviewId === rev.id}
                            className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            {deletingReviewId === rev.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            )}
                            حذف
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              DASHBOARD TAB: SECURITY SETTINGS
              ================================================================= */}
          {activeTab === 'security' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-amber-500/20 p-6 md:p-8 space-y-8 transition-colors duration-200">
              
              {/* Password change block */}
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white pb-3 border-b border-gray-100 dark:border-amber-500/20 mb-6">تغيير كلمة المرور</h2>
                
                {passwordError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 text-sm rounded-xl mb-4 font-semibold">
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-sm rounded-xl mb-4 font-semibold">
                    {passwordSuccess}
                  </div>
                )}

                <form onSubmit={handlePasswordChangeSubmit} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور الحالية</label>
                    <input
                      type="password"
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      required
                      value={changeNewPassword}
                      onChange={(e) => setChangeNewPassword(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">تأكيد كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      required
                      value={changeConfirmPassword}
                      onChange={(e) => setChangeConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="py-2.5 px-6 rounded-xl bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-sm flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    تحديث كلمة المرور
                  </button>
                </form>
              </div>

              {/* Danger Zone / Delete account */}
              <div className="pt-6 border-t border-red-100 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/20 p-6 rounded-2xl border border-dashed border-red-200 dark:border-red-800">
                <h3 className="text-base font-black text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
                  منطقة الخطورة القصوى (Danger Zone)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  عند قيامك بحذف حسابك الشخصي، سيتم حذف هويتك وملف الشراء الخاص بك وجميع العناوين المسجلة من قواعد بياناتنا بشكل نهائي ولا يمكن التراجع عن هذه الخطوة تحت أي ظرف.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteAccountClick}
                  disabled={actionLoading}
                  className="mt-4 py-2.5 px-5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف حسابي المعتمد بشكل نهائي
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* =========================================================================
          EDIT REVIEW MODAL POPUP
          ========================================================================= */}
      {editingReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative border border-gray-100 dark:border-amber-500/20 space-y-4">
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-150 dark:border-amber-500/20">
              <h3 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                تعديل المراجعة والتقييم
              </h3>
              <button
                onClick={() => setEditingReview(null)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveReview} className="space-y-4 text-xs">
              {/* Star Rating Picker */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1.5">التقييم بالنجوم *</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditRating(star)}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= editRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-200 dark:text-slate-600 hover:text-amber-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="mr-2 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {editRating} من 5
                  </span>
                </div>
              </div>

              {/* Review Title */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">عنوان المراجعة (اختياري)</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="مثال: تجربة ممتازة وتبريد سريع"
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Review Comment */}
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">التعليق والملاحظات *</label>
                <textarea
                  required
                  rows={4}
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="اكتب ملاحظاتك وتجربتك الفنية بالتفصيل..."
                  className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditingReview(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-xl font-black text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {editLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  حفظ التغييرات
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================================================
          ORDER DETAILS AND TIMELINE TRACKING MODAL POPUP
          ========================================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl relative border border-gray-100 dark:border-amber-500/20 flex flex-col justify-between">
            
            {/* Header */}
            <div className="p-6 border-b border-gray-150 dark:border-amber-500/20 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">تفاصيل الفاتورة {selectedOrder.invoiceNumber}</h3>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-extrabold text-[11px] border ${getStatusBadge(selectedOrder.status).color}`}>
                    {getStatusBadge(selectedOrder.status).label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">تاريخ الإنشاء: {(() => {
                  const rawDate = selectedOrder.createdAt || selectedOrder.date || selectedOrder.created_at;
                  if (!rawDate) return 'تاريخ غير متوفر';
                  const parsed = new Date(rawDate);
                  return isNaN(parsed.getTime()) ? rawDate : parsed.toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' });
                })()}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewOrderDetails(selectedOrder.id)}
                  disabled={fetchingOrderDetail}
                  title="تحديث حالة الشحنة"
                  className="p-2 rounded-xl border border-gray-200 dark:border-amber-500/30 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 text-amber-600 dark:text-amber-400 ${fetchingOrderDetail ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">تحديث التتبع</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* Modal Body content */}
            <div className="p-6 space-y-6 flex-1">
              
              {/* Order Status Tracker Progress timeline */}
              <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-5 border border-slate-150 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-750">
                  <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                    مسار توصيل وتتبع الشحنة الفعلي
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">تحديثات اللوجستيات المباشرة</span>
                </div>
                
                <div className="relative border-r-2 border-amber-500/30 pr-4 mr-2 space-y-6">
                  {selectedOrder.timeline && selectedOrder.timeline.length > 0 ? (
                    selectedOrder.timeline.map((event: any, idx: number) => {
                      const isLatest = idx === selectedOrder.timeline.length - 1;
                      const badge = getStatusBadge(event.status);
                      return (
                        <div key={idx} className="relative">
                          {/* Bullet dot indicator */}
                          <span className={`absolute top-1.5 -right-[23px] w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ring-4 ${
                            isLatest ? 'bg-amber-500 ring-amber-500/20 animate-pulse' : 'bg-slate-400 ring-slate-200 dark:ring-slate-700'
                          }`} />
                          
                          <div className="text-xs">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <strong className="text-slate-950 dark:text-white font-extrabold text-sm flex items-center gap-2">
                                {getTimelineStatusText(event.status)}
                                <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </strong>
                              <span className="text-gray-400 dark:text-slate-400 font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-gray-150 dark:border-slate-700">
                                {new Date(event.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 mt-1 font-semibold leading-relaxed bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700">
                              {event.description}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-gray-400 dark:text-slate-500 py-2">لا توجد تحديثات مسجلة لخط السير حتى الآن.</div>
                  )}
                </div>
              </div>

              {/* Payment Status & COD details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-amber-500/5 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-500/15 dark:border-amber-500/30">
                <div>
                  <span className="text-gray-400 dark:text-slate-400 font-bold block mb-1">طريقة الدفع الفردية</span>
                  <p className="text-slate-950 dark:text-white font-black flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    الدفع نقداً عند الاستلام (COD)
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 dark:text-slate-400 font-bold block mb-1">حالة السداد والتحصيل</span>
                  <p className={`font-black ${selectedOrder.status === 'Delivered' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {selectedOrder.status === 'Delivered' ? '✓ تم تحصيل المبلغ نقداً بنجاح عند التسليم' : '⏳ قيد التحصيل الفعلي عند تسليم المندوب'}
                  </p>
                </div>
              </div>

              {/* Order Items list */}
              <div>
                <h4 className="font-black text-sm text-slate-900 dark:text-white mb-3 pb-1 border-b border-gray-100 dark:border-slate-700">محتويات الشحنة والمنتجات</h4>
                <div className="divide-y divide-gray-100 dark:divide-slate-700 max-h-72 overflow-y-auto pr-2 space-y-3">
                  {selectedOrder.items.map((item: any, idx: number) => {
                    const p = products.find(prod => prod.id === (item.productId || item.id));
                    const orderIsEligible = ['Delivered', 'Completed'].includes(selectedOrder.status);
                    const isReturnable = p?.isReturnable !== false;

                    const itemReturns = customerReturns.filter(r => 
                      r.orderId === selectedOrder.id && 
                      (r.productId === (item.productId || item.id) || (r.orderItemId && r.orderItemId === item.id)) && 
                      r.status !== 'cancelled'
                    );

                    const approvedOrPendingReturns = itemReturns.filter(r => r.status !== 'rejected');
                    const alreadyReturnedQty = approvedOrPendingReturns.reduce((sum, r) => sum + r.quantity, 0);
                    const remainingReturnableQty = item.quantity - alreadyReturnedQty;

                    const activeReturn = itemReturns[itemReturns.length - 1];

                    const returnStatusBadgeMap: Record<string, { label: string; color: string }> = {
                      pending: { label: 'طلب الإرجاع قيد المراجعة', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30' },
                      approved: { label: 'تمت الموافقة على طلب الإرجاع', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30' },
                      pickup_pending: { label: 'جاري استلام المنتج من العميل', color: 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30' },
                      received: { label: 'تم استلام المنتج وفحصه', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30' },
                      completed: { label: 'تم استكمال الإرجاع واسترداد المبلغ', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30' },
                      rejected: { label: 'تم رفض طلب الإرجاع', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30' }
                    };

                    const showReturnBtn = orderIsEligible && isReturnable && remainingReturnableQty > 0;

                    return (
                      <div key={idx} className="py-2.5 space-y-2 text-sm">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <div className="flex items-center gap-3">
                            <img
                              src={p?.mainImage || item.image || 'https://via.placeholder.com/50'}
                              alt=""
                              className="w-11 h-11 object-cover rounded-lg border border-gray-150 dark:border-slate-700 shrink-0"
                            />
                            <div>
                              <p className="font-black text-slate-950 dark:text-white text-xs truncate max-w-[200px] md:max-w-md">
                                {item.productTitle || item.title}
                              </p>
                              {(item.variantInfo || item.variantSku || item.variant?.name) && (
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                                  المواصفة: {item.variantInfo || item.variantSku || item.variant?.name}
                                </p>
                              )}
                              <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold mt-0.5">
                                الكمية: {item.quantity} قطعة • السعر: {item.price} ج.م
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 justify-between sm:justify-end">
                            <div className="text-left sm:text-right">
                              <span className="font-bold text-slate-900 dark:text-white text-xs block">{item.price * item.quantity} ج.م</span>
                            </div>

                            {showReturnBtn && (
                              <button
                                onClick={() => handleOpenReturnModal(selectedOrder, item)}
                                className="py-1 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-[11px] transition-all shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <RotateCcw className="w-3 h-3" />
                                {alreadyReturnedQty > 0 ? `إرجاع المتبقي (${remainingReturnableQty})` : 'إرجاع المنتج'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Return Request Status Card inside Order Item */}
                        {activeReturn && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[11px]">
                                <RotateCcw className="w-3 h-3 text-amber-500" />
                                حالة الإرجاع:
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${returnStatusBadgeMap[activeReturn.status]?.color || 'bg-slate-100 text-slate-700'}`}>
                                {returnStatusBadgeMap[activeReturn.status]?.label || activeReturn.status}
                              </span>
                            </div>

                            {activeReturn.status === 'rejected' && activeReturn.adminNote && (
                              <p className="text-rose-600 dark:text-rose-400 text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-800/60 mt-1">
                                سبب الرفض: {activeReturn.adminNote}
                              </p>
                            )}

                            {activeReturn.status !== 'rejected' && activeReturn.status !== 'cancelled' && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                الكمية المطلوبة للإرجاع: {activeReturn.quantity} قطعة • المبلغ المسترد: {activeReturn.refundAmount} ج.م
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shipping address details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-150 dark:border-slate-700">
                <div>
                  <span className="text-gray-400 dark:text-slate-400 font-bold block mb-1">بيانات العميل المستلم</span>
                  <p className="text-slate-950 dark:text-white font-black">{selectedOrder.customer.name}</p>
                  <p className="text-slate-800 dark:text-slate-200">هاتف المستلم: {selectedOrder.customer.phone}</p>
                  {selectedOrder.customer.altPhone && <p className="text-slate-500 dark:text-slate-400">هاتف بديل: {selectedOrder.customer.altPhone}</p>}
                </div>
                <div>
                  <span className="text-gray-400 dark:text-slate-400 font-bold block mb-1">عنوان التوصيل المعتمد</span>
                  <p className="text-slate-950 dark:text-white font-black">{selectedOrder.customer.governorate} - {selectedOrder.customer.city}</p>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{selectedOrder.customer.address}</p>
                </div>
              </div>

              {/* Summary Calculation breakdown */}
              <div className="border-t border-gray-150 dark:border-slate-700 pt-4 text-xs font-semibold text-slate-600 dark:text-slate-300 space-y-1.5 max-w-xs mr-auto">
                <div className="flex justify-between">
                  <span>قيمة المنتجات:</span>
                  <span className="text-slate-900 dark:text-white">{selectedOrder.total - selectedOrder.shippingCost - (selectedOrder.taxAmount || 0) + (selectedOrder.discountAmount || 0)} ج.م</span>
                </div>
                {selectedOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>قيمة الخصم والكوبون:</span>
                    <span>-{selectedOrder.discountAmount} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>تكلفة الشحن والتوصيل:</span>
                  <span className="text-slate-900 dark:text-white">+{selectedOrder.shippingCost} ج.م</span>
                </div>
                {selectedOrder.taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>ضريبة القيمة المضافة:</span>
                    <span className="text-slate-900 dark:text-white">+{selectedOrder.taxAmount} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-slate-950 dark:text-white border-t border-dashed border-gray-200 dark:border-slate-700 pt-2">
                  <span>الإجمالي الكلي المستحق:</span>
                  <span className="text-amber-600 dark:text-amber-400">{selectedOrder.total} ج.م</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          RETURN REQUEST MODAL POPUP
          ========================================================================= */}
      {returnModalItem && (() => {
        const ord = returnModalItem.order;
        const itm = returnModalItem.item;
        const p = products.find(prod => prod.id === (itm.productId || itm.id));
        const pTitle = itm.productTitle || itm.title || p?.title || 'منتج من الفاتورة';
        const pImage = p?.mainImage || itm.image || 'https://via.placeholder.com/80';
        const unitPrice = itm.price || 0;

        const itemReturns = customerReturns.filter(r => 
          r.orderId === ord.id && 
          (r.productId === (itm.productId || itm.id) || (r.orderItemId && r.orderItemId === itm.id)) && 
          r.status !== 'cancelled' && r.status !== 'rejected'
        );
        const alreadyReturned = itemReturns.reduce((sum, r) => sum + r.quantity, 0);
        const maxReturnableQty = Math.max(1, (itm.quantity || 1) - alreadyReturned);

        const calculatedRefund = unitPrice * returnQuantity;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans" dir="rtl">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative border border-gray-100 dark:border-amber-500/20 space-y-4 max-h-[90vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-3 border-b border-gray-150 dark:border-amber-500/20">
                <div>
                  <h3 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-500" />
                    طلب إرجاع منتج
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                    رقم الفاتورة: <strong className="text-amber-600 dark:text-amber-400">{ord.invoiceNumber || ord.id}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setReturnModalItem(null)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              {/* Product Card Summary */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                <img src={pImage} alt={pTitle} className="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-black text-slate-950 dark:text-white text-xs truncate">{pTitle}</h4>
                  {(itm.variantInfo || itm.variantSku || itm.variant?.name) && (
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                      المواصفة: {itm.variantInfo || itm.variantSku || itm.variant?.name}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1">
                    سعر القطعة: {unitPrice} ج.م • المشتراة: {itm.quantity} • المتبقية للإرجاع: {maxReturnableQty}
                  </p>
                </div>
              </div>

              {/* Banners */}
              {returnSubmitError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800">
                  {returnSubmitError}
                </div>
              )}

              {returnSubmitSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {returnSubmitSuccess}
                </div>
              )}

              <form onSubmit={handleSubmitReturnRequest} className="space-y-4 text-xs">
                {/* Quantity Selector */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    الكمية المراد إرجاعها (بين 1 و {maxReturnableQty}) *
                  </label>
                  <select
                    value={returnQuantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val >= 1 && val <= maxReturnableQty) {
                        setReturnQuantity(val);
                      }
                    }}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {Array.from({ length: maxReturnableQty }, (_, i) => i + 1).map((q) => (
                      <option key={q} value={q}>
                        {q} {q === 1 ? 'قطعة واحدة' : 'قطع'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Reason Select */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    سبب الإرجاع *
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value as ReturnReason)}
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="damaged">المنتج تالف</option>
                    <option value="different_from_description">المنتج مختلف عن الوصف</option>
                    <option value="wrong_product">تم إرسال منتج خاطئ</option>
                    <option value="defective">المنتج به عيب</option>
                    <option value="unwanted">لا أرغب في المنتج</option>
                    <option value="other">سبب آخر</option>
                  </select>
                </div>

                {/* Conditional extra description input for 'other' reason */}
                {returnReason === 'other' && (
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                      توضيح السبب الآخر *
                    </label>
                    <input
                      type="text"
                      required
                      value={returnOtherReason}
                      onChange={(e) => setReturnOtherReason(e.target.value)}
                      placeholder="اكتب تفاصيل السبب الآخر الملاحظ على المنتج..."
                      className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}

                {/* Customer Notes */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    ملاحظات العميل والتفاصيل الإضافية (اختياري)
                  </label>
                  <textarea
                    rows={3}
                    value={returnCustomerNote}
                    onChange={(e) => setReturnCustomerNote(e.target.value)}
                    placeholder="اكتب أي ملاحظات قد تفيد فريق المعاينة والفحص..."
                    className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-2.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                </div>

                {/* Images Upload / Links */}
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    إرفاق صور المعاينة والفحص (اختياري)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={returnImageUrlInput}
                      onChange={(e) => setReturnImageUrlInput(e.target.value)}
                      placeholder="رابط صورة المعاينة (مثال: https://...)"
                      className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddReturnImage}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      + إضافة
                    </button>
                  </div>

                  {returnImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {returnImages.map((img, idx) => (
                        <div key={idx} className="relative group w-14 h-14 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden shrink-0">
                          <img src={img} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveReturnImage(idx)}
                            className="absolute inset-0 bg-red-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Refund Calculation & Summary */}
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-amber-900 dark:text-amber-300 block">ملخص المبلغ المراد إرجاعه:</span>
                    <span className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">
                      ({unitPrice} ج.م × {returnQuantity} قطعة)
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                      {calculatedRefund.toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-150 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setReturnModalItem(null)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={returnSubmitLoading}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-450 text-slate-950 rounded-xl font-black text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    {returnSubmitLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    إرسال طلب الإرجاع
                  </button>
                </div>
              </form>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
