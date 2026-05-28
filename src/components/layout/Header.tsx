import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, WifiOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/firebase/auth';
import { useToast } from '@/components/ui/Toast';

interface HeaderProps {
  sidebarWidth: number;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/staff':      'Staff List',
  '/staff/new':  'Add New Staff',
  '/salary':     'Salary Bill',
  '/reports':    'Reports',
  '/settings':   'Settings',
};

function getTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.match(/\/staff\/[^/]+\/edit/)) return 'Edit Staff';
  if (pathname.match(/\/staff\/[^/]+/))       return 'Staff Profile';
  return 'SMP Staff Portal';
}

export function Header({ sidebarWidth }: HeaderProps) {
  const { pathname } = useLocation();
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const handleSignOut = async () => {
    try { await signOut(); }
    catch { showToast('error', 'Failed to sign out'); }
  };

  return (
    <header
      className="no-print fixed top-0 right-0 flex items-center px-6 z-20"
      style={{
        left: sidebarWidth,
        height: 56,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #BAE6FD',
        transition: 'left 220ms cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 1px 8px 0 rgba(14,165,233,0.07)',
        animation: 'fade-in 0.18s ease-out',
      }}
    >
      {offline && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-400" />
      )}

      <h1 className="text-[15px] font-semibold text-gray-900 flex-1 tracking-tight">
        {getTitle(pathname)}
      </h1>

      {offline && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-500 mr-4 font-semibold">
          <WifiOff className="w-3.5 h-3.5" />
          Offline
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-gray-800 leading-tight">{user?.email ?? '—'}</p>
          <p className="text-[10px] text-sky-500 uppercase tracking-widest leading-tight font-semibold">{role ?? 'viewer'}</p>
        </div>

        <div
          className="w-8 h-8 rounded-full flex items-center justify-center ring-2 ring-sky-200"
          style={{ background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }}
        >
          <span className="text-white text-xs font-bold">
            {user?.email?.charAt(0).toUpperCase() ?? '?'}
          </span>
        </div>

        <button
          onClick={() => { void handleSignOut(); }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-150"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
