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
      className="no-print fixed top-0 right-0 flex items-center px-6 bg-white/90 border-b border-[#E2E5EA] z-20"
      style={{
        left: sidebarWidth,
        height: 56,
        backdropFilter: 'blur(12px)',
        transition: 'left 220ms cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 1px 0 0 #E2E5EA, 0 2px 8px rgba(27,58,107,0.04)',
        animation: 'fade-in 0.18s ease-out',
      }}
    >
      {/* Offline stripe */}
      {offline && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#E8A020]" />
      )}

      <h1 className="text-[15px] font-semibold text-[#111827] flex-1 tracking-tight">
        {getTitle(pathname)}
      </h1>

      {offline && (
        <div className="flex items-center gap-1.5 text-[11px] text-[#E8A020] mr-4 font-semibold">
          <WifiOff className="w-3.5 h-3.5" />
          Offline
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-[#111827] leading-tight">{user?.email ?? '—'}</p>
          <p className="text-[10px] text-[#6B7280] uppercase tracking-widest leading-tight">{role ?? 'viewer'}</p>
        </div>

        <div
          className="w-8 h-8 rounded-full bg-[#1B3A6B] flex items-center justify-center ring-2 ring-[#E8A020]/30"
          style={{ boxShadow: '0 2px 8px rgba(27,58,107,0.25)' }}
        >
          <span className="text-white text-xs font-bold">
            {user?.email?.charAt(0).toUpperCase() ?? '?'}
          </span>
        </div>

        <button
          onClick={() => { void handleSignOut(); }}
          className="p-1.5 rounded-md text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors duration-150"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
