import React, {useEffect, useMemo, useState} from 'react';
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  HeartHandshake,
  MapPin,
  Phone,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type {CaseRecordView, InstitutionId, NaysarBlock, UiThemeAccent} from '../types';

type IdentityTab = 'institutions' | 'personnel' | 'beneficiaries' | 'stakeholders';

interface InstitutionProfile {
  id: string;
  code: InstitutionId | 'joint' | 'custom';
  name: string;
  legalType: string;
  regNumber: string;
  nationalId: string;
  economicCode: string;
  licenseIssuer: string;
  director: string;
  address: string;
  postalCode: string;
  phone: string;
  foundedYear: string;
  description: string;
  isCore?: boolean;
}

interface PersonnelProfile {
  id: string;
  personnelCode: string;
  name: string;
  nationalId: string;
  roleTitle: string;
  education: string;
  institution: InstitutionId;
  phone: string;
  blockCoverage: string;
  activeCasesCount: number;
  status: 'active' | 'leave' | 'inactive';
  joinedAt: string;
}

interface CustomBeneficiaryIdentity {
  id: string;
  beneficiaryCode: string;
  fullName: string;
  fatherName: string;
  nationalId: string;
  nationalIdHashPrefix: string;
  birthDate: string;
  idCertificateNo: string;
  owningInstitution: InstitutionId;
  blockId: string;
  blockName: string;
  address: string;
  postalCode: string;
  phone: string;
  householdSize: number;
  headStatus: string;
  housingType: string;
  registeredAt: string;
  notes: string;
}

type StakeholderRoleType = 'board_member' | 'donor' | 'volunteer' | 'local_liaison';

interface StakeholderProfile {
  id: string;
  fullName: string;
  roleType: StakeholderRoleType;
  nationalId: string;
  institution: InstitutionId | 'joint';
  phone: string;
  specialtyOrContribution: string;
  status: 'active' | 'inactive';
  registeredAt: string;
}

interface IdentityProfilesManagerViewProps {
  cases?: CaseRecordView[];
  blocks?: NaysarBlock[];
  activeInstitution?: InstitutionId;
  isDark?: boolean;
  themeAccent?: UiThemeAccent;
  onStartAssessmentWithId?: (nationalId: string, blockId: string) => void;
  onExportToast?: (title: string, description: string) => void;
}

const STORAGE_KEYS = {
  institutions: 'naysar_identity_institutions_v1',
  personnel: 'naysar_identity_personnel_v1',
  beneficiaries: 'naysar_identity_beneficiaries_v1',
  stakeholders: 'naysar_identity_stakeholders_v1',
};

const STAKEHOLDER_LABELS: Record<StakeholderRoleType, string> = {
  board_member: 'عضو هیئت‌مدیره / امنا',
  donor: 'خیر و حامی مالی',
  volunteer: 'داوطلب و همیار محله',
  local_liaison: 'ضامن / معتمد بلوک',
};

const PERSONNEL_STATUS_LABELS: Record<PersonnelProfile['status'], string> = {
  active: 'فعال',
  leave: 'مرخصی',
  inactive: 'غیرفعال',
};

function toPersianNum(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num);
}

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function normalizeSearch(value: string): string {
  return toAsciiDigits(value)
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .toLowerCase();
}

function maskNid(nid: string): string {
  const clean = toAsciiDigits(nid).replace(/\D/g, '');
  if (clean.length < 7) return nid || '***';
  return `${clean.slice(0, 3)}***${clean.slice(-4)}`;
}

function computeSimpleHashPrefix(nid: string): string {
  const clean = toAsciiDigits(nid).replace(/\D/g, '');
  let h1 = 0x811c9dc5;
  for (let i = 0; i < clean.length; i += 1) {
    h1 ^= clean.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + 'a4f9';
}

function getTodayPersianDate(): string {
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return '۱۴۰۵/۰۸/۲۵';
  }
}

const DEFAULT_INSTITUTIONS: InstitutionProfile[] = [
  {
    id: 'inst-darolahsan',
    code: 'darolahsan',
    name: 'مؤسسه خیریه دارالاحسان سنندج',
    legalType: 'مؤسسه غیرتجاری و عام‌المنفعه',
    regNumber: '۱۲۸۴',
    nationalId: '10660048210',
    economicCode: '411398201145',
    licenseIssuer: 'فرمانداری و اداره کل بهزیستی کردستان',
    director: 'حاج احمد رمضانی',
    address: 'سنندج، ناحیه منفصل شهری نایسر، خیابان اصلی امام خمینی، پلاک ۴۲',
    postalCode: '6617843911',
    phone: '۰۸۷-۳۳۲۸۱۵۰۰',
    foundedYear: '۱۳۸۲',
    description:
      'مؤسسه پیشگام در حمایت معیشتی، درمان و توانمندسازی خانواده‌های نیازمند در مناطق حاشیه‌نشین سنندج.',
    isCore: true,
  },
  {
    id: 'inst-edalat',
    code: 'edalat',
    name: 'مؤسسه خیریه عدالت و برابری کردستان',
    legalType: 'سازمان مردم‌نهاد (سمن) توانمندسازی',
    regNumber: '۱۵۴۰',
    nationalId: '10660129450',
    economicCode: '411420918832',
    licenseIssuer: 'وزارت کشور (استانداری کردستان)',
    director: 'دکتر مریم ناصری',
    address: 'سنندج، نایسر، جنب مرکز بهداشت، مجتمع هم‌افزایی، طبقه دوم',
    postalCode: '6617891204',
    phone: '۰۸۷-۳۳۲۹۲۰۱۰',
    foundedYear: '۱۳۸۹',
    description:
      'متمرکز بر صندوق‌های خرد اعتباری (SHG)، اشتغال‌زایی زنان سرپرست خانوار و پایش مستمر توسعه انسانی.',
    isCore: true,
  },
  {
    id: 'inst-joint',
    code: 'joint',
    name: 'دفتر هماهنگی مشترک پایلوت نایسر',
    legalType: 'کارگروه مشترک بین‌سازمانی',
    regNumber: 'پایلوت ملی',
    nationalId: '10669988112',
    economicCode: '—',
    licenseIssuer: 'تفاهم‌نامه مشترک دارالاحسان و عدالت',
    director: 'مهندس سامان کاظمی',
    address: 'سنندج، ناحیه نایسر، بلوک ۱، دفتر مرکزی هم‌افزایی دو مؤسسه',
    postalCode: '6617811009',
    phone: '۰۸۷-۳۳۲۹۹۰۰۰',
    foundedYear: '۱۴۰۴',
    description:
      'مرکز متمرکز ضد هم‌پوشانی پرونده‌ها، تجمیع استعلام‌های هش‌شده و مدیریت یکپارچه مداخله در نایسر.',
    isCore: true,
  },
];

const DEFAULT_PERSONNEL: PersonnelProfile[] = [
  {
    id: 'p-1',
    personnelCode: 'DR-1042',
    name: 'سهیلا محمدی',
    nationalId: '3732189231',
    roleTitle: 'مددکار ارشد معیشت و توانمندسازی',
    education: 'کارشناسی ارشد مددکاری اجتماعی',
    institution: 'darolahsan',
    phone: '۰۹۱۸۳۸۸۱۱۲۰',
    blockCoverage: 'بلوک ۱ و ۳ (نایسر مرکزی)',
    activeCasesCount: 34,
    status: 'active',
    joinedAt: '۱۴۰۱/۰۲/۱۵',
  },
  {
    id: 'p-2',
    personnelCode: 'ED-2018',
    name: 'آرش کریمی',
    nationalId: '3730912345',
    roleTitle: 'مددکار ارشد پرونده‌های درمانی و حمایتی',
    education: 'کارشناسی علوم اجتماعی',
    institution: 'edalat',
    phone: '۰۹۱۸۵۱۲۳۳۴۴',
    blockCoverage: 'بلوک ۲ و ۵ (تپه نایسر)',
    activeCasesCount: 31,
    status: 'active',
    joinedAt: '۱۴۰۲/۰۷/۰۱',
  },
  {
    id: 'p-3',
    personnelCode: 'DR-1089',
    name: 'مهناز رحیمی',
    nationalId: '3731189012',
    roleTitle: 'مددکار میدانی پذیرش و خانواده',
    education: 'کارشناسی مشاوره خانواده',
    institution: 'darolahsan',
    phone: '۰۹۱۸۷۶۵۴۳۲۱',
    blockCoverage: 'بلوک ۱ و ۵ (محدوده مشترک)',
    activeCasesCount: 29,
    status: 'active',
    joinedAt: '۱۴۰۳/۰۱/۲۰',
  },
  {
    id: 'p-4',
    personnelCode: 'ED-2041',
    name: 'روژین صالحی',
    nationalId: '3734451120',
    roleTitle: 'مددکار توانمندسازی بانوان و آموزش',
    education: 'کارشناسی کارآفرینی و مدیریت',
    institution: 'edalat',
    phone: '۰۹۳۶۴۱۲۰۹۸۷',
    blockCoverage: 'بلوک ۴ (شهرک پایین نایسر)',
    activeCasesCount: 26,
    status: 'active',
    joinedAt: '۱۴۰۳/۰۵/۱۰',
  },
];

const DEFAULT_STAKEHOLDERS: StakeholderProfile[] = [
  {
    id: 'stk-1',
    fullName: 'حاج جلال الدین حسینی',
    roleType: 'board_member',
    nationalId: '3730011223',
    institution: 'darolahsan',
    phone: '۰۹۱۸۱۱۱۴۵۶۰',
    specialtyOrContribution: 'رئیس هیئت‌مدیره و نظارت بر تخصیص بودجه درمانی',
    status: 'active',
    registeredAt: '۱۳۹۸/۰۴/۱۰',
  },
  {
    id: 'stk-2',
    fullName: 'مهندس پروین صلواتی',
    roleType: 'donor',
    nationalId: '3738822110',
    institution: 'edalat',
    phone: '۰۹۱۲۳۴۵۹۰۱۰',
    specialtyOrContribution: 'حامی صندوق‌های خرد اشتغال بانوان (کارگاه‌های خیاطی)',
    status: 'active',
    registeredAt: '۱۴۰۴/۰۳/۱۸',
  },
  {
    id: 'stk-3',
    fullName: 'کاوه قادری',
    roleType: 'local_liaison',
    nationalId: '3735566778',
    institution: 'joint',
    phone: '۰۹۱۸۶۵۴۹۹۸۸',
    specialtyOrContribution: 'معتمد محله نایسر و تسهیلگر بازدیدهای میدانی بلوک ۵',
    status: 'active',
    registeredAt: '۱۴۰۵/۰۲/۰۵',
  },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export const IdentityProfilesManagerView: React.FC<IdentityProfilesManagerViewProps> = ({
  cases = [],
  blocks = [],
  activeInstitution = 'darolahsan',
  onStartAssessmentWithId,
  onExportToast,
}) => {
  const [activeTab, setActiveTab] = useState<IdentityTab>('institutions');
  const [searchQuery, setSearchQuery] = useState('');
  const [institutionFilter, setInstitutionFilter] = useState<'all' | InstitutionId>('all');

  // Persisted state for all identity directories
  const [institutions, setInstitutions] = useState<InstitutionProfile[]>(() =>
    loadFromStorage(STORAGE_KEYS.institutions, DEFAULT_INSTITUTIONS),
  );
  const [personnel, setPersonnel] = useState<PersonnelProfile[]>(() =>
    loadFromStorage(STORAGE_KEYS.personnel, DEFAULT_PERSONNEL),
  );
  const [customBeneficiaries, setCustomBeneficiaries] = useState<CustomBeneficiaryIdentity[]>(() =>
    loadFromStorage(STORAGE_KEYS.beneficiaries, []),
  );
  const [stakeholders, setStakeholders] = useState<StakeholderProfile[]>(() =>
    loadFromStorage(STORAGE_KEYS.stakeholders, DEFAULT_STAKEHOLDERS),
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.institutions, JSON.stringify(institutions));
    } catch {}
  }, [institutions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.personnel, JSON.stringify(personnel));
    } catch {}
  }, [personnel]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.beneficiaries, JSON.stringify(customBeneficiaries));
    } catch {}
  }, [customBeneficiaries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.stakeholders, JSON.stringify(stakeholders));
    } catch {}
  }, [stakeholders]);

  // Modal / Form states
  const [showInstForm, setShowInstForm] = useState(false);
  const [editingInstId, setEditingInstId] = useState<string | null>(null);
  const [instForm, setInstForm] = useState({
    name: '',
    legalType: 'مؤسسه خیریه غیرتجاری',
    regNumber: '',
    nationalId: '',
    economicCode: '',
    licenseIssuer: 'استانداری کردستان / بهزیستی',
    director: '',
    address: '',
    postalCode: '',
    phone: '',
    foundedYear: '۱۴۰۵',
    description: '',
  });

  const [showPersonnelForm, setShowPersonnelForm] = useState(false);
  const [editingPersonnelId, setEditingPersonnelId] = useState<string | null>(null);
  const [personnelForm, setPersonnelForm] = useState<{
    name: string;
    nationalId: string;
    personnelCode: string;
    roleTitle: string;
    education: string;
    institution: InstitutionId;
    phone: string;
    blockCoverage: string;
    status: PersonnelProfile['status'];
  }>({
    name: '',
    nationalId: '',
    personnelCode: '',
    roleTitle: 'مددکار اجتماعی',
    education: 'کارشناسی مددکاری اجتماعی',
    institution: activeInstitution,
    phone: '',
    blockCoverage: blocks[0]?.name || 'بلوک ۱ (نایسر مرکزی)',
    status: 'active',
  });

  const [showBeneficiaryForm, setShowBeneficiaryForm] = useState(false);
  const [editingBeneficiaryId, setEditingBeneficiaryId] = useState<string | null>(null);
  const [beneficiaryForm, setBeneficiaryForm] = useState<{
    fullName: string;
    fatherName: string;
    nationalId: string;
    birthDate: string;
    idCertificateNo: string;
    owningInstitution: InstitutionId;
    blockId: string;
    address: string;
    postalCode: string;
    phone: string;
    householdSize: number;
    headStatus: string;
    housingType: string;
    notes: string;
  }>({
    fullName: '',
    fatherName: '',
    nationalId: '',
    birthDate: '',
    idCertificateNo: '',
    owningInstitution: activeInstitution,
    blockId: blocks[0]?.id || 'blk-1',
    address: '',
    postalCode: '',
    phone: '',
    householdSize: 3,
    headStatus: 'زن سرپرست خانوار',
    housingType: 'استیجاری با اجاره سنگین',
    notes: '',
  });

  const [showStakeholderForm, setShowStakeholderForm] = useState(false);
  const [editingStakeholderId, setEditingStakeholderId] = useState<string | null>(null);
  const [stakeholderForm, setStakeholderForm] = useState<{
    fullName: string;
    roleType: StakeholderRoleType;
    nationalId: string;
    institution: InstitutionId | 'joint';
    phone: string;
    specialtyOrContribution: string;
  }>({
    fullName: '',
    roleType: 'donor',
    nationalId: '',
    institution: activeInstitution,
    phone: '',
    specialtyOrContribution: '',
  });

  const [inspectedCard, setInspectedCard] = useState<{
    title: string;
    subtitle: string;
    fields: Array<{label: string; value: string}>;
  } | null>(null);

  // Handlers: Institutions
  const openEditInstitution = (inst: InstitutionProfile) => {
    setEditingInstId(inst.id);
    setInstForm({
      name: inst.name,
      legalType: inst.legalType,
      regNumber: inst.regNumber,
      nationalId: inst.nationalId,
      economicCode: inst.economicCode,
      licenseIssuer: inst.licenseIssuer,
      director: inst.director,
      address: inst.address,
      postalCode: inst.postalCode,
      phone: inst.phone,
      foundedYear: inst.foundedYear,
      description: inst.description,
    });
    setShowInstForm(true);
  };

  const handleSaveInstitution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instForm.name.trim() || !instForm.director.trim()) return;

    if (editingInstId) {
      setInstitutions((prev) =>
        prev.map((item) =>
          item.id === editingInstId
            ? {
                ...item,
                ...instForm,
              }
            : item,
        ),
      );
      onExportToast?.('مشخصات مؤسسه بروزرسانی شد', `اطلاعات هویتی «${instForm.name}» با موفقیت ویرایش و ذخیره شد.`);
    } else {
      const created: InstitutionProfile = {
        id: `inst-${Date.now()}`,
        code: 'custom',
        ...instForm,
        isCore: false,
      };
      setInstitutions((prev) => [...prev, created]);
      onExportToast?.('مؤسسه جدید ثبت شد', `مشخصات هویتی «${created.name}» به دایرکتوری شبکه افزوده شد.`);
    }
    setShowInstForm(false);
    setEditingInstId(null);
  };

  const handleDeleteInstitution = (id: string) => {
    setInstitutions((prev) => prev.filter((i) => i.id !== id));
    onExportToast?.('حذف مؤسسه', 'رکورد مؤسسه از دایرکتوری حذف شد.');
  };

  // Handlers: Personnel
  const openNewPersonnel = () => {
    setEditingPersonnelId(null);
    setPersonnelForm({
      name: '',
      nationalId: '',
      personnelCode: `PR-${Math.floor(1100 + Math.random() * 8800)}`,
      roleTitle: 'مددکار اجتماعی',
      education: 'کارشناسی مددکاری اجتماعی',
      institution: activeInstitution,
      phone: '',
      blockCoverage: blocks[0]?.name || 'بلوک ۱ (نایسر مرکزی)',
      status: 'active',
    });
    setShowPersonnelForm(true);
  };

  const openEditPersonnel = (p: PersonnelProfile) => {
    setEditingPersonnelId(p.id);
    setPersonnelForm({
      name: p.name,
      nationalId: p.nationalId,
      personnelCode: p.personnelCode,
      roleTitle: p.roleTitle,
      education: p.education,
      institution: p.institution,
      phone: p.phone,
      blockCoverage: p.blockCoverage,
      status: p.status,
    });
    setShowPersonnelForm(true);
  };

  const handleSavePersonnel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personnelForm.name.trim()) return;

    if (editingPersonnelId) {
      setPersonnel((prev) =>
        prev.map((item) =>
          item.id === editingPersonnelId
            ? {
                ...item,
                ...personnelForm,
              }
            : item,
        ),
      );
      onExportToast?.('مشخصات پرسنل ویرایش شد', `اطلاعات هویتی «${personnelForm.name}» ذخیره شد.`);
    } else {
      const created: PersonnelProfile = {
        id: `pers-${Date.now()}`,
        ...personnelForm,
        personnelCode: personnelForm.personnelCode.trim() || `PR-${Math.floor(1100 + Math.random() * 8800)}`,
        activeCasesCount: 0,
        joinedAt: getTodayPersianDate(),
      };
      setPersonnel((prev) => [created, ...prev]);
      onExportToast?.('پرسنل جدید ثبت شد', `شناسنامه هویتی «${created.name}» با کد ${created.personnelCode} ثبت گردید.`);
    }
    setShowPersonnelForm(false);
    setEditingPersonnelId(null);
  };

  const handleDeletePersonnel = (id: string) => {
    setPersonnel((prev) => prev.filter((p) => p.id !== id));
    onExportToast?.('حذف پرسنل', 'مشخصات پرسنل از دایرکتوری حذف گردید.');
  };

  // Handlers: Beneficiaries
  const openNewBeneficiary = () => {
    setEditingBeneficiaryId(null);
    setBeneficiaryForm({
      fullName: '',
      fatherName: '',
      nationalId: '',
      birthDate: '',
      idCertificateNo: '',
      owningInstitution: activeInstitution,
      blockId: blocks[0]?.id || 'blk-1',
      address: '',
      postalCode: '',
      phone: '',
      householdSize: 3,
      headStatus: 'زن سرپرست خانوار',
      housingType: 'استیجاری با اجاره سنگین',
      notes: '',
    });
    setShowBeneficiaryForm(true);
  };

  const openEditBeneficiary = (b: CustomBeneficiaryIdentity) => {
    setEditingBeneficiaryId(b.id);
    setBeneficiaryForm({
      fullName: b.fullName,
      fatherName: b.fatherName,
      nationalId: b.nationalId,
      birthDate: b.birthDate,
      idCertificateNo: b.idCertificateNo,
      owningInstitution: b.owningInstitution,
      blockId: b.blockId,
      address: b.address,
      postalCode: b.postalCode,
      phone: b.phone,
      householdSize: b.householdSize,
      headStatus: b.headStatus,
      housingType: b.housingType,
      notes: b.notes,
    });
    setShowBeneficiaryForm(true);
  };

  const handleSaveBeneficiary = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNid = toAsciiDigits(beneficiaryForm.nationalId).replace(/\D/g, '');
    if (!beneficiaryForm.fullName.trim() || cleanNid.length !== 10) {
      onExportToast?.(
        'خطا در اعتبارسنجی کدملی',
        'لطفاً نام سرپرست خانوار و کدملی ۱۰ رقمی معتبر را وارد نمایید.',
      );
      return;
    }

    const selectedBlock = blocks.find((blk) => blk.id === beneficiaryForm.blockId);
    const blockName = selectedBlock?.name || 'بلوک ۱ (نایسر مرکزی)';
    const hashPrefix = computeSimpleHashPrefix(cleanNid);

    if (editingBeneficiaryId) {
      setCustomBeneficiaries((prev) =>
        prev.map((item) =>
          item.id === editingBeneficiaryId
            ? {
                ...item,
                ...beneficiaryForm,
                nationalId: cleanNid,
                nationalIdHashPrefix: hashPrefix,
                blockName,
              }
            : item,
        ),
      );
      onExportToast?.('مشخصات مددجو بروزرسانی شد', `اطلاعات هویتی «${beneficiaryForm.fullName}» ویرایش شد.`);
    } else {
      const created: CustomBeneficiaryIdentity = {
        id: `ben-${Date.now()}`,
        beneficiaryCode: `NY-ID-${Math.floor(1000 + Math.random() * 8999)}`,
        ...beneficiaryForm,
        nationalId: cleanNid,
        nationalIdHashPrefix: hashPrefix,
        blockName,
        registeredAt: getTodayPersianDate(),
      };
      setCustomBeneficiaries((prev) => [created, ...prev]);
      onExportToast?.(
        'شناسنامه هویتی مددجو ثبت شد',
        `مشخصات هویتی «${created.fullName}» با هش امن ${hashPrefix} ذخیره شد و آماده ارجاع به ارزیابی معیشتی است.`,
      );
    }
    setShowBeneficiaryForm(false);
    setEditingBeneficiaryId(null);
  };

  const handleDeleteBeneficiary = (id: string) => {
    setCustomBeneficiaries((prev) => prev.filter((b) => b.id !== id));
    onExportToast?.('حذف پرونده هویتی', 'مشخصات مددجو از دایرکتوری محلی حذف شد.');
  };

  // Handlers: Stakeholders ("و...")
  const openNewStakeholder = () => {
    setEditingStakeholderId(null);
    setStakeholderForm({
      fullName: '',
      roleType: 'donor',
      nationalId: '',
      institution: activeInstitution,
      phone: '',
      specialtyOrContribution: '',
    });
    setShowStakeholderForm(true);
  };

  const openEditStakeholder = (s: StakeholderProfile) => {
    setEditingStakeholderId(s.id);
    setStakeholderForm({
      fullName: s.fullName,
      roleType: s.roleType,
      nationalId: s.nationalId,
      institution: s.institution,
      phone: s.phone,
      specialtyOrContribution: s.specialtyOrContribution,
    });
    setShowStakeholderForm(true);
  };

  const handleSaveStakeholder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stakeholderForm.fullName.trim()) return;

    if (editingStakeholderId) {
      setStakeholders((prev) =>
        prev.map((item) =>
          item.id === editingStakeholderId ? {...item, ...stakeholderForm} : item,
        ),
      );
      onExportToast?.('اطلاعات شخص مرتبط بروزرسانی شد', `مشخصات «${stakeholderForm.fullName}» ویرایش شد.`);
    } else {
      const created: StakeholderProfile = {
        id: `stk-${Date.now()}`,
        ...stakeholderForm,
        status: 'active',
        registeredAt: getTodayPersianDate(),
      };
      setStakeholders((prev) => [created, ...prev]);
      onExportToast?.('عضو مرتبط جدید ثبت شد', `مشخصات «${created.fullName}» در دایرکتوری ذی‌نفعان ثبت شد.`);
    }
    setShowStakeholderForm(false);
    setEditingStakeholderId(null);
  };

  const handleDeleteStakeholder = (id: string) => {
    setStakeholders((prev) => prev.filter((s) => s.id !== id));
    onExportToast?.('حذف رکورد', 'مشخصات شخص مرتبط حذف شد.');
  };

  // Filtered collections
  const normalizedQuery = normalizeSearch(searchQuery);

  const filteredPersonnel = useMemo(() => {
    return personnel.filter((p) => {
      if (institutionFilter !== 'all' && p.institution !== institutionFilter) return false;
      if (!normalizedQuery) return true;
      return (
        normalizeSearch(p.name).includes(normalizedQuery) ||
        normalizeSearch(p.personnelCode).includes(normalizedQuery) ||
        normalizeSearch(p.roleTitle).includes(normalizedQuery) ||
        normalizeSearch(p.blockCoverage).includes(normalizedQuery)
      );
    });
  }, [personnel, institutionFilter, normalizedQuery]);

  type UnifiedBeneficiaryRow = {
    source: 'custom' | 'case';
    id: string;
    code: string;
    fullName: string;
    fatherName?: string;
    nationalIdDisplay: string;
    rawNationalId?: string;
    hashPrefix: string;
    owningInstitution: InstitutionId;
    blockId: string;
    blockName: string;
    phone: string;
    address: string;
    householdSize: number;
    headStatus: string;
    registeredAt: string;
    isMasked: boolean;
    customRecord?: CustomBeneficiaryIdentity;
    caseRecord?: CaseRecordView;
  };

  const unifiedBeneficiaries = useMemo<UnifiedBeneficiaryRow[]>(() => {
    const customRows: UnifiedBeneficiaryRow[] = customBeneficiaries.map((b) => ({
      source: 'custom',
      id: b.id,
      code: b.beneficiaryCode,
      fullName: b.fullName,
      fatherName: b.fatherName,
      nationalIdDisplay: maskNid(b.nationalId),
      rawNationalId: b.nationalId,
      hashPrefix: b.nationalIdHashPrefix,
      owningInstitution: b.owningInstitution,
      blockId: b.blockId,
      blockName: b.blockName,
      phone: b.phone || '—',
      address: b.address || b.blockName,
      householdSize: b.householdSize,
      headStatus: b.headStatus,
      registeredAt: b.registeredAt,
      isMasked: false,
      customRecord: b,
    }));

    const caseRows: UnifiedBeneficiaryRow[] = cases.map((c) => ({
      source: 'case',
      id: c.id,
      code: c.id,
      fullName: c.isMasked ? `پرونده محرمانه مؤسسه همکار (${c.id})` : c.fullName || 'سرپرست خانوار',
      nationalIdDisplay: c.isMasked ? 'محرمانه (ایزوله)' : c.nationalIdMasked || '***',
      hashPrefix: c.nationalIdHash.slice(0, 12),
      owningInstitution: c.owningInstitution,
      blockId: c.blockId,
      blockName: c.blockName,
      phone: c.isMasked ? '***' : c.phone || '—',
      address: c.isMasked ? c.blockName : c.address || c.blockName,
      householdSize: c.householdSize || 0,
      headStatus: c.headStatus || '—',
      registeredAt: c.registeredAt,
      isMasked: c.isMasked,
      caseRecord: c,
    }));

    return [...customRows, ...caseRows].filter((row) => {
      if (institutionFilter !== 'all' && row.owningInstitution !== institutionFilter) return false;
      if (!normalizedQuery) return true;
      return (
        normalizeSearch(row.fullName).includes(normalizedQuery) ||
        normalizeSearch(row.code).includes(normalizedQuery) ||
        normalizeSearch(row.blockName).includes(normalizedQuery) ||
        normalizeSearch(row.hashPrefix).includes(normalizedQuery)
      );
    });
  }, [customBeneficiaries, cases, institutionFilter, normalizedQuery]);

  const filteredStakeholders = useMemo(() => {
    return stakeholders.filter((s) => {
      if (institutionFilter !== 'all' && s.institution !== 'joint' && s.institution !== institutionFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        normalizeSearch(s.fullName).includes(normalizedQuery) ||
        normalizeSearch(STAKEHOLDER_LABELS[s.roleType]).includes(normalizedQuery) ||
        normalizeSearch(s.specialtyOrContribution).includes(normalizedQuery)
      );
    });
  }, [stakeholders, institutionFilter, normalizedQuery]);

  // CSV Export of Current Directory Tab
  const handleExportDirectoryCsv = () => {
    let csv = '\uFEFF';
    if (activeTab === 'institutions') {
      csv += 'نام مؤسسه,نوع حقوقی,شناسه ملی,شماره ثبت,مدیرعامل/مسئول,تلفن,کد پستی,نشانی\n';
      for (const i of institutions) {
        csv += `"${i.name}","${i.legalType}","${i.nationalId}","${i.regNumber}","${i.director}","${i.phone}","${i.postalCode}","${i.address}"\n`;
      }
    } else if (activeTab === 'personnel') {
      csv += 'کد پرسنلی,نام و نام خانوادگی,سمت,تحصیلات,مؤسسه,تلفن,بلوک تحت پوشش,وضعیت\n';
      for (const p of filteredPersonnel) {
        csv += `"${p.personnelCode}","${p.name}","${p.roleTitle}","${p.education}","${p.institution === 'darolahsan' ? 'دارالاحسان' : 'عدالت و برابری'}","${p.phone}","${p.blockCoverage}","${PERSONNEL_STATUS_LABELS[p.status]}"\n`;
      }
    } else if (activeTab === 'beneficiaries') {
      csv += 'کد پرونده/هویت,نام سرپرست,کدملی ماسک‌شده,پیشوند هش SHA-256,مؤسسه متولی,بلوک جغرافیایی,تعداد اعضا,وضعیت سرپرست,تاریخ ثبت\n';
      for (const b of unifiedBeneficiaries) {
        csv += `"${b.code}","${b.fullName}","${b.nationalIdDisplay}","${b.hashPrefix}","${b.owningInstitution === 'darolahsan' ? 'دارالاحسان' : 'عدالت و برابری'}","${b.blockName}",${b.householdSize},"${b.headStatus}","${b.registeredAt}"\n`;
      }
    } else {
      csv += 'نام و نام خانوادگی,نقش,مؤسسه مرتبط,تلفن,حوزه همکاری,تاریخ ثبت\n';
      for (const s of filteredStakeholders) {
        csv += `"${s.fullName}","${STAKEHOLDER_LABELS[s.roleType]}","${s.institution === 'darolahsan' ? 'دارالاحسان' : s.institution === 'edalat' ? 'عدالت و برابری' : 'دفتر مشترک'}","${s.phone}","${s.specialtyOrContribution}","${s.registeredAt}"\n`;
      }
    }

    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `naysar-identity-${activeTab}-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onExportToast?.('خروجی CSV دایرکتوری ذخیره شد', 'فهرست هویتی بخش فعال با انکودینگ فارسی (UTF-8 BOM) دانلود شد.');
  };

  return (
    <div className="space-y-6">
      {/* Header Zone */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-teal-700 dark:text-teal-400">
              سامانه جامع هویت و ذی‌نفعان نایسر
            </span>
            <span aria-hidden="true">·</span>
            <span>مؤسسات، پرسنل، مددجویان و هیئت‌مدیره</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            ثبت و مدیریت مشخصات هویتی شبکه
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            ثبت متمرکز شناسنامه حقوقی مؤسسات خیریه، پروفایل پرسنل و مددکاران، مشخصات هویتی سرپرستان خانوار و دایرکتوری خیرین، داوطلبان و اعضای هیئت‌مدیره.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportDirectoryCsv}
            className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی CSV فهرست</span>
          </button>

          {activeTab === 'institutions' && (
            <button
              type="button"
              onClick={() => {
                setEditingInstId(null);
                setInstForm({
                  name: '',
                  legalType: 'مؤسسه خیریه غیرتجاری',
                  regNumber: '',
                  nationalId: '',
                  economicCode: '',
                  licenseIssuer: 'استانداری کردستان / بهزیستی',
                  director: '',
                  address: '',
                  postalCode: '',
                  phone: '',
                  foundedYear: '۱۴۰۵',
                  description: '',
                });
                setShowInstForm(true);
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت مؤسسه / شعبه جدید</span>
            </button>
          )}

          {activeTab === 'personnel' && (
            <button
              type="button"
              onClick={openNewPersonnel}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت پرسنل / مددکار</span>
            </button>
          )}

          {activeTab === 'beneficiaries' && (
            <button
              type="button"
              onClick={openNewBeneficiary}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت مشخصات مددجو</span>
            </button>
          )}

          {activeTab === 'stakeholders' && (
            <button
              type="button"
              onClick={openNewStakeholder}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت عضو / خیر / داوطلب</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Column Tabular KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">مؤسسات و دفاتر ثبت‌شده</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {toPersianNum(institutions.length)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">دارای شناسه ملی و شماره ثبت</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">پرسنل و مددکاران شبکه</div>
          <div className="text-2xl font-bold text-teal-700 dark:text-teal-400 mt-1 tabular-nums">
            {toPersianNum(personnel.filter((p) => p.status === 'active').length)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            از مجموع {toPersianNum(personnel.length)} کادر ثبت‌شده
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">پرونده‌های هویتی مددجویان</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {toPersianNum(cases.length + customBeneficiaries.length)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            شامل {toPersianNum(customBeneficiaries.length)} ثبت هویتی جدید
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">هیئت‌مدیره، خیرین و داوطلبان</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {toPersianNum(stakeholders.length)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">حامیان و معتمدین محلی نایسر</div>
        </div>
      </div>

      {/* Navigation Tabs + Filters Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('institutions')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'institutions'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>مؤسسات ({toPersianNum(institutions.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('personnel')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'personnel'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>پرسنل و مددکاران ({toPersianNum(personnel.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('beneficiaries')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'beneficiaries'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>مددجویان ({toPersianNum(cases.length + customBeneficiaries.length)})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stakeholders')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'stakeholders'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
            <span>هیئت‌مدیره، خیرین و داوطلبان ({toPersianNum(stakeholders.length)})</span>
          </button>
        </div>

        {activeTab !== 'institutions' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setInstitutionFilter('all')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  institutionFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                همه مؤسسات
              </button>
              <button
                type="button"
                onClick={() => setInstitutionFilter('darolahsan')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  institutionFilter === 'darolahsan'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                دارالاحسان
              </button>
              <button
                type="button"
                onClick={() => setInstitutionFilter('edalat')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  institutionFilter === 'edalat'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                عدالت و برابری
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو بر اساس نام، کد یا محدوده..."
                className="w-full text-xs bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: INSTITUTIONS */}
      {activeTab === 'institutions' && (
        <div className="space-y-6">
          {showInstForm && (
            <form
              onSubmit={handleSaveInstitution}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingInstId ? 'ویرایش مشخصات هویتی و حقوقی مؤسسه' : 'ثبت مشخصات هویتی مؤسسه یا شعبه جدید'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowInstForm(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نام رسمی مؤسسه / دفتر *</label>
                  <input
                    type="text"
                    required
                    value={instForm.name}
                    onChange={(e) => setInstForm({...instForm, name: e.target.value})}
                    placeholder="مثلاً: مرکز نیکوکاری نایسر شرقی"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نوع شخصیت حقوقی</label>
                  <input
                    type="text"
                    value={instForm.legalType}
                    onChange={(e) => setInstForm({...instForm, legalType: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">مدیرعامل / مسئول *</label>
                  <input
                    type="text"
                    required
                    value={instForm.director}
                    onChange={(e) => setInstForm({...instForm, director: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">شناسه ملی (۱۱ رقمی)</label>
                  <input
                    type="text"
                    value={instForm.nationalId}
                    onChange={(e) => setInstForm({...instForm, nationalId: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">شماره ثبت</label>
                  <input
                    type="text"
                    value={instForm.regNumber}
                    onChange={(e) => setInstForm({...instForm, regNumber: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">کد اقتصادی</label>
                  <input
                    type="text"
                    value={instForm.economicCode}
                    onChange={(e) => setInstForm({...instForm, economicCode: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">مرجع صادرکننده مجوز</label>
                  <input
                    type="text"
                    value={instForm.licenseIssuer}
                    onChange={(e) => setInstForm({...instForm, licenseIssuer: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">تلفن تماس</label>
                  <input
                    type="text"
                    value={instForm.phone}
                    onChange={(e) => setInstForm({...instForm, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">کد پستی</label>
                  <input
                    type="text"
                    value={instForm.postalCode}
                    onChange={(e) => setInstForm({...instForm, postalCode: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">سال تأسیس</label>
                  <input
                    type="text"
                    value={instForm.foundedYear}
                    onChange={(e) => setInstForm({...instForm, foundedYear: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نشانی دفتر مرکزی</label>
                  <input
                    type="text"
                    value={instForm.address}
                    onChange={(e) => setInstForm({...instForm, address: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2 lg:col-span-4">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">شرح مأموریت و حوزه خدمات</label>
                  <textarea
                    rows={2}
                    value={instForm.description}
                    onChange={(e) => setInstForm({...instForm, description: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInstForm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  {editingInstId ? 'ذخیره تغییرات مؤسسه' : 'ثبت مؤسسه در سامانه'}
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {institutions.map((inst) => (
              <div
                key={inst.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>شناسه ملی: {inst.nationalId}</span>
                    <span aria-hidden="true">·</span>
                    <span>تأسیس {inst.foundedYear}</span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{inst.name}</h3>
                    <div className="text-xs text-teal-700 dark:text-teal-400 mt-1 tabular-nums">
                      {inst.legalType} · شماره ثبت {inst.regNumber}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {inst.description || '—'}
                  </p>

                  <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>مسئول: {inst.director}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">مجوز: {inst.licenseIssuer}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{inst.address}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{inst.phone} · کد پستی {inst.postalCode || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    فعال در شبکه
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditInstitution(inst)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md inline-flex items-center gap-1 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>ویرایش</span>
                    </button>
                    {!inst.isCore && (
                      <button
                        type="button"
                        onClick={() => handleDeleteInstitution(inst.id)}
                        className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 rounded-md transition-colors"
                        title="حذف مؤسسه"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PERSONNEL */}
      {activeTab === 'personnel' && (
        <div className="space-y-6">
          {showPersonnelForm && (
            <form
              onSubmit={handleSavePersonnel}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingPersonnelId ? 'ویرایش مشخصات هویتی پرسنل' : 'ثبت مشخصات هویتی پرسنل / مددکار جدید'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowPersonnelForm(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نام و نام خانوادگی *</label>
                  <input
                    type="text"
                    required
                    value={personnelForm.name}
                    onChange={(e) => setPersonnelForm({...personnelForm, name: e.target.value})}
                    placeholder="مثلاً: فرهاد شریعتی"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">کدملی</label>
                  <input
                    type="text"
                    value={personnelForm.nationalId}
                    onChange={(e) => setPersonnelForm({...personnelForm, nationalId: e.target.value})}
                    placeholder="۱۰ رقم"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">کد پرسنلی</label>
                  <input
                    type="text"
                    value={personnelForm.personnelCode}
                    onChange={(e) => setPersonnelForm({...personnelForm, personnelCode: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">سمت تخصصی</label>
                  <input
                    type="text"
                    value={personnelForm.roleTitle}
                    onChange={(e) => setPersonnelForm({...personnelForm, roleTitle: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">مدرک و رشته تحصیلی</label>
                  <input
                    type="text"
                    value={personnelForm.education}
                    onChange={(e) => setPersonnelForm({...personnelForm, education: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">مؤسسه متبوع</label>
                  <select
                    value={personnelForm.institution}
                    onChange={(e) => setPersonnelForm({...personnelForm, institution: e.target.value as InstitutionId})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="darolahsan">دارالاحسان سنندج</option>
                    <option value="edalat">عدالت و برابری</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">شماره تماس</label>
                  <input
                    type="text"
                    value={personnelForm.phone}
                    onChange={(e) => setPersonnelForm({...personnelForm, phone: e.target.value})}
                    placeholder="۰۹۱۸..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">محدوده بلوک تحت پوشش</label>
                  <input
                    type="text"
                    value={personnelForm.blockCoverage}
                    onChange={(e) => setPersonnelForm({...personnelForm, blockCoverage: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">وضعیت همکاری:</span>
                  {(['active', 'leave', 'inactive'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPersonnelForm({...personnelForm, status: st})}
                      className={`px-2.5 py-1 rounded-md border transition-colors ${
                        personnelForm.status === st
                          ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-300 text-teal-800 dark:text-teal-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {PERSONNEL_STATUS_LABELS[st]}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPersonnelForm(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                  >
                    {editingPersonnelId ? 'ذخیره تغییرات' : 'ثبت پرسنل'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {filteredPersonnel.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  پرسنلی با مشخصات جستجو‌شده یافت نشد.
                </p>
                <button
                  type="button"
                  onClick={openNewPersonnel}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white"
                >
                  ثبت پرسنل جدید
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-4 whitespace-nowrap">کد پرسنلی</th>
                      <th className="py-3 px-4 whitespace-nowrap">نام و سمت تخصصی</th>
                      <th className="py-3 px-4 whitespace-nowrap">کدملی</th>
                      <th className="py-3 px-4 whitespace-nowrap">مؤسسه متبوع</th>
                      <th className="py-3 px-4 whitespace-nowrap">محدوده پوشش</th>
                      <th className="py-3 px-4 whitespace-nowrap">تماس</th>
                      <th className="py-3 px-4 whitespace-nowrap">وضعیت</th>
                      <th className="py-3 px-4 whitespace-nowrap">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs tabular-nums">
                    {filteredPersonnel.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {p.personnelCode}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {p.roleTitle} · {p.education}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {maskNid(p.nationalId)}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {p.institution === 'darolahsan' ? 'دارالاحسان سنندج' : 'عدالت و برابری'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{p.blockCoverage}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{p.phone || '—'}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-semibold ${
                              p.status === 'active'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : p.status === 'leave'
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {PERSONNEL_STATUS_LABELS[p.status]}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditPersonnel(p)}
                              className="p-1.5 text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 rounded-md"
                              title="ویرایش مشخصات"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePersonnel(p.id)}
                              className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 rounded-md"
                              title="حذف پرسنل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BENEFICIARIES */}
      {activeTab === 'beneficiaries' && (
        <div className="space-y-6">
          {showBeneficiaryForm && (
            <form
              onSubmit={handleSaveBeneficiary}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingBeneficiaryId ? 'ویرایش شناسنامه هویتی مددجو' : 'ثبت مشخصات هویتی مددجو و سرپرست خانوار جدید'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowBeneficiaryForm(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نام و نام خانوادگی سرپرست *</label>
                  <input
                    type="text"
                    required
                    value={beneficiaryForm.fullName}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, fullName: e.target.value})}
                    placeholder="مثلاً: فاطمه رضوانی"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نام پدر</label>
                  <input
                    type="text"
                    value={beneficiaryForm.fatherName}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, fatherName: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">کدملی ۱۰ رقمی *</label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={beneficiaryForm.nationalId}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, nationalId: e.target.value})}
                    placeholder="3730000000"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">شماره شناسنامه / تاریخ تولد</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={beneficiaryForm.idCertificateNo}
                      onChange={(e) => setBeneficiaryForm({...beneficiaryForm, idCertificateNo: e.target.value})}
                      placeholder="ش.ش"
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                    <input
                      type="text"
                      value={beneficiaryForm.birthDate}
                      onChange={(e) => setBeneficiaryForm({...beneficiaryForm, birthDate: e.target.value})}
                      placeholder="۱۳۶۲/۰۴/۱۲"
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">مؤسسه متولی</label>
                  <select
                    value={beneficiaryForm.owningInstitution}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, owningInstitution: e.target.value as InstitutionId})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="darolahsan">دارالاحسان سنندج</option>
                    <option value="edalat">عدالت و برابری</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">بلوک جغرافیایی نایسر</label>
                  <select
                    value={beneficiaryForm.blockId}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, blockId: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {blocks.length > 0 ? (
                      blocks.map((blk) => (
                        <option key={blk.id} value={blk.id}>
                          {blk.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="blk-1">بلوک ۱ (نایسر مرکزی)</option>
                        <option value="blk-2">بلوک ۲ (تپه نایسر)</option>
                        <option value="blk-3">بلوک ۳ (محله مسجد جامع)</option>
                        <option value="blk-4">بلوک ۴ (شهرک پایین)</option>
                        <option value="blk-5">بلوک ۵ (محدوده مشترک)</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">شماره تماس</label>
                  <input
                    type="text"
                    value={beneficiaryForm.phone}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, phone: e.target.value})}
                    placeholder="۰۹۱۸..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">کد پستی / تعداد اعضا</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={beneficiaryForm.postalCode}
                      onChange={(e) => setBeneficiaryForm({...beneficiaryForm, postalCode: e.target.value})}
                      placeholder="کد پستی"
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={beneficiaryForm.householdSize}
                      onChange={(e) => setBeneficiaryForm({...beneficiaryForm, householdSize: Number(e.target.value) || 1})}
                      className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">وضعیت سرپرستی</label>
                  <select
                    value={beneficiaryForm.headStatus}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, headStatus: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="زن سرپرست خانوار">زن سرپرست خانوار</option>
                    <option value="سرپرست ازکارافتاده / بیمار صعب‌العلاج">سرپرست ازکارافتاده / بیمار صعب‌العلاج</option>
                    <option value="سالمند تنها">سالمند تنها</option>
                    <option value="عادی">عادی (دارای سرپرست فعال)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نوع مسکن</label>
                  <select
                    value={beneficiaryForm.housingType}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, housingType: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="استیجاری با اجاره سنگین">استیجاری با اجاره سنگین</option>
                    <option value="سکونتگاه غیررسمی / حاشیه‌ای">سکونتگاه غیررسمی / حاشیه‌ای</option>
                    <option value="رهن یا مسکن مهر">رهن یا مسکن مهر</option>
                    <option value="ملکی">ملکی</option>
                  </select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نشانی دقیق محل سکونت</label>
                  <input
                    type="text"
                    value={beneficiaryForm.address}
                    onChange={(e) => setBeneficiaryForm({...beneficiaryForm, address: e.target.value})}
                    placeholder="نایسر، کوچه، پلاک..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBeneficiaryForm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  {editingBeneficiaryId ? 'ذخیره تغییرات مددجو' : 'ثبت مشخصات هویتی مددجو'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                دایرکتوری هویتی مددجویان ({toPersianNum(unifiedBeneficiaries.length)} خانوار)
              </h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                کدملی‌ها به صورت خودکار به هش یک‌طرفه SHA-256 تبدیل و ایزوله‌سازی می‌شوند
              </span>
            </div>

            {unifiedBeneficiaries.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  مددجویی با عبارت جستجو‌شده یافت نشد.
                </p>
                <button
                  type="button"
                  onClick={openNewBeneficiary}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white"
                >
                  ثبت شناسنامه هویتی مددجو
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-4 whitespace-nowrap">شناسه و سرپرست</th>
                      <th className="py-3 px-4 whitespace-nowrap">کدملی / هش امن</th>
                      <th className="py-3 px-4 whitespace-nowrap">مؤسسه متولی</th>
                      <th className="py-3 px-4 whitespace-nowrap">بلوک جغرافیایی</th>
                      <th className="py-3 px-4 whitespace-nowrap">خانوار / سرپرست</th>
                      <th className="py-3 px-4 whitespace-nowrap">تاریخ ثبت</th>
                      <th className="py-3 px-4 whitespace-nowrap">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs tabular-nums">
                    {unifiedBeneficiaries.map((b) => (
                      <tr key={`${b.source}-${b.id}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{b.fullName}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {b.code} {b.source === 'custom' ? '· ثبت جدید دایرکتوری' : '· پرونده فعال'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          <div>{b.nationalIdDisplay}</div>
                          <div className="text-[10px] text-slate-400">SHA: {b.hashPrefix}...</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {b.owningInstitution === 'darolahsan' ? 'دارالاحسان' : 'عدالت و برابری'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{b.blockName}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          <div>{b.householdSize > 0 ? `${toPersianNum(b.householdSize)} نفر` : '—'}</div>
                          <div className="text-[11px] text-slate-500">{b.headStatus}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{b.registeredAt}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setInspectedCard({
                                  title: b.fullName,
                                  subtitle: `شناسنامه هویتی مددجو · ${b.code}`,
                                  fields: [
                                    {label: 'کدملی (ماسک‌شده)', value: b.nationalIdDisplay},
                                    {label: 'کد هش یک‌طرفه', value: b.hashPrefix},
                                    {label: 'مؤسسه متولی', value: b.owningInstitution === 'darolahsan' ? 'دارالاحسان سنندج' : 'عدالت و برابری کردستان'},
                                    {label: 'بلوک جغرافیایی', value: b.blockName},
                                    {label: 'شماره تماس', value: b.phone},
                                    {label: 'نشانی محل سکونت', value: b.address},
                                    {label: 'وضعیت سرپرست', value: b.headStatus},
                                    {label: 'تعداد اعضای خانوار', value: b.householdSize > 0 ? `${toPersianNum(b.householdSize)} نفر` : '—'},
                                    ...(b.fatherName ? [{label: 'نام پدر', value: b.fatherName}] : []),
                                    ...(b.customRecord?.birthDate ? [{label: 'تاریخ تولد', value: b.customRecord.birthDate}] : []),
                                    ...(b.customRecord?.postalCode ? [{label: 'کد پستی', value: b.customRecord.postalCode}] : []),
                                  ],
                                })
                              }
                              className="p-1.5 text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 rounded-md"
                              title="مشاهده شناسنامه هویتی"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {b.source === 'custom' && b.rawNationalId && onStartAssessmentWithId && (
                              <button
                                type="button"
                                onClick={() => onStartAssessmentWithId(b.rawNationalId!, b.blockId)}
                                className="px-2 py-1 text-[11px] font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 rounded-md inline-flex items-center gap-1"
                                title="ارجاع به فرم ارزیابی معیشتی"
                              >
                                <ClipboardCheck className="w-3 h-3" />
                                <span>ارزیابی</span>
                              </button>
                            )}

                            {b.source === 'custom' && b.customRecord && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditBeneficiary(b.customRecord!)}
                                  className="p-1.5 text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 rounded-md"
                                  title="ویرایش مشخصات"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBeneficiary(b.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 rounded-md"
                                  title="حذف رکورد هویتی"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: STAKEHOLDERS ("و...") */}
      {activeTab === 'stakeholders' && (
        <div className="space-y-6">
          {showStakeholderForm && (
            <form
              onSubmit={handleSaveStakeholder}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {editingStakeholderId ? 'ویرایش مشخصات شخص مرتبط' : 'ثبت عضو هیئت‌مدیره، خیر حامی، داوطلب یا معتمد محلی'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowStakeholderForm(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نام و نام خانوادگی *</label>
                  <input
                    type="text"
                    required
                    value={stakeholderForm.fullName}
                    onChange={(e) => setStakeholderForm({...stakeholderForm, fullName: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">نقش در شبکه</label>
                  <select
                    value={stakeholderForm.roleType}
                    onChange={(e) => setStakeholderForm({...stakeholderForm, roleType: e.target.value as StakeholderRoleType})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="board_member">عضو هیئت‌مدیره / امنا</option>
                    <option value="donor">خیر و حامی مالی</option>
                    <option value="volunteer">داوطلب و همیار محله</option>
                    <option value="local_liaison">ضامن / معتمد بلوک</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">مؤسسه مرتبط</label>
                  <select
                    value={stakeholderForm.institution}
                    onChange={(e) => setStakeholderForm({...stakeholderForm, institution: e.target.value as InstitutionId | 'joint'})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    <option value="darolahsan">دارالاحسان سنندج</option>
                    <option value="edalat">عدالت و برابری</option>
                    <option value="joint">دفتر هماهنگی مشترک</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">کدملی</label>
                  <input
                    type="text"
                    value={stakeholderForm.nationalId}
                    onChange={(e) => setStakeholderForm({...stakeholderForm, nationalId: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">شماره تماس</label>
                  <input
                    type="text"
                    value={stakeholderForm.phone}
                    onChange={(e) => setStakeholderForm({...stakeholderForm, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">حوزه مشارکت / تخصص</label>
                  <input
                    type="text"
                    value={stakeholderForm.specialtyOrContribution}
                    onChange={(e) => setStakeholderForm({...stakeholderForm, specialtyOrContribution: e.target.value})}
                    placeholder="مثلاً: تامین تجهیزات کارگاهی یا مشاور حقوقی"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStakeholderForm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  {editingStakeholderId ? 'ذخیره تغییرات' : 'ثبت در دایرکتوری ذی‌نفعان'}
                </button>
              </div>
            </form>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {filteredStakeholders.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  شخص مرتبطی با این جستجو ثبت نشده است.
                </p>
                <button
                  type="button"
                  onClick={openNewStakeholder}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white"
                >
                  ثبت اولین عضو / خیر
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-xs font-medium text-slate-600 dark:text-slate-400">
                      <th className="py-3 px-4 whitespace-nowrap">نام و نقش</th>
                      <th className="py-3 px-4 whitespace-nowrap">کدملی</th>
                      <th className="py-3 px-4 whitespace-nowrap">مؤسسه مرتبط</th>
                      <th className="py-3 px-4 whitespace-nowrap">شماره تماس</th>
                      <th className="py-3 px-4 whitespace-nowrap">حوزه همکاری و تخصص</th>
                      <th className="py-3 px-4 whitespace-nowrap">تاریخ ثبت</th>
                      <th className="py-3 px-4 whitespace-nowrap">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs tabular-nums">
                    {filteredStakeholders.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{s.fullName}</div>
                          <div className="text-[11px] text-teal-700 dark:text-teal-400">
                            {STAKEHOLDER_LABELS[s.roleType]}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {maskNid(s.nationalId)}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {s.institution === 'darolahsan'
                            ? 'دارالاحسان'
                            : s.institution === 'edalat'
                              ? 'عدالت و برابری'
                              : 'دفتر مشترک نایسر'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">{s.phone || '—'}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{s.specialtyOrContribution || '—'}</td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{s.registeredAt}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditStakeholder(s)}
                              className="p-1.5 text-slate-500 hover:text-teal-700 dark:hover:text-teal-300 rounded-md"
                              title="ویرایش مشخصات"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStakeholder(s.id)}
                              className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 rounded-md"
                              title="حذف رکورد"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Identity Sheet Inspection Modal */}
      {inspectedCard && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectedCard(null);
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <div className="text-xs text-teal-700 dark:text-teal-400 font-semibold">{inspectedCard.subtitle}</div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">{inspectedCard.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedCard(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {inspectedCard.fields.map((f) => (
                <div
                  key={f.label}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70"
                >
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{f.label}</div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">{f.value}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>چاپ برگه هویتی</span>
              </button>
              <button
                type="button"
                onClick={() => setInspectedCard(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
