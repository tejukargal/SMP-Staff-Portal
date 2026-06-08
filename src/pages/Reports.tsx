import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Printer, Download, Search, X, FileText } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { Button } from '@/components/ui/Button';
import { DeptBadge, StatusBadge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { StaffTable } from '@/components/staff/StaffTable';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { formatDate, computeServiceYears, computeDOR } from '@/utils/dateUtils';
import { exportStaffToExcel, exportReportToExcel } from '@/utils/exportUtils';
import { exportReportPdf } from '@/utils/reportsPdf';
import type { StaffRecord } from '@/types';
import { DEPARTMENTS, STATUSES, DESIGNATIONS, DEPT_COLORS } from '@/constants/enums';

// ── Types ──────────────────────────────────────────────────────────────────────

type ReportKey =
  | 'staff-list'
  | 'retired'
  | 'service-register'
  | 'seniority'
  | 'by-designation'
  | 'contact-dir'
  | 'dor-list';

interface ReportDef { key: ReportKey; label: string; title: string; }

const REPORTS: ReportDef[] = [
  { key: 'staff-list',       label: 'Staff List',       title: 'Staff List — All Staff' },
  { key: 'retired',          label: 'Retired Staff',    title: 'Retired Staff List' },
  { key: 'service-register', label: 'Service Register', title: 'Service Register' },
  { key: 'seniority',        label: 'Seniority List',   title: 'Seniority List' },
  { key: 'by-designation',   label: 'By Designation',   title: 'Staff by Designation' },
  { key: 'contact-dir',      label: 'Contact Directory',title: 'Contact Directory' },
  { key: 'dor-list',         label: 'DOR List',         title: 'Date of Retirement List' },
];

// ── Base dataset per report ────────────────────────────────────────────────────

function getBaseData(key: ReportKey, staff: StaffRecord[]): StaffRecord[] {
  switch (key) {
    case 'retired':          return staff.filter(s => s.status === 'RTRD').sort((a, b) => a.name.localeCompare(b.name));
    case 'service-register':
    case 'seniority':        return [...staff].sort((a, b) => a.doe.localeCompare(b.doe));
    case 'by-designation':   return [...staff].sort((a, b) => a.designation.localeCompare(b.designation) || a.name.localeCompare(b.name));
    case 'contact-dir':      return [...staff].sort((a, b) => a.name.localeCompare(b.name));
    case 'dor-list':         return [...staff].sort((a, b) => {
      const da = computeDOR(a.dob) || a.dor || '';
      const db = computeDOR(b.dob) || b.dor || '';
      return da.localeCompare(db);
    });
    default:                 return [...staff].sort((a, b) => a.name.localeCompare(b.name));
  }
}

function toExportRow(key: ReportKey, s: StaffRecord): Record<string, unknown> {
  if (key === 'dor-list')
    return { NAME: s.name, 'EMP ID': s.empId, DESIGNATION: s.designation, DEPT: s.dept, STATUS: s.status, DOB: formatDate(s.dob), DOR: formatDate(computeDOR(s.dob) || s.dor) };
  if (key === 'contact-dir')
    return { NAME: s.name, DEPT: s.dept, TYPE: s.type, PHONE: s.phone, EMAIL: s.email };
  if (key === 'service-register')
    return { NAME: s.name, 'EMP ID': s.empId, DEPT: s.dept, DOB: formatDate(s.dob), DOE: formatDate(s.doe), DOR: formatDate(computeDOR(s.dob) || s.dor), 'SERVICE YEARS': computeServiceYears(s.doe) };
  return { NAME: s.name, 'EMP ID': s.empId, DESIGNATION: s.designation, TYPE: s.type, DEPT: s.dept, STATUS: s.status, CATEGORY: s.category ?? '', DOE: formatDate(s.doe) };
}

const SEL = 'rounded-lg border border-sky-100 px-2.5 py-1.5 text-xs bg-white/80 focus:outline-none focus:ring-1 focus:ring-sky-400 focus:border-sky-400 cursor-pointer text-gray-700 transition-colors';

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Reports() {
  const { staff, loading } = useStaff();

  const [active,       setActive]  = useState<ReportKey>('staff-list');
  const [search,       setSearch]  = useState('');
  const [fDept,        setFDept]   = useState('');
  const [fType,        setFType]   = useState('');
  const [fStatus,      setFStat]   = useState('');
  const [fDesig,       setFDesig]  = useState('');
  const [fCategory,    setFCat]    = useState('');

  // ── Tab scroll ──────────────────────────────────────────────────────────────
  const tabsRef  = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll); };
  }, [checkScroll]);

  useEffect(() => { setTimeout(checkScroll, 100); }, [staff, checkScroll]);

  const scrollTabs = (dir: 'left' | 'right') => {
    tabsRef.current?.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' });
    setTimeout(checkScroll, 320);
  };

  const switchTab = (key: ReportKey) => {
    setActive(key);
    setSearch(''); setFDept(''); setFType(''); setFStat(''); setFDesig(''); setFCat('');
  };

  // ── Derived category options (from actual data) ─────────────────────────────
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    staff.forEach(s => { if (s.category?.trim()) set.add(s.category.trim().toUpperCase()); });
    const ORDER = ['GEN', 'OBC', 'SC', 'ST'];
    return [...set].sort((a, b) => {
      const ai = ORDER.indexOf(a), bi = ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1; if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [staff]);

  // ── Filtered display data ───────────────────────────────────────────────────
  const displayData = useMemo(() => {
    const base = getBaseData(active, staff);
    const q = search.trim().toUpperCase();
    return base.filter(s => {
      if (q && !s.name.toUpperCase().includes(q) && !s.empId.toUpperCase().includes(q) && !(s.phone ?? '').includes(q)) return false;
      if (fDept     && s.dept        !== fDept)                              return false;
      if (fType     && s.type        !== fType)                              return false;
      if (fStatus   && s.status      !== fStatus)                            return false;
      if (fDesig    && s.designation !== fDesig)                             return false;
      if (fCategory && (s.category?.trim().toUpperCase() ?? '') !== fCategory) return false;
      return true;
    });
  }, [active, staff, search, fDept, fType, fStatus, fDesig, fCategory]);

  const chipStats = useMemo(() => {
    const teaching = displayData.filter(s => s.type === 'TEACHING').length;
    const deptCounts = DEPARTMENTS
      .map(d => ({ dept: d, count: displayData.filter(s => s.dept === d).length }))
      .filter(d => d.count > 0);
    return { teaching, nonTeaching: displayData.length - teaching, deptCounts };
  }, [displayData]);

  const activeDef  = REPORTS.find(r => r.key === active)!;
  const hasFilters = !!(search || fDept || fType || fStatus || fDesig || fCategory);
  const clearAll   = () => { setSearch(''); setFDept(''); setFType(''); setFStat(''); setFDesig(''); setFCat(''); };

  const handleExport = () => {
    if (active === 'staff-list') {
      exportStaffToExcel(displayData, 'SMP_Staff_List');
    } else {
      exportReportToExcel(displayData.map(s => toExportRow(active, s)), activeDef.title, `SMP_${active}`);
    }
  };

  const handlePdf = () => {
    setTimeout(() => exportReportPdf(active, displayData, {
      search: search || undefined,
      dept: fDept || undefined,
      type: fType || undefined,
      status: fStatus || undefined,
      desig: fDesig || undefined,
      category: fCategory || undefined,
    }), 0);
  };

  if (loading) return <PageSpinner />;

  return (
    <div className="h-full flex flex-col gap-3" style={{ animation: 'page-enter 0.35s ease-out' }}>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {/* Left arrow — always rendered, styled active/inactive */}
        <button
          onClick={() => scrollTabs('left')}
          className={['shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-sky-100 bg-white/80 transition-all',
            canLeft ? 'text-gray-500 hover:text-sky-600 hover:border-sky-300 cursor-pointer' : 'text-gray-200 cursor-default pointer-events-none',
          ].join(' ')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Fixed-width strip — ~4 tabs wide, scrolls for the rest */}
        <div
          ref={tabsRef}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
          style={{ width: 380, flexShrink: 0 }}
        >
          {REPORTS.map(r => (
            <button
              key={r.key}
              onClick={() => switchTab(r.key)}
              className={[
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-all duration-150',
                active === r.key
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-white/80 text-gray-600 border-sky-100 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700',
              ].join(' ')}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scrollTabs('right')}
          className={['shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-sky-100 bg-white/80 transition-all',
            canRight ? 'text-gray-500 hover:text-sky-600 hover:border-sky-300 cursor-pointer' : 'text-gray-200 cursor-default pointer-events-none',
          ].join(' ')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Actions */}
        <div className="shrink-0 flex gap-1.5 ml-auto no-print">
          <Button variant="secondary" size="sm" onClick={handlePdf}>
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
        </div>
      </div>

      {/* ── Filters bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 rounded-2xl border border-sky-100"
        style={{ background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(8px)', boxShadow: '0 1px 4px 0 rgba(14,165,233,0.06)' }}
      >
        {/* Search */}
        <div className="flex items-center gap-1.5 min-w-44 flex-1">
          <Search className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <input
            type="text"
            value={search}
            placeholder="Search name, emp ID, phone…"
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none"
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-300 hover:text-gray-500 text-base leading-none">×</button>
          )}
        </div>

        <div className="w-px h-4 bg-sky-100 shrink-0" />

        {/* Dept */}
        <select value={fDept} onChange={e => setFDept(e.target.value)} className={SEL}>
          <option value="">All Depts</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Type — hidden on retired tab (mostly non-teaching irrelevant distinction) */}
        {active !== 'retired' && (
          <select value={fType} onChange={e => setFType(e.target.value)} className={SEL}>
            <option value="">All Types</option>
            <option value="TEACHING">Teaching</option>
            <option value="NON-TEACHING">Non-Teaching</option>
          </select>
        )}

        {/* Status — hidden on retired tab */}
        {active !== 'retired' && (
          <select value={fStatus} onChange={e => setFStat(e.target.value)} className={SEL}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {/* Designation */}
        <select value={fDesig} onChange={e => setFDesig(e.target.value)} className={SEL}>
          <option value="">All Designations</option>
          {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        {/* Category — only shown when categories exist in data */}
        {categoryOptions.length > 0 && (
          <select value={fCategory} onChange={e => setFCat(e.target.value)} className={SEL}>
            <option value="">All Categories</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        <span className="ml-auto text-[11px] text-gray-400 shrink-0 tabular-nums">
          {displayData.length} record{displayData.length !== 1 ? 's' : ''}
          {hasFilters && <span className="text-sky-500"> · filtered</span>}
        </span>
      </div>

      {/* ── Count chips ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0" style={{ boxShadow: '0 1px 3px rgba(14,165,233,0.07)' }}>
          <span className="text-[11px] text-sky-500 font-semibold">Total</span>
          <span className="text-[11px] font-bold text-gray-800" key={displayData.length} style={{ animation: 'stat-pop 0.28s ease-out' }}>{displayData.length}</span>
        </div>
        <span className="text-sky-200 text-xs select-none shrink-0">·</span>
        <div className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0">
          <span className="text-[11px] text-gray-500 font-medium">Teaching</span>
          <span className="text-[11px] font-bold text-gray-800" key={`t-${chipStats.teaching}`} style={{ animation: 'stat-pop 0.28s ease-out' }}>{chipStats.teaching}</span>
        </div>
        <div className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0">
          <span className="text-[11px] text-gray-500 font-medium">Non-Teaching</span>
          <span className="text-[11px] font-bold text-gray-800" key={`nt-${chipStats.nonTeaching}`} style={{ animation: 'stat-pop 0.28s ease-out' }}>{chipStats.nonTeaching}</span>
        </div>
        {chipStats.deptCounts.length > 0 && (
          <>
            <span className="text-sky-200 text-xs select-none shrink-0">·</span>
            {chipStats.deptCounts.map(({ dept, count }) => (
              <div key={dept} className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: DEPT_COLORS[dept] }} />
                <span className="text-[11px] text-gray-600 font-medium">{dept}</span>
                <span className="text-[11px] font-bold text-gray-800" key={`${dept}-${count}`} style={{ animation: 'stat-pop 0.28s ease-out' }}>{count}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Report title ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0">
        <h2 className="text-sm font-bold text-gray-700">{activeDef.title}</h2>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {active === 'staff-list' ? (
        <StaffTable
          staff={displayData}
          loading={false}
          isAdmin={false}
          onDelete={() => {}}
          onLeave={() => {}}
          className="flex-1 min-h-0"
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ReportTable reportKey={active} data={displayData} />
        </div>
      )}

    </div>
  );
}

// ── Report renderers ────────────────────────────────────────────────────────────

function ReportTable({ reportKey, data }: { reportKey: ReportKey; data: StaffRecord[] }) {
  if (data.length === 0) {
    return <div className="py-16 text-center text-sm text-gray-300">No records match the current filters</div>;
  }

  if (reportKey === 'dor-list') {
    return (
      <Table>
        <Thead>
          <tr>
            <Th>Sl</Th><Th>Name</Th><Th>Emp ID</Th><Th>Designation</Th>
            <Th>Dept</Th><Th>Status</Th><Th className="text-center">DOB</Th><Th className="text-center">DOR</Th>
          </tr>
        </Thead>
        <tbody>
          {data.map((s, i) => {
            const dor = computeDOR(s.dob) || s.dor;
            return (
              <Tr key={s.id}>
                <Td className="font-mono text-xs text-gray-400 w-10">{i + 1}</Td>
                <Td><span className="font-medium">{s.name}</span></Td>
                <Td className="font-mono text-xs">{s.empId}</Td>
                <Td className="text-xs">{s.designation}</Td>
                <Td><DeptBadge dept={s.dept} /></Td>
                <Td><StatusBadge status={s.status} /></Td>
                <Td className="text-xs text-gray-400 text-center font-mono">{formatDate(s.dob)}</Td>
                <Td className="text-xs text-center font-mono font-semibold text-gray-700">{formatDate(dor)}</Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    );
  }

  if (reportKey === 'contact-dir') {
    return (
      <Table>
        <Thead><tr><Th>Sl</Th><Th>Name</Th><Th>Type</Th><Th>Dept</Th><Th>Phone</Th><Th>Email</Th></tr></Thead>
        <tbody>
          {data.map((s, i) => (
            <Tr key={s.id}>
              <Td className="font-mono text-xs text-gray-400 w-10">{i + 1}</Td>
              <Td className="font-medium">{s.name}</Td>
              <Td className="text-xs text-gray-500">{s.type}</Td>
              <Td><DeptBadge dept={s.dept} /></Td>
              <Td>{s.phone || '—'}</Td>
              <Td>{s.email || '—'}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    );
  }

  if (reportKey === 'service-register') {
    return (
      <Table>
        <Thead><tr><Th>Sl</Th><Th>Name</Th><Th>Emp ID</Th><Th>Dept</Th><Th className="text-center">DOB</Th><Th className="text-center">DOE</Th><Th className="text-center">DOR</Th><Th>Service Years</Th></tr></Thead>
        <tbody>
          {data.map((s, i) => {
            const dor = computeDOR(s.dob) || s.dor;
            return (
              <Tr key={s.id}>
                <Td className="font-mono text-xs text-gray-400 w-10">{i + 1}</Td>
                <Td className="font-medium">{s.name}</Td>
                <Td className="font-mono text-xs">{s.empId}</Td>
                <Td><DeptBadge dept={s.dept} /></Td>
                <Td className="text-xs text-gray-400 text-center font-mono">{formatDate(s.dob)}</Td>
                <Td className="text-center">{formatDate(s.doe)}</Td>
                <Td className="text-center font-mono font-semibold text-gray-700">{formatDate(dor)}</Td>
                <Td className="tabular-nums">{computeServiceYears(s.doe)} yrs</Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    );
  }

  if (reportKey === 'seniority' || reportKey === 'by-designation') {
    const groups: Record<string, StaffRecord[]> = {};
    data.forEach(s => { if (!groups[s.designation]) groups[s.designation] = []; groups[s.designation].push(s); });
    return (
      <div className="flex flex-col gap-5">
        {Object.entries(groups).map(([group, members]) => (
          <div key={group}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{group}</p>
            <StaffMiniTable data={members} />
          </div>
        ))}
      </div>
    );
  }

  return <StaffMiniTable data={data} />;
}

function StaffMiniTable({ data }: { data: StaffRecord[] }) {
  return (
    <Table>
      <Thead>
        <tr>
          <Th>Sl</Th><Th>Name</Th><Th>Emp ID</Th><Th>Designation</Th>
          <Th>Type</Th><Th>Dept</Th><Th>Status</Th><Th>Category</Th><Th className="text-center">DOE</Th>
        </tr>
      </Thead>
      <tbody>
        {data.map((s, i) => (
          <Tr key={s.id}>
            <Td className="font-mono text-xs text-gray-400 w-10">{i + 1}</Td>
            <Td><span className="font-medium">{s.name}</span></Td>
            <Td className="font-mono text-xs">{s.empId}</Td>
            <Td className="text-xs">{s.designation}</Td>
            <Td className="text-xs text-gray-400">{s.type}</Td>
            <Td><DeptBadge dept={s.dept} /></Td>
            <Td><StatusBadge status={s.status} /></Td>
            <Td className="text-xs text-gray-500">{s.category || '—'}</Td>
            <Td className="text-xs text-gray-400 text-center">{formatDate(s.doe)}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
