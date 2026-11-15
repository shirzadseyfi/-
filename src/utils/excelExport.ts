import * as XLSX from 'xlsx';
import type {
  CaseRecordView,
  CaseStage,
  CaseWorkerPerformanceItem,
  InstitutionId,
  NaysarBlock,
  ReportsPayload,
} from '../types';

const STAGE_LABELS: Record<CaseStage, string> = {
  1: '۱. پذیرش و ارجاع',
  2: '۲. ارزیابی همه‌جانبه',
  3: '۳. برنامه مداخله',
  4: '۴. اجرا و خدمات',
  5: '۵. پایش مستمر',
  6: '۶. خروج موفق',
};

function getInstitutionLabel(id: InstitutionId | 'joint_pilot'): string {
  if (id === 'darolahsan') return 'مؤسسه خیریه دارالاحسان سنندج';
  if (id === 'edalat') return 'مؤسسه خیریه عدالت و برابری کردستان';
  return 'پایلوت مشترک دو مؤسسه';
}

function getTierLabel(tier: CaseRecordView['urgencyTier']): string {
  if (tier === 'red') return 'قرمز (بحرانی)';
  if (tier === 'yellow') return 'زرد (مستمر)';
  return 'سبز (توانمندسازی)';
}

function getCoverageLabel(status: CaseRecordView['coverageStatus']): string {
  if (status === 'GRADUATED') return 'خوداتکا و خروج موفق';
  if (status === 'SUSPENDED_OVERLAP') return 'تعلیق جهت ارجاع متقابل';
  return 'پوشش فعال';
}

function applyRtlAndColumnWidths(
  ws: XLSX.WorkSheet,
  rows: Array<Array<string | number>>,
  minWidth = 14,
  maxWidth = 48,
) {
  ws['!views'] = [{rightToLeft: true}];
  const colWidths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, idx) => {
      const len = String(cell ?? '').length;
      const estimated = Math.min(maxWidth, Math.max(minWidth, len + 4));
      colWidths[idx] = Math.max(colWidths[idx] || minWidth, estimated);
    });
  }
  ws['!cols'] = colWidths.map((wch) => ({wch}));
}

function buildCaseRows(cases: CaseRecordView[], redactPrivate = false) {
  const header = [
    'شناسه پرونده',
    'کد هش (SHA-256)',
    'نام سرپرست خانوار',
    'کدملی (ماسک‌شده)',
    'شماره تماس',
    'مؤسسه متولی',
    'مدل همکاری',
    'بلوک جغرافیایی',
    'آدرس',
    'تعداد خانوار',
    'وضعیت سرپرست',
    'نوع مسکن',
    'مرحله فعلی',
    'وضعیت پوشش',
    'درجه فوریت',
    'امتیاز کل (از ۱۰۰)',
    'ساختار خانوار (۳۰)',
    'مسکن (۲۵)',
    'معیشت (۲۵)',
    'سلامت (۲۰)',
    'مسیر مداخله',
    'آخرین حمایت ثبت‌شده',
    'تاریخ آخرین حمایت',
    'توقف در مرحله (روز)',
    'پیش‌بینی نیاز ۳ ماهه',
    'احتمال نیاز (٪)',
    'تاریخ ثبت',
    'آخرین بروزرسانی',
  ];

  const rows: Array<Array<string | number>> = [header];
  for (const c of cases) {
    const isHidden = c.isMasked || redactPrivate;
    rows.push([
      c.id,
      `${c.nationalIdHash.slice(0, 16)}...`,
      isHidden ? (redactPrivate ? `مددجو (${c.id})` : 'محرمانه (ایزوله در مؤسسه همکار)') : c.fullName || '—',
      isHidden ? '***' : c.nationalIdMasked || '***',
      isHidden ? '***' : c.phone || '—',
      getInstitutionLabel(c.owningInstitution),
      c.collaborationModel === 'complementary_support' ? 'پوشش ترکیبی دو مؤسسه' : 'تک‌متولی',
      c.blockName,
      isHidden ? c.blockName : c.address || c.blockName,
      isHidden ? '—' : c.householdSize ?? '—',
      isHidden ? '—' : c.headStatus || '—',
      isHidden ? '—' : c.housingType || '—',
      STAGE_LABELS[c.stage],
      getCoverageLabel(c.coverageStatus),
      getTierLabel(c.urgencyTier),
      c.score.total,
      c.score.familyStructure,
      c.score.housing,
      c.score.livelihood,
      c.score.health,
      c.servicePath === 'livelihood_medical' ? 'معیشتی و درمانی' : 'توانمندسازی و اشتغال',
      c.lastSupportType,
      c.lastSupportDate,
      c.daysInStage,
      isHidden ? '—' : c.needForecast3M?.categoryLabel || '—',
      isHidden ? '—' : c.needForecast3M?.probabilityPct ?? '—',
      c.registeredAt,
      c.lastUpdatedAt,
    ]);
  }
  return rows;
}

export function exportReportsToExcel(params: {
  report: ReportsPayload;
  workers: CaseWorkerPerformanceItem[];
  cases: CaseRecordView[];
  scopeLabel: string;
  preparedBy?: string;
  generatedAt?: string;
}) {
  const {report, workers, cases, scopeLabel, preparedBy, generatedAt} = params;
  const wb = XLSX.utils.book_new();
  wb.Workbook = {Views: [{RTL: true}]};

  const totalReviewed = workers.reduce((s, w) => s + w.reviewedCasesCount, 0);
  const totalCurrentMonthReviewed = workers.reduce((s, w) => s + w.currentMonthReviewedCount, 0);
  const totalTransitions = workers.reduce((s, w) => s + w.stageTransitionsCount, 0);
  const avgDays =
    workers.length > 0
      ? Number(
          (workers.reduce((s, w) => s + w.avgTransitionDays, 0) / workers.length).toFixed(1),
        )
      : 0;

  // Sheet 1: Executive Summary
  const summaryRows: Array<Array<string | number>> = [
    ['گزارش مدیریتی جامع سامانه هم‌افزایی نایسر سنندج', ''],
    ['محدوده گزارش', scopeLabel],
    ['تاریخ تهیه', generatedAt || '—'],
    ['تهیه‌کننده', preparedBy || '—'],
    ['', ''],
    ['شاخص کلیدی', 'مقدار'],
    ['مجموع خانوارهای خوداتکا (تجمعی)', report.totalGraduatedEnd],
    ['درصد رشد ۶ ماهه خوداتکایی', `${report.sixMonthGrowthPct}٪`],
    ['پرونده‌های قرمز (بحرانی فعلی)', report.currentDistribution.red],
    ['پرونده‌های زرد (نیازمند مستمر)', report.currentDistribution.yellow],
    ['پرونده‌های سبز (مستعد توانمندسازی)', report.currentDistribution.green],
    ['جمع پرونده‌های فعال شبکه در گزارش', report.currentDistribution.total],
    ['پرونده‌های بررسی‌شده توسط مددکاران (ماه جاری)', totalCurrentMonthReviewed],
    ['پرونده‌های بررسی‌شده توسط مددکاران (ماه گذشته)', totalReviewed],
    ['مجموع جابجایی مراحل ثبت‌شده (ماه گذشته)', totalTransitions],
    ['میانگین سرعت جابجایی مراحل تیم (روز)', avgDays],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  applyRtlAndColumnWidths(wsSummary, summaryRows, 22, 46);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'خلاصه مدیریتی');

  // Sheet 2: 6-Month Series
  const seriesRows: Array<Array<string | number>> = [
    [
      'ماه',
      'خوداتکای تجمعی',
      'خروج موفق ماهانه',
      'هم‌پوشانی پیشگیری‌شده',
      'درجه قرمز (بحرانی)',
      'درجه زرد (مستمر)',
      'درجه سبز (توانمندسازی)',
    ],
    ...report.series.map((r) => [
      r.monthLabel,
      r.graduatedCumulative,
      r.graduatedNew,
      r.overlapsPrevented,
      r.redTier,
      r.yellowTier,
      r.greenTier,
    ]),
  ];
  const wsSeries = XLSX.utils.aoa_to_sheet(seriesRows);
  applyRtlAndColumnWidths(wsSeries, seriesRows, 16, 30);
  XLSX.utils.book_append_sheet(wb, wsSeries, 'عملکرد ۶ ماهه');

  // Sheet 3: Case Worker Monthly Performance
  const workerRows: Array<Array<string | number>> = [
    [
      'نام مددکار',
      'سمت تخصصی',
      'مؤسسه',
      'بلوک‌های تحت پوشش',
      'بررسی‌شده (ماه جاری)',
      'هدف ماه جاری',
      'بررسی‌شده (ماه گذشته)',
      'جابجایی مراحل',
      'میانگین سرعت (روز)',
      'پیگیری به‌موقع (٪)',
    ],
    ...workers.map((w) => [
      w.name,
      w.roleTitle,
      w.institutionLabel,
      w.blockCoverage,
      w.currentMonthReviewedCount,
      w.currentMonthTargetCount,
      w.reviewedCasesCount,
      w.stageTransitionsCount,
      w.avgTransitionDays,
      w.onTimeFollowUpPct,
    ]),
  ];
  const wsWorkers = XLSX.utils.aoa_to_sheet(workerRows);
  applyRtlAndColumnWidths(wsWorkers, workerRows, 16, 36);
  XLSX.utils.book_append_sheet(wb, wsWorkers, 'عملکرد مددکاران');

  // Sheet 4: Employment & Income Distribution
  const socioRows: Array<Array<string | number>> = [
    ['بخش اول: توزیع وضعیت اشتغال و پوشش بیمه‌ای', '', '', ''],
    ['وضعیت', 'تعداد خانوار', 'درصد سهم (٪)', ''],
    ...report.employmentDistribution.map((e) => [e.label, e.count, e.percentage, '']),
    ['', '', '', ''],
    ['بخش دوم: توزیع سطح درآمد ماهانه خانوارها', '', '', ''],
    ['بازه درآمدی', 'تعداد خانوار', 'درصد سهم (٪)', 'وضعیت خط معیشت'],
    ...report.incomeDistribution.map((inc) => [
      inc.bracketLabel,
      inc.count,
      inc.percentage,
      inc.povertyLineStatus,
    ]),
  ];
  const wsSocio = XLSX.utils.aoa_to_sheet(socioRows);
  applyRtlAndColumnWidths(wsSocio, socioRows, 16, 48);
  XLSX.utils.book_append_sheet(wb, wsSocio, 'اشتغال و درآمد');

  // Sheet 5: Accessible Case Register
  const scopedCases =
    report.institutionFilter === 'all'
      ? cases
      : cases.filter((c) => c.owningInstitution === report.institutionFilter);
  const caseRows = buildCaseRows(scopedCases, false);
  const wsCases = XLSX.utils.aoa_to_sheet(caseRows);
  applyRtlAndColumnWidths(wsCases, caseRows, 14, 38);
  XLSX.utils.book_append_sheet(wb, wsCases, 'فهرست پرونده‌ها');

  XLSX.writeFile(wb, `naysar-reports-${report.institutionFilter}-${Date.now()}.xlsx`);
}

export function exportCasesRegisterToExcel(params: {
  cases: CaseRecordView[];
  blocks: NaysarBlock[];
  institutionLabel: string;
  preparedBy?: string;
  generatedAt?: string;
}) {
  const {cases, blocks, institutionLabel, preparedBy, generatedAt} = params;
  const wb = XLSX.utils.book_new();
  wb.Workbook = {Views: [{RTL: true}]};

  const caseRows = buildCaseRows(cases, false);
  const wsCases = XLSX.utils.aoa_to_sheet(caseRows);
  applyRtlAndColumnWidths(wsCases, caseRows, 14, 38);
  XLSX.utils.book_append_sheet(wb, wsCases, 'کارتابل پرونده‌ها');

  const blockRows: Array<Array<string | number>> = [
    ['شناسه بلوک', 'نام محدوده', 'منطقه', 'مؤسسه مسئول', 'پایلوت', 'تعداد خانوار ساکن', 'پرونده‌های فعال'],
    ...blocks.map((b) => [
      b.id,
      b.name,
      b.zoneLabel,
      getInstitutionLabel(b.leadInstitution),
      b.isPilotZone ? 'بله' : 'خیر',
      b.householdCount,
      b.activeCasesCount,
    ]),
    ['', '', '', '', '', '', ''],
    ['مؤسسه فعال گزارش‌گیر', institutionLabel, 'تاریخ تهیه', generatedAt || '—', 'تهیه‌کننده', preparedBy || '—', ''],
  ];
  const wsBlocks = XLSX.utils.aoa_to_sheet(blockRows);
  applyRtlAndColumnWidths(wsBlocks, blockRows, 16, 40);
  XLSX.utils.book_append_sheet(wb, wsBlocks, 'بلوک‌بندی نایسر');

  XLSX.writeFile(wb, `naysar-cases-register-${Date.now()}.xlsx`);
}

export function exportSingleBeneficiaryDossierToExcel(params: {
  caseRecord: CaseRecordView;
  publishableMode: boolean;
  preparedBy?: string;
  generatedAt?: string;
}) {
  const {caseRecord, publishableMode, preparedBy, generatedAt} = params;
  const isRedacted = caseRecord.isMasked || publishableMode;
  const wb = XLSX.utils.book_new();
  wb.Workbook = {Views: [{RTL: true}]};

  const wf = caseRecord.workflow;

  // Sheet 1: Profile & Scoring
  const profileRows: Array<Array<string | number>> = [
    ['پرونده جامع مددجو — سامانه هم‌افزایی و مدیریت مورد نایسر', ''],
    ['نوع نسخه خروجی', isRedacted ? 'نسخه قابل انتشار (بدون اطلاعات هویتی)' : 'نسخه رسمی اداری (محرمانه)'],
    ['تاریخ تهیه', generatedAt || '—'],
    ['تهیه‌کننده', preparedBy || '—'],
    ['', ''],
    ['شناسه پرونده', caseRecord.id],
    ['نام سرپرست خانوار', isRedacted ? `خانوار تحت کد ${caseRecord.id}` : caseRecord.fullName || '—'],
    ['کدملی (ماسک‌شده)', isRedacted ? 'محرمانه / حذف‌شده در نسخه انتشار' : caseRecord.nationalIdMasked || '***'],
    ['شماره تماس', isRedacted ? 'محرمانه' : caseRecord.phone || '—'],
    ['کد هش یک‌طرفه (SHA-256)', `${caseRecord.nationalIdHash.slice(0, 20)}...`],
    ['مؤسسه متولی', getInstitutionLabel(caseRecord.owningInstitution)],
    ['مدل همکاری', caseRecord.collaborationModel === 'complementary_support' ? 'پوشش ترکیبی دو مؤسسه' : 'تک‌متولی'],
    ['بلوک جغرافیایی', caseRecord.blockName],
    ['نشانی محل سکونت', isRedacted ? caseRecord.blockName : caseRecord.address || caseRecord.blockName],
    ['تعداد اعضای خانوار', isRedacted ? '—' : caseRecord.householdSize ?? '—'],
    ['وضعیت سرپرست خانوار', caseRecord.headStatus || '—'],
    ['وضعیت مسکن', caseRecord.housingType || '—'],
    ['مرحله فعلی مدیریت مورد', STAGE_LABELS[caseRecord.stage]],
    ['وضعیت پوشش', getCoverageLabel(caseRecord.coverageStatus)],
    ['درجه فوریت', getTierLabel(caseRecord.urgencyTier)],
    ['مسیر مداخله', caseRecord.servicePath === 'livelihood_medical' ? 'معیشتی و درمانی' : 'توانمندسازی و اشتغال'],
    ['امتیاز کل نیازمندی (از ۱۰۰)', caseRecord.score.total],
    ['امتیاز ساختار خانوار (از ۳۰)', caseRecord.score.familyStructure],
    ['امتیاز مسکن (از ۲۵)', caseRecord.score.housing],
    ['امتیاز معیشت و درآمد (از ۲۵)', caseRecord.score.livelihood],
    ['امتیاز سلامت و درمان (از ۲۰)', caseRecord.score.health],
    ['تاریخ تشکیل پرونده', caseRecord.registeredAt],
    ['آخرین بروزرسانی', caseRecord.lastUpdatedAt],
    ['آخرین حمایت ثبت‌شده', `${caseRecord.lastSupportType} (${caseRecord.lastSupportDate})`],
    ['پیش‌بینی نیاز ۳ ماهه', caseRecord.needForecast3M ? `${caseRecord.needForecast3M.categoryLabel} (${caseRecord.needForecast3M.probabilityPct}٪)` : '—'],
    ['توضیحات سلامت', isRedacted ? 'خلاصه‌شده برای انتشار عمومی' : caseRecord.medicalNotes || '—'],
    ['یادداشت مددکار', isRedacted ? 'خلاصه‌شده برای انتشار عمومی' : caseRecord.caseWorkerNote || '—'],
  ];
  const wsProfile = XLSX.utils.aoa_to_sheet(profileRows);
  applyRtlAndColumnWidths(wsProfile, profileRows, 24, 52);
  XLSX.utils.book_append_sheet(wb, wsProfile, 'مشخصات و امتیازدهی');

  // Sheet 2: 6-Stage Summary & Goals
  const stageRows: Array<Array<string | number>> = [
    ['مرحله', 'وضعیت و خلاصه ثبت‌شده', 'تاریخ تکمیل / اقدام'],
    [
      '۱. پذیرش و ارجاع',
      wf ? `${wf.stage1Intake.referralSource} · ${wf.stage1Intake.intakeSummary}` : 'ثبت اولیه انجام شده',
      wf?.stage1Intake.completedAt || caseRecord.registeredAt,
    ],
    [
      '۲. ارزیابی همه‌جانبه',
      wf ? `${wf.stage2Assessment.priorityNeeds.join('، ')} · ${wf.stage2Assessment.strengthsAndCapacities}` : 'ارزیابی ۱۰۰ امتیازی',
      wf?.stage2Assessment.completedAt || 'در حال انجام',
    ],
    [
      '۳. برنامه مداخله',
      wf ? `${wf.stage3Plan.assignedServicePackage} · ${wf.stage3Plan.partnerCoordinationTask}` : 'تدوین بسته مداخله',
      wf?.stage3Plan.completedAt || 'در انتظار',
    ],
    [
      '۴. اجرا و خدمات',
      wf ? `${wf.stage4Execution.shgConnected ? `متصل به ${wf.stage4Execution.shgGroupName}` : 'ارائه خدمات مستقیم'} · ${wf.stage4Execution.deliveredServices.length} خدمت ثبت‌شده` : caseRecord.lastSupportType,
      wf?.stage4Execution.completedAt || 'در انتظار',
    ],
    [
      '۵. پایش مستمر',
      wf ? `ثبات ${wf.stage5Monitoring.stabilityMonthsCount} ماه · ${wf.stage5Monitoring.visits.length} بازدید پایش` : 'در انتظار پایش',
      wf?.stage5Monitoring.completedAt || 'در انتظار',
    ],
    [
      '۶. خروج موفق',
      wf?.stage6Graduation.stableIncomeVerified
        ? `گواهی ${wf.stage6Graduation.graduationCertificateNo || 'صادرشده'} · درآمد پایدار تاییدشده`
        : 'در مسیر توانمندسازی',
      wf?.stage6Graduation.completedAt || '—',
    ],
    ['', '', ''],
    ['اهداف برنامه مداخله', 'مسئول پیگیری / تاریخ هدف', 'وضعیت'],
    ...(wf?.stage3Plan.goals.length
      ? wf.stage3Plan.goals.map((g) => [
          g.title,
          `${g.responsible} (${g.targetDate})`,
          g.status === 'achieved' ? 'محقق‌شده' : g.status === 'in_progress' ? 'در حال اجرا' : 'در انتظار',
        ])
      : [['هدف ثبت‌نشده', '—', '—']]),
  ];
  const wsStages = XLSX.utils.aoa_to_sheet(stageRows);
  applyRtlAndColumnWidths(wsStages, stageRows, 20, 56);
  XLSX.utils.book_append_sheet(wb, wsStages, 'مراحل و اهداف');

  // Sheet 3: Delivered Services & Monitoring Visits
  const servicesRows: Array<Array<string | number>> = [
    ['تاریخ و ساعت', 'نوع خدمت', 'عنوان خدمت', 'میزان / مبلغ', 'مؤسسه ارائه‌دهنده', 'توضیحات'],
    ...(wf?.stage4Execution.deliveredServices.length
      ? wf.stage4Execution.deliveredServices.map((s) => [
          s.dateTime,
          s.category,
          s.title,
          s.amountOrQuantity,
          getInstitutionLabel(s.providerInstitution),
          isRedacted ? 'ثبت‌شده در پرونده' : s.notes,
        ])
      : [[caseRecord.lastSupportDate, 'حمایت اصلی', caseRecord.lastSupportType, '۱ مورد', getInstitutionLabel(caseRecord.owningInstitution), '—']]),
    ['', '', '', '', '', ''],
    ['تاریخ بازدید پایش', 'برآورد درآمد ماهانه (تومان)', 'ثبات اشتغال', 'وضعیت تحصیلی', 'ارزیابی پیشرفت', 'ملاحظات'],
    ...(wf?.stage5Monitoring.visits.length
      ? wf.stage5Monitoring.visits.map((v) => [
          v.dateTime,
          v.monthlyEstimatedIncome,
          v.employmentStability,
          v.childEducationStatus,
          v.overallProgress,
          isRedacted ? 'ثبت‌شده در پایش' : v.notes,
        ])
      : [['بازدید پایش ثبت نشده است', '—', '—', '—', '—', '—']]),
  ];
  const wsServices = XLSX.utils.aoa_to_sheet(servicesRows);
  applyRtlAndColumnWidths(wsServices, servicesRows, 18, 42);
  XLSX.utils.book_append_sheet(wb, wsServices, 'خدمات و پایش');

  // Sheet 4: Timeline
  const historyRows: Array<Array<string | number>> = [
    ['تاریخ و ساعت', 'نوع رویداد', 'شرح اقدام', 'مؤسسه ثبت‌کننده', 'امتیاز', 'مرحله'],
    ...(caseRecord.history?.length
      ? caseRecord.history.map((h) => [
          h.timestamp,
          h.type,
          isRedacted ? `رویداد ثبت‌شده در مرحله ${h.stage ?? caseRecord.stage}` : h.summary,
          getInstitutionLabel(h.actorInstitution),
          h.scoreTotal ?? caseRecord.score.total,
          h.stage ? STAGE_LABELS[h.stage] : STAGE_LABELS[caseRecord.stage],
        ])
      : [[caseRecord.registeredAt, 'CREATED', 'تشکیل پرونده اولیه', getInstitutionLabel(caseRecord.owningInstitution), caseRecord.score.total, STAGE_LABELS[caseRecord.stage]]]),
  ];
  const wsHistory = XLSX.utils.aoa_to_sheet(historyRows);
  applyRtlAndColumnWidths(wsHistory, historyRows, 18, 52);
  XLSX.utils.book_append_sheet(wb, wsHistory, 'تاریخچه پرونده');

  const suffix = isRedacted ? 'publishable' : 'official';
  XLSX.writeFile(wb, `naysar-dossier-${caseRecord.id}-${suffix}.xlsx`);
}

export function exportReportsToCsv(params: {
  report: ReportsPayload;
  workers: CaseWorkerPerformanceItem[];
  scopeLabel: string;
}) {
  const {report, workers, scopeLabel} = params;
  let csvContent = '\uFEFF'; // UTF-8 BOM for Persian in Excel

  csvContent += `محدوده گزارش:, "${scopeLabel}"\n`;
  csvContent += `تاریخ تهیه:, "${new Date().toLocaleDateString('fa-IR')}"\n\n`;

  csvContent += `--- روند ۶ ماهه خوداتکایی و توزیع فوریت ---\n`;
  csvContent += `ماه,خوداتکای تجمعی,خروج موفق ماهانه,هم‌پوشانی پیشگیری‌شده,درجه قرمز (بحرانی),درجه زرد (مستمر),درجه سبز (توانمندسازی),میانگین زمان پاسخ (روز)\n`;
  for (const r of report.series) {
    csvContent += `"${r.monthLabel}",${r.graduatedCumulative},${r.graduatedNew},${r.overlapsPrevented},${r.redTier},${r.yellowTier},${r.greenTier},${r.avgResponseDays}\n`;
  }
  csvContent += `\n`;

  csvContent += `--- عملکرد مددکاران در ماه گذشته ---\n`;
  csvContent += `نام مددکار,سمت,مؤسسه,تعداد پرونده بررسی‌شده,هدف ماهانه,تعداد جابجایی مراحل,میانگین سرعت (روز),درصد پیگیری به‌موقع\n`;
  for (const w of workers) {
    csvContent += `"${w.name}","${w.roleTitle}","${w.institutionLabel}",${w.reviewedCasesCount},${w.currentMonthTargetCount},${w.stageTransitionsCount},${w.avgTransitionDays},${w.onTimeFollowUpPct}\n`;
  }
  csvContent += `\n`;

  csvContent += `--- توزیع درآمد خانوار ---\n`;
  csvContent += `بازه درآمدی,تعداد خانوار,درصد (٪),وضعیت خط معیشت\n`;
  for (const inc of report.incomeDistribution) {
    csvContent += `"${inc.bracketLabel}",${inc.count},${inc.percentage},"${inc.povertyLineStatus}"\n`;
  }

  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `naysar-charts-data-${report.institutionFilter}-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportAnonymizedCaseStatisticsCsv(params: {
  cases: CaseRecordView[];
  report?: ReportsPayload | null;
  scopeLabel: string;
}) {
  const {cases, report, scopeLabel} = params;
  let csvContent = '\uFEFF'; // UTF-8 BOM for Persian in Excel

  csvContent += `گزارش خودکار ماهانه آمار ناشناس‌شده پرونده‌ها (Anonymized Case Statistics)\n`;
  csvContent += `محدوده:, "${scopeLabel}"\n`;
  csvContent += `تاریخ تولید خودکار:, "${new Date().toLocaleDateString('fa-IR')}"\n\n`;

  if (report) {
    csvContent += `--- خلاصه شاخص‌های کلیدی ۶ ماهه ---\n`;
    csvContent += `ماه,خوداتکای تجمعی,خروج موفق ماهانه,هم‌پوشانی پیشگیری‌شده,درجه قرمز (بحرانی),درجه زرد (مستمر),درجه سبز (توانمندسازی)\n`;
    for (const r of report.series) {
      csvContent += `"${r.monthLabel}",${r.graduatedCumulative},${r.graduatedNew},${r.overlapsPrevented},${r.redTier},${r.yellowTier},${r.greenTier}\n`;
    }
    csvContent += `\n`;
  }

  csvContent += `--- فهرست آماری ناشناس‌شده پرونده‌های فعال ---\n`;
  csvContent += `شناسه پرونده (کد),کد هش امن (SHA-256),مؤسسه متولی,بلوک جغرافیایی,مرحله فعلی,وضعیت پوشش,درجه فوریت,امتیاز کل,مسیر مداخله\n`;
  for (const c of cases) {
    const maskedHash = `${c.nationalIdHash.slice(0, 12)}***`;
    const instLabel = c.owningInstitution === 'darolahsan' ? 'دارالاحسان' : 'عدالت و برابری';
    csvContent += `"${c.id}","${maskedHash}","${instLabel}","${c.blockName}","مرحله ${c.stage}","${c.coverageStatus}","${c.urgencyTier}",${c.score.total},"${c.servicePath}"\n`;
  }

  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `naysar-anonymized-stats-monthly-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


