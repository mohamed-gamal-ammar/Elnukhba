import React, { useEffect } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { CustomSelect, SelectOption } from './CustomSelect.js';
import {
  NumericType,
  handleNumericKeyDown,
  handleNumericPaste,
  sanitizeNumericInput,
  validateNumericValue
} from '../lib/numericValidation.js';

// Admin Modal Container
export interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg'
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl'
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in-50 duration-200"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-modal-title"
    >
      <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/20 rounded-2xl w-full ${widthClasses[maxWidth]} shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col text-slate-900 dark:text-slate-100`}>
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-amber-500/10 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60">
          <div>
            <h3 id="admin-modal-title" className="text-base font-black text-slate-900 dark:text-white">{title}</h3>
            {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-4 text-slate-700 dark:text-slate-200 text-xs">
          {children}
        </div>
      </div>
    </div>
  );
};

// Admin Confirmation Dialog
export interface AdminDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const AdminDialog: React.FC<AdminDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'تأكيد',
  cancelText = 'إلغاء',
  variant = 'danger',
  loading = false,
  icon
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20',
    warning: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20',
    info: 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-50 duration-200"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/20 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-4 text-slate-900 dark:text-white">
        {icon && <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-amber-500/20">{icon}</div>}
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 w-full mt-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2.5 px-4 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 ${variantStyles[variant]}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-300 dark:border-amber-500/20 disabled:opacity-50"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Admin Form Container
export interface AdminFormProps {
  onSubmit: (e: React.FormEvent) => void;
  children: React.ReactNode;
  className?: string;
}

export const AdminForm: React.FC<AdminFormProps> = ({ onSubmit, children, className = '' }) => {
  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`} dir="rtl">
      {children}
    </form>
  );
};

// Admin Form Section Wrapper
export interface AdminFormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const AdminFormSection: React.FC<AdminFormSectionProps> = ({
  title,
  description,
  children,
  className = ''
}) => {
  return (
    <div className={`space-y-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-amber-500/20 rounded-xl p-4 ${className}`}>
      {(title || description) && (
        <div className="border-b border-slate-200 dark:border-amber-500/10 pb-2.5">
          {title && <h4 className="text-xs font-bold text-slate-900 dark:text-white">{title}</h4>}
          {description && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
};

// Input Field Component
export interface AdminInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
  numericType?: NumericType;
  suffix?: string;
  prefix?: string;
}

export const AdminInput: React.FC<AdminInputProps> = ({
  label,
  error,
  required,
  helperText,
  className = '',
  type,
  numericType,
  suffix,
  prefix,
  onKeyDown,
  onPaste,
  onChange,
  ...props
}) => {
  // If explicitly numeric or type="number"
  const isNumeric = type === 'number' || !!numericType;
  const resolvedNumericType: NumericType = numericType || 'non_negative_decimal';

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isNumeric) {
      handleNumericKeyDown(e, resolvedNumericType);
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handlePasteInternal = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isNumeric) {
      handleNumericPaste(e, resolvedNumericType);
    }
    if (onPaste) onPaste(e);
  };

  const handleChangeInternal = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isNumeric) {
      const clean = sanitizeNumericInput(e.target.value, resolvedNumericType);
      if (clean !== e.target.value) {
        e.target.value = clean;
      }
    }
    if (onChange) onChange(e);
  };

  return (
    <div className="space-y-1 text-right">
      {label && (
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
          {label} {required && <span className="text-rose-500 font-black">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute right-3 text-xs text-slate-400 dark:text-slate-500 pointer-events-none font-bold">
            {prefix}
          </span>
        )}
        <input
          type={isNumeric ? 'text' : type}
          inputMode={isNumeric ? (resolvedNumericType.includes('decimal') ? 'decimal' : 'numeric') : undefined}
          onKeyDown={handleKeyDownInternal}
          onPaste={handlePasteInternal}
          onChange={handleChangeInternal}
          className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
            prefix ? 'pr-9' : ''
          } ${suffix ? 'pl-9' : ''} ${
            error
              ? 'border-rose-500 ring-2 ring-rose-500/30 focus:border-rose-500'
              : 'border-slate-300 dark:border-amber-500/20 hover:border-slate-400 dark:hover:border-amber-500/40 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
          } ${className}`}
          {...props}
        />
        {suffix && (
          <span className="absolute left-3 text-xs text-slate-400 dark:text-slate-500 pointer-events-none font-bold">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-rose-500 dark:text-rose-400 font-bold flex items-center gap-1 mt-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {helperText && !error && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{helperText}</p>
      )}
    </div>
  );
};

// Dedicated Strict Numeric Input Component
export interface AdminNumericInputProps extends Omit<AdminInputProps, 'onChange' | 'value'> {
  value: number | string | undefined | null;
  numericType?: NumericType;
  onValueChange?: (numericValue: number | undefined, stringValue: string) => void;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: number;
  max?: number;
  allowEmpty?: boolean;
}

export const AdminNumericInput: React.FC<AdminNumericInputProps> = ({
  value,
  numericType = 'non_negative_decimal',
  onValueChange,
  onChange,
  min,
  max,
  allowEmpty = true,
  ...props
}) => {
  const currentNumericType: NumericType = numericType as NumericType;
  const displayValue = value === undefined || value === null ? '' : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const clean = sanitizeNumericInput(raw, currentNumericType);
    e.target.value = clean;

    if (onChange) onChange(e);

    if (onValueChange) {
      if (clean === '') {
        onValueChange(undefined, '');
      } else {
        const parsed = Number(clean);
        if (!isNaN(parsed) && Number.isFinite(parsed)) {
          onValueChange(parsed, clean);
        } else {
          onValueChange(undefined, clean);
        }
      }
    }
  };

  return (
    <AdminInput
      type="text"
      numericType={numericType}
      value={displayValue}
      onChange={handleChange}
      {...props}
    />
  );
};

// Textarea Component
export interface AdminTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
}

export const AdminTextarea: React.FC<AdminTextareaProps> = ({
  label,
  error,
  required,
  helperText,
  className = '',
  rows = 3,
  ...props
}) => {
  return (
    <div className="space-y-1 text-right">
      {label && (
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
          {label} {required && <span className="text-rose-500 font-black">*</span>}
        </label>
      )}
      <textarea
        rows={rows}
        className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${
          error
            ? 'border-rose-500 ring-2 ring-rose-500/30 focus:border-rose-500'
            : 'border-slate-300 dark:border-amber-500/20 hover:border-slate-400 dark:hover:border-amber-500/40 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
        } ${className}`}
        {...props}
      />
      {error && (
        <p className="text-[11px] text-rose-500 dark:text-rose-400 font-bold flex items-center gap-1 mt-0.5">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {helperText && !error && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{helperText}</p>
      )}
    </div>
  );
};

// Select Component
export interface AdminSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  required?: boolean;
  options?: { value: string | number; label: string; description?: string; badge?: string }[];
  helperText?: string;
  size?: 'sm' | 'md' | 'lg';
  searchable?: boolean;
}

export const AdminSelect: React.FC<AdminSelectProps> = ({
  label,
  error,
  required,
  options,
  children,
  helperText,
  className = '',
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  id,
  size = 'sm',
  searchable,
}) => {
  // Convert children to options if options prop not directly passed
  const resolvedOptions: SelectOption[] = React.useMemo(() => {
    if (options) {
      return options.map(opt => ({
        value: String(opt.value),
        label: opt.label,
        description: opt.description,
        badge: opt.badge
      }));
    }
    if (children) {
      const extracted: SelectOption[] = [];
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && child.type === 'option') {
          const val = child.props.value !== undefined ? String(child.props.value) : String(child.props.children);
          const lab = String(child.props.children || child.props.value || '');
          extracted.push({ value: val, label: lab });
        }
      });
      return extracted;
    }
    return [];
  }, [options, children]);

  const handleChange = (val: string) => {
    if (onChange) {
      const event = {
        target: { value: val, name: name || '' },
        currentTarget: { value: val, name: name || '' },
        persist: () => {},
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(event);
    }
  };

  return (
    <CustomSelect
      id={id}
      name={name}
      label={label}
      required={required}
      disabled={disabled}
      error={error}
      helperText={helperText}
      value={value !== undefined ? String(value) : undefined}
      defaultValue={defaultValue !== undefined ? String(defaultValue) : undefined}
      onChange={handleChange}
      options={resolvedOptions}
      size={size}
      searchable={searchable}
      buttonClassName={`bg-white dark:bg-slate-900 border-slate-300 dark:border-amber-500/20 text-slate-900 dark:text-slate-100 hover:border-slate-400 dark:hover:border-amber-500/40 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 ${className}`}
      menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-amber-500/20 shadow-2xl"
    />
  );
};

// Checkbox Component
export interface AdminCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
}

export const AdminCheckbox: React.FC<AdminCheckboxProps> = ({
  label,
  helperText,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <div className={`flex items-start gap-2.5 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        disabled={disabled}
        className={`mt-0.5 rounded border border-slate-300 dark:border-amber-500/30 bg-white dark:bg-slate-900 text-amber-500 accent-amber-500 focus:ring-2 focus:ring-amber-500/30 focus:outline-none h-4 w-4 transition-colors ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-amber-500/60'
        } ${className}`}
        {...props}
      />
      <div>
        <label className={`text-xs font-bold text-slate-800 dark:text-slate-200 block ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
          {label}
        </label>
        {helperText && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{helperText}</p>}
      </div>
    </div>
  );
};

// Switch Toggle Component
export interface AdminSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const AdminSwitch: React.FC<AdminSwitchProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false
}) => {
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-amber-500/20 rounded-xl">
      <div>
        <label className={`text-xs font-bold text-slate-900 dark:text-white block ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>{label}</label>
        {description && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${
          checked ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-950 shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-0' : '-translate-x-4'
          }`}
        />
      </button>
    </div>
  );
};

// Form Action Buttons Bar
export interface AdminFormActionsProps {
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  extraActions?: React.ReactNode;
}

export const AdminFormActions: React.FC<AdminFormActionsProps> = ({
  onCancel,
  submitText = 'حفظ التغييرات',
  cancelText = 'إلغاء',
  loading = false,
  disabled = false,
  className = '',
  extraActions
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-amber-500/10 mt-6 ${className}`}>
      {extraActions}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-amber-500/20"
        >
          {cancelText}
        </button>
      )}
      <button
        type="submit"
        disabled={loading || disabled}
        className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        <span>{submitText}</span>
      </button>
    </div>
  );
};
