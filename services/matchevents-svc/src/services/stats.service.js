/** Lógica de estadísticas agregadas por Competencia/Torneo (lecturas públicas). */
import { pool } from '../config/db.js';
import * as statsRepo from '../repositories/stats.repository.js';
import * as inscriptionsClient from '../clients/inscriptions.client.js';
import { mergeParticipantTotals } from '../domain/presence.js';

const EMPTY_PARTICIPANT_TOTALS = {
  goals: 0,
  yellowCards: 0,
  redCards: 0,
  suspensionMatches: 0,
  matchesPlayed: null,
};

function toPlayerRow(row) {
  return {
    playerKey: row.player_key,
    displayName: row.display_name,
    inscriptionId: row.inscription_id != null ? Number(row.inscription_id) : null,
    linkedMemberId: row.linked_member_id != null ? Number(row.linked_member_id) : null,
    // PJ solo desde presencias: null = sin datos (la UI muestra "—")
    matchesPlayed: row.matches_played != null ? Number(row.matches_played) : null,
  };
}

export async function getScorers({ tournamentId, competitionId, limit, offset }) {
  const rows = await statsRepo.scorers(pool, { tournamentId, competitionId, limit, offset });
  return rows.map((r) => ({ ...toPlayerRow(r), goals: r.goals }));
}

export async function getScorersMulti({ tournamentIds, limit, offset }) {
  const rows = await statsRepo.scorersMulti(pool, { tournamentIds, limit, offset });
  return rows.map((r) => ({
    ...toPlayerRow(r),
    goals: r.goals,
    identityApproximate: r.linked_member_id == null,
  }));
}

export async function getCards({ tournamentId, competitionId, limit, offset }) {
  const rows = await statsRepo.cards(pool, { tournamentId, competitionId, limit, offset });
  return rows.map((r) => ({
    ...toPlayerRow(r),
    yellowCards: r.yellow_cards,
    redCards: r.red_cards,
    suspensionMatches: r.suspension_matches,
  }));
}

/** Stats de un Participant: totales + desglose por torneo/competencia. Opcional teamId filtra por inscripciones del equipo. */
export async function getParticipantStats({ memberId, teamId = null }) {
  let inscriptionIds = null;
  if (teamId != null) {
    const tid = Number(teamId);
    if (!tid) {
      return { memberId: Number(memberId), totals: { ...EMPTY_PARTICIPANT_TOTALS }, byTournament: [] };
    }
    const rows = await inscriptionsClient.listTeamInscriptions(tid);
    inscriptionIds = rows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n) && n > 0);
    if (!inscriptionIds.length) {
      return { memberId: Number(memberId), totals: { ...EMPTY_PARTICIPANT_TOTALS }, byTournament: [] };
    }
  }
  const [eventRows, presenceRows] = await Promise.all([
    statsRepo.participantEventTotals(pool, memberId, inscriptionIds),
    statsRepo.participantPresenceTotals(pool, memberId, inscriptionIds),
  ]);
  const { totals, byTournament } = mergeParticipantTotals(eventRows, presenceRows);
  return { memberId: Number(memberId), totals, byTournament };
}

export async function getTeamStats({ tournamentId, competitionId, limit, offset }) {
  const rows = await statsRepo.teamStats(pool, { tournamentId, competitionId, limit, offset });
  return rows.map((r) => ({
    inscriptionId: Number(r.inscription_id),
    goals: r.goals,
    yellowCards: r.yellow_cards,
    redCards: r.red_cards,
  }));
}

export async function getEventsByInscription({ tournamentId, inscriptionId, limit, offset }) {
  return statsRepo.eventsByInscription(pool, { tournamentId, inscriptionId, limit, offset });
}
