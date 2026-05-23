import { describe, expect, it } from 'vitest';
import {
  deriveEligibleInscriptionsFromIncomingTransitions,
  collectIncomingTransitionRows,
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

    const a9 = out.find((o) => o.inscriptionId === 'a9');
    expect(a9?.shortLabel).toBe('P9G1');
    expect(a9?.source).toBe('groups');
    expect(a9?.sectionTitle).toBe('T · C · Fase grupos · desde grupos');
    expect(a9?.optionLabel).toBe('T · C · Fase grupos · Grupo A · posición 9 · A9');
    const b9 = out.find((o) => o.inscriptionId === 'b9');
    expect(b9?.shortLabel).toBe('P9G2');
    expect(b9?.optionLabel).toBe('T · C · Fase grupos · Grupo B · posición 9 · B9');

    const g1Synth = out.find((o) => o.inscriptionId === 'liga360-slot:sg:g-stage:tr-1:g-a:10');
    expect(g1Synth?.inscriptionId).toMatch(/^liga360-slot:sg:/);
    expect(g1Synth?.displayName).toBe('Grupo A · posición 10');
    expect(g1Synth?.shortLabel).toBe('P10G1');
    expect(g1Synth?.optionLabel).toBe('T · C · Fase grupos · Grupo A · posición 10 · sin asignar');

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
    expect(out.map((x) => x.inscriptionId).sort()).toEqual(['p10', 'p11']);

    expect(out.find((x) => x.inscriptionId === 'p10')?.optionLabel).toBe('T · C · Liga · tabla general P10 · Diez');
    expect(out.find((x) => x.inscriptionId === 'p10')?.shortLabel).toBe('P10');
    expect(out.find((x) => x.inscriptionId === 'p10')?.sectionTitle).toBe('T · C · Liga · desde liga');
    expect(out.find((x) => x.inscriptionId === 'p11')?.optionLabel).toBe('T · C · Liga · tabla general P11 · Once');
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

  it('elimination: lista local/visitante de partidos con destino de ganador = transición hacia etapa', () => {
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
      ['aw1', 'h1', 'h2', 'liga360-slot:el:elim-from:trans-to-rep:m2:away'].sort()
    );
    const h1 = out.find((x) => x.inscriptionId === 'h1');
    expect(h1?.shortLabel).toBe('E3M1');
    expect(h1?.source).toBe('elimination');
    expect(h1?.sectionTitle).toContain('Tv');
    expect(h1?.sectionTitle).toContain('Copa');
    expect(h1?.sectionTitle).toContain('desde eliminatoria');
    expect(h1?.optionLabel).toBe('Tv · Copa · Cuartos · eliminatoria llave E3M1 · H1');
    const awaySlot = out.find((x) => x.inscriptionId === 'liga360-slot:el:elim-from:trans-to-rep:m2:away');
    expect(awaySlot?.optionLabel).toBe('Tv · Copa · Cuartos · Cuartos · E3-M2 · Visitante · sin asignar');
    expect(awaySlot?.shortLabel).toBe('E3M2-V');
    expect(awaySlot?.displayName).toBe('Cuartos · E3-M2 · Visitante');
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
    expect(out.some((x) => x.inscriptionId === 'a1' && x.source === 'elimination')).toBe(true);
    expect(out.some((x) => x.inscriptionId === 'liga360-slot:el:elim-from:trans-to-liguilla:m2:away')).toBe(true);
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
    const p10 = out.find((o) => o.inscriptionId === 'liga360-slot:lg:ls:tr:10');
    expect(p10?.displayName).toMatch(/^Liga ×\d+$/);
    expect(p10?.shortLabel).toMatch(/^×\d+$/);
    expect(p10?.optionLabel).toBe('T · C · Liga · P10 · Liga ×1 · sin asignar');
  });
});
