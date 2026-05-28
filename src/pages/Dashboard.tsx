import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, Briefcase, UserCheck, Plus, DollarSign, FileText, Search, Eye } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { PageSpinner } from '@/components/ui/Spinner';
import { DeptBadge } from '@/components/ui/Badge';
import { DEPARTMENTS, DEPT_COLORS, STATUSES } from '@/constants/enums';
import type { DeptEnum, StatusEnum, StaffRecord } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_COLORS: Record<StatusEnum, string> = {
  'IN SERVICE':  '#22c55e',
  'RTRD':        '#94a3b8',
  'TRANSFERRED': '#38bdf8',
  'RESIGNED':    '#fbbf24',
  'DECEASED':    '#475569',
};

// ── Card ─────────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  gradientFrom: string;
  gradientTo: string;
  delay: number;
}

function StatCard({ label, value, sub, icon: Icon, gradientFrom, gradientTo, delay }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
        animation: `content-enter 0.35s ease-out ${delay}ms both`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      {/* Background icon watermark */}
      <div className="absolute right-3 bottom-2 opacity-10">
        <Icon style={{ width: 64, height: 64 }} />
      </div>

      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.25)' }}
      >
        <Icon className="w-4.5 h-4.5 text-white" style={{ width: 18, height: 18 }} />
      </div>

      <div>
        <p className="text-2xl font-bold text-white leading-none">
          <AnimNum value={value} />
        </p>
        <p className="text-xs text-white/80 mt-1 font-medium">{label}</p>
        {sub && <p className="text-[10px] text-white/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({ title, children, delay, className = '' }: {
  title: string; children: React.ReactNode; delay: number; className?: string;
}) {
  return (
    <div
      className={`bg-white/80 rounded-2xl border border-sky-100 p-5 flex flex-col gap-4 ${className}`}
      style={{
        animation: `content-enter 0.35s ease-out ${delay}ms both`,
        boxShadow: '0 1px 4px rgba(14,165,233,0.07)',
      }}
    >
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</h2>
      {children}
    </div>
  );
}

// ── Stacked bar row ───────────────────────────────────────────────────────────

function DeptBar({ dept, teaching, nonTeaching, max, delay }: {
  dept: DeptEnum; teaching: number; nonTeaching: number; max: number; delay: number;
}) {
  const color = DEPT_COLORS[dept];
  const total = teaching + nonTeaching;
  const tPct  = max > 0 ? (teaching   / max) * 100 : 0;
  const ntPct = max > 0 ? (nonTeaching / max) * 100 : 0;

  return (
    <div className="flex items-center gap-3 group">
      <span className="w-14 text-[11px] font-semibold text-gray-500 text-right shrink-0">{dept}</span>
      <div className="flex-1 h-6 bg-sky-50 rounded-lg overflow-hidden flex">
        <div
          className="h-full rounded-l-lg"
          style={{
            width: `${tPct}%`,
            backgroundColor: color,
            animation: `bar-grow 0.55s ease-out ${delay}ms both`,
            transformOrigin: 'left',
            minWidth: tPct > 0 ? 4 : 0,
          }}
        />
        <div
          className="h-full"
          style={{
            width: `${ntPct}%`,
            backgroundColor: color,
            opacity: 0.35,
            animation: `bar-grow 0.55s ease-out ${delay + 80}ms both`,
            transformOrigin: 'left',
            minWidth: ntPct > 0 ? 4 : 0,
          }}
        />
      </div>
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        {total > 0 ? (
          <>
            <span className="text-xs font-bold text-gray-800 tabular-nums w-5 text-right">{total}</span>
            <span className="text-[10px] text-gray-400 tabular-nums">{teaching}T · {nonTeaching}NT</span>
          </>
        ) : (
          <span className="text-[10px] text-gray-300">—</span>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { staff, loading } = useStaff();
  const navigate = useNavigate();

  // ── Search ─────────────────────────────────────────────────────────────────
  const [searchQ, setSearchQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchCtx, setSearchCtx] = useState<{ x: number; y: number; record: StaffRecord } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = searchQ.trim().toUpperCase();
    if (!q) return [];
    return staff
      .filter(s =>
        s.name.toUpperCase().includes(q) ||
        s.empId.toUpperCase().includes(q) ||
        (s.phone && s.phone.includes(q))
      )
      .slice(0, 3);
  }, [staff, searchQ]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchCtx(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchCtx(null); setSearchQ(''); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function openSearchCtx(e: React.MouseEvent, record: StaffRecord) {
    e.preventDefault();
    const menuW = 140, menuH = 44;
    const x = Math.min(e.clientX, window.innerWidth  - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setSearchCtx({ x, y, record });
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const inService = staff.filter(s => s.status === 'IN SERVICE');
    return {
      total:       staff.length,
      inService:   inService.length,
      teaching:    inService.filter(s => s.type === 'TEACHING').length,
      nonTeaching: inService.filter(s => s.type === 'NON-TEACHING').length,
    };
  }, [staff]);

  // ── Dept × type breakdown (in-service only) ────────────────────────────────
  const deptStats = useMemo(() =>
    DEPARTMENTS.map(dept => {
      const all       = staff.filter(s => s.dept === dept);
      const inService = all.filter(s => s.status === 'IN SERVICE');
      return {
        dept: dept as DeptEnum,
        total:       all.length,
        inService:   inService.length,
        teaching:    inService.filter(s => s.type === 'TEACHING').length,
        nonTeaching: inService.filter(s => s.type === 'NON-TEACHING').length,
      };
    }),
    [staff]
  );

  const maxInService = Math.max(...deptStats.map(d => d.inService), 1);

  // ── Status breakdown ───────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const map: Partial<Record<StatusEnum, number>> = {};
    staff.forEach(s => { map[s.status] = (map[s.status] ?? 0) + 1; });
    return STATUSES.map(s => ({ status: s, count: map[s] ?? 0 })).filter(s => s.count > 0);
  }, [staff]);

  const maxStatus = Math.max(...statusCounts.map(s => s.count), 1);

  // ── Designation breakdown (in-service) ─────────────────────────────────────
  const designationBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    staff.filter(s => s.status === 'IN SERVICE')
         .forEach(s => { map[s.designation] = (map[s.designation] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 9);
  }, [staff]);

  const maxDesig = Math.max(...designationBreakdown.map(d => d[1]), 1);

  // ── Category (GEN/OBC/SC/ST…) breakdown ───────────────────────────────────
  const { catRows, catTotals } = useMemo(() => {
    const map: Record<string, { tInSvc: number; tOthers: number; ntInSvc: number; ntOthers: number }> = {};
    staff.forEach(s => {
      const key = (s.category?.trim().toUpperCase()) || 'NOT SPECIFIED';
      if (!map[key]) map[key] = { tInSvc: 0, tOthers: 0, ntInSvc: 0, ntOthers: 0 };
      const isInSvc = s.status === 'IN SERVICE';
      const isT = s.type === 'TEACHING';
      if (isT  &&  isInSvc) map[key].tInSvc++;
      if (isT  && !isInSvc) map[key].tOthers++;
      if (!isT &&  isInSvc) map[key].ntInSvc++;
      if (!isT && !isInSvc) map[key].ntOthers++;
    });
    const ORDER = ['GEN', 'OBC', 'SC', 'ST'];
    const rows = Object.entries(map)
      .sort(([a], [b]) => {
        const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      })
      .map(([cat, v]) => ({
        cat,
        tInSvc: v.tInSvc, tOthers: v.tOthers, tTotal: v.tInSvc + v.tOthers,
        ntInSvc: v.ntInSvc, ntOthers: v.ntOthers, ntTotal: v.ntInSvc + v.ntOthers,
        total: v.tInSvc + v.tOthers + v.ntInSvc + v.ntOthers,
      }));
    const totals = rows.reduce(
      (acc, r) => ({
        tInSvc: acc.tInSvc + r.tInSvc, tOthers: acc.tOthers + r.tOthers, tTotal: acc.tTotal + r.tTotal,
        ntInSvc: acc.ntInSvc + r.ntInSvc, ntOthers: acc.ntOthers + r.ntOthers, ntTotal: acc.ntTotal + r.ntTotal,
        total: acc.total + r.total,
      }),
      { tInSvc: 0, tOthers: 0, tTotal: 0, ntInSvc: 0, ntOthers: 0, ntTotal: 0, total: 0 }
    );
    return { catRows: rows, catTotals: totals };
  }, [staff]);

  // ── Dept × category full breakdown (all statuses) ─────────────────────────
  const { categoryStats, categoryTotals } = useMemo(() => {
    const rows = DEPARTMENTS.map(dept => {
      const deptStaff = staff.filter(s => s.dept === dept);
      const tInSvc  = deptStaff.filter(s => s.type === 'TEACHING'     && s.status === 'IN SERVICE').length;
      const tOthers = deptStaff.filter(s => s.type === 'TEACHING'     && s.status !== 'IN SERVICE').length;
      const ntInSvc = deptStaff.filter(s => s.type === 'NON-TEACHING' && s.status === 'IN SERVICE').length;
      const ntOthers= deptStaff.filter(s => s.type === 'NON-TEACHING' && s.status !== 'IN SERVICE').length;
      return {
        dept: dept as DeptEnum,
        tInSvc, tOthers, tTotal: tInSvc + tOthers,
        ntInSvc, ntOthers, ntTotal: ntInSvc + ntOthers,
        total: deptStaff.length,
      };
    });
    const totals = rows.reduce(
      (acc, r) => ({
        tInSvc:   acc.tInSvc   + r.tInSvc,
        tOthers:  acc.tOthers  + r.tOthers,
        tTotal:   acc.tTotal   + r.tTotal,
        ntInSvc:  acc.ntInSvc  + r.ntInSvc,
        ntOthers: acc.ntOthers + r.ntOthers,
        ntTotal:  acc.ntTotal  + r.ntTotal,
        total:    acc.total    + r.total,
      }),
      { tInSvc: 0, tOthers: 0, tTotal: 0, ntInSvc: 0, ntOthers: 0, ntTotal: 0, total: 0 }
    );
    return { categoryStats: rows, categoryTotals: totals };
  }, [staff]);

  if (loading) return <PageSpinner />;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Staff search ─────────────────────────────────────────────────── */}
      <div ref={searchRef} className="relative">
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-sky-100 bg-white/80"
          style={{ backdropFilter: 'blur(8px)', boxShadow: '0 1px 6px rgba(14,165,233,0.08)' }}
        >
          <Search className="w-4 h-4 text-sky-400 shrink-0" />
          <input
            type="text"
            value={searchQ}
            placeholder="Search staff by name, employee ID or phone…"
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
            onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
          />
          {searchQ && (
            <button
              onClick={() => { setSearchQ(''); setSearchOpen(false); }}
              className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
            >×</button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {searchOpen && suggestions.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-sky-100 bg-white shadow-xl overflow-hidden z-40"
            style={{ animation: 'modal-enter 0.12s ease-out' }}
          >
            {suggestions.map((s, i) => (
              <div
                key={s.id}
                onMouseDown={() => { navigate(`/staff/${s.id}`, { state: { from: 'dashboard' } }); setSearchOpen(false); setSearchQ(''); }}
                onContextMenu={e => openSearchCtx(e, s)}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-sky-50 transition-colors border-b border-sky-50 last:border-0 select-none"
                style={{ animation: `content-enter 0.18s ease-out ${i * 40}ms both` }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                  style={{ background: `linear-gradient(135deg, ${DEPT_COLORS[s.dept]} 0%, ${DEPT_COLORS[s.dept]}99 100%)` }}
                >
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                  <p className="text-[11px] text-gray-400">{s.empId}{s.phone ? ` · ${s.phone}` : ''}</p>
                </div>
                <DeptBadge dept={s.dept} />
              </div>
            ))}
          </div>
        )}

        {searchOpen && searchQ.trim() && suggestions.length === 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-sky-100 bg-white shadow-xl px-4 py-3 z-40 text-sm text-gray-400"
            style={{ animation: 'modal-enter 0.12s ease-out' }}
          >
            No staff found matching "{searchQ.trim()}"
          </div>
        )}
      </div>

      {/* Context menu for search result */}
      {searchCtx && (
        <div
          onMouseDown={e => e.stopPropagation()}
          className="fixed z-50 min-w-36 rounded-lg border border-[#E2E5EA] bg-white shadow-xl py-1 text-sm"
          style={{ top: searchCtx.y, left: searchCtx.x, animation: 'modal-enter 0.12s ease-out' }}
        >
          <button
            onMouseDown={() => { navigate(`/staff/${searchCtx.record.id}`, { state: { from: 'dashboard' } }); setSearchCtx(null); setSearchOpen(false); setSearchQ(''); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[#374151] hover:bg-[#F7F8FA] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
            View Profile
          </button>
        </div>
      )}

      {/* ── Row 1: Stat cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Staff"
          value={stats.total}
          sub="All statuses"
          icon={Users}
          gradientFrom="#0284C7"
          gradientTo="#0369A1"
          delay={0}
        />
        <StatCard
          label="In Service"
          value={stats.inService}
          sub={`${stats.total ? Math.round((stats.inService / stats.total) * 100) : 0}% of total`}
          icon={UserCheck}
          gradientFrom="#059669"
          gradientTo="#047857"
          delay={60}
        />
        <StatCard
          label="Teaching"
          value={stats.teaching}
          sub="In-service faculty"
          icon={GraduationCap}
          gradientFrom="#7C3AED"
          gradientTo="#6D28D9"
          delay={120}
        />
        <StatCard
          label="Non-Teaching"
          value={stats.nonTeaching}
          sub="In-service staff"
          icon={Briefcase}
          gradientFrom="#D97706"
          gradientTo="#B45309"
          delay={180}
        />
      </div>

      {/* ── Row 2: Dept chart + Status breakdown ─────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Stacked dept bar chart */}
        <Panel title="Department-wise Staff  ·  In Service" delay={220} className="col-span-2">
          {/* Legend */}
          <div className="flex items-center gap-4 -mt-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0EA5E9' }} />
              <span className="text-[10px] text-gray-400 font-medium">Teaching</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#0EA5E9', opacity: 0.35 }} />
              <span className="text-[10px] text-gray-400 font-medium">Non-Teaching</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {deptStats.map(({ dept, teaching, nonTeaching }, i) => (
              <DeptBar
                key={dept}
                dept={dept}
                teaching={teaching}
                nonTeaching={nonTeaching}
                max={maxInService}
                delay={260 + i * 70}
              />
            ))}
          </div>
        </Panel>

        {/* Status breakdown */}
        <Panel title="Staff Status" delay={240}>
          <div className="flex flex-col gap-3">
            {statusCounts.map(({ status, count }) => (
              <div key={status} className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600 font-medium">{status}</span>
                  <span className="text-xs font-bold text-gray-800 tabular-nums">{count}</span>
                </div>
                <div className="h-1.5 bg-sky-50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / maxStatus) * 100}%`,
                      backgroundColor: STATUS_COLORS[status],
                      animation: 'bar-grow 0.5s ease-out both',
                      transformOrigin: 'left',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="mt-auto pt-3 border-t border-sky-50 flex flex-col gap-1.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Quick Actions</p>
            {[
              { label: 'Add Staff',        icon: Plus,      to: '/staff/new', color: '#0284C7' },
              { label: 'Salary Bill',       icon: DollarSign,to: '/salary',   color: '#059669' },
              { label: 'Reports',           icon: FileText,  to: '/reports',  color: '#7C3AED' },
            ].map(({ label, icon: Icon, to, color }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-sky-100 bg-white/60 hover:bg-sky-50 hover:border-sky-200 transition-all duration-150 text-xs font-medium text-gray-600 hover:text-gray-900 group w-full text-left"
              >
                <Icon className="w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:scale-110" style={{ color }} />
                {label}
              </button>
            ))}
          </div>
        </Panel>

      </div>

      {/* ── Row 3: Dept stats table ───────────────────────────────────────── */}
      <Panel title="Department Summary" delay={400}>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sky-100">
                {['Department', 'Total Staff', 'In Service', 'Teaching', 'Non-Teaching', 'Retired / Others'].map(h => (
                  <th key={h} className="pb-2 text-left font-semibold text-gray-400 uppercase tracking-wide text-[10px] pr-6 last:pr-0 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deptStats.map(({ dept, total, inService, teaching, nonTeaching }, i) => {
                const others = total - inService;
                return (
                  <tr
                    key={dept}
                    className="border-b border-sky-50 last:border-0 hover:bg-sky-50/50 transition-colors"
                    style={{ animation: `content-enter 0.3s ease-out ${420 + i * 40}ms both` }}
                  >
                    <td className="py-1.5 pr-6">
                      <DeptBadge dept={dept} />
                    </td>
                    <td className="py-1.5 pr-6">
                      <span className="font-bold text-gray-800 tabular-nums">{total}</span>
                    </td>
                    <td className="py-1.5 pr-6">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800 tabular-nums w-6">{inService}</span>
                        {total > 0 && (
                          <div className="flex-1 max-w-20 h-1.5 bg-sky-50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(inService / total) * 100}%`,
                                backgroundColor: DEPT_COLORS[dept],
                                opacity: 0.7,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 pr-6">
                      <span className="font-bold text-violet-600 tabular-nums">{teaching}</span>
                    </td>
                    <td className="py-1.5 pr-6">
                      <span className="font-bold text-amber-600 tabular-nums">{nonTeaching}</span>
                    </td>
                    <td className="py-1.5">
                      <span className={`tabular-nums font-bold ${others > 0 ? 'text-gray-500' : 'text-gray-200'}`}>{others}</span>
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t-2 border-sky-100 bg-sky-50/40">
                <td className="py-1.5 pr-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</td>
                <td className="py-1.5 pr-6 font-bold text-sky-700 tabular-nums">{stats.total}</td>
                <td className="py-1.5 pr-6 font-bold text-sky-700 tabular-nums">{stats.inService}</td>
                <td className="py-1.5 pr-6 font-bold text-violet-600 tabular-nums">{stats.teaching}</td>
                <td className="py-1.5 pr-6 font-bold text-amber-600 tabular-nums">{stats.nonTeaching}</td>
                <td className="py-1.5 font-bold text-gray-500 tabular-nums">{stats.total - stats.inService}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── Row 4: Designation + Category-wise table ─────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Designation breakdown */}
        <Panel title="By Designation  ·  In Service" delay={500} className="h-full">
          {designationBreakdown.length === 0
            ? <p className="text-sm text-gray-300">No data yet</p>
            : (
              <div className="flex-1 flex flex-col justify-between">
                {designationBreakdown.map(([desig, count]) => (
                  <div key={desig} className="flex items-center gap-2.5">
                    <span className="text-sm font-medium text-gray-700 flex-1 truncate" title={desig}>{desig}</span>
                    <div className="w-20 h-1.5 bg-sky-50 rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{
                          width: `${(count / maxDesig) * 100}%`,
                          animation: 'bar-grow 0.5s ease-out both',
                          transformOrigin: 'left',
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-800 tabular-nums w-5 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
        </Panel>

        {/* Category-wise table */}
        <Panel title="Department × Category  ·  All Staff" delay={520} className="col-span-2">
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sky-100">
                  <th className="pb-2 text-left font-semibold text-gray-400 uppercase tracking-wide text-[10px] pr-4 whitespace-nowrap">Dept</th>
                  <th colSpan={3} className="pb-1 text-center font-bold text-[10px] uppercase tracking-wide pr-4" style={{ color: '#7C3AED' }}>Teaching</th>
                  <th colSpan={3} className="pb-1 text-center font-bold text-[10px] uppercase tracking-wide pr-4" style={{ color: '#D97706' }}>Non-Teaching</th>
                  <th className="pb-2 text-right font-semibold text-gray-400 uppercase tracking-wide text-[10px] whitespace-nowrap">Total</th>
                </tr>
                <tr className="border-b border-sky-200">
                  <th className="py-1.5 pr-4" />
                  <th className="py-1.5 text-center text-[10px] font-semibold text-gray-500 pr-2 whitespace-nowrap align-middle">InSvc</th>
                  <th className="py-1.5 text-center text-[10px] font-semibold text-gray-500 pr-2 whitespace-nowrap align-middle">Others</th>
                  <th className="py-1.5 text-center text-[10px] font-semibold pr-4 whitespace-nowrap align-middle" style={{ color: '#7C3AED' }}>Sub</th>
                  <th className="py-1.5 text-center text-[10px] font-semibold text-gray-500 pr-2 whitespace-nowrap align-middle">InSvc</th>
                  <th className="py-1.5 text-center text-[10px] font-semibold text-gray-500 pr-2 whitespace-nowrap align-middle">Others</th>
                  <th className="py-1.5 text-center text-[10px] font-semibold pr-4 whitespace-nowrap align-middle" style={{ color: '#D97706' }}>Sub</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {categoryStats.map(({ dept, tInSvc, tOthers, tTotal, ntInSvc, ntOthers, ntTotal, total }, i) => (
                  <tr
                    key={dept}
                    className="border-b border-sky-200 last:border-0 hover:bg-sky-50/50 transition-colors"
                    style={{ animation: `content-enter 0.3s ease-out ${540 + i * 40}ms both` }}
                  >
                    <td className="py-1.5 pr-4"><DeptBadge dept={dept} /></td>
                    <td className="py-1.5 pr-2 text-center tabular-nums font-medium text-gray-700">{tInSvc  || <span className="text-gray-200">—</span>}</td>
                    <td className="py-1.5 pr-2 text-center tabular-nums font-medium text-gray-500">{tOthers || <span className="text-gray-200">—</span>}</td>
                    <td className="py-1.5 pr-4 text-center tabular-nums font-bold" style={{ color: '#7C3AED' }}>{tTotal  || <span className="text-gray-200">—</span>}</td>
                    <td className="py-1.5 pr-2 text-center tabular-nums font-medium text-gray-700">{ntInSvc  || <span className="text-gray-200">—</span>}</td>
                    <td className="py-1.5 pr-2 text-center tabular-nums font-medium text-gray-500">{ntOthers || <span className="text-gray-200">—</span>}</td>
                    <td className="py-1.5 pr-4 text-center tabular-nums font-bold" style={{ color: '#D97706' }}>{ntTotal || <span className="text-gray-200">—</span>}</td>
                    <td className="py-1.5 text-right tabular-nums font-bold text-gray-800">{total || <span className="text-gray-300">—</span>}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-sky-100 bg-sky-50/40">
                  <td className="py-1.5 pr-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</td>
                  <td className="py-1.5 pr-2 text-center font-bold text-gray-700 tabular-nums">{categoryTotals.tInSvc}</td>
                  <td className="py-1.5 pr-2 text-center font-bold text-gray-500 tabular-nums">{categoryTotals.tOthers}</td>
                  <td className="py-1.5 pr-4 text-center font-bold tabular-nums" style={{ color: '#7C3AED' }}>{categoryTotals.tTotal}</td>
                  <td className="py-1.5 pr-2 text-center font-bold text-gray-700 tabular-nums">{categoryTotals.ntInSvc}</td>
                  <td className="py-1.5 pr-2 text-center font-bold text-gray-500 tabular-nums">{categoryTotals.ntOthers}</td>
                  <td className="py-1.5 pr-4 text-center font-bold tabular-nums" style={{ color: '#D97706' }}>{categoryTotals.ntTotal}</td>
                  <td className="py-1.5 text-right font-bold text-sky-700 tabular-nums">{categoryTotals.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

      </div>

      {/* ── Row 5: Category-wise table ───────────────────────────────────── */}
      <Panel title="Category-wise Staff Count  ·  All Staff" delay={580}>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sky-100">
                <th className="pb-2 text-left font-semibold text-gray-400 uppercase tracking-wide text-[10px] pr-6 whitespace-nowrap">Category</th>
                <th colSpan={3} className="pb-1 text-center font-bold text-[10px] uppercase tracking-wide pr-6" style={{ color: '#7C3AED' }}>Teaching</th>
                <th colSpan={3} className="pb-1 text-center font-bold text-[10px] uppercase tracking-wide pr-6" style={{ color: '#D97706' }}>Non-Teaching</th>
                <th className="pb-2 text-right font-semibold text-sky-600 uppercase tracking-wide text-[10px] whitespace-nowrap">Total</th>
              </tr>
              <tr className="border-b border-sky-200">
                <th className="py-1.5 pr-6" />
                <th className="py-1.5 text-center text-[10px] font-semibold text-gray-500 pr-3 whitespace-nowrap align-middle">In Service</th>
                <th className="py-1.5 text-center text-[10px] font-semibold text-gray-500 pr-3 whitespace-nowrap align-middle">Others</th>
                <th className="py-1.5 text-center text-[10px] font-semibold pr-6 whitespace-nowrap align-middle" style={{ color: '#7C3AED' }}>Sub-total</th>
                <th className="py-1.5 text-center text-[10px] font-semibold text-gray-500 pr-3 whitespace-nowrap align-middle">In Service</th>
                <th className="py-1.5 text-center text-[10px] font-semibold text-gray-500 pr-3 whitespace-nowrap align-middle">Others</th>
                <th className="py-1.5 text-center text-[10px] font-semibold pr-6 whitespace-nowrap align-middle" style={{ color: '#D97706' }}>Sub-total</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {catRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-gray-300">No category data recorded yet</td>
                </tr>
              ) : catRows.map(({ cat, tInSvc, tOthers, tTotal, ntInSvc, ntOthers, ntTotal, total }, i) => (
                <tr
                  key={cat}
                  className="border-b border-sky-200 last:border-0 hover:bg-sky-50/50 transition-colors"
                  style={{ animation: `content-enter 0.3s ease-out ${600 + i * 40}ms both` }}
                >
                  <td className="py-1.5 pr-6">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-100 whitespace-nowrap">{cat}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-center tabular-nums font-medium text-gray-700">{tInSvc   || <span className="text-gray-200">—</span>}</td>
                  <td className="py-1.5 pr-3 text-center tabular-nums font-medium text-gray-500">{tOthers  || <span className="text-gray-200">—</span>}</td>
                  <td className="py-1.5 pr-6 text-center tabular-nums font-bold" style={{ color: '#7C3AED' }}>{tTotal   || <span className="text-gray-200">—</span>}</td>
                  <td className="py-1.5 pr-3 text-center tabular-nums font-medium text-gray-700">{ntInSvc  || <span className="text-gray-200">—</span>}</td>
                  <td className="py-1.5 pr-3 text-center tabular-nums font-medium text-gray-500">{ntOthers || <span className="text-gray-200">—</span>}</td>
                  <td className="py-1.5 pr-6 text-center tabular-nums font-bold" style={{ color: '#D97706' }}>{ntTotal  || <span className="text-gray-200">—</span>}</td>
                  <td className="py-1.5 text-right tabular-nums font-bold text-gray-800">{total || <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-sky-100 bg-sky-50/40">
                <td className="py-1.5 pr-6 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</td>
                <td className="py-1.5 pr-3 text-center font-bold text-gray-700 tabular-nums">{catTotals.tInSvc}</td>
                <td className="py-1.5 pr-3 text-center font-bold text-gray-500 tabular-nums">{catTotals.tOthers}</td>
                <td className="py-1.5 pr-6 text-center font-bold tabular-nums" style={{ color: '#7C3AED' }}>{catTotals.tTotal}</td>
                <td className="py-1.5 pr-3 text-center font-bold text-gray-700 tabular-nums">{catTotals.ntInSvc}</td>
                <td className="py-1.5 pr-3 text-center font-bold text-gray-500 tabular-nums">{catTotals.ntOthers}</td>
                <td className="py-1.5 pr-6 text-center font-bold tabular-nums" style={{ color: '#D97706' }}>{catTotals.ntTotal}</td>
                <td className="py-1.5 text-right font-bold text-sky-700 tabular-nums">{catTotals.total}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

    </div>
  );
}
