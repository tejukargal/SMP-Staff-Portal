import { useState, useEffect, useCallback } from 'react';
import { getAllStaff } from '@/firebase/firestore';
import type { StaffRecord } from '@/types';

interface StaffState {
  staff: StaffRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useStaff(): StaffState {
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllStaff();
      setStaff(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load staff data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  return { staff, loading, error, refetch: fetch };
}
