/**
 * Agregaciones de estadísticas sobre MatchEvent (ADR-0001).
 * Clave de agregación compuesta:
 *   - member:{linked_member_id} cuando el jugador está vinculado al plantel
 *   - name:{inscription_id|-}:{display_name normalizado} como fallback de texto libre
 * Eventos legacy sin inscription_id agregan con inscriptionId null (equipo "—" en UI).
 */

const PLAYER_KEY_SQL = `
  CASE
    WHEN linked_member_id IS NOT NULL THEN 'member:' || linked_member_id
    ELSE 'name:' || COALESCE(inscription_id::text, '-') || ':' || lower(btrim(display_name))
  END
`;

function competitionFilter(competitionId, params) {
  if (!competitionId) return '';
  params.push(competitionId);
  return ` AND competition_id = $${params.length}`;
}

/**
 * CTE de presencias agrupadas por la misma clave compuesta: aporta
 * matches_played (PJ). LEFT JOIN: NULL cuando el equipo no carga presencias
 * (la UI muestra "—"; nunca se infiere de plantilla ni partidos del equipo).
 */
const PRESENCE_CTE = (compFilter) => `
  presences AS (
    SELECT ${PLAYER_KEY_SQL} AS player_key, COUNT(*)::int AS matches_played
    FROM "MatchPresence"
    WHERE tournament_id = $1${compFilter}
    GROUP BY 1
  )
`;

export async function scorers(client, { tournamentId, competitionId = null, limit = 50 }) {
  const params = [tournamentId];
  const compFilter = competitionFilter(competitionId, params);
  params.push(Number(limit) || 50);
  const r = await client.query(
    `WITH ${PRESENCE_CTE(compFilter)},
     ev AS (
       SELECT ${PLAYER_KEY_SQL} AS player_key,
              -- nombre más reciente registrado para la clave
              (array_agg(display_name ORDER BY created_at DESC))[1] AS display_name,
              MIN(inscription_id) AS inscription_id,
              MIN(linked_member_id) AS linked_member_id,
              COUNT(*)::int AS goals
       FROM "MatchEvent"
       WHERE tournament_id = $1 AND event_type = 'goal'${compFilter}
       GROUP BY 1
     )
     SELECT ev.*, presences.matches_played
     FROM ev LEFT JOIN presences USING (player_key)
     ORDER BY ev.goals DESC, ev.display_name ASC
     LIMIT $${params.length}`,
    params
  );
  return r.rows;
}

export async function cards(client, { tournamentId, competitionId = null }) {
  const params = [tournamentId];
  const compFilter = competitionFilter(competitionId, params);
  const r = await client.query(
    `WITH ${PRESENCE_CTE(compFilter)},
     ev AS (
       SELECT ${PLAYER_KEY_SQL} AS player_key,
              (array_agg(display_name ORDER BY created_at DESC))[1] AS display_name,
              MIN(inscription_id) AS inscription_id,
              MIN(linked_member_id) AS linked_member_id,
              COUNT(*) FILTER (WHERE event_type = 'yellow_card')::int AS yellow_cards,
              COUNT(*) FILTER (WHERE event_type = 'red_card')::int AS red_cards,
              COALESCE(SUM(suspension_matches) FILTER (WHERE event_type = 'suspension'), 0)::int AS suspension_matches
       FROM "MatchEvent"
       WHERE tournament_id = $1
         AND event_type IN ('yellow_card', 'red_card', 'suspension')${compFilter}
       GROUP BY 1
     )
     SELECT ev.*, presences.matches_played
     FROM ev LEFT JOIN presences USING (player_key)
     ORDER BY ev.red_cards DESC, ev.yellow_cards DESC, ev.display_name ASC`,
    params
  );
  return r.rows;
}

export async function teamStats(client, { tournamentId, competitionId = null }) {
  const params = [tournamentId];
  const compFilter = competitionFilter(competitionId, params);
  const r = await client.query(
    `SELECT inscription_id,
            COUNT(*) FILTER (WHERE event_type = 'goal')::int AS goals,
            COUNT(*) FILTER (WHERE event_type = 'yellow_card')::int AS yellow_cards,
            COUNT(*) FILTER (WHERE event_type = 'red_card')::int AS red_cards
     FROM "MatchEvent"
     WHERE tournament_id = $1 AND inscription_id IS NOT NULL${compFilter}
     GROUP BY inscription_id
     ORDER BY inscription_id`,
    params
  );
  return r.rows;
}

export async function eventsByInscription(client, { tournamentId, inscriptionId }) {
  const r = await client.query(
    `SELECT * FROM "MatchEvent"
     WHERE tournament_id = $1 AND inscription_id = $2
     ORDER BY created_at ASC, COALESCE(minute, 999999) ASC`,
    [tournamentId, Number(inscriptionId)]
  );
  return r.rows;
}

/** Eventos de un Participant (linked_member_id) agrupados por torneo/competencia. */
export async function participantEventTotals(client, memberId) {
  const r = await client.query(
    `SELECT tournament_id, competition_id,
            COUNT(*) FILTER (WHERE event_type = 'goal')::int AS goals,
            COUNT(*) FILTER (WHERE event_type = 'yellow_card')::int AS yellow_cards,
            COUNT(*) FILTER (WHERE event_type = 'red_card')::int AS red_cards,
            COALESCE(SUM(suspension_matches) FILTER (WHERE event_type = 'suspension'), 0)::int AS suspension_matches
     FROM "MatchEvent"
     WHERE linked_member_id = $1
     GROUP BY tournament_id, competition_id
     ORDER BY tournament_id, competition_id`,
    [Number(memberId)]
  );
  return r.rows;
}

/** Presencias de un Participant agrupadas por torneo/competencia (PJ real). */
export async function participantPresenceTotals(client, memberId) {
  const r = await client.query(
    `SELECT tournament_id, competition_id, COUNT(*)::int AS matches_played
     FROM "MatchPresence"
     WHERE linked_member_id = $1
     GROUP BY tournament_id, competition_id
     ORDER BY tournament_id, competition_id`,
    [Number(memberId)]
  );
  return r.rows;
}
