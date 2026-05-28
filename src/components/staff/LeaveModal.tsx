import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Pencil, CalendarDays, Wallet } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import {
  getLeaveBalance,
  updateLeaveBalance,
  getLeaveRecords,
  addLeaveRecord,
  updateLeaveRecord,
  deleteLeaveRecord,
} from '@/firebase/firestore';
import type { StaffRecord, LeaveBalance, LeaveRecord, LeaveType, DayType } from '@/types';

interface Props {
  open: boolean;
  staff: StaffRecord | null;
  onClose: () => void;
}

type Tab = 'balances' | 'records';

const LEAVE_LABELS: Record<LeaveType, string> = {
  CL: 'Casual Leave', HPL: 'Half Pay Leave', EL: 'Earned Leave',
};

export const LEAVE_COLORS: Record<LeaveType, { bg: string; border: string; accent: string }> = {
  CL:  { bg: '#EFF6FF', border: '#BFDBFE', accent: '#2563EB' },
  HPL: { bg: '#F0FDF4', border: '#BBF7D0', accent: '#16A34A' },
  EL:  { bg: '#FFF7ED', border: '#FED7AA', accent: '#EA580C' },
};

/** Parse dd/mm/yyyy or dd-mm-yyyy → YYYY-MM-DD. Returns null if invalid. */
export function parseDateInput(s: string): string | null {
  if (!s) return null;
  const parts = s.replace(/-/g, '/').split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10), m = parseInt(parts[1], 10), rawY = parseInt(parts[2], 10);
  if (isNaN(d) || isNaN(m) || isNaN(rawY) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const y = rawY < 100 ? 2000 + rawY : rawY;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** YYYY-MM-DD → dd/mm/yyyy */
export function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** YYYY-MM-DD → dd/mm/yyyy for text input pre-fill */
export function isoToInput(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function computeDays(fromIso: string, toIso: string, dayType: DayType): number {
  if (!fromIso || !toIso) return 0;
  const from = new Date(fromIso), to = new Date(toIso);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return 0;
  const cal = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return dayType === 'HALF' ? cal * 0.5 : cal;
}

export const EMPTY_LEAVE_FORM = {
  fromDate: '', toDate: '', type: 'CL' as LeaveType, dayType: 'FULL' as DayType, note: 'Personal',
};

export function LeaveModal({ open, staff, onClose }: Props) {
  const [tab, setTab]               = useState<Tab>('balances');
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveOk, setSaveOk]         = useState(false);
  const [balance, setBalance]       = useState<LeaveBalance>({ cl: 0, hpl: 0, el: 0 });
  const [records, setRecords]       = useState<LeaveRecord[]>([]);
  const [form, setForm]             = useState(EMPTY_LEAVE_FORM);
  const [dateErrors, setDateErrors] = useState({ from: '', to: '' });
  const [editingRecord, setEditingRecord] = useState<LeaveRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError]           = useState('');

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const [bal, recs] = await Promise.all([getLeaveBalance(id), getLeaveRecords(id)]);
      setBalance(bal);
      setRecords(recs);
    } catch { /* show empty state */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open && staff?.id) {
      setTab('balances');
      setForm(EMPTY_LEAVE_FORM);
      setEditingRecord(null);
      setError('');
      setSaveOk(false);
      setDateErrors({ from: '', to: '' });
      void load(staff.id);
    }
  }, [open, staff?.id, load]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !staff) return null;

  // ── Balance save ──────────────────────────────────────────────────────
  const handleSaveBalance = async () => {
    if (!staff.id) return;
    setSaving(true); setSaveOk(false);
    try {
      await updateLeaveBalance(staff.id, balance);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch { setError('Failed to save balances.'); }
    finally { setSaving(false); }
  };

  // ── Date validation ───────────────────────────────────────────────────
  function validateDates(): { fromIso: string; toIso: string } | null {
    const fromIso = parseDateInput(form.fromDate);
    const toIso   = parseDateInput(form.toDate);
    const errs = {
      from: fromIso ? '' : form.fromDate ? 'Invalid — use dd/mm/yyyy' : 'Required',
      to:   toIso   ? '' : form.toDate   ? 'Invalid — use dd/mm/yyyy' : 'Required',
    };
    setDateErrors(errs);
    if (!fromIso || !toIso) return null;
    if (toIso < fromIso) { setDateErrors(e => ({ ...e, to: 'Must be on or after From date' })); return null; }
    return { fromIso, toIso };
  }

  // ── Add record ────────────────────────────────────────────────────────
  const handleAddRecord = async () => {
    if (!staff.id) return;
    setError('');
    const dates = validateDates();
    if (!dates) return;
    const { fromIso, toIso } = dates;
    const days = computeDays(fromIso, toIso, form.dayType);
    if (days <= 0) { setError('Invalid date range.'); return; }
    setSubmitting(true);
    try {
      const key = form.type.toLowerCase() as keyof LeaveBalance;
      const recData: Omit<LeaveRecord, 'id' | 'createdAt'> = {
        staffId: staff.id, staffName: staff.name, empId: staff.empId, dept: staff.dept,
        type: form.type, fromDate: fromIso, toDate: toIso, dayType: form.dayType, days,
      };
      if (form.note.trim()) recData.note = form.note.trim();
      await addLeaveRecord(staff.id, recData);
      const nb = { ...balance, [key]: +(balance[key] - days).toFixed(1) };
      await updateLeaveBalance(staff.id, nb);
      setBalance(nb);
      setForm(EMPTY_LEAVE_FORM);
      setDateErrors({ from: '', to: '' });
      void load(staff.id);
    } catch (e) {
      console.error('addLeaveRecord error:', e);
      setError('Failed to save record. Please try again.');
    } finally { setSubmitting(false); }
  };

  // ── Edit record ───────────────────────────────────────────────────────
  const startEdit = (rec: LeaveRecord) => {
    setEditingRecord(rec);
    setForm({ fromDate: isoToInput(rec.fromDate), toDate: isoToInput(rec.toDate), type: rec.type, dayType: rec.dayType, note: rec.note ?? '' });
    setDateErrors({ from: '', to: '' });
    setError('');
  };

  const cancelEdit = () => {
    setEditingRecord(null);
    setForm(EMPTY_LEAVE_FORM);
    setDateErrors({ from: '', to: '' });
    setError('');
  };

  const handleUpdateRecord = async () => {
    if (!staff.id || !editingRecord?.id) return;
    setError('');
    const dates = validateDates();
    if (!dates) return;
    const { fromIso, toIso } = dates;
    const newDays = computeDays(fromIso, toIso, form.dayType);
    if (newDays <= 0) { setError('Invalid date range.'); return; }
    setSubmitting(true);
    try {
      const oldKey = editingRecord.type.toLowerCase() as keyof LeaveBalance;
      const newKey = form.type.toLowerCase() as keyof LeaveBalance;
      const nb = { ...balance };
      nb[oldKey] = +(nb[oldKey] + editingRecord.days).toFixed(1);
      nb[newKey] = +(nb[newKey] - newDays).toFixed(1);
      const upd: Partial<LeaveRecord> = { type: form.type, fromDate: fromIso, toDate: toIso, dayType: form.dayType, days: newDays };
      if (form.note.trim()) upd.note = form.note.trim(); else upd.note = undefined;
      await updateLeaveRecord(staff.id, editingRecord.id, upd);
      await updateLeaveBalance(staff.id, nb);
      setBalance(nb);
      cancelEdit();
      void load(staff.id);
    } catch (e) {
      console.error('updateLeaveRecord error:', e);
      setError('Failed to update record.');
    } finally { setSubmitting(false); }
  };

  // ── Delete record ─────────────────────────────────────────────────────
  const handleDeleteRecord = async (rec: LeaveRecord) => {
    if (!staff.id || !rec.id) return;
    if (editingRecord?.id === rec.id) cancelEdit();
    setDeletingId(rec.id);
    try {
      await deleteLeaveRecord(staff.id, rec.id);
      const key = rec.type.toLowerCase() as keyof LeaveBalance;
      const nb = { ...balance, [key]: +(balance[key] + rec.days).toFixed(1) };
      await updateLeaveBalance(staff.id, nb);
      setBalance(nb);
      setRecords(r => r.filter(x => x.id !== rec.id));
    } catch { setError('Failed to delete record.'); }
    finally { setDeletingId(null); }
  };

  const fromIso     = parseDateInput(form.fromDate);
  const toIso       = parseDateInput(form.toDate);
  const previewDays = fromIso && toIso ? computeDays(fromIso, toIso, form.dayType) : 0;
  const isEditing   = editingRecord !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', animation: 'backdrop-enter 0.2s ease-out' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: 540, maxHeight: '90vh', animation: 'modal-enter 0.22s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#F0F2F5] shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-[#111827] leading-tight">Leave Management</h2>
            <p className="text-xs text-[#6B7280] mt-0.5 truncate max-w-xs">{staff.name} · {staff.empId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0 shrink-0">
          {([
            ['balances', <Wallet key="w" className="w-3.5 h-3.5" />, 'Balances'],
            ['records',  <CalendarDays key="c" className="w-3.5 h-3.5" />, 'Leave Records'],
          ] as [Tab, React.ReactNode, string][]).map(([t, icon, label]) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === 'balances') cancelEdit(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? 'bg-[#EFF6FF] text-[#2563EB]' : 'text-[#6B7280] hover:bg-[#F7F8FA] hover:text-[#374151]'}`}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : tab === 'balances' ? (
            <BalancesTab balance={balance} onChange={setBalance} />
          ) : (
            <RecordsTab
              records={records}
              form={form}
              dateErrors={dateErrors}
              previewDays={previewDays}
              error={error}
              submitting={submitting}
              deletingId={deletingId}
              editingRecord={editingRecord}
              isEditing={isEditing}
              onChange={(f) => { setForm(f); setError(''); }}
              onAdd={() => void handleAddRecord()}
              onUpdate={() => void handleUpdateRecord()}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onDelete={(r) => void handleDeleteRecord(r)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-[#F0F2F5] flex justify-end gap-2 items-center">
          {saveOk && <span className="text-[11px] text-emerald-600 font-medium mr-auto">Balances saved</span>}
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
            Close
          </button>
          {tab === 'balances' && (
            <button
              onClick={() => void handleSaveBalance()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
            >
              {saving && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />}
              Save Balances
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Balances Tab ──────────────────────────────────────────────────────

function BalancesTab({ balance, onChange }: { balance: LeaveBalance; onChange: (b: LeaveBalance) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-[#6B7280]">Set the opening leave balance for each type. Balances auto-adjust as leave records are added or removed.</p>
      <div className="grid grid-cols-3 gap-3">
        {(['CL', 'HPL', 'EL'] as LeaveType[]).map((type) => {
          const key = type.toLowerCase() as keyof LeaveBalance;
          const c   = LEAVE_COLORS[type];
          return (
            <div key={type} className="rounded-xl border p-3 flex flex-col gap-2" style={{ backgroundColor: c.bg, borderColor: c.border }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: c.accent }}>{type}</span>
                <span className="text-[10px] text-[#9CA3AF]">days</span>
              </div>
              <p className="text-[10px] text-[#6B7280] leading-tight">{LEAVE_LABELS[type]}</p>
              <input
                type="number" min={0} step={0.5}
                value={balance[key]}
                onChange={(e) => onChange({ ...balance, [key]: +e.target.value })}
                className="w-full text-center text-xl font-bold bg-white/70 border rounded-lg py-1.5 focus:outline-none focus:ring-2 transition-all"
                style={{ color: c.accent, borderColor: c.border }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Records Tab ───────────────────────────────────────────────────────

interface RecordsTabProps {
  records: LeaveRecord[];
  form: typeof EMPTY_LEAVE_FORM;
  dateErrors: { from: string; to: string };
  previewDays: number;
  error: string;
  submitting: boolean;
  deletingId: string | null;
  editingRecord: LeaveRecord | null;
  isEditing: boolean;
  onChange: (f: typeof EMPTY_LEAVE_FORM) => void;
  onAdd: () => void;
  onUpdate: () => void;
  onStartEdit: (rec: LeaveRecord) => void;
  onCancelEdit: () => void;
  onDelete: (rec: LeaveRecord) => void;
}

function RecordsTab({
  records, form, dateErrors, previewDays, error, submitting, deletingId,
  editingRecord, isEditing, onChange, onAdd, onUpdate, onStartEdit, onCancelEdit, onDelete,
}: RecordsTabProps) {
  return (
    <div className="space-y-4">
      {/* All records list */}
      <div>
        <h3 className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-2">
          Saved Leaves{records.length > 0 ? ` (${records.length})` : ''}
        </h3>
        {records.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] py-3 text-center border border-dashed border-[#E5E7EB] rounded-xl">
            No leave records yet
          </p>
        ) : (
          <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="px-3 py-2 text-left font-semibold text-[#6B7280]">From</th>
                  <th className="px-3 py-2 text-left font-semibold text-[#6B7280]">To</th>
                  <th className="px-3 py-2 text-center font-semibold text-[#6B7280]">Type</th>
                  <th className="px-3 py-2 text-center font-semibold text-[#6B7280]">Days</th>
                  <th className="px-3 py-2 text-center font-semibold text-[#6B7280]">½?</th>
                  <th className="px-1 py-2 w-14" />
                </tr>
              </thead>
              <tbody>
                {records.map((rec, i) => {
                  const c = LEAVE_COLORS[rec.type];
                  const beingEdited = editingRecord?.id === rec.id;
                  return (
                    <tr key={rec.id} className={`border-b border-[#F3F4F6] last:border-0 ${beingEdited ? 'bg-[#EFF6FF]' : i % 2 === 1 ? 'bg-[#FAFAFA]' : ''}`}>
                      <td className="px-3 py-2 font-mono text-[#374151]">{fmtDate(rec.fromDate)}</td>
                      <td className="px-3 py-2 font-mono text-[#374151]">{fmtDate(rec.toDate)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: c.bg, color: c.accent, border: `1px solid ${c.border}` }}>
                          {rec.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-semibold text-[#374151]">{rec.days}</td>
                      <td className="px-3 py-2 text-center text-[#9CA3AF]">{rec.dayType === 'HALF' ? '½' : '—'}</td>
                      <td className="px-1 py-2">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => beingEdited ? onCancelEdit() : onStartEdit(rec)}
                            className={`p-1 rounded transition-colors ${beingEdited ? 'text-[#2563EB] bg-[#DBEAFE]' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
                            title={beingEdited ? 'Cancel edit' : 'Edit'}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => onDelete(rec)}
                            disabled={deletingId === rec.id}
                            className="p-1 rounded text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-40 transition-colors"
                            title="Delete & restore balance"
                          >
                            {deletingId === rec.id
                              ? <span className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin inline-block" />
                              : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit form */}
      <div className={`rounded-xl border p-4 space-y-3 transition-colors ${isEditing ? 'border-[#BFDBFE] bg-[#EFF6FF]/40' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
        <h3 className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide flex items-center gap-1.5">
          {isEditing ? <Pencil className="w-3 h-3 text-[#2563EB]" /> : <Plus className="w-3 h-3" />}
          {isEditing ? 'Edit Leave Record' : 'Add Leave Record'}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <LeaveFormDateField label="From Date" value={form.fromDate} error={dateErrors.from}
            onChange={(v) => onChange({ ...form, fromDate: v })} />
          <LeaveFormDateField label="To Date" value={form.toDate} error={dateErrors.to}
            onChange={(v) => onChange({ ...form, toDate: v })} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#6B7280]">Leave Type</span>
            <select value={form.type} onChange={(e) => onChange({ ...form, type: e.target.value as LeaveType })}
              className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]">
              <option value="CL">CL — Casual</option>
              <option value="HPL">HPL — Half Pay</option>
              <option value="EL">EL — Earned</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#6B7280]">Day Type</span>
            <select value={form.dayType} onChange={(e) => onChange({ ...form, dayType: e.target.value as DayType })}
              className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]">
              <option value="FULL">Full Day</option>
              <option value="HALF">Half Day</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium text-[#6B7280]">Days</span>
            <div className={`border rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold ${previewDays > 0 ? 'text-[#2563EB] border-[#BFDBFE] bg-[#EFF6FF]' : 'text-[#9CA3AF] border-[#E5E7EB] bg-white/60'}`}>
              {previewDays > 0 ? previewDays : '—'}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-[#6B7280]">Note (optional)</span>
          <input type="text" placeholder="e.g. Medical, personal" value={form.note}
            onChange={(e) => onChange({ ...form, note: e.target.value })}
            className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]" />
        </div>

        {error && <p className="text-[11px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          {isEditing && (
            <button onClick={onCancelEdit} className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
              Cancel
            </button>
          )}
          <button
            onClick={isEditing ? onUpdate : onAdd}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
          >
            {submitting
              ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              : isEditing ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isEditing ? 'Save Changes' : 'Add Record & Deduct Balance'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared date field ─────────────────────────────────────────────────

export function LeaveFormDateField({ label, value, error, onChange }: {
  label: string; value: string; error: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-[#6B7280]">{label} <span className="text-[#9CA3AF]">(dd/mm/yyyy)</span></span>
      <input
        type="text" inputMode="numeric" placeholder="15/05/2025" maxLength={10}
        value={value} onChange={(e) => onChange(e.target.value)}
        className={`border rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 transition-colors ${error ? 'border-[#F87171]' : 'border-[#E5E7EB] focus:border-[#2563EB]'}`}
      />
      {error && <span className="text-[10px] text-[#DC2626]">{error}</span>}
    </div>
  );
}
