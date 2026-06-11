/**
 * Reglas puras de la vista Agenda: competencia activa, siguiente partido, fecha en juego, orden.
 */
import { isByeFromInscriptionSlots } from '../../components/tournament-schedule/matchParticipantUtils';
import { dedupeCompetitionsByName, matchFixtureKey } from '../team-presences/matchDedupe';
import { collectMatchesForInscription } from '../team-presences/teamMatches';
import { effectiveStageStatus } from '../tournaments-list/stageLifecycle';
import type {
  TournamentCompetition,
  TournamentEntity,
  TournamentMatchRow,
  TournamentStage,
  TournamentStageFormat,
} from '../tournaments-list/types';

export const AGENDA_PAGE_SIZE = 5;
export const AGENDA_ALL_TOURNAMENTS = 'all';

export function agendaRoundKey(round: number, leg: number): string {
  return `${round}|${leg}`;
}

export interface AgendaFixtureFocus {
  competitionId: string;
  stageId: string;
  roundKey: string;
}

export function agendaFixtureFocusFromRow(row: AgendaRow): AgendaFixtureFocus {
  return {
    competitionId: row.competitionId,
    stageId: row.stageId,
    roundKey: agendaRoundKey(row.sortRound, row.sortLeg),
  };
}

export interface AgendaParticipantRowData {
  kind: 'participant';
  rowKey: string;
  tournamentId: string;
  tournamentName: string;
  competitionId: string;
  competitionName: string;
  stageId: string;
  stageName: string;
  stageFormat: TournamentStageFormat;
  badge: string;
  match: TournamentMatchRow;
  inscriptionId: number;
  opponentName: string;
  isHome: boolean;
  sortScheduledAtMs: number | null;
  sortRound: number;
  sortLeg: number;
}

export interface AgendaOrganizerRowData {
  kind: 'organizer';
  rowKey: string;
  tournamentId: string;
  tournamentName: string;
  competitionId: string;
  competitionName: string;
  stageId: string;
  stageName: string;
  stageFormat: TournamentStageFormat;
  activeRound: number;
  roundLabel: string;
  pendingCount: number;
  pendingMatches: TournamentMatchRow[];
  earliestScheduledAt: string | null;
  sortScheduledAtMs: number | null;
  sortRound: number;
  sortLeg: number;
}

export type AgendaRow = AgendaParticipantRowData | AgendaOrganizerRowData;

export function isTournamentAgendaEligible(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s !== 'draft' && s !== 'finished';
}

export function isMatchCompleted(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === 'finished' || s === 'completed';
}

export function isMatchPending(status: string | null | undefined): boolean {
  return !isMatchCompleted(status);
}

function slotInscriptionId(slot?: { inscriptionId?: string | number | null } | null): number | null {
  const raw = slot?.inscriptionId;
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function isAgendaByeMatch(
  match: TournamentMatchRow,
  stageFormat: TournamentStageFormat | string | null | undefined
): boolean {
  return isByeFromInscriptionSlots(
    match.homeAssignedInscription,
    match.awayAssignedInscription,
    { matchKind: match.matchKind, stageFormat }
  );
}

export function isCompetitionActive(competition: TournamentCompetition): boolean {
  return (competition.stages || []).some((s) => effectiveStageStatus(s) === 'active');
}

function collectStageMatches(stage: TournamentStage): TournamentMatchRow[] {
  const direct = stage.matches ?? [];
  const fromGroups = (stage.groups ?? []).flatMap((g) => g.matches ?? []);
  const seen = new Set<string>();
  const out: TournamentMatchRow[] = [];
  for (const m of [...direct, ...fromGroups]) {
    const key = matchFixtureKey(m);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function compareMatchOrder(
  a: { round?: number | null; leg?: number | null },
  b: { round?: number | null; leg?: number | null }
): number {
  const r = (a.round ?? 0) - (b.round ?? 0);
  if (r !== 0) return r;
  return (a.leg ?? 1) - (b.leg ?? 1);
}

export function parseScheduledAtMs(scheduledAt: string | null | undefined): number | null {
  if (!scheduledAt) return null;
  const ts = Date.parse(scheduledAt);
  return Number.isFinite(ts) ? ts : null;
}

export function roundLabelForStage(format: TournamentStageFormat | string, round: number): string {
  if (format === 'league' || format === 'groups') return `Fecha ${round}`;
  return `Ronda ${round}`;
}

export function pickActiveRound(pendingMatches: TournamentMatchRow[]): number | null {
  const rounds = pendingMatches
    .map((m) => m.round ?? 0)
    .filter((r) => r > 0);
  return rounds.length > 0 ? Math.min(...rounds) : null;
}

function opponentForInscription(
  match: TournamentMatchRow,
  inscriptionId: number
): { name: string; isHome: boolean } {
  const home = slotInscriptionId(match.homeAssignedInscription);
  const away = slotInscriptionId(match.awayAssignedInscription);
  if (home === inscriptionId) {
    return {
      isHome: true,
      name: match.awayAssignedInscription?.displayName?.trim() || 'Por definir',
    };
  }
  return {
    isHome: false,
    name: match.homeAssignedInscription?.displayName?.trim() || 'Por definir',
  };
}

/** Siguiente partido pendiente de la inscripción en una competencia activa. */
export function pickNextPendingMatchInCompetition(
  competition: TournamentCompetition,
  inscriptionId: number
): {
  match: TournamentMatchRow;
  stageId: string;
  stageName: string;
  stageFormat: TournamentStageFormat;
} | null {
  if (!isCompetitionActive(competition)) return null;
  const stages = [...(competition.stages || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const candidates: {
    match: TournamentMatchRow;
    stageId: string;
    stageName: string;
    stageFormat: TournamentStageFormat;
    stageOrder: number;
  }[] = [];

  for (const stage of stages) {
    if (effectiveStageStatus(stage) !== 'active') continue;
    for (const match of collectStageMatches(stage)) {
      if (!isMatchPending(match.status)) continue;
      if (isAgendaByeMatch(match, stage.format)) continue;
      const home = slotInscriptionId(match.homeAssignedInscription);
      const away = slotInscriptionId(match.awayAssignedInscription);
      if (home !== inscriptionId && away !== inscriptionId) continue;
      candidates.push({
        match,
        stageId: stage.id,
        stageName: stage.name,
        stageFormat: stage.format,
        stageOrder: stage.order ?? 0,
      });
    }
  }

  candidates.sort((a, b) => {
    const o = a.stageOrder - b.stageOrder;
    if (o !== 0) return o;
    return compareMatchOrder(a.match, b.match);
  });
  if (candidates.length === 0) return null;
  const first = candidates[0];
  return {
    match: first.match,
    stageId: first.stageId,
    stageName: first.stageName,
    stageFormat: first.stageFormat,
  };
}

export function buildParticipantRowsFromTournament(
  tournament: TournamentEntity,
  inscriptionId: number,
  badge: string
): AgendaParticipantRowData[] {
  if (!isTournamentAgendaEligible(tournament.status)) return [];
  const competitions = dedupeCompetitionsByName(tournament.competitions || []);
  const rows: AgendaParticipantRowData[] = [];

  for (const competition of competitions) {
    const next = pickNextPendingMatchInCompetition(competition, inscriptionId);
    if (!next) continue;
    const { name: opponentName, isHome } = opponentForInscription(next.match, inscriptionId);
    const sortScheduledAtMs = parseScheduledAtMs(next.match.scheduledAt);
    rows.push({
      kind: 'participant',
      rowKey: `${tournament.id}:${competition.id}:${inscriptionId}`,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      competitionId: competition.id,
      competitionName: competition.name,
      stageId: next.stageId,
      stageName: next.stageName,
      stageFormat: next.stageFormat,
      badge,
      match: next.match,
      inscriptionId,
      opponentName,
      isHome,
      sortScheduledAtMs,
      sortRound: next.match.round ?? 0,
      sortLeg: next.match.leg ?? 1,
    });
  }
  return rows;
}

export function buildOrganizerRowForCompetition(
  tournament: TournamentEntity,
  competition: TournamentCompetition
): AgendaOrganizerRowData | null {
  if (!isTournamentAgendaEligible(tournament.status)) return null;
  if (!isCompetitionActive(competition)) return null;

  const stages = [...(competition.stages || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const stage of stages) {
    if (effectiveStageStatus(stage) !== 'active') continue;
    const pending = collectStageMatches(stage).filter(
      (m) => isMatchPending(m.status) && !isAgendaByeMatch(m, stage.format)
    );
    if (pending.length === 0) continue;
    const activeRound = pickActiveRound(pending);
    if (activeRound == null) continue;
    const roundMatches = pending
      .filter((m) => (m.round ?? 0) === activeRound)
      .sort(compareMatchOrder);
    const scheduled = roundMatches
      .map((m) => parseScheduledAtMs(m.scheduledAt))
      .filter((v): v is number => v != null);
    const earliestScheduledAt =
      scheduled.length > 0
        ? roundMatches.find((m) => parseScheduledAtMs(m.scheduledAt) === Math.min(...scheduled))?.scheduledAt ??
          null
        : null;
    const sortScheduledAtMs = parseScheduledAtMs(earliestScheduledAt);

    return {
      kind: 'organizer',
      rowKey: `${tournament.id}:${competition.id}:${stage.id}`,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      competitionId: competition.id,
      competitionName: competition.name,
      stageId: stage.id,
      stageName: stage.name,
      stageFormat: stage.format,
      activeRound,
      roundLabel: roundLabelForStage(stage.format, activeRound),
      pendingCount: roundMatches.length,
      pendingMatches: roundMatches,
      earliestScheduledAt,
      sortScheduledAtMs,
      sortRound: activeRound,
      sortLeg: roundMatches[0]?.leg ?? 1,
    };
  }
  return null;
}

export function buildOrganizerRowsFromTournament(tournament: TournamentEntity): AgendaOrganizerRowData[] {
  if (!isTournamentAgendaEligible(tournament.status)) return [];
  const competitions = dedupeCompetitionsByName(tournament.competitions || []);
  return competitions
    .map((c) => buildOrganizerRowForCompetition(tournament, c))
    .filter((r): r is AgendaOrganizerRowData => r != null);
}

/** Orden global: con scheduledAt arriba (ASC), sin fecha abajo por round/leg. */
export function sortAgendaRows<T extends AgendaRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aHas = a.sortScheduledAtMs != null;
    const bHas = b.sortScheduledAtMs != null;
    if (aHas && bHas) return (a.sortScheduledAtMs as number) - (b.sortScheduledAtMs as number);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    const r = a.sortRound - b.sortRound;
    if (r !== 0) return r;
    return a.sortLeg - b.sortLeg;
  });
}

/** Atajo: todas las filas participante desde torneo + inscripción (tests / validación). */
export function collectMatchesForInscriptionInActiveCompetitions(
  tournament: TournamentEntity | null,
  inscriptionId: number
): ReturnType<typeof collectMatchesForInscription> {
  return collectMatchesForInscription(tournament, inscriptionId).filter((item) => {
    const comp = tournament?.competitions?.find((c) => c.id === item.competitionId);
    return comp ? isCompetitionActive(comp) && isMatchPending(item.match.status) : false;
  });
}
