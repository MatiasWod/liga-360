import React from 'react';
import type { TeamInfo } from '../../types/domain';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface TeamHeaderCardProps {
  team: TeamInfo;
  onRotateCode: () => Promise<void>;
  onCopyCode: () => Promise<void>;
  onEditTeam: () => Promise<void>;
}

export const TeamHeaderCard: React.FC<TeamHeaderCardProps> = ({
  team,
  onRotateCode,
  onCopyCode,
  onEditTeam,
}) => {
  return (
    <Card className="mb-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <Avatar name={team.name} imageUrl={team.badgeUrl} size="xl" />
          <div>
            <h1 className="text-2xl font-semibold">{team.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {team.isOwner && <Badge variant="success">Owner</Badge>}
              <Badge variant="success" className="font-mono">
                Codigo: {team.secretCode}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={onEditTeam}>Editar equipo</Button>
          <Button variant="secondary" onClick={onRotateCode}>Rotar codigo</Button>
          <Button onClick={onCopyCode}>Copiar codigo</Button>
        </div>
      </div>
    </Card>
  );
};

