import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ShieldCheck, Search, Filter, Plus, Pencil, Trash2, X, RefreshCw, IndianRupee, Users } from 'lucide-react';
import {
  getAllStaff,
  getLicPolicies,
  addLicPolicy,
  updateLicPolicy,
  deleteLicPolicy,
} from '@/firebase/firestore';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { DeptBadge } from '@/components/ui/Badge';
import { parseDateInput, fmtDate, isoToInput } from '@/components/staff/LeaveModal';
import { DEPARTMENTS } from '@/constants/enums';
import type { StaffRecord, LicPolicy, DeptEnum } from '@/types';

// ── Flat row type (policy + denormalized staff info) ─────────────────

interface FlatPolicy extends LicPolicy {
  staffId: string;
  staffName: string;
  empId: string;
  dept: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function yearKey(iso: string) { return iso ? iso.slice(0, 4) : ''; }

// ── Summary Card ──────────────────────────────────────────────────────

interface SummaryCardProps { label: string; value: string | number; icon: React.ReactNode; accent: string; bg: string; }

function SummaryCard({ label, value, icon, accent, bg }: SummaryCardProps) {
  return (
    <div className="rounded-xl border bg-white p-3.5 flex items-center gap-3" style={{ borderColor: '#E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg, color: accent }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-[#9CA3AF] leading-tight">{label}</p>
        <p className="text-base font-bold leading-tight truncate" style={{ color: accent }}>{value}</p>
      </div>
    </div>
  );
}

// ── Entry Modal ───────────────────────────────────────────────────────

interface EntryModalProps {
  open: boolean;
  editing: FlatPolicy | null;
  staffList: StaffRecord[];
  onClose: () => void;
  onSaved: () => void;
}

function EntryModal({ open, editing, staffList, onClose, onSaved }: EntryModalProps) {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [policyNumber, setPolicyNumber]       = useState('');
  const [premiumAmount, setPremiumAmount]     = useState('');
  const [maturityDate, setMaturityDate]       = useState('');
  const [dateError, setDateError]             = useState('');
  const [error, setError]                     = useState('');
  const [submitting, setSubmitting]           = useState(false);

  const isEdit = editing !== null;

  useEffect(() => {
    if (!open) return;
    setError(''); setDateError('');
    if (editing) {
      setSelectedStaffId(editing.staffId);
      setPolicyNumber(editing.policyNumber);
      setPremiumAmount(String(editing.premiumAmount));
      setMaturityDate(isoToInput(editing.maturityDate));
    } else {
      setSelectedStaffId('');
      setPolicyNumber('');
      setPremiumAmount('');
      setMaturityDate('');
    }
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setDateError('');

    const pn = policyNumber.trim();
    if (!pn) { setError('Policy number is required.'); return; }

    const premium = parseFloat(premiumAmount);
    if (!premiumAmount || isNaN(premium) || premium <= 0) { setError('Enter a valid premium amount.'); return; }

    const matIso = parseDateInput(maturityDate);
    if (!matIso) { setDateError(maturityDate ? 'Invalid — use dd/mm/yyyy' : 'Required'); return; }

    if (!isEdit && !selectedStaffId) { setError('Select a staff member.'); return; }

    setSubmitting(true);
    try {
      const staffId = isEdit ? editing!.staffId : selectedStaffId;
      const data = { policyNumber: pn, premiumAmount: premium, maturityDate: matIso };
      if (isEdit) {
        await updateLicPolicy(staffId, editing!.id!, data);
      } else {
        await addLicPolicy(staffId, data);
      }
      onSaved();
      onClose();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-sm font-bold text-[#111827] mb-4">
          {isEdit ? 'Edit LIC Policy' : 'Add LIC Policy'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Staff selector */}
          {!isEdit ? (
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
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">Staff Member</label>
              <p className="text-xs text-[#374151] bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2">
                {editing!.staffName}
                <span className="text-[#9CA3AF] ml-1.5">({editing!.empId})</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-[#374151] mb-1">Policy Number</label>
            <input
              type="text"
              value={policyNumber}
              onChange={e => { setPolicyNumber(e.target.value); setError(''); }}
              placeholder="e.g. 123456789"
              className="w-full text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">Premium (₹)</label>
              <input
                type="number"
                min={1}
                value={premiumAmount}
                onChange={e => { setPremiumAmount(e.target.value); setError(''); }}
                placeholder="e.g. 5000"
                className="w-full text-xs border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#374151] mb-1">
                Maturity Date <span className="text-[#9CA3AF] font-normal">(dd/mm/yyyy)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="31/12/2035"
                maxLength={10}
                value={maturityDate}
                onChange={e => { setMaturityDate(e.target.value); setDateError(''); }}
                className={`w-full text-xs border rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 transition-colors ${dateError ? 'border-[#F87171]' : 'border-[#E5E7EB] focus:border-[#2563EB]'}`}
              />
              {dateError && <p className="text-[10px] text-[#DC2626] mt-0.5">{dateError}</p>}
            </div>
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
              {submitting ? <><Spinner size="sm" /> Saving…</> : isEdit ? 'Save Changes' : 'Add Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────

interface DeleteConfirmProps {
  policy: FlatPolicy | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteConfirm({ policy, onClose, onDeleted }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!policy?.id) return;
    setDeleting(true); setError('');
    try {
      await deleteLicPolicy(policy.staffId, policy.id);
      onDeleted();
      onClose();
    } catch {
      setError('Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  if (!policy) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-[#111827] mb-1">Delete LIC Policy?</h2>
        <p className="text-xs text-[#6B7280] mb-4">
          Policy <span className="font-semibold">{policy.policyNumber}</span> for{' '}
          <span className="font-semibold">{policy.staffName}</span> will be permanently removed.
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

// ── Page ──────────────────────────────────────────────────────────────

export default function LicPolicies() {
  const [staffList, setStaffList]     = useState<StaffRecord[]>([]);
  const [policies, setPolicies]       = useState<FlatPolicy[]>([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState('');
  const [deptFilter, setDeptFilter]   = useState('');
  const [yearFilter, setYearFilter]   = useState('');
  const [entryOpen, setEntryOpen]     = useState(false);
  const [editPolicy, setEditPolicy]   = useState<FlatPolicy | null>(null);
  const [deletePolicy, setDeletePolicy] = useState<FlatPolicy | null>(null);
  const [ctxMenu, setCtxMenu]         = useState<{ x: number; y: number; policy: FlatPolicy } | null>(null);
  const ctxRef = useRef<HTMLDivElement>(null);

  const loadPolicies = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const staff = await getAllStaff();
      setStaffList(staff);
      const arrays = await Promise.all(
        staff.map(s =>
          s.id
            ? getLicPolicies(s.id).then(ps =>
                ps.map(p => ({
                  ...p,
                  staffId:   s.id!,
                  staffName: s.name,
                  empId:     s.empId,
                  dept:      s.dept,
                } as FlatPolicy))
              )
            : Promise.resolve([] as FlatPolicy[])
        )
      );
      const all = arrays.flat().sort((a, b) => a.staffName.localeCompare(b.staffName));
      setPolicies(all);
    } catch {
      setPolicies([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadPolicies(); }, [loadPolicies]);

  // Close context menu on outside click / Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', onKey); };
  }, [ctxMenu]);

  const maturityYears = useMemo(() => {
    const set = new Set(policies.map(p => yearKey(p.maturityDate)).filter(Boolean));
    return Array.from(set).sort();
  }, [policies]);

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase();
    return policies.filter(p => {
      if (q && !p.staffName.toUpperCase().includes(q) && !p.empId.toUpperCase().includes(q) && !p.policyNumber.toUpperCase().includes(q)) return false;
      if (deptFilter && p.dept !== deptFilter) return false;
      if (yearFilter && yearKey(p.maturityDate) !== yearFilter) return false;
      return true;
    });
  }, [policies, search, deptFilter, yearFilter]);

  const summary = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    const staffSet = new Set(filtered.map(p => p.staffId));
    const totalPremium = filtered.reduce((s, p) => s + p.premiumAmount, 0);
    const maturingThisYear = filtered.filter(p => yearKey(p.maturityDate) === thisYear).length;
    return {
      total: filtered.length,
      staffCount: staffSet.size,
      totalPremium,
      maturingThisYear,
    };
  }, [filtered]);

  const hasFilters = !!(search || deptFilter || yearFilter);

  function openAdd()               { setEditPolicy(null); setEntryOpen(true); }
  function openEdit(p: FlatPolicy) { setEditPolicy(p); setEntryOpen(true); }
  function closeEntry()            { setEntryOpen(false); setEditPolicy(null); }

  if (loading) return <PageSpinner />;

  return (
    <>
      <div className="h-full flex flex-col gap-4" style={{ animation: 'page-enter 0.35s ease-out' }}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-[#111827] leading-tight">LIC Policies</h1>
            <p className="text-xs text-[#6B7280] mt-0.5">{policies.length} total policies across all staff</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadPolicies(true)}
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
              Add Policy
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Total Policies"
            value={summary.total}
            icon={<ShieldCheck className="w-4 h-4" />}
            accent="#2563EB" bg="#EFF6FF"
          />
          <SummaryCard
            label="Staff with Policies"
            value={summary.staffCount}
            icon={<Users className="w-4 h-4" />}
            accent="#7C3AED" bg="#F5F3FF"
          />
          <SummaryCard
            label="Total Premium (₹)"
            value={'₹' + summary.totalPremium.toLocaleString('en-IN')}
            icon={<IndianRupee className="w-4 h-4" />}
            accent="#16A34A" bg="#F0FDF4"
          />
          <SummaryCard
            label="Maturing This Year"
            value={summary.maturingThisYear}
            icon={<ShieldCheck className="w-4 h-4" />}
            accent="#EA580C" bg="#FFF7ED"
          />
        </div>

        {/* Filters */}
        <div className="flex-shrink-0 flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search name, Emp ID, or policy no…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] w-56"
            />
          </div>

          <div className="flex items-center gap-1 text-[#9CA3AF]"><Filter className="w-3.5 h-3.5" /></div>

          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          >
            <option value="">All Depts</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          >
            <option value="">All Maturity Years</option>
            {maturityYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setDeptFilter(''); setYearFilter(''); }}
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
              <ShieldCheck className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">No LIC policies found</p>
              {hasFilters && <p className="text-xs mt-1">Try adjusting your filters</p>}
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280]">Staff</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280]">Emp ID</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280]">Dept</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[#6B7280]">Policy No.</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[#6B7280]">Premium (₹)</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-[#6B7280]">Maturity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const thisYear = new Date().getFullYear().toString();
                  const maturing = yearKey(p.maturityDate) === thisYear;
                  return (
                    <tr
                      key={`${p.staffId}-${p.id}`}
                      onContextMenu={e => {
                        e.preventDefault();
                        const menuW = 160, menuH = 90;
                        setCtxMenu({
                          x: Math.min(e.clientX, window.innerWidth  - menuW - 8),
                          y: Math.min(e.clientY, window.innerHeight - menuH - 8),
                          policy: p,
                        });
                      }}
                      className={`border-b border-[#F3F4F6] last:border-0 hover:bg-[#F7F8FA] transition-colors cursor-context-menu select-none ${i % 2 === 1 ? 'bg-[#FAFAFA]' : ''}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-[#111827]">{p.staffName}</td>
                      <td className="px-4 py-2.5 font-mono text-[#6B7280]">{p.empId}</td>
                      <td className="px-4 py-2.5">
                        {p.dept ? <DeptBadge dept={p.dept as DeptEnum} /> : <span className="text-[#9CA3AF]">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[#374151]">{p.policyNumber}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#374151]">
                        {p.premiumAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono">
                        <span className={maturing ? 'text-[#EA580C] font-semibold' : 'text-[#374151]'}>
                          {fmtDate(p.maturityDate)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Entry Modal */}
      <EntryModal
        open={entryOpen}
        editing={editPolicy}
        staffList={staffList}
        onClose={closeEntry}
        onSaved={() => void loadPolicies(true)}
      />

      {/* Delete Confirm */}
      <DeleteConfirm
        policy={deletePolicy}
        onClose={() => setDeletePolicy(null)}
        onDeleted={() => void loadPolicies(true)}
      />

      {/* Context menu */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          className="fixed z-50 bg-white rounded-xl shadow-lg border border-[#E5E7EB] py-1 min-w-[150px]"
          style={{ top: ctxMenu.y, left: ctxMenu.x }}
        >
          <button
            type="button"
            onClick={() => { openEdit(ctxMenu.policy); setCtxMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[#374151] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Policy
          </button>
          <div className="my-1 border-t border-[#F3F4F6]" />
          <button
            type="button"
            onClick={() => { setDeletePolicy(ctxMenu.policy); setCtxMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Policy
          </button>
        </div>
      )}
    </>
  );
}
