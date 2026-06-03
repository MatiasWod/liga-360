import React from 'react';
import type { TeamParticipant } from '../../types/domain';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface LinkedParticipantsSectionProps {
  participants: TeamParticipant[];
  onUnlink: (participantId: string) => Promise<void>;
}

export const LinkedParticipantsSection: React.FC<LinkedParticipantsSectionProps> = ({ participants, onUnlink }) => {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Participantes vinculados</h2>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {participants.map((participant) => (
          <article key={participant.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar
                  name={`${participant.firstName} ${participant.lastName}`}
                  imageUrl={participant.avatarUrl}
                  size="sm"
                />
                <div>
                  <h3 className="font-medium text-slate-800">
                    {participant.firstName} {participant.lastName}
                  </h3>
                  <p className="text-xs text-slate-500">DNI: {participant.dni || 'Sin DNI'}</p>
                </div>
              </div>
              <Button variant="destructive" onClick={() => onUnlink(participant.id)}>
                No soy yo
              </Button>
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
};

