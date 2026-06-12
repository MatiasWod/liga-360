import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VALID_EVENT_TYPES, isValidEventType, sanitizeEventForViewer } from '../../domain/matchEvent.js';

describe('matchEvent domain', () => {
  test('VALID_EVENT_TYPES contiene los tipos esperados', () => {
    assert.deepEqual(VALID_EVENT_TYPES, ['goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction', 'tennis_set']);
  });

  test('isValidEventType acepta tipos válidos', () => {
    for (const t of VALID_EVENT_TYPES) assert.equal(isValidEventType(t), true);
  });

  test('isValidEventType rechaza tipos inválidos', () => {
    for (const t of ['penalty', '', null, undefined, 'GOAL']) assert.equal(isValidEventType(t), false);
  });

  test('sanitizeEventForViewer excluye notes para no organizadores', () => {
    const ev = { id: 1, event_type: 'goal', display_name: 'Juan', notes: 'interno' };
    const publicView = sanitizeEventForViewer(ev, false);
    assert.equal('notes' in publicView, false);
    assert.equal(publicView.display_name, 'Juan');
  });

  test('sanitizeEventForViewer conserva notes para organizadores', () => {
    const ev = { id: 1, event_type: 'goal', display_name: 'Juan', notes: 'interno' };
    assert.deepEqual(sanitizeEventForViewer(ev, true), ev);
  });

  test('sanitizeEventForViewer tolera null/undefined', () => {
    assert.equal(sanitizeEventForViewer(null, false), null);
    assert.equal(sanitizeEventForViewer(undefined, false), undefined);
  });
});
