import React, {useEffect, useMemo, useState} from 'react';
import {Award, Check, Copy, PlusCircle, Users} from 'lucide-react';
import type {ShgGroup} from '../types';
import {apiFetch} from '../utils/staticApiFallback';

interface MicrofinanceGraduationViewProps {
  groups: ShgGroup[];
  onGroupUpdated: () => Promise<void>;
}

const CHECKLIST_ITEMS = [
  {
    id: 'econ-1',
    section: 'بخش اول: شاخص‌های اقتصادی و درآمدی',
    label: 'ثبات جریان درآمد: درآمد حاصل از کسب‌وکار خانگی کفاف هزینه‌های ماهانه مسکن و خوراک را می‌دهد.',
  },
  {
    id: 'econ-2',
    section: 'بخش اول: شاخص‌های اقتصادی و درآمدی',
    label: 'استمرار فعالیت اقتصادی: کسب‌وکار راه‌اندازی‌شده همچنان دایر است و نیمه‌فعال نشده است.',
  },
  {
    id: 'econ-3',
    section: 'بخش اول: شاخص‌های اقتصادی و درآمدی',
    label: 'مدیریت بدهی‌ها و اقساط: در بازپرداخت اقساط وام صندوق خرد خوش‌حساب بوده است.',
  },
  {
    id: 'econ-4',
    section: 'بخش اول: شاخص‌های اقتصادی و درآمدی',
    label: 'حفظ پس‌انداز اضطراری: مبلغی به عنوان پس‌انداز در صندوق محلی برای روز مبادا ذخیره کرده است.',
  },
  {
    id: 'health-1',
    section: 'بخش دوم: سلامت، درمان و مسکن',
    label: 'مدیریت هزینه‌های درمان: بیماری‌های مزمن تحت پوشش بیمه و حمایت درمانی مناسب قرار دارند.',
  },
  {
    id: 'health-2',
    section: 'بخش دوم: سلامت، درمان و مسکن',
    label: 'ثبات مسکن: تغییر منفی (تخلیه اجباری یا بی‌سرپناهی) در ۶ ماه گذشته رخ نداده است.',
  },
  {
    id: 'social-1',
    section: 'بخش سوم: اجتماعی، آموزشی و کرامت خانوار',
    label: 'استمرار تحصیل فرزندان: هیچ‌یک از کودکان به دلیل مشکلات مالی ترک تحصیل نکرده است.',
  },
  {
    id: 'social-2',
    section: 'بخش سوم: اجتماعی، آموزشی و کرامت خانوار',
    label: 'افزایش اعتمادبه‌نفس و خوداتکایی: حس استقلال، عزت‌نفس و توانمندی در رفتار سرپرست مشهود است.',
  },
  {
    id: 'comm-1',
    section: 'بخش چهارم: مشارکت و پیوند با جامعه محلی',
    label: 'مشارکت در شبکه‌های همیاری: ارتباط مثبت با صندوق‌های خودیاری نایسر و انتقال تجربه به دیگران.',
  },
];

function formatToman(amount: number): string {
  return new Intl.NumberFormat('fa-IR').format(amount) + ' تومان';
}

export const MicrofinanceGraduationView: React.FC<MicrofinanceGraduationViewProps> = ({
  groups,
  onGroupUpdated,
}) => {
  const [subTab, setSubTab] = useState<'shg' | 'graduation'>('shg');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id || 'shg-1');

  // New SHG Member form
  const [memberAlias, setMemberAlias] = useState('');
  const [monthlySaving, setMonthlySaving] = useState(400000);
  const [loanAmount, setLoanAmount] = useState(10000000);
  const [businessType, setBusinessType] = useState('خدمات خیاطی و تعمیرات لباس');
  const [guarantor1, setGuarantor1] = useState('');
  const [guarantor2, setGuarantor2] = useState('');
  const [shgSubmitting, setShgSubmitting] = useState(false);
  const [shgError, setShgError] = useState<string | null>(null);
  const [shgSuccess, setShgSuccess] = useState<string | null>(null);

  // 6-Month Graduation Checklist
  const [familyAlias, setFamilyAlias] = useState('خانوار محترم خانم نرگس احمدی');
  const [checkedIds, setCheckedIds] = useState<string[]>([
    'econ-1',
    'econ-2',
    'econ-3',
    'econ-4',
    'health-1',
    'health-2',
    'social-1',
    'social-2',
    'comm-1',
  ]);
  const [copiedLetter, setCopiedLetter] = useState(false);

  useEffect(() => {
    if (groups.length > 0 && !groups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(groups[0].id);
    }
  }, [groups, selectedGroupId]);

  const activeGroup = groups.find((g) => g.id === selectedGroupId) || groups[0];

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const graduationEval = useMemo(() => {
    const count = checkedIds.length;
    if (count >= 7) {
      return {
        status: 'پایداری کامل (سبز)',
        colorClass: 'text-emerald-700 dark:text-emerald-400',
        action:
          'تثبیت وضعیت خوداتکایی، ثبت به عنوان «خانواده موفق و الگوی محلی»، صدور لوح تقدیر و دعوت به عنوان همیار افتخاری در صندوق‌های خرد نایسر.',
        letter: `${familyAlias} گرامی؛ با افتخار پایان موفقیت‌آمیز دوره توانمندسازی و ورود شما به جرگه خانواده‌های مستقل و الهام‌بخش محله نایسر را تبریک می‌گوییم. این دستاورد حاصل همت و پشتکار شماست. هرچند حمایت مستمر مصرفی به خانواده‌های در نوبت اختصاص می‌یابد، اما درهای مؤسسه دارالاحسان و عدالت و برابری برای مشاوره کسب‌وکار، اتصال به بازار فروش و بیمه پایداری همیشه به روی شما باز است و از حضور ارزشمند شما به عنوان همیار تجربه در جمع بانوان محله استقبال می‌کنیم.`,
      };
    }
    if (count >= 4) {
      return {
        status: 'پایداری شکننده (زرد)',
        colorClass: 'text-amber-700 dark:text-amber-400',
        action:
          'فعال‌سازی مشاوره‌های حمایتی مربی‌محور، اتصال مجدد به بازار فروش شهری/تعاونی و اعطای وام اضطراری کم‌بهره از طریق صندوق خودیاری خرد.',
        letter: `${familyAlias} گرامی؛ با قدردانی از تلاش مستمر شما در مسیر کسب‌وکار خانگی، کارگروه مشاوره دو مؤسسه در کنار شماست تا با اتصال به بازارچه‌های فصلی و تسهیلات صندوق خرد، ثبات درآمدی خانواده به سطح پایدار برسد.`,
      };
    }
    return {
      status: 'بازگشت به بحران (قرمز)',
      colorClass: 'text-red-700 dark:text-red-400',
      action:
        'بازگشایی موقت پرونده، بازگشت فوری به چرخه حمایت‌های اضطراری (سبد معیشتی و صندوق درمان) تا زمان تثبیت مجدد شرایط.',
      letter: `${familyAlias} گرامی؛ با توجه به شرایط پیش‌آمده، پرونده حمایتی شما مجدداً فعال گردید تا بدون دغدغه معیشتی و درمانی، آرامش به خانواده بازگردد.`,
    };
  }, [checkedIds.length, familyAlias]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    setShgError(null);
    setShgSuccess(null);
    setShgSubmitting(true);
    try {
      const sanitizedSaving = Math.max(100000, Number(monthlySaving) || 100000);
      const sanitizedLoan = Math.max(0, Number(loanAmount) || 0);
      const res = await apiFetch(`/api/shg/${activeGroup.id}/members`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          memberAlias,
          monthlySaving: sanitizedSaving,
          loanAmount: sanitizedLoan,
          businessType,
          guarantor1,
          guarantor2,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setShgError(data.error || 'خطا در ثبت عضو صندوق.');
        return;
      }
      setShgSuccess(
        `عضو «${memberAlias}» در دفترچه ${activeGroup.name} ثبت و سرمایه اهرمی صندوق بروزرسانی شد.`,
      );
      setMemberAlias('');
      setGuarantor1('');
      setGuarantor2('');
      await onGroupUpdated();
    } catch {
      setShgError('خطا در ارتباط با سرور.');
    } finally {
      setShgSubmitting(false);
    }
  };

  const handleCopyLetter = async () => {
    try {
      await navigator.clipboard.writeText(graduationEval.letter);
      setCopiedLetter(true);
      setTimeout(() => setCopiedLetter(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            صندوق‌های خودیاری خرد و پایش خروج موفق (Graduation Model)
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
            حرکت از حمایت معیشتی صرف به سمت خوداتکایی پایدار از طریق گروه‌های ۵ تا ۱۰ نفره بانوان،
            سرمایه اهرمی خیریه، ضمانت اجتماعی و ارزیابی محترمانه ۶ ماهه پس از خروج.
          </p>
        </div>

        {/* Segmented Sub-View Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg self-start shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('shg')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'shg'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            صندوق‌های خودیاری خرد بانوان
          </button>
          <button
            type="button"
            onClick={() => setSubTab('graduation')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'graduation'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            چک‌لیست ۶ ماهه و جشن خوداتکایی
          </button>
        </div>
      </div>

      {subTab === 'shg' && activeGroup && (
        <div className="space-y-6">
          {/* Group Selector & Capital Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {groups.map((grp) => {
              const selected = grp.id === activeGroup.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setSelectedGroupId(grp.id)}
                  className={`text-right p-5 rounded-xl border transition-colors ${
                    selected
                      ? 'bg-white dark:bg-slate-900 border-teal-700 dark:border-teal-500 ring-1 ring-teal-700 dark:ring-teal-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{grp.blockName}</span>
                    <span className="font-mono">نسبت اهرمی {grp.matchingRatio}</span>
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {grp.name}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{grp.meetingDay}</div>
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs tabular-nums">
                    <span className="text-slate-500 dark:text-slate-400">مجموع سرمایه صندوق:</span>
                    <span className="font-bold text-teal-800 dark:text-teal-400">
                      {formatToman(grp.membersTotalSavings + grp.charityMatchingFund)}
                    </span>
                  </div>
                </button>
              );
            })}

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Users className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                ساختار سرمایه اهرمی (Matching Funds)
              </div>
              <div className="space-y-2 text-xs mt-3 tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">پس‌انداز تجمیع‌شده اعضا:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {formatToman(activeGroup.membersTotalSavings)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    تزریق بلاعوض اهرمی خیریه ({activeGroup.matchingRatio}):
                  </span>
                  <span className="font-semibold text-teal-700 dark:text-teal-400">
                    {formatToman(activeGroup.charityMatchingFund)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">ضمانت وام:</span>
                  <span className="text-slate-800 dark:text-slate-200">ضمانت اجتماعی ۲ عضو معتبر</span>
                </div>
              </div>
            </div>
          </div>

          {/* Member Ledger Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  کاربرگ ثبت صندوق خرد و پس‌انداز ماهیانه · {activeGroup.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  کارمزد حداکثر ۴٪ سالیانه صرفاً جهت حفظ ارزش پول در برابر تورم · نظارت مربی‌محور
                </p>
              </div>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400 tabular-nums">
                تعداد اعضا: {activeGroup.members.length} نفر
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 whitespace-nowrap">نام عضو / نقش</th>
                    <th className="py-3 px-4 whitespace-nowrap">کسب‌وکار خرد خانگی</th>
                    <th className="py-3 px-4 whitespace-nowrap">پس‌انداز ماهیانه</th>
                    <th className="py-3 px-4 whitespace-nowrap">پس‌انداز کل</th>
                    <th className="py-3 px-4 whitespace-nowrap">وام دریافتی / بازپرداخت</th>
                    <th className="py-3 px-4 whitespace-nowrap">ضمانت اجتماعی (۲ عضو)</th>
                    <th className="py-3 px-4 whitespace-nowrap">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {activeGroup.members.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{m.memberAlias}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{m.roleInGroup}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700 dark:text-slate-300">{m.businessType}</td>
                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatToman(m.monthlySaving)}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatToman(m.totalSaved)}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums whitespace-nowrap">
                        <div className="text-slate-900 dark:text-slate-100">{formatToman(m.activeLoanAmount)}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          بازپرداخت: {formatToman(m.repaidAmount)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {m.guarantors[0]} · {m.guarantors[1]}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium whitespace-nowrap">
                        <span
                          className={
                            m.repaymentStatus === 'خوش‌حساب'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : m.repaymentStatus === 'نیاز به مشاوره'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-slate-700 dark:text-slate-300'
                          }
                        >
                          {m.repaymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add New SHG Member & Loan Form */}
            <form
              onSubmit={handleAddMember}
              className="p-6 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <PlusCircle className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                ثبت عضو جدید یا اعطای وام کسب‌وکار خانگی در {activeGroup.name}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={memberAlias}
                  onChange={(e) => setMemberAlias(e.target.value)}
                  placeholder="نام عضو (مثال: خانم ر. مرادی)"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="نوع کسب‌وکار خرد"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg"
                />
                <input
                  type="number"
                  min={100000}
                  step={50000}
                  value={monthlySaving}
                  onChange={(e) => setMonthlySaving(Math.max(100000, Number(e.target.value) || 100000))}
                  placeholder="پس‌انداز ماهانه (تومان)"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-mono tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  step={500000}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="مبلغ وام قرض‌الحسنه"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg font-mono tabular-nums"
                />
                <input
                  type="text"
                  required
                  value={guarantor1}
                  onChange={(e) => setGuarantor1(e.target.value)}
                  placeholder="ضامن اول (از اعضای گروه)"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg"
                />
                <input
                  type="text"
                  required
                  value={guarantor2}
                  onChange={(e) => setGuarantor2(e.target.value)}
                  placeholder="ضامن دوم (از اعضای گروه)"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg"
                />
              </div>

              {shgError && (
                <div className="text-xs text-red-700 dark:text-red-400">{shgError}</div>
              )}

              {shgSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300">
                  {shgSuccess}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={shgSubmitting}
                  className="px-4 py-2 text-xs font-medium bg-teal-700 hover:bg-teal-800 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {shgSubmitting ? 'در حال ثبت...' : 'ثبت در دفترچه صندوق و محاسبه سرمایه اهرمی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {subTab === 'graduation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 6-Month Stability Checklist */}
          <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  چک‌لیست ارزیابی پایداری ۶ ماهه پس از خروج (رصد غیرمداخله‌گرایانه)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  این چک‌لیست نه به شکل بازرسی، بلکه در قالب گفتگوی مشاوره‌ای صمیمانه یا از طریق
                  همیاران صندوق خرد تکمیل می‌شود.
                </p>
              </div>
              <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                {checkedIds.length} / {CHECKLIST_ITEMS.length} شاخص
              </span>
            </div>

            <div className="space-y-2.5">
              {CHECKLIST_ITEMS.map((item) => {
                const checked = checkedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCheck(item.id)}
                      className="mt-1 rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
                    />
                    <div className="text-sm">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {item.section}
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 mt-0.5">{item.label}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Decision & Dignified Graduation Certificate / Script */}
          <aside className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                <Award className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                نتیجه تصمیم‌گیری ۶ ماهه
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">وضعیت ارزیابی خانوار</div>
                <div className={`text-lg font-bold mt-0.5 ${graduationEval.colorClass}`}>
                  {graduationEval.status}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  اقدام مقتضی از سوی خیریه
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                  {graduationEval.action}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
              <div>
                <label
                  htmlFor="family-alias-input"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
                >
                  نام سرپرست خانوار برای درج در لوح و پیام تکریم
                </label>
                <input
                  id="family-alias-input"
                  type="text"
                  value={familyAlias}
                  onChange={(e) => setFamilyAlias(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg"
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    متن لوح و اطلاع‌رسانی «جشن خوداتکایی» (بدون واژگان گزنده)
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLetter}
                    className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 inline-flex items-center gap-1"
                  >
                    {copiedLetter ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        کپی شد
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        کپی متن
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {graduationEval.letter}
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
