import { useState, useEffect } from 'react';
import { X, FileText, Printer } from 'lucide-react';
import { MONTHS } from '@/constants/enums';
import { generateSalaryCertificate } from '@/utils/salaryCertificateHtml';
import type { StaffRecord } from '@/types';

interface Props {
  open: boolean;
  staff: StaffRecord | null;
  onClose: () => void;
}

const REASON_CHIPS = ['Personal', 'Bank Loan', 'Official'];

function addMonths(month: string, year: number, offset: number): { month: string; year: number } {
  const idx = MONTHS.indexOf(month);
  const total = idx + offset;
  const y = year + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  return { month: MONTHS[m], year: y };
}

export function SalaryCertificateModal({ open, staff, onClose }: Props) {
  const now = new Date();
  const [months, setMonths] = useState(1);
  const [fromMonth, setFromMonth] = useState(MONTHS[now.getMonth()]);
  const [fromYear, setFromYear] = useState(now.getFullYear());
  const [toMonth, setToMonth] = useState(MONTHS[now.getMonth()]);
  const [toYear, setToYear] = useState(now.getFullYear());
  const [reason, setReason] = useState('Personal');
  const [position, setPosition] = useState<'top' | 'bottom'>('top');

  useEffect(() => {
    if (open) {
      const n = new Date();
      setMonths(1);
      setFromMonth(MONTHS[n.getMonth()]);
      setFromYear(n.getFullYear());
      setToMonth(MONTHS[n.getMonth()]);
      setToYear(n.getFullYear());
      setReason('Personal');
      setPosition('top');
    }
  }, [open, staff?.id]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !staff) return null;

  function handleMonthsChange(n: number) {
    const clamped = Math.min(12, Math.max(1, n || 1));
    setMonths(clamped);
    const to = addMonths(fromMonth, fromYear, clamped - 1);
    setToMonth(to.month);
    setToYear(to.year);
  }

  function handleFromChange(month: string, year: number) {
    setFromMonth(month);
    setFromYear(year);
    const to = addMonths(month, year, months - 1);
    setToMonth(to.month);
    setToYear(to.year);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', animation: 'backdrop-enter 0.2s ease-out' }}
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="relative w-full bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxWidth: 480, maxHeight: '90vh', animation: 'modal-enter 0.22s cubic-bezier(0.34,1.26,0.64,1)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#F0F2F5] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-[#111827] leading-tight">Salary Certificate</h2>
                <p className="text-[11px] text-[#6B7280] mt-0.5 truncate max-w-xs">{staff.name} · {staff.empId}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] hover:text-[#374151] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0 space-y-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-[#6B7280]">Number of Months</span>
              <input
                type="number"
                min={1}
                max={12}
                value={months}
                onChange={e => handleMonthsChange(parseInt(e.target.value, 10))}
                className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white w-24 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
            </div>

            <div>
              <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-2">Period</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-[#6B7280]">From Month</span>
                  <select
                    value={fromMonth}
                    onChange={e => handleFromChange(e.target.value, fromYear)}
                    className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-[#6B7280]">From Year</span>
                  <input
                    type="number"
                    value={fromYear}
                    onChange={e => handleFromChange(fromMonth, parseInt(e.target.value, 10) || fromYear)}
                    className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-[#6B7280]">To Month</span>
                  <select
                    value={toMonth}
                    onChange={e => setToMonth(e.target.value)}
                    className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  >
                    {MONTHS.map(m => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium text-[#6B7280]">To Year</span>
                  <input
                    type="number"
                    value={toYear}
                    onChange={e => setToYear(parseInt(e.target.value, 10) || toYear)}
                    className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-[#6B7280]">Reason</span>
              <input
                type="text"
                placeholder="e.g. Personal, Bank Loan"
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB]"
              />
              <div className="flex gap-1.5 mt-1">
                {REASON_CHIPS.map(r => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                      reason === r ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-[#6B7280]">Print Position (for reusing a half-printed sheet)</span>
              <div className="flex gap-1.5">
                {(['top', 'bottom'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setPosition(p)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium border transition-colors ${
                      position === p ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E5E7EB] text-[#6B7280] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    {p === 'top' ? 'Top Half' : 'Bottom Half'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-3 border-t border-[#F0F2F5] flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                generateSalaryCertificate(staff, {
                  fromMonth, fromYear, toMonth, toYear,
                  reason: reason.trim() || 'Official',
                  position,
                });
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
