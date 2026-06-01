import { isBestThirdSlotLabel } from './incomingTransitionEligibility';
import type { StandingsRow, TournamentMatchRow, TournamentStage } from './types';

type InscriptionLookup = ReadonlyMap<string, { display_name?: string | null }>;

function isPhysicalInscriptionId(raw: string): boolean {
  const id = String(raw || '').trim();
  return !!id && !id.startsWith('liga360-slot:') && !id.startsWith('pos:');
}

/** Nombre visible de equipo: ignora etiquetas BN1/BN2 u otros nombres stale del grafo. */
export function resolvePersistedTeamDisplayName(
  displayName: string | null | undefined,
  inscriptionId: string | null | undefined,
  inscriptionById?: InscriptionLookup
): string {
  const id = String(inscriptionId ?? '').trim();
  const dn = String(displayName ?? '').trim();
  const fromInsc = id ? String(inscriptionById?.get(id)?.display_name ?? '').trim() : '';
  // Inscripción física (Postgres) manda sobre Neo4j stale — alinea fixture con inicialización.
  if (fromInsc && isPhysicalInscriptionId(id)) return fromInsc;
  if (fromInsc && (!dn || isBestThirdSlotLabel(dn))) return fromInsc;
  return dn || fromInsc || id || '—';
}

function enrichMatchRow(
  match: TournamentMatchRow,
  inscriptionById?: InscriptionLookup
): TournamentMatchRow {
  const home = match.homeAssignedInscription;
  const away = match.awayAssignedInscription;
  return {
    ...match,
    ...(home
      ? {
          homeAssignedInscription: {
            ...home,
            displayName: resolvePersistedTeamDisplayName(home.displayName, home.inscriptionId, inscriptionById),
          },
        }
      : {}),
    ...(away
      ? {
          awayAssignedInscription: {
            ...away,
            displayName: resolvePersistedTeamDisplayName(away.displayName, away.inscriptionId, inscriptionById),
          },
        }
      : {}),
  };
}

function enrichStandingsRow(row: StandingsRow, inscriptionById?: InscriptionLookup): StandingsRow {
  return {
    ...row,
    displayName: resolvePersistedTeamDisplayName(row.displayName, row.inscriptionId, inscriptionById),
  };
}

/** Corrige nombres stale (p. ej. BN1/BN2) antes de renderizar fixture o tablas de grupos. */
export function enrichStageTeamDisplayNames(
  stage: TournamentStage,
  inscriptionById?: InscriptionLookup
): TournamentStage {
  if (!inscriptionById?.size) return stage;
  return {
    ...stage,
    standings: (stage.standings || []).map((r) => enrichStandingsRow(r, inscriptionById)),
    matches: (stage.matches || []).map((m) => enrichMatchRow(m, inscriptionById)),
    groups: (stage.groups || []).map((g) => ({
      ...g,
      standings: (g.standings || []).map((r) => enrichStandingsRow(r, inscriptionById)),
      matches: (g.matches || []).map((m) => enrichMatchRow(m, inscriptionById)),
      assignedInscriptions: (g.assignedInscriptions || []).map((a) => ({
        ...a,
        displayName: resolvePersistedTeamDisplayName(a.displayName, a.inscriptionId, inscriptionById),
      })),
    })),
    assignedInscriptions: (stage.assignedInscriptions || []).map((a) => ({
      ...a,
      displayName: resolvePersistedTeamDisplayName(a.displayName, a.inscriptionId, inscriptionById),
    })),
  };
}

/** Mapa id → nombre real a partir del torneo (grupos, asignaciones, partidos). */
export function buildInscriptionNameLookupFromTournament(
  tournament: { competitions?: Array<{ stages?: Array<{
    assignedInscriptions?: Array<{ inscriptionId?: string | null; displayName?: string | null }>;
    matches?: Array<{
      homeAssignedInscription?: { inscriptionId?: string | null; displayName?: string | null } | null;
      awayAssignedInscription?: { inscriptionId?: string | null; displayName?: string | null } | null;
    }>;
    groups?: Array<{
      assignedInscriptions?: Array<{ inscriptionId?: string | null; displayName?: string | null }>;
      standings?: Array<{ inscriptionId?: string | null; displayName?: string | null }>;
    }>;
  }> }> }
): Map<string, string> {
  const out = new Map<string, string>();
  const add = (id: string | null | undefined, displayName: string | null | undefined) => {
    const sid = String(id ?? '').trim();
    const dn = String(displayName ?? '').trim();
    if (!sid || !dn || isBestThirdSlotLabel(dn)) return;
    if (!out.has(sid)) out.set(sid, dn);
  };

  for (const c of tournament.competitions || []) {
    for (const st of c.stages || []) {
      for (const ai of st.assignedInscriptions || []) {
        add(ai.inscriptionId, ai.displayName);
      }
      for (const m of st.matches || []) {
        add(m.homeAssignedInscription?.inscriptionId, m.homeAssignedInscription?.displayName);
        add(m.awayAssignedInscription?.inscriptionId, m.awayAssignedInscription?.displayName);
      }
      for (const g of st.groups || []) {
        for (const ai of g.assignedInscriptions || []) {
          add(ai.inscriptionId, ai.displayName);
        }
        for (const row of g.standings || []) {
          add(row.inscriptionId, row.displayName);
        }
      }
    }
  }
  return out;
}

export function mergeInscriptionNameLookups(
  ...maps: Array<ReadonlyMap<string, string> | undefined>
): Map<string, string> {
  const out = new Map<string, string>();
  for (const map of maps) {
    if (!map) continue;
    for (const [id, name] of map) {
      const sid = String(id ?? '').trim();
      const dn = String(name ?? '').trim();
      if (!sid || !dn || isBestThirdSlotLabel(dn)) continue;
      if (!out.has(sid)) out.set(sid, dn);
    }
  }
  return out;
}
