import React from 'react';
import type { AppUser, NavItem, NavItemId } from '../../types/domain';
import { HeaderBar } from './HeaderBar';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  user: AppUser;
  activeTeamName?: string;
  showActiveTeam?: boolean;
  activeNav: NavItemId;
  navItems: NavItem[];
  onNavigate: (item: NavItemId) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  user,
  activeTeamName,
  showActiveTeam = true,
  activeNav,
  navItems,
  onNavigate,
  onLogout,
  children,
}) => {
  return (
    <div className="min-h-screen bg-[#F5F7F9] text-[#0F2A33]">
      <HeaderBar
        activeTeamName={activeTeamName}
        showActiveTeam={showActiveTeam}
        user={user}
        onLogout={onLogout}
        onOpenProfile={() => onNavigate('perfil')}
      />
      <div className="flex min-h-[calc(100vh-4rem)] items-stretch">
        <Sidebar active={activeNav} onNavigate={onNavigate} items={navItems} />
        <main className="w-full p-6">{children}</main>
      </div>
      <div className="sticky bottom-0 z-40 mt-6 border-t border-slate-200 bg-white lg:hidden">
        <nav className={`grid`} style={{ gridTemplateColumns: `repeat(${Math.max(navItems.length, 1)}, minmax(0, 1fr))` }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`px-2 py-3 text-xs font-medium ${
                activeNav === item.id ? 'text-[#2E7D32]' : 'text-slate-500'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
};

