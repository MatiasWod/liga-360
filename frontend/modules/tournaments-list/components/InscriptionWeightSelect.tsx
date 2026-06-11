import React from 'react';
import { NEUTRAL_WEIGHT } from '../inscriptionWeight';

const MIN_WEIGHT = 1;
const MAX_WEIGHT = 10;
const SAVE_DEBOUNCE_MS = 1500;

function clampWeight(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < MIN_WEIGHT || n > MAX_WEIGHT) return null;
  return n;
}

function clampWeightNumber(n: number): number {
  return Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, Math.trunc(n)));
}

export const InscriptionWeightSelect: React.FC<{
  inscriptionId: number;
  value: number | null | undefined;
  suggestedWeight?: number | null;
  eloRaw?: number | null;
  onChange: (weight: number | null) => void;
  onApplySuggested?: () => void;
  disabled?: boolean;
}> = ({ inscriptionId, value, onChange, onApplySuggested, suggestedWeight, eloRaw, disabled = false }) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const onChangeRef = React.useRef(onChange);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = React.useRef<number | null | undefined>(undefined);

  onChangeRef.current = onChange;

  function clearDebounce() {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  function queuePersist(next: number | null) {
    pendingValueRef.current = next;
    clearDebounce();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      const pending = pendingValueRef.current;
      pendingValueRef.current = undefined;
      if (pending !== undefined) onChangeRef.current(pending);
    }, SAVE_DEBOUNCE_MS);
  }

  function flushPersist() {
    clearDebounce();
    const pending = pendingValueRef.current;
    pendingValueRef.current = undefined;
    if (pending !== undefined) onChangeRef.current(pending);
  }

  function cancelPersist() {
    clearDebounce();
    pendingValueRef.current = undefined;
  }

  React.useEffect(() => {
    if (!editing) {
      setDraft(value != null ? String(value) : '');
    }
  }, [value, editing]);

  React.useEffect(() => () => flushPersist(), []);

  function currentWeight(): number {
    return clampWeight(draft) ?? value ?? NEUTRAL_WEIGHT;
  }

  function applyWeight(next: number) {
    const clamped = clampWeightNumber(next);
    setDraft(String(clamped));
    if (clamped !== value) queuePersist(clamped);
    else cancelPersist();
  }

  function stepWeight(delta: number) {
    if (disabled) return;
    applyWeight(currentWeight() + delta);
  }

  function commitDraft() {
    const next = clampWeight(draft);
    if (next == null) {
      if (draft.trim() === '') return;
      setDraft(value != null ? String(value) : '');
      cancelPersist();
      return;
    }
    setDraft(String(next));
    if (next !== value) {
      pendingValueRef.current = next;
      flushPersist();
    } else {
      cancelPersist();
    }
  }

  function handleToggle() {
    if (disabled) return;
    if (editing) {
      flushPersist();
      setEditing(false);
      setDraft(value != null ? String(value) : '');
      return;
    }
    setEditing(true);
    setDraft(value != null ? String(value) : '');
  }

  function handleDeactivate() {
    if (disabled) return;
    cancelPersist();
    setEditing(false);
    setDraft('');
    if (value != null) onChange(null);
  }

  const stepBtnClass =
    'flex h-3 w-4 items-center justify-center text-[8px] leading-none text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

  const showSuggestion = suggestedWeight != null && Number.isFinite(suggestedWeight);
  const suggestionDrift =
    showSuggestion && value != null && Math.abs(Number(value) - Number(suggestedWeight)) >= 2;

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      {showSuggestion ? (
        <div className="flex items-center gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] ${
              suggestionDrift
                ? 'border-amber-300/80 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
            title={eloRaw != null ? `ELO ${eloRaw}` : undefined}
          >
            Sug. {suggestedWeight}
          </span>
          {onApplySuggested && value !== suggestedWeight ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onApplySuggested}
              className="rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title="Copiar ponderación sugerida al peso manual"
            >
              ↵
            </button>
          ) : null}
        </div>
      ) : null}
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={editing}
        aria-controls={`weight-input-${inscriptionId}`}
        aria-label={editing ? 'Cerrar ponderación' : 'Editar ponderación'}
        onClick={handleToggle}
        className={`inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[10px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          editing
            ? 'border-slate-300 bg-slate-100 text-[#0F2A33] shadow-sm'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
        }`}
      >
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
            editing ? 'bg-[#0F2A33]' : value != null ? 'bg-slate-500' : 'bg-slate-300'
          }`}
          aria-hidden
        />
        Peso
        {!editing && value != null ? (
          <span className="rounded bg-slate-100 px-1 font-semibold text-[#0F2A33]">{value}</span>
        ) : null}
      </button>

      {editing ? (
        <>
          <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
            <input
              id={`weight-input-${inscriptionId}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              disabled={disabled}
              value={draft}
              placeholder="1–10"
              aria-label="Ponderación del 1 al 10"
              onChange={(e) => {
                const next = e.target.value.replace(/[^\d]/g, '');
                setDraft(next);
                const parsed = clampWeight(next);
                if (parsed != null) {
                  if (parsed !== value) queuePersist(parsed);
                  else cancelPersist();
                } else {
                  cancelPersist();
                }
              }}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  stepWeight(1);
                  return;
                }
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  stepWeight(-1);
                  return;
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitDraft();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="h-6 w-8 border-0 bg-transparent px-1 text-center text-[10px] font-semibold text-[#0F2A33] outline-none placeholder:font-normal placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <div className="flex flex-col border-l border-slate-200" role="group" aria-label="Ajustar ponderación">
              <button
                type="button"
                disabled={disabled || currentWeight() >= MAX_WEIGHT}
                aria-label="Subir ponderación"
                onClick={() => stepWeight(1)}
                className={`${stepBtnClass} border-b border-slate-200`}
              >
                ▲
              </button>
              <button
                type="button"
                disabled={disabled || currentWeight() <= MIN_WEIGHT}
                aria-label="Bajar ponderación"
                onClick={() => stepWeight(-1)}
                className={stepBtnClass}
              >
                ▼
              </button>
            </div>
          </div>
          <button
            type="button"
            disabled={disabled}
            aria-label="Quitar ponderación (neutro)"
            title={`Neutro (${NEUTRAL_WEIGHT})`}
            onClick={handleDeactivate}
            className="rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ×
          </button>
        </>
      ) : null}
    </div>
    </div>
  );
};
