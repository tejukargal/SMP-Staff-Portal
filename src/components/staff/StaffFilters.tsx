import { Search, X } from 'lucide-react';
import { DEPARTMENTS, STATUSES, DESIGNATIONS } from '@/constants/enums';
import type { DeptEnum, StatusEnum, DesignationEnum } from '@/types';

export interface StaffFiltersState {
  search: string;
  dept: DeptEnum | '';
  type: 'TEACHING' | 'NON-TEACHING' | '';
  status: StatusEnum | '';
  desig: DesignationEnum | '';
}

const DEFAULT_FILTERS: StaffFiltersState = { search: '', dept: '', type: '', status: '', desig: '' };

const fs = 'shrink-0 rounded-lg border border-sky-100 px-2 py-1.5 text-xs bg-white/80 focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 cursor-pointer text-gray-700 transition-colors';

interface Props {
  filters: StaffFiltersState;
  onChange: (filters: StaffFiltersState) => void;
}

export function StaffFilters({ filters, onChange }: Props) {
  const set = <K extends keyof StaffFiltersState>(key: K, value: StaffFiltersState[K]) =>
    onChange({ ...filters, [key]: value });

  const isActive =
    filters.search !== '' || filters.dept !== '' || filters.type !== '' || filters.status !== '' || filters.desig !== '';

  return (
    <div
      className="flex-1 min-w-0 rounded-2xl border border-sky-100 overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 4px 0 rgba(14,165,233,0.06)' }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-sky-100 bg-white/80 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>

        <select className={fs} value={filters.dept} onChange={(e) => set('dept', e.target.value as DeptEnum | '')}>
          <option value="">All Depts</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <select className={fs} value={filters.type} onChange={(e) => set('type', e.target.value as 'TEACHING' | 'NON-TEACHING' | '')}>
          <option value="">All Types</option>
          <option value="TEACHING">Teaching</option>
          <option value="NON-TEACHING">Non-Teaching</option>
        </select>

        <select className={fs} value={filters.status} onChange={(e) => set('status', e.target.value as StatusEnum | '')}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className={fs} value={filters.desig} onChange={(e) => set('desig', e.target.value as DesignationEnum | '')}>
          <option value="">All Designations</option>
          {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        {isActive && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
