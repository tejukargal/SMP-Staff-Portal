import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, Briefcase, UserCheck,
  Search, Eye, ClipboardList, X, FileText, Sheet,
} from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { getSanctionedPosts } from '@/firebase/firestore';
import { PageSpinner } from '@/components/ui/Spinner';
import { DeptBadge } from '@/components/ui/Badge';
import { DEPARTMENTS, DESIGNATIONS, DEPT_COLORS, DESIGNATION_ORDER } from '@/constants/enums';
import type { DeptEnum, StaffRecord, SanctionedPost } from '@/types';
import {
  exportVacancyMatrixPdf, exportVacancyMatrixXlsx,
  exportDeptVacancySummaryPdf, exportDeptVacancySummaryXlsx,
  exportDesignationBreakdownPdf, exportDesignationBreakdownXlsx,
  exportDeptCategoryPdf, exportDeptCategoryXlsx,
  exportCategoryDeptMatrixPdf, exportCategoryDeptMatrixXlsx,
} from '@/utils/dashboardExport';

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


// ── Flat Stat Card ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  bg: string;
  iconBg: string;
  iconColor: string;
  numColor: string;
  borderColor: string;
  delay: number;
}

function StatCard({ label, value, sub, icon: Icon, bg, iconBg, iconColor, numColor, borderColor, delay }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{
        background: bg,
        border: `1.5px solid ${borderColor}`,
        animation: `content-enter 0.35s ease-out ${delay}ms both`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        <Icon style={{ width: 20, height: 20, color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none" style={{ color: numColor }}>
          <AnimNum value={value} />
        </p>
        <p className="text-xs font-semibold text-gray-600 mt-1">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}


// ── Panel wrapper ─────────────────────────────────────────────────────────────

function Panel({ title, subtitle, children, delay, action, className = '' }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay: number;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 px-5 pt-3 pb-5 flex flex-col gap-3 ${className}`}
      style={{
        animation: `content-enter 0.35s ease-out ${delay}ms both`,
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────

function Th({ children, align = 'left', className = '', style }: { children?: React.ReactNode; align?: 'left' | 'center' | 'right'; className?: string; style?: React.CSSProperties }) {
  return (
    <th className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 text-${align} whitespace-nowrap ${className}`} style={style}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', className = '' }: { children?: React.ReactNode; align?: 'left' | 'center' | 'right'; className?: string }) {
  return (
    <td className={`px-3 py-2 text-sm text-${align} ${className}`}>
      {children}
    </td>
  );
}


// ── Num cell helper ───────────────────────────────────────────────────────────

function Num({ v, color }: { v: number; color?: string }) {
  if (!v) return <span className="text-gray-200 font-medium">—</span>;
  return <span className="font-bold tabular-nums" style={{ color: color ?? '#1f2937' }}>{v}</span>;
}

// ── Export action buttons ─────────────────────────────────────────────────────

function ExportActions({ onPdf, onXls }: { onPdf: () => void; onXls: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onPdf}
        className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
      >
        <FileText className="w-3 h-3" />PDF
      </button>
      <button
        onClick={onXls}
        className="flex items-center gap-1 px-2 py-1 rounded border border-emerald-200 text-[10px] font-semibold text-emerald-600 hover:bg-emerald-50 transition-colors"
      >
        <Sheet className="w-3 h-3" />XLS
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { staff, loading } = useStaff();
  const navigate = useNavigate();

  // Sanctioned posts
  const [sanctionedPosts, setSanctionedPosts] = useState<SanctionedPost[]>([]);
  useEffect(() => {
    getSanctionedPosts().then(setSanctionedPosts).catch(() => {});
  }, []);

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

  const TEACHING_DESIGS = new Set(['PRINCIPAL', 'HOD', 'SEL GR LECT', 'LECTURER']);

  const { totalSanctioned, totalFilled, totalVacant, deptVacancyStats } = useMemo(() => {
    // Build dept+designation in-service counts once for all computations below
    const inSvcMap: Record<string, number> = {};
    staff.filter(s => s.status === 'IN SERVICE').forEach(s => {
      const k = `${s.dept}_${s.designation}`;
      inSvcMap[k] = (inSvcMap[k] ?? 0) + 1;
    });

    // Per-designation in-service count; LECTURER posts absorb SEL GR LECT staff too
    function getInSvc(dept: string, designation: string): number {
      if (designation === 'LECTURER')
        return (inSvcMap[`${dept}_LECTURER`] ?? 0) + (inSvcMap[`${dept}_SEL GR LECT`] ?? 0);
      return inSvcMap[`${dept}_${designation}`] ?? 0;
    }

    // SEL GR LECT fills LECTURER posts — exclude its own rows to avoid double-counting
    const effectivePosts  = sanctionedPosts.filter(p => p.designation !== 'SEL GR LECT');

    const totalSanctioned = effectivePosts.reduce((s, p) => s + p.sanctionedCount, 0);
    const totalFilled     = staff.filter(s => s.status === 'IN SERVICE').length;
    const totalVacant     = effectivePosts.reduce((sum, p) =>
      sum + Math.max(0, p.sanctionedCount - getInSvc(p.dept, p.designation)), 0);

    const deptVacancyStats = DEPARTMENTS.map(dept => {
      const deptPosts    = effectivePosts.filter(p => p.dept === dept);
      const sanctionedT  = deptPosts.filter(p =>  TEACHING_DESIGS.has(p.designation)).reduce((s, p) => s + p.sanctionedCount, 0);
      const sanctionedNT = deptPosts.filter(p => !TEACHING_DESIGS.has(p.designation)).reduce((s, p) => s + p.sanctionedCount, 0);
      const sanctioned   = sanctionedT + sanctionedNT;

      const deptInSvc = staff.filter(s => s.dept === dept && s.status === 'IN SERVICE');
      const filledT   = deptInSvc.filter(s => s.type === 'TEACHING').length;
      const filledNT  = deptInSvc.filter(s => s.type === 'NON-TEACHING').length;
      const inService = filledT + filledNT;

      const vacant   = deptPosts.reduce((sum, p) => sum + Math.max(0, p.sanctionedCount - getInSvc(dept, p.designation)), 0);
      const vacantT  = deptPosts.filter(p =>  TEACHING_DESIGS.has(p.designation)).reduce((sum, p) => sum + Math.max(0, p.sanctionedCount - getInSvc(dept, p.designation)), 0);
      const vacantNT = deptPosts.filter(p => !TEACHING_DESIGS.has(p.designation)).reduce((sum, p) => sum + Math.max(0, p.sanctionedCount - getInSvc(dept, p.designation)), 0);

      return { dept: dept as DeptEnum, sanctioned, sanctionedT, sanctionedNT, inService, filledT, filledNT, vacant, vacantT, vacantNT };
    });

    return { totalSanctioned, totalFilled, totalVacant, deptVacancyStats };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sanctionedPosts, staff]);

  const [detailModal, setDetailModal] = useState<'sanctioned' | 'filled' | 'vacant' | null>(null);

  // ── Dept × designation vacancy matrix ─────────────────────────────────────
  const vacancyMatrix = useMemo(() => {
    const inSvc: Record<string, number> = {};
    staff.filter(s => s.status === 'IN SERVICE').forEach(s => {
      const k = `${s.dept}_${s.designation}`;
      inSvc[k] = (inSvc[k] ?? 0) + 1;
    });

    function buildRow(desig: string) {
      const cells = DEPARTMENTS.map(dept => {
        const sanctioned = sanctionedPosts.find(p => p.dept === dept && p.designation === desig)?.sanctionedCount ?? 0;
        const filled = inSvc[`${dept}_${desig}`] ?? 0;
        return { sanctioned, filled, vacant: Math.max(0, sanctioned - filled) };
      });
      const totSanctioned = cells.reduce((s, c) => s + c.sanctioned, 0);
      const totVacant     = cells.reduce((s, c) => s + c.vacant, 0);
      return { desig, cells, totSanctioned, totVacant };
    }

    // LECT & SEL GR: sanctioned comes only from LECTURER posts; both groups fill them
    function buildLecturerRow() {
      const cells = DEPARTMENTS.map(dept => {
        const sanctioned = sanctionedPosts.find(p => p.dept === dept && p.designation === 'LECTURER')?.sanctionedCount ?? 0;
        const filled = (inSvc[`${dept}_LECTURER`] ?? 0) + (inSvc[`${dept}_SEL GR LECT`] ?? 0);
        return { sanctioned, filled, vacant: Math.max(0, sanctioned - filled) };
      });
      const totSanctioned = cells.reduce((s, c) => s + c.sanctioned, 0);
      const totVacant     = cells.reduce((s, c) => s + c.vacant, 0);
      return { desig: 'LECT & SEL GR', cells, totSanctioned, totVacant };
    }

    function subtotal(rows: ReturnType<typeof buildRow>[]) {
      return {
        cells: DEPARTMENTS.map((_, i) => ({
          sanctioned: rows.reduce((s, r) => s + r.cells[i].sanctioned, 0),
          vacant:     rows.reduce((s, r) => s + r.cells[i].vacant, 0),
        })),
        totSanctioned: rows.reduce((s, r) => s + r.totSanctioned, 0),
        totVacant:     rows.reduce((s, r) => s + r.totVacant, 0),
      };
    }

    const NON_TEACHING_DESIGS = ['SUPDT.', 'FDC', 'SDC', 'TYPIST', 'ATTENDER', 'GROUP D', 'INSTRUCTOR', 'ASST. INST', 'SYS. ANALIST', 'MECHANIC', 'HELPER', 'OPERATOR', 'LIBRARIAN', 'OTHER'];
    const ACCOUNTED_DESIGS    = ['PRINCIPAL', 'HOD', 'SEL GR LECT', 'LECTURER', ...NON_TEACHING_DESIGS];
    const OTHER_DESIGS        = DESIGNATIONS.filter(d => !ACCOUNTED_DESIGS.includes(d));

    const teachingRows = [
      buildRow('PRINCIPAL'),
      buildRow('HOD'),
      buildLecturerRow(),
    ].filter(r => r.totSanctioned > 0);

    const nonTeachingRows  = NON_TEACHING_DESIGS.map(buildRow).filter(r => r.totSanctioned > 0);
    const otherRows        = OTHER_DESIGS.map(buildRow).filter(r => r.totSanctioned > 0);

    const teachingSub    = subtotal(teachingRows);
    const nonTeachingSub = subtotal(nonTeachingRows);
    const allRows        = [...teachingRows, ...nonTeachingRows, ...otherRows];
    const grandTotal     = subtotal(allRows);

    return { teachingRows, nonTeachingRows, otherRows, teachingSub, nonTeachingSub, grandTotal };
  }, [sanctionedPosts, staff]);

  // ── Designation breakdown (in-service) ─────────────────────────────────────
  const { designationBreakdown, designationTotal } = useMemo(() => {
    const map: Record<string, number> = {};
    staff.filter(s => s.status === 'IN SERVICE')
         .forEach(s => { map[s.designation] = (map[s.designation] ?? 0) + 1; });
    const sorted = Object.entries(map).sort(([a], [b]) => {
      const ai = DESIGNATION_ORDER.indexOf(a);
      const bi = DESIGNATION_ORDER.indexOf(b);
      const an = ai === -1 ? DESIGNATION_ORDER.length : ai;
      const bn = bi === -1 ? DESIGNATION_ORDER.length : bi;
      return an - bn;
    });
    return { designationBreakdown: sorted, designationTotal: sorted.reduce((s, [, c]) => s + c, 0) };
  }, [staff]);

  const maxDesig = Math.max(...designationBreakdown.map(d => d[1]), 1);

  // ── Category × Dept in-service matrix ─────────────────────────────────────
  const { catDeptRows, catDeptColTotals, catDeptGrandTotal } = useMemo(() => {
    const matrix: Record<string, Record<string, number>> = {};
    staff.filter(s => s.status === 'IN SERVICE').forEach(s => {
      const cat = s.category?.trim().toUpperCase() || 'NOT SPECIFIED';
      if (!matrix[cat]) matrix[cat] = {};
      matrix[cat][s.dept] = (matrix[cat][s.dept] ?? 0) + 1;
    });
    const ORDER = ['GEN', 'OBC', 'SC', 'ST'];
    const rows = Object.entries(matrix)
      .sort(([a], [b]) => {
        const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1; if (bi !== -1) return 1;
        return a.localeCompare(b);
      })
      .map(([cat, deptCounts]) => ({
        cat,
        deptCounts,
        total: DEPARTMENTS.reduce((s, d) => s + (deptCounts[d] ?? 0), 0),
      }));
    const colTotals = Object.fromEntries(
      DEPARTMENTS.map(d => [d, rows.reduce((s, r) => s + (r.deptCounts[d] ?? 0), 0)])
    );
    const grandTotal = rows.reduce((s, r) => s + r.total, 0);
    return { catDeptRows: rows, catDeptColTotals: colTotals, catDeptGrandTotal: grandTotal };
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
    <div className="flex flex-col gap-5" style={{ animation: 'page-enter 0.35s ease-out' }}>

      {/* ── Staff search ─────────────────────────────────────────────────── */}
      <div ref={searchRef} className="relative">
        <div
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border border-gray-200 bg-white"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
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

        {searchOpen && suggestions.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-gray-100 bg-white shadow-xl overflow-hidden z-40"
            style={{ animation: 'modal-enter 0.12s ease-out' }}
          >
            {suggestions.map((s, i) => (
              <div
                key={s.id}
                onMouseDown={() => { navigate(`/staff/${s.id}`, { state: { from: 'dashboard' } }); setSearchOpen(false); setSearchQ(''); }}
                onContextMenu={e => openSearchCtx(e, s)}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-sky-50 transition-colors border-b border-gray-50 last:border-0 select-none"
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
            className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-gray-100 bg-white shadow-xl px-4 py-3 z-40 text-sm text-gray-400"
            style={{ animation: 'modal-enter 0.12s ease-out' }}
          >
            No staff found matching "{searchQ.trim()}"
          </div>
        )}
      </div>

      {/* Context menu */}
      {searchCtx && (
        <div
          onMouseDown={e => e.stopPropagation()}
          className="fixed z-50 min-w-36 rounded-lg border border-gray-200 bg-white shadow-xl py-1 text-sm"
          style={{ top: searchCtx.y, left: searchCtx.x, animation: 'modal-enter 0.12s ease-out' }}
        >
          <button
            onMouseDown={() => { navigate(`/staff/${searchCtx.record.id}`, { state: { from: 'dashboard' } }); setSearchCtx(null); setSearchOpen(false); setSearchQ(''); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            View Profile
          </button>
        </div>
      )}

      {/* ── Row 1: Flat stat cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="In Service"
          value={stats.inService}
          sub={totalSanctioned > 0 ? `of ${totalSanctioned} sanctioned` : 'Active staff'}
          icon={UserCheck}
          bg="#F0FDF4"
          iconBg="#BBF7D0"
          iconColor="#059669"
          numColor="#047857"
          borderColor="#BBF7D0"
          delay={0}
        />
        <StatCard
          label="Teaching"
          value={stats.teaching}
          sub="In-service faculty"
          icon={GraduationCap}
          bg="#F5F3FF"
          iconBg="#DDD6FE"
          iconColor="#7C3AED"
          numColor="#6D28D9"
          borderColor="#DDD6FE"
          delay={60}
        />
        <StatCard
          label="Non-Teaching"
          value={stats.nonTeaching}
          sub="In-service staff"
          icon={Briefcase}
          bg="#FFFBEB"
          iconBg="#FDE68A"
          iconColor="#D97706"
          numColor="#B45309"
          borderColor="#FDE68A"
          delay={120}
        />
        <StatCard
          label="Vacant Posts"
          value={totalVacant}
          sub={totalSanctioned > 0 ? `${totalSanctioned} allotted total` : 'No posts configured'}
          icon={ClipboardList}
          bg={totalVacant > 0 ? '#FEF2F2' : '#F0FDF4'}
          iconBg={totalVacant > 0 ? '#FECACA' : '#BBF7D0'}
          iconColor={totalVacant > 0 ? '#DC2626' : '#059669'}
          numColor={totalVacant > 0 ? '#B91C1C' : '#047857'}
          borderColor={totalVacant > 0 ? '#FECACA' : '#BBF7D0'}
          delay={180}
        />
      </div>

      {/* ── Row 2: Vacancy summary cards ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { key: 'sanctioned', label: 'Sanctioned Posts', value: totalSanctioned,
            bg: '#F0F9FF', border: '#BAE6FD', num: '#0369A1', sub: 'Total allotted' },
          { key: 'filled',     label: 'Filled Posts',     value: totalFilled,
            bg: '#F0FDF4', border: '#BBF7D0', num: '#047857', sub: 'Currently in service' },
          { key: 'vacant',     label: 'Vacant Posts',     value: totalVacant,
            bg: totalVacant > 0 ? '#FEF2F2' : '#F0FDF4',
            border: totalVacant > 0 ? '#FECACA' : '#BBF7D0',
            num: totalVacant > 0 ? '#B91C1C' : '#047857',
            sub: totalVacant > 0 ? 'Posts unfilled' : 'All posts filled' },
        ] as const).map(({ key, label, value, bg, border, num, sub }, i) => (
          <button
            key={key}
            onClick={() => setDetailModal(key)}
            className="rounded-2xl p-4 text-left w-full group transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
            style={{
              background: bg, border: `1.5px solid ${border}`,
              animation: `content-enter 0.35s ease-out ${i * 60}ms both`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <p className="text-3xl font-bold tabular-nums leading-none" style={{ color: num }}>
              <AnimNum value={value} />
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-2">{label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 group-hover:text-gray-500 transition-colors">{sub} · view breakdown →</p>
          </button>
        ))}
      </div>

      {/* ── Vacancy detail modal ──────────────────────────────────────────── */}
      {detailModal && (() => {
        const cfg = {
          sanctioned: { title: 'Sanctioned Posts by Dept', getValue: (d: typeof deptVacancyStats[0]) => d.sanctioned,  total: totalSanctioned, numColor: '#0369A1' },
          filled:     { title: 'Filled Posts by Dept',     getValue: (d: typeof deptVacancyStats[0]) => d.inService,   total: totalFilled,     numColor: '#047857' },
          vacant:     { title: 'Vacant Posts by Dept',     getValue: (d: typeof deptVacancyStats[0]) => d.vacant,      total: totalVacant,     numColor: '#B91C1C' },
        }[detailModal];
        const rows = deptVacancyStats.filter(d => detailModal === 'vacant' ? d.sanctioned > 0 : cfg.getValue(d) > 0);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', animation: 'backdrop-enter 0.18s ease-out' }}
            onClick={() => setDetailModal(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-xs mx-4"
              style={{ animation: 'modal-enter 0.22s cubic-bezier(0.34,1.26,0.64,1)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">{cfg.title}</h3>
                <button onClick={() => setDetailModal(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 py-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wide">
                      <th className="pb-1.5 text-left font-medium">Department</th>
                      <th className="pb-1.5 text-right font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ dept, ...d }) => {
                      const val = cfg.getValue({ dept, ...d } as typeof deptVacancyStats[0]);
                      return (
                        <tr key={dept} className="border-b border-gray-50">
                          <td className="py-1.5">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DEPT_COLORS[dept] }} />
                              <span className="font-medium text-gray-700">{dept}</span>
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-bold tabular-nums"
                            style={{ color: detailModal === 'vacant' && val > 0 ? '#B91C1C' : detailModal === 'vacant' ? '#22c55e' : cfg.numColor }}>
                            {val}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-100">
                      <td className="pt-2 font-bold text-gray-700">Total</td>
                      <td className="pt-2 text-right font-bold tabular-nums text-sm" style={{ color: cfg.numColor }}>{cfg.total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Row 3: Dept × Designation vacancy matrix (full width) ──────────── */}
      <Panel
        title="Dept × Designation Vacancy"
        subtitle="Vacant posts by department and designation"
        delay={320}
        action={
          <ExportActions
            onPdf={() => exportVacancyMatrixPdf(vacancyMatrix, DEPARTMENTS)}
            onXls={() => exportVacancyMatrixXlsx(vacancyMatrix, DEPARTMENTS)}
          />
        }
      >
        <div className="-mx-5 -mb-5 overflow-x-auto">
          <table className="w-full text-xs border-collapse [&_th]:border-r [&_th]:border-gray-100 [&_td]:border-r [&_td]:border-gray-100">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="pl-5 pr-3 py-1.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 w-44">Designation</th>
                {DEPARTMENTS.map(dept => (
                  <th key={dept} className="px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: DEPT_COLORS[dept as DeptEnum] }}>
                    {dept}
                  </th>
                ))}
                <th className="px-3 py-1.5 pr-5 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* ── Teaching ── */}
              {vacancyMatrix.teachingRows.length > 0 && (
                <tr>
                  <td colSpan={DEPARTMENTS.length + 2} className="pl-5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-500">
                    Teaching
                  </td>
                </tr>
              )}
              {vacancyMatrix.teachingRows.map(({ desig, cells, totVacant }, i) => (
                <tr key={desig} className="border-b border-gray-100 hover:bg-sky-50/40 transition-colors"
                  style={{ animation: `content-enter 0.25s ease-out ${340 + i * 25}ms both` }}>
                  <td className="pl-5 pr-3 py-1.5 text-[13px] font-medium text-gray-700 sticky left-0 bg-white">{desig}</td>
                  {cells.map((c, di) => (
                    <td key={di} className="px-3 py-1.5 text-center tabular-nums text-[13px]">
                      {c.sanctioned === 0
                        ? <span className="text-gray-200">—</span>
                        : c.vacant === 0
                          ? <span className="font-semibold text-green-500">0</span>
                          : <span className="font-bold text-red-500">{c.vacant}</span>}
                    </td>
                  ))}
                  <td className="px-3 pr-5 py-1.5 text-center tabular-nums text-[13px] font-bold">
                    {totVacant > 0 ? <span className="text-red-500">{totVacant}</span> : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              ))}
              {vacancyMatrix.teachingRows.length > 0 && (
                <tr className="border-y border-violet-100 bg-violet-50/60">
                  <td className="pl-5 pr-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-600 sticky left-0 bg-violet-50/60 whitespace-nowrap">Teaching Sub.</td>
                  {vacancyMatrix.teachingSub.cells.map((c, di) => (
                    <td key={di} className="px-3 py-1.5 text-center tabular-nums text-xs font-bold">
                      {c.sanctioned === 0 ? <span className="text-gray-200">—</span>
                        : c.vacant > 0 ? <span className="text-red-500">{c.vacant}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                  ))}
                  <td className="px-3 pr-5 py-1.5 text-center text-xs font-bold">
                    {vacancyMatrix.teachingSub.totVacant > 0
                      ? <span className="text-red-500">{vacancyMatrix.teachingSub.totVacant}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              )}

              {/* ── Non-Teaching ── */}
              {vacancyMatrix.nonTeachingRows.length > 0 && (
                <tr>
                  <td colSpan={DEPARTMENTS.length + 2} className="pl-5 pt-2 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                    Non-Teaching
                  </td>
                </tr>
              )}
              {vacancyMatrix.nonTeachingRows.map(({ desig, cells, totVacant }, i) => (
                <tr key={desig} className="border-b border-gray-100 hover:bg-sky-50/40 transition-colors"
                  style={{ animation: `content-enter 0.25s ease-out ${400 + i * 25}ms both` }}>
                  <td className="pl-5 pr-3 py-1.5 text-[13px] font-medium text-gray-700 sticky left-0 bg-white">{desig}</td>
                  {cells.map((c, di) => (
                    <td key={di} className="px-3 py-1.5 text-center tabular-nums text-[13px]">
                      {c.sanctioned === 0
                        ? <span className="text-gray-200">—</span>
                        : c.vacant === 0
                          ? <span className="font-semibold text-green-500">0</span>
                          : <span className="font-bold text-red-500">{c.vacant}</span>}
                    </td>
                  ))}
                  <td className="px-3 pr-5 py-1.5 text-center tabular-nums text-[13px] font-bold">
                    {totVacant > 0 ? <span className="text-red-500">{totVacant}</span> : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              ))}
              {vacancyMatrix.nonTeachingRows.length > 0 && (
                <tr className="border-y border-amber-100 bg-amber-50/60">
                  <td className="pl-5 pr-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 sticky left-0 bg-amber-50/60 whitespace-nowrap">Non-Teaching Sub.</td>
                  {vacancyMatrix.nonTeachingSub.cells.map((c, di) => (
                    <td key={di} className="px-3 py-1.5 text-center tabular-nums text-xs font-bold">
                      {c.sanctioned === 0 ? <span className="text-gray-200">—</span>
                        : c.vacant > 0 ? <span className="text-red-500">{c.vacant}</span>
                        : <span className="text-gray-300">0</span>}
                    </td>
                  ))}
                  <td className="px-3 pr-5 py-1.5 text-center text-xs font-bold">
                    {vacancyMatrix.nonTeachingSub.totVacant > 0
                      ? <span className="text-red-500">{vacancyMatrix.nonTeachingSub.totVacant}</span>
                      : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              )}

              {/* ── Other designations (e.g. English Part Time) ── */}
              {vacancyMatrix.otherRows.map(({ desig, cells, totVacant }, i) => (
                <tr key={desig} className="border-b border-gray-100 hover:bg-sky-50/40 transition-colors"
                  style={{ animation: `content-enter 0.25s ease-out ${460 + i * 25}ms both` }}>
                  <td className="pl-5 pr-3 py-1.5 text-[13px] font-medium text-gray-700 sticky left-0 bg-white">{desig}</td>
                  {cells.map((c, di) => (
                    <td key={di} className="px-3 py-1.5 text-center tabular-nums text-[13px]">
                      {c.sanctioned === 0
                        ? <span className="text-gray-200">—</span>
                        : c.vacant === 0
                          ? <span className="font-semibold text-green-500">0</span>
                          : <span className="font-bold text-red-500">{c.vacant}</span>}
                    </td>
                  ))}
                  <td className="px-3 pr-5 py-1.5 text-center tabular-nums text-[13px] font-bold">
                    {totVacant > 0 ? <span className="text-red-500">{totVacant}</span> : <span className="text-gray-300">0</span>}
                  </td>
                </tr>
              ))}

              {/* ── Grand total ── */}
              <tr className="bg-sky-50/70 border-t-2 border-sky-100">
                <td className="pl-5 pr-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-700 sticky left-0 bg-sky-50/70">Total</td>
                {vacancyMatrix.grandTotal.cells.map((c, di) => (
                  <td key={di} className="px-3 py-1.5 text-center tabular-nums font-bold text-sm">
                    {c.sanctioned === 0
                      ? <span className="text-gray-200 text-xs">—</span>
                      : c.vacant > 0
                        ? <span className="text-red-600">{c.vacant}</span>
                        : <span className="text-gray-300 text-xs">0</span>}
                  </td>
                ))}
                <td className="px-3 pr-5 py-1.5 text-center font-bold text-sm">
                  {vacancyMatrix.grandTotal.totVacant > 0
                    ? <span className="text-red-600">{vacancyMatrix.grandTotal.totVacant}</span>
                    : <span className="text-green-600">0</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── Row 4: Dept vacancy summary table ────────────────────────────── */}
      <Panel
        title="Department Vacancy Summary"
        subtitle="Sanctioned vs filled vs vacant · Teaching / Non-Teaching"
        delay={480}
        action={
          <ExportActions
            onPdf={() => exportDeptVacancySummaryPdf(deptVacancyStats, { totalSanctioned, totalFilled, totalVacant })}
            onXls={() => exportDeptVacancySummaryXlsx(deptVacancyStats, { totalSanctioned, totalFilled, totalVacant })}
          />
        }
      >
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm border-collapse [&_th]:border-r [&_th]:border-gray-100 [&_td]:border-r [&_td]:border-gray-100">
            <thead>
              {/* Group headers */}
              <tr className="border-b border-gray-100">
                <th className="pl-5 px-3 py-1.5 text-left bg-gray-50" rowSpan={2} />
                <th colSpan={3} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 border-r border-sky-200">Sanctioned</th>
                <th colSpan={3} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 border-r border-green-200">Filled</th>
                <th colSpan={3} className="px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50">Vacant</th>
              </tr>
              {/* Sub-headers */}
              <tr className="border-b border-gray-200">
                <Th align="center" className="text-violet-500 bg-sky-50/60">T</Th>
                <Th align="center" className="text-amber-500 bg-sky-50/60">NT</Th>
                <Th align="center" className="text-sky-700 bg-sky-50/60 border-r border-sky-200">Total</Th>
                <Th align="center" className="text-violet-500 bg-green-50/60">T</Th>
                <Th align="center" className="text-amber-500 bg-green-50/60">NT</Th>
                <Th align="center" className="text-green-700 bg-green-50/60 border-r border-green-200">Total</Th>
                <Th align="center" className="text-violet-500 bg-red-50/60">T</Th>
                <Th align="center" className="text-amber-500 bg-red-50/60">NT</Th>
                <Th align="center" className="text-red-600 bg-red-50/60">Total</Th>
              </tr>
            </thead>
            <tbody>
              {deptVacancyStats.map(({ dept, sanctioned, sanctionedT, sanctionedNT, inService, filledT, filledNT, vacant, vacantT, vacantNT }, i) => (
                <tr
                  key={dept}
                  className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors"
                  style={{ animation: `content-enter 0.3s ease-out ${500 + i * 40}ms both` }}
                >
                  <Td className="pl-5 bg-white"><DeptBadge dept={dept} /></Td>
                  <Td align="center" className="bg-sky-50/30"><Num v={sanctionedT}  color="#7C3AED" /></Td>
                  <Td align="center" className="bg-sky-50/30"><Num v={sanctionedNT} color="#D97706" /></Td>
                  <Td align="center" className="bg-sky-50/50"><span className="font-bold text-sky-700 tabular-nums">{sanctioned || <span className="text-gray-300">—</span>}</span></Td>
                  <Td align="center" className="bg-green-50/30"><Num v={filledT}  color="#7C3AED" /></Td>
                  <Td align="center" className="bg-green-50/30"><Num v={filledNT} color="#D97706" /></Td>
                  <Td align="center" className="bg-green-50/50"><span className="font-bold text-green-700 tabular-nums">{inService || <span className="text-gray-300">—</span>}</span></Td>
                  <Td align="center" className="bg-red-50/30">{vacantT  > 0 ? <span className="font-bold text-red-500 tabular-nums">{vacantT}</span>  : <span className="text-gray-300 font-semibold">0</span>}</Td>
                  <Td align="center" className="bg-red-50/30">{vacantNT > 0 ? <span className="font-bold text-red-500 tabular-nums">{vacantNT}</span> : <span className="text-gray-300 font-semibold">0</span>}</Td>
                  <Td align="center" className="bg-red-50/50">{vacant   > 0 ? <span className="font-bold text-red-600 tabular-nums">{vacant}</span>   : <span className="text-gray-300 font-semibold">0</span>}</Td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200">
                <td className="pl-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50">Total</td>
                <td className="py-2.5 text-center font-bold text-violet-600 tabular-nums text-sm bg-sky-100">{deptVacancyStats.reduce((s, d) => s + d.sanctionedT,  0)}</td>
                <td className="py-2.5 text-center font-bold text-amber-600  tabular-nums text-sm bg-sky-100">{deptVacancyStats.reduce((s, d) => s + d.sanctionedNT, 0)}</td>
                <td className="py-2.5 text-center font-bold text-sky-700    tabular-nums text-sm bg-sky-100">{totalSanctioned}</td>
                <td className="py-2.5 text-center font-bold text-violet-600 tabular-nums text-sm bg-green-100">{deptVacancyStats.reduce((s, d) => s + d.filledT,  0)}</td>
                <td className="py-2.5 text-center font-bold text-amber-600  tabular-nums text-sm bg-green-100">{deptVacancyStats.reduce((s, d) => s + d.filledNT, 0)}</td>
                <td className="py-2.5 text-center font-bold text-green-700  tabular-nums text-sm bg-green-100">{totalFilled}</td>
                <td className="py-2.5 text-center font-bold text-violet-600 tabular-nums text-sm bg-red-100">{deptVacancyStats.reduce((s, d) => s + d.vacantT,  0) || <span className="text-gray-400">0</span>}</td>
                <td className="py-2.5 text-center font-bold text-amber-600  tabular-nums text-sm bg-red-100">{deptVacancyStats.reduce((s, d) => s + d.vacantNT, 0) || <span className="text-gray-400">0</span>}</td>
                <td className="py-2.5 text-center font-bold tabular-nums text-sm bg-red-100">{totalVacant > 0 ? <span className="text-red-600">{totalVacant}</span> : <span className="text-gray-400">0</span>}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      {/* ── Row 5: Designation + Dept × Category ─────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Designation breakdown */}
        <Panel
          title="By Designation"
          subtitle="In-service only"
          delay={560}
          className="h-full flex flex-col"
          action={
            <ExportActions
              onPdf={() => exportDesignationBreakdownPdf(designationBreakdown, designationTotal)}
              onXls={() => exportDesignationBreakdownXlsx(designationBreakdown, designationTotal)}
            />
          }
        >
          {designationBreakdown.length === 0
            ? <p className="text-sm text-gray-300">No data yet</p>
            : (
              <div className="flex flex-col flex-1 -mb-5">
                {/* Rows — grow to fill available space */}
                <div className="flex flex-col gap-1.5 flex-1 justify-between pb-2">
                  {designationBreakdown.map(([desig, count]) => (
                    <div key={desig} className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-gray-700 flex-1 truncate" title={desig}>{desig}</span>
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                        <div
                          className="h-full rounded-full bg-sky-400"
                          style={{
                            width: `${(count / maxDesig) * 100}%`,
                            animation: 'bar-grow 0.5s ease-out both',
                            transformOrigin: 'left',
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-gray-800 tabular-nums w-5 text-right shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
                {/* Total row — matches adjacent table total styling */}
                <div className="flex items-center -mx-5 px-5 py-2.5 border-t-2 border-sky-100 bg-sky-50/60 shrink-0">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex-1">Total</span>
                  <span className="text-sm font-bold text-sky-700 tabular-nums">{designationTotal}</span>
                </div>
              </div>
            )}
        </Panel>

        {/* Dept × category table */}
        <Panel
          title="Department × Category"
          subtitle="In-service · Teaching vs Non-Teaching"
          delay={580}
          className="col-span-2"
          action={
            <ExportActions
              onPdf={() => exportDeptCategoryPdf(categoryStats, { tInSvc: categoryTotals.tInSvc, ntInSvc: categoryTotals.ntInSvc })}
              onXls={() => exportDeptCategoryXlsx(categoryStats, { tInSvc: categoryTotals.tInSvc, ntInSvc: categoryTotals.ntInSvc })}
            />
          }
        >
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th className="pl-5">Dept</Th>
                  <Th align="center" className="text-violet-600">Teaching</Th>
                  <Th align="center" className="text-amber-600">Non-Teaching</Th>
                  <Th align="right" className="pr-5">Total</Th>
                </tr>
              </thead>
              <tbody>
                {categoryStats.map(({ dept, tInSvc, ntInSvc }, i) => (
                  <tr
                    key={dept}
                    className="border-t border-gray-50 hover:bg-sky-50/40 transition-colors"
                    style={{ animation: `content-enter 0.3s ease-out ${600 + i * 40}ms both` }}
                  >
                    <Td className="pl-5"><DeptBadge dept={dept} /></Td>
                    <Td align="center"><Num v={tInSvc}  color="#7C3AED" /></Td>
                    <Td align="center"><Num v={ntInSvc} color="#D97706" /></Td>
                    <Td align="right" className="pr-5"><Num v={tInSvc + ntInSvc} /></Td>
                  </tr>
                ))}
                <tr className="border-t-2 border-sky-100 bg-sky-50/60">
                  <td className="pl-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total</td>
                  <td className="py-2.5 text-center font-bold text-violet-600 tabular-nums text-sm">{categoryTotals.tInSvc}</td>
                  <td className="py-2.5 text-center font-bold text-amber-600 tabular-nums text-sm">{categoryTotals.ntInSvc}</td>
                  <td className="pr-5 py-2.5 text-right font-bold text-sky-700 tabular-nums text-sm">{categoryTotals.tInSvc + categoryTotals.ntInSvc}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>

      </div>

      {/* ── Row 6: Category × Dept matrix ───────────────────────────────── */}
      <Panel
        title="Category-wise Staff Count"
        subtitle="In-service staff by category and department"
        delay={640}
        action={
          <ExportActions
            onPdf={() => exportCategoryDeptMatrixPdf(catDeptRows, catDeptColTotals, catDeptGrandTotal, DEPARTMENTS)}
            onXls={() => exportCategoryDeptMatrixXlsx(catDeptRows, catDeptColTotals, catDeptGrandTotal, DEPARTMENTS)}
          />
        }
      >
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm border-collapse [&_th]:border-r [&_th]:border-gray-100 [&_td]:border-r [&_td]:border-gray-100">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <Th className="pl-5 sticky left-0 bg-gray-50 z-10">Category</Th>
                {DEPARTMENTS.map(dept => (
                  <Th key={dept} align="center" style={{ color: DEPT_COLORS[dept as DeptEnum] }}>{dept}</Th>
                ))}
                <Th align="right" className="pr-5">Total</Th>
              </tr>
            </thead>
            <tbody>
              {catDeptRows.length === 0 ? (
                <tr>
                  <td colSpan={DEPARTMENTS.length + 2} className="py-8 text-center text-sm text-gray-300">No category data recorded yet</td>
                </tr>
              ) : catDeptRows.map(({ cat, deptCounts, total }, i) => (
                <tr
                  key={cat}
                  className="border-b border-gray-50 hover:bg-sky-50/40 transition-colors"
                  style={{ animation: `content-enter 0.3s ease-out ${660 + i * 40}ms both` }}
                >
                  <Td className="pl-5 sticky left-0 bg-white">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-100">{cat}</span>
                  </Td>
                  {DEPARTMENTS.map(dept => (
                    <Td key={dept} align="center">
                      <Num v={deptCounts[dept] ?? 0} color={DEPT_COLORS[dept as DeptEnum]} />
                    </Td>
                  ))}
                  <Td align="right" className="pr-5"><span className="font-bold tabular-nums text-gray-800">{total}</span></Td>
                </tr>
              ))}
              <tr className="border-t-2 border-sky-100 bg-sky-50/60">
                <td className="pl-5 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-sky-50/60">Total</td>
                {DEPARTMENTS.map(dept => (
                  <td key={dept} className="py-2.5 text-center font-bold tabular-nums text-sm" style={{ color: DEPT_COLORS[dept as DeptEnum] }}>
                    {catDeptColTotals[dept] || <span className="text-gray-300">—</span>}
                  </td>
                ))}
                <td className="pr-5 py-2.5 text-right font-bold text-sky-700 tabular-nums text-sm">{catDeptGrandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

    </div>
  );
}
