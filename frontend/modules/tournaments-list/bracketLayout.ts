/** Índice vertical dentro de cada mitad del cuadro (1 = arriba). */
export function bracketVisualSlotIndex(slotIdx: number, maxSlot: number): number {
	const half = maxSlot / 2;
	if (slotIdx <= half) return slotIdx;
	return maxSlot - slotIdx + 1;
}

/** Partidos por mitad en la primera ronda (P/2 slots → P/4 por lado). */
export function bracketSlotsPerSide(firstRoundMaxSlot: number): number {
	return Math.max(1, Math.floor(firstRoundMaxSlot / 2));
}

/** Posición Y del centro de una llave en el árbol (roundIndex 0-based). */
export function bracketCenterY(
	roundIndex: number,
	visualSlot: number,
	baseH: number,
): number {
	const ri = roundIndex + 1;
	return baseH * (2 * visualSlot - 1) * Math.pow(2, ri - 2);
}

const BRACKET_TEAM_ROW_H = 26;
const BRACKET_VUELTA_H = 20;

/** Altura estimada de una tarjeta de llave (ida / vuelta). */
export function bracketMatchSlotHeight(legCount: number): number {
	if (legCount <= 0) return BRACKET_TEAM_ROW_H * 2;
	let h = 0;
	for (let i = 0; i < legCount; i += 1) {
		if (i > 0) h += BRACKET_VUELTA_H;
		h += BRACKET_TEAM_ROW_H * 2;
	}
	return h;
}

export type BracketLayoutEntry = {
	centerY: number;
	legCount: number;
};

/** Altura mínima del árbol según posiciones reales (evita scroll vertical vacío). */
export function bracketTreeContentHeight(
	entries: BracketLayoutEntry[],
	labelH: number,
	cardHalfH: number,
): number {
	let maxBottom = labelH;
	for (const entry of entries) {
		const top = Math.max(labelH, labelH + entry.centerY - cardHalfH);
		maxBottom = Math.max(maxBottom, top + bracketMatchSlotHeight(entry.legCount));
	}
	return maxBottom;
}
