export function resolveEditionDisplay(
  editionLabel?: string | null,
  season?: string | null
): string {
  return String(editionLabel || season || '').trim();
}

export type SeriesEditionBadge = {
  text: string;
  title: string;
};

/** Etiqueta unificada: serie + edición cuando corresponda. */
export function formatSeriesEditionBadge(
  seriesName?: string | null,
  editionLabel?: string | null,
  season?: string | null
): SeriesEditionBadge | null {
  const series = String(seriesName ?? '').trim();
  const edition = resolveEditionDisplay(editionLabel, season);
  if (series && edition) {
    return {
      text: `${series} · Edición ${edition}`,
      title: `Serie ${series} · Edición ${edition}`,
    };
  }
  if (series) {
    return { text: series, title: `Serie: ${series}` };
  }
  if (edition) {
    return { text: `Edición ${edition}`, title: `Edición ${edition}` };
  }
  return null;
}
