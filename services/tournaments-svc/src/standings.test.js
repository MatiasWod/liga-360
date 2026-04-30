import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStandings, STANDINGS_DEFAULTS } from './standings.js';

test('computeStandings: liga de 3 equipos con resultados finalizados', () => {
  const inscriptions = [
    { inscriptionId: 'A', displayName: 'Atlas' },
    { inscriptionId: 'B', displayName: 'Boca' },
    { inscriptionId: 'C', displayName: 'Colón' },
  ];
  const matches = [
    { homeInscriptionId: 'A', awayInscriptionId: 'B', homeDisplayName: 'Atlas', awayDisplayName: 'Boca', homeScore: 2, awayScore: 1, matchStatus: 'finished' },
    { homeInscriptionId: 'A', awayInscriptionId: 'C', homeDisplayName: 'Atlas', awayDisplayName: 'Colón', homeScore: 0, awayScore: 1, matchStatus: 'finished' },
    { homeInscriptionId: 'B', awayInscriptionId: 'C', homeDisplayName: 'Boca', awayDisplayName: 'Colón', homeScore: 3, awayScore: 3, matchStatus: 'finished' },
  ];

  const rows = computeStandings(matches, inscriptions);
  assert.deepEqual(rows.map((r) => [r.position, r.inscriptionId, r.points]), [
    [1, 'C', 4],
    [2, 'A', 3],
    [3, 'B', 1],
  ]);
});

test('computeStandings: desempate por diferencia de gol', () => {
  const inscriptions = [
    { inscriptionId: 'A', displayName: 'Alpha' },
    { inscriptionId: 'B', displayName: 'Beta' },
    { inscriptionId: 'C', displayName: 'Gamma' },
  ];
  const matches = [
    { homeInscriptionId: 'A', awayInscriptionId: 'B', homeDisplayName: 'Alpha', awayDisplayName: 'Beta', homeScore: 2, awayScore: 0, matchStatus: 'finished' },
    { homeInscriptionId: 'B', awayInscriptionId: 'C', homeDisplayName: 'Beta', awayDisplayName: 'Gamma', homeScore: 3, awayScore: 0, matchStatus: 'finished' },
    { homeInscriptionId: 'C', awayInscriptionId: 'A', homeDisplayName: 'Gamma', awayDisplayName: 'Alpha', homeScore: 1, awayScore: 0, matchStatus: 'finished' },
  ];
  const rows = computeStandings(matches, inscriptions);
  assert.equal(rows[0].inscriptionId, 'B');
  assert.equal(rows[1].inscriptionId, 'A');
});

test('computeStandings: desempate por goles a favor', () => {
  const inscriptions = [
    { inscriptionId: 'A', displayName: 'Alpha' },
    { inscriptionId: 'B', displayName: 'Beta' },
    { inscriptionId: 'C', displayName: 'Gamma' },
  ];
  const matches = [
    { homeInscriptionId: 'A', awayInscriptionId: 'B', homeDisplayName: 'Alpha', awayDisplayName: 'Beta', homeScore: 2, awayScore: 0, matchStatus: 'finished' },
    { homeInscriptionId: 'C', awayInscriptionId: 'B', homeDisplayName: 'Gamma', awayDisplayName: 'Beta', homeScore: 1, awayScore: 0, matchStatus: 'finished' },
    { homeInscriptionId: 'A', awayInscriptionId: 'C', homeDisplayName: 'Alpha', awayDisplayName: 'Gamma', homeScore: 1, awayScore: 1, matchStatus: 'finished' },
  ];
  const rows = computeStandings(matches, inscriptions);
  assert.equal(rows[0].inscriptionId, 'A');
  assert.equal(rows[1].inscriptionId, 'C');
});

test('computeStandings: empate total ordena alfabeticamente por displayName', () => {
  const inscriptions = [
    { inscriptionId: 'A', displayName: 'Andes' },
    { inscriptionId: 'B', displayName: 'Barsa' },
  ];
  const matches = [
    { homeInscriptionId: 'A', awayInscriptionId: 'B', homeDisplayName: 'Andes', awayDisplayName: 'Barsa', homeScore: 0, awayScore: 0, matchStatus: 'finished' },
    { homeInscriptionId: 'B', awayInscriptionId: 'A', homeDisplayName: 'Barsa', awayDisplayName: 'Andes', homeScore: 1, awayScore: 1, matchStatus: 'finished' },
  ];
  const rows = computeStandings(matches, inscriptions);
  assert.equal(rows[0].displayName, 'Andes');
  assert.equal(rows[1].displayName, 'Barsa');
});

test('computeStandings: incluye inscripcion sin partidos jugados', () => {
  const inscriptions = [
    { inscriptionId: 'A', displayName: 'Atlas' },
    { inscriptionId: 'B', displayName: 'Boca' },
  ];
  const rows = computeStandings([], inscriptions);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].played, 0);
  assert.equal(rows[0].points, 0);
  assert.equal(rows[1].played, 0);
  assert.equal(rows[1].points, 0);
});

test('computeStandings: ignora partidos no finalizados', () => {
  const inscriptions = [
    { inscriptionId: 'A', displayName: 'Atlas' },
    { inscriptionId: 'B', displayName: 'Boca' },
  ];
  const rows = computeStandings(
    [{ homeInscriptionId: 'A', awayInscriptionId: 'B', homeDisplayName: 'Atlas', awayDisplayName: 'Boca', homeScore: 4, awayScore: 0, matchStatus: 'scheduled' }],
    inscriptions
  );
  assert.equal(rows[0].points, 0);
  assert.equal(rows[1].points, 0);
});

test('computeStandings: trata score null como 0 en match finished (consistente con UI)', () => {
  // homeScore null → se interpreta como 0; el partido sí cuenta (0-1 → Boca gana).
  const rows = computeStandings(
    [{ homeInscriptionId: 'A', awayInscriptionId: 'B', homeDisplayName: 'Atlas', awayDisplayName: 'Boca', homeScore: null, awayScore: 1, matchStatus: 'finished' }],
    [
      { inscriptionId: 'A', displayName: 'Atlas' },
      { inscriptionId: 'B', displayName: 'Boca' },
    ]
  );
  const atlas = rows.find((r) => r.inscriptionId === 'A');
  const boca  = rows.find((r) => r.inscriptionId === 'B');
  assert.equal(atlas.played, 1);
  assert.equal(atlas.lost,   1);
  assert.equal(boca.played,  1);
  assert.equal(boca.won,     1);
});

test('computeStandings: usa config de puntos personalizada', () => {
  const rows = computeStandings(
    [{ homeInscriptionId: 'A', awayInscriptionId: 'B', homeDisplayName: 'Atlas', awayDisplayName: 'Boca', homeScore: 2, awayScore: 1, matchStatus: 'finished' }],
    [
      { inscriptionId: 'A', displayName: 'Atlas' },
      { inscriptionId: 'B', displayName: 'Boca' },
    ],
    { winPoints: 2 }
  );
  assert.equal(rows[0].points, 2);
});

test('computeStandings: expone defaults esperados', () => {
  assert.deepEqual(STANDINGS_DEFAULTS, { winPoints: 3, drawPoints: 1, lossPoints: 0 });
});
