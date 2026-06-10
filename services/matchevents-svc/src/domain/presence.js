/**
 * Lógica pura de presencias (ADR-0002): autorización de dueño y validación de entradas.
 * Sin IO — la resolución inscription→team→owner la hace el service con los clients.
 */

/**
 * Matriz de autorización de escritura de presencias.
 * Devuelve { ok: true } o { ok: false, statusCode, code, message }.
 * - Solo usuarios `team` pueden escribir (organizador y otros tipos → 403 sin tocar red).
 * - La inscripción debe existir y estar vinculada a un Team (`linked_team_id`).
 * - El usuario debe ser el `owner_user_id` del Team.
 */
export function evaluatePresenceWriteAccess({ user, inscription, team }) {
  if (!user) return deny(401, 'UNAUTHORIZED', 'token requerido');
  if (user.type !== 'team') {
    return deny(403, 'FORBIDDEN', 'solo el dueño del equipo puede editar presencias');
  }
  if (!inscription) return deny(404, 'NOT_FOUND', 'inscripcion no encontrada');
  if (!inscription.linked_team_id) {
    return deny(403, 'FORBIDDEN', 'la inscripcion no esta vinculada a un equipo');
  }
  if (!team) return deny(404, 'NOT_FOUND', 'equipo no encontrado');
  if (Number(team.owner_user_id) !== Number(user.sub)) {
    return deny(403, 'FORBIDDEN', 'solo el dueño del equipo puede editar presencias');
  }
  return { ok: true };
}

function deny(statusCode, code, message) {
  return { ok: false, statusCode, code, message };
}

/**
 * Merge puro de totales de eventos y presencias de un Participant por
 * (torneo, competencia). `matchesPlayed` solo proviene de presencias: queda
 * null cuando no hay registros (nunca se infiere). Calcula totales globales.
 */
export function mergeParticipantTotals(eventRows, presenceRows) {
  const key = (r) => `${r.tournament_id}|${r.competition_id ?? ''}`;
  const byKey = new Map();
  for (const r of eventRows) {
    byKey.set(key(r), {
      tournamentId: r.tournament_id,
      competitionId: r.competition_id ?? null,
      goals: Number(r.goals) || 0,
      yellowCards: Number(r.yellow_cards) || 0,
      redCards: Number(r.red_cards) || 0,
      suspensionMatches: Number(r.suspension_matches) || 0,
      matchesPlayed: null,
    });
  }
  for (const r of presenceRows) {
    const k = key(r);
    const row = byKey.get(k) ?? {
      tournamentId: r.tournament_id,
      competitionId: r.competition_id ?? null,
      goals: 0,
      yellowCards: 0,
      redCards: 0,
      suspensionMatches: 0,
      matchesPlayed: null,
    };
    row.matchesPlayed = Number(r.matches_played) || 0;
    byKey.set(k, row);
  }
  const byTournament = [...byKey.values()];
  const totals = byTournament.reduce(
    (acc, r) => ({
      goals: acc.goals + r.goals,
      yellowCards: acc.yellowCards + r.yellowCards,
      redCards: acc.redCards + r.redCards,
      suspensionMatches: acc.suspensionMatches + r.suspensionMatches,
      matchesPlayed: r.matchesPlayed != null ? (acc.matchesPlayed ?? 0) + r.matchesPlayed : acc.matchesPlayed,
    }),
    { goals: 0, yellowCards: 0, redCards: 0, suspensionMatches: 0, matchesPlayed: null }
  );
  return { totals, byTournament };
}

/**
 * Valida y normaliza las entradas del PUT bulk. Cada entrada necesita
 * `display_name` (snapshot de texto obligatorio); `linked_member_id` e
 * `is_guest` son opcionales. Devuelve { ok, entries } o { ok: false, error }.
 */
export function normalizePresenceEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) {
    return { ok: false, error: 'entries debe ser una lista' };
  }
  const entries = [];
  const seenMembers = new Set();
  const seenNames = new Set();
  for (const raw of rawEntries) {
    const displayName = String(raw?.display_name ?? '').trim();
    if (!displayName) {
      return { ok: false, error: 'cada presencia requiere display_name (snapshot de texto)' };
    }
    const linkedMemberId = raw?.linked_member_id != null ? Number(raw.linked_member_id) : null;
    if (linkedMemberId != null && (!Number.isFinite(linkedMemberId) || linkedMemberId <= 0)) {
      return { ok: false, error: 'linked_member_id invalido' };
    }
    // Duplicados dentro del mismo payload (la DB también lo garantiza con unique parcial)
    if (linkedMemberId != null) {
      if (seenMembers.has(linkedMemberId)) {
        return { ok: false, error: `jugador duplicado en la lista (member ${linkedMemberId})` };
      }
      seenMembers.add(linkedMemberId);
    } else {
      const nameKey = displayName.toLowerCase();
      if (seenNames.has(nameKey)) {
        return { ok: false, error: `nombre duplicado en la lista (${displayName})` };
      }
      seenNames.add(nameKey);
    }
    entries.push({
      linkedMemberId,
      displayName,
      isGuest: Boolean(raw?.is_guest),
    });
  }
  return { ok: true, entries };
}
