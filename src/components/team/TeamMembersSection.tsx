import React from 'react';
import type { TeamParticipant } from '../../types/domain';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Table } from '../ui/Table';

interface TeamMembersSectionProps {
  participants: TeamParticipant[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenCreateModal: () => void;
  onEditParticipant: (id: string) => void;
  onRemoveParticipant: (id: string) => void;
  readOnly?: boolean;
}

function maskDni(dni?: string) {
  if (!dni) return 'Sin DNI';
  if (dni.length < 4) return dni;
  return `${dni.slice(0, 2)}****${dni.slice(-2)}`;
}

export const TeamMembersSection: React.FC<TeamMembersSectionProps> = ({
  participants,
  search,
  onSearchChange,
  onOpenCreateModal,
  onEditParticipant,
  onRemoveParticipant,
  readOnly = false,
}) => {
  return (
    <Card>
      <div className="mb-4 flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
        <h2 className="text-xl font-semibold">Integrantes</h2>
        <div className="flex w-full flex-col gap-2 md:flex-row lg:w-auto">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm md:w-72"
            placeholder="Buscar por nombre, apodo o DNI"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {!readOnly && (
            <Button onClick={onOpenCreateModal}>
              <span className="text-base leading-none">+</span> Agregar integrante
            </Button>
          )}
        </div>
      </div>

      <Table headers={['Integrante', 'Apodo', 'DNI', 'Estado', ...(readOnly ? [] : ['Acciones'])]}>
        {participants.map((participant) => (
          <tr key={participant.id} className="hover:bg-surface-2">
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar
                  name={`${participant.firstName} ${participant.lastName}`}
                  imageUrl={participant.avatarUrl}
                  size="sm"
                />
                <span className="font-medium text-slate-800">
                  {participant.firstName} {participant.lastName}
                </span>
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-slate-700">{participant.nickname || '-'}</td>
            <td className="px-4 py-3 text-sm text-slate-700">{maskDni(participant.dni)}</td>
            <td className="px-4 py-3">
              {participant.status === 'claimed' ? (
                <Badge variant="success">Reclamado</Badge>
              ) : (
                <Badge variant="warning">Sin perfil</Badge>
              )}
            </td>
            {!readOnly && (
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditParticipant(participant.id)}
                    className="rounded-lg p-2 text-slate-600 hover:bg-surface-3"
                    aria-label="Editar integrante"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveParticipant(participant.id)}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    aria-label="Remover integrante"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              </td>
            )}
          </tr>
        ))}
      </Table>
    </Card>
  );
};

