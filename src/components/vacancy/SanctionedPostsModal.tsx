import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { getSanctionedPosts, upsertSanctionedPost } from '@/firebase/firestore';
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
    setLoading(true);
    getSanctionedPosts()
      .then((posts: SanctionedPost[]) => {
        const map: Record<string, number> = {};
        posts.filter((p) => p.dept === dept).forEach((p) => {
          map[p.designation] = p.sanctionedCount;
        });
        setCounts(map);
      })
      .finally(() => setLoading(false));
  }, [dept]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = DESIGNATIONS.map((d) => {
        const count = counts[d] ?? 0;
        if (count > 0) return upsertSanctionedPost(dept, d, count);
        return Promise.resolve();
      });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h3 className="text-base font-semibold text-gray-900">
            Sanctioned Posts — {dept}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
          ) : (
            <div className="space-y-2">
              {DESIGNATIONS.map((d) => (
                <div key={d} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700 flex-1">{d}</span>
                  <input
                    type="number"
                    min={0}
                    value={counts[d] ?? 0}
                    onChange={(e) =>
                      setCounts((prev) => ({ ...prev, [d]: Math.max(0, parseInt(e.target.value) || 0) }))
                    }
                    className="w-16 text-center text-sm px-2 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={saving} onClick={() => { void handleSave(); }}>
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
