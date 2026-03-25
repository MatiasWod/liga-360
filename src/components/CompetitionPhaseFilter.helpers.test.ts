import { describe, expect, it } from 'vitest';
import {
  computeSelectedFilters,
  getCompetitionSelectionState,
  toggleCompetitionSelection,
  togglePhaseSelection,
  type Competition,
} from './CompetitionPhaseFilter';

const competitions: Competition[] = [
  {
    id: 'comp-a',
    name: 'Primera Division',
    phases: [
      { id: 'fase-1', name: 'Apertura' },
      { id: 'fase-2', name: 'Clausura' },
    ],
  },
];

describe('CompetitionPhaseFilter helpers', () => {
  it('calcula estado indeterminado de una competencia', () => {
    const selected = new Set<string>(['comp-a::fase-1']);
    const state = getCompetitionSelectionState(competitions[0], selected);
    expect(state.totalCount).toBe(2);
    expect(state.selectedCount).toBe(1);
    expect(state.allSelected).toBe(false);
    expect(state.indeterminate).toBe(true);
  });

  it('toggleCompetitionSelection selecciona y deselecciona todas las fases', () => {
    const selectedNone = new Set<string>();
    const selectedAll = toggleCompetitionSelection(selectedNone, competitions[0]);
    expect(selectedAll.has('comp-a::fase-1')).toBe(true);
    expect(selectedAll.has('comp-a::fase-2')).toBe(true);

    const selectedAgain = toggleCompetitionSelection(selectedAll, competitions[0]);
    expect(selectedAgain.size).toBe(0);
  });

  it('togglePhaseSelection alterna una fase puntual', () => {
    const initial = new Set<string>();
    const selected = togglePhaseSelection(initial, 'comp-a', 'fase-1');
    expect(selected.has('comp-a::fase-1')).toBe(true);

    const unselected = togglePhaseSelection(selected, 'comp-a', 'fase-1');
    expect(unselected.has('comp-a::fase-1')).toBe(false);
  });

  it('computeSelectedFilters ignora fases inexistentes', () => {
    const selected = new Set<string>(['comp-a::fase-1', 'comp-a::inexistente', 'otra::fase']);
    const filters = computeSelectedFilters(competitions, selected);
    expect(filters).toEqual([{ competitionId: 'comp-a', phaseId: 'fase-1' }]);
  });
});
