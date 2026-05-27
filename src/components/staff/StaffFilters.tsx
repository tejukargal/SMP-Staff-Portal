import { Search } from 'lucide-react';
import { DEPARTMENTS, STATUSES } from '@/constants/enums';
import type { DeptEnum, StatusEnum } from '@/types';

export interface StaffFiltersState {
  search: string;
  dept: DeptEnum | '';
  type: 'TEACHING' | 'NON-TEACHING' | '';
  status: StatusEnum | '';
}

interface Props {
  filters: StaffFiltersState;
  onChange: (filters: StaffFiltersState) => void;
}

export function StaffFilters({ filters, onChange }: Props) {
  const set = <K extends keyof StaffFiltersState>(key: K, value: StaffFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-52">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
        <input
          type="text"
          placeholder="Search name or Emp ID..."
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-[#E2E5EA] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
        />
      </div>

      <select
        value={filters.dept}
        onChange={(e) => set('dept', e.target.value as DeptEnum | '')}
        className="px-3 py-2 text-sm border border-[#E2E5EA] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
      >
        <option value="">All Depts</option>
        {DEPARTMENTS.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      <select
        value={filters.type}
        onChange={(e) => set('type', e.target.value as 'TEACHING' | 'NON-TEACHING' | '')}
        className="px-3 py-2 text-sm border border-[#E2E5EA] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
      >
        <option value="">All Types</option>
        <option value="TEACHING">Teaching</option>
        <option value="NON-TEACHING">Non-Teaching</option>
      </select>

      <select
        value={filters.status}
        onChange={(e) => set('status', e.target.value as StatusEnum | '')}
        className="px-3 py-2 text-sm border border-[#E2E5EA] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
      >
        <option value="">All Statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
