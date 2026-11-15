import React, {useMemo, useState} from 'react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {InstitutionEmblem} from './InstitutionalLogo';
import type {CaseRecordView, InstitutionId, UrgencyTier} from '../types';

interface RiskTierDistributionPieWidgetProps {
  cases: CaseRecordView[];
  selectedRiskTier: UrgencyTier | 'all';
  onSelectRiskTier: (tier: UrgencyTier | 'all') => void;
  isDark?: boolean;
}

interface RiskSliceDatum {
  tier: UrgencyTier;
  label: string;
  shortLabel: string;
  count: number;
  percentage: number;
  darolahsanCount: number;
  edalatCount: number;
  color: string;
}

interface CustomTooltipPayloadItem {
  payload?: RiskSliceDatum;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  institutionScope: InstitutionId | 'all';
}

function toPersianNum(value: number | string): string {
  const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}

const RISK_META: Array<{
  tier: UrgencyTier;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    tier: 'red',
    label: 'قرمز · بحرانی (فوری)',
    shortLabel: 'بحرانی (قرمز)',
    description: 'نیازمند مداخله فوری معیشتی و درمانی (امتیاز ≥ ۷۰)',
  },
  {
    tier: 'yellow',
    label: 'زرد · نیازمند مستمر',
    shortLabel: 'مستمر (زرد)',
    description: 'تحت حمایت و پیگیری مستمر ماهانه (امتیاز ۴۰ تا ۶۹)',
  },
  {
    tier: 'green',
    label: 'سبز · مستعد توانمندسازی',
    shortLabel: 'توانمندسازی (سبز)',
    description: 'آماده اشتغال، صندوق خرد و خروج موفق (امتیاز < ۴۰)',
  },
];

const RiskPieTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  institutionScope,
}) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const d = payload[0].payload;

  return (
    <div
      dir="rtl"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 min-w-[190px]"
    >
      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
        <span
          className="w-2.5 h-2.5 rounded-xs shrink-0"
          style={{backgroundColor: d.color}}
        />
        <span>{d.label}</span>
      </div>
      <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 tabular-nums">
        <span>تعداد پرونده‌ها:</span>
        <span className="font-bold">
          {toPersianNum(d.count)} ({toPersianNum(d.percentage)}٪)
        </span>
      </div>
      {institutionScope === 'all' && (
        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
          <div className="flex items-center justify-between">
            <span>دارالاحسان سنندج:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {toPersianNum(d.darolahsanCount)} پرونده
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>عدالت و برابری:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {toPersianNum(d.edalatCount)} پرونده
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const RiskTierDistributionPieWidget: React.FC<
  RiskTierDistributionPieWidgetProps
> = ({cases, selectedRiskTier, onSelectRiskTier, isDark = false}) => {
  const [institutionScope, setInstitutionScope] = useState<InstitutionId | 'all'>(
    'all',
  );
  const [hoveredTier, setHoveredTier] = useState<UrgencyTier | null>(null);

  const tierColors = useMemo<Record<UrgencyTier, string>>(
    () => ({
      red: isDark ? '#ef4444' : '#dc2626',
      yellow: isDark ? '#f59e0b' : '#d97706',
      green: isDark ? '#22c55e' : '#16a34a',
    }),
    [isDark],
  );

  const scopedCases = useMemo(() => {
    if (institutionScope === 'all') return cases;
    return cases.filter((c) => c.owningInstitution === institutionScope);
  }, [cases, institutionScope]);

  const totalInScope = scopedCases.length;

  const slices = useMemo<RiskSliceDatum[]>(() => {
    return RISK_META.map((meta) => {
      const matching = scopedCases.filter((c) => c.urgencyTier === meta.tier);
      const darolahsanCount = cases.filter(
        (c) => c.owningInstitution === 'darolahsan' && c.urgencyTier === meta.tier,
      ).length;
      const edalatCount = cases.filter(
        (c) => c.owningInstitution === 'edalat' && c.urgencyTier === meta.tier,
      ).length;
      const count = matching.length;
      const percentage =
        totalInScope > 0 ? Math.round((count / totalInScope) * 100) : 0;

      return {
        tier: meta.tier,
        label: meta.label,
        shortLabel: meta.shortLabel,
        count,
        percentage,
        darolahsanCount,
        edalatCount,
        color: tierColors[meta.tier],
      };
    });
  }, [scopedCases, cases, totalInScope, tierColors]);

  const activePieData = useMemo(
    () => slices.filter((s) => s.count > 0),
    [slices],
  );

  const institutionSummaries = useMemo(() => {
    const buildSummary = (id: InstitutionId, name: string) => {
      const instCases = cases.filter((c) => c.owningInstitution === id);
      const total = instCases.length;
      const red = instCases.filter((c) => c.urgencyTier === 'red').length;
      const yellow = instCases.filter((c) => c.urgencyTier === 'yellow').length;
      const green = instCases.filter((c) => c.urgencyTier === 'green').length;
      return {
        id,
        name,
        total,
        red,
        yellow,
        green,
        redPct: total > 0 ? Math.round((red / total) * 100) : 0,
        yellowPct: total > 0 ? Math.round((yellow / total) * 100) : 0,
        greenPct: total > 0 ? Math.round((green / total) * 100) : 0,
      };
    };

    return [
      buildSummary('darolahsan', 'دارالاحسان سنندج'),
      buildSummary('edalat', 'عدالت و برابری کردستان'),
    ];
  }, [cases]);

  const activeHighlightTier =
    hoveredTier !== null
      ? hoveredTier
      : selectedRiskTier !== 'all'
        ? selectedRiskTier
        : null;

  const focusedSlice = useMemo(() => {
    if (!activeHighlightTier) return null;
    return slices.find((s) => s.tier === activeHighlightTier) || null;
  }, [activeHighlightTier, slices]);

  return (
    <section
      aria-label="توزیع پرونده‌ها بر اساس وضعیت‌های ریسک در بین مؤسسات"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
    >
      {/* Header & Institution Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            توزیع پرونده‌ها بر اساس وضعیت‌های ریسک در بین مؤسسات (Recharts)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            مقایسه سهم پرونده‌های بحرانی (قرمز)، نیازمند مستمر (زرد) و مستعد توانمندسازی (سبز) به تفکیک دو مؤسسه همکار.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {selectedRiskTier !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectRiskTier('all')}
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 underline underline-offset-4 whitespace-nowrap ml-2"
            >
              نمایش همه سطوح ریسک
            </button>
          )}
          <div
            role="group"
            aria-label="فیلتر مؤسسه برای نمودار ریسک"
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
          >
            {(
              [
                {id: 'all', label: 'هر دو مؤسسه'},
                {id: 'darolahsan', label: 'دارالاحسان'},
                {id: 'edalat', label: 'عدالت و برابری'},
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInstitutionScope(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  institutionScope === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Recharts PieChart */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-2">
          <div className="relative w-full h-[270px] min-w-0" dir="ltr">
            {activePieData.length === 0 ? (
              <div
                dir="rtl"
                className="w-full h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-400"
              >
                پرونده‌ای در این محدوده ثبت نشده است.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={270} minWidth={100}>
                  <PieChart>
                    <Pie
                      data={activePieData}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={98}
                      paddingAngle={3}
                      stroke={isDark ? '#0f172a' : '#ffffff'}
                      strokeWidth={2}
                      animationDuration={400}
                      onMouseEnter={(_data, idx) => {
                        const target = activePieData[idx];
                        if (target) setHoveredTier(target.tier);
                      }}
                      onMouseLeave={() => setHoveredTier(null)}
                      onClick={(_data, idx) => {
                        const target = activePieData[idx];
                        if (target) {
                          onSelectRiskTier(
                            selectedRiskTier === target.tier ? 'all' : target.tier,
                          );
                        }
                      }}
                    >
                      {activePieData.map((entry) => {
                        const isDimmed =
                          activeHighlightTier !== null &&
                          activeHighlightTier !== entry.tier;
                        return (
                          <Cell
                            key={entry.tier}
                            fill={entry.color}
                            fillOpacity={isDimmed ? 0.35 : 0.95}
                            className="cursor-pointer outline-none"
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip
                      content={
                        <RiskPieTooltip institutionScope={institutionScope} />
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>

                {/* Center Summary Readout */}
                <div
                  dir="rtl"
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
                >
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {toPersianNum(
                      focusedSlice ? focusedSlice.count : totalInScope,
                    )}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {focusedSlice ? focusedSlice.shortLabel : 'کل پرونده‌ها'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="text-center text-xs text-slate-500 dark:text-slate-400 tabular-nums min-h-[1.5rem]">
            {focusedSlice ? (
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {focusedSlice.label}: {toPersianNum(focusedSlice.count)} پرونده (
                {toPersianNum(focusedSlice.percentage)}٪)
              </span>
            ) : (
              <span>
                برای فیلتر جدول کارتابل روی برش‌های نمودار یا کارت‌های ریسک کلیک کنید.
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Risk Tier Cards & Institutional Comparison */}
        <div className="lg:col-span-7 space-y-4">
          {/* 3 Risk Tier Interactive Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {slices.map((slice) => {
              const meta = RISK_META.find((m) => m.tier === slice.tier)!;
              const isSelected = selectedRiskTier === slice.tier;
              const isHovered = hoveredTier === slice.tier;
              return (
                <button
                  key={slice.tier}
                  type="button"
                  onMouseEnter={() => setHoveredTier(slice.tier)}
                  onMouseLeave={() => setHoveredTier(null)}
                  onClick={() =>
                    onSelectRiskTier(isSelected ? 'all' : slice.tier)
                  }
                  aria-pressed={isSelected}
                  className={`text-right p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'border-teal-700 dark:border-teal-500 bg-teal-50/60 dark:bg-teal-950/35'
                      : isHovered
                        ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-xs shrink-0"
                        style={{backgroundColor: slice.color}}
                      />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {slice.shortLabel}
                      </span>
                    </div>
                    <span className="text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                      {toPersianNum(slice.count)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {meta.description}
                  </p>

                  <div className="space-y-1">
                    <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/70 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${slice.percentage}%`,
                          backgroundColor: slice.color,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>{toPersianNum(slice.percentage)}٪ از محدوده</span>
                      <span>{isSelected ? 'فیلتر فعال' : 'فیلتر'}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Institutional Breakdown Comparison */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2.5">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              مقایسه توزیع ریسک بین دو مؤسسه (برای تمرکز نمودار روی هر مؤسسه کلیک کنید):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {institutionSummaries.map((inst) => {
                const isActiveInst = institutionScope === inst.id;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() =>
                      setInstitutionScope((prev) =>
                        prev === inst.id ? 'all' : inst.id,
                      )
                    }
                    className={`text-right p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                      isActiveInst
                        ? 'border-teal-700 dark:border-teal-500 bg-teal-50/50 dark:bg-teal-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <InstitutionEmblem institution={inst.id} size="xs" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {inst.name}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                        {toPersianNum(inst.total)} پرونده
                      </span>
                    </div>

                    {/* Proportional stacked risk bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
                      {inst.redPct > 0 && (
                        <div
                          style={{
                            width: `${inst.redPct}%`,
                            backgroundColor: tierColors.red,
                          }}
                          title={`قرمز: ${inst.red}`}
                        />
                      )}
                      {inst.yellowPct > 0 && (
                        <div
                          style={{
                            width: `${inst.yellowPct}%`,
                            backgroundColor: tierColors.yellow,
                          }}
                          title={`زرد: ${inst.yellow}`}
                        />
                      )}
                      {inst.greenPct > 0 && (
                        <div
                          style={{
                            width: `${inst.greenPct}%`,
                            backgroundColor: tierColors.green,
                          }}
                          title={`سبز: ${inst.green}`}
                        />
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                      <span className="text-red-700 dark:text-red-400 font-medium">
                        قرمز: {toPersianNum(inst.red)} ({toPersianNum(inst.redPct)}٪)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        زرد: {toPersianNum(inst.yellow)} ({toPersianNum(inst.yellowPct)}٪)
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                        سبز: {toPersianNum(inst.green)} ({toPersianNum(inst.greenPct)}٪)
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
