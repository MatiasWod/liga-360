/** Etiquetas sintéticas de UI — no son nombres de equipo. */
export function isPlaceholderParticipantLabel(raw) {
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

/** ID de inscripción real (no ref pos:/liga360-slot:). */
export function isPhysicalInscriptionId(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  if (s.startsWith('liga360-slot:')) return false;
  if (s.startsWith('pos:')) return false;
  return true;
}

/** Elige fila de tabla con equipo real (excluye refs sintéticos duplicados). */
export function pickPhysicalStandingsRow(standings, position) {
  const pos = Number(position);
  if (!Number.isFinite(pos) || pos < 1) return null;
  const physical = (standings || []).filter((r) =>
    isPhysicalInscriptionId(String(r?.inscriptionId ?? ''))
  );
  const row = physical.find((r) => Number(r.position) === pos);
  if (!row) return null;
  const dn = String(row.displayName ?? '').trim();
  if (!dn || isPlaceholderParticipantLabel(dn)) return null;
  return row;
}
