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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export const RoundSelector: React.FC<RoundSelectorProps> = ({
  rounds,
  selectedId,
  onChange,
  theme = 'light',
  className = '',
}) => {
  const triggerId = React.useId();
  const listboxId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const isDark = theme === 'dark';

  const safeId =
    selectedId && rounds.some((r) => r.id === selectedId) ? selectedId : (rounds[0]?.id ?? '');
  const selected = rounds.find((r) => r.id === safeId) ?? rounds[0];

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (rounds.length === 0) return null;

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  const triggerClass = isDark
    ? 'border-white/15 bg-surface-2 text-text-primary hover:border-white/25 hover:bg-surface-3'
    : 'border-border-subtle bg-surface-2 text-text-primary hover:border-border-strong hover:bg-surface-3';

  const panelClass = isDark
    ? 'border-white/15 bg-surface-2 shadow-lg shadow-black/30'
    : 'border-border-subtle bg-surface-1 shadow-lg shadow-brand-dark/10';

  const optionBase =
    'flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors';
  const optionIdle = isDark
    ? 'text-text-primary hover:bg-white/10'
    : 'text-text-primary hover:bg-surface-2';
  const optionActive = 'bg-accent-soft text-success-base font-medium';

  return (
    <div ref={rootRef} className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span
        id={`${triggerId}-label`}
        className={`text-sm font-medium ${isDark ? 'text-text-primary' : 'text-text-muted'}`}
      >
        Fecha
      </span>
      <div className="relative">
        <button
          type="button"
          id={triggerId}
          aria-label="Seleccionar fecha"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex min-w-[11rem] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40 ${triggerClass}`}
        >
          <span className="truncate">{selected?.label ?? 'Elegir fecha'}</span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={`${triggerId}-label`}
            aria-activedescendant={`${listboxId}-opt-${safeId}`}
            className={`absolute left-0 top-full z-50 mt-1.5 max-h-64 min-w-full overflow-y-auto rounded-xl border p-1 ${panelClass}`}
          >
            {rounds.map((r) => {
              const isSelected = r.id === safeId;
              return (
                <li key={r.id} role="presentation">
                  <button
                    type="button"
                    id={`${listboxId}-opt-${r.id}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => pick(r.id)}
                    className={`${optionBase} ${isSelected ? optionActive : optionIdle}`}
                  >
                    {r.label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
};
