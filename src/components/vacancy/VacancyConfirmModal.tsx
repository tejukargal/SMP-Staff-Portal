import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { addVacancyEvent } from '@/firebase/firestore';
import { useToast } from '@/components/ui/Toast';
import { VACANCY_REASON_LABELS } from '@/constants/enums';

interface Props {
  staffId: string;
  staffName: string;
  designation: string;
  dept: string;
  reason: 'RETIREMENT' | 'RESIGNATION' | 'TRANSFER' | 'DECEASED';
  onDone: () => void;
}

export function VacancyConfirmModal({ staffId, staffName, designation, dept, reason, onDone }: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await addVacancyEvent({
        dept,
        designation,
        status: 'VACANT',
        vacancyReason: reason,
        vacatedByStaffId: staffId,
        vacatedByStaffName: staffName,
        isPending: false,
      });
      showToast('success', 'Vacancy entry created');
    } catch {
      showToast('error', 'Failed to create vacancy entry');
    } finally {
      setLoading(false);
      onDone();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Create Vacancy Entry?</h3>
            <p className="text-sm text-gray-500 mt-1">
              <strong>{staffName}</strong> has been marked as{' '}
              <strong>{VACANCY_REASON_LABELS[reason]?.toLowerCase()}</strong>. Would you like to
              open a vacant post for <strong>{designation}</strong> in <strong>{dept}</strong>?
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={onDone} disabled={loading}>
            Skip
          </Button>
          <Button size="sm" loading={loading} onClick={() => { void handleConfirm(); }}>
            Yes, Create Vacancy
          </Button>
        </div>
      </div>
    </div>
  );
}
