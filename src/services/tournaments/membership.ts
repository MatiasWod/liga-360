import { listTournamentInscriptions, type InscriptionItem } from '../inscriptionsApi';
import { listTournamentIds } from './tournaments';

export async function listTournamentIdsByInscriptionPredicate(
  predicate: (item: InscriptionItem) => boolean
): Promise<Set<string>> {
  const tournamentIds = await listTournamentIds();
  const matched = new Set<string>();
  for (const tournamentId of tournamentIds) {
    if (!tournamentId) continue;
    const inscriptions = await listTournamentInscriptions(tournamentId);
    if (inscriptions.some((item) => predicate(item))) {
      matched.add(tournamentId);
    }
  }
  return matched;
}
