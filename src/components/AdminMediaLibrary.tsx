import React, { useState, useEffect, useRef, DragEvent } from 'react';
import { 
  UploadCloud, 
  Search, 
  Grid, 
  Trash2, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Folder, 
  FolderPlus, 
  FolderClosed, 
  Info, 
  Eye, 
  Calendar, 
  FileImage, 
  MoveRight, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Edit2,
  FileCode,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api, { getFriendlyErrorMessage } from '../lib/api.js';
import { MediaItem } from '../types.js';
import { AdminTablePagination } from './AdminTableComponents.js';
import { CustomSelect } from './CustomSelect.js';

interface AdminMediaLibraryProps {
  isPickerMode?: boolean;
  onSelect?: (urls: string[]) => void;
  multiple?: boolean;
  onClose?: () => void;
  activeSubTab?: string;
}

export default function AdminMediaLibrary({
  isPickerMode = false,
  onSelect,
  multiple = false,
  onClose,
  activeSubTab
}: AdminMediaLibraryProps) {
  // State
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number; error?: string }[]>([]);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replacingProgress, setReplacingProgress] = useState<number | null>(null);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, webp, jpeg, png, gif
  const [filterSize, setFilterSize] = useState('all'); // all, small, medium, large
  const [filterUsage, setFilterUsage] = useState('all'); // all, used, unused
  const [activeFolder, setActiveFolder] = useState('all'); // all, recent, or folder name
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest'); // newest, oldest, name, size
  
  // Folders list
  const [folders, setFolders] = useState<string[]>(['المنتجات', 'اللافتات', 'الشعارات']);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  
  // Drag and Drop
  const [dragActive, setDragActive] = useState(false);
  
  // Details sidebar edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Alerts / Feedback
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const sidebarEndRef = useRef<HTMLDivElement>(null);

  // Fetch Media
  const fetchMediaList = async (selectFirst = false) => {
    setLoading(true);
    setGlobalError('');
    try {
      const res = await api.getMedia();
      if (res && res.success) {
        setMedia(res.media);
        
        // Retain selection if they still exist
        const updatedSelected = selectedIds.filter(id => res.media.some(m => m.id === id));
        setSelectedIds(updatedSelected);
        
        // Update active item if selected
        if (activeItem) {
          const updatedActive = res.media.find(m => m.id === activeItem.id) || null;
          setActiveItem(updatedActive);
        } else if (selectFirst && res.media.length > 0) {
          setActiveItem(res.media[0]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load media:', err);
      setGlobalError(getFriendlyErrorMessage(err, 'فشل جلب ملفات الوسائط من الخادم.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMediaList(true);
  }, []);

  // Sync folders from unique tags in media
  useEffect(() => {
    const uniqueFolders = Array.from(new Set(
      media
        .map(m => m.folder)
        .filter((f): f is string => typeof f === 'string' && f !== '')
    ));
    setFolders(prev => {
      const combined = Array.from(new Set([...prev, ...uniqueFolders]));
      return combined;
    });
  }, [media]);

  // Drag and Drop Handlers
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFilesList(Array.from(e.dataTransfer.files));
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFilesList(Array.from(e.target.files));
    }
  };

  // Upload Logic
  const uploadFilesList = async (files: File[]) => {
    setGlobalError('');
    setGlobalSuccess('');
    
    const validFiles: File[] = [];
    const sizeLimit = 5 * 1024 * 1024; // 5MB

    for (const file of files) {
      // Validate type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '');
      
      if (!allowedTypes.includes(file.type) && !isAllowedExt) {
        setGlobalError(`الملف "${file.name}" غير مدعوم. يرجى رفع ملفات صور فقط.`);
        continue;
      }
      
      // Validate size
      if (file.size > sizeLimit) {
        setGlobalError(`حجم الملف "${file.name}" يتجاوز 5 ميجابايت. الحد الأقصى المسموح به هو 5 ميجابايت.`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Add files to upload UI progress
    const fileTrackers = validFiles.map(f => ({ name: f.name, progress: 0 }));
    setUploadingFiles(prev => [...prev, ...fileTrackers]);

    for (const file of validFiles) {
      try {
        const response = await api.uploadMediaItem(file, (percent) => {
          setUploadingFiles(prev =>
            prev.map(t => (t.name === file.name ? { ...t, progress: percent } : t))
          );
        });

        if (response && response.success) {
          // Remove from list or flag green
          setUploadingFiles(prev => prev.filter(t => t.name !== file.name));
          
          // Show duplicate warning if applied
          if (response.isDuplicate) {
            setGlobalSuccess(`تم التعرف على "${file.name}" مسبقاً في مكتبتك (منع التكرار).`);
          } else {
            setGlobalSuccess(`تم رفع الملف "${file.name}" بنجاح وتحويله إلى WebP.`);
          }
          
          // Re-fetch media
          await fetchMediaList();
          
          // Focus new upload
          if (response.media) {
            setActiveItem(response.media);
            // If folder tag matches current active folder, tag it automatically
            if (activeFolder !== 'all' && activeFolder !== 'recent') {
              await api.bulkMoveMediaItems([response.media.id], activeFolder);
              await fetchMediaList();
            }
          }
        }
      } catch (err: any) {
        console.error('File upload failed:', err);
        setUploadingFiles(prev =>
          prev.map(t => (t.name === file.name ? { ...t, progress: 100, error: getFriendlyErrorMessage(err, 'فشل رفع الملف') } : t))
        );
      }
    }
  };

  // Replace logic
  const triggerReplaceSelect = (id: string) => {
    setReplacingId(id);
    replaceInputRef.current?.click();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replacingId || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    // Validate
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedMimeValidate(file, allowedTypes, 5 * 1024 * 1024)) return;

    setReplacingProgress(0);
    setGlobalError('');
    setGlobalSuccess('');

    try {
      const response = await api.replaceMediaItem(replacingId, file, (percent) => {
        setReplacingProgress(percent);
      });

      if (response && response.success) {
        setGlobalSuccess('تم استبدال الصورة بنجاح وتحديث كافة الارتباطات تلقائياً.');
        await fetchMediaList();
        if (response.media) {
          setActiveItem(response.media);
        }
      }
    } catch (err: any) {
      setGlobalError(getFriendlyErrorMessage(err, 'فشل استبدال الملف المختار.'));
    } finally {
      setReplacingId(null);
      setReplacingProgress(null);
    }
  };

  // Helper validation
  const allowedMimeValidate = (file: File, types: string[], max: number): boolean => {
    if (!types.includes(file.type)) {
      setGlobalError('نوع الملف غير مدعوم.');
      return false;
    }
    if (file.size > max) {
      setGlobalError('حجم الملف كبير جداً.');
      return false;
    }
    return true;
  };

  // Rename Title Logic
  const handleRenameSubmit = async () => {
    if (!activeItem || !tempTitle.trim()) return;
    setSaveLoading(true);
    try {
      const res = await api.renameMediaItem(activeItem.id, tempTitle.trim());
      if (res && res.success) {
        setGlobalSuccess('تم تعديل اسم الملف بنجاح.');
        setEditingTitle(false);
        await fetchMediaList();
        if (res.media) {
          setActiveItem(res.media);
        }
      }
    } catch (err: any) {
      setGlobalError(getFriendlyErrorMessage(err, 'فشل تعديل اسم ملف الوسائط.'));
    } finally {
      setSaveLoading(false);
    }
  };

  // Delete single item
  const handleDeleteItem = async (item: MediaItem) => {
    const usages = item.usedBy || [];
    if (usages.length > 0) {
      setGlobalError(`لا يمكن حذف هذا الملف؛ الصورة مستخدمة في: ${usages.map(u => u.name).join('، ')}`);
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف الصورة "${item.title || item.filename}" نهائياً من الخادم؟`)) {
      return;
    }

    try {
      const res = await api.deleteMediaItem(item.id);
      if (res && res.success) {
        setGlobalSuccess('تم حذف الصورة بنجاح من الخادم.');
        setActiveItem(null);
        await fetchMediaList(true);
      }
    } catch (err: any) {
      setGlobalError(getFriendlyErrorMessage(err, 'فشل حذف الصورة من الخادم.'));
    }
  };

  // Multi select toggler
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = (currentItems: MediaItem[]) => {
    const pageIds = currentItems.map(m => m.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    // Check if any selected items are referenced
    const referencedItems = media.filter(m => selectedIds.includes(m.id) && (m.usedBy && m.usedBy.length > 0));
    if (referencedItems.length > 0) {
      setGlobalError(`لا يمكن حذف الملفات المحددة دفعة واحدة. هناك ملفات مستخدمة في منتجات أو لافتات: \n${referencedItems.map(m => m.title || m.filename).join('، ')}`);
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.length} ملفات محددة نهائياً من الخادم؟`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await api.bulkDeleteMediaItems(selectedIds);
      if (res && res.success) {
        setGlobalSuccess(res.message);
        setSelectedIds([]);
        setActiveItem(null);
        await fetchMediaList(true);
      }
    } catch (err: any) {
      setGlobalError(getFriendlyErrorMessage(err, 'فشل تنفيذ الحذف الجماعي.'));
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMove = async (folder: string) => {
    if (selectedIds.length === 0) return;
    try {
      const res = await api.bulkMoveMediaItems(selectedIds, folder);
      if (res && res.success) {
        setGlobalSuccess(`تم نقل ${selectedIds.length} ملف بنجاح إلى المجلد "${folder || 'عام'}".`);
        setSelectedIds([]);
        await fetchMediaList();
      }
    } catch (err: any) {
      setGlobalError(getFriendlyErrorMessage(err, 'فشل عملية النقل الجماعي.'));
    }
  };

  // Create folder
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    if (folders.includes(newFolderName.trim())) {
      setGlobalError('المجلد موجود بالفعل.');
      return;
    }
    setFolders(prev => [...prev, newFolderName.trim()]);
    setActiveFolder(newFolderName.trim());
    setNewFolderName('');
    setShowNewFolderInput(false);
    setGlobalSuccess('تم إنشاء مجلد تنظيمي جديد.');
  };

  // Copy Image URL Helper
  const handleCopyUrl = (url: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // Confirm picker selection
  const handleConfirmPickerSelection = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!onSelect) return;
    
    if (multiple) {
      const selectedUrls = media
        .filter(m => selectedIds.includes(m.id))
        .map(m => m.url);
      onSelect(selectedUrls);
    } else {
      if (activeItem) {
        onSelect([activeItem.url]);
      }
    }
    if (onClose) onClose();
  };

  // Helper formats
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  // ----------------------------------------------------
  // FILTERING LOGIC
  // ----------------------------------------------------
  const filteredMedia = media.filter(item => {
    // 1. Search Query Match
    const matchSearch = 
      (item.title || '').toLowerCase().includes(search.toLowerCase()) || 
      (item.filename || '').toLowerCase().includes(search.toLowerCase());
    
    if (!matchSearch) return false;

    // 2. Folder Match
    if (activeFolder === 'recent') {
      // Last 24 hours
      const itemTime = new Date(item.uploadDate).getTime();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (itemTime < oneDayAgo) return false;
    } else if (activeFolder !== 'all') {
      if ((item.folder || '') !== activeFolder) return false;
    }

    // 3. MIME Type Match
    if (filterType !== 'all') {
      const ext = item.url.split('.').pop()?.toLowerCase();
      if (filterType === 'webp' && !item.type.includes('webp') && ext !== 'webp') return false;
      if (filterType === 'jpeg' && !item.type.includes('jpeg') && ext !== 'jpg' && ext !== 'jpeg') return false;
      if (filterType === 'png' && !item.type.includes('png') && ext !== 'png') return false;
      if (filterType === 'gif' && !item.type.includes('gif') && ext !== 'gif') return false;
    }

    // 4. File Size Match
    if (filterSize !== 'all') {
      const sizeKB = item.size / 1024;
      if (filterSize === 'small' && sizeKB >= 200) return false; // < 200KB
      if (filterSize === 'medium' && (sizeKB < 200 || sizeKB > 1024)) return false; // 200KB - 1MB
      if (filterSize === 'large' && sizeKB <= 1024) return false; // > 1MB
    }

    // 5. Usage Match
    if (filterUsage !== 'all') {
      const isUsed = item.usedBy && item.usedBy.length > 0;
      if (filterUsage === 'used' && !isUsed) return false;
      if (filterUsage === 'unused' && isUsed) return false;
    }

    return true;
  });

  // Apply Sorting
  const sortedMedia = [...filteredMedia].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
    }
    if (sortBy === 'name') {
      return (a.title || a.filename).localeCompare(b.title || b.filename, 'ar');
    }
    if (sortBy === 'size') {
      return b.size - a.size;
    }
    return 0;
  });

  // Pagination indexing
  const totalItems = sortedMedia.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentItems = sortedMedia.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Automatically reset to page 1 when search, filters, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterType, filterSize, filterUsage, activeFolder, sortBy]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative select-none">
      
      {/* Upper header */}
      <div className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-500 rounded-xl border border-amber-500/20">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">مكتبة ملفات الوسائط</h1>
            <p className="text-[10px] text-slate-600 dark:text-slate-400">إدارة ورفع وتنظيم صور المتجر مع حماية مدمجة من التكرار وضمان الأداء العالي (WebP)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Upload Trigger */}
          <button 
            type="button"
            onClick={triggerFileSelect}
            className="flex items-center gap-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 transition-colors text-slate-950 px-4 py-2.5 rounded-xl cursor-pointer shadow-xs"
          >
            <UploadCloud className="w-4 h-4" />
            <span>رفع ملفات جديدة</span>
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />

          <input 
            type="file" 
            ref={replaceInputRef} 
            onChange={handleReplaceFile} 
            accept="image/*" 
            className="hidden" 
          />

          {isPickerMode && (
            <button 
              type="button"
              onClick={onClose}
              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-slate-950 cursor-pointer shadow-xs"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* Uploading Progress Bars floating alerts */}
      <AnimatePresence>
        {(uploadingFiles.length > 0 || replacingProgress !== null) && (
          <div className="absolute top-18 left-4 right-4 z-50 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xl space-y-3 max-h-48 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
              <span>جاري المعالجة والرفع...</span>
            </h3>
            
            {replacingProgress !== null && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-700 dark:text-slate-300">
                  <span>جاري استبدال الملف المختار...</span>
                  <span>{replacingProgress}%</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${replacingProgress}%` }}></div>
                </div>
              </div>
            )}

            {uploadingFiles.map((up, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-700 dark:text-slate-300">
                  <span className="truncate max-w-[70%]">{up.name}</span>
                  {up.error ? (
                    <span className="text-red-500 font-bold">{up.error}</span>
                  ) : (
                    <span>{up.progress}%</span>
                  )}
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${up.error ? 'bg-red-500' : 'bg-amber-500'}`} 
                    style={{ width: `${up.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Toast Alerts feedback */}
      <AnimatePresence>
        {globalError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="m-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3.5 rounded-xl text-xs flex items-start gap-2.5 shadow-xs"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 whitespace-pre-line">{globalError}</div>
            <button type="button" onClick={() => setGlobalError('')} className="text-[10px] text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 cursor-pointer font-bold">إغلاق</button>
          </motion.div>
        )}
        {globalSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="m-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-3.5 rounded-xl text-xs flex items-center justify-between gap-2.5 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{globalSuccess}</span>
            </div>
            <button type="button" onClick={() => setGlobalSuccess('')} className="text-[10px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 cursor-pointer font-bold">إغلاق</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid content with Sidebar and Items list */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Right Sidebar: Folders List */}
        <div className="w-56 shrink-0 border-l border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950 p-4 flex flex-col gap-6 overflow-y-auto hidden md:flex">
          <div>
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-500" />
              <span>المجلدات التنظيمية</span>
            </h3>
            
            <div className="space-y-1">
              <button 
                type="button"
                onClick={() => setActiveFolder('all')}
                className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer ${activeFolder === 'all' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 font-bold border border-amber-500/20' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
              >
                <div className="flex items-center gap-2">
                  <FolderClosed className="w-3.5 h-3.5" />
                  <span>جميع الملفات</span>
                </div>
                <span className="text-[10px] bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded-md font-mono">{media.length}</span>
              </button>

              <button 
                type="button"
                onClick={() => setActiveFolder('recent')}
                className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer ${activeFolder === 'recent' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 font-bold border border-amber-500/20' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>مرفوعة حديثاً</span>
                </div>
              </button>

              <div className="h-px bg-slate-200 dark:bg-slate-900 my-2"></div>

              {folders.map((folder, i) => {
                const count = media.filter(m => m.folder === folder).length;
                return (
                  <button 
                    key={i}
                    type="button"
                    onClick={() => setActiveFolder(folder)}
                    className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer ${activeFolder === folder ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 font-bold border border-amber-500/20' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                  >
                    <div className="flex items-center gap-2 truncate max-w-[80%]">
                      <Folder className="w-3.5 h-3.5" />
                      <span className="truncate">{folder}</span>
                    </div>
                    <span className="text-[10px] bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded-md font-mono">{count}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Create Folder button inline */}
            <div className="mt-3">
              {showNewFolderInput ? (
                <div className="space-y-2 p-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  <input 
                    type="text" 
                    placeholder="اسم المجلد الجديد..." 
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-800 rounded-lg p-2 focus:outline-none focus:border-amber-500 text-right shadow-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateFolder();
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={handleCreateFolder}
                      className="flex-1 py-1 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-lg cursor-pointer hover:bg-amber-600 shadow-xs"
                    >
                      إضافة
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setShowNewFolderInput(false);
                        setNewFolderName('');
                      }}
                      className="flex-1 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 text-[10px] rounded-lg cursor-pointer hover:text-slate-900 dark:hover:text-slate-200"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button"
                  onClick={() => setShowNewFolderInput(true)}
                  className="w-full flex items-center gap-2 justify-center text-xs text-amber-600 dark:text-amber-500/80 hover:text-amber-700 dark:hover:text-amber-500 bg-amber-50 dark:bg-amber-500/5 hover:bg-amber-100 dark:hover:bg-amber-500/10 border border-dashed border-amber-300 dark:border-amber-500/20 rounded-xl py-2 cursor-pointer transition-colors"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>مجلد تنظيمي جديد</span>
                </button>
              )}
            </div>
          </div>
          
          {/* Quick guide inside sidebar */}
          <div className="mt-auto p-3 bg-slate-100 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-900 space-y-2">
            <h4 className="text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Info className="w-3 h-3 text-amber-500" />
              <span>تحسين تلقائي ذكي</span>
            </h4>
            <p className="text-[9px] text-slate-600 dark:text-slate-400 leading-relaxed">
              عند رفع الصور يتم ضغطها وتحويلها تلقائياً إلى صيغة WebP سريعة التحميل لضمان سرعة فائقة لمتجرك وسيو متصدر.
            </p>
          </div>
        </div>

        {/* Middle Section: Search, Filters, and Media Grid */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 dark:bg-slate-950/20">
          
          {/* Filters Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/80 space-y-3 shrink-0">
            <div className="flex gap-2 items-center flex-wrap md:flex-nowrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="ابحث باسم الصورة أو الملف..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 text-right shadow-xs"
                />
              </div>

              {/* Mobile Folder Selector fallback */}
              <div className="md:hidden w-full sm:w-auto min-w-[140px]">
                <CustomSelect 
                  value={activeFolder}
                  onChange={(val) => setActiveFolder(val)}
                  size="sm"
                  buttonClassName="w-full text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[150px] shadow-lg"
                  options={[
                    { value: 'all', label: 'جميع الملفات' },
                    { value: 'recent', label: 'مرفوعة حديثاً' },
                    ...folders.map((f) => ({ value: f, label: f }))
                  ]}
                />
              </div>

              {/* Sort selector */}
              <div className="w-full sm:w-auto min-w-[130px]">
                <CustomSelect 
                  value={sortBy}
                  onChange={(val) => setSortBy(val as 'newest' | 'oldest' | 'name' | 'size')}
                  size="sm"
                  buttonClassName="w-full text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-300 font-bold focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[140px] shadow-lg"
                  options={[
                    { value: 'newest', label: 'الأحدث أولاً' },
                    { value: 'oldest', label: 'الأقدم أولاً' },
                    { value: 'name', label: 'الاسم أبجدياً' },
                    { value: 'size', label: 'حجم الملف' }
                  ]}
                />
              </div>
            </div>

            {/* Sub filters */}
            <div className="flex gap-2 items-center flex-wrap text-slate-600 dark:text-slate-400 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
              <span>تصفية إضافية:</span>
              
              {/* Type Filter */}
              <div className="min-w-[100px]">
                <CustomSelect 
                  value={filterType}
                  onChange={(val) => setFilterType(val)}
                  size="sm"
                  buttonClassName="text-[10px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2 text-slate-800 dark:text-slate-300 focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[110px] shadow-lg"
                  options={[
                    { value: 'all', label: 'كل الصيغ' },
                    { value: 'webp', label: 'WebP' },
                    { value: 'jpeg', label: 'JPEG / JPG' },
                    { value: 'png', label: 'PNG' },
                    { value: 'gif', label: 'GIF' }
                  ]}
                />
              </div>

              {/* Size Filter */}
              <div className="min-w-[130px]">
                <CustomSelect 
                  value={filterSize}
                  onChange={(val) => setFilterSize(val)}
                  size="sm"
                  buttonClassName="text-[10px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2 text-slate-800 dark:text-slate-300 focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[140px] shadow-lg"
                  options={[
                    { value: 'all', label: 'كل الأحجام' },
                    { value: 'small', label: 'صغير (< 200KB)' },
                    { value: 'medium', label: 'متوسط (200KB - 1MB)' },
                    { value: 'large', label: 'كبير (> 1MB)' }
                  ]}
                />
              </div>

              {/* Usage Filter */}
              <div className="min-w-[150px]">
                <CustomSelect 
                  value={filterUsage}
                  onChange={(val) => setFilterUsage(val)}
                  size="sm"
                  buttonClassName="text-[10px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2 text-slate-800 dark:text-slate-300 focus:border-amber-500 shadow-xs"
                  menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[180px] shadow-lg"
                  options={[
                    { value: 'all', label: 'حالة الاستخدام' },
                    { value: 'used', label: 'مستخدم في المتجر' },
                    { value: 'unused', label: 'غير مستخدم (يمكن حذفه بأمان)' }
                  ]}
                />
              </div>

              {/* Display Counter */}
              <span className="mr-auto text-[10px] text-slate-500 font-bold">تم العثور على {totalItems} عنصر</span>
            </div>
          </div>

          {/* Drag & Drop Canvas Wrapper */}
          <div 
            className="flex-1 overflow-y-auto p-4 min-h-0 relative"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
          >
            {dragActive && (
              <div className="absolute inset-0 bg-amber-500/5 backdrop-blur-xs border-2 border-dashed border-amber-500/40 rounded-xl m-4 flex flex-col items-center justify-center gap-3 z-30 transition-all">
                <UploadCloud className="w-12 h-12 text-amber-500 animate-bounce" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">أفلت الصور هنا لرفعها فوراً</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">الحد الأقصى 5 ميجابايت للملف الواحد</p>
              </div>
            )}

            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="text-xs font-bold">جاري تحميل عناصر مكتبة الوسائط...</span>
              </div>
            ) : currentItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400 py-16 text-center">
                <FileImage className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">لا توجد صور مطابقة لخيارات البحث</h3>
                <p className="text-xs text-slate-500 max-w-sm leading-relaxed">يرجى رفع صور جديدة أو تغيير مرشحات التصفية والمجلدات التنظيمية في القائمة الجانبية.</p>
                <button 
                  type="button"
                  onClick={triggerFileSelect}
                  className="mt-2 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-500 px-4 py-2 rounded-lg border border-amber-500/20 cursor-pointer font-bold"
                >
                  رفع أول ملف الآن
                </button>
              </div>
            ) : (
              /* Grid Layout */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* Select All Checkbox Helper */}
                <div className="col-span-full mb-1 flex items-center justify-between">
                  <button 
                    type="button"
                    onClick={() => handleSelectAllOnPage(currentItems)}
                    className="text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900/30 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Check className="w-3 h-3 text-amber-500" />
                    <span>تحديد / إلغاء تحديد الكل بهذه الصفحة</span>
                  </button>
                </div>

                {currentItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isActive = activeItem?.id === item.id;
                  const isUsed = item.usedBy && item.usedBy.length > 0;
                  
                  return (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setActiveItem(item);
                        setEditingTitle(false);
                        if (isPickerMode && multiple) {
                          setSelectedIds(prev =>
                            prev.includes(item.id) ? prev.filter(x => x !== item.id) : [...prev, item.id]
                          );
                        }
                      }}
                      className={`relative aspect-square bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden border cursor-pointer group transition-all shadow-xs ${isActive ? 'border-amber-500 shadow-md ring-1 ring-amber-500/20' : isSelected ? 'border-amber-500/40' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
                    >
                      {/* Image Thumbnail with lazy loading */}
                      <img 
                        src={item.thumbnailUrl || item.url} 
                        alt={item.title || item.filename}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        referrerPolicy="no-referrer"
                      />

                      {/* Multi select checkbox overlay */}
                      <button 
                        type="button"
                        onClick={(e) => toggleSelect(item.id, e)}
                        className={`absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center border transition-all z-20 cursor-pointer ${isSelected ? 'bg-amber-500 border-amber-500 text-slate-950' : 'bg-white/80 dark:bg-slate-900/60 border-slate-300 dark:border-slate-700 hover:border-amber-500'}`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      {/* Used marker indicator */}
                      {isUsed && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-amber-500 text-[8px] font-bold text-slate-950 rounded-sm z-15 shadow-sm">
                          مستخدم
                        </div>
                      )}

                      {/* Format tag overlay bottom */}
                      <div className="absolute bottom-2 left-2 bg-slate-900/70 backdrop-blur-xs text-[8px] font-mono text-slate-300 px-1 py-0.5 rounded-xs z-10 select-none uppercase">
                        {item.url.split('.').pop() || 'WebP'}
                      </div>

                      {/* Hover Overlay triggers */}
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-10">
                        <div className="p-1.5 bg-slate-900/90 text-slate-200 hover:text-amber-500 hover:scale-110 transition-transform rounded-lg cursor-pointer" title="عرض التفاصيل">
                          <Eye className="w-4 h-4" />
                        </div>
                        <button 
                          type="button"
                          onClick={(e) => handleCopyUrl(item.url, e)}
                          className="p-1.5 bg-slate-900/90 text-slate-200 hover:text-amber-500 hover:scale-110 transition-transform rounded-lg cursor-pointer" 
                          title="نسخ رابط الملف"
                        >
                          {copiedUrl === item.url ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Controls & Pagination */}
          <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 shrink-0">
            <AdminTablePagination
              page={currentPage}
              totalPages={totalPages}
              total={totalItems}
              limit={itemsPerPage}
              onPageChange={(newPage) => setCurrentPage(newPage)}
              onLimitChange={(newLimit) => {
                setItemsPerPage(newLimit);
                setCurrentPage(1);
              }}
              className="mt-0 pt-0 border-t-0"
            />
          </div>
        </div>

        {/* Left Drawer / Sidebar: Active Details Inspector */}
        <div className="w-72 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 flex flex-col min-h-0 shrink-0 hidden lg:flex">
          {activeItem ? (
            <div className="flex-1 flex flex-col min-h-0">
              
              {/* Sidebar Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-200">تفاصيل ومعاينة الملف</span>
                <span className="text-[10px] text-slate-500 font-mono select-all">ID: {activeItem.id.replace('media-', '')}</span>
              </div>

              {/* Scrollable details contents */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                
                {/* Large Preview */}
                <div className="relative aspect-video bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden group">
                  <img 
                    src={activeItem.url} 
                    alt={activeItem.title || activeItem.filename}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <a 
                    href={activeItem.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="absolute bottom-2 left-2 p-1.5 bg-slate-900/95 text-slate-300 hover:text-amber-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="فتح في علامة تبويب جديدة"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* File Title Editing / Rename */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">الاسم المعروض (السيما الفنية)</label>
                    {!editingTitle && (
                      <button 
                        type="button"
                        onClick={() => {
                          setTempTitle(activeItem.title || activeItem.filename);
                          setEditingTitle(true);
                        }}
                        className="text-[10px] text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 flex items-center gap-0.5 cursor-pointer font-bold"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        <span>تعديل</span>
                      </button>
                    )}
                  </div>

                  {editingTitle ? (
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        value={tempTitle}
                        onChange={(e) => setTempTitle(e.target.value)}
                        className="flex-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 shadow-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit();
                        }}
                      />
                      <button 
                        type="button"
                        onClick={handleRenameSubmit}
                        disabled={saveLoading}
                        className="px-2 bg-amber-500 text-slate-950 text-xs rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {saveLoading ? '...' : 'حفظ'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setEditingTitle(false)}
                        className="px-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-900 dark:text-slate-200 font-bold break-all bg-slate-50 dark:bg-slate-900/40 p-2.5 border border-slate-200 dark:border-slate-900 rounded-xl">
                      {activeItem.title || activeItem.filename}
                    </div>
                  )}
                </div>

                {/* Metadata details list */}
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-900 rounded-xl p-3.5 space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-2">المواصفات الفنية</h4>
                  
                  <div className="grid grid-cols-2 gap-y-2.5 text-[10px]">
                    <span className="text-slate-500">حجم الملف</span>
                    <span className="text-slate-800 dark:text-slate-200 text-left font-mono font-bold">{formatBytes(activeItem.size)}</span>
                    
                    <span className="text-slate-500">الأبعاد والقياس</span>
                    <span className="text-slate-800 dark:text-slate-200 text-left font-mono font-bold">
                      {activeItem.dimensions ? `${activeItem.dimensions.width} × ${activeItem.dimensions.height} بكسل` : 'غير متوفر'}
                    </span>
                    
                    <span className="text-slate-500">صيغة الملف</span>
                    <span className="text-slate-800 dark:text-slate-200 text-left font-mono font-bold select-all uppercase">{activeItem.type.split('/').pop() || 'WebP'}</span>

                    <span className="text-slate-500">تاريخ الرفع</span>
                    <span className="text-slate-800 dark:text-slate-200 text-left truncate" title={formatDate(activeItem.uploadDate)}>{formatDate(activeItem.uploadDate)}</span>
                  </div>
                </div>

                {/* Used In References Section */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400">أين تستخدم هذه الصورة؟</h4>
                  {activeItem.usedBy && activeItem.usedBy.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeItem.usedBy.map((usage, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/10 rounded-xl text-[10px]">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <span className="text-slate-600 dark:text-slate-400 font-bold shrink-0">
                            {usage.type === 'product' ? 'منتج:' : usage.type === 'banner' ? 'لافتة ترويجية:' : usage.type === 'settings_logo' ? 'الشعار:' : 'اللافتة الرئيسية:'}
                          </span>
                          <span className="text-slate-900 dark:text-slate-200 truncate font-semibold">{usage.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-xl text-[10px] flex items-center gap-2 font-medium">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>غير مستخدمة حالياً؛ ملف الوسائط آمن للحذف.</span>
                    </div>
                  )}
                </div>

                {/* Actions Inside Inspector Drawer */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button 
                    type="button"
                    onClick={(e) => handleCopyUrl(activeItem.url, e)}
                    className="w-full flex items-center justify-center gap-2 text-xs border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl cursor-pointer shadow-xs font-semibold"
                  >
                    {copiedUrl === activeItem.url ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedUrl === activeItem.url ? 'تم نسخ الرابط!' : 'نسخ رابط الصورة'}</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => triggerReplaceSelect(activeItem.id)}
                    className="w-full flex items-center justify-center gap-2 text-xs border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl cursor-pointer shadow-xs font-semibold"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>استبدال الصورة بملف جديد</span>
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleDeleteItem(activeItem)}
                    className={`w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl transition-colors font-bold cursor-pointer shadow-xs ${activeItem.usedBy && activeItem.usedBy.length > 0 ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-950' : 'bg-red-50 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-500/10 dark:hover:bg-red-500 dark:text-red-500 dark:hover:text-slate-950 border border-red-200 dark:border-red-500/20'}`}
                    disabled={activeItem.usedBy && activeItem.usedBy.length > 0}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف ملف الوسائط</span>
                  </button>

                  {activeItem.usedBy && activeItem.usedBy.length > 0 && (
                    <p className="text-[9px] text-red-500 dark:text-red-400/80 leading-relaxed text-center font-medium">
                      * يرجى إزالة الصورة من العناصر المرتبطة أولاً قبل حذفها من مكتبة الخادم لمنع كسر الصور المعروضة.
                    </p>
                  )}
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2.5 text-slate-400 dark:text-slate-500 text-center p-6">
              <Info className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <span className="text-xs font-bold">حدد أي ملف وسائط لعرض المواصفات الفنية والارتباطات</span>
            </div>
          )}
        </div>

      </div>

      {/* Floating bulk actions drawer bottom bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-16 sm:bottom-18 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-950 border border-amber-500/40 rounded-2xl p-3 px-5 shadow-2xl flex items-center gap-4 flex-wrap z-40 max-w-[95%] sm:max-w-fit"
          >
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-500/10 px-2 py-1 rounded-lg">
                {selectedIds.length}
              </span>
              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">ملفات محددة</span>
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0"></div>

            {/* Move to folder quick action dropdown */}
            <div className="flex items-center gap-1.5 min-w-[140px]">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline shrink-0 font-medium">نقل إلى:</span>
              <CustomSelect 
                value=""
                onChange={(val) => {
                  if (val) {
                    handleBulkMove(val === '__root__' ? '' : val);
                  }
                }}
                placeholder="اختر مجلد..."
                size="sm"
                buttonClassName="text-[10px] bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 rounded-lg py-1 px-2.5 shadow-xs"
                menuClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 min-w-[150px] shadow-lg"
                options={[
                  { value: '__root__', label: 'عام / بدون مجلد' },
                  ...folders.map((f) => ({ value: f, label: f }))
                ]}
              />
            </div>

            <button 
              type="button"
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-500 hover:text-white dark:hover:text-slate-950 hover:bg-red-600 dark:hover:bg-red-500 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 px-3 py-1.5 rounded-xl cursor-pointer transition-colors font-bold shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف جماعي</span>
            </button>

            {isPickerMode && (
              <>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 shrink-0"></div>
                <button 
                  type="button"
                  onClick={(e) => handleConfirmPickerSelection(e)}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  تأكيد اختيار الصور ({selectedIds.length})
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Picker Selection actions if single selection */}
      {isPickerMode && !multiple && activeItem && (
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2 truncate max-w-[60%]">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">الملف المختار:</span>
            <span className="text-xs text-slate-900 dark:text-slate-200 font-bold truncate">{activeItem.title || activeItem.filename}</span>
          </div>
          <button 
            type="button"
            onClick={(e) => handleConfirmPickerSelection(e)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            تأكيد اختيار الصورة
          </button>
        </div>
      )}

    </div>
  );
}
