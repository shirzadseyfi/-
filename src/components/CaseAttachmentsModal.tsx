import React, {useState, useEffect, useRef} from 'react';
import {X, Camera, Upload, Trash2, Eye, FileText, Image as ImageIcon, ShieldCheck} from 'lucide-react';
import type {CaseAttachment, AttachmentCategory, CaseRecordView} from '../types';

interface CaseAttachmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: CaseRecordView | null;
  onExportToast?: (title: string, description: string) => void;
}

const CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  lease: 'اجاره‌نامه / سکونت',
  medical: 'نسخه و پرونده پزشکی',
  identity: 'مدارک شناسایی',
  receipt: 'رسید و فاکتور مالی',
  other: 'سایر مستندات',
};

export const CaseAttachmentsModal: React.FC<CaseAttachmentsModalProps> = ({
  isOpen,
  onClose,
  caseItem,
  onExportToast,
}) => {
  const [attachments, setAttachments] = useState<CaseAttachment[]>([]);
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<AttachmentCategory>('lease');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!caseItem) return;
    try {
      const saved = localStorage.getItem(`naysar_attachments_${caseItem.id}`);
      if (saved) {
        setAttachments(JSON.parse(saved));
      } else {
        // Initial mock attachments if any
        setAttachments([
          {
            id: `att-${caseItem.id}-1`,
            caseId: caseItem.id,
            title: 'قرارداد اجاره‌نامه مسکن نایسر',
            category: 'lease',
            categoryLabel: CATEGORY_LABELS['lease'],
            dataUrl: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80',
            timestamp: '۱۴۰۵/۰۸/۱۰ · ۱۱:۱۵',
            uploaderName: 'سهیلا محمدی',
          },
        ]);
      }
    } catch {
      setAttachments([]);
    }
  }, [caseItem]);

  useEffect(() => {
    if (!caseItem) return;
    try {
      localStorage.setItem(`naysar_attachments_${caseItem.id}`, JSON.stringify(attachments));
    } catch {}
  }, [attachments, caseItem]);

  const handleAddAttachment = (dataUrl: string, customTitle?: string) => {
    if (!caseItem) return;
    const title = (customTitle || titleInput || 'سند ضمیمه جدید').trim();
    const nowStr = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

    const newItem: CaseAttachment = {
      id: `att-${Date.now()}`,
      caseId: caseItem.id,
      title,
      category: categoryInput,
      categoryLabel: CATEGORY_LABELS[categoryInput],
      dataUrl,
      timestamp: nowStr,
      uploaderName: 'مددکار سامانه',
    };

    setAttachments((prev) => [newItem, ...prev]);
    setTitleInput('');
    onExportToast?.('پیوست اضافه شد', `سند «${title}» با موفقیت به پرونده ${caseItem.id} ضمیمه گردید.`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleAddAttachment(dataUrl, file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'environment'}});
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      onExportToast?.('خطا در دسترسی به دوربین', 'امکان راه‌اندازی دوربین دستگاه وجود ندارد. لطفاً از گزینه آپلود تصویر استفاده کنید.');
      setIsCameraActive(false);
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Stop tracks
    const stream = video.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());

    setIsCameraActive(false);
    handleAddAttachment(dataUrl, 'تصویر دوربین سند');
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
    }
    setIsCameraActive(false);
  };

  const handleDeleteAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
    onExportToast?.('پیوست حذف شد', 'سند مورد نظر از پرونده حذف گردید.');
  };

  if (!isOpen || !caseItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                پیوست‌سازی اسناد پرونده ({caseItem.id})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                گرفتن عکس با دوربین دستگاه یا بارگذاری اسناد (اجاره‌نامه، نسخه پزشکی، کارت ملی)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنل پیوست"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300">
          {/* Camera active modal view */}
          {isCameraActive ? (
            <div className="space-y-4 bg-slate-950 p-4 rounded-2xl text-center text-white">
              <div className="relative aspect-video rounded-xl overflow-hidden bg-black max-w-lg mx-auto">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={captureSnapshot}
                  className="px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm inline-flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  ثبت عکس سند
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm"
                >
                  انصراف
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  عنوان سند یا مدرک
                </label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="مثلاً: اجاره‌نامه منزل مسکونی نایسر"
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  دسته‌بندی سند
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value as AttachmentCategory)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3 flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  گرفتن عکس با دوربین دستگاه
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  بارگذاری تصویر از گالری...
                </button>

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  فرمت‌های قابل قبول: JPG, PNG, WebP (حداکثر ۱۰ مگابایت)
                </div>
              </div>
            </div>
          )}

          {/* Attachments List */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
              اسناد پیوست‌شده ({attachments.length})
            </h3>

            {attachments.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                هنوز هیچ مدرکی به این پرونده پیوست نشده است. از دکمه دوربین یا بارگذاری استفاده کنید.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer" onClick={() => setPreviewImage(att.dataUrl)}>
                        <img src={att.dataUrl} alt={att.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {att.title}
                        </div>
                        <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                          {att.categoryLabel}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {att.timestamp} · {att.uploaderName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewImage(att.dataUrl)}
                        title="مشاهده تصویر"
                        aria-label="مشاهده تصویر پیوست"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(att.id)}
                        title="حذف پیوست"
                        aria-label="حذف پیوست"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>ذخیره‌سازی امن محلی در حافظه مرورگر دستگاه</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors"
          >
            تایید و بستن
          </button>
        </div>
      </div>

      {/* Image Zoom Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="پیش‌نمایش سند" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" />
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              aria-label="بستن پیش‌نمایش"
              className="absolute -top-4 -left-4 p-2 rounded-full bg-white text-slate-900 shadow-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
