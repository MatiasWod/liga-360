import { describe, expect, it } from 'vitest';
import { formatSeriesEditionBadge, resolveEditionDisplay } from '../../../../modules/tournaments-list/editionDisplay';

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

describe('formatSeriesEditionBadge', () => {
  it('combina serie y edición', () => {
    expect(formatSeriesEditionBadge('Copa Municipal', '2026', null)).toEqual({
      text: 'Copa Municipal · Edición 2026',
      title: 'Serie Copa Municipal · Edición 2026',
    });
  });

  it('muestra solo edición sin serie', () => {
    expect(formatSeriesEditionBadge(null, '2026', null)?.text).toBe('Edición 2026');
  });

  it('muestra solo serie sin edición', () => {
    expect(formatSeriesEditionBadge('Mundial FIFA', null, null)?.text).toBe('Mundial FIFA');
  });
});
