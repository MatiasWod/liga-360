import React from 'react';
import type { AppUser, NavItem, NavItemId } from '../../types/domain';
import { HeaderBar } from './HeaderBar';

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
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <HeaderBar
        activeTeamName={activeTeamName}
        showActiveTeam={showActiveTeam}
        activeNav={activeNav}
        navItems={navItems}
        onNavigate={onNavigate}
        user={user}
        onLogout={onLogout}
        onOpenProfile={() => onNavigate('perfil')}
      />
      <main className="mx-auto w-full max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
};
