import React from 'react';
import { Card } from '../components/ui/Card';
import type { TeamInfo, TeamParticipant } from '../types/domain';

interface TeamHomePageProps {
  team: TeamInfo | null;
  participants: TeamParticipant[];
  tournamentsCount: number;
}

export const TeamHomePage: React.FC<TeamHomePageProps> = ({
  team,
  participants,
  tournamentsCount,
}) => {
  return (
    <div className="space-y-4">
      {!team && (
        <Card>
          <h1 className="text-2xl font-semibold text-[#0F2A33]">Dashboard de equipo</h1>
          <p className="mt-2 text-sm text-slate-600">
            Todavia no hay un equipo activo. Este panel muestra resumen de plantilla y torneos cuando exista uno.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Equipo activo</h2>
          <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{team?.name || 'Sin equipo'}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Integrantes</h2>
          <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{participants.length}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Torneos vinculados</h2>
          <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{tournamentsCount}</p>
        </Card>
      </div>
    </div>
  );
};

