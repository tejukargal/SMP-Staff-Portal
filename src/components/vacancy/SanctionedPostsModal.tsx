import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { getSanctionedPosts, upsertSanctionedPost, deleteSanctionedPost } from '@/firebase/firestore';
import { DESIGNATIONS } from '@/constants/enums';
import type { SanctionedPost } from '@/types';

interface Props {
  dept: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SanctionedPostsModal({ dept, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Clear stale data immediately so the previous dept's values are never
    // visible or accidentally saved while the new dept's fetch is in flight.
    setCounts({});
    setLoading(true);
    getSanctionedPosts()
      .then((posts: SanctionedPost[]) => {
        const map: Record<string, number> = {};
        posts
          .filter((p) => p.dept === dept && p.designation !== 'SEL GR LECT')
          .forEach((p) => { map[p.designation] = p.sanctionedCount; });
        setCounts(map);
      })
      .finally(() => setLoading(false));
  }, [dept]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = [
        // Clean up any legacy SEL GR LECT rows — they fill LECTURER posts, not separate posts
        deleteSanctionedPost(dept, 'SEL GR LECT'),
        ...DESIGNATIONS.filter((d) => d !== 'SEL GR LECT').map((d) => {
          const count = counts[d] ?? 0;
          return count > 0
            ? upsertSanctionedPost(dept, d, count)
            : deleteSanctionedPost(dept, d);
        }),
      ];
      await Promise.all(promises);
      showToast('success', 'Sanctioned posts saved');
      onSaved();
    } catch {
      showToast('error', 'Failed to save sanctioned posts');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ animation: 'backdrop-enter 0.2s ease-out', backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 flex flex-col"
        style={{ animation: 'modal-enter 0.22s cubic-bezier(0.34,1.26,0.64,1)', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              Sanctioned Posts — {dept}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Total: <span className="font-bold text-sky-600">{Object.values(counts).reduce((s, v) => s + v, 0)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — always full height; inputs fade in to avoid resize jitter */}
        <div className="flex-1 overflow-y-auto px-5 py-4 relative min-h-0">
          {/* Full input list — always rendered so height stays stable */}
          <div
            className="space-y-2"
            style={{
              opacity: loading ? 0 : 1,
              transition: 'opacity 0.18s ease',
              pointerEvents: loading ? 'none' : 'auto',
            }}
          >
            {DESIGNATIONS.filter((d) => d !== 'SEL GR LECT').map((d) => (
              <div key={d} className="flex items-center justify-between gap-3">
                <span className="text-base text-gray-700 flex-1">{d}</span>
                <input
                  type="number"
                  min={0}
                  value={counts[d] ?? 0}
                  onChange={(e) =>
                    setCounts((prev) => ({ ...prev, [d]: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  className="w-18 text-center text-base font-medium px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
            ))}
          </div>

          {/* Loading overlay — sits on top while fetching, disappears as inputs fade in */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="inline-block w-5 h-5 rounded-full border-2 border-sky-200 border-t-sky-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} disabled={loading} onClick={() => { void handleSave(); }}>
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
