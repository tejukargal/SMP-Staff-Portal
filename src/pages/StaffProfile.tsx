import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { DeptBadge, StatusBadge } from '@/components/ui/Badge';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import {
  getStaffById,
  getLeaveBalance,
  getLeaveRecords,
  getLicPolicies,
  getSalarySlipsByStaff,
} from '@/firebase/firestore';
import { formatDate, computeServiceYears, computeDOR, getAge } from '@/utils/dateUtils';
import { formatINR } from '@/utils/salaryUtils';
import { LEAVE_COLORS, fmtDate } from '@/components/staff/LeaveModal';
import { MONTHS } from '@/constants/enums';
import type { StaffRecord, LeaveBalance, LeaveRecord, LicPolicy, StatusEnum, SalarySlip } from '@/types';

// ── Types & constants ─────────────────────────────────────────────────────────

type Tab = 'personal' | 'service' | 'financial' | 'leave' | 'lic' | 'salary';

const TABS: { key: Tab; label: string; active: string }[] = [
  { key: 'personal',  label: 'Personal',  active: 'border-blue-500   text-blue-600'   },
  { key: 'service',   label: 'Service',   active: 'border-sky-500    text-sky-600'    },
  { key: 'financial', label: 'Financial', active: 'border-violet-500 text-violet-600' },
  { key: 'leave',     label: 'Leave',     active: 'border-amber-500  text-amber-600'  },
  { key: 'lic',       label: 'LIC',       active: 'border-rose-500   text-rose-600'   },
  { key: 'salary',    label: 'Salary',    active: 'border-emerald-500 text-emerald-600' },
];

const MONTH_IDX = Object.fromEntries(MONTHS.map((m, i) => [m, i]));
function fmtN(n: number) { return n ? n.toLocaleString('en-IN') : '—'; }

const STATUS_GRADIENT: Record<StatusEnum, string> = {
  'IN SERVICE':  'from-emerald-700 to-teal-900',
  'RTRD':        'from-slate-500   to-slate-800',
  'RESIGNED':    'from-amber-600   to-orange-800',
  'TRANSFERRED': 'from-blue-600    to-indigo-800',
  'DECEASED':    'from-gray-600    to-gray-900',
};

const STATUS_CHIP: Record<StatusEnum, string> = {
  'IN SERVICE':  'bg-emerald-400/30 border-emerald-300/40',
  'RTRD':        'bg-slate-300/30   border-slate-300/40',
  'RESIGNED':    'bg-amber-400/30   border-amber-300/40',
  'TRANSFERRED': 'bg-blue-400/30    border-blue-300/40',
  'DECEASED':    'bg-gray-400/30    border-gray-300/40',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Design system (matches StudentDetailModal) ────────────────────────────────

function ProfileSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-100 overflow-hidden">
      <div className={`px-4 py-2 ${accent} flex items-center gap-2`}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-current opacity-70">
          {title}
        </span>
      </div>
      <div className="px-4 py-4 bg-white">{children}</div>
    </section>
  );
}

function PField({
  label,
  value,
  wide,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
  mono?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === '';
  return (
    <div className={wide ? 'col-span-2 sm:col-span-4' : ''}>
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 leading-tight mb-0.5">
        {label}
      </dt>
      <dd className={`text-xs leading-snug ${isEmpty ? 'text-gray-300' : `text-gray-800 font-medium ${mono ? 'font-mono' : ''}`}`}>
        {isEmpty ? '—' : value}
      </dd>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StaffProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();
  const fromDashboard = (state as { from?: string } | null)?.from === 'dashboard';
  const { isAdmin } = useRole();
  const { showToast } = useToast();

  const [staff, setStaff]         = useState<StaffRecord | null>(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('personal');

  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[] | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [licPolicies, setLicPolicies]   = useState<LicPolicy[] | null>(null);
  const [licLoading, setLicLoading]     = useState(false);
  const [salarySlips, setSalarySlips]   = useState<SalarySlip[] | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

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
    if ((activeTab === 'salary' || activeTab === 'financial') && salarySlips === null && !salaryLoading) {
      setSalaryLoading(true);
      getSalarySlipsByStaff(staff.id, staff.empId ?? '')
        .then(slips => {
          const sorted = [...slips].sort((a, b) =>
            b.year !== a.year ? b.year - a.year : (MONTH_IDX[b.month] ?? 0) - (MONTH_IDX[a.month] ?? 0)
          );
          setSalarySlips(sorted);
        })
        .catch(() => showToast('error', 'Failed to load salary records'))
        .finally(() => setSalaryLoading(false));
    }
  }, [activeTab, staff?.id, leaveBalance, leaveLoading, licPolicies, licLoading, salarySlips, salaryLoading, showToast]);

  if (loading) return <PageSpinner />;
  if (!staff) return (
    <div className="text-center py-16 text-gray-400">
      Staff record not found.{' '}
      <button onClick={() => navigate('/staff')} className="text-sky-600 underline">Go back</button>
    </div>
  );

  const dor      = computeDOR(staff.dob) || staff.dor;
  const svcYears = computeServiceYears(staff.doe);
  const gradient = STATUS_GRADIENT[staff.status] ?? 'from-slate-700 to-slate-900';
  const chipCls  = STATUS_CHIP[staff.status]     ?? 'bg-white/20 border-white/30';

  return (
    <div className="h-full flex flex-col">

      {/* ── Main card — fills full height ─────────────────────────────── */}
      <div className="flex-1 min-h-0 rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden bg-white">

        {/* ── Gradient header ───────────────────────────────────────────── */}
        <div className={`px-4 py-3 bg-gradient-to-r ${gradient} flex items-center justify-between shrink-0`}>
          <div className="min-w-0 flex-1 flex items-center gap-3">
            {/* Compact back button — circle, matches reference modal's close button style */}
            <button
              onClick={() => navigate(fromDashboard ? '/dashboard' : '/staff')}
              title={fromDashboard ? 'Back to Dashboard' : 'Back to Staff List'}
              className="no-print w-7 h-7 rounded-full bg-white/20 hover:bg-white/35 border border-white/30 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            {/* Initials avatar */}
            <div className="w-9 h-9 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold" style={{ fontFamily: "'DM Serif Display', serif" }}>
                {getInitials(staff.name)}
              </span>
            </div>

            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight">{staff.name}</h3>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                <span className="inline-flex items-center rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {staff.empId}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {staff.designation} · {staff.dept}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {staff.type}
                </span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold text-white ${chipCls}`}>
                  {staff.status}
                </span>
              </div>
            </div>
          </div>

          {/* Edit button — admin only */}
          {isAdmin && (
            <button
              onClick={() => navigate(`/staff/${staff.id}/edit`)}
              className="no-print ml-3 shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>

        {/* ── Info bar ──────────────────────────────────────────────────── */}
        <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {[
              { label: 'DOE',     value: formatDate(staff.doe) },
              { label: 'DOR',     value: formatDate(dor) },
              { label: 'Service', value: `${svcYears} yrs` },
              { label: 'Phone',   value: staff.phone || '—' },
              ...(staff.biometricId ? [{ label: 'Bio ID',       value: staff.biometricId }] : []),
              ...(staff.recipientId ? [{ label: 'Recipient ID', value: staff.recipientId }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col min-w-0">
                <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
                <span className="text-xs text-gray-700 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-200 shrink-0 px-5 bg-white">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? tab.active
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Personal ─────────────────────────────────────────────── */}
          {activeTab === 'personal' && (
            <div className="px-5 py-4 space-y-3">
              <ProfileSection title="Personal Information" accent="bg-blue-50 text-blue-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <div className="col-span-2">
                    <PField label="Full Name" value={staff.name} />
                  </div>
                  <PField label="Employee ID" value={staff.empId} mono />
                  <PField
                    label="Date of Birth"
                    value={staff.dob ? `${formatDate(staff.dob)}  ·  Age ${getAge(staff.dob)}` : ''}
                  />
                  <PField label="Phone" value={staff.phone} />
                  <PField label="Email" value={staff.email} />
                  <div className="col-span-2">
                    <PField label="Father / Husband Name" value={staff.fatherOrHusbandName} />
                  </div>
                  <div className="col-span-2">
                    <PField label="Address" value={staff.address} />
                  </div>
                </dl>
              </ProfileSection>

              <ProfileSection title="Background" accent="bg-amber-50 text-amber-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <PField label="Caste"    value={staff.caste} />
                  <PField label="Category" value={staff.category} />
                </dl>
              </ProfileSection>

              <ProfileSection title="Educational Qualifications" accent="bg-emerald-50 text-emerald-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <div className="col-span-2">
                    <PField label="University" value={staff.university} />
                  </div>
                  <PField label="Class Obtained"     value={staff.classObtained} />
                  <PField label="Date of Completion" value={formatDate(staff.dateOfCompletion)} />
                </dl>
              </ProfileSection>
            </div>
          )}

          {/* ── Service ──────────────────────────────────────────────── */}
          {activeTab === 'service' && (
            <div className="px-5 py-4 space-y-3">
              <ProfileSection title="Position" accent="bg-sky-50 text-sky-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <PField label="Designation"  value={staff.designation} />
                  <PField label="Department"   value={<DeptBadge dept={staff.dept} />} />
                  <PField label="Type"         value={staff.type} />
                  <PField label="Status"       value={<StatusBadge status={staff.status} />} />
                  <PField label="Biometric ID" value={staff.biometricId} mono />
                </dl>
              </ProfileSection>

              <ProfileSection title="Service Record" accent="bg-violet-50 text-violet-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <PField label="Date of Entry into Service" value={formatDate(staff.doe)} />
                  <PField label="Date of Retirement"         value={formatDate(dor)} />
                  <PField label="Years of Service"           value={`${svcYears} years`} />
                  {staff.status === 'RTRD'        && <PField label="Date of Retirement (Actual)" value={formatDate(staff.dor)} />}
                  {staff.status === 'DECEASED'    && <PField label="Date of Deceased"            value={formatDate(staff.dateOfDeceased)} />}
                  {staff.status === 'RESIGNED'    && <PField label="Date of Resignation"         value={formatDate(staff.dateOfResignation)} />}
                  {staff.status === 'TRANSFERRED' && <PField label="Date of Transfer"            value={formatDate(staff.dateOfTransfer)} />}
                </dl>
              </ProfileSection>

              <ProfileSection title="Appointment" accent="bg-orange-50 text-orange-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <PField
                    label="Appointment Type"
                    value={
                      staff.appointmentType === 'DIRECT'    ? 'Direct'    :
                      staff.appointmentType === 'PROMOTION' ? 'Promotion' : ''
                    }
                  />
                  <PField label="Promoted From Designation" value={staff.promotedFromDesignation} />
                </dl>
              </ProfileSection>

              <ProfileSection title="Order & Arrears" accent="bg-amber-50 text-amber-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <PField label="Approval Order No." value={staff.approvalOrderNumber} mono />
                  <PField label="Date of Approval"   value={formatDate(staff.dateOfApproval)} />
                  <PField label="Arrears Taken From" value={staff.arrearsTakenFrom} />
                </dl>
              </ProfileSection>

              <ProfileSection title="Remarks" accent="bg-gray-100 text-gray-500">
                <p className={`text-xs leading-relaxed ${staff.remarks ? 'text-gray-700' : 'text-gray-300'}`}>
                  {staff.remarks || '—'}
                </p>
              </ProfileSection>
            </div>
          )}

          {/* ── Financial ────────────────────────────────────────────── */}
          {activeTab === 'financial' && (
            <div className="px-5 py-4 space-y-3">
              {(() => {
                const slip = salarySlips?.[0] ?? null;
                const daPercent  = slip?.basicPay ? +(slip.daAmount  / slip.basicPay * 100).toFixed(1) : null;
                const hraPercent = slip?.basicPay ? +(slip.hraAmount / slip.basicPay * 100).toFixed(1) : null;
                const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

                type Accent = 'sky' | 'red' | 'emerald';
                const accentCls: Record<Accent, { bg: string; label: string; value: string }> = {
                  sky:     { bg: 'bg-sky-50',     label: 'text-sky-500',     value: 'text-sky-700 font-bold' },
                  red:     { bg: 'bg-red-50',     label: 'text-red-400',     value: 'text-red-700 font-bold' },
                  emerald: { bg: 'bg-emerald-50', label: 'text-emerald-500', value: 'text-emerald-700 font-bold' },
                };
                function SCell({ label, value, accent }: { label: string; value: string; accent?: Accent }) {
                  const a = accent ? accentCls[accent] : null;
                  return (
                    <div className={`flex-1 min-w-0 flex flex-col px-3 py-2.5 ${a ? a.bg : 'bg-white'}`}>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider leading-tight truncate ${a ? a.label : 'text-gray-400'}`}>{label}</span>
                      <span className={`text-xs tabular-nums mt-0.5 truncate ${a ? a.value : 'text-gray-800 font-medium'}`}>{value}</span>
                    </div>
                  );
                }
                const Row = ({ children }: { children: React.ReactNode }) => (
                  <div className="flex rounded-xl border border-gray-100 overflow-hidden divide-x divide-gray-100">{children}</div>
                );

                return (
                  <ProfileSection
                    title={slip ? `Salary · ${slip.month} ${slip.year}` : 'Salary'}
                    accent="bg-emerald-50 text-emerald-600"
                  >
                    {salaryLoading ? (
                      <div className="flex justify-center py-4"><Spinner /></div>
                    ) : slip ? (
                      <div className="space-y-1.5">
                        {/* Row 1 — Earnings */}
                        <Row>
                          <SCell label="Basic Pay"                                          value={inr(slip.basicPay)} />
                          <SCell label={`DA${daPercent != null ? ` (${daPercent}%)`  : ''}`} value={inr(slip.daAmount)} />
                          <SCell label={`HRA${hraPercent != null ? ` (${hraPercent}%)` : ''}`} value={inr(slip.hraAmount)} />
                          <SCell label="IR"          value={fmtN(slip.ir)} />
                          <SCell label="SFN"         value={fmtN(slip.sfn ?? 0)} />
                          <SCell label="P"           value={fmtN(slip.p ?? 0)} />
                          <SCell label="SPAY-TYPIST" value={fmtN(slip.spayTypist ?? 0)} />
                          <SCell label="Gross"       value={inr(slip.gross)} accent="sky" />
                        </Row>
                        {/* Row 2 — Deductions */}
                        <Row>
                          <SCell label="IT"    value={fmtN(slip.itDeduction)} />
                          <SCell label="PT"    value={fmtN(slip.ptDeduction)} />
                          <SCell label="GSLIC" value={fmtN(slip.gslic)} />
                          <SCell label="LIC"   value={fmtN(slip.lic)} />
                          <SCell label="FBF"   value={fmtN(slip.fbf)} />
                          <SCell label="Total Deductions" value={inr(slip.totalDeductions)} accent="red" />
                        </Row>
                        {/* Row 3 — Meta + Net */}
                        <Row>
                          <SCell label="Pay Scale"   value={staff.payScale || slip.payScale || '—'} />
                          <SCell label="Days Worked" value={slip.daysWorked ? String(slip.daysWorked) : '—'} />
                          <SCell label="Net Salary"  value={inr(slip.netSalary)} accent="emerald" />
                        </Row>
                      </div>
                    ) : (
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                        <div className="col-span-2">
                          <PField label="Pay Scale" value={staff.payScale} />
                        </div>
                        <PField label="Basic Pay" value={staff.basicPay ? formatINR(staff.basicPay) : ''} />
                        <PField label="DA %"      value={staff.da  != null ? `${staff.da}%`  : ''} />
                        <PField label="HRA %"     value={staff.hra != null ? `${staff.hra}%` : ''} />
                        <p className="col-span-4 text-[10px] text-gray-300 mt-1">No salary records imported yet</p>
                      </dl>
                    )}
                  </ProfileSection>
                );
              })()}

              <ProfileSection title="Payroll IDs" accent="bg-sky-50 text-sky-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <PField label="Recipient ID" value={staff.recipientId} mono />
                  <PField label="Biometric ID" value={staff.biometricId} mono />
                </dl>
              </ProfileSection>

              <ProfileSection title="Bank & Compliance" accent="bg-rose-50 text-rose-600">
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3.5">
                  <div className="col-span-2">
                    <PField label="Bank Account No." value={staff.bankAccountNo} mono />
                  </div>
                  <PField label="PAN"     value={staff.pan}    mono />
                  <PField label="Aadhaar" value={staff.aadhar} mono />
                </dl>
              </ProfileSection>
            </div>
          )}

          {/* ── Leave ────────────────────────────────────────────────── */}
          {activeTab === 'leave' && (
            leaveLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                {leaveBalance && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                      Leave Balance
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {(['CL', 'HPL', 'EL'] as const).map(type => {
                        const c   = LEAVE_COLORS[type];
                        const key = type.toLowerCase() as 'cl' | 'hpl' | 'el';
                        return (
                          <div
                            key={type}
                            className="rounded-xl border p-3 flex flex-col gap-1"
                            style={{ backgroundColor: c.bg, borderColor: c.border }}
                          >
                            <span className="text-[11px] font-bold" style={{ color: c.accent }}>{type}</span>
                            <span className="text-xl font-bold"     style={{ color: c.accent }}>{leaveBalance[key]}</span>
                            <span className="text-[10px] text-gray-500">days remaining</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                    Leave Records{leaveRecords && leaveRecords.length > 0 ? ` · ${leaveRecords.length}` : ''}
                  </h4>
                  {!leaveRecords || leaveRecords.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-8 border border-dashed border-gray-200 rounded-xl">
                      No leave records found
                    </p>
                  ) : (
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-3 py-2 text-left  font-semibold text-gray-400">From</th>
                            <th className="px-3 py-2 text-left  font-semibold text-gray-400">To</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-400">Type</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-400">Days</th>
                            <th className="px-3 py-2 text-left  font-semibold text-gray-400">Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaveRecords.map((rec, i) => {
                            const c = LEAVE_COLORS[rec.type];
                            return (
                              <tr
                                key={rec.id}
                                className={`border-b border-gray-50 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                              >
                                <td className="px-3 py-2 font-mono text-gray-700">{fmtDate(rec.fromDate)}</td>
                                <td className="px-3 py-2 font-mono text-gray-700">{fmtDate(rec.toDate)}</td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                                    style={{ backgroundColor: c.bg, color: c.accent, border: `1px solid ${c.border}` }}
                                  >
                                    {rec.type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center font-mono font-semibold text-gray-700">
                                  {rec.days}{rec.dayType === 'HALF' ? ' ½' : ''}
                                </td>
                                <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{rec.note ?? '—'}</td>
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

          {/* ── LIC ──────────────────────────────────────────────────── */}
          {activeTab === 'lic' && (
            licLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                {licPolicies && licPolicies.length > 0 && (() => {
                  const totalPremium = licPolicies.reduce((s, p) => s + p.premiumAmount, 0);
                  const nearest = [...licPolicies].sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))[0];
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Policies</span>
                        <span className="text-2xl font-bold text-amber-700">{licPolicies.length}</span>
                        <span className="text-[10px] text-gray-500">active policies</span>
                      </div>
                      <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-sky-500 uppercase tracking-widest">Total Premium</span>
                        <span className="text-lg font-bold text-sky-700">{formatINR(totalPremium)}</span>
                        <span className="text-[10px] text-gray-500">per annum</span>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Next Maturity</span>
                        <span className="text-sm font-bold text-emerald-700 font-mono">{fmtDate(nearest.maturityDate)}</span>
                        <span className="text-[10px] text-gray-500 font-mono truncate">{nearest.policyNumber}</span>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
                    LIC Policies{licPolicies && licPolicies.length > 0 ? ` · ${licPolicies.length}` : ''}
                  </h4>
                  {!licPolicies || licPolicies.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-8 border border-dashed border-gray-200 rounded-xl">
                      No LIC policies found
                    </p>
                  ) : (
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-3 py-2 text-left  font-semibold text-gray-400">#</th>
                            <th className="px-3 py-2 text-left  font-semibold text-gray-400">Policy No.</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-400">Premium (₹)</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-400">Maturity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {licPolicies.map((p, i) => (
                            <tr
                              key={p.id}
                              className={`border-b border-gray-50 last:border-0 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                            >
                              <td className="px-3 py-2 text-gray-300 tabular-nums">{i + 1}</td>
                              <td className="px-3 py-2 font-mono font-medium text-gray-800">{p.policyNumber}</td>
                              <td className="px-3 py-2 text-right font-mono text-gray-700">
                                {p.premiumAmount.toLocaleString('en-IN')}
                              </td>
                              <td className="px-3 py-2 text-center font-mono text-gray-700">
                                {fmtDate(p.maturityDate)}
                              </td>
                            </tr>
                          ))}
                          {licPolicies.length > 1 && (
                            <tr className="bg-amber-50 border-t border-amber-100">
                              <td className="px-3 py-2" />
                              <td className="px-3 py-2 font-bold text-amber-700">Total</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-amber-700">
                                {licPolicies.reduce((s, p) => s + p.premiumAmount, 0).toLocaleString('en-IN')}
                              </td>
                              <td />
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {/* ── Salary ───────────────────────────────────────────────── */}
          {activeTab === 'salary' && (
            salaryLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : (
              <div className="h-full flex flex-col px-5 py-4 gap-2">

                {/* Table */}
                {!salarySlips || salarySlips.length === 0 ? (
                  <p className="text-xs text-gray-300 text-center py-8 border border-dashed border-gray-200 rounded-xl">
                    No salary records found for this staff member
                  </p>
                ) : (
                  <>
                  <div className="flex-1 min-h-0 rounded-xl border border-gray-100 overflow-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-gray-50 border-b border-gray-200">
                            {/* Time */}
                            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">Month</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">Year</th>
                            {/* Earnings */}
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">Basic</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">DA</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">HRA</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">IR</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">SFN</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">P</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">SPAY</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-700 whitespace-nowrap bg-sky-50">Gross</th>
                            {/* Deductions */}
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">IT</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">PT</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">GSLIC</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">LIC</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-gray-500 whitespace-nowrap">FBF</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-red-600  whitespace-nowrap bg-red-50">Tot. Ded.</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap bg-emerald-50">Net</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {salarySlips.map((r, i) => (
                            <tr key={r.id} className={`hover:bg-sky-50/40 transition-colors ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                              <td className="px-3 py-2 text-gray-700 font-medium whitespace-nowrap">{r.month}</td>
                              <td className="px-3 py-2 text-gray-600 tabular-nums">{r.year}</td>
                              <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{fmtN(r.basicPay)}</td>
                              <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{fmtN(r.daAmount)}</td>
                              <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{fmtN(r.hraAmount)}</td>
                              <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{fmtN(r.ir)}</td>
                              <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{fmtN(r.sfn ?? 0)}</td>
                              <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{fmtN(r.p ?? 0)}</td>
                              <td className="px-3 py-2 text-right text-gray-600 tabular-nums">{fmtN(r.spayTypist ?? 0)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-sky-700 tabular-nums bg-sky-50/40">{fmtN(r.gross)}</td>
                              <td className="px-3 py-2 text-right text-red-500 tabular-nums">{fmtN(r.itDeduction)}</td>
                              <td className="px-3 py-2 text-right text-red-500 tabular-nums">{fmtN(r.ptDeduction)}</td>
                              <td className="px-3 py-2 text-right text-red-500 tabular-nums">{fmtN(r.gslic)}</td>
                              <td className="px-3 py-2 text-right text-red-500 tabular-nums">{fmtN(r.lic)}</td>
                              <td className="px-3 py-2 text-right text-red-500 tabular-nums">{fmtN(r.fbf)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-red-700 tabular-nums bg-red-50/40">{fmtN(r.totalDeductions)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-700 tabular-nums bg-emerald-50/40">{fmtN(r.netSalary)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {salarySlips.length > 1 && (() => {
                          const t = salarySlips.reduce((acc, r) => ({
                            basic: acc.basic + r.basicPay, da: acc.da + r.daAmount,
                            hra:   acc.hra   + r.hraAmount, ir: acc.ir + r.ir,
                            sfn:   acc.sfn   + (r.sfn ?? 0), p: acc.p + (r.p ?? 0),
                            spay:  acc.spay  + (r.spayTypist ?? 0),
                            gross: acc.gross + r.gross,
                            it:    acc.it    + r.itDeduction, pt: acc.pt + r.ptDeduction,
                            gslic: acc.gslic + r.gslic, lic: acc.lic + r.lic, fbf: acc.fbf + r.fbf,
                            totDed: acc.totDed + r.totalDeductions, net: acc.net + r.netSalary,
                          }), { basic: 0, da: 0, hra: 0, ir: 0, sfn: 0, p: 0, spay: 0, gross: 0, it: 0, pt: 0, gslic: 0, lic: 0, fbf: 0, totDed: 0, net: 0 });
                          return (
                            <tfoot className="sticky bottom-0 z-10">
                              <tr className="bg-gray-100 border-t-2 border-gray-300">
                                <td colSpan={2} className="px-3 py-2.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700 tabular-nums">{fmtN(t.basic)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700 tabular-nums">{fmtN(t.da)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700 tabular-nums">{fmtN(t.hra)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700 tabular-nums">{fmtN(t.ir)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700 tabular-nums">{fmtN(t.sfn)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700 tabular-nums">{fmtN(t.p)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-gray-700 tabular-nums">{fmtN(t.spay)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-sky-700  tabular-nums">{fmtN(t.gross)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-600  tabular-nums">{fmtN(t.it)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-600  tabular-nums">{fmtN(t.pt)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-600  tabular-nums">{fmtN(t.gslic)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-600  tabular-nums">{fmtN(t.lic)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-600  tabular-nums">{fmtN(t.fbf)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-red-700  tabular-nums">{fmtN(t.totDed)}</td>
                                <td className="px-3 py-2.5 text-right text-xs font-bold text-emerald-700 tabular-nums">{fmtN(t.net)}</td>
                              </tr>
                            </tfoot>
                          );
                        })()}
                      </table>
                  </div>
                  <p className="text-[10px] text-gray-400 text-right pr-1">
                    {salarySlips.length} record{salarySlips.length !== 1 ? 's' : ''}
                  </p>
                  </>
                )}
              </div>
            )
          )}

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
          <div><strong>DOB:</strong> {formatDate(staff.dob)} (Age {getAge(staff.dob)})</div>
          <div><strong>DOE:</strong> {formatDate(staff.doe)}</div>
          <div><strong>DOR:</strong> {formatDate(dor)}</div>
          <div><strong>Service:</strong> {svcYears} years</div>
          <div><strong>Phone:</strong> {staff.phone}</div>
          <div><strong>Email:</strong> {staff.email}</div>
          <div><strong>Pay Scale:</strong> {staff.payScale}</div>
          <div><strong>Basic Pay:</strong> {staff.basicPay ? formatINR(staff.basicPay) : '—'}</div>
          <div><strong>Bank Account No.:</strong> {staff.bankAccountNo}</div>
          <div><strong>PAN:</strong> {staff.pan}</div>
          <div><strong>Aadhaar:</strong> {staff.aadhar}</div>
          {staff.biometricId         && <div><strong>Biometric ID:</strong>       {staff.biometricId}</div>}
          {staff.recipientId         && <div><strong>Recipient ID:</strong>        {staff.recipientId}</div>}
          {staff.caste               && <div><strong>Caste:</strong>               {staff.caste}</div>}
          {staff.category            && <div><strong>Category:</strong>            {staff.category}</div>}
          {staff.university          && <div><strong>University:</strong>          {staff.university}</div>}
          {staff.classObtained       && <div><strong>Class Obtained:</strong>      {staff.classObtained}</div>}
          {staff.dateOfCompletion    && <div><strong>Date of Completion:</strong>  {formatDate(staff.dateOfCompletion)}</div>}
          {staff.approvalOrderNumber && <div><strong>Approval Order No.:</strong>  {staff.approvalOrderNumber}</div>}
          {staff.dateOfApproval      && <div><strong>Date of Approval:</strong>    {formatDate(staff.dateOfApproval)}</div>}
          {staff.arrearsTakenFrom    && <div><strong>Arrears Taken From:</strong>  {staff.arrearsTakenFrom}</div>}
          {staff.remarks             && <div className="col-span-2"><strong>Remarks:</strong> {staff.remarks}</div>}
        </div>
      </div>
    </div>
  );
}
