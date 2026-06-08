import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/** Copia de helpers en index.js (sin exportar el módulo completo). */
function isWinnerSlotRef(raw) {
  const s = String(raw || '');
  return s.startsWith('liga360-slot:ew:') || s.startsWith('pos:ew:');
}

function parseWinnerSlotRef(str) {
  const s = String(str || '');
  if (s.startsWith('pos:ew:')) {
    const matchId = s.slice('pos:ew:'.length).trim();
    return matchId ? { stageId: null, matchId } : null;
  }
  if (s.startsWith('liga360-slot:ew:')) {
    const rest = s.slice('liga360-slot:ew:'.length);
    const idx = rest.indexOf(':');
    if (idx <= 0) return null;
    const stageId = rest.slice(0, idx).trim();
    const matchId = rest.slice(idx + 1).trim();
    if (!stageId || !matchId) return null;
    return { stageId, matchId };
  }
  return null;
}

describe('winnerSlotRef helpers', () => {
  it('isWinnerSlotRef detecta refs de ganador', () => {
    assert.equal(isWinnerSlotRef('liga360-slot:ew:st-1:m-1'), true);
    assert.equal(isWinnerSlotRef('pos:ew:m-1'), true);
    assert.equal(isWinnerSlotRef('pos:l:st-1:10'), false);
  });

  it('parseWinnerSlotRef con stage UUID y match id con guiones', () => {
    const ref = 'liga360-slot:ew:550e8400-e29b-41d4-a716-446655440000:m-1734567890-abc12';
    assert.deepEqual(parseWinnerSlotRef(ref), {
      stageId: '550e8400-e29b-41d4-a716-446655440000',
      matchId: 'm-1734567890-abc12',
    });
  });

  it('parseWinnerSlotRef pos:ew', () => {
    assert.deepEqual(parseWinnerSlotRef('pos:ew:match-xyz'), {
      stageId: null,
      matchId: 'match-xyz',
    });
  });
});
