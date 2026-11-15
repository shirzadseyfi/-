import type {CaseRecordView} from '../types';

export interface MonthlyCsvArchiveItem {
  id: string;
  monthLabel: string;
  generatedDate: string;
  graduatedCount: number;
  csvDataContent: string;
  institutionFilter: string;
}

export function generateMonthlyGraduatedCsvArchive(params: {
  cases: CaseRecordView[];
  monthLabel: string;
  institutionFilter?: string;
}): MonthlyCsvArchiveItem {
  const {cases, monthLabel, institutionFilter = 'all'} = params;

  // Filter finalized or successfully graduated cases (Stage 6 or GRADUATED)
  const finalizedCases = cases.filter(
    (c) => c.stage === 6 || c.coverageStatus === 'GRADUATED',
  );

  let csvContent = '\uFEFF'; // UTF-8 BOM for Persian in Excel
  csvContent += `بایگانی خودکار پایان ماه - آمار پرونده‌های نهایی‌شده و خروجی‌های موفق\n`;
  csvContent += `دوره ماهیانه:, "${monthLabel}"\n`;
  csvContent += `تاریخ تولید آرشیو:, "${new Date().toLocaleDateString('fa-IR')}"\n`;
  csvContent += `محدوده مؤسسه:, "${institutionFilter === 'darolahsan' ? 'دارالاحسان' : institutionFilter === 'edalat' ? 'عدالت و برابری' : 'کل نایسر (مشترک)'}"\n\n`;

  csvContent += `شناسه پرونده,کد هش امن (SHA-256),مؤسسه متولی,بلوک جغرافیایی,امتیاز کل,مسیر مداخله,آخرین حمایت ثبت‌شده,تاریخ آخرین حمایت\n`;

  for (const c of finalizedCases) {
    if (institutionFilter !== 'all' && c.owningInstitution !== institutionFilter) {
      continue;
    }
    const maskedHash = `${c.nationalIdHash.slice(0, 12)}***`;
    const instLabel = c.owningInstitution === 'darolahsan' ? 'دارالاحسان' : 'عدالت و برابری';
    csvContent += `"${c.id}","${maskedHash}","${instLabel}","${c.blockName}",${c.score.total},"${c.servicePath}","${c.lastSupportType}","${c.lastSupportDate}"\n`;
  }

  return {
    id: `archive-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    monthLabel,
    generatedDate: new Date().toLocaleDateString('fa-IR'),
    graduatedCount: finalizedCases.length,
    csvDataContent: csvContent,
    institutionFilter,
  };
}

export function downloadCsvArchive(archive: MonthlyCsvArchiveItem) {
  const blob = new Blob([archive.csvDataContent], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `naysar-graduated-archive-${archive.monthLabel.replace(/\s+/g, '_')}-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
