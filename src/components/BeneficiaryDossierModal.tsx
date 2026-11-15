import React, {useEffect, useMemo, useState} from 'react';
import {
  Download,
  EyeOff,
  FileSpreadsheet,
  Lock,
  Printer,
  ShieldCheck,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {InstitutionEmblem, InstitutionalLogo} from './InstitutionalLogo';
import type {CaseRecordView, CaseStage, DeliveredServiceEntry, InstitutionId} from '../types';
import {exportSingleBeneficiaryDossierToExcel} from '../utils/excelExport';

interface BeneficiaryDossierModalProps {
  caseRecord: CaseRecordView;
  preparedBy?: string;
  generatedAt?: string;
  onClose: () => void;
  onExportToast?: (title: string, description: string) => void;
}

const STAGE_TITLES: Record<CaseStage, string> = {
  1: '۱. پذیرش و ارجاع',
  2: '۲. ارزیابی همه‌جانبه',
  3: '۳. برنامه مداخله',
  4: '۴. اجرا و خدمات',
  5: '۵. پایش مستمر',
  6: '۶. خروج موفق',
};

const SERVICE_CATEGORY_LABELS: Record<DeliveredServiceEntry['category'], string> = {
  livelihood: 'معیشتی و سبد کالا',
  medical: 'درمانی و پزشکی',
  employment: 'اشتغال و مهارت‌آموزی',
  housing: 'مسکن و ودیعه',
  education: 'تحصیلی و دانش‌آموزی',
};

function getInstitutionFullLabel(id: InstitutionId): string {
  return id === 'darolahsan'
    ? 'مؤسسه خیریه دارالاحسان سنندج'
    : 'مؤسسه خیریه عدالت و برابری کردستان';
}

function getTierLabel(tier: CaseRecordView['urgencyTier']): string {
  if (tier === 'red') return 'قرمز · بحرانی (فوری)';
  if (tier === 'yellow') return 'زرد · نیازمند مستمر';
  return 'سبز · مستعد توانمندسازی';
}

function getCoverageLabel(status: CaseRecordView['coverageStatus']): string {
  if (status === 'GRADUATED') return 'خوداتکا و خروج موفق';
  if (status === 'SUSPENDED_OVERLAP') return 'تعلیق جهت ارجاع متقابل';
  return 'پوشش فعال';
}

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const BeneficiaryDossierModal: React.FC<BeneficiaryDossierModalProps> = ({
  caseRecord,
  preparedBy,
  generatedAt,
  onClose,
  onExportToast,
}) => {
  // Masked partner cases are always locked to redacted mode; owned cases allow toggling between Official and Publishable
  const [publishableMode, setPublishableMode] = useState<boolean>(caseRecord.isMasked);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    setPublishableMode(caseRecord.isMasked);
  }, [caseRecord.id, caseRecord.isMasked]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isRedacted = caseRecord.isMasked || publishableMode;
  const wf = caseRecord.workflow;

  const displayOwnerName = useMemo(() => {
    if (isRedacted) {
      return `خانوار تحت کد ${caseRecord.id}`;
    }
    return caseRecord.fullName || `پرونده ${caseRecord.id}`;
  }, [isRedacted, caseRecord.id, caseRecord.fullName]);

  const stageSummaryRows = useMemo(() => {
    const getStatusLabel = (stageNum: CaseStage): string => {
      if (caseRecord.stage > stageNum) return 'تکمیل‌شده';
      if (caseRecord.stage === stageNum) {
        return stageNum === 6 && caseRecord.coverageStatus === 'GRADUATED'
          ? 'تکمیل‌شده'
          : 'مرحله فعال';
      }
      return 'در انتظار';
    };

    return [
      {
        stage: 1 as CaseStage,
        title: STAGE_TITLES[1],
        status: getStatusLabel(1),
        summary: wf
          ? `منبع ارجاع: ${wf.stage1Intake.referralSource} · ${
              isRedacted ? 'پذیرش و رضایت‌نامه ثبت و تایید شده است.' : wf.stage1Intake.intakeSummary
            }`
          : 'پذیرش اولیه، استعلام هش‌شده و ثبت رضایت‌نامه آگاهانه',
        date: wf?.stage1Intake.completedAt || caseRecord.registeredAt,
      },
      {
        stage: 2 as CaseStage,
        title: STAGE_TITLES[2],
        status: getStatusLabel(2),
        summary: wf
          ? `نیازهای اولویت‌دار: ${wf.stage2Assessment.priorityNeeds.join('، ') || 'ارزیابی استاندارد'} · ${
              wf.stage2Assessment.fieldVisitPerformed ? 'بازدید میدانی انجام‌شده' : 'ارزیابی ستادی'
            }`
          : `امتیازدهی ۱۰۰ امتیازی (مجموع ${caseRecord.score.total})`,
        date: wf?.stage2Assessment.completedAt || '—',
      },
      {
        stage: 3 as CaseStage,
        title: STAGE_TITLES[3],
        status: getStatusLabel(3),
        summary: wf
          ? `بسته مداخله: ${wf.stage3Plan.assignedServicePackage || 'تدوین‌شده'} · ${toPersianNum(
              wf.stage3Plan.goals.length,
            )} هدف توانمندسازی`
          : caseRecord.servicePath === 'livelihood_medical'
            ? 'بسته معیشتی و درمانی'
            : 'بسته توانمندسازی و اشتغال',
        date: wf?.stage3Plan.completedAt || '—',
      },
      {
        stage: 4 as CaseStage,
        title: STAGE_TITLES[4],
        status: getStatusLabel(4),
        summary: wf
          ? `${
              wf.stage4Execution.shgConnected
                ? `اتصال به صندوق همیاری (${wf.stage4Execution.shgGroupName || 'فعال'})`
                : 'ارائه خدمات مستقیم'
            } · ${toPersianNum(wf.stage4Execution.deliveredServices.length)} خدمت ثبت‌شده`
          : caseRecord.lastSupportType,
        date: wf?.stage4Execution.completedAt || caseRecord.lastSupportDate,
      },
      {
        stage: 5 as CaseStage,
        title: STAGE_TITLES[5],
        status: getStatusLabel(5),
        summary: wf
          ? `ثبات ${toPersianNum(wf.stage5Monitoring.stabilityMonthsCount)} ماه · ${toPersianNum(
              wf.stage5Monitoring.visits.length,
            )} بازدید پایش دوره‌ای`
          : 'پایش دوره‌ای شاخص‌های درآمد و معیشت',
        date: wf?.stage5Monitoring.completedAt || '—',
      },
      {
        stage: 6 as CaseStage,
        title: STAGE_TITLES[6],
        status: getStatusLabel(6),
        summary: wf?.stage6Graduation.stableIncomeVerified
          ? `درآمد پایدار تاییدشده · شماره گواهی: ${wf.stage6Graduation.graduationCertificateNo || 'صادرشده'}`
          : 'در مسیر دستیابی به خوداتکایی پایدار',
        date: wf?.stage6Graduation.completedAt || '—',
      },
    ];
  }, [caseRecord, wf, isRedacted]);

  const handlePrintDossier = () => {
    setIsPrinting(true);
    document.body.classList.add('printing-dossier');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('printing-dossier');
      setIsPrinting(false);
      window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => {
        cleanup();
        onExportToast?.(
          'پرونده جامع آماده چاپ / PDF شد',
          isRedacted
            ? `نسخه قابل انتشار پرونده ${caseRecord.id} با حذف اطلاعات هویتی برای چاپ ارسال شد.`
            : `نسخه رسمی پرونده ${caseRecord.id} برای چاپ یا ذخیره PDF ارسال شد.`,
        );
      }, 400);
    }, 100);
  };

  const handleExportExcel = () => {
    exportSingleBeneficiaryDossierToExcel({
      caseRecord,
      publishableMode: isRedacted,
      preparedBy,
      generatedAt,
    });
    onExportToast?.(
      'فایل اکسل پرونده ذخیره شد',
      `فایل ۴ کاربرگه (.xlsx) برای ${displayOwnerName} در حالت ${
        isRedacted ? 'قابل انتشار (ناشناس)' : 'کامل اداری'
      } دانلود شد.`,
    );
  };

  const handleDownloadStandaloneHtml = () => {
    const versionLabel = isRedacted
      ? 'نسخه قابل انتشار عمومی (بدون اطلاعات هویتی)'
      : 'نسخه رسمی اداری (محرمانه)';
    const goalsHtml =
      wf && wf.stage3Plan.goals.length > 0
        ? wf.stage3Plan.goals
            .map(
              (g) =>
                `<tr>
                  <td>${escapeHtml(g.title)}</td>
                  <td>${escapeHtml(g.responsible)}</td>
                  <td>${escapeHtml(g.targetDate)}</td>
                  <td>${
                    g.status === 'achieved'
                      ? 'محقق‌شده'
                      : g.status === 'in_progress'
                        ? 'در حال اجرا'
                        : 'در انتظار'
                  }</td>
                </tr>`,
            )
            .join('')
        : '<tr><td colspan="4">هدف مداخله‌ای مجزا ثبت نشده است.</td></tr>';

    const servicesHtml =
      wf && wf.stage4Execution.deliveredServices.length > 0
        ? wf.stage4Execution.deliveredServices
            .map(
              (s) =>
                `<tr>
                  <td>${escapeHtml(s.dateTime)}</td>
                  <td>${escapeHtml(SERVICE_CATEGORY_LABELS[s.category])}</td>
                  <td>${escapeHtml(s.title)}</td>
                  <td>${escapeHtml(s.amountOrQuantity)}</td>
                  <td>${escapeHtml(getInstitutionFullLabel(s.providerInstitution))}</td>
                </tr>`,
            )
            .join('')
        : `<tr><td>${escapeHtml(caseRecord.lastSupportDate)}</td><td>حمایت ثبت‌شده</td><td>${escapeHtml(
            caseRecord.lastSupportType,
          )}</td><td>۱ نوبت</td><td>${escapeHtml(
            getInstitutionFullLabel(caseRecord.owningInstitution),
          )}</td></tr>`;

    const visitsHtml =
      wf && wf.stage5Monitoring.visits.length > 0
        ? wf.stage5Monitoring.visits
            .map(
              (v) =>
                `<tr>
                  <td>${escapeHtml(v.dateTime)}</td>
                  <td>${toPersianNum(v.monthlyEstimatedIncome)} تومان</td>
                  <td>${escapeHtml(v.employmentStability)}</td>
                  <td>${escapeHtml(v.childEducationStatus)}</td>
                  <td>${escapeHtml(v.overallProgress)}</td>
                </tr>`,
            )
            .join('')
        : '<tr><td colspan="5">بازدید پایش دوره‌ای ثبت نشده است.</td></tr>';

    const stagesHtml = stageSummaryRows
      .map(
        (row) =>
          `<tr>
            <td><strong>${escapeHtml(row.title)}</strong></td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.summary)}</td>
            <td>${escapeHtml(row.date)}</td>
          </tr>`,
      )
      .join('');

    const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>پرونده جامع مددجو ${escapeHtml(caseRecord.id)} · ${escapeHtml(versionLabel)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; background: #fff; color: #0f172a; font-family: "Vazirmatn", Tahoma, sans-serif; line-height: 1.6; }
    .container { max-width: 960px; margin: 0 auto; }
    .toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 14px; }
    .btn { padding: 8px 16px; border-radius: 8px; border: 1px solid #0f766e; background: #0f766e; color: #fff; font-family: inherit; font-size: 13px; cursor: pointer; }
    .masthead { border-bottom: 2px solid #0f766e; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #f0fdfa; border: 1px solid #99f6e4; color: #0f766e; margin-bottom: 6px; }
    h1 { margin: 0; font-size: 20px; }
    h2 { margin: 0 0 10px 0; font-size: 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .meta { font-size: 12px; color: #475569; }
    .section { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 16px; margin-bottom: 14px; break-inside: avoid; page-break-inside: avoid; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 12px; }
    .grid-5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; font-size: 12px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; }
    .lbl { font-size: 11px; color: #64748b; }
    .val { font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; text-align: right; vertical-align: top; }
    th { background: #f8fafc; color: #475569; }
    .signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
    .sign-box { border: 1px dashed #94a3b8; border-radius: 8px; padding: 12px; min-height: 78px; font-size: 11px; color: #475569; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar no-print">
      <button class="btn" onclick="window.print()">چاپ / ذخیره PDF</button>
    </div>
    <header class="masthead">
      <div>
        <div class="badge">${escapeHtml(versionLabel)}</div>
        <h1>پرونده جامع مددجو — ${escapeHtml(displayOwnerName)}</h1>
        <div class="meta">شناسه پرونده: ${escapeHtml(caseRecord.id)} · مؤسسه متولی: ${escapeHtml(
          getInstitutionFullLabel(caseRecord.owningInstitution),
        )} · بلوک: ${escapeHtml(caseRecord.blockName)}</div>
      </div>
      <div class="meta">
        <div>تاریخ صدور: ${escapeHtml(generatedAt || '—')}</div>
        ${preparedBy ? `<div>تهیه‌کننده: ${escapeHtml(preparedBy)}</div>` : ''}
        <div>هش SHA-256: ${escapeHtml(caseRecord.nationalIdHash.slice(0, 16))}...</div>
      </div>
    </header>
    <section class="section">
      <h2>۱. مشخصات پایه و وضعیت پوشش</h2>
      <div class="grid-3">
        <div class="box"><div class="lbl">سرپرست خانوار</div><div class="val">${escapeHtml(displayOwnerName)}</div></div>
        <div class="box"><div class="lbl">کدملی / تماس</div><div class="val">${
          isRedacted ? 'محرمانه (حذف‌شده)' : `${escapeHtml(caseRecord.nationalIdMasked || '***')} · ${escapeHtml(caseRecord.phone || '—')}`
        }</div></div>
        <div class="box"><div class="lbl">نشانی و مسکن</div><div class="val">${
          isRedacted ? escapeHtml(caseRecord.blockName) : escapeHtml(caseRecord.address || caseRecord.blockName)
        }</div></div>
        <div class="box"><div class="lbl">مرحله فعلی</div><div class="val">${escapeHtml(STAGE_TITLES[caseRecord.stage])}</div></div>
        <div class="box"><div class="lbl">وضعیت پوشش</div><div class="val">${escapeHtml(getCoverageLabel(caseRecord.coverageStatus))}</div></div>
        <div class="box"><div class="lbl">درجه فوریت</div><div class="val">${escapeHtml(getTierLabel(caseRecord.urgencyTier))}</div></div>
      </div>
    </section>
    <section class="section">
      <h2>۲. امتیازدهی ۱۰۰ امتیازی نیازمندی‌سنجی</h2>
      <div class="grid-5">
        <div class="box"><div class="lbl">امتیاز کل</div><div class="val">${toPersianNum(caseRecord.score.total)} / ۱۰۰</div></div>
        <div class="box"><div class="lbl">ساختار خانوار</div><div class="val">${toPersianNum(caseRecord.score.familyStructure)} / ۳۰</div></div>
        <div class="box"><div class="lbl">مسکن</div><div class="val">${toPersianNum(caseRecord.score.housing)} / ۲۵</div></div>
        <div class="box"><div class="lbl">معیشت</div><div class="val">${toPersianNum(caseRecord.score.livelihood)} / ۲۵</div></div>
        <div class="box"><div class="lbl">سلامت</div><div class="val">${toPersianNum(caseRecord.score.health)} / ۲۰</div></div>
      </div>
    </section>
    <section class="section">
      <h2>۳. گزارش ۶ مرحله مدیریت مورد</h2>
      <table><thead><tr><th>مرحله</th><th>وضعیت</th><th>خلاصه اقدامات</th><th>تاریخ</th></tr></thead><tbody>${stagesHtml}</tbody></table>
    </section>
    <section class="section">
      <h2>۴. اهداف برنامه مداخله</h2>
      <table><thead><tr><th>عنوان هدف</th><th>مسئول</th><th>تاریخ هدف</th><th>وضعیت</th></tr></thead><tbody>${goalsHtml}</tbody></table>
    </section>
    <section class="section">
      <h2>۵. خدمات و حمایت‌های ارائه‌شده</h2>
      <table><thead><tr><th>تاریخ</th><th>نوع خدمت</th><th>شرح خدمت</th><th>میزان</th><th>ارائه‌دهنده</th></tr></thead><tbody>${servicesHtml}</tbody></table>
    </section>
    <section class="section">
      <h2>۶. بازدیدهای پایش مستمر</h2>
      <table><thead><tr><th>تاریخ بازدید</th><th>درآمد برآوردی</th><th>ثبات اشتغال</th><th>وضعیت تحصیلی</th><th>ارزیابی</th></tr></thead><tbody>${visitsHtml}</tbody></table>
    </section>
    <div class="signs">
      <div class="sign-box">مددکار اجتماعی مسئول پرونده<br/>نام و امضا:</div>
      <div class="sign-box">سرپرست فنی مؤسسه متولی<br/>تایید و مهر:</div>
      <div class="sign-box">کارگروه هماهنگی شبکه نایسر<br/>تاییدیه هم‌افزایی:</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], {type: 'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `naysar-dossier-${caseRecord.id}-${isRedacted ? 'publishable' : 'official'}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

    onExportToast?.(
      'نسخه قابل انتشار پرونده دانلود شد',
      `پرونده جامع ${caseRecord.id} (${isRedacted ? 'بدون اطلاعات هویتی' : 'نسخه اداری'}) با فرمت چاپی ذخیره شد.`,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 dossier-print-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beneficiary-dossier-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 transition-all overflow-y-auto shadow-2xl dossier-print-panel ${
          isFullscreen
            ? 'w-screen h-screen max-w-none max-h-none rounded-none'
            : 'rounded-2xl max-w-5xl max-h-[92vh]'
        }`}
      >
        {/* Sticky Screen Toolbar (Hidden during print) */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 print:hidden">
          <div>
            <h2
              id="beneficiary-dossier-title"
              className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100"
            >
              پرونده جامع قابل انتشار و چاپ · {caseRecord.id}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تجمیع اطلاعات خانوار، امتیازدهی ۱۰۰ امتیازی، ۶ مرحله مدیریت مورد، خدمات و پایش
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Official vs Publishable Mode Switch */}
            {caseRecord.isMasked ? (
              <span className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                قفل محرمانگی همکار (قابل انتشار)
              </span>
            ) : (
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPublishableMode(false)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    !publishableMode
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  نسخه کامل اداری
                </button>
                <button
                  type="button"
                  onClick={() => setPublishableMode(true)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                    publishableMode
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <EyeOff className="w-3 h-3" />
                  نسخه قابل انتشار (بدون هویت)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              خروجی اکسل (.xlsx)
            </button>

            <button
              type="button"
              onClick={handleDownloadStandaloneHtml}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              فایل قابل انتشار (HTML)
            </button>

            <button
              type="button"
              disabled={isPrinting}
              onClick={handlePrintDossier}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              {isPrinting ? 'در حال آماده‌سازی...' : 'چاپ / PDF'}
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              title={isFullscreen ? 'خروج از حالت تمام‌صفحه' : 'ورود به حالت تمام‌صفحه'}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              )}
              <span>{isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="بستن پرونده"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* White A4 Paper Sheet Preview (Always light paper for faithful print/publish preview) */}
        <div className="p-4 sm:p-6 print:p-0">
          <article className="bg-white text-slate-900 border border-slate-300 rounded-xl p-6 sm:p-8 space-y-6 shadow-xs print:border-none print:shadow-none print:p-0">
            {/* Official Masthead */}
            <header className="border-b-2 border-teal-700 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <InstitutionalLogo variant="mark" size="lg" tone="print" />
                  <InstitutionEmblem
                    institution={caseRecord.owningInstitution}
                    size="lg"
                    tone="print"
                  />
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-teal-200 bg-teal-50 text-teal-800 text-xs font-semibold">
                    {isRedacted ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        نسخه قابل انتشار عمومی · اطلاعات هویتی حذف‌شده
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        نسخه رسمی اداری · محرمانه درون‌سازمانی
                      </>
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-600">
                    سامانه هم‌افزایی و مدیریت مورد ناحیه منفصل شهری نایسر سنندج
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    پرونده جامع مددجو: {displayOwnerName}
                  </h1>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1 tabular-nums sm:text-left">
                <div>
                  شناسه پرونده: <strong className="font-mono text-slate-900">{caseRecord.id}</strong>
                </div>
                <div>
                  کد هش امنیتی:{' '}
                  <span className="font-mono">{caseRecord.nationalIdHash.slice(0, 18)}...</span>
                </div>
                <div>تاریخ صدور: {generatedAt || caseRecord.lastUpdatedAt}</div>
                {preparedBy && <div>تهیه‌کننده: {preparedBy}</div>}
              </div>
            </header>

            {/* Section 1: Household Profile & Governance */}
            <section className="space-y-3 print-avoid-break">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                ۱. مشخصات پایه خانوار، متولی پرونده و وضعیت پوشش
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">مؤسسه متولی و مدل همکاری</div>
                  <div className="font-semibold text-slate-900 mt-1">
                    {getInstitutionFullLabel(caseRecord.owningInstitution)}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {caseRecord.collaborationModel === 'complementary_support'
                      ? 'پوشش ترکیبی دو مؤسسه'
                      : 'مدیریت تک‌متولی'}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">اطلاعات هویتی و تماس</div>
                  <div className="font-semibold text-slate-900 mt-1 tabular-nums">
                    {isRedacted
                      ? 'حذف‌شده برای انتشار (ناشناس)'
                      : `${caseRecord.nationalIdMasked || '***'} · ${caseRecord.phone || '—'}`}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {isRedacted
                      ? 'رضایت‌نامه آگاهانه ثبت‌شده'
                      : `${caseRecord.headStatus || '—'} · ${toPersianNum(
                          caseRecord.householdSize || 0,
                        )} نفر`}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">بلوک جغرافیایی و سکونت</div>
                  <div className="font-semibold text-slate-900 mt-1">{caseRecord.blockName}</div>
                  <div className="text-slate-600 mt-0.5">
                    {isRedacted
                      ? 'نشانی دقیق جهت حفظ حریم خصوصی مخفی است'
                      : caseRecord.address || caseRecord.blockName}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">مرحله فعلی مدیریت مورد</div>
                  <div className="font-semibold text-teal-800 mt-1">
                    {STAGE_TITLES[caseRecord.stage]}
                  </div>
                  <div className="text-slate-600 mt-0.5 tabular-nums">
                    توقف در مرحله: {toPersianNum(caseRecord.daysInStage)} روز (از{' '}
                    {caseRecord.stageEnteredDate})
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">وضعیت پوشش و درجه فوریت</div>
                  <div className="font-semibold text-slate-900 mt-1">
                    {getCoverageLabel(caseRecord.coverageStatus)}
                  </div>
                  <div className="text-slate-700 mt-0.5">{getTierLabel(caseRecord.urgencyTier)}</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">تاریخچه زمانی و آخرین حمایت</div>
                  <div className="font-semibold text-slate-900 mt-1 tabular-nums">
                    ثبت: {caseRecord.registeredAt} · بروزرسانی: {caseRecord.lastUpdatedAt}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    {caseRecord.lastSupportType} ({caseRecord.lastSupportDate})
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: 100-Point Assessment Breakdown & 3M Forecast */}
            <section className="space-y-3 print-avoid-break">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                ۲. ارزیابی ۱۰۰ امتیازی نیازمندی‌سنجی و پیش‌بینی نیاز ۳ ماه آینده
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs tabular-nums">
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                  <div className="text-teal-800 font-medium">امتیاز کل نیازمندی</div>
                  <div className="text-xl font-bold text-teal-900 mt-1">
                    {toPersianNum(caseRecord.score.total)} / ۱۰۰
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">ساختار خانوار</div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {toPersianNum(caseRecord.score.familyStructure)} / ۳۰
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">وضعیت مسکن</div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {toPersianNum(caseRecord.score.housing)} / ۲۵
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">معیشت و درآمد</div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {toPersianNum(caseRecord.score.livelihood)} / ۲۵
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-slate-500">سلامت و درمان</div>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    {toPersianNum(caseRecord.score.health)} / ۲۰
                  </div>
                </div>
              </div>

              {caseRecord.needForecast3M && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
                  <div className="font-semibold text-slate-900 tabular-nums">
                    پیش‌بینی نیاز ۳ ماهه: {caseRecord.needForecast3M.categoryLabel} (احتمال{' '}
                    {toPersianNum(caseRecord.needForecast3M.probabilityPct)}٪)
                  </div>
                  <p className="text-slate-700 leading-relaxed">
                    {isRedacted
                      ? 'برآورد ریسک ۳ ماهه بر اساس امتیازدهی ساختاری جهت تخصیص بهینه منابع جلسه مدیریتی لحاظ شده است.'
                      : caseRecord.needForecast3M.rationale}
                  </p>
                </div>
              )}

              {!isRedacted && (caseRecord.medicalNotes || caseRecord.caseWorkerNote) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                    <div className="font-semibold text-slate-700">ملاحظات پزشکی و سلامت</div>
                    <p className="text-slate-700 leading-relaxed">
                      {caseRecord.medicalNotes || 'ثبت نشده'}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                    <div className="font-semibold text-slate-700">ارزیابی و یادداشت مددکار</div>
                    <p className="text-slate-700 leading-relaxed">
                      {caseRecord.caseWorkerNote || 'ثبت نشده'}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Section 3: 6-Stage Workflow Summary */}
            <section className="space-y-3 print-avoid-break">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                ۳. خلاصه گام به گام ۶ مرحله مدیریت مورد
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2.5 px-3 font-semibold">مرحله</th>
                      <th className="py-2.5 px-3 font-semibold">وضعیت</th>
                      <th className="py-2.5 px-3 font-semibold">خلاصه اقدامات و مدارک</th>
                      <th className="py-2.5 px-3 font-semibold">تاریخ ثبت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {stageSummaryRows.map((row) => (
                      <tr key={row.stage}>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                          {row.title}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              row.status === 'تکمیل‌شده'
                                ? 'text-emerald-700'
                                : row.status === 'مرحله فعال'
                                  ? 'text-teal-700'
                                  : 'text-slate-500'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 leading-relaxed">{row.summary}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                          {row.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 4: Intervention Goals & Delivered Services */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-1">
              <div className="space-y-2 print-avoid-break">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  ۴. اهداف برنامه مداخله و توانمندسازی
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2 px-3 font-semibold">هدف</th>
                        <th className="py-2 px-3 font-semibold">مسئول</th>
                        <th className="py-2 px-3 font-semibold">تاریخ هدف</th>
                        <th className="py-2 px-3 font-semibold">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {wf && wf.stage3Plan.goals.length > 0 ? (
                        wf.stage3Plan.goals.map((g) => (
                          <tr key={g.id}>
                            <td className="py-2 px-3 text-slate-900 font-medium">{g.title}</td>
                            <td className="py-2 px-3 text-slate-600">{g.responsible}</td>
                            <td className="py-2 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                              {g.targetDate}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap font-semibold">
                              {g.status === 'achieved' ? (
                                <span className="text-emerald-700">محقق‌شده</span>
                              ) : g.status === 'in_progress' ? (
                                <span className="text-teal-700">در حال اجرا</span>
                              ) : (
                                <span className="text-slate-500">در انتظار</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-4 px-3 text-center text-slate-500">
                            هدف مداخله‌ای در پرونده ثبت نشده است.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2 print-avoid-break">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  ۵. خدمات و حمایت‌های ارائه‌شده
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2 px-3 font-semibold">تاریخ</th>
                        <th className="py-2 px-3 font-semibold">نوع</th>
                        <th className="py-2 px-3 font-semibold">شرح خدمت</th>
                        <th className="py-2 px-3 font-semibold">میزان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {wf && wf.stage4Execution.deliveredServices.length > 0 ? (
                        wf.stage4Execution.deliveredServices.map((s) => (
                          <tr key={s.id}>
                            <td className="py-2 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                              {s.dateTime}
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                              {SERVICE_CATEGORY_LABELS[s.category]}
                            </td>
                            <td className="py-2 px-3 text-slate-900 font-medium">{s.title}</td>
                            <td className="py-2 px-3 text-slate-700 tabular-nums whitespace-nowrap">
                              {s.amountOrQuantity}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="py-2 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {caseRecord.lastSupportDate}
                          </td>
                          <td className="py-2 px-3 text-slate-700">حمایت ثبت‌شده</td>
                          <td className="py-2 px-3 text-slate-900 font-medium">
                            {caseRecord.lastSupportType}
                          </td>
                          <td className="py-2 px-3 text-slate-700">۱ نوبت</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Section 6: Monitoring Visits & Graduation Checklist */}
            <section className="space-y-3 print-avoid-break">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                ۶. بازدیدهای پایش مستمر و شاخص‌های خروج موفق (خوداتکایی)
              </h3>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2 px-3 font-semibold">تاریخ بازدید</th>
                      <th className="py-2 px-3 font-semibold">درآمد برآوردی ماهانه</th>
                      <th className="py-2 px-3 font-semibold">ثبات اشتغال</th>
                      <th className="py-2 px-3 font-semibold">وضعیت تحصیلی فرزندان</th>
                      <th className="py-2 px-3 font-semibold">ارزیابی کلی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {wf && wf.stage5Monitoring.visits.length > 0 ? (
                      wf.stage5Monitoring.visits.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {v.dateTime}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {toPersianNum(v.monthlyEstimatedIncome)} تومان
                          </td>
                          <td className="py-2 px-3 text-slate-700">{v.employmentStability}</td>
                          <td className="py-2 px-3 text-slate-700">{v.childEducationStatus}</td>
                          <td className="py-2 px-3 font-semibold text-teal-800 whitespace-nowrap">
                            {v.overallProgress}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-4 px-3 text-center text-slate-500">
                          بازدید پایش دوره‌ای برای این پرونده هنوز ثبت نشده است.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {wf && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-1">
                  {[
                    {
                      label: 'تایید درآمد پایدار خانوار',
                      done: wf.stage6Graduation.stableIncomeVerified,
                    },
                    {
                      label: 'پوشش بیمه درمانی / تامین اجتماعی',
                      done: wf.stage6Graduation.insuranceActive,
                    },
                    {
                      label: 'تکمیل پیگیری پس از ۶ ماه',
                      done: wf.stage6Graduation.sixMonthFollowUpDone,
                    },
                    {
                      label: 'آمادگی مشارکت داوطلبانه همیار',
                      done: wf.stage6Graduation.peerVolunteerJoined,
                    },
                  ].map((chk) => (
                    <div
                      key={chk.label}
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                        chk.done
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="font-medium">{chk.label}</span>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          chk.done ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {chk.done ? 'تاییدشده' : 'در انتظار'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 7: Chronological Timeline */}
            {caseRecord.history && caseRecord.history.length > 0 && (
              <section className="space-y-2 print-avoid-break">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                  ۷. تاریخچه وقایع و تغییرات پرونده
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="py-2 px-3 font-semibold">تاریخ و ساعت</th>
                        <th className="py-2 px-3 font-semibold">شرح رویداد</th>
                        <th className="py-2 px-3 font-semibold">مؤسسه ثبت‌کننده</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {caseRecord.history.map((h) => (
                        <tr key={h.id}>
                          <td className="py-2 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {h.timestamp}
                          </td>
                          <td className="py-2 px-3 text-slate-800">
                            {isRedacted
                              ? `ثبت رویداد در مرحله ${STAGE_TITLES[h.stage || caseRecord.stage]}`
                              : h.summary}
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {getInstitutionFullLabel(h.actorInstitution)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Official Signature Footer */}
            <footer className="pt-4 border-t border-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs print-avoid-break">
              <div className="border border-dashed border-slate-300 rounded-lg p-3 min-h-[76px] flex flex-col justify-between">
                <span className="font-semibold text-slate-700">مددکار اجتماعی مسئول پرونده</span>
                <span className="text-slate-400">نام، تاریخ و امضا:</span>
              </div>
              <div className="border border-dashed border-slate-300 rounded-lg p-3 min-h-[76px] flex flex-col justify-between">
                <span className="font-semibold text-slate-700">ناظر فنی مؤسسه متولی</span>
                <span className="text-slate-400">تایید و مهر مؤسسه:</span>
              </div>
              <div className="border border-dashed border-slate-300 rounded-lg p-3 min-h-[76px] flex flex-col justify-between">
                <span className="font-semibold text-slate-700">کارگروه هم‌افزایی شبکه نایسر</span>
                <span className="text-slate-400">مهر تایید انتشار / بایگانی:</span>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
};
