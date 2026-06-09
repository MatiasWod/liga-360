/** Lógica de estadísticas agregadas por Competencia/Torneo (lecturas públicas). */
import { pool } from '../config/db.js';
import * as statsRepo from '../repositories/stats.repository.js';

function toPlayerRow(row) {
  return {
    playerKey: row.player_key,
    displayName: row.display_name,
    inscriptionId: row.inscription_id != null ? Number(row.inscription_id) : null,
    linkedMemberId: row.linked_member_id != null ? Number(row.linked_member_id) : null,
  };
}

export async function getScorers({ tournamentId, competitionId, limit }) {
  const rows = await statsRepo.scorers(pool, { tournamentId, competitionId, limit });
  return rows.map((r) => ({ ...toPlayerRow(r), goals: r.goals }));
}

export async function getCards({ tournamentId, competitionId }) {
  const rows = await statsRepo.cards(pool, { tournamentId, competitionId });
  return rows.map((r) => ({
    ...toPlayerRow(r),
    yellowCards: r.yellow_cards,
    redCards: r.red_cards,
    suspensionMatches: r.suspension_matches,
  }));
}

export async function getTeamStats({ tournamentId, competitionId }) {
  const rows = await statsRepo.teamStats(pool, { tournamentId, competitionId });
  return rows.map((r) => ({
    inscriptionId: Number(r.inscription_id),
    goals: r.goals,
    yellowCards: r.yellow_cards,
    redCards: r.red_cards,
  }));
}

export async function getEventsByInscription({ tournamentId, inscriptionId }) {
  return statsRepo.eventsByInscription(pool, { tournamentId, inscriptionId });
}
