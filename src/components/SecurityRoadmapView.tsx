import React, {useState} from 'react';
import {Lock} from 'lucide-react';
import type {AuditLogEntry, InstitutionId, UserRole} from '../types';

interface SecurityRoadmapViewProps {
  auditLogs: AuditLogEntry[];
  onRefreshLogs: () => Promise<void>;
}

const ROLE_LABELS: Record<UserRole, string> = {
  case_worker: 'مددکار مجری پرونده',
  executive_manager: 'مدیر اجرایی',
  privacy_officer: 'ناظر امنیتی',
  system_admin: 'مدیر سیستم',
};

function getActorInstitutionLabel(institution: InstitutionId | 'joint'): string {
  if (institution === 'darolahsan') return 'دارالاحسان';
  if (institution === 'edalat') return 'عدالت و برابری';
  return 'مشترک دو مؤسسه';
}

const RBAC_ROLES = [
  {
    role: 'مدیر کل سیستم (System Admin)',
    users: 'مدیران فناوری هر دو مؤسسه (با نظارت مشترک)',
    access: 'مدیریت کاربران، پشتیبانی فنی، مانیتورینگ لاگ‌های امنیتی (بدون دسترسی به جزئیات پرونده مددجویان)',
  },
  {
    role: 'مدیر اجرایی / مسئول مددکاری',
    users: 'مدیران و مددکاران ارشد هر مؤسسه',
    access: 'مشاهده پرونده‌های کامل مؤسسه خود و انجام استعلام‌های اشتراکی جهت بررسی هم‌پوشانی',
  },
  {
    role: 'مددکار مجری پرونده',
    users: 'مددکاران میدانی',
    access: 'ایجاد، ویرایش و مشاهده صرفاً پرونده‌های ارجاع‌شده به خود سازمان متبوع',
  },
  {
    role: 'ناظر امنیتی (Privacy Officer)',
    users: 'نماینده حقوقی یا ناظر بی‌طرف',
    access: 'بررسی گزارش‌های دسترسی، رصد رعایت حریم خصوصی و رسیدگی به اعتراضات احتمالی',
  },
];

const PILOT_PHASES = [
  {
    phase: 'فاز اول: پایه‌گذاری، تفاهم‌نامه و بلوک‌بندی',
    window: 'ماه اول',
    tasks: [
      'برگزاری نشست مشترک مدیران عامل و امضای تفاهم‌نامه رسمی (MoU)',
      'تشکیل کارگروه راهبردی و معرفی رابطان فنی/مددکاری',
      'تقسیم‌بندی جغرافیایی محلات و بلوک‌های نایسر جهت جلوگیری از تداخل سرزمینی',
    ],
    deliverable: 'تفاهم‌نامه امضاشده و نقشه بلوک‌بندی نایسر',
  },
  {
    phase: 'فاز دوم: طراحی پروتکل‌ها و زیرساخت امن',
    window: 'ماه دوم',
    tasks: [
      'نهایی‌سازی فرم ارزیابی معیشتی ۱۰۰ امتیازی و فرم رضایت‌نامه آگاهانه',
      'تفکیک پایگاه داده (Dedicated Data در برابر Shared Match Registry)',
      'پیاده‌سازی تابع هش SHA-256 + Secret Salt، سطوح دسترسی RBAC و لاگ ممیزی',
    ],
    deliverable: 'وب‌سرویس استعلام امن و پکیج فرم‌های استاندارد',
  },
  {
    phase: 'فاز سوم: کارگاه توجیهی ۲ روزه مددکاران',
    window: 'ماه سوم · نیمه اول',
    tasks: [
      'روز اول: مدل ۶ مرحله‌ای مدیریت مورد، خطوط قرمز محرمانگی و اخذ رضایت‌نامه',
      'روز دوم: کارگاه عملی کار با سامانه استعلام، صندوق‌های خرد و شبیه‌سازی حل اختلاف',
      'توزیع راهنمای جیبی (Cheat Sheet) و دفترچه دخل و خرج ساده خانگی',
    ],
    deliverable: 'آمادگی کامل تیم مددکاری دو مؤسسه',
  },
  {
    phase: 'فاز چهارم: اجرای آزمایشی (پایلوت) محدوده‌محور',
    window: 'ماه سوم (نیمه دوم) تا پایان ماه چهارم',
    tasks: [
      'اجرای انحصاری در فاز یک و دو نایسر با استعلام اجباری مراجعان جدید',
      'ثبت سناریوهای هم‌پوشانی و آزمایش عملی پروتکل تعیین مؤسسه مسئول',
      'جلسات ارزیابی دوهفته‌ای جهت رفع باگ‌ها و سنجش کرامت و رضایت مددجو',
    ],
    deliverable: 'گزارش عملکرد پایلوت و شاخص‌های Go / No-Go',
  },
  {
    phase: 'فاز پنجم: تسری سراسری و صندوق‌های خودیاری خرد',
    window: 'ماه پنجم به بعد',
    tasks: [
      'گسترش سامانه به کل ناحیه منفصل شهری نایسر',
      'تشکیل گروه‌های خودیاری ۵ تا ۱۰ نفره بانوان با سرمایه اهرمی ۱:۱ و ۲:۱',
      'پایش ۶ ماهه خروج موفق و برگزاری آیین تکریم خوداتکایی',
    ],
    deliverable: 'استقرار یکپارچه و توانمندسازی پایدار در نایسر',
  },
];

const ACTION_LABELS: Record<AuditLogEntry['action'], string> = {
  INQUIRY_HASH: 'استعلام هش کدملی',
  CASE_CREATED: 'تشکیل پرونده جدید',
  CASE_UPDATED: 'بروزرسانی ارزیابی',
  OVERLAP_FLAGGED: 'هشدار هم‌پوشانی',
  STAGE_ADVANCED: 'ارتقای مرحله',
  CONFLICT_RESOLVED: 'توافق مدل همکاری',
  SHG_TRANSACTION: 'تراکنش صندوق خرد',
};

export const SecurityRoadmapView: React.FC<SecurityRoadmapViewProps> = ({
  auditLogs,
  onRefreshLogs,
}) => {
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefreshLogs();
    } finally {
      setRefreshing(false);
    }
  };

  const activePhase = PILOT_PHASES[selectedPhaseIndex];

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          امنیت داده‌ها، لاگ ممیزی و نقشه راه استقرار پایلوت نایسر
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          معماری دولایه تفکیک پایگاه داده، ماتریس کنترل دسترسی مبتنی بر نقش (RBAC)، ثبت تغییرناپذیر
          رویدادها و برنامه ۵ فازی استقرار سامانه مشترک.
        </p>
      </div>

      {/* Data Partitioning & RBAC */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
            معماری دولایه تفکیک پایگاه داده
          </div>

          <div className="space-y-4 text-sm">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                بخش اختصاصی (Dedicated Data)
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                جدول <span className="font-mono">institution_local_cases</span> شامل نام، آدرس،
                وضعیت مسکن، گزارش‌های مددکاری و پزشکی صرفاً در سرور داخلی هر مؤسسه ذخیره شده و
                مؤسسه همکار هیچ دسترسی به آن ندارد.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900/60 space-y-1.5">
              <div className="font-semibold text-teal-950 dark:text-teal-200">
                بخش مشترک رمزنگاری‌شده (Shared Match Registry)
              </div>
              <p className="text-xs text-teal-900/80 dark:text-teal-200/80 leading-relaxed">
                جدول <span className="font-mono">shared_matching_registry</span> فقط شامل ۳ فیلد
                حداقلی است: کد ۶۴ کاراکتری <span className="font-mono">national_id_hash</span>،
                شناسه مؤسسه ثبت‌کننده و وضعیت پوشش (فعال/غیرفعال) با ارتباط رمزنگاری‌شده TLS 1.3 و
                محدودیت IP.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              ماتریس سطوح دسترسی مبتنی بر نقش (RBAC)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 whitespace-nowrap">سطح دسترسی</th>
                  <th className="py-3 px-4 whitespace-nowrap">کاربران مجاز</th>
                  <th className="py-3 px-4">میزان دسترسی به اطلاعات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {RBAC_ROLES.map((row) => (
                  <tr key={row.role} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 text-xs whitespace-nowrap">
                      {row.role}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">{row.users}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {row.access}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Immutable Audit Trail */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              دفتر ثبت رویدادهای امنیتی تغییرناپذیر (Immutable Audit Trail)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تمامی استعلام‌های کدملی، هشدارهای هم‌پوشانی و تغییرات پرونده با شناسه کاربر و زمان دقیق
              ثبت شده و غیرقابل ویرایش یا حذف است.
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing}
            onClick={handleRefresh}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            {refreshing ? 'در حال بروزرسانی...' : 'بروزرسانی لاگ‌های امنیتی'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 whitespace-nowrap">شناسه لاگ</th>
                <th className="py-3 px-4 whitespace-nowrap">زمان رویداد</th>
                <th className="py-3 px-4 whitespace-nowrap">نوع رویداد</th>
                <th className="py-3 px-4 whitespace-nowrap">مؤسسه و نقش کاربر</th>
                <th className="py-3 px-4 whitespace-nowrap">پیشوند هش کدملی</th>
                <th className="py-3 px-4 whitespace-nowrap">محدوده</th>
                <th className="py-3 px-4">نتیجه ثبت‌شده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                    {log.id}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-3 px-4 font-medium text-teal-800 dark:text-teal-300 whitespace-nowrap">
                    {ACTION_LABELS[log.action] ?? log.action}
                  </td>
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {getActorInstitutionLabel(log.actorInstitution)} ·{' '}
                    {ROLE_LABELS[log.actorRole] ?? log.actorRole}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {log.nationalIdHashPrefix}...
                  </td>
                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {log.blockName}
                  </td>
                  <td className="py-3 px-4 text-slate-800 dark:text-slate-200">{log.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5-Phase Pilot Roadmap + Go/No-Go Matrix */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            نقشه راه ۵ فازی استقرار و شاخص‌های تصمیم‌گیری پایلوت نایسر
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            برنامه سه‌ماهه از امضای تفاهم‌نامه تا تست آزمایشی در بلوک پایلوت و گسترش سراسری در نایسر.
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {PILOT_PHASES.map((phase, idx) => (
            <button
              key={phase.phase}
              type="button"
              onClick={() => setSelectedPhaseIndex(idx)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                selectedPhaseIndex === idx
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {phase.window}
            </button>
          ))}
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {activePhase.phase}
            </h3>
            <span className="text-xs font-medium text-teal-800 dark:text-teal-300">
              خروجی ملموس: {activePhase.deliverable}
            </span>
          </div>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300 list-disc pr-5 marker:text-teal-700 dark:marker:text-teal-400">
            {activePhase.tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-1.5">
            <div className="font-bold text-emerald-800 dark:text-emerald-300">موفقیت کامل (Go)</div>
            <p className="text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
              رفع موازی‌کاری بالای ۸۰٪، رضایت بالای مددکاران و سرعت استعلام مطلوب ← تایید نهایی و
              گسترش سراسری به کل نایسر.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-1.5">
            <div className="font-bold text-amber-800 dark:text-amber-300">موفقیت مشروط (Revise)</div>
            <p className="text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
              چالش‌های فنی جزئی یا مقاومت نرم در برخی مددکاران ← بازبینی سامانه، کارگاه تکمیلی و
              تمدید ۲ هفته‌ای پایلوت.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 space-y-1.5">
            <div className="font-bold text-red-800 dark:text-red-300">نیاز به بازطراحی (No-Go)</div>
            <p className="text-red-900/80 dark:text-red-200/80 leading-relaxed">
              نارضایتی شدید مراجعین، خطای امنیتی یا امتناع مددکاران ← توقف موقت سامانه و اصلاح
              بنیادین فرآیندها.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
