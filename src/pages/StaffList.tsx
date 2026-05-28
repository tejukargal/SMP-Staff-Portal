import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, FileText, FileUp } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { useRole } from '@/hooks/useRole';
import { StaffFilters, type StaffFiltersState } from '@/components/staff/StaffFilters';
import { StaffTable } from '@/components/staff/StaffTable';
import { ImportModal } from '@/components/staff/ImportModal';
import { LeaveModal } from '@/components/staff/LeaveModal';
import { LicModal } from '@/components/staff/LicModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { deleteStaff } from '@/firebase/firestore';
import { exportStaffToExcel } from '@/utils/exportUtils';
import { exportStaffListPdf } from '@/utils/reportsPdf';
import { DEPT_COLORS, DEPARTMENTS } from '@/constants/enums';
import type { StaffRecord } from '@/types';

export default function StaffList() {
  const { staff, loading, refetch } = useStaff();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [filters, setFilters] = useState<StaffFiltersState>({
    search: '',
    dept: '',
    type: '',
    status: '',
    desig: '',
  });
  const [deleteTarget, setDeleteTarget] = useState<StaffRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<StaffRecord | null>(null);
  const [licTarget, setLicTarget]     = useState<StaffRecord | null>(null);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toUpperCase();
    return staff
      .filter((s) => {
        if (q && !s.name.includes(q) && !s.empId.includes(q)) return false;
        if (filters.dept   && s.dept        !== filters.dept)   return false;
        if (filters.type   && s.type        !== filters.type)   return false;
        if (filters.status && s.status      !== filters.status) return false;
        if (filters.desig  && s.designation !== filters.desig)  return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, filters]);

  const stats = useMemo(() => {
    const inService  = filtered.filter(s => s.status === 'IN SERVICE').length;
    const teaching   = filtered.filter(s => s.type === 'TEACHING').length;
    const deptCounts = DEPARTMENTS.map(d => ({
      dept: d,
      count: filtered.filter(s => s.dept === d).length,
    })).filter(d => d.count > 0);
    return { total: filtered.length, inService, teaching, nonTeaching: filtered.length - teaching, deptCounts };
  }, [filtered]);

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await deleteStaff(deleteTarget.id);
      showToast('success', `${deleteTarget.name} deleted successfully`);
      refetch();
    } catch {
      showToast('error', 'Failed to delete staff record');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 flex-wrap">
        <StaffFilters
          filters={filters}
          onChange={(f) => setFilters(f)}
        />

        <div className="flex gap-2 shrink-0 no-print">
          <Button variant="secondary" size="sm" onClick={() => exportStaffToExcel(filtered)}>
            <Download className="w-3.5 h-3.5" />
            Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setTimeout(() => exportStaffListPdf(filtered, {
            search: filters.search || undefined,
            dept:   filters.dept   || undefined,
            type:   filters.type   || undefined,
            status: filters.status || undefined,
            desig:  filters.desig  || undefined,
          }), 0)}>
            <FileText className="w-3.5 h-3.5" />
            PDF
          </Button>
          {isAdmin && (
            <>
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                <FileUp className="w-3.5 h-3.5" />
                Import
              </Button>
              <Button size="sm" onClick={() => navigate('/staff/new')}>
                <Plus className="w-3.5 h-3.5" />
                Add Staff
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex-shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {/* Total */}
        <div className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0" style={{ boxShadow: '0 1px 3px rgba(14,165,233,0.07)' }}>
          <span className="text-[11px] text-sky-500 font-semibold">Total</span>
          <span className="text-[11px] font-bold text-gray-800" style={{ animation: 'stat-pop 0.28s ease-out' }} key={stats.total}>{stats.total}</span>
        </div>

        <span className="text-sky-200 text-xs select-none shrink-0">·</span>

        {/* In Service */}
        <div className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-[11px] text-gray-500 font-medium">In Service</span>
          <span className="text-[11px] font-bold text-gray-800" key={stats.inService} style={{ animation: 'stat-pop 0.28s ease-out' }}>{stats.inService}</span>
        </div>

        <span className="text-sky-200 text-xs select-none shrink-0">·</span>

        {/* Teaching / Non-Teaching */}
        <div className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0">
          <span className="text-[11px] text-gray-500 font-medium">Teaching</span>
          <span className="text-[11px] font-bold text-gray-800" key={`t-${stats.teaching}`} style={{ animation: 'stat-pop 0.28s ease-out' }}>{stats.teaching}</span>
        </div>
        <div className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0">
          <span className="text-[11px] text-gray-500 font-medium">Non-Teaching</span>
          <span className="text-[11px] font-bold text-gray-800" key={`nt-${stats.nonTeaching}`} style={{ animation: 'stat-pop 0.28s ease-out' }}>{stats.nonTeaching}</span>
        </div>

        {stats.deptCounts.length > 0 && (
          <>
            <span className="text-sky-200 text-xs select-none shrink-0">·</span>
            {stats.deptCounts.map(({ dept, count }) => (
              <div key={dept} className="flex items-center gap-1 bg-white/80 border border-sky-100 rounded-full px-2.5 py-0.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: DEPT_COLORS[dept] }} />
                <span className="text-[11px] text-gray-600 font-medium">{dept}</span>
                <span className="text-[11px] font-bold text-gray-800" key={`${dept}-${count}`} style={{ animation: 'stat-pop 0.28s ease-out' }}>{count}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Table — the only scrollable section */}
      <StaffTable
        staff={filtered}
        loading={loading}
        isAdmin={isAdmin}
        onDelete={(s) => setDeleteTarget(s)}
        onLeave={(s) => setLeaveTarget(s)}
        onLic={(s) => setLicTarget(s)}
        className="flex-1 min-h-0"
      />

      {/* Delete confirm */}
      <Modal
        open={deleteTarget !== null}
        title="Delete Staff Record"
        message={
          <>
            Are you sure you want to permanently delete{' '}
            <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={() => { void handleDelete(); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Leave modal */}
      <LeaveModal
        open={leaveTarget !== null}
        staff={leaveTarget}
        onClose={() => setLeaveTarget(null)}
      />

      {/* LIC Policy modal */}
      <LicModal
        open={licTarget !== null}
        staff={licTarget}
        onClose={() => setLicTarget(null)}
      />

      {/* Import modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          showToast('success', 'Staff records imported successfully');
          refetch();
        }}
      />
    </div>
  );
}
