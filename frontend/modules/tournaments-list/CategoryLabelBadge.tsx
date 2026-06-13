import React from 'react';

interface CategoryLabelBadgeProps {
  label?: string | null;
  className?: string;
}

export function CategoryLabelBadge({ label, className = '' }: CategoryLabelBadgeProps) {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return null;
  return (
    <span
      title={`Categoría: ${trimmed}`}
      className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-sky-400/40 bg-sky-500/10 text-sky-200 ${className}`}
    >
      {trimmed}
    </span>
  );
}
