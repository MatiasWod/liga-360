import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWinnerSlotRefs,
  defaultBracketAdvanceTarget,
  pickAdvanceSideForRef,
  resolveAdvanceRoleForLeg,
} from '../../../domain/elimination/eliminationAdvance.js';

describe('eliminationAdvance', () => {
  it('buildWinnerSlotRefs incluye liga360-slot y pos:ew', () => {
    const refs = buildWinnerSlotRefs('st-1', ['m-1', 'm-2']);
    assert.ok(refs.includes('liga360-slot:ew:st-1:m-1'));
    assert.ok(refs.includes('pos:ew:m-1'));
    assert.ok(refs.includes('liga360-slot:ew:st-1:m-2'));
  });

  it('defaultBracketAdvanceTarget usa árbol clásico', () => {
    assert.deepEqual(defaultBracketAdvanceTarget(1, 1), {
      nextRound: 2,
      nextSlotIndex: 1,
      isHomeInLeg1: true,
    });
    assert.deepEqual(defaultBracketAdvanceTarget(1, 2), {
      nextRound: 2,
      nextSlotIndex: 1,
      isHomeInLeg1: false,
    });
    assert.deepEqual(defaultBracketAdvanceTarget(1, 8), {
      nextRound: 2,
      nextSlotIndex: 4,
      isHomeInLeg1: false,
    });
  });

  it('pickAdvanceSideForRef detecta el lado con ref de ganador', () => {
    const refs = new Set(['liga360-slot:ew:st:m8']);
    assert.equal(
      pickAdvanceSideForRef('liga360-slot:ew:st:m1', 'liga360-slot:ew:st:m8', refs),
      'away'
    );
    assert.equal(
      pickAdvanceSideForRef('liga360-slot:ew:st:m8', null, refs),
      'home'
    );
    assert.equal(pickAdvanceSideForRef('x', 'y', refs), null);
  });

  it('resolveAdvanceRoleForLeg invierte roles en la vuelta', () => {
    assert.equal(resolveAdvanceRoleForLeg('home', 1), 'home');
    assert.equal(resolveAdvanceRoleForLeg('home', 2), 'away');
    assert.equal(resolveAdvanceRoleForLeg('away', 2), 'home');
  });
});
