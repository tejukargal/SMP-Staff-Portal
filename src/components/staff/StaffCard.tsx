import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { DeptBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, computeServiceYears } from '@/utils/dateUtils';
import type { StaffRecord } from '@/types';

interface Props {
  staff: StaffRecord;
  isAdmin: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function StaffCard({ staff, isAdmin }: Props) {
  const navigate = useNavigate();
  const serviceYears = computeServiceYears(staff.doe);

  return (
    <div className="bg-white rounded-xl border border-[#E2E5EA] p-6 flex flex-col items-center text-center gap-4">
      {/* Avatar */}
      <div className="w-20 h-20 rounded-full bg-[#1B3A6B] flex items-center justify-center shrink-0">
        <span className="text-white text-2xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>
          {getInitials(staff.name)}
        </span>
      </div>

      {/* Name & badges */}
      <div>
        <h2 className="text-lg font-semibold text-[#111827] mb-2" style={{ fontFamily: "'DM Serif Display', serif" }}>
          {staff.name}
        </h2>
        <p className="text-sm text-[#6B7280] mb-3">{staff.designation}</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <DeptBadge dept={staff.dept} />
          <StatusBadge status={staff.status} />
        </div>
      </div>

      {/* Quick stats */}
      <div className="w-full border-t border-[#E2E5EA] pt-4 grid grid-cols-1 gap-3">
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Emp ID</span>
          <span className="font-mono text-xs font-medium">{staff.empId}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Service</span>
          <span className="font-medium">{serviceYears} years</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">DOE</span>
          <span className="font-medium">{formatDate(staff.doe)}</span>
        </div>
        {staff.dor && (
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280]">DOR</span>
            <span className="font-medium">{formatDate(staff.dor)}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="w-full flex flex-col gap-2 no-print">
        {isAdmin && (
          <Button
            variant="primary"
            className="w-full justify-center"
            onClick={() => navigate(`/staff/${staff.id}/edit`)}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Record
          </Button>
        )}
      </div>
    </div>
  );
}
