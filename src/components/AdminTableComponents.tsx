import React from 'react';
import { Search, Filter, ChevronRight, ChevronLeft, X, LucideIcon } from 'lucide-react';
import { AdminSkeleton, AdminEmptyState } from './AdminUIComponents.js';
import { CustomSelect } from './CustomSelect.js';

// Table Column Interface
export interface AdminTableColumn<T> {
  key: string;
  header: string | React.ReactNode;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

// Search Input Component
export interface AdminSearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const AdminSearchInput: React.FC<AdminSearchInputProps> = React.memo(({
  value,
  onChange,
  placeholder = 'بحث بالكلمة المفتاحية...',
  className = ''
}) => {
  return (
    <div className={`relative w-full sm:w-auto sm:min-w-[220px] ${className}`}>
      <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pr-10 pl-8 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-xs"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="مسح البحث"
          className="absolute left-2.5 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer min-w-[24px] min-h-[24px] flex items-center justify-center"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

// Filter Button Component
export interface AdminFilterButtonProps {
  onClick?: () => void;
  active?: boolean;
  label?: string;
  className?: string;
}

export const AdminFilterButton: React.FC<AdminFilterButtonProps> = React.memo(({
  onClick,
  active = false,
  label = 'فلترة',
  className = ''
}) => {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
        active
          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40'
          : 'bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 shadow-xs'
      } ${className}`}
    >
      <Filter className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
});

// Table Toolbar Component
export interface AdminTableToolbarProps {
  searchSlot?: React.ReactNode;
  filterSlot?: React.ReactNode;
  bulkActionSlot?: React.ReactNode;
  extraSlot?: React.ReactNode;
  className?: string;
}

export const AdminTableToolbar: React.FC<AdminTableToolbarProps> = ({
  searchSlot,
  filterSlot,
  bulkActionSlot,
  extraSlot,
  className = ''
}) => {
  return (
    <div className={`bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 mb-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs ${className}`}>
      <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
        {searchSlot}
        {filterSlot}
        {bulkActionSlot}
      </div>
      {extraSlot && (
        <div className="flex items-center gap-2 shrink-0">
          {extraSlot}
        </div>
      )}
    </div>
  );
};

// Table Pagination Component
export interface AdminTablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  onLimitChange?: (newLimit: number) => void;
  className?: string;
}

export const AdminTablePagination: React.FC<AdminTablePaginationProps> = React.memo(({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  className = ''
}) => {
  if (total <= 0) return null;

  const startItem = limit ? (page - 1) * limit + 1 : 1;
  const endItem = limit ? Math.min(page * limit, total) : total;

  return (
    <div className={`mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400 ${className}`}>
      <div>
        عرض <strong className="text-slate-900 dark:text-white">{startItem}–{endItem}</strong> من إجمالي <strong className="text-amber-600 dark:text-amber-400">{total}</strong> (صفحة <strong className="text-slate-900 dark:text-white">{page}</strong> من <strong className="text-slate-900 dark:text-white">{totalPages || 1}</strong>)
      </div>

      <div className="flex items-center gap-2">
        {onLimitChange && (
          <div className="flex items-center gap-1.5 min-w-[110px]">
            <span className="text-[11px] shrink-0">عدد العناصر:</span>
            <CustomSelect
              value={limit}
              onChange={(val) => onLimitChange(Number(val))}
              size="sm"
              buttonClassName="bg-white dark:bg-slate-900 border-slate-300 dark:border-amber-500/20 text-slate-900 dark:text-white rounded-lg px-2 py-0.5 text-xs font-bold"
              menuClassName="bg-white dark:bg-slate-900 min-w-[70px]"
              options={[
                { value: '10', label: '10' },
                { value: '15', label: '15' },
                { value: '25', label: '25' },
                { value: '50', label: '50' }
              ]}
            />
          </div>
        )}

        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="الصفحة السابقة"
            className="p-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
            title="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="px-2 font-mono text-slate-900 dark:text-white font-bold">{page}</span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="الصفحة التالية"
            className="p-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
            title="الصفحة التالية"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

// Unified Admin Table Component
export interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: React.ReactNode;
  rowKey?: (row: T, index: number) => string;
  stickyHeader?: boolean;
  className?: string;
}

export function AdminTable<T>({
  columns,
  data,
  loading = false,
  emptyTitle = 'لا توجد بيانات متاحة',
  emptyDescription = 'لم نجد أية نتائج مطابقة لمعايير العرض الحالية.',
  emptyIcon,
  emptyAction,
  rowKey,
  stickyHeader = true,
  className = ''
}: AdminTableProps<T>) {
  if (loading) {
    return <AdminSkeleton count={5} height="h-14" />;
  }

  if (!data || data.length === 0) {
    return (
      <AdminEmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm animate-in fade-in-50 duration-200 ${className}`}>
      <table className="w-full text-right text-xs text-slate-800 dark:text-slate-200 border-collapse">
        <thead className={`bg-slate-50 dark:bg-slate-950/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 ${stickyHeader ? 'sticky top-0 z-10 backdrop-blur-md' : ''}`}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`p-3.5 whitespace-nowrap text-right font-bold text-slate-700 dark:text-slate-300 ${col.headerClassName || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
          {data.map((row, index) => {
            const key = rowKey ? rowKey(row, index) : ((row as any).id || index.toString());
            return (
              <tr
                key={key}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors duration-150 group"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`p-3.5 align-middle ${col.className || ''}`}>
                    {col.render ? col.render(row, index) : (row as any)[col.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
