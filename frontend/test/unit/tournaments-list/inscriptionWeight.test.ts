import { describe, expect, it } from 'vitest';
import { effectiveWeight, sortInscriptionsByWeight } from '../../../modules/tournaments-list/inscriptionWeight';

describe('inscriptionWeight', () => {
  it('effectiveWeight trata null como neutro (5)', () => {
    expect(effectiveWeight(null)).toBe(5);
    expect(effectiveWeight(undefined)).toBe(5);
  });

  it('effectiveWeight normaliza enteros 1–10', () => {
    expect(effectiveWeight(10)).toBe(10);
    expect(effectiveWeight(1)).toBe(1);
    expect(effectiveWeight(0)).toBe(5);
    expect(effectiveWeight(11)).toBe(5);
  });

  it('sortInscriptionsByWeight ordena por peso descendente y desempata por nombre', () => {
    const sorted = sortInscriptionsByWeight([
      { inscriptionId: '1', displayName: 'Zeta', weight: null },
      { inscriptionId: '2', displayName: 'Alfa', weight: 10 },
      { inscriptionId: '3', displayName: 'Beta', weight: 10 },
      { inscriptionId: '4', displayName: 'Gamma', weight: 3 },
    ]);
    expect(sorted.map((x) => x.inscriptionId)).toEqual(['2', '3', '1', '4']);
  });
});
