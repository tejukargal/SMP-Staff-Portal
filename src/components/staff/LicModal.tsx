import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { getLicPolicies, addLicPolicy, updateLicPolicy, deleteLicPolicy } from '@/firebase/firestore';
import { parseDateInput, fmtDate, isoToInput } from '@/components/staff/LeaveModal';
import type { StaffRecord, LicPolicy } from '@/types';

const EMPTY_FORM = { policyNumber: '', premiumAmount: '', maturityDate: '' };

interface Props {
  open: boolean;
  staff: StaffRecord | null;
  onClose: () => void;
}

export function LicModal({ open, staff, onClose }: Props) {
  const [policies, setPolicies]     = useState<LicPolicy[]>([]);
  const [loading, setLoading]       = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [dateError, setDateError]   = useState('');
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError]           = useState('');

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setPolicies(await getLicPolicies(id));
    } catch {
      setError('Failed to load policies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && staff?.id) {
      setForm(EMPTY_FORM);
      setEditingId(null);
      setError('');
      setDateError('');
      void load(staff.id);
    }
  }, [open, staff?.id, load]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !staff) return null;

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError('');
    setDateError('');
  }

  function startEdit(p: LicPolicy) {
    setEditingId(p.id!);
    setForm({
      policyNumber: p.policyNumber,
      premiumAmount: String(p.premiumAmount),
      maturityDate: isoToInput(p.maturityDate),
    });
    setError('');
    setDateError('');
  }

  function validate(): { policyNumber: string; premiumAmount: number; maturityDate: string } | null {
    const policyNumber = form.policyNumber.trim();
    if (!policyNumber) { setError('Policy number is required.'); return null; }

    const premium = parseFloat(form.premiumAmount);
    if (!form.premiumAmount || isNaN(premium) || premium <= 0) {
      setError('Enter a valid premium amount.');
      return null;
    }

    const maturityIso = parseDateInput(form.maturityDate);
    if (!maturityIso) {
      setDateError(form.maturityDate ? 'Invalid — use dd/mm/yyyy' : 'Required');
      return null;
    }

    return { policyNumber, premiumAmount: premium, maturityDate: maturityIso };
  }

  async function handleAdd() {
    const id = staff?.id;
    if (!id) return;
    setError(''); setDateError('');
    const data = validate();
    if (!data) return;
    setSubmitting(true);
    try {
      await addLicPolicy(id, data);
      await load(id);
      resetForm();
    } catch {
      setError('Failed to save policy.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate() {
    const id = staff?.id;
    if (!id || !editingId) return;
    setError(''); setDateError('');
    const data = validate();
    if (!data) return;
    setSubmitting(true);
    try {
      await updateLicPolicy(id, editingId, data);
      await load(id);
      resetForm();
    } catch {
      setError('Failed to update policy.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(p: LicPolicy) {
    const id = staff?.id;
    if (!id || !p.id) return;
    if (editingId === p.id) resetForm();
    setDeletingId(p.id);
    try {
      await deleteLicPolicy(id, p.id);
      setPolicies(ps => ps.filter(x => x.id !== p.id));
    } catch {
      setError('Failed to delete policy.');
    } finally {
      setDeletingId(null);
    }
  }

  const isEditing = editingId !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxWidth: 480, maxHeight: '88vh' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#F0F2F5] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
              <ShieldCheck className="w-3.5 h-3.5 text-[#2563EB]" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[#111827] leading-tight">LIC Policies</h2>
              <p className="text-[11px] text-[#6B7280] mt-0.5 truncate max-w-xs">{staff.name} · {staff.empId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 space-y-4">

          {/* Policy list */}
          <div>
            <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-2">
              Saved Policies{policies.length > 0 ? ` (${policies.length})` : ''}
            </p>
            {loading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : policies.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] py-4 text-center border border-dashed border-[#E5E7EB] rounded-xl">
                No policies added yet
              </p>
            ) : (
              <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
                {/* Sticky header */}
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="px-3 py-2 text-left font-semibold text-[#6B7280]">Policy No.</th>
                      <th className="px-3 py-2 text-right font-semibold text-[#6B7280]">Premium (₹)</th>
                      <th className="px-3 py-2 text-center font-semibold text-[#6B7280]">Maturity</th>
                      <th className="px-1 py-2 w-14" />
                    </tr>
                  </thead>
                </table>
                {/* Scrollable body — shows 2 rows, rest scrolls */}
                <div className="overflow-y-auto" style={{ maxHeight: 66 }}>
                  <table className="w-full text-xs">
                    <tbody>
                      {policies.map((p, i) => {
                        const beingEdited = editingId === p.id;
                        return (
                          <tr
                            key={p.id}
                            className={`border-b border-[#F3F4F6] last:border-0 ${beingEdited ? 'bg-[#EFF6FF]' : i % 2 === 1 ? 'bg-[#FAFAFA]' : ''}`}
                          >
                            <td className="px-3 py-2 font-mono font-medium text-[#111827]">{p.policyNumber}</td>
                            <td className="px-3 py-2 text-right font-mono text-[#374151]">
                              {p.premiumAmount.toLocaleString('en-IN')}
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-[#374151]">
                              {fmtDate(p.maturityDate)}
                            </td>
                            <td className="px-1 py-2">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  onClick={() => beingEdited ? resetForm() : startEdit(p)}
                                  className={`p-1 rounded transition-colors ${beingEdited ? 'text-[#2563EB] bg-[#DBEAFE]' : 'text-[#6B7280] hover:bg-[#F3F4F6]'}`}
                                  title={beingEdited ? 'Cancel edit' : 'Edit'}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => void handleDelete(p)}
                                  disabled={deletingId === p.id}
                                  className="p-1 rounded text-[#DC2626] hover:bg-[#FEF2F2] disabled:opacity-40 transition-colors"
                                  title="Delete policy"
                                >
                                  {deletingId === p.id
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
              </div>
            )}
          </div>

          {/* Add / Edit form */}
          <div className={`rounded-xl border p-4 space-y-3 transition-colors ${isEditing ? 'border-[#BFDBFE] bg-[#EFF6FF]/40' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}>
            <h3 className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide flex items-center gap-1.5">
              {isEditing ? <Pencil className="w-3 h-3 text-[#2563EB]" /> : <Plus className="w-3 h-3" />}
              {isEditing ? 'Edit Policy' : 'Add Policy'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#6B7280]">Policy Number</span>
                <input
                  type="text"
                  placeholder="e.g. 123456789"
                  value={form.policyNumber}
                  onChange={e => { setForm(f => ({ ...f, policyNumber: e.target.value })); setError(''); }}
                  className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-medium text-[#6B7280]">Premium Amount (₹)</span>
                <input
                  type="number"
                  min={1}
                  placeholder="e.g. 5000"
                  value={form.premiumAmount}
                  onChange={e => { setForm(f => ({ ...f, premiumAmount: e.target.value })); setError(''); }}
                  className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-[#6B7280]">
                Maturity Date <span className="text-[#9CA3AF]">(dd/mm/yyyy)</span>
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="31/12/2035"
                maxLength={10}
                value={form.maturityDate}
                onChange={e => { setForm(f => ({ ...f, maturityDate: e.target.value })); setDateError(''); }}
                className={`border rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 transition-colors ${dateError ? 'border-[#F87171]' : 'border-[#E5E7EB] focus:border-[#2563EB]'}`}
              />
              {dateError && <span className="text-[10px] text-[#DC2626]">{dateError}</span>}
            </div>

            {error && (
              <p className="text-[11px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 pt-0.5">
              {isEditing && (
                <button
                  onClick={resetForm}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => void (isEditing ? handleUpdate() : handleAdd())}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
                  : isEditing ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {isEditing ? 'Save Changes' : 'Add Policy'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-[#F0F2F5] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
