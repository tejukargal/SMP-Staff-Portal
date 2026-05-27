import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { auth, onAuthStateChanged } from '@/firebase/auth';
import { getUserById } from '@/firebase/firestore';
import type { UserRole } from '@/types';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, role: null, loading: false });
        return;
      }
      try {
        const record = await getUserById(user.uid);
        setState({ user, role: record?.role ?? null, loading: false });
      } catch {
        setState({ user, role: null, loading: false });
      }
    });
    return unsub;
  }, []);

  return state;
}
