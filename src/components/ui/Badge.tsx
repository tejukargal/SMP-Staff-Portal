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
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {dept}
    </span>
  );
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status}
    </span>
  );
}
