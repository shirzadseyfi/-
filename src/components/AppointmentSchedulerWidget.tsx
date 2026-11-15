import React, {useState, useEffect, useMemo} from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  MapPin,
  Bell,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Search,
  Download,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import {sendDesktopNotification, requestDesktopNotificationPermission, getDesktopNotificationPermission} from '../utils/desktopNotifications';
import type {CaseRecordView, InstitutionId, UiThemeAccent} from '../types';

interface AppointmentSchedulerWidgetProps {
  cases: CaseRecordView[];
  activeInstitution: InstitutionId | 'all';
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onExportToast?: (title: string, description: string) => void;
  onInspectCase?: (item: CaseRecordView) => void;
}

export interface AppointmentItem {
  id: string;
  caseId: string;
  beneficiaryName: string;
  blockName: string;
  institution: InstitutionId;
  date: string; // YYYY/MM/DD
  time: string; // HH:MM
  meetingType: 'office_visit' | 'home_visit' | 'microfinance' | 'counseling';
  caseWorkerName: string;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  reminderSent: boolean;
  createdAt: string;
}

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

const MEETING_TYPE_LABELS: Record<AppointmentItem['meetingType'], string> = {
  office_visit: 'ملاقات حضوری در دفتر مرکزی',
  home_visit: 'بازدید میدانی از منزل مددجو',
  microfinance: 'مشاوره وام و خوداشتغالی',
  counseling: 'مشاوره حقوقی و مددکاری اجتماعی',
};

const ACCENT_COLORS: Record<UiThemeAccent, string> = {
  teal: '#0f766e',
  blue: '#1d4ed8',
  emerald: '#047857',
  amber: '#b45309',
  violet: '#6d28d9',
};

export const AppointmentSchedulerWidget: React.FC<AppointmentSchedulerWidgetProps> = ({
  cases = [],
  activeInstitution = 'all',
  isDark = false,
  themeAccent = 'teal',
  onExportToast,
  onInspectCase,
}) => {
  const primaryColor = ACCENT_COLORS[themeAccent] || '#0f766e';
  const [notificationPermission, setNotificationPermission] = useState<string>(() =>
    getDesktopNotificationPermission()
  );

  const [appointments, setAppointments] = useState<AppointmentItem[]>(() => {
    try {
      const saved = localStorage.getItem('naysar_appointments_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as AppointmentItem[];
      }
    } catch {}
    return [
      {
        id: 'apt-101',
        caseId: 'NY-1405-101',
        beneficiaryName: 'فاطمه احمدی',
        blockName: 'نایسر - بلوک بهاران',
        institution: 'darolahsan',
        date: '1405/08/28',
        time: '10:30',
        meetingType: 'office_visit',
        caseWorkerName: 'سهیلا محمدی',
        notes: 'بررسی مدارک ضامن وام خوداشتغالی و تحویل فاکتور خرید تجهیزات خیاطی.',
        status: 'scheduled',
        reminderSent: false,
        createdAt: '۱۴۰۵/۰۸/۲۴',
      },
      {
        id: 'apt-102',
        caseId: 'NY-1405-102',
        beneficiaryName: 'محمد کریمی',
        blockName: 'نایسر - شهرک قبا',
        institution: 'edalat',
        date: '1405/08/29',
        time: '15:00',
        meetingType: 'home_visit',
        caseWorkerName: 'کیوان فاتحی',
        notes: 'بازدید میدانی از وضعیت مسکن خانوار و پایش پیشرفت کارگاه خانگی.',
        status: 'scheduled',
        reminderSent: true,
        createdAt: '۱۴۰۵/۰۸/۲۳',
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('naysar_appointments_list', JSON.stringify(appointments));
    } catch {}
  }, [appointments]);

  // Form state for new appointment
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>('1405/08/30');
  const [appointmentTime, setAppointmentTime] = useState<string>('11:00');
  const [meetingType, setMeetingType] = useState<AppointmentItem['meetingType']>('office_visit');
  const [caseWorkerName, setCaseWorkerName] = useState<string>('سهیلا محمدی (مددکار ارشد)');
  const [appointmentNotes, setAppointmentNotes] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('scheduled');

  const eligibleCases = useMemo(() => {
    return cases.filter((c) => !c.isMasked && c.stage < 6);
  }, [cases]);

  const handleRequestPermission = async () => {
    const res = await requestDesktopNotificationPermission();
    setNotificationPermission(res);
    if (res === 'granted') {
      onExportToast?.('مجوز اعلان‌ها تایید شد', 'اعلان‌های یادآوری قرارهای ملاقات فعال شدند.');
      sendDesktopNotification({
        title: 'سامانه مدیریت نایسر',
        body: 'سیستم اعلان‌های دسکتاپ قرارهای ملاقات با موفقیت فعال شد.',
        enabled: true,
      });
    } else {
      onExportToast?.('عدم دسترسی به اعلان‌ها', 'لطفاً مجوز اعلان را در تنظیمات مرورگر فعال کنید.');
    }
  };

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    const targetCase = cases.find((c) => c.id === selectedCaseId);
    if (!targetCase) {
      onExportToast?.('خطا در ثبت قرار ملاقات', 'لطفاً یک پرونده مددجو را انتخاب کنید.');
      return;
    }

    const newApt: AppointmentItem = {
      id: `apt-${Date.now()}`,
      caseId: targetCase.id,
      beneficiaryName: targetCase.fullName || 'مددجوی محترم',
      blockName: targetCase.blockName,
      institution: targetCase.owningInstitution,
      date: appointmentDate,
      time: appointmentTime,
      meetingType,
      caseWorkerName,
      notes: appointmentNotes.trim() || 'قرار ملاقات حضوری جهت بررسی پرونده و پیگیری خدمات معیشتی.',
      status: 'scheduled',
      reminderSent: false,
      createdAt: 'امروز',
    };

    setAppointments((prev) => [newApt, ...prev]);
    setSelectedCaseId('');
    setAppointmentNotes('');
    onExportToast?.('قرار ملاقات ثبت شد', `ملاقات حضوری برای پرونده ${targetCase.id} با موفقیت در تقویم ثبت شد.`);

    // Send desktop reminder notification immediately if permitted
    sendDesktopNotification({
      title: `قرار ملاقات جدید: ${targetCase.fullName}`,
      body: `ملاقات ${MEETING_TYPE_LABELS[meetingType]} در تاریخ ${appointmentDate} ساعت ${appointmentTime} ثبت شد.`,
      enabled: true,
      critical: true,
    });
  };

  const handleSendReminder = (apt: AppointmentItem) => {
    const success = sendDesktopNotification({
      title: `یادآوری قرار ملاقات حضوری (${apt.beneficiaryName})`,
      body: `زمان قرار: ${apt.date} ساعت ${apt.time} - نوع: ${MEETING_TYPE_LABELS[apt.meetingType]} - محل: ${apt.blockName}`,
      enabled: true,
      critical: true,
    });

    if (success) {
      setAppointments((prev) =>
        prev.map((a) => (a.id === apt.id ? {...a, reminderSent: true} : a))
      );
      onExportToast?.('یادآوری ارسال شد', `اعلان دسکتاپ برای قرار ملاقات ${apt.beneficiaryName} با موفقیت ارسال گردید.`);
    } else {
      onExportToast?.('خطا در ارسال اعلان', 'لطفاً ابتدا مجوز اعلان دسکتاپ مرورگر را فعال کنید.');
    }
  };

  const handleUpdateStatus = (aptId: string, status: AppointmentItem['status']) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === aptId ? {...a, status} : a))
    );
    onExportToast?.('وضعیت بروزرسانی شد', 'وضعیت قرار ملاقات با موفقیت تغییر یافت.');
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      if (filterStatus !== 'all' && apt.status !== filterStatus) return false;
      if (activeInstitution !== 'all' && apt.institution !== activeInstitution) return false;
      return true;
    });
  }, [appointments, filterStatus, activeInstitution]);

  return (
    <section
      aria-label="ماژول زمان‌بندی قرارهای ملاقات حضوری"
      className={`border rounded-2xl p-6 shadow-sm transition-all ${
        isDark ? 'bg-slate-900/90 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl text-white shadow-xs" style={{backgroundColor: primaryColor}}>
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              زمان‌بندی قرارهای ملاقات حضوری مددکاران با مددجویان
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-semibold border border-teal-500/20">
                یکپارچه با تقویم سامانه
              </span>
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ثبت، مدیریت و ارسال اعلان‌های یادآوری خودکار برای بازدیدهای میدانی و ملاقات‌های دفتر مرکزی نایسر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {notificationPermission !== 'granted' ? (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
            >
              <Bell className="w-3.5 h-3.5" />
              فعال‌سازی اعلان دسکتاپ
            </button>
          ) : (
            <span className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 tabular-nums">
              <CheckCircle2 className="w-3.5 h-3.5" />
              اعلان‌های دسکتاپ فعال است
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
        {/* Left: New Appointment Form */}
        <div className={`lg:col-span-5 p-5 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/80' : 'bg-slate-50 border-slate-200'}`}>
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-teal-600" />
            ثبت قرار ملاقات جدید
          </h3>

          <form onSubmit={handleCreateAppointment} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                انتخاب پرونده مددجو <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="">-- انتخاب مددجو از فهرست پرونده‌های فعال --</option>
                {eligibleCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} - {c.fullName} ({c.blockName})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  تاریخ قرار (شمسی) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  placeholder="1405/08/30"
                  required
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600 tabular-nums text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  ساعت ملاقات <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  placeholder="10:30"
                  required
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600 tabular-nums text-right"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                نوع ملاقات حضوری
              </label>
              <select
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value as AppointmentItem['meetingType'])}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              >
                <option value="office_visit">ملاقات حضوری در دفتر مرکزی</option>
                <option value="home_visit">بازدید میدانی از منزل مددجو</option>
                <option value="microfinance">مشاوره وام و خوداشتغالی</option>
                <option value="counseling">مشاوره حقوقی و مددکاری اجتماعی</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                مددکار مسئول پیگیری
              </label>
              <input
                type="text"
                value={caseWorkerName}
                onChange={(e) => setCaseWorkerName(e.target.value)}
                placeholder="نام مددکار..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                توضیحات و محورهای جلسه
              </label>
              <textarea
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                rows={2}
                placeholder="یادداشت‌های محرمانه یا دستور کار جلسه..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 transition-colors shadow-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              ثبت و تنظیم قرار ملاقات
            </button>
          </form>
        </div>

        {/* Right: Appointments List & Management */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">فهرست قرارهای ملاقات ثبت‌شده</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold tabular-nums">
                {toPersianNum(filteredAppointments.length)} مورد
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus('scheduled')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterStatus === 'scheduled'
                    ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                برنامه‌ریزی‌شده
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('completed')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterStatus === 'completed'
                    ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                انجام‌شده
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('all')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                همه
              </button>
            </div>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-2 bg-slate-50/40 dark:bg-slate-800/20">
              <Calendar className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                هیچ قرار ملاقاتی با این وضعیت ثبت نشده است.
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                از فرم سمت راست برای ثبت قرار ملاقات جدید با مددجویان استفاده کنید.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
              {filteredAppointments.map((apt) => {
                const targetCaseObj = cases.find((c) => c.id === apt.caseId);
                return (
                  <div
                    key={apt.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      apt.status === 'completed'
                        ? 'bg-emerald-50/30 dark:bg-emerald-950/15 border-emerald-200/80 dark:border-emerald-900/40 opacity-85'
                        : apt.status === 'cancelled'
                          ? 'bg-slate-100/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60 line-through'
                          : isDark
                            ? 'bg-slate-800/60 border-slate-700'
                            : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-700/70">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                          {MEETING_TYPE_LABELS[apt.meetingType]}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                          {apt.caseId}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        <span>تاریخ: {apt.date}</span>
                        <span>ساعت: {apt.time}</span>
                      </div>
                    </div>

                    <div className="py-3 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-teal-600" />
                          {apt.beneficiaryName}
                        </h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {apt.blockName}
                        </span>
                      </div>

                      <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                        {apt.notes}
                      </p>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                        <span>مددکار مسئول: <strong className="text-slate-700 dark:text-slate-200">{apt.caseWorkerName}</strong></span>
                        <span className="tabular-nums">ثبت: {apt.createdAt}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSendReminder(apt)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-1 transition-colors ${
                            apt.reminderSent
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                        >
                          <Bell className="w-3.5 h-3.5" />
                          {apt.reminderSent ? 'یادآوری ارسال شد' : 'ارسال یادآوری فوری'}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {targetCaseObj && onInspectCase && (
                          <button
                            type="button"
                            onClick={() => onInspectCase(targetCaseObj)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            مشاهده پرونده
                          </button>
                        )}

                        {apt.status === 'scheduled' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(apt.id, 'completed')}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              انجام شد
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                              لغو
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
