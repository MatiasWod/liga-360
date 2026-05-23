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

describe('matchInputToRecord', () => {
  it('mapea status finished y goles desde GraphQL', () => {
    const m = matchInputToRecord({
      id: 'm1',
      round: 1,
      leg: 1,
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      homeAssignedInscription: { inscriptionId: 'a', displayName: 'A' },
      awayAssignedInscription: { inscriptionId: 'b', displayName: 'B' },
    });
    expect(m.status).toBe('completed');
    expect(m.homeScore).toBe(2);
    expect(m.awayScore).toBe(1);
  });

  it('mapea venue y referee desde GraphQL', () => {
    const m = matchInputToRecord({
      id: 'm2',
      round: 1,
      leg: 1,
      venue: 'Estadio Municipal',
      referee: 'Juan Pérez',
      homeAssignedInscription: { inscriptionId: 'c', displayName: 'C' },
      awayAssignedInscription: { inscriptionId: 'd', displayName: 'D' },
    });
    expect(m.venue).toBe('Estadio Municipal');
    expect(m.referee).toBe('Juan Pérez');
  });

  it('no incluye venue ni referee cuando están ausentes', () => {
    const m = matchInputToRecord({
      id: 'm3',
      round: 1,
      homeAssignedInscription: null,
      awayAssignedInscription: null,
    });
    expect(m.venue).toBeUndefined();
    expect(m.referee).toBeUndefined();
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
