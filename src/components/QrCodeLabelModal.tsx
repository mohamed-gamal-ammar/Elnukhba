import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Copy, Check, QrCode, RefreshCw, Tag, Box, MapPin } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../lib/api.js';

interface QrCodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  sku: string;
  price: number;
  qrCodeValue: string;
  barcodeValue?: string;
  location?: string;
  productId: string;
  variantId?: string;
  variantInfo?: string;
  onQrUpdated?: (newQr: string) => void;
}

export const QrCodeLabelModal: React.FC<QrCodeLabelModalProps> = ({
  isOpen,
  onClose,
  title,
  sku,
  price,
  qrCodeValue,
  barcodeValue,
  location = 'المستودع الرئيسي',
  productId,
  variantId,
  variantInfo,
  onQrUpdated
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [labelQuantity, setLabelQuantity] = useState<number>(1);
  const [currentQr, setCurrentQr] = useState(qrCodeValue);

  useEffect(() => {
    setCurrentQr(qrCodeValue);
  }, [qrCodeValue]);

  useEffect(() => {
    if (currentQr) {
      QRCode.toDataURL(currentQr, {
        width: 300,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Error generating QR data URL', err));
    }
  }, [currentQr]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentQr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const res = await api.generateQrCode(productId, variantId);
      if (res && res.qrCode) {
        setCurrentQr(res.qrCode);
        if (onQrUpdated) onQrUpdated(res.qrCode);
      }
    } catch (err) {
      console.error('Failed to regenerate QR code', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-${sku || productId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const labelsHtml = Array.from({ length: labelQuantity }).map(() => `
      <div class="label-box">
        <div class="header">
          <div class="brand">STORE WAREHOUSE</div>
          <div class="location">${location}</div>
        </div>
        <div class="title">${title} ${variantInfo ? `<span class="variant">(${variantInfo})</span>` : ''}</div>
        <div class="middle">
          <img src="${qrDataUrl}" class="qr-img" />
          <div class="details">
            <div class="sku">SKU: ${sku}</div>
            ${barcodeValue ? `<div class="barcode">BC: ${barcodeValue}</div>` : ''}
            <div class="price">${price.toLocaleString('ar-EG')} ج.م</div>
            <div class="qr-code-text">${currentQr}</div>
          </div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>طباعة ملصقات QR - ${sku}</title>
        <style>
          @page {
            size: auto;
            margin: 5mm;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 10px;
            background: #fff;
            color: #000;
          }
          .labels-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .label-box {
            border: 2px solid #000;
            border-radius: 8px;
            padding: 8px;
            box-sizing: border-box;
            page-break-inside: avoid;
            background: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            font-weight: bold;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
            margin-bottom: 5px;
          }
          .title {
            font-size: 11px;
            font-weight: bold;
            line-height: 1.2;
            margin-bottom: 6px;
            height: 26px;
            overflow: hidden;
          }
          .variant {
            color: #444;
          }
          .middle {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .qr-img {
            width: 70px;
            height: 70px;
          }
          .details {
            font-size: 10px;
            line-height: 1.4;
          }
          .sku {
            font-family: monospace;
            font-weight: bold;
          }
          .barcode {
            font-family: monospace;
            font-size: 9px;
            color: #333;
          }
          .price {
            font-size: 13px;
            font-weight: 900;
            margin-top: 2px;
          }
          .qr-code-text {
            font-family: monospace;
            font-size: 8px;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="labels-grid">
          ${labelsHtml}
        </div>
        <script>
          setTimeout(() => {
            window.print();
            window.close();
          }, 300);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 text-slate-900 dark:text-white">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">بطاقة رمز QR للمنتج</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">توليد وطباعة ملصقات الرمز للمستودع</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product preview & QR Visual */}
        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center">
          {qrDataUrl ? (
            <div className="bg-white p-2.5 rounded-xl shadow-xs shrink-0 border border-slate-200">
              <img src={qrDataUrl} alt="QR Code" className="w-32 h-32 object-contain" />
            </div>
          ) : (
            <div className="w-32 h-32 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 text-xs">
              جارٍ التحميل...
            </div>
          )}

          <div className="space-y-1.5 text-xs flex-1 w-full">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2">{title}</h4>
            {variantInfo && (
              <span className="inline-block bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                {variantInfo}
              </span>
            )}

            <div className="space-y-1 pt-1 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>SKU: {sku}</span>
              </div>
              {barcodeValue && (
                <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400/90">
                  <Box className="w-3.5 h-3.5" />
                  <span>باركود: {barcodeValue}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>الموقع: {location}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-200 dark:border-slate-800/80">
              <span className="text-amber-600 dark:text-amber-500 font-black text-sm">{price.toLocaleString('ar-EG')} ج.م</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                {currentQr}
              </span>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>عدد الملصقات للطباعة:</span>
            <div className="flex items-center gap-2">
              {[1, 2, 4, 8, 12].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setLabelQuantity(num)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${labelQuantity === num ? 'bg-amber-500 text-slate-950 font-black shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'تم النسخ!' : 'نسخ الرمز'}</span>
            </button>

            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 border border-slate-200 dark:border-slate-700 shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              <span>توليد جديد</span>
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>تحميل PNG</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 dark:hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ({labelQuantity})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
