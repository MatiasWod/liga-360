/** Orquestación ELO: process-match idempotente, global Team + ghost local vía inscriptions-svc. */
import { pool, withTransaction } from '../config/db.js';
import { DEFAULT_ELO, computeMatchElo } from '../domain/elo/eloCalculator.js';
import * as eloRepo from '../repositories/elo.repository.js';
import * as inscriptionsClient from '../clients/inscriptions.client.js';
import { badRequest, translateError } from './serviceErrors.js';

function normalizeRating(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : DEFAULT_ELO;
}

async function resolveSideRating(side, teamId, tournamentRating) {
  if (teamId) {
    const elo = await eloRepo.getTeamElo(pool, teamId);
    return normalizeRating(elo ?? DEFAULT_ELO);
  }
  return normalizeRating(tournamentRating ?? DEFAULT_ELO);
}

async function revertEvent(client, event) {
  if (event.home_team_id) {
    await eloRepo.setTeamElo(client, event.home_team_id, event.home_elo_before);
  } else {
    await inscriptionsClient.updateTournamentRating(event.home_inscription_id, event.home_elo_before);
  }
  if (event.away_team_id) {
    await eloRepo.setTeamElo(client, event.away_team_id, event.away_elo_before);
  } else {
    await inscriptionsClient.updateTournamentRating(event.away_inscription_id, event.away_elo_before);
  }
}

export async function processMatch({
  matchId,
  tournamentId,
  tournamentStatus,
  homeInscriptionId,
  awayInscriptionId,
  homeScore,
  awayScore,
}) {
  if (String(tournamentStatus || '').toLowerCase() !== 'published') {
    return { skipped: true, reason: 'tournament_not_published' };
  }
  const hid = String(homeInscriptionId || '').trim();
  const aid = String(awayInscriptionId || '').trim();
  if (!hid || !aid) throw badRequest('inscripciones requeridas');
  const hs = Number(homeScore);
  const as = Number(awayScore);
  if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
    throw badRequest('marcador invalido');
  }

  const rows = await inscriptionsClient.lookupInscriptions([hid, aid]);
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const homeRow = byId.get(hid);
  const awayRow = byId.get(aid);
  if (!homeRow || !awayRow) return { skipped: true, reason: 'inscription_lookup_miss' };
  if (homeRow.competitor_kind === 'participant' || awayRow.competitor_kind === 'participant') {
    return { skipped: true, reason: 'participant_not_supported' };
  }

  const homeTeamId = homeRow.linked_team_id != null ? Number(homeRow.linked_team_id) : null;
  const awayTeamId = awayRow.linked_team_id != null ? Number(awayRow.linked_team_id) : null;

  try {
    return await withTransaction(async (client) => {
      const existing = await eloRepo.findEventByMatchId(client, matchId);
      if (existing) {
        await revertEvent(client, existing);
        await eloRepo.deleteEventByMatchId(client, matchId);
      }

      const homeRating = await resolveSideRating('home', homeTeamId, homeRow.tournament_rating);
      const awayRating = await resolveSideRating('away', awayTeamId, awayRow.tournament_rating);
      const computed = computeMatchElo({
        homeRating,
        awayRating,
        homeScore: hs,
        awayScore: as,
      });

      if (homeTeamId) {
        await eloRepo.setTeamElo(client, homeTeamId, computed.homeAfter);
      } else {
        await inscriptionsClient.updateTournamentRating(hid, computed.homeAfter);
      }
      if (awayTeamId) {
        await eloRepo.setTeamElo(client, awayTeamId, computed.awayAfter);
      } else {
        await inscriptionsClient.updateTournamentRating(aid, computed.awayAfter);
      }

      const event = await eloRepo.insertEvent(client, {
        matchId: String(matchId),
        tournamentId: String(tournamentId),
        homeInscriptionId: hid,
        awayInscriptionId: aid,
        homeEloBefore: computed.homeBefore,
        awayEloBefore: computed.awayBefore,
        homeDelta: computed.homeDelta,
        awayDelta: computed.awayDelta,
        homeEloAfter: computed.homeAfter,
        awayEloAfter: computed.awayAfter,
        homeTeamId,
        awayTeamId,
      });

      return { processed: true, event };
    });
  } catch (e) {
    throw translateError(e);
  }
}
