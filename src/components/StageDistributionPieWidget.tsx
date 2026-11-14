import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as d3 from 'd3';
import type {CaseRecordView, CaseStage, UiThemeAccent} from '../types';

interface StageDistributionPieWidgetProps {
  cases: CaseRecordView[];
  selectedStage: CaseStage | 'all';
  onSelectStage: (stage: CaseStage | 'all') => void;
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
}

interface StageSliceDatum {
  stage: CaseStage;
  label: string;
  shortLabel: string;
  count: number;
  percentage: number;
  color: string;
}

const STAGE_META: Array<{stage: CaseStage; label: string; shortLabel: string}> = [
  {stage: 1, label: '۱. پذیرش و ارجاع', shortLabel: 'پذیرش و ارجاع'},
  {stage: 2, label: '۲. ارزیابی همه‌جانبه', shortLabel: 'ارزیابی همه‌جانبه'},
  {stage: 3, label: '۳. برنامه مداخله', shortLabel: 'برنامه مداخله'},
  {stage: 4, label: '۴. اجرا و خدمات', shortLabel: 'اجرا و خدمات'},
  {stage: 5, label: '۵. پایش مستمر', shortLabel: 'پایش مستمر'},
  {stage: 6, label: '۶. خروج موفق', shortLabel: 'خروج موفق'},
];

const ACCENT_HEX: Record<UiThemeAccent, {light: string; dark: string}> = {
  teal: {light: '#0f766e', dark: '#14b8a6'},
  blue: {light: '#1d4ed8', dark: '#60a5fa'},
  emerald: {light: '#047857', dark: '#34d399'},
  amber: {light: '#b45309', dark: '#fbbf24'},
  violet: {light: '#6d28d9', dark: '#a78bfa'},
};

function toPersianNum(value: number | string): string {
  const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}

export const StageDistributionPieWidget: React.FC<StageDistributionPieWidgetProps> = ({
  cases,
  selectedStage,
  onSelectStage,
  isDark = false,
  themeAccent = 'teal',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerSize, setContainerSize] = useState(290);
  const [hoveredStage, setHoveredStage] = useState<CaseStage | null>(null);

  const stagePalette = useMemo<Record<CaseStage, string>>(() => {
    const accent = ACCENT_HEX[themeAccent]?.[isDark ? 'dark' : 'light'] || (isDark ? '#14b8a6' : '#0f766e');
    return {
      1: isDark ? '#94a3b8' : '#64748b',
      2: isDark ? '#38bdf8' : '#0284c7',
      3: isDark ? '#818cf8' : '#4f46e5',
      4: isDark ? '#fbbf24' : '#d97706',
      5: accent,
      6: isDark ? '#34d399' : '#059669',
    };
  }, [isDark, themeAccent]);

  const totalCases = cases.length;

  const slices = useMemo<StageSliceDatum[]>(() => {
    const counts = new Map<CaseStage, number>();
    for (const m of STAGE_META) counts.set(m.stage, 0);
    for (const c of cases) {
      counts.set(c.stage, (counts.get(c.stage) || 0) + 1);
    }

    return STAGE_META.map((m) => {
      const count = counts.get(m.stage) || 0;
      const percentage = totalCases > 0 ? Math.round((count / totalCases) * 100) : 0;
      return {
        stage: m.stage,
        label: m.label,
        shortLabel: m.shortLabel,
        count,
        percentage,
        color: stagePalette[m.stage],
      };
    });
  }, [cases, totalCases, stagePalette]);

  const activeData = useMemo(
    () => slices.filter((s) => s.count > 0),
    [slices],
  );

  const focusedSlice = useMemo(() => {
    if (hoveredStage !== null) {
      return slices.find((s) => s.stage === hoveredStage) || null;
    }
    if (selectedStage !== 'all') {
      return slices.find((s) => s.stage === selectedStage) || null;
    }
    return null;
  }, [hoveredStage, selectedStage, slices]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 0) {
        setContainerSize(Math.max(230, Math.min(310, w)));
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const size = containerSize;
    const radius = size / 2 - 14;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${size} ${size}`).attr('width', size).attr('height', size);

    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);
    const sliceStroke = isDark ? '#0f172a' : '#ffffff';
    const emptyFill = isDark ? '#1e293b' : '#e2e8f0';

    if (activeData.length === 0) {
      g.append('circle')
        .attr('r', radius)
        .attr('fill', emptyFill);
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', isDark ? '#94a3b8' : '#64748b')
        .style('font-family', 'inherit')
        .style('font-size', '12px')
        .text('پرونده‌ای ثبت نشده');
      return;
    }

    const pie = d3
      .pie<StageSliceDatum>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.016);

    const arc = d3
      .arc<d3.PieArcDatum<StageSliceDatum>>()
      .innerRadius(0)
      .outerRadius(radius)
      .cornerRadius(3);

    const hoverArc = d3
      .arc<d3.PieArcDatum<StageSliceDatum>>()
      .innerRadius(0)
      .outerRadius(radius + 6)
      .cornerRadius(4);

    const labelArc = d3
      .arc<d3.PieArcDatum<StageSliceDatum>>()
      .innerRadius(radius * 0.56)
      .outerRadius(radius * 0.68);

    const activeHighlightStage =
      hoveredStage !== null
        ? hoveredStage
        : selectedStage !== 'all'
          ? selectedStage
          : null;

    const paths = g
      .selectAll('.stage-pie-slice')
      .data(pie(activeData))
      .enter()
      .append('g')
      .attr('class', 'stage-pie-slice cursor-pointer')
      .on('mouseenter', (_event, d) => setHoveredStage(d.data.stage))
      .on('mouseleave', () => setHoveredStage(null))
      .on('click', (_event, d) => {
        onSelectStage(selectedStage === d.data.stage ? 'all' : d.data.stage);
      });

    paths
      .append('path')
      .attr('d', (d) =>
        activeHighlightStage === d.data.stage ? hoverArc(d) || '' : arc(d) || '',
      )
      .attr('fill', (d) => d.data.color)
      .attr('stroke', sliceStroke)
      .attr('stroke-width', 2)
      .attr('opacity', (d) =>
        activeHighlightStage !== null && activeHighlightStage !== d.data.stage
          ? 0.42
          : 0.94,
      );

    paths
      .filter((d) => d.endAngle - d.startAngle >= 0.34)
      .append('text')
      .attr('transform', (d) => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#ffffff')
      .style('font-family', 'inherit')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .style('pointer-events', 'none')
      .text((d) => `${toPersianNum(d.data.percentage)}٪`);
  }, [activeData, containerSize, isDark, hoveredStage, selectedStage, onSelectStage]);

  return (
    <section
      aria-label="توزیع پرونده‌ها بر اساس وضعیت"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            توزیع پرونده‌ها بر اساس وضعیت (مراحل ۶گانه جریان کاری)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            نمایش سهم و تعداد پرونده‌های موجود در هر یک از ۶ مرحله مدیریت مورد · برای فیلتر کارتابل روی هر بخش کلیک کنید.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {selectedStage !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectStage('all')}
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 underline underline-offset-4 whitespace-nowrap"
            >
              نمایش همه مراحل
            </button>
          )}
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
            مجموع: {toPersianNum(totalCases)} پرونده
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left/Right in RTL: D3 Pie Chart */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-3">
          <div ref={containerRef} className="w-full max-w-[300px] flex justify-center" dir="ltr">
            <svg
              ref={svgRef}
              className="block h-auto"
              role="img"
              aria-label="نمودار دایره‌ای توزیع پرونده‌ها بر اساس مراحل ۶گانه جریان کاری"
            />
          </div>

          <div className="min-h-[1.75rem] text-center text-xs text-slate-600 dark:text-slate-300 tabular-nums">
            {focusedSlice ? (
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {focusedSlice.label}: {toPersianNum(focusedSlice.count)} پرونده (
                {toPersianNum(focusedSlice.percentage)}٪ از کل)
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                برای مشاهده جزئیات هر مرحله، نشانگر را روی برش‌های نمودار قرار دهید.
              </span>
            )}
          </div>
        </div>

        {/* Interactive 6-Stage Breakdown List */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {slices.map((item) => {
            const isSelected = selectedStage === item.stage;
            const isHovered = hoveredStage === item.stage;
            return (
              <button
                key={item.stage}
                type="button"
                onMouseEnter={() => setHoveredStage(item.stage)}
                onMouseLeave={() => setHoveredStage(null)}
                onClick={() => onSelectStage(isSelected ? 'all' : item.stage)}
                aria-pressed={isSelected}
                className={`text-right p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2.5 ${
                  isSelected
                    ? 'border-teal-700 dark:border-teal-500 bg-teal-50/70 dark:bg-teal-950/40'
                    : isHovered
                      ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{backgroundColor: item.color}}
                    />
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                    {toPersianNum(item.count)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/70 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{toPersianNum(item.percentage)}٪ سهم کل</span>
                    <span>
                      {isSelected ? 'فیلتر فعال در کارتابل' : 'کلیک برای فیلتر'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
