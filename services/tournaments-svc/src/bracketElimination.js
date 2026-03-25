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
