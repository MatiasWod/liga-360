import { gqlRequest } from './client';

export type TournamentStage = {
  id: string;
  name: string;
  order: number;
  format: 'league' | 'groups' | 'elimination';
};

export type TournamentCompetition = {
  id: string;
  name: string;
  order: number;
  stages: TournamentStage[];
};

export type TournamentListItem = {
  id: string;
  name: string;
  venue?: string | null;
  organizer?: string | null;
  participantType?: string | null;
  inscriptionMode?: 'public' | 'invitation' | null;
  competitions: TournamentCompetition[];
};

export type TournamentSummary = {
  id: string;
  name: string;
  organizer?: string | null;
  venue?: string | null;
  participantType?: string | null;
};

export async function listTournamentIds(): Promise<string[]> {
  const data = await gqlRequest<{ tournaments?: Array<{ id?: string | null }> }>(`
    query TournamentsIds {
      tournaments {
        id
      }
    }
  `);
  const tournaments = Array.isArray(data?.tournaments) ? data.tournaments : [];
  return tournaments.map((t) => String(t?.id || '')).filter(Boolean);
}

export async function listTournamentsGraphql(): Promise<TournamentListItem[]> {
  const data = await gqlRequest<{ tournaments?: TournamentListItem[] }>(`
    query TournamentsList {
      tournaments {
        id
        name
        venue
        organizer
        participantType
        inscriptionMode
        competitions {
          id
          name
          order
          stages {
            id
            name
            order
            format
          }
        }
      }
    }
  `);
  return Array.isArray(data?.tournaments) ? data.tournaments : [];
}

export async function getTournamentForInvite(tournamentId: string): Promise<{
  id: string;
  name: string;
  competitions: Array<{ id: string; name: string }>;
} | null> {
  const data = await gqlRequest<{ tournament?: any }>(
    `
      query TournamentForInvite($id: ID!) {
        tournament(id: $id) {
          id
          name
          competitions {
            id
            name
          }
        }
      }
    `,
    { id: tournamentId }
  );
  const tournament = data?.tournament;
  if (!tournament?.id) return null;
  return {
    id: String(tournament.id),
    name: String(tournament.name || ''),
    competitions: Array.isArray(tournament.competitions)
      ? tournament.competitions.map((competition: any) => ({
          id: String(competition.id || ''),
          name: String(competition.name || ''),
        }))
      : [],
  };
}

export async function getTournamentSummaryById(tournamentId: string): Promise<TournamentSummary | null> {
  const data = await gqlRequest<{ tournament?: any }>(
    `
      query TournamentSummary($id: ID!) {
        tournament(id: $id) {
          id
          name
          organizer
          venue
          participantType
        }
      }
    `,
    { id: tournamentId }
  );
  const tournament = data?.tournament;
  if (!tournament?.id) return null;
  return {
    id: String(tournament.id),
    name: String(tournament.name || ''),
    organizer: tournament.organizer ?? null,
    venue: tournament.venue ?? null,
    participantType: tournament.participantType ?? null,
  };
}

export async function getTournamentDetailById(tournamentId: string): Promise<any | null> {
  const data = await gqlRequest<{ tournament?: any }>(
    `
      query TournamentDetail($id: ID!) {
        tournament(id: $id) {
          id
          name
          venue
          organizer
          participantType
          status
          competitions {
            id
            name
            order
            stages {
              id
              name
              order
              format
              stageStatus
              standings {
                position
                inscriptionId
                displayName
                played
                won
                drawn
                lost
                goalsFor
                goalsAgainst
                goalDifference
                points
              }
              matches {
                id
                round
                leg
                slotIndex
                fixtureCode
                groupId
                scheduledAt
                venue
                referee
                homeScore
                awayScore
                status
                homeAssignedInscription { inscriptionId displayName }
                awayAssignedInscription { inscriptionId displayName }
              }
              groups {
                id
                name
                order
                standings {
                  position
                  inscriptionId
                  displayName
                  played
                  won
                  drawn
                  lost
                  goalsFor
                  goalsAgainst
                  goalDifference
                  points
                }
                matches {
                  id
                  round
                  leg
                  slotIndex
                  fixtureCode
                  groupId
                  scheduledAt
                  venue
                  referee
                  homeScore
                  awayScore
                  status
                  homeAssignedInscription { inscriptionId displayName }
                  awayAssignedInscription { inscriptionId displayName }
                }
              }
            }
          }
        }
      }
    `,
    { id: tournamentId }
  );
  return data?.tournament || null;
}

export async function deleteTournamentById(id: string): Promise<void> {
  await gqlRequest<{ deleteTournament: boolean }>(
    `mutation DeleteTournament($id: ID!) { deleteTournament(id: $id) }`,
    { id },
    { auth: true }
  );
}
