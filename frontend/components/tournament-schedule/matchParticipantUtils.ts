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
  if (/^BN\d+$/i.test(s)) return true;
  if (/^liga360-slot:/i.test(s) || /^pos:/i.test(s)) return true;
  if (/sin asignar/i.test(s)) return true;
  if (/pendiente/i.test(s)) return true;
  return false;
}

export function isByeMatchTeam(team: TeamRef): boolean {
  return String(team.id || '').trim().startsWith('__bye-');
}

export function isByeMatchRecord(match: Pick<MatchRecord, 'homeTeam' | 'awayTeam'>): boolean {
  return isByeMatchTeam(match.homeTeam) || isByeMatchTeam(match.awayTeam);
}

function isRealInscriptionId(id: string | null | undefined): boolean {
  const s = String(id ?? '').trim();
  return !!s && !s.startsWith('liga360-slot:') && !s.startsWith('pos:');
}

type ByeSlotOptions = {
  matchKind?: string | null;
  stageFormat?: string | null;
};

/** Partido con fecha libre: un solo equipo real y el otro slot vacío. */
export function isByeFromInscriptionSlots(
  home: InscriptionSlot,
  away: InscriptionSlot,
  options?: ByeSlotOptions
): boolean {
  const homeId = home?.inscriptionId;
  const awayId = away?.inscriptionId;
  const partial =
    (isRealInscriptionId(homeId) && !awayId) || (isRealInscriptionId(awayId) && !homeId);
  if (!partial) return false;
  if (String(options?.matchKind || '').toLowerCase() === 'bye') return true;
  // En eliminatoria, un slot vacío durante la inicialización no es bye hasta que el backend lo marque.
  if (String(options?.stageFormat || '').toLowerCase() === 'elimination') return false;
  return true;
}

/** Equipo asignado y listo para jugar: nombre real (aunque el id siga siendo ref de slot). */
export function isResolvedMatchTeam(team: TeamRef): boolean {
  const id = String(team.id || '').trim();
  const name = String(team.name || '').trim();
  if (!name || name === '—') return false;
  if (id.startsWith('__empty-') || id.startsWith('__bye-')) return false;
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

/** Nombre para bracket público: vacío si aún no hay equipo asignado (sin "Ganador Partido…"). */
export function bracketPublicTeamName(
  slot: InscriptionSlot,
  nameById?: ReadonlyMap<string, string>,
): string {
  const id = String(slot?.inscriptionId ?? '').trim();
  const rawName = String(slot?.displayName ?? '').trim();
  const fromLookup = id ? String(nameById?.get(id) ?? '').trim() : '';
  const name =
    rawName && !isPlaceholderParticipantLabel(rawName)
      ? rawName
      : fromLookup || rawName;
  const team = slotToTeamRef({ inscriptionId: id || null, displayName: name || null });
  if (!isResolvedMatchTeam(team)) return '';
  return team.name;
}
