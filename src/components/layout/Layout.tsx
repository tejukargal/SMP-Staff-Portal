import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/hooks/useAuth';
import { PageSpinner } from '@/components/ui/Spinner';

export function PrivateRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

export function AdminRoute() {
  const { user, role, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

const SIDEBAR_W = 200;
const SIDEBAR_W_COLLAPSED = 64;

function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const sw = collapsed ? SIDEBAR_W_COLLAPSED : SIDEBAR_W;
  const { pathname } = useLocation();

  return (
    <div className="h-screen overflow-hidden flex">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className="flex-1 flex flex-col overflow-hidden min-w-0"
        style={{
          marginLeft: sw,
          width: `calc(100vw - ${sw}px)`,
          transition: 'margin-left 220ms cubic-bezier(0.4,0,0.2,1), width 220ms cubic-bezier(0.4,0,0.2,1)',
          ['--sidebar-w' as string]: `${sw}px`,
        }}
      >
        <Header sidebarWidth={sw} />
        <main
          className="flex-1 min-h-0 px-4 py-4 overflow-y-auto"
          style={{ marginTop: 56 }}
        >
          <div
            key={pathname}
            className="h-full flex flex-col"
            style={{ animation: 'page-enter 0.22s ease-out' }}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
