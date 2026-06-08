/** Acceso a datos de Key (llaves que agrupan grupos dentro de una etapa). */

export async function findByStage(session, stageId) {
  const res = await session.run(
    `MATCH (s:Stage {id:$id})-[hk:HAS_KEY]->(k:Key)
     RETURN k ORDER BY hk.order`,
    { id: stageId }
  );
  return res.records.map((r) => {
    const k = r.get('k').properties;
    return { id: k.id, name: k.name, order: Number(k.order) || 0 };
  });
}

export async function create(session, { stageId, id, name, order }) {
  await session.run(
    `MATCH (s:Stage {id:$stageId})
     CREATE (s)-[:HAS_KEY {order:$order}]->(k:Key {id:$id, name:$name, order:$order})
     RETURN k`,
    { stageId, id, name, order }
  );
  return { id, name, order };
}

export async function linkGroup(session, keyId, groupId) {
  await session.run(
    `MATCH (k:Key {id:$keyId}), (g:Group {id:$groupId})
     MERGE (k)-[:HAS_GROUP]->(g)`,
    { keyId, groupId }
  );
}

export async function groupIds(session, keyId) {
  const res = await session.run(
    `MATCH (k:Key {id:$id})-[:HAS_GROUP]->(g:Group)
     RETURN g.id AS gid ORDER BY g.id`,
    { id: keyId }
  );
  return res.records.map((r) => r.get('gid'));
}
