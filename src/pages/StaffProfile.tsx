import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { StaffCard } from '@/components/staff/StaffCard';
import { Button } from '@/components/ui/Button';
import { PageSpinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import { getStaffById } from '@/firebase/firestore';
import { formatDate, computeServiceYears, computeDOR } from '@/utils/dateUtils';
import { computeGross, computeNet, computeDAAmount, computeHRAAmount, formatINR } from '@/utils/salaryUtils';
import { maskAadhaar, maskPAN, maskBankAccount } from '@/utils/maskUtils';
import type { StaffRecord } from '@/types';

type Tab = 'personal' | 'service' | 'financial' | 'salary';

const TABS: { key: Tab; label: string }[] = [
  { key: 'personal', label: 'Personal' },
  { key: 'service', label: 'Service' },
  { key: 'financial', label: 'Financial' },
  { key: 'salary', label: 'Salary' },
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-3 border-b border-[#F3F4F6] text-sm">
      <span className="text-[#6B7280] shrink-0">{label}</span>
      <span className="font-medium text-[#111827] text-right">{value}</span>
    </div>
  );
}

export default function StaffProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const { showToast } = useToast();

  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getStaffById(id)
      .then((data) => {
        if (data) setStaff(data);
        else showToast('error', 'Staff record not found');
      })
      .catch(() => showToast('error', 'Failed to load staff record'))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  if (loading) return <PageSpinner />;
  if (!staff) return (
    <div className="text-center py-16 text-[#6B7280]">
      Staff record not found.{' '}
      <button onClick={() => navigate('/staff')} className="text-[#1B3A6B] underline">
        Go back
      </button>
    </div>
  );

  const basicPay = staff.basicPay ?? 0;
  const da = staff.da ?? 0;
  const hra = staff.hra ?? 0;
  const nps = staff.nps ?? 0;
  const pt = staff.pt ?? 0;
  const daAmount = computeDAAmount(basicPay, da);
  const hraAmount = computeHRAAmount(basicPay, hra);
  const gross = computeGross(basicPay, da, hra);
  const net = computeNet(gross, nps, pt);
  const dor = staff.dor || computeDOR(staff.dob);

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start no-print" onClick={() => navigate('/staff')}>
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Staff List
      </Button>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column — profile card */}
        <div className="col-span-1">
          <StaffCard staff={{ ...staff, dor }} isAdmin={isAdmin} />
        </div>

        {/* Right column — tabs */}
        <div className="col-span-2 bg-white rounded-xl border border-[#E2E5EA]">
          {/* Tab bar */}
          <div className="flex border-b border-[#E2E5EA] no-print">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'px-5 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                  activeTab === tab.key
                    ? 'border-[#1B3A6B] text-[#1B3A6B]'
                    : 'border-transparent text-[#6B7280] hover:text-[#111827]',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Personal */}
            {activeTab === 'personal' && (
              <div>
                <Row label="Full Name" value={staff.name} />
                <Row label="Date of Birth" value={formatDate(staff.dob)} />
                <Row label="Phone" value={staff.phone || '—'} />
                <Row label="Email" value={staff.email || '—'} />
                {staff.caste && <Row label="Caste" value={staff.caste} />}
                {staff.category && <Row label="Category" value={staff.category} />}
                {staff.dateOfCompletion && <Row label="Date of Completion" value={formatDate(staff.dateOfCompletion)} />}
                {staff.classObtained && <Row label="Class Obtained" value={staff.classObtained} />}
                {staff.university && <Row label="University" value={staff.university} />}
              </div>
            )}

            {/* Service */}
            {activeTab === 'service' && (
              <div>
                <Row label="Employee ID" value={<span className="font-mono">{staff.empId}</span>} />
                <Row label="Designation" value={staff.designation} />
                <Row label="Department" value={staff.dept} />
                <Row label="Type" value={staff.type} />
                <Row label="Date of Entry into Service" value={formatDate(staff.doe)} />
                <Row label="Date of Retirement" value={formatDate(dor)} />
                <Row label="Years of Service" value={`${computeServiceYears(staff.doe)} years`} />
                {staff.approvalOrderNumber && <Row label="Approval Order No." value={staff.approvalOrderNumber} />}
                {staff.dateOfApproval && <Row label="Date of Approval" value={formatDate(staff.dateOfApproval)} />}
                {staff.arrearsTakenFrom && <Row label="Arrears Taken From" value={staff.arrearsTakenFrom} />}
                <Row label="Pay Scale" value={staff.payScale || '—'} />
                <Row label="Basic Pay" value={basicPay ? formatINR(basicPay) : '—'} />
                {staff.remarks && <Row label="Remarks" value={staff.remarks} />}
              </div>
            )}

            {/* Financial */}
            {activeTab === 'financial' && (
              <div>
                <div className="flex justify-end mb-3 no-print">
                  {isAdmin && (
                    <button
                      onClick={() => setRevealed((r) => !r)}
                      className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#1B3A6B] transition-colors"
                    >
                      {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {revealed ? 'Mask fields' : 'Reveal fields'}
                    </button>
                  )}
                </div>
                <Row
                  label="Bank Account No."
                  value={<span className="font-mono">{maskBankAccount(staff.bankAccountNo, revealed)}</span>}
                />
                <Row
                  label="PAN"
                  value={<span className="font-mono">{maskPAN(staff.pan, revealed)}</span>}
                />
                <Row
                  label="Aadhaar"
                  value={<span className="font-mono">{maskAadhaar(staff.aadhar, revealed)}</span>}
                />
              </div>
            )}

            {/* Salary */}
            {activeTab === 'salary' && (
              <div>
                <Row label="Basic Pay" value={basicPay ? formatINR(basicPay) : '—'} />
                <Row label={`DA (${da}%)`} value={daAmount ? formatINR(daAmount) : '—'} />
                <Row label={`HRA (${hra}%)`} value={hraAmount ? formatINR(hraAmount) : '—'} />
                <Row label="Gross Salary" value={<span className="font-bold text-[#1B3A6B]">{gross ? formatINR(gross) : '—'}</span>} />
                <Row label="NPS Deduction" value={nps ? formatINR(nps) : '—'} />
                <Row label="Professional Tax" value={pt ? formatINR(pt) : '—'} />
                <Row label="Net Salary" value={<span className="font-bold text-[#16A34A]">{net ? formatINR(net) : '—'}</span>} />
              </div>
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
          {staff.caste && <div><strong>Caste:</strong> {staff.caste}</div>}
          {staff.category && <div><strong>Category:</strong> {staff.category}</div>}
          {staff.university && <div><strong>University:</strong> {staff.university}</div>}
          {staff.classObtained && <div><strong>Class Obtained:</strong> {staff.classObtained}</div>}
          {staff.dateOfCompletion && <div><strong>Date of Completion:</strong> {formatDate(staff.dateOfCompletion)}</div>}
          {staff.approvalOrderNumber && <div><strong>Approval Order No.:</strong> {staff.approvalOrderNumber}</div>}
          {staff.dateOfApproval && <div><strong>Date of Approval:</strong> {formatDate(staff.dateOfApproval)}</div>}
          {staff.arrearsTakenFrom && <div><strong>Arrears Taken From:</strong> {staff.arrearsTakenFrom}</div>}
        </div>
      </div>
    </div>
  );
}
