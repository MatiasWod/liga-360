import { describe, expect, it } from 'vitest';
import { combineDateYmdAndTime, enumerateDaysInclusive } from '../../../modules/tournaments-list/useFixtureSchedulingPrefs';

describe('enumerateDaysInclusive', () => {
  it('lista días inclusivos', () => {
    expect(enumerateDaysInclusive('2026-04-01', '2026-04-03')).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);
  });
  it('vacío si falta rango', () => {
    expect(enumerateDaysInclusive('', '2026-04-01')).toEqual([]);
  });
});

describe('combineDateYmdAndTime', () => {
  it('arma datetime-local', () => {
    expect(combineDateYmdAndTime('2026-04-10', '18:30')).toBe('2026-04-10T18:30');
  });
});
