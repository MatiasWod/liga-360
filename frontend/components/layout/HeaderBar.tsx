import React from 'react';
import type { AppUser, NavItem, NavItemId } from '../../types/domain';
import { Avatar } from '../ui/Avatar';

interface HeaderBarProps {
  activeTeamName?: string;
  showActiveTeam?: boolean;
  activeNav: NavItemId;
  navItems: NavItem[];
  onNavigate: (item: NavItemId) => void;
  user: AppUser;
  onLogout: () => void;
  onOpenProfile: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeNav,
  navItems,
  onNavigate,
  user,
  onLogout,
  onOpenProfile,
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="border-b border-border-subtle bg-surface-1 px-6">
      <div className="grid h-16 w-full grid-cols-[240px_minmax(0,1fr)_240px] items-center gap-4">
        <div className="flex items-center gap-3">
          <img src="/logoTransparent.png" alt="LIGA360" className="h-10 w-auto" />
          <span className="text-xl font-semibold tracking-wide text-text-primary">LIGA360</span>
        </div>

        <nav className="min-w-0 flex items-center justify-center gap-2 overflow-x-auto whitespace-nowrap">
          {navItems.map((item) => {
            const selected = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 ${
                  selected
                    ? 'bg-accent-primary text-white shadow-sm shadow-black/30'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text-primary'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="relative justify-self-end">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-2 px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
          >
            <Avatar name={user.fullName} imageUrl={user.avatarUrl} size="sm" />
            <span className="hidden lg:block">{user.fullName}</span>
          </button>
          {open && (
            <div className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-border-subtle bg-surface-1 p-2 shadow-xl shadow-black/40">
              <button
                type="button"
                onClick={() => {
                  onOpenProfile();
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-2"
              >
                Mi perfil
              </button>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-2"
              >
                Configuracion
              </button>
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-danger-base transition-colors hover:bg-danger-soft"
              >
                Cerrar sesion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
