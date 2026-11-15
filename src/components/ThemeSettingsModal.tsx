import React, {useEffect, useState} from 'react';
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCircle2,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  ShieldAlert,
  Sun,
  Type as TypeIcon,
  Volume2,
  X,
} from 'lucide-react';
import type {
  ToastNotificationPreferences,
  ToastPosition,
  ToastSeverityLevel,
  UiFontFamily,
  UiFontScale,
  UiPreferences,
  UiThemeAccent,
  UiThemeMode,
} from '../types';

export type UserSettingsTab = 'notifications' | 'appearance';

export const DEFAULT_TOAST_PREFERENCES: ToastNotificationPreferences = {
  level: 'all',
  durationMs: 4500,
  position: 'bottom-left',
  soundOnCritical: false,
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  mode: 'light',
  accent: 'teal',
  font: 'vazirmatn',
  scale: 'normal',
  toast: DEFAULT_TOAST_PREFERENCES,
};

const MODE_OPTIONS: Array<{
  id: UiThemeMode;
  label: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {id: 'light', label: 'حالت روز (روشن)', icon: Sun},
  {id: 'dark', label: 'حالت شب (تیره)', icon: Moon},
  {id: 'system', label: 'خودکار سیستم', icon: Monitor},
];

const ACCENT_OPTIONS: Array<{id: UiThemeAccent; label: string; swatchClass: string}> = [
  {id: 'teal', label: 'فیروزه‌ای نایسر', swatchClass: 'bg-[#0f766e]'},
  {id: 'blue', label: 'لاجوردی کردستان', swatchClass: 'bg-[#1d4ed8]'},
  {id: 'emerald', label: 'زمردی امید', swatchClass: 'bg-[#047857]'},
  {id: 'amber', label: 'کهربایی گرم', swatchClass: 'bg-[#b45309]'},
  {id: 'violet', label: 'بنفش مدنی', swatchClass: 'bg-[#6d28d9]'},
];

const FONT_OPTIONS: Array<{id: UiFontFamily; label: string; desc: string}> = [
  {id: 'vazirmatn', label: 'وزیرمتن (فونت اداری مدرن)', desc: 'فونت استاندارد، متعادل و رسمی اداری'},
  {id: 'amiri', label: 'امیری / نسخ (Traditional Amiri)', desc: 'خوانایی کلاسیک، نسخ و اسناد رسمی هیئت مدیره'},
  {id: 'noto', label: 'نوتو سنس (رسمی و تحلیلی)', desc: 'خوانایی بالا برای گزارش‌ها و جداول'},
  {id: 'rubik', label: 'روبیک (Rubik)', desc: 'طراحی هندسی نرم و روان'},
  {id: 'almarai', label: 'المراعی (Almarai)', desc: 'شفاف و دقیق برای اعداد و جداول'},
];

const SCALE_OPTIONS: Array<{id: UiFontScale; label: string; hint: string}> = [
  {id: 'compact', label: 'فشرده', hint: 'اطلاعات بیشتر در صفحه'},
  {id: 'normal', label: 'استاندارد', hint: 'اندازه متعادل پیش‌فرض'},
  {id: 'large', label: 'بزرگ و خوانا', hint: 'راحتی بیشتر چشم'},
];

const TOAST_SEVERITY_OPTIONS: Array<{
  id: ToastSeverityLevel;
  title: string;
  desc: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {
    id: 'critical_only',
    title: 'فقط خطاهای حیاتی',
    desc: 'تنها خطاهای بحرانی، اختلال ارتباط با سرور و هشدارهای امنیتی نمایش داده می‌شوند؛ تراکنش‌های عادی و ذخیره موقت بی‌صدا ثبت می‌شوند.',
    icon: ShieldAlert,
  },
  {
    id: 'important',
    title: 'عملیات کلیدی و خطاها',
    desc: 'علاوه‌بر خطاهای حیاتی، رویدادهای مهم مانند جابجایی مرحله پرونده و خروجی گزارش‌ها نمایش داده می‌شوند (بدون اعلان ذخیره خودکار).',
    icon: AlertTriangle,
  },
  {
    id: 'all',
    title: 'تمامی تراکنش‌ها و رویدادها',
    desc: 'کلیه اعلان‌ها شامل ورود به سامانه، ذخیره موقت و خودکار فرم‌ها، جابجایی مراحل، دریافت خروجی و خطاها نمایش داده می‌شوند.',
    icon: BellRing,
  },
];

const DURATION_OPTIONS: Array<{ms: number; label: string}> = [
  {ms: 3000, label: 'کوتاه (۳ ثانیه)'},
  {ms: 4500, label: 'استاندارد (۴.۵ ثانیه)'},
  {ms: 7000, label: 'طولانی (۷ ثانیه)'},
];

const POSITION_OPTIONS: Array<{id: ToastPosition; label: string}> = [
  {id: 'bottom-left', label: 'پایین چپ'},
  {id: 'bottom-right', label: 'پایین راست'},
  {id: 'top-center', label: 'بالا وسط'},
];

interface ThemeSettingsModalProps {
  open: boolean;
  initialTab?: UserSettingsTab;
  prefs: UiPreferences;
  onChange: (next: UiPreferences) => void;
  onTestToast?: (item: {
    variant: 'success' | 'info' | 'error';
    category: 'critical' | 'transaction' | 'draft';
    title: string;
    description: string;
  }) => boolean;
  onClose: () => void;
}

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
  open,
  initialTab = 'notifications',
  prefs,
  onChange,
  onTestToast,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<UserSettingsTab>(initialTab);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      setTestFeedback(null);
    }
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const toastPrefs = prefs.toast || DEFAULT_TOAST_PREFERENCES;

  const updateToastPrefs = (patch: Partial<ToastNotificationPreferences>) => {
    setTestFeedback(null);
    onChange({
      ...prefs,
      toast: {
        ...toastPrefs,
        ...patch,
      },
    });
  };

  const handleRunTest = (kind: 'critical' | 'transaction' | 'draft') => {
    if (!onTestToast) return;
    const payload =
      kind === 'critical'
        ? {
            variant: 'error' as const,
            category: 'critical' as const,
            title: 'اعلان آزمایشی: خطای حیاتی سامانه',
            description: 'این اعلان با اولویت بحرانی در تمامی سطوح اطلاع‌رسانی نمایش داده می‌شود.',
          }
        : kind === 'transaction'
          ? {
              variant: 'success' as const,
              category: 'transaction' as const,
              title: 'اعلان آزمایشی: ثبت تراکنش و جابجایی مرحله',
              description: 'این اعلان در حالت «تمامی تراکنش‌ها» یا «عملیات کلیدی» نمایش داده می‌شود.',
            }
          : {
              variant: 'info' as const,
              category: 'draft' as const,
              title: 'اعلان آزمایشی: ذخیره موقت و خودکار فرم',
              description: 'این اعلان فقط زمانی که سطح «تمامی تراکنش‌ها» فعال باشد نمایش داده می‌شود.',
            };

    const shown = onTestToast(payload);
    if (shown) {
      setTestFeedback('اعلان آزمایشی طبق تنظیمات فعلی روی صفحه نمایش داده شد.');
    } else {
      setTestFeedback(
        'این اعلان مطابق فیلتر شدت فعلی (برای مثال «فقط خطاهای حیاتی») بی‌صدا فیلتر شد و مزاحم کار مددکار نگردید.',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-settings-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300">
              {activeTab === 'notifications' ? (
                <Bell className="w-5 h-5" />
              ) : (
                <Palette className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="user-settings-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                تنظیمات کاربری مددکار و شخصی‌سازی سامانه
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                کنترل شدت اطلاع‌رسانی‌های Toast و ظاهر محیط کار · ذخیره خودکار در مرورگر
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره تنظیمات کاربری"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Tab Bar */}
        <div
          role="tablist"
          aria-label="بخش‌های تنظیمات کاربری"
          className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700/70"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'notifications'}
            onClick={() => setActiveTab('notifications')}
            className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'notifications'
                ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4" />
            اطلاع‌رسانی‌ها (Toast)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            onClick={() => setActiveTab('appearance')}
            className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'appearance'
                ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4" />
            ظاهر، تم و فونت
          </button>
        </div>

        {activeTab === 'notifications' ? (
          <div className="space-y-5">
            {/* 1. Notification Intensity Level */}
            <section className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                شدت و سطح نمایش اعلان‌های Toast
              </div>
              <div className="space-y-2">
                {TOAST_SEVERITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = toastPrefs.level === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateToastPrefs({level: opt.id})}
                      className={`w-full text-right p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/50'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-teal-700 text-white dark:bg-teal-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                            {opt.title}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Duration & Position */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <section className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  مدت زمان نمایش هر اعلان
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {DURATION_OPTIONS.map((opt) => {
                    const isSelected = toastPrefs.durationMs === opt.ms;
                    return (
                      <button
                        key={opt.ms}
                        type="button"
                        onClick={() => updateToastPrefs({durationMs: opt.ms})}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium text-right transition-colors ${
                          isSelected
                            ? 'border-teal-700 bg-teal-50/70 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  موقعیت نمایش اعلان در صفحه
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {POSITION_OPTIONS.map((opt) => {
                    const isSelected = toastPrefs.position === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateToastPrefs({position: opt.id})}
                        className={`px-3 py-2 rounded-lg border text-xs font-medium text-right transition-colors ${
                          isSelected
                            ? 'border-teal-700 bg-teal-50/70 text-teal-900 dark:border-teal-500 dark:bg-teal-950/50 dark:text-teal-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* 3. Critical Alert Audio Toggle */}
            <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 cursor-pointer">
              <div className="flex items-center gap-2.5 min-w-0">
                <Volume2 className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    هشدار صوتی ملایم برای خطاهای حیاتی
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    پخش یک صدای کوتاه هنگام ثبت خطای بحرانی یا قطع ارتباط با سرور
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={toastPrefs.soundOnCritical}
                onChange={(e) => updateToastPrefs({soundOnCritical: e.target.checked})}
                className="w-4 h-4 accent-teal-700 rounded shrink-0"
              />
            </label>

            {/* 4. Interactive Filter Test Strip */}
            {onTestToast && (
              <section className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 space-y-2.5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  آزمایش عملکرد فیلتر اطلاع‌رسانی
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunTest('critical')}
                    className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/70 bg-white dark:bg-slate-900 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    تست خطای حیاتی
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunTest('transaction')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    تست تراکنش ثبت پرونده
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunTest('draft')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    تست ذخیره موقت / خودکار
                  </button>
                </div>
                {testFeedback && (
                  <p className="text-[11px] text-teal-800 dark:text-teal-300 font-medium">
                    {testFeedback}
                  </p>
                )}
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* 1. Light / Dark / System Mode */}
            <section className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                حالت روشنایی (روز و شب)
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = prefs.mode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange({...prefs, mode: opt.id})}
                      className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-2 transition-colors ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/70 text-teal-900 dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-200'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Theme Accent Palette */}
            <section className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                رنگ سازمانی و تم اصلی
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ACCENT_OPTIONS.map((opt) => {
                  const isSelected = prefs.accent === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange({...prefs, accent: opt.id})}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-colors ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/70 text-slate-900 dark:border-teal-400 dark:bg-teal-950/60 dark:text-slate-100'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-md shrink-0 ${opt.swatchClass}`} />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. Persian Font Family */}
            <section className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <TypeIcon className="w-3.5 h-3.5" />
                فونت متون فارسی
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FONT_OPTIONS.map((opt) => {
                  const isSelected = prefs.font === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange({...prefs, font: opt.id})}
                      className={`text-right p-3 rounded-xl border transition-colors ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/60 dark:border-teal-500 dark:bg-teal-950/60'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 4. Font Scale / Readability */}
            <section className="space-y-2.5">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                اندازه نوشته‌ها و تراکم نمایش
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {SCALE_OPTIONS.map((opt) => {
                  const isSelected = prefs.scale === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChange({...prefs, scale: opt.id})}
                      className={`p-3 rounded-xl border text-right transition-colors ${
                        isSelected
                          ? 'border-teal-700 bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/60'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {opt.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setTestFeedback(null);
              onChange(DEFAULT_UI_PREFERENCES);
            }}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            بازگشت به پیش‌فرض
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors"
          >
            تایید و بستن
          </button>
        </div>
      </div>
    </div>
  );
};
