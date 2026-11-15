import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardEdit,
  FileCheck2,
  HardDriveDownload,
  History,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Volume2,
  Wand2,
  WifiOff,
} from 'lucide-react';
import type {
  CaseRecordView,
  CaseStage,
  InquiryResponse,
  InstitutionId,
  NaysarBlock,
  ServicePath,
  SmartFieldAssistResponse,
  UserRole,
} from '../types';
import {
  getPersianDateTimeParts,
  normalizeVisitDateInput,
  normalizeVisitTimeInput,
  toPersianDigits,
} from '../utils/persianDateTime';

interface AssessmentConsentViewProps {
  blocks: NaysarBlock[];
  cases: CaseRecordView[];
  activeInstitution: InstitutionId;
  activeRole: UserRole;
  prefilledNationalId?: string;
  prefilledBlockId?: string;
  initialEditCaseId?: string | null;
  onClearInitialEditCase?: () => void;
  onCaseSaved: (meta?: {
    caseId: string;
    isUpdate: boolean;
    stageChanged: boolean;
    stage: CaseStage;
    fullName?: string;
  }) => Promise<void>;
  onNavigateToOverview: () => void;
  onOpenCaseWorkflow?: (caseId: string) => void;
  onDraftToast?: (title: string, description?: string) => void;
}

interface AiRecommendation {
  recommendedPath: string;
  microBusinessIdeas: string[];
  coordinationAdvice: string;
  dignifiedScript: string;
}

type WizardMode = 'new' | 'update';
type WizardStep = 1 | 2 | 3 | 4 | 5;

const WIZARD_STEPS: {step: WizardStep; shortTitle: string; title: string}[] = [
  {step: 1, shortTitle: 'استعلام، زمان و رضایت', title: 'گام ۱: وضعیت پرونده، تاریخ و ساعت و رضایت‌نامه'},
  {step: 2, shortTitle: 'هوش مصنوعی و خانوار', title: 'گام ۲: دستیار هوشمند گزارش میدانی و ساختار خانوار'},
  {step: 3, shortTitle: 'معیشت، مسکن و سلامت', title: 'گام ۳: ارزیابی ۱۰۰ امتیازی، نوع اقدام و مرحله'},
  {step: 4, shortTitle: 'تحلیل و پیش‌بینی AI', title: 'گام ۴: تحلیل هوشمند، پیش‌بینی ۳ ماهه و نقشه راه'},
  {step: 5, shortTitle: 'بازبینی و ثبت نهایی', title: 'گام ۵: بازبینی نهایی، تایید زمان‌بندی و ثبت'},
];

const STAGE_LABELS: Record<CaseStage, string> = {
  1: '۱. پذیرش و ارجاع',
  2: '۲. ارزیابی همه‌جانبه',
  3: '۳. برنامه مداخله',
  4: '۴. اجرا و خدمات',
  5: '۵. پایش مستمر',
  6: '۶. خروج موفق',
};

const QUICK_SUPPORT_ACTIONS = [
  'ارزیابی اولیه و تشکیل پرونده معیشتی',
  'بازبینی دوره‌ای وضعیت معیشتی و درآمد',
  'سبد معیشتی و کمک‌هزینه دارویی',
  'معرفی به صندوق خودیاری خرد و تسهیلات اشتغال',
  'کمک‌هزینه ودیعه و اجاره مسکن',
  'ارزیابی نهایی خروج موفق و خوداتکایی',
];

const FIELD_NOTE_TEMPLATES = [
  {
    label: 'نمونه زن سرپرست + خیاطی',
    text: 'مادر سرپرست خانوار با ۲ فرزند محصل در خانه استیجاری با اجاره سنگین سکونت دارد. درآمد روزمزد ناپایدار است اما به خیاطی و دوخت لباس محلی مسلط و آماده کار در کارگاه خانگی است. بیماری خاص ندارد.',
  },
  {
    label: 'نمونه بیمار مزمن + مسکن بحرانی',
    text: 'سرپرست خانوار ازکارافتاده با بیماری تنفسی مزمن و نیاز مستمر به دارو است. منزل در سکونتگاه حاشیه‌ای بدون سیستم گرمایش مناسب قرار دارد و خانوار فاقد درآمد ثابت است؛ کودک خردسال نیاز به حمایت تغذیه‌ای دارد.',
  },
];

const AUTOSAVE_PREFIX = 'naysar_assessment_autosave_v2_';
const SAVED_DRAFTS_KEY = 'naysar_assessment_saved_drafts_v2';

interface AssessmentDraftSnapshot {
  draftId: string;
  institution: InstitutionId;
  savedAt: string;
  mode: WizardMode;
  selectedCaseId: string;
  currentStep: WizardStep;
  visitDate: string;
  visitTime: string;
  oralMode: boolean;
  consentPillar1: boolean;
  consentPillar2: boolean;
  consentPillar3: boolean;
  fullName: string;
  nationalId: string;
  phone: string;
  blockId: string;
  address: string;
  householdSize: number;
  skillInterest: string;
  headStatus: string;
  studentsCount: number;
  dependentsCount: number;
  housingType: string;
  lacksUtilities: boolean;
  incomeSourcePoints: number;
  hasUnemployedWorker: boolean;
  hasChronicDisease: boolean;
  childNutritionRisk: boolean;
  medicalNotes: string;
  targetStage: CaseStage;
  lastSupportType: string;
  caseWorkerNote: string;
  fieldNotesInput: string;
  scoreTotal: number;
}

function readSavedDrafts(): AssessmentDraftSnapshot[] {
  try {
    const raw = localStorage.getItem(SAVED_DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AssessmentDraftSnapshot[]) : [];
  } catch {
    return [];
  }
}

function writeSavedDrafts(drafts: AssessmentDraftSnapshot[]) {
  try {
    localStorage.setItem(SAVED_DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // ignore storage quota errors
  }
}

function getHeadPoints(headStatus: string): number {
  if (headStatus === 'زن سرپرست خانوار') return 14;
  if (headStatus === 'سرپرست ازکارافتاده / بیمار صعب‌العلاج') return 16;
  if (headStatus === 'معلول یا زندانی') return 15;
  return 6;
}

function getHousingPoints(housingType: string): number {
  if (housingType === 'فاقد سرپناه مستقل') return 16;
  if (housingType === 'سکونتگاه غیررسمی / حاشیه‌ای') return 15;
  if (housingType === 'استیجاری با اجاره سنگین') return 13;
  if (housingType === 'رهن یا مسکن مهر') return 8;
  return 4;
}

function getInstitutionLabel(id: InstitutionId): string {
  return id === 'darolahsan' ? 'مؤسسه دارالاحسان سنندج' : 'مؤسسه عدالت و برابری کردستان';
}

export const AssessmentConsentView: React.FC<AssessmentConsentViewProps> = ({
  blocks,
  cases,
  activeInstitution,
  activeRole,
  prefilledNationalId = '',
  prefilledBlockId = '',
  initialEditCaseId = null,
  onClearInitialEditCase,
  onCaseSaved,
  onNavigateToOverview,
  onOpenCaseWorkflow,
  onDraftToast,
}) => {
  const initialDateTime = useMemo(() => getPersianDateTimeParts(), []);

  // Mode & Step
  const [mode, setMode] = useState<WizardMode>(initialEditCaseId ? 'update' : 'new');
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initialEditCaseId || '');
  const [casePickerSearch, setCasePickerSearch] = useState('');

  // Visit Persian Date & Time
  const [visitDate, setVisitDate] = useState(initialDateTime.date);
  const [visitTime, setVisitTime] = useState(initialDateTime.shortTime);

  // Live Step-1 Inquiry Verification (for New Case mode)
  const [stepInquiryLoading, setStepInquiryLoading] = useState(false);
  const [stepInquiryError, setStepInquiryError] = useState<string | null>(null);
  const [stepInquiryResult, setStepInquiryResult] = useState<InquiryResponse | null>(null);

  // Consent protocol state
  const [oralMode, setOralMode] = useState(false);
  const [consentPillar1, setConsentPillar1] = useState(false);
  const [consentPillar2, setConsentPillar2] = useState(false);
  const [consentPillar3, setConsentPillar3] = useState(false);

  // Household identity (stored only in dedicated institution DB)
  const [fullName, setFullName] = useState('');
  const [nationalId, setNationalId] = useState(prefilledNationalId);
  const [phone, setPhone] = useState('');
  const [blockId, setBlockId] = useState(prefilledBlockId || blocks[0]?.id || 'blk-1');
  const [address, setAddress] = useState('');
  const [householdSize, setHouseholdSize] = useState(4);
  const [skillInterest, setSkillInterest] = useState('خیاطی و دوخت خانگی');

  // 1. Family Structure (max 30)
  const [headStatus, setHeadStatus] = useState('زن سرپرست خانوار');
  const [studentsCount, setStudentsCount] = useState(2);
  const [dependentsCount, setDependentsCount] = useState(1);

  // 2. Housing (max 25)
  const [housingType, setHousingType] = useState('استیجاری با اجاره سنگین');
  const [lacksUtilities, setLacksUtilities] = useState(false);

  // 3. Livelihood (max 25)
  const [incomeSourcePoints, setIncomeSourcePoints] = useState(14);
  const [hasUnemployedWorker, setHasUnemployedWorker] = useState(true);

  // 4. Health (max 20)
  const [hasChronicDisease, setHasChronicDisease] = useState(false);
  const [childNutritionRisk, setChildNutritionRisk] = useState(false);
  const [medicalNotes, setMedicalNotes] = useState('');

  // Action, Stage & Worker Notes
  const [targetStage, setTargetStage] = useState<CaseStage>(2);
  const [lastSupportType, setLastSupportType] = useState('ارزیابی اولیه و تشکیل پرونده معیشتی');
  const [caseWorkerNote, setCaseWorkerNote] = useState('');

  // Smart Field Note AI Assistant (Step 2)
  const [fieldNotesInput, setFieldNotesInput] = useState('');
  const [smartAssistLoading, setSmartAssistLoading] = useState(false);
  const [smartAssistError, setSmartAssistError] = useState<string | null>(null);
  const [smartAssistResult, setSmartAssistResult] = useState<SmartFieldAssistResponse | null>(null);

  // Submission & Step-4 AI Advisory state
  const [stepValidationError, setStepValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<{
    caseId: string;
    timestamp: string;
    auditLogId?: string;
    scoreTotal: number;
    previousScore?: number;
    isUpdate: boolean;
  } | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<AiRecommendation | null>(null);

  // Offline resilience & Temporary Draft Manager
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [savedDrafts, setSavedDrafts] = useState<AssessmentDraftSnapshot[]>(readSavedDrafts);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [draftStatusNotice, setDraftStatusNotice] = useState<string | null>(null);

  const isRestrictedRole = activeRole === 'privacy_officer' || activeRole === 'system_admin';

  // Editable cases belonging to activeInstitution
  const editableCases = useMemo(() => {
    return cases.filter((c) => !c.isMasked && c.owningInstitution === activeInstitution);
  }, [cases, activeInstitution]);

  const filteredEditableCases = useMemo(() => {
    const q = casePickerSearch.trim().toLowerCase();
    if (!q) return editableCases;
    return editableCases.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        (c.fullName && c.fullName.toLowerCase().includes(q)) ||
        (c.nationalIdMasked && c.nationalIdMasked.includes(q)) ||
        c.blockName.toLowerCase().includes(q),
    );
  }, [editableCases, casePickerSearch]);

  const selectedExistingCase = useMemo(() => {
    if (mode !== 'update' || !selectedCaseId) return null;
    return editableCases.find((c) => c.id === selectedCaseId) || null;
  }, [mode, selectedCaseId, editableCases]);

  const loadExistingCaseIntoForm = useCallback((record: CaseRecordView) => {
    const nowParts = getPersianDateTimeParts();
    setSelectedCaseId(record.id);
    setVisitDate(nowParts.date);
    setVisitTime(nowParts.shortTime);
    setFullName(record.fullName || '');
    setNationalId(record.nationalIdMasked || '');
    setPhone(record.phone || '');
    setBlockId(record.blockId);
    setAddress(record.address || '');
    setHouseholdSize(record.householdSize || 4);

    const normalizedHead =
      record.headStatus === 'زن سرپرست خانوار' ||
      record.headStatus === 'سرپرست ازکارافتاده / بیمار صعب‌العلاج' ||
      record.headStatus === 'معلول یا زندانی' ||
      record.headStatus === 'عادی'
        ? record.headStatus
        : record.headStatus?.includes('ازکارافتاده') || record.headStatus?.includes('صعب')
          ? 'سرپرست ازکارافتاده / بیمار صعب‌العلاج'
          : record.headStatus?.includes('زن')
            ? 'زن سرپرست خانوار'
            : 'عادی';
    setHeadStatus(normalizedHead);

    const normalizedHousing =
      record.housingType === 'استیجاری با اجاره سنگین' ||
      record.housingType === 'سکونتگاه غیررسمی / حاشیه‌ای' ||
      record.housingType === 'فاقد سرپناه مستقل' ||
      record.housingType === 'رهن یا مسکن مهر' ||
      record.housingType === 'ملکی'
        ? record.housingType
        : record.housingType?.includes('غیررسمی')
          ? 'سکونتگاه غیررسمی / حاشیه‌ای'
          : record.housingType?.includes('رهن')
            ? 'رهن یا مسکن مهر'
            : record.housingType?.includes('ملکی')
              ? 'ملکی'
              : 'استیجاری با اجاره سنگین';
    setHousingType(normalizedHousing);

    const details = record.assessmentDetails;
    setStudentsCount(details?.studentsCount ?? 1);
    setDependentsCount(details?.dependentsCount ?? 0);
    setLacksUtilities(details?.lacksUtilities ?? false);
    setIncomeSourcePoints(details?.incomeSourcePoints ?? 14);
    setHasUnemployedWorker(details?.hasUnemployedWorker ?? true);
    setHasChronicDisease(details?.hasChronicDisease ?? false);
    setChildNutritionRisk(details?.childNutritionRisk ?? false);
    setSkillInterest(details?.skillInterest ?? 'خیاطی و دوخت خانگی');

    setMedicalNotes(record.medicalNotes || '');
    setCaseWorkerNote(record.caseWorkerNote || '');
    setTargetStage(record.stage);
    setLastSupportType('بازبینی دوره‌ای وضعیت معیشتی و درآمد');

    // Existing cases already have signed consent; allow immediate reconfirmation toggle
    setConsentPillar1(record.consentSigned);
    setConsentPillar2(record.consentSigned);
    setConsentPillar3(record.consentSigned);

    setStepValidationError(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    setAiRecommendation(null);
    setSmartAssistResult(null);
  }, []);

  // Monitor browser online/offline connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const applyDraftSnapshot = useCallback((draft: Partial<AssessmentDraftSnapshot>) => {
    if (draft.mode === 'new' || draft.mode === 'update') setMode(draft.mode);
    if (typeof draft.selectedCaseId === 'string') setSelectedCaseId(draft.selectedCaseId);
    if (
      draft.currentStep === 1 ||
      draft.currentStep === 2 ||
      draft.currentStep === 3 ||
      draft.currentStep === 4 ||
      draft.currentStep === 5
    ) {
      setCurrentStep(draft.currentStep);
    }
    if (draft.visitDate) setVisitDate(draft.visitDate);
    if (draft.visitTime) setVisitTime(draft.visitTime);
    if (typeof draft.oralMode === 'boolean') setOralMode(draft.oralMode);
    if (typeof draft.consentPillar1 === 'boolean') setConsentPillar1(draft.consentPillar1);
    if (typeof draft.consentPillar2 === 'boolean') setConsentPillar2(draft.consentPillar2);
    if (typeof draft.consentPillar3 === 'boolean') setConsentPillar3(draft.consentPillar3);
    if (typeof draft.fullName === 'string') setFullName(draft.fullName);
    if (typeof draft.nationalId === 'string') setNationalId(draft.nationalId);
    if (typeof draft.phone === 'string') setPhone(draft.phone);
    if (typeof draft.blockId === 'string') setBlockId(draft.blockId);
    if (typeof draft.address === 'string') setAddress(draft.address);
    if (typeof draft.householdSize === 'number') setHouseholdSize(draft.householdSize);
    if (typeof draft.headStatus === 'string') setHeadStatus(draft.headStatus);
    if (typeof draft.studentsCount === 'number') setStudentsCount(draft.studentsCount);
    if (typeof draft.dependentsCount === 'number') setDependentsCount(draft.dependentsCount);
    if (typeof draft.housingType === 'string') setHousingType(draft.housingType);
    if (typeof draft.lacksUtilities === 'boolean') setLacksUtilities(draft.lacksUtilities);
    if (typeof draft.incomeSourcePoints === 'number') setIncomeSourcePoints(draft.incomeSourcePoints);
    if (typeof draft.hasUnemployedWorker === 'boolean') setHasUnemployedWorker(draft.hasUnemployedWorker);
    if (typeof draft.hasChronicDisease === 'boolean') setHasChronicDisease(draft.hasChronicDisease);
    if (typeof draft.childNutritionRisk === 'boolean') setChildNutritionRisk(draft.childNutritionRisk);
    if (typeof draft.medicalNotes === 'string') setMedicalNotes(draft.medicalNotes);
    if (typeof draft.skillInterest === 'string') setSkillInterest(draft.skillInterest);
    if (
      draft.targetStage === 1 ||
      draft.targetStage === 2 ||
      draft.targetStage === 3 ||
      draft.targetStage === 4 ||
      draft.targetStage === 5 ||
      draft.targetStage === 6
    ) {
      setTargetStage(draft.targetStage);
    }
    if (typeof draft.lastSupportType === 'string') setLastSupportType(draft.lastSupportType);
    if (typeof draft.caseWorkerNote === 'string') setCaseWorkerNote(draft.caseWorkerNote);
    if (typeof draft.fieldNotesInput === 'string') setFieldNotesInput(draft.fieldNotesInput);
    if (draft.draftId) setActiveDraftId(draft.draftId);
  }, []);

  // Load initial edit case if navigated from Overview or Inquiry
  useEffect(() => {
    if (!initialEditCaseId) return;
    const match = editableCases.find((c) => c.id === initialEditCaseId);
    if (match) {
      setMode('update');
      setCurrentStep(1);
      loadExistingCaseIntoForm(match);
    }
  }, [initialEditCaseId, editableCases, loadExistingCaseIntoForm]);

  // Restore continuous auto-saved session per activeInstitution on mount (if no explicit edit/prefill)
  useEffect(() => {
    if (initialEditCaseId || prefilledNationalId) return;
    try {
      const raw = localStorage.getItem(`${AUTOSAVE_PREFIX}${activeInstitution}`);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<AssessmentDraftSnapshot> | null;
      if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return;
      const hasMeaningfulData =
        Boolean(draft.fullName?.trim()) ||
        Boolean(draft.nationalId?.trim()) ||
        Boolean(draft.fieldNotesInput?.trim()) ||
        Boolean(draft.medicalNotes?.trim()) ||
        (draft.currentStep && draft.currentStep > 1);
      if (hasMeaningfulData) {
        applyDraftSnapshot(draft);
        if (draft.savedAt) {
          setLastAutoSavedAt(draft.savedAt);
        }
      }
    } catch {
      // ignore invalid autosave
    }
  }, [activeInstitution, initialEditCaseId, prefilledNationalId, applyDraftSnapshot]);

  // Keep latest form snapshot in a ref for 10-second periodic auto-save & sudden-exit flush
  const latestAutoSaveRef = useRef<Partial<AssessmentDraftSnapshot> | null>(null);
  const autoSaveDirtyRef = useRef(false);

  const flushAutoSaveSnapshot = useCallback(
    (force = false) => {
      if (submitSuccess || isRestrictedRole) return;
      const snapshot = latestAutoSaveRef.current;
      if (!snapshot) return;
      if (!force && !autoSaveDirtyRef.current) return;

      const parts = getPersianDateTimeParts();
      const stampedAt = `${parts.date} · ${parts.time}`;
      const payload: Partial<AssessmentDraftSnapshot> = {
        ...snapshot,
        savedAt: stampedAt,
      };

      try {
        localStorage.setItem(`${AUTOSAVE_PREFIX}${activeInstitution}`, JSON.stringify(payload));
        if (payload.draftId) {
          const existing = readSavedDrafts();
          const idx = existing.findIndex((d) => d.draftId === payload.draftId);
          if (idx >= 0) {
            existing[idx] = {
              ...existing[idx],
              ...(payload as AssessmentDraftSnapshot),
              savedAt: stampedAt,
            };
            writeSavedDrafts(existing);
            setSavedDrafts(existing);
          }
        }
        autoSaveDirtyRef.current = false;
        setLastAutoSavedAt(stampedAt);
      } catch {
        // ignore quota errors
      }
    },
    [activeInstitution, isRestrictedRole, submitSuccess],
  );

  // Track changes and mark snapshot dirty for the 10-second Auto-save timer
  useEffect(() => {
    if (submitSuccess || isRestrictedRole) return;
    const hasInput =
      Boolean(fullName.trim()) ||
      Boolean(nationalId.trim()) ||
      Boolean(phone.trim()) ||
      Boolean(address.trim()) ||
      Boolean(fieldNotesInput.trim()) ||
      Boolean(medicalNotes.trim()) ||
      Boolean(caseWorkerNote.trim()) ||
      consentPillar1 ||
      consentPillar2 ||
      consentPillar3 ||
      currentStep > 1;
    if (!hasInput) {
      latestAutoSaveRef.current = null;
      autoSaveDirtyRef.current = false;
      return;
    }

    const headPoints = getHeadPoints(headStatus);
    const housingOwnershipPoints = getHousingPoints(housingType);
    const computedScoreTotal =
      Math.min(30, headPoints + studentsCount * 3 + dependentsCount * 5) +
      Math.min(25, housingOwnershipPoints + (lacksUtilities ? 9 : 0)) +
      Math.min(25, incomeSourcePoints + (hasUnemployedWorker ? 7 : 0)) +
      Math.min(20, (hasChronicDisease ? 14 : 0) + (childNutritionRisk ? 6 : 0));

    latestAutoSaveRef.current = {
      draftId: activeDraftId || undefined,
      institution: activeInstitution,
      mode,
      selectedCaseId,
      currentStep,
      visitDate,
      visitTime,
      oralMode,
      consentPillar1,
      consentPillar2,
      consentPillar3,
      fullName,
      nationalId,
      phone,
      blockId,
      address,
      householdSize,
      skillInterest,
      headStatus,
      studentsCount,
      dependentsCount,
      housingType,
      lacksUtilities,
      incomeSourcePoints,
      hasUnemployedWorker,
      hasChronicDisease,
      childNutritionRisk,
      medicalNotes,
      targetStage,
      lastSupportType,
      caseWorkerNote,
      fieldNotesInput,
      scoreTotal: computedScoreTotal,
    };
    autoSaveDirtyRef.current = true;
  }, [
    activeInstitution,
    activeDraftId,
    isRestrictedRole,
    submitSuccess,
    mode,
    selectedCaseId,
    currentStep,
    visitDate,
    visitTime,
    oralMode,
    consentPillar1,
    consentPillar2,
    consentPillar3,
    fullName,
    nationalId,
    phone,
    blockId,
    address,
    householdSize,
    headStatus,
    studentsCount,
    dependentsCount,
    housingType,
    lacksUtilities,
    incomeSourcePoints,
    hasUnemployedWorker,
    hasChronicDisease,
    childNutritionRisk,
    medicalNotes,
    skillInterest,
    targetStage,
    lastSupportType,
    caseWorkerNote,
    fieldNotesInput,
  ]);

  // 10-second periodic Auto-save interval + sudden-exit flush (beforeunload / visibilitychange)
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      flushAutoSaveSnapshot(false);
    }, 10000);

    const handleBeforeUnload = () => {
      flushAutoSaveSnapshot(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushAutoSaveSnapshot(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      flushAutoSaveSnapshot(true);
    };
  }, [flushAutoSaveSnapshot]);

  // Sync prefilled props from InquiryView
  useEffect(() => {
    if (prefilledNationalId) {
      setMode('new');
      setNationalId(prefilledNationalId);
      setStepInquiryResult(null);
    }
  }, [prefilledNationalId]);

  useEffect(() => {
    if (prefilledBlockId) {
      setBlockId(prefilledBlockId);
    } else if (blocks.length > 0 && !blocks.some((b) => b.id === blockId)) {
      setBlockId(blocks[0].id);
    }
  }, [prefilledBlockId, blocks, blockId]);

  // Reset update selection if institution switches away from owning institution
  useEffect(() => {
    if (mode === 'update' && selectedCaseId) {
      const stillEditable = editableCases.some((c) => c.id === selectedCaseId);
      if (!stillEditable) {
        setSelectedCaseId('');
        setSubmitSuccess(null);
      }
    }
  }, [activeInstitution, mode, selectedCaseId, editableCases]);

  const score = useMemo(() => {
    const headPoints = getHeadPoints(headStatus);
    const housingOwnershipPoints = getHousingPoints(housingType);
    const familyStructure = Math.min(30, headPoints + studentsCount * 3 + dependentsCount * 5);
    const housing = Math.min(25, housingOwnershipPoints + (lacksUtilities ? 9 : 0));
    const livelihood = Math.min(25, incomeSourcePoints + (hasUnemployedWorker ? 7 : 0));
    const health = Math.min(20, (hasChronicDisease ? 14 : 0) + (childNutritionRisk ? 6 : 0));
    const total = familyStructure + housing + livelihood + health;
    return {familyStructure, housing, livelihood, health, total};
  }, [
    headStatus,
    studentsCount,
    dependentsCount,
    housingType,
    lacksUtilities,
    incomeSourcePoints,
    hasUnemployedWorker,
    hasChronicDisease,
    childNutritionRisk,
  ]);

  const urgencyMeta = useMemo(() => {
    if (score.total >= 70) {
      return {
        tierLabel: 'قرمز · بحرانی (نیاز به حمایت فوری)',
        colorClass: 'text-red-700 dark:text-red-400',
        barClass: 'bg-red-600',
        recommendedPath: 'livelihood_medical' as ServicePath,
        pathLabel: 'مسیریابی معیشتی و درمانی فوری + بررسی صندوق درمان مشترک',
      };
    }
    if (score.total >= 40) {
      return {
        tierLabel: 'زرد · نیازمند مستمر',
        colorClass: 'text-amber-700 dark:text-amber-400',
        barClass: 'bg-amber-600',
        recommendedPath: 'empowerment_employment' as ServicePath,
        pathLabel: 'مسیریابی توانمندسازی، معرفی به صندوق خودیاری خرد و آموزش مهارت',
      };
    }
    return {
      tierLabel: 'سبز · مستعد ورود به چرخه توانمندسازی',
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      barClass: 'bg-emerald-600',
      recommendedPath: 'empowerment_employment' as ServicePath,
      pathLabel: 'مسیریابی اشتغال خانگی و اتصال به بازار کار محلی',
    };
  }, [score.total]);

  // Live local 3-month need forecast preview (Step 4)
  const liveThreeMonthForecast = useMemo(() => {
    if (targetStage === 6) {
      return {
        categoryLabel: 'پایش ثبات شغلی و خوداتکایی',
        probabilityPct: 18,
        riskLevel: 'پایین' as const,
        riskColor: 'text-emerald-700 dark:text-emerald-400',
        rationale: 'خانوار در مرحله خروج موفق قرار گرفته است و ریسک بازگشت به نیاز حمایتی پایین برآورد می‌شود.',
      };
    }
    const medicalScore = (score.health / 20) * 65 + (hasChronicDisease ? 20 : 0) + (householdSize >= 5 ? 5 : 0);
    const employmentScore =
      (score.livelihood / 25) * 50 +
      (urgencyMeta.recommendedPath === 'empowerment_employment' ? 18 : 0) +
      (hasUnemployedWorker ? 14 : 0) +
      (headStatus === 'زن سرپرست خانوار' ? 7 : 0);
    const housingScore =
      (score.housing / 25) * 54 +
      (housingType.includes('غیررسمی') || housingType.includes('فاقد سرپناه')
        ? 20
        : housingType.includes('استیجاری')
          ? 12
          : 0) +
      (householdSize >= 5 ? 7 : 0);

    const list = [
      {
        categoryLabel: 'خدمات پزشکی و درمان',
        raw: medicalScore,
        rationale: `با توجه به امتیاز سلامت (${score.health}/۲۰) و وضعیت بیماری مزمن، نیاز به پوشش دارویی یا صندوق درمان مشترک در ۹۰ روز آینده محتمل است.`,
      },
      {
        categoryLabel: 'حمایت اشتغال و تسهیلات',
        raw: employmentScore,
        rationale: `شاخص معیشت (${score.livelihood}/۲۵) و آمادگی نیروی کار خانوار، اولویت اتصال به صندوق خودیاری خرد و تسهیلات اشتغال خانگی را نشان می‌دهد.`,
      },
      {
        categoryLabel: 'حمایت مسکن و اجاره‌بها',
        raw: housingScore,
        rationale: `امتیاز مسکن (${score.housing}/۲۵) و وضعیت «${housingType}» ریسک نیاز به کمک‌هزینه ودیعه یا ترمیم سرپناه در فصل پیش رو را برجسته می‌کند.`,
      },
    ].sort((a, b) => b.raw - a.raw);

    const top = list[0];
    const pct = Math.min(95, Math.max(28, Math.round(top.raw)));
    const riskLevel = pct >= 75 ? 'بالا' : pct >= 52 ? 'متوسط' : 'پایین';
    const riskColor =
      pct >= 75
        ? 'text-red-700 dark:text-red-400'
        : pct >= 52
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-emerald-700 dark:text-emerald-400';

    return {
      categoryLabel: top.categoryLabel,
      probabilityPct: pct,
      riskLevel,
      riskColor,
      rationale: top.rationale,
    };
  }, [score, hasChronicDisease, householdSize, urgencyMeta.recommendedPath, hasUnemployedWorker, headStatus, housingType, targetStage]);

  const consentComplete = consentPillar1 && consentPillar2 && consentPillar3;

  const handleSetNowDateTime = () => {
    const parts = getPersianDateTimeParts();
    setVisitDate(parts.date);
    setVisitTime(parts.shortTime);
  };

  const handleModeSwitch = (nextMode: WizardMode) => {
    setMode(nextMode);
    setCurrentStep(1);
    setStepValidationError(null);
    setSubmitError(null);
    setSubmitSuccess(null);
    setStepInquiryResult(null);
    setStepInquiryError(null);
    if (nextMode === 'new') {
      setSelectedCaseId('');
      onClearInitialEditCase?.();
      setTargetStage(2);
      setLastSupportType('ارزیابی اولیه و تشکیل پرونده معیشتی');
      setNationalId('');
      setFullName('');
      setPhone('');
      setAddress('');
      setMedicalNotes('');
      setCaseWorkerNote('');
      setConsentPillar1(false);
      setConsentPillar2(false);
      setConsentPillar3(false);
    } else if (editableCases.length > 0) {
      const first = editableCases[0];
      loadExistingCaseIntoForm(first);
    }
  };

  const handleRunStep1Inquiry = async () => {
    setStepInquiryError(null);
    setStepInquiryResult(null);
    if (!nationalId.trim()) {
      setStepInquiryError('ابتدا شماره ملی ۱۰ رقمی سرپرست خانوار را وارد کنید.');
      return;
    }
    setStepInquiryLoading(true);
    try {
      const res = await fetch('/api/inquiry', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          nationalId,
          institution: activeInstitution,
          role: activeRole,
          blockId,
          needsMedicalSpecial: hasChronicDisease,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStepInquiryError(data.error || 'خطا در استعلام کدملی.');
        return;
      }
      setStepInquiryResult(data as InquiryResponse);
    } catch {
      setStepInquiryError('خطا در برقراری ارتباط با سرویس استعلام کدملی.');
    } finally {
      setStepInquiryLoading(false);
    }
  };

  const handleRunSmartAssist = async () => {
    setSmartAssistError(null);
    setSmartAssistLoading(true);
    try {
      const res = await fetch('/api/ai/smart-assist', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          fieldNotes: fieldNotesInput,
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSmartAssistError(data.error || 'خطا در تحلیل هوشمند متن مشاهدات.');
        return;
      }
      setSmartAssistResult(data.assist as SmartFieldAssistResponse);
    } catch {
      setSmartAssistError('امکان برقراری ارتباط با دستیار هوشمند وجود ندارد.');
    } finally {
      setSmartAssistLoading(false);
    }
  };

  const handleApplySmartAssist = () => {
    if (!smartAssistResult) return;
    if (
      smartAssistResult.suggestedHeadStatus === 'زن سرپرست خانوار' ||
      smartAssistResult.suggestedHeadStatus === 'سرپرست ازکارافتاده / بیمار صعب‌العلاج' ||
      smartAssistResult.suggestedHeadStatus === 'معلول یا زندانی' ||
      smartAssistResult.suggestedHeadStatus === 'عادی'
    ) {
      setHeadStatus(smartAssistResult.suggestedHeadStatus);
    }
    if (
      smartAssistResult.suggestedHousingType === 'استیجاری با اجاره سنگین' ||
      smartAssistResult.suggestedHousingType === 'سکونتگاه غیررسمی / حاشیه‌ای' ||
      smartAssistResult.suggestedHousingType === 'فاقد سرپناه مستقل' ||
      smartAssistResult.suggestedHousingType === 'رهن یا مسکن مهر' ||
      smartAssistResult.suggestedHousingType === 'ملکی'
    ) {
      setHousingType(smartAssistResult.suggestedHousingType);
    }
    setLacksUtilities(Boolean(smartAssistResult.suggestedLacksUtilities));
    if ([18, 14, 10, 5].includes(smartAssistResult.suggestedIncomeSourcePoints)) {
      setIncomeSourcePoints(smartAssistResult.suggestedIncomeSourcePoints);
    }
    setHasUnemployedWorker(Boolean(smartAssistResult.suggestedHasUnemployedWorker));
    setHasChronicDisease(Boolean(smartAssistResult.suggestedHasChronicDisease));
    setChildNutritionRisk(Boolean(smartAssistResult.suggestedChildNutritionRisk));
    if (smartAssistResult.suggestedSkillInterest) {
      setSkillInterest(smartAssistResult.suggestedSkillInterest);
    }
    if (smartAssistResult.structuredMedicalSummary) {
      setMedicalNotes(smartAssistResult.structuredMedicalSummary);
    }
    if (smartAssistResult.suggestedSupportAction) {
      setLastSupportType(smartAssistResult.suggestedSupportAction);
    }
  };

  const handleAskAiAdvisor = async () => {
    setAiError(null);
    setAiLoading(true);
    const block = blocks.find((b) => b.id === blockId);
    try {
      // Strictly send ONLY anonymized scores & block name — zero PII!
      const res = await fetch('/api/ai/recommend', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          scoreTotal: score.total,
          familyScore: score.familyStructure,
          housingScore: score.housing,
          livelihoodScore: score.livelihood,
          healthScore: score.health,
          headStatus,
          blockName: block?.name || 'ناحیه نایسر',
          householdSize,
          hasSkillInterest: skillInterest,
          mode,
          previousScoreTotal: selectedExistingCase?.score.total,
          currentStage: targetStage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'خطا در دریافت پیشنهاد هوشمند.');
        return;
      }
      setAiRecommendation(data.recommendation);
    } catch {
      setAiError('امکان برقراری ارتباط با سرویس مشاوره هوشمند وجود ندارد.');
    } finally {
      setAiLoading(false);
    }
  };

  const validateBeforeStep = (targetStep: WizardStep): string | null => {
    if (targetStep <= 1) return null;
    if (mode === 'update' && !selectedExistingCase) {
      return 'در حالت بروزرسانی، ابتدا پرونده مورد نظر را از فهرست پرونده‌های قبلی انتخاب کنید.';
    }
    if (!consentComplete) {
      return 'پیش از ورود به گام‌های ارزیابی، تایید هر سه بند رضایت‌نامه آگاهانه الزامی است.';
    }
    if (targetStep >= 3) {
      if (!fullName.trim()) {
        return 'لطفاً در گام ۲ نام و نام خانوادگی سرپرست خانوار را وارد نمایید.';
      }
      if (mode === 'new') {
        const cleanDigits = nationalId.replace(/[۰-۹٠-٩]/g, (ch) => {
          const p = '۰۱۲۳۴۵۶۷۸۹'.indexOf(ch);
          if (p >= 0) return String(p);
          const a = '٠١٢٣٤٥٦٧٨٩'.indexOf(ch);
          return a >= 0 ? String(a) : ch;
        }).replace(/\D/g, '');
        if (cleanDigits.length !== 10) {
          return 'در گام ۲ وارد کردن کدملی ۱۰ رقمی معتبر برای ثبت پرونده جدید الزامی است.';
        }
      }
    }
    return null;
  };

  const handleGoToStep = (nextStep: WizardStep) => {
    const err = validateBeforeStep(nextStep);
    if (err) {
      setStepValidationError(err);
      return;
    }
    setStepValidationError(null);
    setCurrentStep(nextStep);
  };

  const handleSaveOrUpdateCase = async () => {
    setSubmitError(null);
    setStepValidationError(null);

    const err = validateBeforeStep(5);
    if (err) {
      setSubmitError(err);
      return;
    }

    const formattedDate = normalizeVisitDateInput(visitDate);
    const formattedTime = normalizeVisitTimeInput(visitTime);
    const assessmentDetails = {
      studentsCount,
      dependentsCount,
      lacksUtilities,
      incomeSourcePoints,
      hasUnemployedWorker,
      hasChronicDisease,
      childNutritionRisk,
      skillInterest,
    };

    setSubmitting(true);
    try {
      if (mode === 'update' && selectedExistingCase) {
        const res = await fetch(`/api/cases/${encodeURIComponent(selectedExistingCase.id)}`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            institution: activeInstitution,
            role: activeRole,
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
            visitDate: formattedDate,
            visitTime: formattedTime,
            stage: targetStage,
            consentSigned: consentComplete,
            score,
            servicePath: urgencyMeta.recommendedPath,
            assessmentDetails,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || 'خطا در بروزرسانی پرونده.');
          return;
        }
        const stageChanged = selectedExistingCase.stage !== targetStage;
        try {
          localStorage.removeItem(`${AUTOSAVE_PREFIX}${activeInstitution}`);
        } catch {
          // ignore
        }
        if (activeDraftId) {
          const nextDrafts = savedDrafts.filter((d) => d.draftId !== activeDraftId);
          setSavedDrafts(nextDrafts);
          writeSavedDrafts(nextDrafts);
          setActiveDraftId(null);
        }
        setSubmitSuccess({
          caseId: data.caseRecord.id,
          timestamp: data.caseRecord.lastUpdatedAt,
          auditLogId: data.auditLogId,
          scoreTotal: data.newScore,
          previousScore: data.previousScore,
          isUpdate: true,
        });
        await onCaseSaved({
          caseId: data.caseRecord.id,
          isUpdate: true,
          stageChanged,
          stage: targetStage,
          fullName: fullName.trim(),
        });
      } else {
        const res = await fetch('/api/cases', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            nationalId,
            institution: activeInstitution,
            role: activeRole,
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
            visitDate: formattedDate,
            visitTime: formattedTime,
            stage: targetStage,
            consentSigned: consentComplete,
            score,
            servicePath: urgencyMeta.recommendedPath,
            assessmentDetails,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSubmitError(data.error || 'خطا در ثبت پرونده.');
          return;
        }
        try {
          localStorage.removeItem(`${AUTOSAVE_PREFIX}${activeInstitution}`);
        } catch {
          // ignore
        }
        if (activeDraftId) {
          const nextDrafts = savedDrafts.filter((d) => d.draftId !== activeDraftId);
          setSavedDrafts(nextDrafts);
          writeSavedDrafts(nextDrafts);
          setActiveDraftId(null);
        }
        setSubmitSuccess({
          caseId: data.caseRecord.id,
          timestamp: data.caseRecord.registeredAt,
          auditLogId: data.auditLogId,
          scoreTotal: score.total,
          isUpdate: false,
        });
        await onCaseSaved({
          caseId: data.caseRecord.id,
          isUpdate: false,
          stageChanged: false,
          stage: targetStage,
          fullName: fullName.trim(),
        });
      }
    } catch {
      setSubmitError(
        !navigator.onLine
          ? 'ارتباط اینترنت قطع است؛ اطلاعات شما به صورت موقت در دستگاه ذخیره شده و پس از اتصال قابل ثبت نهایی است.'
          : 'خطا در ارتباط با سرور برای ذخیره اطلاعات. پیش‌نویس شما به صورت خودکار حفظ شده است.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTemporaryDraft = () => {
    if (isRestrictedRole) return;
    const nowTs = getPersianDateTimeParts().timestamp;
    const draftId =
      activeDraftId ||
      (mode === 'update' && selectedCaseId
        ? `draft-upd-${activeInstitution}-${selectedCaseId}`
        : `draft-new-${activeInstitution}-${Date.now()}`);

    const snapshot: AssessmentDraftSnapshot = {
      draftId,
      institution: activeInstitution,
      savedAt: nowTs,
      mode,
      selectedCaseId,
      currentStep,
      visitDate,
      visitTime,
      oralMode,
      consentPillar1,
      consentPillar2,
      consentPillar3,
      fullName,
      nationalId,
      phone,
      blockId,
      address,
      householdSize,
      skillInterest,
      headStatus,
      studentsCount,
      dependentsCount,
      housingType,
      lacksUtilities,
      incomeSourcePoints,
      hasUnemployedWorker,
      hasChronicDisease,
      childNutritionRisk,
      medicalNotes,
      targetStage,
      lastSupportType,
      caseWorkerNote,
      fieldNotesInput,
      scoreTotal: score.total,
    };

    const existing = readSavedDrafts().filter((d) => d.draftId !== draftId);
    const updated = [snapshot, ...existing].slice(0, 12);
    writeSavedDrafts(updated);
    setSavedDrafts(updated);
    setActiveDraftId(draftId);
    setLastAutoSavedAt(nowTs);
    const label = fullName.trim() || (selectedCaseId ? `پرونده ${selectedCaseId}` : 'پرونده جدید');
    const noticeMsg = `ذخیره موقت «${label}» در گام ${toPersianDigits(currentStep)} از ۵ انجام شد.`;
    setDraftStatusNotice(noticeMsg);
    onDraftToast?.(
      'ذخیره موقت پرونده انجام شد',
      `${label} در گام ${toPersianDigits(currentStep)} (${WIZARD_STEPS[currentStep - 1].shortTitle}) ذخیره شد و بعداً قابل ادامه است.`,
    );
  };

  const handleResumeDraft = (draft: AssessmentDraftSnapshot) => {
    setSubmitSuccess(null);
    setSubmitError(null);
    setStepValidationError(null);
    applyDraftSnapshot(draft);
    setDraftStatusNotice(
      `پیش‌نویس «${draft.fullName.trim() || 'پرونده جدید'}» از گام ${toPersianDigits(draft.currentStep)} بازیابی شد.`,
    );
    onDraftToast?.(
      'پیش‌نویس موقت بازیابی شد',
      `ادامه فرآیند ارزیابی از گام ${toPersianDigits(draft.currentStep)} (${WIZARD_STEPS[draft.currentStep - 1].shortTitle}).`,
    );
  };

  const handleDeleteSavedDraft = (draftId: string) => {
    const updated = savedDrafts.filter((d) => d.draftId !== draftId);
    writeSavedDrafts(updated);
    setSavedDrafts(updated);
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
  };

  const handleClearDraft = () => {
    try {
      localStorage.removeItem(`${AUTOSAVE_PREFIX}${activeInstitution}`);
    } catch {
      // ignore
    }
    setActiveDraftId(null);
    setDraftStatusNotice(null);
    setFullName('');
    setNationalId('');
    setPhone('');
    setAddress('');
    setHouseholdSize(4);
    setHeadStatus('زن سرپرست خانوار');
    setStudentsCount(2);
    setDependentsCount(1);
    setHousingType('استیجاری با اجاره سنگین');
    setLacksUtilities(false);
    setIncomeSourcePoints(14);
    setHasUnemployedWorker(true);
    setHasChronicDisease(false);
    setChildNutritionRisk(false);
    setMedicalNotes('');
    setCaseWorkerNote('');
    setFieldNotesInput('');
    setSmartAssistResult(null);
    setAiRecommendation(null);
    setSubmitSuccess(null);
    setCurrentStep(1);
    handleSetNowDateTime();
  };

  const institutionDrafts = useMemo(() => {
    return savedDrafts.filter((d) => d.institution === activeInstitution);
  }, [savedDrafts, activeInstitution]);

  const scoreDelta =
    mode === 'update' && selectedExistingCase
      ? score.total - selectedExistingCase.score.total
      : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            فرآیند گام‌به‌گام هوشمند ارزیابی، تشکیل پرونده و بروزرسانی سوابق
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            ثبت ساختاریافته پرونده‌های جدید یا بازبینی و بروزرسانی پرونده‌های قبلی با استعلام آنی
            کدملی، استخراج هوشمند شاخص‌ها از گزارش میدانی و ثبت دقیق تاریخ و ساعت شمسی.
          </p>
        </div>

        {/* Mode Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => handleModeSwitch('new')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              mode === 'new'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            تشکیل پرونده جدید
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('update')}
            className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
              mode === 'update'
                ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ClipboardEdit className="w-4 h-4" />
            بروزرسانی پرونده قبلی ({toPersianDigits(editableCases.length)})
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 flex items-start gap-3 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
          <WifiOff className="w-5 h-5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
          <div>
            <strong>حالت آفلاین فعال است (قطع ارتباط اینترنت):</strong> نگران از دست رفتن اطلاعات
            نباشید؛ تمامی ورودی‌های این مرحله به صورت خودکار روی دستگاه ذخیره می‌شوند. همچنین
            می‌توانید با دکمه <strong>«ذخیره موقت و ادامه بعداً»</strong> پرونده را ثبت موقت کرده
            و پس از برقراری اینترنت از همین مرحله ادامه دهید.
          </div>
        </div>
      )}

      {isRestrictedRole && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 flex items-start gap-3 text-sm text-amber-900 dark:text-amber-200">
          <Lock className="w-5 h-5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
          <div>
            <strong>محدودیت نقش ناظر امنیتی:</strong> مطابق ماتریس RBAC و تفکیک داده‌ها، ثبت یا
            ویرایش جزئیات هویتی و پرونده‌های مددجویان صرفاً در محیط کاربری یکی از دو مؤسسه
            (دارالاحسان یا عدالت و برابری) مجاز است. می‌توانید از نوار بالای صفحه محیط کاربری مؤسسه
            را انتخاب کنید.
          </div>
        </div>
      )}

      {/* Saved Temporary Drafts Queue (Resume from Exact Step) */}
      {!isRestrictedRole && institutionDrafts.length > 0 && (
        <section
          aria-label="پرونده‌های ذخیره موقت"
          className="bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/70 rounded-xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HardDriveDownload className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                پرونده‌های ذخیره موقت ({toPersianDigits(institutionDrafts.length)} مورد آماده ادامه)
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              ذخیره‌شده در حافظه امن دستگاه برای ادامه بدون قطعی از آخرین مرحله
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {institutionDrafts.map((draft) => {
              const blockLabel = blocks.find((b) => b.id === draft.blockId)?.name || 'نایسر';
              const isCurrentlyLoaded = activeDraftId === draft.draftId;
              return (
                <div
                  key={draft.draftId}
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isCurrentlyLoaded
                      ? 'bg-teal-50/70 dark:bg-teal-950/40 border-teal-500 dark:border-teal-600'
                      : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        {draft.fullName.trim() || 'پرونده بدون نام سرپرست'}
                      </span>
                      <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                        · گام {toPersianDigits(draft.currentStep)} از ۵ (
                        {WIZARD_STEPS[draft.currentStep - 1].shortTitle})
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      <span>
                        {draft.mode === 'update' && draft.selectedCaseId
                          ? `بروزرسانی ${draft.selectedCaseId}`
                          : 'تشکیل پرونده جدید'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{blockLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>امتیاز: {toPersianDigits(draft.scoreTotal)}/۱۰۰</span>
                      <span aria-hidden="true">·</span>
                      <span>ذخیره: {draft.savedAt}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleResumeDraft(draft)}
                      className="px-3 py-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Play className="w-3.5 h-3.5" />
                      ادامه از گام {toPersianDigits(draft.currentStep)}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedDraft(draft.draftId)}
                      aria-label="حذف پیش‌نویس موقت"
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {draftStatusNotice && (
        <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/35 border border-teal-200 dark:border-teal-800/70 text-xs text-teal-900 dark:text-teal-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <span>{draftStatusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setDraftStatusNotice(null)}
            className="text-[11px] underline underline-offset-4 text-teal-700 dark:text-teal-300 shrink-0"
          >
            بستن
          </button>
        </div>
      )}

      {/* 5-Step Interactive Progress Stepper */}
      <nav
        aria-label="مراحل گام‌به‌گام ارزیابی"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4"
      >
        <ol className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {WIZARD_STEPS.map((s) => {
            const isActive = currentStep === s.step;
            const isCompleted = currentStep > s.step;
            return (
              <li key={s.step}>
                <button
                  type="button"
                  onClick={() => handleGoToStep(s.step)}
                  className={`w-full text-right px-3 py-2.5 rounded-lg border transition-colors flex items-center gap-2.5 ${
                    isActive
                      ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-600 dark:border-teal-500 text-teal-900 dark:text-teal-200'
                      : isCompleted
                        ? 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-md text-xs font-mono font-bold flex items-center justify-center shrink-0 tabular-nums ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : toPersianDigits(s.step)}
                  </span>
                  <span className="text-xs font-semibold truncate">{s.shortTitle}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {stepValidationError && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-xs sm:text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{stepValidationError}</span>
        </div>
      )}

      {/* Main Grid: Active Step Content (8 cols) + Live Sticky Summary (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* ==================== STEP 1 ==================== */}
          {currentStep === 1 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    {WIZARD_STEPS[0].title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    محیط ثبت فعال: {getInstitutionLabel(activeInstitution)}
                  </p>
                </div>
                {mode === 'new' && (
                  <button
                    type="button"
                    onClick={handleClearDraft}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-4 self-start sm:self-auto"
                  >
                    پاک کردن پیش‌نویس فرم
                  </button>
                )}
              </div>

              {/* Mode-Specific Case Selection or Quick Duplicate Inquiry */}
              {mode === 'update' ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      انتخاب پرونده قبلی جهت بازبینی و بروزرسانی
                    </label>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="search"
                        value={casePickerSearch}
                        onChange={(e) => setCasePickerSearch(e.target.value)}
                        placeholder="جستجو نام، کد پرونده یا بلوک..."
                        className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                  </div>

                  {filteredEditableCases.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                      پرونده قابل ویرایشی برای {getInstitutionLabel(activeInstitution)} مطابق فیلتر یافت نشد.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pl-1">
                      {filteredEditableCases.map((item) => {
                        const isSelected = selectedCaseId === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => loadExistingCaseIntoForm(item)}
                            className={`text-right p-3.5 rounded-xl border transition-colors space-y-1 ${
                              isSelected
                                ? 'border-teal-600 dark:border-teal-500 bg-teal-50/70 dark:bg-teal-950/40'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-mono font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                                {item.id}
                              </span>
                              <span className="font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                                امتیاز {item.score.total}/۱۰۰
                              </span>
                            </div>
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {item.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {STAGE_LABELS[item.stage]} · آخرین بروزرسانی: {item.lastUpdatedAt}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedExistingCase?.history && selectedExistingCase.history.length > 0 && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <History className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        تاریخچه اقدامات ثبت‌شده این پرونده ({selectedExistingCase.id})
                      </div>
                      <ul className="space-y-2 text-xs">
                        {selectedExistingCase.history.slice(0, 4).map((evt) => (
                          <li
                            key={evt.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-700 dark:text-slate-300 border-b border-slate-200/70 dark:border-slate-700/70 last:border-0 pb-1.5 last:pb-0"
                          >
                            <span>{evt.summary}</span>
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                              {evt.timestamp}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    استعلام آنی کدملی پیش از تکمیل فرم (جلوگیری از پرونده تکراری)
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      value={nationalId}
                      onChange={(e) => {
                        setNationalId(e.target.value);
                        setStepInquiryResult(null);
                      }}
                      placeholder="کدملی ۱۰ رقمی سرپرست خانوار (مثال: 3730998877)"
                      className="flex-1 px-3.5 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      disabled={stepInquiryLoading}
                      onClick={handleRunStep1Inquiry}
                      className="px-4 py-2 text-xs sm:text-sm font-medium bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      {stepInquiryLoading ? 'در حال بررسی هش...' : 'بررسی سریع کدملی'}
                    </button>
                  </div>

                  {stepInquiryError && (
                    <div className="text-xs text-red-700 dark:text-red-400">{stepInquiryError}</div>
                  )}

                  {stepInquiryResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs space-y-2 ${
                        stepInquiryResult.status === 'CLEAN'
                          ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                          : 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      {stepInquiryResult.status === 'CLEAN' ? (
                        <div className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          تایید شد: این کدملی در هیچ‌یک از دو مؤسسه ثبت نشده و آماده تشکیل پرونده جدید است.
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {stepInquiryResult.status === 'MATCH_SAME'
                              ? `این کدملی پیش‌تر در همین مؤسسه (${stepInquiryResult.matchedRecord?.caseId}) ثبت شده است.`
                              : `این خانوار تحت پوشش ${stepInquiryResult.matchedRecord?.owningInstitutionName} ثبت شده است.`}
                          </div>
                          {stepInquiryResult.status === 'MATCH_SAME' &&
                            stepInquiryResult.matchedRecord && (
                              <button
                                type="button"
                                onClick={() => {
                                  const match = editableCases.find(
                                    (c) => c.id === stepInquiryResult.matchedRecord?.caseId,
                                  );
                                  if (match) {
                                    setMode('update');
                                    loadExistingCaseIntoForm(match);
                                  }
                                }}
                                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-md font-medium"
                              >
                                سوئیچ به حالت بروزرسانی همین پرونده ({stepInquiryResult.matchedRecord.caseId})
                              </button>
                            )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Visit Date & Time (Jalali + Tehran Clock) */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <CalendarClock className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    تاریخ و ساعت دقیق مراجعه یا بازدید میدانی (شمسی)
                  </div>
                  <button
                    type="button"
                    onClick={handleSetNowDateTime}
                    className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    تنظیم خودکار به تاریخ و ساعت اکنون
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      تاریخ شمسی (سال/ماه/روز)
                    </label>
                    <input
                      type="text"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      placeholder="۱۴۰۵/۰۸/۲۴"
                      className="w-full px-3 py-2 font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      ساعت دقیق (ساعت:دقیقه)
                    </label>
                    <input
                      type="text"
                      value={visitTime}
                      onChange={(e) => setVisitTime(e.target.value)}
                      placeholder="۱۴:۳۰"
                      className="w-full px-3 py-2 font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                </div>
              </div>

              {/* Informed Consent Protocol */}
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                      پروتکل رضایت‌نامه آگاهانه و حفظ محرمانگی
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOralMode((prev) => !prev)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      oralMode
                        ? 'border-teal-700 dark:border-teal-500 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {oralMode ? 'متن بیان شفاهی صمیمانه فعال است' : 'راهنمای بیان شفاهی (کم‌سواد)'}
                  </button>
                </div>

                {oralMode && (
                  <div className="p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 text-sm text-teal-950 dark:text-teal-100 leading-relaxed">
                    <strong>راهنمای بیان شفاهی مددکار به مددجو:</strong> «مادر/پدر گرامی، اطلاعات زندگی
                    و بیماری شما کاملاً محرمانه در پرونده خودمان می‌ماند و هیچ‌کس خارج از این دفتر آن را
                    نمی‌بیند. فقط برای اینکه کمک‌ها عادلانه پخش شود و دست یاری به خانواده‌های بیشتر و
                    محروم‌تر نایسر برسد، کدملی شما به صورت یک کد رمزنگاری‌شده با خیریه همکار چک می‌شود.»
                  </div>
                )}

                <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPillar1}
                      onChange={(e) => setConsentPillar1(e.target.checked)}
                      className="mt-1 rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
                    />
                    <span>
                      <strong>۱. حفظ محرمانگی کامل:</strong> اطلاعات شخصی، جزئیات زندگی، شرایط مسکن و
                      پرونده درمانی کاملاً محرمانه تلقی شده و در اختیار اشخاص ثالث قرار نمی‌گیرد.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPillar2}
                      onChange={(e) => setConsentPillar2(e.target.checked)}
                      className="mt-1 rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
                    />
                    <span>
                      <strong>۲. استعلام هم‌پوشانی:</strong> صرفاً وضعیت پوشش حمایتی به صورت کدملی
                      رمزنگاری‌شده (هش یک‌طرفه) جهت جلوگیری از تکرار خدمت با مؤسسه همکار تطبیق داده
                      می‌شود.
                    </span>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consentPillar3}
                      onChange={(e) => setConsentPillar3(e.target.checked)}
                      className="mt-1 rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
                    />
                    <span>
                      <strong>۳. حق انصراف و آگاهی از بازبینی:</strong> مددجو در هر زمان حق انصراف
                      داشته و از ثبت یا بروزرسانی ارزیابی معیشتی خود آگاه است.
                    </span>
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* ==================== STEP 2 ==================== */}
          {currentStep === 2 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    {WIZARD_STEPS[1].title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    امتیاز بخش ساختار خانوار: {toPersianDigits(score.familyStructure)} از ۳۰
                  </p>
                </div>
              </div>

              {/* AI Smart Field Note Extractor */}
              <div className="bg-teal-50/50 dark:bg-teal-950/25 border border-teal-200 dark:border-teal-800/60 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-teal-950 dark:text-teal-200">
                    <Wand2 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    دستیار هوشمند استخراج خودکار شاخص‌ها از گزارش میدانی
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {FIELD_NOTE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => setFieldNotesInput(tpl.text)}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 transition-colors"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={fieldNotesInput}
                  onChange={(e) => setFieldNotesInput(e.target.value)}
                  placeholder="مشاهدات بازدید منزل یا وضعیت خانوار را به صورت متن آزاد بنویسید (بدون ذکر نام و کدملی) تا هوش مصنوعی شاخص‌های مسکن، درآمد، سلامت و سوالات تکمیلی را پیشنهاد دهد..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-teal-200 dark:border-teal-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-600 dark:text-slate-400">
                    اطلاعات هویتی هرگز به مدل هوشمند ارسال نمی‌شود.
                  </span>
                  <button
                    type="button"
                    disabled={smartAssistLoading}
                    onClick={handleRunSmartAssist}
                    className="px-3.5 py-1.5 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {smartAssistLoading
                      ? 'در حال استخراج هوشمند...'
                      : 'تحلیل متن و پیشنهاد تکمیل خودکار فرم'}
                  </button>
                </div>

                {smartAssistError && (
                  <div className="text-xs text-red-700 dark:text-red-400">{smartAssistError}</div>
                )}

                {smartAssistResult && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 space-y-2.5 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        شاخص‌های استخراج‌شده آماده اعمال روی فرم گام ۲ و ۳
                      </span>
                      <button
                        type="button"
                        onClick={handleApplySmartAssist}
                        className="px-3 py-1 bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-800 text-white rounded-md font-medium self-start sm:self-auto"
                      >
                        اعمال پیشنهادها روی فرم
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">سرپرست:</span>{' '}
                        <strong>{smartAssistResult.suggestedHeadStatus}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">مسکن:</span>{' '}
                        <strong>{smartAssistResult.suggestedHousingType}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">مهارت/علاقه:</span>{' '}
                        <strong>{smartAssistResult.suggestedSkillInterest}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">اقدام پیشنهادی:</span>{' '}
                        <strong>{smartAssistResult.suggestedSupportAction}</strong>
                      </div>
                    </div>
                    {smartAssistResult.followUpQuestions.length > 0 && (
                      <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-slate-500 dark:text-slate-400 mb-1 font-medium">
                          سوالات تکمیلی پیشنهادی برای پرسش از سرپرست خانوار:
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-700 dark:text-slate-300">
                          {smartAssistResult.followUpQuestions.map((q, idx) => (
                            <li key={idx}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Household Identity & Structure Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    نام و نام خانوادگی سرپرست خانوار (محرمانه داخلی)
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="مثال: سمیه رستگاری"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white dark:focus:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    {mode === 'update'
                      ? 'کدملی ثبت‌شده (محافظت‌شده)'
                      : 'کدملی سرپرست (۱۰ رقم · هش‌گذاری خودکار)'}
                  </label>
                  <input
                    type="text"
                    required={mode === 'new'}
                    disabled={mode === 'update'}
                    inputMode="numeric"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder="مثال: 3730998877"
                    className="w-full px-3 py-2 font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    شماره تماس
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0918-000-0000"
                    className="w-full px-3 py-2 font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    بلوک جغرافیایی نایسر
                  </label>
                  <select
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    نشانی دقیق سکونت (صرفاً در جدول اختصاصی مؤسسه)
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="نایسر، بلوک ۱، کوچه..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    وضعیت سرپرست خانوار
                  </label>
                  <select
                    value={headStatus}
                    onChange={(e) => setHeadStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="زن سرپرست خانوار">زن سرپرست خانوار</option>
                    <option value="سرپرست ازکارافتاده / بیمار صعب‌العلاج">
                      سرپرست ازکارافتاده / بیمار صعب‌العلاج
                    </option>
                    <option value="معلول یا زندانی">معلول یا زندانی</option>
                    <option value="عادی">سرپرست عادی (حاضر)</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      کل اعضا
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={householdSize}
                      onChange={(e) =>
                        setHouseholdSize(Math.min(15, Math.max(1, Number(e.target.value) || 1)))
                      }
                      className="w-full px-2.5 py-2 tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      محصل
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={studentsCount}
                      onChange={(e) =>
                        setStudentsCount(Math.min(10, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-full px-2.5 py-2 tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      سالمند/معلول
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={dependentsCount}
                      onChange={(e) =>
                        setDependentsCount(Math.min(6, Math.max(0, Number(e.target.value) || 0)))
                      }
                      className="w-full px-2.5 py-2 tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ==================== STEP 3 ==================== */}
          {currentStep === 3 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {WIZARD_STEPS[2].title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  امتیاز مسکن ({toPersianDigits(score.housing)}/۲۵) · معیشت ({toPersianDigits(score.livelihood)}/۲۵) · سلامت ({toPersianDigits(score.health)}/۲۰)
                </p>
              </div>

              {/* Housing */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    وضعیت مسکن و سرپناه
                  </h3>
                  <span className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                    {toPersianDigits(score.housing)} از ۲۵
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      نوع مالکیت و فشار اجاره
                    </label>
                    <select
                      value={housingType}
                      onChange={(e) => setHousingType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    >
                      <option value="استیجاری با اجاره سنگین">استیجاری با اجاره سنگین</option>
                      <option value="سکونتگاه غیررسمی / حاشیه‌ای">سکونتگاه غیررسمی / حاشیه‌ای</option>
                      <option value="فاقد سرپناه مستقل">فاقد سرپناه مستقل</option>
                      <option value="رهن یا مسکن مهر">رهن یا مسکن مهر</option>
                      <option value="ملکی">ملکی</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2.5 sm:pt-5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lacksUtilities}
                      onChange={(e) => setLacksUtilities(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
                    />
                    <span>فاقد سیستم گرمایش مناسب، استحکام بنا یا آب لوله‌کشی سالم</span>
                  </label>
                </div>
              </div>

              {/* Livelihood */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    وضعیت معیشت، درآمد و اشتغال
                  </h3>
                  <span className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                    {toPersianDigits(score.livelihood)} از ۲۵
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      منبع درآمد اصلی و نسبت به خط فقر
                    </label>
                    <select
                      value={incomeSourcePoints}
                      onChange={(e) => setIncomeSourcePoints(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    >
                      <option value={18}>فاقد درآمد ثابت / زیر خط فقر شدید</option>
                      <option value={14}>کارگری فصلی / دستفروشی ناپایدار</option>
                      <option value={10}>مستمری محدود کمیته امداد / بهزیستی</option>
                      <option value={5}>درآمد جزئی خانگی (نیازمند تقویت)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      زمینه مهارتی و علاقه شغلی خانوار
                    </label>
                    <input
                      type="text"
                      value={skillInterest}
                      onChange={(e) => setSkillInterest(e.target.value)}
                      placeholder="مثال: خیاطی، ترشیجات، صنایع دستی، تایپ..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasUnemployedWorker}
                    onChange={(e) => setHasUnemployedWorker(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
                  />
                  <span>وجود نیروی کار فعال بدون شغل (جوان یا زن سرپرست آماده به کار)</span>
                </label>
              </div>

              {/* Health */}
              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    وضعیت سلامت، درمان و تغذیه کودکان
                  </h3>
                  <span className="font-mono text-xs font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                    {toPersianDigits(score.health)} از ۲۰
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 text-sm">
                  <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasChronicDisease}
                      onChange={(e) => setHasChronicDisease(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
                    />
                    <span>بیمار صعب‌العلاج / هزینه دارویی مستمر</span>
                  </label>
                  <label className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={childNutritionRisk}
                      onChange={(e) => setChildNutritionRisk(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
                    />
                    <span>نیاز به حمایت تغذیه‌ای ویژه کودکان</span>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    ملاحظات درمانی و مشاهدات بازدید میدانی (محرمانه داخلی)
                  </label>
                  <textarea
                    rows={2}
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                    placeholder="مشاهدات عینی مددکار از وضعیت زندگی، نیازهای دارویی و شرایط تغذیه..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
              </div>

              {/* Action Registered & Case Stage */}
              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  ثبت اقدام / حمایت این نوبت و تعیین مرحله مدیریت مورد
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SUPPORT_ACTIONS.map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setLastSupportType(act)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                        lastSupportType === act
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      عنوان حمایت یا اقدام ثبت‌شده در این نوبت
                    </label>
                    <input
                      type="text"
                      value={lastSupportType}
                      onChange={(e) => setLastSupportType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      مرحله پرونده در مدل ۶ مرحله‌ای
                    </label>
                    <select
                      value={targetStage}
                      onChange={(e) => setTargetStage(Number(e.target.value) as CaseStage)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                    >
                      {([1, 2, 3, 4, 5, 6] as CaseStage[]).map((st) => (
                        <option key={st} value={st}>
                          {STAGE_LABELS[st]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    یادداشت تخصصی مددکار برای پیگیری بعدی
                  </label>
                  <input
                    type="text"
                    value={caseWorkerNote}
                    onChange={(e) => setCaseWorkerNote(e.target.value)}
                    placeholder="جمع‌بندی پیگیری، ارجاع به صندوق خودیاری یا برنامه بازدید بعدی..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                  />
                </div>
              </div>
            </section>
          )}

          {/* ==================== STEP 4 ==================== */}
          {currentStep === 4 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {WIZARD_STEPS[3].title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  پیش‌بینی خودکار نیاز ۳ ماه آینده و دریافت نقشه راه اختصاصی از هوش مصنوعی (بدون ارسال هویت).
                </p>
              </div>

              {/* Live 3-Month Need Forecast Preview */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    پیش‌بینی نیاز حمایتی خانوار در ۳ ماه آینده (محاسبه زنده)
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${liveThreeMonthForecast.riskColor}`}>
                    ریسک {liveThreeMonthForecast.riskLevel} ({toPersianDigits(liveThreeMonthForecast.probabilityPct)}٪) ·{' '}
                    {liveThreeMonthForecast.categoryLabel}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {liveThreeMonthForecast.rationale}
                </p>
              </div>

              {/* Gemini AI Advisor Trigger */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50/50 dark:bg-teal-950/25 border border-teal-200 dark:border-teal-800/60 rounded-xl p-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    تحلیل هوشمند نقشه راه توانمندسازی و هماهنگی بین‌نهادی
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    فقط امتیازهای عددی و وضعیت مسکن/مهارت به سرور هوش مصنوعی ارسال می‌شود.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={handleAskAiAdvisor}
                  className="px-4 py-2.5 bg-slate-900 dark:bg-teal-700 hover:bg-slate-800 dark:hover:bg-teal-800 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? 'در حال تولید تحلیل هوشمند...' : 'دریافت تحلیل و پیشنهاد هوشمند'}
                </button>
              </div>

              {aiError && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                  {aiError}
                </div>
              )}

              {aiRecommendation && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 text-sm">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
                    خروجی مشاور هوشمند برای این پرونده
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">مسیر مداخله پیشنهادی</div>
                    <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                      {aiRecommendation.recommendedPath}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      ایده‌های کسب‌وکار خرد بومی
                    </div>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside leading-relaxed">
                      {aiRecommendation.microBusinessIdeas.map((idea, idx) => (
                        <li key={idx}>{idea}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">هماهنگی بین دو مؤسسه</div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                      {aiRecommendation.coordinationAdvice}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                      جمله پیشنهادی گفتگو با سرپرست خانوار
                    </div>
                    <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                      {aiRecommendation.dignifiedScript}
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ==================== STEP 5 ==================== */}
          {currentStep === 5 && (
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {WIZARD_STEPS[4].title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  پیش از ثبت نهایی در سامانه و دفتر ممیزی تغییرناپذیر، خلاصه اطلاعات و زمان‌بندی را تایید کنید.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">نوع عملیات و پرونده</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {mode === 'update' && selectedExistingCase
                      ? `بروزرسانی پرونده ${selectedExistingCase.id} (${fullName})`
                      : `تشکیل پرونده جدید (${fullName})`}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {getInstitutionLabel(activeInstitution)} ·{' '}
                    {blocks.find((b) => b.id === blockId)?.name || 'نایسر'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">تاریخ و ساعت ثبت در کارنامه</div>
                  <div className="font-mono font-bold text-teal-800 dark:text-teal-300 tabular-nums">
                    {normalizeVisitDateInput(visitDate)} · {normalizeVisitTimeInput(visitTime)}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    مرحله هدف: {STAGE_LABELS[targetStage]}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">امتیاز نیازمندی و فوریت</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {toPersianDigits(score.total)} از ۱۰۰ ({urgencyMeta.tierLabel})
                  </div>
                  {scoreDelta !== null && selectedExistingCase && (
                    <div className="text-xs font-medium text-teal-700 dark:text-teal-400 tabular-nums">
                      مقایسه با نوبت قبل: {toPersianDigits(selectedExistingCase.score.total)} ⟵{' '}
                      {toPersianDigits(score.total)} (
                      {scoreDelta === 0
                        ? 'بدون تغییر'
                        : scoreDelta < 0
                          ? `کاهش نیاز به میزان ${toPersianDigits(Math.abs(scoreDelta))} امتیاز`
                          : `افزایش نیاز به میزان ${toPersianDigits(scoreDelta)} امتیاز`}
                      )
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">اقدام ثبت‌شده و پیش‌بینی ۳ ماهه</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">{lastSupportType}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    نیاز محتمل: {liveThreeMonthForecast.categoryLabel} (
                    {toPersianDigits(liveThreeMonthForecast.probabilityPct)}٪)
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs sm:text-sm text-red-700 dark:text-red-300">
                  {submitError}
                </div>
              )}

              {submitSuccess ? (
                <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-900/60 space-y-3">
                  <div className="flex items-start gap-2.5 text-emerald-900 dark:text-emerald-200">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
                    <div className="space-y-1 text-sm">
                      <div className="font-bold">
                        {submitSuccess.isUpdate
                          ? `بروزرسانی پرونده ${submitSuccess.caseId} با موفقیت ثبت شد.`
                          : `پرونده جدید ${submitSuccess.caseId} با موفقیت ایجاد و هش‌گذاری شد.`}
                      </div>
                      <div className="text-xs text-emerald-800 dark:text-emerald-300 tabular-nums">
                        زمان ثبت در سیستم: {submitSuccess.timestamp}
                        {submitSuccess.auditLogId ? ` · شناسه ممیزی: ${submitSuccess.auditLogId}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {onOpenCaseWorkflow && (
                      <button
                        type="button"
                        onClick={() => onOpenCaseWorkflow(submitSuccess.caseId)}
                        className="px-4 py-2 text-xs sm:text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <Layers className="w-4 h-4" />
                        ثبت اجزای ۶ مرحله‌ای مدیریت مورد
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onNavigateToOverview}
                      className="px-4 py-2 text-xs sm:text-sm font-medium border border-teal-300 dark:border-teal-800 bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      مشاهده در کارتابل پیشخوان
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDraft}
                      className="px-4 py-2 text-xs sm:text-sm font-medium border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-900 dark:text-emerald-200 rounded-lg hover:bg-emerald-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      شروع ارزیابی جدید
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={submitting || isRestrictedRole}
                    onClick={handleSaveOrUpdateCase}
                    className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {submitting
                      ? 'در حال ثبت و نگارش لاگ ممیزی...'
                      : mode === 'update'
                        ? 'ثبت نهایی بروزرسانی و تاریخچه پرونده'
                        : 'ثبت نهایی پرونده جدید در سامانه'}
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Step Navigation Footer with Temporary Save */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 sm:px-5 py-3.5">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={() => handleGoToStep((currentStep - 1) as WizardStep)}
              className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <ArrowRight className="w-4 h-4" />
              گام قبلی
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                گام {toPersianDigits(currentStep)} از ۵
              </span>
              {!isRestrictedRole && !submitSuccess && (
                <button
                  type="button"
                  onClick={handleSaveTemporaryDraft}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-950 transition-colors inline-flex items-center gap-1.5"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  ذخیره موقت و ادامه بعداً
                </button>
              )}
            </div>

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => handleGoToStep((currentStep + 1) as WizardStep)}
                className="px-4 py-2 text-xs sm:text-sm font-medium rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5"
              >
                مرحله بعد
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-xs font-medium text-teal-700 dark:text-teal-400">
                آماده ثبت نهایی
              </span>
            )}
          </div>
        </div>

        {/* Sticky Right Live Score & Timeline Summary */}
        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                امتیاز کل نیازمندی‌سنجی
              </span>
              <span className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                {toPersianDigits(score.total)}{' '}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/ ۱۰۰</span>
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${urgencyMeta.barClass}`}
                style={{width: `${score.total}%`}}
              />
            </div>

            {mode === 'update' && selectedExistingCase && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1 tabular-nums">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>امتیاز ثبت‌شده قبلی:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {toPersianDigits(selectedExistingCase.score.total)} / ۱۰۰
                  </span>
                </div>
                {scoreDelta !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">تغییر وضعیت:</span>
                    <span
                      className={`font-semibold ${
                        scoreDelta < 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : scoreDelta > 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {scoreDelta === 0
                        ? 'بدون تغییر'
                        : scoreDelta < 0
                          ? `${toPersianDigits(Math.abs(scoreDelta))} امتیاز بهبود`
                          : `${toPersianDigits(scoreDelta)} امتیاز تشدید نیاز`}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400">ساختار خانوار</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {toPersianDigits(score.familyStructure)} / ۳۰
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400">مسکن و سرپناه</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {toPersianDigits(score.housing)} / ۲۵
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400">معیشت و درآمد</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {toPersianDigits(score.livelihood)} / ۲۵
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-slate-500 dark:text-slate-400">سلامت و تغذیه</div>
                <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {toPersianDigits(score.health)} / ۲۰
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">درجه فوریت و اولویت حمایت</div>
              <div className={`text-sm font-bold ${urgencyMeta.colorClass}`}>
                {urgencyMeta.tierLabel}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-0.5">
                <strong className="text-slate-800 dark:text-slate-200">مسیر پیشنهادی:</strong>{' '}
                {urgencyMeta.pathLabel}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <div className="flex items-center justify-between">
                <span>زمان ثبت در این نوبت:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {visitDate} · {visitTime}
                </span>
              </div>
              {!isRestrictedRole && (
                <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400">
                  <span>ذخیره خودکار (هر ۱۰ ثانیه):</span>
                  <span className="font-mono">
                    {lastAutoSavedAt || 'آماده پایش تغییرات'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
