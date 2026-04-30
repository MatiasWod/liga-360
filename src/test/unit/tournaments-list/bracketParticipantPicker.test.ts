import { describe, expect, it } from 'vitest';
import {
  filterPoolSectionsForRole,
  resolvePoolEntryId,
} from '../../../modules/tournaments-list/bracketParticipantPool';
import {
  shortPhaseTabTitle,
  summarizeParticipantOptionLabel,
} from '../../../modules/tournaments-list/BracketParticipantPicker';
import type { TournamentMatchRow } from '../../../modules/tournaments-list/types';

describe('BracketParticipantPicker helpers', () => {
  it('shortPhaseTabTitle recorta texto “desde …” como pestaña corta', () => {
    expect(shortPhaseTabTitle('T · Copa · Grupos · desde grupos')).toBe('Grupos');
  });

  it('summarizeParticipantOptionLabel convierte G1P9 · … a texto de posición y grupo (compat)', () => {
    const s = summarizeParticipantOptionLabel('G1P9 · Clasificación pendiente');
    expect(s.headline).toBe('Posición 9 · Grupo 1');
    expect(s.subline).toBe('Clasificación pendiente');
  });

  it('summarizeParticipantOptionLabel reconoce P9G1 incluso después del lineage triple', () => {
    const s = summarizeParticipantOptionLabel('T · C · Fase grupos · P9G1 · A9');
    expect(s.headline).toBe('Posición 9 · Grupo 1');
    expect(s.subline).toBe('T · C · Fase grupos · A9');
  });

  it('summarizeParticipantOptionLabel convierte tabla general P… a posición en liga única', () => {
    const s = summarizeParticipantOptionLabel('T · C · Liga · tabla general P12 · Riv');
    expect(s.headline).toBe('Posición 12 · Tabla única');
    expect(s.subline).toBe('T · C · Liga · Riv');
  });

  it('filterPoolSectionsForRole mantiene secciones con entradas permitidas para home', () => {
    const rows = [
      {
        sectionLabel: 'A',
        entries: [{ kind: 'assigned' as const, id: 'x1', displayName: 'uno' }],
      },
      {
        sectionLabel: 'B',
        entries: [{ kind: 'assigned' as const, id: 'x2', displayName: 'dos' }],
      },
    ];
    const blocked = new Set<string>(['x1']);
    const match: TournamentMatchRow = {
      id: 'm1',
      homeAssignedInscription: null,
      awayAssignedInscription: null,
    };
    const out = filterPoolSectionsForRole(rows, 'home', match, blocked);
    expect(out).toHaveLength(1);
    expect(resolvePoolEntryId(out[0].entries[0])).toBe('x2');
  });
});
