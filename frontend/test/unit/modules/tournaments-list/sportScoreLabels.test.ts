import { describe, expect, it } from 'vitest';
import {
  isTennisSport,
  resolveSportScoreLabels,
  sportDisplayName,
} from '../../../../modules/tournaments-list/sportScoreLabels';

describe('sportScoreLabels', () => {
  it('detecta tenis por valor del formulario y variantes', () => {
    expect(isTennisSport('tennis')).toBe(true);
    expect(isTennisSport('tenis')).toBe(true);
    expect(isTennisSport('tenis de mesa')).toBe(true);
    expect(isTennisSport('football')).toBe(false);
  });

  it('usa sets y oculta eventos de goles en tenis', () => {
    const labels = resolveSportScoreLabels('tennis', 'individuals');
    expect(labels.scoreUnit).toBe('sets');
    expect(labels.scoreHint).toMatch(/games por set/);
    expect(labels.forShort).toBe('SF');
    expect(labels.entityColumn).toBe('Jugador');
    expect(labels.hideGoalEvents).toBe(true);
  });

  it('mantiene goles en fútbol', () => {
    const labels = resolveSportScoreLabels('football', 'teams');
    expect(labels.scoreUnit).toBe('goles');
    expect(labels.forShort).toBe('GF');
    expect(labels.entityColumn).toBe('Equipo');
    expect(labels.hideGoalEvents).toBe(false);
  });

  it('muestra nombre legible del deporte', () => {
    expect(sportDisplayName('tennis')).toBe('Tenis');
    expect(sportDisplayName('football')).toBe('Fútbol');
  });
});
