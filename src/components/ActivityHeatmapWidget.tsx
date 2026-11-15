import React, {useEffect, useRef, useState, useMemo} from 'react';
import * as d3 from 'd3';
import {Activity, Calendar, Download, Sparkles, Flame} from 'lucide-react';
import type {CaseRecordView, UiThemeAccent} from '../types';

interface ActivityHeatmapWidgetProps {
  cases?: CaseRecordView[];
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
}

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

const ACCENT_HEX: Record<UiThemeAccent, {light: string; dark: string}> = {
  teal: {light: '#0f766e', dark: '#2dd4bf'},
  blue: {light: '#1d4ed8', dark: '#60a5fa'},
  emerald: {light: '#047857', dark: '#34d399'},
  amber: {light: '#b45309', dark: '#fbbf24'},
  violet: {light: '#6d28d9', dark: '#a78bfa'},
};

interface DayActivityPoint {
  dateKey: string; // YYYY/MM/DD
  dayLabel: string;
  count: number;
  monthLabel: string;
}

export const ActivityHeatmapWidget: React.FC<ActivityHeatmapWidgetProps> = ({
  cases = [],
  isDark = false,
  themeAccent = 'teal',
  onExportToast,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(720);
  const [hoveredDay, setHoveredDay] = useState<DayActivityPoint | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'all' | 'interventions' | 'updates'>('all');

  const accentHex = isDark ? ACCENT_HEX[themeAccent].dark : ACCENT_HEX[themeAccent].light;

  // ResizeObserver for responsive SVG
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      setContainerWidth(Math.max(300, Math.floor(el.clientWidth)));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Generate 180 days (6 months) of activity data
  const activityData = useMemo(() => {
    const data: DayActivityPoint[] = [];
    const today = new Date();
    const persianMonths = ['اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر'];

    for (let i = 179; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 86400000);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const dateKey = `${year}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
      
      // Seeded pseudo-random activity density based on day of week & case count
      const isWeekend = d.getUTCDay() === 5; // Friday
      const base = isWeekend ? 1 : 3;
      const randomNoise = Math.floor(Math.sin(i * 12.9898) * 43758.5453) % 6;
      const count = isWeekend ? Math.max(0, randomNoise - 2) : Math.max(1, Math.abs(randomNoise) + base + (cases.length % 3));

      const monthIdx = (month + i) % persianMonths.length;
      data.push({
        dateKey,
        dayLabel: `${day} ${persianMonths[monthIdx]}`,
        count,
        monthLabel: persianMonths[monthIdx],
      });
    }
    return data;
  }, [cases.length]);

  const totalActivityCount = useMemo(() => {
    return activityData.reduce((sum, d) => sum + d.count, 0);
  }, [activityData]);

  const maxCount = useMemo(() => {
    return d3.max(activityData, (d) => d.count) ?? 10;
  }, [activityData]);

  // Render D3 Heatmap Grid
  useEffect(() => {
    if (!svgRef.current) return;
    const width = containerWidth;
    const height = 180;
    const margin = {top: 20, right: 20, bottom: 30, left: 30};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const cols = 26; // ~26 weeks in 6 months
    const rows = 7; // 7 days of week
    const cellSize = Math.floor(Math.min(innerWidth / cols, innerHeight / rows) - 2);

    const colorScale = d3
      .scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolate(isDark ? '#334155' : '#ccfbf1', accentHex));

    const weeksData: DayActivityPoint[][] = [];
    for (let c = 0; c < cols; c++) {
      weeksData.push(activityData.slice(c * rows, (c + 1) * rows));
    }

    const weekGroups = g
      .selectAll('.week-col')
      .data(weeksData)
      .enter()
      .append('g')
      .attr('transform', (_d, i) => `translate(${i * (cellSize + 3)}, 0)`);

    weekGroups
      .selectAll('.day-cell')
      .data((d) => d)
      .enter()
      .append('rect')
      .attr('class', 'day-cell cursor-pointer transition-all')
      .attr('y', (_d, rIndex) => rIndex * (cellSize + 3))
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 3)
      .attr('fill', (d) => {
        if (d.count === 0) return isDark ? '#1e293b' : '#f1f5f9';
        return colorScale(d.count);
      })
      .attr('stroke', isDark ? '#334155' : '#e2e8f0')
      .attr('stroke-width', 0.5)
      .on('mouseenter', (_event, d) => setHoveredDay(d))
      .on('mouseleave', () => setHoveredDay(null));

    // Day labels on left
    const daysShort = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    g.selectAll('.day-label')
      .data(daysShort)
      .enter()
      .append('text')
      .attr('x', -10)
      .attr('y', (_d, i) => i * (cellSize + 3) + cellSize / 2 + 3)
      .attr('text-anchor', 'end')
      .attr('fill', isDark ? '#94a3b8' : '#64748b')
      .style('font-size', '10px')
      .style('font-family', 'inherit')
      .text((d) => d);

  }, [activityData, containerWidth, isDark, maxCount]);

  return (
    <div
      className={`border rounded-2xl p-6 shadow-sm transition-all ${
        isDark ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl text-white shadow-xs" style={{backgroundColor: accentHex}}>
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              نقشه حرارتی تراکم فعالیت‌ها و به‌روزرسانی پرونده‌ها (۶ ماه گذشته)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-semibold border border-teal-500/20">
                تحلیل D3.js
              </span>
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              پایش چگالی اقدامات، بازدیدهای میدانی و به‌روزرسانی‌های انجام‌شده توسط تیم مددکاری نایسر
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center rounded-xl p-1 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setSelectedMetric('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedMetric === 'all'
                  ? 'bg-white dark:bg-slate-900 shadow-xs font-semibold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              همه فعالیت‌ها
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('interventions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedMetric === 'interventions'
                  ? 'bg-white dark:bg-slate-900 shadow-xs font-semibold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              مداخلات میدانی
            </button>
            <button
              type="button"
              onClick={() => setSelectedMetric('updates')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedMetric === 'updates'
                  ? 'bg-white dark:bg-slate-900 shadow-xs font-semibold text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              بروزرسانی پرونده
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onExportToast?.(
                'خروجی نقشه حرارتی فعالیت‌ها',
                'گزارش تراکم فعالیت‌های ۶ ماهه تیم مددکاری با موفقیت صادر شد.'
              );
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all ${
              isDark
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            خروجی گزارش
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
        <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-xs text-slate-500 dark:text-slate-400">مجموع فعالیت‌های ثبت‌شده (۶ ماه)</div>
          <div className="text-2xl font-bold mt-2 tabular-nums">
            {toPersianNum(totalActivityCount)} <span className="text-xs font-normal">اقدام و خدمت</span>
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-xs text-slate-500 dark:text-slate-400">میانگین فعالیت روزانه تیم</div>
          <div className="text-2xl font-bold mt-2 tabular-nums text-teal-600 dark:text-teal-400">
            {toPersianNum(Math.round((totalActivityCount / 180) * 10) / 10)} <span className="text-xs font-normal">اقدام / روز</span>
          </div>
        </div>

        <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800/50 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
          <div className="text-xs text-slate-500 dark:text-slate-400">حداکثر تراکم روزانه (اوج فعالیت)</div>
          <div className="text-2xl font-bold mt-2 tabular-nums text-emerald-600 dark:text-emerald-400">
            {toPersianNum(maxCount)} <span className="text-xs font-normal">اقدام در یک روز</span>
          </div>
        </div>
      </div>

      {/* Heatmap SVG Container */}
      <div ref={containerRef} className="w-full pt-4 overflow-x-auto">
        <svg ref={svgRef} className="w-full h-auto overflow-visible" />
      </div>

      {/* Hover Status Bar */}
      <div className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'} text-xs flex items-center justify-between`}>
        {hoveredDay ? (
          <span className="font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
            تاریخ: {hoveredDay.dayLabel} ({hoveredDay.dateKey}) — تراکم فعالیت: {toPersianNum(hoveredDay.count)} اقدام ثبت‌شده
          </span>
        ) : (
          <span>نشانگر را روی خانه‌های نقشه حرارتی قرار دهید تا جزئیات تراکم فعالیت روزانه را مشاهده کنید.</span>
        )}

        <div className="flex items-center gap-2">
          <span>کم‌تراکم</span>
          <div className="flex items-center gap-1">
            <span className={`w-3 h-3 rounded-xs ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
            <span className="w-3 h-3 rounded-xs bg-teal-300 dark:bg-teal-900" />
            <span className="w-3 h-3 rounded-xs bg-teal-500 dark:bg-teal-600" />
            <span className="w-3 h-3 rounded-xs bg-teal-700 dark:bg-teal-400" />
          </div>
          <span>پرتراکم</span>
        </div>
      </div>
    </div>
  );
};
