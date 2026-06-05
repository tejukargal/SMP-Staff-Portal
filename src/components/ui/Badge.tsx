import { DEPT_COLORS, STATUS_STYLES } from '@/constants/enums';
import type { DeptEnum, StatusEnum } from '@/types';

interface DeptBadgeProps {
  dept: DeptEnum;
}

interface StatusBadgeProps {
  status: StatusEnum;
}

export function DeptBadge({ dept }: DeptBadgeProps) {
  const color = DEPT_COLORS[dept] ?? '#6B7280';
  return (
    <span
      className="inline-flex items-center gap-1.5 min-w-[5rem] px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: `${color}18`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {dept}
    </span>
  );
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center justify-center min-w-[7rem] py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status}
    </span>
  );
}
