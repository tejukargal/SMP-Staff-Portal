import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, CalendarDays, ShieldCheck, Settings, ChevronLeft, ClipboardList } from 'lucide-react';
import { useRole } from '@/hooks/useRole';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV = [
  { to: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/staff',         label: 'Staff',         icon: Users },
  { to: '/reports',       label: 'Reports',       icon: FileText },
  { to: '/leave-records', label: 'Leave Records', icon: CalendarDays },
  { to: '/lic-policies',      label: 'LIC Policies',     icon: ShieldCheck },
  { to: '/vacancy-register',  label: 'Vacancy Register', icon: ClipboardList, adminOnly: true },
  { to: '/settings',          label: 'Settings',         icon: Settings, adminOnly: true },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { isAdmin } = useRole();
  const [logoHovered, setLogoHovered] = useState(false);

  function navClass(isActive: boolean) {
    const base = 'relative group flex items-center rounded-xl text-[13px] font-medium transition-all duration-150 overflow-hidden';
    const layout = collapsed ? 'justify-center px-0 py-2.5 w-10 mx-auto' : 'gap-2.5 px-3 py-2 w-full';
    const color = isActive
      ? 'bg-sky-500 text-white shadow-sm'
      : 'text-gray-500 hover:bg-sky-50 hover:text-sky-800';
    return `${base} ${layout} ${color}`;
  }

  function iconClass(isActive: boolean) {
    return `shrink-0 w-4 h-4 transition-colors ${
      isActive ? 'text-white' : 'text-gray-400 group-hover:text-sky-600'
    }`;
  }

  return (
    <aside
      className="no-print sidebar fixed left-0 top-0 bottom-0 flex flex-col z-30"
      style={{
        width: collapsed ? 64 : 240,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid #BAE6FD',
        boxShadow: '1px 0 12px 0 rgba(14,165,233,0.07)',
      }}
    >
      {/* Brand */}
      <button
        onClick={onToggle}
        onMouseEnter={() => setLogoHovered(true)}
        onMouseLeave={() => setLogoHovered(false)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`group flex items-center w-full cursor-pointer hover:bg-sky-50/50 transition-colors pt-5 pb-3 ${
          collapsed ? 'justify-center px-0' : 'px-4 justify-between gap-3'
        }`}
      >
        {/* Flip-card logo — front: SMP text, back: expand chevron */}
        <div className="relative w-9 h-9 shrink-0" style={{ perspective: '280px' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transformStyle: 'preserve-3d',
              transition: 'transform 380ms cubic-bezier(0.4, 0, 0.2, 1)',
              transform: collapsed && logoHovered ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front face: SMP text */}
            <div
              className="absolute inset-0 rounded-xl flex items-center justify-center shadow-md"
              style={{
                background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <span className="text-white font-bold text-sm" style={{ fontFamily: "'DM Serif Display', serif" }}>
                SMP
              </span>
            </div>
            {/* Back face: expand arrow */}
            <div
              className="absolute inset-0 rounded-xl flex items-center justify-center shadow-md"
              style={{
                background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Wordmark — expanded only */}
        {!collapsed && (
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-bold text-gray-900 leading-tight tracking-tight">Sanjay Memorial</p>
            <p className="text-[10px] font-semibold text-sky-500 leading-tight tracking-wider uppercase">Staff Portal</p>
          </div>
        )}

        {/* Collapse arrow — expanded only */}
        {!collapsed && (
          <span className="flex items-center justify-center text-gray-400 group-hover:text-sky-600 transition-colors shrink-0">
            <ChevronLeft className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* Divider */}
      <div className="mx-3 h-px bg-sky-100 mb-2" />

      {/* Navigation */}
      <nav className="flex-1 px-2 pb-2 space-y-0.5 overflow-y-auto no-scrollbar">
        {NAV.map(({ to, label, icon: Icon, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) => navClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <Icon className={iconClass(isActive)} />
                  {!collapsed && (
                    <>
                      <span className="sidebar-content-label flex-1 truncate">{label}</span>
                      {isActive && (
                        <span className="w-1 h-4 rounded-full bg-sky-300 glow-sky" />
                      )}
                    </>
                  )}
                  {collapsed && isActive && (
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-sky-300 glow-sky" />
                  )}
                  {collapsed && (
                    <span
                      className="absolute left-full ml-3 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-900 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50"
                      style={{ transition: 'opacity 120ms ease', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                    >
                      {label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
