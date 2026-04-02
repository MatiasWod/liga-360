import { describe, expect, it } from 'vitest';
import { buildScheduleFromStage, matchInputToRecord } from '../../../components/tournament-schedule/adaptFixtureData';

describe('buildScheduleFromStage (groups)', () => {
  it('usa el mismo id de ronda en todos los grupos para la misma fecha', () => {
    const g1 = {
      id: 'g1',
      name: 'Grupo A',
      order: 0,
      matches: [
        {
          id: 'm1',
          round: 1,
          leg: 1,
          slotIndex: 0,
          homeAssignedInscription: { inscriptionId: 'a', displayName: 'A' },
          awayAssignedInscription: { inscriptionId: 'b', displayName: 'B' },
        },
      ],
    };
    const g2 = {
      id: 'g2',
      name: 'Grupo B',
      order: 1,
      matches: [
        {
          id: 'm2',
          round: 1,
          leg: 1,
          slotIndex: 0,
          homeAssignedInscription: { inscriptionId: 'c', displayName: 'C' },
          awayAssignedInscription: { inscriptionId: 'd', displayName: 'D' },
        },
      ],
    };
    const out = buildScheduleFromStage({
      format: 'groups',
      groups: [g1, g2],
    });
    expect(out?.type).toBe('groups');
    if (out?.type !== 'groups') return;
    const r0a = out.data.groups[0].rounds[0];
    const r0b = out.data.groups[1].rounds[0];
    expect(r0a.id).toBe(r0b.id);
    expect(r0a.matches).toHaveLength(1);
    expect(r0b.matches).toHaveLength(1);
  });
});

describe('buildScheduleFromStage (elimination)', () => {
  it('ordena ida y vuelta por slot y luego pierna', () => {
    const out = buildScheduleFromStage({
      format: 'elimination',
      matches: [
        { id: 'a', round: 1, leg: 2, slotIndex: 1, homeAssignedInscription: null, awayAssignedInscription: null },
        { id: 'b', round: 1, leg: 1, slotIndex: 1, homeAssignedInscription: null, awayAssignedInscription: null },
        { id: 'c', round: 1, leg: 1, slotIndex: 2, homeAssignedInscription: null, awayAssignedInscription: null },
      ],
    });
    expect(out?.type).toBe('knockout');
    if (out?.type !== 'knockout') return;
    const col = out.data.rounds[0]?.matches ?? [];
    expect(col.map((m) => m.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('matchInputToRecord', () => {
  it('mapea status finished a completed y conserva marcadores', () => {
    const rec = matchInputToRecord({
      id: 'm1',
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
      resultRecordedAt: '2026-03-29T12:00:00.000Z',
      resultRecordedBy: 'org1',
      homeAssignedInscription: { inscriptionId: 'a', displayName: 'A' },
      awayAssignedInscription: { inscriptionId: 'b', displayName: 'B' },
    });
    expect(rec.status).toBe('completed');
    expect(rec.homeScore).toBe(2);
    expect(rec.awayScore).toBe(1);
    expect(rec.resultRecordedBy).toBe('org1');
  });
});
