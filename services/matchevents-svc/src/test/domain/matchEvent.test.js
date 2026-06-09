import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { VALID_EVENT_TYPES, isValidEventType } from '../../domain/matchEvent.js';

describe('matchEvent domain', () => {
  test('VALID_EVENT_TYPES contiene los tipos esperados', () => {
    assert.deepEqual(VALID_EVENT_TYPES, ['goal', 'yellow_card', 'red_card', 'suspension', 'other_sanction']);
  });

  test('isValidEventType acepta tipos válidos', () => {
    for (const t of VALID_EVENT_TYPES) assert.equal(isValidEventType(t), true);
  });

  test('isValidEventType rechaza tipos inválidos', () => {
    for (const t of ['penalty', '', null, undefined, 'GOAL']) assert.equal(isValidEventType(t), false);
  });
});
