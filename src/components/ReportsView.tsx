import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as d3 from 'd3';
import {
  Download,
  Eye,
  FileSpreadsheet,
  Printer,
  Award,
} from 'lucide-react';
import {
  INSTITUTION_LOGOS,
  InstitutionalLogo,
  PartnerLogosPair,
} from './InstitutionalLogo';
import {BoardOfDirectorsReportModal} from './BoardOfDirectorsReportModal';
import type {
  CaseRecordView,
  CaseWorkerPerformanceItem,
  EmploymentDistributionItem,
  IncomeBracketItem,
  InstitutionId,
  MonthlyReportPoint,
  ReportsPayload,
  UiThemeAccent,
} from '../types';
import {exportReportsToExcel} from '../utils/excelExport';
import {ServiceDemandForecastWidget} from './ServiceDemandForecastWidget';
import {ScheduledReportsWidget} from './ScheduledReportsWidget';
import {PeriodicReportsManager} from './PeriodicReportsManager';

interface ReportsViewProps {
  cases?: CaseRecordView[];
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  preparedBy?: string;
  generatedAt?: string;
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

const INCOME_COLORS: Record<IncomeBracketItem['key'], string> = {
  under_3m: '#dc2626',
  '3m_to_6m': '#ea580c',
  '6m_to_10m': '#d97706',
  '10m_to_15m': '#0284c7',
  over_15m: '#0f766e',
};

function getInstitutionScopeLabel(filter: InstitutionId | 'all'): string {
  if (filter === 'darolahsan') return 'مؤسسه خیریه دارالاحسان سنندج';
  if (filter === 'edalat') return 'مؤسسه خیریه عدالت و برابری کردستان';
  return 'کل ناحیه منفصل شهری نایسر (مشترک دو مؤسسه)';
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  cases = [],
  isDark = false,
  themeAccent = 'teal',
  preparedBy,
  generatedAt,
  onExportToast,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [pendingDownload, setPendingDownload] = useState(false);
  const [printPreviewMode, setPrintPreviewMode] = useState(false);
  const [isBoardModalOpen, setIsBoardModalOpen] = useState(false);
  const effectiveDark = isDark && !(isPrinting || printPreviewMode);
  const isLightPaper = isPrinting || printPreviewMode;

  const accentHex = effectiveDark
    ? ACCENT_HEX[themeAccent].dark
    : ACCENT_HEX[themeAccent].light;
  const chartColors = {
    textPrimary: effectiveDark ? '#f1f5f9' : '#0f172a',
    textSecondary: effectiveDark ? '#cbd5e1' : '#334155',
    textAxis: effectiveDark ? '#94a3b8' : '#475569',
    textMuted: effectiveDark ? '#94a3b8' : '#64748b',
    gridStroke: effectiveDark ? '#1e293b' : '#e2e8f0',
    axisStroke: effectiveDark ? '#334155' : '#cbd5e1',
    nodeBg: effectiveDark ? '#0f172a' : '#ffffff',
    sliceStroke: effectiveDark ? '#0f172a' : '#ffffff',
    secondaryLine: effectiveDark ? '#38bdf8' : '#0284c7',
  };
  const employmentColors: Record<EmploymentDistributionItem['key'], string> = {
    employed: accentHex,
    job_seeking: effectiveDark ? '#f59e0b' : '#d97706',
    insured: effectiveDark ? '#38bdf8' : '#0284c7',
  };
  const incomeColors: Record<IncomeBracketItem['key'], string> = {
    ...INCOME_COLORS,
    over_15m: accentHex,
  };
  const [institutionFilter, setInstitutionFilter] = useState<InstitutionId | 'all'>('all');
  const [report, setReport] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierChartMode, setTierChartMode] = useState<'stacked' | 'grouped'>('stacked');
  const [pieStyle, setPieStyle] = useState<'pie' | 'donut'>('pie');
  const [incomeMetric, setIncomeMetric] = useState<'count' | 'percentage'>('count');
  const [workerChartMode, setWorkerChartMode] = useState<'combo' | 'scatter'>('combo');
  const [workerSortBy, setWorkerSortBy] = useState<'reviewed' | 'speed'>('reviewed');
  const [workerHBarSortBy, setWorkerHBarSortBy] = useState<'desc' | 'asc' | 'institution'>('desc');

  const [hoveredGrowth, setHoveredGrowth] = useState<MonthlyReportPoint | null>(null);
  const [hoveredTier, setHoveredTier] = useState<MonthlyReportPoint | null>(null);
  const [hoveredEmployment, setHoveredEmployment] =
    useState<EmploymentDistributionItem | null>(null);
  const [hoveredIncome, setHoveredIncome] = useState<IncomeBracketItem | null>(null);
  const [hoveredWorker, setHoveredWorker] = useState<CaseWorkerPerformanceItem | null>(null);
  const [hoveredWorkerHBar, setHoveredWorkerHBar] =
    useState<CaseWorkerPerformanceItem | null>(null);

  const growthContainerRef = useRef<HTMLDivElement | null>(null);
  const growthSvgRef = useRef<SVGSVGElement | null>(null);
  const tierContainerRef = useRef<HTMLDivElement | null>(null);
  const tierSvgRef = useRef<SVGSVGElement | null>(null);
  const pieContainerRef = useRef<HTMLDivElement | null>(null);
  const pieSvgRef = useRef<SVGSVGElement | null>(null);
  const incomeContainerRef = useRef<HTMLDivElement | null>(null);
  const incomeSvgRef = useRef<SVGSVGElement | null>(null);
  const workerContainerRef = useRef<HTMLDivElement | null>(null);
  const workerSvgRef = useRef<SVGSVGElement | null>(null);
  const workerHBarContainerRef = useRef<HTMLDivElement | null>(null);
  const workerHBarSvgRef = useRef<SVGSVGElement | null>(null);
  const workerRadarContainerRef = useRef<HTMLDivElement | null>(null);
  const workerRadarSvgRef = useRef<SVGSVGElement | null>(null);
  const responseContainerRef = useRef<HTMLDivElement | null>(null);
  const responseSvgRef = useRef<SVGSVGElement | null>(null);
  const workerWeeklyContainerRef = useRef<HTMLDivElement | null>(null);
  const workerWeeklySvgRef = useRef<SVGSVGElement | null>(null);
  const stageDurationContainerRef = useRef<HTMLDivElement | null>(null);
  const stageDurationSvgRef = useRef<SVGSVGElement | null>(null);

  const [selectedRadarWorkerId, setSelectedRadarWorkerId] = useState<string>('team_avg');
  const [hoveredResponse, setHoveredResponse] = useState<MonthlyReportPoint | null>(null);
  const [hoveredWorkerWeekly, setHoveredWorkerWeekly] = useState<CaseWorkerPerformanceItem | null>(null);
  const [stageDurationViewMode, setStageDurationViewMode] = useState<'darolahsan' | 'edalat' | 'all'>('all');
  const [hoveredStageDuration, setHoveredStageDuration] = useState<{
    stageKey: string;
    stageLabel: string;
    workerName: string;
    workerId: string;
    institution: InstitutionId;
    days: number;
  } | null>(null);

  const [containerWidths, setContainerWidths] = useState({
    growth: 540,
    tier: 540,
    pie: 340,
    income: 540,
    worker: 580,
    workerHBar: 760,
    workerRadar: 500,
    response: 540,
    workerWeekly: 580,
    stageDuration: 760,
  });

  useEffect(() => {
    let active = true;
    const loadReports = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/reports?institution=${encodeURIComponent(institutionFilter)}`,
        );
        if (!res.ok) throw new Error('خطا در دریافت داده‌های گزارش ۶ ماهه.');
        const data = (await res.json()) as ReportsPayload;
        if (active) setReport(data);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'خطا در بارگذاری گزارش‌ها.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadReports();
    return () => {
      active = false;
    };
  }, [institutionFilter]);

  // Responsive SVG container measurement via ResizeObserver
  useEffect(() => {
    const growthEl = growthContainerRef.current;
    const tierEl = tierContainerRef.current;
    const pieEl = pieContainerRef.current;
    const incomeEl = incomeContainerRef.current;
    const workerEl = workerContainerRef.current;
    const workerHBarEl = workerHBarContainerRef.current;
    const workerRadarEl = workerRadarContainerRef.current;
    const responseEl = responseContainerRef.current;
    const workerWeeklyEl = workerWeeklyContainerRef.current;
    const stageDurationEl = stageDurationContainerRef.current;
    if (!growthEl && !tierEl && !pieEl && !incomeEl && !workerEl && !workerHBarEl && !workerRadarEl && !responseEl && !workerWeeklyEl && !stageDurationEl) return;

    const updateWidths = () => {
      setContainerWidths({
        growth: growthEl ? Math.max(300, Math.floor(growthEl.clientWidth)) : 540,
        tier: tierEl ? Math.max(300, Math.floor(tierEl.clientWidth)) : 540,
        pie: pieEl ? Math.max(260, Math.min(360, Math.floor(pieEl.clientWidth))) : 320,
        income: incomeEl ? Math.max(300, Math.floor(incomeEl.clientWidth)) : 540,
        worker: workerEl ? Math.max(300, Math.floor(workerEl.clientWidth)) : 580,
        workerHBar: workerHBarEl ? Math.max(300, Math.floor(workerHBarEl.clientWidth)) : 760,
        workerRadar: workerRadarEl ? Math.max(300, Math.floor(workerRadarEl.clientWidth)) : 500,
        response: responseEl ? Math.max(300, Math.floor(responseEl.clientWidth)) : 540,
        workerWeekly: workerWeeklyEl ? Math.max(300, Math.floor(workerWeeklyEl.clientWidth)) : 580,
        stageDuration: stageDurationEl ? Math.max(300, Math.floor(stageDurationEl.clientWidth)) : 760,
      });
    };

    updateWidths();
    const observer = new ResizeObserver(updateWidths);
    if (growthEl) observer.observe(growthEl);
    if (tierEl) observer.observe(tierEl);
    if (pieEl) observer.observe(pieEl);
    if (incomeEl) observer.observe(incomeEl);
    if (workerEl) observer.observe(workerEl);
    if (workerHBarEl) observer.observe(workerHBarEl);
    if (workerRadarEl) observer.observe(workerRadarEl);
    if (responseEl) observer.observe(responseEl);
    if (workerWeeklyEl) observer.observe(workerWeeklyEl);
    if (stageDurationEl) observer.observe(stageDurationEl);
    return () => observer.disconnect();
  }, [loading]);

  // Chart 1: D3.js Graduated Families Growth (Area + Line + Interactive Points)
  useEffect(() => {
    if (!report || !growthSvgRef.current) return;
    const data = report.series;
    const width = containerWidths.growth;
    const height = 290;
    const margin = {top: 24, right: 24, bottom: 42, left: 46};
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(growthSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const defs = svg.append('defs');
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'graduatedAreaFill')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', accentHex).attr('stop-opacity', effectiveDark ? 0.32 : 0.24);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', accentHex).attr('stop-opacity', 0.02);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scalePoint<string>()
      .domain(data.map((d) => d.monthLabel))
      .range([0, innerWidth])
      .padding(0.25);

    const maxVal = d3.max(data, (d) => d.graduatedCumulative) ?? 40;
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxVal * 1.18)])
      .nice()
      .range([innerHeight, 0]);

    // Horizontal grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => ''),
      )
      .call((grid) => grid.select('.domain').remove())
      .call((grid) =>
        grid.selectAll('.tick line').attr('stroke', chartColors.gridStroke).attr('stroke-dasharray', '3,3'),
      );

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(12))
      .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke))
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textAxis)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

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
          .attr('fill', chartColors.textMuted)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    // Area path
    const areaGen = d3
      .area<MonthlyReportPoint>()
      .x((d) => x(d.monthLabel) ?? 0)
      .y0(innerHeight)
      .y1((d) => y(d.graduatedCumulative))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#graduatedAreaFill)')
      .attr('d', areaGen);

    // Line path
    const lineGen = d3
      .line<MonthlyReportPoint>()
      .x((d) => x(d.monthLabel) ?? 0)
      .y((d) => y(d.graduatedCumulative))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', accentHex)
      .attr('stroke-width', 2.5)
      .attr('d', lineGen);

    // Secondary line: Monthly New Graduated
    const newLineGen = d3
      .line<MonthlyReportPoint>()
      .x((d) => x(d.monthLabel) ?? 0)
      .y((d) => y(d.graduatedNew))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', chartColors.secondaryLine)
      .attr('stroke-width', 1.75)
      .attr('stroke-dasharray', '4,4')
      .attr('d', newLineGen);

    // Data point nodes + value labels
    const nodes = g
      .selectAll('.growth-node')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'growth-node cursor-pointer')
      .attr('transform', (d) => `translate(${x(d.monthLabel) ?? 0},${y(d.graduatedCumulative)})`)
      .on('mouseenter', (_event, d) => setHoveredGrowth(d))
      .on('mouseleave', () => setHoveredGrowth(null));

    nodes
      .append('circle')
      .attr('r', 5)
      .attr('fill', chartColors.nodeBg)
      .attr('stroke', accentHex)
      .attr('stroke-width', 2.5);

    nodes
      .append('text')
      .attr('y', -11)
      .attr('text-anchor', 'middle')
      .attr('fill', chartColors.textPrimary)
      .style('font-family', 'inherit')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .text((d) => toPersianNum(d.graduatedCumulative));

    // Monthly new dots
    g.selectAll('.new-dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.monthLabel) ?? 0)
      .attr('cy', (d) => y(d.graduatedNew))
      .attr('r', 3.5)
      .attr('fill', chartColors.secondaryLine)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredGrowth(d))
      .on('mouseleave', () => setHoveredGrowth(null));
  }, [report, containerWidths.growth, effectiveDark, themeAccent]);

  // Chart 8: D3.js Response Time Trend Line Chart
  useEffect(() => {
    if (!report || !responseSvgRef.current) return;
    const data = report.series;
    const width = containerWidths.response;
    const height = 290;
    const margin = {top: 24, right: 24, bottom: 42, left: 46};
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(responseSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const defs = svg.append('defs');
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'responseAreaFill')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b').attr('stop-opacity', effectiveDark ? 0.32 : 0.24);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.02);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scalePoint<string>()
      .domain(data.map((d) => d.monthLabel))
      .range([0, innerWidth])
      .padding(0.25);

    const maxVal = d3.max(data, (d) => d.avgResponseDays) ?? 20;
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxVal * 1.25)])
      .nice()
      .range([innerHeight, 0]);

    // Horizontal grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => ''),
      )
      .call((grid) => grid.select('.domain').remove())
      .call((grid) =>
        grid.selectAll('.tick line').attr('stroke', chartColors.gridStroke).attr('stroke-dasharray', '3,3'),
      );

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(12))
      .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke))
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textAxis)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    // Y Axis
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((val) => `${toPersianNum(Number(val))} روز`),
      )
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('.tick line').remove())
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textMuted)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    // Area path
    const areaGen = d3
      .area<MonthlyReportPoint>()
      .x((d) => x(d.monthLabel) ?? 0)
      .y0(innerHeight)
      .y1((d) => y(d.avgResponseDays))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#responseAreaFill)')
      .attr('d', areaGen);

    // Line path
    const lineGen = d3
      .line<MonthlyReportPoint>()
      .x((d) => x(d.monthLabel) ?? 0)
      .y((d) => y(d.avgResponseDays))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.5)
      .attr('d', lineGen);

    // Data point nodes
    const nodes = g
      .selectAll('.response-node')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'response-node cursor-pointer')
      .attr('transform', (d) => `translate(${x(d.monthLabel) ?? 0},${y(d.avgResponseDays)})`)
      .on('mouseenter', (_event, d) => setHoveredResponse(d))
      .on('mouseleave', () => setHoveredResponse(null));

    nodes
      .append('circle')
      .attr('r', 5)
      .attr('fill', chartColors.nodeBg)
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.5);

    nodes
      .append('text')
      .attr('y', -11)
      .attr('text-anchor', 'middle')
      .attr('fill', chartColors.textPrimary)
      .style('font-family', 'inherit')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .text((d) => `${toPersianNum(d.avgResponseDays)} روز`);
  }, [report, containerWidths.response, effectiveDark, themeAccent]);

  // Chart 2: D3.js Case Tier Distribution (Stacked or Grouped Bar Chart)
  useEffect(() => {
    if (!report || !tierSvgRef.current) return;
    const data = report.series;
    const width = containerWidths.tier;
    const height = 290;
    const margin = {top: 24, right: 20, bottom: 42, left: 46};
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(tierSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const keys = ['redTier', 'yellowTier', 'greenTier'] as const;
    const colorMap: Record<(typeof keys)[number], string> = {
      redTier: '#dc2626',
      yellowTier: '#d97706',
      greenTier: '#16a34a',
    };

    const x0 = d3
      .scaleBand<string>()
      .domain(data.map((d) => d.monthLabel))
      .range([0, innerWidth])
      .padding(0.28);

    const maxY =
      tierChartMode === 'stacked'
        ? d3.max(data, (d) => d.redTier + d.yellowTier + d.greenTier) ?? 150
        : d3.max(data, (d) => Math.max(d.redTier, d.yellowTier, d.greenTier)) ?? 80;

    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxY * 1.12)])
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
        grid.selectAll('.tick line').attr('stroke', chartColors.gridStroke).attr('stroke-dasharray', '3,3'),
      );

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0).tickSize(0).tickPadding(12))
      .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke))
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textAxis)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

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
          .attr('fill', chartColors.textMuted)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    if (tierChartMode === 'stacked') {
      const stackGen = d3.stack<MonthlyReportPoint>().keys(keys);
      const stackedSeries = stackGen(data);

      g.selectAll('.tier-layer')
        .data(stackedSeries)
        .enter()
        .append('g')
        .attr('fill', (d) => colorMap[d.key as (typeof keys)[number]])
        .selectAll('rect')
        .data((d) => d)
        .enter()
        .append('rect')
        .attr('x', (d) => x0(d.data.monthLabel) ?? 0)
        .attr('y', (d) => y(d[1]))
        .attr('height', (d) => Math.max(0, y(d[0]) - y(d[1])))
        .attr('width', x0.bandwidth())
        .attr('rx', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', (_event, d) => setHoveredTier(d.data))
        .on('mouseleave', () => setHoveredTier(null));
    } else {
      const x1 = d3
        .scaleBand<string>()
        .domain(keys)
        .range([0, x0.bandwidth()])
        .padding(0.12);

      const monthGroups = g
        .selectAll('.month-group')
        .data(data)
        .enter()
        .append('g')
        .attr('transform', (d) => `translate(${x0(d.monthLabel) ?? 0},0)`)
        .style('cursor', 'pointer')
        .on('mouseenter', (_event, d) => setHoveredTier(d))
        .on('mouseleave', () => setHoveredTier(null));

      monthGroups
        .selectAll('rect')
        .data((d) =>
          keys.map((key) => ({
            key,
            value: d[key],
          })),
        )
        .enter()
        .append('rect')
        .attr('x', (d) => x1(d.key) ?? 0)
        .attr('y', (d) => y(d.value))
        .attr('width', x1.bandwidth())
        .attr('height', (d) => Math.max(0, innerHeight - y(d.value)))
        .attr('rx', 3)
        .attr('fill', (d) => colorMap[d.key]);
    }
  }, [report, tierChartMode, containerWidths.tier, effectiveDark, themeAccent]);

  // Chart 3: D3.js Household Employment Status Distribution (Pie / Donut Chart)
  useEffect(() => {
    if (!report || !pieSvgRef.current) return;
    const data = report.employmentDistribution;
    const size = containerWidths.pie;
    const radius = Math.floor(size / 2) - 18;
    const innerRadius = pieStyle === 'donut' ? Math.floor(radius * 0.54) : 0;

    const svg = d3.select(pieSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${size} ${size}`).attr('width', size).attr('height', size);

    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    const pieGen = d3
      .pie<EmploymentDistributionItem>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.02);

    const arcGen = d3
      .arc<d3.PieArcDatum<EmploymentDistributionItem>>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const hoverArcGen = d3
      .arc<d3.PieArcDatum<EmploymentDistributionItem>>()
      .innerRadius(innerRadius)
      .outerRadius(radius + 6);

    const labelArcGen = d3
      .arc<d3.PieArcDatum<EmploymentDistributionItem>>()
      .innerRadius(pieStyle === 'donut' ? (innerRadius + radius) / 2 : radius * 0.62)
      .outerRadius(pieStyle === 'donut' ? (innerRadius + radius) / 2 : radius * 0.62);

    const slices = g
      .selectAll('.employment-slice')
      .data(pieGen(data))
      .enter()
      .append('g')
      .attr('class', 'employment-slice cursor-pointer');

    slices
      .append('path')
      .attr('d', arcGen)
      .attr('fill', (d) => employmentColors[d.data.key])
      .attr('stroke', chartColors.sliceStroke)
      .attr('stroke-width', 2)
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('d', hoverArcGen(d) || '');
        setHoveredEmployment(d.data);
      })
      .on('mouseleave', function (_event, d) {
        d3.select(this).attr('d', arcGen(d) || '');
        setHoveredEmployment(null);
      });

    slices
      .append('text')
      .attr('transform', (d) => `translate(${labelArcGen.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#ffffff')
      .style('font-family', 'inherit')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('pointer-events', 'none')
      .text((d) => `${toPersianNum(d.data.percentage)}٪`);

    if (pieStyle === 'donut') {
      const totalHouseholds = d3.sum(data, (d) => d.count);
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', -6)
        .attr('fill', chartColors.textPrimary)
        .style('font-family', 'inherit')
        .style('font-size', '20px')
        .style('font-weight', '700')
        .text(toPersianNum(totalHouseholds));

      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 16)
        .attr('fill', chartColors.textMuted)
        .style('font-family', 'inherit')
        .style('font-size', '11px')
        .text('کل خانوارها');
    }
  }, [report, pieStyle, containerWidths.pie, effectiveDark, themeAccent]);

  // Chart 4: D3.js Household Income Level Distribution (Vertical Bar Chart)
  useEffect(() => {
    if (!report || !incomeSvgRef.current) return;
    const data = report.incomeDistribution;
    const width = containerWidths.income;
    const height = 300;
    const margin = {top: 28, right: 20, bottom: 48, left: 48};
    const innerWidth = Math.max(140, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(incomeSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand<string>()
      .domain(data.map((d) => d.shortLabel))
      .range([0, innerWidth])
      .padding(0.32);

    const getVal = (d: IncomeBracketItem) =>
      incomeMetric === 'count' ? d.count : d.percentage;

    const maxVal = d3.max(data, getVal) ?? 50;
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxVal * 1.18)])
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
        grid.selectAll('.tick line').attr('stroke', chartColors.gridStroke).attr('stroke-dasharray', '3,3'),
      );

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(12))
      .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke))
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textSecondary)
          .style('font-family', 'inherit')
          .style('font-size', '11px')
          .style('font-weight', '500'),
      );

    // Y Axis
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((val) =>
            incomeMetric === 'percentage'
              ? `${toPersianNum(Number(val))}٪`
              : toPersianNum(Number(val)),
          ),
      )
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('.tick line').remove())
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textMuted)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    const bars = g
      .selectAll('.income-bar-group')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'income-bar-group cursor-pointer')
      .on('mouseenter', (_event, d) => setHoveredIncome(d))
      .on('mouseleave', () => setHoveredIncome(null));

    bars
      .append('rect')
      .attr('x', (d) => x(d.shortLabel) ?? 0)
      .attr('y', (d) => y(getVal(d)))
      .attr('width', x.bandwidth())
      .attr('height', (d) => Math.max(0, innerHeight - y(getVal(d))))
      .attr('rx', 4)
      .attr('fill', (d) => incomeColors[d.key])
      .attr('opacity', (d) =>
        hoveredIncome && hoveredIncome.key !== d.key ? 0.55 : 0.92,
      );

    bars
      .append('text')
      .attr('x', (d) => (x(d.shortLabel) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(getVal(d)) - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', chartColors.textPrimary)
      .style('font-family', 'inherit')
      .style('font-size', '11px')
      .style('font-weight', '600')
      .text((d) =>
        incomeMetric === 'percentage'
          ? `${toPersianNum(d.percentage)}٪`
          : `${toPersianNum(d.count)} (${toPersianNum(d.percentage)}٪)`,
      );
  }, [report, incomeMetric, containerWidths.income, hoveredIncome, effectiveDark, themeAccent]);

  const sortedWorkers = useMemo(() => {
    if (!report?.caseWorkerPerformance) return [];
    const copy = [...report.caseWorkerPerformance];
    if (workerSortBy === 'speed') {
      copy.sort((a, b) => a.avgTransitionDays - b.avgTransitionDays || b.reviewedCasesCount - a.reviewedCasesCount);
    } else {
      copy.sort((a, b) => b.reviewedCasesCount - a.reviewedCasesCount || a.avgTransitionDays - b.avgTransitionDays);
    }
    return copy;
  }, [report, workerSortBy]);

  const workerSummary = useMemo(() => {
    if (sortedWorkers.length === 0) {
      return {totalReviewed: 0, totalTransitions: 0, avgDays: 0};
    }
    const totalReviewed = sortedWorkers.reduce((sum, w) => sum + w.reviewedCasesCount, 0);
    const totalTransitions = sortedWorkers.reduce((sum, w) => sum + w.stageTransitionsCount, 0);
    const avgDays = Number(
      (
        sortedWorkers.reduce((sum, w) => sum + w.avgTransitionDays, 0) /
        sortedWorkers.length
      ).toFixed(1),
    );
    return {totalReviewed, totalTransitions, avgDays};
  }, [sortedWorkers]);

  // Chart 5: D3.js Case Worker Monthly Performance Dashboard (Combo Dual-Axis or Speed/Volume Matrix)
  useEffect(() => {
    if (!report || sortedWorkers.length === 0 || !workerSvgRef.current) return;
    const data = sortedWorkers;
    const width = containerWidths.worker;
    const height = 320;
    const margin =
      workerChartMode === 'combo'
        ? {top: 32, right: 54, bottom: 52, left: 48}
        : {top: 32, right: 28, bottom: 52, left: 56};
    const innerWidth = Math.max(160, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(workerSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const getInstColor = (inst: InstitutionId) =>
      inst === 'darolahsan' ? accentHex : chartColors.secondaryLine;
    const speedStrokeColor = effectiveDark ? '#fbbf24' : '#d97706';

    if (workerChartMode === 'combo') {
      const x = d3
        .scaleBand<string>()
        .domain(data.map((d) => d.name))
        .range([0, innerWidth])
        .padding(0.36);

      const maxReviewed = d3.max(data, (d) => d.reviewedCasesCount) ?? 40;
      const yLeft = d3
        .scaleLinear()
        .domain([0, Math.ceil(maxReviewed * 1.22)])
        .nice()
        .range([innerHeight, 0]);

      const maxDays = d3.max(data, (d) => d.avgTransitionDays) ?? 12;
      const yRight = d3
        .scaleLinear()
        .domain([0, Math.ceil(maxDays * 1.25)])
        .nice()
        .range([innerHeight, 0]);

      // Horizontal grid lines (based on left Y axis)
      g.append('g')
        .call(
          d3
            .axisLeft(yLeft)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat(() => ''),
        )
        .call((grid) => grid.select('.domain').remove())
        .call((grid) =>
          grid.selectAll('.tick line').attr('stroke', chartColors.gridStroke).attr('stroke-dasharray', '3,3'),
        );

      // X Axis (Worker Names)
      const xAxisGroup = g
        .append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickSize(0).tickPadding(12))
        .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke));

      xAxisGroup
        .selectAll('text')
        .attr('fill', chartColors.textSecondary)
        .style('font-family', 'inherit')
        .style('font-size', innerWidth < 460 ? '10px' : '11px')
        .style('font-weight', '600')
        .attr('transform', innerWidth < 460 ? 'rotate(-20)' : null)
        .style('text-anchor', innerWidth < 460 ? 'end' : 'middle');

      // Left Y Axis (Reviewed Cases Count)
      g.append('g')
        .call(
          d3
            .axisLeft(yLeft)
            .ticks(5)
            .tickFormat((val) => toPersianNum(Number(val))),
        )
        .call((axis) => axis.select('.domain').remove())
        .call((axis) => axis.selectAll('.tick line').remove())
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', chartColors.textMuted)
            .style('font-family', 'inherit')
            .style('font-size', '11px'),
        );

      // Left Y Axis Title
      g.append('text')
        .attr('x', 0)
        .attr('y', -14)
        .attr('text-anchor', 'start')
        .attr('fill', chartColors.textMuted)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .text('تعداد پرونده');

      // Right Y Axis (Avg Stage Transition Speed in Days)
      g.append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .call(
          d3
            .axisRight(yRight)
            .ticks(5)
            .tickFormat((val) => `${toPersianNum(Number(val))} ر`),
        )
        .call((axis) => axis.select('.domain').remove())
        .call((axis) => axis.selectAll('.tick line').remove())
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', speedStrokeColor)
            .style('font-family', 'inherit')
            .style('font-size', '11px'),
        );

      // Right Y Axis Title
      g.append('text')
        .attr('x', innerWidth)
        .attr('y', -14)
        .attr('text-anchor', 'end')
        .attr('fill', speedStrokeColor)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .text('سرعت جابجایی (روز)');

      // Bars for reviewedCasesCount
      const bars = g
        .selectAll('.worker-bar-group')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'worker-bar-group cursor-pointer')
        .on('mouseenter', (_event, d) => setHoveredWorker(d))
        .on('mouseleave', () => setHoveredWorker(null));

      bars
        .append('rect')
        .attr('x', (d) => x(d.name) ?? 0)
        .attr('y', (d) => yLeft(d.reviewedCasesCount))
        .attr('width', x.bandwidth())
        .attr('height', (d) => Math.max(0, innerHeight - yLeft(d.reviewedCasesCount)))
        .attr('rx', 4)
        .attr('fill', (d) => getInstColor(d.institution))
        .attr('opacity', (d) =>
          hoveredWorker && hoveredWorker.id !== d.id ? 0.42 : 0.86,
        );

      bars
        .append('text')
        .attr('x', (d) => (x(d.name) ?? 0) + x.bandwidth() / 2)
        .attr('y', (d) => Math.max(12, yLeft(d.reviewedCasesCount) - 7))
        .attr('text-anchor', 'middle')
        .attr('fill', chartColors.textPrimary)
        .style('font-family', 'inherit')
        .style('font-size', '11px')
        .style('font-weight', '700')
        .text((d) => toPersianNum(d.reviewedCasesCount));

      // Line overlay for avgTransitionDays (speed)
      const speedLineGen = d3
        .line<CaseWorkerPerformanceItem>()
        .x((d) => (x(d.name) ?? 0) + x.bandwidth() / 2)
        .y((d) => yRight(d.avgTransitionDays))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', speedStrokeColor)
        .attr('stroke-width', 2.25)
        .attr('stroke-dasharray', '5,4')
        .attr('d', speedLineGen);

      const speedNodes = g
        .selectAll('.worker-speed-node')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'worker-speed-node cursor-pointer')
        .attr(
          'transform',
          (d) =>
            `translate(${(x(d.name) ?? 0) + x.bandwidth() / 2},${yRight(d.avgTransitionDays)})`,
        )
        .on('mouseenter', (_event, d) => setHoveredWorker(d))
        .on('mouseleave', () => setHoveredWorker(null));

      speedNodes
        .append('circle')
        .attr('r', (d) => (hoveredWorker?.id === d.id ? 6.5 : 4.5))
        .attr('fill', chartColors.nodeBg)
        .attr('stroke', speedStrokeColor)
        .attr('stroke-width', 2.5);

      speedNodes
        .append('text')
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('fill', speedStrokeColor)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .text((d) => `${toPersianNum(d.avgTransitionDays)} ر`);
    } else {
      // Scatter Quadrant Matrix: X = Reviewed Cases Count, Y = Avg Transition Days (inverted: top = fastest)
      const minReviewed = Math.max(0, (d3.min(data, (d) => d.reviewedCasesCount) ?? 15) - 5);
      const maxReviewed = (d3.max(data, (d) => d.reviewedCasesCount) ?? 38) + 5;
      const x = d3.scaleLinear().domain([minReviewed, maxReviewed]).nice().range([0, innerWidth]);

      const minDays = Math.max(2, (d3.min(data, (d) => d.avgTransitionDays) ?? 5) - 1.5);
      const maxDays = (d3.max(data, (d) => d.avgTransitionDays) ?? 11) + 1.5;
      // Inverted Y scale so faster (fewer days) is higher up
      const y = d3.scaleLinear().domain([maxDays, minDays]).nice().range([innerHeight, 0]);

      const sizeScale = d3
        .scaleSqrt<number>()
        .domain([
          d3.min(data, (d) => d.stageTransitionsCount) ?? 10,
          d3.max(data, (d) => d.stageTransitionsCount) ?? 30,
        ])
        .range([10, 19]);

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
          grid.selectAll('.tick line').attr('stroke', chartColors.gridStroke).attr('stroke-dasharray', '3,3'),
        );

      // X Axis
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(
          d3
            .axisBottom(x)
            .ticks(5)
            .tickFormat((val) => toPersianNum(Number(val))),
        )
        .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke))
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', chartColors.textAxis)
            .style('font-family', 'inherit')
            .style('font-size', '11px'),
        );

      // X Axis Label
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 38)
        .attr('text-anchor', 'middle')
        .attr('fill', chartColors.textMuted)
        .style('font-family', 'inherit')
        .style('font-size', '11px')
        .text('تعداد پرونده‌های بررسی‌شده در ماه گذشته');

      // Y Axis
      g.append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(5)
            .tickFormat((val) => `${toPersianNum(Number(val))} روز`),
        )
        .call((axis) => axis.select('.domain').remove())
        .call((axis) => axis.selectAll('.tick line').remove())
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', chartColors.textMuted)
            .style('font-family', 'inherit')
            .style('font-size', '11px'),
        );

      // Y Axis Label
      g.append('text')
        .attr('x', 0)
        .attr('y', -14)
        .attr('text-anchor', 'start')
        .attr('fill', speedStrokeColor)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .text('بالاتر = سرعت جابجایی بیشتر (روز کمتر)');

      // Average Crosshair Lines
      const avgRev = d3.mean(data, (d) => d.reviewedCasesCount) ?? 25;
      const avgDaysVal = d3.mean(data, (d) => d.avgTransitionDays) ?? 7.5;

      g.append('line')
        .attr('x1', x(avgRev))
        .attr('x2', x(avgRev))
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', chartColors.axisStroke)
        .attr('stroke-dasharray', '4,4');

      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', y(avgDaysVal))
        .attr('y2', y(avgDaysVal))
        .attr('stroke', chartColors.axisStroke)
        .attr('stroke-dasharray', '4,4');

      // Top-right quadrant indicator label
      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', 14)
        .attr('text-anchor', 'end')
        .attr('fill', accentHex)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .style('font-weight', '600')
        .text('حجم بالا و جابجایی سریع');

      const bubbles = g
        .selectAll('.worker-bubble')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'worker-bubble cursor-pointer')
        .attr('transform', (d) => `translate(${x(d.reviewedCasesCount)},${y(d.avgTransitionDays)})`)
        .on('mouseenter', (_event, d) => setHoveredWorker(d))
        .on('mouseleave', () => setHoveredWorker(null));

      bubbles
        .append('circle')
        .attr('r', (d) => sizeScale(d.stageTransitionsCount))
        .attr('fill', (d) => getInstColor(d.institution))
        .attr('fill-opacity', (d) =>
          hoveredWorker && hoveredWorker.id !== d.id ? 0.35 : 0.78,
        )
        .attr('stroke', chartColors.nodeBg)
        .attr('stroke-width', 2);

      bubbles
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', '#ffffff')
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .style('pointer-events', 'none')
        .text((d) => toPersianNum(d.stageTransitionsCount));

      bubbles
        .append('text')
        .attr('y', (d) => -sizeScale(d.stageTransitionsCount) - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', chartColors.textPrimary)
        .style('font-family', 'inherit')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .text((d) => d.name);
    }
  }, [
    report,
    sortedWorkers,
    workerChartMode,
    containerWidths.worker,
    hoveredWorker,
    effectiveDark,
    themeAccent,
  ]);

  // Chart: Average Case Duration in 6 Workflow Stages per Caseworker
  useEffect(() => {
    if (!report || !stageDurationSvgRef.current) return;
    const workers = report.caseWorkerPerformance.filter(
      (w) => stageDurationViewMode === 'all' || w.institution === stageDurationViewMode
    );
    if (workers.length === 0) return;

    const width = containerWidths.stageDuration;
    const height = 340;
    const margin = {top: 32, right: 30, bottom: 56, left: 52};
    const innerWidth = Math.max(160, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(stageDurationSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const stagesData = [
      {key: 'stage1', label: 'مرحله ۱: پذیرش'},
      {key: 'stage2', label: 'مرحله ۲: ارزیابی'},
      {key: 'stage3', label: 'مرحله ۳: برنامه'},
      {key: 'stage4', label: 'مرحله ۴: اجرا'},
      {key: 'stage5', label: 'مرحله ۵: پایش'},
      {key: 'stage6', label: 'مرحله ۶: خروج'},
    ];

    const x0 = d3
      .scaleBand<string>()
      .domain(stagesData.map((s) => s.label))
      .range([0, innerWidth])
      .padding(0.2);

    const x1 = d3
      .scaleBand<string>()
      .domain(workers.map((w) => w.name))
      .range([0, x0.bandwidth()])
      .padding(0.06);

    const maxDays =
      d3.max(workers, (w) =>
        Math.max(
          w.stageDurations.stage1,
          w.stageDurations.stage2,
          w.stageDurations.stage3,
          w.stageDurations.stage4,
          w.stageDurations.stage5,
          w.stageDurations.stage6,
        ),
      ) ?? 55;

    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxDays * 1.18)])
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
        grid.selectAll('.tick line').attr('stroke', chartColors.gridStroke).attr('stroke-dasharray', '3,3'),
      );

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x0).tickSize(0).tickPadding(12))
      .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke))
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textAxis)
          .style('font-family', 'inherit')
          .style('font-size', innerWidth < 520 ? '9px' : '11px')
          .style('font-weight', '600'),
      );

    // Y Axis
    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((val) => `${toPersianNum(Number(val))} ر`),
      )
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('.tick line').remove())
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textMuted)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    // Y Axis Title
    g.append('text')
      .attr('x', 0)
      .attr('y', -14)
      .attr('text-anchor', 'start')
      .attr('fill', chartColors.textMuted)
      .style('font-family', 'inherit')
      .style('font-size', '10px')
      .text('مدت حضور (روز)');

    const workerPalette = [accentHex, chartColors.secondaryLine, '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

    const stageGroups = g
      .selectAll('.stage-group')
      .data(stagesData)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${x0(d.label) ?? 0},0)`);

    stageGroups
      .selectAll('rect')
      .data((stage) =>
        workers.map((w) => ({
          stageKey: stage.key,
          stageLabel: stage.label,
          workerName: w.name,
          workerId: w.id,
          institution: w.institution,
          days: w.stageDurations[stage.key as keyof typeof w.stageDurations],
        })),
      )
      .enter()
      .append('rect')
      .attr('x', (d) => x1(d.workerName) ?? 0)
      .attr('y', (d) => y(d.days))
      .attr('width', x1.bandwidth())
      .attr('height', (d) => Math.max(0, innerHeight - y(d.days)))
      .attr('rx', 3)
      .attr('fill', (_d, i) => workerPalette[i % workerPalette.length])
      .attr('opacity', (d) =>
        hoveredStageDuration && hoveredStageDuration.workerId !== d.workerId ? 0.45 : 0.92,
      )
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => setHoveredStageDuration(d))
      .on('mouseleave', () => setHoveredStageDuration(null));
  }, [
    report,
    stageDurationViewMode,
    containerWidths.stageDuration,
    hoveredStageDuration,
    effectiveDark,
    themeAccent,
  ]);

  const sortedCurrentMonthWorkers = useMemo(() => {
    if (!report?.caseWorkerPerformance) return [];
    const copy = [...report.caseWorkerPerformance];
    if (workerHBarSortBy === 'asc') {
      copy.sort(
        (a, b) =>
          a.currentMonthReviewedCount - b.currentMonthReviewedCount ||
          a.name.localeCompare(b.name, 'fa'),
      );
    } else if (workerHBarSortBy === 'institution') {
      copy.sort(
        (a, b) =>
          a.institution.localeCompare(b.institution) ||
          b.currentMonthReviewedCount - a.currentMonthReviewedCount,
      );
    } else {
      copy.sort(
        (a, b) =>
          b.currentMonthReviewedCount - a.currentMonthReviewedCount ||
          b.onTimeFollowUpPct - a.onTimeFollowUpPct,
      );
    }
    return copy;
  }, [report, workerHBarSortBy]);

  const currentMonthSummary = useMemo(() => {
    if (sortedCurrentMonthWorkers.length === 0) {
      return {
        totalReviewed: 0,
        totalTarget: 0,
        avgReviewed: 0,
        overallPct: 0,
        topWorker: null as CaseWorkerPerformanceItem | null,
      };
    }
    const totalReviewed = sortedCurrentMonthWorkers.reduce(
      (sum, w) => sum + w.currentMonthReviewedCount,
      0,
    );
    const totalTarget = sortedCurrentMonthWorkers.reduce(
      (sum, w) => sum + w.currentMonthTargetCount,
      0,
    );
    const avgReviewed = Number(
      (totalReviewed / sortedCurrentMonthWorkers.length).toFixed(1),
    );
    const overallPct = totalTarget > 0 ? Math.round((totalReviewed / totalTarget) * 100) : 0;
    const topWorker = [...sortedCurrentMonthWorkers].sort(
      (a, b) => b.currentMonthReviewedCount - a.currentMonthReviewedCount,
    )[0];
    return {totalReviewed, totalTarget, avgReviewed, overallPct, topWorker};
  }, [sortedCurrentMonthWorkers]);

  // Chart 6: D3.js Current-Month Case Worker Reviewed Cases (Horizontal Bar Chart)
  useEffect(() => {
    if (!report || sortedCurrentMonthWorkers.length === 0 || !workerHBarSvgRef.current) return;
    const data = sortedCurrentMonthWorkers;
    const width = containerWidths.workerHBar;
    const isCompact = width < 540;
    const height = Math.max(260, data.length * 48 + 74);
    const margin = {
      top: 34,
      right: isCompact ? 76 : 106,
      bottom: 42,
      left: isCompact ? 118 : 156,
    };
    const innerWidth = Math.max(140, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(workerHBarSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const getInstColor = (inst: InstitutionId) =>
      inst === 'darolahsan' ? accentHex : chartColors.secondaryLine;
    const targetMarkerColor = effectiveDark ? '#f59e0b' : '#b45309';
    const trackFill = effectiveDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.14)';

    const maxDataVal = Math.max(
      d3.max(data, (d) => d.currentMonthReviewedCount) ?? 25,
      d3.max(data, (d) => d.currentMonthTargetCount) ?? 30,
    );

    const x = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxDataVal * 1.15)])
      .nice()
      .range([0, innerWidth]);

    const y = d3
      .scaleBand<string>()
      .domain(data.map((d) => d.name))
      .range([0, innerHeight])
      .padding(0.32);

    // Vertical grid lines
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(isCompact ? 4 : 6)
          .tickSize(-innerHeight)
          .tickFormat(() => ''),
      )
      .call((grid) => grid.select('.domain').remove())
      .call((grid) =>
        grid
          .selectAll('.tick line')
          .attr('stroke', chartColors.gridStroke)
          .attr('stroke-dasharray', '3,3'),
      );

    // X Axis (bottom numeric ticks)
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(isCompact ? 4 : 6)
          .tickFormat((val) => toPersianNum(Number(val))),
      )
      .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke))
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', chartColors.textAxis)
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    // X Axis Caption
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 34)
      .attr('text-anchor', 'middle')
      .attr('fill', chartColors.textMuted)
      .style('font-family', 'inherit')
      .style('font-size', '11px')
      .text('تعداد پرونده‌های بررسی‌شده در ماه جاری');

    // Y Axis (Worker Names)
    const yAxisGroup = g
      .append('g')
      .call(d3.axisLeft(y).tickSize(0).tickPadding(14))
      .call((axis) => axis.select('.domain').attr('stroke', chartColors.axisStroke));

    yAxisGroup
      .selectAll('text')
      .attr('fill', chartColors.textPrimary)
      .style('font-family', 'inherit')
      .style('font-size', isCompact ? '11px' : '12px')
      .style('font-weight', '600');

    // Team Average Vertical Dashed Reference Line
    const teamAvg = d3.mean(data, (d) => d.currentMonthReviewedCount) ?? 0;
    if (teamAvg > 0) {
      const avgX = x(teamAvg);
      g.append('line')
        .attr('x1', avgX)
        .attr('x2', avgX)
        .attr('y1', -6)
        .attr('y2', innerHeight)
        .attr('stroke', chartColors.textMuted)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4');

      const clampedLabelX = Math.max(48, Math.min(innerWidth - 48, avgX));
      g.append('text')
        .attr('x', clampedLabelX)
        .attr('y', -13)
        .attr('text-anchor', 'middle')
        .attr('fill', chartColors.textSecondary)
        .style('font-family', 'inherit')
        .style('font-size', '10.5px')
        .style('font-weight', '600')
        .text(`میانگین تیم: ${toPersianNum(Number(teamAvg.toFixed(1)))} پرونده`);
    }

    // Horizontal Bar Groups
    const rows = g
      .selectAll('.worker-hbar-row')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'worker-hbar-row cursor-pointer')
      .on('mouseenter', (_event, d) => setHoveredWorkerHBar(d))
      .on('mouseleave', () => setHoveredWorkerHBar(null));

    // Background Target Quota Track
    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => y(d.name) ?? 0)
      .attr('width', (d) => Math.max(0, x(d.currentMonthTargetCount)))
      .attr('height', y.bandwidth())
      .attr('rx', 6)
      .attr('fill', trackFill);

    // Institution Color Dot adjacent to Y Axis label
    rows
      .append('circle')
      .attr('cx', -7)
      .attr('cy', (d) => (y(d.name) ?? 0) + y.bandwidth() / 2)
      .attr('r', 3.5)
      .attr('fill', (d) => getInstColor(d.institution));

    // Primary Horizontal Bar (Current Month Reviewed Count)
    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => y(d.name) ?? 0)
      .attr('width', (d) => Math.max(4, x(d.currentMonthReviewedCount)))
      .attr('height', y.bandwidth())
      .attr('rx', 6)
      .attr('fill', (d) => getInstColor(d.institution))
      .attr('opacity', (d) =>
        hoveredWorkerHBar && hoveredWorkerHBar.id !== d.id ? 0.36 : 0.9,
      )
      .attr('stroke', (d) =>
        hoveredWorkerHBar?.id === d.id ? chartColors.textPrimary : 'none',
      )
      .attr('stroke-width', (d) => (hoveredWorkerHBar?.id === d.id ? 1.5 : 0));

    // Target Benchmark Notch per Worker
    rows
      .append('line')
      .attr('x1', (d) => x(d.currentMonthTargetCount))
      .attr('x2', (d) => x(d.currentMonthTargetCount))
      .attr('y1', (d) => (y(d.name) ?? 0) - 2)
      .attr('y2', (d) => (y(d.name) ?? 0) + y.bandwidth() + 2)
      .attr('stroke', targetMarkerColor)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('opacity', (d) =>
        hoveredWorkerHBar && hoveredWorkerHBar.id !== d.id ? 0.45 : 0.9,
      );

    // Right-end Numeric Value Label (Placed after whichever is further: bar end or target notch if close)
    rows
      .append('text')
      .attr('x', (d) => {
        const barEnd = x(d.currentMonthReviewedCount);
        const targetEnd = x(d.currentMonthTargetCount);
        return Math.max(barEnd, targetEnd > barEnd && targetEnd - barEnd < 18 ? targetEnd : barEnd) + 8;
      })
      .attr('y', (d) => (y(d.name) ?? 0) + y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('fill', chartColors.textPrimary)
      .style('font-family', 'inherit')
      .style('font-size', isCompact ? '10.5px' : '11.5px')
      .style('font-weight', '700')
      .text((d) => {
        const pct =
          d.currentMonthTargetCount > 0
            ? Math.round((d.currentMonthReviewedCount / d.currentMonthTargetCount) * 100)
            : 0;
        return isCompact
          ? `${toPersianNum(d.currentMonthReviewedCount)} پرونده`
          : `${toPersianNum(d.currentMonthReviewedCount)} پرونده (${toPersianNum(pct)}٪)`;
      });
  }, [
    report,
    sortedCurrentMonthWorkers,
    containerWidths.workerHBar,
    hoveredWorkerHBar,
    effectiveDark,
    themeAccent,
  ]);

  // Chart 7: D3.js Radar Chart for Case Worker 5 Key Performance Indicators
  useEffect(() => {
    if (!report || report.caseWorkerPerformance.length === 0 || !workerRadarSvgRef.current) return;
    const workers = report.caseWorkerPerformance;
    const width = containerWidths.workerRadar;
    const height = 360;
    const margin = {top: 40, right: 50, bottom: 40, left: 50};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const cx = innerWidth / 2 + margin.left;
    const cy = innerHeight / 2 + margin.top;
    const radius = Math.min(innerWidth, innerHeight) / 2 - 24;

    const svg = d3.select(workerRadarSvgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const axes = [
      {key: 'recordSpeedScore', label: 'سرعت ثبت پرونده'},
      {key: 'assessmentAccuracyScore', label: 'دقت در ارزیابی'},
      {key: 'onTimeFollowUpScore', label: 'پیگیری به‌موقع'},
      {key: 'conflictResolutionScore', label: 'حل‌وفصل تعارضات'},
      {key: 'documentationQualityScore', label: 'کیفیت مستندسازی'},
    ];

    const levels = [25, 50, 75, 100];
    const gridColor = effectiveDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.25)';
    const textColor = chartColors.textPrimary;
    const mutedTextColor = chartColors.textMuted;

    // Draw concentric polygon grid levels
    levels.forEach((lvl) => {
      const lvlR = (radius * lvl) / 100;
      const points = axes.map((_, i) => {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        return [cx + lvlR * Math.cos(angle), cy + lvlR * Math.sin(angle)];
      });
      svg.append('polygon')
        .attr('points', points.map((p) => p.join(',')).join(' '))
        .attr('fill', 'none')
        .attr('stroke', gridColor)
        .attr('stroke-width', lvl === 100 ? 1.5 : 1)
        .attr('stroke-dasharray', lvl === 100 ? 'none' : '3,3');

      if (lvl < 100) {
        svg.append('text')
          .attr('x', cx + 4)
          .attr('y', cy - lvlR)
          .attr('fill', mutedTextColor)
          .style('font-family', 'inherit')
          .style('font-size', '9px')
          .text(toPersianNum(lvl));
      }
    });

    // Draw axis lines and labels
    axes.forEach((axis, i) => {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const x2 = cx + radius * Math.cos(angle);
      const y2 = cy + radius * Math.sin(angle);

      svg.append('line')
        .attr('x1', cx)
        .attr('y1', cy)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', gridColor)
        .attr('stroke-width', 1);

      const labelDist = radius + 22;
      const lx = cx + labelDist * Math.cos(angle);
      const ly = cy + labelDist * Math.sin(angle);
      const anchor = Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';

      svg.append('text')
        .attr('x', lx)
        .attr('y', ly + 4)
        .attr('text-anchor', anchor)
        .attr('fill', textColor)
        .style('font-family', 'inherit')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .text(axis.label);
    });

    // Determine target scores (either selected worker or team average)
    let activeScores: Record<string, number> = {};
    let activeTitle = '';
    if (selectedRadarWorkerId === 'team_avg') {
      activeTitle = 'میانگین تیم مددکاری';
      axes.forEach((axis) => {
        const sum = d3.sum(workers, (w) => (w as any)[axis.key] || 85);
        activeScores[axis.key] = Math.round(sum / workers.length);
      });
    } else {
      const found = workers.find((w) => w.id === selectedRadarWorkerId) || workers[0];
      activeTitle = `${found.name} (${found.institutionLabel})`;
      axes.forEach((axis) => {
        activeScores[axis.key] = (found as any)[axis.key] || 85;
      });
    }

    // Compute polygon coordinates for active scores
    const polygonPoints = axes.map((axis, i) => {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const val = Math.max(0, Math.min(100, activeScores[axis.key] || 0));
      const dist = (radius * val) / 100;
      return {
        x: cx + dist * Math.cos(angle),
        y: cy + dist * Math.sin(angle),
        val,
      };
    });

    // Draw filled polygon
    svg.append('polygon')
      .attr('points', polygonPoints.map((p) => `${p.x},${p.y}`).join(' '))
      .attr('fill', accentHex)
      .attr('fill-opacity', 0.25)
      .attr('stroke', accentHex)
      .attr('stroke-width', 2.5);

    // Draw vertex dots and values
    polygonPoints.forEach((p, i) => {
      svg.append('circle')
        .attr('cx', p.x)
        .attr('cy', p.y)
        .attr('r', 4.5)
        .attr('fill', accentHex)
        .attr('stroke', effectiveDark ? '#0f172a' : '#ffffff')
        .attr('stroke-width', 1.5);

      svg.append('text')
        .attr('x', p.x + (Math.cos((i * 2 * Math.PI) / 5 - Math.PI / 2) * 14))
        .attr('y', p.y + (Math.sin((i * 2 * Math.PI) / 5 - Math.PI / 2) * 14))
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('fill', textColor)
        .style('font-family', 'inherit')
        .style('font-size', '10px')
        .style('font-weight', '700')
        .text(toPersianNum(p.val));
    });

    // Center title or badge
    svg.append('text')
      .attr('x', cx)
      .attr('y', cy - radius - 16)
      .attr('text-anchor', 'middle')
      .attr('fill', accentHex)
      .style('font-family', 'inherit')
      .style('font-size', '12px')
      .style('font-weight', '700')
      .text(activeTitle);
  }, [report, selectedRadarWorkerId, containerWidths.workerRadar, effectiveDark, themeAccent]);

  const distTotal = report ? Math.max(1, report.currentDistribution.total) : 1;

  // Listen to browser print lifecycle to restore dark-mode SVG colors cleanly after printing
  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handlePrintPdf = () => {
    setIsPrinting(true);
    window.setTimeout(() => {
      try {
        window.print();
        onExportToast?.(
          'نسخه چاپی / PDF آماده شد',
          'در پنجره چاپ مرورگر، گزینه «Save as PDF / ذخیره به عنوان PDF» را انتخاب نمایید.',
        );
      } finally {
        window.setTimeout(() => {
          setIsPrinting(false);
        }, 1200);
      }
    }, 220);
  };

  useEffect(() => {
    if (!pendingDownload || effectiveDark || !report) return;
    const frameId = window.requestAnimationFrame(() => {
      try {
        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const serializeSvg = (ref: React.RefObject<SVGSVGElement | null>) =>
          ref.current ? ref.current.outerHTML : '';

        const scopeLabel = escapeHtml(getInstitutionScopeLabel(institutionFilter));
        const safePreparedBy = preparedBy ? escapeHtml(preparedBy) : '';
        const stamped = escapeHtml(
          generatedAt ||
            new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
              timeZone: 'Asia/Tehran',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            }).format(new Date()),
        );

        const lowIncomeCount = report.incomeDistribution
          .filter((i) => i.key === 'under_3m' || i.key === '3m_to_6m')
          .reduce((acc, i) => acc + i.count, 0);
        const lowIncomePct = report.incomeDistribution
          .filter((i) => i.key === 'under_3m' || i.key === '3m_to_6m')
          .reduce((acc, i) => acc + i.percentage, 0);

        const htmlContent = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>گزارش مدیریتی هم‌افزایی نایسر · ${scopeLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px; background: #ffffff; color: #0f172a;
      font-family: "Vazirmatn", Tahoma, sans-serif; line-height: 1.6;
    }
    .container { max-width: 1020px; margin: 0 auto; }
    .toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 16px; }
    .btn {
      padding: 8px 16px; border-radius: 8px; border: 1px solid #0f766e;
      background: #0f766e; color: #fff; font-family: inherit; font-size: 13px; cursor: pointer;
    }
    .masthead {
      border-bottom: 2px solid #0f766e; padding-bottom: 14px; margin-bottom: 20px;
      display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
    }
    h1 { margin: 0; font-size: 20px; }
    .meta { font-size: 12px; color: #475569; margin-top: 4px; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
    .kpi-label { font-size: 11px; color: #64748b; }
    .kpi-val { font-size: 20px; font-weight: 700; margin-top: 4px; }
    .exec-box {
      border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 10px;
      padding: 14px 16px; margin-bottom: 20px; font-size: 13px;
    }
    .card {
      border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px;
      margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid;
    }
    .card h2 { margin: 0 0 8px 0; font-size: 15px; }
    .charts-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    svg { max-width: 100%; height: auto; display: block; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; text-align: right; }
    th { background: #f8fafc; color: #475569; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar no-print">
      <button class="btn" onclick="window.print()">چاپ / ذخیره به عنوان PDF</button>
    </div>
    <header class="masthead">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="${window.location.origin}${INSTITUTION_LOGOS.darolahsan.src}" alt="${escapeHtml(INSTITUTION_LOGOS.darolahsan.name)}" style="width:44px;height:44px;object-fit:contain;border:1px solid #cbd5e1;border-radius:8px;padding:2px;background:#fff;" />
        <img src="${window.location.origin}${INSTITUTION_LOGOS.edalat.src}" alt="${escapeHtml(INSTITUTION_LOGOS.edalat.name)}" style="width:44px;height:44px;object-fit:contain;border:1px solid #cbd5e1;border-radius:8px;padding:2px;background:#fff;" />
        <div>
          <h1>گزارش مدیریتی وضعیت خانوارهای تحت پوشش و عملکرد مددکاران</h1>
          <div class="meta">محدوده گزارش: <strong>${scopeLabel}</strong>${safePreparedBy ? ` · تهیه‌کننده: ${safePreparedBy}` : ''}</div>
        </div>
      </div>
      <div class="meta">تاریخ تهیه: ${stamped}</div>
    </header>
    <section class="kpis">
      <div class="kpi"><div class="kpi-label">خانوارهای خوداتکا (تجمعی)</div><div class="kpi-val">${toPersianNum(report.totalGraduatedEnd)} (+${toPersianNum(report.sixMonthGrowthPct)}٪)</div></div>
      <div class="kpi"><div class="kpi-label">پرونده‌های قرمز (بحرانی)</div><div class="kpi-val" style="color:#dc2626">${toPersianNum(report.currentDistribution.red)} (${toPersianNum(Math.round((report.currentDistribution.red / distTotal) * 100))}٪)</div></div>
      <div class="kpi"><div class="kpi-label">پرونده‌های زرد (مستمر)</div><div class="kpi-val" style="color:#d97706">${toPersianNum(report.currentDistribution.yellow)}</div></div>
      <div class="kpi"><div class="kpi-label">درآمد زیر خط پایه (&lt;۶ م)</div><div class="kpi-val">${toPersianNum(lowIncomeCount)} (${toPersianNum(lowIncomePct)}٪)</div></div>
    </section>
    <section class="exec-box">
      <strong>جمع‌بندی وضعیت برای جلسه مدیریتی:</strong>
      از مجموع ${toPersianNum(distTotal)} پرونده فعال در محدوده انتخاب‌شده، ${toPersianNum(report.totalGraduatedEnd)} خانوار با رشد ${toPersianNum(report.sixMonthGrowthPct)} درصدی در ۶ ماه اخیر به مرحله خوداتکایی رسیده‌اند. در ماه گذشته تیم مددکاری مجموعاً ${toPersianNum(workerSummary.totalReviewed)} پرونده را بررسی و ${toPersianNum(workerSummary.totalTransitions)} جابجایی مرحله را با میانگین سرعت ${toPersianNum(workerSummary.avgDays)} روز ثبت کرده است.
    </section>
    <div class="charts-2">
      <section class="card"><h2>روند رشد خانوارهای خوداتکا (۶ ماه اخیر)</h2><div dir="ltr">${serializeSvg(growthSvgRef)}</div></section>
      <section class="card"><h2>تحلیل زمان پاسخگویی و سرعت ثبت پرونده‌ها (۶ ماه اخیر)</h2><div dir="ltr">${serializeSvg(responseSvgRef)}</div></section>
    </div>
    <div class="charts-2">
      <section class="card"><h2>توزیع درجه فوریت پرونده‌ها</h2><div dir="ltr">${serializeSvg(tierSvgRef)}</div></section>
      <section class="card"><h2>توزیع وضعیت اشتغال و پوشش بیمه‌ای</h2><div dir="ltr">${serializeSvg(pieSvgRef)}</div></section>
    </div>
    <section class="card">
      <h2>تعداد پرونده‌های بررسی‌شده توسط هر مددکار در ماه جاری (${escapeHtml(report.currentMonthPeriodLabel)})</h2>
      <div dir="ltr">${serializeSvg(workerHBarSvgRef)}</div>
    </section>
    <section class="card">
      <h2>عملکرد مددکاران در ماه گذشته (${escapeHtml(report.caseWorkerPeriodLabel)})</h2>
      <div dir="ltr">${serializeSvg(workerSvgRef)}</div>
      <table>
        <thead><tr><th>مددکار</th><th>مؤسسه</th><th>ماه جاری / هدف</th><th>ماه گذشته</th><th>جابجایی مرحله</th><th>میانگین سرعت</th><th>پیگیری به‌موقع</th></tr></thead>
        <tbody>
          ${sortedWorkers
            .map(
              (w) =>
                `<tr><td>${escapeHtml(w.name)}</td><td>${escapeHtml(w.institutionLabel)}</td><td>${toPersianNum(w.currentMonthReviewedCount)} از ${toPersianNum(w.currentMonthTargetCount)}</td><td>${toPersianNum(w.reviewedCasesCount)}</td><td>${toPersianNum(w.stageTransitionsCount)}</td><td>${toPersianNum(w.avgTransitionDays)} روز</td><td>${toPersianNum(w.onTimeFollowUpPct)}٪</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>
    <section class="card">
      <h2>جدول عددی عملکرد ۶ ماهه</h2>
      <table>
        <thead><tr><th>ماه</th><th>خوداتکای تجمعی</th><th>خروج ماهانه</th><th>هم‌پوشانی پیشگیری‌شده</th><th>قرمز</th><th>زرد</th><th>سبز</th></tr></thead>
        <tbody>
          ${report.series
            .map(
              (r) =>
                `<tr><td>${escapeHtml(r.monthLabel)}</td><td>${toPersianNum(r.graduatedCumulative)}</td><td>${toPersianNum(r.graduatedNew)}</td><td>${toPersianNum(r.overlapsPrevented)}</td><td>${toPersianNum(r.redTier)}</td><td>${toPersianNum(r.yellowTier)}</td><td>${toPersianNum(r.greenTier)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], {type: 'text/html;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `naysar-report-${institutionFilter}-${Date.now()}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        onExportToast?.(
          'فایل گزارش جلسات ذخیره شد',
          'نسخه چاپی کامل شامل نمودارها و خلاصه وضعیت خانوارها دانلود شد و با مرورگر نیز قابل چاپ به PDF است.',
        );
      } finally {
        setPendingDownload(false);
        setIsPrinting(false);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [
    pendingDownload,
    effectiveDark,
    report,
    institutionFilter,
    preparedBy,
    generatedAt,
    distTotal,
    workerSummary,
    sortedWorkers,
    onExportToast,
  ]);

  const handleDownloadStandaloneReport = () => {
    if (!report) return;
    setIsPrinting(true);
    setPendingDownload(true);
  };

  const handleExportExcel = () => {
    if (!report) return;
    exportReportsToExcel({
      report,
      workers: sortedWorkers,
      cases,
      scopeLabel: getInstitutionScopeLabel(institutionFilter),
      preparedBy,
      generatedAt,
    });
    onExportToast?.(
      'فایل اکسل گزارش‌ها ذخیره شد',
      `فایل ۵ کاربرگه (.xlsx) شامل خلاصه مدیریتی، روند ۶ ماهه، عملکرد مددکاران، اشتغال و فهرست پرونده‌ها (${getInstitutionScopeLabel(institutionFilter)}) دانلود شد.`,
    );
  };

  const lowIncomeHouseholdsCount = report
    ? report.incomeDistribution
        .filter((i) => i.key === 'under_3m' || i.key === '3m_to_6m')
        .reduce((acc, i) => acc + i.count, 0)
    : 0;
  const lowIncomeHouseholdsPct = report
    ? report.incomeDistribution
        .filter((i) => i.key === 'under_3m' || i.key === '3m_to_6m')
        .reduce((acc, i) => acc + i.percentage, 0)
    : 0;

  const cardSurface = isLightPaper
    ? 'bg-white border-slate-300 text-slate-900'
    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800';
  const borderRule = isLightPaper
    ? 'border-slate-200'
    : 'border-slate-200 dark:border-slate-800';
  const divideRule = isLightPaper
    ? 'divide-slate-200'
    : 'divide-slate-200 dark:divide-slate-800';
  const headingTone = isLightPaper
    ? 'text-slate-900'
    : 'text-slate-900 dark:text-slate-100';
  const mutedTone = isLightPaper
    ? 'text-slate-600'
    : 'text-slate-500 dark:text-slate-400';
  const legendTone = isLightPaper
    ? 'text-slate-700'
    : 'text-slate-600 dark:text-slate-300';
  const bodyTone = isLightPaper
    ? 'text-slate-700'
    : 'text-slate-700 dark:text-slate-300';
  const accentTone = isLightPaper
    ? 'text-teal-700'
    : 'text-teal-700 dark:text-teal-400';

  return (
    <div className={`space-y-8 ${printPreviewMode ? 'bg-white text-slate-900 p-6 sm:p-8 rounded-2xl border border-slate-300 shadow-sm' : ''}`}>
      {/* Formal Executive Masthead (Always visible in Print/PDF and in Print Preview mode) */}
      <div
        className={`${
          printPreviewMode ? 'block' : 'hidden print:block'
        } border-b-2 border-teal-700 pb-4 space-y-3`}
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <InstitutionalLogo variant="mark" size="lg" tone="print" />
            <PartnerLogosPair size="md" showLabels={false} tone="print" />
            <div>
              <div className="text-xs font-semibold text-teal-800">
                سامانه هم‌افزایی و مدیریت مورد ناحیه منفصل شهری نایسر سنندج
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
                گزارش مدیریتی وضعیت خانوارهای تحت پوشش و عملکرد مددکاران
              </h1>
            </div>
          </div>
          <div className="text-xs text-slate-600 tabular-nums text-left space-y-0.5">
            <div>تاریخ تهیه: {generatedAt || 'آبان ۱۴۰۵'}</div>
            {preparedBy && <div>تهیه‌کننده: {preparedBy}</div>}
          </div>
        </div>
        <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 leading-relaxed">
          <strong>خلاصه وضعیت جلسه مدیریتی ({getInstitutionScopeLabel(institutionFilter)}):</strong>{' '}
          {report ? (
            <>
              در حال حاضر از مجموع {toPersianNum(distTotal)} پرونده فعال،{' '}
              {toPersianNum(report.currentDistribution.red)} خانوار در وضعیت بحرانی (قرمز)،{' '}
              {toPersianNum(report.currentDistribution.yellow)} خانوار نیازمند مستمر (زرد) و{' '}
              {toPersianNum(report.currentDistribution.green)} خانوار در مسیر توانمندسازی (سبز) قرار دارند و{' '}
              {toPersianNum(report.totalGraduatedEnd)} خانوار (رشد +{toPersianNum(report.sixMonthGrowthPct)}٪ در ۶ ماه) به خوداتکایی رسیده‌اند. همچنین{' '}
              {toPersianNum(lowIncomeHouseholdsCount)} خانوار ({toPersianNum(lowIncomeHouseholdsPct)}٪) دارای درآمد ماهانه زیر ۶ میلیون تومان هستند و تیم مددکاری در ماه گذشته{' '}
              {toPersianNum(workerSummary.totalReviewed)} پرونده و {toPersianNum(workerSummary.totalTransitions)} جابجایی مرحله را با میانگین سرعت{' '}
              {toPersianNum(workerSummary.avgDays)} روز ثبت کرده است.
            </>
          ) : (
            'در حال بارگذاری آمار...'
          )}
        </div>
      </div>

      {/* Header + Institutional Filter + PDF Export Actions (Screen Only) */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 print:hidden">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight ${printPreviewMode ? 'text-slate-900' : 'text-slate-900 dark:text-slate-100'}`}>
            گزارش‌های تحلیلی ۶ ماهه و روند خوداتکایی
          </h1>
          <p className={`text-sm sm:text-base leading-relaxed ${printPreviewMode ? 'text-slate-600' : 'text-slate-600 dark:text-slate-400'}`}>
            پایش رشد خانوارهای خارج‌شده از چرخه حمایت (خروج موفق) و تغییرات توزیع درجه فوریت
            پرونده‌ها در ناحیه منفصل شهری نایسر طی ۶ ماه گذشته با مصورسازی D3.js.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Interactive Institution Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setInstitutionFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                institutionFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              کل نایسر (مشترک)
            </button>
            <button
              type="button"
              onClick={() => setInstitutionFilter('darolahsan')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                institutionFilter === 'darolahsan'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              دارالاحسان سنندج
            </button>
            <button
              type="button"
              onClick={() => setInstitutionFilter('edalat')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                institutionFilter === 'edalat'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              عدالت و برابری
            </button>
          </div>

          {/* PDF / Print Export Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!report || loading}
              onClick={() => setPrintPreviewMode((prev) => !prev)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 ${
                printPreviewMode
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {printPreviewMode ? 'خروج از پیش‌نمایش چاپ' : 'پیش‌نمایش چاپ'}
            </button>

            <button
              type="button"
              disabled={!report || loading}
              onClick={handleExportExcel}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              خروجی اکسل (.xlsx)
            </button>

            <button
              type="button"
              disabled={!report || loading}
              onClick={handleDownloadStandaloneReport}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              دانلود فایل چاپی
            </button>

            <button
              type="button"
              disabled={!report || loading || isPrinting}
              onClick={handlePrintPdf}
              className="px-3.5 py-2 text-xs font-medium rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              {isPrinting ? 'در حال آماده‌سازی PDF...' : 'دریافت خروجی PDF'}
            </button>

            <button
              type="button"
              onClick={() => setIsBoardModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <Award className="w-4 h-4" />
              <span>گزارش هیئت مدیره</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading || !report ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
          <div className="h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
          <div className="h-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
        </div>
      ) : (
        <>
          {/* 4-Column Summary Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print-avoid-break">
            <div className={`${cardSurface} border rounded-xl p-5 print-light-surface`}>
              <div className={`text-xs font-medium ${mutedTone}`}>
                مجموع خانوارهای خوداتکا (تجمعی)
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-3xl font-bold tabular-nums ${accentTone}`}>
                  {toPersianNum(report.totalGraduatedEnd)}
                </span>
                <span className={`text-xs font-medium tabular-nums ${isLightPaper ? 'text-emerald-700' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  +{toPersianNum(report.sixMonthGrowthPct)}٪ رشد در ۶ ماه
                </span>
              </div>
            </div>

            <div className={`${cardSurface} border rounded-xl p-5 print-light-surface`}>
              <div className={`text-xs font-medium ${mutedTone}`}>
                پرونده‌های قرمز (بحرانی فعلی)
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-3xl font-bold tabular-nums ${isLightPaper ? 'text-red-700' : 'text-red-700 dark:text-red-400'}`}>
                  {toPersianNum(report.currentDistribution.red)}
                </span>
                <span className={`text-xs tabular-nums ${mutedTone}`}>
                  {toPersianNum(Math.round((report.currentDistribution.red / distTotal) * 100))}
                  ٪ از کل پرونده‌ها
                </span>
              </div>
            </div>

            <div className={`${cardSurface} border rounded-xl p-5 print-light-surface`}>
              <div className={`text-xs font-medium ${mutedTone}`}>
                پرونده‌های زرد (نیازمند مستمر)
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-3xl font-bold tabular-nums ${isLightPaper ? 'text-amber-700' : 'text-amber-700 dark:text-amber-400'}`}>
                  {toPersianNum(report.currentDistribution.yellow)}
                </span>
                <span className={`text-xs tabular-nums ${mutedTone}`}>
                  {toPersianNum(Math.round((report.currentDistribution.yellow / distTotal) * 100))}
                  ٪ از کل پرونده‌ها
                </span>
              </div>
            </div>

            <div className={`${cardSurface} border rounded-xl p-5 print-light-surface`}>
              <div className={`text-xs font-medium ${mutedTone}`}>
                پرونده‌های سبز (مستعد توانمندسازی)
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-3xl font-bold tabular-nums ${isLightPaper ? 'text-emerald-700' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {toPersianNum(report.currentDistribution.green)}
                </span>
                <span className={`text-xs tabular-nums ${mutedTone}`}>
                  {toPersianNum(Math.round((report.currentDistribution.green / distTotal) * 100))}
                  ٪ از کل پرونده‌ها
                </span>
              </div>
            </div>
          </section>

          {/* D3 Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Chart 1: Graduated Families Growth */}
            <section className={`${cardSurface} border rounded-xl p-6 flex flex-col justify-between space-y-4 print-avoid-break print-light-surface`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b ${borderRule} pb-4`}>
                <div>
                  <h2 className={`text-base font-semibold ${headingTone}`}>
                    روند رشد خانوارهای خوداتکا (خروج موفق)
                  </h2>
                  <p className={`text-xs mt-0.5 ${mutedTone}`}>
                    مقایسه تعداد تجمعی خانوارهای فارغ‌التحصیل‌شده و خروجی ماهانه در ۶ ماه اخیر
                  </p>
                </div>
                <div className={`flex items-center gap-4 text-xs shrink-0 ${legendTone}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 bg-teal-700 dark:bg-teal-400 inline-block" />
                    تجمعی
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-3 h-0.5 border-t-2 border-dashed border-sky-600 dark:border-sky-400 inline-block" />
                    خروج ماهانه
                  </span>
                </div>
              </div>

              <div ref={growthContainerRef} className="w-full overflow-hidden" dir="ltr">
                <svg ref={growthSvgRef} className="w-full h-auto block" role="img" aria-label="نمودار رشد خانوارهای خوداتکا در ۶ ماه گذشته" />
              </div>

              <div className={`pt-3 border-t ${borderRule} text-xs ${mutedTone} min-h-[2.25rem] flex items-center justify-between print:hidden`}>
                {hoveredGrowth ? (
                  <>
                    <span className={`font-semibold ${headingTone}`}>{hoveredGrowth.monthLabel}</span>
                    <span className="tabular-nums">
                      تجمعی: <strong>{toPersianNum(hoveredGrowth.graduatedCumulative)}</strong> خانوار ·
                      خروج ماهانه: <strong>{toPersianNum(hoveredGrowth.graduatedNew)}</strong> ·
                      پیشگیری هم‌پوشانی: <strong>{toPersianNum(hoveredGrowth.overlapsPrevented)}</strong>
                    </span>
                  </>
                ) : (
                  <span>برای مشاهده جزئیات دقیق هر ماه، نشانگر را روی نقاط نمودار قرار دهید.</span>
                )}
              </div>
            </section>

            {/* Chart 2: Case Tier Distribution */}
            <section className={`${cardSurface} border rounded-xl p-6 flex flex-col justify-between space-y-4 print-avoid-break print-light-surface`}>
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${borderRule} pb-4`}>
                <div>
                  <h2 className={`text-base font-semibold ${headingTone}`}>
                    توزیع درجه فوریت پرونده‌ها در ۶ ماه گذشته
                  </h2>
                  <p className={`text-xs mt-0.5 ${mutedTone}`}>
                    گذار خانوارها از وضعیت بحرانی (قرمز) به سمت نیازمند مستمر (زرد) و توانمندسازی (سبز)
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start shrink-0 print:hidden">
                  <button
                    type="button"
                    onClick={() => setTierChartMode('stacked')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      tierChartMode === 'stacked'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    پشته‌ای
                  </button>
                  <button
                    type="button"
                    onClick={() => setTierChartMode('grouped')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      tierChartMode === 'grouped'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    گروهی
                  </button>
                </div>
              </div>

              <div ref={tierContainerRef} className="w-full overflow-hidden" dir="ltr">
                <svg ref={tierSvgRef} className="w-full h-auto block" role="img" aria-label="نمودار توزیع سطوح فوریت پرونده‌ها در ۶ ماه گذشته" />
              </div>

              <div className={`pt-3 border-t ${borderRule} text-xs ${mutedTone} min-h-[2.25rem] flex flex-wrap items-center justify-between gap-2`}>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                    قرمز (بحرانی)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                    زرد (مستمر)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                    سبز (توانمندسازی)
                  </span>
                </div>

                {hoveredTier && (
                  <span className={`font-medium tabular-nums ${headingTone}`}>
                    {hoveredTier.monthLabel}: قرمز {toPersianNum(hoveredTier.redTier)} · زرد{' '}
                    {toPersianNum(hoveredTier.yellowTier)} · سبز {toPersianNum(hoveredTier.greenTier)}
                  </span>
                )}
              </div>
            </section>
          </div>

          {/* Chart 8 Card: Response Time Trend Analysis & Bottlenecks */}
          <section className={`${cardSurface} border rounded-xl p-6 flex flex-col justify-between space-y-4 print-avoid-break print-light-surface`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b ${borderRule} pb-4`}>
              <div>
                <h2 className={`text-base font-semibold ${headingTone}`}>
                  تحلیل زمان پاسخگویی و سرعت ثبت پرونده‌ها (۶ ماه اخیر)
                </h2>
                <p className={`text-xs mt-0.5 ${mutedTone}`}>
                  شناسایی گلوگاه‌های عملیاتی و روند کاهش میانگین روزهای انتظار از پذیرش اولیه تا تکمیل ارزیابی معیشتی
                </p>
              </div>
              <div className={`flex items-center gap-4 text-xs shrink-0 ${legendTone}`}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block" />
                  میانگین روزهای انتظار (ثبت تا ارزیابی)
                </span>
              </div>
            </div>

            <div ref={responseContainerRef} className="w-full overflow-hidden" dir="ltr">
              <svg ref={responseSvgRef} className="w-full h-auto block" role="img" aria-label="نمودار روند میانگین زمان پاسخگویی در ۶ ماه گذشته" />
            </div>

            <div className={`pt-3 border-t ${borderRule} text-xs ${mutedTone} min-h-[2.25rem] flex items-center justify-between print:hidden`}>
              {hoveredResponse ? (
                <>
                  <span className={`font-semibold ${headingTone}`}>{hoveredResponse.monthLabel}</span>
                  <span className="tabular-nums">
                    میانگین زمان پاسخگویی: <strong className="text-amber-600 dark:text-amber-400">{toPersianNum(hoveredResponse.avgResponseDays)} روز</strong> ·
                    رشد خوداتکایی تجمعی: <strong>{toPersianNum(hoveredResponse.graduatedCumulative)} خانوار</strong>
                  </span>
                </>
              ) : (
                <span>برای مشاهده تحلیل گلوگاه‌های هر ماه، نشانگر را روی نقاط نمودار قرار دهید.</span>
              )}
            </div>
          </section>

          {/* Chart 3: Household Employment Status Pie / Donut Chart */}
          <section className={`${cardSurface} border rounded-xl p-6 space-y-6 print-avoid-break print-light-surface`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${borderRule} pb-4`}>
              <div>
                <h2 className={`text-base font-semibold ${headingTone}`}>
                  توزیع وضعیت اشتغال و پوشش بیمه‌ای خانوارها
                </h2>
                <p className={`text-xs mt-0.5 ${mutedTone}`}>
                  تفکیک خانوارهای تحت پوشش در سه وضعیت «شاغل»، «جویای کار» و «تحت پوشش بیمه» بر اساس داده‌های ارزیابی معیشتی
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setPieStyle('pie')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    pieStyle === 'pie'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  دایره‌ای کامل
                </button>
                <button
                  type="button"
                  onClick={() => setPieStyle('donut')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    pieStyle === 'donut'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  حلقه‌ای
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div
                ref={pieContainerRef}
                className="lg:col-span-5 flex items-center justify-center"
                dir="ltr"
              >
                <svg
                  ref={pieSvgRef}
                  className="block max-w-full h-auto"
                  role="img"
                  aria-label="نمودار دایره‌ای توزیع وضعیت اشتغال خانوارها"
                />
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className={`border ${borderRule} rounded-xl divide-y ${divideRule} overflow-hidden`}>
                  {report.employmentDistribution.map((item) => {
                    const isHighlighted = hoveredEmployment?.key === item.key;
                    return (
                      <div
                        key={item.key}
                        onMouseEnter={() => setHoveredEmployment(item)}
                        onMouseLeave={() => setHoveredEmployment(null)}
                        className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                          isHighlighted
                            ? isLightPaper
                              ? 'bg-slate-50'
                              : 'bg-slate-50 dark:bg-slate-800/70'
                            : isLightPaper
                              ? 'bg-white'
                              : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="w-3 h-3 rounded-xs shrink-0"
                            style={{backgroundColor: employmentColors[item.key]}}
                          />
                          <div>
                            <div className={`text-sm font-semibold ${headingTone}`}>
                              {item.label}
                            </div>
                            <div className={`text-xs mt-0.5 ${mutedTone}`}>
                              {item.key === 'employed'
                                ? 'دارای درآمد از مشاغل خانگی، خیاطی، صنایع‌دستی یا عضو فعال صندوق خرد'
                                : item.key === 'job_seeking'
                                  ? 'دارای نیروی کار آماده؛ نیازمند اتصال به کارگاه مهارتی و وام خودیاری'
                                  : 'سالمندان، بیماران صعب‌العلاج و خانوارهای دارای پوشش بیمه درمان'}
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0 tabular-nums">
                          <div className={`text-base font-bold ${headingTone}`}>
                            {toPersianNum(item.count)} خانوار
                          </div>
                          <div className={`text-xs font-medium ${mutedTone}`}>
                            {toPersianNum(item.percentage)}٪ از کل
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`text-xs ${mutedTone} min-h-[1.5rem] flex items-center justify-between px-1 print:hidden`}>
                  {hoveredEmployment ? (
                    <span className={`font-medium tabular-nums ${headingTone}`}>
                      وضعیت انتخاب‌شده: {hoveredEmployment.label} —{' '}
                      {toPersianNum(hoveredEmployment.count)} خانوار (
                      {toPersianNum(hoveredEmployment.percentage)}٪)
                    </span>
                  ) : (
                    <span>
                      برای برجسته‌سازی هر بخش، نشانگر را روی برش‌های نمودار یا ردیف‌های جدول قرار دهید.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Chart 4: Household Income Distribution Bar Chart (D3.js) */}
          <section className={`${cardSurface} border rounded-xl p-6 space-y-6 print-avoid-break print-light-surface`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${borderRule} pb-4`}>
              <div>
                <h2 className={`text-base font-semibold ${headingTone}`}>
                  توزیع سطح درآمد ماهانه خانوارهای تحت پوشش
                </h2>
                <p className={`text-xs mt-0.5 ${mutedTone}`}>
                  پراکندگی خانوارها در ۵ بازه درآمدی (میلیون تومان در ماه) برای ارزیابی شکاف معیشتی منطقه نایسر
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setIncomeMetric('count')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    incomeMetric === 'count'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  تعداد خانوار
                </button>
                <button
                  type="button"
                  onClick={() => setIncomeMetric('percentage')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    incomeMetric === 'percentage'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  درصد سهم
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div
                ref={incomeContainerRef}
                className="lg:col-span-7 w-full overflow-hidden"
                dir="ltr"
              >
                <svg
                  ref={incomeSvgRef}
                  className="w-full h-auto block"
                  role="img"
                  aria-label="نمودار میله‌ای توزیع سطح درآمد ماهانه خانوارهای تحت پوشش"
                />
              </div>

              <div className="lg:col-span-5 space-y-3">
                <div className={`border ${borderRule} rounded-xl divide-y ${divideRule} overflow-hidden`}>
                  {report.incomeDistribution.map((item) => {
                    const isHighlighted = hoveredIncome?.key === item.key;
                    return (
                      <div
                        key={item.key}
                        onMouseEnter={() => setHoveredIncome(item)}
                        onMouseLeave={() => setHoveredIncome(null)}
                        className={`p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isHighlighted
                            ? isLightPaper
                              ? 'bg-slate-50'
                              : 'bg-slate-50 dark:bg-slate-800/70'
                            : isLightPaper
                              ? 'bg-white'
                              : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className="w-3 h-3 rounded-xs shrink-0 mt-1"
                            style={{backgroundColor: incomeColors[item.key]}}
                          />
                          <div>
                            <div className={`text-sm font-semibold ${headingTone}`}>
                              {item.bracketLabel}
                            </div>
                            <div className={`text-xs mt-0.5 ${mutedTone}`}>
                              {item.povertyLineStatus}
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0 tabular-nums">
                          <div className={`text-sm font-bold ${headingTone}`}>
                            {toPersianNum(item.count)} خانوار
                          </div>
                          <div className={`text-xs ${mutedTone}`}>
                            {toPersianNum(item.percentage)}٪
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`text-xs ${mutedTone} min-h-[1.5rem] flex items-center justify-between px-1 print:hidden`}>
                  {hoveredIncome ? (
                    <span className={`font-medium tabular-nums ${headingTone}`}>
                      بازه {hoveredIncome.bracketLabel}:{' '}
                      {toPersianNum(hoveredIncome.count)} خانوار (
                      {toPersianNum(hoveredIncome.percentage)}٪)
                    </span>
                  ) : (
                    <span>
                      برای مشاهده جزئیات هر بازه درآمدی، نشانگر را روی ستون‌های نمودار قرار دهید.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Chart 6: Current-Month Case Worker Reviewed Cases (D3.js Horizontal Bar Chart) */}
          <section className={`${cardSurface} border rounded-xl p-6 space-y-5 print-avoid-break print-light-surface`}>
            <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b ${borderRule} pb-4`}>
              <div>
                <h2 className={`text-base font-semibold ${headingTone}`}>
                  پایش شفاف پرونده‌های بررسی‌شده مددکاران در ماه جاری
                </h2>
                <p className={`text-xs mt-1 ${mutedTone}`}>
                  مقایسه تعداد پرونده‌های بررسی‌شده هر مددکار نسبت به سقف هدف ماهانه و میانگین تیم ·{' '}
                  <span className={`font-medium ${bodyTone}`}>
                    {report.currentMonthPeriodLabel}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setWorkerHBarSortBy('desc')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    workerHBarSortBy === 'desc'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  بیشترین بررسی
                </button>
                <button
                  type="button"
                  onClick={() => setWorkerHBarSortBy('asc')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    workerHBarSortBy === 'asc'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  نیازمند توجه
                </button>
                <button
                  type="button"
                  onClick={() => setWorkerHBarSortBy('institution')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    workerHBarSortBy === 'institution'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  تفکیک مؤسسه
                </button>
              </div>
            </div>

            {/* 3-Column Hairline KPI Summary Strip for Current Month */}
            <div className={`grid grid-cols-1 sm:grid-cols-3 border rounded-xl divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse print:grid-cols-3 print-light-muted ${
              isLightPaper
                ? 'border-slate-200 divide-slate-200 bg-slate-50'
                : 'border-slate-200 dark:border-slate-800 divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
            }`}>
              <div className="p-4 flex items-center justify-between sm:block">
                <div className={`text-xs ${mutedTone}`}>
                  مجموع پرونده‌های بررسی‌شده ماه جاری
                </div>
                <div className={`text-xl font-bold mt-1 tabular-nums ${headingTone}`}>
                  {toPersianNum(currentMonthSummary.totalReviewed)} از{' '}
                  {toPersianNum(currentMonthSummary.totalTarget)} ({toPersianNum(currentMonthSummary.overallPct)}٪)
                </div>
              </div>
              <div className="p-4 flex items-center justify-between sm:block">
                <div className={`text-xs ${mutedTone}`}>
                  میانگین سرانه هر مددکار
                </div>
                <div className={`text-xl font-bold mt-1 tabular-nums ${accentTone}`}>
                  {toPersianNum(currentMonthSummary.avgReviewed)} پرونده
                </div>
              </div>
              <div className="p-4 flex items-center justify-between sm:block">
                <div className={`text-xs ${mutedTone}`}>
                  بالاترین عملکرد در ماه جاری
                </div>
                <div className={`text-sm sm:text-base font-bold mt-1 tabular-nums ${headingTone}`}>
                  {currentMonthSummary.topWorker
                    ? `${currentMonthSummary.topWorker.name} · ${toPersianNum(currentMonthSummary.topWorker.currentMonthReviewedCount)} پرونده`
                    : '—'}
                </div>
              </div>
            </div>

            <div ref={workerHBarContainerRef} className="w-full overflow-hidden" dir="ltr">
              <svg
                ref={workerHBarSvgRef}
                className="w-full h-auto block"
                role="img"
                aria-label="نمودار ستونی افقی تعداد پرونده‌های بررسی‌شده هر مددکار در ماه جاری"
              />
            </div>

            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t ${borderRule} text-xs ${mutedTone}`}>
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-xs inline-block"
                    style={{backgroundColor: accentHex}}
                  />
                  دارالاحسان سنندج
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-xs inline-block"
                    style={{backgroundColor: chartColors.secondaryLine}}
                  />
                  عدالت و برابری
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-0.5 h-3 bg-amber-600 dark:bg-amber-400 inline-block rounded-full" />
                  سقف هدف ماهانه هر مددکار
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t-2 border-dashed border-slate-500 dark:border-slate-400 inline-block" />
                  خط میانگین تیم
                </span>
              </div>

              <div className="min-h-[1.5rem] flex items-center print:hidden">
                {hoveredWorkerHBar ? (
                  <span className={`font-medium tabular-nums ${headingTone}`}>
                    {hoveredWorkerHBar.name} ({hoveredWorkerHBar.institutionLabel} · {hoveredWorkerHBar.blockCoverage}):{' '}
                    {toPersianNum(hoveredWorkerHBar.currentMonthReviewedCount)} پرونده از هدف{' '}
                    {toPersianNum(hoveredWorkerHBar.currentMonthTargetCount)} پرونده در ماه جاری
                  </span>
                ) : (
                  <span>
                    برای مشاهده جزئیات هدف و محدوده هر مددکار، نشانگر را روی ستون افقی قرار دهید.
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* Chart: Average Case Duration in 6 Workflow Stages per Caseworker */}
          <section className={`${cardSurface} border rounded-xl p-6 space-y-6 print-avoid-break print-light-surface`}>
            <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b ${borderRule} pb-4`}>
              <div>
                <h2 className={`text-base font-semibold ${headingTone}`}>
                  میانگین مدت زمان حضور پرونده‌ها در مراحل ششگانه به تفکیک مددکاران
                </h2>
                <p className={`text-xs mt-1 ${mutedTone}`}>
                  ارزیابی دقیق کارایی در مدیریت مورد و زمان سپری‌شده در هر یک از مراحل جریان کاری (پذیرش، ارزیابی، برنامه، اجرا، پایش و خروج) به تفکیک مددکاران
                </p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setStageDurationViewMode('all')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    stageDurationViewMode === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  کل تیم
                </button>
                <button
                  type="button"
                  onClick={() => setStageDurationViewMode('darolahsan')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    stageDurationViewMode === 'darolahsan'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  دارالاحسان
                </button>
                <button
                  type="button"
                  onClick={() => setStageDurationViewMode('edalat')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    stageDurationViewMode === 'edalat'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  عدالت و برابری
                </button>
              </div>
            </div>

            <div ref={stageDurationContainerRef} className="w-full overflow-hidden" dir="ltr">
              <svg
                ref={stageDurationSvgRef}
                className="w-full h-auto block"
                role="img"
                aria-label="نمودار مدت زمان متوسط حضور پرونده‌ها در مراحل ششگانه به تفکیک مددکاران"
              />
            </div>

            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t ${borderRule} text-xs ${mutedTone}`}>
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs inline-block" style={{backgroundColor: accentHex}} />
                  مددکاران برتر (دارالاحسان / عدالت)
                </span>
                <span>واحد اندازه گیری: متوسط روزهای ماندگاری در هر مرحله</span>
              </div>

              <div className="min-h-[1.5rem] flex items-center print:hidden">
                {hoveredStageDuration ? (
                  <span className={`font-medium tabular-nums ${headingTone}`}>
                    {hoveredStageDuration.workerName} در {hoveredStageDuration.stageLabel}:{' '}
                    <strong className="text-amber-600 dark:text-amber-400">{toPersianNum(hoveredStageDuration.days)} روز</strong>
                  </span>
                ) : (
                  <span>برای مشاهده جزئیات مدت ماندگاری هر مرحله به تفکیک مددکار، نشانگر را روی ستون‌ها قرار دهید.</span>
                )}
              </div>
            </div>
          </section>

          {/* D3.js Radar Chart Card for 5 Key Performance Indicators */}
          <section className={`${cardSurface} border rounded-xl p-6 space-y-6 print-avoid-break print-light-surface`}>
            <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b ${borderRule} pb-4`}>
              <div>
                <h2 className={`text-base font-semibold ${headingTone}`}>
                  ارزیابی راداری عملکرد مددکاران بر اساس ۵ شاخص کلیدی
                </h2>
                <p className={`text-xs mt-1 ${mutedTone}`}>
                  مقایسه چندبعدی عملکرد مددکاران در شاخص‌های: سرعت ثبت پرونده، دقت در ارزیابی، پیگیری به‌موقع، حل‌وفصل تعارضات و کیفیت مستندسازی.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0 print:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedRadarWorkerId('team_avg')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    selectedRadarWorkerId === 'team_avg'
                      ? 'bg-slate-900 dark:bg-teal-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  میانگین تیم
                </button>
                {report.caseWorkerPerformance.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setSelectedRadarWorkerId(w.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      selectedRadarWorkerId === w.id
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>

            <div ref={workerRadarContainerRef} className="w-full flex justify-center overflow-hidden" dir="ltr">
              <svg
                ref={workerRadarSvgRef}
                className="w-full max-w-[520px] h-auto block"
                role="img"
                aria-label="نمودار راداری ۵ شاخص کلیدی عملکرد مددکاران"
              />
            </div>

            <div className={`pt-4 border-t ${borderRule} flex flex-wrap items-center justify-around gap-4 text-xs tabular-nums ${mutedTone}`}>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">سرعت ثبت پرونده:</span>{' '}
                {selectedRadarWorkerId === 'team_avg'
                  ? `${Math.round(d3.mean(report.caseWorkerPerformance, (w) => w.recordSpeedScore) || 90)}٪`
                  : `${report.caseWorkerPerformance.find((w) => w.id === selectedRadarWorkerId)?.recordSpeedScore || 0}٪`}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">دقت در ارزیابی:</span>{' '}
                {selectedRadarWorkerId === 'team_avg'
                  ? `${Math.round(d3.mean(report.caseWorkerPerformance, (w) => w.assessmentAccuracyScore) || 92)}٪`
                  : `${report.caseWorkerPerformance.find((w) => w.id === selectedRadarWorkerId)?.assessmentAccuracyScore || 0}٪`}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">پیگیری به‌موقع:</span>{' '}
                {selectedRadarWorkerId === 'team_avg'
                  ? `${Math.round(d3.mean(report.caseWorkerPerformance, (w) => w.onTimeFollowUpScore) || 90)}٪`
                  : `${report.caseWorkerPerformance.find((w) => w.id === selectedRadarWorkerId)?.onTimeFollowUpScore || 0}٪`}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">حل‌وفصل تعارضات:</span>{' '}
                {selectedRadarWorkerId === 'team_avg'
                  ? `${Math.round(d3.mean(report.caseWorkerPerformance, (w) => w.conflictResolutionScore) || 89)}٪`
                  : `${report.caseWorkerPerformance.find((w) => w.id === selectedRadarWorkerId)?.conflictResolutionScore || 0}٪`}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">مستندسازی:</span>{' '}
                {selectedRadarWorkerId === 'team_avg'
                  ? `${Math.round(d3.mean(report.caseWorkerPerformance, (w) => w.documentationQualityScore) || 92)}٪`
                  : `${report.caseWorkerPerformance.find((w) => w.id === selectedRadarWorkerId)?.documentationQualityScore || 0}٪`}
              </div>
            </div>
          </section>

          {/* Chart 5: Case Worker Monthly Performance Dashboard (D3.js) */}
          <section className={`${cardSurface} border rounded-xl p-6 space-y-6 print-avoid-break print-light-surface`}>
            <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b ${borderRule} pb-4`}>
              <div>
                <h2 className={`text-base font-semibold ${headingTone}`}>
                  داشبورد عملکرد مددکاران در ماه گذشته
                </h2>
                <p className={`text-xs mt-1 ${mutedTone}`}>
                  پایش تعداد پرونده‌های بررسی‌شده، دفعات جابجایی مراحل و میانگین سرعت انتقال مرحله (روز) ·{' '}
                  <span className={`font-medium ${bodyTone}`}>
                    {report.caseWorkerPeriodLabel}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setWorkerChartMode('combo')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      workerChartMode === 'combo'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ستونی و منحنی سرعت
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkerChartMode('scatter')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      workerChartMode === 'scatter'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    ماتریس حجم و سرعت
                  </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setWorkerSortBy('reviewed')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      workerSortBy === 'reviewed'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    مرتب: تعداد پرونده
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkerSortBy('speed')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      workerSortBy === 'speed'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    مرتب: سرعت جابجایی
                  </button>
                </div>
              </div>
            </div>

            {/* 3-Column Hairline KPI Summary Strip */}
            <div className={`grid grid-cols-1 sm:grid-cols-3 border rounded-xl divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse print:grid-cols-3 print-light-muted ${
              isLightPaper
                ? 'border-slate-200 divide-slate-200 bg-slate-50'
                : 'border-slate-200 dark:border-slate-800 divide-slate-200 dark:divide-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
            }`}>
              <div className="p-4 flex items-center justify-between sm:block">
                <div className={`text-xs ${mutedTone}`}>
                  پرونده‌های بررسی‌شده در ماه گذشته
                </div>
                <div className={`text-xl font-bold mt-1 tabular-nums ${headingTone}`}>
                  {toPersianNum(workerSummary.totalReviewed)} پرونده
                </div>
              </div>
              <div className="p-4 flex items-center justify-between sm:block">
                <div className={`text-xs ${mutedTone}`}>
                  مجموع جابجایی مراحل ثبت‌شده
                </div>
                <div className={`text-xl font-bold mt-1 tabular-nums ${accentTone}`}>
                  {toPersianNum(workerSummary.totalTransitions)} مرحله
                </div>
              </div>
              <div className="p-4 flex items-center justify-between sm:block">
                <div className={`text-xs ${mutedTone}`}>
                  میانگین سرعت جابجایی مراحل تیم
                </div>
                <div className={`text-xl font-bold mt-1 tabular-nums ${isLightPaper ? 'text-amber-700' : 'text-amber-700 dark:text-amber-400'}`}>
                  {toPersianNum(workerSummary.avgDays)} روز
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
                <div ref={workerContainerRef} className="w-full overflow-hidden" dir="ltr">
                  <svg
                    ref={workerSvgRef}
                    className="w-full h-auto block"
                    role="img"
                    aria-label="نمودار داشبورد عملکرد مددکاران در ماه گذشته"
                  />
                </div>

                <div className={`flex flex-wrap items-center justify-between gap-3 pt-2 border-t ${borderRule} text-xs ${mutedTone}`}>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-xs inline-block"
                        style={{backgroundColor: accentHex}}
                      />
                      دارالاحسان سنندج
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-xs inline-block"
                        style={{backgroundColor: chartColors.secondaryLine}}
                      />
                      عدالت و برابری
                    </span>
                    {workerChartMode === 'combo' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-600 dark:border-amber-400 inline-block" />
                        میانگین سرعت جابجایی (روز کمتر = سریع‌تر)
                      </span>
                    ) : (
                      <span>اندازه دایره = تعداد جابجایی مراحل ثبت‌شده</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
                <div className={`border ${borderRule} rounded-xl divide-y ${divideRule} overflow-hidden`}>
                  {sortedWorkers.map((worker, index) => {
                    const isHighlighted = hoveredWorker?.id === worker.id;
                    const instDotColor =
                      worker.institution === 'darolahsan'
                        ? accentHex
                        : chartColors.secondaryLine;
                    return (
                      <div
                        key={worker.id}
                        onMouseEnter={() => setHoveredWorker(worker)}
                        onMouseLeave={() => setHoveredWorker(null)}
                        className={`p-3.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                          isHighlighted
                            ? isLightPaper
                              ? 'bg-slate-50'
                              : 'bg-slate-50 dark:bg-slate-800/70'
                            : isLightPaper
                              ? 'bg-white'
                              : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0 mt-1.5"
                            style={{backgroundColor: instDotColor}}
                          />
                          <div className="min-w-0">
                            <div className={`text-sm font-semibold truncate ${headingTone}`}>
                              {toPersianNum(index + 1)}. {worker.name}
                            </div>
                            <div className={`text-xs mt-0.5 truncate ${mutedTone}`}>
                              {worker.institutionLabel} · {worker.blockCoverage}
                            </div>
                          </div>
                        </div>

                        <div className="text-left shrink-0 tabular-nums">
                          <div className={`text-sm font-bold ${headingTone}`}>
                            {toPersianNum(worker.reviewedCasesCount)} پرونده ·{' '}
                            <span className={isLightPaper ? 'text-amber-700' : 'text-amber-700 dark:text-amber-400'}>
                              {toPersianNum(worker.avgTransitionDays)} روز
                            </span>
                          </div>
                          <div className={`text-xs mt-0.5 ${mutedTone}`}>
                            {toPersianNum(worker.stageTransitionsCount)} جابجایی مرحله ·{' '}
                            {toPersianNum(worker.onTimeFollowUpPct)}٪ به‌موقع
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`text-xs ${mutedTone} min-h-[1.75rem] flex items-center justify-between px-1 print:hidden`}>
                  {hoveredWorker ? (
                    <span className={`font-medium tabular-nums ${headingTone}`}>
                      {hoveredWorker.name} ({hoveredWorker.roleTitle}):{' '}
                      {toPersianNum(hoveredWorker.reviewedCasesCount)} پرونده بررسی‌شده،{' '}
                      {toPersianNum(hoveredWorker.stageTransitionsCount)} جابجایی مرحله با میانگین{' '}
                      {toPersianNum(hoveredWorker.avgTransitionDays)} روز
                    </span>
                  ) : (
                    <span>
                      برای مقایسه جزئیات سرعت و حجم پرونده‌ها، نشانگر را روی نمودار یا ردیف مددکار قرار دهید.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Monthly Data Table */}
          <section className={`${cardSurface} border rounded-xl overflow-hidden print-avoid-break print-light-surface`}>
            <div className={`p-6 border-b ${borderRule}`}>
              <h2 className={`text-base font-semibold ${headingTone}`}>
                جدول عددی عملکرد ۶ ماهه (مبنای رسم نمودارها)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className={`border-b text-xs font-medium ${
                    isLightPaper
                      ? 'border-slate-200 bg-slate-50 text-slate-600'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400'
                  }`}>
                    <th className="py-3 px-4 whitespace-nowrap">ماه</th>
                    <th className="py-3 px-4 whitespace-nowrap">خوداتکای تجمعی</th>
                    <th className="py-3 px-4 whitespace-nowrap">خروج موفق ماهانه</th>
                    <th className="py-3 px-4 whitespace-nowrap">هم‌پوشانی پیشگیری‌شده</th>
                    <th className="py-3 px-4 whitespace-nowrap">درجه قرمز (بحرانی)</th>
                    <th className="py-3 px-4 whitespace-nowrap">درجه زرد (مستمر)</th>
                    <th className="py-3 px-4 whitespace-nowrap">درجه سبز (توانمندسازی)</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${divideRule} text-sm tabular-nums`}>
                  {report.series.map((row) => (
                    <tr key={row.monthKey} className={isLightPaper ? 'bg-white' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'}>
                      <td className={`py-3 px-4 font-medium whitespace-nowrap ${headingTone}`}>
                        {row.monthLabel}
                      </td>
                      <td className={`py-3 px-4 font-semibold ${accentTone}`}>
                        {toPersianNum(row.graduatedCumulative)}
                      </td>
                      <td className={`py-3 px-4 ${bodyTone}`}>{toPersianNum(row.graduatedNew)}</td>
                      <td className={`py-3 px-4 ${bodyTone}`}>
                        {toPersianNum(row.overlapsPrevented)}
                      </td>
                      <td className={`py-3 px-4 font-medium ${isLightPaper ? 'text-red-700' : 'text-red-700 dark:text-red-400'}`}>
                        {toPersianNum(row.redTier)}
                      </td>
                      <td className={`py-3 px-4 font-medium ${isLightPaper ? 'text-amber-700' : 'text-amber-700 dark:text-amber-400'}`}>
                        {toPersianNum(row.yellowTier)}
                      </td>
                      <td className={`py-3 px-4 font-medium ${isLightPaper ? 'text-emerald-700' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {toPersianNum(row.greenTier)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Service Demand Forecast Widget based on historical stage trends */}
          <ServiceDemandForecastWidget
            isDark={effectiveDark}
            themeAccent={themeAccent}
            onExportToast={onExportToast}
          />

          {/* Scheduled Reports Widget */}
          <ScheduledReportsWidget
            isDark={effectiveDark}
            themeAccent={themeAccent}
            onExportToast={onExportToast}
          />

          {/* Periodic Reports Manager (Notifications & PDF Export) */}
          <PeriodicReportsManager
            activeInstitution={institutionFilter}
            isDark={effectiveDark}
            themeAccent={themeAccent}
            onExportToast={onExportToast}
          />
        </>
      )}

      {/* Board of Directors Report Modal */}
      <BoardOfDirectorsReportModal
        isOpen={isBoardModalOpen}
        onClose={() => setIsBoardModalOpen(false)}
        activeInstitution={institutionFilter}
        cases={cases}
        preparedBy={preparedBy}
        generatedAt={generatedAt}
        onExportToast={onExportToast}
      />
    </div>
  );
};
