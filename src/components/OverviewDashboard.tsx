import React, {useEffect, useMemo, useState} from 'react';
import {
  Briefcase,
  FileSpreadsheet,
  HeartPulse,
  History,
  Home,
  Lock,
  Search,
  ShoppingBasket,
  X,
} from 'lucide-react';
import {BeneficiaryDossierModal} from './BeneficiaryDossierModal';
import {CaseManagementWorkflowModal} from './CaseManagementWorkflowModal';
import {InstitutionEmblem} from './InstitutionalLogo';
import {NaysarInteractiveMap} from './NaysarInteractiveMap';
import {Stage5FollowUpCalendar} from './Stage5FollowUpCalendar';
import {StageDistributionPieWidget} from './StageDistributionPieWidget';
import {StageForecastPanel} from './StageForecastPanel';
import {exportCasesRegisterToExcel} from '../utils/excelExport';
import type {
  AiPrioritizationFocus,
  AiPrioritizationResult,
  CaseRecordView,
  CaseStage,
  DashboardSummary,
  InstitutionId,
  NaysarBlock,
  PredictedServiceCategory,
  ThreeMonthNeedForecast,
  UiThemeAccent,
  UserRole,
} from '../types';

interface OverviewDashboardProps {
  summary: DashboardSummary;
  blocks: NaysarBlock[];
  cases: CaseRecordView[];
  activeInstitution: InstitutionId;
  activeRole: UserRole;
  onAdvanceStage: (caseId: string, nextStage: CaseStage) => Promise<void>;
  onEditCase: (caseId: string) => void;
  onWorkflowSaved: (
    updatedCase?: CaseRecordView,
    meta?: {advanced: boolean; previousStage: CaseStage},
  ) => Promise<void>;
  initialWorkflowCaseId?: string | null;
  onClearInitialWorkflowCase?: () => void;
  onNavigateToInquiry: () => void;
  onNavigateToAssessment: () => void;
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  preparedBy?: string;
  generatedAt?: string;
  onExportToast?: (title: string, description: string) => void;
}

const STAGE_LABELS: Record<CaseStage, string> = {
  1: '۱. پذیرش و ارجاع',
  2: '۲. ارزیابی همه‌جانبه',
  3: '۳. برنامه مداخله',
  4: '۴. اجرا و خدمات',
  5: '۵. پایش مستمر',
  6: '۶. خروج موفق',
};

function getInstitutionName(id: InstitutionId | 'joint_pilot'): string {
  if (id === 'darolahsan') return 'دارالاحسان سنندج';
  if (id === 'edalat') return 'عدالت و برابری کردستان';
  return 'پایلوت مشترک دو مؤسسه';
}

function getTierMeta(tier: CaseRecordView['urgencyTier']) {
  if (tier === 'red') {
    return {
      label: 'قرمز · بحرانی (فوری)',
      textClass: 'text-red-700 dark:text-red-400',
    };
  }
  if (tier === 'yellow') {
    return {
      label: 'زرد · نیازمند مستمر',
      textClass: 'text-amber-700 dark:text-amber-400',
    };
  }
  return {
    label: 'سبز · مستعد توانمندسازی',
    textClass: 'text-emerald-700 dark:text-emerald-400',
  };
}

function normalizeSearchText(input: string): string {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return input
    .trim()
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeDigitsOnly(input: string): string {
  return normalizeSearchText(input).replace(/\D/g, '');
}

function getForecastIcon(category: PredictedServiceCategory) {
  if (category === 'medical') return HeartPulse;
  if (category === 'employment') return Briefcase;
  if (category === 'housing') return Home;
  return ShoppingBasket;
}

const ForecastRiskIndicator: React.FC<{forecast: ThreeMonthNeedForecast}> = ({forecast}) => {
  const Icon = getForecastIcon(forecast.category);
  const styleClass =
    forecast.riskLevel === 'high'
      ? 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-300'
      : forecast.riskLevel === 'medium'
        ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-300'
        : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300';
  const riskWord =
    forecast.riskLevel === 'high'
      ? 'ریسک بالا'
      : forecast.riskLevel === 'medium'
        ? 'ریسک متوسط'
        : 'ریسک پایین';

  return (
    <span
      title={forecast.rationale}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold tabular-nums whitespace-nowrap ${styleClass}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>
        {riskWord} ({forecast.probabilityPct}٪): {forecast.categoryLabel}
      </span>
    </span>
  );
};

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  summary,
  blocks,
  cases,
  activeInstitution,
  activeRole,
  onAdvanceStage,
  onEditCase,
  onWorkflowSaved,
  initialWorkflowCaseId = null,
  onClearInitialWorkflowCase,
  onNavigateToInquiry,
  onNavigateToAssessment,
  isDark = false,
  themeAccent = 'teal',
  preparedBy,
  generatedAt,
  onExportToast,
}) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<CaseStage | 'all'>('all');
  const [selectedForecastFilter, setSelectedForecastFilter] = useState<
    'all' | 'high_risk' | PredictedServiceCategory
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [serverMatchedIds, setServerMatchedIds] = useState<Set<string> | null>(null);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [inspectedCase, setInspectedCase] = useState<CaseRecordView | null>(null);
  const [dossierCase, setDossierCase] = useState<CaseRecordView | null>(null);
  const [workflowCaseId, setWorkflowCaseId] = useState<string | null>(initialWorkflowCaseId);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [aiFocus, setAiFocus] = useState<AiPrioritizationFocus>('comprehensive');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiPrioritizationResult | null>(null);

  useEffect(() => {
    if (initialWorkflowCaseId) {
      setWorkflowCaseId(initialWorkflowCaseId);
    }
  }, [initialWorkflowCaseId]);

  const workflowTargetCase = useMemo(() => {
    if (!workflowCaseId) return null;
    return cases.find((c) => c.id === workflowCaseId) || null;
  }, [cases, workflowCaseId]);

  useEffect(() => {
    setAiAnalysis(null);
    setAiError(null);
    if (activeRole === 'privacy_officer' || activeRole === 'system_admin') {
      setSelectedForecastFilter('all');
    }
  }, [activeInstitution, activeRole]);

  useEffect(() => {
    if (!inspectedCase) return;
    const latest = cases.find((c) => c.id === inspectedCase.id);
    if (latest && latest !== inspectedCase) {
      setInspectedCase(latest);
    }
  }, [cases, inspectedCase]);

  useEffect(() => {
    if (!inspectedCase) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectedCase(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedCase]);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setServerMatchedIds(null);
      setIsSearchingServer(false);
      return;
    }

    const controller = new AbortController();
    setIsSearchingServer(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/cases/search?institution=${encodeURIComponent(activeInstitution)}&role=${encodeURIComponent(activeRole)}&q=${encodeURIComponent(trimmed)}`,
          {signal: controller.signal},
        );
        if (!res.ok) return;
        const data = (await res.json()) as {matchedIds: string[]};
        setServerMatchedIds(new Set(data.matchedIds));
      } catch (err: unknown) {
        if ((err as {name?: string})?.name !== 'AbortError') {
          setServerMatchedIds(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingServer(false);
        }
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, activeInstitution, activeRole]);

  const stagnantCases = useMemo(() => {
    return cases
      .filter((item) => item.stage < 6 && item.daysInStage > 90)
      .sort((a, b) => b.daysInStage - a.daysInStage);
  }, [cases]);

  const matchesTextQuery = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) return null;
    const q = normalizeSearchText(trimmed);
    const qDigits = normalizeDigitsOnly(trimmed);

    return (item: CaseRecordView) => {
      if (serverMatchedIds && serverMatchedIds.has(item.id)) {
        return true;
      }
      const matchesId = normalizeSearchText(item.id).includes(q);
      const matchesHash = item.nationalIdHash.toLowerCase().includes(q);
      const matchesBlock = normalizeSearchText(item.blockName).includes(q);
      const matchesName = item.fullName
        ? normalizeSearchText(item.fullName).includes(q)
        : false;
      const matchesHead = item.headStatus
        ? normalizeSearchText(item.headStatus).includes(q)
        : false;
      const matchesMaskedNid =
        qDigits.length > 0 && item.nationalIdMasked
          ? item.nationalIdMasked.replace(/\D/g, '').includes(qDigits)
          : false;

      return (
        matchesId ||
        matchesHash ||
        matchesBlock ||
        matchesName ||
        matchesHead ||
        matchesMaskedNid
      );
    };
  }, [searchTerm, serverMatchedIds]);

  const searchMatches = useMemo(() => {
    if (!matchesTextQuery) return [];
    return cases.filter(matchesTextQuery);
  }, [cases, matchesTextQuery]);

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      if (selectedBlockId !== 'all' && item.blockId !== selectedBlockId) {
        return false;
      }
      if (selectedStage !== 'all' && item.stage !== selectedStage) {
        return false;
      }
      if (selectedForecastFilter !== 'all') {
        if (!item.needForecast3M) return false;
        if (selectedForecastFilter === 'high_risk') {
          if (item.needForecast3M.riskLevel !== 'high') return false;
        } else if (item.needForecast3M.category !== selectedForecastFilter) {
          return false;
        }
      }
      if (matchesTextQuery && !matchesTextQuery(item)) {
        return false;
      }
      return true;
    });
  }, [cases, selectedBlockId, selectedStage, selectedForecastFilter, matchesTextQuery]);

  const handleAdvance = async (item: CaseRecordView) => {
    if (item.stage >= 6 || item.isMasked) return;
    setUpdatingId(item.id);
    try {
      const next = (item.stage + 1) as CaseStage;
      await onAdvanceStage(item.id, next);
      if (inspectedCase && inspectedCase.id === item.id) {
        setInspectedCase({...inspectedCase, stage: next});
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRunAiPrioritization = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/prioritize', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          institution: activeInstitution,
          role: activeRole,
          focusArea: aiFocus,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'خطا در تحلیل هوشمند پرونده‌ها.');
        return;
      }
      setAiAnalysis(data.analysis);
    } catch {
      setAiError('خطا در برقراری ارتباط با سرویس تحلیل هوشمند.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
    <div className="space-y-8 dossier-print-hide">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            پیشخوان مدیریت مورد و هماهنگی خدمات نایسر
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            سامانه مشترک پایش پرونده‌ها، بلوک‌بندی جغرافیایی محلات و جلوگیری از موازی‌کاری میان
            مؤسسه خیریه دارالاحسان سنندج و مؤسسه خیریه عدالت و برابری کردستان.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateToInquiry}
            className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            استعلام کدملی
          </button>
          <button
            type="button"
            onClick={onNavigateToAssessment}
            className="px-4 py-2.5 text-sm font-medium rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors whitespace-nowrap shrink-0"
          >
            ثبت ارزیابی و پرونده جدید
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <section aria-label="شاخص‌های کلیدی سامانه" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            پرونده‌های فعال در نایسر
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.totalActiveCases}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <InstitutionEmblem institution="darolahsan" size="xs" />
                {summary.darolahsanCases}
              </span>
              <span aria-hidden="true">/</span>
              <span className="inline-flex items-center gap-1">
                <InstitutionEmblem institution="edalat" size="xs" />
                {summary.edalatCases}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            هم‌پوشانی‌های پیشگیری‌شده
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-teal-700 dark:text-teal-400 tabular-nums">
              {summary.overlapsPrevented}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">تخصیص عادلانه منابع</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            پراکندگی درجه فوریت
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              قرمز {summary.redTierCount} · زرد {summary.yellowTierCount} · سبز {summary.greenTierCount}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            بر اساس فرم امتیازدهی ۱۰۰ امتیازی
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            سرعت پاسخ استعلام امن
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {summary.avgInquiryMs}{' '}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">میلی‌ثانیه</span>
            </span>
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              هش یک‌طرفه SHA-256
            </span>
          </div>
        </div>
      </section>

      {/* 6-Stage Case Status Distribution Pie Chart Widget */}
      <StageDistributionPieWidget
        cases={cases}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
        isDark={isDark}
        themeAccent={themeAccent}
      />

      {/* Stage 5 Follow-up Due Dates Mini Calendar */}
      <Stage5FollowUpCalendar
        cases={cases}
        onInspectCase={(item) => setInspectedCase(item)}
        onOpenWorkflow={(caseId) => setWorkflowCaseId(caseId)}
      />

      {/* Quick Text Search for Head Name or Partial National ID */}
      <section
        aria-label="جستجوی سریع پرونده‌ها در پیشخوان"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              جستجوی سریع پرونده (نام یا کدملی سرپرست خانوار)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              بخشی از نام سرپرست خانوار، ارقام ابتدایی یا انتهایی کدملی (مثلاً ۳۷۳ یا ۴۵۸۹)، شماره پرونده یا نام بلوک را وارد کنید.
            </p>
          </div>
          {searchTerm.trim() && (
            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                {isSearchingServer
                  ? 'در حال جستجو...'
                  : `${searchMatches.length} پرونده مرتبط یافت شد`}
              </span>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4"
              >
                پاک کردن جستجو
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <Search
            aria-hidden="true"
            className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو با بخشی از نام (مثلاً فرشته) یا کدملی سرپرست خانوار (مثلاً ۳۷۳۲ یا ۴۵۸۹)..."
            aria-label="جستجو با نام یا کدملی سرپرست خانوار"
            className="w-full pr-10 pl-10 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white dark:focus:bg-slate-900 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="پاک کردن عبارت جستجو"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 absolute left-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {searchTerm.trim() && (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-800/30">
            {searchMatches.length === 0 ? (
              <div className="p-5 text-center space-y-1.5">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  پرونده‌ای با عبارت «{searchTerm.trim()}» در دسترس این مؤسسه یافت نشد.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  توجه: مطابق تفکیک داده‌ها، جستجوی نام و کدملی جزئی فقط برای پرونده‌های مؤسسه فعال انجام می‌شود؛ برای بررسی کدملی ۱۰ رقمی کامل در هر دو مؤسسه از بخش{' '}
                  <button
                    type="button"
                    onClick={onNavigateToInquiry}
                    className="text-teal-700 dark:text-teal-400 font-semibold hover:underline"
                  >
                    استعلام کدملی
                  </button>{' '}
                  استفاده کنید.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {searchMatches.slice(0, 6).map((item) => {
                  const tier = getTierMeta(item.urgencyTier);
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            {item.id}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {item.isMasked ? 'پرونده محرمانه مؤسسه همکار' : item.fullName}
                          </span>
                          {!item.isMasked && item.needForecast3M && (
                            <ForecastRiskIndicator forecast={item.needForecast3M} />
                          )}
                          {!item.isMasked && item.nationalIdMasked && (
                            <>
                              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                ·
                              </span>
                              <span className="font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                                کدملی: {item.nationalIdMasked}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{item.blockName}</span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            {STAGE_LABELS[item.stage]}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <span className={`font-medium ${tier.textClass}`}>{tier.label}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setInspectedCase(item)}
                          className="px-3 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-950 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors whitespace-nowrap"
                        >
                          مشاهده پرونده
                        </button>
                        {!item.isMasked && (
                          <>
                            <button
                              type="button"
                              onClick={() => setWorkflowCaseId(item.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
                            >
                              مدیریت مورد
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditCase(item.id)}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                            >
                              بروزرسانی
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {searchMatches.length > 6 && (
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span className="tabular-nums">
                      نمایش ۶ نتیجه اول از {searchMatches.length} پرونده یافت‌شده
                    </span>
                    <a
                      href="#overview-case-table"
                      className="font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
                    >
                      مشاهده همه در کارتابل ↓
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Stagnant Cases Alert Section (> 3 months in one stage) */}
      <section
        aria-label="هشدار پرونده‌های متوقف‌شده بیش از ۳ ماه"
        className={`rounded-xl border p-6 space-y-4 ${
          stagnantCases.length > 0
            ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800/70'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              هشدار بهینه‌سازی مدیریت مورد: پرونده‌های راکد (بیش از ۳ ماه در یک مرحله)
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {stagnantCases.length > 0
                ? `${stagnantCases.length} پرونده بیش از ۹۰ روز بدون تغییر مرحله باقی مانده‌اند و نیازمند پیگیری مددکار یا ارتقا به مرحله بعد هستند.`
                : 'همه پرونده‌های فعال در بازه زمانی استاندارد (کمتر از ۳ ماه در هر مرحله) در حال پیگیری هستند.'}
            </p>
          </div>

          {stagnantCases.length > 0 && (
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-300 tabular-nums whitespace-nowrap shrink-0">
              تعداد نیازمند اقدام: {stagnantCases.length} پرونده
            </div>
          )}
        </div>

        {stagnantCases.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-amber-200/90 dark:border-amber-900/60 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
            {stagnantCases.map((item) => {
              const monthsStopped = (item.daysInStage / 30).toFixed(1);
              const isCriticalStop = item.urgencyTier === 'red' || item.daysInStage >= 120;
              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {item.id}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {item.isMasked ? 'پرونده محرمانه مؤسسه همکار' : item.fullName}
                      </span>
                      {!item.isMasked && item.needForecast3M && (
                        <ForecastRiskIndicator forecast={item.needForecast3M} />
                      )}
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {STAGE_LABELS[item.stage]}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                      <span
                        className={`font-semibold ${
                          isCriticalStop
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        توقف {item.daysInStage} روز ({monthsStopped} ماه) از تاریخ {item.stageEnteredDate}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span>{getInstitutionName(item.owningInstitution)}</span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span>{item.blockName}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setInspectedCase(item)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                    >
                      بررسی جزئیات
                    </button>
                    {!item.isMasked ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setWorkflowCaseId(item.id)}
                          className="px-3 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          ثبت اجزای مرحله
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => handleAdvance(item)}
                          className="px-3.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          ارتقا به مرحله {item.stage + 1}
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                        تحت پیگیری مؤسسه همکار
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* AI Case Analysis & Household Prioritization */}
      <section
        aria-label="تحلیل هوشمند داده‌های پرونده و اولویت‌بندی خانوارها"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              تحلیل هوشمند داده‌ها و اولویت‌بندی خانوارها برای دریافت خدمات حمایتی
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
              تحلیل هم‌زمان شاخص‌های ۴گانه معیشتی (ساختار خانوار، مسکن، درآمد و سلامت) و مدت توقف پرونده‌ها بدون ارسال نام و کدملی جهت پیشنهاد اولویت‌بندی دریافت خدمات.
            </p>
          </div>

          <button
            type="button"
            disabled={aiLoading}
            onClick={handleRunAiPrioritization}
            className="px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {aiLoading ? 'در حال تحلیل و اولویت‌بندی...' : 'تحلیل هوشمند و اولویت‌بندی'}
          </button>
        </div>

        {/* Focus Selector */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
            محور اولویت‌بندی:
          </span>
          {(
            [
              {id: 'comprehensive', label: 'جامع خدمات حمایتی'},
              {id: 'livelihood_medical', label: 'سبد معیشتی و درمان فوری'},
              {id: 'empowerment', label: 'تسهیلات و اشتغال خانگی'},
              {id: 'housing', label: 'مسکن و اجاره‌بها'},
            ] as {id: AiPrioritizationFocus; label: string}[]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAiFocus(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                aiFocus === opt.id
                  ? 'bg-slate-900 dark:bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {aiError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-800 dark:text-red-300">
            {aiError}
          </div>
        )}

        {aiAnalysis && (
          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-1.5">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  تحلیل کلان شاخص‌های معیشتی ({aiAnalysis.analyzedCasesCount} پرونده فعال)
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {aiAnalysis.executiveSummary}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-1.5">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  راهبرد پیشنهادی تخصیص منابع و هم‌افزایی
                </div>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                  {aiAnalysis.resourceAllocationStrategy}
                </p>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
              {aiAnalysis.prioritizedHouseholds.map((rec) => {
                const matched = cases.find((c) => c.id === rec.caseId);
                const priorityColor = rec.priorityLevel.includes('فوری')
                  ? 'text-red-700 dark:text-red-400'
                  : rec.priorityLevel.includes('بالا')
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-teal-700 dark:text-teal-400';

                return (
                  <div
                    key={rec.caseId}
                    className="p-4 sm:p-5 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors space-y-3"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2.5 text-sm">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-900 dark:bg-slate-800 text-white tabular-nums">
                          اولویت {rec.rank}
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {rec.caseId}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {matched
                            ? matched.isMasked
                              ? 'پرونده محرمانه مؤسسه همکار'
                              : matched.fullName
                            : rec.caseId}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className={`text-xs font-semibold ${priorityColor}`}>
                          {rec.priorityLevel}
                        </span>
                      </div>

                      {matched && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setInspectedCase(matched)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                          >
                            مشاهده پرونده
                          </button>
                          {!matched.isMasked && matched.stage < 6 && (
                            <button
                              type="button"
                              disabled={updatingId === matched.id}
                              onClick={() => handleAdvance(matched)}
                              className="px-3 py-1.5 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-950 border border-teal-200 dark:border-teal-800 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              ارتقا به مرحله {matched.stage + 1}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {matched && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <span>{matched.blockName}</span>
                        <span aria-hidden="true">·</span>
                        <span>امتیاز کل: {matched.score.total}/100</span>
                        <span aria-hidden="true">·</span>
                        <span>ساختار {matched.score.familyStructure}/30</span>
                        <span>مسکن {matched.score.housing}/25</span>
                        <span>معیشت {matched.score.livelihood}/25</span>
                        <span>سلامت {matched.score.health}/20</span>
                        <span aria-hidden="true">·</span>
                        <span>{matched.daysInStage} روز در {STAGE_LABELS[matched.stage]}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs sm:text-sm pt-1">
                      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div className="text-xs font-semibold text-teal-800 dark:text-teal-400 mb-1">
                          بسته حمایتی پیشنهادی
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                          {rec.recommendedServicePackage}
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          استدلال مبتنی بر شاخص‌ها
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{rec.rationale}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          اثر مورد انتظار
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{rec.estimatedImpact}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Probabilistic 6-Stage Workflow Forecast for Next Month */}
      <StageForecastPanel
        activeInstitution={activeInstitution}
        refreshSignal={cases.reduce((acc, c) => acc + c.stage, cases.length * 10)}
        isDark={isDark}
        themeAccent={themeAccent}
        onFilterByStage={(stage) => {
          setSelectedStage(stage);
          document.getElementById('overview-case-table')?.scrollIntoView({behavior: 'smooth'});
        }}
      />

      {/* Interactive Spatial Hotspot Map of Naysar Neighborhoods */}
      <NaysarInteractiveMap
        blocks={blocks}
        cases={cases}
        selectedBlockId={selectedBlockId}
        onSelectBlock={setSelectedBlockId}
        onInspectCase={(c) => setInspectedCase(c)}
        onOpenWorkflow={(caseId) => setWorkflowCaseId(caseId)}
        activeInstitution={activeInstitution}
        activeRole={activeRole}
        isDark={isDark}
        themeAccent={themeAccent}
      />

      {/* Naysar Block Zoning */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              تقسیم کار جغرافیایی و بلوک‌بندی ناحیه منفصل شهری نایسر
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              جهت جلوگیری از تداخل سرزمینی، هر بلوک به یک مؤسسه مسئول اختصاص یافته است. برای فیلتر
              پرونده‌ها روی هر بلوک کلیک کنید.
            </p>
          </div>
          {selectedBlockId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedBlockId('all')}
              className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 underline underline-offset-4 whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              نمایش همه بلوک‌ها
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {blocks.map((block) => {
            const isSelected = selectedBlockId === block.id;
            return (
              <button
                key={block.id}
                type="button"
                onClick={() =>
                  setSelectedBlockId((prev) => (prev === block.id ? 'all' : block.id))
                }
                className={`text-right p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-teal-700 dark:border-teal-500 bg-teal-50/60 dark:bg-teal-950/40'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{block.zoneLabel}</span>
                    {block.isPilotZone && (
                      <span className="text-teal-700 dark:text-teal-400 font-medium">پایلوت</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {block.name}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    {getInstitutionName(block.leadInstitution)}
                  </span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                    {block.activeCasesCount} پرونده
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 6-Stage Case Management Table */}
      <section
        id="overview-case-table"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                کارتابل ۶ مرحله‌ای مدیریت مورد (تفکیک محرمانگی داده‌ها)
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {activeRole === 'privacy_officer' || activeRole === 'system_admin'
                  ? 'در نقش ناظر امنیتی / مدیر سیستم، جزئیات هویتی هر دو مؤسسه برای حفظ حریم خصوصی مخفی (Masked) است.'
                  : `پرونده‌های ${getInstitutionName(activeInstitution)} با جزئیات کامل نمایش داده می‌شوند؛ پرونده‌های مؤسسه همکار صرفاً در سطح استعلام هش‌شده قابل مشاهده‌اند.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
              <div className="w-full sm:w-72 relative">
                <Search
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="جستجو با نام، کدملی، شماره پرونده یا بلوک..."
                  aria-label="جستجو در جدول پرونده‌ها"
                  className="w-full pr-9 pl-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white dark:focus:bg-slate-900"
                />
              </div>
              <button
                type="button"
                disabled={filteredCases.length === 0}
                onClick={() => {
                  exportCasesRegisterToExcel({
                    cases: filteredCases,
                    blocks,
                    institutionLabel:
                      activeRole === 'privacy_officer' || activeRole === 'system_admin'
                        ? 'ناظر امنیتی (نمای ناشناس)'
                        : getInstitutionName(activeInstitution),
                    preparedBy,
                    generatedAt,
                  });
                  onExportToast?.(
                    'فایل اکسل کارتابل ذخیره شد',
                    `فهرست ${filteredCases.length} پرونده مطابق فیلتر فعلی به همراه جدول بلوک‌های نایسر با فرمت .xlsx دانلود شد.`,
                  );
                }}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                خروجی اکسل کارتابل ({filteredCases.length})
              </button>
            </div>
          </div>

          {/* Interactive 6-Stage Filter Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedStage('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                selectedStage === 'all'
                  ? 'bg-slate-900 dark:bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              همه مراحل ({cases.length})
            </button>
            {([1, 2, 3, 4, 5, 6] as CaseStage[]).map((stageNum) => {
              const count = cases.filter((c) => c.stage === stageNum).length;
              return (
                <button
                  key={stageNum}
                  type="button"
                  onClick={() => setSelectedStage(stageNum)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                    selectedStage === stageNum
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {STAGE_LABELS[stageNum]} ({count})
                </button>
              );
            })}
          </div>

          {/* 3-Month Need Forecast Filter Strip */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 ml-1">
              پیش‌بینی نیاز ۳ ماه آینده:
            </span>
            {(
              [
                {id: 'all', label: 'همه پیش‌بینی‌ها'},
                {id: 'high_risk', label: 'ریسک بالا (≥۷۵٪)'},
                {id: 'medical', label: 'پزشکی و درمان'},
                {id: 'employment', label: 'اشتغال و تسهیلات'},
                {id: 'housing', label: 'مسکن و اجاره'},
                {id: 'livelihood', label: 'سبد معیشتی'},
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedForecastFilter(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedForecastFilter === opt.id
                    ? 'bg-slate-900 dark:bg-teal-700 text-white border border-transparent'
                    : 'bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 whitespace-nowrap">شناسه پرونده</th>
                <th className="py-3 px-4 whitespace-nowrap">وضعیت هویتی و تفکیک داده</th>
                <th className="py-3 px-4 whitespace-nowrap">مؤسسه متولی و بلوک</th>
                <th className="py-3 px-4 whitespace-nowrap">امتیاز / فوریت</th>
                <th className="py-3 px-4 whitespace-nowrap">مرحله فعلی</th>
                <th className="py-3 px-4 whitespace-nowrap">آخرین حمایت</th>
                <th className="py-3 px-4 whitespace-nowrap">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    هیچ پرونده‌ای مطابق فیلتر انتخاب‌شده یافت نشد.
                  </td>
                </tr>
              ) : (
                filteredCases.map((item) => {
                  const tier = getTierMeta(item.urgencyTier);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs font-medium text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                        {item.id}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.isMasked ? (
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <Lock className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <div>
                              <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                محرمانه (ایزوله در مؤسسه همکار)
                              </div>
                              <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                                SHA-256: {item.nationalIdHash.slice(0, 14)}...
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900 dark:text-slate-100">
                                {item.fullName}
                              </span>
                              {item.needForecast3M && (
                                <ForecastRiskIndicator forecast={item.needForecast3M} />
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {item.headStatus} · {item.householdSize} نفر
                              {item.nationalIdMasked && (
                                <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 mr-1.5 tabular-nums">
                                  · کدملی: {item.nationalIdMasked}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {getInstitutionName(item.owningInstitution)}
                          {item.collaborationModel === 'complementary_support' && (
                            <span className="text-teal-700 dark:text-teal-400"> · پوشش ترکیبی</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.blockName}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {item.score.total} / 100
                        </div>
                        <div className={`text-xs font-medium ${tier.textClass}`}>{tier.label}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          {STAGE_LABELS[item.stage]}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                          {item.coverageStatus === 'SUSPENDED_OVERLAP' ? (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              تعلیق جهت ارجاع متقابل
                            </span>
                          ) : item.coverageStatus === 'GRADUATED' ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                              خوداتکا و فارغ‌التحصیل
                            </span>
                          ) : item.daysInStage > 90 ? (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">
                              توقف {item.daysInStage} روز (بیش از ۳ ماه)
                            </span>
                          ) : (
                            `پوشش فعال · ${item.daysInStage} روز در این مرحله`
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-slate-800 dark:text-slate-200">{item.lastSupportType}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          {item.lastSupportDate}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectedCase(item)}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            مشاهده
                          </button>
                          <button
                            type="button"
                            onClick={() => setDossierCase(item)}
                            className="px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950 rounded-md transition-colors"
                          >
                            پرونده جامع
                          </button>
                          {!item.isMasked && (
                            <button
                              type="button"
                              onClick={() => setWorkflowCaseId(item.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors"
                            >
                              مدیریت مورد
                            </button>
                          )}
                          {!item.isMasked && (
                            <button
                              type="button"
                              onClick={() => onEditCase(item.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              بروزرسانی
                            </button>
                          )}
                          {!item.isMasked && item.stage < 6 && (
                            <button
                              type="button"
                              disabled={updatingId === item.id}
                              onClick={() => handleAdvance(item)}
                              className="px-2.5 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/40 hover:bg-teal-50 dark:hover:bg-teal-950 rounded-md transition-colors disabled:opacity-50"
                            >
                              مرحله بعد
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Case Inspection Drawer / Modal */}
      {inspectedCase && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInspectedCase(null);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  پرونده {inspectedCase.id} · ثبت: {inspectedCase.registeredAt} · آخرین بروزرسانی:{' '}
                  {inspectedCase.lastUpdatedAt}
                </div>
                <h3 id="case-modal-title" className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {inspectedCase.isMasked
                    ? 'نمای استعلامی مشترک (داده‌های اختصاصی محرمانه)'
                    : inspectedCase.fullName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCase(null)}
                aria-label="بستن پنجره"
                className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inspectedCase.isMasked ? (
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3 text-sm">
                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                  <Lock className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  تفکیک پایگاه داده (Data Partitioning) فعال است
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  بر اساس پروتکل محرمانگی و رضایت‌نامه آگاهانه مددجو، جزئیات زندگی، نام، شماره تماس،
                  آدرس و گزارش‌های پزشکی این خانوار صرفاً در پایگاه داده اختصاصی{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {getInstitutionName(inspectedCase.owningInstitution)}
                  </strong>{' '}
                  نگهداری می‌شود و برای سایر کاربران قابل رویت نیست.
                </p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">کد هش یک‌طرفه (SHA-256):</span>
                    <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5 break-all">
                      {inspectedCase.nationalIdHash}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">آخرین اقدام ثبت‌شده در رجیستری مشترک:</span>
                    <div className="text-slate-800 dark:text-slate-200 font-medium mt-0.5">
                      {inspectedCase.lastSupportType} ({inspectedCase.lastSupportDate})
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">سرپرست خانوار، کدملی و تماس</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                      {inspectedCase.headStatus} · {inspectedCase.phone}
                      {inspectedCase.nationalIdMasked && (
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 mr-2 tabular-nums">
                          ({inspectedCase.nationalIdMasked})
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">محدوده و آدرس محل سکونت</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                      {inspectedCase.address}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">وضعیت مسکن و تعداد عائله</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                      {inspectedCase.housingType} · {inspectedCase.householdSize} نفر
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">مسیر مداخله و رضایت‌نامه</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                      {inspectedCase.servicePath === 'livelihood_medical'
                        ? 'مسیریابی معیشتی و درمانی'
                        : 'مسیریابی توانمندسازی و اشتغال'}
                      {' · '}
                      {inspectedCase.consentSigned ? 'رضایت‌نامه امضاشده' : 'در انتظار امضا'}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    تفکیک امتیاز نیازمندی‌سنجی (مجموع {inspectedCase.score.total} از ۱۰۰)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="text-slate-500 dark:text-slate-400">ساختار خانوار</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {inspectedCase.score.familyStructure} / 30
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="text-slate-500 dark:text-slate-400">وضعیت مسکن</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {inspectedCase.score.housing} / 25
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="text-slate-500 dark:text-slate-400">معیشت و درآمد</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {inspectedCase.score.livelihood} / 25
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="text-slate-500 dark:text-slate-400">سلامت و درمان</div>
                      <div className="font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {inspectedCase.score.health} / 20
                      </div>
                    </div>
                  </div>
                </div>

                {inspectedCase.needForecast3M && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        پیش‌بینی نیاز حمایتی در ۳ ماه آینده (تحلیل داده‌های ثبت‌شده)
                      </span>
                      <ForecastRiskIndicator forecast={inspectedCase.needForecast3M} />
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      {inspectedCase.needForecast3M.rationale}
                    </p>
                  </div>
                )}

                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2">
                  <div className="text-xs text-slate-500 dark:text-slate-400">گزارش سلامت و یادداشت مددکار</div>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {inspectedCase.medicalNotes}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {inspectedCase.caseWorkerNote}
                  </p>
                </div>

                {inspectedCase.history && inspectedCase.history.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <History className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      تاریخچه ارزیابی‌ها و بروزرسانی‌های پرونده
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-200 dark:divide-slate-700">
                      {inspectedCase.history.map((evt) => (
                        <div
                          key={evt.id}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                        >
                          <span className="text-slate-800 dark:text-slate-200">{evt.summary}</span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                            {evt.timestamp}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const target = inspectedCase;
                  setInspectedCase(null);
                  setDossierCase(target);
                }}
                className="px-4 py-2 text-sm font-medium border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 rounded-lg transition-colors"
              >
                پرونده جامع قابل انتشار / چاپ
              </button>
              {!inspectedCase.isMasked && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const idToOpen = inspectedCase.id;
                      setInspectedCase(null);
                      setWorkflowCaseId(idToOpen);
                    }}
                    className="px-4 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors"
                  >
                    ثبت اجزای ۶ مرحله‌ای مدیریت مورد
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const idToEdit = inspectedCase.id;
                      setInspectedCase(null);
                      onEditCase(idToEdit);
                    }}
                    className="px-4 py-2 text-sm font-medium border border-teal-300 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950 rounded-lg transition-colors"
                  >
                    بروزرسانی ارزیابی و پرونده
                  </button>
                </>
              )}
              {!inspectedCase.isMasked && inspectedCase.stage < 6 && (
                <button
                  type="button"
                  disabled={updatingId === inspectedCase.id}
                  onClick={() => handleAdvance(inspectedCase)}
                  className="px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  ارتقا به مرحله {inspectedCase.stage + 1}
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectedCase(null)}
                className="px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6-Stage Step-by-Step Case Management Workflow Modal */}
      {workflowTargetCase && (
        <CaseManagementWorkflowModal
          caseRecord={workflowTargetCase}
          activeInstitution={activeInstitution}
          activeRole={activeRole}
          onClose={() => {
            setWorkflowCaseId(null);
            onClearInitialWorkflowCase?.();
          }}
          onSaved={async (updatedCase, meta) => {
            await onWorkflowSaved(updatedCase, meta);
          }}
        />
      )}
    </div>

    {/* Publishable & Printable Single-Beneficiary Comprehensive Dossier Modal */}
    {dossierCase && (
      <BeneficiaryDossierModal
        caseRecord={cases.find((c) => c.id === dossierCase.id) || dossierCase}
        preparedBy={preparedBy}
        generatedAt={generatedAt}
        onClose={() => setDossierCase(null)}
        onExportToast={onExportToast}
      />
    )}
    </>
  );
};
