import { format, parseISO, differenceInYears, addYears } from 'date-fns';

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
    return format(addYears(parseISO(dob), 60), 'yyyy-MM-dd');
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
