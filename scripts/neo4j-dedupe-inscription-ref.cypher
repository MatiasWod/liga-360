// Elimina nodos InscriptionRef duplicados (mismo tournamentId + inscriptionId).
// Neo4j MERGE puede crear dos nodos si mezclás número y string en inscriptionId.
// Conserva el de menor id interno; borra el resto con DETACH DELETE.
//
// Uso (ejemplo):
//   docker exec -i liga360-neo4j cypher-shell -u neo4j -p password < scripts/neo4j-dedupe-inscription-ref.cypher
//
MATCH (i:InscriptionRef)
WITH i.tournamentId AS tid, toString(i.inscriptionId) AS iid, collect(i) AS nodes
WHERE size(nodes) > 1
UNWIND nodes AS n
WITH tid, iid, n ORDER BY id(n)
WITH collect(n) AS ordered
WITH ordered[0] AS keep, ordered[1..] AS rest
UNWIND rest AS dup
DETACH DELETE dup;
