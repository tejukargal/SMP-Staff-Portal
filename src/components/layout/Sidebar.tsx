import type React from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, CalendarDays, ShieldCheck, Settings, ChevronLeft, ClipboardList, ReceiptText } from 'lucide-react';
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
  { to: '/salary-records',    label: 'Salary Records',   icon: ReceiptText,   adminOnly: true },
  { to: '/vacancy-register',  label: 'Vacancy Register', icon: ClipboardList, adminOnly: true },
  { to: '/settings',          label: 'Settings',         icon: Settings, adminOnly: true },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { isAdmin } = useRole();
  const [logoHovered, setLogoHovered] = useState(false);

  // Fades + collapses text width in sync with sidebar animation
  const textStyle = (extraDelay = 0): React.CSSProperties => ({
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    maxWidth: collapsed ? 0 : '120px',
    opacity: collapsed ? 0 : 1,
    transition: collapsed
      ? `opacity 100ms ease, max-width 220ms cubic-bezier(0.4,0,0.2,1) ${extraDelay}ms`
      : `max-width 220ms cubic-bezier(0.4,0,0.2,1) ${extraDelay}ms, opacity 180ms ease ${extraDelay + 60}ms`,
  });

  // paddingLeft transitions: 16px (icon centered in 64px sidebar) → 12px (left-aligned when expanded)
  const navItemStyle: React.CSSProperties = {
    paddingLeft: collapsed ? 16 : 12,
    transition: 'padding-left 220ms cubic-bezier(0.4, 0, 0.2, 1)',
  };

  function navClass(isActive: boolean) {
    const base = 'group flex items-center gap-2.5 pr-3 py-2 w-full rounded-xl text-[13px] font-medium transition-colors duration-150';
    const color = isActive
      ? 'bg-sky-500 text-white shadow-sm'
      : 'text-gray-500 hover:bg-sky-50 hover:text-sky-800';
    return `${base} ${color}`;
  }

  function iconClass(isActive: boolean) {
    return `shrink-0 w-4 h-4 transition-colors ${
      isActive ? 'text-white' : 'text-gray-400 group-hover:text-sky-600'
    }`;
  }

  return (
    <aside
      className="no-print sidebar fixed left-0 top-0 bottom-0 flex flex-col z-30 overflow-hidden"
      style={{
        width: collapsed ? 64 : 200,
        transition: 'width 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid #BAE6FD',
        boxShadow: '1px 0 12px 0 rgba(14,165,233,0.07)',
      }}
    >
      {/* Brand — height matches the app header so their bottom borders form one line */}
      <button
        onClick={onToggle}
        onMouseEnter={() => setLogoHovered(true)}
        onMouseLeave={() => setLogoHovered(false)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="group flex items-center gap-2 w-full cursor-pointer hover:bg-sky-50/50 transition-colors px-4 shrink-0"
        style={{ height: 56, borderBottom: '1px solid #BAE6FD' }}
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

        {/* Wordmark — opacity only; width follows the sidebar's own transition naturally */}
        <div
          className="overflow-hidden"
          style={{
            opacity: collapsed ? 0 : 1,
            transition: collapsed ? 'opacity 100ms ease' : 'opacity 180ms ease 60ms',
          }}
        >
          <p style={{ whiteSpace: 'nowrap' }} className="text-base font-bold text-sky-600 leading-tight tracking-tight">Staff Portal</p>
        </div>

        {/* Collapse arrow — fades with sidebar */}
        <span
          className="flex items-center justify-center text-gray-400 group-hover:text-sky-600 transition-colors shrink-0 ml-auto"
          style={textStyle()}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </span>
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden no-scrollbar">
        {NAV.map(({ to, label, icon: Icon, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              style={navItemStyle}
              className={({ isActive }) => navClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <Icon className={iconClass(isActive)} />
                  <span style={textStyle()} className="truncate sidebar-content-label">{label}</span>
                  {isActive && (
                    <span
                      className="w-1 h-4 rounded-full bg-sky-300 glow-sky shrink-0"
                      style={{
                        opacity: collapsed ? 0 : 1,
                        transition: 'opacity 150ms ease',
                      }}
                    />
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
