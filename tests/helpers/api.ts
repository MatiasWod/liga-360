import type { APIRequestContext } from '@playwright/test';

const AUTH_BASE = 'http://localhost:4003';
const TEAMS_BASE = 'http://localhost:4002';
const INSCRIPTIONS_BASE = 'http://localhost:4004';
const GATEWAY_BASE = 'http://localhost:4000';

type RegisterMode = 'team' | 'organizer' | 'participant';

export type SessionUser = {
  id: number;
  username: string;
  type: RegisterMode;
};

export type Session = {
  token: string;
  user: SessionUser;
  credentials: {
    username: string;
    password: string;
  };
};

export type E2ETeam = {
  id: number;
  name: string;
  inviteCode: string;
};

export type E2ETournament = {
  id: string;
  name: string;
};

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function parseJson(response: Awaited<ReturnType<APIRequestContext['post']>>) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function assertOk(response: Awaited<ReturnType<APIRequestContext['post']>>, fallback: string) {
  if (response.ok()) return;
  const json = await parseJson(response);
  throw new Error(json?.error || `${fallback} (HTTP ${response.status()})`);
}

export async function ensureBackendsHealthy(request: APIRequestContext): Promise<void> {
  const urls = [
    `${GATEWAY_BASE}/health`,
    `${TEAMS_BASE}/health`,
    `${AUTH_BASE}/health`,
    `${INSCRIPTIONS_BASE}/health`,
  ];

  for (const url of urls) {
    const response = await request.get(url);
    if (!response.ok()) {
      throw new Error(`Backend no disponible para E2E crítico: ${url}`);
    }
  }
}

export async function registerAndLogin(
  request: APIRequestContext,
  mode: RegisterMode,
  prefix: string
): Promise<Session> {
  const username = `${prefix}_${uniqueSuffix()}`.toLowerCase();
  const password = 'Pass1234!';
  const name = mode === 'team' ? `Team ${prefix}` : mode === 'organizer' ? `Org ${prefix}` : `User ${prefix}`;

  const registerResponse = await request.post(`${AUTH_BASE}/register`, {
    data: { mode, username, password, name },
  });
  await assertOk(registerResponse, 'No se pudo registrar usuario E2E');

  const loginResponse = await request.post(`${AUTH_BASE}/login`, {
    data: { username, password },
  });
  await assertOk(loginResponse, 'No se pudo loguear usuario E2E');
  const loginJson = await parseJson(loginResponse);

  return {
    token: String(loginJson.token),
    user: {
      id: Number(loginJson.user?.id),
      username: String(loginJson.user?.username || username),
      type: mode,
    },
    credentials: {
      username,
      password,
    },
  };
}

export async function ensureOwnedTeam(
  request: APIRequestContext,
  session: Session,
  preferredName: string
): Promise<E2ETeam> {
  const listResponse = await request.get(`${TEAMS_BASE}?mine=true`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });
  await assertOk(listResponse, 'No se pudo listar equipos del team');
  const listedJson = await parseJson(listResponse);
  let team = Array.isArray(listedJson?.teams) && listedJson.teams.length > 0 ? listedJson.teams[0] : null;
  if (!team) {
    const createResponse = await request.post(`${TEAMS_BASE}`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      data: { name: preferredName },
    });
    await assertOk(createResponse, 'No se pudo crear equipo del team');
    const createJson = await parseJson(createResponse);
    team = createJson.team;
  }

  if (!team?.invite_code) {
    const codeResponse = await request.get(`${TEAMS_BASE}/me/invite-code`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    await assertOk(codeResponse, 'No se pudo obtener invite_code de equipo');
    const codeJson = await parseJson(codeResponse);
    team.invite_code = codeJson.inviteCode;
  }

  return {
    id: Number(team.id),
    name: String(team.name),
    inviteCode: String(team.invite_code),
  };
}

export async function createTournament(
  request: APIRequestContext,
  organizer: Session,
  payload: { namePrefix: string; inscriptionMode: 'public' | 'invitation' }
): Promise<E2ETournament> {
  const name = `${payload.namePrefix}-${uniqueSuffix()}`;
  const mutation = `
    mutation CreateTournament($name: String!, $inscriptionMode: InscriptionMode!, $status: TournamentStatus!) {
      createTournament(
        name: $name,
        sport: "futbol",
        season: "2026",
        venue: "E2E Venue",
        participantType: "team",
        inscriptionMode: $inscriptionMode,
        status: $status
      ) {
        id
        name
      }
    }
  `;
  const response = await request.post(`${GATEWAY_BASE}/graphql`, {
    headers: {
      Authorization: `Bearer ${organizer.token}`,
      'Content-Type': 'application/json',
    },
    data: {
      query: mutation,
      variables: {
        name,
        inscriptionMode: payload.inscriptionMode,
        status: 'published',
      },
    },
  });
  await assertOk(response, 'No se pudo crear torneo E2E');
  const json = await parseJson(response);
  const created = json?.data?.createTournament;
  if (!created?.id) throw new Error('Respuesta inválida al crear torneo E2E');

  return { id: String(created.id), name: String(created.name || name) };
}

export async function createPublicInvite(
  request: APIRequestContext,
  organizer: Session,
  tournamentId: string
): Promise<string> {
  const response = await request.post(`${INSCRIPTIONS_BASE}/invites`, {
    headers: {
      Authorization: `Bearer ${organizer.token}`,
      'Content-Type': 'application/json',
    },
    data: {
      tournamentId,
      competitionId: null,
      type: 'public',
    },
  });
  await assertOk(response, 'No se pudo crear invitación pública E2E');
  const json = await parseJson(response);
  return String(json?.invite?.token || '');
}

export async function createTargetedInvite(
  request: APIRequestContext,
  organizer: Session,
  tournamentId: string,
  targetTeamCode?: string | null,
  targetParticipantUserId?: number | null
): Promise<number> {
  const response = await request.post(`${INSCRIPTIONS_BASE}/invites`, {
    headers: {
      Authorization: `Bearer ${organizer.token}`,
      'Content-Type': 'application/json',
    },
    data: {
      tournamentId,
      competitionId: null,
      type: 'targeted',
      targetTeamCode: targetTeamCode || null,
      targetParticipantUserId: targetParticipantUserId ?? null,
    },
  });
  await assertOk(response, 'No se pudo crear invitación dirigida E2E');
  const json = await parseJson(response);
  return Number(json?.invite?.id);
}

export async function listTournamentInscriptions(
  request: APIRequestContext,
  session: Session,
  tournamentId: string
) {
  const response = await request.get(`${INSCRIPTIONS_BASE}/tournaments/${encodeURIComponent(tournamentId)}/inscriptions`, {
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });
  await assertOk(response, 'No se pudieron listar inscripciones por torneo E2E');
  const json = await parseJson(response);
  return Array.isArray(json?.inscriptions) ? json.inscriptions : [];
}

export async function listTeamInvites(
  request: APIRequestContext,
  teamSession: Session
) {
  const response = await request.get(`${INSCRIPTIONS_BASE}/me/invites`, {
    headers: {
      Authorization: `Bearer ${teamSession.token}`,
    },
  });
  await assertOk(response, 'No se pudieron listar invitaciones del equipo');
  const json = await parseJson(response);
  return Array.isArray(json?.invites) ? json.invites : [];
}

export async function listParticipantInvites(
  request: APIRequestContext,
  participantSession: Session
) {
  const response = await request.get(`${INSCRIPTIONS_BASE}/participants/me/invites`, {
    headers: {
      Authorization: `Bearer ${participantSession.token}`,
    },
  });
  await assertOk(response, 'No se pudieron listar invitaciones del participante');
  const json = await parseJson(response);
  return Array.isArray(json?.invites) ? json.invites : [];
}

export async function createTeamAndOrganizerContext(request: APIRequestContext, prefix: string) {
  const organizer = await registerAndLogin(request, 'organizer', `org_${prefix}`);
  const teamSession = await registerAndLogin(request, 'team', `team_${prefix}`);
  const team = await ensureOwnedTeam(request, teamSession, `E2E Team ${prefix}`);
  return { organizer, teamSession, team };
}

export async function createParticipantAndOrganizerContext(request: APIRequestContext, prefix: string) {
  const organizer = await registerAndLogin(request, 'organizer', `org_${prefix}`);
  const participantSession = await registerAndLogin(request, 'participant', `participant_${prefix}`);
  return { organizer, participantSession };
}
