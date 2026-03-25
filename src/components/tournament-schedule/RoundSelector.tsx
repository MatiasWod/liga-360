import { motion } from 'framer-motion';
import React from 'react';

export interface RoundTab {
  id: string;
  label: string;
}

interface RoundSelectorProps {
  rounds: RoundTab[];
  selectedId: string | null;
  onChange: (roundId: string) => void;
  theme?: 'light' | 'dark';
  className?: string;
}

export const RoundSelector: React.FC<RoundSelectorProps> = ({
  rounds,
  selectedId,
  onChange,
  theme = 'light',
  className = '',
}) => {
  const tabLayoutId = React.useId();
  const isDark = theme === 'dark';
  const borderB = isDark ? 'border-white/15' : 'border-slate-200';

  return (
    <div
      role="tablist"
      aria-label="Fechas y rondas"
      className={`flex flex-wrap gap-1 border-b pb-px ${borderB} ${className}`}
    >
      {rounds.map((r) => {
        const selected = r.id === selectedId;
        return (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(r.id)}
            className={`relative rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              selected
                ? isDark
                  ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/20'
                  : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 ring-offset-0'
                : isDark
                  ? 'text-white/55 hover:bg-white/5 hover:text-white/90'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {r.label}
            {selected ? (
              <motion.span
                layoutId={`${tabLayoutId}-indicator`}
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-500"
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
