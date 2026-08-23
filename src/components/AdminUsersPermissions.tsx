import React, { useState, useEffect } from 'react';
import {
  Users, ShieldCheck, Key, Search, Plus, Edit2, Trash2, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Check, X, ShieldAlert,
  UserPlus, Shield, Info, Lock, Eye
} from 'lucide-react';
import { api, getFriendlyErrorMessage } from '../lib/api.js';
import { CurrentAdmin } from '../types.js';
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
import { CustomSelect } from './CustomSelect.js';

interface AdminUserItem {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  roleId: string;
  active: boolean;
  isDeleted?: boolean;
  createdAt?: string;
}

interface RoleItem {
  id: string;
  name: string;
  description: string;
  isSystem?: boolean;
  active?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
}

interface PermissionItem {
  id: string;
  key: string;
  name: string;
  description?: string;
  group: string;
  isSystem?: boolean;
  active?: boolean;
  isDeleted?: boolean;
}

interface AdminUsersPermissionsProps {
  currentAdmin?: CurrentAdmin | null;
  setCurrentAdmin?: React.Dispatch<React.SetStateAction<CurrentAdmin | null>>;
}

export default function AdminUsersPermissions({
  currentAdmin,
  setCurrentAdmin
}: AdminUsersPermissionsProps = {}) {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'matrix'>('users');

  // Common Notification State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // ==========================================
  // TAB 1: USERS STATE & ACTIONS
  // ==========================================
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersSearch, setUsersSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [usersPage, setUsersPage] = useState(1);
  const USERS_PER_PAGE = 8;
  const usersFetchReqIdRef = React.useRef(0);

  // Modal states for Users
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [userNameInput, setUserNameInput] = useState('');
  const [userEmailInput, setUserEmailInput] = useState('');
  const [userRoleIdInput, setUserRoleIdInput] = useState('');
  const [userActiveInput, setUserActiveInput] = useState(true);
  const [userPasswordInput, setUserPasswordInput] = useState('');
  const [userModalError, setUserModalError] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Delete User Confirmation Modal
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // ==========================================
  // TAB 2: ROLES STATE & ACTIONS
  // ==========================================
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesSearch, setRolesSearch] = useState('');

  // Modal states for Roles
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [roleNameInput, setRoleNameInput] = useState('');
  const [roleDescInput, setRoleDescInput] = useState('');
  const [roleActiveInput, setRoleActiveInput] = useState(true);
  const [roleModalError, setRoleModalError] = useState('');
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  // Delete Role Confirmation Modal
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleItem | null>(null);
  const [deletingRole, setDeletingRole] = useState(false);

  // ==========================================
  // TAB 3: PERMISSIONS MATRIX STATE & ACTIONS
  // ==========================================
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [assignedKeys, setAssignedKeys] = useState<string[]>([]);
  const [originalAssignedKeys, setOriginalAssignedKeys] = useState<string[]>([]);
  const [matrixSubmitting, setMatrixSubmitting] = useState(false);
  const [matrixError, setMatrixError] = useState('');

  // ------------------------------------------
  // INITIAL DATA FETCHING
  // ------------------------------------------
  const loadUsersData = async () => {
    const currentReqId = ++usersFetchReqIdRef.current;
    setUsersLoading(true);
    try {
      const data = await api.getAdminUsers();
      if (currentReqId === usersFetchReqIdRef.current) {
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      if (currentReqId === usersFetchReqIdRef.current) {
        showToast(getFriendlyErrorMessage(err, 'فشل تحميل قائمة المستخدمين'), 'error');
      }
    } finally {
      if (currentReqId === usersFetchReqIdRef.current) {
        setUsersLoading(false);
      }
    }
  };

  const loadRolesData = async () => {
    setRolesLoading(true);
    try {
      const data = await api.getAdminRoles();
      const rolesList = Array.isArray(data) ? data : [];
      setRoles(rolesList);
      if (rolesList.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesList[0].id);
      }
    } catch (err: any) {
      showToast(getFriendlyErrorMessage(err, 'فشل تحميل قائمة الأدوار'), 'error');
    } finally {
      setRolesLoading(false);
    }
  };

  const loadMatrixForRole = async (roleId: string) => {
    if (!roleId) return;
    setMatrixLoading(true);
    setMatrixError('');
    try {
      const res = await api.getRolePermissions(roleId);
      if (res) {
        setAllPermissions(res.permissions || []);
        const keys = res.assignedPermissions || [];
        setAssignedKeys(keys);
        setOriginalAssignedKeys(keys);
      }
    } catch (err: any) {
      setMatrixError(getFriendlyErrorMessage(err, 'فشل جلب مصفوفة صلاحيات الدور المحدد'));
    } finally {
      setMatrixLoading(false);
    }
  };

  useEffect(() => {
    loadUsersData();
    loadRolesData();
  }, []);

  useEffect(() => {
    if (activeTab === 'matrix' && selectedRoleId) {
      loadMatrixForRole(selectedRoleId);
    }
  }, [activeTab, selectedRoleId]);

  // ------------------------------------------
  // USERS HANDLERS
  // ------------------------------------------
  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserNameInput('');
    setUserEmailInput('');
    setUserRoleIdInput(roles.length > 0 ? roles[0].id : '');
    setUserActiveInput(true);
    setUserPasswordInput('');
    setUserModalError('');
    setUserModalOpen(true);
  };

  const handleOpenEditUser = (u: AdminUserItem) => {
    setEditingUser(u);
    setUserNameInput(u.name || '');
    setUserEmailInput(u.email || '');
    setUserRoleIdInput(u.roleId || (roles.length > 0 ? roles[0].id : ''));
    setUserActiveInput(u.active !== undefined ? Boolean(u.active) : true);
    setUserPasswordInput('');
    setUserModalError('');
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError('');

    if (!userNameInput.trim()) {
      setUserModalError('اسم المشرف مطلوب');
      return;
    }
    if (!userEmailInput.trim()) {
      setUserModalError('البريد الإلكتروني مطلوب');
      return;
    }
    if (!userRoleIdInput) {
      setUserModalError('يرجى اختيار دور للمستخدم');
      return;
    }

    setUserSubmitting(true);
    try {
      if (editingUser) {
        // Update user
        const payload: any = {
          name: userNameInput.trim(),
          email: userEmailInput.trim(),
          roleId: userRoleIdInput,
          active: userActiveInput
        };
        if (userPasswordInput.trim()) {
          payload.password = userPasswordInput.trim();
        }
        await api.updateAdminUser(editingUser.id, payload);

        // Check if the edited user matches currentAdmin's email
        if (
          currentAdmin?.email &&
          (userEmailInput.trim().toLowerCase() === currentAdmin.email.toLowerCase() ||
           editingUser.email?.toLowerCase() === currentAdmin.email.toLowerCase())
        ) {
          const matchedRole = roles.find(r => r.id === userRoleIdInput);
          if (setCurrentAdmin) {
            setCurrentAdmin(prev => prev ? ({
              ...prev,
              name: userNameInput.trim(),
              email: userEmailInput.trim(),
              roleId: userRoleIdInput,
              role: matchedRole?.name || prev.role,
              permissions: matchedRole?.permissions || prev.permissions
            }) : {
              name: userNameInput.trim(),
              email: userEmailInput.trim(),
              roleId: userRoleIdInput,
              role: matchedRole?.name,
              permissions: matchedRole?.permissions || []
            });
          }
        }

        showToast('تم تحديث بيانات المستخدم بنجاح');
      } else {
        // Create user
        const payload: any = {
          name: userNameInput.trim(),
          email: userEmailInput.trim(),
          roleId: userRoleIdInput,
          active: userActiveInput
        };
        if (userPasswordInput.trim()) {
          payload.password = userPasswordInput.trim();
        }
        await api.createAdminUser(payload);
        showToast('تم إضافة المستخدم الجديد بنجاح');
      }
      setUserModalOpen(false);
      await loadUsersData();
    } catch (err: any) {
      setUserModalError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء حفظ المستخدم'));
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleToggleUserActive = async (u: AdminUserItem) => {
    try {
      await api.updateAdminUser(u.id, { active: !u.active });
      showToast(`تم ${!u.active ? 'تفعيل' : 'تعطيل'} حساب المستخدم بنجاح`);
      await loadUsersData();
    } catch (err: any) {
      showToast(getFriendlyErrorMessage(err, 'فشل تغيير حالة حساب المستخدم'), 'error');
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    try {
      await api.deleteAdminUser(deleteUserTarget.id);
      showToast('تم حذف المستخدم بنجاح (حذف مؤقت)');
      setDeleteUserTarget(null);
      await loadUsersData();
    } catch (err: any) {
      showToast(getFriendlyErrorMessage(err, 'فشل حذف المستخدم'), 'error');
    } finally {
      setDeletingUser(false);
    }
  };

  // ------------------------------------------
  // ROLES HANDLERS
  // ------------------------------------------
  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleNameInput('');
    setRoleDescInput('');
    setRoleActiveInput(true);
    setRoleModalError('');
    setRoleModalOpen(true);
  };

  const handleOpenEditRole = (r: RoleItem) => {
    setEditingRole(r);
    setRoleNameInput(r.name || '');
    setRoleDescInput(r.description || '');
    setRoleActiveInput(r.active !== undefined ? Boolean(r.active) : true);
    setRoleModalError('');
    setRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleModalError('');

    if (!roleNameInput.trim()) {
      setRoleModalError('اسم الدور مطلوب');
      return;
    }
    if (!roleDescInput.trim()) {
      setRoleModalError('وصف الدور مطلوب');
      return;
    }

    setRoleSubmitting(true);
    try {
      if (editingRole) {
        await api.updateAdminRole(editingRole.id, {
          name: roleNameInput.trim(),
          description: roleDescInput.trim(),
          active: roleActiveInput
        });
        showToast('تم تحديث بيانات الدور بنجاح');
      } else {
        await api.createAdminRole({
          name: roleNameInput.trim(),
          description: roleDescInput.trim(),
          active: roleActiveInput
        });
        showToast('تم إنشاء الدور الجديد بنجاح');
      }
      setRoleModalOpen(false);
      loadRolesData();
    } catch (err: any) {
      setRoleModalError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء حفظ الدور'));
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleDeleteRoleConfirm = async () => {
    if (!deleteRoleTarget) return;
    setDeletingRole(true);
    try {
      await api.deleteAdminRole(deleteRoleTarget.id);
      showToast('تم حذف الدور بنجاح');
      setDeleteRoleTarget(null);
      loadRolesData();
    } catch (err: any) {
      showToast(getFriendlyErrorMessage(err, 'فشل حذف الدور'), 'error');
    } finally {
      setDeletingRole(false);
    }
  };

  // ------------------------------------------
  // PERMISSIONS MATRIX HANDLERS
  // ------------------------------------------
  const handleTogglePermissionKey = (key: string) => {
    setAssignedKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const handleToggleGroupAll = (groupKeys: string[], shouldEnable: boolean) => {
    setAssignedKeys(prev => {
      if (shouldEnable) {
        const set = new Set([...prev, ...groupKeys]);
        return Array.from(set);
      } else {
        return prev.filter(k => !groupKeys.includes(k));
      }
    });
  };

  const handleSaveMatrix = async () => {
    if (!selectedRoleId) return;
    setMatrixSubmitting(true);
    setMatrixError('');
    try {
      await api.updateRolePermissions(selectedRoleId, assignedKeys);
      setOriginalAssignedKeys(assignedKeys);
      showToast('تم حفظ تحديثات الصلاحيات للدور المحدد بنجاح 🛡️');
    } catch (err: any) {
      const friendly = getFriendlyErrorMessage(err, 'فشل حفظ تغييرات الصلاحيات');
      setMatrixError(friendly);
      showToast(friendly, 'error');
    } finally {
      setMatrixSubmitting(false);
    }
  };

  // Filtered Users & Pagination
  const filteredUsers = users.filter(u => {
    if (usersSearch.trim()) {
      const q = usersSearch.toLowerCase().trim();
      const roleName = roles.find(r => r.id === u.roleId)?.name?.toLowerCase() || '';
      const matchesSearch = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || roleName.includes(q);
      if (!matchesSearch) return false;
    }
    if (userRoleFilter !== 'all' && u.roleId !== userRoleFilter) {
      return false;
    }
    return true;
  });

  const totalUsersCount = filteredUsers.length;
  const totalUsersPages = Math.ceil(totalUsersCount / USERS_PER_PAGE) || 1;
  const safeUsersPage = Math.min(Math.max(1, usersPage), totalUsersPages);
  const usersOffset = (safeUsersPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(usersOffset, usersOffset + USERS_PER_PAGE);

  useEffect(() => {
    if (usersPage > totalUsersPages) {
      setUsersPage(totalUsersPages);
    }
  }, [usersPage, totalUsersPages]);

  // Filtered Roles
  const filteredRoles = roles.filter(r => {
    if (!rolesSearch.trim()) return true;
    const q = rolesSearch.toLowerCase().trim();
    return r.name.toLowerCase().includes(q) || (r.description && r.description.toLowerCase().includes(q));
  });

  // Grouped Permissions
  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    const grp = perm.group || 'عام';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(perm);
    return acc;
  }, {} as Record<string, PermissionItem[]>);

  const isMatrixDirty = JSON.stringify([...assignedKeys].sort()) !== JSON.stringify([...originalAssignedKeys].sort());

  const getRoleName = (roleId: string) => {
    const r = roles.find(item => item.id === roleId);
    return r ? r.name : roleId;
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 dir-rtl font-sans" dir="rtl" id="rbac-admin-panel">
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-xl shadow-2xl border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-5 ${
          toastMessage.type === 'success'
            ? 'bg-emerald-900/90 dark:bg-emerald-950 border-emerald-500/40 text-emerald-200'
            : 'bg-rose-900/90 dark:bg-rose-950 border-rose-500/40 text-rose-200'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
          <span className="text-xs font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* 1. Master Page Header */}
      <AdminPageHeader
        title="المستخدمون والصلاحيات"
        description="إدارة مستخدمي الإدارة، أدوار النظام، ومصفوفة الصلاحيات المتقدمة"
        icon={ShieldCheck}
        badge={<AdminBadge variant="amber">{users.length} مستخدم</AdminBadge>}
        actions={
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-xl gap-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>المستخدمون ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('roles')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'roles'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>الأدوار ({roles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'matrix'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>مصفوفة الصلاحيات</span>
            </button>
          </div>
        }
      />

      {/* 2. KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          title="إجمالي المشرفين"
          value={users.length}
          icon={Users}
          subtitle="حسابات مدراء النظام"
        />
        <AdminStatCard
          title="المشرفون النشطون"
          value={users.filter(u => u.active).length}
          icon={CheckCircle2}
          trend={{ value: `${users.filter(u => u.active).length} حساب`, isPositive: true, label: 'يمتلكون حق الدخول' }}
        />
        <AdminStatCard
          title="أدوار النظام المعتمدة"
          value={roles.length}
          icon={Shield}
          subtitle="مستويات الصلاحيات المتاحة"
        />
        <AdminStatCard
          title="الصلاحيات البرمجية"
          value={allPermissions.length || 18}
          icon={Key}
          trend={{ value: 'RBAC Active', isPositive: true, label: 'أمان ومصادقة مشددة' }}
        />
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ADMIN USERS MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <AdminCard className="space-y-4 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-72">
                <AdminSearchInput
                  value={usersSearch}
                  onChange={(val) => { setUsersSearch(val); setUsersPage(1); }}
                  placeholder="ابحث بالاسم، البريد، أو الدور..."
                />
              </div>
              <div className="w-full sm:w-48">
                <CustomSelect
                  value={userRoleFilter}
                  onChange={(val) => { setUserRoleFilter(val); setUsersPage(1); }}
                  size="sm"
                  buttonClassName="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 font-bold"
                  menuClassName="bg-white dark:bg-slate-900 min-w-[180px]"
                  options={[
                    { value: 'all', label: 'جميع الأدوار' },
                    ...roles.map(r => ({ value: r.id, label: r.name }))
                  ]}
                />
              </div>
            </div>

            <AdminButton
              icon={UserPlus}
              onClick={handleOpenCreateUser}
            >
              إضافة مشرف جديد
            </AdminButton>
          </div>

          {/* Table Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            {usersLoading ? (
              <AdminLoading text="جارٍ تحميل قائمة المشرفين..." />
            ) : filteredUsers.length === 0 ? (
              <AdminEmptyState
                icon={Users}
                title="لم يتم العثور على أي مشرفين"
                description="جرّب تغيير كلمات البحث أو قم بإضافة مشرف جديد للنظام."
                action={
                  <AdminButton icon={UserPlus} onClick={handleOpenCreateUser}>
                    إضافة مشرف الآن
                  </AdminButton>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-3.5 px-4">المشرف</th>
                      <th className="py-3.5 px-4">الدور الوظيفي</th>
                      <th className="py-3.5 px-4">الحالة</th>
                      <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                      <th className="py-3.5 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-200">
                    {paginatedUsers.map((u) => {
                      const roleName = getRoleName(u.roleId);
                      return (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-black flex items-center justify-center text-sm shrink-0">
                                {u.name.slice(0, 1)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white text-xs truncate">{u.name}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 dir-ltr text-right truncate font-mono">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <AdminBadge variant="amber">
                              <Shield className="w-3 h-3 ml-1" />
                              {roleName}
                            </AdminBadge>
                          </td>
                          <td className="py-3.5 px-4">
                            {u.active ? (
                              <AdminBadge variant="success">
                                <CheckCircle2 className="w-3 h-3 ml-1" />
                                نشط
                              </AdminBadge>
                            ) : (
                              <AdminBadge variant="danger">
                                <XCircle className="w-3 h-3 ml-1" />
                                معطل
                              </AdminBadge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('ar-EG') : '—'}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleToggleUserActive(u)}
                                title={u.active ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  u.active
                                    ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                                }`}
                              >
                                {u.active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                              </button>

                              <button
                                onClick={() => handleOpenEditUser(u)}
                                title="تعديل بيانات المشرف"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setDeleteUserTarget(u)}
                                title="حذف المشرف"
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredUsers.length > 0 && (
              <AdminTablePagination
                page={safeUsersPage}
                totalPages={totalUsersPages}
                total={totalUsersCount}
                limit={USERS_PER_PAGE}
                onPageChange={(p) => setUsersPage(p)}
              />
            )}
          </div>
        </AdminCard>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ROLES MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'roles' && (
        <AdminCard className="space-y-4 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="w-full sm:w-80">
              <AdminSearchInput
                value={rolesSearch}
                onChange={(val) => setRolesSearch(val)}
                placeholder="ابحث باسم الدور أو الوصف..."
              />
            </div>

            <AdminButton
              icon={Plus}
              onClick={handleOpenCreateRole}
            >
              إضافة دور جديد
            </AdminButton>
          </div>

          {/* Roles Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            {rolesLoading ? (
              <AdminLoading text="جارٍ تحميل قائمة الأدوار..." />
            ) : filteredRoles.length === 0 ? (
              <AdminEmptyState
                icon={Shield}
                title="لم يتم العثور على أي أدوار"
                description="جرّب تغيير كلمات البحث أو أضف دوراً وظيفياً جديداً."
                action={
                  <AdminButton icon={Plus} onClick={handleOpenCreateRole}>
                    إضافة دور جديد
                  </AdminButton>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-3.5 px-4">اسم الدور</th>
                      <th className="py-3.5 px-4">الوصف</th>
                      <th className="py-3.5 px-4">نوع الدور</th>
                      <th className="py-3.5 px-4">الحالة</th>
                      <th className="py-3.5 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-semibold text-slate-700 dark:text-slate-200">
                    {filteredRoles.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              <Shield className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white text-xs">{r.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{r.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-xs max-w-xs truncate">
                          {r.description || '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          {r.isSystem ? (
                            <AdminBadge variant="amber">
                              <Lock className="w-3 h-3 ml-1" />
                              دور نظام أساسي
                            </AdminBadge>
                          ) : (
                            <AdminBadge variant="neutral">
                              دور مخصص
                            </AdminBadge>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {r.active !== false ? (
                            <AdminBadge variant="success">
                              <CheckCircle2 className="w-3 h-3 ml-1" />
                              نشط
                            </AdminBadge>
                          ) : (
                            <AdminBadge variant="danger">
                              غير نشط
                            </AdminBadge>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEditRole(r)}
                              title="تعديل الدور"
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              disabled={Boolean(r.isSystem)}
                              onClick={() => setDeleteRoleTarget(r)}
                              title={r.isSystem ? 'لا يمكن حذف دور نظام أساسي' : 'حذف الدور'}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                r.isSystem
                                  ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                  : 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/30 text-rose-600 dark:text-rose-400 cursor-pointer'
                              }`}
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
            )}
          </div>
        </AdminCard>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PERMISSIONS MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <AdminCard className="space-y-4 animate-in fade-in duration-200">
          {/* Matrix Header Controls */}
          <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xs">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">اختر الدور الوظيفي:</label>
              <div className="w-full md:w-64">
                <CustomSelect
                  value={selectedRoleId}
                  onChange={(val) => setSelectedRoleId(val)}
                  size="sm"
                  buttonClassName="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-amber-600 dark:text-amber-400 font-bold focus:border-amber-500"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[200px]"
                  options={roles.map(r => ({
                    value: r.id,
                    label: `${r.name} ${r.isSystem ? '(نظام)' : ''}`
                  }))}
                />
              </div>
            </div>

            {/* Matrix Action Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              {isMatrixDirty && (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 animate-pulse bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  يوجد تغييرات غير محفوظة ⚠️
                </span>
              )}
              <AdminButton
                disabled={matrixSubmitting || !isMatrixDirty}
                loading={matrixSubmitting}
                onClick={handleSaveMatrix}
                icon={Check}
              >
                حفظ صلاحيات الدور
              </AdminButton>
            </div>
          </div>

          {/* Error Banner */}
          {matrixError && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
              <span>{matrixError}</span>
            </div>
          )}

          {/* Permissions Matrix Content */}
          {matrixLoading ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <span className="text-xs font-bold">جارٍ تحميل مصفوفة الصلاحيات...</span>
            </div>
          ) : Object.keys(groupedPermissions).length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <p className="text-sm font-bold">لا توجد صلاحيات مسجلة في النظام.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedPermissions).map(([groupName, perms]) => {
                const permsList = (perms || []) as PermissionItem[];
                const groupKeys = permsList.map(p => p.key);
                const allChecked = groupKeys.every(k => assignedKeys.includes(k));
                const someChecked = groupKeys.some(k => assignedKeys.includes(k));

                return (
                  <div key={groupName} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
                    {/* Group Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                        <h3 className="text-sm font-black text-slate-900 dark:text-white capitalize">مجموعة: {groupName}</h3>
                        <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
                          {permsList.length} صلاحية
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleGroupAll(groupKeys, !allChecked)}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
                      >
                        {allChecked ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                      </button>
                    </div>

                    {/* Permissions Checkboxes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {permsList.map((p) => {
                        const checked = assignedKeys.includes(p.key);
                        return (
                          <label
                            key={p.id}
                            onClick={() => handleTogglePermissionKey(p.key)}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                              checked
                                ? 'bg-amber-500/10 border-amber-500/40 text-slate-900 dark:text-white shadow-xs'
                                : 'bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}} // handled by parent label onClick
                              className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 bg-white dark:bg-slate-900 cursor-pointer"
                            />
                            <div className="min-w-0 space-y-0.5">
                              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{p.name}</span>
                                {p.isSystem && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                                    نظام
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">{p.key}</div>
                              {p.description && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{p.description}</p>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AdminCard>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. USER CREATE/EDIT MODAL */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 text-right shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-500" />
                <span>{editingUser ? 'تعديل بيانات المشرف' : 'إضافة مشرف جديد'}</span>
              </h3>
              <button
                onClick={() => setUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {userModalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold">
                ⚠️ {userModalError}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">الاسم الكامل *</label>
                <input
                  type="text"
                  value={userNameInput}
                  onChange={(e) => setUserNameInput(e.target.value)}
                  placeholder="مثال: أحمد محمود"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">البريد الإلكتروني *</label>
                <input
                  type="email"
                  value={userEmailInput}
                  onChange={(e) => setUserEmailInput(e.target.value)}
                  placeholder="admin@store.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono text-left"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">الدور الوظيفي *</label>
                <CustomSelect
                  value={userRoleIdInput}
                  onChange={(val) => setUserRoleIdInput(val)}
                  size="sm"
                  buttonClassName="w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-amber-600 dark:text-amber-400 font-bold focus:border-amber-500"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[200px]"
                  options={[
                    { value: '', label: '-- اختر الدور --' },
                    ...roles.map(r => ({
                      value: r.id,
                      label: r.name
                    }))
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  كلمة المرور {editingUser ? '(اتركها فارغة للإبقاء على الحالية)' : '(اختياري - توليد تلقائي)'}
                </label>
                <input
                  type="password"
                  value={userPasswordInput}
                  onChange={(e) => setUserPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="userActiveCheck"
                  checked={userActiveInput}
                  onChange={(e) => setUserActiveInput(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-50 dark:bg-slate-950 cursor-pointer"
                />
                <label htmlFor="userActiveCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  حساب نشط ومفعل
                </label>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex justify-center items-center gap-2"
                >
                  {userSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingUser ? 'تحديث البيانات' : 'إنشاء المشرف'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ROLE CREATE/EDIT MODAL */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 text-right shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <span>{editingRole ? 'تعديل بيانات الدور' : 'إنشاء دور جديد'}</span>
              </h3>
              <button
                onClick={() => setRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {roleModalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold">
                ⚠️ {roleModalError}
              </div>
            )}

            <form onSubmit={handleSaveRole} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">اسم الدور الوظيفي *</label>
                <input
                  type="text"
                  value={roleNameInput}
                  onChange={(e) => setRoleNameInput(e.target.value)}
                  placeholder="مثال: مدير المبيعات"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">وصف الدور مسؤولياته *</label>
                <textarea
                  rows={3}
                  value={roleDescInput}
                  onChange={(e) => setRoleDescInput(e.target.value)}
                  placeholder="اكتب وصفاً موجزاً للمسؤوليات الموكلة لهذا الدور..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="roleActiveCheck"
                  checked={roleActiveInput}
                  onChange={(e) => setRoleActiveInput(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-50 dark:bg-slate-950 cursor-pointer"
                />
                <label htmlFor="roleActiveCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  دور نشط ومتاح للاستخدام
                </label>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={roleSubmitting}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer flex justify-center items-center gap-2"
                >
                  {roleSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{editingRole ? 'تحديث الدور' : 'إنشاء الدور'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. DELETE USER CONFIRMATION MODAL */}
      {deleteUserTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">تأكيد حذف المشرف</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              هل أنت تأكد من رغبتك في حذف المشرف <span className="text-slate-900 dark:text-white font-bold">"{deleteUserTarget.name}"</span>؟
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={deletingUser}
                onClick={handleDeleteUserConfirm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {deletingUser && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>حذف المشرف</span>
              </button>
              <button
                onClick={() => setDeleteUserTarget(null)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. DELETE ROLE CONFIRMATION MODAL */}
      {deleteRoleTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">تأكيد حذف الدور الوظيفي</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              هل أنت تأكد من حذف الدور <span className="text-slate-900 dark:text-white font-bold">"{deleteRoleTarget.name}"</span>؟
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                disabled={deletingRole}
                onClick={handleDeleteRoleConfirm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {deletingRole && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>حذف الدور</span>
              </button>
              <button
                onClick={() => setDeleteRoleTarget(null)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
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
