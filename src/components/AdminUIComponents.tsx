import React, { useEffect } from 'react';
import { LucideIcon, CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.js';

export { ThemeToggle };

// Unified Card Container
export interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  children,
  className = '',
  onClick,
  hoverEffect = false
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-6 text-slate-900 dark:text-slate-100 shadow-sm transition-all duration-200 ease-in-out ${
        hoverEffect || onClick
          ? 'hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
          : 'hover:border-slate-300/80 dark:hover:border-slate-800/90'
      } ${className}`}
    >
      {children}
    </div>
  );
};

// Unified Section Container
export interface AdminSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminSection: React.FC<AdminSectionProps> = ({ children, className = '' }) => {
  return (
    <section className={`space-y-6 animate-in fade-in-50 duration-200 ${className}`}>
      {children}
    </section>
  );
};

// Unified Page / Section Header
export interface AdminPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  showThemeToggle?: boolean;
  className?: string;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  badge,
  actions,
  showThemeToggle = false,
  className = ''
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 ${className}`}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <Icon className="w-6 h-6 shrink-0" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h1>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {actions}
        {showThemeToggle && (
          <ThemeToggle variant="admin" showLabel={false} />
        )}
      </div>
    </div>
  );
};

// Unified Empty State
export interface AdminEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const AdminEmptyState: React.FC<AdminEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div
      role="status"
      className={`bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-10 md:p-14 text-center flex flex-col items-center justify-center gap-3 animate-in fade-in-50 duration-200 ${className}`}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center text-slate-500 dark:text-slate-400 mb-1">
          <Icon className="w-7 h-7 stroke-[1.5] shrink-0" />
        </div>
      )}
      <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

// Unified Skeleton Loader
export interface AdminSkeletonProps {
  count?: number;
  height?: string;
  className?: string;
}

export const AdminSkeleton: React.FC<AdminSkeletonProps> = ({
  count = 3,
  height = 'h-16',
  className = ''
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="جاري التحميل..."
      className={`space-y-3 ${className}`}
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`${height} bg-slate-200/80 dark:bg-slate-900/60 border border-slate-300/60 dark:border-slate-800/80 rounded-xl animate-pulse`}
        />
      ))}
    </div>
  );
};

// Unified Loading Indicator
export interface AdminLoadingProps {
  message?: string;
  className?: string;
}

export const AdminLoading: React.FC<AdminLoadingProps> = ({
  message = 'جارٍ تحميل البيانات...',
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-slate-500 dark:text-slate-400 gap-3 ${className}`}>
      <span className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0" />
      <span className="text-xs font-bold">{message}</span>
    </div>
  );
};

// Unified Primary / Standard Action Button
export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  children: React.ReactNode;
}

export const AdminButton: React.FC<AdminButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0';
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-[11px]',
    md: 'px-4 py-2.5 text-xs',
    lg: 'px-5 py-3 text-sm'
  };

  const variantStyles = {
    primary: 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/10 active:scale-[0.98]',
    secondary: 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700/80 active:scale-[0.98]',
    outline: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700/80 active:scale-[0.98]',
    danger: 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/20 active:scale-[0.98]',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 active:scale-[0.98]',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        Icon && <Icon className="w-4 h-4 shrink-0" />
      )}
      <span>{children}</span>
    </button>
  );
};

// Unified Stat Card
export interface AdminStatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: string | number; isPositive?: boolean; label?: string };
  badge?: React.ReactNode;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export const AdminStatCard: React.FC<AdminStatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  badge,
  subtitle,
  className = '',
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 text-slate-900 dark:text-slate-100 shadow-sm relative overflow-hidden transition-all duration-200 ease-in-out hover:border-slate-300 dark:hover:border-slate-700/80 hover:shadow-md ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">{title}</p>
          <div className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-mono">
            {value}
          </div>
        </div>
        {Icon && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
            <Icon className="w-5 h-5 shrink-0" />
          </div>
        )}
      </div>
      {(trend || subtitle || badge) && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
          {trend && (
            <span className={`font-bold inline-flex items-center gap-1 ${trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}
              {trend.label && <span className="text-slate-400 dark:text-slate-500 text-[10px] mr-1">{trend.label}</span>}
            </span>
          )}
          {subtitle && <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{subtitle}</span>}
          {badge}
        </div>
      )}
    </div>
  );
};

// Unified Badge Primitive
export interface AdminBadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'amber' | 'purple';
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export const AdminBadge: React.FC<AdminBadgeProps> = ({
  variant = 'neutral',
  children,
  icon: Icon,
  className = ''
}) => {
  const variantStyles = {
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    info: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
    amber: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 font-bold',
    purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${variantStyles[variant]} ${className}`}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  );
};

// Unified Alert / Banner Notification
export interface AdminAlertProps {
  type?: 'success' | 'danger' | 'warning' | 'info';
  message: string | React.ReactNode;
  onClose?: () => void;
  className?: string;
  autoCloseDuration?: number;
}

export const AdminAlert: React.FC<AdminAlertProps> = ({
  type = 'info',
  message,
  onClose,
  className = '',
  autoCloseDuration
}) => {
  useEffect(() => {
    if (autoCloseDuration && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [autoCloseDuration, onClose]);

  const alertStyles = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    danger: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    info: 'bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400'
  };

  const icons = {
    success: CheckCircle2,
    danger: AlertCircle,
    warning: AlertTriangle,
    info: Info
  };

  const IconComp = icons[type];

  return (
    <div
      role="alert"
      className={`p-3.5 border rounded-xl flex items-center justify-between text-xs font-bold gap-3 animate-in fade-in-50 duration-200 ${alertStyles[type]} ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <IconComp className="w-4 h-4 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق التنبيه"
          className="hover:opacity-75 transition-opacity cursor-pointer p-1 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export * from './AdminTableComponents.js';
export * from './AdminFormComponents.js';
