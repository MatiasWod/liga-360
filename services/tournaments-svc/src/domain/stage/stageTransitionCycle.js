/**
 * Detecta si agregar ADVANCES_TO from→to cerraría un ciclo inválido entre etapas.
 *
 * Se permiten pares bidireccionales (ascenso + descenso entre dos divisiones).
 * Se bloquean ciclos de 3+ etapas (p. ej. A→B→C→A).
 */
export function wouldCreateInvalidStageCycle(adjacency, fromStageId, toStageId) {
  const from = String(fromStageId ?? '').trim();
  const to = String(toStageId ?? '').trim();
  if (!from || !to || from === to) return false;

  const edges = adjacency instanceof Map ? adjacency : buildAdjacency(adjacency);
  return hasAdvancesToPath(edges, to, from, 2);
}

export function buildAdjacency(pairs) {
  const map = new Map();
  for (const [from, to] of pairs) {
    const f = String(from ?? '').trim();
    const t = String(to ?? '').trim();
    if (!f || !t) continue;
    const arr = map.get(f) || [];
    arr.push(t);
    map.set(f, arr);
  }
  return map;
}

function hasAdvancesToPath(edges, startId, targetId, minHops) {
  const start = String(startId ?? '').trim();
  const target = String(targetId ?? '').trim();
  if (!start || !target) return false;

  const queue = [{ id: start, hops: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { id, hops } = queue.shift();
    const visitKey = `${id}:${hops}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    if (id === target && hops >= minHops) return true;
    if (hops >= 32) continue;

    for (const next of edges.get(id) || []) {
      queue.push({ id: next, hops: hops + 1 });
    }
  }

  return false;
}

/** Cypher: camino existente destino→origen de longitud ≥ 2 (excluye ascenso/descenso mutuo). */
export const STAGE_CYCLE_CHECK_CYPHER = `
  OPTIONAL MATCH p=(b)-[:ADVANCES_TO*2..]->(a)
  RETURN p IS NOT NULL AS hasCycle
`;

export const STAGE_CYCLE_ERROR =
  'BAD_REQUEST: transición inválida: ya hay un camino de avance desde la etapa destino hacia la etapa origen ' +
  '(ciclo en el grafo). Ascenso y descenso entre dos divisiones está permitido; si borraste transiciones antes, recargá la página.';
