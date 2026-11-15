import React from 'react';
import {History, Clock, User, CheckCircle2, ArrowUpRight, ShieldCheck} from 'lucide-react';
import type {AuditLogEntry, CaseRecordView, UiThemeAccent} from '../types';

interface RecentActivityWidgetProps {
  auditLogs?: AuditLogEntry[];
  cases?: CaseRecordView[];
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
}

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({
  auditLogs = [],
  cases = [],
  isDark: _isDark,
  themeAccent: _themeAccent = 'teal',
  onExportToast: _onExportToast,
}) => {
  // Extract or simulate last 5 important system activities
  const recentActivities = React.useMemo(() => {
    if (auditLogs && auditLogs.length > 0) {
      const actionTitleMap: Record<AuditLogEntry['action'], string> = {
        CASE_CREATED: 'ثبت پرونده حمایتی جدید',
        STAGE_ADVANCED: 'ارتقای مرحله جریان کاری',
        OVERLAP_FLAGGED: 'شناسایی و پیشگیری از هم‌پوشانی',
        CONFLICT_RESOLVED: 'تعیین تکلیف هم‌پوشانی و مدل همکاری',
        SHG_TRANSACTION: 'ثبت تراکنش صندوق خودیاری',
        INQUIRY_HASH: 'استعلام حریم‌خصوصی کدملی',
        CASE_UPDATED: 'به‌روزرسانی اطلاعات پرونده',
      };
      return auditLogs.slice(0, 5).map((log) => ({
        id: log.id,
        title: actionTitleMap[log.action] || 'به‌روزرسانی اطلاعات مورد',
        description: `بلوک ${log.blockName} · نتیجه: ${log.outcome}`,
        timestamp: log.timestamp,
        actor:
          log.actorRole === 'privacy_officer'
            ? 'ناظر امنیتی'
            : log.actorRole === 'system_admin'
              ? 'مدیر سیستم'
              : log.actorRole === 'executive_manager'
                ? 'مدیرعامل مؤسسه'
                : 'مددکار ارشد',
        institution:
          log.actorInstitution === 'darolahsan'
            ? 'دارالاحسان'
            : log.actorInstitution === 'edalat'
              ? 'عدالت'
              : 'مشترک',
      }));
    }

    // Fallback recent items from cases
    return cases.slice(0, 5).map((c, idx) => ({
      id: `act-${c.id}`,
      title: c.stage === 6 ? 'ثبت خروج موفق و خوداتکایی' : `به‌روزرسانی پرونده ${c.id}`,
      description: `سرپرست: ${c.fullName || 'محرمانه'} · ${c.blockName}`,
      timestamp: c.lastUpdatedAt || '۱۴۰۵/۰۸/۲۲ · ۱۱:۳۰',
      actor: idx % 2 === 0 ? 'سهیلا محمدی' : 'کیوان فاتحی',
      institution: c.owningInstitution === 'darolahsan' ? 'دارالاحسان' : 'عدالت',
    }));
  }, [auditLogs, cases]);

  return (
    <section
      aria-label="گزارش تغییرات و فعالیت‌های اخیر سامانه"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tabular-nums">
              ثبت رویدادهای زنده
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ۵ فعالیت اخیر ثبت‌شده در سامانه نایسر
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
            گزارش تغییرات و فعالیت‌های اخیر (Recent Activity Log)
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            نمایش آخرین اقدامات مهم مددکاران و مدیران (مانند ثبت پرونده جدید، ارتقای مرحله یا تغییر وضعیت خروج).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
          <History className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
          <span>پایش لحظه‌ای فعالیت‌ها</span>
        </div>
      </div>

      <div className="space-y-3">
        {recentActivities.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
            هنوز فعالیتی ثبت نشده است.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/40 dark:bg-slate-800/30">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {act.title}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        ({act.institution})
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {act.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{act.actor}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{act.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
