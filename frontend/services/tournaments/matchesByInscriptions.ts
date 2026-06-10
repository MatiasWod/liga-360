import { gqlRequest } from './client';

/** Partido con contexto histórico devuelto por matchesByInscriptionIds. */
export interface HistoricalMatchRow {
  id: string;
  round?: number | null;
  leg?: number | null;
  scheduledAt?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string | null;
  tournamentId?: string | null;
  tournamentName?: string | null;
  competitionId?: string | null;
  competitionName?: string | null;
  stageId?: string | null;
  stageName?: string | null;
  homeAssignedInscription?: { inscriptionId: string; tournamentId: string; displayName: string } | null;
  awayAssignedInscription?: { inscriptionId: string; tournamentId: string; displayName: string } | null;
}

const QUERY = `
  query MatchesByInscriptionIds($ids: [ID!]!) {
    matchesByInscriptionIds(ids: $ids) {
      id
      round
      leg
      scheduledAt
      homeScore
      awayScore
      status
      tournamentId
      tournamentName
      competitionId
      competitionName
      stageId
      stageName
      homeAssignedInscription { inscriptionId tournamentId displayName }
      awayAssignedInscription { inscriptionId tournamentId displayName }
    }
  }
`;

/** Partidos públicos donde participa cualquiera de las inscripciones (ids físicos). */
export async function getMatchesByInscriptionIds(inscriptionIds: number[]): Promise<HistoricalMatchRow[]> {
  const ids = inscriptionIds.map(String).filter(Boolean);
  if (ids.length === 0) return [];
  const data = await gqlRequest<{ matchesByInscriptionIds: HistoricalMatchRow[] }>(QUERY, { ids });
  return data.matchesByInscriptionIds || [];
}
