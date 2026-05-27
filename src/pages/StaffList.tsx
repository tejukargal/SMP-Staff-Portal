import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Download, Printer, FileUp } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { useRole } from '@/hooks/useRole';
import { StaffFilters, type StaffFiltersState } from '@/components/staff/StaffFilters';
import { StaffTable } from '@/components/staff/StaffTable';
import { ImportModal } from '@/components/staff/ImportModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { deleteStaff } from '@/firebase/firestore';
import { exportStaffToExcel } from '@/utils/exportUtils';
import type { StaffRecord } from '@/types';

const PAGE_SIZE = 25;

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
  });
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<StaffRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const [theadTop, setTheadTop] = useState(0);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTheadTop(el.offsetHeight));
    ro.observe(el);
    setTheadTop(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toUpperCase();
    return staff
      .filter((s) => {
        if (q && !s.name.includes(q) && !s.empId.includes(q)) return false;
        if (filters.dept && s.dept !== filters.dept) return false;
        if (filters.type && s.type !== filters.type) return false;
        if (filters.status && s.status !== filters.status) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [staff, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
    <div className="flex flex-col gap-4">
      {/* Sticky toolbar + count */}
      <div
        ref={toolbarRef}
        className="sticky top-0 bg-white z-20 -mx-6 px-6 pb-3 border-b border-[#E2E5EA] no-print"
      >
        <div className="flex items-center justify-between gap-4 flex-wrap pt-6">
          <StaffFilters
            filters={filters}
            onChange={(f) => { setFilters(f); setPage(1); }}
          />
          <div className="flex gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => exportStaffToExcel(filtered)}>
              <Download className="w-3.5 h-3.5" />
              Excel
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              Print
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
        <p className="text-xs text-[#6B7280] mt-2">
          Showing {paginated.length} of {filtered.length} records
        </p>
      </div>

      {/* Table */}
      <StaffTable
        staff={paginated}
        loading={loading}
        isAdmin={isAdmin}
        onDelete={(s) => setDeleteTarget(s)}
        startIndex={(page - 1) * PAGE_SIZE + 1}
        theadTop={theadTop}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 no-print">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-[#6B7280]">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

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
