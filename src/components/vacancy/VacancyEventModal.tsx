import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import {
  addVacancyEvent,
  fillVacancyEvent,
  getAllStaff,
  updateVacancyEvent,
} from '@/firebase/firestore';
import { DESIGNATIONS, VACANCY_REASON_LABELS } from '@/constants/enums';
import type { VacancyEvent, StaffRecord, AppointmentType, VacancyReason } from '@/types';

type Mode = 'add' | 'fill' | 'edit';

interface Props {
  dept: string;
  mode: Mode;
  event?: VacancyEvent;
  onClose: () => void;
  onSaved: () => void;
}

const REASON_OPTIONS = (Object.keys(VACANCY_REASON_LABELS) as VacancyReason[]).map((k) => ({
  value: k,
  label: VACANCY_REASON_LABELS[k],
}));

const DESIGNATION_OPTIONS = DESIGNATIONS.map((d) => ({ value: d, label: d }));

export function VacancyEventModal({ dept, mode, event, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // Add mode fields
  const [designation, setDesignation] = useState(event?.designation ?? DESIGNATIONS[0]);
  const [reason, setReason] = useState<VacancyReason>(event?.vacancyReason ?? 'NEW_POST');
  const [vacatedByStaffId, setVacatedByStaffId] = useState(event?.vacatedByStaffId ?? '');

  // Fill mode fields
  const [filledByStaffId, setFilledByStaffId] = useState('');
  const [dateFilledOn, setDateFilledOn] = useState(new Date().toISOString().slice(0, 10));
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('DIRECT');
  const [promotedFromDesignation, setPromotedFromDesignation] = useState('');

  useEffect(() => {
    if (mode === 'fill' || mode === 'add') {
      setStaffLoading(true);
      getAllStaff()
        .then((list) => setStaffList(list.filter((s) => s.status === 'IN SERVICE')))
        .finally(() => setStaffLoading(false));
    }
  }, [mode]);

  // When a staff is selected for "filled by", auto-populate their designation as the promotedFrom default
  const selectedFilledStaff = staffList.find((s) => s.id === filledByStaffId);
  useEffect(() => {
    if (selectedFilledStaff && !promotedFromDesignation) {
      setPromotedFromDesignation(selectedFilledStaff.designation);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFilledStaff]);

  const staffOptions = staffList.map((s) => ({
    value: s.id!,
    label: `${s.name} (${s.empId}) — ${s.designation}`,
  }));

  const vacatedByOptions = [
    { value: '', label: '— None —' },
    ...staffList.map((s) => ({
      value: s.id!,
      label: `${s.name} (${s.empId})`,
    })),
  ];

  const handleAdd = async () => {
    setSaving(true);
    try {
      const vacatedStaff = staffList.find((s) => s.id === vacatedByStaffId);
      await addVacancyEvent({
        dept,
        designation,
        status: 'VACANT',
        vacancyReason: reason,
        vacatedByStaffId:   vacatedStaff?.id,
        vacatedByStaffName: vacatedStaff?.name,
        isPending: false,
      });
      showToast('success', 'Vacancy entry added');
      onSaved();
    } catch {
      showToast('error', 'Failed to add vacancy');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!event?.id) return;
    setSaving(true);
    try {
      const vacatedStaff = staffList.find((s) => s.id === vacatedByStaffId);
      await updateVacancyEvent(event.id, {
        designation,
        vacancyReason: reason,
        vacatedByStaffId:   vacatedStaff?.id,
        vacatedByStaffName: vacatedStaff?.name,
      });
      showToast('success', 'Vacancy entry updated');
      onSaved();
    } catch {
      showToast('error', 'Failed to update vacancy');
    } finally {
      setSaving(false);
    }
  };

  const handleFill = async () => {
    if (!event?.id) return;
    if (!filledByStaffId) { showToast('error', 'Select a staff member'); return; }
    if (!dateFilledOn)    { showToast('error', 'Enter date filled');       return; }
    if (appointmentType === 'PROMOTION' && !promotedFromDesignation) {
      showToast('error', 'Select the designation promoted from');
      return;
    }
    setSaving(true);
    try {
      const filledStaff = staffList.find((s) => s.id === filledByStaffId);
      await fillVacancyEvent(event.id, {
        filledByStaffId,
        filledByStaffName: filledStaff?.name ?? '',
        dateFilledOn,
        appointmentType,
        promotedFromDesignation: appointmentType === 'PROMOTION' ? promotedFromDesignation : undefined,
        dept:        event.dept,
        designation: event.designation,
      });
      const cascadeMsg = appointmentType === 'PROMOTION'
        ? ` A new vacancy for ${promotedFromDesignation} was also created.`
        : '';
      showToast('success', `Post filled successfully.${cascadeMsg}`);
      onSaved();
    } catch {
      showToast('error', 'Failed to fill vacancy');
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode === 'add'  ? `Add Vacancy — ${dept}` :
    mode === 'fill' ? `Fill Post — ${event?.designation} (${dept})` :
                      `Edit Vacancy — ${dept}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Add / Edit mode */}
          {(mode === 'add' || mode === 'edit') && (
            <>
              <Select
                label="Designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                options={DESIGNATION_OPTIONS}
              />
              <Select
                label="Reason for Vacancy"
                value={reason}
                onChange={(e) => setReason(e.target.value as VacancyReason)}
                options={REASON_OPTIONS}
              />
              {staffLoading ? (
                <p className="text-xs text-gray-400">Loading staff...</p>
              ) : (
                <Select
                  label="Vacated By (optional)"
                  value={vacatedByStaffId}
                  onChange={(e) => setVacatedByStaffId(e.target.value)}
                  options={vacatedByOptions}
                />
              )}
            </>
          )}

          {/* Fill mode */}
          {mode === 'fill' && (
            <>
              <div className="rounded-lg bg-sky-50 border border-sky-200 px-4 py-3 text-sm text-sky-800">
                Filling <strong>{event?.designation}</strong> post in <strong>{dept}</strong>
              </div>

              {staffLoading ? (
                <p className="text-xs text-gray-400">Loading staff...</p>
              ) : (
                <Select
                  label="Staff Member Filling Post"
                  value={filledByStaffId}
                  onChange={(e) => { setFilledByStaffId(e.target.value); setPromotedFromDesignation(''); }}
                  options={[{ value: '', label: '— Select staff —' }, ...staffOptions]}
                />
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 uppercase tracking-wide block mb-1">
                  Date Filled On
                </label>
                <input
                  type="date"
                  value={dateFilledOn}
                  onChange={(e) => setDateFilledOn(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <Select
                label="Appointment Type"
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}
                options={[
                  { value: 'DIRECT',    label: 'Direct' },
                  { value: 'PROMOTION', label: 'Promotion' },
                ]}
              />

              {appointmentType === 'PROMOTION' && (
                <>
                  <Select
                    label="Promoted From Designation"
                    value={promotedFromDesignation}
                    onChange={(e) => setPromotedFromDesignation(e.target.value)}
                    options={[{ value: '', label: '— Select —' }, ...DESIGNATION_OPTIONS]}
                  />
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    A new vacant entry for <strong>{promotedFromDesignation || '…'}</strong> will be auto-created in {dept}.
                  </p>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            loading={saving}
            onClick={() => {
              void (mode === 'fill' ? handleFill() : mode === 'edit' ? handleEdit() : handleAdd());
            }}
          >
            {mode === 'fill' ? 'Fill Post' : mode === 'edit' ? 'Save Changes' : 'Add Vacancy'}
          </Button>
        </div>
      </div>
    </div>
  );
}
