import { describe, expect, it } from 'vitest';
import {
  filterPoolSectionsForRole,
  resolvePoolEntryId,
} from '../../../modules/tournaments-list/bracketParticipantPool';
import {
  shortPhaseTabTitle,
  summarizeParticipantOptionLabel,
  displayLabelFromPoolEligible,
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

  it('summarizeParticipantOptionLabel reconoce ganador de repechaje con etapa', () => {
    const s = summarizeParticipantOptionLabel('T · C · Repechaje · Ganador Partido 1 - Repechaje');
    expect(s.headline).toBe('Ganador Partido 1 - Repechaje');
  });

  it('summarizeParticipantOptionLabel reconoce ganador legacy con ronda', () => {
    const s = summarizeParticipantOptionLabel('T · C · Repechaje · Ganador · Partido 1 · Ronda 1');
    expect(s.headline).toBe('Ganador · Partido 1 · Ronda 1');
  });

  it('summarizeParticipantOptionLabel convierte tabla general P… a posición en liga única', () => {
    const s = summarizeParticipantOptionLabel('T · C · Liga · tabla general P12 · Riv');
    expect(s.headline).toBe('Posición 12 · Liga');
    expect(s.subline).toBe('T · C · Liga · Riv');
  });

  it('summarizeParticipantOptionLabel reconoce Grupo N · posición M (Mundial clásico)', () => {
    const s = summarizeParticipantOptionLabel(
      'Mundial Clasico · Copa del Mundo · Fase de grupos · Grupo 3 · posición 1 · Argentina'
    );
    expect(s.headline).toBe('Posición 1 · Grupo 3');
    expect(s.subline).toContain('Mundial Clasico');
    expect(s.subline).toContain('Argentina');
  });

  it('displayLabelFromPoolEligible no cae al nombre del torneo si falta patrón', () => {
    expect(
      displayLabelFromPoolEligible({
        inscriptionId: 'pos:sg:st:g1:1',
        optionLabel: 'Mundial Clasico · Copa · Grupos · sin patrón',
        shortLabel: 'P1G1',
        displayName: 'Clasificación pendiente',
      })
    ).toBe('P1G1');
  });

  it('summarizeParticipantOptionLabel reconoce cupo BN1 como mejor tercero', () => {
    const s = summarizeParticipantOptionLabel(
      'Mini mundial · Copa · Grupos · 1° mejor 3° entre grupos · Italia (provisional)'
    );
    expect(s.headline).toBe('1° mejor 3° entre grupos');
    expect(s.subline).toContain('Italia');
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
