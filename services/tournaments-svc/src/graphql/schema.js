import { readFileSync } from 'fs';
import { parse } from 'graphql';
import { buildSubgraphSchema } from '@apollo/subgraph';
import resolvers from './resolvers.js';

// schema.graphql vive en la raíz del servicio (dos niveles arriba de src/graphql/).
const sdlString = readFileSync(new URL('../../schema.graphql', import.meta.url), 'utf8');

export const typeDefs = parse(sdlString);

export function buildSchema() {
  return buildSubgraphSchema({ typeDefs, resolvers });
}
