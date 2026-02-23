import React from 'react';
import type { AppUser } from '../../types/domain';
import { Avatar } from '../ui/Avatar';

interface HeaderBarProps {
  activeTeamName?: string;
  showActiveTeam?: boolean;
  user: AppUser;
  onLogout: () => void;
  onOpenProfile: () => void;
}

const LogoMark: React.FC = () => (
  <svg viewBox="0 0 120 32" className="h-8 w-auto" role="img" aria-label="LIGA360">
    <rect x="1" y="1" width="30" height="30" rx="8" fill="#2E7D32" />
    <path d="M11 9h4v14h8v3H11z" fill="white" />
    <text x="40" y="22" fill="white" fontSize="16" fontWeight="700" fontFamily="Inter, sans-serif">
      LIGA360
    </text>
  </svg>
);

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTeamName,
  showActiveTeam = true,
  user,
  onLogout,
  onOpenProfile,
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-[#0F2A33] px-6">
      <div className="flex items-center gap-4">
        <LogoMark />
        {showActiveTeam && (
          <div className="hidden text-sm text-slate-300 lg:block">
            Equipo activo: <span className="font-semibold text-white">{activeTeamName || 'Sin equipo'}</span>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-[#153743] px-3 py-1.5 text-sm text-white hover:bg-[#1a3f4c]"
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
    </header>
  );
};

