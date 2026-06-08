import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CalendarDays, TrendingDown, Search, Filter, Plus, Pencil, Trash2, X, RefreshCw } from 'lucide-react';
import {
  getAllStaff,
  getLeaveRecords,
  getLeaveBalance,
  updateLeaveBalance,
  addLeaveRecord,
  updateLeaveRecord,
  deleteLeaveRecord,
} from '@/firebase/firestore';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { DeptBadge } from '@/components/ui/Badge';
import {
  parseDateInput,
  fmtDate,
  isoToInput,
  computeDays,
  LEAVE_COLORS,
  EMPTY_LEAVE_FORM,
  LeaveFormDateField,
} from '@/components/staff/LeaveModal';
import { DEPARTMENTS } from '@/constants/enums';
import type { StaffRecord, LeaveRecord, LeaveType, DayType, DeptEnum } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────

function monthKey(iso: string) { return iso ? iso.slice(0, 7) : ''; }

function monthLabel(ym: string) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// ── Leave Type Badge ──────────────────────────────────────────────────

function LeaveTypeBadge({ type }: { type: LeaveType }) {
  const c = LEAVE_COLORS[type];
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
      style={{ backgroundColor: c.bg, color: c.accent, border: `1px solid ${c.border}` }}
    >
      {type}
    </span>
  );
}

// ── Entry Modal ───────────────────────────────────────────────────────

interface EntryModalProps {
  open: boolean;
  editing: LeaveRecord | null;
  staffList: StaffRecord[];
  onClose: () => void;
  onSaved: () => void;
}

function EntryModal({ open, editing, staffList, onClose, onSaved }: EntryModalProps) {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [form, setForm] = useState(EMPTY_LEAVE_FORM);
  const [dateErrors, setDateErrors] = useState({ from: '', to: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEdit = editing !== null;

  useEffect(() => {
    if (!open) return;
    setError('');
    setDateErrors({ from: '', to: '' });
    if (editing) {
      setSelectedStaffId(editing.staffId);
      setForm({
        fromDate: isoToInput(editing.fromDate),
        toDate: isoToInput(editing.toDate),
        type: editing.type,
        dayType: editing.dayType,
        note: editing.note ?? '',
      });
    } else {
      setSelectedStaffId('');
      setForm(EMPTY_LEAVE_FORM);
    }
  }, [open, editing]);

  const selectedStaff = useMemo(
    () => staffList.find(s => s.id === selectedStaffId) ?? null,
    [staffList, selectedStaffId],
  );

  const fromIso = parseDateInput(form.fromDate);
  const toIso   = parseDateInput(form.toDate);
  const days    = fromIso && toIso ? computeDays(fromIso, toIso, form.dayType as DayType) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const errs = { from: '', to: '' };
    if (!fromIso) errs.from = 'Invalid date (dd/mm/yyyy)';
    if (!toIso)   errs.to   = 'Invalid date (dd/mm/yyyy)';
    if (toIso && fromIso && toIso < fromIso) errs.to = 'Must be ≥ From date';
    if (errs.from || errs.to) { setDateErrors(errs); return; }
    if (!isEdit && !selectedStaffId) { setError('Select a staff member.'); return; }
    if (days <= 0) { setError('Days must be > 0.'); return; }

    setSubmitting(true);
    try {
      const staffId  = isEdit ? editing!.staffId : selectedStaffId;
      const balance  = await getLeaveBalance(staffId);
      const leaveKey = form.type.toLowerCase() as 'cl' | 'hpl' | 'el';

      if (isEdit) {
        const oldKey = editing!.type.toLowerCase() as 'cl' | 'hpl' | 'el';
        balance[oldKey]  = +(balance[oldKey]  + editing!.days).toFixed(1);
        balance[leaveKey] = +(balance[leaveKey] - days).toFixed(1);

        const patch: Partial<Omit<LeaveRecord, 'id' | 'createdAt'>> = {
          type: form.type as LeaveType,
          fromDate: fromIso!,
          toDate: toIso!,
          dayType: form.dayType as DayType,
          days,
        };
        if (form.note.trim()) patch.note = form.note.trim();
        await updateLeaveRecord(staffId, editing!.id!, patch);
      } else {
        balance[leaveKey] = +(balance[leaveKey] - days).toFixed(1);

        const recData: Omit<LeaveRecord, 'id' | 'createdAt'> = {
          staffId,
          staffName: selectedStaff?.name ?? '',
          empId: selectedStaff?.empId ?? '',
          dept: selectedStaff?.dept ?? '',
          type: form.type as LeaveType,
          fromDate: fromIso!,
          toDate: toIso!,
          dayType: form.dayType as DayType,
          days,
        };
        if (form.note.trim()) recData.note = form.note.trim();
        await addLeaveRecord(staffId, recData);
      }

      await updateLeaveBalance(staffId, balance);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-5 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-sm font-bold text-[#111827] mb-4">
          {isEdit ? 'Edit Leave Record' : 'Add Leave Record'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Staff selector — add mode */}
          {!isEdit && (
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">Staff Member</label>
              <select
                value={selectedStaffId}
                onChange={e => setSelectedStaffId(e.target.value)}
                className="w-full text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              >
                <option value="">— Select staff —</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.empId})</option>
                ))}
              </select>
            </div>
          )}

          {/* Edit mode: show staff name read-only */}
          {isEdit && (
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">Staff Member</label>
              <p className="text-xs text-[#374151] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2">
                {editing!.staffName ?? editing!.staffId}
                {editing!.empId ? <span className="text-[#9CA3AF] ml-1.5">({editing!.empId})</span> : null}
              </p>
            </div>
          )}

          {/* Leave type + Day type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">Leave Type</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as LeaveType }))}
                className="w-full text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              >
                <option value="CL">CL — Casual</option>
                <option value="HPL">HPL — Half Pay</option>
                <option value="EL">EL — Earned</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">Day Type</label>
              <select
                value={form.dayType}
                onChange={e => setForm(f => ({ ...f, dayType: e.target.value as DayType }))}
                className="w-full text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              >
                <option value="FULL">Full Day</option>
                <option value="HALF">Half Day</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <LeaveFormDateField
              label="From"
              value={form.fromDate}
              error={dateErrors.from}
              onChange={v => { setForm(f => ({ ...f, fromDate: v })); setDateErrors(e => ({ ...e, from: '' })); }}
            />
            <LeaveFormDateField
              label="To"
              value={form.toDate}
              error={dateErrors.to}
              onChange={v => { setForm(f => ({ ...f, toDate: v })); setDateErrors(e => ({ ...e, to: '' })); }}
            />
          </div>

          {days > 0 && (
            <p className="text-[11px] text-[#6B7280]">
              <span className="font-semibold text-[#111827]">{days}</span> day{days !== 1 ? 's' : ''} deducted from{' '}
              <span className="font-semibold">{form.type}</span> balance
            </p>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">Note (optional)</label>
            <input
              type="text"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Reason or remarks"
              className="w-full text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
            />
          </div>

          {error && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-xs font-medium text-[#374151] border border-[#E5E7EB] rounded-lg py-2 hover:bg-[#F9FAFB] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg py-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {submitting ? <><Spinner size="sm" /> Saving…</> : isEdit ? 'Save Changes' : 'Add Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────

interface DeleteConfirmProps {
  record: LeaveRecord | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteConfirm({ record, onClose, onDeleted }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!record?.id) return;
    setDeleting(true);
    setError('');
    try {
      const balance = await getLeaveBalance(record.staffId);
      const key = record.type.toLowerCase() as 'cl' | 'hpl' | 'el';
      balance[key] = +(balance[key] + record.days).toFixed(1);
      await deleteLeaveRecord(record.staffId, record.id);
      await updateLeaveBalance(record.staffId, balance);
      onDeleted();
      onClose();
    } catch {
      setError('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-[#111827] mb-1">Delete Leave Record?</h2>
        <p className="text-xs text-[#6B7280] mb-4">
          This will restore{' '}
          <span className="font-semibold">{record.days} day{record.days !== 1 ? 's' : ''}</span> of{' '}
          <span className="font-semibold">{record.type}</span> balance for{' '}
          <span className="font-semibold">{record.staffName ?? record.staffId}</span>.
        </p>
        {error && <p className="text-[11px] text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-xs font-medium text-[#374151] border border-[#E5E7EB] rounded-lg py-2 hover:bg-[#F9FAFB] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg py-2 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            {deleting ? <><Spinner size="sm" /> Deleting…</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────

interface SummaryCardProps { label: string; value: number; icon: React.ReactNode; accent: string; bg: string; }

function SummaryCard({ label, value, icon, accent, bg }: SummaryCardProps) {
  return (
    <div className="rounded-xl border bg-white p-3.5 flex items-center gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg, color: accent }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-[#9CA3AF] leading-tight">{label}</p>
        <p className="text-lg font-bold leading-tight" style={{ color: accent }}>{value}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────

export default function LeaveRecords() {
  const [staffList, setStaffList]   = useState<StaffRecord[]>([]);
  const [records, setRecords]       = useState<LeaveRecord[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [entryOpen, setEntryOpen]   = useState(false);
  const [editRecord, setEditRecord] = useState<LeaveRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<LeaveRecord | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; record: LeaveRecord } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  // Fetch per-staff (individual collection cache is up-to-date after writes)
  const loadRecords = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const staff = await getAllStaff();
      setStaffList(staff);
      const arrays = await Promise.all(staff.map(s => s.id ? getLeaveRecords(s.id) : Promise.resolve([])));
      const all = arrays
        .flat()
        .sort((a, b) => (b.fromDate ?? '').localeCompare(a.fromDate ?? ''));
      setRecords(all);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const months = useMemo(() => {
    const set = new Set(records.map(r => monthKey(r.fromDate)).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return records.filter(r => {
      if (q && !(r.staffName ?? '').toUpperCase().includes(q) && !(r.empId ?? '').toUpperCase().includes(q)) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (deptFilter && r.dept !== deptFilter) return false;
      if (monthFilter && monthKey(r.fromDate) !== monthFilter) return false;
      return true;
    });
  }, [records, search, typeFilter, deptFilter, monthFilter]);

  const summary = useMemo(() => ({
    total: filtered.length,
    cl:  filtered.filter(r => r.type === 'CL').reduce((s, r) => s + r.days, 0),
    hpl: filtered.filter(r => r.type === 'HPL').reduce((s, r) => s + r.days, 0),
    el:  filtered.filter(r => r.type === 'EL').reduce((s, r) => s + r.days, 0),
  }), [filtered]);

  const hasFilters = !!(search || typeFilter || deptFilter || monthFilter);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    }
    if (ctxMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [ctxMenu]);

  function openAdd() { setEditRecord(null); setEntryOpen(true); }
  function openEdit(rec: LeaveRecord) { setEditRecord(rec); setEntryOpen(true); }
  function closeEntry() { setEntryOpen(false); setEditRecord(null); }

  if (loading) return <PageSpinner />;

  return (
    <>
      <div className="h-full flex flex-col gap-4" style={{ animation: 'page-enter 0.35s ease-out' }}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#111827] leading-tight">Leave Records</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">{records.length} total entries across all staff</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadRecords(true)}
              disabled={refreshing}
              title="Refresh"
              className="flex items-center justify-center w-8 h-8 rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:text-[#2563EB] hover:bg-[#EFF6FF] hover:border-[#BFDBFE] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] px-3 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Leave
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Total Entries" value={summary.total} icon={<CalendarDays className="w-4 h-4" />} accent="#2563EB" bg="#EFF6FF" />
          <SummaryCard label="CL Days Used"  value={summary.cl}   icon={<TrendingDown className="w-4 h-4" />} accent="#2563EB" bg="#EFF6FF" />
          <SummaryCard label="HPL Days Used" value={summary.hpl}  icon={<TrendingDown className="w-4 h-4" />} accent="#16A34A" bg="#F0FDF4" />
          <SummaryCard label="EL Days Used"  value={summary.el}   icon={<TrendingDown className="w-4 h-4" />} accent="#EA580C" bg="#FFF7ED" />
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search name or Emp ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] w-48"
            />
          </div>

          <div className="flex items-center gap-1 text-[#9CA3AF]"><Filter className="w-3.5 h-3.5" /></div>

          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          >
            <option value="">All Types</option>
            <option value="CL">CL — Casual</option>
            <option value="HPL">HPL — Half Pay</option>
            <option value="EL">EL — Earned</option>
          </select>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          >
            <option value="">All Depts</option>
            {DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={monthFilter}
            onChange={e => setMonthFilter(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          >
            <option value="">All Months</option>
            {months.map(m => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setTypeFilter(''); setDeptFilter(''); setMonthFilter(''); }}
              className="text-xs text-[#6B7280] hover:text-[#374151] px-2 py-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors"
            >
              Clear filters
            </button>
          )}

          <span className="ml-auto text-[11px] text-[#9CA3AF]">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-[#E5E7EB] bg-white" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#9CA3AF]">
              <CalendarDays className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No leave records found</p>
              {hasFilters && <p className="text-xs mt-1">Try adjusting your filters</p>}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280]">Staff</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280]">Emp ID</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280]">Dept</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[#6B7280]">Type</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[#6B7280]">From</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[#6B7280]">To</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[#6B7280]">Days</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[#6B7280]">Half?</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280]">Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec, i) => (
                  <tr
                    key={rec.id}
                    onContextMenu={e => {
                      e.preventDefault();
                      setCtxMenu({ x: e.clientX, y: e.clientY, record: rec });
                    }}
                    className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#F7F8FA] transition-colors cursor-context-menu select-none ${i % 2 === 1 ? 'bg-[#FAFAFA]' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-[#111827]">{rec.staffName ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-[#6B7280]">{rec.empId ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {rec.dept ? <DeptBadge dept={rec.dept as DeptEnum} /> : <span className="text-[#9CA3AF]">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center"><LeaveTypeBadge type={rec.type} /></td>
                    <td className="px-4 py-2.5 text-center font-mono text-[#374151]">{fmtDate(rec.fromDate)}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-[#374151]">{fmtDate(rec.toDate)}</td>
                    <td className="px-4 py-2.5 text-center font-semibold text-[#374151]">{rec.days}</td>
                    <td className="px-4 py-2.5 text-center text-[#9CA3AF]">{rec.dayType === 'HALF' ? '½' : '—'}</td>
                    <td className="px-4 py-2.5 text-[#6B7280] max-w-[140px] truncate">{rec.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <EntryModal
        open={entryOpen}
        editing={editRecord}
        staffList={staffList}
        onClose={closeEntry}
        onSaved={() => void loadRecords(true)}
      />
      <DeleteConfirm
        record={deleteRecord}
        onClose={() => setDeleteRecord(null)}
        onDeleted={() => void loadRecords(true)}
      />

      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1 min-w-[140px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <button
            type="button"
            onClick={() => { openEdit(ctxMenu.record); setCtxMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#374151] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Record
          </button>
          <div className="my-1 border-t border-[#F3F4F6]" />
          <button
            type="button"
            onClick={() => { setDeleteRecord(ctxMenu.record); setCtxMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Record
          </button>
        </div>
      )}
    </>
  );
}
