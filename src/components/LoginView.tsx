import React, {useState} from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Moon,
  Palette,
  Sun,
  User,
} from 'lucide-react';
import {
  InstitutionEmblem,
  InstitutionalLogo,
  PartnerLogosPair,
} from './InstitutionalLogo';
import naysarSanandajImg from '../assets/images/naysar_sanandaj_view_1794683370549.jpg';
import type {AuthUserSession} from '../types';
import type {PersianDateTimeParts} from '../utils/persianDateTime';

interface LoginViewProps {
  liveDateTime: PersianDateTimeParts;
  isDark: boolean;
  onToggleDarkMode: () => void;
  onOpenThemeModal: () => void;
  onLoginSuccess: (session: AuthUserSession, remember: boolean) => void;
}

const DEMO_ACCOUNTS = [
  {
    username: 'darolahsan',
    password: 'Naysar@1405',
    label: 'مددکار دارالاحسان',
    sublabel: 'بلوک‌های ۱، ۳ و مشترک',
    institution: 'darolahsan' as const,
  },
  {
    username: 'edalat',
    password: 'Naysar@1405',
    label: 'مددکار عدالت و برابری',
    sublabel: 'بلوک‌های ۲، ۴ و مشترک',
    institution: 'edalat' as const,
  },
  {
    username: 'nazer',
    password: 'Nazer@1405',
    label: 'ناظر امنیتی',
    sublabel: 'پایش ممیزی و حریم خصوصی',
    institution: null,
  },
] as const;

export const LoginView: React.FC<LoginViewProps> = ({
  liveDateTime,
  isDark,
  onToggleDarkMode,
  onOpenThemeModal,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError('لطفاً نام کاربری و رمز عبور خود را وارد نمایید.');
      return;
    }

    setSubmitting(true);
    try {
      const normalizedUser = username
        .trim()
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: normalizedUser,
          password,
        }),
      });
      const rawText = await res.text();
      let data: {error?: string; session?: AuthUserSession} = {};
      if (rawText) {
        try {
          data = JSON.parse(rawText) as {error?: string; session?: AuthUserSession};
        } catch {
          data = {};
        }
      }
      if (!res.ok || !data.session) {
        setError(
          data.error ||
            (res.status >= 500
              ? 'سرور احراز هویت موقتاً در دسترس نیست. لطفاً چند لحظه دیگر مجدداً تلاش کنید.'
              : 'ورود ناموفق بود. لطفاً نام کاربری و رمز عبور را بررسی کنید.'),
        );
        return;
      }
      onLoginSuccess(data.session, rememberMe);
    } catch {
      setError('خطا در برقراری ارتباط با سرور احراز هویت.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickFill = (accUsername: string, accPassword: string) => {
    setUsername(accUsername);
    setPassword(accPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 grid grid-cols-1 lg:grid-cols-12 transition-colors duration-200">
      {/* Right Column (RTL): Login Form Panel */}
      <div className="lg:col-span-5 flex flex-col justify-between p-5 sm:p-8 lg:p-10 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-l border-slate-200 dark:border-slate-800 order-2 lg:order-1">
        {/* Top Utility Strip */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {liveDateTime.date} · {liveDateTime.shortTime}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleDarkMode}
              title={isDark ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
              aria-label={isDark ? 'تغییر به حالت روز' : 'تغییر به حالت شب'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenThemeModal}
              title="شخصی‌سازی تم و فونت"
              aria-label="شخصی‌سازی تم و فونت"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Palette className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            </button>
          </div>
        </div>

        {/* Center Auth Form */}
        <div className="w-full max-w-md mx-auto my-8 space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <InstitutionalLogo
                variant="lockup"
                size="lg"
                subtitle="شبکه هم‌افزایی نایسر سنندج"
              />
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                مؤسسات همکار:
              </span>
              <PartnerLogosPair size="sm" showLabels fullNames={false} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              ورود به سامانه
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              جهت دسترسی به کارتابل مدیریت مورد، استعلام هش‌شده کدملی و ثبت ارزیابی مددجویان، نام
              کاربری و رمز عبور خود را وارد نمایید.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                نام کاربری
              </label>
              <div className="relative">
                <User
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  id="login-username"
                  type="text"
                  dir="ltr"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="darolahsan"
                  className="w-full pr-10 pl-3.5 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white dark:focus:bg-slate-900 transition-colors text-left"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                رمز عبور
              </label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full pr-10 pl-10 py-2.5 text-sm font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white dark:focus:bg-slate-900 transition-colors text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'مخفی کردن رمز عبور' : 'نمایش رمز عبور'}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-teal-700 rounded"
              />
              <span>حفظ نشست کاربری در این مرورگر</span>
            </label>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/70 text-xs sm:text-sm text-red-800 dark:text-red-300 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {submitting ? 'در حال بررسی اعتبار حساب...' : 'ورود به سامانه'}
            </button>
          </form>

          {/* Quick-Fill Pilot Credentials */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              حساب‌های آزمایشی سامانه (کلیک برای درج خودکار):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => handleQuickFill(acc.username, acc.password)}
                  className={`text-right p-2.5 rounded-xl border transition-colors ${
                    username.trim().toLowerCase() === acc.username
                      ? 'bg-teal-50 dark:bg-teal-950/50 border-teal-600 dark:border-teal-500'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {acc.institution && (
                      <InstitutionEmblem institution={acc.institution} size="xs" />
                    )}
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {acc.label}
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-teal-800 dark:text-teal-300 mt-0.5 truncate" dir="ltr">
                    {acc.username}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {acc.sublabel}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Security Note */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span>تفکیک محرمانگی داده‌ها و رمزنگاری هش یک‌طرفه SHA-256 فعال است</span>
          <span>نسخه پایلوت نایسر سنندج</span>
        </div>
      </div>

      {/* Left Column (RTL): Naysar Sanandaj Scenic Showcase */}
      <div className="lg:col-span-7 relative min-h-[280px] sm:min-h-[340px] lg:min-h-screen overflow-hidden order-1 lg:order-2 bg-slate-900">
        <img
          src={naysarSanandajImg}
          alt="چشم‌انداز منطقه نایسر و کوهستان سنندج در کردستان هنگام غروب آفتاب"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/20"
        />

        {/* Top Location Label */}
        <div className="relative z-10 p-5 sm:p-8 flex items-center justify-between">
          <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 backdrop-blur-md border border-white/15 text-xs font-medium text-white">
            ناحیه منفصل شهری نایسر · سنندج، کردستان
          </div>
        </div>

        {/* Bottom Editorial Caption */}
        <div className="relative z-10 lg:absolute lg:bottom-0 lg:inset-x-0 p-5 sm:p-8 lg:p-10 mt-16 lg:mt-0 space-y-3 text-white">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold leading-snug max-w-2xl">
            هم‌افزایی محلی برای توانمندسازی پایدار خانواده‌های نایسر با حفظ کرامت انسانی
          </h2>
          <p className="text-xs sm:text-sm text-slate-200/95 leading-relaxed max-w-xl">
            هماهنگی شفاف خدمات حمایتی، جلوگیری از هم‌پوشانی کمک‌ها و هدایت مرحله‌به‌مرحله
            خانوارها از حمایت معیشتی فوری تا خوداتکایی شغلی و عضویت در صندوق‌های خرد محلی.
          </p>
          <div className="pt-2 grid grid-cols-3 gap-3 max-w-lg text-xs border-t border-white/15">
            <div>
              <div className="font-bold text-amber-300 text-sm sm:text-base tabular-nums">۵ بلوک</div>
              <div className="text-slate-300 mt-0.5">تقسیم کار جغرافیایی</div>
            </div>
            <div>
              <div className="font-bold text-teal-300 text-sm sm:text-base tabular-nums">۶ مرحله</div>
              <div className="text-slate-300 mt-0.5">پروتکل مدیریت مورد</div>
            </div>
            <div>
              <div className="font-bold text-emerald-300 text-sm sm:text-base tabular-nums">SHA-256</div>
              <div className="text-slate-300 mt-0.5">استعلام امن بدون افشا</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
