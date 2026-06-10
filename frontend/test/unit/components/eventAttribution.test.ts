import { describe, expect, it } from 'vitest';
import {
  buildAttribution,
  buildPlayerPickerOptions,
  parseInscriptionSlot,
  rosterMemberName,
} from '../../../components/match-edit/eventAttribution';

describe('parseInscriptionSlot', () => {
  it('convierte un slot GraphQL válido en opción de equipo', () => {
    expect(parseInscriptionSlot({ inscriptionId: '245', displayName: 'Boca Norte' })).toEqual({
      inscriptionId: 245,
      displayName: 'Boca Norte',
    });
  });

  it('acepta ids numéricos', () => {
    expect(parseInscriptionSlot({ inscriptionId: 7, displayName: 'River Sur' })?.inscriptionId).toBe(7);
  });

  it('devuelve null para slots vacíos, nulos o sintéticos', () => {
    expect(parseInscriptionSlot(null)).toBeNull();
    expect(parseInscriptionSlot(undefined)).toBeNull();
    expect(parseInscriptionSlot({ inscriptionId: '', displayName: 'X' })).toBeNull();
    expect(parseInscriptionSlot({ inscriptionId: 'W1', displayName: 'Ganador P1' })).toBeNull();
    expect(parseInscriptionSlot({ inscriptionId: '-1', displayName: 'TBD' })).toBeNull();
  });
});

describe('buildAttribution', () => {
  it('falla sin equipo seleccionado', () => {
    const r = buildAttribution({ inscriptionId: null, member: null, freeText: 'Juan' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/equipo/i);
  });

  it('usa el integrante de plantilla cuando está elegido', () => {
    const r = buildAttribution({
      inscriptionId: 10,
      member: { id: 100, name: 'Juan Pérez' },
      freeText: 'ignorado',
    });
    expect(r).toEqual({ ok: true, inscription_id: 10, linked_member_id: 100, display_name: 'Juan Pérez' });
  });

  it('cae a texto libre sin integrante elegido', () => {
    const r = buildAttribution({ inscriptionId: 11, member: null, freeText: '  Carlos Gómez ' });
    expect(r).toEqual({ ok: true, inscription_id: 11, linked_member_id: null, display_name: 'Carlos Gómez' });
  });

  it('falla con equipo pero sin jugador ni texto', () => {
    const r = buildAttribution({ inscriptionId: 11, member: null, freeText: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/jugador/i);
  });
});

describe('rosterMemberName', () => {
  it('prioriza el apodo', () => {
    expect(rosterMemberName({ firstName: 'Juan', lastName: 'Pérez', nickname: 'Juancho' })).toBe('Juancho');
  });

  it('arma nombre completo sin apodo', () => {
    expect(rosterMemberName({ firstName: 'Juan', lastName: 'Pérez', nickname: '' })).toBe('Juan Pérez');
  });

  it('degrada a "Sin nombre"', () => {
    expect(rosterMemberName({})).toBe('Sin nombre');
  });
});

describe('buildPlayerPickerOptions (cascada presencias → plantilla → texto libre)', () => {
  const roster = [
    { id: 100, name: 'Juan Pérez' },
    { id: 101, name: 'Carlos Gómez' },
  ];
  const presences = [
    { inscription_id: 10, linked_member_id: 100, display_name: 'Juan Pérez', is_guest: false },
    { inscription_id: 10, linked_member_id: null, display_name: 'Invitado X', is_guest: true },
    { inscription_id: 20, linked_member_id: 200, display_name: 'Rival', is_guest: false },
  ];

  it('con presencias del partido, son la fuente (presentes primero, invitados al final)', () => {
    const { options, source } = buildPlayerPickerOptions({ inscriptionId: 10, presences, roster });
    expect(source).toBe('presences');
    expect(options.map((o) => o.name)).toEqual(['Juan Pérez', 'Invitado X']);
    expect(options[1].isGuest).toBe(true);
    expect(options[1].memberId).toBeNull();
  });

  it('sin presencias de la inscripción, ofrece la plantilla', () => {
    const { options, source } = buildPlayerPickerOptions({ inscriptionId: 10, presences: [], roster });
    expect(source).toBe('roster');
    expect(options.map((o) => o.memberId)).toEqual([100, 101]);
  });

  it('sin presencias ni plantilla queda solo texto libre', () => {
    const { options, source } = buildPlayerPickerOptions({ inscriptionId: 10, presences: [], roster: [] });
    expect(source).toBe('none');
    expect(options).toEqual([]);
  });

  it('sin equipo seleccionado no ofrece opciones', () => {
    const { options } = buildPlayerPickerOptions({ inscriptionId: null, presences, roster });
    expect(options).toEqual([]);
  });
});
