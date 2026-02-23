import React from 'react';
import type { LinkedTeam } from '../../types/domain';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface LinkedTeamsSectionProps {
  teams: LinkedTeam[];
}

export const LinkedTeamsSection: React.FC<LinkedTeamsSectionProps> = ({ teams }) => {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Equipos vinculados</h2>
      <div className="space-y-3">
        {teams.map((team) => (
          <article key={team.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3">
              <Avatar name={team.name} imageUrl={team.badgeUrl} size="sm" />
              <div>
                <h3 className="font-medium text-slate-800">{team.name}</h3>
                <p className="text-xs text-slate-500">ID: {team.id}</p>
              </div>
            </div>
            <Badge>{team.roleLabel}</Badge>
          </article>
        ))}
      </div>
    </Card>
  );
};

