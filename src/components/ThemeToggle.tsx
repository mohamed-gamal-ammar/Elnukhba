import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

export interface ThemeToggleProps {
  className?: string;
  variant?: 'header' | 'admin' | 'compact' | 'pill';
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  variant = 'header',
  showLabel = false
}) => {
  const { isDark, toggleTheme } = useTheme();

  // Requirements:
  // - Show a Sun icon with tooltip "الوضع الفاتح" when currently in Dark Mode.
  // - Show a Moon icon with tooltip "الوضع الداكن" when currently in Light Mode.
  const tooltip = isDark ? 'الوضع الفاتح' : 'الوضع الداكن';
  const labelText = isDark ? 'الوضع الفاتح' : 'الوضع الداكن';

  if (variant === 'admin') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none border shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shadow-sm ${className}`}
        title={tooltip}
        aria-label={tooltip}
        id="admin-theme-toggle-btn"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon className="w-4 h-4 text-amber-600 transition-transform duration-300 hover:-rotate-12" />
        )}
        <span className="truncate">{showLabel ? labelText : (isDark ? 'الوضع الفاتح' : 'الوضع الداكن')}</span>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center border shrink-0 ${
          isDark
            ? 'bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-800 hover:border-amber-500/40'
            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300'
        } ${className}`}
        title={tooltip}
        aria-label={tooltip}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-amber-500" />
        )}
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative inline-flex items-center h-8 w-14 rounded-full p-1 transition-colors duration-200 cursor-pointer border shrink-0 ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-200 border-slate-300'
        } ${className}`}
        title={tooltip}
        aria-label={tooltip}
      >
        <span
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full transform transition-transform duration-200 shadow-md ${
            isDark ? 'translate-x-0 bg-slate-800 text-amber-400' : '-translate-x-6 bg-white text-amber-500'
          }`}
        >
          {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </span>
      </button>
    );
  }

  // Default 'header' variant
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 border shrink-0 ${
        isDark
          ? 'bg-slate-900/90 hover:bg-slate-800 text-amber-400 border-slate-800 hover:border-amber-500/40 hover:text-amber-300 shadow-sm'
          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-sm'
      } ${className}`}
      title={tooltip}
      aria-label={tooltip}
      id="header-theme-toggle-btn"
    >
      {isDark ? (
        <Sun className="w-4.5 h-4.5 text-amber-400 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="w-4.5 h-4.5 text-amber-500 transition-transform duration-300 hover:-rotate-12" />
      )}
      {showLabel && (
        <span className="text-xs font-bold">{labelText}</span>
      )}
    </button>
  );
};

export default ThemeToggle;
