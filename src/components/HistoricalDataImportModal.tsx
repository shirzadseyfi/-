import React, {useRef, useState} from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Database,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Award,
  Sparkles,
  Download,
} from 'lucide-react';
import type {CaseRecordView, InstitutionId, UiThemeAccent} from '../types';

interface HistoricalDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseRecordView[];
  activeInstitution: InstitutionId;
  onImportLegacyCases: (importedCases: CaseRecordView[]) => void;
  onExportToast?: (title: string, description: string) => void;
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
}

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

export const HistoricalDataImportModal: React.FC<HistoricalDataImportModalProps> = ({
  isOpen,
  onClose,
  cases,
  activeInstitution,
  onImportLegacyCases,
  onExportToast,
  isDark = false,
  themeAccent = 'teal',
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewCases, setPreviewCases] = useState<CaseRecordView[]>([]);
  const [analysisMode, setAnalysisMode] = useState(false);

  if (!isOpen) return null;

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        'id,fullName,nationalId,blockName,headStatus,scoreTotal,stage,registrationYear',
        'NY-1403-501,زهرا کریمی,0081234567,نایسر - بهاران,زن سرپرست خانوار,72,6,1403',
        'NY-1403-502,علی مرادی,0079876543,نایسر - شهرک قبا,سرپرست ازکارافتاده,65,5,1403',
        'NY-1404-301,مریم عزیزی,0065432109,نایسر - ننله,عادی,48,4,1404',
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'naysar_legacy_cases_sample.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    onExportToast?.('فایل نمونه دانلود شد', 'فایل CSV نمونه مددجویان قبلی جهت ویرایش و بارگذاری دریافت شد.');
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
        // Simple CSV or JSON parser for legacy data
        if (file.name.endsWith('.json') || text.trim().startsWith('{')) {
          const parsed = JSON.parse(text);
          const list = Array.isArray(parsed) ? parsed : parsed.cases;
          if (!Array.isArray(list)) {
            throw new Error('ساختار فایل JSON نامعتبر است.');
          }
          setPreviewCases(list as CaseRecordView[]);
          setImportStatus('success');
          setAnalysisMode(true);
          onExportToast?.('بارگذاری موفق اطلاعات گذشته', `${list.length} پرونده تاریخی بارگذاری و آماده تحلیل شد.`);
        } else {
          // CSV Parser
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) {
            throw new Error('فایل CSV فاقد داده‌های معتبر است.');
          }

          const parsedList: CaseRecordView[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''));
            if (cols.length >= 2) {
              const legacyId = cols[0] || `NY-LEGACY-${1400 + i}`;
              const name = cols[1] || 'مددجوی سابق';
              const block = cols[3] || 'نایسر - هسته مرکزی';
              const score = Number(cols[5]) || 60;
              const stage = (Number(cols[6]) || 5) as any;

              parsedList.push({
                id: legacyId,
                nationalIdHash: 'legacy_hash_' + Math.random().toString(36).substring(7),
                owningInstitution: activeInstitution,
                blockId: 'blk-1',
                blockName: block,
                coverageStatus: stage === 6 ? 'GRADUATED' : 'ACTIVE',
                urgencyTier: score >= 70 ? 'red' : score >= 40 ? 'yellow' : 'green',
                stage,
                servicePath: 'livelihood_medical',
                collaborationModel: 'single_ownership',
                lastSupportDate: '۱۴۰۴/۱۲/۲۸',
                lastSupportType: 'بسته معیشتی و حمایتی گذشته',
                registeredAt: '۱۴۰۳/۰۱/۱۵',
                lastUpdatedAt: '۱۴۰۴/۱۲/۲۸',
                stageEnteredDate: '۱۴۰۴/۱۰/۰۱',
                daysInStage: 45,
                score: {
                  familyStructure: Math.round(score * 0.3),
                  housing: Math.round(score * 0.25),
                  livelihood: Math.round(score * 0.25),
                  health: Math.round(score * 0.2),
                  total: score,
                },
                consentSigned: true,
                isMasked: false,
                fullName: name,
                nationalIdMasked: cols[2] ? `${cols[2].substring(0, 3)}****${cols[2].substring(7)}` : '002****123',
                phone: '0918*******',
                address: block,
                headStatus: cols[4] || 'زن سرپرست خانوار',
                housingType: 'استیجاری با اجاره سنگین',
                householdSize: 4,
              });
            }
          }

          setPreviewCases(parsedList);
          setImportStatus('success');
          setAnalysisMode(true);
          onExportToast?.('بارگذاری موفق اطلاعات گذشته', `${parsedList.length} پرونده تاریخی CSV بارگذاری و آماده تحلیل شد.`);
        }
      } catch (err: unknown) {
        setImportStatus('error');
        setErrorMessage((err as Error)?.message || 'خطا در پردازش فایل وارد شده.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImportAndAnalyze = () => {
    if (previewCases.length === 0) return;
    onImportLegacyCases(previewCases);
    onExportToast?.('ادغام و تحلیل اطلاعات گذشته', `${previewCases.length} پرونده تاریخی با موفقیت به سامانه اضافه شد.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`border rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">ورودی اطلاعات مددجویان قبلی (گذشته)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                بارگذاری سوابق سال‌های گذشته جهت تجزیه و تحلیل دقیق پیش از اجرای طرح مشترک نایسر
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
        <div className="p-6 space-y-6 text-sm">
          {!analysisMode ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
                <div className="flex items-center gap-2 font-bold text-teal-900 dark:text-teal-300 text-xs">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>راهنمای تحلیل تطبیقی داده‌های گذشته</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  با بارگذاری فایل CSV یا JSON حاوی اطلاعات مددجویان سابق سال‌های ۱۴۰۳ و ۱۴۰۴ مؤسسات «دارالاحسان» و «عدالت و برابری»، سامانه پیش از آغاز فاز عملیاتی، روند تغییرات معیشتی، نرخ خروج گذشته و ریسک هم‌پوشانی محلات نایسر را مقایسه می‌کند.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  دانلود فایل نمونه CSV
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv, .json"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  بارگذاری فایل سوابق گذشته (CSV / JSON)
                </button>
              </div>

              {importStatus === 'error' && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>خطا در بارگذاری: {errorMessage}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  پیش‌نمایش داده‌های تاریخی بارگذاری‌شده ({toPersianNum(previewCases.length)} پرونده)
                </h3>
                <button
                  type="button"
                  onClick={() => setAnalysisMode(false)}
                  className="text-xs text-teal-700 dark:text-teal-400 font-semibold hover:underline"
                >
                  انتخاب فایل دیگر
                </button>
              </div>

              {/* Quick Analysis Summary */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500">تعداد کل سوابق</div>
                  <div className="text-lg font-bold mt-1 tabular-nums">{toPersianNum(previewCases.length)} خانوار</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500">میانگین امتیاز نیاز</div>
                  <div className="text-lg font-bold mt-1 tabular-nums text-teal-700 dark:text-teal-400">
                    {toPersianNum(Math.round(previewCases.reduce((s, c) => s + c.score.total, 0) / (previewCases.length || 1)))} / ۱۰۰
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500">آماده تحلیل مشترک</div>
                  <div className="text-lg font-bold mt-1 tabular-nums text-emerald-600">تایید شده</div>
                </div>
              </div>

              {/* Preview table */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                      <th className="py-2.5 px-3">شناسه</th>
                      <th className="py-2.5 px-3">نام سرپرست</th>
                      <th className="py-2.5 px-3">محله / بلوک</th>
                      <th className="py-2.5 px-3">امتیاز نیازمندی</th>
                      <th className="py-2.5 px-3">مرحله</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {previewCases.slice(0, 10).map((c) => (
                      <tr key={c.id}>
                        <td className="py-2 px-3 font-mono tabular-nums">{c.id}</td>
                        <td className="py-2 px-3 font-medium">{c.fullName}</td>
                        <td className="py-2 px-3 text-slate-500">{c.blockName}</td>
                        <td className="py-2 px-3 font-bold tabular-nums text-teal-700 dark:text-teal-300">
                          {toPersianNum(c.score.total)}
                        </td>
                        <td className="py-2 px-3 tabular-nums">مرحله {toPersianNum(c.stage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConfirmImportAndAnalyze}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  <TrendingUp className="w-4 h-4" />
                  ادغام سوابق گذشته و آغاز تحلیل پیش از اجرای طرح مشترک
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <span className="text-xs text-slate-500">تحلیل آماری پیش از اجرای فاز عملیاتی نایسر</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 transition-colors"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
