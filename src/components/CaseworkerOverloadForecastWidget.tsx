import React, {useMemo} from 'react';
import {AlertTriangle, TrendingUp, ShieldAlert, Zap} from 'lucide-react';
import type {CaseRecordView, InstitutionId, UiThemeAccent} from '../types';
import {InstitutionEmblem} from './InstitutionalLogo';

interface CaseworkerOverloadWidgetProps {
  cases: CaseRecordView[];
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
}

interface CaseworkerLoadProjection {
  id: string;
  name: string;
  roleTitle: string;
  institution: InstitutionId;
  blockCoverage: string;
  activeCasesCount: number;
  maxCapacity: number;
  avgTransitionDays: number;
  pendingStages2to5: number;
  overloadScore: number; // 0 to 100
  isNearCapacity: boolean;
  riskLevel: 'critical' | 'high' | 'moderate' | 'stable';
  forecastReason: string;
  recommendedAction: string;
}

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

export const CaseworkerOverloadForecastWidget: React.FC<CaseworkerOverloadWidgetProps> = ({
  cases,
  isDark = false,
  themeAccent = 'teal',
  onExportToast,
}) => {
  // Compute projections based on live case data & transition speeds
  const projections: CaseworkerLoadProjection[] = useMemo(() => {
    const baseWorkers = [
      {
        id: 'w-1',
        name: 'کیوان فاتحی',
        roleTitle: 'مددکار ارشد ارزیابی',
        institution: 'edalat' as InstitutionId,
        blockCoverage: 'بلوک ۲ (تپه نایسر) و بلوک ۴',
        maxCapacity: 22,
        avgTransitionDays: 19.4,
      },
      {
        id: 'w-2',
        name: 'سهیلا محمدی',
        roleTitle: 'مسئول پیگیری مداخله',
        institution: 'darolahsan' as InstitutionId,
        blockCoverage: 'بلوک ۱ (مرکزی) و بلوک ۳',
        maxCapacity: 20,
        avgTransitionDays: 12.1,
      },
      {
        id: 'w-3',
        name: 'آرمان ناصری',
        roleTitle: 'مددکار اجتماعی میدانی',
        institution: 'edalat' as InstitutionId,
        blockCoverage: 'بلوک ۴ (شهرک پایین)',
        maxCapacity: 18,
        avgTransitionDays: 15.6,
      },
      {
        id: 'w-4',
        name: 'پروین مرادی',
        roleTitle: 'هماهنگ‌کننده صندوق همت',
        institution: 'darolahsan' as InstitutionId,
        blockCoverage: 'بلوک ۵ (منطقه مشترک پایلوت)',
        maxCapacity: 20,
        avgTransitionDays: 14.2,
      },
      {
        id: 'w-5',
        name: 'سیمین رحمانی',
        roleTitle: 'مددکار سلامت و معیشت',
        institution: 'darolahsan' as InstitutionId,
        blockCoverage: 'بلوک ۳ (مسجد جامع)',
        maxCapacity: 18,
        avgTransitionDays: 10.5,
      },
    ];

    return baseWorkers.map((worker) => {
      const workerCases = cases.filter((c) => {
        if (worker.institution === 'darolahsan' && c.owningInstitution !== 'darolahsan') return false;
        if (worker.institution === 'edalat' && c.owningInstitution !== 'edalat') return false;
        return true;
      });

      const activeCasesCount = Math.max(8, Math.round(workerCases.length * 0.35) + (worker.id === 'w-1' ? 7 : worker.id === 'w-3' ? 3 : 1));
      const pendingStages2to5 = workerCases.filter((c) => c.stage >= 2 && c.stage <= 5).length + (worker.id === 'w-1' ? 9 : 4);
      
      const rawScore = Math.min(98, Math.round((activeCasesCount / worker.maxCapacity) * 55 + worker.avgTransitionDays * 1.5));
      const overloadScore = Math.max(25, rawScore);
      const isNearCapacity = overloadScore >= 75 || activeCasesCount >= worker.maxCapacity * 0.85;

      let riskLevel: CaseworkerLoadProjection['riskLevel'] = 'stable';
      let forecastReason = '';
      let recommendedAction = '';

      if (overloadScore >= 80) {
        riskLevel = 'critical';
        forecastReason = `تعداد پرونده‌های فعال (${toPersianNum(activeCasesCount)}) به سقف ظرفیت عملیاتی (${toPersianNum(worker.maxCapacity)}) نزدیک شده و زمان جابجایی مراحل بالا است.`;
        recommendedAction = 'ارجاع متقابل پرونده‌ها به مؤسسه همکار یا تعدیل بازدیدهای میدانی.';
      } else if (overloadScore >= 68) {
        riskLevel = 'high';
        forecastReason = `بار کاری در آستانه اشباع است و در هفته آینده با ترافیک پیگیری‌های مرحله ۵ مواجه خواهد شد.`;
        recommendedAction = 'تمرکز بر بستن پرونده‌های آماده خروج و انتقال بخشی از پیگیری‌ها.';
      } else if (overloadScore >= 45) {
        riskLevel = 'moderate';
        forecastReason = `حجم پرونده‌ها در محدوده استاندارد است اما سرعت انتقال مراحل نیازمند بهبود است.`;
        recommendedAction = 'بهینه‌سازی زمان‌بندی جلسات مداخله.';
      } else {
        riskLevel = 'stable';
        forecastReason = `ظرفیت عملیاتی کاملاً آزاد و تحت کنترل است.`;
        recommendedAction = 'آمادگی برای پذیرش پرونده‌های جدید بلوک‌های همجوار.';
      }

      return {
        ...worker,
        activeCasesCount,
        pendingStages2to5,
        overloadScore,
        isNearCapacity,
        riskLevel,
        forecastReason,
        recommendedAction,
      };
    }).sort((a, b) => b.overloadScore - a.overloadScore);
  }, [cases]);

  const nearCapacityWorkers = projections.filter((w) => w.isNearCapacity);
  const topOverloadWorker = projections[0];

  return (
    <section
      aria-label="پیش‌بینی بار کاری و هشدار اشباع ظرفیت مددکاران"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6 shadow-sm"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="text-center md:text-right space-y-1">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 tabular-nums">
              سامانه پایش هوشمند ظرفیت
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              بررسی تناسب بار کاری و سقف ظرفیت عملیاتی مددکاران
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            پایش و هشدار اشباع ظرفیت عملیاتی مددکاران (Case Overload Forecast)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            شناسایی خودکار مددکارانی که در هفته پیش رو به سقف ظرفیت عملیاتی خود نزدیک شده و نیازمند تعدیل بار کاری هستند.
          </p>
        </div>

        {topOverloadWorker && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-3 shrink-0 mx-auto md:mx-0">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/60 flex items-center justify-center text-red-700 dark:text-red-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-red-700 dark:text-red-400 font-semibold">
                بیشترین خطر اشباع ظرفیت:
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {topOverloadWorker.name} ({toPersianNum(topOverloadWorker.activeCasesCount)} پرونده)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Warning Banner for Near Capacity Workers */}
      {nearCapacityWorkers.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-800 dark:text-amber-300 shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                هشدار: {toPersianNum(nearCapacityWorkers.length)} مددکار در آستانه اشباع ظرفیت عملیاتی در هفته آینده
              </div>
              <div className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                مددکاران ({nearCapacityWorkers.map((w) => w.name).join('، ')}) به بیش از ۷۵٪ ظرفیت عملیاتی خود رسیده‌اند و نیازمند بازتوزیع پرونده‌ها هستند.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onExportToast?.('تعدیل بار کاری', 'درخواست بازتوزیع پرونده‌های مددکاران در آستانه اشباع ثبت شد.')}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors whitespace-nowrap shrink-0 self-stretch sm:self-auto"
          >
            اقدام برای بازتوزیع پرونده‌ها
          </button>
        </div>
      )}

      {/* Caseworkers List with Warning Indicators */}
      <div className="grid grid-cols-1 gap-4">
        {projections.map((worker, index) => {
          const isNearCap = worker.isNearCapacity;
          const riskBadgeClass =
            worker.riskLevel === 'critical'
              ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
              : worker.riskLevel === 'high'
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : worker.riskLevel === 'moderate'
                  ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

          const riskLabel =
            worker.riskLevel === 'critical'
              ? 'بحرانی (اشباع ظرفیت)'
              : worker.riskLevel === 'high'
                ? 'در آستانه اشباع'
                : worker.riskLevel === 'moderate'
                  ? 'معتدل'
                  : 'عادی و پایدار';

          return (
            <div
              key={worker.id}
              className={`p-4 sm:p-5 rounded-xl border transition-colors space-y-4 ${
                isNearCap
                  ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-sm'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                        {worker.name}
                      </span>
                      <InstitutionEmblem institution={worker.institution} size="xs" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({worker.roleTitle})
                      </span>
                      {isNearCap && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse">
                          <Zap className="w-3 h-3" />
                          نزدیک به سقف ظرفیت
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      حوزه فعالیت: {worker.blockCoverage}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      ظرفیت ({toPersianNum(worker.activeCasesCount)} / {toPersianNum(worker.maxCapacity)})
                    </div>
                    <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                      {toPersianNum(worker.overloadScore)}٪
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold rounded-lg border tabular-nums ${riskBadgeClass}`}>
                    {riskLabel}
                  </span>
                </div>
              </div>

              {/* Progress Bar for Overload Score */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>پرونده‌های فعال: {toPersianNum(worker.activeCasesCount)} از {toPersianNum(worker.maxCapacity)} سقف</span>
                  <span>سرعت جابجایی: {toPersianNum(worker.avgTransitionDays)} روز</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      worker.overloadScore >= 80
                        ? 'bg-red-600'
                        : worker.overloadScore >= 68
                          ? 'bg-amber-500'
                          : 'bg-teal-600'
                    }`}
                    style={{width: `${worker.overloadScore}%`}}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    تحلیل پیش‌بینی هفته آینده
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {worker.forecastReason}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1">
                  <div className="font-semibold text-teal-700 dark:text-teal-400">
                    پیشنهاد تعادل‌بخشی بار کاری (Load Balancing)
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {worker.recommendedAction}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>
            نوار هشدار به صورت خودکار مددکارانی را که بیش از ۷۵٪ از ظرفیت عملیاتی خود را اشغال کرده‌اند علامت‌گذاری می‌کند.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onExportToast?.('توزیع بار کاری', 'گزارش پیش‌بینی ظرفیت مددکاران ذخیره شد.')}
          className="px-3 py-1.5 font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          ذخیره گزارش ظرفیت
        </button>
      </div>
    </section>
  );
};
