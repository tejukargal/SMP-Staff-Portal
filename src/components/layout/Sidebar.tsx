import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, FileText, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRole } from '@/hooks/useRole';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/staff',     label: 'Staff',     icon: Users },
  { to: '/salary',    label: 'Salary Bill', icon: DollarSign },
  { to: '/reports',   label: 'Reports',   icon: FileText },
  { to: '/settings',  label: 'Settings',  icon: Settings, adminOnly: true },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { isAdmin } = useRole();
  const w = collapsed ? 64 : 240;

  return (
    <aside
      className="no-print sidebar fixed left-0 top-0 bottom-0 flex flex-col z-30 overflow-hidden"
      style={{
        width: w,
        backgroundColor: 'var(--color-sidebar-bg)',
        boxShadow: '2px 0 16px 0 rgba(27,58,107,0.18)',
      }}
    >
      {/* Logo + toggle in one row */}
      <div
        className="flex items-center border-b border-white/10 px-3 gap-2"
        style={{ height: 56 }}
      >
        <div
          className="w-9 h-9 rounded-lg bg-[#E8A020] flex items-center justify-center shrink-0"
          style={{ boxShadow: '0 2px 8px rgba(232,160,32,0.4)' }}
        >
          <span className="text-white font-bold text-sm" style={{ fontFamily: "'DM Serif Display', serif" }}>
            SMP
          </span>
        </div>

        {!collapsed && (
          <div className="sidebar-content-label flex-1 min-w-0">
            <div className="text-white text-xs font-semibold leading-tight truncate">Sanjay Memorial</div>
            <div className="text-[#94A3B8] text-[10px] leading-tight">Staff Portal</div>
          </div>
        )}

        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-white hover:bg-white/15 transition-all duration-150"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto no-scrollbar px-2">
        {NAV.map(({ to, label, icon: Icon, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                [
                  'flex items-center rounded-lg text-sm font-medium transition-all duration-150 relative group',
                  collapsed ? 'justify-center px-0 py-2.5 mx-0' : 'gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-[#CBD5E1] hover:bg-white/10 hover:text-white',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-4 h-4 shrink-0" />

                  {!collapsed && (
                    <>
                      <span className="sidebar-content-label flex-1">{label}</span>
                      {isActive && (
                        <span className="w-1 h-4 rounded-full bg-[#E8A020] glow-amber" />
                      )}
                    </>
                  )}

                  {/* Collapsed active dot */}
                  {collapsed && isActive && (
                    <span
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-[#E8A020] glow-amber"
                    />
                  )}

                  {/* Tooltip when collapsed */}
                  {collapsed && (
                    <span
                      className="absolute left-full ml-3 px-2.5 py-1 rounded-md text-xs font-medium bg-[#1B3A6B] text-white border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50"
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
