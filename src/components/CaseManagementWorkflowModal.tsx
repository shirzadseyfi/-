import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ArrowLeft,
  BookmarkPlus,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  HardDriveDownload,
  Layers,
  Lock,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AiStageAssistResult,
  CaseManagementWorkflow,
  CaseRecordView,
  CaseStage,
  CollaborationModel,
  DeliveredServiceEntry,
  InstitutionId,
  InterventionGoal,
  MonitoringVisitEntry,
  UserRole,
} from '../types';
import {getPersianDateTimeParts, toPersianDigits} from '../utils/persianDateTime';
import {apiFetch} from '../utils/staticApiFallback';

interface CaseManagementWorkflowModalProps {
  caseRecord: CaseRecordView | null;
  activeInstitution: InstitutionId;
  activeRole: UserRole;
  onClose: () => void;
  onSaved: (
    updatedCase: CaseRecordView,
    meta?: {advanced: boolean; previousStage: CaseStage},
  ) => Promise<void>;
}

const STAGE_META: Array<{
  stage: CaseStage;
  shortTitle: string;
  fullTitle: string;
  description: string;
}> = [
  {
    stage: 1,
    shortTitle: 'پذیرش و ارجاع',
    fullTitle: 'مرحله ۱: پذیرش اولیه، استعلام و تعیین مؤسسه متولی',
    description: 'ثبت مبدا ارجاع، تایید استعلام هش‌شده، رضایت‌نامه آگاهانه و مدل همکاری بین دو مؤسسه.',
  },
  {
    stage: 2,
    shortTitle: 'ارزیابی همه‌جانبه',
    fullTitle: 'مرحله ۲: بازدید میدانی و احصای نیازها و ظرفیت‌ها',
    description: 'ثبت گزارش بازدید منزل، اولویت‌بندی نیازهای فوری و شناسایی توانمندی‌های اعضای خانوار.',
  },
  {
    stage: 3,
    shortTitle: 'برنامه مداخله',
    fullTitle: 'مرحله ۳: تدوین برنامه مداخله فردی و اهداف زمان‌دار',
    description: 'تعیین بسته خدماتی، هماهنگی بین‌مؤسسه‌ای، تاریخ بازبینی و ثبت اهداف قابل اندازه‌گیری.',
  },
  {
    stage: 4,
    shortTitle: 'اجرا و خدمات',
    fullTitle: 'مرحله ۴: اجرای مداخلات، خدمات ارائه‌شده و صندوق خرد',
    description: 'ثبت دفتر کل خدمات تحویلی (معیشتی، درمان، اشتغال، مسکن، تحصیل) و وضعیت اتصال به SHG.',
  },
  {
    stage: 5,
    shortTitle: 'پایش مستمر',
    fullTitle: 'مرحله ۵: پایش دوره‌ای ثبات درآمد و وضعیت خانوار',
    description: 'ثبت نوبت‌های پایش، برآورد درآمد ماهانه، وضعیت تحصیل فرزندان و تعداد ماه‌های پایداری.',
  },
  {
    stage: 6,
    shortTitle: 'خروج موفق',
    fullTitle: 'مرحله ۶: احراز شاخص‌های خوداتکایی و خروج با کرامت',
    description: 'بررسی چک‌لیست ۴گانه خروج موفق، صدور شماره گواهی خوداتکایی و ثبت یادداشت پایانی.',
  },
];

const SERVICE_CATEGORY_LABELS: Record<DeliveredServiceEntry['category'], string> = {
  livelihood: 'سبد معیشتی و کالا',
  medical: 'درمان و دارو',
  employment: 'اشتغال و ابزار کار',
  housing: 'مسکن و اجاره‌بها',
  education: 'تحصیل فرزندان',
};

const GOAL_STATUS_LABELS: Record<InterventionGoal['status'], string> = {
  pending: 'در انتظار شروع',
  in_progress: 'در حال اجرا',
  achieved: 'محقق‌شده',
};

function createFallbackWorkflow(record: CaseRecordView): CaseManagementWorkflow {
  const nowTs = getPersianDateTimeParts().timestamp;
  return {
    stage1Intake: {
      referralSource: 'مراجعه حضوری به دفتر بلوک محلی',
      intakeOfficer: 'مددکار پذیرش',
      inquiryVerified: true,
      consentVerified: record.consentSigned,
      leadAgencyDecision: record.collaborationModel,
      intakeSummary: record.caseWorkerNote || 'تشکیل پرونده اولیه انجام شد.',
      completedAt: record.registeredAt,
    },
    stage2Assessment: {
      fieldVisitPerformed: record.stage >= 2,
      visitDateTime: record.registeredAt,
      priorityNeeds: ['نیاز معیشتی و پایش خانوار'],
      strengthsAndCapacities: 'همکاری مناسب سرپرست خانوار در فرآیند ارزیابی',
      assessmentSummary: record.medicalNotes || 'ارزیابی ۴ بعدی تکمیل گردید.',
      completedAt: record.stage >= 2 ? record.lastUpdatedAt : undefined,
    },
    stage3Plan: {
      assignedServicePackage:
        record.servicePath === 'livelihood_medical'
          ? 'بسته معیشتی و پوشش درمان مشترک'
          : 'بسته توانمندسازی، آموزش مهارت و صندوق خرد',
      partnerCoordinationTask:
        record.collaborationModel === 'complementary_support'
          ? 'تامین مشترک خدمات درمانی و معیشتی بدون هم‌پوشانی'
          : 'مدیریت متمرکز در مؤسسه متولی',
      targetReviewDate: nowTs.split('·')[0]?.trim() || '۱۴۰۵/۰۹/۰۱',
      beneficiaryAgreed: record.stage >= 3,
      goals: [],
      completedAt: record.stage >= 3 ? record.lastUpdatedAt : undefined,
    },
    stage4Execution: {
      shgConnected: record.stage >= 4 && record.servicePath === 'empowerment_employment',
      shgGroupName: '',
      executionNotes: record.lastSupportType || '',
      deliveredServices: [],
      completedAt: record.stage >= 4 ? record.lastUpdatedAt : undefined,
    },
    stage5Monitoring: {
      nextFollowUpDate: '۱۴۰۵/۱۰/۰۱',
      stabilityMonthsCount: record.stage >= 6 ? 6 : record.stage === 5 ? 2 : 0,
      visits: [],
      completedAt: record.stage >= 5 ? record.lastUpdatedAt : undefined,
    },
    stage6Graduation: {
      stableIncomeVerified: record.stage === 6,
      insuranceActive: record.stage === 6,
      sixMonthFollowUpDone: record.stage === 6,
      peerVolunteerJoined: false,
      graduationCertificateNo: record.stage === 6 ? `GRAD-${record.id}` : '',
      graduationNotes: '',
      completedAt: record.stage === 6 ? record.lastUpdatedAt : undefined,
    },
  };
}

function cloneWorkflow(wf: CaseManagementWorkflow): CaseManagementWorkflow {
  return JSON.parse(JSON.stringify(wf)) as CaseManagementWorkflow;
}

export const CaseManagementWorkflowModal: React.FC<CaseManagementWorkflowModalProps> = ({
  caseRecord,
  activeInstitution,
  activeRole,
  onClose,
  onSaved,
}) => {
  const [activeStageTab, setActiveStageTab] = useState<CaseStage>(caseRecord?.stage || 1);
  const [workflow, setWorkflow] = useState<CaseManagementWorkflow | null>(
    caseRecord ? cloneWorkflow(caseRecord.workflow || createFallbackWorkflow(caseRecord)) : null,
  );

  // Action metadata
  const [actionDateTime, setActionDateTime] = useState(() => getPersianDateTimeParts().timestamp);
  const [summaryNote, setSummaryNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Stage 2: new priority need input
  const [newNeedInput, setNewNeedInput] = useState('');

  // Stage 3: new goal form
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState('۱۴۰۵/۱۰/۱۵');
  const [newGoalResponsible, setNewGoalResponsible] = useState('مددکار معین و سرپرست خانوار');

  // Stage 4: new delivered service form
  const [newSvcCategory, setNewSvcCategory] =
    useState<DeliveredServiceEntry['category']>('livelihood');
  const [newSvcTitle, setNewSvcTitle] = useState('');
  const [newSvcAmount, setNewSvcAmount] = useState('');
  const [newSvcNotes, setNewSvcNotes] = useState('');

  // Stage 5: new monitoring visit form
  const [newVisitIncome, setNewVisitIncome] = useState('7500000');
  const [newVisitEmployment, setNewVisitEmployment] =
    useState<MonitoringVisitEntry['employmentStability']>('رو به رشد');
  const [newVisitEducation, setNewVisitEducation] = useState('تحصیل منظم و بدون غیبت');
  const [newVisitProgress, setNewVisitProgress] =
    useState<MonitoringVisitEntry['overallProgress']>('در مسیر خوداتکایی');
  const [newVisitNotes, setNewVisitNotes] = useState('');

  // Stage AI Supervisor Assistant
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAssistError, setAiAssistError] = useState<string | null>(null);
  const [aiAssistResult, setAiAssistResult] = useState<AiStageAssistResult | null>(null);

  // Per-case Temporary Draft (10-second Auto-save & offline/sudden-exit resilience)
  const [savedLocalDraft, setSavedLocalDraft] = useState<{
    savedAt: string;
    activeStageTab: CaseStage;
    workflow: CaseManagementWorkflow;
    summaryNote: string;
  } | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);

  const initialLoadRef = useRef(true);
  const workflowDirtyRef = useRef(false);
  const latestWorkflowDraftRef = useRef<{
    caseId: string;
    activeStageTab: CaseStage;
    workflow: CaseManagementWorkflow;
    summaryNote: string;
  } | null>(null);

  useEffect(() => {
    if (!caseRecord) return;
    initialLoadRef.current = true;
    workflowDirtyRef.current = false;
    setActiveStageTab(caseRecord.stage);
    setWorkflow(cloneWorkflow(caseRecord.workflow || createFallbackWorkflow(caseRecord)));
    setActionDateTime(getPersianDateTimeParts().timestamp);
    setSummaryNote('');
    setSaveError(null);
    setSaveSuccess(null);
    setAiAssistResult(null);
    setAiAssistError(null);
    setDraftNotice(null);
    setLastAutoSavedAt(null);
    try {
      const raw = localStorage.getItem(`naysar_workflow_draft_v1_${caseRecord.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          parsed.workflow &&
          typeof parsed.workflow === 'object'
        ) {
          setSavedLocalDraft(parsed);
          return;
        }
      }
    } catch {
      // ignore invalid draft
    }
    setSavedLocalDraft(null);
  }, [caseRecord?.id]);

  const flushWorkflowAutoSave = useCallback(
    (force = false) => {
      if (!caseRecord) return;
      const isRestricted = activeRole === 'privacy_officer' || activeRole === 'system_admin';
      const canModify =
        !caseRecord.isMasked && !isRestricted && caseRecord.owningInstitution === activeInstitution;
      if (!canModify) return;
      if (!force && !workflowDirtyRef.current) return;
      const snapshot = latestWorkflowDraftRef.current;
      if (!snapshot) return;

      const parts = getPersianDateTimeParts();
      const savedAt = `${parts.date} · ${parts.time}`;
      const payload = {
        savedAt,
        activeStageTab: snapshot.activeStageTab,
        workflow: snapshot.workflow,
        summaryNote: snapshot.summaryNote,
      };
      try {
        localStorage.setItem(`naysar_workflow_draft_v1_${snapshot.caseId}`, JSON.stringify(payload));
        workflowDirtyRef.current = false;
        setSavedLocalDraft(payload);
        setLastAutoSavedAt(savedAt);
      } catch {
        // ignore quota errors
      }
    },
    [caseRecord, activeInstitution, activeRole],
  );

  useEffect(() => {
    if (!caseRecord || !workflow) return;
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      latestWorkflowDraftRef.current = {
        caseId: caseRecord.id,
        activeStageTab,
        workflow,
        summaryNote,
      };
      return;
    }
    latestWorkflowDraftRef.current = {
      caseId: caseRecord.id,
      activeStageTab,
      workflow,
      summaryNote,
    };
    workflowDirtyRef.current = true;
  }, [caseRecord, workflow, activeStageTab, summaryNote]);

  useEffect(() => {
    if (!caseRecord) return;
    const intervalId = window.setInterval(() => {
      flushWorkflowAutoSave(false);
    }, 10000);

    const handleBeforeUnload = () => {
      flushWorkflowAutoSave(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushWorkflowAutoSave(false);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      flushWorkflowAutoSave(false);
      window.clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [caseRecord, flushWorkflowAutoSave]);

  useEffect(() => {
    setAiAssistResult(null);
    setAiAssistError(null);
  }, [activeStageTab]);

  useEffect(() => {
    if (!caseRecord) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [caseRecord, onClose]);

  const completedStagesMap = useMemo(() => {
    if (!workflow) return {} as Record<CaseStage, string | undefined>;
    return {
      1: workflow.stage1Intake.completedAt,
      2: workflow.stage2Assessment.completedAt,
      3: workflow.stage3Plan.completedAt,
      4: workflow.stage4Execution.completedAt,
      5: workflow.stage5Monitoring.completedAt,
      6: workflow.stage6Graduation.completedAt,
    };
  }, [workflow]);

  if (!caseRecord || !workflow) return null;

  const isRestrictedRole = activeRole === 'privacy_officer' || activeRole === 'system_admin';
  const isOwner = caseRecord.owningInstitution === activeInstitution;
  const canEdit = !caseRecord.isMasked && !isRestrictedRole && isOwner;

  const activeStageMeta = STAGE_META.find((s) => s.stage === activeStageTab) || STAGE_META[0];

  const handleAddPriorityNeed = () => {
    const trimmed = newNeedInput.trim();
    if (!trimmed) return;
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage2Assessment: {
              ...prev.stage2Assessment,
              priorityNeeds: [...prev.stage2Assessment.priorityNeeds, trimmed],
            },
          }
        : prev,
    );
    setNewNeedInput('');
  };

  const handleRemovePriorityNeed = (idx: number) => {
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage2Assessment: {
              ...prev.stage2Assessment,
              priorityNeeds: prev.stage2Assessment.priorityNeeds.filter((_, i) => i !== idx),
            },
          }
        : prev,
    );
  };

  const handleAddGoal = () => {
    const title = newGoalTitle.trim();
    if (!title) return;
    const newGoal: InterventionGoal = {
      id: `G-${Date.now()}`,
      title,
      targetDate: newGoalTargetDate.trim() || '۱۴۰۵/۱۱/۰۱',
      responsible: newGoalResponsible.trim() || 'مددکار معین',
      status: 'pending',
    };
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage3Plan: {
              ...prev.stage3Plan,
              goals: [...prev.stage3Plan.goals, newGoal],
            },
          }
        : prev,
    );
    setNewGoalTitle('');
  };

  const handleUpdateGoalStatus = (goalId: string, status: InterventionGoal['status']) => {
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage3Plan: {
              ...prev.stage3Plan,
              goals: prev.stage3Plan.goals.map((g) => (g.id === goalId ? {...g, status} : g)),
            },
          }
        : prev,
    );
  };

  const handleRemoveGoal = (goalId: string) => {
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage3Plan: {
              ...prev.stage3Plan,
              goals: prev.stage3Plan.goals.filter((g) => g.id !== goalId),
            },
          }
        : prev,
    );
  };

  const handleAddDeliveredService = () => {
    const title = newSvcTitle.trim();
    if (!title) return;
    const entry: DeliveredServiceEntry = {
      id: `SVC-${Date.now()}`,
      dateTime: getPersianDateTimeParts().timestamp,
      category: newSvcCategory,
      title,
      amountOrQuantity: newSvcAmount.trim() || '۱ نوبت',
      providerInstitution: activeInstitution,
      notes: newSvcNotes.trim() || 'ثبت در دفتر کل خدمات پرونده',
    };
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage4Execution: {
              ...prev.stage4Execution,
              deliveredServices: [entry, ...prev.stage4Execution.deliveredServices],
            },
          }
        : prev,
    );
    setNewSvcTitle('');
    setNewSvcAmount('');
    setNewSvcNotes('');
  };

  const handleRemoveDeliveredService = (serviceId: string) => {
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage4Execution: {
              ...prev.stage4Execution,
              deliveredServices: prev.stage4Execution.deliveredServices.filter(
                (s) => s.id !== serviceId,
              ),
            },
          }
        : prev,
    );
  };

  const handleAddMonitoringVisit = () => {
    const incomeNum = Math.max(0, Number(newVisitIncome.replace(/[^\d]/g, '')) || 0);
    const visit: MonitoringVisitEntry = {
      id: `MON-${Date.now()}`,
      dateTime: getPersianDateTimeParts().timestamp,
      monthlyEstimatedIncome: incomeNum,
      employmentStability: newVisitEmployment,
      childEducationStatus: newVisitEducation.trim() || 'در حال تحصیل',
      overallProgress: newVisitProgress,
      notes: newVisitNotes.trim() || 'ثبت نوبت پایش دوره‌ای وضعیت معیشتی',
    };
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage5Monitoring: {
              ...prev.stage5Monitoring,
              visits: [visit, ...prev.stage5Monitoring.visits],
            },
          }
        : prev,
    );
    setNewVisitNotes('');
  };

  const handleRemoveMonitoringVisit = (visitId: string) => {
    setWorkflow((prev) =>
      prev
        ? {
            ...prev,
            stage5Monitoring: {
              ...prev.stage5Monitoring,
              visits: prev.stage5Monitoring.visits.filter((v) => v.id !== visitId),
            },
          }
        : prev,
    );
  };

  const handleRequestStageAi = async () => {
    setAiAssistLoading(true);
    setAiAssistError(null);
    try {
      const res = await apiFetch('/api/ai/stage-assist', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          caseId: caseRecord.id,
          stageNumber: activeStageTab,
          institution: activeInstitution,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiAssistError(data.error || 'خطا در دریافت راهنمای هوشمند مرحله.');
        return;
      }
      setAiAssistResult(data.stageAssist as AiStageAssistResult);
    } catch {
      setAiAssistError('امکان برقراری ارتباط با دستیار هوشمند وجود ندارد.');
    } finally {
      setAiAssistLoading(false);
    }
  };

  const handleApplyAiSuggestionToStage = () => {
    if (!aiAssistResult) return;
    if (activeStageTab === 3) {
      setNewGoalTitle(aiAssistResult.recommendedGoalOrService);
    } else if (activeStageTab === 4) {
      setNewSvcTitle(aiAssistResult.recommendedGoalOrService);
    } else if (activeStageTab === 2) {
      setNewNeedInput(aiAssistResult.recommendedGoalOrService);
    } else {
      setSummaryNote(aiAssistResult.recommendedGoalOrService);
    }
  };

  const handleSaveWorkflow = async (advanceToNextStage: boolean) => {
    if (!canEdit) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const res = await apiFetch(`/api/cases/${encodeURIComponent(caseRecord.id)}/workflow`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          institution: activeInstitution,
          role: activeRole,
          stageNumber: activeStageTab,
          workflow,
          advanceToNextStage,
          actionDateTime: actionDateTime.trim() || getPersianDateTimeParts().timestamp,
          summaryNote: summaryNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || 'خطا در ذخیره اجزای مدیریت مورد.');
        return;
      }

      const previousStage = caseRecord.stage;
      const updatedCase = data.caseRecord as CaseRecordView;
      if (updatedCase.workflow) {
        setWorkflow(cloneWorkflow(updatedCase.workflow));
      }
      if (advanceToNextStage) {
        setActiveStageTab(updatedCase.stage);
      }
      setSummaryNote('');
      try {
        localStorage.removeItem(`naysar_workflow_draft_v1_${caseRecord.id}`);
      } catch {
        // ignore
      }
      setSavedLocalDraft(null);
      setDraftNotice(null);
      setSaveSuccess(
        advanceToNextStage
          ? `اجزای مرحله ${toPersianDigits(activeStageTab)} ذخیره و پرونده به مرحله ${toPersianDigits(updatedCase.stage)} ارتقا یافت (${data.auditLogId}).`
          : `اجزای مرحله ${toPersianDigits(activeStageTab)} با موفقیت ثبت شد (${data.auditLogId}).`,
      );
      await onSaved(updatedCase, {
        advanced: advanceToNextStage,
        previousStage,
      });
    } catch {
      setSaveError(
        'خطا در برقراری ارتباط با سرور؛ می‌توانید از دکمه «ذخیره موقت» برای نگهداری تغییرات روی دستگاه استفاده کنید.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocalWorkflowDraft = () => {
    if (!canEdit || !workflow) return;
    const savedAt = getPersianDateTimeParts().timestamp;
    const payload = {
      savedAt,
      activeStageTab,
      workflow,
      summaryNote,
    };
    try {
      localStorage.setItem(`naysar_workflow_draft_v1_${caseRecord.id}`, JSON.stringify(payload));
      setSavedLocalDraft(payload);
      setDraftNotice(
        `پیش‌نویس موقت مرحله ${toPersianDigits(activeStageTab)} در ساعت ${savedAt} روی دستگاه ذخیره شد.`,
      );
    } catch {
      setSaveError('امکان ذخیره موقت در حافظه مرورگر وجود ندارد.');
    }
  };

  const handleRestoreLocalWorkflowDraft = () => {
    if (!savedLocalDraft) return;
    setWorkflow(cloneWorkflow(savedLocalDraft.workflow));
    setActiveStageTab(savedLocalDraft.activeStageTab);
    setSummaryNote(savedLocalDraft.summaryNote || '');
    setDraftNotice(
      `پیش‌نویس ذخیره‌شده (${savedLocalDraft.savedAt}) از مرحله ${toPersianDigits(savedLocalDraft.activeStageTab)} بازیابی شد.`,
    );
  };

  const handleDiscardLocalWorkflowDraft = () => {
    try {
      localStorage.removeItem(`naysar_workflow_draft_v1_${caseRecord.id}`);
    } catch {
      // ignore
    }
    setSavedLocalDraft(null);
  };

  const graduationChecksCount = [
    workflow.stage6Graduation.stableIncomeVerified,
    workflow.stage6Graduation.insuranceActive,
    workflow.stage6Graduation.sixMonthFollowUpDone,
    workflow.stage6Graduation.peerVolunteerJoined,
  ].filter(Boolean).length;

  const achievedGoalsCount = workflow.stage3Plan.goals.filter(
    (g) => g.status === 'achieved',
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workflow-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0 bg-slate-50/70 dark:bg-slate-900">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="inline-flex items-center gap-1 font-semibold text-teal-800 dark:text-teal-300">
                <Layers className="w-3.5 h-3.5" />
                پرونده {caseRecord.id}
              </span>
              <span aria-hidden="true">·</span>
              <span>کدملی: {caseRecord.nationalIdMasked || 'محرمانه'}</span>
              <span aria-hidden="true">·</span>
              <span>{caseRecord.blockName}</span>
              <span aria-hidden="true">·</span>
              <span>امتیاز: {toPersianDigits(caseRecord.score.total)}/۱۰۰</span>
              <span aria-hidden="true">·</span>
              <span>آخرین بروزرسانی: {caseRecord.lastUpdatedAt}</span>
            </div>
            <h2
              id="workflow-modal-title"
              className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100"
            >
              مدیریت مورد گام‌به‌گام: {caseRecord.fullName || 'پرونده محرمانه'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره مدیریت مورد"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 6-Stage Interactive Stepper */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto">
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 min-w-[640px] lg:min-w-0">
            {STAGE_META.map((s) => {
              const isSelected = activeStageTab === s.stage;
              const isCurrentCaseStage = caseRecord.stage === s.stage;
              const isCompleted = Boolean(completedStagesMap[s.stage]) || caseRecord.stage > s.stage;
              return (
                <li key={s.stage}>
                  <button
                    type="button"
                    onClick={() => setActiveStageTab(s.stage)}
                    className={`w-full text-right p-2.5 rounded-xl border transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 dark:border-teal-500 text-teal-950 dark:text-teal-100'
                        : isCurrentCaseStage
                          ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`w-5 h-5 rounded-md text-[11px] font-mono font-bold flex items-center justify-center tabular-nums ${
                          isSelected
                            ? 'bg-teal-700 text-white'
                            : isCompleted
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3 h-3" /> : toPersianDigits(s.stage)}
                      </span>
                      {isCurrentCaseStage && (
                        <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-400">
                          مرحله فعلی
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold truncate">{s.shortTitle}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Scrollable Stage Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!canEdit && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/70 flex items-center gap-2.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
              <Lock className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <span>
                این پرونده در محیط کاربری فعلی فقط قابل مشاهده است؛ ثبت یا ویرایش اجزای مراحل
                مدیریت مورد تنها توسط کارشناسان مؤسسه متولی مجاز است.
              </span>
            </div>
          )}

          {canEdit && savedLocalDraft && (
            <div className="p-3.5 rounded-xl bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-2 text-teal-900 dark:text-teal-200">
                <HardDriveDownload className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                <span className="tabular-nums">
                  پیش‌نویس موقت برای این پرونده در تاریخ <strong>{savedLocalDraft.savedAt}</strong>{' '}
                  (مرحله {toPersianDigits(savedLocalDraft.activeStageTab)}) موجود است.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleRestoreLocalWorkflowDraft}
                  className="px-3 py-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors"
                >
                  بازیابی و ادامه از مرحله {toPersianDigits(savedLocalDraft.activeStageTab)}
                </button>
                <button
                  type="button"
                  onClick={handleDiscardLocalWorkflowDraft}
                  className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400"
                >
                  حذف پیش‌نویس
                </button>
              </div>
            </div>
          )}

          {draftNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span>{draftNotice}</span>
            </div>
          )}

          {/* Active Stage Banner + AI Stage Assistant Trigger */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {activeStageMeta.fullTitle}
                </h3>
                {completedStagesMap[activeStageTab] && (
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                    (ثبت‌شده: {completedStagesMap[activeStageTab]})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {activeStageMeta.description}
              </p>
            </div>

            <button
              type="button"
              disabled={aiAssistLoading || !canEdit}
              onClick={handleRequestStageAi}
              className="px-3.5 py-2 text-xs font-medium rounded-lg border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/60 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {aiAssistLoading ? 'در حال تحلیل مرحله...' : 'راهنمای هوشمند این مرحله'}
            </button>
          </div>

          {aiAssistError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
              {aiAssistError}
            </div>
          )}

          {aiAssistResult && (
            <div className="p-4 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/70 space-y-3 text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="font-bold text-teal-900 dark:text-teal-200">
                  پیشنهاد سوپروایزر هوشمند: {aiAssistResult.stageTitle}
                </div>
                <button
                  type="button"
                  onClick={handleApplyAiSuggestionToStage}
                  className="px-2.5 py-1 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-md transition-colors self-start sm:self-auto"
                >
                  درج عنوان پیشنهادی در فرم
                </button>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>هدف مرحله:</strong> {aiAssistResult.stageObjective}
              </p>
              <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside">
                {aiAssistResult.suggestedActions.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-xs">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-teal-200/70 dark:border-teal-900">
                  <span className="font-semibold text-teal-800 dark:text-teal-300">
                    هدف / خدمت کلیدی پیشنهادی:
                  </span>{' '}
                  <span className="text-slate-800 dark:text-slate-200">
                    {aiAssistResult.recommendedGoalOrService}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-teal-200/70 dark:border-teal-900">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    توصیه ارتباطی با خانوار:
                  </span>{' '}
                  <span className="text-slate-700 dark:text-slate-300">
                    {aiAssistResult.workerCommunicationTip}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ==================== STAGE 1: INTAKE & REFERRAL ==================== */}
          {activeStageTab === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    مبدا یا کانال ارجاع پرونده
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={workflow.stage1Intake.referralSource}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage1Intake: {...workflow.stage1Intake, referralSource: e.target.value},
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    نام مددکار یا کارشناس پذیرش
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={workflow.stage1Intake.intakeOfficer}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage1Intake: {...workflow.stage1Intake, intakeOfficer: e.target.value},
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  تصمیم مدل همکاری بین مؤسسات
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        value: 'single_ownership' as CollaborationModel,
                        title: 'واگذاری کامل به مؤسسه متولی (Single Ownership)',
                        desc: 'تمامی خدمات مالی و مددکاری متمرکز توسط همین مؤسسه ارائه می‌شود.',
                      },
                      {
                        value: 'complementary_support' as CollaborationModel,
                        title: 'پوشش ترکیبی مکمل (Complementary Support)',
                        desc: 'تقسیم کار شفاف (مثلاً درمان با یکی و اشتغال با دیگری) بدون هم‌پوشانی.',
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() =>
                        setWorkflow({
                          ...workflow,
                          stage1Intake: {
                            ...workflow.stage1Intake,
                            leadAgencyDecision: opt.value,
                          },
                        })
                      }
                      className={`text-right p-3.5 rounded-xl border transition-colors ${
                        workflow.stage1Intake.leadAgencyDecision === opt.value
                          ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-600 dark:border-teal-500'
                          : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {opt.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-xs sm:text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={workflow.stage1Intake.inquiryVerified}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage1Intake: {...workflow.stage1Intake, inquiryVerified: e.target.checked},
                      })
                    }
                    className="w-4 h-4 accent-teal-700 rounded"
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    استعلام کد ملی با هش SHA-256 و عدم هم‌پوشانی تایید شد
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-xs sm:text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={workflow.stage1Intake.consentVerified}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage1Intake: {...workflow.stage1Intake, consentVerified: e.target.checked},
                      })
                    }
                    className="w-4 h-4 accent-teal-700 rounded"
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    رضایت‌نامه آگاهانه سه‌بندی از سرپرست خانوار اخذ شد
                  </span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  شرح پذیرش و خلاصه وضعیت ارجاع
                </label>
                <textarea
                  rows={3}
                  disabled={!canEdit}
                  value={workflow.stage1Intake.intakeSummary}
                  onChange={(e) =>
                    setWorkflow({
                      ...workflow,
                      stage1Intake: {...workflow.stage1Intake, intakeSummary: e.target.value},
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                />
              </div>
            </div>
          )}

          {/* ==================== STAGE 2: COMPREHENSIVE ASSESSMENT ==================== */}
          {activeStageTab === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-xs sm:text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={workflow.stage2Assessment.fieldVisitPerformed}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage2Assessment: {
                          ...workflow.stage2Assessment,
                          fieldVisitPerformed: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-teal-700 rounded"
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    بازدید میدانی منزل و راستی‌آزمایی شرایط سکونت انجام شده است
                  </span>
                </label>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    تاریخ و ساعت بازدید میدانی
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={workflow.stage2Assessment.visitDateTime}
                      onChange={(e) =>
                        setWorkflow({
                          ...workflow,
                          stage2Assessment: {
                            ...workflow.stage2Assessment,
                            visitDateTime: e.target.value,
                          },
                        })
                      }
                      className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setWorkflow({
                            ...workflow,
                            stage2Assessment: {
                              ...workflow.stage2Assessment,
                              visitDateTime: getPersianDateTimeParts().timestamp,
                            },
                          })
                        }
                        className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                      >
                        اکنون
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Priority Needs Dynamic Checklist */}
              <div className="space-y-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  فهرست نیازهای اولویت‌دار احصاشده ({toPersianDigits(workflow.stage2Assessment.priorityNeeds.length)} مورد)
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newNeedInput}
                      onChange={(e) => setNewNeedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPriorityNeed();
                        }
                      }}
                      placeholder="نیاز جدید را وارد کنید (مثلاً تامین دستگاه فشارسنج یا ودیعه اجاره)..."
                      className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddPriorityNeed}
                      className="px-3.5 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      افزودن نیاز
                    </button>
                  </div>
                )}

                {workflow.stage2Assessment.priorityNeeds.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    هنوز نیازی ثبت نشده است.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
                    {workflow.stage2Assessment.priorityNeeds.map((need, idx) => (
                      <div
                        key={`${need}-${idx}`}
                        className="px-3 py-2 flex items-center justify-between gap-2 text-xs sm:text-sm"
                      >
                        <span className="text-slate-800 dark:text-slate-200">
                          {toPersianDigits(idx + 1)}. {need}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemovePriorityNeed(idx)}
                            aria-label="حذف نیاز"
                            className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    نقاط قوت، مهارت‌ها و ظرفیت‌های خانوار
                  </label>
                  <textarea
                    rows={3}
                    disabled={!canEdit}
                    value={workflow.stage2Assessment.strengthsAndCapacities}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage2Assessment: {
                          ...workflow.stage2Assessment,
                          strengthsAndCapacities: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    جمع‌بندی ارزیابی همه‌جانبه مددکار
                  </label>
                  <textarea
                    rows={3}
                    disabled={!canEdit}
                    value={workflow.stage2Assessment.assessmentSummary}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage2Assessment: {
                          ...workflow.stage2Assessment,
                          assessmentSummary: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==================== STAGE 3: INTERVENTION PLAN & GOALS ==================== */}
          {activeStageTab === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    بسته خدماتی اختصاص‌یافته
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={workflow.stage3Plan.assignedServicePackage}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage3Plan: {
                          ...workflow.stage3Plan,
                          assignedServicePackage: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    تاریخ بازبینی هدف‌گذاری
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={workflow.stage3Plan.targetReviewDate}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage3Plan: {...workflow.stage3Plan, targetReviewDate: e.target.value},
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    تکلیف هماهنگی بین دو مؤسسه / صندوق مشترک
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={workflow.stage3Plan.partnerCoordinationTask}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage3Plan: {
                          ...workflow.stage3Plan,
                          partnerCoordinationTask: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-xs sm:text-sm cursor-pointer sm:mt-5">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={workflow.stage3Plan.beneficiaryAgreed}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage3Plan: {...workflow.stage3Plan, beneficiaryAgreed: e.target.checked},
                      })
                    }
                    className="w-4 h-4 accent-teal-700 rounded"
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    برنامه مداخله و تعهدات متقابل به تایید سرپرست خانوار رسید
                  </span>
                </label>
              </div>

              {/* Dynamic Intervention Goals Manager */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    اهداف عملیاتی و زمان‌دار برنامه مداخله ({toPersianDigits(achievedGoalsCount)} از{' '}
                    {toPersianDigits(workflow.stage3Plan.goals.length)} هدف محقق‌شده)
                  </div>
                </div>

                {canEdit && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      value={newGoalTitle}
                      onChange={(e) => setNewGoalTitle(e.target.value)}
                      placeholder="عنوان هدف جدید (مثلاً خرید چرخ خیاطی صنعتی و تولید ۱۰ دست لباس)..."
                      className="sm:col-span-6 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <input
                      type="text"
                      value={newGoalTargetDate}
                      onChange={(e) => setNewGoalTargetDate(e.target.value)}
                      placeholder="موعد (۱۴۰۵/۱۰/۱۵)"
                      className="sm:col-span-2 px-3 py-2 text-xs sm:text-sm font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <input
                      type="text"
                      value={newGoalResponsible}
                      onChange={(e) => setNewGoalResponsible(e.target.value)}
                      placeholder="مسئول پیگیری"
                      className="sm:col-span-2 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddGoal}
                      className="sm:col-span-2 px-3 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg inline-flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      افزودن هدف
                    </button>
                  </div>
                )}

                {workflow.stage3Plan.goals.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    هنوز هدفی در برنامه مداخله ثبت نشده است.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                    {workflow.stage3Plan.goals.map((goal) => (
                      <div
                        key={goal.id}
                        className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                            {goal.title}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                            موعد: {goal.targetDate} · مسئول: {goal.responsible}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {(['pending', 'in_progress', 'achieved'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => handleUpdateGoalStatus(goal.id, st)}
                              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                goal.status === st
                                  ? st === 'achieved'
                                    ? 'bg-emerald-600 text-white'
                                    : st === 'in_progress'
                                      ? 'bg-teal-700 text-white'
                                      : 'bg-slate-700 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {GOAL_STATUS_LABELS[st]}
                            </button>
                          ))}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveGoal(goal.id)}
                              aria-label="حذف هدف"
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== STAGE 4: EXECUTION & DELIVERED SERVICES ==================== */}
          {activeStageTab === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/50 text-xs sm:text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={workflow.stage4Execution.shgConnected}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage4Execution: {
                          ...workflow.stage4Execution,
                          shgConnected: e.target.checked,
                        },
                      })
                    }
                    className="w-4 h-4 accent-teal-700 rounded"
                  />
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    خانوار به گروه خودیاری و صندوق اعتبار خرد محلی (SHG) متصل شد
                  </span>
                </label>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    نام گروه خودیاری یا طرح توانمندسازی متصل‌شده
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={workflow.stage4Execution.shgGroupName}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage4Execution: {
                          ...workflow.stage4Execution,
                          shgGroupName: e.target.value,
                        },
                      })
                    }
                    placeholder="مثلاً صندوق هم‌افزایی بانوان بهار نایسر"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  یادداشت اجرای مداخلات و هماهنگی بین‌بخشی
                </label>
                <textarea
                  rows={2}
                  disabled={!canEdit}
                  value={workflow.stage4Execution.executionNotes}
                  onChange={(e) =>
                    setWorkflow({
                      ...workflow,
                      stage4Execution: {
                        ...workflow.stage4Execution,
                        executionNotes: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                />
              </div>

              {/* Delivered Services Ledger */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  دفتر کل خدمات ارائه‌شده به خانوار (
                  {toPersianDigits(workflow.stage4Execution.deliveredServices.length)} خدمت ثبت‌شده)
                </div>

                {canEdit && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <select
                      value={newSvcCategory}
                      onChange={(e) =>
                        setNewSvcCategory(e.target.value as DeliveredServiceEntry['category'])
                      }
                      className="sm:col-span-3 px-2.5 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      {Object.entries(SERVICE_CATEGORY_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newSvcTitle}
                      onChange={(e) => setNewSvcTitle(e.target.value)}
                      placeholder="شرح خدمت (مثلاً پرداخت ودیعه مسکن یا تامین دارو)..."
                      className="sm:col-span-4 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <input
                      type="text"
                      value={newSvcAmount}
                      onChange={(e) => setNewSvcAmount(e.target.value)}
                      placeholder="مبلغ یا تعداد (مثلاً ۵ میلیون تومان)"
                      className="sm:col-span-3 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddDeliveredService}
                      className="sm:col-span-2 px-3 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg inline-flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      ثبت خدمت
                    </button>
                    <input
                      type="text"
                      value={newSvcNotes}
                      onChange={(e) => setNewSvcNotes(e.target.value)}
                      placeholder="توضیحات تکمیلی تحویل خدمت (اختیاری)..."
                      className="sm:col-span-12 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                )}

                {workflow.stage4Execution.deliveredServices.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    هنوز خدمتی در دفتر کل این پرونده ثبت نشده است.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                    {workflow.stage4Execution.deliveredServices.map((svc) => (
                      <div
                        key={svc.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-teal-800 dark:text-teal-300">
                              [{SERVICE_CATEGORY_LABELS[svc.category]}]
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                              {svc.title}
                            </span>
                            <span className="font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                              · {svc.amountOrQuantity}
                            </span>
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">{svc.notes}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {svc.dateTime}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDeliveredService(svc.id)}
                              aria-label="حذف خدمت"
                              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== STAGE 5: CONTINUOUS MONITORING ==================== */}
          {activeStageTab === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    تاریخ نوبت پایش بعدی
                  </label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={workflow.stage5Monitoring.nextFollowUpDate}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage5Monitoring: {
                          ...workflow.stage5Monitoring,
                          nextFollowUpDate: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    تعداد ماه‌های ثبت‌شده ثبات معیشتی (حداقل ۶ ماه برای خروج موفق):{' '}
                    <span className="font-mono text-teal-700 dark:text-teal-400 tabular-nums">
                      {toPersianDigits(workflow.stage5Monitoring.stabilityMonthsCount)} ماه
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    disabled={!canEdit}
                    value={workflow.stage5Monitoring.stabilityMonthsCount}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage5Monitoring: {
                          ...workflow.stage5Monitoring,
                          stabilityMonthsCount: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-teal-700"
                  />
                </div>
              </div>

              {/* Monitoring Visits Log */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40 space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  سابقه نوبت‌های پایش مستمر و سنجش درآمد خانوار (
                  {toPersianDigits(workflow.stage5Monitoring.visits.length)} نوبت)
                </div>

                {canEdit && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        min={0}
                        step={500000}
                        value={newVisitIncome}
                        onChange={(e) => setNewVisitIncome(e.target.value)}
                        placeholder="درآمد ماهانه (تومان)"
                        className="w-full px-3 py-2 text-xs sm:text-sm font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>
                    <select
                      value={newVisitEmployment}
                      onChange={(e) =>
                        setNewVisitEmployment(
                          e.target.value as MonitoringVisitEntry['employmentStability'],
                        )
                      }
                      className="sm:col-span-3 px-2.5 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="ناپایدار">اشتغال: ناپایدار</option>
                      <option value="رو به رشد">اشتغال: رو به رشد</option>
                      <option value="پایدار">اشتغال: پایدار</option>
                    </select>
                    <select
                      value={newVisitProgress}
                      onChange={(e) =>
                        setNewVisitProgress(
                          e.target.value as MonitoringVisitEntry['overallProgress'],
                        )
                      }
                      className="sm:col-span-4 px-2.5 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="نیاز به تداوم حمایت">وضعیت: نیاز به تداوم حمایت</option>
                      <option value="در مسیر خوداتکایی">وضعیت: در مسیر خوداتکایی</option>
                      <option value="آماده خروج">وضعیت: آماده خروج</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddMonitoringVisit}
                      className="sm:col-span-2 px-3 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg inline-flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      ثبت پایش
                    </button>
                    <input
                      type="text"
                      value={newVisitEducation}
                      onChange={(e) => setNewVisitEducation(e.target.value)}
                      placeholder="وضعیت تحصیل و سلامت فرزندان..."
                      className="sm:col-span-5 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <input
                      type="text"
                      value={newVisitNotes}
                      onChange={(e) => setNewVisitNotes(e.target.value)}
                      placeholder="مشاهدات مددکار در این نوبت پایش..."
                      className="sm:col-span-7 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                )}

                {workflow.stage5Monitoring.visits.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    هنوز نوبت پایشی برای این پرونده ثبت نشده است.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 dark:divide-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                    {workflow.stage5Monitoring.visits.map((visit) => (
                      <div
                        key={visit.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            <span>
                              درآمد برآوردی:{' '}
                              {visit.monthlyEstimatedIncome.toLocaleString('fa-IR')} تومان
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="text-teal-700 dark:text-teal-400">
                              ثبات شغلی: {visit.employmentStability}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{visit.overallProgress}</span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-400">
                            تحصیل/فرزندان: {visit.childEducationStatus} — {visit.notes}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {visit.dateTime}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMonitoringVisit(visit.id)}
                              aria-label="حذف نوبت پایش"
                              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== STAGE 6: GRADUATION ==================== */}
          {activeStageTab === 6 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  <span>چک‌لیست احراز شاخص‌های خروج موفق و پایدار</span>
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {toPersianDigits(graduationChecksCount)} از ۴ شاخص تایید شده
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        key: 'stableIncomeVerified',
                        label: 'دستیابی به درآمد پایدار و پوشش هزینه‌های پایه خانوار',
                      },
                      {
                        key: 'insuranceActive',
                        label: 'برقراری بیمه تامین اجتماعی یا پوشش درمانی پایه',
                      },
                      {
                        key: 'sixMonthFollowUpDone',
                        label: 'اتمام دوره ۶ ماهه پایش بدون بازگشت به بحران معیشتی',
                      },
                      {
                        key: 'peerVolunteerJoined',
                        label: 'آمادگی سرپرست خانوار به عنوان همیار افتخاری در محله نایسر',
                      },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        disabled={!canEdit}
                        checked={workflow.stage6Graduation[item.key]}
                        onChange={(e) =>
                          setWorkflow({
                            ...workflow,
                            stage6Graduation: {
                              ...workflow.stage6Graduation,
                              [item.key]: e.target.checked,
                            },
                          })
                        }
                        className="mt-0.5 w-4 h-4 accent-emerald-600 rounded shrink-0"
                      />
                      <span className="text-slate-800 dark:text-slate-200 leading-relaxed">
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    شماره گواهی خوداتکایی و آیین تکریم
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!canEdit}
                      value={workflow.stage6Graduation.graduationCertificateNo}
                      onChange={(e) =>
                        setWorkflow({
                          ...workflow,
                          stage6Graduation: {
                            ...workflow.stage6Graduation,
                            graduationCertificateNo: e.target.value,
                          },
                        })
                      }
                      placeholder="مثلاً GRAD-NY-1405-101"
                      className="flex-1 px-3 py-2 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setWorkflow({
                            ...workflow,
                            stage6Graduation: {
                              ...workflow.stage6Graduation,
                              graduationCertificateNo: `GRAD-${caseRecord.id}`,
                            },
                          })
                        }
                        className="px-3 py-2 text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                      >
                        صدور خودکار
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    یادداشت پایانی و برنامه صیانت پس از خروج
                  </label>
                  <textarea
                    rows={2}
                    disabled={!canEdit}
                    value={workflow.stage6Graduation.graduationNotes}
                    onChange={(e) =>
                      setWorkflow({
                        ...workflow,
                        stage6Graduation: {
                          ...workflow.stage6Graduation,
                          graduationNotes: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Save Status Feedback */}
          {saveError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs sm:text-sm text-red-700 dark:text-red-300">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span>{saveSuccess}</span>
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0 space-y-3">
          {canEdit && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
              <div className="md:col-span-4 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                <input
                  type="text"
                  value={actionDateTime}
                  onChange={(e) => setActionDateTime(e.target.value)}
                  aria-label="تاریخ و ساعت ثبت این مرحله"
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
                <button
                  type="button"
                  onClick={() => setActionDateTime(getPersianDateTimeParts().timestamp)}
                  className="px-2 py-1.5 text-[11px] font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  اکنون
                </button>
              </div>
              <div className="md:col-span-8">
                <input
                  type="text"
                  value={summaryNote}
                  onChange={(e) => setSummaryNote(e.target.value)}
                  placeholder="یادداشت خلاصه این ثبت برای درج در تاریخچه پرونده و دفتر ممیزی (اختیاری)..."
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-medium border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                بستن پنجره
              </button>
              {canEdit && (
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {lastAutoSavedAt
                    ? `ذخیره خودکار: ${lastAutoSavedAt}`
                    : 'ذخیره خودکار هر ۱۰ ثانیه فعال'}
                </span>
              )}
            </div>

            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveLocalWorkflowDraft}
                  className="px-3.5 py-2 text-xs sm:text-sm font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <BookmarkPlus className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  ذخیره موقت آفلاین
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveWorkflow(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-medium border border-teal-700 dark:border-teal-600 text-teal-800 dark:text-teal-300 bg-white dark:bg-slate-900 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <ClipboardList className="w-4 h-4" />
                  {saving ? 'در حال ذخیره...' : 'ذخیره اجزای این مرحله'}
                </button>
                {caseRecord.stage < 6 && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveWorkflow(true)}
                    className="px-4 py-2 text-xs sm:text-sm font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>ذخیره و ارتقا به مرحله بعد</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
