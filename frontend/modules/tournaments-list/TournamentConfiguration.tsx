import React from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TeamNameLink } from '../../components/team/TeamNameLink';
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
  updateInscriptionWeight,
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
import { CreateNextEditionModal } from './CreateNextEditionModal';
import { InscriptionWeightSelect } from './components/InscriptionWeightSelect';
import { EliminationInitWizard } from './EliminationInitWizard';
import type {
  AssignedInscription,
  TournamentCompetition as Competition,
  TournamentEntity as Tournament,
  TournamentStage as Stage,
} from './types';
import {
  countTeamsFromInboundTransition as countTeamsFromTransition,
  describeInboundSelectionNatural as describeSelectionNatural,
} from './transitionInboundCounts';
import { isNextEditionTransition } from './transitionTiming';
import { shortPhaseTabTitle } from './BracketParticipantPicker';
import {
  deriveEligibleInscriptionsFromIncomingTransitions,
  type EligibleInscription,
} from './incomingTransitionEligibility';

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
    if (String(assigned.inscriptionId).startsWith('liga360-slot:')) continue;
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

/** Círculo punteado: plaza sintética sin equipo (compacto frente a la palabra «pendiente»). */
function InboundEligiblePendingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle
        cx="6"
        cy="6"
        r="4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeDasharray="1.85 1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Tab = 'gestion' | 'inicializacion' | 'fixture';

interface TournamentConfigurationProps {
  tournamentId: string;
  onBack: () => void;
  onNextEditionCreated?: (payload: {
    tournamentId: string;
    name: string;
    warnings: string[];
    inscriptionsCreated: number;
  }) => void;
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

/** Cupo ocupado por equipos reales; refs pos:/liga360-slot: son solo configuración de llaves. */
function physicalAssignedCount(stage: Stage): number {
  return (stage.assignedInscriptions || []).filter((item) => {
    const id = String(item.inscriptionId ?? '');
    return id && !id.startsWith('liga360-slot:') && !id.startsWith('pos:');
  }).length;
}

function teamsPerGroup(stage: Stage): number | null {
  if (stage.format !== 'groups') return null;
  const cfg = parseJsonSafe(stage.configJson || null) || {};
  const perGroup = Number(cfg.teamsPerGroup);
  return Number.isInteger(perGroup) && perGroup > 0 ? perGroup : null;
}

type StageTransition = NonNullable<Stage['transitions']>[number];

function collectIncomingTransitions(
  tournament: Tournament | null,
  targetStageId: string
): Array<{ fromStage: Stage; tr: StageTransition; fromCompetitionName: string }> {
  const out: Array<{ fromStage: Stage; tr: StageTransition; fromCompetitionName: string }> = [];
  for (const c of tournament?.competitions || []) {
    for (const s of c.stages || []) {
      for (const tr of s.transitions || []) {
        if (String(tr.toStageId || '') === targetStageId && !isNextEditionTransition(tr)) {
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
      <div className="mt-3 border-t border-border-subtle pt-3 text-[11px] leading-snug text-text-muted">
        <div className="rounded-lg border border-dashed border-border-subtle bg-surface-1 px-3 py-2">
          <span className="font-medium text-text-primary">Origen:</span> ninguna relación de avance desde otra etapa apunta a esta
          fase. Podés asignar {entityPlural} manualmente o usar esta etapa como entrada directa.
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 border-t border-border-subtle pt-3 text-[11px] leading-snug text-text-primary">
      <div className="rounded-lg border border-accent-primary/40 bg-accent-soft px-3 py-2">
        <p className="font-medium text-success-base">
          {total} {total === 1 ? entitySingular : entityPlural} desde otra{incoming.length > 1 ? 's' : ''} fase
          {incoming.length > 1 ? 's' : ''}
        </p>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-text-muted">
          {incoming.map(({ fromStage, tr, fromCompetitionName }) => {
            const n = countTeamsFromTransition(tr, fromStage);
            const sel = describeSelectionNatural(tr, fromStage);
            const lbl = tr.label?.trim();
            return (
              <li key={tr.id}>
                <span className="font-medium">{n}</span> {n === 1 ? entitySingular : entityPlural} desde{' '}
                <strong className="text-text-primary">{fromStage.name}</strong>
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

export const TournamentConfiguration: React.FC<TournamentConfigurationProps> = ({
  tournamentId,
  onBack,
  onNextEditionCreated,
}) => {
  const [tab, setTab] = React.useState<Tab>('gestion');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [inscriptions, setInscriptions] = React.useState<InscriptionItem[]>([]);
  const [initializationCompetitionId, setInitializationCompetitionId] = React.useState('');
  const [initializationStageId, setInitializationStageId] = React.useState('');
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
  const [nextEditionModalOpen, setNextEditionModalOpen] = React.useState(false);
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

  const pendingRequests = React.useMemo(
    () => inscriptions.filter((item) => item.status === 'PENDIENTE' && item.source !== 'invitation'),
    [inscriptions],
  );
  const sentInvitations = React.useMemo(
    () => inscriptions.filter((item) => item.source === 'invitation'),
    [inscriptions],
  );
  const inscriptionById = React.useMemo(() => {
    const map = new Map<string, InscriptionItem>();
    for (const item of inscriptions) map.set(String(item.id), item);
    return map;
  }, [inscriptions]);

  const initializationCompetition = React.useMemo(
    () => tournament?.competitions.find((competition) => competition.id === initializationCompetitionId) || null,
    [tournament, initializationCompetitionId]
  );

  const initializationSelectedStage = React.useMemo(() => {
    if (!initializationCompetition) return null;
    const sorted = [...(initializationCompetition.stages || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    return sorted.find((s) => s.id === initializationStageId) ?? sorted[0] ?? null;
  }, [initializationCompetition, initializationStageId]);

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
        // Sólo placements reales en el grafo: el competition_id de la inscripción (enrolamiento)
        // no se limpia al quitar de una fase, y dejaría la tarjeta marcada para siempre.
        const aAssigned = assignmentByInscriptionId.get(String(a.id)) || [];
        const bAssigned = assignmentByInscriptionId.get(String(b.id)) || [];
        const aInActive =
          Boolean(activeCompetitionId) && aAssigned.some((p) => p.competitionId === activeCompetitionId);
        const bInActive =
          Boolean(activeCompetitionId) && bAssigned.some((p) => p.competitionId === activeCompetitionId);
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
          if (id.startsWith('liga360-slot:')) continue;
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

  /** Mismo criterio de cupo que el listado de Inicialización (PENDIENTE + ACEPTADO) + asignados sólo en grafo cuando faltaban en ese listado por estado. */
  const eliminationBracketParticipantPool = React.useMemo(() => {
    const rows = new Map<string, { id: string | number; display_name: string }>();

    const addRow = (sid: string, idVal: string | number, displayName: string) => {
      if (rows.has(sid)) return;
      rows.set(sid, { id: idVal, display_name: displayName });
    };

    for (const item of inscriptions) {
      if (!['PENDIENTE', 'ACEPTADO'].includes(String(item.status ?? ''))) continue;
      addRow(String(item.id), item.id, item.display_name);
    }

    for (const competition of tournament?.competitions || []) {
      for (const st of competition.stages || []) {
        for (const assigned of st.assignedInscriptions || []) {
          const sid = String(assigned.inscriptionId ?? '').trim();
          if (!sid) continue;
          if (rows.has(sid)) continue;
          const dn = (assigned.displayName || '').trim() || sid;
          addRow(sid, sid, dn);
        }
      }
    }

    return [...rows.values()].sort((a, b) =>
      String(a.display_name || '').localeCompare(String(b.display_name || ''), 'es', { sensitivity: 'base' })
    );
  }, [inscriptions, tournament]);

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
    const sorted = (initializationCompetition?.stages || [])
      .slice()
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    if (sorted.length === 0) return;
    setInitializationStageId((prev) => {
      const stillValid = sorted.some((s) => s.id === prev);
      return stillValid ? prev : (sorted[0]?.id ?? '');
    });
  }, [initializationCompetition?.id, initializationCompetition?.stages]);

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

  async function handleWeightChange(inscriptionId: number, weight: number | null) {
    setSaving(true);
    setError('');
    try {
      await updateInscriptionWeight(inscriptionId, weight);
      await loadInscriptions();
    } catch (e: any) {
      setError(e?.message || 'No se pudo actualizar la ponderacion');
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
        const currentCount = physicalAssignedCount(targetStage);
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
      const stageCount = physicalAssignedCount(stage);
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

  /** Quita la inscripción de la fase; el backend también la desasigna de su grupo y de las llaves de partido. */
  async function removeFromStage(inscriptionId: string, stage: Stage) {
    setSaving(true);
    setError('');
    try {
      await unassignInscriptionFromStage(stage.id, inscriptionId, tournamentId);
      await loadTournament();
      await loadInscriptions();
    } catch (e: any) {
      setError(e?.message || `No se pudo quitar de la fase "${stage.name}"`);
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
      <CreateNextEditionModal
        open={nextEditionModalOpen}
        onClose={() => setNextEditionModalOpen(false)}
        sourceTournamentId={tournamentId}
        sourceTournamentName={tournament.name}
        sourceEditionLabel={tournament.editionLabel}
        seriesId={tournament.seriesId}
        onSuccess={(result) => {
          onNextEditionCreated?.({
            tournamentId: result.tournament.id,
            name: result.tournament.name,
            warnings: result.warnings,
            inscriptionsCreated: result.inscriptionsCreated,
          });
        }}
      />
      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>← Volver</Button>
      </div>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#0F2A33]">Centro de gestión del torneo</h2>
            <p className="text-sm text-slate-600">
              {tournament.name}
              {tournament.editionLabel ? ` · Edición ${tournament.editionLabel}` : ''}
            </p>
          </div>
          {String(tournament.status || '').toLowerCase() === 'finished' ? (
            <Button type="button" variant="secondary" onClick={() => setNextEditionModalOpen(true)}>
              Crear próxima edición
            </Button>
          ) : null}
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
                    <p className="font-medium text-slate-800">{isTeamsTournament ? <TeamNameLink teamId={item.linked_team_id ?? undefined} teamName={item.display_name} /> : item.display_name}</p>
                    <p className="text-xs text-slate-500">
                      {competitionNameById.get(String(item.competition_id || '')) || 'Sin competencia'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" disabled={saving} onClick={() => handleStatusChange(item.id, 'approved')}>Aceptar</Button>
                    <Button type="button" variant="secondary" disabled={saving} onClick={() => handleStatusChange(item.id, 'rejected')}>Rechazar</Button>
                  </div>
                </div>
              ))}
              {pendingRequests.length === 0 && <p className="text-sm text-slate-500">No hay peticiones pendientes.</p>}
            </div>
          </Card>

          {sentInvitations.length > 0 && (
            <Card>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Invitaciones enviadas</h3>
              <div className="space-y-2">
                {sentInvitations.map((item) => {
                  const statusLabel =
                    item.status === 'ACEPTADO'
                      ? { text: 'Aceptada', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                      : item.status === 'RECHAZADO'
                        ? { text: 'Rechazada', cls: 'bg-red-50 text-red-700 border-red-200' }
                        : { text: 'Enviada · esperando respuesta', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
                  return (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
                      <div>
                        <p className="font-medium text-slate-800">{isTeamsTournament ? <TeamNameLink teamId={item.linked_team_id ?? undefined} teamName={item.display_name} /> : item.display_name}</p>
                        <p className="text-xs text-slate-500">
                          {competitionNameById.get(String(item.competition_id || '')) || 'Sin competencia'}
                        </p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusLabel.cls}`}>
                        {statusLabel.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

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
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {renderEntryAvatar(item, 'h-9 w-9')}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{isTeamsTournament ? <TeamNameLink teamId={item.linked_team_id ?? undefined} teamName={item.display_name} className="max-w-full truncate align-bottom" /> : item.display_name}</p>
                            <p className="text-[11px] text-emerald-700">ACEPTADO</p>
                          </div>
                        </div>
                        <InscriptionWeightSelect
                          inscriptionId={item.id}
                          value={item.weight ?? null}
                          suggestedWeight={item.suggested_weight ?? null}
                          eloRaw={item.elo_raw ?? null}
                          disabled={saving}
                          onChange={(weight) => void handleWeightChange(item.id, weight)}
                          onApplySuggested={
                            item.suggested_weight != null
                              ? () => void handleWeightChange(item.id, item.suggested_weight!)
                              : undefined
                          }
                        />
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
              {/* Tabs de competencia */}
              <Card>
                <div className="inline-flex flex-wrap rounded-xl bg-surface-0 p-1">
                  {(tournament.competitions || []).map((competition) => (
                    <button
                      key={competition.id}
                      type="button"
                      onClick={() => setInitializationCompetitionId(competition.id)}
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        initializationCompetitionId === competition.id
                          ? 'bg-surface-3 text-text-primary shadow-sm'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {competition.name}
                    </button>
                  ))}
                </div>
              </Card>

              {initializationCompetition ? (
                <>
                  {/* Tabs de fase */}
                  {(initializationCompetition.stages || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(initializationCompetition.stages || [])
                        .slice()
                        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
                        .map((stage) => (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => setInitializationStageId(stage.id)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              initializationStageId === stage.id
                                ? 'border-accent-primary bg-accent-soft text-success-base'
                                : 'border-border-subtle bg-surface-2 text-text-muted hover:border-border-strong hover:text-text-primary'
                            }`}
                          >
                            {stage.order}. {stage.name}
                          </button>
                        ))}
                    </div>
                  ) : null}

                  {/* Contenido de la fase activa */}
                  {(() => {
                    const sortedStages = (initializationCompetition.stages || [])
                      .slice()
                      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
                    const stage = sortedStages.find((s) => s.id === initializationStageId) ?? sortedStages[0];
                    if (!stage) return null;

                    // Inscripciones con partidos ya finalizados en esta fase: quitarlas rompería resultados/posiciones.
                    const playedInscriptionIds = new Set<string>();
                    for (const m of [...(stage.matches || []), ...(stage.groups || []).flatMap((g) => g.matches || [])]) {
                      if (!['finished', 'completed'].includes(String(m.status || '').toLowerCase())) continue;
                      for (const side of [m.homeAssignedInscription, m.awayAssignedInscription]) {
                        if (side?.inscriptionId) playedInscriptionIds.add(String(side.inscriptionId));
                      }
                    }
                    const isSyntheticRef = (id: unknown) => /^(liga360-slot:|pos:)/.test(String(id ?? ''));
                    const removalBlockReason = (id: unknown): string | null => {
                      if (stage.stageStatus === 'finished') return 'No se puede quitar: la fase ya está finalizada';
                      if (playedInscriptionIds.has(String(id ?? ''))) {
                        return 'No se puede quitar: ya tiene partidos finalizados en esta fase';
                      }
                      return null;
                    };

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
                      stage.format === 'groups' ? stageAssignedList.length : stageRosterEntries.length;
                    const incomingTr = collectIncomingTransitions(tournament, stage.id);
                    const inboundEligibles: EligibleInscription[] =
                      stage.format === 'league' || stage.format === 'composed'
                        ? deriveEligibleInscriptionsFromIncomingTransitions(tournament, stage.id)
                        : [];
                    const inboundSectionOrder: string[] = [];
                    const inboundBySection = new Map<string, EligibleInscription[]>();
                    for (const el of inboundEligibles) {
                      const st = el.sectionTitle;
                      if (!inboundBySection.has(st)) {
                        inboundSectionOrder.push(st);
                        inboundBySection.set(st, []);
                      }
                      inboundBySection.get(st)!.push(el);
                    }
                    const assignedToStageIds = new Set<string>();
                    for (const row of stageRosterEntries) {
                      if (row.kind === 'inscription') assignedToStageIds.add(String(row.item.id));
                      else assignedToStageIds.add(String(row.assigned.inscriptionId));
                    }

                    return (
                      <Card>
                        <div
                          className={`rounded-xl border p-3 transition-all duration-150 ${
                            dragOverZone === `stage-${stage.id}`
                              ? 'border-accent-primary ring-2 ring-accent-soft shadow-md'
                              : 'border-border-subtle bg-surface-2'
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
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-text-primary">
                              {stage.order}. {stage.name}
                            </p>
                            <p className="text-[11px] text-text-muted">
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
                            <div className="mb-3 rounded-lg border border-warning-base/40 bg-warning-soft px-3 py-2">
                              <p className="mb-1.5 text-[11px] font-medium text-warning-base">
                                Pendientes de ubicar en un grupo ({floatingInStageOnly.length})
                              </p>
                              <p className="mb-2 text-[11px] text-text-muted">
                                Los equipos ya están en la fase, pero hay que asignarlos a <strong className="text-text-primary">Grupo A</strong>,{' '}
                                <strong className="text-text-primary">Grupo B</strong>, etc. Arrastrá cada uno al recuadro del grupo.
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
                                      className={`inline-flex max-w-[200px] items-center gap-1.5 rounded-md border border-warning-base/50 bg-surface-2 px-2 py-1 text-[11px] text-warning-base shadow-sm ${
                                        canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                                      }`}
                                    >
                                      {item ? (
                                        renderEntryAvatar(item, 'h-5 w-5')
                                      ) : (
                                        <span className="inline-flex h-5 w-5 shrink-0 rounded-full bg-warning-soft" aria-hidden />
                                      )}
                                      <span className="truncate font-medium">{label}</span>
                                      {!isSyntheticRef(assigned.inscriptionId) ? (
                                        <button
                                          type="button"
                                          disabled={saving || removalBlockReason(assigned.inscriptionId) != null}
                                          onClick={() => void removeFromStage(String(assigned.inscriptionId), stage)}
                                          className="shrink-0 rounded p-0.5 text-sm leading-none text-warning-base transition-colors hover:bg-danger-soft hover:text-danger-base disabled:cursor-not-allowed disabled:opacity-40"
                                          title={removalBlockReason(assigned.inscriptionId) ?? 'Quitar de la fase'}
                                          aria-label={`Quitar ${label} de la fase`}
                                        >
                                          ×
                                        </button>
                                      ) : null}
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
                                      className={`rounded-lg border p-2 ${
                                        dragOverZone === `group-${group.id}`
                                          ? 'border-accent-primary ring-2 ring-accent-soft'
                                          : 'border-border-subtle bg-surface-1'
                                      }`}
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
                                      <p className="mb-2 text-xs font-semibold text-text-primary">
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
                                              className={`flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-xs transition-all duration-150 hover:border-accent-primary ${
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
                                                <span className="inline-flex h-6 w-6 shrink-0 rounded-full bg-surface-3" aria-hidden />
                                              )}
                                              <p className="line-clamp-1 min-w-0 flex-1 font-medium text-text-primary">{label}</p>
                                              {!isSyntheticRef(assigned.inscriptionId) ? (
                                                <button
                                                  type="button"
                                                  disabled={saving || removalBlockReason(assigned.inscriptionId) != null}
                                                  onClick={() => void removeFromStage(String(assigned.inscriptionId), stage)}
                                                  className="shrink-0 rounded p-0.5 text-sm leading-none text-text-subtle transition-colors hover:bg-danger-soft hover:text-danger-base disabled:cursor-not-allowed disabled:opacity-40"
                                                  title={removalBlockReason(assigned.inscriptionId) ?? 'Quitar de la fase'}
                                                  aria-label={`Quitar ${label} de la fase`}
                                                >
                                                  ×
                                                </button>
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                        {assignedList.length === 0 ? (
                                          <p className="text-[11px] text-text-subtle">Sin {entityPlural}</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : null}

                          {inboundEligibles.length > 0 ? (
                            <div className="mb-3 rounded-lg border border-border-subtle bg-surface-1 px-2.5 py-2">
                              <p className="mb-2 text-[11px] font-semibold text-text-primary">Origen por plaza</p>
                              <div className="space-y-2">
                                {inboundSectionOrder.map((sectionTitle) => (
                                  <div key={`inbound-${stage.id}-${sectionTitle}`}>
                                    <p className="mb-1 truncate text-[10px] font-medium text-text-muted" title={sectionTitle}>
                                      {shortPhaseTabTitle(sectionTitle)}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {(inboundBySection.get(sectionTitle) ?? []).map((el) => {
                                        const synthetic = String(el.inscriptionId || '').startsWith('liga360-slot:');
                                        const enLista = assignedToStageIds.has(String(el.inscriptionId));
                                        return (
                                          <div
                                            key={`slot-${el.sectionTitle}-${el.inscriptionId}`}
                                            className={`inline-flex max-w-[200px] min-w-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] leading-snug tabular-nums ${
                                              enLista
                                                ? 'border-success-base/35 bg-accent-soft text-text-primary'
                                                : synthetic
                                                  ? 'border-dashed border-border-strong bg-surface-2 text-text-muted'
                                                  : 'border-border-subtle bg-surface-2 text-text-primary'
                                            }`}
                                            title={el.optionLabel}
                                          >
                                            <span className="shrink-0 font-mono text-[10px] font-semibold text-accent-primary">{el.shortLabel}</span>
                                            <span className="min-w-0 truncate">{el.displayName}</span>
                                            {enLista ? (
                                              <span className="shrink-0 text-[9px] font-medium uppercase text-success-base" aria-label="Ya en lista">
                                                ✓
                                              </span>
                                            ) : null}
                                            {synthetic ? (
                                              <InboundEligiblePendingIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {stage.format === 'elimination' ? (
                            <EliminationInitWizard
                              tournamentId={tournamentId}
                              tournament={tournament}
                              stage={stage}
                              participantPoolItems={(() => {
                                const hasIncoming = collectIncomingTransitions(tournament, stage.id).length > 0;
                                if (!hasIncoming) return eliminationBracketParticipantPool;
                                if (stage.stageStatus === 'not_started') return [];
                                return (stage.assignedInscriptions || [])
                                  .filter(a => !String(a.inscriptionId).startsWith('liga360-slot'))
                                  .map(a => ({ id: a.inscriptionId, display_name: a.displayName }));
                              })()}
                              inscriptionById={inscriptionById}
                              onReload={async () => {
                                await loadTournament();
                              }}
                              setSaving={setSaving}
                              setError={setError}
                              readOnly={
                                stage.stageStatus === 'finished' ||
                                (stage.matches || []).some((m) =>
                                  ['finished', 'completed'].includes(String(m.status || '').toLowerCase())
                                )
                              }
                            />
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
                                    className={`relative w-24 rounded-xl border border-border-subtle bg-surface-2 px-2 py-2 text-center text-xs shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary hover:shadow-md ${
                                      draggingInscriptionId === String(entry.item.id) ? 'scale-95 opacity-60' : 'cursor-grab active:cursor-grabbing'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      disabled={saving || removalBlockReason(entry.item.id) != null}
                                      onClick={() => void removeFromStage(String(entry.item.id), stage)}
                                      className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border-subtle bg-surface-1 text-sm leading-none text-text-subtle shadow-sm transition-colors hover:border-danger-base hover:text-danger-base disabled:cursor-not-allowed disabled:opacity-40"
                                      title={removalBlockReason(entry.item.id) ?? 'Quitar de la fase'}
                                      aria-label={`Quitar ${entry.item.display_name} de la fase`}
                                    >
                                      ×
                                    </button>
                                    <div className="mx-auto mb-1 w-fit">{renderEntryAvatar(entry.item, 'h-8 w-8')}</div>
                                    <p className="line-clamp-2 font-medium text-text-primary">{entry.item.display_name}</p>
                                  </div>
                                ) : (
                                  <div
                                    key={`gql-${String(entry.assigned.inscriptionId)}`}
                                    draggable={false}
                                    title="Asignado en el torneo pero sin inscripción en la base de gestión; re-seed o creá la inscripción manual para arrastrar y editar aquí."
                                    className="relative w-24 rounded-xl border border-warning-base/40 bg-warning-soft px-2 py-2 text-center text-xs shadow-sm"
                                  >
                                    {!isSyntheticRef(entry.assigned.inscriptionId) ? (
                                      <button
                                        type="button"
                                        disabled={saving || removalBlockReason(entry.assigned.inscriptionId) != null}
                                        onClick={() => void removeFromStage(String(entry.assigned.inscriptionId), stage)}
                                        className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-warning-base/40 bg-surface-1 text-sm leading-none text-warning-base shadow-sm transition-colors hover:border-danger-base hover:text-danger-base disabled:cursor-not-allowed disabled:opacity-40"
                                        title={removalBlockReason(entry.assigned.inscriptionId) ?? 'Quitar de la fase'}
                                        aria-label={`Quitar ${(entry.assigned.displayName || '').trim() || `Inscripción ${entry.assigned.inscriptionId}`} de la fase`}
                                      >
                                        ×
                                      </button>
                                    ) : null}
                                    <div className="mx-auto mb-1 w-fit">
                                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-warning-soft text-[10px] font-semibold text-warning-base" aria-hidden>
                                        ?
                                      </span>
                                    </div>
                                    <p className="line-clamp-2 font-medium text-text-primary">
                                      {(entry.assigned.displayName || '').trim() || `Inscripción ${entry.assigned.inscriptionId}`}
                                    </p>
                                  </div>
                                )
                              )}
                              {stageRosterEntries.length === 0 ? (
                                <p className="text-xs text-text-muted">Sin {entityPlural} asignados</p>
                              ) : null}
                            </div>
                          ) : null}

                          <InitializationInboundBanner
                            incoming={incomingTr}
                            entitySingular={entitySingular}
                            entityPlural={entityPlural}
                          />
                        </div>
                      </Card>
                    );
                  })()}
                </>
              ) : null}
            </div>

            {/* Panel lateral de participantes */}
            <Card className="sticky top-4 h-fit w-[360px] shrink-0">
              <h3 className="mb-2 text-sm font-semibold text-text-primary">Panel de {entityPlural} (A-Z)</h3>
              {initializationSelectedStage &&
               collectIncomingTransitions(tournament, initializationSelectedStage.id).length > 0 &&
               initializationSelectedStage.stageStatus === 'not_started' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-center">
                  <p className="text-sm font-medium text-amber-800">Esperando etapas anteriores</p>
                  <p className="mt-1 text-xs text-amber-700">
                    El panel de {entityPlural} estará disponible cuando todas las etapas previas estén finalizadas.
                  </p>
                </div>
              ) : (
              <>
              <p className="mb-3 text-xs text-text-muted">12 por página · arrastrar a fases</p>
              <CompetitionPhaseFilter
                className="mb-3"
                competitions={phaseFilterCompetitions}
                onChange={setPhaseFilter}
              />
              {visibleRelationOptions.length > 0 ? (
                <div className="mb-3 rounded-lg border border-border-subtle bg-surface-2 p-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Filtro por relaciones</p>
                  <div className="mb-1 flex gap-2">
                    <select
                      className="w-[122px] rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs text-text-primary"
                      value={relationFilterMode}
                      onChange={(e) => setRelationFilterMode(e.target.value as 'include' | 'exclude')}
                    >
                      <option value="include">Mostrar solo</option>
                      <option value="exclude">No mostrar</option>
                    </select>
                    <select
                      multiple
                      className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs text-text-primary"
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
                  <p className="text-[10px] text-text-subtle">
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
                    assignedInfo.some((placement) => placement.competitionId === initializationCompetitionId);
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragEnd={handleDragEnd}
                      className={`relative rounded-xl border px-2 py-2 text-center text-xs shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-accent-primary hover:shadow-md ${
                        isInActiveCompetition
                          ? 'border-accent-primary bg-accent-soft'
                          : 'border-border-subtle bg-surface-2'
                      } ${draggingInscriptionId === String(item.id) ? 'scale-95 opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                      title={item.display_name}
                    >
                      <div className="mx-auto mb-1 w-fit">{renderEntryAvatar(item, 'h-10 w-10')}</div>
                      <p className="line-clamp-2 font-medium text-text-primary">{item.display_name}</p>
                      <p className="text-[10px] text-text-subtle">{item.status}</p>
                    </div>
                  );
                })}
              </div>
              {initializationPool.length === 0 ? (
                <p className="mt-2 text-xs text-text-muted">No hay {entityPlural} para mostrar.</p>
              ) : null}
              {initializationPool.length > 0 ? (
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-text-muted">Página {teamsPage} de {totalTeamsPages}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" disabled={teamsPage <= 1} onClick={() => setTeamsPage((prev) => Math.max(1, prev - 1))}>Anterior</Button>
                    <Button type="button" variant="secondary" disabled={teamsPage >= totalTeamsPages} onClick={() => setTeamsPage((prev) => Math.min(totalTeamsPages, prev + 1))}>Siguiente</Button>
                  </div>
                </div>
              ) : null}
              </>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'fixture' && tournament ? (
        <FixturePlanningPanel
          tournament={tournament}
          inscriptionById={inscriptionById}
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
