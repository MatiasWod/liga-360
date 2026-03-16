import React from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { CompetitionPhaseFilter } from '../../components/CompetitionPhaseFilter';
import {
  createTournamentInvite,
  createManualTeamInscriptionsBatch,
  createTeamInvite,
  listTournamentInvites,
  listTournamentInscriptions,
  type InscriptionItem,
  updateInscriptionStatus,
} from '../../services/inscriptionsApi';

type Tab = 'gestion' | 'inicializacion';

type Stage = {
  id: string;
  name: string;
  order: number;
  format: 'league' | 'groups' | 'elimination' | 'composed';
  isInitial: boolean;
  configJson?: string | null;
  childrenJson?: string | null;
  assignedInscriptions: Array<{ inscriptionId: string; displayName: string }>;
  transitions: Array<{
    id: string;
    label?: string | null;
    toStageId?: string | null;
    selectionKind?: string | null;
    topN?: number | null;
    rangeFrom?: number | null;
    rangeTo?: number | null;
    bottomN?: number | null;
    toExternalTournamentId?: string | null;
    toExternalStageId?: string | null;
    toExternalTournamentName?: string | null;
  }>;
  groups?: Array<{
    id: string;
    name: string;
    order: number;
    capacity?: number | null;
    assignedInscriptions?: Array<{ inscriptionId: string; displayName: string }>;
  }>;
  matches?: Array<{
    id: string;
    round?: number | null;
    leg?: number | null;
    homeAssignedInscription?: { inscriptionId: string; displayName: string } | null;
    awayAssignedInscription?: { inscriptionId: string; displayName: string } | null;
  }>;
};

type Competition = {
  id: string;
  name: string;
  order: number;
  stages: Stage[];
};

type Tournament = {
  id: string;
  name: string;
  competitions: Competition[];
};

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

async function gql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  const token = localStorage.getItem('liga360:token');
  const res = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors?.[0]?.message || 'GraphQL error');
  return json.data as T;
}

function resolveBadgeUrl(rawUrl?: string | null): string {
  const url = String(rawUrl || '').trim();
  if (!url) return DEFAULT_SHIELD_SRC;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `http://localhost:4002${url}`;
  return `http://localhost:4002/${url}`;
}

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
        if (!stage.isInitial) continue;
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
  const acceptedTeams = React.useMemo(() => inscriptions.filter((item) => item.status === 'ACEPTADO'), [inscriptions]);
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
          stages: (competition.stages || [])
            .filter((stage) => stage.isInitial && (stage.assignedInscriptions?.length || 0) > 0)
            .map((stage) => ({ id: stage.id, name: stage.name })),
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

  const acceptedSelectedStageFilterIds = React.useMemo(() => {
    return new Set((acceptedTeamsFilter.selections || []).map((item) => String(item.phaseId)));
  }, [acceptedTeamsFilter]);

  const acceptedSelectedCompetitionIds = React.useMemo(() => {
    return new Set((acceptedTeamsFilter.selections || []).map((item) => String(item.competitionId)));
  }, [acceptedTeamsFilter]);

  const acceptedTeamsPool = React.useMemo(() => {
    return acceptedTeams
      .filter((item) => {
        if (acceptedSelectedStageFilterIds.size === 0 && acceptedSelectedCompetitionIds.size === 0) return true;
        const placement = inscriptionPlacement(item);
        const matchesStage = Array.from(acceptedSelectedStageFilterIds).some((stageId) => placement.stageIds.has(stageId));
        const matchesCompetition = Array.from(acceptedSelectedCompetitionIds).some((competitionId) =>
          placement.competitionIds.has(competitionId)
        );
        const matches = matchesStage || matchesCompetition;
        if (acceptedTeamsFilter.mode === 'include') return matches;
        return !matches;
      })
      .sort((a, b) => String(a.display_name || '').localeCompare(String(b.display_name || ''), 'es', { sensitivity: 'base' }));
  }, [acceptedTeams, acceptedSelectedStageFilterIds, acceptedSelectedCompetitionIds, acceptedTeamsFilter.mode]);

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
    const data = await gql<{ tournament: Tournament }>(
          `query ConfigTournament($id: ID!) {
             tournament(id: $id) {
               id
               name
               competitions {
                 id
                 name
                 order
                 stages {
                   id
                   name
                   order
                  format
                   isInitial
                  configJson
                  childrenJson
                  transitions {
                    id
                    label
                    toStageId
                    selectionKind
                    topN
                    rangeFrom
                    rangeTo
                    bottomN
                    toExternalTournamentId
                    toExternalStageId
                    toExternalTournamentName
                  }
                  groups {
                    id
                    name
                    order
                    capacity
                    assignedInscriptions { inscriptionId displayName }
                  }
                  matches {
                    id
                    round
                    leg
                    homeAssignedInscription { inscriptionId displayName }
                    awayAssignedInscription { inscriptionId displayName }
                  }
              assignedInscriptions { inscriptionId displayName }
                 }
               }
             }
           }`,
          { id: tournamentId }
    );
    const nextTournament = data.tournament || null;
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
      (invite) => invite.type === 'public' && invite.status === 'active' && !invite.competition_id
    );
    if (!general) general = await createTournamentInvite(tournamentId);
    setPublicInviteCode(String(general?.token || ''));
    const targeted = (invites || []).filter((invite) => invite.type === 'targeted');
    setTargetedInvitesPendingCount(
      targeted.filter(
        (invite) =>
          String(invite.invite_response_status || 'pending').toLowerCase() === 'pending' &&
          String(invite.status || '').toLowerCase() === 'active'
      ).length
    );
    setTargetedInvitesRejectedCount(
      targeted.filter((invite) => String(invite.invite_response_status || '').toLowerCase() === 'rejected').length
    );
    setTargetedInvitesAcceptedCount(
      targeted.filter((invite) => String(invite.invite_response_status || '').toLowerCase() === 'accepted').length
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
    const stages = (initializationCompetition?.stages || []).filter((stage) => stage.isInitial);
    if (stages.length === 0) return;
    (async () => {
      for (const stage of stages) {
        if (stage.format === 'groups') await ensureGroupsForStage(stage);
        if (stage.format === 'elimination') await ensureBracketForStage(stage);
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
        await gql(
          `mutation Unassign($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!) {
             unassignInscriptionFromStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId)
           }`,
          {
            stageId: placement.stageId,
            inscriptionId: String(inscription.id),
            tournamentId,
          }
        );
      }
    }

    setSaving(true);
    setError('');
    try {
      await clearPlacementsInCompetition(nextStageId);

      if (nextStageId) {
        await gql(
          `mutation Assign($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!) {
             assignInscriptionToStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName)
           }`,
          {
            stageId: nextStageId,
            inscriptionId: String(inscription.id),
            tournamentId,
            displayName: inscription.display_name,
          }
        );
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
    await gql(
      `mutation SyncGroups($stageId: ID!, $totalGroups: Int!) {
         syncStageGroups(stageId: $stageId, totalGroups: $totalGroups) { id }
       }`,
      { stageId: stage.id, totalGroups: numGroups }
    );
    await loadTournament();
  }

  async function ensureBracketForStage(stage: Stage) {
    const cap = stageCapacity(stage);
    if (stage.format !== 'elimination' || !cap || cap <= 1) return;
    const requiredMatches = Math.ceil(cap / 2);
    if ((stage.matches || []).length >= requiredMatches) return;
    await gql(
      `mutation EnsureBracket($stageId: ID!, $totalSlots: Int!) {
         ensureEliminationBracket(stageId: $stageId, totalSlots: $totalSlots) { id }
       }`,
      { stageId: stage.id, totalSlots: cap }
    );
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
        await gql(
          `mutation Unassign($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!) {
             unassignInscriptionFromStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId)
           }`,
          { stageId: placement.stageId, inscriptionId: String(inscription.id), tournamentId }
        );
      }
      await gql(
        `mutation AssignGroup($stageId: ID!, $groupId: ID!, $inscriptionId: ID!, $tournamentId: ID!, $displayName: String!) {
           assignInscriptionToGroup(stageId: $stageId, groupId: $groupId, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName)
         }`,
        {
          stageId: stage.id,
          groupId,
          inscriptionId: String(inscription.id),
          tournamentId,
          displayName: inscription.display_name,
        }
      );
      await loadTournament();
      await loadInscriptions();
    } catch (e: any) {
      setError(e?.message || 'No se pudo mover al grupo');
    } finally {
      setSaving(false);
    }
  }

  async function moveToBracketSlot(inscription: InscriptionItem, stage: Stage, matchId: string, slotRole: 'home' | 'away') {
    if (!['PENDIENTE', 'ACEPTADO'].includes(inscription.status)) return;
    const stageCap = stageCapacity(stage);
    if (stageCap && stageCap > 0) {
      const assignedIds = new Set<string>();
      for (const match of stage.matches || []) {
        if (match.homeAssignedInscription?.inscriptionId) assignedIds.add(String(match.homeAssignedInscription.inscriptionId));
        if (match.awayAssignedInscription?.inscriptionId) assignedIds.add(String(match.awayAssignedInscription.inscriptionId));
      }
      if (!assignedIds.has(String(inscription.id)) && assignedIds.size >= stageCap) {
        setError(`La llave "${stage.name}" alcanzó su cupo máximo (${stageCap}).`);
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
        await gql(
          `mutation Unassign($stageId: ID!, $inscriptionId: ID!, $tournamentId: ID!) {
             unassignInscriptionFromStage(stageId: $stageId, inscriptionId: $inscriptionId, tournamentId: $tournamentId)
           }`,
          { stageId: placement.stageId, inscriptionId: String(inscription.id), tournamentId }
        );
      }
      await gql(
        `mutation AssignSlot($stageId: ID!, $matchId: ID!, $slotRole: String!, $inscriptionId: ID, $tournamentId: ID!, $displayName: String) {
           assignInscriptionToMatchSlot(stageId: $stageId, matchId: $matchId, slotRole: $slotRole, inscriptionId: $inscriptionId, tournamentId: $tournamentId, displayName: $displayName)
         }`,
        {
          stageId: stage.id,
          matchId,
          slotRole,
          inscriptionId: String(inscription.id),
          tournamentId,
          displayName: inscription.display_name,
        }
      );
      await loadTournament();
      await loadInscriptions();
    } catch (e: any) {
      setError(e?.message || 'No se pudo ubicar en la llave');
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
          </div>
        </div>
      </Card>

      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {tab === 'gestion' ? (
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Invitaciones y altas manuales</h3>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Código de invitación pública</p>
                <p className="text-base font-semibold text-slate-800">{publicInviteCode || '-'}</p>
              </div>
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
            </div>

            <form onSubmit={handleManualBatchSubmit} className="space-y-3">
              {manualRows.map((row, index) => (
                <div key={row.id} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-6"
                    placeholder={`Nombre del equipo #${index + 1}`}
                    value={row.name}
                    onChange={(e) => setManualRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, name: e.target.value } : x)))}
                  />
                  <input
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-4"
                    placeholder="Código invitación (ej: JAV-333)"
                    value={row.inviteCode}
                    onChange={(e) => setManualRows((prev) => prev.map((x) => (x.id === row.id ? { ...x, inviteCode: e.target.value.toUpperCase() } : x)))}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="md:col-span-2"
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
                <Button type="submit" disabled={saving}>Agregar equipos / invitaciones</Button>
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
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Equipos participantes del torneo</h3>
            <CompetitionPhaseFilter
              className="mb-3"
              competitions={phaseFilterCompetitions}
              onChange={setAcceptedTeamsFilter}
            />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {acceptedTeamsPool.map((item) => {
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
                      <img
                        src={resolveBadgeUrl(item.team_badge_url)}
                        alt={item.display_name}
                        className="h-9 w-9 rounded-full object-cover"
                        onError={(event) => {
                          const target = event.currentTarget;
                          if (target.src.endsWith(DEFAULT_SHIELD_SRC)) return;
                          target.src = DEFAULT_SHIELD_SRC;
                        }}
                      />
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
              })}
              {acceptedTeamsPool.length === 0 ? (
                <p className="text-sm text-slate-500">No hay equipos aceptados para el filtro aplicado.</p>
              ) : null}
            </div>
          </Card>
        </div>
      ) : (
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
                  {(initializationCompetition.stages || []).filter((s) => s.isInitial).map((stage) => {
                    const stageCards = (stage.assignedInscriptions || [])
                      .map((assigned) => inscriptionById.get(String(assigned.inscriptionId)))
                      .filter((item): item is InscriptionItem => Boolean(item) && ['PENDIENTE', 'ACEPTADO'].includes(item!.status));
                    const cap = stageCapacity(stage);
                    const occupancy = stageCards.length;
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
                            {occupancy}{cap ? ` / ${cap}` : ''} · {stage.format}
                          </p>
                        </div>

                        {stage.format === 'groups' ? (
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {(stage.groups || [])
                              .slice()
                              .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
                              .map((group) => {
                                const groupCards = (group.assignedInscriptions || [])
                                  .map((assigned) => inscriptionById.get(String(assigned.inscriptionId)))
                                  .filter((item): item is InscriptionItem => Boolean(item));
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
                                      {group.name} · {groupCards.length}{groupCap > 0 ? `/${groupCap}` : ''}
                                    </p>
                                    <div className="space-y-1">
                                      {groupCards.map((item) => (
                                        <div
                                          key={item.id}
                                          draggable
                                          onDragStart={(e) => handleDragStart(e, item)}
                                          onDragEnd={handleDragEnd}
                                          className={`flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs transition-all duration-150 hover:border-emerald-300 ${draggingInscriptionId === String(item.id) ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                                        >
                                          <img
                                            src={resolveBadgeUrl(item.team_badge_url)}
                                            alt={item.display_name}
                                            className="h-6 w-6 rounded-full object-cover"
                                            onError={(event) => {
                                              const target = event.currentTarget;
                                              if (target.src.endsWith(DEFAULT_SHIELD_SRC)) return;
                                              target.src = DEFAULT_SHIELD_SRC;
                                            }}
                                          />
                                          <p className="line-clamp-1 font-medium text-slate-800">{item.display_name}</p>
                                        </div>
                                      ))}
                                      {groupCards.length === 0 ? <p className="text-[11px] text-slate-500">Sin equipos</p> : null}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        ) : null}

                        {stage.format === 'elimination' ? (
                          <div className="space-y-2">
                            {(stage.matches || [])
                              .slice()
                              .sort((a, b) => (Number(a.round || 0) - Number(b.round || 0)) || String(a.id).localeCompare(String(b.id)))
                              .map((match, index) => (
                                <div key={match.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  <p className="mb-2 text-[11px] font-semibold text-slate-600">
                                    Llave {index + 1} · Ronda {match.round || 1}
                                  </p>
                                  {(['home', 'away'] as const).map((slotRole) => {
                                    const slot = slotRole === 'home' ? match.homeAssignedInscription : match.awayAssignedInscription;
                                    const slotItem = slot ? inscriptionById.get(String(slot.inscriptionId)) : null;
                                    const showBye = slotRole === 'away' && !slot && Boolean(match.homeAssignedInscription);
                                    return (
                                      <div
                                        key={`${match.id}-${slotRole}`}
                                        className={`mb-1 rounded-md border px-2 py-1 text-xs ${dragOverZone === `match-${match.id}-${slotRole}` ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDragEnter={() => setDragOverZone(`match-${match.id}-${slotRole}`)}
                                        onDragLeave={() =>
                                          setDragOverZone((prev) => (prev === `match-${match.id}-${slotRole}` ? null : prev))
                                        }
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          setDragOverZone(null);
                                          const id = Number(e.dataTransfer.getData('text/inscription-id'));
                                          const item = inscriptions.find((x) => x.id === id);
                                          if (item) moveToBracketSlot(item, stage, match.id, slotRole);
                                        }}
                                      >
                                        <span className="mr-1 font-semibold text-slate-500">{slotRole === 'home' ? 'A' : 'B'}:</span>
                                        {slotItem ? slotItem.display_name : showBye ? 'BYE' : 'Arrastrar equipo'}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            {(stage.matches || []).length === 0 ? <p className="text-xs text-slate-500">Sin llaves generadas.</p> : null}
                          </div>
                        ) : null}

                        {(stage.format === 'league' || stage.format === 'composed') ? (
                          <div className="flex flex-wrap gap-2">
                            {stageCards.map((item) => (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item)}
                                onDragEnd={handleDragEnd}
                                className={`w-24 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center text-xs shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${draggingInscriptionId === String(item.id) ? 'scale-95 opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                              >
                                <img
                                  src={resolveBadgeUrl(item.team_badge_url)}
                                  alt={item.display_name}
                                  className="mx-auto mb-1 h-8 w-8 rounded-full object-cover"
                                  onError={(event) => {
                                    const target = event.currentTarget;
                                    if (target.src.endsWith(DEFAULT_SHIELD_SRC)) return;
                                    target.src = DEFAULT_SHIELD_SRC;
                                  }}
                                />
                                <p className="line-clamp-2 font-medium text-slate-800">{item.display_name}</p>
                              </div>
                            ))}
                            {stageCards.length === 0 ? <p className="text-xs text-slate-500">Sin equipos asignados</p> : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>

          <Card className="sticky top-4 h-fit w-[360px] shrink-0">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Panel de equipos (A-Z)</h3>
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
                    <img
                      src={resolveBadgeUrl(item.team_badge_url)}
                      alt={item.display_name}
                      className="mx-auto mb-1 h-10 w-10 rounded-full object-cover"
                      onError={(event) => {
                        const target = event.currentTarget;
                        if (target.src.endsWith(DEFAULT_SHIELD_SRC)) return;
                        target.src = DEFAULT_SHIELD_SRC;
                      }}
                    />
                    <p className="line-clamp-2 font-medium text-slate-800">{item.display_name}</p>
                    <p className="text-[10px] text-slate-500">{item.status}</p>
        </div>
                );
              })}
                      </div>
            {initializationPool.length === 0 ? <p className="mt-2 text-xs text-slate-500">No hay equipos para mostrar.</p> : null}
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
      )}
    </div>
  );
};
