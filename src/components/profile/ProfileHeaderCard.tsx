import React from 'react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ProfileHeaderCardProps {
  fullName: string;
  dni: string;
  avatarUrl?: string;
  onClaim: () => Promise<void>;
}

export const ProfileHeaderCard: React.FC<ProfileHeaderCardProps> = ({ fullName, dni, avatarUrl, onClaim }) => {
  return (
    <Card className="mb-6">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-4">
          <Avatar name={fullName} imageUrl={avatarUrl} size="xl" />
          <div>
            <h1 className="text-2xl font-semibold">{fullName}</h1>
            <p className="text-sm text-slate-600">DNI: {dni}</p>
          </div>
        </div>
        <Button onClick={onClaim}>Reclamar por DNI</Button>
      </div>
    </Card>
  );
};

