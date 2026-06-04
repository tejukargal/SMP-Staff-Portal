import type { Timestamp } from 'firebase/firestore';

export type LeaveType = 'CL' | 'HPL' | 'EL';
export type DayType = 'FULL' | 'HALF';

export type AppointmentType = 'DIRECT' | 'PROMOTION';

export type VacancyReason =
  | 'RETIREMENT'
  | 'RESIGNATION'
  | 'TRANSFER'
  | 'DECEASED'
  | 'NEW_POST'
  | 'PROMOTION_CHAIN';

export interface SanctionedPost {
  id?: string;
  dept: string;
  designation: string;
  sanctionedCount: number;
  updatedAt?: Timestamp;
}

export interface VacancyEvent {
  id?: string;
  dept: string;
  designation: string;
  status: 'VACANT' | 'FILLED';
  vacancyReason: VacancyReason;
  vacatedByStaffId?: string;
  vacatedByStaffName?: string;
  filledByStaffId?: string;
  filledByStaffName?: string;
  dateFilledOn?: string;
  appointmentType?: AppointmentType;
  promotedFromDesignation?: string;
  cascadeEventId?: string;
  isPending: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LeaveBalance {
  cl: number;
  hpl: number;
  el: number;
}

export interface LeaveRecord {
  id?: string;
  staffId: string;
  staffName?: string;
  empId?: string;
  dept?: string;
  type: LeaveType;
  fromDate: string;
  toDate: string;
  dayType: DayType;
  days: number;
  note?: string;
  createdAt: Timestamp;
}

export type DesignationEnum =
  | 'PRINCIPAL'
  | 'SUPDT.'
  | 'FDC'
  | 'SDC'
  | 'TYPIST'
  | 'GROUP D'
  | 'SEL GR LECT'
  | 'LECTURER'
  | 'INSTRUCTOR'
  | 'ASST. INST'
  | 'MECHANIC'
  | 'HELPER'
  | 'SYS. ANALIST'
  | 'OPERATOR'
  | 'HOD'
  | 'LIBRARIAN'
  | 'OTHER';

export type DeptEnum = 'OFFICE' | 'ME' | 'CE' | 'EC' | 'CS' | 'SCIENCE' | 'ELECTRICAL' | 'EE';

export type StatusEnum = 'IN SERVICE' | 'RTRD' | 'DECEASED' | 'RESIGNED' | 'TRANSFERRED';

export type StaffType = 'TEACHING' | 'NON-TEACHING';

export type UserRole = 'admin' | 'viewer';

export interface StaffRecord {
  id?: string;
  sl: number;
  name: string;
  empId: string;
  designation: DesignationEnum;
  type: StaffType;
  dept: DeptEnum;
  status: StatusEnum;
  dob: string;
  phone: string;
  email: string;
  doe: string;
  dor?: string;
  bankAccountNo: string;
  pan: string;
  aadhar: string;
  payScale?: string;
  basicPay?: number;
  da?: number;
  hra?: number;
  nps?: number;
  pt?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  photoUrl?: string;
  remarks?: string;
  fatherOrHusbandName?: string;
  address?: string;
  recipientId?: string;
  biometricId?: string;
  caste?: string;
  category?: string;
  dateOfCompletion?: string;
  classObtained?: string;
  university?: string;
  approvalOrderNumber?: string;
  dateOfApproval?: string;
  arrearsTakenFrom?: string;
  leaveBalance?: LeaveBalance;
  appointmentType?: AppointmentType;
  promotedFromDesignation?: string;
  dateOfDeceased?: string;
  dateOfResignation?: string;
  dateOfTransfer?: string;
}

export interface LicPolicy {
  id?: string;
  policyNumber: string;
  premiumAmount: number;
  maturityDate: string; // ISO YYYY-MM-DD
  createdAt?: import('firebase/firestore').Timestamp;
}

export interface UserRecord {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  disabled?: boolean;
}

export interface SalaryRow {
  staffId: string;
  name: string;
  designation: DesignationEnum;
  dept: DeptEnum;
  basicPay: number;
  daPercent: number;
  hraPercent: number;
  daAmount: number;
  hraAmount: number;
  gross: number;
  nps: number;
  pt: number;
  otherDed: number;
  net: number;
}
