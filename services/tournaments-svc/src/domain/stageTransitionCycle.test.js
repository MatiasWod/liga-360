import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdjacency,
  wouldCreateInvalidStageCycle,
} from './stageTransitionCycle.js';

test('permite ascenso y descenso mutuo entre dos divisiones', () => {
  const edges = buildAdjacency([
    ['div1', 'div2'],
  ]);
  assert.equal(wouldCreateInvalidStageCycle(edges, 'div2', 'div1'), false);
});

test('bloquea ciclo de tres etapas', () => {
  const edges = buildAdjacency([
    ['a', 'b'],
    ['b', 'c'],
  ]);
  assert.equal(wouldCreateInvalidStageCycle(edges, 'c', 'a'), true);
});

test('permite cadena lineal sin cerrar ciclo', () => {
  const edges = buildAdjacency([
    ['a', 'b'],
  ]);
  assert.equal(wouldCreateInvalidStageCycle(edges, 'b', 'c'), false);
});

test('bloquea cerrar triángulo existente parcial', () => {
  const edges = buildAdjacency([
    ['b', 'c'],
    ['c', 'a'],
  ]);
  assert.equal(wouldCreateInvalidStageCycle(edges, 'a', 'b'), true);
});
