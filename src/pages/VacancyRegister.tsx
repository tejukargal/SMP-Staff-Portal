import { useState, useEffect, useCallback } from 'react';
import { Settings2, PlusCircle, CheckCircle2, Pencil, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useRole } from '@/hooks/useRole';
import {
  getSanctionedPosts,
  getVacancyEvents,
  getAllStaff,
  deleteVacancyEvent,
  confirmVacancyEvent,
} from '@/firebase/firestore';
import { SanctionedPostsModal } from '@/components/vacancy/SanctionedPostsModal';
import { VacancyEventModal } from '@/components/vacancy/VacancyEventModal';
import { DEPARTMENTS, DEPT_COLORS, VACANCY_REASON_LABELS, APPOINTMENT_TYPE_LABELS } from '@/constants/enums';
import type { SanctionedPost, VacancyEvent } from '@/types';

type DeptKey = typeof DEPARTMENTS[number];

interface DeptStats {
  sanctioned: number;
  filled: number;
  vacant: number;
}

const STATUS_CHIP: Record<'VACANT' | 'FILLED', { bg: string; text: string; label: string }> = {
  VACANT: { bg: 'bg-red-50',    text: 'text-red-700',   label: 'Vacant' },
  FILLED: { bg: 'bg-green-50',  text: 'text-green-700', label: 'Filled' },
};

export default function VacancyRegister() {
  const { isAdmin } = useRole();
  const { showToast } = useToast();

  const [activeDept, setActiveDept] = useState<DeptKey>('OFFICE');
  const [sanctionedPosts, setSanctionedPosts] = useState<SanctionedPost[]>([]);
  const [events, setEvents] = useState<VacancyEvent[]>([]);
  const [inServiceCounts, setInServiceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [showSanctioned, setShowSanctioned] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [fillEvent, setFillEvent] = useState<VacancyEvent | null>(null);
  const [editEvent, setEditEvent] = useState<VacancyEvent | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [posts, allEvents, allStaff] = await Promise.all([
        getSanctionedPosts(),
        getVacancyEvents(),
        getAllStaff(),
      ]);
      setSanctionedPosts(posts);
      setEvents(allEvents);

      // Count IN SERVICE staff per dept+designation
      const counts: Record<string, number> = {};
      allStaff
        .filter((s) => s.status === 'IN SERVICE')
        .forEach((s) => {
          const key = `${s.dept}_${s.designation}`;
          counts[key] = (counts[key] ?? 0) + 1;
        });
      setInServiceCounts(counts);
    } catch {
      showToast('error', 'Failed to load vacancy data');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Dept-level stats (sanctioned across all designations in dept)
  function getDeptStats(dept: DeptKey): DeptStats {
    const sanctioned = sanctionedPosts
      .filter((p) => p.dept === dept)
      .reduce((sum, p) => sum + p.sanctionedCount, 0);
    const filled = Object.entries(inServiceCounts)
      .filter(([key]) => key.startsWith(`${dept}_`))
      .reduce((sum, [, cnt]) => sum + cnt, 0);
    return { sanctioned, filled, vacant: Math.max(0, sanctioned - filled) };
  }

  const deptEvents = events.filter((e) => e.dept === activeDept);
  const stats = getDeptStats(activeDept);

  const handleConfirm = async (event: VacancyEvent) => {
    try {
      await confirmVacancyEvent(event.id!);
      showToast('success', 'Vacancy confirmed');
      void fetchAll();
    } catch {
      showToast('error', 'Failed to confirm vacancy');
    }
  };

  const handleDelete = async (event: VacancyEvent) => {
    if (!confirm(`Delete this vacancy entry for ${event.designation}?`)) return;
    try {
      await deleteVacancyEvent(event.id!);
      showToast('success', 'Entry deleted');
      void fetchAll();
    } catch {
      showToast('error', 'Failed to delete entry');
    }
  };

  const onModalSaved = () => {
    setShowSanctioned(false);
    setAddModal(false);
    setFillEvent(null);
    setEditEvent(null);
    void fetchAll();
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'DM Serif Display', serif" }}>
          Vacancy Register
        </h1>
      </div>

      {/* Dept tabs */}
      <div className="flex gap-1 flex-wrap">
        {DEPARTMENTS.map((dept) => {
          const s = getDeptStats(dept as DeptKey);
          const isActive = activeDept === dept;
          const color = DEPT_COLORS[dept as DeptKey];
          return (
            <button
              key={dept}
              onClick={() => setActiveDept(dept as DeptKey)}
              className={[
                'px-4 py-2 rounded-xl text-sm font-semibold transition-all border',
                isActive
                  ? 'text-white shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
              ].join(' ')}
              style={isActive ? { background: color, borderColor: color } : {}}
            >
              {dept}
              {s.vacant > 0 && (
                <span
                  className={[
                    'ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700',
                  ].join(' ')}
                >
                  {s.vacant}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active dept panel */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">

        {/* Summary + actions bar */}
        <div className="flex flex-wrap items-center gap-4 px-5 py-4 border-b border-gray-100">
          {/* Stats */}
          <div className="flex gap-6">
            <StatPill label="Sanctioned" value={stats.sanctioned} color="sky" />
            <StatPill label="Filled"     value={stats.filled}     color="green" />
            <StatPill label="Vacant"     value={stats.vacant}     color="red" />
          </div>

          <div className="ml-auto flex gap-2">
            {isAdmin && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setShowSanctioned(true)}>
                  <Settings2 className="w-3.5 h-3.5" />
                  Edit Sanctioned
                </Button>
                <Button size="sm" onClick={() => setAddModal(true)}>
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Vacancy
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Designation-wise breakdown */}
        <DesignationSummary
          dept={activeDept}
          sanctionedPosts={sanctionedPosts}
          inServiceCounts={inServiceCounts}
        />

        {/* Events table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Loading...</div>
          ) : deptEvents.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              No vacancy entries for {activeDept}.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Designation</th>
                  <th className="px-4 py-3 text-left">Vacated By</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Appointment</th>
                  <th className="px-4 py-3 text-left">Filled By</th>
                  <th className="px-4 py-3 text-left">Date Filled</th>
                  {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deptEvents
                  .slice()
                  .sort((a, b) => {
                    // pending first, then vacant, then filled
                    if (a.isPending !== b.isPending) return a.isPending ? -1 : 1;
                    if (a.status !== b.status) return a.status === 'VACANT' ? -1 : 1;
                    return 0;
                  })
                  .map((ev) => {
                    const chip = STATUS_CHIP[ev.status];
                    const isFaded = ev.status === 'FILLED';
                    return (
                      <tr
                        key={ev.id}
                        className={[
                          'transition-colors hover:bg-gray-50/60',
                          isFaded ? 'opacity-60' : '',
                        ].join(' ')}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{ev.designation}</td>
                        <td className="px-4 py-3 text-gray-600">{ev.vacatedByStaffName || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {VACANCY_REASON_LABELS[ev.vacancyReason] ?? ev.vacancyReason}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${chip.bg} ${chip.text}`}>
                              {chip.label}
                            </span>
                            {ev.isPending && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {ev.appointmentType
                            ? APPOINTMENT_TYPE_LABELS[ev.appointmentType]
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{ev.filledByStaffName || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {ev.dateFilledOn
                            ? new Date(ev.dateFilledOn).toLocaleDateString('en-IN')
                            : '—'}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {ev.isPending && (
                                <button
                                  title="Confirm vacancy"
                                  onClick={() => void handleConfirm(ev)}
                                  className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              {ev.status === 'VACANT' && !ev.isPending && (
                                <button
                                  title="Fill this post"
                                  onClick={() => setFillEvent(ev)}
                                  className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors text-xs font-semibold"
                                >
                                  Fill
                                </button>
                              )}
                              {ev.status === 'VACANT' && (
                                <button
                                  title="Edit vacancy"
                                  onClick={() => setEditEvent(ev)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                title="Delete entry"
                                onClick={() => void handleDelete(ev)}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {showSanctioned && (
        <SanctionedPostsModal dept={activeDept} onClose={() => setShowSanctioned(false)} onSaved={onModalSaved} />
      )}
      {addModal && (
        <VacancyEventModal dept={activeDept} mode="add" onClose={() => setAddModal(false)} onSaved={onModalSaved} />
      )}
      {fillEvent && (
        <VacancyEventModal dept={activeDept} mode="fill" event={fillEvent} onClose={() => setFillEvent(null)} onSaved={onModalSaved} />
      )}
      {editEvent && (
        <VacancyEventModal dept={activeDept} mode="edit" event={editEvent} onClose={() => setEditEvent(null)} onSaved={onModalSaved} />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: 'sky' | 'green' | 'red' }) {
  const styles = {
    sky:   { num: 'text-sky-700',   bg: 'bg-sky-50',   lbl: 'text-sky-500' },
    green: { num: 'text-green-700', bg: 'bg-green-50', lbl: 'text-green-500' },
    red:   { num: 'text-red-700',   bg: 'bg-red-50',   lbl: 'text-red-500' },
  }[color];
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${styles.bg}`}>
      <span className={`text-xl font-bold ${styles.num}`}>{value}</span>
      <span className={`text-xs font-medium ${styles.lbl}`}>{label}</span>
    </div>
  );
}

function DesignationSummary({
  dept,
  sanctionedPosts,
  inServiceCounts,
}: {
  dept: string;
  sanctionedPosts: SanctionedPost[];
  inServiceCounts: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);

  const rows = sanctionedPosts
    .filter((p) => p.dept === dept && p.sanctionedCount > 0)
    .map((p) => {
      const filled = inServiceCounts[`${dept}_${p.designation}`] ?? 0;
      return { designation: p.designation, sanctioned: p.sanctionedCount, filled, vacant: Math.max(0, p.sanctionedCount - filled) };
    });

  if (rows.length === 0) return null;

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50 transition-colors"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        Designation Breakdown
      </button>
      {open && (
        <div className="px-5 pb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="py-1.5 text-left font-medium">Designation</th>
                <th className="py-1.5 text-center font-medium">Sanctioned</th>
                <th className="py-1.5 text-center font-medium">Filled</th>
                <th className="py-1.5 text-center font-medium">Vacant</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.designation} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5 text-gray-700 font-medium">{r.designation}</td>
                  <td className="py-1.5 text-center text-gray-600">{r.sanctioned}</td>
                  <td className="py-1.5 text-center text-green-700 font-semibold">{r.filled}</td>
                  <td className="py-1.5 text-center">
                    {r.vacant > 0
                      ? <span className="text-red-600 font-bold">{r.vacant}</span>
                      : <span className="text-gray-400">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
