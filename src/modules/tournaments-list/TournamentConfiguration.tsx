import React from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CompetitionPhaseFilter } from '../../components/CompetitionPhaseFilter';
import {
  createTournamentInvite,
  createManualParticipantInscriptionsBatch,
  createManualTeamInscriptionsBatch,
  createTeamInvite,
  listTournamentInvites,
  listTournamentInscriptions,
  type InscriptionItem,
  updateInscriptionStatus,
} from '../../services/inscriptionsApi';
import {
  assignInscriptionToGroup,
  assignInscriptionToStage,
  getTournamentConfigurationById,
  syncStageGroups,
  unassignInscriptionFromStage,
} from '../../services/tournaments/configuration';
import { TEAMS_BASE } from '../../services/teams/client';
import { FixturePlanningPanel } from './FixturePlanningPanel';
import type {
  AssignedInscription,
  TournamentCompetition as Competition,
  TournamentEntity as Tournament,
  TournamentStage as Stage,
} from './types';

/** Entrada en la grilla de una fase: fila en Postgres o asignación sólo en Neo4j (p. ej. seeds viejos). */
type StageRosterEntry =
  | { kind: 'inscription'; item: InscriptionItem }
  | { kind: 'graphOnly'; assigned: AssignedInscription };

function buildStageRosterEntries(
  assignedList: AssignedInscription[] | undefined,
  byId: Map<string, InscriptionItem>
): StageRosterEntry[] {
  const out: StageRosterEntry[] = [];
  for (const assigned of assignedList || []) {
    const item = byId.get(String(assigned.inscriptionId));
    if (item && ['PENDIENTE', 'ACEPTADO'].includes(String(item.status))) {
      out.push({ kind: 'inscription', item });
      continue;
    }
    const label = (assigned.displayName || '').trim() || String(assigned.inscriptionId || '');
    if (label) out.push({ kind: 'graphOnly', assigned });
  }
  return out;
}

type Tab = 'gestion' | 'inicializacion' | 'fixture';

interface TournamentConfigurationProps {
  tournamentId: string;
  onBack: () => void;
}

const DEFAULT_SHIELD_SRC = '/predeterminado.png';

function parseJsonSafe(value?: string | null): any {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stageCapacity(stage: Stage): number | null {
  const cfg = parseJsonSafe(stage.configJson || null) || {};
  if (stage.format === 'groups') {
    const groups = Number(cfg.numGroups);
    const perGroup = Number(cfg.teamsPerGroup);
    if (Number.isInteger(groups) && groups > 0 && Number.isInteger(perGroup) && perGroup > 0) return groups * perGroup;
    return null;
  }
  if (stage.format === 'league' || stage.format === 'elimination') {
    const participants = Number(cfg.numParticipants);
    if (Number.isInteger(participants) && participants > 0) return participants;
  }
  return null;
}

function teamsPerGroup(stage: Stage): number | null {
  if (stage.format !== 'groups') return null;
  const cfg = parseJsonSafe(stage.configJson || null) || {};
  const perGroup = Number(cfg.teamsPerGroup);
  return Number.isInteger(perGroup) && perGroup > 0 ? perGroup : null;
}

type StageTransition = NonNullable<Stage['transitions']>[number];

function countTeamsFromTransition(tr: StageTransition, fromStage: Stage): number {
  const kind = String(tr.selectionKind || 'top').toLowerCase();
  const cfg = parseJsonSafe(fromStage.configJson || null) || {};
  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    return Math.max(0, to - from + 1);
  }
  if (kind === 'bottom') {
    const b = Number(tr.bottomN) || 0;
    if (fromStage.format === 'groups') {
      const numGroups = (fromStage.groups || []).length || Number(cfg.numGroups) || 0;
      const perGroup = Math.min(b, Number(cfg.teamsPerGroup) || b);
      return numGroups > 0 ? numGroups * perGroup : b;
    }
    return b;
  }
  const t = Number(tr.topN) || 0;
  if (fromStage.format === 'groups') {
    const numGroups = (fromStage.groups || []).length || Number(cfg.numGroups) || 0;
    const teamsPerG = Number(cfg.teamsPerGroup) || 0;
    if (numGroups <= 0) return t;
    const perGroup = Math.min(t, teamsPerG || t);
    return perGroup * numGroups;
  }
  return t;
}

function describeSelectionNatural(tr: StageTransition, fromStage: Stage): string {
  const kind = String(tr.selectionKind || 'top').toLowerCase();
  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    return `puestos ${from} a ${to} en la tabla`;
  }
  if (kind === 'bottom') {
    const b = Number(tr.bottomN) || 0;
    return fromStage.format === 'groups' ? `últimos ${b} por grupo` : `últimos ${b} en la tabla`;
  }
  const t = Number(tr.topN) || 0;
  return fromStage.format === 'groups' ? `primeros ${t} por grupo` : `primeros ${t} en la tabla`;
}

/** Etiquetas previstas por cupo (p. ej. 1° Grupo A, 2° Grupo B) para cruzar con la 1ª ronda. */
function buildQualifierLabels(tr: StageTransition, fromStage: Stage): string[] {
  const kind = String(tr.selectionKind || 'top').toLowerCase();
  const cfg = parseJsonSafe(fromStage.configJson || null) || {};
  const groups = [...(fromStage.groups || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  if (kind === 'range') {
    const from = Number(tr.rangeFrom) || 0;
    const to = Number(tr.rangeTo) || 0;
    const n = Math.max(0, to - from + 1);
    return Array.from({ length: n }, (_, i) => `${from + i}° puesto · ${fromStage.name}`);
  }
  if (kind === 'bottom') {
    const b = Number(tr.bottomN) || 0;
    if (fromStage.format === 'groups') {
      const out: string[] = [];
      for (const g of groups) {
        for (let k = 1; k <= b; k++) {
          out.push(`${k}° desde abajo · ${g.name}`);
        }
      }
      return out.length > 0 ? out : Array.from({ length: b }, (_, i) => `Último ${i + 1} · ${fromStage.name}`);
    }
    return Array.from({ length: b }, (_, i) => `Último ${i + 1} · ${fromStage.name}`);
  }
  const t = Number(tr.topN) || 0;
  if (fromStage.format === 'groups') {
    const out: string[] = [];
    for (const g of groups) {
      for (let rank = 1; rank <= t; rank++) {
        out.push(`${rank}° ${g.name}`);
      }
    }
    return out.length > 0 ? out : Array.from({ length: t }, (_, i) => `${i + 1}° (grupo) · ${fromStage.name}`);
  }
  if (fromStage.format === 'league') {
    return Array.from({ length: t }, (_, i) => `${i + 1}° ${fromStage.name}`);
  }
  return Array.from({ length: t }, (_, i) => `Clasificado ${i + 1} · ${fromStage.name}`);
}

function collectIncomingTransitions(
  tournament: Tournament | null,
  targetStageId: string
): Array<{ fromStage: Stage; tr: StageTransition; fromCompetitionName: string }> {
  const out: Array<{ fromStage: Stage; tr: StageTransition; fromCompetitionName: string }> = [];
  for (const c of tournament?.competitions || []) {
    for (const s of c.stages || []) {
      for (const tr of s.transitions || []) {
        if (String(tr.toStageId || '') === targetStageId) {
          out.push({ fromStage: s, tr, fromCompetitionName: c.name });
        }
      }
    }
  }
  out.sort((a, b) => {
    const o = Number(a.fromStage.order || 0) - Number(b.fromStage.order || 0);
    if (o !== 0) return o;
    return String(a.fromStage.name || '').localeCompare(String(b.fromStage.name || ''), 'es', { sensitivity: 'base' });
  });
  return out;
}

function flattenQualifierLabels(
  incoming: Array<{ fromStage: Stage; tr: StageTransition; fromCompetitionName: string }>
): string[] {
  const labels: string[] = [];
  for (const { fromStage, tr, fromCompetitionName } of incoming) {
    const part = buildQualifierLabels(tr, fromStage);
    const prefix = fromCompetitionName ? `[${fromCompetitionName}] ` : '';
    for (const p of part) {
      labels.push(`${prefix}${p}`);
    }
  }
  return labels;
}

type IncomingTransitionRow = ReturnType<typeof collectIncomingTransitions>[number];

function InitializationInboundBanner({
  incoming,
  entitySingular,
  entityPlural,
}: {
  incoming: IncomingTransitionRow[];
  entitySingular: string;
  entityPlural: string;
}) {
  const total = React.useMemo(
    () => incoming.reduce((sum, x) => sum + countTeamsFromTransition(x.tr, x.fromStage), 0),
    [incoming]
  );
  if (incoming.length === 0) {
    return (
      <div className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-snug text-slate-600">
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2">
          <span className="font-medium text-slate-800">Origen:</span> ninguna relación de avance desde otra etapa apunta a esta
          fase. Podés asignar {entityPlural} manualmente o usar esta etapa como entrada directa.
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-snug text-slate-800">
      <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2">
        <p className="font-medium text-emerald-950">
          {total} {total === 1 ? entitySingular : entityPlural} desde otra{incoming.length > 1 ? 's' : ''} fase
          {incoming.length > 1 ? 's' : ''}
        </p>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-slate-700">
          {incoming.map(({ fromStage, tr, fromCompetitionName }) => {
            const n = countTeamsFromTransition(tr, fromStage);
            const sel = describeSelectionNatural(tr, fromStage);
            const lbl = tr.label?.trim();
            return (
              <li key={tr.id}>
                <span className="font-medium">{n}</span> {n === 1 ? entitySingular : entityPlural} desde{' '}
                <strong>{fromStage.name}</strong>
                {fromCompetitionName ? ` · ${fromCompetitionName}` : ''}: {sel}
                {lbl ? ` · ${lbl}` : ''}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function resolveBadgeUrl(rawUrl?: string | null): string {
  const url = String(rawUrl || '').trim();
  if (!url) return DEFAULT_SHIELD_SRC;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${TEAMS_BASE}${url}`;
  return `${TEAMS_BASE}/${url}`;
}

function normalizeParticipantType(value?: string | null): 'teams' | 'individuals' {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'team' || raw === 'teams') return 'teams';
  if (raw === 'participant' || raw === 'participants' || raw === 'individual' || raw === 'individuals') return 'individuals';
  return 'teams';
}

function initialsFromName(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'P';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'P';
}

function isInscriptionAcceptedStatus(status: unknown): boolean {
  return String(status || '').trim().toUpperCase() === 'ACEPTADO';
}

function matchesParticipantPhaseFilter(
  placement: { competitionIds: Set<string>; stageIds: Set<string> },
  filter: { mode: 'include' | 'exclude'; selections: Array<{ competitionId: string; phaseId: string }> }
): boolean {
  const stageSel = new Set((filter.selections || []).map((s) => String(s.phaseId)));
  const compSel = new Set((filter.selections || []).map((s) => String(s.competitionId)));
  if (stageSel.size === 0 && compSel.size === 0) return true;
  const matchesStage = [...stageSel].some((id) => placement.stageIds.has(id));
  const matchesComp = [...compSel].some((id) => placement.competitionIds.has(id));
  const matches = matchesStage || matchesComp;
  return filter.mode === 'include' ? matches : !matches;
}

/** Fila en “Equipos participantes”: inscripción aceptada o asignación sólo en el grafo (sin fila en Postgres). */
type GestionParticipantRow =
  | { kind: 'inscription'; item: InscriptionItem }
  | {
      kind: 'graphOnly';
      inscriptionId: string;
      displayName: string;
      placement: { competitionIds: Set<string>; stageIds: Set<string> };
    };

export const TournamentConfiguration: React.FC<TournamentConfigurationProps> = ({ tournamentId, onBack }) => {
  const [tab, setTab] = React.useState<Tab>('gestion');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [inscriptions, setInscriptions] = React.useState<InscriptionItem[]>([]);
  const [initializationCompetitionId, setInitializationCompetitionId] = React.useState('');
  const [publicInviteCode, setPublicInviteCode] = React.useState('');
  const [targetedInvitesPendingCount, setTargetedInvitesPendingCount] = React.useState(0);
  const [targetedInvitesRejectedCount, setTargetedInvitesRejectedCount] = React.useState(0);
  const [targetedInvitesAcceptedCount, setTargetedInvitesAcceptedCount] = React.useState(0);
  const [draggingInscriptionId, setDraggingInscriptionId] = React.useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = React.useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = React.useState<{
    mode: 'include' | 'exclude';
    selections: Array<{ competitionId: string; phaseId: string }>;
  }>({ mode: 'include', selections: [] });
  const [relationFilterMode, setRelationFilterMode] = React.useState<'include' | 'exclude'>('include');
  const [selectedRelationTransitionIds, setSelectedRelationTransitionIds] = React.useState<string[]>([]);
  const [acceptedTeamsFilter, setAcceptedTeamsFilter] = React.useState<{
    mode: 'include' | 'exclude';
    selections: Array<{ competitionId: string; phaseId: string }>;
  }>({ mode: 'include', selections: [] });
  const [manualRows, setManualRows] = React.useState<Array<{ id: string; name: string; inviteCode: string }>>([
    { id: crypto.randomUUID(), name: '', inviteCode: '' },
  ]);

  const normalizedTournamentParticipantType = React.useMemo(
    () => normalizeParticipantType(tournament?.participantType),
    [tournament?.participantType]
  );
  const isTeamsTournament = normalizedTournamentParticipantType === 'teams';
  const entitySingular = isTeamsTournament ? 'equipo' : 'participante';
  const entityPlural = isTeamsTournament ? 'equipos' : 'participantes';

  const competitionNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const competition of tournament?.competitions || []) map.set(competition.id, competition.name);
    return map;
  }, [tournament]);

  const stageMetaById = React.useMemo(() => {
    const map = new Map<string, { stageName: string; competitionId: string; competitionName: string }>();
    for (const competition of tournament?.competitions || []) {
      for (const stage of competition.stages || []) {
        map.set(stage.id, {
          stageName: stage.name,
          competitionId: competition.id,
          competitionName: competition.name,
        });
      }
    }
    return map;
  }, [tournament]);

  const assignmentByInscriptionId = React.useMemo(() => {
    const map = new Map<string, Array<{ stageId: string; competitionId: string }>>();
    for (const competition of tournament?.competitions || []) {
      for (const stage of competition.stages || []) {
        for (const assigned of stage.assignedInscriptions || []) {
          const key = String(assigned.inscriptionId);
          const prev = map.get(key) || [];
          prev.push({ stageId: stage.id, competitionId: competition.id });
          map.set(key, prev);
        }
      }
    }
    return map;
  }, [tournament]);

  const stageById = React.useMemo(() => {
    const map = new Map<string, Stage>();
    for (const competition of tournament?.competitions || []) {
      for (const stage of competition.stages || []) map.set(stage.id, stage);
    }
    return map;
  }, [tournament]);

  const inscriptionIdsByStageId = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const competition of tournament?.competitions || []) {
      for (const stage of competition.stages || []) {
        const ids = new Set<string>();
        for (const assigned of stage.assignedInscriptions || []) ids.add(String(assigned.inscriptionId));
        map.set(stage.id, ids);
      }
    }
    return map;
  }, [tournament]);

  const pendingRequests = React.useMemo(() => inscriptions.filter((item) => item.status === 'PENDIENTE'), [inscriptions]);
  const inscriptionById = React.useMemo(() => {
    const map = new Map<string, InscriptionItem>();
    for (const item of inscriptions) map.set(String(item.id), item);
    return map;
  }, [inscriptions]);

  const initializationCompetition = React.useMemo(
    () => tournament?.competitions.find((competition) => competition.id === initializationCompetitionId) || null,
    [tournament, initializationCompetitionId]
  );

  const relationFilterOptions = React.useMemo(() => {
    const options: Array<{ id: string; label: string; fromStageId: string; toStageId: string }> = [];
    for (const competition of tournament?.competitions || []) {
      for (const stage of competition.stages || []) {
        for (const transition of stage.transitions || []) {
          const toStageId = String(transition.toStageId || '');
          if (!toStageId) continue;
          const dst = stageById.get(toStageId);
          if (!dst) continue;
          const label = `${stage.name} → ${dst.name}${transition.label ? ` (${transition.label})` : ''}`;
          options.push({ id: transition.id, label, fromStageId: stage.id, toStageId });
        }
      }
    }
    return options;
  }, [tournament, stageById]);

  const relationOptionById = React.useMemo(() => {
    const map = new Map<string, { fromStageId: string; toStageId: string }>();
    for (const option of relationFilterOptions) {
      map.set(option.id, { fromStageId: option.fromStageId, toStageId: option.toStageId });
    }
    return map;
  }, [relationFilterOptions]);

  const visibleRelationOptions = React.useMemo(() => {
    if (!initializationCompetitionId) return [];
    return relationFilterOptions.filter((option) => {
      const fromMeta = stageMetaById.get(option.fromStageId);
      const toMeta = stageMetaById.get(option.toStageId);
      return (
        String(fromMeta?.competitionId || '') === initializationCompetitionId ||
        String(toMeta?.competitionId || '') === initializationCompetitionId
      );
    });
  }, [relationFilterOptions, stageMetaById, initializationCompetitionId]);

  const phaseFilterCompetitions = React.useMemo(
    () =>
      (tournament?.competitions || [])
        .map((competition: Competition) => ({
          id: competition.id,
          name: competition.name,
          stages: (competition.stages || []).map((stage) => ({ id: stage.id, name: stage.name })),
        }))
        .filter((group) => group.stages.length > 0)
        .map((group) => ({
          id: group.id,
          name: group.name,
          phases: group.stages,
        })),
    [tournament]
  );

  const selectedStageFilterIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const selection of phaseFilter.selections || []) {
      ids.add(String(selection.phaseId));
    }
    return ids;
  }, [phaseFilter]);

  function inscriptionPlacement(inscription: InscriptionItem) {
    const placements = assignmentByInscriptionId.get(String(inscription.id)) || [];
    const competitionIds = new Set<string>();
    const stageIds = new Set<string>();
    for (const placement of placements) {
      competitionIds.add(String(placement.competitionId || ''));
      stageIds.add(String(placement.stageId || ''));
    }
    if (inscription.competition_id) competitionIds.add(String(inscription.competition_id));
    return { competitionIds, stageIds };
  }

  function getInscriptionCompetitionLabels(inscription: InscriptionItem): string[] {
    const placement = inscriptionPlacement(inscription);
    return Array.from(placement.competitionIds)
      .filter((id) => String(id || '').trim() && String(id || '').toLowerCase() !== 'null')
      .map((id) => competitionNameById.get(id) || id)
      .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  const initializationPool = React.useMemo(() => {
    const activeCompetitionId = initializationCompetitionId;
    return inscriptions
      .filter((item) => ['PENDIENTE', 'ACEPTADO'].includes(item.status))
      .filter((item) => {
        const placement = inscriptionPlacement(item);
        if (selectedStageFilterIds.size > 0) {
          const matches = Array.from(selectedStageFilterIds).some((stageId) => placement.stageIds.has(stageId));
          if (phaseFilter.mode === 'include' && !matches) return false;
          if (phaseFilter.mode === 'exclude' && matches) return false;
        }
        if (selectedRelationTransitionIds.length > 0) {
          const relationMatches = selectedRelationTransitionIds.some((transitionId) => {
            const option = relationOptionById.get(transitionId);
            if (!option) return false;
            const sourceIds = inscriptionIdsByStageId.get(option.fromStageId);
            if (!sourceIds) return false;
            return sourceIds.has(String(item.id));
          });
          if (relationFilterMode === 'include' && !relationMatches) return false;
          if (relationFilterMode === 'exclude' && relationMatches) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aAssigned = assignmentByInscriptionId.get(String(a.id)) || [];
        const bAssigned = assignmentByInscriptionId.get(String(b.id)) || [];
        const aInActive =
          Boolean(activeCompetitionId) &&
          (String(a.competition_id || '') === activeCompetitionId || aAssigned.some((p) => p.competitionId === activeCompetitionId));
        const bInActive =
          Boolean(activeCompetitionId) &&
          (String(b.competition_id || '') === activeCompetitionId || bAssigned.some((p) => p.competitionId === activeCompetitionId));
        if (aInActive !== bInActive) return aInActive ? 1 : -1; // verdes al final
        return String(a.display_name || '').localeCompare(String(b.display_name || ''), 'es', { sensitivity: 'base' });
      });
  }, [
    inscriptions,
    assignmentByInscriptionId,
    initializationCompetitionId,
    selectedStageFilterIds,
    phaseFilter.mode,
    selectedRelationTransitionIds,
    relationFilterMode,
    relationOptionById,
    inscriptionIdsByStageId,
  ]);

  /** Inscripciones aceptadas + asignaciones en fase sin fila en inscriptions-svc (alineado con vista Inicialización / fixture). */
  const gestionParticipantsPool = React.useMemo(() => {
    const rows = new Map<string, GestionParticipantRow>();

    for (const item of inscriptions) {
      if (!isInscriptionAcceptedStatus(item.status)) continue;
      rows.set(String(item.id), { kind: 'inscription', item });
    }

    for (const competition of tournament?.competitions || []) {
      for (const stage of competition.stages || []) {
        for (const assigned of stage.assignedInscriptions || []) {
          const id = String(assigned.inscriptionId);
          if (rows.has(id)) continue;
          if (inscriptionById.has(id)) continue;
          const displayName = (assigned.displayName || '').trim() || id;
          rows.set(id, {
            kind: 'graphOnly',
            inscriptionId: id,
            displayName,
            placement: {
              competitionIds: new Set([String(competition.id)]),
              stageIds: new Set([String(stage.id)]),
            },
          });
        }
      }
    }

    const filtered: GestionParticipantRow[] = [];
    for (const row of rows.values()) {
      const placement =
        row.kind === 'inscription' ? inscriptionPlacement(row.item) : row.placement;
      if (!matchesParticipantPhaseFilter(placement, acceptedTeamsFilter)) continue;
      filtered.push(row);
    }

    filtered.sort((a, b) => {
      const nameA = a.kind === 'inscription' ? a.item.display_name : a.displayName;
      const nameB = b.kind === 'inscription' ? b.item.display_name : b.displayName;
      return String(nameA || '').localeCompare(String(nameB || ''), 'es', { sensitivity: 'base' });
    });
    return filtered;
  }, [inscriptions, tournament, acceptedTeamsFilter, inscriptionById, assignmentByInscriptionId]);

  const [teamsPage, setTeamsPage] = React.useState(1);
  const teamsPerPage = 12;
  const totalTeamsPages = Math.max(1, Math.ceil(initializationPool.length / teamsPerPage));
  const pagedPool = React.useMemo(
    () => initializationPool.slice((teamsPage - 1) * teamsPerPage, teamsPage * teamsPerPage),
    [initializationPool, teamsPage]
  );

  React.useEffect(() => {
    if (teamsPage > totalTeamsPages) setTeamsPage(totalTeamsPages);
  }, [teamsPage, totalTeamsPages]);

  React.useEffect(() => {
    const allowed = new Set(visibleRelationOptions.map((option) => option.id));
    setSelectedRelationTransitionIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [visibleRelationOptions]);

  const loadTournament = React.useCallback(async () => {
    const nextTournament = (await getTournamentConfigurationById(tournamentId)) as Tournament | null;
    setTournament(nextTournament);
    const firstCompetitionId = nextTournament?.competitions?.[0]?.id || '';
    setInitializationCompetitionId((prev) => prev || firstCompetitionId);
    return nextTournament;
  }, [tournamentId]);

  const loadInscriptions = React.useCallback(async () => {
    const list = await listTournamentInscriptions(tournamentId);
    setInscriptions(list || []);
  }, [tournamentId]);

  const loadTournamentInvites = React.useCallback(async () => {
    const invites = await listTournamentInvites(tournamentId);
    let general = (invites || []).find(
      (invite: any) => invite.type === 'public' && invite.status === 'active' && !invite.competition_id
    );
    if (!general) general = await createTournamentInvite(tournamentId);
    setPublicInviteCode(String(general?.token || ''));
    const targeted = (invites || []).filter((invite: any) => invite.type === 'targeted');
    setTargetedInvitesPendingCount(
      targeted.filter(
        (invite: any) =>
          String(invite.invite_response_status || 'pending').toLowerCase() === 'pending' &&
          String(invite.status || '').toLowerCase() === 'active'
      ).length
    );
    setTargetedInvitesRejectedCount(
      targeted.filter((invite: any) => String(invite.invite_response_status || '').toLowerCase() === 'rejected').length
    );
    setTargetedInvitesAcceptedCount(
      targeted.filter((invite: any) => String(invite.invite_response_status || '').toLowerCase() === 'accepted').length
    );
  }, [tournamentId]);

  const refreshAll = React.useCallback(async () => {
    setSaving(true);
    setError('');
    try {
      await loadTournament();
      await loadInscriptions();
      await loadTournamentInvites();
    } catch (e: any) {
      setError(e?.message || 'No se pudo cargar la configuración');
    } finally {
      setSaving(false);
      setLoading(false);
    }
  }, [loadInscriptions, loadTournament, loadTournamentInvites]);

  React.useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  React.useEffect(() => {
    if (tab !== 'inicializacion') return;
    const stages = (initializationCompetition?.stages || []).filter((stage) => stage.format === 'groups');
    if (stages.length === 0) return;
    (async () => {
      for (const stage of stages) {
        await ensureGroupsForStage(stage);
      }
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, initializationCompetition?.id, tournament?.id]);

  async function handleStatusChange(inscriptionId: number, status: 'approved' | 'rejected') {
    setSaving(true);
    setError('');
    try {
      await updateInscriptionStatus(inscriptionId, status);
      await loadInscriptions();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar el estado');
    } finally {
      setSaving(false);
    }
  }

  async function handleManualBatchSubmit(event: React.FormEvent) {
    event.preventDefault();
    const rows = manualRows
      .map((row) => ({ ...row, name: row.name.trim(), inviteCode: row.inviteCode.trim().toUpperCase() }))
      .filter((row) => row.name || row.inviteCode);
    if (rows.length === 0) return;
    setSaving(true);
    setError('');
    try {
      if (isTeamsTournament) {
        await createManualTeamInscriptionsBatch({
          tournamentId,
          competitionId: '',
          entries: rows.filter((row) => row.name).map((row) => ({ name: row.name })),
        });
        for (const row of rows.filter((row) => row.inviteCode)) {
          await createTeamInvite({
            tournamentId,
            competitionId: null,
            targetTeamCode: row.inviteCode,
          });
        }
      } else {
        await createManualParticipantInscriptionsBatch({
          tournamentId,
          competitionId: '',
          entries: rows.filter((row) => row.name).map((row) => ({ name: row.name })),
        });
      }
      setManualRows([{ id: crypto.randomUUID(), name: '', inviteCode: '' }]);
      await loadInscriptions();
      await loadTournamentInvites();
    } catch (e: any) {
      setError(e?.message || 'No se pudo procesar la carga');
    } finally {
      setSaving(false);
    }
  }

  async function moveToStage(inscription: InscriptionItem, nextCompetitionId: string, nextStageId: string) {
    if (!['PENDIENTE', 'ACEPTADO'].includes(inscription.status)) return;
    const currentPlacements = assignmentByInscriptionId.get(String(inscription.id)) || [];
    const alreadyInTarget = currentPlacements.some(
      (placement) => placement.stageId === nextStageId && placement.competitionId === nextCompetitionId
    );
    if (alreadyInTarget) return;

    const targetStage = stageById.get(nextStageId);
    if (targetStage) {
      const cap = stageCapacity(targetStage);
      if (cap && cap > 0) {
        const currentCount = (targetStage.assignedInscriptions || []).length;
        if (currentCount >= cap) {
          setError(`La fase "${targetStage.name}" alcanzó su cupo máximo (${cap}).`);
          return;
        }
      }
    }

    async function clearPlacementsInCompetition(excludeStageId?: string) {
      const placementsInSameCompetition = currentPlacements.filter(
        (placement) => placement.competitionId === nextCompetitionId && placement.stageId !== excludeStageId
      );
      for (const placement of placementsInSameCompetition) {
        await unassignInscriptionFromStage(placement.stageId, String(inscription.id), tournamentId);
      }
    }

    setSaving(true);
    setError('');
    try {
      await clearPlacementsInCompetition(nextStageId);

      if (nextStageId) {
        await assignInscriptionToStage({
          stageId: nextStageId,
          inscriptionId: String(inscription.id),
          tournamentId,
          displayName: inscription.display_name,
        });
      }

      await loadTournament();
      await loadInscriptions();
    } catch (e: any) {
      setError(e?.message || 'No se pudo mover a la fase');
    } finally {
      setSaving(false);
    }
  }

  async function ensureGroupsForStage(stage: Stage) {
    const cfg = parseJsonSafe(stage.configJson || null) || {};
    const numGroups = Number(cfg.numGroups);
    if (stage.format !== 'groups' || !Number.isInteger(numGroups) || numGroups <= 0) return;
    if ((stage.groups || []).length >= numGroups) return;
    await syncStageGroups(stage.id, numGroups);
    await loadTournament();
  }

  async function moveToGroup(inscription: InscriptionItem, stage: Stage, groupId: string) {
    if (!['PENDIENTE', 'ACEPTADO'].includes(inscription.status)) return;
    const group = (stage.groups || []).find((item) => item.id === groupId);
    if (!group) return;
    const groupCap = Number(group.capacity || teamsPerGroup(stage) || 0);
    const groupCount = (group.assignedInscriptions || []).length;
    const alreadyInGroup = (group.assignedInscriptions || []).some((item) => String(item.inscriptionId) === String(inscription.id));
    if (!alreadyInGroup && groupCap > 0 && groupCount >= groupCap) {
      setError(`El ${group.name} alcanzó su cupo máximo (${groupCap}).`);
      return;
    }
    const stageCap = stageCapacity(stage);
    if (stageCap && stageCap > 0) {
      const stageCount = (stage.assignedInscriptions || []).length;
      const alreadyInStage = (stage.assignedInscriptions || []).some((item) => String(item.inscriptionId) === String(inscription.id));
      if (!alreadyInStage && stageCount >= stageCap) {
        setError(`La fase "${stage.name}" alcanzó su cupo máximo (${stageCap}).`);
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const currentPlacements = assignmentByInscriptionId.get(String(inscription.id)) || [];
      for (const placement of currentPlacements.filter(
        (placement) => placement.competitionId === initializationCompetitionId && placement.stageId !== stage.id
      )) {
        await unassignInscriptionFromStage(placement.stageId, String(inscription.id), tournamentId);
      }
      await assignInscriptionToGroup({
        stageId: stage.id,
        groupId,
        inscriptionId: String(inscription.id),
        tournamentId,
        displayName: inscription.display_name,
      });
      await loadTournament();
      await loadInscriptions();
    } catch (e: any) {
      setError(e?.message || 'No se pudo mover al grupo');
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(event: React.DragEvent<HTMLElement>, item: InscriptionItem) {
    const id = String(item.id);
    setDraggingInscriptionId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/inscription-id', id);

    const ghost = document.createElement('div');
    ghost.style.position = 'fixed';
    ghost.style.top = '-9999px';
    ghost.style.left = '-9999px';
    ghost.style.padding = '8px 10px';
    ghost.style.borderRadius = '10px';
    ghost.style.border = '1px solid #cbd5e1';
    ghost.style.background = '#ffffff';
    ghost.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.15)';
    ghost.style.fontSize = '12px';
    ghost.style.fontWeight = '600';
    ghost.style.color = '#0f172a';
    ghost.textContent = item.display_name;
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 16, 16);
    window.setTimeout(() => {
      ghost.remove();
    }, 0);
  }

  function handleDragEnd() {
    setDraggingInscriptionId(null);
    setDragOverZone(null);
  }

  function renderEntryAvatar(item: InscriptionItem, className: string) {
    if (!isTeamsTournament) {
      return (
        <div
          className={`flex items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 ${className}`}
          aria-label={item.display_name}
          title={item.display_name}
        >
          {initialsFromName(item.display_name)}
        </div>
      );
    }
    return (
      <img
        src={resolveBadgeUrl(item.team_badge_url)}
        alt={item.display_name}
        className={`${className} rounded-full object-cover`}
        onError={(event) => {
          const target = event.currentTarget;
          if (target.src.endsWith(DEFAULT_SHIELD_SRC)) return;
          target.src = DEFAULT_SHIELD_SRC;
        }}
      />
    );
  }

  if (loading) return <Card>Cargando configuración del torneo...</Card>;
  if (!tournament) return <Card>{error || 'No se encontró el torneo'}</Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>← Volver</Button>
      </div>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#0F2A33]">Centro de gestión del torneo</h2>
            <p className="text-sm text-slate-600">{tournament.name}</p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab('gestion')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'gestion' ? 'bg-white text-[#0F2A33] shadow-sm' : 'text-slate-600'}`}
            >
              Gestión general
            </button>
            <button
              type="button"
              onClick={() => setTab('inicializacion')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'inicializacion' ? 'bg-white text-[#0F2A33] shadow-sm' : 'text-slate-600'}`}
            >
              Inicialización
            </button>
            <button
              type="button"
              onClick={() => setTab('fixture')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === 'fixture' ? 'bg-white text-[#0F2A33] shadow-sm' : 'text-slate-600'}`}
            >
              Fixture
            </button>
          </div>
        </div>
      </Card>

      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {tab === 'gestion' ? (
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              {isTeamsTournament ? 'Invitaciones y altas manuales' : 'Altas manuales y solicitudes'}
            </h3>
            <div className={`mb-4 grid grid-cols-1 gap-3 ${isTeamsTournament ? 'md:grid-cols-4' : 'md:grid-cols-1'}`}>
              <div className="rounded-xl border border-slate-200 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Código de invitación pública</p>
                <p className="text-base font-semibold text-slate-800">{publicInviteCode || '-'}</p>
              </div>
              {isTeamsTournament ? (
                <>
                  <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Invitaciones en curso</p>
                    <p className="text-base font-semibold text-slate-800">{targetedInvitesPendingCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Invitaciones aceptadas</p>
                    <p className="text-base font-semibold text-emerald-700">{targetedInvitesAcceptedCount}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Invitaciones rechazadas</p>
                    <p className="text-base font-semibold text-rose-700">{targetedInvitesRejectedCount}</p>
                  </div>
                </>
              ) : null}
            </div>

            <form onSubmit={handleManualBatchSubmit} className="space-y-3">
              {manualRows.map((row, index) => (
                <div key={row.id} className={`grid grid-cols-1 gap-2 ${isTeamsTournament ? 'md:grid-cols-12' : 'md:grid-cols-8'}`}>
                  <input
                    className={`rounded-xl border border-slate-200 px-3 py-2 text-sm ${isTeamsTournament ? 'md:col-span-6' : 'md:col-span-6'}`}
                    placeholder={`Nombre del ${entitySingular} #${index + 1}`}
                    value={row.name}
                    onChange={(e) => setManualRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, name: e.target.value } : x)))}
                  />
                  {isTeamsTournament ? (
                    <input
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-4"
                      placeholder="Código invitación (ej: JAV-333)"
                      value={row.inviteCode}
                      onChange={(e) => setManualRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, inviteCode: e.target.value.toUpperCase() } : x)))}
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className={isTeamsTournament ? 'md:col-span-2' : 'md:col-span-2'}
                    onClick={() => setManualRows((prev) => prev.filter((x) => x.id !== row.id))}
                  >
                    Quitar
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setManualRows((prev) => [...prev, { id: crypto.randomUUID(), name: '', inviteCode: '' }])}>
                  + Fila
                </Button>
                <Button type="submit" disabled={saving}>
                  {isTeamsTournament ? 'Agregar equipos / invitaciones' : 'Agregar participantes'}
                </Button>
              </div>
            </form>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Peticiones al torneo</h3>
            <div className="space-y-2">
              {pendingRequests.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <p className="font-medium text-slate-800">{item.display_name}</p>
                    <p className="text-xs text-slate-500">
                      {item.source} · {competitionNameById.get(String(item.competition_id || '')) || 'Sin competencia'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" disabled={saving} onClick={() => handleStatusChange(item.id, 'approved')}>Aceptar</Button>
                    <Button type="button" variant="secondary" disabled={saving} onClick={() => handleStatusChange(item.id, 'rejected')}>Rechazar</Button>
                  </div>
                </div>
              ))}
              {pendingRequests.length === 0 ? <p className="text-sm text-slate-500">No hay peticiones pendientes.</p> : null}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">
              {isTeamsTournament ? 'Equipos participantes del torneo' : 'Participantes del torneo'}
            </h3>
            <CompetitionPhaseFilter
              className="mb-3"
              competitions={phaseFilterCompetitions}
              onChange={setAcceptedTeamsFilter}
            />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {gestionParticipantsPool.map((row) => {
                if (row.kind === 'inscription') {
                  const item = row.item;
                  const competitionLabels = getInscriptionCompetitionLabels(item);
                  const placement = inscriptionPlacement(item);
                  const stageLabels = Array.from(placement.stageIds)
                    .map((stageId) => stageMetaById.get(stageId))
                    .filter(Boolean)
                    .map((meta) => `${meta!.stageName} (${meta!.competitionName})`)
                    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
                  return (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        {renderEntryAvatar(item, 'h-9 w-9')}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{item.display_name}</p>
                          <p className="text-[11px] text-emerald-700">ACEPTADO</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        <span className="font-medium">Competiciones:</span>{' '}
                        {competitionLabels.length > 0 ? competitionLabels.join(' · ') : 'Sin competencia'}
                      </p>
                      {stageLabels.length > 0 ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                          <span className="font-medium">Fases:</span> {stageLabels.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  );
                }
                const stageLabels = Array.from(row.placement.stageIds)
                  .map((stageId) => stageMetaById.get(stageId))
                  .filter(Boolean)
                  .map((meta) => `${meta!.stageName} (${meta!.competitionName})`)
                  .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
                const competitionLabels = Array.from(row.placement.competitionIds)
                  .filter((id) => String(id || '').trim() && String(id || '').toLowerCase() !== 'null')
                  .map((id) => competitionNameById.get(id) || id)
                  .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
                return (
                  <div
                    key={`graph-${row.inscriptionId}`}
                    className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2"
                    title="Figura en el fixture / fases pero no hay inscripción ACEPTADA en la base de gestión (p. ej. seed antiguo). Corré seed:dev o creá la inscripción manual."
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200/90 text-xs font-semibold text-amber-950" aria-hidden>
                        ?
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{row.displayName}</p>
                        <p className="text-[11px] font-medium text-amber-900">Sólo en competición</p>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-medium">Competiciones:</span>{' '}
                      {competitionLabels.length > 0 ? competitionLabels.join(' · ') : '—'}
                    </p>
                    {stageLabels.length > 0 ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                        <span className="font-medium">Fases:</span> {stageLabels.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              {gestionParticipantsPool.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No hay {entityPlural} para mostrar con el filtro aplicado (inscripción aceptada o asignado en una fase).
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      ) : tab === 'inicializacion' ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[980px] items-start gap-4">
          <div className="min-w-0 flex-1 space-y-4">
            <Card>
              <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
                {(tournament.competitions || []).map((competition) => (
                  <button
                    key={competition.id}
                    type="button"
                    onClick={() => setInitializationCompetitionId(competition.id)}
                    className={`rounded-lg px-3 py-2 text-sm font-medium ${initializationCompetitionId === competition.id ? 'bg-white text-[#0F2A33] shadow-sm' : 'text-slate-600'}`}
                  >
                    {competition.name}
                  </button>
                ))}
              </div>
          </Card>

            {initializationCompetition ? (
          <Card>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">{initializationCompetition.name}</h3>
                <div className="space-y-3">
                  {(initializationCompetition.stages || [])
                    .slice()
                    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
                    .map((stage) => {
                    const stageRosterEntries = buildStageRosterEntries(stage.assignedInscriptions, inscriptionById);
                    const cap = stageCapacity(stage);
                    const stageAssignedList = stage.assignedInscriptions || [];
                    const idsInGroups =
                      stage.format === 'groups'
                        ? new Set(
                            (stage.groups || []).flatMap((g) =>
                              (g.assignedInscriptions || []).map((a) => String(a.inscriptionId))
                            )
                          )
                        : new Set<string>();
                    const floatingInStageOnly =
                      stage.format === 'groups'
                        ? stageAssignedList.filter((a) => !idsInGroups.has(String(a.inscriptionId)))
                        : [];
                    const occupancy =
                      stage.format === 'groups'
                        ? stageAssignedList.length
                        : stageRosterEntries.length;
                    const incomingTr = collectIncomingTransitions(tournament, stage.id);
                    const previewLabels = flattenQualifierLabels(incomingTr);
                    const eliminationPairingCount =
                      stage.format === 'elimination' ? Math.floor(previewLabels.length / 2) : 0;
                    return (
                      <div
                        key={stage.id}
                        className={`rounded-xl border bg-white p-3 transition-all duration-150 ${
                          dragOverZone === `stage-${stage.id}`
                            ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md'
                            : 'border-slate-200'
                        }`}
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={() => setDragOverZone(`stage-${stage.id}`)}
                        onDragLeave={() => setDragOverZone((prev) => (prev === `stage-${stage.id}` ? null : prev))}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverZone(null);
                          if (stage.format === 'groups' || stage.format === 'elimination') return;
                          const id = Number(e.dataTransfer.getData('text/inscription-id'));
                          const item = inscriptions.find((x) => x.id === id);
                          if (item) moveToStage(item, initializationCompetition.id, stage.id);
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-700">{stage.order}. {stage.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {stage.format === 'groups' ? (
                              <>
                                {occupancy}
                                {cap ? ` / ${cap}` : ''} cupo fase · {idsInGroups.size} en grupos
                              </>
                            ) : (
                              <>
                                {occupancy}
                                {cap ? ` / ${cap}` : ''}
                              </>
                            )}{' '}
                            · {stage.format}
                          </p>
                        </div>

                        {stage.format === 'groups' && floatingInStageOnly.length > 0 ? (
                          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2">
                            <p className="mb-1.5 text-[11px] font-medium text-amber-900">
                              Pendientes de ubicar en un grupo ({floatingInStageOnly.length})
                            </p>
                            <p className="mb-2 text-[11px] text-amber-800/90">
                              Los equipos ya están en la fase, pero hay que asignarlos a <strong>Grupo A</strong>,{' '}
                              <strong>Grupo B</strong>, etc. Arrastrá cada uno al recuadro del grupo.
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {floatingInStageOnly.map((assigned) => {
                                const item = inscriptionById.get(String(assigned.inscriptionId));
                                const label =
                                  item?.display_name?.trim() ||
                                  assigned.displayName?.trim() ||
                                  `Inscripción ${assigned.inscriptionId}`;
                                const canDrag =
                                  Boolean(item) && ['PENDIENTE', 'ACEPTADO'].includes(String(item!.status));
                                return (
                                  <div
                                    key={`float-${stage.id}-${String(assigned.inscriptionId)}`}
                                    draggable={canDrag}
                                    onDragStart={canDrag ? (e) => handleDragStart(e, item!) : undefined}
                                    onDragEnd={handleDragEnd}
                                    className={`inline-flex max-w-[200px] items-center gap-1.5 rounded-md border border-amber-300/80 bg-white px-2 py-1 text-[11px] text-amber-950 shadow-sm ${
                                      canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                                    }`}
                                  >
                                    {item ? (
                                      renderEntryAvatar(item, 'h-5 w-5')
                                    ) : (
                                      <span className="inline-flex h-5 w-5 shrink-0 rounded-full bg-amber-200/80" aria-hidden />
                                    )}
                                    <span className="truncate font-medium">{label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        {stage.format === 'groups' ? (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {(stage.groups || [])
                              .slice()
                              .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
                              .map((group) => {
                                const assignedList = group.assignedInscriptions || [];
                                const groupCap = Number(group.capacity || teamsPerGroup(stage) || 0);
                                return (
                                  <div
                                    key={group.id}
                                    className={`rounded-lg border p-2 ${dragOverZone === `group-${group.id}` ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDragEnter={() => setDragOverZone(`group-${group.id}`)}
                                    onDragLeave={() => setDragOverZone((prev) => (prev === `group-${group.id}` ? null : prev))}
                                    onDrop={(e) => {
                                      e.preventDefault();
                                      setDragOverZone(null);
                                      const id = Number(e.dataTransfer.getData('text/inscription-id'));
                                      const item = inscriptions.find((x) => x.id === id);
                                      if (item) moveToGroup(item, stage, group.id);
                                    }}
                                  >
                                    <p className="mb-2 text-xs font-semibold text-slate-700">
                                      {group.name} · {assignedList.length}
                                      {groupCap > 0 ? `/${groupCap}` : ''}
                                    </p>
                                    <div className="space-y-1">
                                      {assignedList.map((assigned) => {
                                        const item = inscriptionById.get(String(assigned.inscriptionId));
                                        const label =
                                          item?.display_name?.trim() ||
                                          assigned.displayName?.trim() ||
                                          `Inscripción ${assigned.inscriptionId}`;
                                        const canDrag =
                                          Boolean(item) && ['PENDIENTE', 'ACEPTADO'].includes(String(item!.status));
                                        return (
                                          <div
                                            key={`${group.id}-${String(assigned.inscriptionId)}`}
                                            draggable={canDrag}
                                            onDragStart={canDrag ? (e) => handleDragStart(e, item!) : undefined}
                                            onDragEnd={handleDragEnd}
                                            className={`flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs transition-all duration-150 hover:border-emerald-300 ${
                                              canDrag
                                                ? draggingInscriptionId === String(item!.id)
                                                  ? 'opacity-60'
                                                  : 'cursor-grab active:cursor-grabbing'
                                                : 'opacity-95'
                                            }`}
                                          >
                                            {item ? (
                                              renderEntryAvatar(item, 'h-6 w-6')
                                            ) : (
                                              <span className="inline-flex h-6 w-6 shrink-0 rounded-full bg-slate-200" aria-hidden />
                                            )}
                                            <p className="line-clamp-1 font-medium text-slate-800">{label}</p>
                                          </div>
                                        );
                                      })}
                                      {assignedList.length === 0 ? (
                                        <p className="text-[11px] text-slate-500">Sin {entityPlural}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : null}

                        {stage.format === 'elimination' ? (
                          <div className="space-y-3">
                            {eliminationPairingCount > 0 ? (
                              <div className="grid gap-4">
                                {Array.from({ length: eliminationPairingCount }, (_, idx) => {
                                  const home = previewLabels[idx * 2] ?? '—';
                                  const away = previewLabels[idx * 2 + 1] ?? '—';
                                  return (
                                    <div
                                      key={`elim-preview-${stage.id}-${idx}`}
                                      className="overflow-hidden rounded-xl border border-slate-300/90 bg-gradient-to-b from-slate-100/90 to-white shadow-sm"
                                    >
                                      <div className="flex items-stretch gap-1.5 p-2 sm:gap-2">
                                        <div className="flex min-h-[3rem] flex-1 flex-col justify-center rounded-lg border border-slate-200/90 bg-white px-2 py-2 text-center text-[11px] font-semibold leading-snug text-slate-900 shadow-sm">
                                          {home}
                                        </div>
                                        <div className="flex shrink-0 flex-col items-center justify-center px-0.5">
                                          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black tracking-wider text-white">
                                            VS
                                          </span>
                                        </div>
                                        <div className="flex min-h-[3rem] flex-1 flex-col justify-center rounded-lg border border-slate-200/90 bg-white px-2 py-2 text-center text-[11px] font-semibold leading-snug text-slate-900 shadow-sm">
                                          {away}
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-center border-t border-slate-200/80 bg-slate-50/50 px-2 pb-2 pt-1">
                                        <div className="mb-1 h-3 w-px bg-slate-400/80" aria-hidden />
                                        <div className="w-full max-w-[min(100%,14rem)] rounded-lg border-2 border-dashed border-emerald-500/60 bg-emerald-50 px-3 py-2 text-center shadow-sm">
                                          <p className="text-[11px] font-bold text-emerald-900">Ganador</p>
                                          <p className="mt-0.5 text-[10px] font-medium text-emerald-800/90">
                                            Avanza a la siguiente ronda
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                            {(stage.matches || [])
                              .slice()
                              .sort((a, b) => (Number(a.round || 0) - Number(b.round || 0)) || String(a.id).localeCompare(String(b.id)))
                              .map((match, index) => (
                                <div key={match.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  <p className="mb-2 text-[11px] font-semibold text-slate-600">
                                    Llave {index + 1} · Ronda {match.round || 1}
                                    {match.fixtureCode ? ` · ${match.fixtureCode}` : ''}
                                  </p>
                                  {(['home', 'away'] as const).map((slotRole) => {
                                    const slot = slotRole === 'home' ? match.homeAssignedInscription : match.awayAssignedInscription;
                                    const slotItem = slot ? inscriptionById.get(String(slot.inscriptionId)) : null;
                                    const showBye = slotRole === 'away' && !slot && Boolean(match.homeAssignedInscription);
                                    return (
                                      <div
                                        key={`${match.id}-${slotRole}`}
                                        className="mb-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
                                      >
                                        <span className="mr-1 font-semibold text-slate-500">{slotRole === 'home' ? 'A' : 'B'}:</span>
                                        {slotItem
                                          ? slotItem.display_name
                                          : slot?.displayName?.trim() || (showBye ? 'BYE' : '—')}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                          </div>
                        ) : null}

                        {(stage.format === 'league' || stage.format === 'composed') ? (
                          <div className="flex flex-wrap gap-2">
                            {stageRosterEntries.map((entry) =>
                              entry.kind === 'inscription' ? (
                                <div
                                  key={entry.item.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, entry.item)}
                                  onDragEnd={handleDragEnd}
                                  className={`w-24 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${draggingInscriptionId === String(entry.item.id) ? 'scale-95 opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                                >
                                  <div className="mx-auto mb-1 w-fit">{renderEntryAvatar(entry.item, 'h-8 w-8')}</div>
                                  <p className="line-clamp-2 font-medium text-slate-800">{entry.item.display_name}</p>
                                </div>
                              ) : (
                                <div
                                  key={`gql-${String(entry.assigned.inscriptionId)}`}
                                  draggable={false}
                                  title="Asignado en el torneo pero sin inscripción en la base de gestión; re-seed o creá la inscripción manual para arrastrar y editar aquí."
                                  className="w-24 rounded-xl border border-amber-200/80 bg-amber-50/90 px-2 py-2 text-center text-xs shadow-sm"
                                >
                                  <div className="mx-auto mb-1 w-fit">
                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-200/80 text-[10px] font-semibold text-amber-950" aria-hidden>
                                      ?
                                    </span>
                                  </div>
                                  <p className="line-clamp-2 font-medium text-slate-800">
                                    {(entry.assigned.displayName || '').trim() || `Inscripción ${entry.assigned.inscriptionId}`}
                                  </p>
                                </div>
                              )
                            )}
                            {stageRosterEntries.length === 0 ? (
                              <p className="text-xs text-slate-500">Sin {entityPlural} asignados</p>
                            ) : null}
                          </div>
                        ) : null}

                        <InitializationInboundBanner
                          incoming={incomingTr}
                          entitySingular={entitySingular}
                          entityPlural={entityPlural}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>

          <Card className="sticky top-4 h-fit w-[360px] shrink-0">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Panel de {entityPlural} (A-Z)</h3>
            <p className="mb-3 text-xs text-slate-500">12 por página · arrastrar a fases</p>
            <CompetitionPhaseFilter
              className="mb-3"
              competitions={phaseFilterCompetitions}
              onChange={setPhaseFilter}
            />
            {visibleRelationOptions.length > 0 ? (
              <div className="mb-3 rounded-lg border border-slate-200 bg-white p-2">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Filtro por relaciones</p>
                <div className="mb-1 flex gap-2">
                  <select
                    className="w-[122px] rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    value={relationFilterMode}
                    onChange={(e) => setRelationFilterMode(e.target.value as 'include' | 'exclude')}
                  >
                    <option value="include">Mostrar solo</option>
                    <option value="exclude">No mostrar</option>
                  </select>
                  <select
                    multiple
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                    value={selectedRelationTransitionIds}
                    onChange={(e) =>
                      setSelectedRelationTransitionIds(Array.from(e.target.selectedOptions).map((opt) => opt.value))
                    }
                  >
                    {visibleRelationOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500">
                  {selectedRelationTransitionIds.length > 0
                    ? `${selectedRelationTransitionIds.length} relación(es) seleccionada(s)`
                    : 'Sin filtro por relaciones'}
                </p>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              {pagedPool.map((item) => {
                const assignedInfo = assignmentByInscriptionId.get(String(item.id)) || [];
                const isInActiveCompetition =
                  initializationCompetitionId &&
                  (String(item.competition_id || '') === initializationCompetitionId ||
                    assignedInfo.some((placement) => placement.competitionId === initializationCompetitionId));
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragEnd={handleDragEnd}
                    className={`relative rounded-xl border px-2 py-2 text-center text-xs shadow-sm ${
                      isInActiveCompetition
                        ? 'border-emerald-300 bg-emerald-50'
                        : 'border-slate-200 bg-slate-100'
                    } transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${
                      draggingInscriptionId === String(item.id) ? 'scale-95 opacity-60' : 'cursor-grab active:cursor-grabbing'
                    }`}
                    title={item.display_name}
                  >
                    <div className="mx-auto mb-1 w-fit">{renderEntryAvatar(item, 'h-10 w-10')}</div>
                    <p className="line-clamp-2 font-medium text-slate-800">{item.display_name}</p>
                    <p className="text-[10px] text-slate-500">{item.status}</p>
        </div>
                );
              })}
                      </div>
            {initializationPool.length === 0 ? <p className="mt-2 text-xs text-slate-500">No hay {entityPlural} para mostrar.</p> : null}
            {initializationPool.length > 0 ? (
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">Página {teamsPage} de {totalTeamsPages}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" disabled={teamsPage <= 1} onClick={() => setTeamsPage((prev) => Math.max(1, prev - 1))}>Anterior</Button>
                  <Button type="button" variant="secondary" disabled={teamsPage >= totalTeamsPages} onClick={() => setTeamsPage((prev) => Math.min(totalTeamsPages, prev + 1))}>Siguiente</Button>
                </div>
              </div>
            ) : null}
          </Card>
          </div>
        </div>
      ) : null}

      {tab === 'fixture' && tournament ? (
        <FixturePlanningPanel
          tournament={tournament}
          onRefresh={async () => {
            await loadTournament();
          }}
          setSaving={setSaving}
          setError={setError}
        />
      ) : null}
    </div>
  );
};
