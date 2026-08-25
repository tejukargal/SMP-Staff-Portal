import type { StaffRecord, SalarySlip } from '@/types';
import { MONTHS } from '@/constants/enums';

export function computeGross(basicPay: number, daPercent: number, hraPercent: number): number {
  const da = Math.round((basicPay * daPercent) / 100);
  const hra = Math.round((basicPay * hraPercent) / 100);
  return basicPay + da + hra;
}

export function computeNet(gross: number, nps: number, pt: number, otherDed = 0): number {
  return gross - nps - pt - otherDed;
}

export function computeDAAmount(basicPay: number, daPercent: number): number {
  return Math.round((basicPay * daPercent) / 100);
}

export function computeHRAAmount(basicPay: number, hraPercent: number): number {
  return Math.round((basicPay * hraPercent) / 100);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── LIC 6.25% report ─────────────────────────────────────────────────────────

export function computeLic625(payScale: string | undefined): number | null {
  const m = payScale?.match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  const midpoint = (Number(m[1]) + Number(m[2])) / 2;
  return Math.round(midpoint * 0.0625);
}

export function normalizeEmpId(empId: string): string {
  return empId.replace(/^0+/, '') || empId;
}

// Picks, per staff (by normalized empId), the salary slip with the latest year/month.
export function buildLatestSlipMap(slips: SalarySlip[]): Map<string, SalarySlip> {
  const rank = (s: SalarySlip) => s.year * 12 + MONTHS.indexOf(s.month);
  const map = new Map<string, SalarySlip>();
  for (const slip of slips) {
    const key = normalizeEmpId(slip.empId);
    const existing = map.get(key);
    if (!existing || rank(slip) > rank(existing)) map.set(key, slip);
  }
  return map;
}

export type LicStatus = 'OK' | 'SHORT' | '';

export interface LicRow {
  empId: string;
  name: string;
  month: string;
  year: number | '';
  payScale: string;
  lic: number | '';
  lic625: number | '';
  difference: number | '';
  status: LicStatus;
}

export function buildLicRow(s: StaffRecord, slipMap: Map<string, SalarySlip>): LicRow {
  const slip = slipMap.get(normalizeEmpId(s.empId));
  if (!slip) {
    return { empId: s.empId, name: s.name, month: '', year: '', payScale: '', lic: '', lic625: '', difference: '', status: '' };
  }
  const lic625 = computeLic625(slip.payScale);
  const difference = lic625 !== null ? slip.lic - lic625 : '';
  return {
    empId: s.empId,
    name: s.name,
    month: slip.month,
    year: slip.year,
    payScale: slip.payScale,
    lic: slip.lic,
    lic625: lic625 ?? '',
    difference,
    status: typeof difference === 'number' ? (difference >= 0 ? 'OK' : 'SHORT') : '',
  };
}
