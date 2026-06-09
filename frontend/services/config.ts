const env = import.meta.env;

export const API_ENDPOINTS = {
  tournamentsGraphql: env.VITE_TOURNAMENTS_GRAPHQL_URL || '/api/graphql',
  teams: env.VITE_TEAMS_API_URL || '/api/teams',
  auth: env.VITE_AUTH_API_URL || '/api/auth',
  inscriptions: env.VITE_INSCRIPTIONS_API_URL || '/api/inscriptions',
  matchEvents: env.VITE_MATCHEVENTS_API_URL || '/api/matches',
};
