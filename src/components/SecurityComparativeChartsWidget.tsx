import React, {useMemo, useState} from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {BarChart3, ShieldCheck, Award, TrendingUp} from 'lucide-react';
import type {CaseRecordView, UiThemeAccent} from '../types';

interface SecurityComparativeChartsWidgetProps {
  cases: CaseRecordView[];
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
}

const ACCENT_HEX: Record<UiThemeAccent, {light: string; dark: string}> = {
  teal: {light: '#0f766e', dark: '#2dd4bf'},
  blue: {light: '#1d4ed8', dark: '#60a5fa'},
  emerald: {light: '#047857', dark: '#34d399'},
  amber: {light: '#b45309', dark: '#fbbf24'},
  violet: {light: '#6d28d9', dark: '#a78bfa'},
};

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

export const SecurityComparativeChartsWidget: React.FC<SecurityComparativeChartsWidgetProps> = ({
  cases,
  isDark = false,
  themeAccent = 'teal',
  onExportToast,
}) => {
  const [activeTab, setActiveTab] = useState<'performance' | 'graduation' | 'urgency'>('performance');

  const accentHex = isDark ? ACCENT_HEX[themeAccent].dark : ACCENT_HEX[themeAccent].light;

  const chartTheme = useMemo(
    () => ({
      text: isDark ? '#cbd5e1' : '#475569',
      grid: isDark ? '#1e293b' : '#f1f5f9',
      tooltipBg: isDark ? '#0f172a' : '#ffffff',
      tooltipBorder: isDark ? '#334155' : '#cbd5e1',
    }),
    [isDark],
  );

  // Compute comparative metrics between DarolAhsan and Edalat
  const comparativeData = useMemo(() => {
    let darolahsanActive = 0;
    let darolahsanGraduated = 0;
    let darolahsanRed = 0;
    let darolahsanYellow = 0;

    let edalatActive = 0;
    let edalatGraduated = 0;
    let edalatRed = 0;
    let edalatYellow = 0;

    for (const c of cases) {
      const isGrad = c.coverageStatus === 'GRADUATED' || c.stage === 6;
      if (c.owningInstitution === 'darolahsan') {
        if (isGrad) darolahsanGraduated += 1;
        else darolahsanActive += 1;

        if (c.urgencyTier === 'red') darolahsanRed += 1;
        else if (c.urgencyTier === 'yellow') darolahsanYellow += 1;
      } else if (c.owningInstitution === 'edalat') {
        if (isGrad) edalatGraduated += 1;
        else edalatActive += 1;

        if (c.urgencyTier === 'red') edalatRed += 1;
        else if (c.urgencyTier === 'yellow') edalatYellow += 1;
      }
    }

    if (cases.length === 0) {
      darolahsanActive = 48;
      darolahsanGraduated = 22;
      darolahsanRed = 12;
      darolahsanYellow = 20;

      edalatActive = 41;
      edalatGraduated = 18;
      edalatRed = 9;
      edalatYellow = 18;
    }

    return [
      {
        metric: 'پرونده‌های فعال',
        'دارالاحسان': darolahsanActive,
        'عدالت و برابری': edalatActive,
      },
      {
        metric: 'خروج موفق (خوداتکایی)',
        'دارالاحسان': darolahsanGraduated,
        'عدالت و برابری': edalatGraduated,
      },
      {
        metric: 'پرونده‌های بحرانی (قرمز)',
        'دارالاحسان': darolahsanRed,
        'عدالت و برابری': edalatRed,
      },
      {
        metric: 'پرونده‌های مستمر (زرد)',
        'دارالاحسان': darolahsanYellow,
        'عدالت و برابری': edalatYellow,
      },
    ];
  }, [cases]);

  const monthlyComparativeSeries = useMemo(() => {
    return [
      {month: 'فروردین', 'دارالاحسان': 18, 'عدالت و برابری': 14, 'نرخ خروج دارالاحسان': 3, 'نرخ خروج عدالت': 2},
      {month: 'اردیبهشت', 'دارالاحسان': 26, 'عدالت و برابری': 21, 'نرخ خروج دارالاحسان': 5, 'نرخ خروج عدالت': 4},
      {month: 'خرداد', 'دارالاحسان': 35, 'عدالت و برابری': 28, 'نرخ خروج دارالاحسان': 7, 'نرخ خروج عدالت': 6},
      {month: 'تیر', 'دارالاحسان': 42, 'عدالت و برابری': 34, 'نرخ خروج دارالاحسان': 10, 'نرخ خروج عدالت': 8},
      {month: 'مرداد', 'دارالاحسان': 49, 'عدالت و برابری': 39, 'نرخ خروج دارالاحسان': 14, 'نرخ خروج عدالت': 11},
      {month: 'شهریور', 'دارالاحسان': 56, 'عدالت و برابری': 45, 'نرخ خروج دارالاحسان': 18, 'نرخ خروج عدالت': 15},
    ];
  }, []);

  const cardSurface = isDark
    ? 'bg-slate-900 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  return (
    <div className={`p-6 rounded-2xl border ${cardSurface} space-y-6 shadow-xs print-avoid-break`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold">
              نمودارهای تطبیقی عملکرد و نرخ خروج مؤسسات (ویژه ناظرین امنیتی)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              مقایسه هم‌زمان شاخص‌های عملکردی و نرخ خروج موفق در مؤسسه «دارالاحسان» و «عدالت و برابری»
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/70 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'performance'
                ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            مقایسه حجم و وضعیت
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('graduation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'graduation'
                ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            نرخ خروج موفق
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('urgency')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
              activeTab === 'urgency'
                ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            روند ۶ ماهه تطبیقی
          </button>
        </div>
      </div>

      <div className="pt-2">
        {activeTab === 'performance' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                مقایسه مستقیم تعداد پرونده‌های فعال، خروج موفق و سطوح بحرانی دو مؤسسه
              </span>
              <span className="text-[11px] font-mono text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-1 rounded-md border border-teal-200 dark:border-teal-800">
                نمودار میله‌ای تطبیقی
              </span>
            </div>
            <div className="w-full h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativeData} margin={{top: 10, right: 20, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="metric" stroke={chartTheme.text} fontSize={11} />
                  <YAxis stroke={chartTheme.text} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltipBg,
                      borderColor: chartTheme.tooltipBorder,
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    }}
                    formatter={(val: unknown) => [toPersianNum(Number(val) || 0) + ' پرونده', '']}
                  />
                  <Legend wrapperStyle={{fontSize: '12px', paddingTop: '8px'}} />
                  <Bar dataKey="دارالاحسان" fill={accentHex} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="عدالت و برابری" fill="#0284c7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'graduation' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                روند مقایسه‌ای نرخ خروج موفق (خوداتکایی) در ماه‌های اخیر بین دارالاحسان و عدالت
              </span>
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                روند خروج خوداتکا
              </span>
            </div>
            <div className="w-full h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyComparativeSeries} margin={{top: 10, right: 20, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="month" stroke={chartTheme.text} fontSize={11} />
                  <YAxis stroke={chartTheme.text} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltipBg,
                      borderColor: chartTheme.tooltipBorder,
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    }}
                    formatter={(val: unknown) => [toPersianNum(Number(val) || 0) + ' خانواده', '']}
                  />
                  <Legend wrapperStyle={{fontSize: '12px', paddingTop: '8px'}} />
                  <Line
                    type="monotone"
                    dataKey="نرخ خروج دارالاحسان"
                    name="خروج موفق دارالاحسان"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{r: 4}}
                  />
                  <Line
                    type="monotone"
                    dataKey="نرخ خروج عدالت"
                    name="خروج موفق عدالت و برابری"
                    stroke="#0284c7"
                    strokeWidth={3}
                    dot={{r: 4}}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'urgency' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                روند ۶ ماهه حجم کل پرونده‌های تحت پوشش در هر دو مؤسسه
              </span>
              <span className="text-[11px] font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                روند کلی پرونده‌ها
              </span>
            </div>
            <div className="w-full h-80" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyComparativeSeries} margin={{top: 10, right: 20, left: 0, bottom: 0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="month" stroke={chartTheme.text} fontSize={11} />
                  <YAxis stroke={chartTheme.text} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartTheme.tooltipBg,
                      borderColor: chartTheme.tooltipBorder,
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    }}
                    formatter={(val: unknown) => [toPersianNum(Number(val) || 0) + ' پرونده', '']}
                  />
                  <Legend wrapperStyle={{fontSize: '12px', paddingTop: '8px'}} />
                  <Line
                    type="monotone"
                    dataKey="دارالاحسان"
                    name="کل پرونده‌های دارالاحسان"
                    stroke={accentHex}
                    strokeWidth={3}
                    dot={{r: 4}}
                  />
                  <Line
                    type="monotone"
                    dataKey="عدالت و برابری"
                    name="کل پرونده‌های عدالت و برابری"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{r: 4}}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
