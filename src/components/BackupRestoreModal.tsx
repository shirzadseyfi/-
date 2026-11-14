import React, {useRef, useState} from 'react';
import {X, Download, Upload, Database, CheckCircle2, AlertCircle} from 'lucide-react';
import type {CaseRecordView, NaysarBlock} from '../types';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseRecordView[];
  blocks: NaysarBlock[];
  onRestoreData: (importedData: {cases: CaseRecordView[]; blocks: NaysarBlock[]}) => void;
  onExportToast?: (title: string, description: string) => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  cases,
  blocks,
  onRestoreData,
  onExportToast,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number>(0);

  if (!isOpen) return null;

  const handleExportBackup = () => {
    try {
      const backupPayload = {
        version: '1.405',
        exportedAt: new Date().toISOString(),
        systemName: 'سامانه مدیریت مورد نایسر (دارالاحسان و عدالت)',
        cases,
        blocks,
        quickNotesMap: (() => {
          try {
            return JSON.parse(localStorage.getItem('naysar_quick_notes_map') || '{}');
          } catch {
            return {};
          }
        })(),
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      const dateStr = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()).replace(/\//g, '-');
      downloadAnchor.setAttribute('download', `naysar_system_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      onExportToast?.('فایل پشتیبان ذخیره شد', `فایل بکاپ حاوی ${cases.length} پرونده با موفقیت دانلود شد.`);
    } catch {
      onExportToast?.('خطا در پشتیبان‌گیری', 'امکان ایجاد فایل پشتیبان فراهم نشد.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('idle');
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed || !Array.isArray(parsed.cases)) {
          throw new Error('ساختار فایل پشتیبان نامعتبر است یا فاقد جدول پرونده‌هاست.');
        }

        const restoredCases = parsed.cases as CaseRecordView[];
        const restoredBlocks = Array.isArray(parsed.blocks) ? (parsed.blocks as NaysarBlock[]) : blocks;

        if (parsed.quickNotesMap) {
          try {
            localStorage.setItem('naysar_quick_notes_map', JSON.stringify(parsed.quickNotesMap));
          } catch {}
        }

        onRestoreData({cases: restoredCases, blocks: restoredBlocks});
        setImportedCount(restoredCases.length);
        setImportStatus('success');
        onExportToast?.('بازیابی موفق اطلاعات', `فایل پشتیبان از سیستم دیگر با موفقیت بارگذاری شد (${restoredCases.length} پرونده).`);
      } catch (err: unknown) {
        setImportStatus('error');
        setErrorMessage((err as Error)?.message || 'خطا در پردازش فایل JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                پشتیبان‌گیری و بازیابی اطلاعات سامانه
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                دریافت فایل پشتیبان امن یا بارگذاری داده‌ها از سیستم دیگر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 text-sm text-slate-700 dark:text-slate-300">
          {/* Export Section */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <Download className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>دریافت فایل پشتیبان (Export Backup)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              تمامی پرونده‌ها، یادداشت‌های سریع، بلوک‌بندی‌ها و سوابق سامانه را در قالب یک فایل استاندارد JSON دانلود کنید تا در صورت نیاز روی سیستم دیگر استفاده نمایید.
            </p>
            <button
              type="button"
              onClick={handleExportBackup}
              className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              دانلود فایل پشتیبان ({cases.length} پرونده)
            </button>
          </div>

          {/* Import Section */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <Upload className="w-4 h-4 text-teal-700 dark:text-teal-400" />
              <span>بارگذاری فایل پشتیبان از سیستم دیگر (Import Restore)</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              فایل پشتیبان JSON دریافت‌شده از سیستم دیگر را انتخاب کنید تا اطلاعات پرونده‌ها و یادداشت‌ها در این سامانه بارگذاری و جایگزین شود.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              انتخاب و بارگذاری فایل JSON...
            </button>

            {importStatus === 'success' && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>اطلاعات با موفقیت بازیابی شد! ({importedCount} پرونده بارگذاری شد)</span>
              </div>
            )}

            {importStatus === 'error' && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>خطا در بازیابی: {errorMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            امنیت داده‌ها با فرمت استاندارد JSON
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 transition-colors"
          >
            بستن پنجره
          </button>
        </div>
      </div>
    </div>
  );
};
