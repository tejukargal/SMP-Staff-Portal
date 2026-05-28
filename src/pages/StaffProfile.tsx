import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Pencil } from 'lucide-react';
import { DeptBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import {
  getStaffById,
  getLeaveBalance,
  getLeaveRecords,
  getLicPolicies,
} from '@/firebase/firestore';
import { formatDate, computeServiceYears, computeDOR } from '@/utils/dateUtils';
import { formatINR } from '@/utils/salaryUtils';
import { maskAadhaar, maskPAN, maskBankAccount } from '@/utils/maskUtils';
import { LEAVE_COLORS, fmtDate } from '@/components/staff/LeaveModal';
import type { StaffRecord, LeaveBalance, LeaveRecord, LicPolicy } from '@/types';

type Tab = 'personal' | 'service' | 'financial' | 'leave' | 'lic';

const TABS: { key: Tab; label: string }[] = [
  { key: 'personal',  label: 'Personal'  },
  { key: 'service',   label: 'Service'   },
  { key: 'financial', label: 'Financial' },
  { key: 'leave',     label: 'Leave'     },
  { key: 'lic',       label: 'LIC'       },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-[#F3F4F6] text-sm last:border-0">
      <span className="text-[#6B7280] shrink-0 mr-4">{label}</span>
      <span className="font-medium text-[#111827] text-right">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-1.5 border-b border-[#F9FAFB] last:border-0">
      <span className="text-[11px] text-[#9CA3AF] shrink-0">{label}</span>
      <span className="text-[11px] font-medium text-[#111827] text-right">{value}</span>
    </div>
  );
}

export default function StaffProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();
  const fromDashboard = (state as { from?: string } | null)?.from === 'dashboard';
  const { isAdmin } = useRole();
  const { showToast } = useToast();

  const [staff, setStaff]       = useState<StaffRecord | null>(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [revealed, setRevealed] = useState(false);

  // Lazy-loaded tab data
  const [leaveBalance, setLeaveBalance]   = useState<LeaveBalance | null>(null);
  const [leaveRecords, setLeaveRecords]   = useState<LeaveRecord[] | null>(null);
  const [leaveLoading, setLeaveLoading]   = useState(false);
  const [licPolicies, setLicPolicies]     = useState<LicPolicy[] | null>(null);
  const [licLoading, setLicLoading]       = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getStaffById(id)
      .then(data => {
        if (data) setStaff(data);
        else showToast('error', 'Staff record not found');
      })
      .catch(() => showToast('error', 'Failed to load staff record'))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  useEffect(() => {
    if (!staff?.id) return;
    if (activeTab === 'leave' && leaveBalance === null && !leaveLoading) {
      setLeaveLoading(true);
      Promise.all([getLeaveBalance(staff.id), getLeaveRecords(staff.id)])
        .then(([bal, recs]) => { setLeaveBalance(bal); setLeaveRecords(recs); })
        .catch(() => showToast('error', 'Failed to load leave data'))
        .finally(() => setLeaveLoading(false));
    }
    if (activeTab === 'lic' && licPolicies === null && !licLoading) {
      setLicLoading(true);
      getLicPolicies(staff.id)
        .then(setLicPolicies)
        .catch(() => showToast('error', 'Failed to load LIC policies'))
        .finally(() => setLicLoading(false));
    }
  }, [activeTab, staff?.id, leaveBalance, leaveLoading, licPolicies, licLoading, showToast]);

  if (loading) return <PageSpinner />;
  if (!staff) return (
    <div className="text-center py-16 text-[#6B7280]">
      Staff record not found.{' '}
      <button onClick={() => navigate('/staff')} className="text-sky-600 underline">Go back</button>
    </div>
  );

  const basicPay  = staff.basicPay ?? 0;
  const dor       = computeDOR(staff.dob) || staff.dor;

  return (
    <div className="h-full flex flex-col gap-4">

      {/* Back button */}
      <Button
        variant="secondary"
        size="sm"
        className="self-start no-print flex-shrink-0"
        onClick={() => navigate(fromDashboard ? '/dashboard' : '/staff')}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {fromDashboard ? 'Back to Dashboard' : 'Back to Staff List'}
      </Button>

      {/* ── Two-panel layout ─────────────────────────────────────────── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── Left: narrow profile strip ────────────────────────────── */}
        <div className="w-52 shrink-0 bg-white rounded-xl border border-[#E2E5EA] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 flex flex-col">

            {/* Avatar + name */}
            <div className="flex flex-col items-center gap-2 mb-3">
              <div className="w-14 h-14 rounded-full bg-[#1B3A6B] flex items-center justify-center shrink-0">
                <span className="text-white text-xl font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  {getInitials(staff.name)}
                </span>
              </div>
              <div className="text-center">
                <h2 className="text-sm font-bold text-[#111827] leading-tight" style={{ fontFamily: "'DM Serif Display', serif" }}>
                  {staff.name}
                </h2>
                <p className="text-[11px] text-[#6B7280] mt-0.5">{staff.designation}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center">
                <DeptBadge dept={staff.dept} />
                <StatusBadge status={staff.status} />
              </div>
            </div>

            {/* Detail rows */}
            <div className="border-t border-[#F3F4F6] pt-3 flex flex-col">
              <DetailRow label="Emp ID"  value={<span className="font-mono">{staff.empId}</span>} />
              <DetailRow label="Type"    value={staff.type} />
              <DetailRow label="DOE"     value={formatDate(staff.doe)} />
              <DetailRow label="DOR"     value={formatDate(dor)} />
              <DetailRow label="Service" value={`${computeServiceYears(staff.doe)} yrs`} />
              {staff.phone && <DetailRow label="Phone" value={staff.phone} />}
            </div>

            {/* Edit button (admin only) */}
            {isAdmin && (
              <div className="mt-4 no-print">
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => navigate(`/staff/${staff.id}/edit`)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Record
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: wider tabs panel ────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-xl border border-[#E2E5EA] flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-[#E2E5EA] shrink-0 no-print">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
                  activeTab === tab.key
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-400 hover:text-gray-700',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content — scrolls independently */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* ── Personal ── */}
            {activeTab === 'personal' && (
              <div>
                <Row label="Full Name"          value={staff.name} />
                <Row label="Date of Birth"      value={formatDate(staff.dob)} />
                <Row label="Phone"              value={staff.phone || '—'} />
                <Row label="Email"              value={staff.email || '—'} />
                {staff.caste             && <Row label="Caste"               value={staff.caste} />}
                {staff.category          && <Row label="Category"            value={staff.category} />}
                {staff.dateOfCompletion  && <Row label="Date of Completion"  value={formatDate(staff.dateOfCompletion)} />}
                {staff.classObtained     && <Row label="Class Obtained"      value={staff.classObtained} />}
                {staff.university        && <Row label="University"          value={staff.university} />}
              </div>
            )}

            {/* ── Service ── */}
            {activeTab === 'service' && (
              <div>
                <Row label="Employee ID"              value={<span className="font-mono">{staff.empId}</span>} />
                <Row label="Designation"              value={staff.designation} />
                <Row label="Department"               value={staff.dept} />
                <Row label="Type"                     value={staff.type} />
                <Row label="Date of Entry into Service" value={formatDate(staff.doe)} />
                <Row label="Date of Retirement"       value={formatDate(dor)} />
                <Row label="Years of Service"         value={`${computeServiceYears(staff.doe)} years`} />
                {staff.approvalOrderNumber && <Row label="Approval Order No."  value={staff.approvalOrderNumber} />}
                {staff.dateOfApproval      && <Row label="Date of Approval"    value={formatDate(staff.dateOfApproval)} />}
                {staff.arrearsTakenFrom    && <Row label="Arrears Taken From"  value={staff.arrearsTakenFrom} />}
                <Row label="Pay Scale"   value={staff.payScale || '—'} />
                <Row label="Basic Pay"   value={basicPay ? formatINR(basicPay) : '—'} />
                {staff.remarks && <Row label="Remarks" value={staff.remarks} />}
              </div>
            )}

            {/* ── Financial ── */}
            {activeTab === 'financial' && (
              <div>
                <div className="flex justify-end mb-3 no-print">
                  {isAdmin && (
                    <button
                      onClick={() => setRevealed(r => !r)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-sky-600 transition-colors"
                    >
                      {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {revealed ? 'Mask fields' : 'Reveal fields'}
                    </button>
                  )}
                </div>
                <Row label="Bank Account No." value={<span className="font-mono">{maskBankAccount(staff.bankAccountNo, revealed)}</span>} />
                <Row label="PAN"              value={<span className="font-mono">{maskPAN(staff.pan, revealed)}</span>} />
                <Row label="Aadhaar"          value={<span className="font-mono">{maskAadhaar(staff.aadhar, revealed)}</span>} />
              </div>
            )}

            {/* ── Leave ── */}
            {activeTab === 'leave' && (
              leaveLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : (
                <div className="space-y-4">
                  {/* Balance cards */}
                  {leaveBalance && (
                    <div>
                      <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-2">Leave Balance</p>
                      <div className="grid grid-cols-3 gap-3">
                        {(['CL', 'HPL', 'EL'] as const).map(type => {
                          const c   = LEAVE_COLORS[type];
                          const key = type.toLowerCase() as 'cl' | 'hpl' | 'el';
                          return (
                            <div key={type} className="rounded-xl border p-3 flex flex-col gap-1" style={{ backgroundColor: c.bg, borderColor: c.border }}>
                              <span className="text-[11px] font-bold"   style={{ color: c.accent }}>{type}</span>
                              <span className="text-xl font-bold"       style={{ color: c.accent }}>{leaveBalance[key]}</span>
                              <span className="text-[10px] text-[#6B7280]">days remaining</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Leave records */}
                  <div>
                    <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-2">
                      Leave Records{leaveRecords && leaveRecords.length > 0 ? ` (${leaveRecords.length})` : ''}
                    </p>
                    {!leaveRecords || leaveRecords.length === 0 ? (
                      <p className="text-xs text-[#9CA3AF] text-center py-6 border border-dashed border-[#E5E7EB] rounded-xl">
                        No leave records found
                      </p>
                    ) : (
                      <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                              <th className="px-3 py-2 text-left  font-semibold text-[#6B7280]">From</th>
                              <th className="px-3 py-2 text-left  font-semibold text-[#6B7280]">To</th>
                              <th className="px-3 py-2 text-center font-semibold text-[#6B7280]">Type</th>
                              <th className="px-3 py-2 text-center font-semibold text-[#6B7280]">Days</th>
                              <th className="px-3 py-2 text-left  font-semibold text-[#6B7280]">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {leaveRecords.map((rec, i) => {
                              const c = LEAVE_COLORS[rec.type];
                              return (
                                <tr key={rec.id} className={`border-b border-[#F3F4F6] last:border-0 ${i % 2 === 1 ? 'bg-[#FAFAFA]' : ''}`}>
                                  <td className="px-3 py-2 font-mono text-[#374151]">{fmtDate(rec.fromDate)}</td>
                                  <td className="px-3 py-2 font-mono text-[#374151]">{fmtDate(rec.toDate)}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: c.bg, color: c.accent, border: `1px solid ${c.border}` }}>
                                      {rec.type}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono font-semibold text-[#374151]">
                                    {rec.days}{rec.dayType === 'HALF' ? ' ½' : ''}
                                  </td>
                                  <td className="px-3 py-2 text-[#6B7280] max-w-[140px] truncate">{rec.note ?? '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {/* ── LIC ── */}
            {activeTab === 'lic' && (
              licLoading ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : (
                <div>
                  <p className="text-[11px] font-semibold text-[#374151] uppercase tracking-wide mb-2">
                    LIC Policies{licPolicies && licPolicies.length > 0 ? ` (${licPolicies.length})` : ''}
                  </p>
                  {!licPolicies || licPolicies.length === 0 ? (
                    <p className="text-xs text-[#9CA3AF] text-center py-6 border border-dashed border-[#E5E7EB] rounded-xl">
                      No LIC policies found
                    </p>
                  ) : (
                    <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                            <th className="px-3 py-2 text-left  font-semibold text-[#6B7280]">Policy No.</th>
                            <th className="px-3 py-2 text-right font-semibold text-[#6B7280]">Premium (₹)</th>
                            <th className="px-3 py-2 text-center font-semibold text-[#6B7280]">Maturity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {licPolicies.map((p, i) => (
                            <tr key={p.id} className={`border-b border-[#F3F4F6] last:border-0 ${i % 2 === 1 ? 'bg-[#FAFAFA]' : ''}`}>
                              <td className="px-3 py-2 font-mono font-medium text-[#111827]">{p.policyNumber}</td>
                              <td className="px-3 py-2 text-right font-mono text-[#374151]">
                                {p.premiumAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-2 text-center font-mono text-[#374151]">
                                {fmtDate(p.maturityDate)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Print-only full details */}
      <div className="print-only mt-4">
        <div className="border-b-2 border-black pb-4 mb-4 text-center">
          <h1 className="text-xl font-bold uppercase">Sanjay Memorial Polytechnic</h1>
          <p className="text-sm">Staff Profile</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Name:</strong> {staff.name}</div>
          <div><strong>Emp ID:</strong> {staff.empId}</div>
          <div><strong>Designation:</strong> {staff.designation}</div>
          <div><strong>Dept:</strong> {staff.dept}</div>
          <div><strong>Status:</strong> {staff.status}</div>
          <div><strong>Type:</strong> {staff.type}</div>
          <div><strong>DOB:</strong> {formatDate(staff.dob)}</div>
          <div><strong>DOE:</strong> {formatDate(staff.doe)}</div>
          <div><strong>DOR:</strong> {formatDate(dor)}</div>
          <div><strong>Service:</strong> {computeServiceYears(staff.doe)} years</div>
          <div><strong>Phone:</strong> {staff.phone}</div>
          <div><strong>Email:</strong> {staff.email}</div>
          <div><strong>Pay Scale:</strong> {staff.payScale}</div>
          <div><strong>Basic Pay:</strong> {basicPay ? formatINR(basicPay) : '—'}</div>
          {staff.caste            && <div><strong>Caste:</strong>              {staff.caste}</div>}
          {staff.category         && <div><strong>Category:</strong>           {staff.category}</div>}
          {staff.university       && <div><strong>University:</strong>         {staff.university}</div>}
          {staff.classObtained    && <div><strong>Class Obtained:</strong>     {staff.classObtained}</div>}
          {staff.dateOfCompletion && <div><strong>Date of Completion:</strong> {formatDate(staff.dateOfCompletion)}</div>}
          {staff.approvalOrderNumber && <div><strong>Approval Order No.:</strong> {staff.approvalOrderNumber}</div>}
          {staff.dateOfApproval   && <div><strong>Date of Approval:</strong>   {formatDate(staff.dateOfApproval)}</div>}
          {staff.arrearsTakenFrom && <div><strong>Arrears Taken From:</strong> {staff.arrearsTakenFrom}</div>}
        </div>
      </div>
    </div>
  );
}
