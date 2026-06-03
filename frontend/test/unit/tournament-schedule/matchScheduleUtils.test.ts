import { describe, expect, it } from 'vitest';
import { datetimeLocalValueToIso, isoToDatetimeLocalValue } from '../../../components/tournament-schedule/matchScheduleUtils';

describe('matchScheduleUtils', () => {
  it('vacío → null en ISO', () => {
    expect(datetimeLocalValueToIso('')).toBeNull();
    expect(datetimeLocalValueToIso('   ')).toBeNull();
  });

  it('roundtrip conserva instante (misma zona local que el entorno de test)', () => {
    const iso = '2026-06-15T15:30:00.000Z';
    const local = isoToDatetimeLocalValue(iso);
    expect(local.length).toBeGreaterThan(10);
    const back = datetimeLocalValueToIso(local);
    expect(back).not.toBeNull();
    expect(new Date(back!).getTime()).toBe(new Date(iso).getTime());
  });
});
