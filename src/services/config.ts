const env = import.meta.env;

export const API_ENDPOINTS = {
  tournamentsGraphql: env.VITE_TOURNAMENTS_GRAPHQL_URL || 'http://localhost:4000/graphql',
  teams: env.VITE_TEAMS_API_URL || 'http://localhost:4002',
  auth: env.VITE_AUTH_API_URL || 'http://localhost:4003',
  inscriptions: env.VITE_INSCRIPTIONS_API_URL || 'http://localhost:4004',
};
