import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as d3 from 'd3';
import {
  BarChart3,
  Grid3X3,
  RefreshCw,
} from 'lucide-react';
import type {
  CaseStage,
  ForecastScenario,
  InstitutionId,
  StageForecastItem,
  StageForecastPayload,
  UiThemeAccent,
} from '../types';
import {apiFetch} from '../utils/staticApiFallback';

interface StageForecastPanelProps {
  activeInstitution: InstitutionId;
  refreshSignal: number;
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onFilterByStage?: (stage: CaseStage) => void;
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

export const StageForecastPanel: React.FC<StageForecastPanelProps> = ({
  activeInstitution,
  refreshSignal,
  isDark = false,
  themeAccent = 'teal',
  onFilterByStage,
}) => {
  const [scopeFilter, setScopeFilter] = useState<InstitutionId | 'all'>('all');
  const [scenario, setScenario] = useState<ForecastScenario>('baseline');
  const [viewMode, setViewMode] = useState<'forecast' | 'matrix'>('forecast');
  const [forecast, setForecast] = useState<StageForecastPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);
  const [hoveredStage, setHoveredStage] = useState<StageForecastItem | null>(null);
  const [selectedStageInfo, setSelectedStageInfo] = useState<CaseStage | null>(null);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(640);

  const accentHex = isDark ? ACCENT_HEX[themeAccent].dark : ACCENT_HEX[themeAccent].light;

  const colors = useMemo(
    () => ({
      textPrimary: isDark ? '#f1f5f9' : '#0f172a',
      textSecondary: isDark ? '#cbd5e1' : '#334155',
      textMuted: isDark ? '#94a3b8' : '#64748b',
      gridStroke: isDark ? '#1e293b' : '#e2e8f0',
      axisStroke: isDark ? '#334155' : '#cbd5e1',
      currentBar: isDark ? '#475569' : '#94a3b8',
      ciBand: isDark ? 'rgba(45, 212, 191, 0.24)' : 'rgba(15, 118, 110, 0.18)',
      ciWhisker: isDark ? '#e2e8f0' : '#1e293b',
      cellEmpty: isDark ? '#0f172a' : '#f8fafc',
      cellStroke: isDark ? '#1e293b' : '#e2e8f0',
      danger: isDark ? '#f87171' : '#dc2626',
      amber: isDark ? '#fbbf24' : '#d97706',
    }),
    [isDark],
  );

  useEffect(() => {
    let active = true;
    const loadForecast = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/api/overview/stage-forecast?institution=${encodeURIComponent(scopeFilter)}&scenario=${encodeURIComponent(scenario)}`,
        );
        if (!res.ok) throw new Error('خطا در محاسبه مدل پیش‌بینی مراحل.');
        const data = (await res.json()) as StageForecastPayload;
        if (active) {
          setForecast(data);
          setSelectedStageInfo((prev) => prev || data.bottleneckStage);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'خطا در دریافت داده‌های پیش‌بینی.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadForecast();
    return () => {
      active = false;
    };
  }, [scopeFilter, scenario, refreshSignal, retryCounter]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      setChartWidth(Math.max(320, Math.floor(el.clientWidth)));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, viewMode]);

  const activeStageDetail = useMemo(() => {
    if (!forecast) return null;
    if (hoveredStage) return hoveredStage;
    if (selectedStageInfo) {
      return forecast.stages.find((s) => s.stage === selectedStageInfo) || forecast.stages[0];
    }
    return forecast.stages.find((s) => s.stage === forecast.bottleneckStage) || forecast.stages[0];
  }, [forecast, hoveredStage, selectedStageInfo]);

  // Draw D3 Chart (Forecast Bars + 80%/95% Confidence Intervals OR 6x6 Markov Matrix)
  useEffect(() => {
    if (!forecast || !chartSvgRef.current) return;
    const svg = d3.select(chartSvgRef.current);
    svg.selectAll('*').remove();

    if (viewMode === 'forecast') {
      const data = forecast.stages;
      const width = chartWidth;
      const height = 340;
      const margin = {top: 32, right: 20, bottom: 56, left: 48};
      const innerWidth = Math.max(200, width - margin.left - margin.right);
      const innerHeight = height - margin.top - margin.bottom;

      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const x0 = d3
        .scaleBand<string>()
        .domain(data.map((d) => d.shortLabel))
        .range([0, innerWidth])
        .padding(0.24);

      const x1 = d3
        .scaleBand<'current' | 'expected'>()
        .domain(['current', 'expected'])
        .range([0, x0.bandwidth()])
        .padding(0.14);

      const maxUpper =
        d3.max(data, (d) => Math.max(d.currentCount, d.ciHigh95, d.expectedCount)) ?? 60;
      const y = d3
        .scaleLinear()
        .domain([0, Math.ceil(maxUpper * 1.16)])
        .nice()
        .range([innerHeight, 0]);

      // Grid lines
      g.append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat(() => ''),
        )
        .call((grid) => grid.select('.domain').remove())
        .call((grid) =>
          grid
            .selectAll('.tick line')
            .attr('stroke', colors.gridStroke)
            .attr('stroke-dasharray', '3,3'),
        );

      // X Axis
      const xAxis = g
        .append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x0).tickSize(0).tickPadding(12))
        .call((axis) => axis.select('.domain').attr('stroke', colors.axisStroke));

      xAxis
        .selectAll('text')
        .attr('fill', colors.textSecondary)
        .style('font-family', 'inherit')
        .style('font-size', innerWidth < 460 ? '10px' : '11px')
        .style('font-weight', '600');

      // Y Axis
      g.append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(5)
            .tickFormat((val) => toPersianNum(Number(val))),
        )
        .call((axis) => axis.select('.domain').remove())
        .call((axis) => axis.selectAll('.tick line').remove())
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', colors.textMuted)
            .style('font-family', 'inherit')
            .style('font-size', '11px'),
        );

      g.append('text')
        .attr('x', 0)
        .attr('y', -14)
        .attr('text-anchor', 'start')
        .attr('fill', colors.textMuted)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .text('تعداد پرونده');

      const stageGroups = g
        .selectAll('.forecast-stage-group')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'forecast-stage-group cursor-pointer')
        .attr('transform', (d) => `translate(${x0(d.shortLabel) ?? 0},0)`)
        .on('mouseenter', (_event, d) => setHoveredStage(d))
        .on('mouseleave', () => setHoveredStage(null))
        .on('click', (_event, d) => setSelectedStageInfo(d.stage));

      // Subtle highlight backdrop when stage is active
      stageGroups
        .append('rect')
        .attr('class', 'stage-hover-backdrop')
        .attr('data-stage', (d) => String(d.stage))
        .attr('x', -4)
        .attr('y', 0)
        .attr('width', x0.bandwidth() + 8)
        .attr('height', innerHeight)
        .attr('rx', 6)
        .attr('fill', 'transparent');

      // Current Month Bar
      stageGroups
        .append('rect')
        .attr('x', x1('current') ?? 0)
        .attr('y', (d) => y(d.currentCount))
        .attr('width', x1.bandwidth())
        .attr('height', (d) => Math.max(0, innerHeight - y(d.currentCount)))
        .attr('rx', 4)
        .attr('fill', colors.currentBar)
        .attr('opacity', 0.72);

      // Current value label
      stageGroups
        .append('text')
        .attr('x', (x1('current') ?? 0) + x1.bandwidth() / 2)
        .attr('y', (d) => y(d.currentCount) - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.textMuted)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .text((d) => toPersianNum(d.currentCount));

      // Expected Next Month Bar (Bottleneck highlighted if high congestion)
      const expectedX = x1('expected') ?? 0;
      const expectedCenter = expectedX + x1.bandwidth() / 2;

      stageGroups
        .append('rect')
        .attr('x', expectedX)
        .attr('y', (d) => y(d.expectedCount))
        .attr('width', x1.bandwidth())
        .attr('height', (d) => Math.max(0, innerHeight - y(d.expectedCount)))
        .attr('rx', 4)
        .attr('fill', (d) =>
          d.stage === forecast.bottleneckStage && d.congestionRisk === 'high'
            ? colors.amber
            : accentHex,
        )
        .attr('opacity', 0.9);

      // 80% Confidence Interval Band (translucent box around expected top)
      stageGroups
        .append('rect')
        .attr('x', expectedX - 2)
        .attr('y', (d) => y(d.ciHigh80))
        .attr('width', x1.bandwidth() + 4)
        .attr('height', (d) => Math.max(2, y(d.ciLow80) - y(d.ciHigh80)))
        .attr('rx', 2)
        .attr('fill', colors.ciBand)
        .attr('stroke', accentHex)
        .attr('stroke-width', 1)
        .attr('stroke-opacity', 0.55);

      // 95% Confidence Whisker Line (ciLow95 to ciHigh95)
      stageGroups
        .append('line')
        .attr('x1', expectedCenter)
        .attr('x2', expectedCenter)
        .attr('y1', (d) => y(d.ciHigh95))
        .attr('y2', (d) => y(d.ciLow95))
        .attr('stroke', colors.ciWhisker)
        .attr('stroke-width', 1.6);

      // Top & bottom whisker caps
      stageGroups
        .append('line')
        .attr('x1', expectedCenter - 4)
        .attr('x2', expectedCenter + 4)
        .attr('y1', (d) => y(d.ciHigh95))
        .attr('y2', (d) => y(d.ciHigh95))
        .attr('stroke', colors.ciWhisker)
        .attr('stroke-width', 1.6);

      stageGroups
        .append('line')
        .attr('x1', expectedCenter - 4)
        .attr('x2', expectedCenter + 4)
        .attr('y1', (d) => y(d.ciLow95))
        .attr('y2', (d) => y(d.ciLow95))
        .attr('stroke', colors.ciWhisker)
        .attr('stroke-width', 1.6);

      // Expected mean value label above upper whisker
      stageGroups
        .append('text')
        .attr('x', expectedCenter)
        .attr('y', (d) => Math.max(11, y(d.ciHigh95) - 7))
        .attr('text-anchor', 'middle')
        .attr('fill', colors.textPrimary)
        .style('font-family', 'inherit')
        .style('font-size', '11px')
        .style('font-weight', '700')
        .text((d) => toPersianNum(d.expectedCount));
    } else {
      // 6x6 Markov Transition Matrix Heatmap
      const width = chartWidth;
      const height = 340;
      const margin = {top: 38, right: 24, bottom: 26, left: 105};
      const innerWidth = Math.max(180, width - margin.left - margin.right);
      const innerHeight = height - margin.top - margin.bottom;

      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
      const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

      const stageLabels = forecast.stages.map((s) => s.shortLabel);
      const x = d3.scaleBand<string>().domain(stageLabels).range([0, innerWidth]).padding(0.06);
      const y = d3.scaleBand<string>().domain(stageLabels).range([0, innerHeight]).padding(0.06);

      const colorScale = d3
        .scaleLinear<string>()
        .domain([0, 35, 90])
        .range([
          colors.cellEmpty,
          isDark ? 'rgba(45, 212, 191, 0.35)' : 'rgba(15, 118, 110, 0.25)',
          accentHex,
        ]);

      // Column headers (To Stage)
      g.append('g')
        .call(d3.axisTop(x).tickSize(0).tickPadding(8))
        .call((axis) => axis.select('.domain').remove())
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', colors.textSecondary)
            .style('font-family', 'inherit')
            .style('font-size', '10px')
            .style('font-weight', '600'),
        );

      // Row headers (From Stage)
      g.append('g')
        .call(d3.axisLeft(y).tickSize(0).tickPadding(8))
        .call((axis) => axis.select('.domain').remove())
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', colors.textSecondary)
            .style('font-family', 'inherit')
            .style('font-size', '10px')
            .style('font-weight', '600'),
        );

      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', -22)
        .attr('text-anchor', 'middle')
        .attr('fill', colors.textMuted)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .text('مقصد پرونده در ماه آینده (ستون) ← مبدا فعلی (ردیف)');

      const cells = g
        .selectAll('.matrix-cell')
        .data(forecast.transitionMatrix)
        .enter()
        .append('g')
        .attr('class', 'matrix-cell cursor-pointer')
        .on('mouseenter', (_event, cell) => {
          const st = forecast.stages.find((s) => s.stage === cell.fromStage) || null;
          setHoveredStage(st);
        })
        .on('mouseleave', () => setHoveredStage(null))
        .on('click', (_event, cell) => setSelectedStageInfo(cell.fromStage));

      cells
        .append('rect')
        .attr('x', (d) => x(stageLabels[d.toStage - 1]) ?? 0)
        .attr('y', (d) => y(stageLabels[d.fromStage - 1]) ?? 0)
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('rx', 4)
        .attr('fill', (d) =>
          d.probabilityPct === 0 ? colors.cellEmpty : colorScale(d.probabilityPct),
        )
        .attr('stroke', colors.cellStroke)
        .attr('stroke-width', 1);

      cells
        .append('text')
        .attr('x', (d) => (x(stageLabels[d.toStage - 1]) ?? 0) + x.bandwidth() / 2)
        .attr('y', (d) => (y(stageLabels[d.fromStage - 1]) ?? 0) + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('fill', (d) =>
          d.probabilityPct >= 48
            ? '#ffffff'
            : d.probabilityPct === 0
              ? colors.textMuted
              : colors.textPrimary,
        )
        .style('font-family', 'inherit')
        .style('font-size', '11px')
        .style('font-weight', (d) => (d.probabilityPct > 0 ? '700' : '400'))
        .text((d) => (d.probabilityPct > 0 ? `${toPersianNum(d.probabilityPct)}٪` : '—'));
    }
  }, [forecast, viewMode, chartWidth, colors, accentHex, isDark]);

  // Lightweight backdrop highlight without rebuilding D3 axes on hover
  useEffect(() => {
    if (!chartSvgRef.current || viewMode !== 'forecast') return;
    const svg = d3.select(chartSvgRef.current);
    svg.selectAll<SVGRectElement, StageForecastItem>('.stage-hover-backdrop').attr('fill', (d) =>
      activeStageDetail?.stage === d.stage
        ? isDark
          ? 'rgba(148, 163, 184, 0.09)'
          : 'rgba(15, 23, 42, 0.045)'
        : 'transparent',
    );
  }, [activeStageDetail, viewMode, isDark, forecast]);

  return (
    <section
      aria-label="پیش‌بینی احتمالی ۶ مرحله‌ای پرونده‌ها در ماه آینده"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
    >
      {/* Header + Scope + Scenario Controls */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            پیش‌بینی احتمالی جریان ۶ مرحله‌ای پرونده‌ها در ماه آینده
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            شبیه‌سازی احتمالی با مدل زنجیره مارکوف گسسته و ۲,۰۰۰ تکرار مونت‌کارلو برای برآورد تراکم هر مرحله و تخصیص بهینه بودجه و ظرفیت مددکاری.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2.5 shrink-0">
          {/* Scope Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                scopeFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              کل شبکه نایسر
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('darolahsan')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                scopeFilter === 'darolahsan'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              دارالاحسان
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('edalat')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                scopeFilter === 'edalat'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              عدالت و برابری
            </button>
          </div>

          {/* Active Institution Shortcut */}
          {scopeFilter !== activeInstitution && (
            <button
              type="button"
              onClick={() => setScopeFilter(activeInstitution)}
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap shrink-0 px-1"
            >
              محدود به مؤسسه فعال
            </button>
          )}
        </div>
      </div>

      {/* Scenario + Chart Mode Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
            سناریوی شبیه‌سازی:
          </span>
          {(
            [
              {id: 'baseline', label: 'روند فعلی (پایه)'},
              {id: 'accelerated_funding', label: 'تزریق بودجه و تسریع (+۳۰٪)'},
              {id: 'winter_surge', label: 'فشار فصلی و ورودی بالا'},
            ] as {id: ForecastScenario; label: string}[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScenario(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                scenario === item.id
                  ? 'bg-slate-900 dark:bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start lg:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('forecast')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              viewMode === 'forecast'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            پیش‌بینی و بازه اطمینان
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              viewMode === 'matrix'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            ماتریس احتمال انتقال
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRetryCounter((c) => c + 1)}
            className="text-xs font-semibold underline inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            تلاش مجدد
          </button>
        </div>
      )}

      {loading || !forecast ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          <div className="h-80 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        </div>
      ) : (
        <>
          {/* 3-Column Hairline Forecast Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 border border-slate-200 dark:border-slate-800 rounded-xl divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="p-4 space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                پرونده‌های فعال پیش‌بینی‌شده (مراحل ۱ تا ۵)
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular-nums">
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {toPersianNum(forecast.totalExpectedNextMonth)} پرونده
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  بازه ۸۰٪: {toPersianNum(forecast.totalCiLow80)} تا {toPersianNum(forecast.totalCiHigh80)}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                ورودی جدید: +{toPersianNum(forecast.expectedNewIntake)} · خروج موفق ماه آینده:{' '}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {toPersianNum(forecast.expectedGraduations)} خانوار
                </span>
              </div>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                گلوگاه احتمالی و کانون تراکم ماه آینده
              </div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                {forecast.stages.find((s) => s.stage === forecast.bottleneckStage)?.stageLabel}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                {forecast.bottleneckReason}
              </div>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                برآورد منابع مورد نیاز ماه آینده
              </div>
              <div className="flex items-baseline justify-between gap-2 tabular-nums">
                <span className="text-2xl font-bold text-teal-700 dark:text-teal-400">
                  {toPersianNum(forecast.totalEstimatedBudgetMillion)} م تومان
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {toPersianNum(forecast.totalRequiredWorkerHours)} ساعت مددکاری
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {forecast.horizonLabel} · {forecast.scenarioLabel}
              </div>
            </div>
          </div>

          {/* Main Grid: D3 Chart + Per-Stage Probabilistic Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left/Main D3 Chart */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
              <div ref={chartContainerRef} className="w-full overflow-hidden" dir="ltr">
                <svg
                  ref={chartSvgRef}
                  className="w-full h-auto block"
                  role="img"
                  aria-label="نمودار پیش‌بینی احتمالی ۶ مرحله مدیریت مورد در ماه آینده"
                />
              </div>

              {/* Legend + Active Hover Summary */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
                {viewMode === 'forecast' ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-xs inline-block"
                        style={{backgroundColor: colors.currentBar}}
                      />
                      وضعیت فعلی
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-xs inline-block"
                        style={{backgroundColor: accentHex}}
                      />
                      میانگین پیش‌بینی ماه آینده
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs border border-teal-700 dark:border-teal-400 bg-teal-700/20 inline-block" />
                      بازه اطمینان ۸۰٪ و ۹۵٪
                    </span>
                  </div>
                ) : (
                  <span>
                    هر خانه احتمال انتقال پرونده از ردیف (مرحله فعلی) به ستون (مرحله ماه آینده) را نشان می‌دهد.
                  </span>
                )}
              </div>
            </div>

            {/* Right Panel: 6-Stage Breakdown & Resource Inspector */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
                {forecast.stages.map((st) => {
                  const isActive = activeStageDetail?.stage === st.stage;
                  const deltaPositive = st.netDelta > 0;
                  const deltaNegative = st.netDelta < 0;
                  return (
                    <button
                      key={st.stage}
                      type="button"
                      onMouseEnter={() => setHoveredStage(st)}
                      onMouseLeave={() => setHoveredStage(null)}
                      onClick={() => setSelectedStageInfo(st.stage)}
                      className={`w-full text-right p-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isActive
                          ? 'bg-slate-50 dark:bg-slate-800/70'
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                          <span className="truncate">{st.stageLabel}</span>
                          {st.congestionRisk === 'high' && (
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 shrink-0">
                              · تراکم بالا
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          بازه ۸۰٪: {toPersianNum(st.ciLow80)}–{toPersianNum(st.ciHigh80)} · احتمال ارتقا:{' '}
                          {toPersianNum(st.advanceProbPct)}٪
                        </div>
                      </div>

                      <div className="text-left shrink-0 tabular-nums space-y-0.5">
                        <div className="flex items-center justify-end gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            {toPersianNum(st.currentCount)} ←
                          </span>
                          <span className="text-teal-700 dark:text-teal-400">
                            {toPersianNum(st.expectedCount)}
                          </span>
                          {deltaPositive ? (
                            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              +{toPersianNum(st.netDelta)}
                            </span>
                          ) : deltaNegative ? (
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              {toPersianNum(st.netDelta)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">ثابت</span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {toPersianNum(st.estimatedMonthlyBudgetMillion)} م ·{' '}
                          {toPersianNum(st.requiredWorkerHours)} ساعت
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Stage Detail Box */}
              {activeStageDetail && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      تحلیل مرحله انتخاب‌شده: {activeStageDetail.stageLabel}
                    </div>
                    {onFilterByStage && (
                      <button
                        type="button"
                        onClick={() => onFilterByStage(activeStageDetail.stage)}
                        className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
                      >
                        نمایش در کارتابل
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {activeStageDetail.resourceAllocationFocus}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300 tabular-nums pt-1 border-t border-slate-200 dark:border-slate-700">
                    <span>
                      بازه ۹۵٪: <strong>{toPersianNum(activeStageDetail.ciLow95)}</strong> تا{' '}
                      <strong>{toPersianNum(activeStageDetail.ciHigh95)}</strong> پرونده
                    </span>
                    <span>
                      ورودی ماهانه: <strong>+{toPersianNum(activeStageDetail.inflowExpected)}</strong>
                    </span>
                    <span>
                      خروجی ماهانه: <strong>-{toPersianNum(activeStageDetail.outflowExpected)}</strong>
                    </span>
                    <span>
                      ماندگاری: <strong>{toPersianNum(activeStageDetail.stayProbPct)}٪</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Managerial Resource Allocation Guidance */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              توصیه‌های آماری برای تخصیص منابع ماه آینده ({forecast.modelSummary})
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {forecast.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed tabular-nums"
                >
                  {rec}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
};
