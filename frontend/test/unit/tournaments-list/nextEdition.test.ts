import { describe, expect, it } from 'vitest';
import { defaultNextEditionName, suggestNextEditionLabel } from '../../../services/tournaments/nextEdition';

describe('defaultNextEditionName', () => {
  it('reutiliza el nombre del torneo fuente', () => {
    expect(defaultNextEditionName('  Liga BDN  ')).toBe('Liga BDN');
    expect(defaultNextEditionName('')).toBe('');
  });
});

describe('suggestNextEditionLabel', () => {
  it('incrementa año de 4 dígitos', () => {
    expect(suggestNextEditionLabel('2025')).toBe('2026');
    expect(suggestNextEditionLabel('Temporada 2024/25')).toBe('Temporada 2025/25');
  });

  it('sugiere año siguiente si no hay patrón', () => {
    const next = suggestNextEditionLabel('');
    expect(Number(next)).toBeGreaterThan(2020);
  });
});
