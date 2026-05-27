import * as XLSX from 'xlsx';
import type { StaffRecord, SalaryRow } from '@/types';
import { formatDate, computeServiceYears } from './dateUtils';

export function exportStaffToExcel(staff: StaffRecord[], filename = 'SMP_Staff_List'): void {
  const rows = staff.map((s, i) => ({
    'SL':                   i + 1,
    'NAME':                 s.name,
    'EMP ID':               s.empId,
    'DESIGNATION':          s.designation,
    'TYPE':                 s.type,
    'DEPT':                 s.dept,
    'STATUS':               s.status,
    'DOB':                  formatDate(s.dob),
    'DOE':                  formatDate(s.doe),
    'DOR':                  formatDate(s.dor ?? ''),
    'SERVICE YEARS':        computeServiceYears(s.doe),
    'CASTE':                s.caste ?? '',
    'CATEGORY':             s.category ?? '',
    'DATE OF COMPLETION':   formatDate(s.dateOfCompletion ?? ''),
    'CLASS OBTAINED':       s.classObtained ?? '',
    'UNIVERSITY':           s.university ?? '',
    'APPROVAL ORDER NUMBER': s.approvalOrderNumber ?? '',
    'DATE OF APPROVAL':     formatDate(s.dateOfApproval ?? ''),
    'ARREARS TAKEN FROM':   s.arrearsTakenFrom ?? '',
    'PHONE':                s.phone,
    'MAIL ID':              s.email,
    'BANK ACCT NO':         s.bankAccountNo,
    'PAN':                  s.pan,
    'AADHAR':               s.aadhar,
    'PAY SCALE':            s.payScale ?? '',
    'BASIC PAY':            s.basicPay ?? '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Staff List');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportSalaryBillToExcel(
  rows: SalaryRow[],
  month: string,
  year: number,
  filename?: string
): void {
  const data: Record<string, unknown>[] = rows.map((r, i) => ({
    'SL': i + 1,
    'NAME': r.name,
    'DESIGNATION': r.designation,
    'DEPT': r.dept,
    'BASIC PAY': r.basicPay,
    'DA': r.daAmount,
    'HRA': r.hraAmount,
    'GROSS': r.gross,
    'NPS': r.nps,
    'PT': r.pt,
    'OTHER DED': r.otherDed,
    'NET PAY': r.net,
  }));

  data.push({
    'SL': '',
    'NAME': 'TOTAL',
    'DESIGNATION': '',
    'DEPT': '',
    'BASIC PAY': rows.reduce((s, r) => s + r.basicPay, 0),
    'DA': rows.reduce((s, r) => s + r.daAmount, 0),
    'HRA': rows.reduce((s, r) => s + r.hraAmount, 0),
    'GROSS': rows.reduce((s, r) => s + r.gross, 0),
    'NPS': rows.reduce((s, r) => s + r.nps, 0),
    'PT': rows.reduce((s, r) => s + r.pt, 0),
    'OTHER DED': rows.reduce((s, r) => s + r.otherDed, 0),
    'NET PAY': rows.reduce((s, r) => s + r.net, 0),
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, `Salary ${month} ${year}`);
  XLSX.writeFile(wb, filename ?? `SMP_Salary_Bill_${month}_${year}.xlsx`);
}

export function exportReportToExcel(
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
