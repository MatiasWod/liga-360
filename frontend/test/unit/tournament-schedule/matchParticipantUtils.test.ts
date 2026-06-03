import { describe, expect, it } from 'vitest';
import {
  bothMatchTeamsResolved,
  bothTeamsResolvedFromSlots,
  bracketPublicTeamName,
  isByeFromInscriptionSlots,
  isByeMatchRecord,
  isPlaceholderParticipantLabel,
  isResolvedMatchTeam,
} from '../../../components/tournament-schedule/matchParticipantUtils';

describe('matchParticipantUtils', () => {
  it('isPlaceholderParticipantLabel detecta refs y etiquetas sintéticas', () => {
    expect(isPlaceholderParticipantLabel('Gan. P3R1')).toBe(true);
    expect(isPlaceholderParticipantLabel('Ganador Partido 1 - Repechaje')).toBe(true);
    expect(isPlaceholderParticipantLabel('Posición 10 · Liga única')).toBe(true);
    expect(isPlaceholderParticipantLabel('Boca Juniors')).toBe(false);
  });

  it('isResolvedMatchTeam exige nombre real (id sintético ok si nombre resuelto)', () => {
    expect(isResolvedMatchTeam({ id: '42', name: 'River Plate' })).toBe(true);
    expect(isResolvedMatchTeam({ id: 'liga360-slot:ew:s:m1', name: 'Boca Juniors' })).toBe(true);
    expect(isResolvedMatchTeam({ id: 'liga360-slot:ew:s:m1', name: 'Ganador Partido 1 - Repechaje' })).toBe(false);
    expect(isResolvedMatchTeam({ id: '__empty-home-x', name: '—' })).toBe(false);
    expect(isResolvedMatchTeam({ id: '__bye-away-m1', name: 'Libre' })).toBe(false);
    expect(isResolvedMatchTeam({ id: 'pos:l:st:10', name: 'Posición 10 · Liga' })).toBe(false);
    expect(isResolvedMatchTeam({ id: 'pos:l:st:10', name: 'San Lorenzo' })).toBe(true);
  });

  it('bothMatchTeamsResolved requiere local y visitante', () => {
    expect(
      bothMatchTeamsResolved({
        homeTeam: { id: '1', name: 'A' },
        awayTeam: { id: '2', name: 'B' },
      })
    ).toBe(true);
    expect(
      bothMatchTeamsResolved({
        homeTeam: { id: '1', name: 'A' },
        awayTeam: { id: 'liga360-slot:ew:s:m1', name: 'Equipo B' },
      })
    ).toBe(true);
    expect(
      bothMatchTeamsResolved({
        homeTeam: { id: '1', name: 'A' },
        awayTeam: { id: 'liga360-slot:ew:s:m1', name: 'Gan. P3R1' },
      })
    ).toBe(false);
  });

  it('bothTeamsResolvedFromSlots desde inscripciones GraphQL', () => {
    expect(
      bothTeamsResolvedFromSlots(
        { inscriptionId: '1', displayName: 'Alpha' },
        { inscriptionId: 'liga360-slot:ew:s:m1', displayName: 'Beta FC' }
      )
    ).toBe(true);
    expect(
      bothTeamsResolvedFromSlots(
        { inscriptionId: '1', displayName: 'Alpha' },
        { inscriptionId: 'liga360-slot:ew:s:m1', displayName: 'Gan. P3R1' }
      )
    ).toBe(false);
  });

  it('isByeFromInscriptionSlots detecta fecha libre con un solo equipo en liga', () => {
    expect(
      isByeFromInscriptionSlots(
        { inscriptionId: '1', displayName: 'Alpha' },
        null,
        { stageFormat: 'league' }
      )
    ).toBe(true);
    expect(
      isByeFromInscriptionSlots(
        { inscriptionId: '1', displayName: 'Alpha' },
        { inscriptionId: '2', displayName: 'Beta' }
      )
    ).toBe(false);
  });

  it('isByeFromInscriptionSlots no trata slot vacío como bye en eliminatoria durante init', () => {
    expect(
      isByeFromInscriptionSlots(
        { inscriptionId: '1', displayName: 'Alpha' },
        null,
        { stageFormat: 'elimination' }
      )
    ).toBe(false);
    expect(
      isByeFromInscriptionSlots(
        { inscriptionId: '1', displayName: 'Alpha' },
        null,
        { stageFormat: 'elimination', matchKind: 'bye' }
      )
    ).toBe(true);
  });

  it('isByeMatchRecord reconoce lado Libre en MatchRecord', () => {
    expect(
      isByeMatchRecord({
        homeTeam: { id: '1', name: 'Alpha' },
        awayTeam: { id: '__bye-away-m1', name: 'Libre' },
      })
    ).toBe(true);
    expect(
      bothMatchTeamsResolved({
        homeTeam: { id: '1', name: 'Alpha' },
        awayTeam: { id: '__bye-away-m1', name: 'Libre' },
      })
    ).toBe(false);
  });

  it('bracketPublicTeamName oculta placeholders de ganador de llave', () => {
    expect(bracketPublicTeamName({ inscriptionId: '1', displayName: 'Argentina' })).toBe('Argentina');
    expect(
      bracketPublicTeamName(
        { inscriptionId: '246', displayName: 'BN1' },
        new Map([['246', 'Italia']])
      )
    ).toBe('Italia');
    expect(
      bracketPublicTeamName({
        inscriptionId: 'liga360-slot:ew:s:m1',
        displayName: 'Ganador Partido 3 - Cuartos',
      })
    ).toBe('');
    expect(bracketPublicTeamName(null)).toBe('');
  });
});
