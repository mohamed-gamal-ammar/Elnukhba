import React, { useState, useRef, DragEvent } from 'react';
import { UploadCloud, Image as ImageIcon, Trash2, Check, RefreshCw, AlertCircle, Sparkles, LayoutGrid } from 'lucide-react';
import api, { getFriendlyErrorMessage } from '../lib/api.js';
import AdminMediaLibrary from './AdminMediaLibrary.js';

interface ImageUploaderProps {
  label?: string;
  // Single image mode
  value?: string;
  onChange?: (url: string) => void;
  // Multiple images mode
  multiple?: boolean;
  images?: string[];
  mainImage?: string;
  onImagesChange?: (images: string[], mainImage: string) => void;
}

export default function ImageUploader({
  label = 'صورة',
  value,
  onChange,
  multiple = false,
  images = [],
  mainImage = '',
  onImagesChange
}: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [optimizing, setOptimizing] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to optimize image using client-side canvas
  const optimizeImageFile = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      // If it is not a supported image, just resolve the original file and let server reject it
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        return resolve(file);
      }

      setOptimizing(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          // Resize proportionally
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setOptimizing(false);
            return resolve(file);
          }

          // Draw image onto canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Export as optimized WebP or JPEG
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob(
            (blob) => {
              setOptimizing(false);
              if (blob) {
                // Return new optimized File
                const optimizedFile = new File([blob], file.name, {
                  type: outputType,
                  lastModified: Date.now()
                });
                resolve(optimizedFile);
              } else {
                resolve(file);
              }
            },
            outputType,
            0.82 // high optimization compression ratio (quality)
          );
        };
        img.onerror = () => {
          setOptimizing(false);
          resolve(file);
        };
      };
      reader.onerror = () => {
        setOptimizing(false);
        resolve(file);
      };
    });
  };

  // Process and upload a file
  const processAndUploadFile = async (file: File) => {
    setError('');
    
    // 1. File type validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp'].includes(extension || '');
    
    if (!allowedTypes.includes(file.type) && !isAllowedExt) {
      setError('نوع الملف غير صالح. يرجى رفع ملفات بصيغة jpg, jpeg, png, webp فقط.');
      return;
    }

    // 2. File size validation (Max 5 MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      setError('حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 5 ميجابايت.');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // 3. Client-side automatic optimization
      const optimized = await optimizeImageFile(file);

      // 4. Send upload request to the server
      const res = await api.uploadImage(optimized, (percent) => {
        setProgress(percent);
      });

      if (res && res.success && res.url) {
        if (multiple && onImagesChange) {
          // Check for duplicate uploads in the list
          if (images.includes(res.url)) {
            setError('هذه الصورة تم رفعها مسبقاً في هذا المنتج.');
            setUploading(false);
            return;
          }
          const updatedImages = [...images, res.url];
          // When a new image is uploaded, set it directly as the new main image
          const updatedMain = res.url;
          onImagesChange(updatedImages, updatedMain);
        } else if (onChange) {
          onChange(res.url);
        }
      } else {
        setError(getFriendlyErrorMessage((res as any)?.message, 'فشل رفع الصورة على الخادم'));
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err, 'حدث خطأ أثناء محاولة رفع الملف.'));
    } finally {
      setUploading(false);
    }
  };

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
      const file = e.dataTransfer.files[0];
      await processAndUploadFile(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await processAndUploadFile(file);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Delete a specific image
  const handleDeleteImage = async (urlToDelete: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذه الصورة نهائياً؟')) {
      return;
    }
    try {
      await api.deleteImage(urlToDelete);
      
      if (multiple && onImagesChange) {
        const updatedImages = images.filter(url => url !== urlToDelete);
        let updatedMain = mainImage;
        if (mainImage === urlToDelete) {
          updatedMain = updatedImages[0] || '';
        }
        onImagesChange(updatedImages, updatedMain);
      } else if (onChange) {
        onChange('');
      }
    } catch (err: any) {
      // Even if deleting physical file fails, remove from UI state
      if (multiple && onImagesChange) {
        const updatedImages = images.filter(url => url !== urlToDelete);
        let updatedMain = mainImage;
        if (mainImage === urlToDelete) {
          updatedMain = updatedImages[0] || '';
        }
        onImagesChange(updatedImages, updatedMain);
      } else if (onChange) {
        onChange('');
      }
    }
  };

  // Set image as main
  const handleSetMain = (url: string) => {
    if (multiple && onImagesChange) {
      onImagesChange(images, url);
    }
  };

  return (
    <div className="space-y-3 font-sans text-right" id="custom-image-uploader-container">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-amber-500" />
          {label}
        </label>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPickerModal(true)}
            className="text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
            <span>اختر من مكتبة الوسائط</span>
          </button>

          {multiple && (
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-950/60 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800 flex items-center gap-1">
              <LayoutGrid className="w-3.5 h-3.5 text-amber-500" />
              تعدد الصور متاح ({images.length} مرفوعة)
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-bold animate-in fade-in slide-in-from-top-1">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Multiple images gallery */}
      {multiple && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-amber-500/20 rounded-xl mb-3">
          {images.map((url, index) => {
            const isMain = url === mainImage;
            return (
              <div 
                key={index} 
                className={`relative group rounded-lg overflow-hidden border bg-white dark:bg-slate-900 transition-all aspect-square flex flex-col justify-between ${
                  isMain ? 'border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30' : 'border-slate-200 dark:border-amber-500/20 hover:border-amber-500/40'
                }`}
              >
                <img 
                  src={url} 
                  alt={`Product Image ${index + 1}`} 
                  className="w-full h-full object-cover select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                />

                {/* Main badge */}
                {isMain && (
                  <div className="absolute top-2 right-2 bg-amber-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                    الرئيسية
                  </div>
                )}

                {/* Overlay actions on hover */}
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-center items-center gap-2 p-2">
                  {!isMain && (
                    <button
                      type="button"
                      onClick={() => handleSetMain(url)}
                      className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      تعيين كرئيسية
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(url)}
                    className="w-full py-1.5 px-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    حذف الصورة
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single image preview and replace/delete row */}
      {!multiple && value && (
        <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-amber-500/20 bg-white dark:bg-slate-900 p-3 flex items-center gap-4 transition-all hover:border-amber-500/40">
          <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-amber-500/20">
            <img 
              src={value} 
              alt="Uploaded Preview" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono truncate">{value}</span>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={onButtonClick}
                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-amber-500/20 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
              >
                استبدال الصورة
              </button>
              <button
                type="button"
                onClick={() => handleDeleteImage(value)}
                className="px-3 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 font-bold text-[10px] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف الصورة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dropzone container */}
      {(!multiple && !value) || (multiple) ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] ${
            dragActive 
              ? 'border-amber-500 bg-amber-500/10 shadow-inner' 
              : 'border-amber-500/30 bg-slate-50 dark:bg-slate-900 hover:border-amber-500/60 hover:bg-amber-500/5'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
          />

          {uploading ? (
            <div className="space-y-3 w-full max-w-[240px] mx-auto">
              <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-500 text-xs font-bold animate-pulse">
                {optimizing ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-amber-500 dark:text-amber-400" />
                    <span>جارٍ تحسين وضغط الصورة...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ الرفع للشبكة ({progress}%)</span>
                  </>
                )}
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 flex flex-col items-center">
              <div className="p-3 bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-amber-500/20 rounded-xl text-slate-500 dark:text-slate-400 shadow-xs">
                <UploadCloud className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                  انقر لاختيار ملف من جهازك أو اسحبه وأفلته هنا
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  الامتدادات المقبولة: PNG, JPG, WEBP • الحجم الأقصى: 5 ميجابايت
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Media Library Picker Modal */}
      {showPickerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className="w-full max-w-6xl h-[85vh] bg-white dark:bg-slate-950 border border-slate-200 dark:border-amber-500/20 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-amber-500/10 flex items-center justify-between bg-slate-50 dark:bg-slate-950 shrink-0">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">اختر من مكتبة ملفات الوسائط</span>
              <button
                type="button"
                onClick={() => setShowPickerModal(false)}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-amber-500/20 rounded-xl px-4 py-2 transition-colors cursor-pointer"
              >
                إغلاق المكتبة ✕
              </button>
            </div>
            <div className="flex-1 p-1 overflow-hidden">
              <AdminMediaLibrary
                isPickerMode={true}
                multiple={multiple}
                onClose={() => setShowPickerModal(false)}
                onSelect={(urls) => {
                  if (multiple && onImagesChange) {
                    const updatedImages = Array.from(new Set([...images, ...urls]));
                    const updatedMain = urls[0] || mainImage || updatedImages[0] || '';
                    onImagesChange(updatedImages, updatedMain);
                  } else if (onChange) {
                    onChange(urls[0]);
                  }
                  setShowPickerModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
