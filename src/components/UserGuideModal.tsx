import React from 'react';
import {X, BookOpen, ShieldCheck, Search, ClipboardList, Wallet, BarChart3, LayoutDashboard} from 'lucide-react';
import {InstitutionEmblem} from './InstitutionalLogo';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({isOpen, onClose, isDark: _isDark}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-700 dark:text-teal-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                راهنمای جامع استفاده از سامانه مدیریت مورد نایسر
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                راهنمای گام‌به‌گام مددکاران، مدیران اجرایی و ناظران امنیتی (دارالاحسان و عدالت)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن راهنما"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          {/* Section 1: Introduction */}
          <div className="space-y-2 bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/50 rounded-xl p-4">
            <div className="font-bold text-teal-900 dark:text-teal-300 flex items-center gap-2">
              <InstitutionEmblem institution="darolahsan" size="xs" />
              <span>مقدمه و هدف سامانه</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              این سامانه به منظور هماهنگی یکپارچه میان مؤسسه خیریه دارالاحسان سنندج و مؤسسه خیریه عدالت و برابری کردستان در ناحیه منفصل شهری نایسر طراحی شده است. هدف اصلی، جلوگیری از موازی‌کاری، تخصیص عادلانه منابع، حفظ حریم خصوصی مددجویان با هش یک‌طرفه SHA-256 و مدیریت جریان کار ۶ مرحله‌ای است.
            </p>
          </div>

          {/* Section 2: Core Modules */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
              بخش‌های اصلی سامانه
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <LayoutDashboard className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>پیشخوان مدیریت مورد</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  نمایش شاخص‌های کلیدی، ویجت توزیع مراحل (Pie Chart)، تقویم سررسید پیگیری‌های مرحله ۵، یادداشت‌های سریع (Quick Notes) برای هر پرونده و پیش‌بینی بار کاری مددکاران (Case Overload).
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <Search className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>استعلام امن کدملی</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  بررسی پیش از پذیرش کدملی در پایگاه داده دو مؤسسه جهت جلوگیری از هم‌پوشانی و دریافت پیشنهاد هوشمند همکاری (Model Selection).
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <ClipboardList className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>ارزیابی معیشتی و پرونده جدید</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  ثبت فرم امتیازدهی ۱۰۰ امتیازی (ساختار خانوار، مسکن، معیشت، سلامت) با محاسبه خودکار درجه فوریت (قرمز، زرد، سبز).
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <Wallet className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>صندوق‌های خرد همت (SHG)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  مدیریت گروه‌های پس‌انداز محلی، اعطای وام اشتغال و نظارت بر چرخه‌های خوداتکایی و خروج موفق مددجویان.
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <BarChart3 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>گزارش‌ها و نمودارهای D3.js</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  تحلیل ۶ ماهه رشد، نمودار راداری عملکرد مددکاران در ۵ شاخص کلیدی، تحلیل زمان پاسخگویی و مدت زمان حضور در مراحل.
                </p>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                  <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>امنیت، پشتیبان‌گیری و بازیابی</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  قابلیت گرفتن فایل پشتیبان JSON از تمام اطلاعات و بارگذاری فایل پشتیبان از سیستم دیگر جهت بازیابی امن داده‌ها.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Workflow Stages */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-2">
              جریان کار ۶ مرحله‌ای مدیریت مورد
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 pr-1">
              <li><strong className="text-slate-900 dark:text-slate-100">پذیرش و ارجاع:</strong> ثبت اولیه، استعلام کدملی و تعیین مؤسسه راهبر.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">ارزیابی همه‌جانبه:</strong> بازدید میدانی، تعیین نیازهای اولویت‌دار و امتیازدهی معیشتی.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">برنامه مداخله:</strong> تعیین اهداف حمایتی، تاریخ بازنگری و توافق با مددجو.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">اجرا و خدمات:</strong> اتصال به صندوق خرد، توزیع سبد معیشتی یا کمک‌های درمانی.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">پایش مستمر:</strong> نظارت ماهانه بر پایداری درآمد و سلامت با تقویم پیگیری روزانه.</li>
              <li><strong className="text-slate-900 dark:text-slate-100">خروج موفق:</strong> خوداتکایی پایدار، صدور گواهی خروج و استمرار نظارت ۶ ماهه.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            نسخه ۱۴۰۵.۲ · سامانه جامع نایسر
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors"
          >
            متوجه شدم، بستن راهنما
          </button>
        </div>
      </div>
    </div>
  );
};
