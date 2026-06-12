import { describe, expect, it } from 'vitest';
import { resolveEditionDisplay } from '../../../../modules/tournaments-list/editionDisplay';

describe('resolveEditionDisplay', () => {
  it('usa editionLabel si existe', () => {
    expect(resolveEditionDisplay('2025', '2026')).toBe('2025');
  });

  it('cae a season si editionLabel falta', () => {
    expect(resolveEditionDisplay(null, '2026')).toBe('2026');
  });

  it('devuelve vacío si no hay datos', () => {
    expect(resolveEditionDisplay(null, null)).toBe('');
  });
});
