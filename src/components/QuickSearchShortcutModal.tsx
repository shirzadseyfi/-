import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  BarChart3,
  ClipboardList,
  Command,
  LayoutDashboard,
  Lock,
  Search,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import type {CaseRecordView, CaseStage, InstitutionId, UserRole} from '../types';

export type ShortcutSectionId =
  | 'overview'
  | 'inquiry'
  | 'assessment'
  | 'microfinance'
  | 'reports'
  | 'security';

interface QuickSearchShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseRecordView[];
  activeInstitution: InstitutionId;
  activeRole: UserRole;
  onSelectCaseInspect: (caseId: string) => void;
  onSelectCaseWorkflow: (caseId: string) => void;
  onNavigateSection: (section: ShortcutSectionId) => void;
  onStartNewCase: () => void;
}

const STAGE_LABELS: Record<CaseStage, string> = {
  1: '۱. پذیرش و ارجاع',
  2: '۲. ارزیابی همه‌جانبه',
  3: '۳. برنامه مداخله',
  4: '۴. اجرا و خدمات',
  5: '۵. پایش مستمر',
  6: '۶. خروج موفق',
};

const QUICK_ACTIONS: Array<{
  id: string;
  label: string;
  hint: string;
  shortcut: string;
  section?: ShortcutSectionId;
  isNewCase?: boolean;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {
    id: 'nav-overview',
    label: 'پیشخوان مدیریت مورد',
    hint: 'مشاهده کارتابل و شاخص‌های کلان',
    shortcut: 'Alt + 1',
    section: 'overview',
    icon: LayoutDashboard,
  },
  {
    id: 'nav-inquiry',
    label: 'استعلام فوری کدملی (SHA-256)',
    hint: 'بررسی هم‌پوشانی پیش از پذیرش ارباب‌رجوع',
    shortcut: 'Alt + 2',
    section: 'inquiry',
    icon: Search,
  },
  {
    id: 'nav-new-case',
    label: 'ثبت ارزیابی و پرونده جدید',
    hint: 'فرم امتیازدهی ۱۰۰ امتیازی و رضایت‌نامه',
    shortcut: 'Alt + 3',
    section: 'assessment',
    isNewCase: true,
    icon: ClipboardList,
  },
  {
    id: 'nav-microfinance',
    label: 'صندوق‌های خرد همت (SHG)',
    hint: 'تسهیلات اشتغال و اقساط خانوارها',
    shortcut: 'Alt + 4',
    section: 'microfinance',
    icon: Wallet,
  },
  {
    id: 'nav-reports',
    label: 'گزارش‌های تحلیلی و هیئت مدیره',
    hint: 'نمودارها و خروجی اکسل/PDF',
    shortcut: 'Alt + 5',
    section: 'reports',
    icon: BarChart3,
  },
  {
    id: 'nav-security',
    label: 'امنیت، ممیزی و نقشه راه',
    hint: 'گزارش لاگ‌های تغییرناپذیر استعلام',
    shortcut: 'Alt + 6',
    section: 'security',
    icon: ShieldCheck,
  },
];

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

export const QuickSearchShortcutModal: React.FC<
  QuickSearchShortcutModalProps
> = ({
  isOpen,
  onClose,
  cases,
  activeInstitution,
  activeRole,
  onSelectCaseInspect,
  onSelectCaseWorkflow,
  onNavigateSection,
  onStartNewCase,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [serverMatchedIds, setServerMatchedIds] = useState<Set<string> | null>(
    null,
  );
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setServerMatchedIds(null);
      setActiveIndex(0);
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
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
      } catch {
        if (!controller.signal.aborted) {
          setServerMatchedIds(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearchingServer(false);
        }
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query, activeInstitution, activeRole]);

  const matchedCases = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return cases.slice(0, 6);
    }
    const q = normalizeSearchText(trimmed);
    const qDigits = normalizeDigitsOnly(trimmed);

    return cases
      .filter((item) => {
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
      })
      .slice(0, 8);
  }, [cases, query, serverMatchedIds]);

  const filteredActions = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return QUICK_ACTIONS;
    const q = normalizeSearchText(trimmed);
    return QUICK_ACTIONS.filter(
      (a) =>
        normalizeSearchText(a.label).includes(q) ||
        normalizeSearchText(a.hint).includes(q),
    );
  }, [query]);

  type PaletteEntry =
    | {kind: 'case'; item: CaseRecordView}
    | {kind: 'action'; action: (typeof QUICK_ACTIONS)[number]};

  const entries = useMemo<PaletteEntry[]>(() => {
    const list: PaletteEntry[] = matchedCases.map((item) => ({
      kind: 'case',
      item,
    }));
    for (const action of filteredActions) {
      list.push({kind: 'action', action});
    }
    return list;
  }, [matchedCases, filteredActions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, entries.length]);

  const executeEntry = (entry: PaletteEntry) => {
    if (entry.kind === 'case') {
      if (!entry.item.isMasked) {
        onSelectCaseWorkflow(entry.item.id);
      } else {
        onSelectCaseInspect(entry.item.id);
      }
      onClose();
      return;
    }

    if (entry.action.isNewCase) {
      onStartNewCase();
    } else if (entry.action.section) {
      onNavigateSection(entry.action.section);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (entries.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % entries.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + entries.length) % entries.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = entries[activeIndex];
      if (target) executeEntry(target);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-slate-950/75 backdrop-blur-xs flex items-start justify-center pt-[10vh] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="جستجوی سریع پرونده‌ها و میانبرهای سامانه"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[78vh]">
        {/* Search Input Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی سریع با نام سرپرست، ارقام کدملی، شماره پرونده (NY-...) یا نام بخش..."
            aria-label="عبارت جستجوی سریع"
            className="flex-1 bg-transparent text-sm sm:text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
          />
          {isSearchingServer && (
            <span className="text-[11px] text-teal-700 dark:text-teal-400 whitespace-nowrap">
              در حال جستجو...
            </span>
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="پاک‌کردن جستجو"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Esc
          </button>
        </div>

        {/* Results & Shortcuts Body */}
        <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {/* Matched Cases */}
          <div className="p-2.5 space-y-1">
            <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>
                {query.trim()
                  ? `نتایج پرونده‌ها (${matchedCases.length})`
                  : 'دسترسی سریع به پرونده‌های اخیر'}
              </span>
              <span className="text-[11px] font-normal">
                انتخاب با Enter
              </span>
            </div>

            {matchedCases.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                پرونده‌ای با عبارت «{query.trim()}» یافت نشد. برای استعلام کدملی کامل از گزینه استعلام (Alt+2) استفاده کنید.
              </div>
            ) : (
              matchedCases.map((item, idx) => {
                const isSelected = activeIndex === idx;
                const tierDotColor =
                  item.urgencyTier === 'red'
                    ? 'text-red-700 dark:text-red-400'
                    : item.urgencyTier === 'yellow'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400';

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                    }`}
                    onClick={() => executeEntry({kind: 'case', item})}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                          {item.id}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        {item.isMasked ? (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-400">
                            <Lock className="w-3.5 h-3.5" />
                            پرونده محرمانه مؤسسه همکار
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {item.fullName}
                          </span>
                        )}
                        {!item.isMasked && item.nationalIdMasked && (
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            ({item.nationalIdMasked})
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{item.blockName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{STAGE_LABELS[item.stage]}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${tierDotColor}`}>
                          امتیاز {item.score.total}/100
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCaseInspect(item.id);
                          onClose();
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
                      >
                        مشاهده جزئیات
                      </button>
                      {!item.isMasked && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCaseWorkflow(item.id);
                            onClose();
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <span>مدیریت مورد</span>
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Section Navigation & Shortcuts */}
          {filteredActions.length > 0 && (
            <div className="p-2.5 space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                ناوبری سریع بخش‌های سامانه
              </div>
              {filteredActions.map((action, aIdx) => {
                const overallIdx = matchedCases.length + aIdx;
                const isSelected = activeIndex === overallIdx;
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(overallIdx)}
                    onClick={() => executeEntry({kind: 'action', action})}
                    className={`w-full text-right rounded-xl px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {action.label}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {action.hint}
                        </div>
                      </div>
                    </div>

                    <kbd
                      dir="ltr"
                      className="px-2 py-0.5 text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md shrink-0"
                    >
                      {action.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Shortcut Legend */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Command className="w-3.5 h-3.5" />
              <kbd dir="ltr" className="font-mono px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
                Ctrl+K
              </kbd>
              <span>بازکردن جستجو</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <kbd dir="ltr" className="font-mono px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
                ↑ ↓
              </kbd>{' '}
              انتخاب
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <kbd dir="ltr" className="font-mono px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
                Enter
              </kbd>{' '}
              بازکردن پرونده
            </span>
          </div>
          <span>کلیدهای Alt+1 تا Alt+6 جهت جابجایی فوری</span>
        </div>
      </div>
    </div>
  );
};
