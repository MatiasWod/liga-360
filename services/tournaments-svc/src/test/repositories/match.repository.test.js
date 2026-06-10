import test from 'node:test';
import assert from 'node:assert/strict';
import { findByInscriptionIds } from '../../repositories/match.repository.js';

function mockSession(records) {
  return {
    async run(_query, params) {
      assert.deepEqual(params.ids, ['10', '20']);
      return { records };
    },
  };
}

test('findByInscriptionIds devuelve partidos con contexto de torneo/competencia/etapa', async () => {
  const records = [{
    get: (key) => ({
      m: {
        properties: {
          id: 'm1',
          round: 1,
          leg: 1,
          homeInscriptionId: '10',
          homeDisplayName: 'Equipo A',
          homeTournamentId: 't1',
          awayInscriptionId: '99',
          awayDisplayName: 'Equipo B',
          awayTournamentId: 't1',
          homeScore: 2,
          awayScore: 1,
          status: 'finished',
        },
      },
      tournamentId: 't1',
      tournamentName: 'Torneo Test',
      competitionId: 'c1',
      competitionName: 'Primera',
      stageId: 's1',
      stageName: 'Liga',
    }[key]),
  }];
  const rows = await findByInscriptionIds(mockSession(records), ['10', '20']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'm1');
  assert.equal(rows[0].tournamentId, 't1');
  assert.equal(rows[0].tournamentName, 'Torneo Test');
  assert.equal(rows[0].competitionName, 'Primera');
  assert.equal(rows[0].stageName, 'Liga');
  assert.equal(rows[0].homeScore, 2);
});

test('findByInscriptionIds con lista vacía no consulta Neo4j', async () => {
  const rows = await findByInscriptionIds({ run: () => assert.fail('no deberia consultar') }, []);
  assert.deepEqual(rows, []);
});
