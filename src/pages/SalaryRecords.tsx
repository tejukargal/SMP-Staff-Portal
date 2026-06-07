import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Download, UploadCloud, FileText, CheckCircle2, AlertTriangle, X, Trash2, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { useStaff } from '@/hooks/useStaff';
import { MONTHS } from '@/constants/enums';
import { parseSalaryPdf, type ParsedSlip } from '@/utils/salaryPdfParser';
import { getAllSalarySlips, importSalarySlips, deleteSalarySlipsForMonth } from '@/firebase/firestore';
import { exportReportToExcel } from '@/utils/exportUtils';
import type { SalarySlip, StaffRecord } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_ORDER = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
const DELETE_PASSKEY = 'teju2015';

/** Strip leading zeros so "0100156349" matches staff "100156349" */
function normEmpId(id: string): string {
  return id.trim().replace(/^0+/, '') || id.trim();
}

function fmt(n: number): string { return n ? n.toLocaleString('en-IN') : '—'; }
function maskAccount(acc: string): string {
  if (!acc || acc.length < 4) return acc || '—';
  return '****' + acc.slice(-4);
}

interface MonthYearOption { month: string; year: number; label: string; key: string; }

function buildMonthYearOptions(slips: SalarySlip[]): MonthYearOption[] {
  const seen = new Set<string>();
  const opts: MonthYearOption[] = [];
  for (const s of slips) {
    if (!s.month || !s.year) continue;
    const key = `${s.month}_${s.year}`;
    if (!seen.has(key)) { seen.add(key); opts.push({ month: s.month, year: s.year, label: `${s.month} ${s.year}`, key }); }
  }
  opts.sort((a, b) => a.year !== b.year ? a.year - b.year : (MONTH_ORDER[a.month] ?? 0) - (MONTH_ORDER[b.month] ?? 0));
  return opts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter select
// ─────────────────────────────────────────────────────────────────────────────

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white text-gray-700 transition-colors hover:border-sky-300 shrink-0">
      <option value="">{label}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete modal with passkey
// ─────────────────────────────────────────────────────────────────────────────

interface DeleteModalProps {
  target: { month: string; year: number } | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
function DeleteModal({ target, loading, onConfirm, onCancel }: DeleteModalProps) {
  const [passkey, setPasskey] = useState('');
  const [show, setShow] = useState(false);
  useEffect(() => { if (!target) { setPasskey(''); setShow(false); } }, [target]);
  if (!target) return null;
  const valid = passkey === DELETE_PASSKEY;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: 'blur(4px)' }} onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 z-10 border border-gray-100" style={{ animation: 'modal-enter 0.25s ease-out' }}>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Delete Salary Records</h2>
        <p className="text-sm text-gray-500 mb-5">
          Permanently delete <strong>all records for {target.month} {target.year}</strong>. This cannot be undone.
        </p>
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Enter passkey to confirm</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={passkey} onChange={(e) => setPasskey(e.target.value)}
              placeholder="Enter passkey…" autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
            <button type="button" onClick={() => setShow((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          {passkey && !valid && <p className="text-xs text-red-500 mt-1">Incorrect passkey</p>}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} disabled={!valid}>Delete Records</Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Import Panel
// ─────────────────────────────────────────────────────────────────────────────

interface ImportPanelProps {
  open: boolean; onClose: () => void;
  staffList: StaffRecord[]; user: { uid: string } | null;
  existingMonthYears: Set<string>; onImported: () => void;
}
function ImportPanel({ open, onClose, staffList, user, existingMonthYears, onImported }: ImportPanelProps) {
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedSlips, setParsedSlips] = useState<ParsedSlip[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() { setFile(null); setParsedSlips(null); setParsing(false); setImporting(false); setOverwriteConfirmed(false); }
  function handleClose() { reset(); onClose(); }

  async function handleParse(f: File) {
    setParsing(true); setOverwriteConfirmed(false);
    try {
      const slips = await parseSalaryPdf(f, staffList);
      if (!slips.length) { showToast('error', 'No salary slips found. Check the PDF format.'); return; }
      setParsedSlips(slips);
    } catch { showToast('error', 'Failed to parse PDF. Ensure it is a text-based salary slip file.'); }
    finally { setParsing(false); }
  }

  async function handleSave() {
    if (!parsedSlips || !user) return;
    setImporting(true);
    try {
      const now = Timestamp.now();
      const slips = parsedSlips.map(({ matched: _m, ...slip }) => ({
        ...slip, monthYear: `${slip.month}_${slip.year}`, importedAt: now, importedBy: user.uid,
      }));
      await importSalarySlips(slips);
      showToast('success', `${slips.length} salary slip${slips.length !== 1 ? 's' : ''} saved.`);
      reset(); onImported(); onClose();
    } catch { showToast('error', 'Failed to save records. Please try again.'); }
    finally { setImporting(false); }
  }

  if (!open) return null;
  const matched = parsedSlips?.filter((s) => s.matched).length ?? 0;
  const total = parsedSlips?.length ?? 0;
  const slipKey = parsedSlips?.[0] ? `${parsedSlips[0].month}_${parsedSlips[0].year}` : '';
  const alreadyExists = slipKey ? existingMonthYears.has(slipKey) : false;
  const blockedByOverwrite = alreadyExists && !overwriteConfirmed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: 'blur(4px)' }} onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col z-10 border border-gray-100 mx-4"
        style={{ width: '92vw', maxWidth: 1100, maxHeight: '90vh', animation: 'modal-enter 0.25s ease-out' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Import Salary PDF</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload a government salary slip PDF to extract and save all records</p>
          </div>
          <button onClick={handleClose} className="cursor-pointer text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6">
          {!parsedSlips ? (
            <div className="flex flex-col items-center gap-6 py-8">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setFile(f); }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer flex flex-col items-center gap-3 w-full max-w-lg border-2 border-dashed rounded-2xl p-10 transition-colors ${dragging ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-sky-300 hover:bg-sky-50/50'}`}>
                <UploadCloud className={`w-10 h-10 ${dragging ? 'text-sky-500' : 'text-gray-300'}`} />
                <p className="text-sm font-medium text-gray-700 text-center">
                  {file ? <span className="flex items-center gap-2 text-sky-700 justify-center"><FileText className="w-4 h-4" />{file.name}</span>
                    : 'Drag & drop salary slip PDF, or click to browse'}
                </p>
                {!file && <p className="text-xs text-gray-400">Accepts .pdf files only</p>}
                <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
              </div>
              <Button variant="primary" onClick={() => file && handleParse(file)} disabled={!file || parsing} loading={parsing}>
                {parsing ? 'Parsing PDF…' : 'Parse PDF'}
              </Button>
              <p className="text-xs text-gray-400 text-center max-w-sm">
                PDF must contain government salary slips with <code className="font-mono bg-gray-100 px-1 rounded">SNO:</code> delimiters.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {alreadyExists && !overwriteConfirmed && (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">Records already exist for {parsedSlips[0].month} {parsedSlips[0].year}</p>
                      <p className="text-xs text-amber-700 mt-0.5">Saving will overwrite existing salary records for this month. This cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                    <Button variant="danger" onClick={() => setOverwriteConfirmed(true)}>Proceed Anyway</Button>
                  </div>
                </div>
              )}
              {alreadyExists && overwriteConfirmed && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Existing records for {parsedSlips[0].month} {parsedSlips[0].year} will be overwritten on save.
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-sky-50 border border-sky-100 rounded-xl">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-sky-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-sky-900">
                      {total} slip{total !== 1 ? 's' : ''} parsed — {parsedSlips[0]?.month} {parsedSlips[0]?.year}
                    </p>
                    <p className="text-xs text-sky-700 mt-0.5">
                      {matched} of {total} matched to portal staff
                      {matched < total && <span className="ml-1 text-amber-600 font-medium">· {total - matched} unmatched</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={reset} disabled={importing}>Change File</Button>
                  <Button variant="primary" onClick={handleSave} loading={importing} disabled={total === 0 || blockedByOverwrite}>Save to Firestore</Button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Status','Emp ID','Name','Month/Year','Basic','DA','HRA','IR','SFN','P','SPAY','Gross','Deductions','Net','Bank A/C'].map((h) => (
                        <th key={h} className={`px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${['Basic','DA','HRA','IR','SFN','P','SPAY','Gross','Deductions','Net','Bank A/C'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedSlips.map((slip, i) => (
                      <tr key={i} className={slip.matched ? '' : 'bg-amber-50'}>
                        <td className="px-3 py-2">
                          {slip.matched
                            ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5"><CheckCircle2 className="w-3 h-3" />Matched</span>
                            : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"><AlertTriangle className="w-3 h-3" />Unmatched</span>}
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-700">{slip.empId}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{slip.staffName || '—'}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{slip.month} {slip.year}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(slip.basicPay)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(slip.daAmount)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(slip.hraAmount)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(slip.ir)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(slip.sfn)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(slip.p)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(slip.spayTypist)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(slip.gross)}</td>
                        <td className="px-3 py-2 text-right text-red-600">{fmt(slip.totalDeductions)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">{fmt(slip.netSalary)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-500 text-[11px]">{maskAccount(slip.bankAccount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function SalaryRecords() {
  const { user } = useAuth();
  const { staff } = useStaff();
  const { showToast } = useToast();

  const [allSlips, setAllSlips]           = useState<SalarySlip[]>([]);
  const [loading, setLoading]             = useState(true);
  const [visibleMonthCount, setVisibleMonthCount] = useState(1);

  const [search, setSearch]               = useState('');
  const [filterMonth, setFilterMonth]     = useState('');
  const [filterYear, setFilterYear]       = useState('');
  const [filterDept, setFilterDept]       = useState('');
  const [filterType, setFilterType]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterDesig, setFilterDesig]     = useState('');

  const [importOpen, setImportOpen]       = useState(false);
  const [deleteTarget, setDeleteTarget]   = useState<{ month: string; year: number } | null>(null);
  const [deleting, setDeleting]           = useState(false);

  // ── Staff lookup maps (normalized empId — strips leading zeros) ──
  const empNameMap = useMemo(() => {
    const m = new Map<string, string>();
    staff.forEach((s) => { if (s.empId && s.name) m.set(normEmpId(s.empId), s.name); });
    return m;
  }, [staff]);

  const empStaffMap = useMemo(() => {
    const m = new Map<string, StaffRecord>();
    staff.forEach((s) => { if (s.empId) m.set(normEmpId(s.empId), s); });
    return m;
  }, [staff]);

  // ── Enrich: fill missing names from staff list ──
  const enrichedSlips = useMemo(() =>
    allSlips.map((slip) => ({
      ...slip,
      staffName: slip.staffName || empNameMap.get(normEmpId(slip.empId)) || '',
    })),
    [allSlips, empNameMap],
  );

  // ── Month/year options sorted ASC ──
  const monthYearOptions = useMemo(() => buildMonthYearOptions(enrichedSlips), [enrichedSlips]);
  const uniqueYears  = useMemo(() => [...new Set(monthYearOptions.map((o) => String(o.year)))], [monthYearOptions]);
  const uniqueMonths = useMemo(() => {
    const ms = [...new Set(monthYearOptions.map((o) => o.month))];
    return ms.sort((a, b) => (MONTH_ORDER[a] ?? 0) - (MONTH_ORDER[b] ?? 0));
  }, [monthYearOptions]);

  // ── Available filter options derived from actual matched staff data ──
  const filterOptions = useMemo(() => {
    const depts = new Set<string>(), types = new Set<string>(),
          statuses = new Set<string>(), desigs = new Set<string>();
    enrichedSlips.forEach((slip) => {
      const s = empStaffMap.get(normEmpId(slip.empId));
      if (!s) return;
      if (s.dept)        depts.add(s.dept);
      if (s.type)        types.add(s.type);
      if (s.status)      statuses.add(s.status);
      if (s.designation) desigs.add(s.designation);
    });
    return {
      depts:    [...depts].sort(),
      types:    [...types].sort(),
      statuses: [...statuses].sort(),
      desigs:   [...desigs].sort(),
    };
  }, [enrichedSlips, empStaffMap]);

  const anyFilterActive = !!(filterMonth || filterYear || filterDept || filterType || filterStatus || filterDesig || search);

  // ── Pagination: show most recent N months when no filter active ──
  const visibleMonthYearKeys = useMemo(() => {
    if (anyFilterActive) return null;
    if (!monthYearOptions.length) return new Set<string>();
    return new Set(monthYearOptions.slice(-visibleMonthCount).map((o) => o.key));
  }, [monthYearOptions, visibleMonthCount, anyFilterActive]);

  // ── Filter + search ──
  const filtered = useMemo(() =>
    enrichedSlips
      .filter((slip) => {
        if (visibleMonthYearKeys && !visibleMonthYearKeys.has(slip.monthYear)) return false;
        if (filterMonth && slip.month !== filterMonth) return false;
        if (filterYear  && String(slip.year) !== filterYear) return false;
        const stf = empStaffMap.get(normEmpId(slip.empId));
        if (filterDept   && stf?.dept        !== filterDept)   return false;
        if (filterType   && stf?.type        !== filterType)   return false;
        if (filterStatus && stf?.status      !== filterStatus) return false;
        if (filterDesig  && stf?.designation !== filterDesig)  return false;
        const q = search.trim().toUpperCase();
        if (q && !slip.staffName.toUpperCase().includes(q) && !slip.empId.includes(q) && !normEmpId(slip.empId).includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        const mo = (MONTH_ORDER[b.month] ?? 0) - (MONTH_ORDER[a.month] ?? 0);
        return mo !== 0 ? mo : a.staffName.localeCompare(b.staffName);
      }),
    [enrichedSlips, visibleMonthYearKeys, filterMonth, filterYear, filterDept, filterType, filterStatus, filterDesig, search, empStaffMap],
  );

  // ── Totals ──
  const totals = useMemo(() => ({
    basicPay:        filtered.reduce((s, r) => s + r.basicPay, 0),
    daAmount:        filtered.reduce((s, r) => s + r.daAmount, 0),
    hraAmount:       filtered.reduce((s, r) => s + r.hraAmount, 0),
    ir:              filtered.reduce((s, r) => s + r.ir, 0),
    sfn:             filtered.reduce((s, r) => s + (r.sfn ?? 0), 0),
    p:               filtered.reduce((s, r) => s + (r.p ?? 0), 0),
    spayTypist:      filtered.reduce((s, r) => s + (r.spayTypist ?? 0), 0),
    gross:           filtered.reduce((s, r) => s + r.gross, 0),
    itDeduction:     filtered.reduce((s, r) => s + r.itDeduction, 0),
    ptDeduction:     filtered.reduce((s, r) => s + r.ptDeduction, 0),
    gslic:           filtered.reduce((s, r) => s + r.gslic, 0),
    lic:             filtered.reduce((s, r) => s + r.lic, 0),
    fbf:             filtered.reduce((s, r) => s + r.fbf, 0),
    totalDeductions: filtered.reduce((s, r) => s + r.totalDeductions, 0),
    netSalary:       filtered.reduce((s, r) => s + r.netSalary, 0),
  }), [filtered]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { setAllSlips(await getAllSalarySlips()); }
    catch { showToast('error', 'Failed to load salary records.'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const existingMonthYears = useMemo(() => new Set(allSlips.map((s) => s.monthYear)), [allSlips]);

  function clearFilters() {
    setFilterMonth(''); setFilterYear(''); setFilterDept('');
    setFilterType(''); setFilterStatus(''); setFilterDesig(''); setSearch('');
  }

  function handleExport() {
    if (!filtered.length) return;
    const rows = filtered.map((r, i) => {
      const stf = empStaffMap.get(normEmpId(r.empId));
      return {
        'SL': i + 1, 'EMP ID': r.empId, 'NAME': r.staffName,
        'DEPT': stf?.dept ?? '', 'TYPE': stf?.type ?? '', 'STATUS': stf?.status ?? '',
        'MONTH': r.month, 'YEAR': r.year, 'DESIGNATION': r.designation || (stf?.designation ?? ''),
        'DAYS WORKED': r.daysWorked, 'BASIC PAY': r.basicPay,
        'DA': r.daAmount, 'HRA': r.hraAmount, 'IR': r.ir, 'SFN': r.sfn,
        'GROSS': r.gross, 'IT': r.itDeduction, 'PT': r.ptDeduction,
        'GSLIC': r.gslic, 'LIC': r.lic, 'FBF': r.fbf,
        'TOTAL DEDUCTIONS': r.totalDeductions, 'NET SALARY': r.netSalary, 'BANK A/C': r.bankAccount,
      };
    });
    const suffix = filterMonth && filterYear ? `${filterMonth}_${filterYear}` : filterMonth || filterYear || 'All';
    exportReportToExcel(rows, `Salary ${suffix}`, `SMP_SalaryRecords_${suffix}`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const count = await deleteSalarySlipsForMonth(deleteTarget.month, deleteTarget.year);
      showToast('success', `${count} record${count !== 1 ? 's' : ''} deleted for ${deleteTarget.month} ${deleteTarget.year}.`);
      setDeleteTarget(null);
      await loadAll();
    } catch { showToast('error', 'Failed to delete records.'); }
    finally { setDeleting(false); }
  }

  const canLoadMore = !anyFilterActive && visibleMonthCount < monthYearOptions.length;
  const oldestShownLabel = monthYearOptions.slice(-visibleMonthCount)[0]?.label ?? '';
  const uniqueStaff = new Set(allSlips.map((s) => normEmpId(s.empId))).size;

  const [showInfoCols, setShowInfoCols] = useState(false);

  // Table column definitions
  const COL_HEADERS = ['Emp ID','Name','Dept','Type','Status','Month','Year','Designation','Days','Basic','DA','HRA','IR','SFN','P','SPAY','Gross','IT','PT','GSLIC','LIC','FBF','Tot. Ded.','Net'];
  const RIGHT_COLS  = new Set(['Days','Basic','DA','HRA','IR','SFN','P','SPAY','Gross','IT','PT','GSLIC','LIC','FBF','Tot. Ded.','Net']);
  const CENTER_COLS = new Set(['Days']);
  const HIDDEN_COLS = new Set(['Dept','Type','Status','Designation','Days']);
  // colSpan for the footer label cell: 4 visible (Emp ID, Name, Month, Year) or 9 when info cols shown
  const footerLabelSpan = showInfoCols ? 9 : 4;
  const ic = !showInfoCols ? 'hidden' : ''; // class for info-only columns

  return (
    <div className="h-full flex flex-col gap-3" style={{ animation: 'page-enter 0.35s ease-out' }}>

      {/* ── Toolbar + Stats grouped tightly ── */}
      <div className="flex-shrink-0 flex flex-col gap-1">

      {/* Toolbar: Search + Filters + Actions */}
      <div className="flex items-start gap-1.5">
        {/* Search */}
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input type="text" placeholder="Search name or ID…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 bg-white w-40 cursor-text" />
        </div>

        <div className="w-px self-stretch bg-gray-200 shrink-0 my-0.5" />

        {/* Filters */}
        <FilterSelect label="Month"  value={filterMonth}  onChange={(v) => { setFilterMonth(v);  setVisibleMonthCount(1); }} options={uniqueMonths} />
        <FilterSelect label="Year"   value={filterYear}   onChange={(v) => { setFilterYear(v);   setVisibleMonthCount(1); }} options={uniqueYears} />
        <FilterSelect label="Dept"   value={filterDept}   onChange={setFilterDept}   options={filterOptions.depts} />
        <FilterSelect label="Type"   value={filterType}   onChange={setFilterType}   options={filterOptions.types} />
        <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={filterOptions.statuses} />
        <FilterSelect label="Desig." value={filterDesig}  onChange={setFilterDesig}  options={filterOptions.desigs} />

        {anyFilterActive && (
          <button onClick={clearFilters}
            className="cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-lg px-2 py-1.5 bg-white transition-colors shrink-0">
            <X className="w-3 h-3" /> Clear
          </button>
        )}

        {filterMonth && filterYear && (
          <Button variant="danger" size="sm" onClick={() => setDeleteTarget({ month: filterMonth, year: parseInt(filterYear) })}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        )}

        {/* Push actions to the right */}
        <div className="flex-1" />

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleExport} disabled={!filtered.length}>
              <Download className="w-3.5 h-3.5" /> Export Excel
            </Button>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <UploadCloud className="w-3.5 h-3.5" /> Import Salary
            </Button>
          </div>
          <button
            onClick={() => setShowInfoCols(v => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-sky-600 transition-colors self-end"
          >
            {showInfoCols
              ? <><EyeOff className="w-3 h-3" /> Hide info columns</>
              : <><Eye className="w-3 h-3" /> Show info columns</>}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {([
          { label: 'Showing', value: filtered.length, unit: 'records', accent: 'text-sky-500' },
          'sep',
          { label: 'Months', value: monthYearOptions.length, accent: 'text-gray-500' },
          'sep',
          { label: 'Staff', value: uniqueStaff, accent: 'text-gray-500' },
          ...(filtered.length ? [
            'sep' as const,
            { label: 'Gross', value: `₹${totals.gross.toLocaleString('en-IN')}`, accent: 'text-gray-500' },
            'sep' as const,
            { label: 'Net Total', value: `₹${totals.netSalary.toLocaleString('en-IN')}`, accent: 'text-emerald-600', bold: true },
          ] : []),
        ] as const).map((item, i) =>
          item === 'sep'
            ? <span key={i} className="text-sky-200 text-xs select-none shrink-0">·</span>
            : (
              <div key={i} className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0" style={{ boxShadow: '0 1px 3px rgba(14,165,233,0.07)' }}>
                <span className={`text-[11px] font-medium ${item.accent}`}>{item.label}</span>
                <span className={`text-[11px] ${'bold' in item && item.bold ? 'font-bold' : 'font-semibold'} text-gray-800`}>{item.value}</span>
                {'unit' in item && item.unit && <span className="text-[11px] text-gray-400">{item.unit}</span>}
              </div>
            )
        )}
      </div>

      </div>{/* end toolbar+stats group */}

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full"><Spinner /></div>
        ) : allSlips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <FileText className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-medium">No salary records yet</p>
            <p className="text-xs">Click <strong>Import Salary</strong> to upload a PDF</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
            <Search className="w-10 h-10 text-gray-200" />
            <p className="text-sm">No records match your filters</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 border-b border-gray-200">
                {COL_HEADERS.map((h) => (
                  <th key={h} className={`px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${CENTER_COLS.has(h) ? 'text-center' : RIGHT_COLS.has(h) ? 'text-right' : 'text-left'} ${HIDDEN_COLS.has(h) ? ic : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtered.map((r, rowIdx) => {
                const stf = empStaffMap.get(normEmpId(r.empId));
                return (
                  <tr key={r.id} className="hover:bg-sky-50/40 transition-colors"
                    style={{ animation: 'content-enter 0.25s ease-out both', animationDelay: `${Math.min(rowIdx * 0.018, 0.28)}s` }}>
                    <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">{r.empId}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.staffName || <span className="text-gray-400 italic">—</span>}</td>
                    <td className={`px-3 py-2 text-gray-600 whitespace-nowrap ${ic}`}>
                      {stf?.dept
                        ? <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100">{stf.dept}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 text-gray-600 whitespace-nowrap ${ic}`}>
                      {stf?.type
                        ? <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stf.type === 'TEACHING' ? 'bg-purple-50 text-purple-700 border-purple-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>{stf.type === 'TEACHING' ? 'Teaching' : 'Non-Teaching'}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-3 py-2 whitespace-nowrap ${ic}`}>
                      {stf?.status
                        ? <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stf.status === 'IN SERVICE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>{stf.status}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{r.month}</td>
                    <td className="px-3 py-2 text-gray-600">{r.year}</td>
                    <td className={`px-3 py-2 text-gray-600 whitespace-nowrap ${ic}`}>{r.designation || stf?.designation || <span className="text-gray-300">—</span>}</td>
                    <td className={`px-3 py-2 text-center text-gray-600 ${ic}`}>{r.daysWorked || '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt(r.basicPay)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt(r.daAmount)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmt(r.hraAmount)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(r.ir)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(r.sfn ?? 0)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(r.p ?? 0)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(r.spayTypist ?? 0)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-800">{fmt(r.gross)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{fmt(r.itDeduction)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{fmt(r.ptDeduction)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{fmt(r.gslic)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{fmt(r.lic)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{fmt(r.fbf)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-red-700">{fmt(r.totalDeductions)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{fmt(r.netSalary)}</td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td colSpan={footerLabelSpan} className="px-3 py-2.5 text-xs font-semibold text-gray-600 whitespace-nowrap">
                  TOTAL — {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.basicPay)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.daAmount)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.hraAmount)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.ir)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.sfn)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.p)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.spayTypist)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-800">{fmt(totals.gross)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-700">{fmt(totals.itDeduction)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-700">{fmt(totals.ptDeduction)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-700">{fmt(totals.gslic)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-700">{fmt(totals.lic)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-700">{fmt(totals.fbf)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-700">{fmt(totals.totalDeductions)}</td>
                <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-700">{fmt(totals.netSalary)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Load More — always occupies same height to prevent table resize ── */}
      <div className="flex-shrink-0 h-6 flex items-center justify-center gap-3">
        {canLoadMore && (
          <>
            <span className="text-xs text-gray-400">
              Showing from <strong>{oldestShownLabel}</strong> · {monthYearOptions.length - visibleMonthCount} older month{monthYearOptions.length - visibleMonthCount !== 1 ? 's' : ''} not loaded
            </span>
            <button onClick={() => setVisibleMonthCount((c) => c + 1)}
              className="cursor-pointer inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-800 border border-sky-200 hover:border-sky-400 rounded-full px-3 py-1 transition-colors bg-white">
              <ChevronDown className="w-3 h-3" /> Load More
            </button>
          </>
        )}
      </div>

      <ImportPanel open={importOpen} onClose={() => setImportOpen(false)}
        staffList={staff} user={user} existingMonthYears={existingMonthYears} onImported={loadAll} />

      <DeleteModal target={deleteTarget} loading={deleting}
        onConfirm={() => { void handleDelete(); }} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}
