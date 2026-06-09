import { isPhysicalInscriptionId, isPlaceholderParticipantLabel } from '../shared/participantLabels.js';

export function nextPowerOf2(n) {
  const x = Number(n);
  if (!Number.isInteger(x) || x < 1) return 2;
  let p = 1;
  while (p < x) p <<= 1;
  return p;
}

export function eliminationMatchSlots(bracketSize) {
  const P = Number(bracketSize);
  if (!Number.isInteger(P) || P < 2 || (P & (P - 1)) !== 0) {
    throw new Error('bracketSize debe ser potencia de 2 >= 2');
  }
  const R = Math.log2(P);
  const out = [];
  for (let r = 1; r <= R; r += 1) {
    const count = P / 2 ** r;
    for (let s = 1; s <= count; s += 1) {
      out.push({ round: r, slotIndex: s });
    }
  }
  return out;
}

export function eliminationMatchCount(bracketSize) {
  return bracketSize - 1;
}

/** Código de fixture eliminatorio: P{partido}R{ronda} (p. ej. P1R1, P3R2-L2 en ida y vuelta). */
export function eliminationFixtureCode(slotIndex, round, leg = 1, options = {}) {
  const si = Math.max(1, Math.trunc(Number(slotIndex) || 1));
  const r = Math.max(1, Math.trunc(Number(round) || 1));
  const lg = Math.max(1, Math.trunc(Number(leg) || 1));
  const base = `P${si}R${r}`;
  if (options.doubleRound && lg > 1) return `${base}-L${lg}`;
  return base;
}

/** Código legible P{n}R{m} desde props de Match (normaliza legacy E{r}-M{n}). */
export function formatEliminationMatchCodeFromProps(m) {
  const fc = String(m?.fixtureCode || '').trim();
  if (fc) {
    const legacy = /^E(\d+)-M(\d+)/i.exec(fc);
    if (legacy) return eliminationFixtureCode(Number(legacy[2]), Number(legacy[1]));
    return fc.replace(/-L\d+$/i, '');
  }
  const si = Math.max(1, Math.trunc(Number(m?.slotIndex) || 1));
  const r = Math.max(1, Math.trunc(Number(m?.round) || 1));
  return eliminationFixtureCode(si, r);
}

/** Config de eliminatoria desde configJson de la etapa (+ fallback del argumento legacy). */
export function resolveEliminationBracketConfig(stageCfg = {}, mutationDoubleRound = false) {
  const matchesPerTie =
    stageCfg.matchesPerTie === 'double'
      ? 'double'
      : stageCfg.matchesPerTie === 'single'
        ? 'single'
        : mutationDoubleRound
          ? 'double'
          : 'single';
  const finalMatchesPerTie =
    stageCfg.finalMatchesPerTie === 'double'
      ? 'double'
      : stageCfg.finalMatchesPerTie === 'single'
        ? 'single'
        : matchesPerTie === 'double'
          ? 'single'
          : 'single';
  const thirdPlace = stageCfg.thirdPlace === 'yes';
  const numAdvancing = Number(stageCfg.numAdvancing);
  return {
    matchesPerTie,
    finalMatchesPerTie,
    thirdPlace,
    numAdvancing: Number.isInteger(numAdvancing) && numAdvancing > 0 ? numAdvancing : 1,
  };
}

/** Ronda máxima del cuadro (número de ronda del partido final). */
export function eliminationMaxRound(slots) {
  if (!slots?.length) return 0;
  return Math.max(...slots.map((s) => Number(s.round) || 0));
}

/** ¿Esta llave se juega ida y vuelta según config? */
export function isEliminationSlotDoubleLeg(round, maxRound, cfg) {
  const r = Math.max(1, Math.trunc(Number(round) || 1));
  const maxR = Math.max(1, Math.trunc(Number(maxRound) || 1));
  const isFinal = r === maxR;
  if (isFinal) return cfg.finalMatchesPerTie === 'double';
  return cfg.matchesPerTie === 'double';
}

/** Piernas a generar para una llave (1 o 2). */
export function legsForEliminationSlot(round, maxRound, cfg) {
  return isEliminationSlotDoubleLeg(round, maxRound, cfg) ? [1, 2] : [1];
}

/** ¿Crear partido de tercer puesto? (semis+ y un solo campeón). */
export function shouldCreateThirdPlaceMatch(maxRound, cfg) {
  if (!cfg.thirdPlace) return false;
  if (cfg.numAdvancing !== 1) return false;
  return maxRound >= 2;
}

/** slotIndex reservado para tercer puesto (no compite en el árbol principal). */
export const THIRD_PLACE_SLOT_INDEX = 0;

export function isThirdPlaceMatchProps(m) {
  const kind = String(m?.matchKind ?? '').toLowerCase();
  if (kind === 'third_place') return true;
  const si = Number(m?.slotIndex);
  const fc = String(m?.fixtureCode ?? '').trim().toUpperCase();
  return si === THIRD_PLACE_SLOT_INDEX && (fc === '3P' || fc.startsWith('3P-'));
}

/**
 * Posiciones 0..P-1 en la primera ronda (llave clásica): partido slotIndex (1-based) une índice (slot-1) con (P-slot).
 */
export function eliminationFirstRoundBracketPositions(bracketSize, slotIndex1Based) {
  const P = Number(bracketSize);
  const s = Number(slotIndex1Based);
  if (!Number.isInteger(P) || P < 2 || (P & (P - 1)) !== 0) {
    throw new Error('bracketSize debe ser potencia de 2 >= 2');
  }
  if (!Number.isInteger(s) || s < 1 || s > P / 2) {
    throw new Error('slotIndex fuera de rango para la primera ronda');
  }
  return { idxA: s - 1, idxB: P - s };
}

function buildCanonicalSideKey(nameToPhysical, id, displayName) {
  const sid = String(id ?? '').trim();
  const dn = String(displayName ?? '').trim();
  if (isPhysicalInscriptionId(sid)) return sid;
  const dnLower = dn.toLowerCase();
  if (dnLower && nameToPhysical.has(dnLower)) return nameToPhysical.get(dnLower);
  if (dn && !isPlaceholderParticipantLabel(dn)) return `dn:${dnLower}`;
  return null;
}

/** Agrega goles por equipo a lo largo de las patas (ida/vuelta). Unifica refs pos:/liga360-slot: con ids físicos por nombre. */
export function aggregateEliminationSeriesScores(legs) {
  const nameToPhysical = new Map();
  for (const leg of legs || []) {
    for (const side of [
      { id: leg.homeInscriptionId, name: leg.homeDisplayName },
      { id: leg.awayInscriptionId, name: leg.awayDisplayName },
    ]) {
      const id = String(side.id ?? '').trim();
      const name = String(side.name ?? '').trim();
      if (isPhysicalInscriptionId(id) && name && !isPlaceholderParticipantLabel(name)) {
        nameToPhysical.set(name.toLowerCase(), id);
      }
    }
  }

  const scoreMap = new Map();
  for (const leg of legs || []) {
    const hs = leg.homeScore != null ? Number(leg.homeScore) : null;
    const as_ = leg.awayScore != null ? Number(leg.awayScore) : null;
    if (hs == null || as_ == null || !Number.isFinite(hs) || !Number.isFinite(as_)) continue;
    const sides = [
      { id: leg.homeInscriptionId, score: hs, displayName: leg.homeDisplayName },
      { id: leg.awayInscriptionId, score: as_, displayName: leg.awayDisplayName },
    ];
    for (const s of sides) {
      const key = buildCanonicalSideKey(nameToPhysical, s.id, s.displayName);
      if (!key) continue;
      const dn = String(s.displayName ?? '').trim();
      const prev = scoreMap.get(key) || { score: 0, displayName: dn };
      prev.score += s.score;
      if (dn && !isPlaceholderParticipantLabel(dn)) prev.displayName = dn;
      scoreMap.set(key, prev);
    }
  }
  return scoreMap;
}

/** Elige ganador de serie por goles agregados (null si empate, datos insuficientes o un solo equipo). */
export function pickSeriesWinnerFromScoreMap(scoreMap) {
  const entries = [...scoreMap.entries()].sort((a, b) => b[1].score - a[1].score);
  if (entries.length < 2) return null;
  if (entries[0][1].score === entries[1][1].score) return null;
  return { inscriptionId: entries[0][0], score: entries[0][1].score, displayName: entries[0][1].displayName };
}
