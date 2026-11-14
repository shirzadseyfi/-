import crypto from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';
import {createServer as createViteServer} from 'vite';
import type {
  AiPrioritizationFocus,
  AiPrioritizationResult,
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
} from './src/types.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Secret salt kept strictly on the server (never exposed to browser)
const SHARED_SECRET_SALT =
  process.env.SHARED_SECRET_SALT || 'DarolAhsan_Adalat_Secure_Salt_Key_1405';

function normalizeDigits(input: string): string {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return input
    .trim()
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/\D/g, '');
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

function maskNationalId(nationalId: string): string {
  const clean = normalizeDigits(nationalId);
  if (clean.length < 7) return '***';
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}

function hashNationalId(nationalId: string): string {
  const cleanId = normalizeDigits(nationalId);
  const saltedValue = `${cleanId}${SHARED_SECRET_SALT}`;
  return crypto.createHash('sha256').update(saltedValue, 'utf8').digest('hex');
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

// Seeded Naysar Blocks
const naysarBlocks: NaysarBlock[] = [
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
  // Dedicated Private Data (strictly isolated per institution)
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

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const initialCases: InternalCaseRecord[] = [
  {
    id: 'NY-1405-101',
    nationalId: '0012345678',
    nationalIdHash: hashNationalId('0012345678'),
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
    nationalIdHash: hashNationalId('3732104589'),
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
    nationalIdHash: hashNationalId('3735551290'),
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
    nationalIdHash: hashNationalId('3738890123'),
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
    nationalIdHash: hashNationalId('3734419902'),
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
    nationalIdHash: hashNationalId('3736621044'),
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
    nationalIdHash: hashNationalId('3731188990'),
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
    nationalIdHash: hashNationalId('3739944112'),
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
    nationalIdHash: hashNationalId('3737712345'),
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
    nationalIdHash: hashNationalId('3733349081'),
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
    nationalIdHash: hashNationalId('3739087612'),
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
    nationalIdHashPrefix: hashNationalId('0012345678').slice(0, 14),
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
    nationalIdHashPrefix: hashNationalId('3736621044').slice(0, 14),
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
    nationalIdHashPrefix: hashNationalId('3735551290').slice(0, 14),
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
    nationalIdHashPrefix: hashNationalId('3734419902').slice(0, 14),
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

let overlapsPreventedCount = 19;

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
  },
];

const workerLiveDeltas: Record<
  InstitutionId,
  {reviewedDelta: number; transitionDelta: number}
> = {
  darolahsan: {reviewedDelta: 0, transitionDelta: 0},
  edalat: {reviewedDelta: 0, transitionDelta: 0},
};

function recordWorkerActivity(
  institution: InstitutionId,
  kind: 'reviewed' | 'transition' | 'both',
) {
  if (kind === 'reviewed' || kind === 'both') {
    workerLiveDeltas[institution].reviewedDelta += 1;
  }
  if (kind === 'transition' || kind === 'both') {
    workerLiveDeltas[institution].transitionDelta += 1;
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
                amountOrQuantity: record.servicePath === 'livelihood_medical' ? '۱ بسته کامل + دارو' : 'تسهیلات قرض‌الحسنه',
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
    (/اجاره سنگین|غیررسمی|فاقد گرمایش/.test(record.housingType) ? 20 : record.housingType.includes('استیجاری') ? 10 : 0) +
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
  requesterInstitution: InstitutionId,
  requesterRole: UserRole,
): CaseRecordView {
  const block = naysarBlocks.find((b) => b.id === record.blockId);
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

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Dashboard Summary & Blocks
  app.get('/api/overview', (req, res) => {
    const institution = (req.query.institution as InstitutionId) || 'darolahsan';
    const role = (req.query.role as UserRole) || 'case_worker';

    const summary: DashboardSummary = {
      totalActiveCases: initialCases.filter((c) => c.coverageStatus !== 'GRADUATED').length,
      overlapsPrevented: overlapsPreventedCount,
      avgInquiryMs: 42,
      graduatedFamilies: initialCases.filter((c) => c.coverageStatus === 'GRADUATED').length,
      darolahsanCases: initialCases.filter((c) => c.owningInstitution === 'darolahsan').length,
      edalatCases: initialCases.filter((c) => c.owningInstitution === 'edalat').length,
      redTierCount: initialCases.filter((c) => c.urgencyTier === 'red').length,
      yellowTierCount: initialCases.filter((c) => c.urgencyTier === 'yellow').length,
      greenTierCount: initialCases.filter((c) => c.urgencyTier === 'green').length,
    };

    const cases = initialCases.map((c) => sanitizeCaseForRole(c, institution, role));
    res.json({summary, blocks: naysarBlocks, cases});
  });

  // 1a. Probabilistic 6-Stage Workflow Forecast (Discrete-Time Markov Chain + Monte Carlo)
  app.get('/api/overview/stage-forecast', (req, res) => {
    const instParam = req.query.institution;
    const institutionFilter: InstitutionId | 'all' =
      instParam === 'darolahsan' || instParam === 'edalat' ? instParam : 'all';

    const scenarioParam = req.query.scenario;
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

    // Baseline stage counts calibrated to Naysar block cohorts + live deltas from initialCases
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
        ? initialCases
        : initialCases.filter((c) => c.owningInstitution === institutionFilter);

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

    // Calibrate worker velocity factor from monthly performance + live deltas
    const scopedWorkers = caseWorkerMonthlySeed.filter(
      (w) => institutionFilter === 'all' || w.institution === institutionFilter,
    );
    const totalLiveTransitions =
      institutionFilter === 'all'
        ? workerLiveDeltas.darolahsan.transitionDelta + workerLiveDeltas.edalat.transitionDelta
        : workerLiveDeltas[institutionFilter].transitionDelta;
    const avgWorkerDays =
      scopedWorkers.reduce((s, w) => s + w.avgTransitionDays, 0) / Math.max(1, scopedWorkers.length);
    const velocityBonus = Math.min(0.08, Math.max(-0.04, (8.0 - avgWorkerDays) * 0.015 + totalLiveTransitions * 0.008));

    // Base 6x6 Discrete-Time Markov Transition Matrix (rows sum to 1.0)
    // Row i -> probability of ending next month in stage j
    const matrix: number[][] = [
      // From Stage 1 (Intake)
      [0.18, 0.64, 0.18, 0.0, 0.0, 0.0],
      // From Stage 2 (Assessment)
      [0.0, 0.34, 0.54, 0.12, 0.0, 0.0],
      // From Stage 3 (Intervention Plan)
      [0.0, 0.0, 0.38, 0.55, 0.07, 0.0],
      // From Stage 4 (Execution & Services)
      [0.0, 0.0, 0.0, 0.48, 0.44, 0.08],
      // From Stage 5 (Monitoring)
      [0.0, 0.0, 0.0, 0.10, 0.52, 0.38],
      // From Stage 6 (Graduation - absorbing with minor re-entry risk)
      [0.0, 0.0, 0.0, 0.0, 0.04, 0.96],
    ];

    // Apply live stagnation drag on stages 2..4 if stagnant cases accumulate
    for (const idx of [1, 2, 3]) {
      const drag = Math.min(0.08, stagnantByStage[idx] * 0.025) - velocityBonus;
      const clampedDrag = Math.max(-0.08, Math.min(0.08, drag));
      matrix[idx][idx] = Math.max(0.12, Math.min(0.68, matrix[idx][idx] + clampedDrag));
      matrix[idx][idx + 1] = Math.max(0.15, matrix[idx][idx + 1] - clampedDrag);
    }

    // Apply scenario adjustments
    let newIntakeMean =
      institutionFilter === 'all' ? 14 : institutionFilter === 'darolahsan' ? 8 : 6;
    let scenarioLabel = 'سناریوی پایه (روند ۳۰ روز اخیر)';

    if (scenario === 'accelerated_funding') {
      scenarioLabel = 'تزریق بودجه و تسریع (+۳۰٪ ظرفیت)';
      newIntakeMean = Math.round(newIntakeMean * 1.08);
      // Faster clearance from Stage 1, 2, 3, 4 and fewer relapses in Stage 5
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

    // Normalize every row strictly to 1.0
    for (let r = 0; r < 6; r += 1) {
      const rowSum = matrix[r].reduce((a, b) => a + b, 0);
      if (rowSum > 0) {
        matrix[r] = matrix[r].map((v) => v / rowSum);
      }
    }

    // Seeded PRNG (Mulberry32) so projections are reproducible for identical state & scenario
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

    // Build cumulative transition distributions per row
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

      // New intake entering Stage 1 (80%) and urgent direct triage to Stage 2 (20%)
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

    // Deterministic expected inflow/outflow per stage
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

    // Identify primary bottleneck among active workflow stages (1..5)
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
    const totalRequiredWorkerHours = stages.reduce(
      (sum, s) => sum + s.requiredWorkerHours,
      0,
    );

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

    const payload: StageForecastPayload = {
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

    res.json(payload);
  });

  // 1b. Privacy-Preserving Overview Text & Partial National ID Search
  app.get('/api/cases/search', (req, res) => {
    const institution = (req.query.institution as InstitutionId) || 'darolahsan';
    const role = (req.query.role as UserRole) || 'case_worker';
    const rawQuery = String(req.query.q || '').trim();

    if (!rawQuery) {
      return res.json({matchedIds: initialCases.map((c) => c.id)});
    }

    const qNormalized = normalizeSearchText(rawQuery);
    const qDigits = normalizeDigits(rawQuery);
    const exactNationalIdHash = qDigits.length === 10 ? hashNationalId(qDigits) : null;

    const matchedIds = initialCases
      .filter((record) => {
        const canViewDedicated =
          role !== 'privacy_officer' &&
          role !== 'system_admin' &&
          record.owningInstitution === institution;

        const block = naysarBlocks.find((b) => b.id === record.blockId);
        const matchesPublicMeta =
          normalizeSearchText(record.id).includes(qNormalized) ||
          record.nationalIdHash.toLowerCase().includes(qNormalized) ||
          (block ? normalizeSearchText(block.name).includes(qNormalized) : false) ||
          (exactNationalIdHash ? record.nationalIdHash === exactNationalIdHash : false);

        if (matchesPublicMeta) return true;

        if (!canViewDedicated) {
          return false;
        }

        const matchesName = normalizeSearchText(record.fullName).includes(qNormalized);
        const matchesHeadStatus = normalizeSearchText(record.headStatus).includes(qNormalized);
        const matchesPartialNid = qDigits.length > 0 && record.nationalId.includes(qDigits);

        return matchesName || matchesHeadStatus || matchesPartialNid;
      })
      .map((record) => record.id);

    res.json({matchedIds});
  });

  // 2. Privacy-Preserving SHA-256 + Salt National ID Inquiry
  app.post('/api/inquiry', (req, res) => {
    const {nationalId, institution, role, blockId, needsMedicalSpecial} = req.body as {
      nationalId?: string;
      institution?: InstitutionId;
      role?: UserRole;
      blockId?: string;
      needsMedicalSpecial?: boolean;
    };

    const cleanId = normalizeDigits(nationalId || '');
    if (cleanId.length !== 10) {
      return res.status(400).json({
        error: 'کدملی باید دقیقاً ۱۰ رقم معتبر باشد.',
      });
    }

    const activeInstitution: InstitutionId = institution === 'edalat' ? 'edalat' : 'darolahsan';
    const activeRole: UserRole = role || 'case_worker';
    const computedHash = hashNationalId(cleanId);
    const block = naysarBlocks.find((b) => b.id === blockId) || naysarBlocks[0];
    const matched = initialCases.find((c) => c.nationalIdHash === computedHash);

    const logId = `AUD-${Math.floor(9042 + Math.random() * 900)}`;

    if (!matched) {
      auditLogs.unshift({
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

      const response: InquiryResponse = {
        status: 'CLEAN',
        nationalIdHashPreview: computedHash,
        auditLogId: logId,
      };
      return res.json(response);
    }

    const isSame = matched.owningInstitution === activeInstitution;
    if (!isSame) {
      overlapsPreventedCount += 1;
    }

    const matchedBlock = naysarBlocks.find((b) => b.id === matched.blockId) || block;
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

    auditLogs.unshift({
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

    return res.json(response);
  });

  // 3. Create New Case with Informed Consent + 100-point Scoring + Exact Timestamp
  app.post('/api/cases', (req, res) => {
    const {
      nationalId,
      institution,
      role,
      blockId,
      fullName,
      phone,
      address,
      householdSize,
      headStatus,
      housingType,
      medicalNotes,
      caseWorkerNote,
      lastSupportType,
      visitDate,
      visitTime,
      stage,
      consentSigned,
      score,
      servicePath,
      assessmentDetails,
    } = req.body as {
      nationalId: string;
      institution: InstitutionId;
      role?: UserRole;
      blockId: string;
      fullName: string;
      phone: string;
      address: string;
      householdSize: number;
      headStatus: string;
      housingType: string;
      medicalNotes: string;
      caseWorkerNote?: string;
      lastSupportType?: string;
      visitDate?: string;
      visitTime?: string;
      stage?: CaseStage;
      consentSigned: boolean;
      score: WelfareScoreBreakdown;
      servicePath: ServicePath;
      assessmentDetails?: AssessmentFormDetails;
    };

    if (!consentSigned) {
      return res.status(400).json({
        error: 'ثبت پرونده بدون تکمیل و تایید فرم رضایت‌نامه آگاهانه امکان‌پذیر نیست.',
      });
    }

    const cleanId = normalizeDigits(nationalId || '');
    if (cleanId.length !== 10 || !fullName?.trim()) {
      return res.status(400).json({
        error: 'لطفاً کدملی ۱۰ رقمی و نام سرپرست خانوار را به درستی وارد نمایید.',
      });
    }

    const computedHash = hashNationalId(cleanId);
    const duplicate = initialCases.find((c) => c.nationalIdHash === computedHash);
    if (duplicate) {
      return res.status(409).json({
        error: `این کدملی پیش‌تر در سامانه (${getInstitutionName(duplicate.owningInstitution)}) ثبت شده است.`,
      });
    }

    const total = Math.min(
      100,
      Math.max(
        0,
        (score?.familyStructure || 0) +
          (score?.housing || 0) +
          (score?.livelihood || 0) +
          (score?.health || 0),
      ),
    );
    const urgencyTier = calculateTier(total);
    const newId = `NY-1405-${107 + initialCases.length}`;
    const activeInstitution: InstitutionId = institution === 'edalat' ? 'edalat' : 'darolahsan';
    const block = naysarBlocks.find((b) => b.id === blockId) || naysarBlocks[0];
    const {dateOnly, fullTimestamp} = buildVisitTimestamp(visitDate, visitTime);
    const initialStage: CaseStage = stage && stage >= 1 && stage <= 6 ? stage : 2;
    const supportLabel = lastSupportType?.trim() || 'ارزیابی اولیه و تشکیل پرونده معیشتی';
    const tierLabel = urgencyTier === 'red' ? 'قرمز' : urgencyTier === 'yellow' ? 'زرد' : 'سبز';

    const newRecord: InternalCaseRecord = {
      id: newId,
      nationalId: cleanId,
      nationalIdHash: computedHash,
      owningInstitution: activeInstitution,
      blockId: block.id,
      coverageStatus: initialStage === 6 ? 'GRADUATED' : 'ACTIVE',
      urgencyTier,
      stage: initialStage,
      servicePath: servicePath || (urgencyTier === 'red' ? 'livelihood_medical' : 'empowerment_employment'),
      collaborationModel: 'single_ownership',
      lastSupportDate: fullTimestamp,
      lastSupportType: supportLabel,
      registeredAt: fullTimestamp,
      lastUpdatedAt: fullTimestamp,
      stageEnteredAt: new Date().toISOString(),
      stageEnteredDate: dateOnly,
      score: {
        familyStructure: score?.familyStructure || 0,
        housing: score?.housing || 0,
        livelihood: score?.livelihood || 0,
        health: score?.health || 0,
        total,
      },
      consentSigned: true,
      fullName: fullName.trim(),
      phone: phone?.trim() || 'ثبت‌نشده',
      address: address?.trim() || block.name,
      householdSize: Number(householdSize) || 1,
      headStatus: headStatus || 'عادی',
      housingType: housingType || 'استیجاری با اجاره سنگین',
      medicalNotes: medicalNotes?.trim() || 'مورد خاصی ثبت نشده است',
      caseWorkerNote:
        caseWorkerNote?.trim() || 'پرونده پس از اخذ رضایت‌نامه آگاهانه و استعلام هش کدملی ایجاد شد.',
      assessmentDetails: {
        studentsCount: assessmentDetails?.studentsCount ?? 0,
        dependentsCount: assessmentDetails?.dependentsCount ?? 0,
        lacksUtilities: Boolean(assessmentDetails?.lacksUtilities),
        incomeSourcePoints: assessmentDetails?.incomeSourcePoints ?? 14,
        hasUnemployedWorker: Boolean(assessmentDetails?.hasUnemployedWorker),
        hasChronicDisease: Boolean(assessmentDetails?.hasChronicDisease),
        childNutritionRisk: Boolean(assessmentDetails?.childNutritionRisk),
        skillInterest: assessmentDetails?.skillInterest?.trim() || 'نامشخص',
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

    initialCases.unshift(newRecord);
    block.activeCasesCount += 1;
    recordWorkerActivity(activeInstitution, 'reviewed');

    const auditLogId = `AUD-${Math.floor(9050 + Math.random() * 900)}`;
    auditLogs.unshift({
      id: auditLogId,
      timestamp: fullTimestamp,
      actorRole: role || 'case_worker',
      actorInstitution: activeInstitution,
      action: 'CASE_CREATED',
      nationalIdHashPrefix: computedHash.slice(0, 14),
      blockName: block.name,
      outcome: `ثبت پرونده جدید ${newId} با رضایت‌نامه آگاهانه (امتیاز ${total} - ${tierLabel})`,
      immutable: true,
    });

    res.status(201).json({
      caseRecord: sanitizeCaseForRole(newRecord, activeInstitution, role || 'case_worker'),
      auditLogId,
    });
  });

  // 3b. Update Existing Case Assessment, Details, Stage & History
  app.put('/api/cases/:id', (req, res) => {
    const {id} = req.params;
    const {
      institution,
      role,
      blockId,
      fullName,
      phone,
      address,
      householdSize,
      headStatus,
      housingType,
      medicalNotes,
      caseWorkerNote,
      lastSupportType,
      visitDate,
      visitTime,
      stage,
      consentSigned,
      score,
      servicePath,
      assessmentDetails,
    } = req.body as {
      institution?: InstitutionId;
      role?: UserRole;
      blockId?: string;
      fullName?: string;
      phone?: string;
      address?: string;
      householdSize?: number;
      headStatus?: string;
      housingType?: string;
      medicalNotes?: string;
      caseWorkerNote?: string;
      lastSupportType?: string;
      visitDate?: string;
      visitTime?: string;
      stage?: CaseStage;
      consentSigned?: boolean;
      score?: WelfareScoreBreakdown;
      servicePath?: ServicePath;
      assessmentDetails?: AssessmentFormDetails;
    };

    const activeInstitution: InstitutionId = institution === 'edalat' ? 'edalat' : 'darolahsan';
    const activeRole: UserRole = role || 'case_worker';

    if (activeRole === 'privacy_officer' || activeRole === 'system_admin') {
      return res.status(403).json({
        error: 'نقش ناظر امنیتی و مدیر سیستم مجاز به ویرایش محتوای اختصاصی پرونده نیست.',
      });
    }

    const target = initialCases.find((c) => c.id === id);
    if (!target) {
      return res.status(404).json({error: 'پرونده مورد نظر یافت نشد.'});
    }
    if (target.owningInstitution !== activeInstitution) {
      return res.status(403).json({
        error: 'مطابق تفکیک پایگاه داده، فقط مؤسسه متولی مجاز به بروزرسانی جزئیات این پرونده است.',
      });
    }
    if (!consentSigned) {
      return res.status(400).json({
        error: 'تایید رضایت‌نامه آگاهانه برای ثبت بازبینی و بروزرسانی پرونده الزامی است.',
      });
    }

    const previousScore = target.score.total;
    const previousStage = target.stage;

    const total = Math.min(
      100,
      Math.max(
        0,
        (score?.familyStructure ?? target.score.familyStructure) +
          (score?.housing ?? target.score.housing) +
          (score?.livelihood ?? target.score.livelihood) +
          (score?.health ?? target.score.health),
      ),
    );
    const urgencyTier = calculateTier(total);
    const {dateOnly, fullTimestamp} = buildVisitTimestamp(visitDate, visitTime);

    const oldBlock = naysarBlocks.find((b) => b.id === target.blockId);
    const nextBlock = (blockId && naysarBlocks.find((b) => b.id === blockId)) || oldBlock || naysarBlocks[0];
    if (oldBlock && nextBlock && oldBlock.id !== nextBlock.id) {
      oldBlock.activeCasesCount = Math.max(0, oldBlock.activeCasesCount - 1);
      nextBlock.activeCasesCount += 1;
      target.blockId = nextBlock.id;
    }

    if (fullName?.trim()) target.fullName = fullName.trim();
    if (phone?.trim()) target.phone = phone.trim();
    if (address?.trim()) target.address = address.trim();
    if (typeof householdSize === 'number' && householdSize > 0) {
      target.householdSize = Math.min(15, Math.max(1, householdSize));
    }
    if (headStatus) target.headStatus = headStatus;
    if (housingType) target.housingType = housingType;
    if (medicalNotes !== undefined) {
      target.medicalNotes = medicalNotes.trim() || 'مورد خاصی ثبت نشده است';
    }
    if (caseWorkerNote !== undefined) {
      target.caseWorkerNote = caseWorkerNote.trim() || target.caseWorkerNote;
    }

    target.score = {
      familyStructure: score?.familyStructure ?? target.score.familyStructure,
      housing: score?.housing ?? target.score.housing,
      livelihood: score?.livelihood ?? target.score.livelihood,
      health: score?.health ?? target.score.health,
      total,
    };
    target.urgencyTier = urgencyTier;
    target.servicePath =
      servicePath || (urgencyTier === 'red' ? 'livelihood_medical' : 'empowerment_employment');

    if (assessmentDetails) {
      target.assessmentDetails = {
        studentsCount: assessmentDetails.studentsCount,
        dependentsCount: assessmentDetails.dependentsCount,
        lacksUtilities: Boolean(assessmentDetails.lacksUtilities),
        incomeSourcePoints: assessmentDetails.incomeSourcePoints,
        hasUnemployedWorker: Boolean(assessmentDetails.hasUnemployedWorker),
        hasChronicDisease: Boolean(assessmentDetails.hasChronicDisease),
        childNutritionRisk: Boolean(assessmentDetails.childNutritionRisk),
        skillInterest: assessmentDetails.skillInterest?.trim() || 'نامشخص',
      };
    }

    if (stage && stage >= 1 && stage <= 6) {
      if (stage !== previousStage) {
        target.stageEnteredAt = new Date().toISOString();
        target.stageEnteredDate = dateOnly;
      }
      target.stage = stage;
      target.coverageStatus = stage === 6 ? 'GRADUATED' : 'ACTIVE';
    }

    const supportActionLabel =
      lastSupportType?.trim() || 'بازبینی دوره‌ای و بروزرسانی شاخص‌های معیشتی';
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
      activeInstitution,
      stage && stage !== previousStage ? 'both' : 'reviewed',
    );

    const auditLogId = `AUD-${Math.floor(9080 + Math.random() * 900)}`;
    auditLogs.unshift({
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

    return res.json({
      caseRecord: sanitizeCaseForRole(target, activeInstitution, activeRole),
      auditLogId,
      previousScore,
      newScore: total,
    });
  });

  // 4. Advance Case Stage or Record Collaboration Resolution
  app.patch('/api/cases/:id/stage', (req, res) => {
    const {id} = req.params;
    const {stage, institution, role, collaborationModel} = req.body as {
      stage?: CaseStage;
      institution?: InstitutionId;
      role?: UserRole;
      collaborationModel?: CollaborationModel;
    };

    const target = initialCases.find((c) => c.id === id);
    if (!target) {
      return res.status(404).json({error: 'پرونده مورد نظر یافت نشد.'});
    }

    const nowTimestamp = formatPersianTimestamp();
    const nowDateOnly = formatPersianDateOnly();

    if (stage && stage >= 1 && stage <= 6) {
      target.stage = stage;
      target.stageEnteredAt = new Date().toISOString();
      target.stageEnteredDate = nowDateOnly;
      target.lastUpdatedAt = nowTimestamp;
      if (stage === 6) {
        target.coverageStatus = 'GRADUATED';
        target.lastSupportType = 'آیین تکریم و خروج موفق از چرخه حمایت';
        target.lastSupportDate = nowTimestamp;
      }
    }

    if (collaborationModel) {
      target.collaborationModel = collaborationModel;
      target.lastUpdatedAt = nowTimestamp;
      if (collaborationModel === 'complementary_support') {
        target.secondaryInstitution = target.owningInstitution === 'darolahsan' ? 'edalat' : 'darolahsan';
        target.coverageStatus = 'ACTIVE';
      }
    }

    const block = naysarBlocks.find((b) => b.id === target.blockId);
    const actorInst = institution || target.owningInstitution;
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
    recordWorkerActivity(actorInst, stage ? 'transition' : 'reviewed');

    auditLogs.unshift({
      id: `AUD-${Math.floor(9100 + Math.random() * 800)}`,
      timestamp: nowTimestamp,
      actorRole: role || 'case_worker',
      actorInstitution: actorInst,
      action: collaborationModel ? 'CONFLICT_RESOLVED' : 'STAGE_ADVANCED',
      nationalIdHashPrefix: target.nationalIdHash.slice(0, 14),
      blockName: block?.name || 'نایسر',
      outcome: outcomeSummary,
      immutable: true,
    });

    res.json({
      caseRecord: sanitizeCaseForRole(
        target,
        actorInst,
        role || 'case_worker',
      ),
    });
  });

  // 4b. Save Complete Step-by-Step Case Management Workflow Stage Data for a Beneficiary
  app.put('/api/cases/:id/workflow', (req, res) => {
    const {id} = req.params;
    const {
      institution,
      role,
      stageNumber,
      workflow,
      advanceToNextStage,
      actionDateTime,
      summaryNote,
    } = req.body as {
      institution?: InstitutionId;
      role?: UserRole;
      stageNumber?: CaseStage;
      workflow?: CaseManagementWorkflow;
      advanceToNextStage?: boolean;
      actionDateTime?: string;
      summaryNote?: string;
    };

    const activeInstitution: InstitutionId = institution === 'edalat' ? 'edalat' : 'darolahsan';
    const activeRole: UserRole = role || 'case_worker';

    if (activeRole === 'privacy_officer' || activeRole === 'system_admin') {
      return res.status(403).json({
        error: 'نقش ناظر امنیتی و مدیر سیستم مجاز به ثبت یا ویرایش اجزای پرونده نیست.',
      });
    }

    const target = initialCases.find((c) => c.id === id);
    if (!target) {
      return res.status(404).json({error: 'پرونده مورد نظر یافت نشد.'});
    }
    if (target.owningInstitution !== activeInstitution) {
      return res.status(403).json({
        error: 'مطابق تفکیک پایگاه داده، فقط مؤسسه متولی مجاز به ویرایش مراحل مدیریت مورد این پرونده است.',
      });
    }

    const nowTimestamp = actionDateTime?.trim() || formatPersianTimestamp();
    const nowDateOnly = nowTimestamp.split('·')[0]?.trim() || formatPersianDateOnly();
    const currentWorkflow = ensureCaseWorkflow(target);

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
    const savedStageNum: CaseStage =
      stageNumber && stageNumber >= 1 && stageNumber <= 6 ? stageNumber : target.stage;

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
      summaryNote?.trim() ||
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
    recordWorkerActivity(activeInstitution, advanceToNextStage ? 'both' : 'reviewed');

    const auditLogId = `AUD-${Math.floor(9150 + Math.random() * 800)}`;
    auditLogs.unshift({
      id: auditLogId,
      timestamp: nowTimestamp,
      actorRole: activeRole,
      actorInstitution: activeInstitution,
      action: advanceToNextStage ? 'STAGE_ADVANCED' : 'CASE_UPDATED',
      nationalIdHashPrefix: target.nationalIdHash.slice(0, 14),
      blockName: naysarBlocks.find((b) => b.id === target.blockId)?.name || 'نایسر',
      outcome: `${target.id}: ${eventSummary}`,
      immutable: true,
    });

    return res.json({
      caseRecord: sanitizeCaseForRole(target, activeInstitution, activeRole),
      auditLogId,
    });
  });

  // 5. Audit Logs (Privacy Officer & Admin View)
  app.get('/api/audit-logs', (_req, res) => {
    res.json({logs: auditLogs});
  });

  // 6. Self-Help Microfinance Groups (SHG)
  app.get('/api/shg', (_req, res) => {
    res.json({groups: shgGroups});
  });

  app.post('/api/shg/:groupId/members', (req, res) => {
    const {groupId} = req.params;
    const {memberAlias, monthlySaving, loanAmount, businessType, guarantor1, guarantor2} = req.body as {
      memberAlias: string;
      monthlySaving: number;
      loanAmount: number;
      businessType: string;
      guarantor1: string;
      guarantor2: string;
    };

    const group = shgGroups.find((g) => g.id === groupId);
    if (!group) {
      return res.status(404).json({error: 'صندوق مورد نظر یافت نشد.'});
    }
    if (!memberAlias?.trim() || !guarantor1?.trim() || !guarantor2?.trim()) {
      return res.status(400).json({error: 'نام عضو و دو ضامن اجتماعی درون‌گروهی الزامی است.'});
    }

    const saving = Math.max(0, Number(monthlySaving) || 350000);
    const loan = Math.max(0, Number(loanAmount) || 0);
    const ratioMultiplier = group.matchingRatio === '2:1' ? 2 : 1;

    group.members.push({
      id: `m-${Date.now()}`,
      memberAlias: memberAlias.trim(),
      roleInGroup: 'عضو',
      monthlySaving: saving,
      totalSaved: saving,
      activeLoanAmount: loan,
      repaidAmount: 0,
      businessType: businessType?.trim() || 'مشاغل خانگی زودبازده',
      guarantors: [guarantor1.trim(), guarantor2.trim()],
      repaymentStatus: 'در جریان',
    });

    group.membersTotalSavings += saving;
    group.charityMatchingFund += saving * ratioMultiplier;

    auditLogs.unshift({
      id: `AUD-${Math.floor(9200 + Math.random() * 700)}`,
      timestamp: formatPersianTimestamp(),
      actorRole: 'case_worker',
      actorInstitution: group.sponsorInstitution,
      action: 'SHG_TRANSACTION',
      nationalIdHashPrefix: crypto
        .createHash('sha256')
        .update(memberAlias)
        .digest('hex')
        .slice(0, 14),
      blockName: group.blockName,
      outcome: `ثبت عضو/تسهیلات جدید در ${group.name} با ضمانت اجتماعی دو عضو`,
      immutable: true,
    });

    res.status(201).json({group});
  });

  // 6b. 6-Month Analytical Reports (Graduated Families Growth & Case Tier Distribution)
  app.get('/api/reports', (req, res) => {
    const filterParam = req.query.institution;
    const institutionFilter: InstitutionId | 'all' =
      filterParam === 'darolahsan' || filterParam === 'edalat' ? filterParam : 'all';

    const scopedCases =
      institutionFilter === 'all'
        ? initialCases
        : initialCases.filter((c) => c.owningInstitution === institutionFilter);

    const extraGraduated = Math.max(
      0,
      scopedCases.filter((c) => c.coverageStatus === 'GRADUATED').length -
        (institutionFilter === 'all' ? 1 : institutionFilter === 'darolahsan' ? 1 : 0),
    );
    const extraRed = Math.max(
      0,
      scopedCases.filter((c) => c.urgencyTier === 'red').length -
        (institutionFilter === 'all' ? 2 : institutionFilter === 'darolahsan' ? 1 : 1),
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
        {
          monthKey: '1405-03',
          monthLabel: 'خرداد ۱۴۰۵',
          graduatedCumulative: 8,
          graduatedNew: 3,
          overlapsPrevented: 4,
          redTier: 48,
          yellowTier: 64,
          greenTier: 22,
        },
        {
          monthKey: '1405-04',
          monthLabel: 'تیر ۱۴۰۵',
          graduatedCumulative: 12,
          graduatedNew: 4,
          overlapsPrevented: 7,
          redTier: 44,
          yellowTier: 68,
          greenTier: 27,
        },
        {
          monthKey: '1405-05',
          monthLabel: 'مرداد ۱۴۰۵',
          graduatedCumulative: 17,
          graduatedNew: 5,
          overlapsPrevented: 10,
          redTier: 39,
          yellowTier: 71,
          greenTier: 34,
        },
        {
          monthKey: '1405-06',
          monthLabel: 'شهریور ۱۴۰۵',
          graduatedCumulative: 23,
          graduatedNew: 6,
          overlapsPrevented: 13,
          redTier: 34,
          yellowTier: 72,
          greenTier: 41,
        },
        {
          monthKey: '1405-07',
          monthLabel: 'مهر ۱۴۰۵',
          graduatedCumulative: 30,
          graduatedNew: 7,
          overlapsPrevented: 16,
          redTier: 29,
          yellowTier: 69,
          greenTier: 49,
        },
        {
          monthKey: '1405-08',
          monthLabel: 'آبان ۱۴۰۵',
          graduatedCumulative: 38 + extraGraduated,
          graduatedNew: 8 + extraGraduated,
          overlapsPrevented: overlapsPreventedCount,
          redTier: 25 + extraRed,
          yellowTier: 67 + extraYellow,
          greenTier: 56 + extraGreen,
        },
      ],
      darolahsan: [
        {
          monthKey: '1405-03',
          monthLabel: 'خرداد ۱۴۰۵',
          graduatedCumulative: 5,
          graduatedNew: 2,
          overlapsPrevented: 2,
          redTier: 26,
          yellowTier: 34,
          greenTier: 12,
        },
        {
          monthKey: '1405-04',
          monthLabel: 'تیر ۱۴۰۵',
          graduatedCumulative: 7,
          graduatedNew: 2,
          overlapsPrevented: 4,
          redTier: 24,
          yellowTier: 36,
          greenTier: 15,
        },
        {
          monthKey: '1405-05',
          monthLabel: 'مرداد ۱۴۰۵',
          graduatedCumulative: 10,
          graduatedNew: 3,
          overlapsPrevented: 6,
          redTier: 21,
          yellowTier: 37,
          greenTier: 19,
        },
        {
          monthKey: '1405-06',
          monthLabel: 'شهریور ۱۴۰۵',
          graduatedCumulative: 14,
          graduatedNew: 4,
          overlapsPrevented: 7,
          redTier: 18,
          yellowTier: 38,
          greenTier: 23,
        },
        {
          monthKey: '1405-07',
          monthLabel: 'مهر ۱۴۰۵',
          graduatedCumulative: 18,
          graduatedNew: 4,
          overlapsPrevented: 9,
          redTier: 15,
          yellowTier: 36,
          greenTier: 27,
        },
        {
          monthKey: '1405-08',
          monthLabel: 'آبان ۱۴۰۵',
          graduatedCumulative: 23 + extraGraduated,
          graduatedNew: 5 + extraGraduated,
          overlapsPrevented: Math.ceil(overlapsPreventedCount * 0.55),
          redTier: 13 + extraRed,
          yellowTier: 35 + extraYellow,
          greenTier: 31 + extraGreen,
        },
      ],
      edalat: [
        {
          monthKey: '1405-03',
          monthLabel: 'خرداد ۱۴۰۵',
          graduatedCumulative: 3,
          graduatedNew: 1,
          overlapsPrevented: 2,
          redTier: 22,
          yellowTier: 30,
          greenTier: 10,
        },
        {
          monthKey: '1405-04',
          monthLabel: 'تیر ۱۴۰۵',
          graduatedCumulative: 5,
          graduatedNew: 2,
          overlapsPrevented: 3,
          redTier: 20,
          yellowTier: 32,
          greenTier: 12,
        },
        {
          monthKey: '1405-05',
          monthLabel: 'مرداد ۱۴۰۵',
          graduatedCumulative: 7,
          graduatedNew: 2,
          overlapsPrevented: 4,
          redTier: 18,
          yellowTier: 34,
          greenTier: 15,
        },
        {
          monthKey: '1405-06',
          monthLabel: 'شهریور ۱۴۰۵',
          graduatedCumulative: 9,
          graduatedNew: 2,
          overlapsPrevented: 6,
          redTier: 16,
          yellowTier: 34,
          greenTier: 18,
        },
        {
          monthKey: '1405-07',
          monthLabel: 'مهر ۱۴۰۵',
          graduatedCumulative: 12,
          graduatedNew: 3,
          overlapsPrevented: 7,
          redTier: 14,
          yellowTier: 33,
          greenTier: 22,
        },
        {
          monthKey: '1405-08',
          monthLabel: 'آبان ۱۴۰۵',
          graduatedCumulative: 15 + extraGraduated,
          graduatedNew: 3 + extraGraduated,
          overlapsPrevented: Math.floor(overlapsPreventedCount * 0.45),
          redTier: 12 + extraRed,
          yellowTier: 32 + extraYellow,
          greenTier: 25 + extraGreen,
        },
      ],
    };

    const series = baseByFilter[institutionFilter];
    const first = series[0];
    const last = series[series.length - 1];
    const sixMonthGrowthPct =
      first.graduatedCumulative > 0
        ? Math.round(
            ((last.graduatedCumulative - first.graduatedCumulative) /
              first.graduatedCumulative) *
              100,
          )
        : 0;

    const baseEmployment: Record<InstitutionId | 'all', {employed: number; jobSeeking: number; insured: number}> = {
      all: {employed: 58, jobSeeking: 52, insured: 38},
      darolahsan: {employed: 32, jobSeeking: 27, insured: 20},
      edalat: {employed: 26, jobSeeking: 25, insured: 18},
    };

    const empBase = baseEmployment[institutionFilter];
    const extraEmployed = scopedCases.filter(
      (c) => c.coverageStatus === 'GRADUATED' || c.stage >= 5,
    ).length;
    const extraJobSeeking = scopedCases.filter(
      (c) => c.servicePath === 'empowerment_employment' && c.stage < 5,
    ).length;
    const extraInsured = scopedCases.filter(
      (c) => c.servicePath === 'livelihood_medical',
    ).length;

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
      scopedCases.filter((c) => c.score.livelihood >= 22).length -
        (institutionFilter === 'all' ? 2 : 1),
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
        const delta = isLead ? workerLiveDeltas[w.institution] : {reviewedDelta: 0, transitionDelta: 0};
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

    const payload: ReportsPayload = {
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
        {
          key: 'under_3m',
          bracketLabel: 'کمتر از ۳ میلیون تومان',
          shortLabel: 'زیر ۳ م',
          count: incCounts[0],
          percentage: incPcts[0],
          povertyLineStatus: 'فقر شدید معیشتی · نیازمند سبد حمایتی فوری',
        },
        {
          key: '3m_to_6m',
          bracketLabel: '۳ تا ۶ میلیون تومان',
          shortLabel: '۳ تا ۶ م',
          count: incCounts[1],
          percentage: incPcts[1],
          povertyLineStatus: 'زیر خط معیشت پایه · درآمد ناپایدار و روزمزد',
        },
        {
          key: '6m_to_10m',
          bracketLabel: '۶ تا ۱۰ میلیون تومان',
          shortLabel: '۶ تا ۱۰ م',
          count: incCounts[2],
          percentage: incPcts[2],
          povertyLineStatus: 'در حال گذار · نیازمند تسهیلات و مهارت‌آموزی',
        },
        {
          key: '10m_to_15m',
          bracketLabel: '۱۰ تا ۱۵ میلیون تومان',
          shortLabel: '۱۰ تا ۱۵ م',
          count: incCounts[3],
          percentage: incPcts[3],
          povertyLineStatus: 'آستانه ثبات نسبی · آماده اتصال به بازار محلی',
        },
        {
          key: 'over_15m',
          bracketLabel: 'بالای ۱۵ میلیون تومان',
          shortLabel: '۱۵+ م',
          count: incCounts[4],
          percentage: incPcts[4],
          povertyLineStatus: 'ثبات درآمدی و خروج موفق از چرخه حمایت',
        },
      ],
      caseWorkerPeriodLabel: 'ماه گذشته (۳۰ روز اخیر · آبان ۱۴۰۵)',
      currentMonthPeriodLabel: 'ماه جاری (آذر ۱۴۰۵ · تا امروز)',
      caseWorkerPerformance,
    };

    res.json(payload);
  });

  // 7. Server-side Gemini AI Case Advisory (Strictly Anonymized Data)
  app.post('/api/ai/recommend', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'کلید GEMINI_API_KEY در تنظیمات سرور (Settings > Secrets) پیکربندی نشده است.',
      });
    }

    const {
      scoreTotal,
      familyScore,
      housingScore,
      livelihoodScore,
      healthScore,
      headStatus,
      blockName,
      householdSize,
      hasSkillInterest,
      mode,
      previousScoreTotal,
      currentStage,
    } = req.body as {
      scoreTotal: number;
      familyScore: number;
      housingScore: number;
      livelihoodScore: number;
      healthScore: number;
      headStatus: string;
      blockName: string;
      householdSize: number;
      hasSkillInterest?: string;
      mode?: 'new' | 'update';
      previousScoreTotal?: number;
      currentStage?: CaseStage;
    };

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const updateContext =
        mode === 'update' && typeof previousScoreTotal === 'number'
          ? `\n- نوع فرآیند: بازبینی و بروزرسانی پرونده قبلی (امتیاز قبلی: ${previousScoreTotal}/100 ← امتیاز جدید: ${scoreTotal}/100 · مرحله فعلی: ${currentStage || 2})`
          : '\n- نوع فرآیند: تشکیل پرونده جدید و ارزیابی اولیه';

      const prompt = `به عنوان مشاور تخصصی مددکاری اجتماعی و توانمندسازی اقتصادی در ناحیه منفصل شهری نایسر سنندج (پروژه مشترک خیریه دارالاحسان و عدالت و برابری کردستان)، بر اساس شاخص‌های ناشناس زیر، برنامه مداخله و توانمندسازی پیشنهاد بده:
- امتیاز کل نیازمندی از ۱۰۰: ${scoreTotal} (ساختار خانوار: ${familyScore}/30، مسکن: ${housingScore}/25، معیشت: ${livelihoodScore}/25، سلامت: ${healthScore}/20)
- وضعیت سرپرست خانوار: ${headStatus}
- تعداد اعضای خانوار: ${householdSize} نفر
- محدوده: ${blockName}
- مهارت یا زمینه مورد علاقه: ${hasSkillInterest || 'نامشخص'}${updateContext}

توجه: هیچ نام یا اطلاعات هویتی نپرس و بر اساس مدل ۶ مرحله‌ای مدیریت مورد، الگوهای بومی استان کردستان (خیاطی، صنایع دستی، بسته‌بندی مواد غذایی خانگی، مراقبت محلی، خدمات دیجیتال، صندوق خودیاری خرد بانوان، و صندوق درمان مشترک) پاسخ علمی، کاربردی و محترمانه به فارسی بده.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          systemInstruction:
            'تو دستیار تخصصی مددکاران اجتماعی نایسر سنندج هستی. پاسخ‌های تو باید کاملاً با لحن محترمانه، کرامت‌محور، خلاصه و ساختاریافته به زبان فارسی باشد.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedPath: {
                type: Type.STRING,
                description: 'مسیر پیشنهادی مداخله (حمایتی/درمانی یا توانمندسازی)',
              },
              microBusinessIdeas: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
                description: '۲ تا ۳ ایده کسب‌وکار خرد متناسب با شرایط خانوار و بازار نایسر/سنندج',
              },
              coordinationAdvice: {
                type: Type.STRING,
                description: 'پیشنهاد هماهنگی بین دارالاحسان و عدالت و برابری (واگذاری کامل یا پوشش ترکیبی)',
              },
              dignifiedScript: {
                type: Type.STRING,
                description: 'یک جمله محترمانه و کرامت‌محور برای گفتگو با سرپرست خانوار',
              },
            },
            required: [
              'recommendedPath',
              'microBusinessIdeas',
              'coordinationAdvice',
              'dignifiedScript',
            ],
          },
        },
      });

      const text = (response.text || '{}').trim();
      const parsed = JSON.parse(text);
      return res.json({recommendation: parsed});
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در ارتباط با سرویس هوش مصنوعی.';
      return res.status(500).json({error: message});
    }
  });

  // 7b. Server-side Gemini AI Smart Step-by-Step Field Note Extraction (Zero PII)
  app.post('/api/ai/smart-assist', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'کلید GEMINI_API_KEY در تنظیمات سرور (Settings > Secrets) پیکربندی نشده است.',
      });
    }

    const {fieldNotes, mode} = req.body as {
      fieldNotes?: string;
      mode?: 'new' | 'update';
    };

    const cleanNotes = (fieldNotes || '').trim();
    if (cleanNotes.length < 10) {
      return res.status(400).json({
        error: 'لطفاً حداقل یک جمله کوتاه از مشاهدات میدانی یا شرایط خانوار را وارد کنید.',
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `متن مشاهدات میدانی مددکار اجتماعی (بدون اطلاعات هویتی) در ناحیه نایسر سنندج:
«${cleanNotes}»
حالت پرونده: ${mode === 'update' ? 'بازبینی و بروزرسانی پرونده قبلی' : 'تشکیل پرونده جدید'}

بر اساس متن بالا، شاخص‌های استاندارد ارزیابی ۱۰۰ امتیازی نایسر را استخراج کن:
- suggestedHeadStatus باید دقیقاً یکی از این ۴ گزینه باشد:
  1) "زن سرپرست خانوار"
  2) "سرپرست ازکارافتاده / بیمار صعب‌العلاج"
  3) "معلول یا زندانی"
  4) "عادی"
- suggestedHousingType باید دقیقاً یکی از این ۵ گزینه باشد:
  1) "استیجاری با اجاره سنگین"
  2) "سکونتگاه غیررسمی / حاشیه‌ای"
  3) "فاقد سرپناه مستقل"
  4) "رهن یا مسکن مهر"
  5) "ملکی"
- suggestedIncomeSourcePoints باید دقیقاً یکی از این ۴ عدد باشد:
  18 (فاقد درآمد ثابت / زیر خط فقر شدید)
  14 (کارگری فصلی / دستفروشی ناپایدار)
  10 (مستمری محدود کمیته امداد / بهزیستی)
  5 (درآمد جزئی خانگی نیازمند تقویت)
- همچنین جمع‌بندی پزشکی/میدانی، اقدام حمایتی پیشنهادی برای ثبت در این نوبت و ۲ تا ۳ سوال تکمیلی مهم که مددکار باید در بازدید از خانواده بپرسد را مشخص کن.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          systemInstruction:
            'تو دستیار هوشمند ارزیابی معیشتی سامانه هم‌افزایی نایسر هستی. مقادیر گزینه‌های ساختاریافته را دقیقاً مطابق فهرست خواسته‌شده برگردان.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestedHeadStatus: {type: Type.STRING},
              suggestedHousingType: {type: Type.STRING},
              suggestedLacksUtilities: {type: Type.BOOLEAN},
              suggestedIncomeSourcePoints: {type: Type.INTEGER},
              suggestedHasUnemployedWorker: {type: Type.BOOLEAN},
              suggestedHasChronicDisease: {type: Type.BOOLEAN},
              suggestedChildNutritionRisk: {type: Type.BOOLEAN},
              suggestedSkillInterest: {type: Type.STRING},
              structuredMedicalSummary: {type: Type.STRING},
              suggestedSupportAction: {type: Type.STRING},
              followUpQuestions: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
              },
              confidenceNote: {type: Type.STRING},
            },
            required: [
              'suggestedHeadStatus',
              'suggestedHousingType',
              'suggestedLacksUtilities',
              'suggestedIncomeSourcePoints',
              'suggestedHasUnemployedWorker',
              'suggestedHasChronicDisease',
              'suggestedChildNutritionRisk',
              'suggestedSkillInterest',
              'structuredMedicalSummary',
              'suggestedSupportAction',
              'followUpQuestions',
              'confidenceNote',
            ],
          },
        },
      });

      const text = (response.text || '{}').trim();
      const parsed = JSON.parse(text);
      return res.json({assist: parsed});
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در تحلیل هوشمند مشاهدات میدانی.';
      return res.status(500).json({error: message});
    }
  });

  // 7c. Server-side Gemini AI Stage-Specific Case Management Assistant (Zero PII)
  app.post('/api/ai/stage-assist', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'کلید GEMINI_API_KEY در تنظیمات سرور (Settings > Secrets) پیکربندی نشده است.',
      });
    }

    const {caseId, stageNumber, institution} = req.body as {
      caseId?: string;
      stageNumber?: CaseStage;
      institution?: InstitutionId;
    };

    const record = initialCases.find((c) => c.id === caseId);
    if (!record) {
      return res.status(404).json({error: 'پرونده مورد نظر یافت نشد.'});
    }
    if (institution && record.owningInstitution !== institution) {
      return res.status(403).json({error: 'دسترسی به تحلیل این پرونده مجاز نیست.'});
    }

    const targetStage: CaseStage =
      stageNumber && stageNumber >= 1 && stageNumber <= 6 ? stageNumber : record.stage;
    const block = naysarBlocks.find((b) => b.id === record.blockId);

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const anonymizedSummary = {
        caseId: record.id,
        targetStage,
        blockName: block?.name || 'ناحیه نایسر',
        urgencyTier: record.urgencyTier,
        servicePath: record.servicePath,
        householdSize: record.householdSize,
        headStatus: record.headStatus,
        housingType: record.housingType,
        score: record.score,
        skillInterest: record.assessmentDetails.skillInterest,
        hasChronicDisease: record.assessmentDetails.hasChronicDisease,
        studentsCount: record.assessmentDetails.studentsCount,
      };

      const prompt = `به عنوان سوپروایزر ارشد مدیریت مورد در ناحیه نایسر سنندج، برای مرحله ${targetStage} از مدل ۶ مرحله‌ای مدیریت مورد (۱=پذیرش و ارجاع، ۲=ارزیابی همه‌جانبه، ۳=برنامه مداخله، ۴=اجرا و خدمات، ۵=پایش مستمر، ۶=خروج موفق) و بر اساس داده‌های کاملاً ناشناس زیر، اقدامات اجرایی دقیق این مرحله را پیشنهاد بده:
${JSON.stringify(anonymizedSummary, null, 2)}

لطفاً پاسخ را کاملاً عملی، بومی‌سازی‌شده برای نایسر و با لحن حرفه‌ای مددکاری اجتماعی به فارسی ارائه بده.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          systemInstruction:
            'تو دستیار تخصصی مدیریت مورد ۶ مرحله‌ای در نایسر سنندج هستی. خروجی باید ساختاریافته، مشخص و بدون هیچ داده هویتی باشد.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              stageTitle: {type: Type.STRING},
              stageObjective: {type: Type.STRING},
              suggestedActions: {
                type: Type.ARRAY,
                items: {type: Type.STRING},
              },
              recommendedGoalOrService: {type: Type.STRING},
              workerCommunicationTip: {type: Type.STRING},
            },
            required: [
              'stageTitle',
              'stageObjective',
              'suggestedActions',
              'recommendedGoalOrService',
              'workerCommunicationTip',
            ],
          },
        },
      });

      const text = (response.text || '{}').trim();
      const parsed = JSON.parse(text);
      return res.json({stageAssist: parsed});
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در تولید پیشنهاد هوشمند مرحله.';
      return res.status(500).json({error: message});
    }
  });

  // 8. Server-side Gemini AI Case Portfolio Analysis & Household Prioritization (Strictly Anonymized)
  app.post('/api/ai/prioritize', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error:
          'کلید GEMINI_API_KEY در تنظیمات سرور (Settings > Secrets) پیکربندی نشده است. لطفاً کلید API را در بخش Settings > Secrets بررسی کنید.',
      });
    }

    const {institution, role, focusArea} = req.body as {
      institution?: InstitutionId;
      role?: UserRole;
      focusArea?: AiPrioritizationFocus;
    };

    const activeInstitution: InstitutionId = institution === 'edalat' ? 'edalat' : 'darolahsan';
    const activeRole: UserRole = role || 'case_worker';
    const activeFocus: AiPrioritizationFocus =
      focusArea === 'livelihood_medical' ||
      focusArea === 'empowerment' ||
      focusArea === 'housing'
        ? focusArea
        : 'comprehensive';

    const focusLabels: Record<AiPrioritizationFocus, string> = {
      comprehensive: 'اولویت‌بندی جامع خدمات حمایتی و توانمندسازی',
      livelihood_medical: 'حمایت معیشتی فوری، سبد کالا و هزینه‌های درمانی',
      empowerment: 'تسهیلات صندوق خودیاری خرد، مهارت‌آموزی و اشتغال خانگی',
      housing: 'کمک‌هزینه مسکن، ودیعه و اجاره‌بها و بهبود سرپناه',
    };

    const candidateCases = initialCases.filter((c) => {
      if (c.coverageStatus === 'GRADUATED') return false;
      if (activeRole === 'privacy_officer' || activeRole === 'system_admin') {
        return true;
      }
      return c.owningInstitution === activeInstitution;
    });

    if (candidateCases.length === 0) {
      return res.status(400).json({
        error: 'پرونده فعالی برای تحلیل و اولویت‌بندی در این محدوده یافت نشد.',
      });
    }

    // Strictly anonymized payload — zero PII (no fullName, no nationalId, no phone, no address)
    const anonymizedCases = candidateCases.map((c) => {
      const block = naysarBlocks.find((b) => b.id === c.blockId);
      const daysInStage = Math.max(
        0,
        Math.floor((Date.now() - new Date(c.stageEnteredAt).getTime()) / (1000 * 60 * 60 * 24)),
      );
      return {
        caseId: c.id,
        blockName: block ? block.name : 'نایسر',
        stage: c.stage,
        daysInStage,
        isStagnantOver90Days: daysInStage > 90,
        coverageStatus: c.coverageStatus,
        urgencyTier: c.urgencyTier,
        servicePath: c.servicePath,
        collaborationModel: c.collaborationModel,
        householdSize: c.householdSize,
        headStatus: c.headStatus,
        housingType: c.housingType,
        scoreTotal: c.score.total,
        scoreFamilyStructureMax30: c.score.familyStructure,
        scoreHousingMax25: c.score.housing,
        scoreLivelihoodMax25: c.score.livelihood,
        scoreHealthMax20: c.score.health,
        lastSupportType: c.lastSupportType,
        healthOrNeedIndicator: c.medicalNotes,
      };
    });

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `داده‌های ناشناس پرونده‌های فعال ناحیه منفصل شهری نایسر سنندج برای تحلیل و اولویت‌بندی دریافت خدمات حمایتی در ادامه آمده است.
محور تمرکز انتخاب‌شده: ${focusLabels[activeFocus]}
نهاد/نقش درخواست‌کننده: ${activeRole === 'privacy_officer' || activeRole === 'system_admin' ? 'نمای مشترک نایسر' : getInstitutionName(activeInstitution)}

داده‌های شاخص‌های معیشتی پرونده‌ها (JSON):
${JSON.stringify(anonymizedCases, null, 2)}

لطفاً تمامی این پرونده‌ها را با توجه به امتیاز ۱۰۰ امتیازی (ساختار خانوار /۳۰، مسکن /۲۵، معیشت /۲۵، سلامت /۲۰)، وضعیت سرپرست خانوار، نوع مسکن، تعداد عائله، توقف بیش از ۹۰ روز در یک مرحله (پرونده راکد)، وضعیت تعلیق هم‌پوشانی و محور تمرکز انتخاب‌شده تحلیل کن و از بیشترین اولویت به کمترین اولویت رتبه‌بندی نما.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: {thinkingLevel: ThinkingLevel.MEDIUM},
          systemInstruction:
            'تو تحلیلگر ارشد داده‌های مددکاری اجتماعی و تخصیص بهینه منابع در سامانه هم‌افزایی نایسر سنندج هستی. پاسخ تو باید کاملاً مستدل بر اعداد شاخص‌های معیشتی ثبت‌شده، محترمانه، کاربردی و به زبان فارسی باشد. در فیلد caseId دقیقاً همان شناسه پرونده ورودی (مانند NY-1405-102) را برگردان و از درج هرگونه نام فرضی خودداری کن.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: {
                type: Type.STRING,
                description:
                  'تحلیل کلان وضعیت معیشتی خانوارهای بررسی‌شده، الگوهای آسیب‌پذیری و گلوگاه‌های توقف پرونده‌ها در ۲ تا ۳ جمله.',
              },
              resourceAllocationStrategy: {
                type: Type.STRING,
                description:
                  'راهبرد پیشنهادی برای تخصیص منابع و هم‌افزایی بین دارالاحسان سنندج و عدالت و برابری کردستان (شامل صندوق درمان مشترک و صندوق خودیاری خرد).',
              },
              prioritizedHouseholds: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rank: {
                      type: Type.INTEGER,
                      description: 'رتبه اولویت از ۱ به بالا',
                    },
                    caseId: {
                      type: Type.STRING,
                      description: 'شناسه دقیق پرونده از داده‌های ورودی',
                    },
                    priorityLevel: {
                      type: Type.STRING,
                      description: 'یکی از سطوح: فوری و حیاتی، اولویت بالا، یا اولویت میان‌مدت',
                    },
                    recommendedServicePackage: {
                      type: Type.STRING,
                      description: 'بسته خدمت حمایتی یا توانمندسازی پیشنهادی مشخص و بومی',
                    },
                    rationale: {
                      type: Type.STRING,
                      description:
                        'استدلال تحلیلی بر اساس امتیازهای ساختار، مسکن، معیشت، سلامت و مدت توقف در مرحله',
                    },
                    estimatedImpact: {
                      type: Type.STRING,
                      description: 'اثر مورد انتظار اجرای این حمایت بر پایداری خانوار',
                    },
                  },
                  required: [
                    'rank',
                    'caseId',
                    'priorityLevel',
                    'recommendedServicePackage',
                    'rationale',
                    'estimatedImpact',
                  ],
                },
              },
            },
            required: [
              'executiveSummary',
              'resourceAllocationStrategy',
              'prioritizedHouseholds',
            ],
          },
        },
      });

      const rawText = (response.text || '{}').trim();
      const parsed = JSON.parse(rawText) as {
        executiveSummary?: string;
        resourceAllocationStrategy?: string;
        prioritizedHouseholds?: Array<{
          rank: number;
          caseId: string;
          priorityLevel: string;
          recommendedServicePackage: string;
          rationale: string;
          estimatedImpact: string;
        }>;
      };

      const validCaseIds = new Set(candidateCases.map((c) => c.id));
      const prioritizedHouseholds = (parsed.prioritizedHouseholds || [])
        .filter((item) => validCaseIds.has(item.caseId))
        .sort((a, b) => a.rank - b.rank)
        .map((item, idx) => ({
          ...item,
          rank: idx + 1,
        }));

      const result: AiPrioritizationResult = {
        focusArea: activeFocus,
        analyzedCasesCount: candidateCases.length,
        generatedAt: formatPersianTimestamp(),
        executiveSummary: parsed.executiveSummary || '',
        resourceAllocationStrategy: parsed.resourceAllocationStrategy || '',
        prioritizedHouseholds,
      };

      return res.json({analysis: result});
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'خطا در ارتباط با سرویس هوش مصنوعی.';
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED') || message.includes('API_KEY')
          ? 403
          : 500;
      const friendlyMessage =
        status === 403
          ? 'کلید API سرویس هوش مصنوعی معتبر نیست یا مجوز دسترسی ندارد. لطفاً کلید را در بخش Settings > Secrets بررسی کنید.'
          : message;
      return res.status(status).json({error: friendlyMessage});
    }
  });

  // 9. Authentication Endpoint for Naysar Case Workers, Managers & Privacy Officer
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
      passwordHash: crypto.createHash('sha256').update('Naysar@1405').digest('hex'),
      displayName: 'سهیلا محمدی',
      roleTitle: 'مددکار معین مؤسسه دارالاحسان سنندج',
      institution: 'darolahsan',
      role: 'case_worker',
    },
    {
      username: 'edalat',
      passwordHash: crypto.createHash('sha256').update('Naysar@1405').digest('hex'),
      displayName: 'آرش کریمی',
      roleTitle: 'مددکار معین مؤسسه عدالت و برابری کردستان',
      institution: 'edalat',
      role: 'case_worker',
    },
    {
      username: 'nazer',
      passwordHash: crypto.createHash('sha256').update('Nazer@1405').digest('hex'),
      displayName: 'مهندس شریفی',
      roleTitle: 'ناظر امنیتی بی‌طرف (کارگروه مشترک نایسر)',
      institution: 'darolahsan',
      role: 'privacy_officer',
    },
  ];

  app.post('/api/auth/login', (req, res) => {
    const {username, password} = req.body as {
      username?: string;
      password?: string;
    };

    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = password || '';

    if (!cleanUser || !cleanPass) {
      return res.status(400).json({
        error: 'وارد کردن نام کاربری و رمز عبور الزامی است.',
      });
    }

    const inputPassHash = crypto.createHash('sha256').update(cleanPass).digest('hex');
    const matchedAccount = SYSTEM_ACCOUNTS.find(
      (acc) => acc.username === cleanUser && acc.passwordHash === inputPassHash,
    );

    if (!matchedAccount) {
      return res.status(401).json({
        error: 'نام کاربری یا رمز عبور نادرست است. لطفاً مجدداً بررسی نمایید.',
      });
    }

    const session: AuthUserSession = {
      username: matchedAccount.username,
      displayName: matchedAccount.displayName,
      roleTitle: matchedAccount.roleTitle,
      institution: matchedAccount.institution,
      role: matchedAccount.role,
      loggedInAt: formatPersianTimestamp(),
    };

    return res.json({session});
  });

  // Vite middleware in dev, static assets in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Naysar Synergistic Case Management System listening on port ${port}`);
  });
}

startServer();
