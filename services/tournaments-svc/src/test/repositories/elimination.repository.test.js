import test from 'node:test';
import assert from 'node:assert/strict';
import { syncEliminationDoubleLegPair } from '../../repositories/elimination.repository.js';

function mockSession(state) {
  return {
    async run(query, params) {
      if (query.includes('MATCH (m:Match {id:$id})')) {
        const m = state.matches.get(params.id);
        return { records: m ? [{ get: (k) => (k === 'm' ? { properties: m } : null) }] : [] };
      }
      if (query.includes('max(toInteger(coalesce(m.round')) {
        return { records: [{ get: (k) => (k === 'mr' ? state.maxRound : null) }] };
      }
      if (query.includes('coalesce(toInteger(m.leg), 1) = $leg')) {
        const m = [...state.matches.values()].find(
          (x) =>
            x.round === params.round &&
            x.slotIndex === params.slot &&
            (x.leg ?? 1) === params.leg
        );
        return { records: m ? [{ get: (k) => (k === 'm' ? { properties: m } : null) }] : [] };
      }
      if (query.includes('SET m.homeInscriptionId = $hid')) {
        const m = state.matches.get(params.matchId);
        Object.assign(m, {
          homeInscriptionId: params.hid,
          homeDisplayName: params.hdn,
          homeTournamentId: params.htid,
          awayInscriptionId: params.aid,
          awayDisplayName: params.adn,
          awayTournamentId: params.atid,
        });
        return { records: [] };
      }
      return { records: [] };
    },
  };
}

test('syncEliminationDoubleLegPair espeja ida en vuelta', async () => {
  const state = {
    maxRound: 3,
    matches: new Map([
      ['leg1', {
        id: 'leg1',
        round: 1,
        slotIndex: 1,
        leg: 1,
        homeInscriptionId: 'arg',
        homeDisplayName: 'Argentina',
        homeTournamentId: 't1',
        awayInscriptionId: 'eng',
        awayDisplayName: 'Inglaterra',
        awayTournamentId: 't1',
      }],
      ['leg2', {
        id: 'leg2',
        round: 1,
        slotIndex: 1,
        leg: 2,
        homeInscriptionId: 'eng',
        homeDisplayName: 'Inglaterra',
        homeTournamentId: 't1',
        awayInscriptionId: 'eng',
        awayDisplayName: 'Inglaterra',
        awayTournamentId: 't1',
      }],
    ]),
  };

  await syncEliminationDoubleLegPair(
    mockSession(state),
    'stage1',
    { configJson: JSON.stringify({ matchesPerTie: 'double', numParticipants: 8 }) },
    'leg1'
  );

  const leg2 = state.matches.get('leg2');
  assert.equal(leg2.homeInscriptionId, 'eng');
  assert.equal(leg2.awayInscriptionId, 'arg');
});
