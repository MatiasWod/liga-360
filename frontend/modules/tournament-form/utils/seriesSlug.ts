/** Misma normalización que tournaments-svc (competition-series.repository). */
export function deriveSeriesSlugFromName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
