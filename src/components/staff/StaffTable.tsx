import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { DeptBadge, StatusBadge } from '@/components/ui/Badge';
import { SkeletonRow } from '@/components/ui/Spinner';
import { formatDate } from '@/utils/dateUtils';
import type { StaffRecord } from '@/types';

interface Props {
  staff: StaffRecord[];
  loading: boolean;
  isAdmin: boolean;
  onDelete: (staff: StaffRecord) => void;
  startIndex?: number;
  theadTop?: number;
}

interface ContextMenu {
  x: number;
  y: number;
  record: StaffRecord;
}

export function StaffTable({ staff, loading, isAdmin, onDelete, startIndex = 1, theadTop = 0 }: Props) {
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click, Escape, or scroll
  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [ctx]);

  function openCtx(e: React.MouseEvent, record: StaffRecord) {
    e.preventDefault();
    // Clamp so menu doesn't overflow viewport
    const menuW = 160;
    const menuH = isAdmin ? 114 : 42;
    const x = Math.min(e.clientX, window.innerWidth  - menuW - 8);
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8);
    setCtx({ x, y, record });
  }

  return (
    <>
      <Table>
        <Thead top={theadTop}>
          <tr>
            <Th>Sl</Th>
            <Th>Name</Th>
            <Th>Emp ID</Th>
            <Th>Designation</Th>
            <Th>Type</Th>
            <Th>Dept</Th>
            <Th>Status</Th>
            <Th>DOE</Th>
          </tr>
        </Thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
            : staff.length === 0
            ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-sm text-[#6B7280]">
                  No staff records found
                </td>
              </tr>
            )
            : staff.map((s, i) => (
              <Tr
                key={s.id}
                onContextMenu={(e) => openCtx(e, s)}
                className="cursor-context-menu select-none"
              >
                <Td className="font-mono text-xs text-[#6B7280] w-10">{startIndex + i}</Td>
                <Td><span className="font-medium">{s.name}</span></Td>
                <Td className="font-mono text-xs">{s.empId}</Td>
                <Td className="text-xs">{s.designation}</Td>
                <Td className="text-xs text-[#6B7280]">{s.type}</Td>
                <Td><DeptBadge dept={s.dept} /></Td>
                <Td><StatusBadge status={s.status} /></Td>
                <Td className="text-xs text-[#6B7280]">{formatDate(s.doe)}</Td>
              </Tr>
            ))}
        </tbody>
      </Table>

      {/* Context menu */}
      {ctx && (
        <div
          ref={menuRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-50 min-w-40 rounded-lg border border-[#E2E5EA] bg-white shadow-xl py-1 text-sm"
          style={{ top: ctx.y, left: ctx.x, animation: 'modal-enter 0.12s ease-out' }}
        >
          <button
            onClick={() => { navigate(`/staff/${ctx.record.id}`); setCtx(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[#374151] hover:bg-[#F7F8FA] transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#6B7280]" />
            View
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => { navigate(`/staff/${ctx.record.id}/edit`); setCtx(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[#374151] hover:bg-[#F7F8FA] transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-[#6B7280]" />
                Edit
              </button>
              <div className="my-1 border-t border-[#F3F4F6]" />
              <button
                onClick={() => { onDelete(ctx.record); setCtx(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
