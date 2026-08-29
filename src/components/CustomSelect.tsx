import React, { useState, useRef, useEffect, useLayoutEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X, AlertCircle } from 'lucide-react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  disabled?: boolean;
}

export interface CustomSelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string) => void;
  options: (SelectOption | string)[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string | boolean;
  helperText?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dir?: 'rtl' | 'ltr';
  placement?: 'bottom' | 'top' | 'auto';
  align?: 'start' | 'end';
  clearable?: boolean;
  onClear?: () => void;
  usePortal?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  name,
  value,
  defaultValue,
  onChange,
  options = [],
  placeholder = 'اختر من القائمة...',
  label,
  required = false,
  disabled = false,
  error,
  helperText,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  optionClassName = '',
  searchable,
  searchPlaceholder = 'بحث...',
  icon,
  size = 'md',
  dir = 'rtl',
  placement = 'auto',
  align = 'start',
  clearable = false,
  onClear,
  usePortal = true,
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  
  // Normalize options into uniform SelectOption structure
  const normalizedOptions: SelectOption[] = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string>(
    value !== undefined ? String(value) : defaultValue !== undefined ? String(defaultValue) : ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dynamic placement & coordinate calculation
  const [resolvedPlacement, setResolvedPlacement] = useState<'top' | 'bottom'>(
    placement === 'top' ? 'top' : 'bottom'
  );
  const [menuStyles, setMenuStyles] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!containerRef.current || typeof window === 'undefined') return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Detect direction
    const isRtl = dir === 'rtl' || (typeof document !== 'undefined' && (document.documentElement.dir === 'rtl' || document.body.dir === 'rtl'));

    // Determine placement (top vs bottom)
    let finalPlacement: 'top' | 'bottom' = 'bottom';
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const estimatedHeight = menuRef.current?.offsetHeight || 220;

    if (placement === 'top') {
      finalPlacement = 'top';
    } else if (placement === 'bottom') {
      finalPlacement = 'bottom';
    } else {
      // auto mode: if space below is too small and space above is larger, flip to top
      if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
        finalPlacement = 'top';
      } else {
        finalPlacement = 'bottom';
      }
    }

    setResolvedPlacement(finalPlacement);

    if (!usePortal) return;

    const styles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 99999,
    };

    // Vertical placement
    if (finalPlacement === 'top') {
      const bottomCoord = viewportHeight - rect.top + 6;
      styles.bottom = `${Math.max(8, Math.round(bottomCoord))}px`;
      styles.top = 'auto';
      styles.maxHeight = `${Math.min(320, Math.max(100, Math.round(spaceAbove - 16)))}px`;
      styles.transformOrigin = 'bottom';
    } else {
      const topCoord = rect.bottom + 6;
      styles.top = `${Math.max(8, Math.round(topCoord))}px`;
      styles.bottom = 'auto';
      styles.maxHeight = `${Math.min(320, Math.max(100, Math.round(spaceBelow - 16)))}px`;
      styles.transformOrigin = 'top';
    }

    // Horizontal Alignment (start | end)
    const minWidth = Math.min(rect.width, viewportWidth - 16);
    styles.minWidth = `${Math.round(minWidth)}px`;
    styles.maxWidth = `${Math.round(viewportWidth - 16)}px`;

    if (isRtl) {
      if (align === 'end') {
        // Left aligned to trigger in RTL
        const leftCoord = Math.max(8, Math.min(rect.left, viewportWidth - minWidth - 8));
        styles.left = `${Math.round(leftCoord)}px`;
        styles.right = 'auto';
      } else {
        // Start (Right) aligned to trigger in RTL
        const rightCoord = Math.max(8, Math.min(viewportWidth - rect.right, viewportWidth - minWidth - 8));
        styles.right = `${Math.round(rightCoord)}px`;
        styles.left = 'auto';
      }
    } else {
      if (align === 'end') {
        // Right aligned to trigger in LTR
        const rightCoord = Math.max(8, Math.min(viewportWidth - rect.right, viewportWidth - minWidth - 8));
        styles.right = `${Math.round(rightCoord)}px`;
        styles.left = 'auto';
      } else {
        // Start (Left) aligned to trigger in LTR
        const leftCoord = Math.max(8, Math.min(rect.left, viewportWidth - minWidth - 8));
        styles.left = `${Math.round(leftCoord)}px`;
        styles.right = 'auto';
      }
    }

    setMenuStyles(styles);
  }, [placement, align, dir, usePortal]);

  // Synchronous positioning on open before paint to eliminate layout shift
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Sync internal value when controlled value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(String(value));
    }
  }, [value]);

  const currentValue = value !== undefined ? String(value) : internalValue;
  const selectedOption = normalizedOptions.find((opt) => opt.value === currentValue);

  // Auto enable search if > 7 options unless explicitly specified
  const isSearchable = searchable !== undefined ? searchable : normalizedOptions.length > 7;

  // Filtered options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const query = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter((opt) =>
      opt.label.toLowerCase().includes(query) ||
      opt.value.toLowerCase().includes(query) ||
      (opt.description && opt.description.toLowerCase().includes(query))
    );
  }, [normalizedOptions, searchQuery]);

  // Click outside listener (handles both container and portal menu element)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && isSearchable) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, isSearchable]);

  // Handle select action
  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    setInternalValue(option.value);
    if (onChange) {
      onChange(option.value);
    }
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  // Handle Clear
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInternalValue('');
    if (onChange) {
      onChange('');
    }
    if (onClear) {
      onClear();
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
          scrollOptionIntoView(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
          scrollOptionIntoView(next);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (filteredOptions.length > 0 && searchQuery) {
          handleSelect(filteredOptions[0]);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchQuery('');
        break;
    }
  };

  const scrollOptionIntoView = (index: number) => {
    if (!listboxRef.current) return;
    const items = listboxRef.current.querySelectorAll('[data-option-item]');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  // Size variations
  const sizeClasses = {
    sm: 'py-1.5 px-3 text-xs min-h-[34px]',
    md: 'py-2.5 px-3.5 text-xs sm:text-sm min-h-[42px]',
    lg: 'py-3 px-4 text-sm min-h-[48px]'
  };

  // Render Dropdown Menu Popover
  const dropdownMenuElement = isOpen && (
    <div
      ref={menuRef}
      dir={dir || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr')}
      style={usePortal ? menuStyles : { maxHeight: '320px' }}
      className={`${
        usePortal
          ? 'fixed'
          : `absolute z-50 ${
              resolvedPlacement === 'top'
                ? 'bottom-full mb-1.5 origin-bottom'
                : 'top-full mt-1.5 origin-top'
            } ${
              align === 'end'
                ? dir === 'rtl'
                  ? 'left-0'
                  : 'right-0'
                : dir === 'rtl'
                ? 'right-0'
                : 'left-0'
            } min-w-full`
      } bg-white dark:bg-slate-900 border border-slate-200 dark:border-amber-500/20 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md transition-all animate-in fade-in-50 zoom-in-95 duration-150 ${menuClassName}`}
    >
      {/* Optional Search Input */}
      {isSearchable && (
        <div className="p-2 border-b border-slate-150 dark:border-amber-500/10 bg-slate-50/70 dark:bg-slate-950/80 sticky top-0 z-10">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-amber-500/70 dark:text-amber-400 absolute right-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full pr-8 pl-7 py-1.5 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-400 border border-slate-200 dark:border-amber-500/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-2 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Options List */}
      <div
        ref={listboxRef}
        role="listbox"
        tabIndex={-1}
        className="overflow-y-auto max-h-56 p-1.5 space-y-0.5 custom-dropdown-scrollbar"
      >
        {filteredOptions.length === 0 ? (
          <div className="py-4 px-3 text-center text-xs text-slate-400 dark:text-slate-400 font-semibold">
            لا توجد نتائج مطابقة
          </div>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isSelected = opt.value === currentValue;
            const isHighlighted = idx === highlightedIndex;

            return (
              <div
                key={opt.value}
                data-option-item
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(opt)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`group w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-150 cursor-pointer ${
                  opt.disabled
                    ? 'opacity-40 cursor-not-allowed text-slate-400'
                    : isSelected
                    ? 'bg-amber-500/20 text-amber-900 dark:text-white font-bold border border-amber-500/30 active:bg-amber-500/25'
                    : isHighlighted
                    ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300 active:bg-amber-500/25'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-amber-500/10 hover:text-slate-900 dark:hover:text-white active:bg-amber-500/25'
                } ${optionClassName}`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon && (
                    <span className={`shrink-0 ${isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 group-hover:text-amber-500 dark:group-hover:text-amber-400'}`}>
                      {opt.icon}
                    </span>
                  )}
                  <div className="flex flex-col text-right truncate">
                    <span className="truncate">{opt.label}</span>
                    {opt.description && (
                      <span className={`text-[10px] font-normal leading-tight truncate ${isSelected ? 'text-amber-800 dark:text-slate-300' : 'text-slate-500 dark:text-slate-300'}`}>
                        {opt.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <Check data-check-icon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 font-black stroke-[2.5]" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      dir={dir}
    >
      {/* Hidden input for form submission & required validation */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={currentValue}
          required={required}
        />
      )}

      {/* Label */}
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label} {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 rounded-xl text-right font-semibold transition-all duration-150 cursor-pointer border ${
          sizeClasses[size]
        } ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400'
            : error
            ? 'border-rose-500 bg-white dark:bg-slate-900 text-rose-500 focus:ring-2 focus:ring-rose-500/20'
            : isOpen
            ? 'border-amber-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white ring-2 ring-amber-500/30'
            : 'border-slate-300 dark:border-amber-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:border-slate-400 dark:hover:border-amber-500/40 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          {icon && <span className="text-amber-500 dark:text-amber-400 shrink-0">{icon}</span>}
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              {selectedOption.icon && <span className="shrink-0 text-amber-500 dark:text-amber-400">{selectedOption.icon}</span>}
              <span className="truncate text-slate-900 dark:text-white">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-500/20">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-400 truncate font-normal">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 transition-colors cursor-pointer"
              title="مسح الاختيار"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 dark:text-amber-400/80 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180 text-amber-500 dark:text-amber-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Overlay: Portal outside document flow vs Inline fallback */}
      {isOpen && (
        usePortal && typeof document !== 'undefined'
          ? createPortal(dropdownMenuElement, document.body)
          : dropdownMenuElement
      )}

      {/* Error text */}
      {error && typeof error === 'string' && (
        <p className="text-[11px] text-rose-500 dark:text-rose-400 font-bold flex items-center gap-1 mt-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Helper text */}
      {helperText && !error && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
};

export default CustomSelect;
