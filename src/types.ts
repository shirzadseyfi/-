export type InstitutionId = 'darolahsan' | 'edalat';

export type UserRole =
  | 'case_worker'
  | 'executive_manager'
  | 'privacy_officer'
  | 'system_admin';

export type UrgencyTier = 'red' | 'yellow' | 'green';

export type CaseStage = 1 | 2 | 3 | 4 | 5 | 6;

export type ServicePath = 'livelihood_medical' | 'empowerment_employment';

export type CollaborationModel = 'single_ownership' | 'complementary_support';

export interface NaysarBlock {
  id: string;
  name: string;
  zoneLabel: string;
  leadInstitution: InstitutionId | 'joint_pilot';
  isPilotZone: boolean;
  householdCount: number;
  activeCasesCount: number;
}

export interface WelfareScoreBreakdown {
  familyStructure: number; // max 30
  housing: number; // max 25
  livelihood: number; // max 25
  health: number; // max 20
  total: number; // max 100
}

export type PredictedServiceCategory =
  | 'medical'
  | 'employment'
  | 'housing'
  | 'livelihood';

export interface ThreeMonthNeedForecast {
  category: PredictedServiceCategory;
  categoryLabel: string;
  probabilityPct: number;
  riskLevel: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface CaseTimelineEvent {
  id: string;
  timestamp: string;
  type: 'CREATED' | 'REASSESSED' | 'STAGE_CHANGED' | 'OVERLAP_RESOLVED';
  summary: string;
  actorInstitution: InstitutionId;
  scoreTotal?: number;
  stage?: CaseStage;
}

export interface AssessmentFormDetails {
  studentsCount: number;
  dependentsCount: number;
  lacksUtilities: boolean;
  incomeSourcePoints: number;
  hasUnemployedWorker: boolean;
  hasChronicDisease: boolean;
  childNutritionRisk: boolean;
  skillInterest: string;
}

export interface InterventionGoal {
  id: string;
  title: string;
  targetDate: string;
  responsible: string;
  status: 'pending' | 'in_progress' | 'achieved';
}

export interface DeliveredServiceEntry {
  id: string;
  dateTime: string;
  category: 'livelihood' | 'medical' | 'employment' | 'housing' | 'education';
  title: string;
  amountOrQuantity: string;
  providerInstitution: InstitutionId;
  notes: string;
}

export interface MonitoringVisitEntry {
  id: string;
  dateTime: string;
  monthlyEstimatedIncome: number;
  employmentStability: 'ناپایدار' | 'رو به رشد' | 'پایدار';
  childEducationStatus: string;
  overallProgress: 'نیاز به تداوم حمایت' | 'در مسیر خوداتکایی' | 'آماده خروج';
  notes: string;
}

export interface CaseManagementWorkflow {
  stage1Intake: {
    referralSource: string;
    intakeOfficer: string;
    inquiryVerified: boolean;
    consentVerified: boolean;
    leadAgencyDecision: CollaborationModel;
    intakeSummary: string;
    completedAt?: string;
  };
  stage2Assessment: {
    fieldVisitPerformed: boolean;
    visitDateTime: string;
    priorityNeeds: string[];
    strengthsAndCapacities: string;
    assessmentSummary: string;
    completedAt?: string;
  };
  stage3Plan: {
    assignedServicePackage: string;
    partnerCoordinationTask: string;
    targetReviewDate: string;
    beneficiaryAgreed: boolean;
    goals: InterventionGoal[];
    completedAt?: string;
  };
  stage4Execution: {
    shgConnected: boolean;
    shgGroupName: string;
    executionNotes: string;
    deliveredServices: DeliveredServiceEntry[];
    completedAt?: string;
  };
  stage5Monitoring: {
    nextFollowUpDate: string;
    stabilityMonthsCount: number;
    visits: MonitoringVisitEntry[];
    completedAt?: string;
  };
  stage6Graduation: {
    stableIncomeVerified: boolean;
    insuranceActive: boolean;
    sixMonthFollowUpDone: boolean;
    peerVolunteerJoined: boolean;
    graduationCertificateNo: string;
    graduationNotes: string;
    completedAt?: string;
  };
}

export interface AiStageAssistResult {
  stageTitle: string;
  stageObjective: string;
  suggestedActions: string[];
  recommendedGoalOrService: string;
  workerCommunicationTip: string;
}

export interface CaseRecordView {
  id: string;
  nationalIdHash: string;
  owningInstitution: InstitutionId;
  blockId: string;
  blockName: string;
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
  stageEnteredDate: string;
  daysInStage: number;
  score: WelfareScoreBreakdown;
  consentSigned: boolean;
  isMasked: boolean;
  // Private fields (only populated when requester belongs to owningInstitution and is not restricted)
  fullName?: string;
  nationalIdMasked?: string;
  phone?: string;
  address?: string;
  householdSize?: number;
  headStatus?: string;
  housingType?: string;
  medicalNotes?: string;
  caseWorkerNote?: string;
  needForecast3M?: ThreeMonthNeedForecast;
  assessmentDetails?: AssessmentFormDetails;
  history?: CaseTimelineEvent[];
  workflow?: CaseManagementWorkflow;
}

export interface InquiryResponse {
  status: 'CLEAN' | 'MATCH_PARTNER' | 'MATCH_SAME';
  nationalIdHashPreview: string;
  matchedRecord?: {
    caseId: string;
    owningInstitution: InstitutionId;
    owningInstitutionName: string;
    coverageStatus: string;
    lastSupportDate: string;
    lastSupportType: string;
    blockId: string;
    blockName: string;
    registeredAt: string;
  };
  leadAgencyEvaluation?: {
    recommendedLead: InstitutionId;
    recommendedLeadName: string;
    reasons: string[];
    suggestedModel: CollaborationModel;
    clientScript: string;
  };
  auditLogId: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorRole: UserRole;
  actorInstitution: InstitutionId | 'joint';
  action:
    | 'INQUIRY_HASH'
    | 'CASE_CREATED'
    | 'CASE_UPDATED'
    | 'OVERLAP_FLAGGED'
    | 'STAGE_ADVANCED'
    | 'CONFLICT_RESOLVED'
    | 'SHG_TRANSACTION';
  nationalIdHashPrefix: string;
  blockName: string;
  outcome: string;
  immutable: true;
}

export interface SmartFieldAssistResponse {
  suggestedHeadStatus: string;
  suggestedHousingType: string;
  suggestedLacksUtilities: boolean;
  suggestedIncomeSourcePoints: number;
  suggestedHasUnemployedWorker: boolean;
  suggestedHasChronicDisease: boolean;
  suggestedChildNutritionRisk: boolean;
  suggestedSkillInterest: string;
  structuredMedicalSummary: string;
  suggestedSupportAction: string;
  followUpQuestions: string[];
  confidenceNote: string;
}

export interface ShgMember {
  id: string;
  memberAlias: string;
  roleInGroup: 'مدیر صندوق' | 'منشی' | 'عضو';
  monthlySaving: number;
  totalSaved: number;
  activeLoanAmount: number;
  repaidAmount: number;
  businessType: string;
  guarantors: [string, string];
  repaymentStatus: 'خوش‌حساب' | 'در جریان' | 'نیاز به مشاوره';
}

export interface ShgGroup {
  id: string;
  name: string;
  blockName: string;
  sponsorInstitution: InstitutionId;
  meetingDay: string;
  matchingRatio: '1:1' | '2:1';
  membersTotalSavings: number;
  charityMatchingFund: number;
  members: ShgMember[];
}

export interface DashboardSummary {
  totalActiveCases: number;
  overlapsPrevented: number;
  avgInquiryMs: number;
  graduatedFamilies: number;
  darolahsanCases: number;
  edalatCases: number;
  redTierCount: number;
  yellowTierCount: number;
  greenTierCount: number;
}

export interface MonthlyReportPoint {
  monthKey: string;
  monthLabel: string;
  graduatedCumulative: number;
  graduatedNew: number;
  overlapsPrevented: number;
  redTier: number;
  yellowTier: number;
  greenTier: number;
  avgResponseDays: number;
}

export interface EmploymentDistributionItem {
  key: 'employed' | 'job_seeking' | 'insured';
  label: string;
  count: number;
  percentage: number;
}

export interface IncomeBracketItem {
  key: 'under_3m' | '3m_to_6m' | '6m_to_10m' | '10m_to_15m' | 'over_15m';
  bracketLabel: string;
  shortLabel: string;
  count: number;
  percentage: number;
  povertyLineStatus: string;
}

export interface CaseWorkerPerformanceItem {
  id: string;
  name: string;
  roleTitle: string;
  institution: InstitutionId;
  institutionLabel: string;
  blockCoverage: string;
  reviewedCasesCount: number;
  currentMonthReviewedCount: number;
  currentMonthTargetCount: number;
  stageTransitionsCount: number;
  avgTransitionDays: number;
  onTimeFollowUpPct: number;
  recordSpeedScore: number;
  assessmentAccuracyScore: number;
  onTimeFollowUpScore: number;
  conflictResolutionScore: number;
  documentationQualityScore: number;
  currentWeekCompletedCount: number;
  currentWeekTargetCount: number;
  stageDurations: {
    stage1: number;
    stage2: number;
    stage3: number;
    stage4: number;
    stage5: number;
    stage6: number;
  };
}

export interface ReportsPayload {
  institutionFilter: InstitutionId | 'all';
  series: MonthlyReportPoint[];
  sixMonthGrowthPct: number;
  totalGraduatedEnd: number;
  currentDistribution: {
    red: number;
    yellow: number;
    green: number;
    total: number;
  };
  employmentDistribution: EmploymentDistributionItem[];
  incomeDistribution: IncomeBracketItem[];
  caseWorkerPeriodLabel: string;
  currentMonthPeriodLabel: string;
  caseWorkerPerformance: CaseWorkerPerformanceItem[];
}

export type AiPrioritizationFocus =
  | 'comprehensive'
  | 'livelihood_medical'
  | 'empowerment'
  | 'housing';

export interface AiPrioritizedHousehold {
  rank: number;
  caseId: string;
  priorityLevel: string;
  recommendedServicePackage: string;
  rationale: string;
  estimatedImpact: string;
}

export interface AiPrioritizationResult {
  focusArea: AiPrioritizationFocus;
  analyzedCasesCount: number;
  generatedAt: string;
  executiveSummary: string;
  resourceAllocationStrategy: string;
  prioritizedHouseholds: AiPrioritizedHousehold[];
}

export type UiThemeMode = 'light' | 'dark' | 'system';
export type UiThemeAccent = 'teal' | 'blue' | 'emerald' | 'amber' | 'violet';
export type UiFontFamily = 'vazirmatn' | 'amiri' | 'noto' | 'rubik' | 'almarai';
export type UiFontScale = 'compact' | 'normal' | 'large';

export type ToastSeverityLevel = 'critical_only' | 'important' | 'all';
export type ToastPosition = 'bottom-left' | 'bottom-right' | 'top-center';

export interface ToastNotificationPreferences {
  level: ToastSeverityLevel;
  durationMs: number;
  position: ToastPosition;
  soundOnCritical: boolean;
  desktopEnabled: boolean;
}

export interface UiPreferences {
  mode: UiThemeMode;
  accent: UiThemeAccent;
  font: UiFontFamily;
  scale: UiFontScale;
  toast: ToastNotificationPreferences;
}

export interface AuthUserSession {
  username: string;
  displayName: string;
  roleTitle: string;
  institution: InstitutionId;
  role: UserRole;
  loggedInAt: string;
}

export type ForecastScenario = 'baseline' | 'accelerated_funding' | 'winter_surge';

export interface StageForecastItem {
  stage: CaseStage;
  stageLabel: string;
  shortLabel: string;
  currentCount: number;
  expectedCount: number;
  medianCount: number;
  ciLow80: number;
  ciHigh80: number;
  ciLow95: number;
  ciHigh95: number;
  netDelta: number;
  inflowExpected: number;
  outflowExpected: number;
  stayProbPct: number;
  advanceProbPct: number;
  congestionRisk: 'high' | 'medium' | 'low';
  resourceAllocationFocus: string;
  estimatedMonthlyBudgetMillion: number;
  requiredWorkerHours: number;
}

export interface StageTransitionCell {
  fromStage: CaseStage;
  toStage: CaseStage;
  probabilityPct: number;
}

export interface StageForecastPayload {
  institutionFilter: InstitutionId | 'all';
  scenario: ForecastScenario;
  scenarioLabel: string;
  horizonLabel: string;
  simulationRuns: number;
  modelSummary: string;
  totalCurrentActive: number;
  totalExpectedNextMonth: number;
  totalCiLow80: number;
  totalCiHigh80: number;
  expectedNewIntake: number;
  expectedGraduations: number;
  bottleneckStage: CaseStage;
  bottleneckReason: string;
  totalEstimatedBudgetMillion: number;
  totalRequiredWorkerHours: number;
  stages: StageForecastItem[];
  transitionMatrix: StageTransitionCell[];
  recommendations: string[];
}

export type AttachmentCategory = 'lease' | 'medical' | 'identity' | 'receipt' | 'other';

export interface CaseAttachment {
  id: string;
  caseId: string;
  title: string;
  category: AttachmentCategory;
  categoryLabel: string;
  dataUrl: string;
  timestamp: string;
  uploaderName: string;
}

