import React from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

interface OrganizerProfilePageProps {
  organizationName: string;
  username: string;
}

export const OrganizerProfilePage: React.FC<OrganizerProfilePageProps> = ({ organizationName, username }) => {
  return (
    <Card>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <Avatar name={organizationName} size="xl" />
        <div>
          <h1 className="text-2xl font-semibold text-[#0F2A33]">{organizationName}</h1>
          <p className="text-sm text-slate-600">Usuario: {username}</p>
          <div className="mt-2">
            <Badge variant="success">Organizacion</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
};

