import type { DesignationEnum, DeptEnum, StatusEnum } from '@/types';

export const DESIGNATIONS: DesignationEnum[] = [
  'PRINCIPAL',
  'SUPDT.',
  'FDC',
  'SDC',
  'TYPIST',
  'GROUP D',
  'SEL GR LECT',
  'LECTURER',
  'INSTRUCTOR',
  'ASST. INST',
  'MECHANIC',
  'HELPER',
  'SYS. ANALIST',
  'OPERATOR',
  'HOD',
  'LIBRARIAN',
  'ENGLISH PART TIME',
  'ATTENDER',
  'OTHER',
];

export const DEPARTMENTS: DeptEnum[] = [
  'OFFICE',
  'ME',
  'CE',
  'EC',
  'CS',
  'SCIENCE',
  'ELECTRICAL',
];

export const STATUSES: StatusEnum[] = [
  'IN SERVICE',
  'RTRD',
  'DECEASED',
  'RESIGNED',
  'TRANSFERRED',
];

export const DEPT_COLORS: Record<DeptEnum, string> = {
  CE: '#3B82F6',
  ME: '#10B981',
  EC: '#8B5CF6',
  CS: '#F59E0B',
  OFFICE: '#6B7280',
  SCIENCE: '#06B6D4',
  ELECTRICAL: '#F97316',
};

export const STATUS_STYLES: Record<StatusEnum, { bg: string; text: string }> = {
  'IN SERVICE': { bg: '#DCFCE7', text: '#15803D' },
  RTRD: { bg: '#F3F4F6', text: '#4B5563' },
  DECEASED: { bg: '#1F2937', text: '#D1D5DB' },
  RESIGNED: { bg: '#FEF3C7', text: '#92400E' },
  TRANSFERRED: { bg: '#DBEAFE', text: '#1D4ED8' },
};

export const PAY_SCALES = [
  'AICTE LEVEL 9A',
  'AICTE LEVEL 10',
  'AICTE LEVEL 11',
  'AICTE LEVEL 12',
  'STATE SCALE SDC',
  'STATE SCALE FDC',
  'STATE SCALE GROUP D',
  'OTHER',
];

export const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

export const DESIGNATION_ORDER: string[] = [
  'PRINCIPAL',
  'SUPDT.',
  'FDC',
  'SDC',
  'TYPIST',
  'ATTENDER',
  'GROUP D',
  'HOD',
  'LECTURER',
  'SEL GR LECT',
  'SYS. ANALIST',
  'OPERATOR',
  'INSTRUCTOR',
  'ASST. INST',
  'MECHANIC',
  'HELPER',
  'LIBRARIAN',
  'ENGLISH PART TIME',
  'OTHER',
];

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  DIRECT:    'Direct',
  PROMOTION: 'Promotion',
};

export const VACANCY_REASON_LABELS: Record<string, string> = {
  RETIREMENT:      'Retirement',
  RESIGNATION:     'Resignation',
  TRANSFER:        'Transfer',
  DECEASED:        'Deceased',
  NEW_POST:        'New Sanctioned Post',
  PROMOTION_CHAIN: 'Promotion (Cascade)',
};
