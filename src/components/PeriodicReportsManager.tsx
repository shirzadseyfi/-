import React, {useState, useEffect} from 'react';
import {Bell, FileText, Download, CheckCircle2, Clock, Calendar, Sparkles} from 'lucide-react';
import type {InstitutionId, UiThemeAccent} from '../types';

interface PeriodicReportNotification {
  id: string;
  title: string;
  periodLabel: string;
  institutionLabel: string;
  generatedAt: string;
  status: 'ready' | 'processing';
  summaryText: string;
}

interface PeriodicReportsManagerProps {
  activeInstitution: InstitutionId | 'all';
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
  onPushNotification?: (reportTitle: string) => void;
}

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

export const PeriodicReportsManager: React.FC<PeriodicReportsManagerProps> = ({
  activeInstitution,
  isDark: _isDark,
  themeAccent: _themeAccent = 'teal',
  onExportToast,
  onPushNotification,
}) => {
  const [reportType, setReportType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [scopeInst, setScopeInst] = useState<InstitutionId | 'all'>(activeInstitution);
  const [generatedReports, setGeneratedReports] = useState<PeriodicReportNotification[]>(() => {
    try {
      const saved = localStorage.getItem('naysar_periodic_reports_box');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'pr-1',
        title: 'گزارش عملکرد ماهانه واحد حمایتی',
        periodLabel: 'مهر ۱۴۰۵',
        institutionLabel: 'ناحیه نایسر (مشترک)',
        generatedAt: '۱۴۰۵/۰۸/۰۱ · ۰۹:۳۰',
        status: 'ready',
        summaryText: 'تعداد کل پرونده‌های فعال: ۱۱۴ مورد، خروجی‌های موفق: ۲۱ خانواده.',
      },
      {
        id: 'pr-2',
        title: 'گزارش عملکرد فصلی واحد حمایتی',
        periodLabel: 'تابستان ۱۴۰۵',
        institutionLabel: 'مؤسسه دارالاحسان سنندج',
        generatedAt: '۱۴۰۵/۰۷/۰۱ · ۱۰:۱۵',
        status: 'ready',
        summaryText: 'مجموع خدمات ارائه‌شده معیشتی و درمانی: ۴۲۰ مورد.',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('naysar_periodic_reports_box', JSON.stringify(generatedReports));
    } catch {}
  }, [generatedReports]);

  const handleGenerateReport = () => {
    const typeLabel = reportType === 'monthly' ? 'ماهانه' : reportType === 'quarterly' ? 'فصلی' : 'سالیانه';
    const instName = scopeInst === 'darolahsan' ? 'دارالاحسان' : scopeInst === 'edalat' ? 'عدالت' : 'ناحیه نایسر';
    const nowStr = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

    const newReport: PeriodicReportNotification = {
      id: `pr-${Date.now()}`,
      title: `گزارش عملکرد ${typeLabel} واحد حمایتی`,
      periodLabel: reportType === 'monthly' ? 'آبان ۱۴۰۵' : reportType === 'quarterly' ? 'پاییز ۱۴۰۵' : 'سال ۱۴۰۵',
      institutionLabel: instName,
      generatedAt: nowStr,
      status: 'ready',
      summaryText: `گزارش ${typeLabel} واحد حمایتی آماده دریافت PDF و بررسی هیئت مدیره است.`,
    };

    setGeneratedReports((prev) => [newReport, ...prev]);
    onExportToast?.('گزارش دوره‌ای آماده شد', `گزارش ${typeLabel} با موفقیت تولید و به بخش اعلان‌ها ارسال شد.`);
    onPushNotification?.(newReport.title);
  };

  const handleDownloadPdfMock = (reportTitle: string) => {
    onExportToast?.('دانلود PDF', `فایل PDF گزارش «${reportTitle}» بارگیری شد.`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tabular-nums">
              مرکز اعلان‌ها و گزارش‌های دوره‌ای
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              تولید خودکار و ارسال به بخش اعلان‌های سامانه
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            گزارش‌های دوره‌ای عملکرد واحد حمایتی (Periodic Reports & Notifications)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            بازه زمانی دلخواه (ماهانه، فصلی، سالانه) را تنظیم کنید تا سامانه به طور خودکار فایل PDF عملکرد را آماده و در بخش اعلان‌ها قرار دهد.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 rounded-xl px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-300 shrink-0">
          <Bell className="w-4 h-4 shrink-0" />
          <span>گزارش‌های آماده در اعلان‌ها: {toPersianNum(generatedReports.length)} مورد</span>
        </div>
      </div>

      {/* Generator Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            بازه زمانی گزارش
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="monthly">گزارش ماهانه عملکرد</option>
            <option value="quarterly">گزارش فصلی عملکرد</option>
            <option value="yearly">گزارش سالیانه عملکرد</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            مؤسسه / محدوده
          </label>
          <select
            value={scopeInst}
            onChange={(e) => setScopeInst(e.target.value as InstitutionId | 'all')}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="all">ناحیه منفصل شهری نایسر (مشترک)</option>
            <option value="darolahsan">مؤسسه خیریه دارالاحسان</option>
            <option value="edalat">مؤسسه خیریه عدالت و برابری</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={handleGenerateReport}
            className="w-full px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>تولید و ارسال به اعلان‌ها</span>
          </button>
        </div>
      </div>

      {/* Generated Reports Box (Notifications) */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
          صندوق گزارش‌های آماده در بخش اعلان‌ها
        </h3>

        {generatedReports.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
            هیچ گزارشی تولید نشده است.
          </div>
        ) : (
          <div className="space-y-3">
            {generatedReports.map((rep) => (
              <div
                key={rep.id}
                className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {rep.title} ({rep.periodLabel})
                      </span>
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        آماده دانلود PDF
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {rep.summaryText}
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      مؤسسه: {rep.institutionLabel} · زمان تولید: {rep.generatedAt}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdfMock(rep.title)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>دانلود PDF گزارش</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>
            با هر بار تولید گزارش دوره‌ای، یک اعلان فوری در سامانه ثبت می‌شود تا دسترسی سریع به فایل PDF فراهم باشد.
          </span>
        </div>
      </div>
    </div>
  );
};
