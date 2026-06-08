import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { VacancyConfirmModal } from '@/components/vacancy/VacancyConfirmModal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/hooks/useAuth';
import { addStaff, updateStaff, getStaffById, isEmpIdUnique, getAllStaff } from '@/firebase/firestore';
import { computeDOR, getAge } from '@/utils/dateUtils';
import { DESIGNATIONS, DEPARTMENTS, STATUSES } from '@/constants/enums';
import type { StaffRecord, DesignationEnum, DeptEnum, StatusEnum, StaffType, AppointmentType } from '@/types';
import { PageSpinner } from '@/components/ui/Spinner';

// ── Date helpers ──────────────────────────────────────────────────────────────

/** "dd/mm/yyyy" → "yyyy-MM-dd" (returns '' if invalid) */
function parseDMY(s: string): string {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const [, d, mo, y] = m;
  const dt = new Date(+y, +mo - 1, +d);
  if (
    isNaN(dt.getTime()) ||
    dt.getDate() !== +d ||
    dt.getMonth() !== +mo - 1 ||
    dt.getFullYear() !== +y
  ) return '';
  return `${y}-${mo}-${d}`;
}

/** "yyyy-MM-dd" → "dd/mm/yyyy" (returns '' if not ISO) */
function isoToDMY(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, mo, d] = iso.split('-');
  return `${d}/${mo}/${y}`;
}

interface DateInputProps {
  label: string;
  required?: boolean;
  value: string;         // ISO yyyy-MM-dd (or '')
  onChange: (iso: string) => void;
  error?: string;
  hint?: string;
}

function DateInput({ label, required, value, onChange, error, hint }: DateInputProps) {
  const [text, setText] = useState(() => isoToDMY(value));
  // Track the last ISO we emitted so we can distinguish external vs internal changes
  const lastEmitted = useRef(value);

  useLayoutEffect(() => {
    // Sync display only when the prop changed externally (e.g. DOR auto-computed from DOB)
    if (value !== lastEmitted.current && value) {
      lastEmitted.current = value;
      setText(isoToDMY(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setText(newText);

    const iso = parseDMY(newText);
    lastEmitted.current = iso;
    onChange(iso);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">
        {label}{required && <span className="text-[#DC2626] ml-1">*</span>}
      </label>
      <input
        type="text"
        placeholder="dd/mm/yyyy"
        value={text}
        onChange={handleChange}
        maxLength={10}
        className={[
          'w-full px-3 py-2 text-sm rounded-lg border bg-white text-gray-900',
          'placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent',
          error ? 'border-red-400' : 'border-gray-200',
        ].join(' ')}
      />
      {hint && !error && <p className="text-xs text-[#6B7280]">{hint}</p>}
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}

type FormErrors = Partial<Record<keyof StaffRecord, string>>;

type SectionColor = 'indigo' | 'sky' | 'emerald' | 'amber' | 'violet';

const COLOR_CLASSES: Record<SectionColor, { border: string; headerBg: string; headerBorder: string; bodyBg: string; text: string }> = {
  indigo: { border: 'border-indigo-200', headerBg: 'bg-indigo-100', headerBorder: 'border-b border-indigo-200', bodyBg: 'bg-indigo-50', text: 'text-indigo-800' },
  sky:    { border: 'border-sky-200',    headerBg: 'bg-sky-100',    headerBorder: 'border-b border-sky-200',    bodyBg: 'bg-sky-50',    text: 'text-sky-800'    },
  emerald:{ border: 'border-emerald-200',headerBg: 'bg-emerald-100',headerBorder: 'border-b border-emerald-200',bodyBg: 'bg-emerald-50',text: 'text-emerald-800' },
  amber:  { border: 'border-amber-200',  headerBg: 'bg-amber-100',  headerBorder: 'border-b border-amber-200',  bodyBg: 'bg-amber-50',  text: 'text-amber-800'  },
  violet: { border: 'border-violet-200', headerBg: 'bg-violet-100', headerBorder: 'border-b border-violet-200', bodyBg: 'bg-violet-50', text: 'text-violet-800' },
};

function ColorSection({ title, color, children }: { title: string; color: SectionColor; children: React.ReactNode }) {
  const c = COLOR_CLASSES[color];
  return (
    <section className={`rounded-xl border ${c.border} shadow-sm`}>
      <div className={`${c.headerBg} px-6 py-2.5 ${c.headerBorder} rounded-t-xl`}>
        <h3 className={`text-sm font-bold ${c.text} uppercase tracking-wider`}>{title}</h3>
      </div>
      <div className={`${c.bodyBg} px-6 py-5 rounded-b-xl`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {children}
        </div>
      </div>
    </section>
  );
}

const CATEGORY_OPTIONS = [
  { value: 'GM', label: 'GM' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' },
  { value: 'C1', label: 'C1' },
  { value: '2A', label: '2A' },
  { value: '2B', label: '2B' },
  { value: '3A', label: '3A' },
  { value: '3B', label: '3B' },
];

const CLASS_OPTIONS = [
  { value: 'DISTINCTION', label: 'DISTINCTION' },
  { value: 'FIRST CLASS', label: 'FIRST CLASS' },
  { value: 'SECOND CLASS', label: 'SECOND CLASS' },
  { value: 'PASS CLASS', label: 'PASS CLASS' },
];

const FIELD_LABELS: Record<string, string> = {
  name:               'Name',
  empId:              'Employee ID',
  dob:                'Date of Birth',
  doe:                'Date of Entry',
  phone:              'Phone',
  pan:                'PAN',
  aadhar:             'Aadhaar',
  designation:        'Designation',
  dept:               'Department',
  status:             'Status',
};

const EMPTY: Partial<StaffRecord> = {
  name: '',
  empId: '',
  designation: 'LECTURER',
  type: 'TEACHING',
  dept: 'CE',
  status: 'IN SERVICE',
  dob: '',
  phone: '',
  email: '',
  fatherOrHusbandName: '',
  address: '',
  caste: '',
  category: '',
  dateOfCompletion: '',
  classObtained: '',
  university: '',
  doe: '',
  dor: '',
  approvalOrderNumber: '',
  dateOfApproval: '',
  arrearsTakenFrom: '',
  bankAccountNo: '',
  pan: '',
  aadhar: '',
  recipientId: '',
  biometricId: '',
  dateOfDeceased: '',
  dateOfResignation: '',
  dateOfTransfer: '',
  remarks: '',
};

export default function StaffForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState<Partial<StaffRecord>>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const originalRef = useRef<Partial<StaffRecord>>(EMPTY);

  // Vacancy auto-suggest state
  const [vacancyPrompt, setVacancyPrompt] = useState<{
    staffId: string;
    staffName: string;
    designation: string;
    dept: string;
    reason: 'RETIREMENT' | 'RESIGNATION' | 'TRANSFER' | 'DECEASED';
    navigateTo: string;
  } | null>(null);

  useEffect(() => {
    if (!isEdit || !id) return;
    setFetching(true);
    getStaffById(id)
      .then((data) => {
        if (data) {
          const recomputed = { ...data, dor: computeDOR(data.dob) || data.dor };
          setForm(recomputed);
          originalRef.current = recomputed;
        }
        else showToast('error', 'Staff record not found');
      })
      .catch(() => showToast('error', 'Failed to load staff record'))
      .finally(() => setFetching(false));
  }, [id, isEdit, showToast]);

  const set = <K extends keyof StaffRecord>(key: K, value: StaffRecord[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    if (key === 'dob' && typeof value === 'string') {
      const dor = computeDOR(value);
      setForm((f) => ({ ...f, dob: value, dor }));
    }
  };

  const handleReset = () => {
    setForm(isEdit ? originalRef.current : EMPTY);
    setErrors({});
  };

  const validate = async (): Promise<boolean> => {
    const e: FormErrors = {};
    if (!form.name?.trim()) e.name = 'Name is required';
    if (!form.empId?.trim()) {
      e.empId = 'Employee ID is required';
    } else {
      const unique = await isEmpIdUnique(form.empId, id);
      if (!unique) e.empId = 'Employee ID already exists';
    }
    if (!form.dob) e.dob = 'Date of birth is required';
    else if (getAge(form.dob) < 18 || getAge(form.dob) > 70) e.dob = 'Age must be between 18 and 70';
    if (!form.doe) e.doe = 'Date of entry into service is required';
    if (form.phone && !/^\d{10}$/.test(form.phone)) e.phone = 'Must be exactly 10 digits';
    if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan)) e.pan = 'Invalid PAN format (e.g. ABCDE1234F)';
    if (form.aadhar && !/^\d{12}$/.test(form.aadhar)) e.aadhar = 'Must be exactly 12 digits';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(await validate())) return;
    setLoading(true);
    try {
      if (isEdit && id) {
        const prevStatus = originalRef.current.status;
        const newStatus = form.status;
        await updateStaff(id, {
          ...form,
          updatedAt: undefined as never,
        } as Partial<StaffRecord>);
        showToast('success', 'Staff record updated');

        // Auto-suggest vacancy when staff transitions out of IN SERVICE
        const vacancyTriggerStatuses = ['RTRD', 'RESIGNED', 'TRANSFERRED', 'DECEASED'] as const;
        type TriggerStatus = typeof vacancyTriggerStatuses[number];
        const reasonMap: Record<TriggerStatus, 'RETIREMENT' | 'RESIGNATION' | 'TRANSFER' | 'DECEASED'> = {
          RTRD:        'RETIREMENT',
          RESIGNED:    'RESIGNATION',
          TRANSFERRED: 'TRANSFER',
          DECEASED:    'DECEASED',
        };
        if (
          prevStatus === 'IN SERVICE' &&
          newStatus &&
          (vacancyTriggerStatuses as readonly string[]).includes(newStatus)
        ) {
          setVacancyPrompt({
            staffId:     id,
            staffName:   form.name ?? '',
            designation: form.designation ?? '',
            dept:        form.dept ?? '',
            reason:      reasonMap[newStatus as TriggerStatus],
            navigateTo:  `/staff/${id}`,
          });
        } else {
          navigate(`/staff/${id}`);
        }
      } else {
        const allStaff = await getAllStaff();
        const sl = allStaff.length + 1;
        await addStaff({
          ...(form as Omit<StaffRecord, 'id' | 'createdAt' | 'updatedAt'>),
          sl,
          createdBy: user?.uid ?? '',
        });
        showToast('success', 'Staff record added');
        navigate('/staff');
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save staff record');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <PageSpinner />;

  const designationOptions = DESIGNATIONS.map((d) => ({ value: d, label: d }));
  const deptOptions = DEPARTMENTS.map((d) => ({ value: d, label: d }));
  const statusOptions = STATUSES.map((s) => ({ value: s, label: s }));
  const errorKeys = Object.keys(errors);

  return (
    <>
      <form id="staff-form" onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4 w-full pb-16" style={{ animation: 'page-enter 0.35s ease-out' }}>
      <div className="flex items-center gap-3 mb-1">
        <Button type="button" variant="secondary" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <h2 className="text-lg font-semibold text-[#111827]" style={{ fontFamily: "'DM Serif Display', serif" }}>
          {isEdit ? 'Edit Staff Record' : 'Add New Staff'}
        </h2>
      </div>

      {/* A — Basic Information */}
      <ColorSection title="A — Basic Information" color="indigo">
        <div className="lg:col-span-2">
          <Input
            label="Name"
            required
            uppercase
            value={form.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
            error={errors.name}
          />
        </div>
        <Input
          label="Employee ID"
          required
          uppercase
          value={form.empId ?? ''}
          onChange={(e) => set('empId', e.target.value)}
          error={errors.empId}
          className="font-mono"
        />
        <Select
          label="Designation"
          required
          value={form.designation ?? ''}
          onChange={(e) => set('designation', e.target.value as DesignationEnum)}
          options={designationOptions}
          error={errors.designation}
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">
            Type <span className="text-[#DC2626]">*</span>
          </label>
          <div className="flex gap-4 pt-1">
            {(['TEACHING', 'NON-TEACHING'] as StaffType[]).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={form.type === t}
                  onChange={() => set('type', t)}
                  className="accent-sky-500"
                />
                <span className="text-sm text-[#374151]">{t}</span>
              </label>
            ))}
          </div>
        </div>
        <Select
          label="Department"
          required
          value={form.dept ?? ''}
          onChange={(e) => set('dept', e.target.value as DeptEnum)}
          options={deptOptions}
          error={errors.dept}
        />
        <Select
          label="Status"
          required
          value={form.status ?? ''}
          onChange={(e) => set('status', e.target.value as StatusEnum)}
          options={statusOptions}
          error={errors.status}
        />
        {form.status === 'RTRD' && (
          <DateInput
            label="Date of Retirement"
            value={form.dor ?? ''}
            onChange={(iso) => set('dor', iso)}
            hint="Actual date of retirement"
          />
        )}
        {form.status === 'DECEASED' && (
          <DateInput
            label="Date of Deceased"
            value={form.dateOfDeceased ?? ''}
            onChange={(iso) => set('dateOfDeceased', iso)}
          />
        )}
        {form.status === 'RESIGNED' && (
          <DateInput
            label="Date of Resignation"
            value={form.dateOfResignation ?? ''}
            onChange={(iso) => set('dateOfResignation', iso)}
          />
        )}
        {form.status === 'TRANSFERRED' && (
          <DateInput
            label="Date of Transfer"
            value={form.dateOfTransfer ?? ''}
            onChange={(iso) => set('dateOfTransfer', iso)}
          />
        )}
        <div className="lg:col-span-4">
          <label className="text-xs font-medium text-[#374151] uppercase tracking-wide block mb-1">Remarks</label>
          <textarea
            value={form.remarks ?? ''}
            onChange={(e) => set('remarks', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
          />
        </div>
      </ColorSection>

      {/* B — Personal Details */}
      <ColorSection title="B — Personal Details" color="sky">
        <DateInput
          label="Date of Birth"
          required
          value={form.dob ?? ''}
          onChange={(iso) => set('dob', iso)}
          error={errors.dob}
        />
        <Input
          label="Phone"
          type="tel"
          value={form.phone ?? ''}
          onChange={(e) => set('phone', e.target.value)}
          error={errors.phone}
          hint="10 digits"
          maxLength={10}
        />
        <div className="lg:col-span-2">
          <Input
            label="Email"
            type="email"
            value={form.email ?? ''}
            onChange={(e) => set('email', e.target.value.toLowerCase())}
            error={errors.email}
          />
        </div>
        <div className="lg:col-span-2">
          <Input
            label="Father / Husband Name"
            uppercase
            value={form.fatherOrHusbandName ?? ''}
            onChange={(e) => set('fatherOrHusbandName', e.target.value)}
          />
        </div>
        <div className="lg:col-span-4">
          <Input
            label="Address"
            uppercase
            value={form.address ?? ''}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
        <Input
          label="Caste"
          uppercase
          value={form.caste ?? ''}
          onChange={(e) => set('caste', e.target.value)}
        />
        <Select
          label="Category"
          value={form.category ?? ''}
          onChange={(e) => set('category', e.target.value)}
          options={CATEGORY_OPTIONS}
          placeholder="Select category"
        />
      </ColorSection>

      {/* C — Educational Qualifications */}
      <ColorSection title="C — Educational Qualifications" color="emerald">
        <DateInput
          label="Date of Completion"
          value={form.dateOfCompletion ?? ''}
          onChange={(iso) => set('dateOfCompletion', iso)}
        />
        <Select
          label="Class Obtained"
          value={form.classObtained ?? ''}
          onChange={(e) => set('classObtained', e.target.value)}
          options={CLASS_OPTIONS}
          placeholder="Select class"
        />
        <div className="lg:col-span-2">
          <Input
            label="University"
            uppercase
            value={form.university ?? ''}
            onChange={(e) => set('university', e.target.value)}
          />
        </div>
      </ColorSection>

      {/* D — Service Details */}
      <ColorSection title="D — Service Details" color="amber">
        <DateInput
          label="Date of Entry into Service"
          required
          value={form.doe ?? ''}
          onChange={(iso) => set('doe', iso)}
          error={errors.doe}
        />
        <DateInput
          label="Date of Retirement (DOR)"
          value={form.dor ?? ''}
          onChange={(iso) => set('dor', iso)}
          hint="Auto-computed from DOB"
        />
        <Input
          label="Approval Order Number"
          uppercase
          value={form.approvalOrderNumber ?? ''}
          onChange={(e) => set('approvalOrderNumber', e.target.value)}
        />
        <DateInput
          label="Date of Approval"
          value={form.dateOfApproval ?? ''}
          onChange={(iso) => set('dateOfApproval', iso)}
        />
        <div className="lg:col-span-2">
          <Input
            label="Arrears Taken From"
            value={form.arrearsTakenFrom ?? ''}
            onChange={(e) => set('arrearsTakenFrom', e.target.value)}
          />
        </div>
        <Select
          label="Appointment Type"
          value={form.appointmentType ?? ''}
          onChange={(e) => set('appointmentType', e.target.value as AppointmentType || undefined as never)}
          options={[
            { value: 'DIRECT',    label: 'Direct' },
            { value: 'PROMOTION', label: 'Promotion' },
          ]}
          placeholder="Select type"
        />
        {form.appointmentType === 'PROMOTION' && (
          <Select
            label="Promoted From Designation"
            value={form.promotedFromDesignation ?? ''}
            onChange={(e) => set('promotedFromDesignation', e.target.value as DesignationEnum)}
            options={designationOptions}
            placeholder="Select designation"
          />
        )}
      </ColorSection>

      {/* E — Financial & Compliance */}
      <ColorSection title="E — Financial & Compliance" color="violet">
        <Input
          label="Bank Account No."
          uppercase
          value={form.bankAccountNo ?? ''}
          onChange={(e) => set('bankAccountNo', e.target.value)}
          error={errors.bankAccountNo}
          hint="11–17 digits"
          className="font-mono"
        />
        <Input
          label="PAN"
          uppercase
          value={form.pan ?? ''}
          onChange={(e) => set('pan', e.target.value)}
          error={errors.pan}
          hint="ABCDE1234F"
          maxLength={10}
          className="font-mono"
        />
        <div className="lg:col-span-2">
          <Input
            label="Aadhaar"
            value={form.aadhar ?? ''}
            onChange={(e) => set('aadhar', e.target.value.replace(/\D/g, ''))}
            error={errors.aadhar}
            hint="12 digits"
            maxLength={12}
            className="font-mono"
          />
        </div>
        <Input
          label="Recipient ID"
          uppercase
          value={form.recipientId ?? ''}
          onChange={(e) => set('recipientId', e.target.value)}
          className="font-mono"
        />
        <Input
          label="Biometric ID"
          uppercase
          value={form.biometricId ?? ''}
          onChange={(e) => set('biometricId', e.target.value)}
          className="font-mono"
        />
      </ColorSection>

      </form>

      {/* Vacancy auto-suggest modal */}
      {vacancyPrompt && (
        <VacancyConfirmModal
          staffId={vacancyPrompt.staffId}
          staffName={vacancyPrompt.staffName}
          designation={vacancyPrompt.designation}
          dept={vacancyPrompt.dept}
          reason={vacancyPrompt.reason}
          onDone={() => {
            setVacancyPrompt(null);
            navigate(vacancyPrompt.navigateTo);
          }}
        />
      )}

      {/* Footer bar — fixed, always visible, left-offset matches sidebar width via CSS var */}
      <div
        className="fixed bottom-0 right-0 z-20 flex items-center gap-3 h-13 px-5 no-print"
        style={{ left: 'var(--sidebar-w)', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', borderTop: '1px solid #BAE6FD', boxShadow: '0 -1px 8px 0 rgba(14,165,233,0.07)' }}
      >
        {/* Validation error pills on the left */}
        {errorKeys.length > 0 && (
          <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
            <svg className="shrink-0 text-red-500 w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div className="flex items-center gap-1 overflow-x-auto min-w-0" style={{ scrollbarWidth: 'none' }}>
              {errorKeys.map((key) => (
                <span
                  key={key}
                  className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200 whitespace-nowrap"
                >
                  {FIELD_LABELS[key] ?? key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Buttons — pushed to the right */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {!isEdit && (
            <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" size="sm" loading={loading}>
            {isEdit ? 'Save Changes' : 'Add Staff'}
          </Button>
        </div>
      </div>
    </>
  );
}
