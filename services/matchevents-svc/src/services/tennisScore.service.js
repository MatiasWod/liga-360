import { pool } from '../config/db.js';
import * as matchEventRepo from '../repositories/matchEvent.repository.js';
import * as tournamentsClient from '../clients/tournaments.client.js';
import { validateTennisScorePayload } from '../domain/tennisScore.js';

export async function replaceTennisScore({
  authorization,
  matchId,
  tournamentId,
  competitionId = null,
  status,
  sets,
  createdByUserId = null,
}) {
  const validated = validateTennisScorePayload({ status, sets });
  if (!validated.ok) {
    throw Object.assign(new Error(validated.error), { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const events = await matchEventRepo.replaceTennisSets(client, {
      matchId,
      tournamentId,
      competitionId,
      sets: validated.sets,
      createdByUserId,
    });

    const match = await tournamentsClient.updateMatchResult({
      matchId,
      homeScore: validated.setsWon.home,
      awayScore: validated.setsWon.away,
      status,
      authorization,
    });

    await client.query('COMMIT');
    return {
      setsWon: validated.setsWon,
      match,
      events,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
