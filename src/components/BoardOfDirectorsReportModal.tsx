import React, {useState} from 'react';
import {X, Printer, FileText, ShieldCheck, Download, Calendar, Award} from 'lucide-react';
import type {InstitutionId, CaseRecordView} from '../types';
import {InstitutionEmblem} from './InstitutionalLogo';

interface BoardReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeInstitution: InstitutionId | 'all';
  cases: CaseRecordView[];
  preparedBy?: string;
  generatedAt?: string;
  onExportToast?: (title: string, description: string) => void;
}

type ReportPeriod = 'monthly' | 'quarterly' | 'yearly';

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

export const BoardOfDirectorsReportModal: React.FC<BoardReportModalProps> = ({
  isOpen,
  onClose,
  activeInstitution,
  cases,
  preparedBy = 'مدیر اجرایی سامانه',
  generatedAt = '۱۴۰۵/۰۸/۲۲',
  onExportToast,
}) => {
  const [period, setPeriod] = useState<ReportPeriod>('quarterly');
  const [selectedInst, setSelectedInst] = useState<InstitutionId | 'all'>(activeInstitution);

  if (!isOpen) return null;

  const filteredCases = cases.filter((c) => {
    if (selectedInst !== 'all' && c.owningInstitution !== selectedInst) return false;
    return true;
  });

  const periodLabel =
    period === 'monthly' ? 'گزارش عملکرد ماهانه (آبان ۱۴۰۵)' : period === 'quarterly' ? 'گزارش عملکرد فصلی (پاییز ۱۴۰۵)' : 'گزارش عملکرد سالیانه (۱۴۰۵)';

  const institutionName =
    selectedInst === 'darolahsan'
      ? 'مؤسسه خیریه دارالاحسان سنندج'
      : selectedInst === 'edalat'
        ? 'مؤسسه خیریه عدالت و برابری کردستان'
        : 'ناحیه منفصل شهری نایسر (عملکرد مشترک دو مؤسسه)';

  const totalActive = filteredCases.length;
  const graduatedCount = filteredCases.filter((c) => c.stage === 6 || c.coverageStatus === 'GRADUATED').length;
  const redTierCount = filteredCases.filter((c) => c.urgencyTier === 'red').length;
  const stage5Count = filteredCases.filter((c) => c.stage === 5).length;
  const stage4Count = filteredCases.filter((c) => c.stage === 4).length;

  const handlePrint = () => {
    window.print();
    onExportToast?.('چاپ گزارش هیئت مدیره', 'گزارش رسمی جهت ارائه به هیئت مدیره آماده چاپ شد.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                گزارش رسمی عملکرد واحد حمایتی برای هیئت مدیره
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                تنظیم شده بر اساس روند اجرایی مراحل شش‌گانه مدیریت مورد
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / PDF گزارش</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن گزارش"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar selectors */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">دوره گزارش:</span>
            {(
              [
                {id: 'monthly', label: 'ماهانه'},
                {id: 'quarterly', label: 'فصلی'},
                {id: 'yearly', label: 'سالیانه'},
              ] as {id: ReportPeriod; label: string}[]
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  period === p.id
                    ? 'bg-slate-900 dark:bg-teal-700 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">مؤسسه:</span>
            <select
              value={selectedInst}
              onChange={(e) => setSelectedInst(e.target.value as InstitutionId | 'all')}
              className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              <option value="all">هر دو مؤسسه (ناحیه نایسر)</option>
              <option value="darolahsan">مؤسسه خیریه دارالاحسان سنندج</option>
              <option value="edalat">مؤسسه خیریه عدالت و برابری کردستان</option>
            </select>
          </div>
        </div>

        {/* Printable Report Body */}
        <div className="p-8 overflow-y-auto space-y-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm leading-relaxed">
          {/* Header Emblems for Board */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 dark:border-slate-100 pb-6">
            <div className="flex items-center gap-3">
              {selectedInst !== 'edalat' && <InstitutionEmblem institution="darolahsan" size="md" />}
              {selectedInst !== 'darolahsan' && <InstitutionEmblem institution="edalat" size="md" />}
              <div>
                <h1 className="text-xl font-bold">گزارش رسمی عملکرد هیئت مدیره</h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {institutionName} · سامانه جامع مدیریت مورد و هم‌افزایی
                </p>
              </div>
            </div>
            <div className="text-left text-xs space-y-1 font-mono text-slate-600 dark:text-slate-400 tabular-nums">
              <div>{periodLabel}</div>
              <div>تاریخ تهیه: {generatedAt}</div>
              <div>مسئول گزارش: {preparedBy}</div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              خلاصه اجرایی مدیریت کلان (Executive Summary)
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              در بازه زمانی مورد گزارش، واحد حمایتی موفق شد با استقرار پروتکل ۶ مرحله‌ای و جلوگیری از موازی‌کاری، جریان خدمات‌رسانی به خانوارهای محروم ناحیه نایسر را بهینه‌سازی کند. مجموعاً <strong className="tabular-nums">{toPersianNum(totalActive)}</strong> پرونده فعال تحت پوشش بوده و <strong className="tabular-nums">{toPersianNum(graduatedCount)}</strong> خانوار به مرحله خوداتکایی پایدار (خروج موفق) نائل شده‌اند.
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center space-y-1">
              <div className="text-xs text-slate-500">پرونده‌های فعال تحت پوشش</div>
              <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {toPersianNum(totalActive)}
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center space-y-1">
              <div className="text-xs text-slate-500">خروجی‌های موفق (خوداتکایی)</div>
              <div className="text-2xl font-bold font-mono text-teal-700 dark:text-teal-400 tabular-nums">
                {toPersianNum(graduatedCount)}
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center space-y-1">
              <div className="text-xs text-slate-500">پرونده‌های بحرانی (درجه قرمز)</div>
              <div className="text-2xl font-bold font-mono text-red-700 dark:text-red-400 tabular-nums">
                {toPersianNum(redTierCount)}
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center space-y-1">
              <div className="text-xs text-slate-500">پایش مستمر (مرحله ۵)</div>
              <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 tabular-nums">
                {toPersianNum(stage5Count)}
              </div>
            </div>
          </div>

          {/* Operational Workflow Analysis */}
          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
              تحلیل روند اجرایی مراحل شش‌گانه
            </h3>
            <div className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span>مرحله ۱ و ۲ (پذیرش و ارزیابی میدانی):</span>
                <span className="font-semibold tabular-nums">ثبت دقیق و اعتبارسنجی ۱۰۰٪ کدملی با هش SHA-256</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span>مرحله ۳ و ۴ (برنامه مداخله و اجرای خدمات):</span>
                <span className="font-semibold tabular-nums">{toPersianNum(stage4Count)} پرونده در صف توزیع خدمات حمایتی</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span>مرحله ۵ و ۶ (پایش مستمر و خروج موفق):</span>
                <span className="font-semibold tabular-nums">{toPersianNum(stage5Count)} خانوار تحت پایش مستمر درآمدی</span>
              </div>
            </div>
          </div>

          {/* Signatures for Board */}
          <div className="grid grid-cols-2 gap-8 pt-10 border-t border-slate-200 dark:border-slate-800 text-xs text-center">
            <div className="space-y-12">
              <div className="font-bold">رئیس هیئت مدیره / مدیرعامل</div>
              <div className="border-t border-slate-300 dark:border-slate-700 pt-2 text-slate-500">امضا و مهر مؤسسه</div>
            </div>
            <div className="space-y-12">
              <div className="font-bold">مسئول واحد حمایتی و مددکاری</div>
              <div className="border-t border-slate-300 dark:border-slate-700 pt-2 text-slate-500">امضا و تاریخ</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between print:hidden">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            گزارش رسمی مصوب هیئت مدیره نایسر
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 transition-colors"
          >
            بستن گزارش
          </button>
        </div>
      </div>
    </div>
  );
};
