/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  BarChart3,
  Bell,
  BellRing,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Search,
  ShieldCheck,
  Sun,
  Wallet,
  X,
  BookOpen,
  Database,
} from 'lucide-react';
import {AssessmentConsentView} from './components/AssessmentConsentView';
import {InquiryView} from './components/InquiryView';
import {InstitutionEmblem, InstitutionalLogo} from './components/InstitutionalLogo';
import {LoginView} from './components/LoginView';
import {MicrofinanceGraduationView} from './components/MicrofinanceGraduationView';
import {OverviewDashboard} from './components/OverviewDashboard';
import {ReportsView} from './components/ReportsView';
import {SecurityRoadmapView} from './components/SecurityRoadmapView';
import {UserGuideModal} from './components/UserGuideModal';
import {BackupRestoreModal} from './components/BackupRestoreModal';
import {apiFetch} from './utils/staticApiFallback';
import {
  QuickSearchShortcutModal,
  type ShortcutSectionId,
} from './components/QuickSearchShortcutModal';
import {
  DEFAULT_TOAST_PREFERENCES,
  DEFAULT_UI_PREFERENCES,
  ThemeSettingsModal,
  type UserSettingsTab,
} from './components/ThemeSettingsModal';
import {ToastContainer, type ToastItem} from './components/ToastContainer';
import {getPersianDateTimeParts, type PersianDateTimeParts} from './utils/persianDateTime';
import {
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  sendDesktopNotification,
  type BrowserNotificationPermissionState,
} from './utils/desktopNotifications';
import type {
  AuditLogEntry,
  AuthUserSession,
  CaseRecordView,
  CaseStage,
  CollaborationModel,
  DashboardSummary,
  InstitutionId,
  NaysarBlock,
  ShgGroup,
  UiPreferences,
  UserRole,
} from './types';

type ActiveSection =
  | 'overview'
  | 'inquiry'
  | 'assessment'
  | 'microfinance'
  | 'reports'
  | 'security';

const NAV_ITEMS: {id: ActiveSection; label: string; icon: ComponentType<{className?: string}>}[] = [
  {id: 'overview', label: 'پیشخوان', icon: LayoutDashboard},
  {id: 'inquiry', label: 'استعلام کدملی', icon: Search},
  {id: 'assessment', label: 'ارزیابی معیشتی', icon: ClipboardList},
  {id: 'microfinance', label: 'صندوق خرد', icon: Wallet},
  {id: 'reports', label: 'گزارش‌ها', icon: BarChart3},
  {id: 'security', label: 'امنیت و نقشه راه', icon: ShieldCheck},
];

const STAGE_LABELS: Record<CaseStage, string> = {
  1: '۱. پذیرش و ارجاع',
  2: '۲. ارزیابی همه‌جانبه',
  3: '۳. برنامه مداخله',
  4: '۴. اجرا و خدمات',
  5: '۵. پایش مستمر',
  6: '۶. خروج موفق',
};

const INITIAL_SUMMARY: DashboardSummary = {
  totalActiveCases: 0,
  overlapsPrevented: 0,
  avgInquiryMs: 42,
  graduatedFamilies: 0,
  darolahsanCases: 0,
  edalatCases: 0,
  redTierCount: 0,
  yellowTierCount: 0,
  greenTierCount: 0,
};

function loadInitialPrefs(): UiPreferences {
  try {
    const raw = localStorage.getItem('naysar_ui_prefs');
    if (!raw) return DEFAULT_UI_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UiPreferences>;
    const rawToast = parsed.toast;
    return {
      mode: parsed.mode === 'dark' || parsed.mode === 'system' ? parsed.mode : 'light',
      accent:
        parsed.accent === 'blue' ||
        parsed.accent === 'emerald' ||
        parsed.accent === 'amber' ||
        parsed.accent === 'violet'
          ? parsed.accent
          : 'teal',
      font:
        parsed.font === 'noto' || parsed.font === 'rubik' || parsed.font === 'almarai'
          ? parsed.font
          : 'vazirmatn',
      scale: parsed.scale === 'compact' || parsed.scale === 'large' ? parsed.scale : 'normal',
      toast: {
        level:
          rawToast?.level === 'critical_only' || rawToast?.level === 'important'
            ? rawToast.level
            : DEFAULT_TOAST_PREFERENCES.level,
        durationMs:
          rawToast?.durationMs === 3000 ||
          rawToast?.durationMs === 4500 ||
          rawToast?.durationMs === 7000
            ? rawToast.durationMs
            : DEFAULT_TOAST_PREFERENCES.durationMs,
        position:
          rawToast?.position === 'bottom-right' || rawToast?.position === 'top-center'
            ? rawToast.position
            : DEFAULT_TOAST_PREFERENCES.position,
        soundOnCritical:
          typeof rawToast?.soundOnCritical === 'boolean'
            ? rawToast.soundOnCritical
            : DEFAULT_TOAST_PREFERENCES.soundOnCritical,
        desktopEnabled:
          typeof rawToast?.desktopEnabled === 'boolean'
            ? rawToast.desktopEnabled
            : DEFAULT_TOAST_PREFERENCES.desktopEnabled,
      },
    };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

function playCriticalAlertBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 250);
  } catch {
    // ignore Web Audio restrictions
  }
}

function clearStoredAuthSession() {
  try {
    localStorage.removeItem('naysar_auth_session_v1');
    sessionStorage.removeItem('naysar_auth_session_temp_v1');
  } catch {
    // ignore
  }
}

function loadInitialSession(): AuthUserSession | null {
  try {
    const raw =
      localStorage.getItem('naysar_auth_session_v1') ||
      sessionStorage.getItem('naysar_auth_session_temp_v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUserSession> | null;
    if (!parsed || typeof parsed !== 'object') {
      clearStoredAuthSession();
      return null;
    }
    const validInstitution =
      parsed.institution === 'darolahsan' || parsed.institution === 'edalat';
    const validRole =
      parsed.role === 'case_worker' ||
      parsed.role === 'executive_manager' ||
      parsed.role === 'privacy_officer' ||
      parsed.role === 'system_admin';
    if (!parsed.username || !validInstitution || !validRole || !parsed.displayName) {
      clearStoredAuthSession();
      return null;
    }
    return parsed as AuthUserSession;
  } catch {
    clearStoredAuthSession();
    return null;
  }
}

interface SessionErrorBoundaryProps {
  children: ReactNode;
  onResetSession: () => void;
}

interface SessionErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class SessionErrorBoundary extends Component<
  SessionErrorBoundaryProps,
  SessionErrorBoundaryState
> {
  state: SessionErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): SessionErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'خطای غیرمنتظره در بارگذاری داشبورد.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SessionErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/70 rounded-2xl p-6 space-y-4 shadow-lg text-right">
            <h1 className="text-lg font-bold text-red-700 dark:text-red-400">
              بروز خطا در بارگذاری فضای کاربری سامانه
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              در هنگام نمایش پیشخوان یا بازیابی نشست کاربری خطایی رخ داد. می‌توانید صفحه را مجدداً بارگذاری کنید یا به صفحه ورود بازگردید.
            </p>
            {this.state.errorMessage && (
              <div
                dir="ltr"
                className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300 break-all"
              >
                {this.state.errorMessage}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => this.setState({hasError: false, errorMessage: ''})}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                تلاش مجدد
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({hasError: false, errorMessage: ''});
                  this.props.onResetSession();
                }}
                className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                خروج و بازگشت به صفحه ورود
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [authSession, setAuthSession] = useState<AuthUserSession | null>(loadInitialSession);
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('naysar_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<UserSettingsTab>('notifications');
  const [uiPrefs, setUiPrefs] = useState<UiPreferences>(loadInitialPrefs);
  const [desktopPermission, setDesktopPermission] = useState<BrowserNotificationPermissionState>(
    () => getDesktopNotificationPermission(),
  );

  useEffect(() => {
    const syncPermission = () => {
      setDesktopPermission(getDesktopNotificationPermission());
    };
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  const openSettingsModal = useCallback((tab: UserSettingsTab) => {
    setSettingsTab(tab);
    setThemeModalOpen(true);
  }, []);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false,
  );

  const isDark = uiPrefs.mode === 'dark' || (uiPrefs.mode === 'system' && systemPrefersDark);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.setAttribute('data-accent', uiPrefs.accent);
    root.setAttribute('data-font', uiPrefs.font);
    root.setAttribute('data-scale', uiPrefs.scale);
    try {
      localStorage.setItem('naysar_ui_prefs', JSON.stringify(uiPrefs));
    } catch {
      // ignore storage quota errors
    }
  }, [uiPrefs, isDark]);

  // Active RBAC & Institution context (initialized from authenticated user session)
  const [activeInstitution, setActiveInstitution] = useState<InstitutionId>(
    () => authSession?.institution || 'darolahsan',
  );
  const [activeRole, setActiveRole] = useState<UserRole>(
    () => authSession?.role || 'case_worker',
  );

  useEffect(() => {
    if (authSession) {
      if (authSession.role !== 'privacy_officer' && authSession.role !== 'system_admin') {
        setActiveInstitution(authSession.institution);
        setActiveRole(authSession.role);
      }
    }
  }, [authSession]);

  // Shared application state loaded from Express backend
  const [summary, setSummary] = useState<DashboardSummary>(INITIAL_SUMMARY);
  const [blocks, setBlocks] = useState<NaysarBlock[]>([]);
  const [cases, setCases] = useState<CaseRecordView[]>([]);
  const [shgGroups, setShgGroups] = useState<ShgGroup[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live Tehran Persian date & time
  const [liveDateTime, setLiveDateTime] = useState<PersianDateTimeParts>(() =>
    getPersianDateTimeParts(),
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLiveDateTime(getPersianDateTimeParts());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Prefill & Update support from Inquiry / Overview -> Assessment Wizard / 6-Stage Workflow
  const [prefilledNationalId, setPrefilledNationalId] = useState('');
  const [prefilledBlockId, setPrefilledBlockId] = useState('');
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null);
  const [activeWorkflowCaseId, setActiveWorkflowCaseId] = useState<string | null>(null);
  const [pendingInspectCaseId, setPendingInspectCaseId] = useState<string | null>(null);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);

  const handleRestoreData = (imported: {cases: CaseRecordView[]; blocks: NaysarBlock[]}) => {
    setCases(imported.cases);
    setBlocks(imported.blocks);
    setSummary((prev) => ({
      ...prev,
      totalActiveCases: imported.cases.filter((c) => c.coverageStatus !== 'GRADUATED').length,
      graduatedFamilies: imported.cases.filter((c) => c.coverageStatus === 'GRADUATED').length,
      darolahsanCases: imported.cases.filter((c) => c.owningInstitution === 'darolahsan').length,
      edalatCases: imported.cases.filter((c) => c.owningInstitution === 'edalat').length,
      redTierCount: imported.cases.filter((c) => c.urgencyTier === 'red').length,
      yellowTierCount: imported.cases.filter((c) => c.urgencyTier === 'yellow').length,
      greenTierCount: imported.cases.filter((c) => c.urgencyTier === 'green').length,
    }));
    pushToast({
      variant: 'success',
      category: 'transaction',
      title: 'بازیابی اطلاعات با موفقیت انجام شد',
      description: `${imported.cases.length} پرونده از فایل پشتیبان سیستم دیگر بارگذاری شد.`,
    });
    notifyCaseworkerDesktop({
      title: 'بازیابی اطلاعات سامانه انجام شد',
      body: `${imported.cases.length} پرونده از فایل پشتیبان بارگذاری و شاخص‌ها بروزرسانی شد.`,
      tag: 'naysar-restore',
      critical: true,
    });
  };

  // Toast notification queue
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notifyCaseworkerDesktop = useCallback(
    (opts: {
      title: string;
      body: string;
      tag?: string;
      critical?: boolean;
      inspectCaseId?: string;
    }) => {
      const desktopEnabled = uiPrefs.toast?.desktopEnabled ?? true;
      return sendDesktopNotification({
        title: opts.title,
        body: opts.body,
        tag: opts.tag,
        critical: opts.critical,
        enabled: desktopEnabled,
        onClick: opts.inspectCaseId
          ? () => {
              setPendingInspectCaseId(opts.inspectCaseId!);
              setActiveSection('overview');
            }
          : undefined,
      });
    },
    [uiPrefs.toast?.desktopEnabled],
  );

  const notifyCaseworkerDesktopRef = useRef(notifyCaseworkerDesktop);
  useEffect(() => {
    notifyCaseworkerDesktopRef.current = notifyCaseworkerDesktop;
  }, [notifyCaseworkerDesktop]);

  const pushToast = useCallback(
    (item: Omit<ToastItem, 'id'>): boolean => {
      const toastPrefs = uiPrefs.toast || DEFAULT_TOAST_PREFERENCES;
      const isCritical = item.variant === 'error' || item.category === 'critical';
      const isDraft = item.category === 'draft' || item.variant === 'info';

      if (isCritical) {
        notifyCaseworkerDesktopRef.current({
          title: item.title,
          body: item.description || 'هشدار حیاتی در سامانه مدیریت مورد نایسر ثبت شد.',
          tag: 'naysar-critical-alert',
          critical: true,
        });
      }

      if (toastPrefs.level === 'critical_only' && !isCritical) {
        return false;
      }
      if (toastPrefs.level === 'important' && !isCritical && isDraft) {
        return false;
      }

      if (isCritical && toastPrefs.soundOnCritical) {
        playCriticalAlertBeep();
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const nowTime = item.timestamp || getPersianDateTimeParts().shortTime;
      setToasts((prev) => [...prev.slice(-3), {...item, id, timestamp: nowTime}]);
      const timer = window.setTimeout(() => {
        toastTimersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, toastPrefs.durationMs || 4500);
      toastTimersRef.current.set(id, timer);
      return true;
    },
    [uiPrefs.toast],
  );

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  const pushToastRef = useRef(pushToast);
  useEffect(() => {
    pushToastRef.current = pushToast;
  }, [pushToast]);

  const handleRequestDesktopPermission = useCallback(async () => {
    const nextPerm = await requestDesktopNotificationPermission();
    setDesktopPermission(nextPerm);
    if (nextPerm === 'granted') {
      setUiPrefs((prev) => ({
        ...prev,
        toast: {
          ...(prev.toast || DEFAULT_TOAST_PREFERENCES),
          desktopEnabled: true,
        },
      }));
      sendDesktopNotification({
        title: 'اعلان دسکتاپ سامانه نایسر فعال شد',
        body: 'در صورت ثبت پرونده جدید یا تغییر وضعیت حیاتی، اعلان دسکتاپ برای شما ارسال می‌شود.',
        tag: 'naysar-desktop-enabled',
      });
      pushToastRef.current({
        variant: 'success',
        category: 'transaction',
        title: 'اعلان دسکتاپ مرورگر فعال شد',
        description: 'از این پس هنگام ثبت پرونده جدید و رخدادهای حیاتی اعلان دسکتاپ ارسال می‌گردد.',
      });
    } else if (nextPerm === 'denied') {
      pushToastRef.current({
        variant: 'info',
        category: 'transaction',
        title: 'مجوز اعلان دسکتاپ در مرورگر مسدود است',
        description: 'در صورت نیاز می‌توانید از بخش تنظیمات سایت در نوار آدرس مرورگر مجوز را فعال کنید.',
      });
    }
    return nextPerm;
  }, []);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await apiFetch(
        `/api/overview?institution=${encodeURIComponent(activeInstitution)}&role=${encodeURIComponent(activeRole)}`,
      );
      if (!res.ok) throw new Error('خطا در دریافت اطلاعات پیشخوان');
      const data = await res.json();
      setSummary(data.summary);
      setBlocks(data.blocks);
      setCases(data.cases);
      setLoadError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'خطا در برقراری ارتباط با سرور';
      setLoadError(msg);
      pushToastRef.current({
        variant: 'error',
        category: 'critical',
        title: 'خطای حیاتی در ارتباط با سرور',
        description: msg,
      });
    }
  }, [activeInstitution, activeRole]);

  const fetchShg = useCallback(async () => {
    try {
      const res = await apiFetch('/api/shg');
      if (!res.ok) return;
      const data = await res.json();
      setShgGroups(data.groups);
    } catch {
      // handled gracefully
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await apiFetch('/api/audit-logs');
      if (!res.ok) return;
      const data = await res.json();
      setAuditLogs(data.logs);
    } catch {
      // handled gracefully
    }
  }, []);

  useEffect(() => {
    if (!authSession) return;
    let active = true;
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchOverview(), fetchShg(), fetchAuditLogs()]);
      if (active) setLoading(false);
    };
    init();
    return () => {
      active = false;
    };
  }, [authSession, fetchOverview, fetchShg, fetchAuditLogs]);

  const handleLoginSuccess = (session: AuthUserSession, remember: boolean) => {
    try {
      if (remember) {
        localStorage.setItem('naysar_auth_session_v1', JSON.stringify(session));
        sessionStorage.removeItem('naysar_auth_session_temp_v1');
      } else {
        sessionStorage.setItem('naysar_auth_session_temp_v1', JSON.stringify(session));
        localStorage.removeItem('naysar_auth_session_v1');
      }
    } catch {
      // ignore storage errors
    }
    setLoadError(null);
    setQuickSearchOpen(false);
    setActiveInstitution(session.institution === 'edalat' ? 'edalat' : 'darolahsan');
    setActiveRole(session.role);
    setAuthSession(session);
    setActiveSection('overview');
    pushToast({
      variant: 'success',
      category: 'transaction',
      title: `خوش آمدید، ${session.displayName}`,
      description: `${session.roleTitle} · ورود با موفقیت ثبت شد.`,
    });
  };

  const handleLogout = () => {
    clearStoredAuthSession();
    setAuthSession(null);
    setLoadError(null);
    setQuickSearchOpen(false);
    setPendingInspectCaseId(null);
    setActiveWorkflowCaseId(null);
    setEditingCaseId(null);
    setActiveSection('overview');
    setMobileMenuOpen(false);
  };

  const handleNavigate = useCallback((section: ActiveSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
    window.scrollTo({top: 0, behavior: 'smooth'});
  }, []);

  useEffect(() => {
    if (!authSession) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
        e.preventDefault();
        setQuickSearchOpen((prev) => !prev);
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable
        ) {
          return;
        }

        const codeMap: Record<string, ActiveSection> = {
          Digit1: 'overview',
          Digit2: 'inquiry',
          Digit3: 'assessment',
          Digit4: 'microfinance',
          Digit5: 'reports',
          Digit6: 'security',
          '1': 'overview',
          '2': 'inquiry',
          '3': 'assessment',
          '4': 'microfinance',
          '5': 'reports',
          '6': 'security',
          '۱': 'overview',
          '۲': 'inquiry',
          '۳': 'assessment',
          '۴': 'microfinance',
          '۵': 'reports',
          '۶': 'security',
        };

        const targetSection = codeMap[e.code] || codeMap[e.key];
        if (targetSection) {
          e.preventDefault();
          setQuickSearchOpen(false);
          handleNavigate(targetSection);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [authSession, handleNavigate]);

  const handleAdvanceStage = async (caseId: string, nextStage: CaseStage) => {
    const targetCase = cases.find((c) => c.id === caseId);
    const res = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/stage`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        stage: nextStage,
        institution: activeInstitution,
        role: activeRole,
      }),
    });
    if (res.ok) {
      await Promise.all([fetchOverview(), fetchAuditLogs()]);
      const beneficiaryLabel =
        targetCase && !targetCase.isMasked && targetCase.fullName
          ? `${targetCase.fullName} (${caseId})`
          : `پرونده ${caseId}`;
      pushToast({
        variant: 'success',
        category: 'transaction',
        title: 'جابجایی مرحله پرونده با موفقیت ثبت شد',
        description: `${beneficiaryLabel} به مرحله «${STAGE_LABELS[nextStage]}» منتقل و در دفتر ممیزی ثبت گردید.`,
      });
      if (nextStage === 6 || targetCase?.urgencyTier === 'red') {
        notifyCaseworkerDesktop({
          title:
            nextStage === 6
              ? 'خروج موفق و خوداتکایی پرونده ثبت شد'
              : 'تغییر وضعیت حیاتی پرونده بحرانی',
          body: `${beneficiaryLabel} به مرحله «${STAGE_LABELS[nextStage]}» منتقل گردید.`,
          tag: `stage-${caseId}`,
          critical: targetCase?.urgencyTier === 'red',
          inspectCaseId: caseId,
        });
      }
    } else {
      pushToast({
        variant: 'error',
        category: 'critical',
        title: 'خطا در جابجایی مرحله پرونده',
        description: 'ثبت انتقال مرحله با خطا مواجه شد. لطفاً مجدداً تلاش کنید.',
      });
    }
  };

  const handleResolveOverlap = async (caseId: string, model: CollaborationModel) => {
    const res = await apiFetch(`/api/cases/${encodeURIComponent(caseId)}/stage`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        collaborationModel: model,
        institution: activeInstitution,
        role: activeRole,
      }),
    });
    if (res.ok) {
      await Promise.all([fetchOverview(), fetchAuditLogs()]);
      pushToast({
        variant: 'success',
        category: 'transaction',
        title: 'پروتکل همکاری دو مؤسسه ثبت شد',
        description: `وضعیت هم‌پوشانی پرونده ${caseId} با موفقیت تعیین تکلیف گردید.`,
      });
      notifyCaseworkerDesktop({
        title: 'تغییر وضعیت هم‌پوشانی و ثبت پروتکل همکاری',
        body: `پرونده ${caseId} با مدل «${
          model === 'complementary_support' ? 'پوشش ترکیبی' : 'واگذاری به مؤسسه مسئول'
        }» تعیین تکلیف شد.`,
        tag: `overlap-${caseId}`,
        critical: true,
        inspectCaseId: caseId,
      });
    } else {
      pushToast({
        variant: 'error',
        category: 'critical',
        title: 'خطا در ثبت پروتکل همکاری',
        description: 'بروزرسانی مدل همکاری با خطا مواجه شد.',
      });
    }
  };

  if (!authSession) {
    return (
      <>
        <LoginView
          liveDateTime={liveDateTime}
          isDark={isDark}
          onToggleDarkMode={() =>
            setUiPrefs((prev) => ({
              ...prev,
              mode: isDark ? 'light' : 'dark',
            }))
          }
          onOpenThemeModal={() => openSettingsModal('appearance')}
          onLoginSuccess={handleLoginSuccess}
        />
        <ThemeSettingsModal
          open={themeModalOpen}
          initialTab={settingsTab}
          prefs={uiPrefs}
          onChange={setUiPrefs}
          desktopPermission={desktopPermission}
          onRequestDesktopPermission={handleRequestDesktopPermission}
          onTestToast={(item) => pushToast(item)}
          onClose={() => setThemeModalOpen(false)}
        />
        <ToastContainer
          toasts={toasts}
          onDismiss={dismissToast}
          position={uiPrefs.toast.position}
        />
      </>
    );
  }

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('naysar_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  const activeNavItem = NAV_ITEMS.find((n) => n.id === activeSection) || NAV_ITEMS[0];
  const activeInstitutionLabel =
    activeRole === 'privacy_officer'
      ? 'ناظر امنیتی بی‌طرف'
      : activeInstitution === 'darolahsan'
        ? 'دارالاحسان سنندج'
        : 'عدالت و برابری کردستان';

  return (
    <SessionErrorBoundary onResetSession={handleLogout}>
      <div className="min-h-screen flex bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 print:bg-white print:text-slate-900 transition-colors duration-200">
      {/* Desktop Minimal Collapsible Sidebar (RTL Right Side) */}
      <aside
        aria-label="منوی کناری سامانه"
        className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-screen bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all duration-200 print:hidden ${
          sidebarCollapsed ? 'w-[72px]' : 'w-60'
        }`}
      >
        {/* Sidebar Header: Institutional Logo & Collapse Toggle */}
        <div
          className={`h-14 flex items-center border-b border-slate-200 dark:border-slate-800 shrink-0 ${
            sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => handleNavigate('overview')}
            title="بازگشت به پیشخوان"
            className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded-lg"
          >
            <InstitutionalLogo
              variant={sidebarCollapsed ? 'mark' : 'lockup'}
              size="sm"
              subtitle="دارالاحسان · عدالت"
            />
          </button>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title="جمع‌کردن منوی کناری"
              aria-label="جمع‌کردن منوی کناری"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Expand Trigger when Collapsed */}
        {sidebarCollapsed && (
          <div className="px-2 pt-2.5 flex justify-center">
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title="بازکردن منوی کناری"
              aria-label="بازکردن منوی کناری"
              className="w-10 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <PanelRightOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary 6-Item Navigation */}
        <nav aria-label="ناوبری اصلی سامانه" className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center rounded-lg text-sm transition-colors whitespace-nowrap ${
                  sidebarCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2.5 text-right'
                } ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-semibold border border-teal-200/70 dark:border-teal-800/60'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white border border-transparent font-medium'
                }`}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom User Profile & Compact Utility Dock */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-2.5 space-y-2.5 shrink-0">
          {!sidebarCollapsed ? (
            <div className="px-2 py-1 flex items-center gap-2.5">
              {activeRole !== 'privacy_officer' && (
                <InstitutionEmblem institution={activeInstitution} size="sm" />
              )}
              <div className="min-w-0 space-y-0.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {authSession.displayName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {activeInstitutionLabel}
                </div>
              </div>
            </div>
          ) : (
            activeRole !== 'privacy_officer' && (
              <div className="flex justify-center">
                <InstitutionEmblem institution={activeInstitution} size="sm" />
              </div>
            )
          )}

          <div
            className={`flex items-center gap-1 ${
              sidebarCollapsed ? 'flex-col' : 'justify-between px-1'
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setUiPrefs((prev) => ({
                  ...prev,
                  mode: isDark ? 'light' : 'dark',
                }))
              }
              title={isDark ? 'تغییر به حالت روز (روشن)' : 'تغییر به حالت شب (تیره)'}
              aria-label={isDark ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => openSettingsModal('notifications')}
              title="تنظیمات کاربری اطلاع‌رسانی (Toast)"
              aria-label="تنظیمات اطلاع‌رسانی و اعلان‌ها"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              {uiPrefs.toast.level === 'critical_only' && (
                <span
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full bg-amber-500 absolute top-1.5 left-1.5"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => openSettingsModal('appearance')}
              title="شخصی‌سازی تم، رنگ و فونت"
              aria-label="شخصی‌سازی تم و فونت"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Palette className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsGuideOpen(true)}
              title="راهنمای استفاده از سامانه"
              aria-label="راهنمای استفاده از سامانه"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsBackupOpen(true)}
              title="پشتیبان‌گیری و بازیابی داده‌ها"
              aria-label="پشتیبان‌گیری و بازیابی داده‌ها"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Database className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              title="خروج از حساب کاربری"
              aria-label="خروج از حساب کاربری"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50/70 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex print:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <aside className="w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-xl">
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <InstitutionalLogo variant="lockup" size="sm" subtitle="دارالاحسان · عدالت" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="بستن منو"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav aria-label="منوی موبایل" className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors text-right ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-semibold border border-teal-200/70 dark:border-teal-800/60'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium border border-transparent'
                    }`}
                  >
                    <Icon className="w-[18px] h-[18px] shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-3">
              <div className="px-1 flex items-center gap-2.5">
                {activeRole !== 'privacy_officer' && (
                  <InstitutionEmblem institution={activeInstitution} size="sm" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {authSession.displayName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {activeInstitutionLabel}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setUiPrefs((prev) => ({
                      ...prev,
                      mode: isDark ? 'light' : 'dark',
                    }))
                  }
                  className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  {isDark ? 'حالت روز' : 'حالت شب'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openSettingsModal('notifications');
                  }}
                  className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1"
                >
                  <Bell className="w-3.5 h-3.5" />
                  اعلان‌ها
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openSettingsModal('appearance');
                  }}
                  className="py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1"
                >
                  <Palette className="w-3.5 h-3.5" />
                  تم و ظاهر
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-2 px-2.5 rounded-lg border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-400 inline-flex items-center justify-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  خروج
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Minimal Contextual Top Bar */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منو"
              className="lg:hidden p-2 -mr-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <span className="lg:hidden inline-flex items-center">
                <InstitutionalLogo variant="mark" size="sm" />
              </span>
              <span className="hidden sm:inline text-slate-400 dark:text-slate-500 whitespace-nowrap">
                هم‌افزایی نایسر
              </span>
              <span aria-hidden="true" className="hidden sm:inline text-slate-300 dark:text-slate-700">
                /
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {activeNavItem.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Dedicated Institution Security Access Badge or Switcher for Auditors */}
            {authSession.role === 'privacy_officer' || authSession.role === 'system_admin' ? (
              <div className="hidden md:flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200/70 dark:border-slate-700/70">
                <button
                  type="button"
                  onClick={() => {
                    setActiveInstitution('darolahsan');
                    if (activeRole === 'privacy_officer') setActiveRole('case_worker');
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                    activeInstitution === 'darolahsan' && activeRole !== 'privacy_officer'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <InstitutionEmblem institution="darolahsan" size="xs" />
                  <span>دارالاحسان</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveInstitution('edalat');
                    if (activeRole === 'privacy_officer') setActiveRole('case_worker');
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                    activeInstitution === 'edalat' && activeRole !== 'privacy_officer'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <InstitutionEmblem institution="edalat" size="xs" />
                  <span>عدالت و برابری</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveRole('privacy_officer')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeRole === 'privacy_officer'
                      ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  ناظر امنیتی
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/50 rounded-lg border border-teal-200 dark:border-teal-800 text-xs font-semibold text-teal-900 dark:text-teal-200">
                <InstitutionEmblem institution={activeInstitution} size="xs" />
                <span>پایگاه اختصاصی {activeInstitution === 'darolahsan' ? 'مؤسسه دارالاحسان سنندج' : 'مؤسسه عدالت و برابری کردستان'}</span>
              </div>
            )}

            <span className="hidden xl:inline text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
              {liveDateTime.date} · {liveDateTime.shortTime}
            </span>

            {desktopPermission === 'default' && (uiPrefs.toast?.desktopEnabled ?? true) && (
              <button
                type="button"
                onClick={handleRequestDesktopPermission}
                title="فعال‌سازی اعلان دسکتاپ مرورگر برای پرونده‌های جدید و تغییر وضعیت‌های حیاتی"
                className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <BellRing className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">اعلان دسکتاپ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setQuickSearchOpen(true)}
              title="جستجوی سریع پرونده‌ها و میانبرهای سامانه (Ctrl+K)"
              className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 shrink-0" />
              <span className="hidden sm:inline">جستجوی سریع</span>
              <kbd
                dir="ltr"
                className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded"
              >
                Ctrl+K
              </kbd>
            </button>

            {activeSection !== 'inquiry' ? (
              <button
                type="button"
                onClick={() => handleNavigate('inquiry')}
                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                استعلام فوری
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingCaseId(null);
                  handleNavigate('assessment');
                }}
                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                ثبت پرونده جدید
              </button>
            )}
          </div>
        </header>

        {/* Mobile Institution Switcher Strip (Only shown on <md viewports) */}
        <div className="md:hidden px-4 pt-3 print:hidden">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                setActiveInstitution('darolahsan');
                if (activeRole === 'privacy_officer') setActiveRole('case_worker');
              }}
              className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                activeInstitution === 'darolahsan' && activeRole !== 'privacy_officer'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <InstitutionEmblem institution="darolahsan" size="xs" />
              <span>دارالاحسان</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveInstitution('edalat');
                if (activeRole === 'privacy_officer') setActiveRole('case_worker');
              }}
              className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                activeInstitution === 'edalat' && activeRole !== 'privacy_officer'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <InstitutionEmblem institution="edalat" size="xs" />
              <span>عدالت و برابری</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRole('privacy_officer')}
              className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeRole === 'privacy_officer'
                  ? 'bg-slate-900 dark:bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              ناظر امنیتی
            </button>
          </div>
        </div>

        {/* Centered Main Content Area */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-sm text-red-800 dark:text-red-200 flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <button
              type="button"
              onClick={() => fetchOverview()}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-slate-800"
            >
              تلاش مجدد
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-6 animate-pulse" aria-busy="true">
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
              ))}
            </div>
            <div className="h-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl" />
          </div>
        ) : (
          <>
            {activeSection === 'overview' && (
              <OverviewDashboard
                summary={summary}
                blocks={blocks}
                cases={cases}
                auditLogs={auditLogs}
                activeInstitution={activeInstitution}
                activeRole={activeRole}
                onAdvanceStage={handleAdvanceStage}
                onEditCase={(caseId) => {
                  setEditingCaseId(caseId);
                  handleNavigate('assessment');
                }}
                onWorkflowSaved={async (updatedCase, meta) => {
                  await Promise.all([fetchOverview(), fetchAuditLogs()]);
                  if (updatedCase && meta?.advanced) {
                    const nameLabel = updatedCase.fullName
                      ? `${updatedCase.fullName} (${updatedCase.id})`
                      : `پرونده ${updatedCase.id}`;
                    pushToast({
                      variant: 'success',
                      category: 'transaction',
                      title: 'ارتقای مرحله پرونده با موفقیت ثبت شد',
                      description: `${nameLabel} به مرحله «${STAGE_LABELS[updatedCase.stage]}» منتقل شد.`,
                    });
                    if (updatedCase.stage === 6 || updatedCase.urgencyTier === 'red') {
                      notifyCaseworkerDesktop({
                        title:
                          updatedCase.stage === 6
                            ? 'تغییر وضعیت پرونده به خروج موفق'
                            : 'تغییر وضعیت حیاتی پرونده بحرانی',
                        body: `${nameLabel} به مرحله «${STAGE_LABELS[updatedCase.stage]}» منتقل شد.`,
                        tag: `workflow-${updatedCase.id}`,
                        critical: updatedCase.urgencyTier === 'red',
                        inspectCaseId: updatedCase.id,
                      });
                    }
                  } else if (updatedCase) {
                    pushToast({
                      variant: 'info',
                      category: 'draft',
                      title: 'اجزای مرحله با موفقیت ذخیره شد',
                      description: `اطلاعات مرحله برای ${updatedCase.fullName || updatedCase.id} در پرونده و دفتر ممیزی ثبت گردید.`,
                    });
                  }
                }}
                initialWorkflowCaseId={activeWorkflowCaseId}
                onClearInitialWorkflowCase={() => setActiveWorkflowCaseId(null)}
                initialInspectedCaseId={pendingInspectCaseId}
                onClearInitialInspectedCase={() => setPendingInspectCaseId(null)}
                onNavigateToInquiry={() => handleNavigate('inquiry')}
                onNavigateToAssessment={() => {
                  setEditingCaseId(null);
                  handleNavigate('assessment');
                }}
                isDark={isDark}
                themeAccent={uiPrefs.accent}
                preparedBy={`${authSession.displayName} · ${authSession.roleTitle}`}
                generatedAt={`${liveDateTime.fullDateLabel} · ساعت ${liveDateTime.time}`}
                onExportToast={(title, description) =>
                  pushToast({
                    variant: 'success',
                    category: 'transaction',
                    title,
                    description,
                  })
                }
              />
            )}

            {activeSection === 'inquiry' && (
              <InquiryView
                blocks={blocks}
                activeInstitution={activeInstitution}
                activeRole={activeRole}
                onStartNewCaseWithId={(nid, blk) => {
                  setEditingCaseId(null);
                  setPrefilledNationalId(nid);
                  setPrefilledBlockId(blk);
                  handleNavigate('assessment');
                }}
                onEditExistingCase={(caseId) => {
                  setEditingCaseId(caseId);
                  handleNavigate('assessment');
                }}
                onResolveOverlap={handleResolveOverlap}
                onOverlapDetected={(matchedCaseId, owningInstitutionName, blockName) => {
                  notifyCaseworkerDesktop({
                    title: 'هشدار هم‌پوشانی پرونده بین دو مؤسسه',
                    body: `پرونده ${matchedCaseId} در محدوده «${blockName}» پیش‌تر تحت پوشش «${owningInstitutionName}» ثبت شده است.`,
                    tag: `inquiry-overlap-${matchedCaseId}`,
                    critical: true,
                    inspectCaseId: matchedCaseId,
                  });
                }}
              />
            )}

            {activeSection === 'assessment' && (
              <AssessmentConsentView
                blocks={blocks}
                cases={cases}
                activeInstitution={activeInstitution}
                activeRole={activeRole}
                prefilledNationalId={prefilledNationalId}
                prefilledBlockId={prefilledBlockId}
                initialEditCaseId={editingCaseId}
                onClearInitialEditCase={() => setEditingCaseId(null)}
                onCaseSaved={async (meta) => {
                  await Promise.all([fetchOverview(), fetchAuditLogs()]);
                  if (meta?.stageChanged) {
                    const label = meta.fullName ? `${meta.fullName} (${meta.caseId})` : `پرونده ${meta.caseId}`;
                    pushToast({
                      variant: 'success',
                      category: 'transaction',
                      title: 'جابجایی مرحله پرونده با موفقیت ثبت شد',
                      description: `${label} در جریان بروزرسانی به مرحله «${STAGE_LABELS[meta.stage]}» منتقل شد.`,
                    });
                  } else if (meta) {
                    const label = meta.fullName ? `${meta.fullName} (${meta.caseId})` : `پرونده ${meta.caseId}`;
                    pushToast({
                      variant: 'success',
                      category: 'transaction',
                      title: meta.isUpdate ? 'بروزرسانی پرونده با موفقیت ثبت شد' : 'پرونده جدید با موفقیت ثبت شد',
                      description: `اطلاعات ${label} در سامانه ذخیره و کد هش آن ثبت گردید.`,
                    });
                  }

                  if (meta) {
                    const label = meta.fullName ? `${meta.fullName} (${meta.caseId})` : `پرونده ${meta.caseId}`;
                    if (!meta.isUpdate) {
                      notifyCaseworkerDesktop({
                        title:
                          meta.urgencyTier === 'red'
                            ? 'ثبت پرونده جدید با وضعیت قرمز (بحرانی)'
                            : 'ثبت پرونده جدید در سامانه نایسر',
                        body: `${label} · امتیاز نیازمندی ${meta.scoreTotal ?? '—'}/۱۰۰ · مرحله «${STAGE_LABELS[meta.stage]}»`,
                        tag: `new-case-${meta.caseId}`,
                        critical: meta.urgencyTier === 'red',
                        inspectCaseId: meta.caseId,
                      });
                    } else {
                      const escalatedToRed =
                        meta.urgencyTier === 'red' && meta.previousUrgencyTier !== 'red';
                      const graduatedNow = meta.stageChanged && meta.stage === 6;
                      const criticalStageMove = meta.stageChanged && meta.urgencyTier === 'red';

                      if (escalatedToRed || graduatedNow || criticalStageMove) {
                        notifyCaseworkerDesktop({
                          title: escalatedToRed
                            ? 'تغییر وضعیت حیاتی: ارتقا به سطح قرمز (بحرانی)'
                            : graduatedNow
                              ? 'تغییر وضعیت پرونده به خروج موفق'
                              : 'تغییر وضعیت حیاتی پرونده بحرانی',
                          body: `${label} · امتیاز ${meta.scoreTotal ?? '—'}/۱۰۰ · مرحله «${STAGE_LABELS[meta.stage]}»`,
                          tag: `case-critical-${meta.caseId}`,
                          critical: escalatedToRed || criticalStageMove,
                          inspectCaseId: meta.caseId,
                        });
                      }
                    }
                  }
                }}
                onNavigateToOverview={() => handleNavigate('overview')}
                onOpenCaseWorkflow={(caseId) => {
                  setActiveWorkflowCaseId(caseId);
                  handleNavigate('overview');
                }}
                onDraftToast={(title, description) => {
                  pushToast({
                    variant: 'info',
                    category: 'draft',
                    title,
                    description,
                  });
                }}
              />
            )}

            {activeSection === 'microfinance' && (
              <MicrofinanceGraduationView
                groups={shgGroups}
                onGroupUpdated={async () => {
                  await Promise.all([fetchShg(), fetchAuditLogs()]);
                }}
              />
            )}

            {activeSection === 'reports' && (
              <ReportsView
                cases={cases}
                isDark={isDark}
                themeAccent={uiPrefs.accent}
                preparedBy={`${authSession.displayName} · ${authSession.roleTitle}`}
                generatedAt={`${liveDateTime.fullDateLabel} · ساعت ${liveDateTime.time}`}
                onExportToast={(title, description) =>
                  pushToast({
                    variant: 'success',
                    category: 'transaction',
                    title,
                    description,
                  })
                }
              />
            )}

            {activeSection === 'security' && (
              <SecurityRoadmapView
                auditLogs={auditLogs}
                onRefreshLogs={fetchAuditLogs}
              />
            )}
          </>
        )}
        </main>

        {/* Minimal Single-Row Footer */}
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-auto print:hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              سامانه هم‌افزایی و مدیریت مورد نایسر · دارالاحسان سنندج و عدالت و برابری کردستان
            </span>
            <span>پروتکل ۶ مرحله‌ای مدیریت مورد و تفکیک محرمانگی داده‌ها</span>
          </div>
        </footer>
      </div>

      <ThemeSettingsModal
        open={themeModalOpen}
        initialTab={settingsTab}
        prefs={uiPrefs}
        onChange={setUiPrefs}
        desktopPermission={desktopPermission}
        onRequestDesktopPermission={handleRequestDesktopPermission}
        onTestToast={(item) => pushToast(item)}
        onClose={() => setThemeModalOpen(false)}
      />

      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        isDark={isDark}
      />

      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
        cases={cases}
        blocks={blocks}
        onRestoreData={handleRestoreData}
        onExportToast={(title, description) =>
          pushToast({variant: 'success', category: 'transaction', title, description})
        }
      />

      <QuickSearchShortcutModal
        isOpen={quickSearchOpen}
        onClose={() => setQuickSearchOpen(false)}
        cases={cases}
        activeInstitution={activeInstitution}
        activeRole={activeRole}
        onSelectCaseInspect={(caseId) => {
          setPendingInspectCaseId(caseId);
          handleNavigate('overview');
        }}
        onSelectCaseWorkflow={(caseId) => {
          setActiveWorkflowCaseId(caseId);
          handleNavigate('overview');
        }}
        onNavigateSection={(section: ShortcutSectionId) => {
          handleNavigate(section);
        }}
        onStartNewCase={() => {
          setEditingCaseId(null);
          handleNavigate('assessment');
        }}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        position={uiPrefs.toast.position}
      />
      </div>
    </SessionErrorBoundary>
  );
}
