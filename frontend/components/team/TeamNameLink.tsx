import React from 'react';
import { openTeamById, openTeamByName } from '../../services/teams/teamNav';
import { readSessionUser } from '../../services/teams/session';

interface TeamNameLinkProps {
  teamName: string;
  /** Si el componente ya conoce el id evita el lookup por nombre. */
  teamId?: string | number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Nombre de equipo clickeable: abre la vista de roster + estadísticas del equipo.
 * Para usuarios no logueados se renderiza como texto plano (los rosters son privados).
 */
export const TeamNameLink: React.FC<TeamNameLinkProps> = ({ teamName, teamId, className = '', children }) => {
  const loggedIn = Boolean(readSessionUser());
  const content = children ?? teamName;

  if (!loggedIn || !teamName.trim()) {
    return <span className={className}>{content}</span>;
  }

  return (
    <button
      type="button"
      className={`cursor-pointer bg-transparent p-0 text-left underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none ${className}`}
      title={`Ver plantel y estadísticas de ${teamName}`}
      onClick={(e) => {
        e.stopPropagation();
        if (teamId != null) openTeamById(teamId, teamName);
        else void openTeamByName(teamName);
      }}
    >
      {content}
    </button>
  );
};
