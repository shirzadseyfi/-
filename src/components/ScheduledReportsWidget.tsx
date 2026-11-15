import React, {useState, useEffect} from 'react';
import {Calendar, Clock, Plus, CheckCircle2, Trash2, FileText, Send} from 'lucide-react';
import type {UiThemeAccent} from '../types';

interface ScheduledReportItem {
  id: string;
  title: string;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'weekly';
  format: 'pdf' | 'excel' | 'summary';
  targetRecipient: string;
  nextRunDate: string;
  status: 'active' | 'paused';
}

interface ScheduledReportsWidgetProps {
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
}

export const ScheduledReportsWidget: React.FC<ScheduledReportsWidgetProps> = ({
  isDark: _isDark,
  themeAccent: _themeAccent = 'teal',
  onExportToast,
}) => {
  const [schedules, setSchedules] = useState<ScheduledReportItem[]>(() => {
    try {
      const saved = localStorage.getItem('naysar_scheduled_reports');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'sch-1',
        title: 'گزارش ماهانه عملکرد واحد حمایتی (PDF)',
        frequency: 'monthly',
        format: 'pdf',
        targetRecipient: 'هیئت مدیره و مدیرعامل',
        nextRunDate: '۱۴۰۵/۰۹/۰۱',
        status: 'active',
      },
      {
        id: 'sch-2',
        title: 'گزارش فصلی تحلیل مراحل و خوداتکایی',
        frequency: 'quarterly',
        format: 'pdf',
        targetRecipient: 'مؤسسه دارالاحسان و عدالت',
        nextRunDate: '۱۴۰۵/۱۰/۰۱',
        status: 'active',
      },
    ];
  });

  const [newTitle, setNewTitle] = useState('');
  const [newFreq, setNewFreq] = useState<ScheduledReportItem['frequency']>('monthly');
  const [newFormat, setNewFormat] = useState<ScheduledReportItem['format']>('pdf');
  const [newRecipient, setNewRecipient] = useState('هیئت مدیره نایسر');

  useEffect(() => {
    try {
      localStorage.setItem('naysar_scheduled_reports', JSON.stringify(schedules));
    } catch {}
  }, [schedules]);

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: ScheduledReportItem = {
      id: `sch-${Date.now()}`,
      title: newTitle.trim(),
      frequency: newFreq,
      format: newFormat,
      targetRecipient: newRecipient.trim() || 'هیئت مدیره',
      nextRunDate: '۱۴۰۵/۰۹/۱۵',
      status: 'active',
    };

    setSchedules((prev) => [newItem, ...prev]);
    setNewTitle('');
    onExportToast?.('گزارش زمان‌بندی شد', `گزارش «${newItem.title}» با موفقیت در تقویم کاری ثبت شد.`);
  };

  const handleDelete = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    onExportToast?.('حذف زمان‌بندی', 'گزارش زمان‌بندی‌شده از تقویم حذف گردید.');
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tabular-nums">
              تقویم خودکار خروجی‌ها
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              برنامه‌ریزی خودکار PDF عملکرد ماهانه، فصلی و سالیانه
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            گزارش‌های زمان‌بندی‌شده و خودکار (Scheduled Performance Reports)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            تعیین زمان‌بندی و ارسال خودکار گزارش‌های عملکرد واحد حمایتی به تقویم کاری مددکاران و هیئت مدیره.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 rounded-xl px-3.5 py-2 text-xs font-semibold text-teal-800 dark:text-teal-300 shrink-0">
          <Calendar className="w-4 h-4 shrink-0" />
          <span>تعداد برنامه‌های فعال: {schedules.filter((s) => s.status === 'active').length} مورد</span>
        </div>
      </div>

      {/* Add New Schedule Form */}
      <form onSubmit={handleAddSchedule} className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            عنوان گزارش زمان‌بندی‌شده
          </label>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="مثلاً: گزارش ماهانه پایداری درآمد خانوارها"
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            دوره تناوب
          </label>
          <select
            value={newFreq}
            onChange={(e) => setNewFreq(e.target.value as ScheduledReportItem['frequency'])}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          >
            <option value="weekly">هفتگی</option>
            <option value="monthly">ماهانه</option>
            <option value="quarterly">فصلی</option>
            <option value="yearly">سالیانه</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن به تقویم</span>
          </button>
        </div>
      </form>

      {/* Schedules List */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
          فهرست گزارش‌های زمان‌بندی‌شده فعال
        </h3>

        {schedules.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
            هیچ گزارش زمان‌بندی‌شده‌ای ثبت نشده است.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {schedules.map((sch) => (
              <div
                key={sch.id}
                className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {sch.title}
                    </span>
                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                      {sch.frequency === 'monthly' ? 'ماهانه' : sch.frequency === 'quarterly' ? 'فصلی' : sch.frequency === 'yearly' ? 'سالیانه' : 'هفتگی'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 tabular-nums">
                    <span>مخابره به: {sch.targetRecipient}</span>
                    <span>·</span>
                    <span>سررسید بعدی: {sch.nextRunDate}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/80 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>فعال در تقویم کاری</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onExportToast?.('تولید گزارش', `گزارش «${sch.title}» به صورت پیش‌نمایش اجرا شد.`)}
                      className="px-2.5 py-1 text-xs font-medium text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 rounded border border-teal-200 dark:border-teal-800 transition-colors inline-flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>اجرای فوری</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(sch.id)}
                      className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors"
                      title="حذف زمان‌بندی"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>
            گزارش‌های زمان‌بندی‌شده به طور خودکار در موعد مقرر خروجی PDF تولید کرده و در کارتابل تقویم مددکار قرار می‌گیرند.
          </span>
        </div>
      </div>
    </div>
  );
};
