import React, {useEffect, useRef, useState} from 'react';
import * as d3 from 'd3';
import {TrendingUp, BarChart2, ShieldCheck, Sparkles} from 'lucide-react';
import type {UiThemeAccent} from '../types';

interface ServiceDemandWidgetProps {
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
}

interface DemandForecastItem {
  category: string;
  historicalAvgMonthly: number;
  forecastNextMonth: number;
  forecastQuarterly: number;
  growthRatePct: number;
  urgencyLevel: 'high' | 'medium' | 'stable';
  color: string;
}

const FORECAST_DATA: DemandForecastItem[] = [
  {
    category: 'سبد معیشتی و مواد غذایی',
    historicalAvgMonthly: 38,
    forecastNextMonth: 46,
    forecastQuarterly: 142,
    growthRatePct: 21.0,
    urgencyLevel: 'high',
    color: '#0f766e',
  },
  {
    category: 'درمان، دارو و تجهیزات پزشکی',
    historicalAvgMonthly: 24,
    forecastNextMonth: 29,
    forecastQuarterly: 88,
    growthRatePct: 18.5,
    urgencyLevel: 'high',
    color: '#0284c7',
  },
  {
    category: 'تسهیلات اشتغال و صندوق خرد',
    historicalAvgMonthly: 15,
    forecastNextMonth: 19,
    forecastQuarterly: 60,
    growthRatePct: 26.6,
    urgencyLevel: 'medium',
    color: '#047857',
  },
  {
    category: 'کمک‌هزینه مسکن و اجاره‌بها',
    historicalAvgMonthly: 12,
    forecastNextMonth: 15,
    forecastQuarterly: 48,
    growthRatePct: 25.0,
    urgencyLevel: 'medium',
    color: '#d97706',
  },
];

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

export const ServiceDemandForecastWidget: React.FC<ServiceDemandWidgetProps> = ({
  isDark = false,
  themeAccent = 'teal',
  onExportToast,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth || 700;
    const height = 320;
    const margin = {top: 25, right: 30, bottom: 45, left: 60};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Monthly historical vs forecast trend series (last 4 months + 3 months forecast)
    const trendSeries = [
      {month: 'مرداد', historical: 32, forecast: 32},
      {month: 'شهریور', historical: 35, forecast: 35},
      {month: 'مهر', historical: 38, forecast: 38},
      {month: 'آبان (جاری)', historical: 41, forecast: 41},
      {month: 'آذر (پیش‌بینی)', historical: 0, forecast: 46},
      {month: 'دی (پیش‌بینی)', historical: 0, forecast: 51},
      {month: 'بهمن (پیش‌بینی)', historical: 0, forecast: 58},
    ];

    const x = d3
      .scalePoint<string>()
      .domain(trendSeries.map((d) => d.month))
      .range([0, innerWidth])
      .padding(0.3);

    const maxVal = d3.max(trendSeries, (d) => Math.max(d.historical, d.forecast)) ?? 60;
    const y = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxVal * 1.15)])
      .nice()
      .range([innerHeight, 0]);

    // Grid lines
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
        grid.selectAll('.tick line').attr('stroke', isDark ? '#1e293b' : '#e2e8f0').attr('stroke-dasharray', '3,3'),
      );

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickSize(0).tickPadding(12))
      .call((axis) => axis.select('.domain').attr('stroke', isDark ? '#334155' : '#cbd5e1'))
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', isDark ? '#94a3b8' : '#475569')
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat((val) => toPersianNum(Number(val))))
      .call((axis) => axis.select('.domain').remove())
      .call((axis) => axis.selectAll('.tick line').remove())
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', isDark ? '#94a3b8' : '#64748b')
          .style('font-family', 'inherit')
          .style('font-size', '11px'),
      );

    // Historical Line Generator
    const histData = trendSeries.filter((d) => d.historical > 0);
    const lineHist = d3
      .line<(typeof trendSeries)[0]>()
      .x((d) => x(d.month) ?? 0)
      .y((d) => y(d.historical))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(histData)
      .attr('fill', 'none')
      .attr('stroke', '#0f766e')
      .attr('stroke-width', 3)
      .attr('d', lineHist);

    // Forecast Line Generator (dashed)
    const forecastData = trendSeries.slice(3); // from current month onwards
    const lineForecast = d3
      .line<(typeof trendSeries)[0]>()
      .x((d) => x(d.month) ?? 0)
      .y((d) => y(d.forecast))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(forecastData)
      .attr('fill', 'none')
      .attr('stroke', '#d97706')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '5,5')
      .attr('d', lineForecast);

    // Dots for Historical
    g.selectAll('.dot-hist')
      .data(histData)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.month) ?? 0)
      .attr('cy', (d) => y(d.historical))
      .attr('r', 5)
      .attr('fill', '#0f766e')
      .attr('stroke', isDark ? '#0f172a' : '#ffffff')
      .attr('stroke-width', 2);

    // Dots for Forecast
    g.selectAll('.dot-forecast')
      .data(forecastData)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.month) ?? 0)
      .attr('cy', (d) => y(d.forecast))
      .attr('r', 5)
      .attr('fill', '#d97706')
      .attr('stroke', isDark ? '#0f172a' : '#ffffff')
      .attr('stroke-width', 2);

  }, [isDark, themeAccent]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="text-center md:text-right space-y-1">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tabular-nums">
              مدل‌سازی آماری پیش‌بینی
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              بر اساس روند تاریخی گذار مراحل پرونده‌ها در نایسر
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            پیش‌بینی تقاضای خدمات منطقه در ۳ ماه آینده (Service Demand Forecast)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            برآورد آماری حجم تقاضای خانوارها برای بسته‌های معیشتی، درمانی و اشتغال با توجه به سرعت جابجایی مراحل.
          </p>
        </div>

        <div className="flex items-center gap-3 justify-center md:justify-start">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span className="w-3 h-3 rounded-full bg-teal-700 inline-block" />
            <span>روند تاریخی واقعی</span>
            <span className="w-3 h-3 rounded-full bg-amber-600 inline-block mr-2" />
            <span>پیش‌بینی ۳ ماهه</span>
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} className="w-full overflow-visible" />
      </div>

      {/* Demand Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {FORECAST_DATA.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {item.category}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded tabular-nums">
                +{item.growthRatePct}٪ رشد
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              <div className="flex justify-between">
                <span>میانگین ماهانه قبلی:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{toPersianNum(item.historicalAvgMonthly)} مورد</span>
              </div>
              <div className="flex justify-between">
                <span>پیش‌بینی ماه آینده:</span>
                <span className="font-bold text-teal-700 dark:text-teal-400">{toPersianNum(item.forecastNextMonth)} مورد</span>
              </div>
              <div className="flex justify-between">
                <span>پیش‌بینی فصل آینده:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{toPersianNum(item.forecastQuarterly)} مورد</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>
            این پیش‌بینی به مدیران مؤسسات دارالاحسان و عدالت کمک می‌کند منابع مالی و سبد‌های حمایتی را پیش از بروز ازدحام تأمین کنند.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onExportToast?.('پیش‌بینی تقاضا', 'گزارش پیش‌بینی تقاضای خدمات ۳ ماهه ذخیره شد.')}
          className="px-3 py-1.5 font-medium bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
        >
          ذخیره گزارش پیش‌بینی
        </button>
      </div>
    </div>
  );
};
