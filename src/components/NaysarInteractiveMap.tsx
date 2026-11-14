import React, {useEffect, useMemo, useRef, useState} from 'react';
import * as d3 from 'd3';
import {
  Lock,
  Maximize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  CaseRecordView,
  InstitutionId,
  NaysarBlock,
  UiThemeAccent,
  UserRole,
} from '../types';

interface NaysarInteractiveMapProps {
  blocks: NaysarBlock[];
  cases: CaseRecordView[];
  selectedBlockId: string;
  onSelectBlock: (blockId: string) => void;
  onInspectCase: (caseRecord: CaseRecordView) => void;
  onOpenWorkflow: (caseId: string) => void;
  activeInstitution: InstitutionId;
  activeRole: UserRole;
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
}

type MapVisualMode = 'hotspot' | 'institution';
type MapTierFilter = 'all' | 'red' | 'yellow' | 'green' | 'own_institution';

interface BlockGeoSpec {
  id: string;
  shortName: string;
  polygon: [number, number][];
  center: [number, number];
  hotspots: Array<{x: number; y: number; weight: number; alleyLabel: string}>;
  labelOffset: [number, number];
}

// Schematic spatial layout of Naysar (Sanandaj) in 800x460 coordinate space:
// West: Beltway / Ring Road (کمربندی مشترک), Center: Main Street (نایسر مرکزی),
// North: Masjed Jameh & Bahar Alley, East/NE: Tappeh Naysar hillside, South: Shahrak Payin.
const BLOCK_GEO_SPECS: Record<string, BlockGeoSpec> = {
  'blk-3': {
    id: 'blk-3',
    shortName: 'بلوک ۳ · مسجد جامع و کوچه بهار',
    polygon: [
      [210, 48],
      [485, 42],
      [512, 165],
      [350, 178],
      [220, 152],
    ],
    center: [358, 112],
    labelOffset: [0, -6],
    hotspots: [
      {x: 318, y: 98, weight: 1.0, alleyLabel: 'کوچه بهار'},
      {x: 416, y: 122, weight: 0.85, alleyLabel: 'محور مسجد جامع'},
      {x: 274, y: 124, weight: 0.72, alleyLabel: 'کوچه گلبرگ'},
    ],
  },
  'blk-2': {
    id: 'blk-2',
    shortName: 'بلوک ۲ · تپه نایسر و حاشیه شرقی',
    polygon: [
      [492, 50],
      [742, 68],
      [756, 268],
      [538, 255],
      [512, 168],
    ],
    center: [634, 164],
    labelOffset: [0, -8],
    hotspots: [
      {x: 618, y: 146, weight: 1.0, alleyLabel: 'تپه شرقی نایسر'},
      {x: 682, y: 196, weight: 0.9, alleyLabel: 'کوچه گلستان'},
      {x: 564, y: 204, weight: 0.75, alleyLabel: 'دامنه تپه'},
    ],
  },
  'blk-1': {
    id: 'blk-1',
    shortName: 'بلوک ۱ · نایسر مرکزی و خیابان اصلی',
    polygon: [
      [220, 156],
      [510, 170],
      [535, 258],
      [492, 316],
      [234, 298],
    ],
    center: [376, 236],
    labelOffset: [0, -6],
    hotspots: [
      {x: 356, y: 226, weight: 1.0, alleyLabel: 'خیابان اصلی نایسر'},
      {x: 438, y: 248, weight: 0.88, alleyLabel: 'کوچه سوم مرکزی'},
      {x: 288, y: 242, weight: 0.78, alleyLabel: 'بازارچه مرکزی'},
    ],
  },
  'blk-5': {
    id: 'blk-5',
    shortName: 'بلوک ۵ · محدوده مشترک کمربندی',
    polygon: [
      [46, 72],
      [206, 52],
      [230, 300],
      [198, 396],
      [54, 368],
    ],
    center: [138, 228],
    labelOffset: [0, -6],
    hotspots: [
      {x: 134, y: 198, weight: 0.95, alleyLabel: 'محور کمربندی'},
      {x: 158, y: 288, weight: 0.82, alleyLabel: 'کوچه شاهد'},
      {x: 108, y: 142, weight: 0.7, alleyLabel: 'ورودی غربی'},
    ],
  },
  'blk-4': {
    id: 'blk-4',
    shortName: 'بلوک ۴ · شهرک پایین نایسر',
    polygon: [
      [234, 302],
      [494, 320],
      [744, 274],
      [720, 412],
      [206, 404],
    ],
    center: [466, 354],
    labelOffset: [0, 4],
    hotspots: [
      {x: 430, y: 352, weight: 0.96, alleyLabel: 'شهرک پایین · کوچه نیلوفر'},
      {x: 572, y: 342, weight: 0.85, alleyLabel: 'بافت جنوبی نایسر'},
      {x: 312, y: 362, weight: 0.74, alleyLabel: 'انتهای شهرک پایین'},
    ],
  },
};

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

function hashStringToUnit(input: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function resolveCasePoint(record: CaseRecordView): {
  x: number;
  y: number;
  alleyHint: string;
} {
  const spec = BLOCK_GEO_SPECS[record.blockId] || BLOCK_GEO_SPECS['blk-1'];
  const addr = record.address || '';
  let hotspot = spec.hotspots[0];

  if (/بهار/.test(addr)) hotspot = spec.hotspots[0];
  else if (/گلبرگ/.test(addr)) hotspot = spec.hotspots[2] || spec.hotspots[0];
  else if (/تپه/.test(addr)) hotspot = spec.hotspots[0];
  else if (/گلستان/.test(addr)) hotspot = spec.hotspots[1] || spec.hotspots[0];
  else if (/شاهد/.test(addr)) hotspot = spec.hotspots[1] || spec.hotspots[0];
  else if (/نیلوفر/.test(addr)) hotspot = spec.hotspots[0];
  else {
    const idx = Math.floor(hashStringToUnit(record.id, 7) * spec.hotspots.length);
    hotspot = spec.hotspots[idx] || spec.hotspots[0];
  }

  const angle = hashStringToUnit(record.id, 19) * Math.PI * 2;
  const dist = 10 + hashStringToUnit(record.id, 31) * 24;
  return {
    x: Math.round(hotspot.x + Math.cos(angle) * dist),
    y: Math.round(hotspot.y + Math.sin(angle) * dist),
    alleyHint: hotspot.alleyLabel,
  };
}

function getTierColor(tier: CaseRecordView['urgencyTier'], isDark: boolean): string {
  if (tier === 'red') return isDark ? '#f87171' : '#dc2626';
  if (tier === 'yellow') return isDark ? '#fbbf24' : '#d97706';
  return isDark ? '#34d399' : '#16a34a';
}

function getTierLabel(tier: CaseRecordView['urgencyTier']): string {
  if (tier === 'red') return 'قرمز (بحرانی)';
  if (tier === 'yellow') return 'زرد (مستمر)';
  return 'سبز (توانمندسازی)';
}

function getInstitutionLabel(id: InstitutionId | 'joint_pilot'): string {
  if (id === 'darolahsan') return 'دارالاحسان سنندج';
  if (id === 'edalat') return 'عدالت و برابری';
  return 'پایلوت مشترک';
}

export const NaysarInteractiveMap: React.FC<NaysarInteractiveMapProps> = ({
  blocks,
  cases,
  selectedBlockId,
  onSelectBlock,
  onInspectCase,
  onOpenWorkflow,
  activeInstitution,
  activeRole,
  isDark = false,
  themeAccent = 'teal',
}) => {
  const [visualMode, setVisualMode] = useState<MapVisualMode>('hotspot');
  const [tierFilter, setTierFilter] = useState<MapTierFilter>('all');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [selectedPinCaseId, setSelectedPinCaseId] = useState<string | null>(null);
  const [hoveredPinCase, setHoveredPinCase] = useState<CaseRecordView | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomLayerRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const accentHex = isDark ? ACCENT_HEX[themeAccent].dark : ACCENT_HEX[themeAccent].light;
  const secondaryInstHex = isDark ? '#38bdf8' : '#0284c7';

  // Filter cases plotted on the map based on active toolbar layer filter
  const visibleCases = useMemo(() => {
    return cases.filter((c) => {
      if (tierFilter === 'red') return c.urgencyTier === 'red';
      if (tierFilter === 'yellow') return c.urgencyTier === 'yellow';
      if (tierFilter === 'green') return c.urgencyTier === 'green';
      if (tierFilter === 'own_institution') return c.owningInstitution === activeInstitution;
      return true;
    });
  }, [cases, tierFilter, activeInstitution]);

  // Precompute spatial pin coordinates for visible cases
  const plottedPins = useMemo(() => {
    return visibleCases.map((record) => {
      const pt = resolveCasePoint(record);
      return {
        record,
        x: pt.x,
        y: pt.y,
        alleyHint: pt.alleyHint,
      };
    });
  }, [visibleCases]);

  // Compute live spatial aggregation per neighborhood block
  const blockSpatialStats = useMemo(() => {
    const map = new Map<
      string,
      {
        block: NaysarBlock;
        totalTrackedCases: number;
        redCount: number;
        yellowCount: number;
        greenCount: number;
        concentrationPct: number;
        densityIntensity: number;
        visibleAlleys: string[];
      }
    >();

    const maxActiveCases = Math.max(1, ...blocks.map((b) => b.activeCasesCount));

    for (const block of blocks) {
      const inBlock = visibleCases.filter((c) => c.blockId === block.id);
      const redCount = inBlock.filter((c) => c.urgencyTier === 'red').length;
      const yellowCount = inBlock.filter((c) => c.urgencyTier === 'yellow').length;
      const greenCount = inBlock.filter((c) => c.urgencyTier === 'green').length;
      const concentrationPct =
        block.householdCount > 0
          ? Number(((block.activeCasesCount / block.householdCount) * 100).toFixed(1))
          : 0;
      const densityIntensity = Math.min(
        1,
        0.28 +
          (block.activeCasesCount / maxActiveCases) * 0.55 +
          Math.min(0.17, redCount * 0.06),
      );

      // Extract non-sensitive street/alley tags for unmasked cases in this block
      const alleySet = new Set<string>();
      for (const c of inBlock) {
        if (!c.isMasked && c.address) {
          const parts = c.address
            .split('،')
            .map((p) => p.trim())
            .filter((p) => p && !p.includes('نایسر') && !p.includes('بلوک') && !p.includes('پلاک'));
          for (const part of parts) {
            alleySet.add(part);
          }
        }
      }
      if (alleySet.size === 0) {
        const spec = BLOCK_GEO_SPECS[block.id];
        if (spec) {
          spec.hotspots.slice(0, 2).forEach((h) => alleySet.add(h.alleyLabel));
        }
      }

      map.set(block.id, {
        block,
        totalTrackedCases: inBlock.length,
        redCount,
        yellowCount,
        greenCount,
        concentrationPct,
        densityIntensity,
        visibleAlleys: Array.from(alleySet).slice(0, 3),
      });
    }
    return map;
  }, [blocks, visibleCases]);

  // Attach D3 zoom/pan to the SVG map
  useEffect(() => {
    if (!svgRef.current || !zoomLayerRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoomLayer = d3.select(zoomLayerRef.current);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.85, 2.6])
      .translateExtent([
        [-60, -40],
        [860, 500],
      ])
      .on('zoom', (event) => {
        zoomLayer.attr('transform', event.transform.toString());
        setZoomScale(Number(event.transform.k.toFixed(2)));
      });

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  const handleZoomBy = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(200)
      .call(zoomBehaviorRef.current.scaleBy, factor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition()
      .duration(220)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  const focusedBlockId =
    hoveredBlockId || (selectedBlockId !== 'all' ? selectedBlockId : 'blk-1');
  const focusedStats = blockSpatialStats.get(focusedBlockId) || blockSpatialStats.get('blk-1');
  const selectedPinCase = useMemo(
    () => cases.find((c) => c.id === selectedPinCaseId) || hoveredPinCase || null,
    [cases, selectedPinCaseId, hoveredPinCase],
  );

  const totalNeighborhoodHouseholds = useMemo(
    () => blocks.reduce((acc, b) => acc + b.householdCount, 0),
    [blocks],
  );
  const totalBlockActiveCases = useMemo(
    () => blocks.reduce((acc, b) => acc + b.activeCasesCount, 0),
    [blocks],
  );

  const mapSurfaceBg = isDark ? '#0b1322' : '#f8fafc';
  const roadStroke = isDark ? '#334155' : '#cbd5e1';
  const ringRoadStroke = isDark ? '#475569' : '#94a3b8';
  const contourStroke = isDark ? '#1e293b' : '#e2e8f0';

  return (
    <section
      aria-label="نقشه تعاملی تمرکز خانوارهای تحت پوشش در محلات نایسر"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
    >
      {/* Header & Map Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            نقشه تعاملی تمرکز خانوارهای تحت پوشش در محلات نایسر
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            نمایش گرافیکی کانون‌های تراکم پرونده‌ها بر اساس داده‌های مکانی بلوک‌ها و نشانی‌های ثبت‌شده · برای فیلتر کارتابل روی هر محله یا پین کلیک کنید.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Layer Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setVisualMode('hotspot')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                visualMode === 'hotspot'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              کانون تراکم و فوریت
            </button>
            <button
              type="button"
              onClick={() => setVisualMode('institution')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                visualMode === 'institution'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              تفکیک مؤسسه مسئول
            </button>
          </div>

          {/* Tier / Institution Filter */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(
              [
                {id: 'all', label: 'همه نقاط'},
                {id: 'red', label: 'بحرانی (قرمز)'},
                {id: 'yellow', label: 'مستمر (زرد)'},
                {id: 'green', label: 'توانمندسازی'},
                {id: 'own_institution', label: 'مؤسسه فعال'},
              ] as {id: MapTierFilter; label: string}[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTierFilter(opt.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  tierFilter === opt.id
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

      {/* Main Map Canvas + Spatial Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Interactive SVG Map (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-3">
          <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Map Overlay Controls: Zoom & Active Filter Reset */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-xs">
              <button
                type="button"
                onClick={() => handleZoomBy(1.25)}
                title="بزرگ‌نمایی"
                aria-label="بزرگ‌نمایی نقشه"
                className="p-1.5 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleZoomBy(0.8)}
                title="کوچک‌نمایی"
                aria-label="کوچک‌نمایی نقشه"
                className="p-1.5 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="بازنشانی نمای نقشه"
                aria-label="بازنشانی نمای نقشه"
                className="p-1.5 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums border-r border-slate-200 dark:border-slate-700">
                {toPersianNum(Math.round(zoomScale * 100))}٪
              </span>
            </div>

            {selectedBlockId !== 'all' && (
              <button
                type="button"
                onClick={() => onSelectBlock('all')}
                className="absolute top-3 right-3 z-10 px-3 py-1.5 text-xs font-medium bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-teal-800 dark:text-teal-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs inline-flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                نمایش همه ۵ محله
              </button>
            )}

            <svg
              ref={svgRef}
              viewBox="0 0 800 460"
              className="w-full h-auto block select-none cursor-grab active:cursor-grabbing"
              role="img"
              aria-label="نقشه گرافیکی تمرکز خانوارهای تحت پوشش در ۵ بلوک نایسر سنندج"
            >
              <defs>
                {/* Thermal Hotspot Radial Gradients */}
                <radialGradient id="hotspot-high" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={isDark ? 0.55 : 0.45} />
                  <stop offset="48%" stopColor="#ea580c" stopOpacity={isDark ? 0.28 : 0.22} />
                  <stop offset="100%" stopColor="#ea580c" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="hotspot-medium" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#d97706" stopOpacity={isDark ? 0.48 : 0.38} />
                  <stop offset="55%" stopColor="#f59e0b" stopOpacity={isDark ? 0.2 : 0.16} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="hotspot-accent" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={accentHex} stopOpacity={isDark ? 0.46 : 0.34} />
                  <stop offset="60%" stopColor={accentHex} stopOpacity={isDark ? 0.16 : 0.12} />
                  <stop offset="100%" stopColor={accentHex} stopOpacity="0" />
                </radialGradient>
                <pattern
                  id="naysar-grid"
                  width="32"
                  height="32"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 32 0 L 0 0 0 32"
                    fill="none"
                    stroke={contourStroke}
                    strokeWidth="0.6"
                    opacity="0.7"
                  />
                </pattern>
              </defs>

              {/* Base Topographic Surface */}
              <rect width="800" height="460" fill={mapSurfaceBg} />
              <rect width="800" height="460" fill="url(#naysar-grid)" />

              <g ref={zoomLayerRef}>
                {/* Eastern Hill Contour Rings (تپه نایسر) */}
                <g fill="none" stroke={contourStroke} strokeWidth="1.2" strokeDasharray="4,4">
                  <ellipse cx="660" cy="160" rx="115" ry="95" />
                  <ellipse cx="670" cy="155" rx="76" ry="62" />
                  <ellipse cx="678" cy="150" rx="40" ry="32" />
                </g>

                {/* Neighborhood Polygons */}
                {blocks.map((block) => {
                  const spec = BLOCK_GEO_SPECS[block.id];
                  if (!spec) return null;
                  const stats = blockSpatialStats.get(block.id);
                  const isSelected = selectedBlockId === block.id;
                  const isHovered = hoveredBlockId === block.id;

                  let fillHex = isDark ? '#1e293b' : '#ffffff';
                  let fillOpacity = 0.85;

                  if (visualMode === 'institution') {
                    if (block.leadInstitution === 'darolahsan') {
                      fillHex = accentHex;
                      fillOpacity = isSelected || isHovered ? 0.28 : 0.16;
                    } else if (block.leadInstitution === 'edalat') {
                      fillHex = secondaryInstHex;
                      fillOpacity = isSelected || isHovered ? 0.28 : 0.16;
                    } else {
                      fillHex = isDark ? '#a78bfa' : '#7c3aed';
                      fillOpacity = isSelected || isHovered ? 0.28 : 0.16;
                    }
                  } else {
                    const intensity = stats?.densityIntensity ?? 0.4;
                    if (stats && stats.redCount >= 2) {
                      fillHex = isDark ? '#7f1d1d' : '#fef2f2';
                      fillOpacity = isSelected || isHovered ? 0.85 : 0.55 + intensity * 0.2;
                    } else if (intensity > 0.72) {
                      fillHex = isDark ? '#78350f' : '#fffbeb';
                      fillOpacity = isSelected || isHovered ? 0.85 : 0.55 + intensity * 0.2;
                    } else {
                      fillHex = isDark ? '#134e4a' : '#f0fdfa';
                      fillOpacity = isSelected || isHovered ? 0.75 : 0.45 + intensity * 0.2;
                    }
                  }

                  const strokeHex =
                    isSelected || isHovered
                      ? accentHex
                      : isDark
                        ? '#475569'
                        : '#94a3b8';

                  return (
                    <g
                      key={block.id}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                      onClick={() =>
                        onSelectBlock(selectedBlockId === block.id ? 'all' : block.id)
                      }
                    >
                      <polygon
                        points={spec.polygon.map((p) => p.join(',')).join(' ')}
                        fill={fillHex}
                        fillOpacity={fillOpacity}
                        stroke={strokeHex}
                        strokeWidth={isSelected ? 3 : isHovered ? 2.2 : 1.3}
                        strokeLinejoin="round"
                      />
                    </g>
                  );
                })}

                {/* Arterial Roads & Street Network */}
                <g fill="none" strokeLinecap="round" pointerEvents="none">
                  {/* Western Ring Road (کمربندی سنندج) */}
                  <path
                    d="M 48 34 Q 32 220 56 420"
                    stroke={ringRoadStroke}
                    strokeWidth="6"
                  />
                  <path
                    d="M 48 34 Q 32 220 56 420"
                    stroke={isDark ? '#1e293b' : '#ffffff'}
                    strokeWidth="1.5"
                    strokeDasharray="8,6"
                  />
                  {/* Main Naysar Boulevard (خیابان اصلی نایسر) */}
                  <path
                    d="M 52 210 C 210 198, 400 228, 535 256 L 748 268"
                    stroke={roadStroke}
                    strokeWidth="4.5"
                  />
                  {/* North-South Spine (محور مسجد جامع به شهرک پایین) */}
                  <path
                    d="M 358 46 C 350 155, 368 270, 385 408"
                    stroke={roadStroke}
                    strokeWidth="3.5"
                  />
                  {/* Tappeh Naysar Connector */}
                  <path
                    d="M 508 168 L 732 136"
                    stroke={roadStroke}
                    strokeWidth="2.5"
                    strokeDasharray="5,4"
                  />
                </g>

                {/* Road Labels */}
                <g
                  fill={isDark ? '#94a3b8' : '#64748b'}
                  fontSize="10"
                  fontFamily="inherit"
                  pointerEvents="none"
                >
                  <text x="64" y="42" textAnchor="start">
                    کمربندی مشترک سنندج
                  </text>
                  <text x="385" y="210" textAnchor="middle">
                    محور اصلی نایسر
                  </text>
                  <text x="688" y="88" textAnchor="middle">
                    ارتفاعات تپه نایسر
                  </text>
                </g>

                {/* Thermal Concentration Halos per Neighborhood Hotspot */}
                {visualMode === 'hotspot' &&
                  blocks.map((block) => {
                    const spec = BLOCK_GEO_SPECS[block.id];
                    const stats = blockSpatialStats.get(block.id);
                    if (!spec || !stats) return null;
                    if (selectedBlockId !== 'all' && selectedBlockId !== block.id) return null;

                    const gradId =
                      stats.redCount >= 2
                        ? 'url(#hotspot-high)'
                        : stats.redCount === 1 || stats.yellowCount >= 2
                          ? 'url(#hotspot-medium)'
                          : 'url(#hotspot-accent)';

                    return (
                      <g key={`halo-${block.id}`} pointerEvents="none">
                        {spec.hotspots.map((spot, idx) => {
                          const radius =
                            (28 + stats.block.activeCasesCount * 0.72) * spot.weight;
                          return (
                            <circle
                              key={`${block.id}-spot-${idx}`}
                              cx={spot.x}
                              cy={spot.y}
                              r={radius}
                              fill={gradId}
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                {/* Neighborhood Center Labels & Aggregate Cluster Badges */}
                {blocks.map((block) => {
                  const spec = BLOCK_GEO_SPECS[block.id];
                  const stats = blockSpatialStats.get(block.id);
                  if (!spec || !stats) return null;
                  const isDimmed =
                    selectedBlockId !== 'all' && selectedBlockId !== block.id;

                  return (
                    <g
                      key={`label-${block.id}`}
                      transform={`translate(${spec.center[0] + spec.labelOffset[0]}, ${spec.center[1] + spec.labelOffset[1]})`}
                      opacity={isDimmed ? 0.35 : 1}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                      onClick={() =>
                        onSelectBlock(selectedBlockId === block.id ? 'all' : block.id)
                      }
                    >
                      <rect
                        x="-78"
                        y="-26"
                        width="156"
                        height="38"
                        rx="8"
                        fill={isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)'}
                        stroke={
                          selectedBlockId === block.id
                            ? accentHex
                            : isDark
                              ? '#334155'
                              : '#cbd5e1'
                        }
                        strokeWidth={selectedBlockId === block.id ? 1.8 : 1}
                      />
                      <text
                        x="0"
                        y="-10"
                        textAnchor="middle"
                        fill={isDark ? '#f1f5f9' : '#0f172a'}
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="inherit"
                      >
                        {spec.shortName}
                      </text>
                      <text
                        x="0"
                        y="5"
                        textAnchor="middle"
                        fill={isDark ? '#94a3b8' : '#475569'}
                        fontSize="10"
                        fontFamily="inherit"
                      >
                        {toPersianNum(block.activeCasesCount)} پرونده فعال ·{' '}
                        {toPersianNum(stats.concentrationPct)}٪ تراکم
                      </text>
                    </g>
                  );
                })}

                {/* Individual Case Spatial Pins */}
                {plottedPins.map(({record, x, y}) => {
                  const isBlockDimmed =
                    selectedBlockId !== 'all' && record.blockId !== selectedBlockId;
                  const isSelectedPin = selectedPinCaseId === record.id;
                  const pinColor =
                    visualMode === 'institution'
                      ? record.owningInstitution === 'darolahsan'
                        ? accentHex
                        : secondaryInstHex
                      : getTierColor(record.urgencyTier, isDark);

                  return (
                    <g
                      key={record.id}
                      transform={`translate(${x}, ${y})`}
                      opacity={isBlockDimmed ? 0.25 : 1}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredPinCase(record)}
                      onMouseLeave={() => setHoveredPinCase(null)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPinCaseId((prev) =>
                          prev === record.id ? null : record.id,
                        );
                      }}
                    >
                      {/* Outer halo ring when selected */}
                      {isSelectedPin && (
                        <circle
                          r="13"
                          fill="none"
                          stroke={pinColor}
                          strokeWidth="2"
                          opacity="0.7"
                        />
                      )}
                      <circle
                        r={isSelectedPin ? 8.5 : 6.5}
                        fill={pinColor}
                        stroke={isDark ? '#0f172a' : '#ffffff'}
                        strokeWidth="2"
                      />
                      {record.isMasked && (
                        <circle
                          r="2.1"
                          fill={isDark ? '#0f172a' : '#ffffff'}
                          pointerEvents="none"
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Compass Indicator (Bottom Right of SVG) */}
              <g transform="translate(760, 422)" pointerEvents="none">
                <circle
                  r="16"
                  fill={isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)'}
                  stroke={isDark ? '#334155' : '#cbd5e1'}
                  strokeWidth="1"
                />
                <path
                  d="M 0 -10 L 4 2 L 0 -1 L -4 2 Z"
                  fill={accentHex}
                />
                <text
                  x="0"
                  y="11"
                  textAnchor="middle"
                  fill={isDark ? '#cbd5e1' : '#334155'}
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="inherit"
                >
                  شمال
                </text>
              </g>
            </svg>
          </div>

          {/* Map Legend Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 px-1">
            <div className="flex flex-wrap items-center gap-4">
              {visualMode === 'hotspot' ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-red-600 inline-block" />
                    بحرانی (نیاز فوری)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-600 inline-block" />
                    نیازمند مستمر
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                    توانمندسازی / خوداتکا
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block"
                      style={{backgroundColor: accentHex}}
                    />
                    پرونده‌های دارالاحسان سنندج
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs inline-block"
                      style={{backgroundColor: secondaryInstHex}}
                    />
                    پرونده‌های عدالت و برابری
                  </span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Lock className="w-3 h-3" />
                نقاط دارای مرکز سفید: پرونده محرمانه همکار (بدون افشای هویت)
              </span>
            </div>

            <div className="tabular-nums text-slate-500 dark:text-slate-400">
              نمایش {toPersianNum(plottedPins.length)} نقطه پرونده در ۵ محله ({toPersianNum(totalBlockActiveCases)} پرونده فعال از {toPersianNum(totalNeighborhoodHouseholds)} خانوار)
            </div>
          </div>
        </div>

        {/* Spatial Neighborhood & Selected Pin Inspector Sidebar (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          {/* Active Neighborhood Concentration Detail */}
          {focusedStats && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {focusedStats.block.zoneLabel} ·{' '}
                    {getInstitutionLabel(focusedStats.block.leadInstitution)}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {focusedStats.block.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onSelectBlock(
                      selectedBlockId === focusedStats.block.id ? 'all' : focusedStats.block.id,
                    )
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedBlockId === focusedStats.block.id
                      ? 'bg-teal-700 text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {selectedBlockId === focusedStats.block.id ? 'فیلتر فعال' : 'فیلتر کارتابل'}
                </button>
              </div>

              <div className="grid grid-cols-3 border border-slate-200 dark:border-slate-700 rounded-lg divide-x divide-x-reverse divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900 text-center tabular-nums">
                <div className="p-2.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">کل خانوار</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {toPersianNum(focusedStats.block.householdCount)}
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">تحت پوشش</div>
                  <div className="text-sm font-bold text-teal-700 dark:text-teal-400 mt-0.5">
                    {toPersianNum(focusedStats.block.activeCasesCount)}
                  </div>
                </div>
                <div className="p-2.5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">نرخ تمرکز</div>
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                    {toPersianNum(focusedStats.concentrationPct)}٪
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
                <div className="flex items-center justify-between tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">
                    وضعیت پرونده‌های کارتابل در این محله:
                  </span>
                  <span className="font-medium">
                    قرمز {toPersianNum(focusedStats.redCount)} · زرد{' '}
                    {toPersianNum(focusedStats.yellowCount)} · سبز{' '}
                    {toPersianNum(focusedStats.greenCount)}
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  کانون‌های تمرکز ثبت‌شده:{' '}
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {focusedStats.visibleAlleys.join(' · ')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Selected / Hovered Case Pin Card */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 flex-1 flex flex-col justify-between space-y-3">
            {selectedPinCase ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {selectedPinCase.id}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {getTierLabel(selectedPinCase.urgencyTier)}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {selectedPinCase.isMasked
                      ? 'پرونده محرمانه مؤسسه همکار'
                      : selectedPinCase.fullName}
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
                    <div>{selectedPinCase.blockName}</div>
                    {!selectedPinCase.isMasked && selectedPinCase.address && (
                      <div className="text-slate-700 dark:text-slate-300">
                        نشانی: {selectedPinCase.address}
                      </div>
                    )}
                    {selectedPinCase.isMasked && (
                      <div className="text-slate-500 dark:text-slate-400">
                        {activeRole === 'privacy_officer' || activeRole === 'system_admin'
                          ? 'نشانی دقیق در نقش ناظر امنیتی مخفی شده است.'
                          : 'نشانی دقیق فقط در دسترس مؤسسه متولی پرونده است.'}
                      </div>
                    )}
                    <div className="tabular-nums">
                      امتیاز معیشتی: <strong>{toPersianNum(selectedPinCase.score.total)}/۱۰۰</strong> ·
                      مرحله {toPersianNum(selectedPinCase.stage)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onInspectCase(selectedPinCase)}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-950 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors"
                  >
                    مشاهده پرونده
                  </button>
                  {!selectedPinCase.isMasked && (
                    <button
                      type="button"
                      onClick={() => onOpenWorkflow(selectedPinCase.id)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                    >
                      مدیریت مورد
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed flex flex-col justify-center h-full py-4 space-y-2">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  راهنمای تعامل با نقشه نایسر
                </div>
                <p>
                  نشانگر را روی هر یک از ۵ محله یا نقاط رنگی پرونده‌ها قرار دهید تا آمار تراکم و کانون‌های محل نمایش داده شود.
                </p>
                <p>
                  با کلیک روی هر محله، جدول پرونده‌های پایین صفحه مستقیماً روی همان محدوده فیلتر می‌شود و با کلیک روی هر نقطه می‌توانید جزئیات پرونده را باز کنید.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
