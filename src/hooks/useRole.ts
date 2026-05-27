import { useAuth } from './useAuth';

export function useRole() {
  const { role, loading } = useAuth();
  return { isAdmin: role === 'admin', isViewer: role === 'viewer', loading };
}
