import React from 'react';
import {
  CATEGORY_LABEL_SUGGESTIONS,
  MAX_CATEGORY_LABEL_LENGTH,
  normalizeCategoryLabelInput,
} from '../utils/categoryLabel';

interface CategoryLabelChipsProps {
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}

export const CategoryLabelChips: React.FC<CategoryLabelChipsProps> = ({ value, onChange, error }) => {
  const [draft, setDraft] = React.useState('');
  const [localError, setLocalError] = React.useState('');

  function addLabel(raw: string) {
    setLocalError('');
    try {
      const normalized = normalizeCategoryLabelInput(raw);
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (value.some((chip) => chip.trim().toLowerCase() === key)) {
        setLocalError(`"${normalized}" ya está en la lista`);
        return;
      }
      onChange([...value, normalized]);
      setDraft('');
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Etiqueta inválida');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLabel(draft);
    }
  }

  const displayError = error || localError;

  return (
    <div className="space-y-2">
      <div>
        <span className="text-sm font-medium opacity-90">Categorías del torneo (opcional)</span>
        <p className="text-xs opacity-70 mt-0.5">
          Creá variantes con la misma estructura (ej. Femenino, Masculino). Sin chips → un solo torneo.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {value.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 rounded-full border border-brand-greenAccent/40 bg-accent-soft px-2.5 py-1 text-xs font-medium text-brand-greenAccent"
          >
            {chip}
            <button
              type="button"
              className="rounded-full px-1 text-brand-greenAccent/80 hover:text-brand-greenAccent"
              aria-label={`Quitar ${chip}`}
              onClick={() => onChange(value.filter((item) => item !== chip))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {CATEGORY_LABEL_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs opacity-80 hover:border-brand-greenAccent/50 hover:text-brand-greenAccent"
            onClick={() => addLabel(suggestion)}
          >
            + {suggestion}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        maxLength={MAX_CATEGORY_LABEL_LENGTH}
        placeholder='Escribí y Enter (ej. "Sub-18")'
        className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-green/60 placeholder-white/50"
        onChange={(e) => {
          setDraft(e.target.value);
          setLocalError('');
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) addLabel(draft);
        }}
      />
      {displayError ? <p className="text-xs text-red-400">{displayError}</p> : null}
    </div>
  );
};
