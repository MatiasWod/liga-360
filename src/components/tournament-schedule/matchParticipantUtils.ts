import type { MatchRecord, TeamRef } from './types';

/** Etiquetas de UI / refs — no son nombres de equipo resueltos (alineado con tournaments-svc). */
export function isPlaceholderParticipantLabel(raw: string | null | undefined): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return true;
  if (/^Gan\.\s/i.test(s)) return true;
  if (/^Ganador\b/i.test(s)) return true;
  if (/^Posición\s+\d+/i.test(s)) return true;
  if (/^\d+°\s/.test(s)) return true;
  if (/^P\d+R\d+(?:-L\d+)?$/i.test(s)) return true;
  if (/^E\d+-M\d+/i.test(s)) return true;
  if (/^P\d+G\d+$/i.test(s)) return true;
  if (/^liga360-slot:/i.test(s) || /^pos:/i.test(s)) return true;
  if (/sin asignar/i.test(s)) return true;
  if (/pendiente/i.test(s)) return true;
  return false;
}

/** Equipo asignado y listo para jugar: nombre real (aunque el id siga siendo ref de slot). */
export function isResolvedMatchTeam(team: TeamRef): boolean {
  const id = String(team.id || '').trim();
  const name = String(team.name || '').trim();
  if (!name || name === '—') return false;
  if (id.startsWith('__empty-')) return false;
  if (isPlaceholderParticipantLabel(name)) return false;
  // Backend puede conservar liga360-slot:/pos: en inscriptionId y resolver displayName al equipo.
  if (id.startsWith('liga360-slot:') || id.startsWith('pos:')) {
    return true;
  }
  if (!id) return false;
  if (isPlaceholderParticipantLabel(id)) return false;
  return true;
}

export function bothMatchTeamsResolved(match: Pick<MatchRecord, 'homeTeam' | 'awayTeam'>): boolean {
  return isResolvedMatchTeam(match.homeTeam) && isResolvedMatchTeam(match.awayTeam);
}

type InscriptionSlot = { inscriptionId?: string | null; displayName?: string | null } | null | undefined;

function slotToTeamRef(slot: InscriptionSlot): TeamRef {
  const id = String(slot?.inscriptionId ?? '').trim();
  const name = String(slot?.displayName ?? '').trim() || '—';
  if (!id) return { id: '', name: '—' };
  return { id, name };
}

/** Desde filas GraphQL (homeAssignedInscription / awayAssignedInscription). */
export function bothTeamsResolvedFromSlots(home: InscriptionSlot, away: InscriptionSlot): boolean {
  return bothMatchTeamsResolved({
    homeTeam: slotToTeamRef(home),
    awayTeam: slotToTeamRef(away),
  });
}
