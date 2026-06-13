import { describe, expect, it } from 'vitest';
import { deriveSeriesSlugFromName } from '../../../../modules/tournament-form/utils/seriesSlug';

describe('deriveSeriesSlugFromName', () => {
  it('normaliza nombre a slug kebab-case', () => {
    expect(deriveSeriesSlugFromName('Copa Municipal 2026')).toBe('copa-municipal-2026');
  });

  it('recorta guiones al inicio y fin', () => {
    expect(deriveSeriesSlugFromName('  --Liga Apertura-- ')).toBe('liga-apertura');
  });
});
