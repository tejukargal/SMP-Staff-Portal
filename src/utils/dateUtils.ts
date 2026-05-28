import { format, parseISO, differenceInYears, addYears, endOfMonth, subMonths } from 'date-fns';

export function formatDate(isoString: string | undefined): string {
  if (!isoString) return '—';
  try {
    return format(parseISO(isoString), 'dd-MM-yyyy');
  } catch {
    return '—';
  }
}

export function computeServiceYears(doe: string): number {
  try {
    return differenceInYears(new Date(), parseISO(doe));
  } catch {
    return 0;
  }
}

export function computeDOR(dob: string): string {
  try {
    const dobDate = parseISO(dob);
    const retirementBirthday = addYears(dobDate, 60);
    // KCSR exception: born on the 1st → retire last day of the preceding month
    const base = dobDate.getDate() === 1
      ? subMonths(retirementBirthday, 1)
      : retirementBirthday;
    return format(endOfMonth(base), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

export function toISODate(dateStr: string): string {
  return dateStr;
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function getAge(dob: string): number {
  try {
    return differenceInYears(new Date(), parseISO(dob));
  } catch {
    return 0;
  }
}
