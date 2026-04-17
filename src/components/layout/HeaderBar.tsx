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
    <header className="border-b border-[#22512D] bg-[#163A20] px-6">
      <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[240px_minmax(0,1fr)_240px] items-center gap-4">
        <div className="flex items-center gap-3">
          <img src="/logoTransparent.png" alt="LIGA360" className="h-10 w-auto" />
          <span className="text-xl font-semibold tracking-wide text-white">LIGA360</span>
        </div>

        <nav className="min-w-0 flex items-center justify-center gap-2 overflow-x-auto whitespace-nowrap">
          {navItems.map((item) => {
            const selected = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-[#66BB6A] text-[#0F2A33]'
                    : 'text-white hover:bg-[#22512D]'
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
            className="flex items-center gap-2 rounded-xl border border-[#66BB6A] bg-[#2E7D32] px-3 py-1.5 text-sm text-white hover:bg-[#256628]"
          >
            <Avatar name={user.fullName} imageUrl={user.avatarUrl} size="sm" />
            <span className="hidden lg:block">{user.fullName}</span>
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-md">
              <button
                type="button"
                onClick={() => {
                  onOpenProfile();
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Mi perfil
              </button>
              <button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                Configuracion
              </button>
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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

