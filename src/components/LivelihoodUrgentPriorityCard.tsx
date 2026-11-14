import React, {useMemo} from 'react';
import {ShoppingBasket, AlertCircle, ArrowUpRight, HeartHandshake} from 'lucide-react';
import type {CaseRecordView, UiThemeAccent} from '../types';

interface LivelihoodPriorityCardProps {
  cases: CaseRecordView[];
  onInspectCase: (item: CaseRecordView) => void;
  onOpenWorkflow: (caseId: string) => void;
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
}

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

export const LivelihoodUrgentPriorityCard: React.FC<LivelihoodPriorityCardProps> = ({
  cases,
  onInspectCase,
  onOpenWorkflow,
  isDark: _isDark,
  themeAccent: _themeAccent = 'teal',
  onExportToast,
}) => {
  // Filter cases in Stage 4 (Execution & Services) with livelihood or low livelihood score / risk
  const urgentLivelihoodCases = useMemo(() => {
    return cases.filter((item) => {
      if (item.stage !== 4) return false;
      const isLivelihoodRisk =
        item.score.livelihood <= 18 ||
        item.needForecast3M?.category === 'livelihood' ||
        item.needForecast3M?.riskLevel === 'high' ||
        item.urgencyTier === 'red';
      return isLivelihoodRisk;
    }).slice(0, 5); // top 5 urgent stage 4 cases
  }, [cases]);

  return (
    <section
      aria-label="اولویت معیشتی خانوارهای مرحله ۴"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tabular-nums">
              مرحله ۴ · اجرا و خدمات
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              پیش‌بینی نیاز به بسته حمایتی ماه آینده
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            اولویت معیشتی خانوارها (نیازمند کمک فوری در ماه پیش رو)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            بر اساس تحلیل داده‌های معیشتی و امتیازات خانوار در مرحله ۴، خانوارهای زیر به عنوان اولویت اول توزیع بسته معیشتی ماه آتی شناسایی شده‌اند.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 rounded-xl px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-300 shrink-0">
          <ShoppingBasket className="w-4 h-4 shrink-0" />
          <span>تعداد واجدین اولویت: {toPersianNum(urgentLivelihoodCases.length)} خانوار</span>
        </div>
      </div>

      {urgentLivelihoodCases.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          در حال حاضر هیچ پرونده‌ای در مرحله ۴ با اولویت معیشتی فوری شناسایی نشده است.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {urgentLivelihoodCases.map((item) => (
            <div
              key={item.id}
              className="bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex flex-col justify-between gap-4 hover:border-teal-500/50 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 tabular-nums">
                    {item.id}
                  </span>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                    اولویت معیشتی فوری
                  </span>
                </div>

                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {item.isMasked ? 'پرونده محرمانه مؤسسه همکار' : item.fullName}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.blockName} · خانوار {toPersianNum(item.householdSize || 4)} نفره
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 space-y-1">
                  <div className="flex justify-between tabular-nums">
                    <span>امتیاز معیشت: {toPersianNum(item.score.livelihood)} / ۲۵</span>
                    <span>امتیاز کل: {toPersianNum(item.score.total)} / ۱۰۰</span>
                  </div>
                  {item.needForecast3M && (
                    <div className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">
                      پیش‌بینی: {item.needForecast3M.categoryLabel} ({toPersianNum(item.needForecast3M.probabilityPct)}٪)
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => onInspectCase(item)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 transition-colors text-center"
                >
                  مشاهده پرونده
                </button>
                {!item.isMasked && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenWorkflow(item.id);
                      onExportToast?.('ثبت سبد معیشتی', `ارسال حواله معیشتی فوری برای پرونده ${item.id} فعال شد.`);
                    }}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors inline-flex items-center justify-center gap-1"
                  >
                    <span>ثبت کمک فوری</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <HeartHandshake className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>
            این فهرست به مددکاران کمک می‌کند در ابتدای هر ماه، سبد‌های معیشتی مرحله ۴ را مستقیماً به خانوارهای نیازمند واقعی تخصیص دهند.
          </span>
        </div>
      </div>
    </section>
  );
};
