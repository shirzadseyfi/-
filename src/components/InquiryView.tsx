import React, {useEffect, useState} from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type {
  CollaborationModel,
  InquiryResponse,
  InstitutionId,
  NaysarBlock,
  UserRole,
} from '../types';
import {apiFetch} from '../utils/staticApiFallback';

interface InquiryViewProps {
  blocks: NaysarBlock[];
  activeInstitution: InstitutionId;
  activeRole: UserRole;
  onStartNewCaseWithId: (nationalId: string, blockId: string) => void;
  onEditExistingCase: (caseId: string) => void;
  onResolveOverlap: (caseId: string, model: CollaborationModel) => Promise<void>;
  onOverlapDetected?: (matchedCaseId: string, owningInstitutionName: string, blockName: string) => void;
}

const SAMPLE_IDS = [
  {
    id: '0012345678',
    label: 'نمونه تطبیق (ثبت در عدالت و برابری)',
  },
  {
    id: '3732104589',
    label: 'نمونه تطبیق (ثبت در دارالاحسان)',
  },
  {
    id: '3730998877',
    label: 'نمونه ثبت‌نام پاک (جدید)',
  },
];

export const InquiryView: React.FC<InquiryViewProps> = ({
  blocks,
  activeInstitution,
  activeRole,
  onStartNewCaseWithId,
  onEditExistingCase,
  onResolveOverlap,
  onOverlapDetected,
}) => {
  const [nationalId, setNationalId] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState(blocks[0]?.id || 'blk-1');
  const [needsMedicalSpecial, setNeedsMedicalSpecial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InquiryResponse | null>(null);
  const [resolvedMessage, setResolvedMessage] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  useEffect(() => {
    setResult(null);
    setResolvedMessage(null);
    setError(null);
  }, [activeInstitution]);

  useEffect(() => {
    if (blocks.length > 0 && !blocks.some((b) => b.id === selectedBlockId)) {
      setSelectedBlockId(blocks[0].id);
    }
  }, [blocks, selectedBlockId]);

  const runInquiry = async (targetId?: string) => {
    const idToQuery = targetId ?? nationalId;
    setError(null);
    setResolvedMessage(null);
    setLoading(true);
    try {
      const res = await apiFetch('/api/inquiry', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          nationalId: idToQuery,
          institution: activeInstitution,
          role: activeRole,
          blockId: selectedBlockId,
          needsMedicalSpecial,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'خطا در استعلام کدملی.');
        setResult(null);
        return;
      }
      const parsed = data as InquiryResponse;
      setResult(parsed);
      if (parsed.status === 'MATCH_PARTNER' && parsed.matchedRecord) {
        onOverlapDetected?.(
          parsed.matchedRecord.caseId,
          parsed.matchedRecord.owningInstitutionName,
          parsed.matchedRecord.blockName,
        );
      }
    } catch {
      setError('ارتباط با سرور استعلام برقرار نشد.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runInquiry();
  };

  const handleConfirmResolution = async (model: CollaborationModel) => {
    if (!result?.matchedRecord) return;
    await onResolveOverlap(result.matchedRecord.caseId, model);
    setResolvedMessage(
      model === 'complementary_support'
        ? 'مدل «پوشش ترکیبی و تکمیلی» در کارنامه مشترک ثبت و لاگ امنیتی صادر شد.'
        : 'مدل «واگذاری کامل به مؤسسه مسئول» ثبت شد و ثبت‌نام موازی متوقف گردید.',
    );
  };

  const handleCopyScript = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch {
      // Clipboard fallback omitted cleanly
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          استعلام امن کدملی و پروتکل تعیین مؤسسه مسئول
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          بررسی هم‌پوشانی پیش از پذیرش نهایی با الگوریتم هش یک‌طرفه{' '}
          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded">
            SHA-256 + Salt
          </span>{' '}
          در سمت سرور؛ هیچ‌یک از جزئیات هویتی و زندگی مددجو میان مؤسسات فاش نمی‌شود.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Inquiry Form */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              فرم استعلام لحظه‌ای مددجو
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              مؤسسه استعلام‌کننده:{' '}
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {activeInstitution === 'darolahsan'
                  ? 'دارالاحسان سنندج'
                  : 'عدالت و برابری کردستان'}
              </span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="national-id-input" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                شماره ملی سرپرست خانوار (۱۰ رقم)
              </label>
              <input
                id="national-id-input"
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                placeholder="مثال: 0012345678"
                className="w-full px-3.5 py-2.5 text-base font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white dark:focus:bg-slate-900"
              />
            </div>

            <div>
              <label htmlFor="block-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                بلوک جغرافیایی محل سکونت در نایسر
              </label>
              <select
                id="block-select"
                value={selectedBlockId}
                onChange={(e) => setSelectedBlockId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 focus:bg-white dark:focus:bg-slate-900"
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={needsMedicalSpecial}
                onChange={(e) => setNeedsMedicalSpecial(e.target.checked)}
                className="mt-1 rounded border-slate-300 dark:border-slate-600 text-teal-700 focus:ring-teal-600"
              />
              <span>
                پرونده دارای نیاز تخصصی درمانی / بیماری صعب‌العلاج است (بررسی مدل پوشش ترکیبی)
              </span>
            </label>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Search className="w-4 h-4" />
              {loading ? 'در حال محاسبه هش و استعلام...' : 'اجرای استعلام امن'}
            </button>
          </form>

          {/* Quick Sample Presets */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              آزمایش سریع با کدملی‌های نمونه:
            </div>
            <div className="flex flex-col gap-1.5">
              {SAMPLE_IDS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => {
                    setNationalId(sample.id);
                    runInquiry(sample.id);
                  }}
                  className="text-right px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2 transition-colors"
                >
                  <span>{sample.label}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">{sample.id}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Result & Lead Agency Protocol */}
        <section className="lg:col-span-7 space-y-6">
          {!result ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 space-y-4">
              <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100 font-semibold">
                <KeyRound className="w-5 h-5 text-teal-700 dark:text-teal-400" />
                نحوه عملکرد شاخص‌گذاری کور (Blind Indexing)
              </div>
              <ol className="space-y-3 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside leading-relaxed">
                <li>
                  مددکار کدملی ۱۰ رقمی مراجعه‌کننده را پس از اخذ رضایت شفاهی یا کتبی در فرم وارد
                  می‌کند.
                </li>
                <li>
                  سرور سامانه، کدملی را با کلید مخفی مشترک (<span className="font-mono">Salt</span>)
                  ترکیب کرده و به کد یک‌طرفه ۶۴ کاراکتری <span className="font-mono">SHA-256</span>{' '}
                  تبدیل می‌نماید.
                </li>
                <li>
                  فقط کد هش‌شده در جدول مشترک استعلام بررسی می‌شود تا در صورت عدم تطابق، اجازه
                  تشکیل پرونده جدید صادر شود و در صورت تطابق، پروتکل تعیین مؤسسه مسئول فعال گردد.
                </li>
              </ol>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
              {/* Outcome Banner */}
              {result.status === 'CLEAN' ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    تایید سامانه: تطابقی یافت نشد؛ ثبت‌نام جدید بلامانع است
                  </div>
                  <p className="text-sm text-emerald-900/80 dark:text-emerald-200/85 leading-relaxed">
                    این خانوار در حال حاضر تحت پوشش هیچ‌یک از دو مؤسسه نیست. می‌توانید با تکمیل فرم
                    رضایت‌نامه آگاهانه، ارزیابی معیشتی را آغاز کنید.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 dark:text-amber-400" />
                    {result.status === 'MATCH_PARTNER'
                      ? 'هشدار سامانه: این خانوار تحت پوشش مؤسسه همکار ثبت شده است'
                      : 'اطلاعیه سامانه: این کدملی پیش‌تر در همین مؤسسه ثبت شده است'}
                  </div>
                  <p className="text-sm text-amber-900/85 dark:text-amber-200/85 leading-relaxed">
                    جهت جلوگیری از هم‌پوشانی و اتلاف منابع حمایتی، ثبت‌نام موازی متوقف شد. نام و
                    جزئیات زندگی خانوار به صورت محرمانه در مؤسسه ثبت‌کننده باقی می‌ماند.
                  </p>
                </div>
              )}

              {/* Hash & Audit Proof */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    کد هش یک‌طرفه تولیدشده در سرور (SHA-256 + Secret Salt)
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    شناسه ثبت لاگ: {result.auditLogId}
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-800 dark:text-slate-200 break-all bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 select-all">
                  {result.nationalIdHashPreview}
                </div>
              </div>

              {/* Clean Next Step */}
              {result.status === 'CLEAN' && (
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onStartNewCaseWithId(nationalId, selectedBlockId)}
                    className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    ادامه به فرم رضایت‌نامه و ارزیابی گام‌به‌گام
                  </button>
                </div>
              )}

              {/* Same Institution Match -> Direct Update Flow */}
              {result.status === 'MATCH_SAME' && result.matchedRecord && (
                <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-teal-50/70 dark:bg-teal-950/35 border border-teal-200 dark:border-teal-800/70">
                  <div className="text-xs sm:text-sm text-teal-950 dark:text-teal-200">
                    پرونده <strong>{result.matchedRecord.caseId}</strong> متعلق به همین مؤسسه است و می‌توانید
                    ارزیابی معیشتی یا مرحله آن را بروزرسانی کنید.
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditExistingCase(result.matchedRecord!.caseId)}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    بروزرسانی ارزیابی پرونده
                  </button>
                </div>
              )}

              {/* Matched Details + Lead Agency Protocol */}
              {result.matchedRecord && result.leadAgencyEvaluation && (
                <div className="space-y-5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">مؤسسه ثبت‌کننده فعلی</div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {result.matchedRecord.owningInstitutionName}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">تاریخ و نوع آخرین حمایت</div>
                      <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                        {result.matchedRecord.lastSupportType} ({result.matchedRecord.lastSupportDate})
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">بلوک ثبت‌شده و تاریخ پذیرش</div>
                      <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                        {result.matchedRecord.blockName} · {result.matchedRecord.registeredAt}
                      </div>
                    </div>
                  </div>

                  {/* Lead Agency Evaluation */}
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      پروتکل حل اختلاف و تعیین مؤسسه مسئول (Lead Agency)
                    </h3>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      مؤسسه پیشنهادی به عنوان متولی اصلی:{' '}
                      <strong className="text-teal-800 dark:text-teal-400">
                        {result.leadAgencyEvaluation.recommendedLeadName}
                      </strong>
                    </div>
                    <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400 list-disc list-inside">
                      {result.leadAgencyEvaluation.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>

                    {/* Respectful Communication Script */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          متن پیشنهادی گفتگو با مددجو (جلوگیری از احساس پاس‌کاری)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyScript(result.leadAgencyEvaluation!.clientScript)
                          }
                          className="text-xs text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 inline-flex items-center gap-1 font-medium"
                        >
                          {copiedScript ? (
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
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {result.leadAgencyEvaluation.clientScript}
                      </p>
                    </div>

                    {resolvedMessage ? (
                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-sm text-emerald-800 dark:text-emerald-300 font-medium">
                        {resolvedMessage}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleConfirmResolution('single_ownership')}
                          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                        >
                          تایید واگذاری کامل (Single Agency)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmResolution('complementary_support')}
                          className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors"
                        >
                          ثبت مدل پوشش ترکیبی و تکمیلی
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
