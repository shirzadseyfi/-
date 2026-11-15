import React, {useMemo, useState} from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  ClipboardList,
  Activity,
} from 'lucide-react';
import {toEnglishDigits, toPersianDigits} from '../utils/persianDateTime';
import type {CaseRecordView} from '../types';

interface Stage5FollowUpCalendarProps {
  cases: CaseRecordView[];
  onInspectCase: (item: CaseRecordView) => void;
  onOpenWorkflow: (caseId: string) => void;
}

interface JalaliDateParts {
  year: number;
  month: number;
  day: number;
}

interface FollowUpCalendarItem {
  caseRecord: CaseRecordView;
  eventType: 'monitoring' | 'intervention_review';
  dueDateKey: string; // YYYY/MM/DD (English digits)
  dueDatePersian: string; // ۱۴۰۵/۰۸/۲۶
  dueParts: JalaliDateParts;
  diffDays: number;
  status: 'overdue' | 'today' | 'soon' | 'upcoming';
  stabilityMonths: number;
  visitsCount: number;
}

const PERSIAN_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

const WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const WEEKDAY_MAP: Record<string, number> = {
  Sat: 0,
  Sun: 1,
  Mon: 2,
  Tue: 3,
  Wed: 4,
  Thu: 5,
  Fri: 6,
};

const jalaliFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

const tehranWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Tehran',
  weekday: 'short',
});

function getJalaliParts(dateObj: Date): JalaliDateParts {
  const parts = jalaliFormatter.formatToParts(dateObj);
  const year = Number(parts.find((p) => p.type === 'year')?.value || 1405);
  const month = Number(parts.find((p) => p.type === 'month')?.value || 1);
  const day = Number(parts.find((p) => p.type === 'day')?.value || 1);
  return {year, month, day};
}

function makeDateKey(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
}

function parseJalaliDateString(raw?: string): JalaliDateParts | null {
  if (!raw) return null;
  const eng = toEnglishDigits(raw).trim();
  const match = eng.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return {year, month, day};
}

function findDateForJalali(targetYear: number, targetMonth: number, targetDay: number): Date {
  const now = new Date();
  const todayJ = getJalaliParts(now);
  const approxDays =
    (targetYear - todayJ.year) * 365 +
    (targetMonth - todayJ.month) * 30 +
    (targetDay - todayJ.day);
  let candidate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0) +
      approxDays * 86400000,
  );

  for (let i = 0; i < 12; i++) {
    const cur = getJalaliParts(candidate);
    if (cur.year === targetYear && cur.month === targetMonth && cur.day === targetDay) {
      return candidate;
    }
    const diff =
      (targetYear - cur.year) * 365 +
      (targetMonth - cur.month) * 30 +
      (targetDay - cur.day);
    const step = diff === 0 ? 0 : diff;
    candidate = new Date(candidate.getTime() + step * 86400000);
    const check = getJalaliParts(candidate);
    if (check.year === targetYear && check.month === targetMonth && check.day === targetDay) {
      return candidate;
    }
    if (check.year === targetYear && check.month === targetMonth) {
      candidate = new Date(candidate.getTime() + (targetDay - check.day) * 86400000);
    }
  }
  return candidate;
}

function getJalaliMonthMeta(year: number, month: number): {
  daysInMonth: number;
  startWeekday: number;
} {
  const firstDayDate = findDateForJalali(year, month, 1);
  const shortWd = tehranWeekdayFormatter.format(firstDayDate);
  const startWeekday = WEEKDAY_MAP[shortWd] ?? 0;

  const day30 = getJalaliParts(new Date(firstDayDate.getTime() + 29 * 86400000));
  const day31 = getJalaliParts(new Date(firstDayDate.getTime() + 30 * 86400000));
  let daysInMonth = 29;
  if (day31.year === year && day31.month === month) {
    daysInMonth = 31;
  } else if (day30.year === year && day30.month === month) {
    daysInMonth = 30;
  }
  return {daysInMonth, startWeekday};
}

export const Stage5FollowUpCalendar: React.FC<Stage5FollowUpCalendarProps> = ({
  cases,
  onInspectCase,
  onOpenWorkflow,
}) => {
  const todayParts = useMemo(() => getJalaliParts(new Date()), []);
  const todayKey = makeDateKey(todayParts.year, todayParts.month, todayParts.day);
  const todayDateObj = useMemo(
    () => findDateForJalali(todayParts.year, todayParts.month, todayParts.day),
    [todayParts],
  );

  const [viewYear, setViewYear] = useState<number>(todayParts.year);
  const [viewMonth, setViewMonth] = useState<number>(todayParts.month);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [taskViewMode, setTaskViewMode] = useState<'all_upcoming' | 'selected_day'>('all_upcoming');
  const [filterType, setFilterType] = useState<'all' | 'monitoring' | 'intervention'>('all');

  const {dueItems, maskedCount} = useMemo(() => {
    const items: FollowUpCalendarItem[] = [];
    let masked = 0;

    for (const c of cases) {
      if (c.isMasked || !c.workflow) {
        masked += 1;
        continue;
      }

      // Collect Stage 5 monitoring follow-up date and Stage 3 intervention review date
      const followUpDateStr = c.workflow.stage5Monitoring?.nextFollowUpDate;
      const reviewDateStr = c.workflow.stage3Plan?.targetReviewDate;

      const datesToProcess: Array<{raw: string | undefined; type: 'monitoring' | 'intervention_review'}> = [];
      if (followUpDateStr) datesToProcess.push({raw: followUpDateStr, type: 'monitoring'});
      if (reviewDateStr) datesToProcess.push({raw: reviewDateStr, type: 'intervention_review'});

      for (const entry of datesToProcess) {
        const parsed = parseJalaliDateString(entry.raw);
        if (!parsed) continue;

        const dueDateKey = makeDateKey(parsed.year, parsed.month, parsed.day);
        const dueDateObj = findDateForJalali(parsed.year, parsed.month, parsed.day);
        const diffDays = Math.round((dueDateObj.getTime() - todayDateObj.getTime()) / 86400000);

        let status: FollowUpCalendarItem['status'] = 'upcoming';
        if (diffDays < 0) status = 'overdue';
        else if (diffDays === 0) status = 'today';
        else if (diffDays <= 3) status = 'soon';

        items.push({
          caseRecord: c,
          eventType: entry.type,
          dueDateKey,
          dueDatePersian: toPersianDigits(dueDateKey),
          dueParts: parsed,
          diffDays,
          status,
          stabilityMonths: c.workflow.stage5Monitoring?.stabilityMonthsCount ?? 0,
          visitsCount: c.workflow.stage5Monitoring?.visits?.length ?? 0,
        });
      }
    }

    items.sort((a, b) => a.diffDays - b.diffDays);
    return {dueItems: items, maskedCount: masked};
  }, [cases, todayDateObj]);

  const filteredDueItems = useMemo(() => {
    if (filterType === 'monitoring') return dueItems.filter((i) => i.eventType === 'monitoring');
    if (filterType === 'intervention') return dueItems.filter((i) => i.eventType === 'intervention_review');
    return dueItems;
  }, [dueItems, filterType]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, FollowUpCalendarItem[]>();
    for (const item of filteredDueItems) {
      const list = map.get(item.dueDateKey) || [];
      list.push(item);
      map.set(item.dueDateKey, list);
    }
    return map;
  }, [filteredDueItems]);

  const monthMeta = useMemo(
    () => getJalaliMonthMeta(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const calendarCells = useMemo(() => {
    const cells: Array<{day: number | null; dateKey: string | null}> = [];
    for (let i = 0; i < monthMeta.startWeekday; i++) {
      cells.push({day: null, dateKey: null});
    }
    for (let d = 1; d <= monthMeta.daysInMonth; d++) {
      cells.push({
        day: d,
        dateKey: makeDateKey(viewYear, viewMonth, d),
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({day: null, dateKey: null});
    }
    return cells;
  }, [monthMeta, viewYear, viewMonth]);

  const overdueCount = filteredDueItems.filter((i) => i.status === 'overdue').length;
  const nearTermCount = filteredDueItems.filter((i) => i.diffDays >= 0 && i.diffDays <= 7).length;

  const displayedTasks = useMemo(() => {
    if (taskViewMode === 'selected_day' && selectedDateKey) {
      return itemsByDate.get(selectedDateKey) || [];
    }
    return filteredDueItems;
  }, [taskViewMode, selectedDateKey, itemsByDate, filteredDueItems]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    setViewYear(todayParts.year);
    setViewMonth(todayParts.month);
    setSelectedDateKey(todayKey);
    setTaskViewMode('selected_day');
  };

  const handleSelectDay = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setTaskViewMode('selected_day');
  };

  const formatRelativeDiff = (diff: number) => {
    if (diff < 0) return `${toPersianDigits(Math.abs(diff))} روز تاخیر`;
    if (diff === 0) return 'امروز';
    if (diff === 1) return 'فردا';
    return `${toPersianDigits(diff)} روز مانده`;
  };

  return (
    <section
      aria-label="تقویم تعاملی سررسید پایش و برنامه‌های مداخله"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-xs"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              تقویم تعاملی سررسید پایش پرونده‌ها و برنامه‌های مداخله
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            نمایش تاریخ‌های پایش دوره‌ای (مرحله ۵) و بازبینی برنامه‌های مداخله (مرحله ۳) بر اساس فیلد تاریخ پایش و بازبینی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Filter Type Segment */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/70 text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              همه ({toPersianDigits(dueItems.length)})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('monitoring')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterType === 'monitoring'
                  ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              پایش مستمر
            </button>
            <button
              type="button"
              onClick={() => setFilterType('intervention')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                filterType === 'intervention'
                  ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              برنامه مداخله
            </button>
          </div>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {overdueCount > 0 && (
            <span className="font-bold text-red-700 dark:text-red-400 inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              {toPersianDigits(overdueCount)} موعد عقب‌افتاده
            </span>
          )}
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            {toPersianDigits(nearTermCount)} سررسید تا ۷ روز آینده
          </span>
        </div>
        <span className="font-semibold text-slate-700 dark:text-slate-300">
          کل رویدادهای تقویم: {toPersianDigits(filteredDueItems.length)} مورد
        </span>
      </div>

      {/* Main Split: Interactive Calendar + Task List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Mini Persian Calendar */}
        <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-slate-800/30 space-y-3">
          {/* Month Navigation */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="ماه قبل"
                title="ماه قبل"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="ماه بعد"
                title="ماه بعد"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {PERSIAN_MONTH_NAMES[viewMonth - 1]} {toPersianDigits(viewYear)}
            </div>

            <button
              type="button"
              onClick={handleJumpToday}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-950 transition-colors"
            >
              امروز
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
            {WEEKDAY_SHORT.map((wd) => (
              <div key={wd} className="py-1">
                {wd}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.day || !cell.dateKey) {
                return <div key={`empty-${idx}`} className="h-10" />;
              }

              const dayItems = itemsByDate.get(cell.dateKey) || [];
              const hasDue = dayItems.length > 0;
              const hasOverdue = dayItems.some((i) => i.status === 'overdue');
              const hasSoon = dayItems.some((i) => i.status === 'today' || i.status === 'soon');
              const isToday = cell.dateKey === todayKey;
              const isSelected = selectedDateKey === cell.dateKey && taskViewMode === 'selected_day';

              const dotColorClass = hasOverdue
                ? 'bg-red-600 dark:bg-red-400'
                : hasSoon
                  ? 'bg-amber-500 dark:bg-amber-400'
                  : 'bg-teal-600 dark:bg-teal-400';

              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => handleSelectDay(cell.dateKey!)}
                  aria-label={`روز ${toPersianDigits(cell.day)} ${PERSIAN_MONTH_NAMES[viewMonth - 1]}${
                    hasDue ? ` · ${toPersianDigits(dayItems.length)} رویداد` : ''
                  }`}
                  className={`h-10 rounded-lg text-xs font-medium tabular-nums relative flex flex-col items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-teal-700 text-white font-bold shadow-xs'
                      : isToday
                        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 ring-1 ring-teal-600 dark:ring-teal-500 font-bold'
                        : hasDue
                          ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{toPersianDigits(cell.day)}</span>
                  {hasDue && (
                    <span className="flex items-center gap-0.5 mt-0.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : dotColorClass
                        }`}
                      />
                      {dayItems.length > 1 && (
                        <span
                          className={`text-[9px] leading-none font-bold ${
                            isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {toPersianDigits(dayItems.length)}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Compact Legend */}
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 dark:bg-red-400" />
              عقب‌افتاده
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
              امروز / تا ۳ روز
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400" />
              آتی
            </span>
          </div>
        </div>

        {/* Daily Schedule Queue List */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setTaskViewMode('all_upcoming')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  taskViewMode === 'all_upcoming'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                همه سررسیدها ({toPersianDigits(filteredDueItems.length)})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!selectedDateKey) setSelectedDateKey(todayKey);
                  setTaskViewMode('selected_day');
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  taskViewMode === 'selected_day'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                روز انتخاب‌شده
                {selectedDateKey && taskViewMode === 'selected_day'
                  ? ` (${toPersianDigits(selectedDateKey)})`
                  : ''}
              </button>
            </div>

            {maskedCount > 0 && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {toPersianDigits(maskedCount)} پرونده در مؤسسه همکار (محرمانه)
              </span>
            )}
          </div>

          {displayedTasks.length === 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-2 bg-slate-50/40 dark:bg-slate-800/20">
              <CalendarDays className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {taskViewMode === 'selected_day' && selectedDateKey
                  ? `در تاریخ ${toPersianDigits(selectedDateKey)} رویداد پایش یا مداخله‌ای ثبت نشده است.`
                  : 'در حال حاضر رویداد سررسید فعالی برای این فیلتر وجود ندارد.'}
              </div>
              {taskViewMode === 'selected_day' && filteredDueItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTaskViewMode('all_upcoming')}
                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline underline-offset-4"
                >
                  مشاهده همه سررسیدها
                </button>
              )}
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
              {displayedTasks.map((item) => {
                const {caseRecord, eventType} = item;
                const statusTone =
                  item.status === 'overdue'
                    ? 'text-red-700 dark:text-red-400'
                    : item.status === 'today' || item.status === 'soon'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-teal-700 dark:text-teal-400';

                return (
                  <div
                    key={`${caseRecord.id}-${eventType}`}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 ${
                            eventType === 'monitoring'
                              ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                          }`}
                        >
                          {eventType === 'monitoring' ? (
                            <>
                              <Activity className="w-3 h-3" />
                              پایش مستمر (مرحله ۵)
                            </>
                          ) : (
                            <>
                              <ClipboardList className="w-3 h-3" />
                              برنامه مداخله (مرحله ۳)
                            </>
                          )}
                        </span>
                        <span className="font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {caseRecord.id}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className={`font-semibold tabular-nums inline-flex items-center gap-1 ${statusTone}`}>
                          <Clock className="w-3.5 h-3.5" />
                          سررسید {item.dueDatePersian} ({formatRelativeDiff(item.diffDays)})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-600 dark:text-slate-300 font-bold">
                        <button
                          type="button"
                          onClick={() => {
                            setViewYear(item.dueParts.year);
                            setViewMonth(item.dueParts.month);
                            setSelectedDateKey(item.dueDateKey);
                          }}
                          className="hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                        >
                          {caseRecord.fullName}
                        </button>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600 font-normal">
                          ·
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 font-normal">
                          {caseRecord.blockName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onInspectCase(caseRecord)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        پرونده
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenWorkflow(caseRecord.id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <span>مدیریت مورد</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
