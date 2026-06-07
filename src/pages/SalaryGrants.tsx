import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Check, X, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { MONTHS } from '@/constants/enums';
import { getAllSalarySlips, getAllSalaryGrants, upsertSalaryGrant } from '@/firebase/firestore';
import type { SalarySlip, SalaryGrant } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTH_ORDER = Object.fromEntries(MONTHS.map((m, i) => [m, i]));

function fmt(n: number): string { return n ? n.toLocaleString('en-IN') : '—'; }

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Local types ───────────────────────────────────────────────────────────────

interface SlipAggregate {
  month: string; year: number; monthYear: string; staffCount: number;
  basicPay: number; daAmount: number; hraAmount: number; ir: number; sfn: number;
  p: number; spayTypist: number;
  gross: number; itDeduction: number; ptDeduction: number; gslic: number;
  lic: number; fbf: number; totalDeductions: number; netSalary: number;
}

type EditDraft = Omit<SalaryGrant, 'id' | 'updatedAt' | 'updatedBy'>;

interface GrantRow {
  key: string; month: string; year: number;
  aggr: SlipAggregate | null;
  grant: SalaryGrant | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function aggregateSlips(slips: SalarySlip[]): Map<string, SlipAggregate> {
  const map = new Map<string, SlipAggregate>();
  for (const s of slips) {
    const key = s.monthYear;
    const a = map.get(key) ?? {
      month: s.month, year: s.year, monthYear: key, staffCount: 0,
      basicPay: 0, daAmount: 0, hraAmount: 0, ir: 0, sfn: 0, p: 0, spayTypist: 0, gross: 0,
      itDeduction: 0, ptDeduction: 0, gslic: 0, lic: 0, fbf: 0,
      totalDeductions: 0, netSalary: 0,
    };
    a.staffCount++;
    a.basicPay       += s.basicPay       || 0;
    a.daAmount       += s.daAmount       || 0;
    a.hraAmount      += s.hraAmount      || 0;
    a.ir             += s.ir             || 0;
    a.sfn            += s.sfn            || 0;
    a.p              += s.p              || 0;
    a.spayTypist     += s.spayTypist     || 0;
    a.gross          += s.gross          || 0;
    a.itDeduction    += s.itDeduction    || 0;
    a.ptDeduction    += s.ptDeduction    || 0;
    a.gslic          += s.gslic          || 0;
    a.lic            += s.lic            || 0;
    a.fbf            += s.fbf            || 0;
    a.totalDeductions += s.totalDeductions || 0;
    a.netSalary      += s.netSalary      || 0;
    map.set(key, a);
  }
  return map;
}

function draftFromRow(row: GrantRow): EditDraft {
  const src = row.grant ?? row.aggr;
  return {
    month:                  row.month,
    year:                   row.year,
    monthYear:              row.key,
    staffCount:             src?.staffCount ?? 0,
    basicPay:               src?.basicPay ?? 0,
    daAmount:               src?.daAmount ?? 0,
    hraAmount:              src?.hraAmount ?? 0,
    ir:                     src?.ir ?? 0,
    sfn:                    src?.sfn ?? 0,
    p:                      src?.p ?? 0,
    spayTypist:             src?.spayTypist ?? 0,
    gross:                  src?.gross ?? 0,
    itDeduction:            src?.itDeduction ?? 0,
    ptDeduction:            src?.ptDeduction ?? 0,
    gslic:                  src?.gslic ?? 0,
    lic:                    src?.lic ?? 0,
    fbf:                    src?.fbf ?? 0,
    totalDeductions:        src?.totalDeductions ?? 0,
    netSalary:              src?.netSalary ?? 0,
    grantsOrderNo:             row.grant?.grantsOrderNo ?? '',
    grantsReceivedGross:       row.grant?.grantsReceivedGross ?? (src?.gross ?? 0),
    grantsReceivedDeductions:  row.grant?.grantsReceivedDeductions ?? (src?.totalDeductions ?? 0),
    grantsReceivedNet:         row.grant?.grantsReceivedNet ?? (src?.netSalary ?? 0),
    salaryCreditedDate:        row.grant?.salaryCreditedDate ?? '',
    deductionsReceivedDate:    row.grant?.deductionsReceivedDate ?? '',
  };
}

// ── Add Entry Modal ───────────────────────────────────────────────────────────

interface AddEntryModalProps {
  existingKeys: Set<string>;
  onAdd: (month: string, year: number) => void;
  onClose: () => void;
}

function AddEntryModal({ existingKeys, onAdd, onClose }: AddEntryModalProps) {
  const [month, setMonth] = useState('');
  const [year, setYear]   = useState(new Date().getFullYear());

  const key            = month ? `${month}_${year}` : '';
  const alreadyExists  = key ? existingKeys.has(key) : false;
  const canConfirm     = !!month && year >= 2000 && year <= 2100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 z-10 border border-gray-100"
        style={{ animation: 'modal-enter 0.25s ease-out' }}>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Add Grant Entry</h2>
        <div className="flex flex-col gap-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300">
              <option value="">Select month…</option>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
            <input type="number" value={year} min={2000} max={2100}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
          </div>
          {alreadyExists && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              A row for <strong>{month} {year}</strong> already exists — it will be opened for editing.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { if (canConfirm) { onAdd(month, year); onClose(); } }} disabled={!canConfirm}>
            {alreadyExists ? 'Edit Existing' : 'Add & Edit'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const TH = 'px-2.5 py-2 font-semibold text-gray-700 whitespace-nowrap text-[11px]';
const TD = 'px-2.5 py-2';

const INPUT_BASE =
  'text-xs border rounded px-1.5 py-1 focus:outline-none focus:ring-1 bg-white w-full tabular-nums';

// ── Main Component ────────────────────────────────────────────────────────────

export default function SalaryGrants() {
  const { user }      = useAuth();
  const { showToast } = useToast();

  const [slips,        setSlips]        = useState<SalarySlip[]>([]);
  const [grants,       setGrants]       = useState<SalaryGrant[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editingKey,   setEditingKey]   = useState<string | null>(null);
  const [editDraft,    setEditDraft]    = useState<EditDraft | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [extraKeys,    setExtraKeys]    = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([getAllSalarySlips(), getAllSalaryGrants()]);
      setSlips(s);
      setGrants(g);
    } catch {
      showToast('error', 'Failed to load salary data');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

  const slipAggregates = useMemo(() => aggregateSlips(slips), [slips]);

  const grantMap = useMemo(() => {
    const m = new Map<string, SalaryGrant>();
    grants.forEach(g => m.set(g.monthYear, g));
    return m;
  }, [grants]);

  const rows = useMemo((): GrantRow[] => {
    const keys = new Set([...slipAggregates.keys(), ...grantMap.keys(), ...extraKeys]);
    return [...keys]
      .map(key => ({
        key,
        month: slipAggregates.get(key)?.month ?? grantMap.get(key)?.month ?? key.split('_')[0],
        year:  slipAggregates.get(key)?.year  ?? grantMap.get(key)?.year  ?? Number(key.split('_')[1]),
        aggr:  slipAggregates.get(key) ?? null,
        grant: grantMap.get(key) ?? null,
      }))
      .sort((a, b) =>
        a.year !== b.year ? b.year - a.year
          : (MONTH_ORDER[b.month] ?? 0) - (MONTH_ORDER[a.month] ?? 0)
      );
  }, [slipAggregates, grantMap, extraKeys]);

  const existingKeys = useMemo(() => new Set(rows.map(r => r.key)), [rows]);

  const patch = useCallback((updates: Partial<EditDraft>) => {
    setEditDraft(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  function startEdit(row: GrantRow) {
    setEditDraft(draftFromRow(row));
    setEditingKey(row.key);
  }

  function cancelEdit(row: GrantRow) {
    setEditingKey(null);
    setEditDraft(null);
    if (!row.aggr && !row.grant) {
      setExtraKeys(prev => { const n = new Set(prev); n.delete(row.key); return n; });
    }
  }

  async function saveEdit() {
    if (!editDraft || !user) return;
    setSaving(true);
    try {
      await upsertSalaryGrant(editDraft, user.uid);
      showToast('success', `Saved grant for ${editDraft.month} ${editDraft.year}`);
      setEditingKey(null);
      setEditDraft(null);
      setExtraKeys(prev => { const n = new Set(prev); n.delete(editDraft.monthYear); return n; });
      await loadData();
    } catch {
      showToast('error', 'Failed to save grant record');
    } finally {
      setSaving(false);
    }
  }

  function handleAddEntry(month: string, year: number) {
    const key  = `${month}_${year}`;
    const aggr = slipAggregates.get(key) ?? null;
    const grant = grantMap.get(key) ?? null;
    if (!existingKeys.has(key)) {
      setExtraKeys(prev => new Set([...prev, key]));
    }
    setEditDraft(draftFromRow({ key, month, year, aggr, grant }));
    setEditingKey(key);
  }

  // Summary stats
  const totalSaved      = grants.length;
  const totalUnsaved    = rows.filter(r => r.aggr && !r.grant).length;
  const totalNetSaved   = grants.reduce((s, g) => s + (g.netSalary || 0), 0);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Spinner /></div>;
  }

  const d = editDraft;

  return (
    <div className="h-full flex flex-col gap-3" style={{ animation: 'page-enter 0.35s ease-out' }}>

      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { label: 'Total Months', value: rows.length,   accent: 'text-sky-600' },
            'sep' as const,
            { label: 'Saved',        value: totalSaved,    accent: 'text-emerald-600' },
            'sep' as const,
            { label: 'From Slips',   value: totalUnsaved,  accent: 'text-amber-600' },
            ...(totalSaved ? ['sep' as const, { label: 'Net Total Saved', value: `₹${totalNetSaved.toLocaleString('en-IN')}`, accent: 'text-teal-700' }] : []),
          ] as const).map((item, i) =>
            item === 'sep'
              ? <span key={i} className="text-sky-200 text-xs select-none">·</span>
              : (
                <div key={i} className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0"
                  style={{ boxShadow: '0 1px 3px rgba(14,165,233,0.07)' }}>
                  <span className={`text-[11px] font-medium ${item.accent}`}>{item.label}</span>
                  <span className="text-[11px] font-semibold text-gray-800">{item.value}</span>
                </div>
              )
          )}
        </div>

        <Button size="sm" onClick={() => setAddModalOpen(true)} disabled={!!editingKey}>
          <Plus className="w-3.5 h-3.5" /> Add Grant Entry
        </Button>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-gray-200 bg-white">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
            <IndianRupee className="w-12 h-12 text-gray-200" />
            <p className="text-sm font-medium">No salary data yet</p>
            <p className="text-xs">Import salary PDFs in Salary Records, or click <strong>Add Grant Entry</strong></p>
          </div>
        ) : (
          <table className="text-xs border-collapse w-full" style={{ minWidth: 2144 }}>

            {/* ── Two-row header ── */}
            <thead className="sticky top-0 z-20">

              {/* Group labels */}
              <tr>
                <th colSpan={2}
                  className="bg-sky-50 border-b border-sky-100 border-r border-sky-200 px-3 py-1.5 text-[10px] font-bold text-sky-700 text-center tracking-wider uppercase whitespace-nowrap">
                  Period
                </th>
                <th colSpan={8}
                  className="bg-emerald-50 border-b border-emerald-100 border-r border-emerald-200 px-3 py-1.5 text-[10px] font-bold text-emerald-700 text-center tracking-wider uppercase whitespace-nowrap">
                  Salary Breakdown
                </th>
                <th colSpan={6}
                  className="bg-red-50 border-b border-red-100 border-r border-red-200 px-3 py-1.5 text-[10px] font-bold text-red-700 text-center tracking-wider uppercase whitespace-nowrap">
                  Deductions
                </th>
                <th colSpan={1}
                  className="bg-teal-50 border-b border-teal-100 border-r border-teal-200 px-3 py-1.5 text-[10px] font-bold text-teal-700 text-center tracking-wider uppercase whitespace-nowrap">
                  Net
                </th>
                <th colSpan={6}
                  className="bg-amber-50 border-b border-amber-100 border-r border-amber-200 px-3 py-1.5 text-[10px] font-bold text-amber-700 text-center tracking-wider uppercase whitespace-nowrap">
                  Grant Administration
                </th>
                <th className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 text-[10px] font-bold text-gray-500 text-center tracking-wider uppercase whitespace-nowrap">
                  &nbsp;
                </th>
              </tr>

              {/* Column headers */}
              <tr className="border-b-2 border-gray-200">
                {/* Period */}
                <th className={`${TH} sticky left-0 z-10 bg-sky-50/95 text-left border-r border-sky-200`} style={{ minWidth: 110 }}>
                  Month / Year
                </th>
                <th className={`${TH} bg-sky-50/95 text-center border-r border-sky-200`} style={{ minWidth: 52 }}>Staff</th>

                {/* Salary breakdown */}
                <th className={`${TH} bg-emerald-50/95 text-right`} style={{ minWidth: 90 }}>Basic</th>
                <th className={`${TH} bg-emerald-50/95 text-right`} style={{ minWidth: 80 }}>DA</th>
                <th className={`${TH} bg-emerald-50/95 text-right`} style={{ minWidth: 80 }}>HRA</th>
                <th className={`${TH} bg-emerald-50/95 text-right`} style={{ minWidth: 72 }}>IR</th>
                <th className={`${TH} bg-emerald-50/95 text-right`} style={{ minWidth: 70 }}>SFN</th>
                <th className={`${TH} bg-emerald-50/95 text-right`} style={{ minWidth: 62 }}>P</th>
                <th className={`${TH} bg-emerald-50/95 text-right`} style={{ minWidth: 80 }}>SPAY</th>
                <th className={`${TH} bg-emerald-50/95 text-right border-r border-emerald-200`} style={{ minWidth: 90 }}>Gross</th>

                {/* Deductions */}
                <th className={`${TH} bg-red-50/95 text-right`} style={{ minWidth: 70 }}>IT</th>
                <th className={`${TH} bg-red-50/95 text-right`} style={{ minWidth: 70 }}>PT</th>
                <th className={`${TH} bg-red-50/95 text-right`} style={{ minWidth: 70 }}>GSLIC</th>
                <th className={`${TH} bg-red-50/95 text-right`} style={{ minWidth: 70 }}>LIC</th>
                <th className={`${TH} bg-red-50/95 text-right`} style={{ minWidth: 62 }}>FBF</th>
                <th className={`${TH} bg-red-50/95 text-right border-r border-red-200`} style={{ minWidth: 90 }}>Tot. Ded.</th>

                {/* Net */}
                <th className={`${TH} bg-teal-50/95 text-right border-r border-teal-200`} style={{ minWidth: 92 }}>Net Salary</th>

                {/* Grant admin */}
                <th className={`${TH} bg-amber-50/95 text-left`} style={{ minWidth: 160 }}>Grants Order No.</th>
                <th className={`${TH} bg-amber-50/95 text-right`} style={{ minWidth: 106 }}>Grants (Gross)</th>
                <th className={`${TH} bg-amber-50/95 text-right`} style={{ minWidth: 106 }}>Grants (Ded.)</th>
                <th className={`${TH} bg-amber-50/95 text-right`} style={{ minWidth: 106 }}>Grants (Net)</th>
                <th className={`${TH} bg-amber-50/95 text-center`} style={{ minWidth: 128 }}>Salary Credited</th>
                <th className={`${TH} bg-amber-50/95 text-center border-r border-amber-200`} style={{ minWidth: 128 }}>Ded. Received</th>

                {/* Actions */}
                <th className={`${TH} bg-gray-50/95 text-center`} style={{ minWidth: 120 }}>Status / Action</th>
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, rowIdx) => {
                const isEditing = editingKey === row.key;
                const isSaved   = !!row.grant;
                const src       = row.grant ?? row.aggr;

                const rowBg = isEditing
                  ? 'bg-sky-50/50'
                  : isSaved
                    ? 'hover:bg-gray-50/50'
                    : 'bg-amber-50/20 hover:bg-amber-50/40';

                const stickyBg = isEditing
                  ? 'rgba(240,249,255,0.98)'
                  : isSaved
                    ? 'rgba(255,255,255,0.98)'
                    : 'rgba(255,251,235,0.98)';

                /* ── Number input shared helper ── */
                function numInput(
                  field: keyof EditDraft,
                  borderCls = 'border-sky-200 focus:ring-sky-400',
                  textCls   = 'text-gray-800',
                ) {
                  return (
                    <input
                      type="number"
                      value={d ? ((d[field] as number) || '') : ''}
                      onChange={(e) => patch({ [field]: Number(e.target.value) } as Partial<EditDraft>)}
                      className={`${INPUT_BASE} text-right ${borderCls} ${textCls}`}
                    />
                  );
                }

                return (
                  <tr key={row.key}
                    className={`transition-colors ${rowBg}`}
                    style={{ animation: 'content-enter 0.25s ease-out both', animationDelay: `${Math.min(rowIdx * 0.022, 0.28)}s` }}>

                    {/* Month / Year — sticky */}
                    <td className={`${TD} sticky left-0 z-10 border-r border-gray-100`}
                      style={{ background: stickyBg, minWidth: 110 }}>
                      <div className="font-semibold text-gray-800 text-[13px] leading-tight">{row.month}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{row.year}</div>
                    </td>

                    {/* Staff count */}
                    <td className={`${TD} text-center text-gray-600 border-r border-gray-100`}>
                      {src?.staffCount ?? (isEditing && d ? d.staffCount : 0)}
                    </td>

                    {/* ─── Salary fields ─── */}
                    {isEditing ? (
                      <>
                        <td className={TD}>{numInput('basicPay')}</td>
                        <td className={TD}>{numInput('daAmount')}</td>
                        <td className={TD}>{numInput('hraAmount')}</td>
                        <td className={TD}>{numInput('ir')}</td>
                        <td className={TD}>{numInput('sfn')}</td>
                        <td className={TD}>{numInput('p')}</td>
                        <td className={TD}>{numInput('spayTypist')}</td>
                        <td className={`${TD} border-r border-gray-100`}>
                          {numInput('gross', 'border-emerald-300 focus:ring-emerald-400', 'text-emerald-800 font-semibold')}
                        </td>
                        <td className={TD}>{numInput('itDeduction', 'border-red-200 focus:ring-red-400', 'text-red-700')}</td>
                        <td className={TD}>{numInput('ptDeduction', 'border-red-200 focus:ring-red-400', 'text-red-700')}</td>
                        <td className={TD}>{numInput('gslic', 'border-red-200 focus:ring-red-400', 'text-red-700')}</td>
                        <td className={TD}>{numInput('lic', 'border-red-200 focus:ring-red-400', 'text-red-700')}</td>
                        <td className={TD}>{numInput('fbf', 'border-red-200 focus:ring-red-400', 'text-red-700')}</td>
                        <td className={`${TD} border-r border-gray-100`}>
                          {numInput('totalDeductions', 'border-red-300 focus:ring-red-400', 'text-red-800 font-semibold')}
                        </td>
                        <td className={`${TD} border-r border-gray-100`}>
                          {numInput('netSalary', 'border-teal-300 focus:ring-teal-400', 'text-teal-800 font-bold')}
                        </td>

                        {/* Grant admin inputs */}
                        <td className={TD}>
                          <input type="text"
                            value={d?.grantsOrderNo ?? ''}
                            onChange={(e) => patch({ grantsOrderNo: e.target.value })}
                            placeholder="Order no. / reference…"
                            className={`${INPUT_BASE} border-amber-300 focus:ring-amber-400 text-left`}
                            style={{ minWidth: 140 }}
                          />
                        </td>
                        <td className={TD}>
                          {numInput('grantsReceivedGross', 'border-amber-300 focus:ring-amber-400', 'text-amber-800 font-semibold')}
                        </td>
                        <td className={TD}>
                          {numInput('grantsReceivedDeductions', 'border-amber-300 focus:ring-amber-400', 'text-red-700 font-semibold')}
                        </td>
                        <td className={TD}>
                          {numInput('grantsReceivedNet', 'border-amber-300 focus:ring-amber-400', 'text-teal-700 font-bold')}
                        </td>
                        <td className={TD}>
                          <input type="date"
                            value={d?.salaryCreditedDate ?? ''}
                            onChange={(e) => patch({ salaryCreditedDate: e.target.value })}
                            className={`${INPUT_BASE} border-amber-300 focus:ring-amber-400`}
                          />
                        </td>
                        <td className={`${TD} border-r border-gray-100`}>
                          <input type="date"
                            value={d?.deductionsReceivedDate ?? ''}
                            onChange={(e) => patch({ deductionsReceivedDate: e.target.value })}
                            className={`${INPUT_BASE} border-amber-300 focus:ring-amber-400`}
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        {/* ─── Display mode ─── */}
                        <td className={`${TD} text-right tabular-nums text-gray-600`}>{fmt(src?.basicPay ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-gray-600`}>{fmt(src?.daAmount ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-gray-600`}>{fmt(src?.hraAmount ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-gray-500`}>{fmt(src?.ir ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-gray-500`}>{fmt(src?.sfn ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-gray-500`}>{fmt(src?.p ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-gray-500`}>{fmt(src?.spayTypist ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums font-semibold text-gray-800 border-r border-gray-100`}>
                          {fmt(src?.gross ?? 0)}
                        </td>
                        <td className={`${TD} text-right tabular-nums text-red-500`}>{fmt(src?.itDeduction ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-red-500`}>{fmt(src?.ptDeduction ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-red-500`}>{fmt(src?.gslic ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-red-500`}>{fmt(src?.lic ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums text-red-500`}>{fmt(src?.fbf ?? 0)}</td>
                        <td className={`${TD} text-right tabular-nums font-semibold text-red-700 border-r border-gray-100`}>
                          {fmt(src?.totalDeductions ?? 0)}
                        </td>
                        <td className={`${TD} text-right tabular-nums font-bold text-teal-700 border-r border-gray-100`}>
                          {fmt(src?.netSalary ?? 0)}
                        </td>

                        {/* Grant admin — only meaningful when saved */}
                        <td className={TD}>
                          {row.grant?.grantsOrderNo
                            ? <span className="font-medium text-amber-800">{row.grant.grantsOrderNo}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          <span className={isSaved ? 'font-semibold text-amber-700' : 'text-gray-400'}>
                            {fmt(row.grant?.grantsReceivedGross ?? src?.gross ?? 0)}
                          </span>
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          <span className={isSaved ? 'font-semibold text-red-600' : 'text-gray-400'}>
                            {fmt(row.grant?.grantsReceivedDeductions ?? src?.totalDeductions ?? 0)}
                          </span>
                        </td>
                        <td className={`${TD} text-right tabular-nums`}>
                          <span className={isSaved ? 'font-bold text-teal-700' : 'text-gray-400'}>
                            {fmt(row.grant?.grantsReceivedNet ?? src?.netSalary ?? 0)}
                          </span>
                        </td>
                        <td className={`${TD} text-center`}>
                          {row.grant?.salaryCreditedDate
                            ? <span className="text-gray-700">{fmtDate(row.grant.salaryCreditedDate)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={`${TD} text-center border-r border-gray-100`}>
                          {row.grant?.deductionsReceivedDate
                            ? <span className="text-gray-700">{fmtDate(row.grant.deductionsReceivedDate)}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                      </>
                    )}

                    {/* Actions */}
                    <td className={`${TD} text-center`}>
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <Button size="sm" onClick={saveEdit} loading={saving} disabled={saving}>
                            <Check className="w-3 h-3" /> Save
                          </Button>
                          <button onClick={() => cancelEdit(row)}
                            className="cursor-pointer p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`inline-flex items-center text-[10px] font-semibold rounded-full px-2 py-0.5 ${
                            isSaved
                              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                              : 'text-amber-700 bg-amber-50 border border-amber-200'
                          }`}>
                            {isSaved ? 'Saved' : 'From Slips'}
                          </span>
                          <button
                            onClick={() => startEdit(row)}
                            disabled={!!editingKey}
                            title="Edit"
                            className="cursor-pointer p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* ── Footer totals ── */}
            {rows.length > 0 && (() => {
              const vis = rows.map(r => r.grant ?? r.aggr);
              const sum = (f: keyof SlipAggregate & keyof SalaryGrant) =>
                vis.reduce((acc, s) => acc + ((s as SlipAggregate | SalaryGrant | null)?.[f] as number || 0), 0);
              return (
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-gray-50 border-t-2 border-gray-300 text-[11px]">
                    <td className="sticky left-0 z-10 bg-gray-50 px-2.5 py-2 font-bold text-gray-700 whitespace-nowrap border-r border-gray-200"
                      style={{ minWidth: 110 }}>
                      TOTAL — {rows.length} month{rows.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-2.5 py-2 text-center font-semibold text-gray-600 border-r border-gray-200">
                      {rows.reduce((acc, r) => acc + ((r.grant ?? r.aggr)?.staffCount || 0), 0)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-gray-800">{fmt(sum('basicPay'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-gray-800">{fmt(sum('daAmount'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-gray-800">{fmt(sum('hraAmount'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-gray-800">{fmt(sum('ir'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-gray-800">{fmt(sum('sfn'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-gray-800">{fmt(sum('p'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-gray-800">{fmt(sum('spayTypist'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-emerald-800 border-r border-gray-200">{fmt(sum('gross'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-red-700">{fmt(sum('itDeduction'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-red-700">{fmt(sum('ptDeduction'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-red-700">{fmt(sum('gslic'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-red-700">{fmt(sum('lic'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-red-700">{fmt(sum('fbf'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-red-800 border-r border-gray-200">{fmt(sum('totalDeductions'))}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-bold text-teal-800 border-r border-gray-200">{fmt(sum('netSalary'))}</td>
                    <td className="px-2.5 py-2 text-gray-400" colSpan={7}>—</td>
                  </tr>
                </tfoot>
              );
            })()}
          </table>
        )}
      </div>

      {addModalOpen && (
        <AddEntryModal
          existingKeys={existingKeys}
          onAdd={handleAddEntry}
          onClose={() => setAddModalOpen(false)}
        />
      )}
    </div>
  );
}
