import type {
  AssessmentFormDetails,
  AuditLogEntry,
  AuthUserSession,
  CaseManagementWorkflow,
  CaseRecordView,
  CaseStage,
  CaseTimelineEvent,
  CaseWorkerPerformanceItem,
  CollaborationModel,
  DashboardSummary,
  ForecastScenario,
  InquiryResponse,
  InstitutionId,
  MonthlyReportPoint,
  NaysarBlock,
  PredictedServiceCategory,
  ReportsPayload,
  ServicePath,
  ShgGroup,
  StageForecastItem,
  StageForecastPayload,
  StageTransitionCell,
  ThreeMonthNeedForecast,
  UrgencyTier,
  UserRole,
  WelfareScoreBreakdown,
} from '../types';

const SHARED_SECRET_SALT = 'DarolAhsan_Adalat_Secure_Salt_Key_1405';
const STORAGE_STATE_KEY = 'naysar_static_api_state_v1';

interface InternalCaseRecord {
  id: string;
  nationalIdHash: string;
  owningInstitution: InstitutionId;
  blockId: string;
  coverageStatus: 'ACTIVE' | 'SUSPENDED_OVERLAP' | 'GRADUATED';
  urgencyTier: UrgencyTier;
  stage: CaseStage;
  servicePath: ServicePath;
  collaborationModel: CollaborationModel;
  secondaryInstitution?: InstitutionId;
  lastSupportDate: string;
  lastSupportType: string;
  registeredAt: string;
  lastUpdatedAt: string;
  stageEnteredAt: string;
  stageEnteredDate: string;
  score: WelfareScoreBreakdown;
  consentSigned: boolean;
  nationalId: string;
  fullName: string;
  phone: string;
  address: string;
  householdSize: number;
  headStatus: string;
  housingType: string;
  medicalNotes: string;
  caseWorkerNote: string;
  assessmentDetails: AssessmentFormDetails;
  history: CaseTimelineEvent[];
  workflow?: CaseManagementWorkflow;
}

interface StaticStoreState {
  blocks: NaysarBlock[];
  cases: InternalCaseRecord[];
  auditLogs: AuditLogEntry[];
  shgGroups: ShgGroup[];
  overlapsPreventedCount: number;
  workerLiveDeltas: Record<InstitutionId, {reviewedDelta: number; transitionDelta: number}>;
}

// Pure-JS SHA-256 fallback for environments where crypto.subtle is unavailable (e.g., insecure HTTP)
function pureSha256Hex(ascii: string): string {
  const bytes = new TextEncoder().encode(ascii);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const rotr = (n: number, x: number) => (x >>> n) | (x << (32 - n));

  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000) >>> 0, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }
  return H.map((x) => x.toString(16).padStart(8, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    try {
      const data = new TextEncoder().encode(value);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return pureSha256Hex(value);
    }
  }
  return pureSha256Hex(value);
}

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizeDigits(input: string): string {
  return toAsciiDigits(input).trim().replace(/\D/g, '');
}

function normalizeSearchText(input: string): string {
  return toAsciiDigits(input)
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function maskNationalId(nationalId: string): string {
  const clean = normalizeDigits(nationalId);
  if (clean.length < 7) return '***';
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}

function hashNationalIdSync(nationalId: string): string {
  const cleanId = normalizeDigits(nationalId);
  return pureSha256Hex(`${cleanId}${SHARED_SECRET_SALT}`);
}

function getInstitutionName(id: InstitutionId): string {
  return id === 'darolahsan'
    ? 'مؤسسه خیریه دارالاحسان سنندج'
    : 'مؤسسه خیریه عدالت و برابری کردستان';
}

function calculateTier(total: number): UrgencyTier {
  if (total >= 70) return 'red';
  if (total >= 40) return 'yellow';
  return 'green';
}

function formatPersianDateOnly(dateObj: Date = new Date()): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);
}

function formatPersianTimestamp(dateObj: Date = new Date()): string {
  const datePart = formatPersianDateOnly(dateObj);
  const timePart = new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dateObj);
  return `${datePart} · ${timePart}`;
}

function buildVisitTimestamp(visitDate?: string, visitTime?: string): {
  dateOnly: string;
  fullTimestamp: string;
} {
  const cleanDate = visitDate?.trim();
  const cleanTime = visitTime?.trim();
  if (cleanDate && cleanTime) {
    return {dateOnly: cleanDate, fullTimestamp: `${cleanDate} · ${cleanTime}`};
  }
  if (cleanDate) {
    const timePart = new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    return {dateOnly: cleanDate, fullTimestamp: `${cleanDate} · ${timePart}`};
  }
  const now = new Date();
  return {dateOnly: formatPersianDateOnly(now), fullTimestamp: formatPersianTimestamp(now)};
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const caseWorkerMonthlySeed: CaseWorkerPerformanceItem[] = [
  {
    id: 'cw-dar-1',
    name: 'سهیلا محمدی',
    roleTitle: 'مددکار ارشد معیشت و توانمندسازی',
    institution: 'darolahsan',
    institutionLabel: 'دارالاحسان سنندج',
    blockCoverage: 'بلوک ۱ و ۳ (نایسر مرکزی)',
    reviewedCasesCount: 34,
    currentMonthReviewedCount: 27,
    currentMonthTargetCount: 32,
    stageTransitionsCount: 28,
    avgTransitionDays: 6.8,
    onTimeFollowUpPct: 94,
    recordSpeedScore: 92,
    assessmentAccuracyScore: 95,
    onTimeFollowUpScore: 94,
    conflictResolutionScore: 90,
    documentationQualityScore: 96,
    currentWeekCompletedCount: 8,
    currentWeekTargetCount: 8,
    stageDurations: {stage1: 2.1, stage2: 5.4, stage3: 7.2, stage4: 12.0, stage5: 38.5, stage6: 6.2},
  },
  {
    id: 'cw-dar-2',
    name: 'مهناز رحیمی',
    roleTitle: 'مددکار میدانی پذیرش و خانواده',
    institution: 'darolahsan',
    institutionLabel: 'دارالاحسان سنندج',
    blockCoverage: 'بلوک ۱ و ۵ (محدوده مشترک)',
    reviewedCasesCount: 29,
    currentMonthReviewedCount: 23,
    currentMonthTargetCount: 28,
    stageTransitionsCount: 22,
    avgTransitionDays: 8.1,
    onTimeFollowUpPct: 89,
    recordSpeedScore: 88,
    assessmentAccuracyScore: 91,
    onTimeFollowUpScore: 89,
    conflictResolutionScore: 88,
    documentationQualityScore: 90,
    currentWeekCompletedCount: 6,
    currentWeekTargetCount: 7,
    stageDurations: {stage1: 3.2, stage2: 6.8, stage3: 8.9, stage4: 15.2, stage5: 42.0, stage6: 8.0},
  },
  {
    id: 'cw-dar-3',
    name: 'کیوان فاتحی',
    roleTitle: 'مددکار پیگیری اشتغال و صندوق خرد',
    institution: 'darolahsan',
    institutionLabel: 'دارالاحسان سنندج',
    blockCoverage: 'بلوک ۳ (کوچه بهار و مسجد جامع)',
    reviewedCasesCount: 21,
    currentMonthReviewedCount: 18,
    currentMonthTargetCount: 24,
    stageTransitionsCount: 19,
    avgTransitionDays: 5.9,
    onTimeFollowUpPct: 96,
    recordSpeedScore: 95,
    assessmentAccuracyScore: 90,
    onTimeFollowUpScore: 96,
    conflictResolutionScore: 92,
    documentationQualityScore: 94,
    currentWeekCompletedCount: 5,
    currentWeekTargetCount: 6,
    stageDurations: {stage1: 1.8, stage2: 4.5, stage3: 6.0, stage4: 10.5, stage5: 35.0, stage6: 5.5},
  },
  {
    id: 'cw-eda-1',
    name: 'آرش کریمی',
    roleTitle: 'مددکار ارشد پرونده‌های درمانی و حمایتی',
    institution: 'edalat',
    institutionLabel: 'عدالت و برابری',
    blockCoverage: 'بلوک ۲ و ۵ (تپه نایسر)',
    reviewedCasesCount: 31,
    currentMonthReviewedCount: 25,
    currentMonthTargetCount: 30,
    stageTransitionsCount: 25,
    avgTransitionDays: 7.4,
    onTimeFollowUpPct: 91,
    recordSpeedScore: 90,
    assessmentAccuracyScore: 93,
    onTimeFollowUpScore: 91,
    conflictResolutionScore: 95,
    documentationQualityScore: 92,
    currentWeekCompletedCount: 7,
    currentWeekTargetCount: 8,
    stageDurations: {stage1: 2.5, stage2: 6.0, stage3: 7.8, stage4: 13.5, stage5: 40.0, stage6: 7.1},
  },
  {
    id: 'cw-eda-2',
    name: 'روژین صالحی',
    roleTitle: 'مددکار توانمندسازی بانوان و آموزش',
    institution: 'edalat',
    institutionLabel: 'عدالت و برابری',
    blockCoverage: 'بلوک ۴ (شهرک پایین نایسر)',
    reviewedCasesCount: 26,
    currentMonthReviewedCount: 21,
    currentMonthTargetCount: 26,
    stageTransitionsCount: 24,
    avgTransitionDays: 6.2,
    onTimeFollowUpPct: 93,
    recordSpeedScore: 93,
    assessmentAccuracyScore: 94,
    onTimeFollowUpScore: 93,
    conflictResolutionScore: 91,
    documentationQualityScore: 95,
    currentWeekCompletedCount: 6,
    currentWeekTargetCount: 7,
    stageDurations: {stage1: 2.0, stage2: 4.8, stage3: 6.5, stage4: 11.2, stage5: 36.5, stage6: 5.8},
  },
  {
    id: 'cw-eda-3',
    name: 'فریدون مرادی',
    roleTitle: 'مددکار ارزیابی مسکن و بحران',
    institution: 'edalat',
    institutionLabel: 'عدالت و برابری',
    blockCoverage: 'بلوک ۲ و ۴ (حاشیه شرقی)',
    reviewedCasesCount: 19,
    currentMonthReviewedCount: 14,
    currentMonthTargetCount: 22,
    stageTransitionsCount: 14,
    avgTransitionDays: 10.6,
    onTimeFollowUpPct: 82,
    recordSpeedScore: 78,
    assessmentAccuracyScore: 85,
    onTimeFollowUpScore: 82,
    conflictResolutionScore: 80,
    documentationQualityScore: 84,
    currentWeekCompletedCount: 4,
    currentWeekTargetCount: 6,
    stageDurations: {stage1: 4.1, stage2: 8.5, stage3: 11.0, stage4: 18.0, stage5: 52.0, stage6: 10.5},
  },
];

function createDefaultStoreState(): StaticStoreState {
  const blocks: NaysarBlock[] = [
    {
      id: 'blk-1',
      name: 'بلوک ۱ (نایسر مرکزی و خیابان اصلی)',
      zoneLabel: 'فاز یک پایلوت',
      leadInstitution: 'darolahsan',
      isPilotZone: true,
      householdCount: 420,
      activeCasesCount: 48,
    },
    {
      id: 'blk-2',
      name: 'بلوک ۲ (تپه نایسر و حاشیه شرقی)',
      zoneLabel: 'فاز دو پایلوت',
      leadInstitution: 'edalat',
      isPilotZone: true,
      householdCount: 385,
      activeCasesCount: 41,
    },
    {
      id: 'blk-3',
      name: 'بلوک ۳ (محله مسجد جامع و کوچه بهار)',
      zoneLabel: 'ناحیه شمالی',
      leadInstitution: 'darolahsan',
      isPilotZone: false,
      householdCount: 310,
      activeCasesCount: 29,
    },
    {
      id: 'blk-4',
      name: 'بلوک ۴ (شهرک پایین نایسر)',
      zoneLabel: 'ناحیه جنوبی',
      leadInstitution: 'edalat',
      isPilotZone: false,
      householdCount: 350,
      activeCasesCount: 34,
    },
    {
      id: 'blk-5',
      name: 'بلوک ۵ (محدوده مشترک کمربندی)',
      zoneLabel: 'منطقه هم‌پوشانی مشترک',
      leadInstitution: 'joint_pilot',
      isPilotZone: true,
      householdCount: 260,
      activeCasesCount: 23,
    },
  ];

  const cases: InternalCaseRecord[] = [
    {
      id: 'NY-1405-101',
      nationalId: '0012345678',
      nationalIdHash: hashNationalIdSync('0012345678'),
      owningInstitution: 'edalat',
      blockId: 'blk-2',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'red',
      stage: 4,
      servicePath: 'livelihood_medical',
      collaborationModel: 'complementary_support',
      secondaryInstitution: 'darolahsan',
      lastSupportDate: '۱۴۰۵/۰۸/۱۲ · ۱۱:۲۰',
      lastSupportType: 'سبد معیشتی و کمک هزینه دارویی',
      registeredAt: '۱۴۰۵/۰۷/۰۴ · ۰۹:۴۵',
      lastUpdatedAt: '۱۴۰۵/۰۸/۱۲ · ۱۱:۲۰',
      stageEnteredAt: daysAgoIso(36),
      stageEnteredDate: '۱۴۰۵/۰۷/۱۷',
      score: {familyStructure: 26, housing: 22, livelihood: 23, health: 17, total: 88},
      consentSigned: true,
      fullName: 'شیرین محمدی',
      phone: '0918-***-4412',
      address: 'نایسر، بلوک ۲، کوچه گلستان ۴، پلاک ۱۲',
      householdSize: 5,
      headStatus: 'زن سرپرست خانوار',
      housingType: 'استیجاری با اجاره سنگین',
      medicalNotes: 'بیماری مزمن تنفسی سرپرست، نیاز مستمر به دارو و بیمه درمان',
      caseWorkerNote: 'پوشش ترکیبی با دارالاحسان برای تامین لوازم‌التحریر ۳ دانش‌آموز.',
      assessmentDetails: {
        studentsCount: 3,
        dependentsCount: 1,
        lacksUtilities: true,
        incomeSourcePoints: 18,
        hasUnemployedWorker: true,
        hasChronicDisease: true,
        childNutritionRisk: true,
        skillInterest: 'خیاطی و تعمیرات لباس خانگی',
      },
      history: [
        {
          id: 'EVT-101-2',
          timestamp: '۱۴۰۵/۰۸/۱۲ · ۱۱:۲۰',
          type: 'REASSESSED',
          summary: 'ثبت سبد معیشتی و کمک‌هزینه دارویی با پوشش ترکیبی دو مؤسسه',
          actorInstitution: 'edalat',
          scoreTotal: 88,
          stage: 4,
        },
        {
          id: 'EVT-101-1',
          timestamp: '۱۴۰۵/۰۷/۰۴ · ۰۹:۴۵',
          type: 'CREATED',
          summary: 'تشکیل پرونده اولیه با رضایت‌نامه آگاهانه و ارزیابی ۱۰۰ امتیازی',
          actorInstitution: 'edalat',
          scoreTotal: 88,
          stage: 2,
        },
      ],
    },
    {
      id: 'NY-1405-102',
      nationalId: '3732104589',
      nationalIdHash: hashNationalIdSync('3732104589'),
      owningInstitution: 'darolahsan',
      blockId: 'blk-1',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'yellow',
      stage: 3,
      servicePath: 'empowerment_employment',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۵/۰۲ · ۱۰:۱۵',
      lastSupportType: 'تدوین برنامه تجهیز کارگاه خیاطی خانگی',
      registeredAt: '۱۴۰۵/۰۴/۱۸ · ۱۰:۰۰',
      lastUpdatedAt: '۱۴۰۵/۰۵/۰۲ · ۱۰:۱۵',
      stageEnteredAt: daysAgoIso(114),
      stageEnteredDate: '۱۴۰۵/۰۴/۳۰',
      score: {familyStructure: 20, housing: 15, livelihood: 18, health: 8, total: 61},
      consentSigned: true,
      fullName: 'فرشته کریمی',
      phone: '0918-***-8821',
      address: 'نایسر، بلوک ۱، خیابان اصلی، کوچه سوم',
      householdSize: 4,
      headStatus: 'زن سرپرست خانوار',
      housingType: 'استیجاری با اجاره سنگین',
      medicalNotes: 'وضعیت سلامت عمومی مناسب، بدون بیمار خاص',
      caseWorkerNote: 'معرفی شده به صندوق خودیاری همت نایسر برای دریافت چرخ خیاطی راسته؛ در انتظار نوبت تسهیلات.',
      assessmentDetails: {
        studentsCount: 2,
        dependentsCount: 0,
        lacksUtilities: false,
        incomeSourcePoints: 14,
        hasUnemployedWorker: true,
        hasChronicDisease: false,
        childNutritionRisk: false,
        skillInterest: 'خیاطی و دوخت لباس محلی',
      },
      history: [
        {
          id: 'EVT-102-2',
          timestamp: '۱۴۰۵/۰۵/۰۲ · ۱۰:۱۵',
          type: 'STAGE_CHANGED',
          summary: 'تدوین برنامه تجهیز کارگاه خیاطی و معرفی به صندوق همت نایسر',
          actorInstitution: 'darolahsan',
          scoreTotal: 61,
          stage: 3,
        },
        {
          id: 'EVT-102-1',
          timestamp: '۱۴۰۵/۰۴/۱۸ · ۱۰:۰۰',
          type: 'CREATED',
          summary: 'تشکیل پرونده اولیه و ثبت در رجیستری مشترک',
          actorInstitution: 'darolahsan',
          scoreTotal: 64,
          stage: 2,
        },
      ],
    },
    {
      id: 'NY-1405-103',
      nationalId: '3735551290',
      nationalIdHash: hashNationalIdSync('3735551290'),
      owningInstitution: 'darolahsan',
      blockId: 'blk-3',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'red',
      stage: 2,
      servicePath: 'livelihood_medical',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۸/۱۹ · ۱۱:۰۵',
      lastSupportType: 'ارزیابی فوری و سبد اضطراری',
      registeredAt: '۱۴۰۵/۰۸/۱۹ · ۱۱:۰۵',
      lastUpdatedAt: '۱۴۰۵/۰۸/۱۹ · ۱۱:۰۵',
      stageEnteredAt: daysAgoIso(12),
      stageEnteredDate: '۱۴۰۵/۰۸/۱۱',
      score: {familyStructure: 24, housing: 23, livelihood: 22, health: 16, total: 85},
      consentSigned: true,
      fullName: 'سلیمان مرادی',
      phone: '0936-***-1104',
      address: 'نایسر، بلوک ۳، کوچه بهار ۷',
      householdSize: 6,
      headStatus: 'سرپرست ازکارافتاده / بیمار صعب‌العلاج',
      housingType: 'سکونتگاه غیررسمی / حاشیه‌ای',
      medicalNotes: 'نیازمند فیزیوتراپی مستمر و تامین هزینه دارو',
      caseWorkerNote: 'در صف تایید صندوق درمان مشترک دو مؤسسه.',
      assessmentDetails: {
        studentsCount: 2,
        dependentsCount: 1,
        lacksUtilities: true,
        incomeSourcePoints: 18,
        hasUnemployedWorker: true,
        hasChronicDisease: true,
        childNutritionRisk: false,
        skillInterest: 'بسته‌بندی و صنایع دستی خانگی توسط همسر',
      },
      history: [
        {
          id: 'EVT-103-1',
          timestamp: '۱۴۰۵/۰۸/۱۹ · ۱۱:۰۵',
          type: 'CREATED',
          summary: 'ثبت پرونده جدید با رضایت‌نامه آگاهانه و ارزیابی فوری معیشتی',
          actorInstitution: 'darolahsan',
          scoreTotal: 85,
          stage: 2,
        },
      ],
    },
    {
      id: 'NY-1405-104',
      nationalId: '3738890123',
      nationalIdHash: hashNationalIdSync('3738890123'),
      owningInstitution: 'edalat',
      blockId: 'blk-4',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'yellow',
      stage: 5,
      servicePath: 'empowerment_employment',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۵/۱۵ · ۱۵:۱۰',
      lastSupportType: 'پایش کسب‌وکار بسته‌بندی حبوبات',
      registeredAt: '۱۴۰۵/۰۴/۱۱ · ۱۲:۳۰',
      lastUpdatedAt: '۱۴۰۵/۰۵/۱۵ · ۱۵:۱۰',
      stageEnteredAt: daysAgoIso(102),
      stageEnteredDate: '۱۴۰۵/۰۵/۱۲',
      score: {familyStructure: 18, housing: 14, livelihood: 16, health: 6, total: 54},
      consentSigned: true,
      fullName: 'مریم قادری',
      phone: '0918-***-6730',
      address: 'نایسر، بلوک ۴، شهرک پایین، کوچه نیلوفر',
      householdSize: 3,
      headStatus: 'زن سرپرست خانوار',
      housingType: 'رهن یا مسکن مهر',
      medicalNotes: 'بدون مشکل خاص درمانی',
      caseWorkerNote: 'فروش ماهانه رو به رشد از طریق بازارچه محلی؛ آماده ارزیابی نهایی خروج موفق.',
      assessmentDetails: {
        studentsCount: 1,
        dependentsCount: 0,
        lacksUtilities: false,
        incomeSourcePoints: 10,
        hasUnemployedWorker: true,
        hasChronicDisease: false,
        childNutritionRisk: false,
        skillInterest: 'بسته‌بندی حبوبات و محصولات ارگانیک',
      },
      history: [
        {
          id: 'EVT-104-2',
          timestamp: '۱۴۰۵/۰۵/۱۵ · ۱۵:۱۰',
          type: 'REASSESSED',
          summary: 'پایش درآمد ماهانه کسب‌وکار بسته‌بندی و کاهش امتیاز نیازمندی از ۶۶ به ۵۴',
          actorInstitution: 'edalat',
          scoreTotal: 54,
          stage: 5,
        },
        {
          id: 'EVT-104-1',
          timestamp: '۱۴۰۵/۰۴/۱۱ · ۱۲:۳۰',
          type: 'CREATED',
          summary: 'تشکیل پرونده اولیه و معرفی به کارگاه مهارت‌آموزی',
          actorInstitution: 'edalat',
          scoreTotal: 66,
          stage: 2,
        },
      ],
    },
    {
      id: 'NY-1405-105',
      nationalId: '3734419902',
      nationalIdHash: hashNationalIdSync('3734419902'),
      owningInstitution: 'darolahsan',
      blockId: 'blk-5',
      coverageStatus: 'GRADUATED',
      urgencyTier: 'green',
      stage: 6,
      servicePath: 'empowerment_employment',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۸/۰۵ · ۰۹:۳۰',
      lastSupportType: 'آیین تکریم و صدور لوح خوداتکایی',
      registeredAt: '۱۴۰۴/۰۶/۱۵ · ۱۱:۰۰',
      lastUpdatedAt: '۱۴۰۵/۰۸/۰۵ · ۰۹:۳۰',
      stageEnteredAt: daysAgoIso(18),
      stageEnteredDate: '۱۴۰۵/۰۸/۰۵',
      score: {familyStructure: 10, housing: 9, livelihood: 10, health: 4, total: 33},
      consentSigned: true,
      fullName: 'نرگس احمدی',
      phone: '0918-***-3091',
      address: 'نایسر، بلوک ۵، محدوده کمربندی',
      householdSize: 3,
      headStatus: 'عادی',
      housingType: 'ملکی',
      medicalNotes: 'پوشش بیمه سلامت برقرار است',
      caseWorkerNote: 'پس از ۶ ماه ثبات درآمد از کارگاه ترشیجات خانگی، با لوح تقدیر به جمع همیاران محله پیوست.',
      assessmentDetails: {
        studentsCount: 1,
        dependentsCount: 0,
        lacksUtilities: false,
        incomeSourcePoints: 5,
        hasUnemployedWorker: false,
        hasChronicDisease: false,
        childNutritionRisk: false,
        skillInterest: 'تولید ترشیجات و سبزی خشک خانگی',
      },
      history: [
        {
          id: 'EVT-105-2',
          timestamp: '۱۴۰۵/۰۸/۰۵ · ۰۹:۳۰',
          type: 'STAGE_CHANGED',
          summary: 'تکمیل ۶ ماه ثبات درآمد و خروج موفق از چرخه حمایت',
          actorInstitution: 'darolahsan',
          scoreTotal: 33,
          stage: 6,
        },
      ],
    },
    {
      id: 'NY-1405-106',
      nationalId: '3736621044',
      nationalIdHash: hashNationalIdSync('3736621044'),
      owningInstitution: 'edalat',
      blockId: 'blk-5',
      coverageStatus: 'SUSPENDED_OVERLAP',
      urgencyTier: 'yellow',
      stage: 1,
      servicePath: 'empowerment_employment',
      collaborationModel: 'complementary_support',
      secondaryInstitution: 'darolahsan',
      lastSupportDate: '۱۴۰۵/۰۸/۲۱ · ۱۶:۴۰',
      lastSupportType: 'تعلیق موقت جهت تعیین مؤسسه مسئول',
      registeredAt: '۱۴۰۵/۰۸/۲۱ · ۱۶:۴۰',
      lastUpdatedAt: '۱۴۰۵/۰۸/۲۱ · ۱۶:۴۰',
      stageEnteredAt: daysAgoIso(5),
      stageEnteredDate: '۱۴۰۵/۰۸/۱۸',
      score: {familyStructure: 19, housing: 16, livelihood: 18, health: 10, total: 63},
      consentSigned: true,
      fullName: 'پروین رضایی',
      phone: '0918-***-9520',
      address: 'نایسر، بلوک ۵، کوچه شاهد ۲',
      householdSize: 4,
      headStatus: 'عادی',
      housingType: 'استیجاری با اجاره سنگین',
      medicalNotes: 'داروهای فصلی کودکان',
      caseWorkerNote: 'ثبت‌نام هم‌زمان در دو مؤسسه شناسایی شد؛ در انتظار نهایی‌سازی پروتکل ارجاع متقابل.',
      assessmentDetails: {
        studentsCount: 2,
        dependentsCount: 1,
        lacksUtilities: false,
        incomeSourcePoints: 14,
        hasUnemployedWorker: true,
        hasChronicDisease: false,
        childNutritionRisk: true,
        skillInterest: 'تایپ و خدمات اینترنتی خانگی',
      },
      history: [
        {
          id: 'EVT-106-1',
          timestamp: '۱۴۰۵/۰۸/۲۱ · ۱۶:۴۰',
          type: 'OVERLAP_RESOLVED',
          summary: 'شناسایی ثبت‌نام موازی و فعال‌سازی پروتکل ارجاع متقابل',
          actorInstitution: 'edalat',
          scoreTotal: 63,
          stage: 1,
        },
      ],
    },
    {
      id: 'NY-1405-107',
      nationalId: '3731188990',
      nationalIdHash: hashNationalIdSync('3731188990'),
      owningInstitution: 'darolahsan',
      blockId: 'blk-3',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'red',
      stage: 2,
      servicePath: 'livelihood_medical',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۴/۱۳ · ۱۴:۰۰',
      lastSupportType: 'ثبت ارزیابی اولیه معیشتی',
      registeredAt: '۱۴۰۵/۰۴/۱۲ · ۱۰:۳۵',
      lastUpdatedAt: '۱۴۰۵/۰۴/۱۳ · ۱۴:۰۰',
      stageEnteredAt: daysAgoIso(132),
      stageEnteredDate: '۱۴۰۵/۰۴/۱۲',
      score: {familyStructure: 25, housing: 20, livelihood: 21, health: 16, total: 82},
      consentSigned: true,
      fullName: 'کامران فرهادی',
      phone: '0918-***-5107',
      address: 'نایسر، بلوک ۳، کوچه گلبرگ ۲',
      householdSize: 5,
      headStatus: 'سرپرست ازکارافتاده / بیمار صعب‌العلاج',
      housingType: 'استیجاری با اجاره سنگین',
      medicalNotes: 'بیماری کلیوی مزمن؛ نیازمند تدوین فوری نقشه راه درمانی و سبد معیشتی',
      caseWorkerNote: 'بیش از ۴ ماه در مرحله ارزیابی همه‌جانبه متوقف مانده و نیاز به تدوین برنامه مداخله دارد.',
      assessmentDetails: {
        studentsCount: 2,
        dependentsCount: 1,
        lacksUtilities: true,
        incomeSourcePoints: 18,
        hasUnemployedWorker: false,
        hasChronicDisease: true,
        childNutritionRisk: false,
        skillInterest: 'مشاغل کم‌تحرک خانگی برای اعضای خانواده',
      },
      history: [
        {
          id: 'EVT-107-1',
          timestamp: '۱۴۰۵/۰۴/۱۲ · ۱۰:۳۵',
          type: 'CREATED',
          summary: 'ثبت ارزیابی اولیه و قرارگیری در صف برنامه مداخله درمانی',
          actorInstitution: 'darolahsan',
          scoreTotal: 82,
          stage: 2,
        },
      ],
    },
    {
      id: 'NY-1405-108',
      nationalId: '3739944112',
      nationalIdHash: hashNationalIdSync('3739944112'),
      owningInstitution: 'edalat',
      blockId: 'blk-2',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'yellow',
      stage: 3,
      servicePath: 'empowerment_employment',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۵/۲۰ · ۱۲:۴۵',
      lastSupportType: 'مشاوره اولیه اشتغال خانگی',
      registeredAt: '۱۴۰۵/۰۵/۱۰ · ۰۹:۱۵',
      lastUpdatedAt: '۱۴۰۵/۰۵/۲۰ · ۱۲:۴۵',
      stageEnteredAt: daysAgoIso(96),
      stageEnteredDate: '۱۴۰۵/۰۵/۱۸',
      score: {familyStructure: 17, housing: 15, livelihood: 19, health: 7, total: 58},
      consentSigned: true,
      fullName: 'زهرا ویسی',
      phone: '0918-***-2298',
      address: 'نایسر، بلوک ۲، خیابان تپه شرقی',
      householdSize: 4,
      headStatus: 'زن سرپرست خانوار',
      housingType: 'استیجاری با اجاره سنگین',
      medicalNotes: 'بدون مشکل خاص درمانی',
      caseWorkerNote: 'در انتظار تخصیص سرمایه اولیه برای کارگاه بسته‌بندی سبزیجات خشک.',
      assessmentDetails: {
        studentsCount: 1,
        dependentsCount: 0,
        lacksUtilities: false,
        incomeSourcePoints: 14,
        hasUnemployedWorker: true,
        hasChronicDisease: false,
        childNutritionRisk: false,
        skillInterest: 'بسته‌بندی سبزیجات خشک و نان سنتی',
      },
      history: [
        {
          id: 'EVT-108-1',
          timestamp: '۱۴۰۵/۰۵/۲۰ · ۱۲:۴۵',
          type: 'STAGE_CHANGED',
          summary: 'مشاوره اولیه اشتغال خانگی و انتقال به مرحله برنامه مداخله',
          actorInstitution: 'edalat',
          scoreTotal: 58,
          stage: 3,
        },
      ],
    },
    {
      id: 'NY-1405-109',
      nationalId: '3737712345',
      nationalIdHash: hashNationalIdSync('3737712345'),
      owningInstitution: 'darolahsan',
      blockId: 'blk-1',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'green',
      stage: 5,
      servicePath: 'empowerment_employment',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۷/۲۴ · ۱۱:۱۰',
      lastSupportType: 'پایش ماهانه کارگاه خیاطی خانگی',
      registeredAt: '۱۴۰۵/۰۳/۱۸ · ۰۹:۲۰',
      lastUpdatedAt: '۱۴۰۵/۰۷/۲۴ · ۱۱:۱۰',
      stageEnteredAt: daysAgoIso(48),
      stageEnteredDate: '۱۴۰۵/۰۷/۰۵',
      score: {familyStructure: 16, housing: 12, livelihood: 13, health: 6, total: 47},
      consentSigned: true,
      fullName: 'لیلا شریفی',
      phone: '0918-***-7410',
      address: 'نایسر، بلوک ۱، خیابان اصلی، کوچه پنجم',
      householdSize: 3,
      headStatus: 'زن سرپرست خانوار',
      housingType: 'رهن یا مسکن مهر',
      medicalNotes: 'سلامت عمومی مطلوب و بیمه سلامت فعال',
      caseWorkerNote: 'تولید مانتو و سفارش‌های محلی منظم است؛ پایش ماه پنجم ثبات درآمد در برنامه فردا.',
      assessmentDetails: {
        studentsCount: 1,
        dependentsCount: 0,
        lacksUtilities: false,
        incomeSourcePoints: 8,
        hasUnemployedWorker: false,
        hasChronicDisease: false,
        childNutritionRisk: false,
        skillInterest: 'خیاطی و دوخت پوشاک زنانه',
      },
      history: [
        {
          id: 'EVT-109-1',
          timestamp: '۱۴۰۵/۰۷/۲۴ · ۱۱:۱۰',
          type: 'STAGE_CHANGED',
          summary: 'ثبت گزارش پایش ماه چهارم و برنامه‌ریزی سررسید پیگیری بعدی',
          actorInstitution: 'darolahsan',
          scoreTotal: 47,
          stage: 5,
        },
      ],
    },
    {
      id: 'NY-1405-110',
      nationalId: '3733349081',
      nationalIdHash: hashNationalIdSync('3733349081'),
      owningInstitution: 'darolahsan',
      blockId: 'blk-3',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'yellow',
      stage: 5,
      servicePath: 'empowerment_employment',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۷/۲۸ · ۱۴:۳۰',
      lastSupportType: 'پایش فروش محصولات کارگاه نجاری کوچک',
      registeredAt: '۱۴۰۵/۰۲/۱۲ · ۱۰:۱۰',
      lastUpdatedAt: '۱۴۰۵/۰۷/۲۸ · ۱۴:۳۰',
      stageEnteredAt: daysAgoIso(62),
      stageEnteredDate: '۱۴۰۵/۰۶/۲۱',
      score: {familyStructure: 18, housing: 15, livelihood: 14, health: 8, total: 55},
      consentSigned: true,
      fullName: 'حسن امینی',
      phone: '0918-***-3812',
      address: 'نایسر، بلوک ۳، محله مسجد جامع، کوچه یاس ۴',
      householdSize: 4,
      headStatus: 'عادی',
      housingType: 'استیجاری با اجاره سنگین',
      medicalNotes: 'پایش دوره‌ای کمر‌درد خفیف سرپرست',
      caseWorkerNote: 'نیاز به بررسی بازپرداخت قسط چهارم صندوق و قرارداد جدید تولید جعبه چوبی.',
      assessmentDetails: {
        studentsCount: 2,
        dependentsCount: 0,
        lacksUtilities: false,
        incomeSourcePoints: 10,
        hasUnemployedWorker: false,
        hasChronicDisease: false,
        childNutritionRisk: false,
        skillInterest: 'نجاری و تولید مصنوعات چوبی',
      },
      history: [
        {
          id: 'EVT-110-1',
          timestamp: '۱۴۰۵/۰۷/۲۸ · ۱۴:۳۰',
          type: 'REASSESSED',
          summary: 'بازدید میدانی ماه سوم پایش و ثبت قرارداد فروش محلی',
          actorInstitution: 'darolahsan',
          scoreTotal: 55,
          stage: 5,
        },
      ],
    },
    {
      id: 'NY-1405-111',
      nationalId: '3739087612',
      nationalIdHash: hashNationalIdSync('3739087612'),
      owningInstitution: 'edalat',
      blockId: 'blk-2',
      coverageStatus: 'ACTIVE',
      urgencyTier: 'yellow',
      stage: 5,
      servicePath: 'empowerment_employment',
      collaborationModel: 'single_ownership',
      lastSupportDate: '۱۴۰۵/۰۷/۲۰ · ۰۹:۴۵',
      lastSupportType: 'پایش تولید نان سنتی و شیرینی خانگی',
      registeredAt: '۱۴۰۵/۰۳/۰۸ · ۱۱:۰۰',
      lastUpdatedAt: '۱۴۰۵/۰۷/۲۰ · ۰۹:۴۵',
      stageEnteredAt: daysAgoIso(55),
      stageEnteredDate: '۱۴۰۵/۰۶/۲۸',
      score: {familyStructure: 19, housing: 14, livelihood: 15, health: 7, total: 55},
      consentSigned: true,
      fullName: 'سمیرا جلالی',
      phone: '0918-***-6024',
      address: 'نایسر، بلوک ۲، حاشیه شرقی، کوچه ارغوان',
      householdSize: 4,
      headStatus: 'زن سرپرست خانوار',
      housingType: 'استیجاری با اجاره سنگین',
      medicalNotes: 'نیاز به تمدید دفترچه بیمه تامین اجتماعی',
      caseWorkerNote: 'موعد پیگیری آبان‌ماه گذشته؛ بررسی فوری تداوم سفارش‌های نان سنتی ضروری است.',
      assessmentDetails: {
        studentsCount: 2,
        dependentsCount: 0,
        lacksUtilities: false,
        incomeSourcePoints: 11,
        hasUnemployedWorker: false,
        hasChronicDisease: false,
        childNutritionRisk: false,
        skillInterest: 'پخت نان محلی و شیرینی سنتی',
      },
      history: [
        {
          id: 'EVT-111-1',
          timestamp: '۱۴۰۵/۰۷/۲۰ · ۰۹:۴۵',
          type: 'REASSESSED',
          summary: 'ثبت گزارش پایش ماه سوم و برنامه‌ریزی بازدید بعدی',
          actorInstitution: 'edalat',
          scoreTotal: 55,
          stage: 5,
        },
      ],
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'AUD-9041',
      timestamp: '۱۴۰۵/۰۸/۲۲ · ۱۰:۱۴',
      actorRole: 'case_worker',
      actorInstitution: 'darolahsan',
      action: 'INQUIRY_HASH',
      nationalIdHashPrefix: hashNationalIdSync('0012345678').slice(0, 14),
      blockName: 'بلوک ۲ (تپه نایسر و حاشیه شرقی)',
      outcome: 'هشدار تطبیق: خانوار تحت پوشش عدالت و برابری ثبت شده است',
      immutable: true,
    },
    {
      id: 'AUD-9040',
      timestamp: '۱۴۰۵/۰۸/۲۱ · ۱۶:۴۰',
      actorRole: 'executive_manager',
      actorInstitution: 'edalat',
      action: 'OVERLAP_FLAGGED',
      nationalIdHashPrefix: hashNationalIdSync('3736621044').slice(0, 14),
      blockName: 'بلوک ۵ (محدوده مشترک کمربندی)',
      outcome: 'تعلیق موقت ثبت‌نام موازی و ارجاع به پروتکل مؤسسه مسئول',
      immutable: true,
    },
    {
      id: 'AUD-9039',
      timestamp: '۱۴۰۵/۰۸/۱۹ · ۱۱:۰۵',
      actorRole: 'case_worker',
      actorInstitution: 'darolahsan',
      action: 'CASE_CREATED',
      nationalIdHashPrefix: hashNationalIdSync('3735551290').slice(0, 14),
      blockName: 'بلوک ۳ (محله مسجد جامع و کوچه بهار)',
      outcome: 'ثبت پرونده جدید با رضایت‌نامه آگاهانه (امتیاز ۸۵ - قرمز)',
      immutable: true,
    },
    {
      id: 'AUD-9038',
      timestamp: '۱۴۰۵/۰۸/۰۵ · ۰۹:۳۰',
      actorRole: 'executive_manager',
      actorInstitution: 'darolahsan',
      action: 'STAGE_ADVANCED',
      nationalIdHashPrefix: hashNationalIdSync('3734419902').slice(0, 14),
      blockName: 'بلوک ۵ (محدوده مشترک کمربندی)',
      outcome: 'ارتقا به مرحله ۶ (خروج موفق و صدور لوح خوداتکایی)',
      immutable: true,
    },
  ];

  const shgGroups: ShgGroup[] = [
    {
      id: 'shg-1',
      name: 'صندوق خودیاری همت نایسر',
      blockName: 'بلوک ۱ (نایسر مرکزی)',
      sponsorInstitution: 'darolahsan',
      meetingDay: 'پنج‌شنبه اول هر ماه · ساعت ۱۰:۰۰',
      matchingRatio: '2:1',
      membersTotalSavings: 18500000,
      charityMatchingFund: 37000000,
      members: [
        {
          id: 'm-1',
          memberAlias: 'خانم ف. کریمی',
          roleInGroup: 'مدیر صندوق',
          monthlySaving: 500000,
          totalSaved: 4000000,
          activeLoanAmount: 15000000,
          repaidAmount: 9000000,
          businessType: 'خیاطی و تعمیرات لباس محلی',
          guarantors: ['خانم ن. احمدی', 'خانم س. رحیمی'],
          repaymentStatus: 'خوش‌حساب',
        },
        {
          id: 'm-2',
          memberAlias: 'خانم ن. احمدی',
          roleInGroup: 'منشی',
          monthlySaving: 500000,
          totalSaved: 5500000,
          activeLoanAmount: 12000000,
          repaidAmount: 12000000,
          businessType: 'تولید ترشیجات و سبزی خشک خانگی',
          guarantors: ['خانم ف. کریمی', 'خانم م. قادری'],
          repaymentStatus: 'خوش‌حساب',
        },
        {
          id: 'm-3',
          memberAlias: 'خانم س. رحیمی',
          roleInGroup: 'عضو',
          monthlySaving: 400000,
          totalSaved: 3200000,
          activeLoanAmount: 10000000,
          repaidAmount: 5500000,
          businessType: 'صنایع‌دستی و گلدوزی بومی کردستان',
          guarantors: ['خانم ف. کریمی', 'خانم ز. حسینی'],
          repaymentStatus: 'در جریان',
        },
        {
          id: 'm-4',
          memberAlias: 'خانم ز. حسینی',
          roleInGroup: 'عضو',
          monthlySaving: 400000,
          totalSaved: 2800000,
          activeLoanAmount: 8000000,
          repaidAmount: 3000000,
          businessType: 'مهدکودک خانگی و نگهداری کودک (همیار مادر)',
          guarantors: ['خانم ن. احمدی', 'خانم س. رحیمی'],
          repaymentStatus: 'در جریان',
        },
      ],
    },
    {
      id: 'shg-2',
      name: 'صندوق امید بانوان تپه نایسر',
      blockName: 'بلوک ۲ (تپه نایسر)',
      sponsorInstitution: 'edalat',
      meetingDay: 'دوشنبه اول هر ماه · ساعت ۱۱:۰۰',
      matchingRatio: '1:1',
      membersTotalSavings: 14200000,
      charityMatchingFund: 14200000,
      members: [
        {
          id: 'm-5',
          memberAlias: 'خانم م. قادری',
          roleInGroup: 'مدیر صندوق',
          monthlySaving: 450000,
          totalSaved: 4500000,
          activeLoanAmount: 14000000,
          repaidAmount: 10500000,
          businessType: 'پاک کردن و بسته‌بندی حبوبات ارگانیک',
          guarantors: ['خانم ه. ویسی', 'خانم پ. رضایی'],
          repaymentStatus: 'خوش‌حساب',
        },
        {
          id: 'm-6',
          memberAlias: 'خانم ه. ویسی',
          roleInGroup: 'منشی',
          monthlySaving: 350000,
          totalSaved: 3150000,
          activeLoanAmount: 9000000,
          repaidAmount: 4500000,
          businessType: 'پخت نان سنتی و شیرینی خانگی',
          guarantors: ['خانم م. قادری', 'خانم آ. رستمی'],
          repaymentStatus: 'در جریان',
        },
        {
          id: 'm-7',
          memberAlias: 'خانم آ. رستمی',
          roleInGroup: 'عضو',
          monthlySaving: 300000,
          totalSaved: 2400000,
          activeLoanAmount: 7500000,
          repaidAmount: 2000000,
          businessType: 'تایپ، ثبت‌نام اینترنتی و خدمات دیجیتال',
          guarantors: ['خانم م. قادری', 'خانم ه. ویسی'],
          repaymentStatus: 'نیاز به مشاوره',
        },
      ],
    },
  ];

  return {
    blocks,
    cases,
    auditLogs,
    shgGroups,
    overlapsPreventedCount: 19,
    workerLiveDeltas: {
      darolahsan: {reviewedDelta: 0, transitionDelta: 0},
      edalat: {reviewedDelta: 0, transitionDelta: 0},
    },
  };
}

let cachedState: StaticStoreState | null = null;

function loadState(): StaticStoreState {
  if (cachedState) return cachedState;
  try {
    const raw = localStorage.getItem(STORAGE_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StaticStoreState> | null;
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.blocks) &&
        Array.isArray(parsed.cases) &&
        Array.isArray(parsed.auditLogs) &&
        Array.isArray(parsed.shgGroups)
      ) {
        cachedState = {
          blocks: parsed.blocks,
          cases: parsed.cases,
          auditLogs: parsed.auditLogs,
          shgGroups: parsed.shgGroups,
          overlapsPreventedCount:
            typeof parsed.overlapsPreventedCount === 'number' ? parsed.overlapsPreventedCount : 19,
          workerLiveDeltas:
            parsed.workerLiveDeltas && typeof parsed.workerLiveDeltas === 'object'
              ? parsed.workerLiveDeltas
              : {darolahsan: {reviewedDelta: 0, transitionDelta: 0}, edalat: {reviewedDelta: 0, transitionDelta: 0}},
        };
        return cachedState;
      }
    }
  } catch {
    // ignore invalid persisted state
  }
  cachedState = createDefaultStoreState();
  return cachedState;
}

function saveState(state: StaticStoreState) {
  cachedState = state;
  try {
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

function recordWorkerActivity(
  state: StaticStoreState,
  institution: InstitutionId,
  kind: 'reviewed' | 'transition' | 'both',
) {
  if (kind === 'reviewed' || kind === 'both') {
    state.workerLiveDeltas[institution].reviewedDelta += 1;
  }
  if (kind === 'transition' || kind === 'both') {
    state.workerLiveDeltas[institution].transitionDelta += 1;
  }
}

function buildDefaultWorkflowForCase(record: InternalCaseRecord): CaseManagementWorkflow {
  const priorityNeeds: string[] = [];
  if (record.score.housing >= 16) priorityNeeds.push('حمایت اجاره‌بها و بهبود سرپناه');
  if (record.score.livelihood >= 16) priorityNeeds.push('تامین سبد معیشتی و تثبیت درآمد');
  if (record.score.health >= 12) priorityNeeds.push('پوشش دارویی و خدمات درمانی');
  if (record.assessmentDetails.studentsCount > 0) {
    priorityNeeds.push(`پشتیبانی تحصیلی ${record.assessmentDetails.studentsCount} دانش‌آموز`);
  }
  if (priorityNeeds.length === 0) priorityNeeds.push('پایش اشتغال و پس‌انداز خرد');

  const stage = record.stage;
  const isGraduated = record.coverageStatus === 'GRADUATED' || stage === 6;

  return {
    stage1Intake: {
      referralSource:
        record.collaborationModel === 'complementary_support'
          ? 'ارجاع متقابل بین دو مؤسسه'
          : 'شناسایی میدانی بلوک و مراجعه حضوری',
      intakeOfficer:
        record.owningInstitution === 'darolahsan'
          ? 'کارشناس پذیرش دارالاحسان'
          : 'کارشناس پذیرش عدالت و برابری',
      inquiryVerified: true,
      consentVerified: record.consentSigned,
      leadAgencyDecision: record.collaborationModel,
      intakeSummary: `ثبت اولیه پرونده در تاریخ ${record.registeredAt} با استعلام کد هش‌شده و تایید رضایت‌نامه آگاهانه.`,
      completedAt: stage >= 1 ? record.registeredAt : undefined,
    },
    stage2Assessment: {
      fieldVisitPerformed: stage >= 2,
      visitDateTime: record.registeredAt,
      priorityNeeds,
      strengthsAndCapacities:
        record.assessmentDetails.skillInterest && record.assessmentDetails.skillInterest !== 'نامشخص'
          ? `علاقه و آمادگی مهارتی در زمینه «${record.assessmentDetails.skillInterest}»`
          : 'همبستگی خانوادگی و آمادگی سرپرست برای مشارکت در برنامه توانمندسازی',
      assessmentSummary: `امتیاز کل ${record.score.total}/۱۰۰ (ساختار ${record.score.familyStructure}، مسکن ${record.score.housing}، معیشت ${record.score.livelihood}، سلامت ${record.score.health}). ${record.medicalNotes}`,
      completedAt: stage >= 2 ? record.registeredAt : undefined,
    },
    stage3Plan: {
      assignedServicePackage:
        record.servicePath === 'livelihood_medical'
          ? 'بسته حمایت معیشتی فوری + پوشش درمانی و دارویی'
          : 'بسته توانمندسازی شغلی، مهارت‌آموزی و اتصال به صندوق خودیاری',
      partnerCoordinationTask:
        record.collaborationModel === 'complementary_support'
          ? 'تامین مکمل لوازم‌التحریر یا صندوق درمان مشترک توسط مؤسسه همکار'
          : 'پیگیری متمرکز توسط مؤسسه متولی واحد',
      targetReviewDate: '۱۴۰۵/۰۹/۱۵',
      beneficiaryAgreed: stage >= 3,
      goals:
        stage >= 3
          ? [
              {
                id: `${record.id}-g1`,
                title:
                  record.servicePath === 'livelihood_medical'
                    ? 'تثبیت پوشش دارویی و تامین سبد معیشتی ماهانه'
                    : `راه‌اندازی کسب‌وکار خرد در زمینه ${record.assessmentDetails.skillInterest}`,
                targetDate: '۱۴۰۵/۰۹/۳۰',
                responsible: 'مددکار معین و سرپرست خانوار',
                status: stage >= 5 ? 'achieved' : stage === 4 ? 'in_progress' : 'pending',
              },
              {
                id: `${record.id}-g2`,
                title: 'پشتیبانی تحصیلی و تغذیه‌ای فرزندان در نیم‌سال جاری',
                targetDate: '۱۴۰۵/۱۰/۱۵',
                responsible: 'واحد آموزش و مددکاری',
                status: stage >= 5 ? 'achieved' : 'in_progress',
              },
            ]
          : [],
      completedAt: stage >= 3 ? record.lastUpdatedAt : undefined,
    },
    stage4Execution: {
      shgConnected: stage >= 4 && record.servicePath === 'empowerment_employment',
      shgGroupName:
        record.servicePath === 'empowerment_employment'
          ? record.owningInstitution === 'darolahsan'
            ? 'صندوق خودیاری همت نایسر'
            : 'صندوق امید بانوان تپه نایسر'
          : '',
      executionNotes: record.caseWorkerNote,
      deliveredServices:
        stage >= 4
          ? [
              {
                id: `${record.id}-s1`,
                dateTime: record.lastSupportDate,
                category: record.servicePath === 'livelihood_medical' ? 'medical' : 'employment',
                title: record.lastSupportType,
                amountOrQuantity:
                  record.servicePath === 'livelihood_medical' ? '۱ بسته کامل + دارو' : 'تسهیلات قرض‌الحسنه',
                providerInstitution: record.owningInstitution,
                notes: record.caseWorkerNote,
              },
            ]
          : [],
      completedAt: stage >= 4 ? record.lastSupportDate : undefined,
    },
    stage5Monitoring: {
      nextFollowUpDate:
        (
          {
            'NY-1405-104': '۱۴۰۵/۰۸/۲۶',
            'NY-1405-109': '۱۴۰۵/۰۸/۲۴',
            'NY-1405-110': '۱۴۰۵/۰۸/۲۹',
            'NY-1405-111': '۱۴۰۵/۰۸/۲۰',
          } as Record<string, string>
        )[record.id] || '۱۴۰۵/۰۹/۰۴',
      stabilityMonthsCount:
        isGraduated
          ? 6
          : record.id === 'NY-1405-109'
            ? 4
            : record.id === 'NY-1405-110' || record.id === 'NY-1405-111'
              ? 3
              : stage === 5
                ? 4
                : 0,
      visits:
        stage >= 5
          ? [
              {
                id: `${record.id}-v1`,
                dateTime: record.lastUpdatedAt,
                monthlyEstimatedIncome: isGraduated ? 16000000 : 8500000,
                employmentStability: isGraduated ? 'پایدار' : 'رو به رشد',
                childEducationStatus: 'تحصیل منظم و بدون غیبت',
                overallProgress: isGraduated ? 'آماده خروج' : 'در مسیر خوداتکایی',
                notes: record.caseWorkerNote,
              },
            ]
          : [],
      completedAt: stage >= 5 ? record.lastUpdatedAt : undefined,
    },
    stage6Graduation: {
      stableIncomeVerified: isGraduated,
      insuranceActive: isGraduated,
      sixMonthFollowUpDone: isGraduated,
      peerVolunteerJoined: isGraduated,
      graduationCertificateNo: isGraduated ? `GRAD-${record.id}` : '',
      graduationNotes: isGraduated ? record.caseWorkerNote : '',
      completedAt: isGraduated ? record.lastUpdatedAt : undefined,
    },
  };
}

function ensureCaseWorkflow(record: InternalCaseRecord): CaseManagementWorkflow {
  if (!record.workflow) {
    record.workflow = buildDefaultWorkflowForCase(record);
  }
  return record.workflow;
}

function predictThreeMonthNeed(
  record: InternalCaseRecord,
  daysInStage: number,
): ThreeMonthNeedForecast {
  if (record.coverageStatus === 'GRADUATED' || record.stage === 6) {
    return {
      category: 'employment',
      categoryLabel: 'پایش ثبات شغلی',
      probabilityPct: 18,
      riskLevel: 'low',
      rationale:
        'خانوار به مرحله خروج موفق رسیده است؛ ریسک بازگشت به نیاز حمایتی در ۳ ماه آینده پایین برآورد می‌شود.',
    };
  }

  const notes = `${record.medicalNotes} ${record.caseWorkerNote} ${record.headStatus}`;
  const stagnationBoost = daysInStage > 90 ? 11 : daysInStage > 45 ? 5 : 0;

  const medicalScore =
    (record.score.health / 20) * 65 +
    (/مزمن|صعب|دارو|درمان|تنفسی|کلیوی|فیزیوتراپی|ازکارافتاده/.test(notes) ? 20 : 0) +
    stagnationBoost +
    (record.householdSize >= 5 ? 5 : 0);

  const employmentScore =
    (record.score.livelihood / 25) * 50 +
    (record.servicePath === 'empowerment_employment' ? 18 : 0) +
    (/بیکاری|جویای کار|کارگاه|خیاطی|تسهیلات|بسته‌بندی|صندوق/.test(notes) ? 14 : 0) +
    (record.headStatus.includes('زن سرپرست') ? 7 : 0) +
    stagnationBoost;

  const housingScore =
    (record.score.housing / 25) * 54 +
    (/اجاره سنگین|غیررسمی|فاقد گرمایش/.test(record.housingType)
      ? 20
      : record.housingType.includes('استیجاری')
        ? 10
        : 0) +
    (record.householdSize >= 5 ? 7 : 0) +
    stagnationBoost;

  const livelihoodScore =
    (record.score.familyStructure / 30) * 34 +
    (record.score.livelihood / 25) * 34 +
    (record.urgencyTier === 'red' ? 14 : 6) +
    stagnationBoost;

  const candidates: Array<{
    category: PredictedServiceCategory;
    categoryLabel: string;
    rawScore: number;
    rationale: string;
  }> = [
    {
      category: 'medical',
      categoryLabel: 'خدمات پزشکی و درمان',
      rawScore: medicalScore,
      rationale: `امتیاز سلامت (${record.score.health}/۲۰) و سوابق درمانی ثبت‌شده، احتمال نیاز به پوشش دارویی یا صندوق درمان مشترک در ۳ ماه آینده را افزایش داده است.`,
    },
    {
      category: 'employment',
      categoryLabel: 'حمایت اشتغال و تسهیلات',
      rawScore: employmentScore,
      rationale: `شاخص معیشت (${record.score.livelihood}/۲۵) و مسیر توانمندسازی نشان‌دهنده نیاز نزدیک خانوار به تسهیلات اشتغال خانگی یا اتصال به صندوق خودیاری است.`,
    },
    {
      category: 'housing',
      categoryLabel: 'حمایت مسکن و اجاره‌بها',
      rawScore: housingScore,
      rationale: `امتیاز مسکن (${record.score.housing}/۲۵) و وضعیت «${record.housingType}» ریسک نیاز به کمک‌هزینه ودیعه یا ترمیم سرپناه در فصل پیش رو را نشان می‌دهد.`,
    },
    {
      category: 'livelihood',
      categoryLabel: 'سبد معیشتی و حمایت فوری',
      rawScore: livelihoodScore,
      rationale: `ترکیب ساختار خانوار (${record.householdSize} نفر) و امتیاز کل ${record.score.total}/۱۰۰ بیانگر ضرورت تداوم سبد معیشتی در ۳ ماه آینده است.`,
    },
  ];

  candidates.sort((a, b) => b.rawScore - a.rawScore);
  const top = candidates[0];
  const probabilityPct = Math.min(95, Math.max(28, Math.round(top.rawScore)));
  const riskLevel: ThreeMonthNeedForecast['riskLevel'] =
    probabilityPct >= 75 ? 'high' : probabilityPct >= 52 ? 'medium' : 'low';

  return {
    category: top.category,
    categoryLabel: top.categoryLabel,
    probabilityPct,
    riskLevel,
    rationale:
      daysInStage > 90
        ? `${top.rationale} (توقف ${daysInStage} روزه پرونده در یک مرحله، این ریسک را تشدید کرده است.)`
        : top.rationale,
  };
}

function sanitizeCaseForRole(
  record: InternalCaseRecord,
  blocks: NaysarBlock[],
  requesterInstitution: InstitutionId,
  requesterRole: UserRole,
): CaseRecordView {
  const block = blocks.find((b) => b.id === record.blockId);
  const canViewDedicated =
    requesterRole !== 'privacy_officer' &&
    requesterRole !== 'system_admin' &&
    record.owningInstitution === requesterInstitution;

  const daysInStage = Math.max(
    0,
    Math.floor((Date.now() - new Date(record.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)),
  );

  const base: CaseRecordView = {
    id: record.id,
    nationalIdHash: record.nationalIdHash,
    owningInstitution: record.owningInstitution,
    blockId: record.blockId,
    blockName: block ? block.name : 'نایسر',
    coverageStatus: record.coverageStatus,
    urgencyTier: record.urgencyTier,
    stage: record.stage,
    servicePath: record.servicePath,
    collaborationModel: record.collaborationModel,
    secondaryInstitution: record.secondaryInstitution,
    lastSupportDate: record.lastSupportDate,
    lastSupportType: record.lastSupportType,
    registeredAt: record.registeredAt,
    lastUpdatedAt: record.lastUpdatedAt,
    stageEnteredDate: record.stageEnteredDate,
    daysInStage,
    score: record.score,
    consentSigned: record.consentSigned,
    isMasked: !canViewDedicated,
  };

  if (canViewDedicated) {
    return {
      ...base,
      nationalIdMasked: maskNationalId(record.nationalId),
      fullName: record.fullName,
      phone: record.phone,
      address: record.address,
      householdSize: record.householdSize,
      headStatus: record.headStatus,
      housingType: record.housingType,
      medicalNotes: record.medicalNotes,
      caseWorkerNote: record.caseWorkerNote,
      needForecast3M: predictThreeMonthNeed(record, daysInStage),
      assessmentDetails: record.assessmentDetails,
      history: record.history,
      workflow: ensureCaseWorkflow(record),
    };
  }

  return base;
}

const SYSTEM_ACCOUNTS: Array<{
  username: string;
  passwordHash: string;
  displayName: string;
  roleTitle: string;
  institution: InstitutionId;
  role: UserRole;
}> = [
  {
    username: 'darolahsan',
    passwordHash: pureSha256Hex('Naysar@1405'),
    displayName: 'سهیلا محمدی',
    roleTitle: 'مددکار معین مؤسسه دارالاحسان سنندج',
    institution: 'darolahsan',
    role: 'case_worker',
  },
  {
    username: 'edalat',
    passwordHash: pureSha256Hex('Naysar@1405'),
    displayName: 'آرش کریمی',
    roleTitle: 'مددکار معین مؤسسه عدالت و برابری کردستان',
    institution: 'edalat',
    role: 'case_worker',
  },
  {
    username: 'nazer',
    passwordHash: pureSha256Hex('Nazer@1405'),
    displayName: 'مهندس شریفی',
    roleTitle: 'ناظر امنیتی بی‌طرف (کارگروه مشترک نایسر)',
    institution: 'darolahsan',
    role: 'privacy_officer',
  },
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {'Content-Type': 'application/json; charset=utf-8'},
  });
}

function buildStageForecast(state: StaticStoreState, searchParams: URLSearchParams): StageForecastPayload {
  const instParam = searchParams.get('institution');
  const institutionFilter: InstitutionId | 'all' =
    instParam === 'darolahsan' || instParam === 'edalat' ? instParam : 'all';

  const scenarioParam = searchParams.get('scenario');
  const scenario: ForecastScenario =
    scenarioParam === 'accelerated_funding' || scenarioParam === 'winter_surge'
      ? scenarioParam
      : 'baseline';

  const STAGE_META: Array<{
    stage: CaseStage;
    label: string;
    shortLabel: string;
    resourceFocus: string;
    unitBudgetMillion: number;
    unitHours: number;
  }> = [
    {
      stage: 1,
      label: '۱. پذیرش و ارجاع',
      shortLabel: '۱. پذیرش',
      resourceFocus: 'استعلام امن کدملی، ارجاع متقابل و تعیین مؤسسه متولی',
      unitBudgetMillion: 1.8,
      unitHours: 2.5,
    },
    {
      stage: 2,
      label: '۲. ارزیابی همه‌جانبه',
      shortLabel: '۲. ارزیابی',
      resourceFocus: 'بازدید میدانی، امتیازدهی ۱۰۰ امتیازی و سبد اضطراری اولیه',
      unitBudgetMillion: 4.5,
      unitHours: 4.0,
    },
    {
      stage: 3,
      label: '۳. برنامه مداخله',
      shortLabel: '۳. برنامه مداخله',
      resourceFocus: 'تدوین بسته خدماتی، هماهنگی بین‌بخشی و تعیین اهداف خانوار',
      unitBudgetMillion: 3.2,
      unitHours: 3.5,
    },
    {
      stage: 4,
      label: '۴. اجرا و خدمات',
      shortLabel: '۴. اجرا و خدمات',
      resourceFocus: 'تامین مستمر معیشت، درمان، اجاره‌بها و اتصال به صندوق خودیاری',
      unitBudgetMillion: 12.5,
      unitHours: 5.0,
    },
    {
      stage: 5,
      label: '۵. پایش مستمر',
      shortLabel: '۵. پایش مستمر',
      resourceFocus: 'بازدیدهای ماهانه ثبات درآمد، بازپرداخت وام و وضعیت تحصیل',
      unitBudgetMillion: 4.0,
      unitHours: 2.5,
    },
    {
      stage: 6,
      label: '۶. خروج موفق',
      shortLabel: '۶. خروج موفق',
      resourceFocus: 'صدور گواهی خوداتکایی، پیگیری فصلی و پیوستن به شبکه همیاران',
      unitBudgetMillion: 1.2,
      unitHours: 1.0,
    },
  ];

  const seedCohortByFilter: Record<InstitutionId | 'all', [number, number, number, number, number, number]> = {
    all: [19, 36, 34, 52, 34, 38],
    darolahsan: [10, 19, 18, 28, 19, 23],
    edalat: [9, 17, 16, 24, 15, 15],
  };
  const seedInitialStageCounts: Record<InstitutionId | 'all', [number, number, number, number, number, number]> = {
    all: [1, 2, 2, 1, 1, 1],
    darolahsan: [0, 2, 1, 0, 0, 1],
    edalat: [1, 0, 1, 1, 1, 0],
  };

  const scopedLiveCases =
    institutionFilter === 'all'
      ? state.cases
      : state.cases.filter((c) => c.owningInstitution === institutionFilter);

  const liveCounts: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  const stagnantByStage: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
  const nowMs = Date.now();

  for (const c of scopedLiveCases) {
    const idx = c.stage - 1;
    liveCounts[idx] += 1;
    const days = Math.floor((nowMs - new Date(c.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 90) {
      stagnantByStage[idx] += 1;
    }
  }

  const baseCohort = seedCohortByFilter[institutionFilter];
  const baseSeedCounts = seedInitialStageCounts[institutionFilter];
  const currentCounts = baseCohort.map((base, idx) =>
    Math.max(0, base + (liveCounts[idx] - baseSeedCounts[idx])),
  ) as [number, number, number, number, number, number];

  const scopedWorkers = caseWorkerMonthlySeed.filter(
    (w) => institutionFilter === 'all' || w.institution === institutionFilter,
  );
  const totalLiveTransitions =
    institutionFilter === 'all'
      ? state.workerLiveDeltas.darolahsan.transitionDelta + state.workerLiveDeltas.edalat.transitionDelta
      : state.workerLiveDeltas[institutionFilter].transitionDelta;
  const avgWorkerDays =
    scopedWorkers.reduce((s, w) => s + w.avgTransitionDays, 0) / Math.max(1, scopedWorkers.length);
  const velocityBonus = Math.min(0.08, Math.max(-0.04, (8.0 - avgWorkerDays) * 0.015 + totalLiveTransitions * 0.008));

  const matrix: number[][] = [
    [0.18, 0.64, 0.18, 0.0, 0.0, 0.0],
    [0.0, 0.34, 0.54, 0.12, 0.0, 0.0],
    [0.0, 0.0, 0.38, 0.55, 0.07, 0.0],
    [0.0, 0.0, 0.0, 0.48, 0.44, 0.08],
    [0.0, 0.0, 0.0, 0.10, 0.52, 0.38],
    [0.0, 0.0, 0.0, 0.0, 0.04, 0.96],
  ];

  for (const idx of [1, 2, 3]) {
    const drag = Math.min(0.08, stagnantByStage[idx] * 0.025) - velocityBonus;
    const clampedDrag = Math.max(-0.08, Math.min(0.08, drag));
    matrix[idx][idx] = Math.max(0.12, Math.min(0.68, matrix[idx][idx] + clampedDrag));
    matrix[idx][idx + 1] = Math.max(0.15, matrix[idx][idx + 1] - clampedDrag);
  }

  let newIntakeMean =
    institutionFilter === 'all' ? 14 : institutionFilter === 'darolahsan' ? 8 : 6;
  let scenarioLabel = 'سناریوی پایه (روند ۳۰ روز اخیر)';

  if (scenario === 'accelerated_funding') {
    scenarioLabel = 'تزریق بودجه و تسریع (+۳۰٪ ظرفیت)';
    newIntakeMean = Math.round(newIntakeMean * 1.08);
    matrix[0] = [0.10, 0.64, 0.26, 0, 0, 0];
    matrix[1] = [0, 0.21, 0.61, 0.18, 0, 0];
    matrix[2] = [0, 0, 0.24, 0.64, 0.12, 0];
    matrix[3] = [0, 0, 0, 0.37, 0.51, 0.12];
    matrix[4] = [0, 0, 0, 0.06, 0.45, 0.49];
    matrix[5] = [0, 0, 0, 0, 0.02, 0.98];
  } else if (scenario === 'winter_surge') {
    scenarioLabel = 'فشار فصلی و افزایش تقاضای معیشتی';
    newIntakeMean = Math.round(newIntakeMean * 1.45);
    matrix[0] = [0.24, 0.61, 0.15, 0, 0, 0];
    matrix[1] = [0, 0.42, 0.48, 0.10, 0, 0];
    matrix[2] = [0, 0, 0.44, 0.51, 0.05, 0];
    matrix[3] = [0, 0, 0, 0.58, 0.36, 0.06];
    matrix[4] = [0, 0, 0, 0.16, 0.54, 0.30];
    matrix[5] = [0, 0, 0, 0, 0.06, 0.94];
  }

  for (let r = 0; r < 6; r += 1) {
    const rowSum = matrix[r].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      matrix[r] = matrix[r].map((v) => v / rowSum);
    }
  }

  const seedVal =
    currentCounts.reduce((acc, n, i) => acc + n * (i + 17) * 31, 0) +
    (scenario === 'accelerated_funding' ? 771 : scenario === 'winter_surge' ? 1933 : 101) +
    totalLiveTransitions * 13;

  let rngState = seedVal >>> 0;
  const rand = () => {
    rngState = (rngState + 0x6d2b79f5) >>> 0;
    let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const samplePoisson = (lambda: number) => {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= rand();
    } while (p > L);
    return k - 1;
  };

  const cdfMatrix = matrix.map((row) => {
    let acc = 0;
    return row.map((p) => {
      acc += p;
      return acc;
    });
  });

  const simulationRuns = 2000;
  const stageSamples: number[][] = [[], [], [], [], [], []];
  const totalActiveSamples: number[] = [];
  const intakeSamples: number[] = [];
  const graduationFlowSamples: number[] = [];

  for (let run = 0; run < simulationRuns; run += 1) {
    const nextCounts = [0, 0, 0, 0, 0, 0];
    let newGraduations = 0;

    for (let from = 0; from < 6; from += 1) {
      const count = currentCounts[from];
      const cdf = cdfMatrix[from];
      for (let cIdx = 0; cIdx < count; cIdx += 1) {
        const u = rand();
        let dest = 5;
        for (let col = 0; col < 6; col += 1) {
          if (u <= cdf[col]) {
            dest = col;
            break;
          }
        }
        nextCounts[dest] += 1;
        if (from < 5 && dest === 5) {
          newGraduations += 1;
        }
      }
    }

    const newIntake = samplePoisson(newIntakeMean);
    let stage1New = 0;
    let stage2New = 0;
    for (let n = 0; n < newIntake; n += 1) {
      if (rand() < 0.8) stage1New += 1;
      else stage2New += 1;
    }
    nextCounts[0] += stage1New;
    nextCounts[1] += stage2New;

    for (let s = 0; s < 6; s += 1) {
      stageSamples[s].push(nextCounts[s]);
    }
    totalActiveSamples.push(
      nextCounts[0] + nextCounts[1] + nextCounts[2] + nextCounts[3] + nextCounts[4],
    );
    intakeSamples.push(newIntake);
    graduationFlowSamples.push(newGraduations);
  }

  const quantile = (sortedArr: number[], q: number) => {
    const pos = (sortedArr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sortedArr[base + 1] !== undefined) {
      return Math.round(sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]));
    }
    return Math.round(sortedArr[base]);
  };

  const meanOf = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);

  const expectedInflows = [0, 0, 0, 0, 0, 0];
  const expectedOutflows = [0, 0, 0, 0, 0, 0];
  expectedInflows[0] += newIntakeMean * 0.8;
  expectedInflows[1] += newIntakeMean * 0.2;

  for (let from = 0; from < 6; from += 1) {
    for (let to = 0; to < 6; to += 1) {
      if (from !== to) {
        const flow = currentCounts[from] * matrix[from][to];
        expectedInflows[to] += flow;
        expectedOutflows[from] += flow;
      }
    }
  }

  const stages: StageForecastItem[] = STAGE_META.map((meta, idx) => {
    const sorted = [...stageSamples[idx]].sort((a, b) => a - b);
    const expectedCount = Math.round(meanOf(sorted));
    const medianCount = quantile(sorted, 0.5);
    const ciLow80 = quantile(sorted, 0.1);
    const ciHigh80 = quantile(sorted, 0.9);
    const ciLow95 = quantile(sorted, 0.025);
    const ciHigh95 = quantile(sorted, 0.975);
    const currentCount = currentCounts[idx];
    const netDelta = expectedCount - currentCount;
    const stayProbPct = Math.round(matrix[idx][idx] * 100);
    const advanceProbPct =
      idx < 5
        ? Math.round(matrix[idx].slice(idx + 1).reduce((a, b) => a + b, 0) * 100)
        : 0;

    const congestionRisk: 'high' | 'medium' | 'low' =
      idx < 5 && (netDelta >= 5 || (stayProbPct >= 42 && expectedCount >= 30))
        ? 'high'
        : idx < 5 && (netDelta >= 2 || expectedCount >= 22)
          ? 'medium'
          : 'low';

    return {
      stage: meta.stage,
      stageLabel: meta.label,
      shortLabel: meta.shortLabel,
      currentCount,
      expectedCount,
      medianCount,
      ciLow80,
      ciHigh80,
      ciLow95,
      ciHigh95,
      netDelta,
      inflowExpected: Math.round(expectedInflows[idx]),
      outflowExpected: Math.round(expectedOutflows[idx]),
      stayProbPct,
      advanceProbPct,
      congestionRisk,
      resourceAllocationFocus: meta.resourceFocus,
      estimatedMonthlyBudgetMillion: Math.round(expectedCount * meta.unitBudgetMillion),
      requiredWorkerHours: Math.round(expectedCount * meta.unitHours),
    };
  });

  const sortedActive = [...totalActiveSamples].sort((a, b) => a - b);
  const totalCurrentActive =
    currentCounts[0] + currentCounts[1] + currentCounts[2] + currentCounts[3] + currentCounts[4];
  const totalExpectedNextMonth = Math.round(meanOf(sortedActive));
  const totalCiLow80 = quantile(sortedActive, 0.1);
  const totalCiHigh80 = quantile(sortedActive, 0.9);

  const bottleneckCandidate = [...stages.slice(0, 5)].sort(
    (a, b) =>
      b.expectedCount * (b.stayProbPct / 100) +
      Math.max(0, b.netDelta) * 2 -
      (a.expectedCount * (a.stayProbPct / 100) + Math.max(0, a.netDelta) * 2),
  )[0];

  const totalEstimatedBudgetMillion = stages.reduce(
    (sum, s) => sum + s.estimatedMonthlyBudgetMillion,
    0,
  );
  const totalRequiredWorkerHours = stages.reduce((sum, s) => sum + s.requiredWorkerHours, 0);

  const transitionMatrix: StageTransitionCell[] = [];
  for (let from = 0; from < 6; from += 1) {
    for (let to = 0; to < 6; to += 1) {
      transitionMatrix.push({
        fromStage: (from + 1) as CaseStage,
        toStage: (to + 1) as CaseStage,
        probabilityPct: Math.round(matrix[from][to] * 100),
      });
    }
  }

  const stage4 = stages[3];
  const stage2 = stages[1];
  const stage3 = stages[2];
  const recommendations: string[] = [
    `تراکم اصلی ماه آینده در «${bottleneckCandidate.stageLabel}» با پیش‌بینی ${bottleneckCandidate.expectedCount} پرونده (بازه ۸۰٪: ${bottleneckCandidate.ciLow80} تا ${bottleneckCandidate.ciHigh80}) رخ می‌دهد؛ تخصیص ${bottleneckCandidate.requiredWorkerHours} ساعت مددکاری برای جلوگیری از رکود پیشنهاد می‌شود.`,
    `برای «${stage4.stageLabel}» (${stage4.expectedCount} پرونده)، پیش‌بینی اعتبار ماهانه حدود ${stage4.estimatedMonthlyBudgetMillion} میلیون تومان جهت سبد معیشتی، دارو و تسهیلات اشتغال برآورد شده است.`,
    scenario === 'accelerated_funding'
      ? `در سناریوی تزریق بودجه، انتقال از مراحل ۲ و ۳ تسریع شده و خروج موفق ماهانه به حدود ${Math.round(meanOf(graduationFlowSamples))} خانوار می‌رسد.`
      : `تامین ظرفیت ارزیابی در مراحل «${stage2.shortLabel}» و «${stage3.shortLabel}» (مجموعاً ${stage2.expectedCount + stage3.expectedCount} پرونده) مانع انباشت پرونده‌های بحرانی بالای ۹۰ روز خواهد شد.`,
  ];

  return {
    institutionFilter,
    scenario,
    scenarioLabel,
    horizonLabel: 'ماه آینده (آذر ۱۴۰۵ · افق ۳۰ روزه)',
    simulationRuns,
    modelSummary:
      'زنجیره مارکوف ۶ حالته کالیبره‌شده با سرعت جابجایی مددکاران و شبیه‌سازی مونت‌کارلو (۲,۰۰۰ تکرار)',
    totalCurrentActive,
    totalExpectedNextMonth,
    totalCiLow80,
    totalCiHigh80,
    expectedNewIntake: Math.round(meanOf(intakeSamples)),
    expectedGraduations: Math.round(meanOf(graduationFlowSamples)),
    bottleneckStage: bottleneckCandidate.stage,
    bottleneckReason: `احتمال ماندگاری ${bottleneckCandidate.stayProbPct}٪ و حجم پیش‌بینی‌شده ${bottleneckCandidate.expectedCount} پرونده در ماه آینده`,
    totalEstimatedBudgetMillion,
    totalRequiredWorkerHours,
    stages,
    transitionMatrix,
    recommendations,
  };
}

function buildReportsPayload(state: StaticStoreState, searchParams: URLSearchParams): ReportsPayload {
  const filterParam = searchParams.get('institution');
  const institutionFilter: InstitutionId | 'all' =
    filterParam === 'darolahsan' || filterParam === 'edalat' ? filterParam : 'all';

  const scopedCases =
    institutionFilter === 'all'
      ? state.cases
      : state.cases.filter((c) => c.owningInstitution === institutionFilter);

  const extraGraduated = Math.max(
    0,
    scopedCases.filter((c) => c.coverageStatus === 'GRADUATED').length -
      (institutionFilter === 'all' ? 1 : institutionFilter === 'darolahsan' ? 1 : 0),
  );
  const extraRed = Math.max(
    0,
    scopedCases.filter((c) => c.urgencyTier === 'red').length -
      (institutionFilter === 'all' ? 2 : 1),
  );
  const extraYellow = Math.max(
    0,
    scopedCases.filter((c) => c.urgencyTier === 'yellow').length -
      (institutionFilter === 'all' ? 3 : institutionFilter === 'darolahsan' ? 1 : 2),
  );
  const extraGreen = Math.max(
    0,
    scopedCases.filter((c) => c.urgencyTier === 'green').length -
      (institutionFilter === 'all' ? 1 : institutionFilter === 'darolahsan' ? 1 : 0),
  );

  const baseByFilter: Record<InstitutionId | 'all', MonthlyReportPoint[]> = {
    all: [
      {monthKey: '1405-03', monthLabel: 'خرداد ۱۴۰۵', graduatedCumulative: 8, graduatedNew: 3, overlapsPrevented: 4, redTier: 48, yellowTier: 64, greenTier: 22, avgResponseDays: 14.5},
      {monthKey: '1405-04', monthLabel: 'تیر ۱۴۰۵', graduatedCumulative: 12, graduatedNew: 4, overlapsPrevented: 7, redTier: 44, yellowTier: 68, greenTier: 27, avgResponseDays: 13.2},
      {monthKey: '1405-05', monthLabel: 'مرداد ۱۴۰۵', graduatedCumulative: 17, graduatedNew: 5, overlapsPrevented: 10, redTier: 39, yellowTier: 71, greenTier: 34, avgResponseDays: 12.0},
      {monthKey: '1405-06', monthLabel: 'شهریور ۱۴۰۵', graduatedCumulative: 23, graduatedNew: 6, overlapsPrevented: 13, redTier: 34, yellowTier: 72, greenTier: 41, avgResponseDays: 10.8},
      {monthKey: '1405-07', monthLabel: 'مهر ۱۴۰۵', graduatedCumulative: 30, graduatedNew: 7, overlapsPrevented: 16, redTier: 29, yellowTier: 69, greenTier: 49, avgResponseDays: 9.5},
      {monthKey: '1405-08', monthLabel: 'آبان ۱۴۰۵', graduatedCumulative: 38 + extraGraduated, graduatedNew: 8 + extraGraduated, overlapsPrevented: state.overlapsPreventedCount, redTier: 25 + extraRed, yellowTier: 67 + extraYellow, greenTier: 56 + extraGreen, avgResponseDays: 8.2},
    ],
    darolahsan: [
      {monthKey: '1405-03', monthLabel: 'خرداد ۱۴۰۵', graduatedCumulative: 5, graduatedNew: 2, overlapsPrevented: 2, redTier: 26, yellowTier: 34, greenTier: 12, avgResponseDays: 14.8},
      {monthKey: '1405-04', monthLabel: 'تیر ۱۴۰۵', graduatedCumulative: 7, graduatedNew: 2, overlapsPrevented: 4, redTier: 24, yellowTier: 36, greenTier: 15, avgResponseDays: 13.5},
      {monthKey: '1405-05', monthLabel: 'مرداد ۱۴۰۵', graduatedCumulative: 10, graduatedNew: 3, overlapsPrevented: 6, redTier: 21, yellowTier: 37, greenTier: 19, avgResponseDays: 12.2},
      {monthKey: '1405-06', monthLabel: 'شهریور ۱۴۰۵', graduatedCumulative: 14, graduatedNew: 4, overlapsPrevented: 7, redTier: 18, yellowTier: 38, greenTier: 23, avgResponseDays: 11.0},
      {monthKey: '1405-07', monthLabel: 'مهر ۱۴۰۵', graduatedCumulative: 18, graduatedNew: 4, overlapsPrevented: 9, redTier: 15, yellowTier: 36, greenTier: 27, avgResponseDays: 9.8},
      {monthKey: '1405-08', monthLabel: 'آبان ۱۴۰۵', graduatedCumulative: 23 + extraGraduated, graduatedNew: 5 + extraGraduated, overlapsPrevented: Math.ceil(state.overlapsPreventedCount * 0.55), redTier: 13 + extraRed, yellowTier: 35 + extraYellow, greenTier: 31 + extraGreen, avgResponseDays: 8.5},
    ],
    edalat: [
      {monthKey: '1405-03', monthLabel: 'خرداد ۱۴۰۵', graduatedCumulative: 3, graduatedNew: 1, overlapsPrevented: 2, redTier: 22, yellowTier: 30, greenTier: 10, avgResponseDays: 14.1},
      {monthKey: '1405-04', monthLabel: 'تیر ۱۴۰۵', graduatedCumulative: 5, graduatedNew: 2, overlapsPrevented: 3, redTier: 20, yellowTier: 32, greenTier: 12, avgResponseDays: 12.8},
      {monthKey: '1405-05', monthLabel: 'مرداد ۱۴۰۵', graduatedCumulative: 7, graduatedNew: 2, overlapsPrevented: 4, redTier: 18, yellowTier: 34, greenTier: 15, avgResponseDays: 11.7},
      {monthKey: '1405-06', monthLabel: 'شهریور ۱۴۰۵', graduatedCumulative: 9, graduatedNew: 2, overlapsPrevented: 6, redTier: 16, yellowTier: 34, greenTier: 18, avgResponseDays: 10.5},
      {monthKey: '1405-07', monthLabel: 'مهر ۱۴۰۵', graduatedCumulative: 12, graduatedNew: 3, overlapsPrevented: 7, redTier: 14, yellowTier: 33, greenTier: 22, avgResponseDays: 9.2},
      {monthKey: '1405-08', monthLabel: 'آبان ۱۴۰۵', graduatedCumulative: 15 + extraGraduated, graduatedNew: 3 + extraGraduated, overlapsPrevented: Math.floor(state.overlapsPreventedCount * 0.45), redTier: 12 + extraRed, yellowTier: 32 + extraYellow, greenTier: 25 + extraGreen, avgResponseDays: 7.9},
    ],
  };

  const series = baseByFilter[institutionFilter];
  const first = series[0];
  const last = series[series.length - 1];
  const sixMonthGrowthPct =
    first.graduatedCumulative > 0
      ? Math.round(((last.graduatedCumulative - first.graduatedCumulative) / first.graduatedCumulative) * 100)
      : 0;

  const baseEmployment: Record<InstitutionId | 'all', {employed: number; jobSeeking: number; insured: number}> = {
    all: {employed: 58, jobSeeking: 52, insured: 38},
    darolahsan: {employed: 32, jobSeeking: 27, insured: 20},
    edalat: {employed: 26, jobSeeking: 25, insured: 18},
  };

  const empBase = baseEmployment[institutionFilter];
  const extraEmployed = scopedCases.filter((c) => c.coverageStatus === 'GRADUATED' || c.stage >= 5).length;
  const extraJobSeeking = scopedCases.filter((c) => c.servicePath === 'empowerment_employment' && c.stage < 5).length;
  const extraInsured = scopedCases.filter((c) => c.servicePath === 'livelihood_medical').length;

  const employedCount = empBase.employed + Math.max(0, extraEmployed - (institutionFilter === 'all' ? 2 : 1));
  const jobSeekingCount = empBase.jobSeeking + Math.max(0, extraJobSeeking - (institutionFilter === 'all' ? 3 : 1));
  const insuredCount = empBase.insured + Math.max(0, extraInsured - (institutionFilter === 'all' ? 3 : 1));
  const empTotal = Math.max(1, employedCount + jobSeekingCount + insuredCount);

  const baseIncome: Record<
    InstitutionId | 'all',
    {under3m: number; b3to6: number; b6to10: number; b10to15: number; over15m: number}
  > = {
    all: {under3m: 28, b3to6: 46, b6to10: 41, b10to15: 22, over15m: 11},
    darolahsan: {under3m: 15, b3to6: 24, b6to10: 22, b10to15: 12, over15m: 6},
    edalat: {under3m: 13, b3to6: 22, b6to10: 19, b10to15: 10, over15m: 5},
  };

  const incBase = baseIncome[institutionFilter];
  const under3mExtra = Math.max(
    0,
    scopedCases.filter((c) => c.score.livelihood >= 22).length - (institutionFilter === 'all' ? 2 : 1),
  );
  const b3to6Extra = Math.max(
    0,
    scopedCases.filter((c) => c.score.livelihood >= 18 && c.score.livelihood < 22).length -
      (institutionFilter === 'all' ? 3 : 1),
  );
  const b6to10Extra = Math.max(
    0,
    scopedCases.filter((c) => c.score.livelihood >= 13 && c.score.livelihood < 18).length -
      (institutionFilter === 'all' ? 1 : 0),
  );
  const over15Extra = Math.max(
    0,
    scopedCases.filter((c) => c.coverageStatus === 'GRADUATED' || c.score.livelihood < 11).length -
      (institutionFilter === 'all' ? 1 : institutionFilter === 'darolahsan' ? 1 : 0),
  );

  const incCounts = [
    incBase.under3m + under3mExtra,
    incBase.b3to6 + b3to6Extra,
    incBase.b6to10 + b6to10Extra,
    incBase.b10to15,
    incBase.over15m + over15Extra,
  ];
  const incTotal = Math.max(1, incCounts.reduce((acc, n) => acc + n, 0));
  const incPcts = incCounts.map((count) => Math.round((count / incTotal) * 100));
  const pctDiff = 100 - incPcts.reduce((acc, p) => acc + p, 0);
  incPcts[1] = Math.max(0, incPcts[1] + pctDiff);

  const caseWorkerPerformance: CaseWorkerPerformanceItem[] = caseWorkerMonthlySeed
    .filter((w) => institutionFilter === 'all' || w.institution === institutionFilter)
    .map((w) => {
      const isLead = w.id === 'cw-dar-1' || w.id === 'cw-eda-1';
      const delta = isLead ? state.workerLiveDeltas[w.institution] : {reviewedDelta: 0, transitionDelta: 0};
      const reviewedCasesCount = w.reviewedCasesCount + delta.reviewedDelta;
      const currentMonthReviewedCount = w.currentMonthReviewedCount + delta.reviewedDelta;
      const stageTransitionsCount = w.stageTransitionsCount + delta.transitionDelta;
      const avgTransitionDays =
        delta.transitionDelta > 0
          ? Number(Math.max(4.5, w.avgTransitionDays - delta.transitionDelta * 0.15).toFixed(1))
          : w.avgTransitionDays;
      return {
        ...w,
        reviewedCasesCount,
        currentMonthReviewedCount,
        stageTransitionsCount,
        avgTransitionDays,
      };
    });

  return {
    institutionFilter,
    series,
    sixMonthGrowthPct,
    totalGraduatedEnd: last.graduatedCumulative,
    currentDistribution: {
      red: last.redTier,
      yellow: last.yellowTier,
      green: last.greenTier,
      total: last.redTier + last.yellowTier + last.greenTier,
    },
    employmentDistribution: [
      {
        key: 'employed',
        label: 'شاغل (کسب‌وکار خانگی / درآمد مستقل)',
        count: employedCount,
        percentage: Math.round((employedCount / empTotal) * 100),
      },
      {
        key: 'job_seeking',
        label: 'جویای کار (آماده مهارت‌آموزی و تسهیلات)',
        count: jobSeekingCount,
        percentage: Math.round((jobSeekingCount / empTotal) * 100),
      },
      {
        key: 'insured',
        label: 'تحت پوشش بیمه و حمایت درمانی',
        count: insuredCount,
        percentage: Math.max(
          0,
          100 -
            Math.round((employedCount / empTotal) * 100) -
            Math.round((jobSeekingCount / empTotal) * 100),
        ),
      },
    ],
    incomeDistribution: [
      {key: 'under_3m', bracketLabel: 'کمتر از ۳ میلیون تومان', shortLabel: 'زیر ۳ م', count: incCounts[0], percentage: incPcts[0], povertyLineStatus: 'فقر شدید معیشتی · نیازمند سبد حمایتی فوری'},
      {key: '3m_to_6m', bracketLabel: '۳ تا ۶ میلیون تومان', shortLabel: '۳ تا ۶ م', count: incCounts[1], percentage: incPcts[1], povertyLineStatus: 'زیر خط معیشت پایه · درآمد ناپایدار و روزمزد'},
      {key: '6m_to_10m', bracketLabel: '۶ تا ۱۰ میلیون تومان', shortLabel: '۶ تا ۱۰ م', count: incCounts[2], percentage: incPcts[2], povertyLineStatus: 'در حال گذار · نیازمند تسهیلات و مهارت‌آموزی'},
      {key: '10m_to_15m', bracketLabel: '۱۰ تا ۱۵ میلیون تومان', shortLabel: '۱۰ تا ۱۵ م', count: incCounts[3], percentage: incPcts[3], povertyLineStatus: 'آستانه ثبات نسبی · آماده اتصال به بازار محلی'},
      {key: 'over_15m', bracketLabel: 'بالای ۱۵ میلیون تومان', shortLabel: '۱۵+ م', count: incCounts[4], percentage: incPcts[4], povertyLineStatus: 'خروج از فقر مطلق · پایداری درآمدی مطلوب'},
    ],
    caseWorkerPeriodLabel: 'ماه گذشته (۳۰ روز اخیر · آبان ۱۴۰۵)',
    currentMonthPeriodLabel: 'ماه جاری (آذر ۱۴۰۵ · تا امروز)',
    caseWorkerPerformance,
  };
}

function parseJsonBody(rawBody?: BodyInit | null): Record<string, unknown> {
  if (typeof rawBody !== 'string' || !rawBody.trim()) return {};
  try {
    const parsed = JSON.parse(rawBody);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function handleLocalApiRequest(
  pathname: string,
  searchParams: URLSearchParams,
  method: string,
  rawBody?: BodyInit | null,
): Promise<Response> {
  const upperMethod = method.toUpperCase();
  const state = loadState();
  const body = parseJsonBody(rawBody);

  // 1. Auth login
  if (pathname === '/api/auth/login' && upperMethod === 'POST') {
    const cleanUser = toAsciiDigits(String(body.username || '')).trim().toLowerCase();
    const rawPass = String(body.password || '');
    const normalizedPass = toAsciiDigits(rawPass).trim();

    if (!cleanUser || !rawPass) {
      return jsonResponse({error: 'وارد کردن نام کاربری و رمز عبور الزامی است.'}, 400);
    }

    const [rawPassHash, normalizedPassHash] = await Promise.all([
      sha256Hex(rawPass),
      sha256Hex(normalizedPass),
    ]);

    const matchedAccount = SYSTEM_ACCOUNTS.find(
      (acc) =>
        acc.username === cleanUser &&
        (acc.passwordHash === rawPassHash || acc.passwordHash === normalizedPassHash),
    );

    if (!matchedAccount) {
      return jsonResponse(
        {error: 'نام کاربری یا رمز عبور نادرست است. لطفاً مجدداً بررسی نمایید.'},
        401,
      );
    }

    const session: AuthUserSession = {
      username: matchedAccount.username,
      displayName: matchedAccount.displayName,
      roleTitle: matchedAccount.roleTitle,
      institution: matchedAccount.institution,
      role: matchedAccount.role,
      loggedInAt: formatPersianTimestamp(),
    };
    return jsonResponse({session}, 200);
  }

  // 2. Dashboard overview
  if (pathname === '/api/overview' && upperMethod === 'GET') {
    const rawInst = searchParams.get('institution');
    const rawRole = searchParams.get('role');
    const institution: InstitutionId = rawInst === 'edalat' ? 'edalat' : 'darolahsan';
    const role: UserRole =
      rawRole === 'executive_manager' ||
      rawRole === 'privacy_officer' ||
      rawRole === 'system_admin'
        ? rawRole
        : 'case_worker';

    const summary: DashboardSummary = {
      totalActiveCases: state.cases.filter((c) => c.coverageStatus !== 'GRADUATED').length,
      overlapsPrevented: state.overlapsPreventedCount,
      avgInquiryMs: 42,
      graduatedFamilies: state.cases.filter((c) => c.coverageStatus === 'GRADUATED').length,
      darolahsanCases: state.cases.filter((c) => c.owningInstitution === 'darolahsan').length,
      edalatCases: state.cases.filter((c) => c.owningInstitution === 'edalat').length,
      redTierCount: state.cases.filter((c) => c.urgencyTier === 'red').length,
      yellowTierCount: state.cases.filter((c) => c.urgencyTier === 'yellow').length,
      greenTierCount: state.cases.filter((c) => c.urgencyTier === 'green').length,
    };

    const cases = state.cases.map((c) => sanitizeCaseForRole(c, state.blocks, institution, role));
    return jsonResponse({summary, blocks: state.blocks, cases});
  }

  // 3. Stage forecast
  if (pathname === '/api/overview/stage-forecast' && upperMethod === 'GET') {
    return jsonResponse(buildStageForecast(state, searchParams));
  }

  // 4. Privacy-preserving search
  if (pathname === '/api/cases/search' && upperMethod === 'GET') {
    const rawInst = searchParams.get('institution');
    const rawRole = searchParams.get('role');
    const institution: InstitutionId = rawInst === 'edalat' ? 'edalat' : 'darolahsan';
    const role: UserRole =
      rawRole === 'executive_manager' ||
      rawRole === 'privacy_officer' ||
      rawRole === 'system_admin'
        ? rawRole
        : 'case_worker';
    const rawQuery = String(searchParams.get('q') || '').trim();
    if (!rawQuery) {
      return jsonResponse({matchedIds: state.cases.map((c) => c.id)});
    }
    const qNormalized = normalizeSearchText(rawQuery);
    const qDigits = normalizeDigits(rawQuery);
    const exactHash = qDigits.length === 10 ? hashNationalIdSync(qDigits) : null;

    const matchedIds = state.cases
      .filter((record) => {
        const canViewDedicated =
          role !== 'privacy_officer' &&
          role !== 'system_admin' &&
          record.owningInstitution === institution;
        const block = state.blocks.find((b) => b.id === record.blockId);
        const matchesPublicMeta =
          normalizeSearchText(record.id).includes(qNormalized) ||
          record.nationalIdHash.toLowerCase().includes(qNormalized) ||
          (block ? normalizeSearchText(block.name).includes(qNormalized) : false) ||
          (exactHash ? record.nationalIdHash === exactHash : false);
        if (matchesPublicMeta) return true;
        if (!canViewDedicated) return false;
        return (
          normalizeSearchText(record.fullName).includes(qNormalized) ||
          normalizeSearchText(record.headStatus).includes(qNormalized) ||
          (qDigits.length >= 3 && record.nationalId.includes(qDigits))
        );
      })
      .map((r) => r.id);

    return jsonResponse({matchedIds});
  }

  // 5. Inquiry
  if (pathname === '/api/inquiry' && upperMethod === 'POST') {
    const cleanId = normalizeDigits(String(body.nationalId || ''));
    if (cleanId.length !== 10) {
      return jsonResponse({error: 'کدملی باید دقیقاً ۱۰ رقم معتبر باشد.'}, 400);
    }
    const activeInstitution: InstitutionId = body.institution === 'edalat' ? 'edalat' : 'darolahsan';
    const activeRole = (body.role as UserRole) || 'case_worker';
    const needsMedicalSpecial = Boolean(body.needsMedicalSpecial);
    const computedHash = hashNationalIdSync(cleanId);
    const block = state.blocks.find((b) => b.id === body.blockId) || state.blocks[0];
    const matched = state.cases.find((c) => c.nationalIdHash === computedHash);
    const logId = `AUD-${Math.floor(9042 + Math.random() * 900)}`;

    if (!matched) {
      state.auditLogs.unshift({
        id: logId,
        timestamp: formatPersianTimestamp(),
        actorRole: activeRole,
        actorInstitution: activeInstitution,
        action: 'INQUIRY_HASH',
        nationalIdHashPrefix: computedHash.slice(0, 14),
        blockName: block.name,
        outcome: 'تطابقی یافت نشد؛ ثبت‌نام جدید بلامانع است',
        immutable: true,
      });
      saveState(state);
      const response: InquiryResponse = {
        status: 'CLEAN',
        nationalIdHashPreview: computedHash,
        auditLogId: logId,
      };
      return jsonResponse(response);
    }

    const isSame = matched.owningInstitution === activeInstitution;
    if (!isSame) {
      state.overlapsPreventedCount += 1;
    }

    const matchedBlock = state.blocks.find((b) => b.id === matched.blockId) || block;
    const reasons: string[] = [];
    let recommendedLead: InstitutionId = matched.owningInstitution;
    if (matchedBlock.leadInstitution === 'darolahsan' || matchedBlock.leadInstitution === 'edalat') {
      recommendedLead = matchedBlock.leadInstitution;
      reasons.push(
        `معیار اول (بلوک‌بندی جغرافیایی): ${matchedBlock.name} در محدوده پوشش تخصصی ${getInstitutionName(recommendedLead)} قرار دارد.`,
      );
    } else {
      reasons.push(
        `معیار دوم (تقدم زمانی ثبت‌نام): پرونده خانوار پیش‌تر در تاریخ ${matched.registeredAt} توسط ${getInstitutionName(matched.owningInstitution)} تشکیل شده است.`,
      );
    }
    if (needsMedicalSpecial) {
      reasons.push(
        'معیار سوم (تخصص و نیاز محوری): به دلیل نیاز درمانی/صعب‌العلاج، استفاده از مدل پوشش ترکیبی و صندوق درمان مشترک پیشنهاد می‌شود.',
      );
    }
    const suggestedModel: CollaborationModel =
      needsMedicalSpecial || matched.urgencyTier === 'red'
        ? 'complementary_support'
        : 'single_ownership';

    state.auditLogs.unshift({
      id: logId,
      timestamp: formatPersianTimestamp(),
      actorRole: activeRole,
      actorInstitution: activeInstitution,
      action: isSame ? 'INQUIRY_HASH' : 'OVERLAP_FLAGGED',
      nationalIdHashPrefix: computedHash.slice(0, 14),
      blockName: matchedBlock.name,
      outcome: isSame
        ? `پرونده فعال در همین مؤسسه (${matched.id}) بازیابی شد`
        : `هشدار هم‌پوشانی با ${getInstitutionName(matched.owningInstitution)} صادر شد`,
      immutable: true,
    });
    saveState(state);

    const response: InquiryResponse = {
      status: isSame ? 'MATCH_SAME' : 'MATCH_PARTNER',
      nationalIdHashPreview: computedHash,
      matchedRecord: {
        caseId: matched.id,
        owningInstitution: matched.owningInstitution,
        owningInstitutionName: getInstitutionName(matched.owningInstitution),
        coverageStatus: matched.coverageStatus,
        lastSupportDate: matched.lastSupportDate,
        lastSupportType: matched.lastSupportType,
        blockId: matched.blockId,
        blockName: matchedBlock.name,
        registeredAt: matched.registeredAt,
      },
      leadAgencyEvaluation: {
        recommendedLead,
        recommendedLeadName: getInstitutionName(recommendedLead),
        reasons,
        suggestedModel,
        clientScript: `«برای اینکه خدمات‌رسانی به شما منظم‌تر باشد و سایر خانواده‌های نیازمند نایسر نیز از حمایت جا نمانند، پرونده شما به صورت متمرکز از طریق ${getInstitutionName(recommendedLead)} پیگیری خواهد شد، اما هر دو مجموعه در کنار شما هستند.»`,
      },
      auditLogId: logId,
    };
    return jsonResponse(response);
  }

  // 6. Create new case
  if (pathname === '/api/cases' && upperMethod === 'POST') {
    if (!body.consentSigned) {
      return jsonResponse(
        {error: 'ثبت پرونده بدون تکمیل و تایید فرم رضایت‌نامه آگاهانه امکان‌پذیر نیست.'},
        400,
      );
    }
    const cleanId = normalizeDigits(String(body.nationalId || ''));
    const fullName = String(body.fullName || '').trim();
    if (cleanId.length !== 10 || !fullName) {
      return jsonResponse(
        {error: 'لطفاً کدملی ۱۰ رقمی و نام سرپرست خانوار را به درستی وارد نمایید.'},
        400,
      );
    }
    const computedHash = hashNationalIdSync(cleanId);
    const duplicate = state.cases.find((c) => c.nationalIdHash === computedHash);
    if (duplicate) {
      return jsonResponse(
        {error: `این کدملی پیش‌تر در سامانه (${getInstitutionName(duplicate.owningInstitution)}) ثبت شده است.`},
        409,
      );
    }

    const score = (body.score || {}) as Partial<WelfareScoreBreakdown>;
    const total = Math.min(
      100,
      Math.max(
        0,
        (score.familyStructure || 0) +
          (score.housing || 0) +
          (score.livelihood || 0) +
          (score.health || 0),
      ),
    );
    const urgencyTier = calculateTier(total);
    const newId = `NY-1405-${107 + state.cases.length}`;
    const activeInstitution: InstitutionId = body.institution === 'edalat' ? 'edalat' : 'darolahsan';
    const activeRole = (body.role as UserRole) || 'case_worker';
    const block = state.blocks.find((b) => b.id === body.blockId) || state.blocks[0];
    const {dateOnly, fullTimestamp} = buildVisitTimestamp(
      body.visitDate as string | undefined,
      body.visitTime as string | undefined,
    );
    const stageNum = Number(body.stage);
    const initialStage: CaseStage =
      stageNum >= 1 && stageNum <= 6 ? (stageNum as CaseStage) : 2;
    const supportLabel =
      String(body.lastSupportType || '').trim() || 'ارزیابی اولیه و تشکیل پرونده معیشتی';
    const tierLabel = urgencyTier === 'red' ? 'قرمز' : urgencyTier === 'yellow' ? 'زرد' : 'سبز';
    const details = (body.assessmentDetails || {}) as Partial<AssessmentFormDetails>;

    const newRecord: InternalCaseRecord = {
      id: newId,
      nationalId: cleanId,
      nationalIdHash: computedHash,
      owningInstitution: activeInstitution,
      blockId: block.id,
      coverageStatus: initialStage === 6 ? 'GRADUATED' : 'ACTIVE',
      urgencyTier,
      stage: initialStage,
      servicePath:
        (body.servicePath as ServicePath) ||
        (urgencyTier === 'red' ? 'livelihood_medical' : 'empowerment_employment'),
      collaborationModel: 'single_ownership',
      lastSupportDate: fullTimestamp,
      lastSupportType: supportLabel,
      registeredAt: fullTimestamp,
      lastUpdatedAt: fullTimestamp,
      stageEnteredAt: new Date().toISOString(),
      stageEnteredDate: dateOnly,
      score: {
        familyStructure: score.familyStructure || 0,
        housing: score.housing || 0,
        livelihood: score.livelihood || 0,
        health: score.health || 0,
        total,
      },
      consentSigned: true,
      fullName,
      phone: String(body.phone || '').trim() || 'ثبت‌نشده',
      address: String(body.address || '').trim() || block.name,
      householdSize: Number(body.householdSize) || 1,
      headStatus: String(body.headStatus || '') || 'عادی',
      housingType: String(body.housingType || '') || 'استیجاری با اجاره سنگین',
      medicalNotes: String(body.medicalNotes || '').trim() || 'مورد خاصی ثبت نشده است',
      caseWorkerNote:
        String(body.caseWorkerNote || '').trim() ||
        'پرونده پس از اخذ رضایت‌نامه آگاهانه و استعلام هش کدملی ایجاد شد.',
      assessmentDetails: {
        studentsCount: details.studentsCount ?? 0,
        dependentsCount: details.dependentsCount ?? 0,
        lacksUtilities: Boolean(details.lacksUtilities),
        incomeSourcePoints: details.incomeSourcePoints ?? 14,
        hasUnemployedWorker: Boolean(details.hasUnemployedWorker),
        hasChronicDisease: Boolean(details.hasChronicDisease),
        childNutritionRisk: Boolean(details.childNutritionRisk),
        skillInterest: details.skillInterest?.trim() || 'نامشخص',
      },
      history: [
        {
          id: `EVT-${Date.now()}`,
          timestamp: fullTimestamp,
          type: 'CREATED',
          summary: `تشکیل پرونده جدید (${supportLabel}) با امتیاز ${total}/۱۰۰ (${tierLabel})`,
          actorInstitution: activeInstitution,
          scoreTotal: total,
          stage: initialStage,
        },
      ],
    };
    newRecord.workflow = buildDefaultWorkflowForCase(newRecord);
    state.cases.unshift(newRecord);
    block.activeCasesCount += 1;
    recordWorkerActivity(state, activeInstitution, 'reviewed');

    const auditLogId = `AUD-${Math.floor(9050 + Math.random() * 900)}`;
    state.auditLogs.unshift({
      id: auditLogId,
      timestamp: fullTimestamp,
      actorRole: activeRole,
      actorInstitution: activeInstitution,
      action: 'CASE_CREATED',
      nationalIdHashPrefix: computedHash.slice(0, 14),
      blockName: block.name,
      outcome: `ثبت پرونده جدید ${newId} با رضایت‌نامه آگاهانه (امتیاز ${total} - ${tierLabel})`,
      immutable: true,
    });
    saveState(state);

    return jsonResponse(
      {
        caseRecord: sanitizeCaseForRole(newRecord, state.blocks, activeInstitution, activeRole),
        auditLogId,
      },
      201,
    );
  }

  // 7. Update case workflow / stage / details
  const caseStageMatch = pathname.match(/^\/api\/cases\/([^/]+)\/stage$/);
  if (caseStageMatch && upperMethod === 'PATCH') {
    const id = decodeURIComponent(caseStageMatch[1]);
    const target = state.cases.find((c) => c.id === id);
    if (!target) {
      return jsonResponse({error: 'پرونده مورد نظر یافت نشد.'}, 404);
    }

    const nowTimestamp = formatPersianTimestamp();
    const nowDateOnly = formatPersianDateOnly();
    const stageNum = Number(body.stage);
    if (stageNum >= 1 && stageNum <= 6) {
      target.stage = stageNum as CaseStage;
      target.stageEnteredAt = new Date().toISOString();
      target.stageEnteredDate = nowDateOnly;
      target.lastUpdatedAt = nowTimestamp;
      if (stageNum === 6) {
        target.coverageStatus = 'GRADUATED';
        target.lastSupportType = 'آیین تکریم و خروج موفق از چرخه حمایت';
        target.lastSupportDate = nowTimestamp;
      }
    }

    const collaborationModel = body.collaborationModel as CollaborationModel | undefined;
    if (collaborationModel) {
      target.collaborationModel = collaborationModel;
      target.lastUpdatedAt = nowTimestamp;
      if (collaborationModel === 'complementary_support') {
        target.secondaryInstitution = target.owningInstitution === 'darolahsan' ? 'edalat' : 'darolahsan';
        target.coverageStatus = 'ACTIVE';
      }
    }

    const block = state.blocks.find((b) => b.id === target.blockId);
    const actorInst = (body.institution as InstitutionId) || target.owningInstitution;
    const actorRole = (body.role as UserRole) || 'case_worker';
    const outcomeSummary = collaborationModel
      ? `توافق مدل همکاری (${collaborationModel === 'complementary_support' ? 'پوشش ترکیبی' : 'واگذاری کامل'}) برای ${target.id}`
      : `انتقال پرونده ${target.id} به مرحله ${target.stage} مدیریت مورد`;

    target.history.unshift({
      id: `EVT-${Date.now()}`,
      timestamp: nowTimestamp,
      type: collaborationModel ? 'OVERLAP_RESOLVED' : 'STAGE_CHANGED',
      summary: outcomeSummary,
      actorInstitution: actorInst,
      scoreTotal: target.score.total,
      stage: target.stage,
    });
    recordWorkerActivity(state, actorInst, body.stage ? 'transition' : 'reviewed');

    state.auditLogs.unshift({
      id: `AUD-${Math.floor(9100 + Math.random() * 800)}`,
      timestamp: nowTimestamp,
      actorRole,
      actorInstitution: actorInst,
      action: collaborationModel ? 'CONFLICT_RESOLVED' : 'STAGE_ADVANCED',
      nationalIdHashPrefix: target.nationalIdHash.slice(0, 14),
      blockName: block?.name || 'نایسر',
      outcome: outcomeSummary,
      immutable: true,
    });
    saveState(state);

    return jsonResponse({
      caseRecord: sanitizeCaseForRole(target, state.blocks, actorInst, actorRole),
    });
  }

  const caseWorkflowMatch = pathname.match(/^\/api\/cases\/([^/]+)\/workflow$/);
  if (caseWorkflowMatch && upperMethod === 'PUT') {
    const id = decodeURIComponent(caseWorkflowMatch[1]);
    const activeInstitution: InstitutionId = body.institution === 'edalat' ? 'edalat' : 'darolahsan';
    const activeRole: UserRole = (body.role as UserRole) || 'case_worker';

    if (activeRole === 'privacy_officer' || activeRole === 'system_admin') {
      return jsonResponse(
        {error: 'نقش ناظر امنیتی و مدیر سیستم مجاز به ثبت یا ویرایش اجزای پرونده نیست.'},
        403,
      );
    }

    const target = state.cases.find((c) => c.id === id);
    if (!target) {
      return jsonResponse({error: 'پرونده مورد نظر یافت نشد.'}, 404);
    }
    if (target.owningInstitution !== activeInstitution) {
      return jsonResponse(
        {error: 'مطابق تفکیک پایگاه داده، فقط مؤسسه متولی مجاز به ویرایش مراحل مدیریت مورد این پرونده است.'},
        403,
      );
    }

    const nowTimestamp = String(body.actionDateTime || '').trim() || formatPersianTimestamp();
    const nowDateOnly = nowTimestamp.split('·')[0]?.trim() || formatPersianDateOnly();
    const currentWorkflow = ensureCaseWorkflow(target);
    const workflow = body.workflow as Partial<CaseManagementWorkflow> | undefined;

    if (workflow) {
      target.workflow = {
        stage1Intake: workflow.stage1Intake || currentWorkflow.stage1Intake,
        stage2Assessment: workflow.stage2Assessment || currentWorkflow.stage2Assessment,
        stage3Plan: workflow.stage3Plan || currentWorkflow.stage3Plan,
        stage4Execution: workflow.stage4Execution || currentWorkflow.stage4Execution,
        stage5Monitoring: workflow.stage5Monitoring || currentWorkflow.stage5Monitoring,
        stage6Graduation: workflow.stage6Graduation || currentWorkflow.stage6Graduation,
      };
    }

    const activeWf = ensureCaseWorkflow(target);
    const reqStage = Number(body.stageNumber);
    const savedStageNum: CaseStage =
      reqStage >= 1 && reqStage <= 6 ? (reqStage as CaseStage) : target.stage;

    if (savedStageNum === 1 && !activeWf.stage1Intake.completedAt) {
      activeWf.stage1Intake.completedAt = nowTimestamp;
    } else if (savedStageNum === 2) {
      activeWf.stage2Assessment.completedAt = nowTimestamp;
    } else if (savedStageNum === 3) {
      activeWf.stage3Plan.completedAt = nowTimestamp;
    } else if (savedStageNum === 4) {
      activeWf.stage4Execution.completedAt = nowTimestamp;
      const latestService = activeWf.stage4Execution.deliveredServices[0];
      if (latestService) {
        target.lastSupportType = latestService.title;
        target.lastSupportDate = latestService.dateTime || nowTimestamp;
      }
    } else if (savedStageNum === 5) {
      activeWf.stage5Monitoring.completedAt = nowTimestamp;
      const latestVisit = activeWf.stage5Monitoring.visits[0];
      if (latestVisit) {
        target.lastSupportType = `پایش مستمر (${latestVisit.overallProgress})`;
        target.lastSupportDate = latestVisit.dateTime || nowTimestamp;
      }
    } else if (savedStageNum === 6) {
      activeWf.stage6Graduation.completedAt = nowTimestamp;
      if (
        activeWf.stage6Graduation.stableIncomeVerified &&
        activeWf.stage6Graduation.sixMonthFollowUpDone
      ) {
        target.stage = 6;
        target.coverageStatus = 'GRADUATED';
        target.lastSupportType = 'آیین تکریم و خروج موفق از چرخه حمایت';
        target.lastSupportDate = nowTimestamp;
      }
    }

    const advanceToNextStage = Boolean(body.advanceToNextStage);
    if (advanceToNextStage && target.stage < 6) {
      target.stage = Math.min(6, Math.max(target.stage, savedStageNum) + 1) as CaseStage;
      target.stageEnteredAt = new Date().toISOString();
      target.stageEnteredDate = nowDateOnly;
      if (target.stage === 6) {
        target.coverageStatus = 'GRADUATED';
        target.lastSupportType = 'آیین تکریم و خروج موفق از چرخه حمایت';
        target.lastSupportDate = nowTimestamp;
      }
    }

    target.lastUpdatedAt = nowTimestamp;

    const stageNames: Record<CaseStage, string> = {
      1: 'پذیرش و ارجاع',
      2: 'ارزیابی همه‌جانبه',
      3: 'برنامه مداخله',
      4: 'اجرا و خدمات',
      5: 'پایش مستمر',
      6: 'خروج موفق',
    };

    const eventSummary =
      String(body.summaryNote || '').trim() ||
      (advanceToNextStage
        ? `تکمیل اجزای مرحله ${savedStageNum} (${stageNames[savedStageNum]}) و ارتقا به مرحله ${target.stage}`
        : `ثبت و بروزرسانی اجزای مرحله ${savedStageNum} (${stageNames[savedStageNum]})`);

    target.history.unshift({
      id: `EVT-${Date.now()}`,
      timestamp: nowTimestamp,
      type: advanceToNextStage ? 'STAGE_CHANGED' : 'REASSESSED',
      summary: eventSummary,
      actorInstitution: activeInstitution,
      scoreTotal: target.score.total,
      stage: target.stage,
    });
    recordWorkerActivity(state, activeInstitution, advanceToNextStage ? 'both' : 'reviewed');

    const auditLogId = `AUD-${Math.floor(9150 + Math.random() * 800)}`;
    state.auditLogs.unshift({
      id: auditLogId,
      timestamp: nowTimestamp,
      actorRole: activeRole,
      actorInstitution: activeInstitution,
      action: advanceToNextStage ? 'STAGE_ADVANCED' : 'CASE_UPDATED',
      nationalIdHashPrefix: target.nationalIdHash.slice(0, 14),
      blockName: state.blocks.find((b) => b.id === target.blockId)?.name || 'نایسر',
      outcome: `${target.id}: ${eventSummary}`,
      immutable: true,
    });
    saveState(state);

    return jsonResponse({
      caseRecord: sanitizeCaseForRole(target, state.blocks, activeInstitution, activeRole),
      auditLogId,
    });
  }

  const caseUpdateMatch = pathname.match(/^\/api\/cases\/([^/]+)$/);
  if (caseUpdateMatch && upperMethod === 'PUT') {
    const id = decodeURIComponent(caseUpdateMatch[1]);
    const activeInstitution: InstitutionId = body.institution === 'edalat' ? 'edalat' : 'darolahsan';
    const activeRole: UserRole = (body.role as UserRole) || 'case_worker';

    if (activeRole === 'privacy_officer' || activeRole === 'system_admin') {
      return jsonResponse(
        {error: 'نقش ناظر امنیتی و مدیر سیستم مجاز به ویرایش محتوای اختصاصی پرونده نیست.'},
        403,
      );
    }

    const target = state.cases.find((c) => c.id === id);
    if (!target) {
      return jsonResponse({error: 'پرونده مورد نظر یافت نشد.'}, 404);
    }
    if (target.owningInstitution !== activeInstitution) {
      return jsonResponse(
        {error: 'مطابق تفکیک پایگاه داده، فقط مؤسسه متولی مجاز به بروزرسانی جزئیات این پرونده است.'},
        403,
      );
    }
    if (!body.consentSigned) {
      return jsonResponse(
        {error: 'تایید رضایت‌نامه آگاهانه برای ثبت بازبینی و بروزرسانی پرونده الزامی است.'},
        400,
      );
    }

    const previousScore = target.score.total;
    const previousStage = target.stage;
    const score = (body.score || {}) as Partial<WelfareScoreBreakdown>;
    const total = Math.min(
      100,
      Math.max(
        0,
        (score.familyStructure ?? target.score.familyStructure) +
          (score.housing ?? target.score.housing) +
          (score.livelihood ?? target.score.livelihood) +
          (score.health ?? target.score.health),
      ),
    );
    const urgencyTier = calculateTier(total);
    const {dateOnly, fullTimestamp} = buildVisitTimestamp(
      body.visitDate as string | undefined,
      body.visitTime as string | undefined,
    );

    const oldBlock = state.blocks.find((b) => b.id === target.blockId);
    const requestedBlock =
      typeof body.blockId === 'string' && body.blockId
        ? state.blocks.find((b) => b.id === body.blockId)
        : undefined;
    const nextBlock = requestedBlock || oldBlock || state.blocks[0];
    if (oldBlock && nextBlock && oldBlock.id !== nextBlock.id) {
      oldBlock.activeCasesCount = Math.max(0, oldBlock.activeCasesCount - 1);
      nextBlock.activeCasesCount += 1;
      target.blockId = nextBlock.id;
    }

    if (typeof body.fullName === 'string' && body.fullName.trim()) target.fullName = body.fullName.trim();
    if (typeof body.phone === 'string' && body.phone.trim()) target.phone = body.phone.trim();
    if (typeof body.address === 'string' && body.address.trim()) target.address = body.address.trim();
    if (typeof body.householdSize === 'number' && body.householdSize > 0) {
      target.householdSize = Math.min(15, Math.max(1, body.householdSize));
    }
    if (typeof body.headStatus === 'string' && body.headStatus) target.headStatus = body.headStatus;
    if (typeof body.housingType === 'string' && body.housingType) target.housingType = body.housingType;
    if (body.medicalNotes !== undefined) {
      target.medicalNotes = String(body.medicalNotes).trim() || 'مورد خاصی ثبت نشده است';
    }
    if (body.caseWorkerNote !== undefined) {
      target.caseWorkerNote = String(body.caseWorkerNote).trim() || target.caseWorkerNote;
    }

    target.score = {
      familyStructure: score.familyStructure ?? target.score.familyStructure,
      housing: score.housing ?? target.score.housing,
      livelihood: score.livelihood ?? target.score.livelihood,
      health: score.health ?? target.score.health,
      total,
    };
    target.urgencyTier = urgencyTier;
    target.servicePath =
      (body.servicePath as ServicePath) ||
      (urgencyTier === 'red' ? 'livelihood_medical' : 'empowerment_employment');

    if (body.assessmentDetails && typeof body.assessmentDetails === 'object') {
      const details = body.assessmentDetails as AssessmentFormDetails;
      target.assessmentDetails = {
        studentsCount: details.studentsCount,
        dependentsCount: details.dependentsCount,
        lacksUtilities: Boolean(details.lacksUtilities),
        incomeSourcePoints: details.incomeSourcePoints,
        hasUnemployedWorker: Boolean(details.hasUnemployedWorker),
        hasChronicDisease: Boolean(details.hasChronicDisease),
        childNutritionRisk: Boolean(details.childNutritionRisk),
        skillInterest: details.skillInterest?.trim() || 'نامشخص',
      };
    }

    const reqStage = Number(body.stage);
    if (reqStage >= 1 && reqStage <= 6) {
      if (reqStage !== previousStage) {
        target.stageEnteredAt = new Date().toISOString();
        target.stageEnteredDate = dateOnly;
      }
      target.stage = reqStage as CaseStage;
      target.coverageStatus = reqStage === 6 ? 'GRADUATED' : 'ACTIVE';
    }

    const supportActionLabel =
      String(body.lastSupportType || '').trim() || 'بازبینی دوره‌ای و بروزرسانی شاخص‌های معیشتی';
    target.lastSupportType = supportActionLabel;
    target.lastSupportDate = fullTimestamp;
    target.lastUpdatedAt = fullTimestamp;
    target.consentSigned = true;

    const scoreDeltaText =
      total === previousScore
        ? `ثابت (${total})`
        : total < previousScore
          ? `بهبود از ${previousScore} به ${total}`
          : `افزایش نیاز از ${previousScore} به ${total}`;

    target.history.unshift({
      id: `EVT-${Date.now()}`,
      timestamp: fullTimestamp,
      type: 'REASSESSED',
      summary: `بروزرسانی ارزیابی (${supportActionLabel}) · امتیاز: ${scoreDeltaText} · مرحله ${target.stage}`,
      actorInstitution: activeInstitution,
      scoreTotal: total,
      stage: target.stage,
    });
    recordWorkerActivity(
      state,
      activeInstitution,
      reqStage && reqStage !== previousStage ? 'both' : 'reviewed',
    );

    const auditLogId = `AUD-${Math.floor(9080 + Math.random() * 900)}`;
    state.auditLogs.unshift({
      id: auditLogId,
      timestamp: fullTimestamp,
      actorRole: activeRole,
      actorInstitution: activeInstitution,
      action: 'CASE_UPDATED',
      nationalIdHashPrefix: target.nationalIdHash.slice(0, 14),
      blockName: nextBlock.name,
      outcome: `بروزرسانی پرونده ${target.id} (${scoreDeltaText} · مرحله ${target.stage})`,
      immutable: true,
    });
    saveState(state);

    return jsonResponse({
      caseRecord: sanitizeCaseForRole(target, state.blocks, activeInstitution, activeRole),
      auditLogId,
      previousScore,
      newScore: total,
    });
  }

  // 8. Audit Logs
  if (pathname === '/api/audit-logs' && upperMethod === 'GET') {
    return jsonResponse({logs: state.auditLogs});
  }

  // 9. SHG Microfinance
  if (pathname === '/api/shg' && upperMethod === 'GET') {
    return jsonResponse({groups: state.shgGroups});
  }

  const shgMatch = pathname.match(/^\/api\/shg\/([^/]+)\/members$/);
  if (shgMatch && upperMethod === 'POST') {
    const groupId = decodeURIComponent(shgMatch[1]);
    const group = state.shgGroups.find((g) => g.id === groupId);
    if (!group) {
      return jsonResponse({error: 'صندوق مورد نظر یافت نشد.'}, 404);
    }
    const memberAlias = String(body.memberAlias || '').trim();
    const guarantor1 = String(body.guarantor1 || '').trim();
    const guarantor2 = String(body.guarantor2 || '').trim();
    if (!memberAlias || !guarantor1 || !guarantor2) {
      return jsonResponse({error: 'نام عضو و دو ضامن اجتماعی درون‌گروهی الزامی است.'}, 400);
    }

    const saving = Math.max(0, Number(body.monthlySaving) || 350000);
    const loan = Math.max(0, Number(body.loanAmount) || 0);
    const ratioMultiplier = group.matchingRatio === '2:1' ? 2 : 1;

    group.members.push({
      id: `m-${Date.now()}`,
      memberAlias,
      roleInGroup: 'عضو',
      monthlySaving: saving,
      totalSaved: saving,
      activeLoanAmount: loan,
      repaidAmount: 0,
      businessType: String(body.businessType || '').trim() || 'مشاغل خانگی زودبازده',
      guarantors: [guarantor1, guarantor2],
      repaymentStatus: 'در جریان',
    });
    group.membersTotalSavings += saving;
    group.charityMatchingFund += saving * ratioMultiplier;

    state.auditLogs.unshift({
      id: `AUD-${Math.floor(9200 + Math.random() * 700)}`,
      timestamp: formatPersianTimestamp(),
      actorRole: 'case_worker',
      actorInstitution: group.sponsorInstitution,
      action: 'SHG_TRANSACTION',
      nationalIdHashPrefix: pureSha256Hex(memberAlias).slice(0, 14),
      blockName: group.blockName,
      outcome: `ثبت عضو/تسهیلات جدید در ${group.name} با ضمانت اجتماعی دو عضو`,
      immutable: true,
    });
    saveState(state);

    return jsonResponse({group}, 201);
  }

  // 10. 6-month analytical reports
  if (pathname === '/api/reports' && upperMethod === 'GET') {
    return jsonResponse(buildReportsPayload(state, searchParams));
  }

  // 11. AI endpoints fallback notice
  if (pathname.startsWith('/api/ai/')) {
    return jsonResponse(
      {
        error:
          'سرویس تحلیل هوشمند نیاز به کلید API سمت سرور دارد و در نسخه استاتیک بدون سرور پشتیبانی غیرفعال است؛ سایر بخش‌های سامانه به‌صورت کامل فعال هستند.',
      },
      503,
    );
  }

  return jsonResponse({error: 'مسیر درخواستی یافت نشد.'}, 404);
}

let installed = false;

const nativeFetch: typeof fetch | null =
  typeof window !== 'undefined' && typeof window.fetch === 'function'
    ? window.fetch.bind(window)
    : typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
      ? globalThis.fetch.bind(globalThis)
      : null;

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost';

  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(rawUrl, origin);
  } catch {
    parsedUrl = null;
  }

  const isSameOriginApi =
    parsedUrl !== null &&
    parsedUrl.origin === origin &&
    parsedUrl.pathname.startsWith('/api/');

  if (!isSameOriginApi || !parsedUrl) {
    if (!nativeFetch) {
      throw new Error('Fetch API is not available in this environment.');
    }
    return nativeFetch(input, init);
  }

  const method =
    init?.method ||
    (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET');
  const body =
    init?.body ??
    (typeof Request !== 'undefined' && input instanceof Request
      ? await input.clone().text()
      : undefined);

  if (!nativeFetch) {
    return handleLocalApiRequest(parsedUrl.pathname, parsedUrl.searchParams, method, body);
  }

  try {
    const response = await nativeFetch(input, init);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // If Express server responded with JSON (2xx or structured 4xx/5xx error JSON), use it directly.
    if (contentType.includes('application/json')) {
      return response;
    }

    // Otherwise (e.g., Vercel static hosting returning 404/405 or SPA index.html), handle in-browser.
    return handleLocalApiRequest(parsedUrl.pathname, parsedUrl.searchParams, method, body);
  } catch (err) {
    // Do not swallow caller-initiated request aborts (e.g., debounced search cancellation)
    if ((err as {name?: string})?.name === 'AbortError' || init?.signal?.aborted) {
      throw err;
    }
    return handleLocalApiRequest(parsedUrl.pathname, parsedUrl.searchParams, method, body);
  }
}

function tryOverrideFetch(target: unknown, replacement: typeof fetch): boolean {
  if (!target || (typeof target !== 'object' && typeof target !== 'function')) {
    return false;
  }
  try {
    Object.defineProperty(target, 'fetch', {
      value: replacement,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return true;
  } catch {
    try {
      (target as {fetch: typeof fetch}).fetch = replacement;
      return true;
    } catch {
      return false;
    }
  }
}

export function installStaticApiFallback() {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;

  if ((window.fetch as unknown) !== apiFetch) {
    tryOverrideFetch(window, apiFetch);
  }
  if (
    typeof globalThis !== 'undefined' &&
    (globalThis as unknown) !== window &&
    (globalThis.fetch as unknown) !== apiFetch
  ) {
    tryOverrideFetch(globalThis, apiFetch);
  }
}

