import { describe, expect, it } from 'vitest';
import {
	buildConvergingBracketLayout,
	buildQfSideMapFromSemiInit,
	convergingBracketBaseH,
	feederMatchIdsFromSlot,
	resolveFeederSlotKeys,
	resolveLayoutFeederSlotKeys,
	slotKey,
} from '../../../modules/tournaments-list/convergingBracketLayout';
import { bracketMatchSlotHeight } from '../../../modules/tournaments-list/bracketLayout';
import type { TournamentMatchRow } from '../../../modules/tournaments-list/types';

function m(partial: Partial<TournamentMatchRow> & { id: string }): TournamentMatchRow {
	return { round: 1, leg: 1, slotIndex: 1, status: 'scheduled', ...partial };
}

function buildCtx(roundMap: Map<number, Map<number, TournamentMatchRow[]>>, roundNums: number[]) {
	const matchById = new Map<string, TournamentMatchRow>();
	for (const [, slotMap] of roundMap) {
		for (const [, ms] of slotMap) {
			matchById.set(ms[0].id, ms[0]);
		}
	}
	return {
		roundMap,
		roundNums,
		firstRound: roundNums[0],
		matchById,
	};
}

describe('convergingBracketLayout', () => {
	it('apila P1 y P8 en la misma mitad cuando ambos alimentan P1R2', () => {
		const stageId = 's1';
		const m1 = m({
			id: 'm1',
			round: 1,
			slotIndex: 1,
			homeAssignedInscription: { inscriptionId: 'a', displayName: 'A' },
			awayAssignedInscription: { inscriptionId: 'b', displayName: 'B' },
		});
		const m8 = m({
			id: 'm8',
			round: 1,
			slotIndex: 8,
			homeAssignedInscription: { inscriptionId: 'h', displayName: 'H' },
			awayAssignedInscription: { inscriptionId: 'i', displayName: 'I' },
		});
		const m2 = m({ id: 'm2', round: 1, slotIndex: 2 });
		const m7 = m({ id: 'm7', round: 1, slotIndex: 7 });
		const qf1 = m({
			id: 'qf1',
			round: 2,
			slotIndex: 1,
			homeAssignedInscription: {
				inscriptionId: `liga360-slot:ew:${stageId}:m1`,
				displayName: 'G1',
			},
			awayAssignedInscription: {
				inscriptionId: `liga360-slot:ew:${stageId}:m8`,
				displayName: 'G8',
			},
		});

		expect(feederMatchIdsFromSlot(qf1)).toEqual(['m1', 'm8']);

		const roundMap = new Map<number, Map<number, TournamentMatchRow[]>>([
			[1, new Map([
				[1, [m1]], [2, [m2]], [7, [m7]], [8, [m8]],
			])],
			[2, new Map([[1, [qf1]]])],
		]);

		const { entries } = buildConvergingBracketLayout({
			roundMap,
			roundNums: [1, 2],
			baseH: 68,
		});

		const r1m1 = entries.find((e) => e.roundNum === 1 && e.slotIdx === 1)!;
		const r1m8 = entries.find((e) => e.roundNum === 1 && e.slotIdx === 8)!;
		const qf1e = entries.find((e) => e.roundNum === 2 && e.slotIdx === 1)!;

		expect(r1m1.col).toBe(r1m8.col);
		expect(r1m1.col).toBe(0);
		expect(r1m8.centerY).toBeGreaterThan(r1m1.centerY);
		expect(qf1e.centerY).toBeCloseTo((r1m1.centerY + r1m8.centerY) / 2, 0);
		expect(qf1e.col).toBe(1);
	});

	it('ordena octavos 1+8, 2+7 izquierda y 3+6, 4+5 derecha (init clásica)', () => {
		const stageId = 's1';
		const mkR1 = (id: string, si: number) =>
			m({ id, round: 1, slotIndex: si });
		const mkQf = (
			id: string,
			si: number,
			homeId: string,
			awayId: string,
		) =>
			m({
				id,
				round: 2,
				slotIndex: si,
				homeAssignedInscription: {
					inscriptionId: `liga360-slot:ew:${stageId}:${homeId}`,
					displayName: `G${homeId}`,
				},
				awayAssignedInscription: {
					inscriptionId: `liga360-slot:ew:${stageId}:${awayId}`,
					displayName: `G${awayId}`,
				},
			});

		const roundMap = new Map<number, Map<number, TournamentMatchRow[]>>([
			[
				1,
				new Map([
					[1, [mkR1('m1', 1)]],
					[2, [mkR1('m2', 2)]],
					[3, [mkR1('m3', 3)]],
					[4, [mkR1('m4', 4)]],
					[5, [mkR1('m5', 5)]],
					[6, [mkR1('m6', 6)]],
					[7, [mkR1('m7', 7)]],
					[8, [mkR1('m8', 8)]],
				]),
			],
			[
				2,
				new Map([
					[1, [mkQf('qf1', 1, 'm1', 'm8')]],
					[2, [mkQf('qf2', 2, 'm2', 'm7')]],
					[3, [mkQf('qf3', 3, 'm3', 'm6')]],
					[4, [mkQf('qf4', 4, 'm4', 'm5')]],
				]),
			],
		]);

		const { entries } = buildConvergingBracketLayout({
			roundMap,
			roundNums: [1, 2],
			baseH: 68,
		});

		const col = (r: number, s: number) =>
			entries.find((e) => e.roundNum === r && e.slotIdx === s)!.col;
		const y = (r: number, s: number) =>
			entries.find((e) => e.roundNum === r && e.slotIdx === s)!.centerY;

		expect(col(1, 1)).toBe(col(1, 8));
		expect(col(1, 2)).toBe(col(1, 7));
		expect(col(1, 3)).toBe(col(1, 6));
		expect(col(1, 4)).toBe(col(1, 5));
		expect(col(1, 1)).toBe(0);
		expect(col(1, 3)).toBe(2 * (2 - 1) - 0);

		expect(y(1, 8)).toBeGreaterThan(y(1, 1));
		expect(y(1, 7)).toBeGreaterThan(y(1, 2));
		expect(y(2, 1)).toBeCloseTo((y(1, 1) + y(1, 8)) / 2, 0);
	});

	it('cuartos con equipos reales traza octavos P1+P8 vía inscripción (datos reales)', () => {
		const stageId = 's-elim';
		const m1 = m({
			id: 'm1',
			round: 1,
			slotIndex: 1,
			homeAssignedInscription: { inscriptionId: '121', displayName: 'Argentina' },
			awayAssignedInscription: { inscriptionId: '126', displayName: 'Brasil' },
		});
		const m8 = m({
			id: 'm8',
			round: 1,
			slotIndex: 8,
			homeAssignedInscription: { inscriptionId: '147', displayName: 'Portugal' },
			awayAssignedInscription: { inscriptionId: '150', displayName: 'Suiza' },
		});
		const qf1 = m({
			id: 'qf1',
			round: 2,
			slotIndex: 1,
			homeAssignedInscription: { inscriptionId: '121', displayName: 'Argentina' },
			awayAssignedInscription: { inscriptionId: '147', displayName: 'Portugal' },
		});
		const sf1 = m({
			id: 'sf1',
			round: 3,
			slotIndex: 1,
			homeAssignedInscription: {
				inscriptionId: `liga360-slot:ew:${stageId}:qf1`,
				displayName: 'Ganador Partido 1 - Eliminatorias',
			},
			awayAssignedInscription: {
				inscriptionId: `liga360-slot:ew:${stageId}:qf4`,
				displayName: 'Ganador Partido 4 - Eliminatorias',
			},
		});

		const roundMap = new Map<number, Map<number, TournamentMatchRow[]>>([
			[1, new Map([[1, [m1]], [8, [m8]]])],
			[2, new Map([[1, [qf1]]])],
			[3, new Map([[1, [sf1]]])],
		]);
		const roundNums = [1, 2, 3];
		const ctx = buildCtx(roundMap, roundNums);

		expect(resolveFeederSlotKeys(qf1, ctx)).toEqual([slotKey(1, 1), slotKey(1, 8)]);
		expect(resolveFeederSlotKeys(sf1, ctx)).toEqual([slotKey(2, 1)]);

		const { entries } = buildConvergingBracketLayout({ roundMap, roundNums, baseH: 68 });
		const r1m1 = entries.find((e) => e.roundNum === 1 && e.slotIdx === 1)!;
		const r1m8 = entries.find((e) => e.roundNum === 1 && e.slotIdx === 8)!;
		const qf1e = entries.find((e) => e.roundNum === 2 && e.slotIdx === 1)!;

		expect(r1m1.col).toBe(r1m8.col);
		expect(r1m8.centerY).toBeGreaterThan(r1m1.centerY);
		expect(qf1e.centerY).toBeCloseTo((r1m1.centerY + r1m8.centerY) / 2, 0);
	});

	it('árbol visual: mitades según init de semis (QF1+QF4 izq, QF2+QF3 der)', () => {
		const mk = (
			id: string,
			r: number,
			s: number,
			h: string,
			hn: string,
			a: string,
			an: string,
		) =>
			m({
				id,
				round: r,
				slotIndex: s,
				homeAssignedInscription: { inscriptionId: h, displayName: hn },
				awayAssignedInscription: { inscriptionId: a, displayName: an },
			});

		const roundMap = new Map<number, Map<number, TournamentMatchRow[]>>([
			[
				1,
				new Map([
					[1, [mk('m1', 1, 1, '121', 'Argentina', '126', 'Brasil')]],
					[2, [mk('m2', 1, 2, '124', 'Alemania', '127', 'Camerun')]],
					[3, [mk('m3', 1, 3, '129', 'Corea', '134', 'Ecuador')]],
					[4, [mk('m4', 1, 4, '131', 'Catar', '133', 'Dinamarca')]],
					[5, [mk('m5', 1, 5, '140', 'Inglaterra', '141', 'Iran')]],
					[6, [mk('m6', 1, 6, '139', 'Ghana', '142', 'Japon')]],
					[7, [mk('m7', 1, 7, '148', 'Senegal', '149', 'Serbia')]],
					[8, [mk('m8', 1, 8, '147', 'Portugal', '150', 'Suiza')]],
				]),
			],
			[
				2,
				new Map([
					[1, [mk('qf1', 2, 1, '121', 'Argentina', '147', 'Portugal')]],
					[2, [mk('qf2', 2, 2, '124', 'Alemania', '148', 'Senegal')]],
					[3, [mk('qf3', 2, 3, '134', 'Ecuador', '142', 'Japon')]],
					[4, [mk('qf4', 2, 4, '131', 'Catar', '140', 'Inglaterra')]],
				]),
			],
			[
				3,
				new Map([
					[1, [mk('sf1', 3, 1, '121', 'Argentina', '140', 'Inglaterra')]],
					[2, [mk('sf2', 3, 2, '124', 'Alemania', '134', 'Ecuador')]],
				]),
			],
			[
				4,
				new Map([
					[
						1,
						[
							mk('f1', 4, 1, 'liga360-slot:ew:s:sf1', 'G1', 'liga360-slot:ew:s:sf2', 'G2'),
						],
					],
				]),
			],
		]);
		const roundNums = [1, 2, 3, 4];
		const ctx = buildCtx(roundMap, roundNums);

		expect(resolveFeederSlotKeys(roundMap.get(3)!.get(1)![0], ctx)).toEqual([
			slotKey(2, 1),
			slotKey(2, 4),
		]);
		expect(resolveLayoutFeederSlotKeys(roundMap.get(3)!.get(1)![0], ctx)).toEqual([
			slotKey(2, 1),
			slotKey(2, 4),
		]);
		expect(resolveLayoutFeederSlotKeys(roundMap.get(3)!.get(2)![0], ctx)).toEqual([
			slotKey(2, 2),
			slotKey(2, 3),
		]);

		const qfSide = buildQfSideMapFromSemiInit(ctx, 2);
		expect(qfSide.get(1)).toBe('left');
		expect(qfSide.get(4)).toBe('left');
		expect(qfSide.get(2)).toBe('right');
		expect(qfSide.get(3)).toBe('right');

		const { entries } = buildConvergingBracketLayout({ roundMap, roundNums, baseH: 68 });
		const col = (r: number, s: number) =>
			entries.find((e) => e.roundNum === r && e.slotIdx === s)!.col;

		// P4+P5 (QF4) abajo a la izquierda; P2+P7 (QF2) abajo a la derecha
		expect(col(1, 1)).toBe(0);
		expect(col(1, 8)).toBe(0);
		expect(col(1, 4)).toBe(0);
		expect(col(1, 5)).toBe(0);
		expect(col(1, 2)).toBe(6);
		expect(col(1, 7)).toBe(6);
		expect(col(2, 1)).toBe(1);
		expect(col(2, 4)).toBe(1);
		expect(col(2, 2)).toBe(5);
		expect(col(2, 3)).toBe(5);
	});

	it('convergingBracketBaseH evita solapamiento entre tarjetas apiladas', () => {
		const cardH = 14 + bracketMatchSlotHeight(1);
		expect(convergingBracketBaseH(cardH)).toBeGreaterThanOrEqual(cardH);
	});

	it('slotKey formatea ronda y slot', () => {
		expect(slotKey(2, 3)).toBe('2-3');
	});
});
