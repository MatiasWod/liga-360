import { describe, expect, it } from 'vitest';
import {
  categoryVariantPillLabel,
  findSiblingTournamentVariants,
  normalizeCategoryLabelInput,
  resolveCategoryLabelsForCreate,
} from '../../../../modules/tournament-form/utils/categoryLabel';

describe('categoryLabel utils', () => {
  it('resolveCategoryLabelsForCreate devuelve [null] sin chips', () => {
    expect(resolveCategoryLabelsForCreate([])).toEqual([null]);
  });

  it('rechaza duplicados case-insensitive', () => {
    expect(() => resolveCategoryLabelsForCreate(['Femenino', 'femenino'])).toThrow(/duplicada/i);
  });

  it('normaliza chips válidos', () => {
    expect(resolveCategoryLabelsForCreate(['  Sub-23 ', '+60'])).toEqual(['Sub-23', '+60']);
  });

  it('normalizeCategoryLabelInput rechaza caracteres inválidos', () => {
    expect(() => normalizeCategoryLabelInput('A/B')).toThrow();
  });

  it('findSiblingTournamentVariants agrupa por nombre y organizador', () => {
    const all = [
      { id: '1', name: 'Copa', organizer: 'org', categoryLabel: 'Femenino' },
      { id: '2', name: 'Copa', organizer: 'org', categoryLabel: 'Masculino' },
      { id: '3', name: 'Otra', organizer: 'org', categoryLabel: null },
    ];
    const siblings = findSiblingTournamentVariants(all, { id: '1', name: 'Copa', organizer: 'org' });
    expect(siblings.map((row) => row.id)).toEqual(['1', '2']);
  });

  it('categoryVariantPillLabel muestra Sin categoría si falta label', () => {
    expect(categoryVariantPillLabel(null)).toBe('Sin categoría');
    expect(categoryVariantPillLabel('Femenino')).toBe('Femenino');
  });
});
