import { listTournamentInscriptions, type InscriptionItem } from '../../services/inscriptionsApi';
import { listTeamInscriptions } from '../../services/inscriptions/teamInscriptions';
import { getTournamentDetailById, listTournamentsGraphql } from '../../services/tournamentsApi';
import type { TournamentEntity } from '../tournaments-list/types';

const DEFAULT_CONCURRENCY = 6;

/** Ejecuta fn en lotes para no saturar el gateway ni serializar miles de requests. */
export async function runBatched<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, concurrency);
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export function isPublishedTournamentStatus(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s !== 'draft' && s !== 'finished';
}

export async function loadTournamentDetail(tournamentId: string): Promise<TournamentEntity | null> {
  try {
    const data = await getTournamentDetailById(tournamentId);
    return (data as TournamentEntity | null) ?? null;
  } catch {
    return null;
  }
}

export async function loadTournamentsByIdsBatched(
  ids: string[],
  concurrency = DEFAULT_CONCURRENCY
): Promise<TournamentEntity[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  const loaded = await runBatched(unique, concurrency, loadTournamentDetail);
  return loaded.filter((t): t is TournamentEntity => t != null);
}

/** Torneos publicados (excluye draft/finished) — una sola query liviana. */
export async function listPublishedTournamentIds(): Promise<string[]> {
  const list = await listTournamentsGraphql();
  return list
    .filter((t) => isPublishedTournamentStatus(t.status))
    .map((t) => t.id)
    .filter(Boolean);
}

/** Inscripciones individuales del participante (paralelo, solo torneos published). */
export async function findIndividualParticipantBindings(
  participantUserId: number,
  publishedIds?: string[]
): Promise<IndividualTournamentBinding[]> {
  const ids = publishedIds ?? (await listPublishedTournamentIds());
  const resolved = await runBatched(ids, DEFAULT_CONCURRENCY, async (tournamentId) => {
    const inscriptions = await listTournamentInscriptions(tournamentId).catch(() => [] as InscriptionItem[]);
    const mine = inscriptions.find(
      (item) =>
        Number(item.linked_participant_user_id || 0) === participantUserId &&
        String(item.status || '').toUpperCase() !== 'RECHAZADO'
    );
    if (!mine) return null;
    const inscriptionId = Number(mine.id);
    if (!Number.isFinite(inscriptionId) || inscriptionId <= 0) return null;
    return { tournamentId, inscriptionId };
  });
  return resolved.filter((b): b is IndividualTournamentBinding => b != null);
}

export interface TeamTournamentBinding {
  tournamentId: string;
  inscriptionId: number;
  badge: string;
}

/** Torneos + inscripción física por equipo vinculado (sin re-fetch por torneo). */
export async function collectTeamTournamentBindings(
  teams: { id: string; name: string }[]
): Promise<TeamTournamentBinding[]> {
  const bindings: TeamTournamentBinding[] = [];
  const teamLoads = await runBatched(teams, DEFAULT_CONCURRENCY, async (team) => {
    const teamId = Number(team.id);
    if (!Number.isFinite(teamId) || teamId <= 0) return [];
    const rows = await listTeamInscriptions(teamId).catch(() => []);
    return rows
      .filter((r) => String(r.status || '').toUpperCase() !== 'RECHAZADO' && r.tournament_id)
      .map((r) => ({
        tournamentId: String(r.tournament_id),
        inscriptionId: Number(r.id),
        badge: team.name,
      }))
      .filter((b) => Number.isFinite(b.inscriptionId) && b.inscriptionId > 0);
  });
  for (const chunk of teamLoads) bindings.push(...chunk);
  return bindings;
}

export interface IndividualTournamentBinding {
  tournamentId: string;
  inscriptionId: number;
}
