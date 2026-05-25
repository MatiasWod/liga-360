import { bracketCenterY } from './bracketLayout';
import { parseAnyStageWinnerSlotId } from './eliminationInitHelpers';
import type { TournamentMatchRow } from './types';

export type SlotKey = `${number}-${number}`;

export function slotKey(round: number, slotIndex: number): SlotKey {
	return `${round}-${slotIndex}` as SlotKey;
}

export function parseSlotKey(key: SlotKey): { round: number; slotIndex: number } {
	const [round, slotIndex] = key.split('-').map(Number);
	return { round, slotIndex };
}

export function parseFeederMatchId(raw: string | null | undefined): string | null {
	const id = String(raw ?? '').trim();
	if (!id) return null;
	const parsed = parseAnyStageWinnerSlotId(id);
	if (parsed?.matchId) return parsed.matchId;
	if (id.startsWith('pos:ew:')) return id.slice('pos:ew:'.length).trim() || null;
	return null;
}

function isRealInscriptionId(id: string | null | undefined): boolean {
	const s = String(id ?? '').trim();
	return !!s && !s.startsWith('liga360-slot:') && !s.startsWith('pos:');
}

/** Partidos fuente declarados en inicialización (refs ganador de llave). */
export function feederMatchIdsFromSlot(match: TournamentMatchRow): string[] {
	const out: string[] = [];
	for (const side of [match.homeAssignedInscription, match.awayAssignedInscription]) {
		const mid = parseFeederMatchId(side?.inscriptionId);
		if (mid) out.push(mid);
	}
	return out;
}

function representativeMatchRow(matches: TournamentMatchRow[]): TournamentMatchRow {
	return matches.find((m) => (m.leg ?? 1) === 1) ?? matches[0];
}

function findMatchInRoundByInscription(
	slotMap: Map<number, TournamentMatchRow[]>,
	inscriptionId: string,
): TournamentMatchRow | null {
	for (const [, ms] of slotMap) {
		const rep = representativeMatchRow(ms);
		const hid = String(rep.homeAssignedInscription?.inscriptionId ?? '');
		const aid = String(rep.awayAssignedInscription?.inscriptionId ?? '');
		if (hid === inscriptionId || aid === inscriptionId) return rep;
	}
	return null;
}

type LayoutCtx = {
	roundMap: Map<number, Map<number, TournamentMatchRow[]>>;
	roundNums: number[];
	firstRound: number;
	matchById: Map<string, TournamentMatchRow>;
};

/**
 * Resuelve alimentadores de una llave desde la final hacia atrás:
 * 1) refs `liga360-slot:ew:` / `pos:ew:` (inicialización / semis / final)
 * 2) equipos reales → partido de la ronda anterior donde jugó ese equipo
 * 3) árbol clásico como último recurso
 */
export function resolveFeederSlotKeys(
	match: TournamentMatchRow,
	ctx: LayoutCtx,
): SlotKey[] {
	const roundNum = Number(match.round ?? 1);
	const slotIdx = Number(match.slotIndex ?? 1);
	const roundIndex = ctx.roundNums.indexOf(roundNum);
	if (roundIndex <= 0) return [];

	const prevRound = ctx.roundNums[roundIndex - 1];
	const prevMap = ctx.roundMap.get(prevRound);
	const feeders: SlotKey[] = [];

	for (const side of [match.homeAssignedInscription, match.awayAssignedInscription]) {
		const iid = String(side?.inscriptionId ?? '').trim();
		if (!iid) continue;

		const refMatchId = parseFeederMatchId(iid);
		if (refMatchId) {
			const src = ctx.matchById.get(refMatchId);
			if (src?.round != null && src.slotIndex != null) {
				feeders.push(slotKey(src.round, src.slotIndex));
			}
			continue;
		}

		if (isRealInscriptionId(iid) && prevMap) {
			const src = findMatchInRoundByInscription(prevMap, iid);
			if (src?.round != null && src.slotIndex != null) {
				feeders.push(slotKey(src.round, src.slotIndex));
			}
		}
	}

	const unique = [...new Set(feeders)];
	if (unique.length > 0) return unique;

	if (prevMap) {
		const classic: SlotKey[] = [
			slotKey(prevRound, slotIdx * 2 - 1),
			slotKey(prevRound, slotIdx * 2),
		];
		return classic.filter((k) => {
			const { round, slotIndex } = parseSlotKey(k);
			return ctx.roundMap.get(round)?.has(slotIndex);
		});
	}

	return [];
}

/**
 * Mitad del cuadro por cuarto según inicialización de semis (SF1→QF1+QF4 izq, SF2→QF2+QF3 der).
 */
export function buildQfSideMapFromSemiInit(
	ctx: LayoutCtx,
	qfRound: number,
): Map<number, 'left' | 'right'> {
	const qfSide = new Map<number, 'left' | 'right'>();
	const semiRound = ctx.roundNums.length >= 3 ? ctx.roundNums[ctx.roundNums.length - 2] : null;
	if (semiRound == null || semiRound === qfRound) return qfSide;

	const semiMap = ctx.roundMap.get(semiRound);
	if (!semiMap) return qfSide;
	const maxSf = Math.max(...semiMap.keys());

	for (const [sfSlot, ms] of semiMap) {
		const rep = representativeMatchRow(ms);
		const side: 'left' | 'right' = sfSlot <= maxSf / 2 ? 'left' : 'right';
		for (const fk of resolveFeederSlotKeys(rep, ctx)) {
			const { round, slotIndex } = parseSlotKey(fk);
			if (round === qfRound) qfSide.set(slotIndex, side);
		}
	}
	return qfSide;
}

/**
 * Alimentadores para el árbol visual convergente:
 * - Cuartos: inicialización (P1+P8 → QF1, etc.)
 * - Semis en adelante: refs/init reales de la etapa
 */
export function resolveLayoutFeederSlotKeys(
	match: TournamentMatchRow,
	ctx: LayoutCtx,
): SlotKey[] {
	const roundNum = Number(match.round ?? 1);
	const roundIndex = ctx.roundNums.indexOf(roundNum);
	if (roundIndex <= 0) return [];

	const qfRound = ctx.roundNums[1];
	if (qfRound != null && roundNum === qfRound) {
		return resolveFeederSlotKeys(match, ctx);
	}

	const initFeeders = resolveFeederSlotKeys(match, ctx);
	if (initFeeders.length > 0) return initFeeders;

	const slotIdx = Number(match.slotIndex ?? 1);
	const prevRound = ctx.roundNums[roundIndex - 1];
	const prevMap = ctx.roundMap.get(prevRound);
	if (!prevMap) return [];

	const classic: SlotKey[] = [
		slotKey(prevRound, slotIdx * 2 - 1),
		slotKey(prevRound, slotIdx * 2),
	];
	return classic.filter((k) => {
		const { round, slotIndex } = parseSlotKey(k);
		return ctx.roundMap.get(round)?.has(slotIndex);
	});
}

export type ConvergingLayoutEntry = {
	roundNum: number;
	slotIdx: number;
	matches: TournamentMatchRow[];
	col: number;
	centerY: number;
	isFinalCol: boolean;
};

export type ConvergingLayoutInput = {
	roundMap: Map<number, Map<number, TournamentMatchRow[]>>;
	roundNums: number[];
	baseH: number;
};

export type ConvergingLayoutResult = {
	entries: ConvergingLayoutEntry[];
	feederGraph: Map<SlotKey, SlotKey[]>;
};

/** Espaciado vertical mínimo entre llaves apiladas (altura tarjeta + margen). */
export function convergingBracketBaseH(cardSlotHeight: number, gap = 14): number {
	return Math.max(56, cardSlotHeight + gap);
}

/**
 * Layout convergente derivado del árbol de inicialización (final → semis → cuartos → octavos).
 */
export function buildConvergingBracketLayout(input: ConvergingLayoutInput): ConvergingLayoutResult {
	const { roundMap, roundNums, baseH } = input;
	if (roundNums.length === 0) return { entries: [], feederGraph: new Map() };

	const M = roundNums.length;
	const centerCol = M - 1;
	const firstRound = roundNums[0];

	const matchById = new Map<string, TournamentMatchRow>();
	for (const [, slotMap] of roundMap) {
		for (const [, ms] of slotMap) {
			for (const m of ms) matchById.set(m.id, representativeMatchRow(ms));
		}
	}

	const ctx: LayoutCtx = { roundMap, roundNums, firstRound, matchById };

	const feederGraph = new Map<SlotKey, SlotKey[]>();
	for (let ri = 1; ri < roundNums.length; ri += 1) {
		const roundNum = roundNums[ri];
		const slotMap = roundMap.get(roundNum);
		if (!slotMap) continue;
		for (const [slotIdx, ms] of slotMap) {
			if (slotIdx < 1) continue;
			const rep = representativeMatchRow(ms);
			const key = slotKey(roundNum, slotIdx);
			feederGraph.set(key, resolveLayoutFeederSlotKeys(rep, ctx));
		}
	}

	const centerYBySlot = new Map<SlotKey, number>();
	const sideBySlot = new Map<SlotKey, 'left' | 'right'>();

	// —— Ronda 1: apilar por llave de cuartos (alimentadores reales del grafo) ——
	const r1Map = roundMap.get(firstRound);
	const r2Round = roundNums[1];
	if (r1Map && r2Round != null) {
		const r2Map = roundMap.get(r2Round)!;
		const qfCount = Math.max(...r2Map.keys());
		const qfHalf = Math.ceil(qfCount / 2);
		const qfSideFromInit = buildQfSideMapFromSemiInit(ctx, r2Round);

		const byQf = new Map<number, TournamentMatchRow[]>();
		for (const [qfSlot, ms] of r2Map) {
			const rep = representativeMatchRow(ms);
			const qfKey = slotKey(r2Round, qfSlot);
			const feederKeys = resolveFeederSlotKeys(rep, ctx);
			for (const fk of feederKeys) {
				const { round, slotIndex } = parseSlotKey(fk);
				if (round !== firstRound) continue;
				const r1Ms = r1Map.get(slotIndex);
				if (!r1Ms) continue;
				const repR1 = representativeMatchRow(r1Ms);
				const list = byQf.get(qfSlot) ?? [];
				list.push(repR1);
				byQf.set(qfSlot, list);
			}
		}

		// Fallback si algún octavo no quedó enlazado
		for (const [, ms] of r1Map) {
			const rep = representativeMatchRow(ms);
			const si = rep.slotIndex ?? 1;
			const already = [...byQf.values()].some((group) => group.some((m) => m.id === rep.id));
			if (!already) {
				const qfSlot = Math.ceil(si / 2);
				const list = byQf.get(qfSlot) ?? [];
				list.push(rep);
				byQf.set(qfSlot, list);
			}
		}

		const sideForQf = (qfSlot: number): 'left' | 'right' =>
			qfSideFromInit.get(qfSlot) ?? (qfSlot <= qfHalf ? 'left' : 'right');

		const leftQfSlots = [...byQf.keys()]
			.filter((s) => sideForQf(s) === 'left')
			.sort((a, b) => a - b);
		const rightQfSlots = [...byQf.keys()]
			.filter((s) => sideForQf(s) === 'right')
			.sort((a, b) => b - a);

		let leftVisual = 1;
		for (const qfSlot of leftQfSlots) {
			const group = (byQf.get(qfSlot) ?? []).sort(
				(a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0),
			);
			for (const m of group) {
				const si = m.slotIndex ?? 1;
				const key = slotKey(firstRound, si);
				centerYBySlot.set(key, bracketCenterY(0, leftVisual, baseH));
				sideBySlot.set(key, 'left');
				leftVisual += 1;
			}
		}

		let rightVisual = 1;
		for (const qfSlot of rightQfSlots) {
			const group = (byQf.get(qfSlot) ?? []).sort(
				(a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0),
			);
			for (const m of group) {
				const si = m.slotIndex ?? 1;
				const key = slotKey(firstRound, si);
				centerYBySlot.set(key, bracketCenterY(0, rightVisual, baseH));
				sideBySlot.set(key, 'right');
				rightVisual += 1;
			}
		}
	}

	// —— Rondas 2+ : centro vertical = promedio de alimentadores ——
	for (let ri = 1; ri < roundNums.length; ri += 1) {
		const roundNum = roundNums[ri];
		const slotMap = roundMap.get(roundNum);
		if (!slotMap) continue;
		const maxSlot = Math.max(...slotMap.keys());

		for (const [slotIdx, ms] of slotMap) {
			if (slotIdx < 1) continue;
			const key = slotKey(roundNum, slotIdx);
			const feederKeys = feederGraph.get(key) ?? [];
			const feederYs = feederKeys
				.map((fk) => centerYBySlot.get(fk))
				.filter((y): y is number => y != null);

			const feederSides = feederKeys
				.map((fk) => sideBySlot.get(fk))
				.filter(Boolean) as Array<'left' | 'right'>;

			let centerY: number;
			if (feederYs.length > 0) {
				centerY = feederYs.reduce((a, b) => a + b, 0) / feederYs.length;
			} else {
				centerY = bracketCenterY(
					ri,
					slotIdx <= maxSlot / 2 ? slotIdx : maxSlot - slotIdx + 1,
					baseH,
				);
			}
			centerYBySlot.set(key, centerY);

			if (feederSides.length > 0 && feederSides.every((s) => s === feederSides[0])) {
				sideBySlot.set(key, feederSides[0]);
			} else if (slotIdx <= maxSlot / 2) {
				sideBySlot.set(key, 'left');
			} else {
				sideBySlot.set(key, 'right');
			}
		}
	}

	const entries: ConvergingLayoutEntry[] = [];
	roundNums.forEach((roundNum, ri) => {
		const slotMap = roundMap.get(roundNum)!;
		const isLast = ri === M - 1;
		for (const [slotIdx, matches] of slotMap) {
			if (slotIdx < 1) continue;
			const key = slotKey(roundNum, slotIdx);
			const side = sideBySlot.get(key);
			const col = isLast
				? centerCol
				: side === 'right'
					? 2 * (M - 1) - ri
					: ri;
			entries.push({
				roundNum,
				slotIdx,
				matches,
				col,
				centerY: centerYBySlot.get(key) ?? bracketCenterY(ri, slotIdx, baseH),
				isFinalCol: isLast,
			});
		}
	});

	return { entries, feederGraph };
}
