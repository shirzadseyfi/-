import React from 'react';

export const INSTITUTION_LOGOS: Record<
  'darolahsan' | 'edalat',
  {src: string; name: string; shortName: string}
> = {
  darolahsan: {
    src: '/assets/aistudio/___________4007e337.png',
    name: 'مؤسسه خیریه دارالاحسان سنندج',
    shortName: 'دارالاحسان',
  },
  edalat: {
    src: '/assets/aistudio/______a705b070.jpg',
    name: 'مؤسسه خیریه عدالت و برابری کردستان',
    shortName: 'عدالت و برابری',
  },
};

interface InstitutionEmblemProps {
  institution: 'darolahsan' | 'edalat';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  fullName?: boolean;
  tone?: 'theme' | 'print';
}

const EMBLEM_SIZES = {
  xs: {box: 'w-5 h-5 rounded-md p-[1px]', label: 'text-xs'},
  sm: {box: 'w-7 h-7 rounded-lg p-0.5', label: 'text-xs'},
  md: {box: 'w-9 h-9 rounded-lg p-0.5', label: 'text-xs sm:text-sm'},
  lg: {box: 'w-12 h-12 rounded-xl p-1', label: 'text-sm'},
};

export const InstitutionEmblem: React.FC<InstitutionEmblemProps> = ({
  institution,
  size = 'sm',
  showLabel = false,
  fullName = false,
  tone = 'theme',
}) => {
  const info = INSTITUTION_LOGOS[institution];
  const s = EMBLEM_SIZES[size];
  const frameClass =
    tone === 'print'
      ? 'bg-white border border-slate-300'
      : 'bg-white border border-slate-200 dark:border-slate-700 shadow-2xs';
  const textClass =
    tone === 'print'
      ? 'text-slate-800'
      : 'text-slate-700 dark:text-slate-200';

  const imgBox = (
    <span
      className={`${s.box} ${frameClass} inline-flex items-center justify-center shrink-0 overflow-hidden`}
    >
      <img
        src={info.src}
        alt={`لوگوی ${info.name}`}
        className="w-full h-full object-contain"
        loading="lazy"
      />
    </span>
  );

  if (!showLabel) {
    return imgBox;
  }

  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {imgBox}
      <span className={`${s.label} font-semibold truncate ${textClass}`}>
        {fullName ? info.name : info.shortName}
      </span>
    </span>
  );
};

interface PartnerLogosPairProps {
  size?: 'xs' | 'sm' | 'md';
  showLabels?: boolean;
  fullNames?: boolean;
  tone?: 'theme' | 'print';
}

export const PartnerLogosPair: React.FC<PartnerLogosPairProps> = ({
  size = 'sm',
  showLabels = true,
  fullNames = false,
  tone = 'theme',
}) => {
  const dividerClass =
    tone === 'print' ? 'bg-slate-300' : 'bg-slate-200 dark:bg-slate-700';

  return (
    <div className="inline-flex flex-wrap items-center gap-2.5">
      <InstitutionEmblem
        institution="darolahsan"
        size={size}
        showLabel={showLabels}
        fullName={fullNames}
        tone={tone}
      />
      <span aria-hidden="true" className={`w-px h-5 ${dividerClass}`} />
      <InstitutionEmblem
        institution="edalat"
        size={size}
        showLabel={showLabels}
        fullName={fullNames}
        tone={tone}
      />
    </div>
  );
};

interface InstitutionalLogoProps {
  variant?: 'mark' | 'lockup';
  size?: 'sm' | 'md' | 'lg';
  tone?: 'theme' | 'print';
  subtitle?: string;
}

const SIZE_MAP = {
  sm: {box: 'w-8 h-8', svg: 32, title: 'text-sm', sub: 'text-[10px]'},
  md: {box: 'w-9 h-9', svg: 36, title: 'text-base', sub: 'text-[11px]'},
  lg: {box: 'w-11 h-11', svg: 44, title: 'text-lg', sub: 'text-xs'},
};

/**
 * لوگوی استاندارد شبکه هم‌افزایی و مدیریت مورد نایسر سنندج
 * نماد هندسی دو قوس هم‌افزای مؤسسات همکار بر فراز خط کوهستان و سرپناه پایدار خانوار
 */
export const InstitutionalLogo: React.FC<InstitutionalLogoProps> = ({
  variant = 'lockup',
  size = 'md',
  tone = 'theme',
  subtitle = 'شبکه حمایتی نایسر سنندج',
}) => {
  const s = SIZE_MAP[size];

  const markContainerClass =
    tone === 'print'
      ? 'bg-teal-800 text-white border border-teal-900'
      : 'bg-teal-700 dark:bg-teal-600 text-white shadow-xs';

  const titleClass =
    tone === 'print'
      ? 'text-slate-900'
      : 'text-slate-900 dark:text-slate-100';

  const subClass =
    tone === 'print'
      ? 'text-slate-600'
      : 'text-slate-500 dark:text-slate-400';

  const mark = (
    <span
      aria-hidden="true"
      className={`${s.box} rounded-xl inline-flex items-center justify-center shrink-0 ${markContainerClass}`}
    >
      <svg
        width={s.svg * 0.68}
        height={s.svg * 0.68}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* افق کوهستان سنندج و پایه استوار */}
        <path
          d="M4.5 24.5H27.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        {/* قوس هم‌افزایی دو مؤسسه (هم‌گرایی از دو سو) */}
        <path
          d="M7 24.5V16.2C7 11.4 10.9 7.6 16 7.6C21.1 7.6 25 11.4 25 16.2V24.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* تاج سرپناه و ستون میانی کرامت خانوار */}
        <path
          d="M11.2 24.5V16.8L16 12.6L20.8 16.8V24.5"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* نقطه کانونی پایداری و همبستگی */}
        <circle cx="16" cy="18.6" r="1.7" fill="currentColor" />
      </svg>
    </span>
  );

  if (variant === 'mark') {
    return mark;
  }

  return (
    <div className="inline-flex items-center gap-2.5 min-w-0">
      {mark}
      <div className="min-w-0 leading-tight text-right">
        <div className={`${s.title} font-bold tracking-tight truncate ${titleClass}`}>
          هم‌افزایی نایسر
        </div>
        {subtitle && (
          <div className={`${s.sub} font-medium truncate mt-0.5 ${subClass}`}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
