import React from 'react';
import { Badge } from './ui/Badge';

export type FilterMode = 'include' | 'exclude';

export type Phase = {
  id: string;
  name: string;
};

export type Competition = {
  id: string;
  name: string;
  phases: Phase[];
};

export type CompetitionPhaseFilterChange = {
  mode: FilterMode;
  selections: Array<{
    competitionId: string;
    phaseId: string;
  }>;
};

interface CompetitionPhaseFilterProps {
  competitions: Competition[];
  onChange: (filters: CompetitionPhaseFilterChange) => void;
  className?: string;
  initialMode?: FilterMode;
}

type ChipItem =
  | {
      id: string;
      type: 'competition';
      competitionId: string;
      label: string;
    }
  | {
      id: string;
      type: 'phase';
      competitionId: string;
      phaseId: string;
      label: string;
    };

function makeSelectionKey(competitionId: string, phaseId: string): string {
  return `${competitionId}::${phaseId}`;
}

function parseSelectionKey(key: string): { competitionId: string; phaseId: string } {
  const [competitionId = '', phaseId = ''] = key.split('::');
  return { competitionId, phaseId };
}

export function setIndeterminateState(input: HTMLInputElement | null, indeterminate: boolean): void {
  if (!input) return;
  input.indeterminate = indeterminate;
}

function isSelected(selectedKeys: Set<string>, competitionId: string, phaseId: string): boolean {
  return selectedKeys.has(makeSelectionKey(competitionId, phaseId));
}

export function getCompetitionSelectionState(
  competition: Competition,
  selectedKeys: Set<string>
): { allSelected: boolean; indeterminate: boolean; selectedCount: number; totalCount: number } {
  const totalCount = competition.phases.length;
  if (totalCount === 0) {
    return { allSelected: false, indeterminate: false, selectedCount: 0, totalCount: 0 };
  }

  const selectedCount = competition.phases.reduce(
    (acc, phase) => acc + (isSelected(selectedKeys, competition.id, phase.id) ? 1 : 0),
    0
  );
  const allSelected = selectedCount === totalCount;
  const indeterminate = selectedCount > 0 && selectedCount < totalCount;

  return { allSelected, indeterminate, selectedCount, totalCount };
}

export function toggleCompetitionSelection(
  selectedKeys: Set<string>,
  competition: Competition
): Set<string> {
  const next = new Set(selectedKeys);
  const { allSelected } = getCompetitionSelectionState(competition, selectedKeys);

  for (const phase of competition.phases) {
    const key = makeSelectionKey(competition.id, phase.id);
    if (allSelected) next.delete(key);
    else next.add(key);
  }

  return next;
}

export function togglePhaseSelection(
  selectedKeys: Set<string>,
  competitionId: string,
  phaseId: string
): Set<string> {
  const next = new Set(selectedKeys);
  const key = makeSelectionKey(competitionId, phaseId);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function computeSelectedFilters(
  competitions: Competition[],
  selectedKeys: Set<string>
): CompetitionPhaseFilterChange['selections'] {
  const validPhaseIdsByCompetitionId = new Map<string, Set<string>>();
  for (const competition of competitions) {
    validPhaseIdsByCompetitionId.set(
      competition.id,
      new Set((competition.phases || []).map((phase) => phase.id))
    );
  }

  const selections: CompetitionPhaseFilterChange['selections'] = [];
  for (const key of selectedKeys) {
    const { competitionId, phaseId } = parseSelectionKey(key);
    const phaseIds = validPhaseIdsByCompetitionId.get(competitionId);
    if (!phaseIds || !phaseIds.has(phaseId)) continue;
    selections.push({ competitionId, phaseId });
  }

  return selections;
}

function computeActiveChips(competitions: Competition[], selectedKeys: Set<string>): ChipItem[] {
  const chips: ChipItem[] = [];

  for (const competition of competitions) {
    const phases = competition.phases || [];
    if (phases.length === 0) continue;

    const selectedPhases = phases.filter((phase) => isSelected(selectedKeys, competition.id, phase.id));
    if (selectedPhases.length === 0) continue;

    if (selectedPhases.length === phases.length) {
      chips.push({
        id: `competition:${competition.id}`,
        type: 'competition',
        competitionId: competition.id,
        label: `${competition.name} / All phases`,
      });
      continue;
    }

    for (const phase of selectedPhases) {
      chips.push({
        id: `phase:${competition.id}:${phase.id}`,
        type: 'phase',
        competitionId: competition.id,
        phaseId: phase.id,
        label: `${competition.name} / ${phase.name}`,
      });
    }
  }

  return chips;
}

export const CompetitionPhaseFilter: React.FC<CompetitionPhaseFilterProps> = ({
  competitions,
  onChange,
  className = '',
  initialMode = 'include',
}) => {
  const [mode, setMode] = React.useState<FilterMode>(initialMode);
  const [search, setSearch] = React.useState('');
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(new Set());
  const [expanded, setExpanded] = React.useState(false);
  const [expandedCompetitionIds, setExpandedCompetitionIds] = React.useState<Set<string>>(
    () => new Set((competitions || []).map((competition) => competition.id))
  );

  React.useEffect(() => {
    setExpandedCompetitionIds((prev) => {
      const next = new Set(prev);
      for (const competition of competitions || []) next.add(competition.id);
      return next;
    });
  }, [competitions]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredCompetitions = React.useMemo(() => {
    return (competitions || [])
      .map((competition) => {
        if (!normalizedSearch) return { ...competition, phases: competition.phases || [] };

        const competitionMatches = competition.name.toLowerCase().includes(normalizedSearch);
        if (competitionMatches) return { ...competition, phases: competition.phases || [] };

        const matchingPhases = (competition.phases || []).filter((phase) =>
          phase.name.toLowerCase().includes(normalizedSearch)
        );
        return { ...competition, phases: matchingPhases };
      })
      .filter((competition) => competition.phases.length > 0 || competition.name.toLowerCase().includes(normalizedSearch));
  }, [competitions, normalizedSearch]);

  const activeChips = React.useMemo(() => computeActiveChips(competitions || [], selectedKeys), [competitions, selectedKeys]);

  React.useEffect(() => {
    onChange({
      mode,
      selections: computeSelectedFilters(competitions || [], selectedKeys),
    });
  }, [mode, selectedKeys, competitions, onChange]);

  function handleToggleCompetition(competition: Competition) {
    setSelectedKeys((prev) => toggleCompetitionSelection(prev, competition));
  }

  function handleTogglePhase(competitionId: string, phaseId: string) {
    setSelectedKeys((prev) => togglePhaseSelection(prev, competitionId, phaseId));
  }

  function handleRemoveChip(chip: ChipItem) {
    if (chip.type === 'competition') {
      const competition = (competitions || []).find((item) => item.id === chip.competitionId);
      if (!competition) return;

      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const phase of competition.phases || []) {
          next.delete(makeSelectionKey(competition.id, phase.id));
        }
        return next;
      });
      return;
    }

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(makeSelectionKey(chip.competitionId, chip.phaseId));
      return next;
    });
  }

  function toggleExpanded(competitionId: string) {
    setExpandedCompetitionIds((prev) => {
      const next = new Set(prev);
      if (next.has(competitionId)) next.delete(competitionId);
      else next.add(competitionId);
      return next;
    });
  }

  const modeLabel = mode === 'include' ? 'Mostrar' : 'No mostrar';

  return (
    <div
      className={`w-full rounded-xl border border-border-subtle bg-surface-1 ${className}`}
      aria-label="Filtro por competiciones y fases"
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2"
        aria-expanded={expanded}
        aria-label="Desplegar filtro de fases"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Filtro de fases</p>
          <p className="text-xs text-slate-500">
            {activeChips.length > 0
              ? `${activeChips.length} filtro(s) activo(s) · modo ${mode === 'include' ? 'mostrar' : 'no mostrar'}`
              : 'Sin filtros activos'}
          </p>
        </div>
        <span className="text-xs text-slate-500">{expanded ? 'v' : '>'}</span>
      </button>

      <div className={`grid transition-all duration-200 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden px-3 pb-3">
          <div className="mb-2 inline-flex w-full rounded-lg border border-border-subtle bg-surface-2 p-1" role="group" aria-label="Selector de modo de filtro">
            <button
              type="button"
              aria-pressed={mode === 'include'}
              onClick={() => setMode('include')}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                mode === 'include' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-surface-3'
              }`}
            >
              Mostrar solo
            </button>
            <button
              type="button"
              aria-pressed={mode === 'exclude'}
              onClick={() => setMode('exclude')}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                mode === 'exclude' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-surface-3'
              }`}
            >
              No mostrar
            </button>
          </div>

          <label className="mb-2 block">
            <span className="sr-only">Buscar competiciones o fases</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar competiciones o fases..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <div className="mb-2 flex min-h-7 flex-wrap gap-1.5">
            {activeChips.length === 0 ? (
              <p className="text-[11px] text-slate-500">No hay filtros activos.</p>
            ) : (
              activeChips.map((chip) => (
                <Badge key={chip.id} className="gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">
                  {`${modeLabel}: ${chip.label}`}
                  <button
                    type="button"
                    onClick={() => handleRemoveChip(chip)}
                    className="ml-0.5 rounded-sm text-emerald-700 transition hover:bg-accent-soft"
                    aria-label={`Quitar filtro ${chip.label}`}
                  >
                    x
                  </button>
                </Badge>
              ))
            )}
          </div>

          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
            {filteredCompetitions.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-500">No se encontraron competiciones o fases.</p>
            ) : (
              <ul className="space-y-1" role="tree" aria-label="Competiciones y fases">
                {filteredCompetitions.map((competition) => {
                  const expandedCompetition = expandedCompetitionIds.has(competition.id);
                  const state = getCompetitionSelectionState(competition, selectedKeys);

                  return (
                    <li key={competition.id} className="rounded-md border border-transparent hover:border-border-subtle hover:bg-surface-2">
                      <div className="flex items-center gap-2 px-2 py-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={state.allSelected && state.totalCount > 0}
                          ref={(input) => setIndeterminateState(input, state.indeterminate)}
                          onChange={() => handleToggleCompetition(competition)}
                          aria-label={`Seleccionar todas las fases de ${competition.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleExpanded(competition.id)}
                          className="w-5 text-xs text-slate-500 transition hover:text-slate-700"
                          aria-label={`${expandedCompetition ? 'Colapsar' : 'Expandir'} ${competition.name}`}
                          aria-expanded={expandedCompetition}
                        >
                          {expandedCompetition ? 'v' : '>'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleCompetition(competition)}
                          className="flex-1 text-left text-xs font-medium text-slate-800"
                        >
                          {competition.name}
                        </button>
                      </div>

                      <div className={`grid transition-all duration-200 ease-out ${expandedCompetition ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <ul className="ml-7 mb-1 mr-2 space-y-1 border-l border-slate-200 pl-3">
                            {(competition.phases || []).map((phase) => {
                              const checked = isSelected(selectedKeys, competition.id, phase.id);

                              return (
                                <li key={phase.id}>
                                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-700 transition hover:bg-surface-2">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                      checked={checked}
                                      onChange={() => handleTogglePhase(competition.id, phase.id)}
                                      aria-label={`Alternar fase ${phase.name} de ${competition.name}`}
                                    />
                                    <span className="truncate">{phase.name}</span>
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

