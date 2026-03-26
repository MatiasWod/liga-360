import React from 'react';
import { Card } from '../../components/ui/Card';
import type { LinkedTeam, TeamParticipant } from '../../types/domain';

interface ParticipantHomePageProps {
  linkedTeams: LinkedTeam[];
  linkedParticipants: TeamParticipant[];
  teamTournamentsCount: number;
  individualTournamentsCount: number;
}

export const ParticipantHomePage: React.FC<ParticipantHomePageProps> = ({
  linkedTeams,
  linkedParticipants,
  teamTournamentsCount,
  individualTournamentsCount,
}) => {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
      <Card>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Equipos vinculados</h2>
        <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{linkedTeams.length}</p>
      </Card>
      <Card>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Perfiles de jugador</h2>
        <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{linkedParticipants.length}</p>
      </Card>
      <Card>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Torneos por equipo</h2>
        <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{teamTournamentsCount}</p>
      </Card>
      <Card>
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">Torneos individuales</h2>
        <p className="mt-2 text-2xl font-semibold text-[#0F2A33]">{individualTournamentsCount}</p>
      </Card>
    </div>
  );
};

