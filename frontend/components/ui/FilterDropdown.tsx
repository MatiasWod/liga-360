import React from 'react';

export interface FilterOption {
  id: string;
  label: string;
  description?: string;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  theme?: 'light' | 'dark';
  className?: string;
  emptyMessage?: string;
  /** Ancho mínimo del trigger (Tailwind class). */
  minWidthClass?: string;
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/**
 * Selector desplegable accesible con estilo propio (no `<select>` nativo).
 * Patrón visual alineado con RoundSelector.
 */
export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Elegir…',
  searchable = false,
  searchPlaceholder = 'Buscar…',
  theme = 'dark',
  className = '',
  emptyMessage = 'Sin opciones',
  minWidthClass = 'min-w-[11rem]',
}) => {
  const triggerId = React.useId();
  const listboxId = React.useId();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const isDark = theme === 'dark';

  const safeValue = options.some((o) => o.id === value) ? value : (options[0]?.id ?? '');
  const selected = options.find((o) => o.id === safeValue);

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q))
    );
  }, [options, query]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
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

  if (options.length === 0) return null;

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
    'flex w-full flex-col rounded-md px-3 py-2 text-left text-sm transition-colors';
  const optionIdle = isDark
    ? 'text-text-primary hover:bg-white/10'
    : 'text-text-primary hover:bg-surface-2';
  const optionActive = 'bg-accent-soft text-success-base font-medium';

  return (
    <div ref={rootRef} className={`flex flex-col gap-1 ${className}`}>
      <span
        id={`${triggerId}-label`}
        className={`text-xs font-medium ${isDark ? 'text-text-muted' : 'text-text-muted'}`}
      >
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          id={triggerId}
          aria-label={label}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex w-full ${minWidthClass} items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40 ${triggerClass}`}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open ? (
          <div
            className={`absolute left-0 top-full z-50 mt-1.5 w-full min-w-[12rem] overflow-hidden rounded-xl border ${panelClass}`}
          >
            {searchable ? (
              <div className="border-b border-border-subtle p-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-md border border-border-subtle bg-surface-1 px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
                  autoFocus
                />
              </div>
            ) : null}
            <ul
              id={listboxId}
              role="listbox"
              aria-labelledby={`${triggerId}-label`}
              className="max-h-64 overflow-y-auto p-1"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-text-muted">{emptyMessage}</li>
              ) : (
                filteredOptions.map((o) => {
                  const isSelected = o.id === safeValue;
                  return (
                    <li key={o.id} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => pick(o.id)}
                        className={`${optionBase} ${isSelected ? optionActive : optionIdle}`}
                      >
                        <span>{o.label}</span>
                        {o.description ? (
                          <span className="text-xs font-normal text-text-muted">{o.description}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};
