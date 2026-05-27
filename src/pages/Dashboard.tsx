import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Briefcase, UserCheck, Plus, DollarSign, FileText } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { PageSpinner } from '@/components/ui/Spinner';
import { DeptBadge, StatusBadge } from '@/components/ui/Badge';
import { DEPARTMENTS, DEPT_COLORS } from '@/constants/enums';
import { formatDate } from '@/utils/dateUtils';
import type { DeptEnum } from '@/types';

function AnimNum({ value }: { value: number }) {
  return (
    <span
      key={value}
      className="tabular-nums"
      style={{ display: 'inline-block', animation: 'stat-pop 0.3s ease-out' }}
    >
      {value}
    </span>
  );
}

export default function Dashboard() {
  const { staff, loading } = useStaff();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const inService = staff.filter((s) => s.status === 'IN SERVICE');
    return {
      total:      inService.length,
      teaching:   inService.filter((s) => s.type === 'TEACHING').length,
      nonTeaching:inService.filter((s) => s.type === 'NON-TEACHING').length,
      retired:    staff.filter((s) => s.status === 'RTRD').length,
    };
  }, [staff]);

  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    DEPARTMENTS.forEach((d) => { counts[d] = 0; });
    staff.filter((s) => s.status === 'IN SERVICE')
         .forEach((s) => { counts[s.dept] = (counts[s.dept] ?? 0) + 1; });
    return counts;
  }, [staff]);

  const maxDept = Math.max(...Object.values(deptCounts), 1);

  const designationBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    staff.filter((s) => s.status === 'IN SERVICE')
         .forEach((s) => { map[s.designation] = (map[s.designation] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [staff]);

  const recent = useMemo(() =>
    [...staff]
      .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0))
      .slice(0, 5),
    [staff]
  );

  if (loading) return <PageSpinner />;

  const STAT_CARDS = [
    { label: 'Total In Service', value: stats.total,       icon: Users,         color: '#1B3A6B', bg: '#EEF2FF' },
    { label: 'Teaching Staff',   value: stats.teaching,    icon: GraduationCap, color: '#10B981', bg: '#ECFDF5' },
    { label: 'Non-Teaching',     value: stats.nonTeaching, icon: Briefcase,     color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Retired',          value: stats.retired,     icon: UserCheck,     color: '#6B7280', bg: '#F9FAFB' },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }, idx) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-[#E2E5EA] p-5 flex items-center gap-4 cursor-default transition-transform duration-200 ease-out hover:scale-[1.025] hover:shadow-md"
            style={{
              animation: `content-enter 0.3s ease-out ${idx * 55}ms both`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: bg }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#111827]">
                <AnimNum value={value} />
              </p>
              <p className="text-xs text-[#6B7280] mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Dept bar chart */}
        <div
          className="col-span-2 bg-white rounded-2xl border border-[#E2E5EA] p-5"
          style={{ animation: 'content-enter 0.35s ease-out 0.15s both', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          <h2 className="text-sm font-semibold text-[#111827] mb-4">Department-wise Staff (In Service)</h2>
          <div className="flex flex-col gap-2.5">
            {DEPARTMENTS.map((dept, i) => {
              const count = deptCounts[dept] ?? 0;
              const pct = maxDept > 0 ? (count / maxDept) * 100 : 0;
              return (
                <div key={dept} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#6B7280] w-14 shrink-0">{dept}</span>
                  <div className="flex-1 h-6 bg-[#F7F8FA] rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-700 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: DEPT_COLORS[dept as DeptEnum],
                        animation: `bar-grow 0.6s ease-out ${i * 80}ms both`,
                        transformOrigin: 'left',
                      }}
                    >
                      {count > 0 && (
                        <span className="text-white text-xs font-bold">{count}</span>
                      )}
                    </div>
                  </div>
                  {count === 0 && <span className="text-xs text-[#9CA3AF]">0</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Designation breakdown */}
        <div
          className="bg-white rounded-2xl border border-[#E2E5EA] p-5"
          style={{ animation: 'content-enter 0.35s ease-out 0.2s both', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          <h2 className="text-sm font-semibold text-[#111827] mb-4">By Designation</h2>
          {designationBreakdown.length === 0
            ? <p className="text-sm text-[#9CA3AF]">No data yet</p>
            : (
              <div className="flex flex-col gap-1 overflow-y-auto max-h-60 no-scrollbar">
                {designationBreakdown.map(([desig, count]) => (
                  <div key={desig} className="flex justify-between items-center text-xs py-1.5 border-b border-[#F3F4F6]">
                    <span className="text-[#374151]">{desig}</span>
                    <span
                      className="font-bold text-[#1B3A6B] tabular-nums"
                      style={{ animation: 'stat-pop 0.3s ease-out' }}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Recent records */}
        <div
          className="col-span-2 bg-white rounded-2xl border border-[#E2E5EA] p-5"
          style={{ animation: 'content-enter 0.35s ease-out 0.25s both', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          <h2 className="text-sm font-semibold text-[#111827] mb-4">Recently Modified</h2>
          {recent.length === 0
            ? <p className="text-sm text-[#9CA3AF]">No records yet</p>
            : (
              <div>
                {recent.map((s, i) => (
                  <div
                    key={s.id}
                    onClick={() => navigate(`/staff/${s.id}`)}
                    className="flex items-center gap-3 py-2.5 border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-[#F7F8FA] -mx-3 px-3 rounded-lg transition-colors duration-150"
                    style={{ animation: `content-enter 0.3s ease-out ${i * 50}ms both` }}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#1B3A6B] flex items-center justify-center shrink-0">
                      <span className="text-white text-xs font-bold">{s.name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111827] truncate">{s.name}</p>
                      <p className="text-xs text-[#6B7280]">{s.designation}</p>
                    </div>
                    <DeptBadge dept={s.dept} />
                    <span className="text-xs text-[#9CA3AF] shrink-0">{formatDate(s.doe)}</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Quick links */}
        <div
          className="bg-white rounded-2xl border border-[#E2E5EA] p-5"
          style={{ animation: 'content-enter 0.35s ease-out 0.3s both', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        >
          <h2 className="text-sm font-semibold text-[#111827] mb-4">Quick Actions</h2>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Add Staff',       icon: Plus,       to: '/staff/new', color: '#1B3A6B' },
              { label: 'Draft Salary Bill',icon: DollarSign, to: '/salary',   color: '#10B981' },
              { label: 'View Reports',    icon: FileText,   to: '/reports',   color: '#8B5CF6' },
            ].map(({ label, icon: Icon, to, color }, i) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E2E5EA] hover:border-[#1B3A6B] hover:bg-[#EEF2FF] transition-all duration-150 text-sm font-medium text-[#374151] hover:text-[#1B3A6B] group"
                style={{ animation: `content-enter 0.3s ease-out ${0.3 + i * 0.06}s both` }}
              >
                <Icon className="w-4 h-4 group-hover:scale-110 transition-transform duration-150" style={{ color }} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent staff table */}
      <div
        className="bg-white rounded-2xl border border-[#E2E5EA] p-5"
        style={{ animation: 'content-enter 0.35s ease-out 0.35s both', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      >
        <h2 className="text-sm font-semibold text-[#111827] mb-4">Latest Staff Records</h2>
        {recent.length === 0
          ? <p className="text-sm text-[#9CA3AF]">No staff records added yet</p>
          : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E5EA]">
                  {['Name', 'Dept', 'Status', 'DOE'].map((h) => (
                    <th key={h} className="pb-2 text-left text-xs text-[#6B7280] uppercase tracking-wide font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/staff/${s.id}`)}
                    className="border-b border-[#F3F4F6] last:border-0 cursor-pointer hover:bg-[#F7F8FA] transition-colors duration-150"
                  >
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2"><DeptBadge dept={s.dept} /></td>
                    <td className="py-2"><StatusBadge status={s.status} /></td>
                    <td className="py-2 text-xs text-[#6B7280]">{formatDate(s.doe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
