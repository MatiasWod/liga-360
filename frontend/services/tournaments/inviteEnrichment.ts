import { getTournamentForInvite } from './tournaments';

type BaseInvite = {
  tournament_id?: string | null;
  competition_id?: string | null;
  invite_response_status?: string | null;
  status?: string | null;
};

export type EnrichedInvite<T extends BaseInvite> = T & {
  tournament_name?: string | null;
  competition_name?: string | null;
  view_status: 'en_curso' | 'aceptada' | 'rechazada';
};

function deriveInviteViewStatus(invite: BaseInvite): 'en_curso' | 'aceptada' | 'rechazada' {
  const responseStatus = String(invite.invite_response_status || '').toLowerCase();
  const inviteStatus = String(invite.status || '').toLowerCase();
  if (responseStatus === 'accepted') return 'aceptada';
  if (responseStatus === 'rejected') return 'rechazada';
  if (inviteStatus !== 'active') return 'rechazada';
  return 'en_curso';
}

export async function enrichInvitesWithTournamentData<T extends BaseInvite>(
  rawInvites: T[]
): Promise<Array<EnrichedInvite<T>>> {
  const tournamentIds = Array.from(
    new Set(rawInvites.map((invite) => String(invite.tournament_id || '')).filter(Boolean))
  );
  const tournamentById = new Map<string, { name: string; competitions: Array<{ id: string; name: string }> }>();

  await Promise.all(
    tournamentIds.map(async (tournamentId) => {
      const tournament = await getTournamentForInvite(tournamentId);
      if (!tournament?.id) return;
      tournamentById.set(String(tournament.id), {
        name: tournament.name,
        competitions: Array.isArray(tournament.competitions) ? tournament.competitions : [],
      });
    })
  );

  return rawInvites.map((invite) => {
    const tournament = tournamentById.get(String(invite.tournament_id || ''));
    const competition = tournament?.competitions?.find(
      (item) => String(item.id) === String(invite.competition_id || '')
    );
    return {
      ...invite,
      tournament_name: tournament?.name || null,
      competition_name: competition?.name || null,
      view_status: deriveInviteViewStatus(invite),
    };
  });
}
