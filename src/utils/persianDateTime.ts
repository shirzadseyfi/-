export interface PersianDateTimeParts {
  date: string; // e.g. ۱۴۰۵/۰۸/۲۴
  time: string; // e.g. ۱۴:۳۲:۱۸
  shortTime: string; // e.g. ۱۴:۳۲
  weekday: string; // e.g. جمعه
  fullDateLabel: string; // e.g. جمعه ۲۴ آبان ۱۴۰۵
  timestamp: string; // e.g. ۱۴۰۵/۰۸/۲۴ · ۱۴:۳۲
}

export function toEnglishDigits(input: string): string {
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return input
    .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
}

export function toPersianDigits(input: string | number): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/\d/g, (d) => persianDigits[Number(d)] ?? d);
}

export function getPersianDateTimeParts(dateObj: Date = new Date()): PersianDateTimeParts {
  const timeZone = 'Asia/Tehran';

  const date = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj);

  const time = new Intl.DateTimeFormat('fa-IR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(dateObj);

  const shortTime = new Intl.DateTimeFormat('fa-IR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dateObj);

  const weekday = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone,
    weekday: 'long',
  }).format(dateObj);

  const fullDateLabel = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);

  return {
    date,
    time,
    shortTime,
    weekday,
    fullDateLabel,
    timestamp: `${date} · ${shortTime}`,
  };
}

export function normalizeVisitDateInput(value: string): string {
  const eng = toEnglishDigits(value).trim();
  const match = eng.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return value.trim();
  const [, y, m, d] = match;
  return toPersianDigits(`${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`);
}

export function normalizeVisitTimeInput(value: string): string {
  const eng = toEnglishDigits(value).trim();
  const match = eng.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return value.trim();
  const hh = Math.min(23, Math.max(0, Number(match[1])));
  const mm = Math.min(59, Math.max(0, Number(match[2])));
  return toPersianDigits(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
}
