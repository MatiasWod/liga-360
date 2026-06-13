import React from 'react';
import { formatSeriesEditionBadge } from './editionDisplay';

interface SeriesEditionBadgeProps {
  seriesName?: string | null;
  editionLabel?: string | null;
  season?: string | null;
  className?: string;
}

export function SeriesEditionBadge({
  seriesName,
  editionLabel,
  season,
  className = '',
}: SeriesEditionBadgeProps) {
  const badge = formatSeriesEditionBadge(seriesName, editionLabel, season);
  if (!badge) return null;
  return (
    <span
      title={badge.title}
      className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-brand-greenAccent/40 bg-accent-soft text-brand-greenAccent ${className}`}
    >
      {badge.text}
    </span>
  );
}
