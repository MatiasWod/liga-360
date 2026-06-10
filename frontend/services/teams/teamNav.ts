import { TEAMS_BASE } from './client';
import { readSessionUser } from './session';

/**
 * Navegación global a la vista de un equipo (roster + estadísticas).
 * Cualquier componente puede pedir abrir un equipo sin prop-drilling: se emite un
 * CustomEvent que App.tsx escucha. Solo funciona para usuarios logueados (el backend
 * además exige token para ver el roster).
 */

export const OPEN_TEAM_EVENT = 'liga360:open-team';

export interface OpenTeamDetail {
  teamId: string;
  teamName?: string;
}

const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '');

/** Resuelve un nombre de equipo a su id en teams-svc (lookup público por nombre). */
export async function resolveTeamIdByName(name: string): Promise<string | null> {
  const clean = name.trim();
  if (!clean) return null;
  try {
    const res = await fetch(`${TEAMS_BASE}?names=${encodeURIComponent(clean)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const teams: any[] = json?.teams ?? [];
    const exact = teams.find((t) => normalize(String(t.name ?? '')) === normalize(clean));
    const team = exact ?? teams[0];
    return team ? String(team.id) : null;
  } catch {
    return null;
  }
}

function dispatchOpen(detail: OpenTeamDetail) {
  window.dispatchEvent(new CustomEvent<OpenTeamDetail>(OPEN_TEAM_EVENT, { detail }));
}

/** Abre la vista del equipo por id (cuando el componente ya lo conoce). */
export function openTeamById(teamId: string | number, teamName?: string) {
  if (!readSessionUser()) return; // anónimos no ven rosters
  dispatchOpen({ teamId: String(teamId), teamName });
}

/**
 * Abre la vista del equipo resolviendo por nombre (standings, fixtures, etc. solo
 * conocen el displayName). Si el nombre no corresponde a un Team registrado, no hace nada.
 */
export async function openTeamByName(teamName: string) {
  if (!readSessionUser()) return;
  const id = await resolveTeamIdByName(teamName);
  if (id) dispatchOpen({ teamId: id, teamName });
}

/** Suscripción usada por App.tsx. Devuelve el unsubscribe. */
export function subscribeOpenTeam(cb: (detail: OpenTeamDetail) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<OpenTeamDetail>).detail);
  window.addEventListener(OPEN_TEAM_EVENT, handler);
  return () => window.removeEventListener(OPEN_TEAM_EVENT, handler);
}
