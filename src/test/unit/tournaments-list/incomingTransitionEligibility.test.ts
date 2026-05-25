import { describe, expect, it } from 'vitest';
import {
  deriveEligibleInscriptionsFromIncomingTransitions,
  collectIncomingTransitionRows,
  enrichEligibleWithRealTeamNames,
} from '../../../modules/tournaments-list/incomingTransitionEligibility';
import type { TournamentEntity, TournamentStage } from '../../../modules/tournaments-list/types';

describe('incomingTransitionEligibility', () => {
  it('grupos: rango 9–16 por grupo agrupa todas las ids', () => {
    const fromStageId = 'g-stage';
    const toStageId = 'rep-stage';

    const groupsStage = {
      id: fromStageId,
      name: 'Fase grupos',
      order: 1,
      format: 'groups' as const,
      groups: [
        {
          id: 'g-a',
          name: 'Grupo A',
          order: 1,
          standings: [
            { position: 8, inscriptionId: 'x1', displayName: 'Early', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
            { position: 9, inscriptionId: 'a9', displayName: 'A9', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
            { position: 16, inscriptionId: 'a16', displayName: 'A16', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
            { position: 17, inscriptionId: 'x2', displayName: 'Late', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
          ],
        },
        {
          id: 'g-b',
          name: 'Grupo B',
          order: 2,
          standings: [
            { position: 9, inscriptionId: 'b9', displayName: 'B9', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
            { position: 15, inscriptionId: 'b15', displayName: 'B15', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
          ],
        },
      ],
      transitions: [
        {
          id: 'tr-1',
          toStageId: toStageId,
          selectionKind: 'range',
          rangeFrom: 9,
          rangeTo: 16,
        },
      ],
    };

    const repStage = {
      id: toStageId,
      name: 'Repechaje',
      order: 2,
      format: 'elimination' as const,
      transitions: [],
    };

    const tournament: TournamentEntity = {
      id: 't1',
      name: 'T',
      competitions: [
        {
          id: 'c1',
          name: 'C',
          order: 1,
          stages: [groupsStage as unknown as TournamentStage, repStage as unknown as TournamentStage],
        },
      ],
    };

    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, toStageId);
    expect(out).toHaveLength(16);

    const a9 = out.find((o) => o.resolvedRealId === 'a9' || o.inscriptionId === 'pos:sg:g-stage:g-a:9');
    expect(a9?.shortLabel).toBe('P9G1');
    expect(a9?.source).toBe('groups');
    expect(a9?.sectionTitle).toBe('T · C · Fase grupos · desde grupos');
    expect(a9?.optionLabel).toBe('T · C · Fase grupos · Grupo A · posición 9 · A9');
    const b9 = out.find((o) => o.resolvedRealId === 'b9' || o.inscriptionId === 'pos:sg:g-stage:g-b:9');
    expect(b9?.shortLabel).toBe('P9G2');
    expect(b9?.optionLabel).toBe('T · C · Fase grupos · Grupo B · posición 9 · B9');

    const g1Synth = out.find((o) => o.inscriptionId === 'pos:sg:g-stage:g-a:10');
    expect(g1Synth?.inscriptionId).toMatch(/^pos:sg:/);
    expect(g1Synth?.displayName).toBe('Clasificación pendiente');
    expect(g1Synth?.shortLabel).toBe('P10G1');
    expect(g1Synth?.optionLabel).toBe('T · C · Fase grupos · Grupo A · posición 10 · Clasificación pendiente');

    const rows = collectIncomingTransitionRows(tournament, toStageId);
    expect(rows).toHaveLength(1);
  });

  it('liga: rango global único', () => {
    const toStageId = 'elim';
    const league: Partial<TournamentStage> = {
      id: 'league-s',
      name: 'Liga',
      order: 1,
      format: 'league',
      standings: [
        { position: 1, inscriptionId: 'p1', displayName: 'Uno', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { position: 10, inscriptionId: 'p10', displayName: 'Diez', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
        { position: 11, inscriptionId: 'p11', displayName: 'Once', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
      ],
      transitions: [{ id: 't2', toStageId: toStageId, selectionKind: 'range', rangeFrom: 10, rangeTo: 11 }],
    };

    const target: Partial<TournamentStage> = {
      id: toStageId,
      name: 'Elim',
      order: 2,
      format: 'elimination',
      transitions: [],
    };

    const tournament: TournamentEntity = {
      id: 't',
      name: 'T',
      competitions: [{ id: 'c', name: 'C', order: 1, stages: [league as TournamentStage, target as TournamentStage] }],
    };

    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, toStageId);
    expect(out.map((x) => x.inscriptionId).sort()).toEqual(['pos:l:league-s:10', 'pos:l:league-s:11']);

    expect(out.find((x) => x.resolvedRealId === 'p10')?.optionLabel).toBe('T · C · Liga · tabla general P10 · Diez');
    expect(out.find((x) => x.resolvedRealId === 'p10')?.shortLabel).toBe('P10');
    expect(out.find((x) => x.resolvedRealId === 'p10')?.sectionTitle).toBe('T · C · Liga · desde liga');
    expect(out.find((x) => x.resolvedRealId === 'p11')?.optionLabel).toBe('T · C · Liga · tabla general P11 · Once');
  });

  it('elimination: sin partidos con transición vinculada no aporta filas', () => {
    const toId = 's2';
    const from: Partial<TournamentStage> = {
      id: 'e1',
      name: 'Elim',
      order: 1,
      format: 'elimination',
      standings: [],
      transitions: [{ id: 't', toStageId: toId, selectionKind: 'top', topN: 2 }],
    };
    const to: Partial<TournamentStage> = { id: toId, name: 'Sig', order: 2, format: 'elimination', transitions: [] };
    const tournament: TournamentEntity = {
      id: 't',
      name: 'T',
      competitions: [{ id: 'c', name: 'C', order: 1, stages: [from as TournamentStage, to as TournamentStage] }],
    };
    expect(deriveEligibleInscriptionsFromIncomingTransitions(tournament, toId)).toEqual([]);
  });

  it('elimination: lista ganadores de partidos con destino de ganador = transición hacia etapa', () => {
    const trToNext = 'trans-to-rep';
    const fromId = 'elim-from';
    const toId = 'rep';
    const elimFrom: Partial<TournamentStage> = {
      id: fromId,
      name: 'Cuartos',
      order: 1,
      format: 'elimination',
      standings: [],
      matches: [
        {
          id: 'm1',
          round: 3,
          leg: 1,
          slotIndex: 1,
          winnerAdvancementTransitionId: trToNext,
          homeAssignedInscription: { inscriptionId: 'h1', displayName: 'H1' },
          awayAssignedInscription: { inscriptionId: 'aw1', displayName: 'A1' },
        },
        {
          id: 'm2',
          round: 3,
          slotIndex: 2,
          winnerAdvancementTransitionId: trToNext,
          homeAssignedInscription: { inscriptionId: 'h2', displayName: 'H2' },
          awayAssignedInscription: null,
        },
      ],
      transitions: [{ id: trToNext, toStageId: toId, selectionKind: 'range', rangeFrom: 1, rangeTo: 16 }],
    };
    const rep: Partial<TournamentStage> = {
      id: toId,
      name: 'Repechaje',
      order: 2,
      format: 'elimination',
      transitions: [],
    };
    const tournament: TournamentEntity = {
      id: 'tv',
      name: 'Tv',
      competitions: [{ id: 'cup', name: 'Copa', order: 1, stages: [elimFrom as TournamentStage, rep as TournamentStage] }],
    };
    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, toId);
    expect(out.map((x) => x.inscriptionId).sort()).toEqual(
      [`liga360-slot:ew:${fromId}:m1`, `liga360-slot:ew:${fromId}:m2`].sort()
    );
    const w1 = out.find((x) => x.inscriptionId === `liga360-slot:ew:${fromId}:m1`);
    expect(w1?.shortLabel).toBe('P1R3');
    expect(w1?.source).toBe('elimination');
    expect(w1?.displayName).toBe('Ganador Partido 1 - Cuartos — pendiente');
    expect(w1?.sectionTitle).toContain('desde eliminatoria');
    expect(w1?.optionLabel).toBe('Tv · Copa · Cuartos · Ganador Partido 1 - Cuartos');
  });

  it('elimination: sin winnerAdvancement por partido aún muestra llaves cuando no hay otros vínculos', () => {
    const trToNext = 'trans-to-liguilla';
    const fromId = 'elim-from';
    const toId = 'liguilla';
    const elimFrom: Partial<TournamentStage> = {
      id: fromId,
      name: 'Repechaje',
      order: 1,
      format: 'elimination',
      standings: [],
      matches: [
        {
          id: 'm1',
          round: 2,
          leg: 1,
          slotIndex: 1,
          homeAssignedInscription: { inscriptionId: 'a1', displayName: 'A1' },
          awayAssignedInscription: { inscriptionId: 'b1', displayName: 'B1' },
        },
        {
          id: 'm2',
          round: 2,
          leg: 1,
          slotIndex: 2,
          homeAssignedInscription: { inscriptionId: 'c1', displayName: 'C1' },
          awayAssignedInscription: null,
        },
      ],
      transitions: [{ id: trToNext, toStageId: toId, selectionKind: 'range', rangeFrom: 1, rangeTo: 4 }],
    };
    const target: Partial<TournamentStage> = {
      id: toId,
      name: 'Liguilla',
      order: 2,
      format: 'league',
      transitions: [],
    };
    const tournament: TournamentEntity = {
      id: 'tctx',
      name: 'Mx',
      competitions: [{ id: 'c', name: 'Cup', order: 1, stages: [elimFrom as TournamentStage, target as TournamentStage] }],
    };
    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, toId);
    expect(out.some((x) => x.inscriptionId === `liga360-slot:ew:${fromId}:m1` && x.source === 'elimination')).toBe(true);
    expect(out.some((x) => x.inscriptionId === `liga360-slot:ew:${fromId}:m2`)).toBe(true);
  });

  it('elimination: repechaje Champions 16→8 expone 8 ganadores de ronda 1 aunque existan rondas posteriores', () => {
    const trToElim = 'trans-to-elim';
    const repechajeId = 'rep-stage';
    const elimId = 'elim-stage';

    const round1Matches = Array.from({ length: 8 }, (_, i) => {
      const slot = i + 1;
      return [
        { id: `r1s${slot}l1`, round: 1, leg: 1, slotIndex: slot },
        { id: `r1s${slot}l2`, round: 1, leg: 2, slotIndex: slot },
      ];
    }).flat();

    const repechaje: Partial<TournamentStage> = {
      id: repechajeId,
      name: 'Repechaje',
      order: 2,
      format: 'elimination',
      configJson: JSON.stringify({ numParticipants: 16, numAdvancing: 8, matchesPerTie: 'double' }),
      matches: [
        ...round1Matches,
        { id: 'r2s1', round: 2, leg: 1, slotIndex: 1 },
        { id: 'r2s2', round: 2, leg: 1, slotIndex: 2 },
        { id: 'r3s1', round: 3, leg: 1, slotIndex: 1 },
        { id: 'r3s2', round: 3, leg: 1, slotIndex: 2 },
      ],
      transitions: [{ id: trToElim, toStageId: elimId, selectionKind: 'top', topN: 8 }],
    };

    const eliminatorias: Partial<TournamentStage> = {
      id: elimId,
      name: 'Eliminatorias',
      order: 3,
      format: 'elimination',
      transitions: [],
    };

    const tournament: TournamentEntity = {
      id: 'ucl',
      name: 'Champions',
      competitions: [
        {
          id: 'c1',
          name: 'Principal',
          order: 1,
          stages: [repechaje as TournamentStage, eliminatorias as TournamentStage],
        },
      ],
    };

    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, elimId);
    expect(out).toHaveLength(8);
    expect(out.every((x) => x.source === 'elimination')).toBe(true);
    expect(out.map((x) => x.shortLabel).sort()).toEqual(
      ['P1R1', 'P2R1', 'P3R1', 'P4R1', 'P5R1', 'P6R1', 'P7R1', 'P8R1'].sort()
    );
    expect(out[0]?.displayName).toBe('Ganador Partido 1 - Repechaje — pendiente');
    expect(out[0]?.inscriptionId).toBe(`liga360-slot:ew:${repechajeId}:r1s1l1`);
    expect(out.find((x) => x.shortLabel === 'P1R3')).toBeUndefined();
  });

  it('mundial clásico: top 2 por grupo con config pero sin grupos persistidos', () => {
    const fromStageId = 'groups-stage';
    const toStageId = 'ko-stage';
    const groupsStage: Partial<TournamentStage> = {
      id: fromStageId,
      name: 'Fase de grupos',
      order: 1,
      format: 'groups',
      configJson: JSON.stringify({ numGroups: 8, teamsPerGroup: 4, groupRoundType: 'single' }),
      groups: [],
      transitions: [{ id: 'tr-m', toStageId, selectionKind: 'top', topN: 2 }],
    };
    const ko: Partial<TournamentStage> = {
      id: toStageId,
      name: 'Eliminatorias',
      order: 2,
      format: 'elimination',
      transitions: [],
    };
    const tournament: TournamentEntity = {
      id: 'mundial',
      name: 'Mundial',
      competitions: [
        {
          id: 'c',
          name: 'Copa del Mundo',
          order: 1,
          stages: [groupsStage as TournamentStage, ko as TournamentStage],
        },
      ],
    };

    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, toStageId);
    expect(out).toHaveLength(16);
    expect(out.every((r) => r.source === 'groups')).toBe(true);
    expect(out.some((r) => r.inscriptionId === `pos:sg:${fromStageId}:__cfg:${fromStageId}:g1:1`)).toBe(true);
    expect(out.find((r) => r.shortLabel === 'P2G8')?.displayName).toBe('Clasificación pendiente');
  });

  it('mundial clásico: top 2 por grupo con standings resuelve nombres', () => {
    const fromStageId = 'groups-stage';
    const toStageId = 'ko-stage';
    const groups = Array.from({ length: 8 }, (_, i) => ({
      id: `g${i + 1}`,
      name: `Grupo ${i + 1}`,
      order: i + 1,
      capacity: 4,
      standings: [
        {
          position: 1,
          inscriptionId: `w${i + 1}`,
          displayName: `Líder G${i + 1}`,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 9,
        },
        {
          position: 2,
          inscriptionId: `r${i + 1}`,
          displayName: `Segundo G${i + 1}`,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 6,
        },
      ],
    }));
    const groupsStage: Partial<TournamentStage> = {
      id: fromStageId,
      name: 'Fase de grupos',
      order: 1,
      format: 'groups',
      configJson: JSON.stringify({ numGroups: 8, teamsPerGroup: 4 }),
      groups,
      transitions: [{ id: 'tr-m2', toStageId, selectionKind: 'top', topN: 2 }],
    };
    const ko: Partial<TournamentStage> = {
      id: toStageId,
      name: 'Eliminatorias',
      order: 2,
      format: 'elimination',
      transitions: [],
    };
    const tournament: TournamentEntity = {
      id: 'mundial',
      name: 'Mundial',
      competitions: [
        {
          id: 'c',
          name: 'Copa del Mundo',
          order: 1,
          stages: [groupsStage as TournamentStage, ko as TournamentStage],
        },
      ],
    };

    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, toStageId);
    expect(out).toHaveLength(16);
    const p1g3 = out.find((r) => r.shortLabel === 'P1G3');
    expect(p1g3?.resolvedRealId).toBe('w3');
    expect(p1g3?.displayName).toBe('Líder G3');
    expect(p1g3?.optionLabel).toContain('Grupo 3 · posición 1 · Líder G3');
  });

  it('bestN: cupos BN1/BN2 son refs pos:bestN, no ids físicos de terceros', () => {
    const fromStageId = 'groups-stage';
    const toStageId = 'ko-stage';
    const groupsStage: Partial<TournamentStage> = {
      id: fromStageId,
      name: 'Fase de grupos',
      order: 1,
      format: 'groups',
      groups: [
        {
          id: 'g1',
          name: 'Grupo 1',
          order: 1,
          standings: [
            { position: 3, inscriptionId: '246', displayName: 'BN1', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 3 },
          ],
        },
        {
          id: 'g2',
          name: 'Grupo 2',
          order: 2,
          standings: [
            { position: 3, inscriptionId: '243', displayName: 'BN2', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 6 },
          ],
        },
        {
          id: 'g3',
          name: 'Grupo 3',
          order: 3,
          standings: [
            { position: 3, inscriptionId: '248', displayName: 'Holanda', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 1 },
          ],
        },
      ],
      transitions: [{ id: 'tr-bn', toStageId, selectionKind: 'bestN', topN: 2, rangeFrom: 3 }],
    };
    const ko: Partial<TournamentStage> = {
      id: toStageId,
      name: 'Eliminatorias',
      order: 2,
      format: 'elimination',
      transitions: [],
    };
    const tournament: TournamentEntity = {
      id: 'mini',
      name: 'Mini mundial',
      competitions: [
        {
          id: 'c',
          name: 'Copa',
          order: 1,
          stages: [groupsStage as TournamentStage, ko as TournamentStage],
        },
      ],
    };

    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, toStageId);
    expect(out).toHaveLength(2);

    const bn1 = out.find((r) => r.shortLabel === 'BN1');
    expect(bn1?.inscriptionId).toBe(`pos:bestN:${fromStageId}:3:2:1`);
    expect(bn1?.resolvedRealId).toBe('243');
    expect(bn1?.displayName).toBe('1° mejor 3° entre grupos');
    expect(bn1?.optionLabel).toContain('(provisional)');

    const bn2 = out.find((r) => r.shortLabel === 'BN2');
    expect(bn2?.inscriptionId).toBe(`pos:bestN:${fromStageId}:3:2:2`);
    expect(bn2?.resolvedRealId).toBe('246');
    expect(bn2?.inscriptionId).not.toBe('246');
  });

  it('enrichEligibleWithRealTeamNames: segundo del grupo muestra Brasil aunque la tabla diga BN2', () => {
    const rows = deriveEligibleInscriptionsFromIncomingTransitions(
      {
        id: 'mini',
        name: 'Mini mundial',
        competitions: [
          {
            id: 'c',
            name: 'Copa',
            order: 1,
            stages: [
              {
                id: 'gs',
                name: 'Grupos',
                order: 1,
                format: 'groups',
                groups: [
                  {
                    id: 'g1',
                    name: 'Grupo 1',
                    order: 1,
                    standings: [],
                  },
                  {
                    id: 'g2',
                    name: 'Grupo 2',
                    order: 2,
                    standings: [
                      { position: 2, inscriptionId: '243', displayName: 'BN2', played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 6 },
                    ],
                  },
                ],
                transitions: [{ id: 'tr', toStageId: 'ko', selectionKind: 'top', topN: 2 }],
              } as TournamentStage,
              { id: 'ko', name: 'Elim', order: 2, format: 'elimination', transitions: [] } as TournamentStage,
            ],
          },
        ],
      },
      'ko'
    );
    const enriched = enrichEligibleWithRealTeamNames(rows, new Map([['243', { display_name: 'Brasil' }]]));
    const p2g2 = enriched.find((r) => r.shortLabel === 'P2G2');
    expect(p2g2?.displayName).toBe('Brasil');
    expect(p2g2?.optionLabel).toContain('Brasil');
  });

  it('liga: sin filas en tabla pero con rango y numParticipants ofrece plazas sintéticas', () => {
    const toStageId = 'next';
    const league: Partial<TournamentStage> = {
      id: 'ls',
      name: 'Liga',
      order: 1,
      format: 'league',
      configJson: JSON.stringify({ numParticipants: 12 }),
      standings: [],
      transitions: [{ id: 'tr', toStageId, selectionKind: 'range', rangeFrom: 10, rangeTo: 11 }],
    };
    const next: Partial<TournamentStage> = {
      id: toStageId,
      name: 'Sig',
      order: 2,
      format: 'elimination',
      transitions: [],
    };
    const tournament: TournamentEntity = {
      id: 't',
      name: 'T',
      competitions: [{ id: 'c', name: 'C', order: 1, stages: [league as TournamentStage, next as TournamentStage] }],
    };
    const out = deriveEligibleInscriptionsFromIncomingTransitions(tournament, toStageId);
    expect(out).toHaveLength(2);
    const p10 = out.find((o) => o.inscriptionId === 'pos:l:ls:10');
    expect(p10?.displayName).toBe('Clasificación pendiente');
    expect(p10?.shortLabel).toBe('P10');
    expect(p10?.optionLabel).toBe('T · C · Liga · tabla general P10 · Clasificación pendiente');
  });
});
