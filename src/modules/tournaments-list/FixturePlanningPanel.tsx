import React from 'react';
import { buildScheduleFromStage, TournamentSchedule } from '../../components/tournament-schedule';
import { MatchEditDrawer } from '../../components/match-edit/MatchEditDrawer';
import { StandingsTable } from '../../components/standings';
import type { ClassificationZone } from '../../components/standings';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  assignInscriptionToStage,
  generateGroupsStageRoundRobin,
  generateLeagueRoundRobin,
  generateSingleEliminationBracket,
  getTournamentConfigurationById,
  setStageStatus,
} from '../../services/tournaments/configuration';
import { updateMatchResult } from '../../services/tournaments/matchResult';
import type { MatchQuickAction } from '../../components/tournament-schedule/MatchCard';
import { bothTeamsResolvedFromSlots } from '../../components/tournament-schedule/matchParticipantUtils';
import { useFixtureSchedulingPrefs } from './useFixtureSchedulingPrefs';
import type { TournamentEntity, TournamentMatchRow } from './types';

export const FixturePlanningPanel: React.FC<{
  tournament: TournamentEntity;
  onRefresh: () => Promise<void>;
  setSaving: (v: boolean) => void;
  setError: (v: string) => void;
}> = ({ tournament, onRefresh, setSaving, setError }) => {
  const [competitionId, setCompetitionId] = React.useState(tournament.competitions[0]?.id || '');
  const [stageId, setStageId] = React.useState('');
  const [matchIdDrawerOpen, setMatchIdDrawerOpen] = React.useState<string | null>(null);
  const [maxRoundsInput, setMaxRoundsInput] = React.useState<string>('');
  const [presetTimeInput, setPresetTimeInput] = React.useState('');

  const competition = tournament.competitions.find((c) => c.id === competitionId);
  const selectableStages = React.useMemo(
    () =>
      (competition?.stages || [])
        .filter((s) => s.format === 'league' || s.format === 'elimination' || s.format === 'groups')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [competition]
  );

  React.useEffect(() => {
    if (!competitionId && tournament.competitions[0]?.id) {
      setCompetitionId(tournament.competitions[0].id);
    }
  }, [competitionId, tournament.competitions]);

  React.useEffect(() => {
    if (!stageId && selectableStages[0]?.id) {
      setStageId(selectableStages[0].id);
    } else if (stageId && !selectableStages.some((s) => s.id === stageId)) {
      setStageId(selectableStages[0]?.id || '');
    }
  }, [selectableStages, stageId]);

  const stage = selectableStages.find((s) => s.id === stageId);

  /** Busca el TournamentMatchRow por id en la etapa activa (stage o grupos). */
  const matchById = React.useMemo<Map<string, TournamentMatchRow>>(() => {
    const map = new Map<string, TournamentMatchRow>();
    if (!stage) return map;
    for (const m of stage.matches || []) map.set(m.id, m);
    for (const g of stage.groups || []) {
      for (const m of g.matches || []) map.set(m.id, m);
    }
    return map;
  }, [stage]);

  const scheduleView = React.useMemo(() => {
    if (!stage || stage.format === 'composed') return null;
    return buildScheduleFromStage({
      format: stage.format,
      matches: stage.matches,
      groups: stage.groups,
    });
  }, [stage]);

  // -- Modo calendario (FixtureViewer) --

  const schedApi = useFixtureSchedulingPrefs(tournament.id, stage?.id);

  function handleAddPresetTime() {
    const t = presetTimeInput.trim();
    if (!/^\d{1,2}:\d{2}$/.test(t)) return;
    schedApi?.addPresetTime(t);
    setPresetTimeInput('');
  }

  const hasAnyMatch =
    stage &&
    (stage.format === 'groups'
      ? (stage.groups || []).some((g) => (g.matches || []).length > 0)
      : (stage.matches || []).length > 0);

  const parsedMaxRounds = maxRoundsInput.trim() !== '' ? parseInt(maxRoundsInput, 10) : null;
  const validMaxRounds = parsedMaxRounds != null && parsedMaxRounds > 0 ? parsedMaxRounds : null;

  const maxRoundsFromConfig = React.useMemo((): number | null => {
    if (!stage || (stage.format !== 'league' && stage.format !== 'groups')) return null;
    try {
      const cfg = JSON.parse(stage.configJson || '{}') as Record<string, unknown>;
      const v = Number(cfg.maxRounds);
      return Number.isInteger(v) && v > 0 ? v : null;
    } catch {}
    return null;
  }, [stage]);

  const doubleRoundFromConfig = React.useMemo((): boolean => {
    if (!stage) return false;
    try {
      const cfg = JSON.parse(stage.configJson || '{}') as Record<string, unknown>;
      if (stage.format === 'league') return cfg.rounds === 'double';
      if (stage.format === 'groups') return cfg.groupRoundType === 'double';
      if (stage.format === 'elimination') return cfg.matchesPerTie === 'double';
    } catch {}
    return false;
  }, [stage]);

  async function handleGenerateLeague(doubleRound: boolean) {
    if (!stage || stage.format !== 'league') return;
    setSaving(true);
    setError('');
    try {
      await generateLeagueRoundRobin(stage.id, doubleRound, maxRoundsFromConfig);
      await onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al generar liga');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateElimination(doubleRound: boolean) {
    if (!stage || stage.format !== 'elimination') return;
    setSaving(true);
    setError('');
    try {
      await generateSingleEliminationBracket(stage.id, doubleRound);
      await onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al generar eliminación');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateGroups(doubleRound: boolean) {
    if (!stage || stage.format !== 'groups') return;
    setSaving(true);
    setError('');
    try {
      await generateGroupsStageRoundRobin(stage.id, doubleRound, maxRoundsFromConfig);
      await onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al generar grupos');
    } finally {
      setSaving(false);
    }
  }

  const [isAdvancing, setIsAdvancing] = React.useState(false);

  const stageStatus = stage?.stageStatus ?? 'active';
  const isBlocked = stageStatus === 'not_started';
  const isFinished = stageStatus === 'finished';
  const canManageMatches = !isBlocked && !isFinished;

  const handleQuickMatchAction = React.useCallback(
    async (matchId: string, action: MatchQuickAction) => {
      const row = matchById.get(matchId);
      if (
        !row ||
        !bothTeamsResolvedFromSlots(row.homeAssignedInscription, row.awayAssignedInscription)
      ) {
        const msg = 'Asigná local y visitante antes de gestionar el partido';
        setError(msg);
        throw new Error(msg);
      }
      setSaving(true);
      setError('');
      try {
        if (action.type === 'start') {
          await updateMatchResult(matchId, 0, 0, 'live');
        } else if (action.type === 'save_score') {
          await updateMatchResult(matchId, action.homeScore, action.awayScore, 'live');
        } else if (action.type === 'finish') {
          await updateMatchResult(matchId, action.homeScore, action.awayScore, 'completed');
        }
        await onRefresh();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al guardar resultado';
        setError(msg);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [matchById, onRefresh, setError, setSaving]
  );

  const allMatches: Array<{ id: string; status?: string | null }> = React.useMemo(() => {
    if (!stage) return [];
    const direct = stage.matches ?? [];
    const fromGroups = (stage.groups ?? []).flatMap((g) => g.matches ?? []);
    return [...direct, ...fromGroups];
  }, [stage]);

  const pendingMatches = allMatches.filter((m) => {
    const s = String(m.status ?? '').toLowerCase();
    return s !== 'finished' && s !== 'completed' && s !== 'suspended';
  });
  const canFinalize = stageStatus === 'active' && pendingMatches.length === 0 && allMatches.length > 0;

  async function handleFinalizeStage() {
    if (!stage) return;
    setIsAdvancing(true);
    try {
      await setStageStatus(stage.id, 'finished');

      const freshTournament = await getTournamentConfigurationById(tournament.id);
      if (!freshTournament) throw new Error('No se pudieron obtener datos actualizados del torneo');

      const freshStage = freshTournament.competitions
        .flatMap((c: any) => c.stages)
        .find((s: any) => s.id === stage.id);
      if (!freshStage) throw new Error('No se encontró la etapa en datos actualizados');

      const outgoing = (stage.transitions || []).filter((tr) => tr.toStageId);
      for (const tr of outgoing) {
        const destStageId = tr.toStageId!;
        const destStage = freshTournament.competitions
          .flatMap((c: any) => c.stages)
          .find((s: any) => s.id === destStageId);
        if (!destStage) continue;

        const eligibles = computeAutoAdvance(freshStage, tr);
        for (const eligible of eligibles) {
          await assignInscriptionToStage({
            stageId: destStageId,
            inscriptionId: eligible.inscriptionId,
            tournamentId: tournament.id,
            displayName: eligible.displayName,
            force: true,
          });
        }

        const allSourcesFinished = freshTournament.competitions
          .flatMap((c: any) => c.stages)
          .filter((s: any) => (s.transitions || []).some((t: any) => t.toStageId === destStageId))
          .every((s: any) => s.id === stage.id || s.stageStatus === 'finished');

        if (allSourcesFinished) {
          await setStageStatus(destStageId, 'active');
        }
      }

      await onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al finalizar la etapa');
    } finally {
      setIsAdvancing(false);
    }
  }

  function computeAutoAdvance(
    sourceStage: any,
    tr: any
  ): Array<{ inscriptionId: string; displayName: string }> {
    const kind = String(tr.selectionKind || 'top').toLowerCase();
    const fmt = String(sourceStage.format || '').toLowerCase();

    function pickFromStandings(standings: any[]): Array<{ inscriptionId: string; displayName: string }> {
      const sorted = [...standings].sort((a, b) => Number(a.position) - Number(b.position));
      if (kind === 'top') {
        const n = Number(tr.topN) || 0;
        return sorted.filter(r => Number(r.position) >= 1 && Number(r.position) <= n)
          .map(r => ({ inscriptionId: String(r.inscriptionId), displayName: String(r.displayName || r.inscriptionId) }));
      }
      if (kind === 'range') {
        const from = Number(tr.rangeFrom) || 0;
        const to = Number(tr.rangeTo) || 0;
        if (from <= 0 || to < from) return [];
        return sorted.filter(r => Number(r.position) >= from && Number(r.position) <= to)
          .map(r => ({ inscriptionId: String(r.inscriptionId), displayName: String(r.displayName || r.inscriptionId) }));
      }
      if (kind === 'bottom') {
        const b = Number(tr.bottomN) || 0;
        return sorted.slice(-b)
          .map(r => ({ inscriptionId: String(r.inscriptionId), displayName: String(r.displayName || r.inscriptionId) }));
      }
      return [];
    }

    if (fmt === 'league') {
      return pickFromStandings(sourceStage.standings || []);
    }

    if (fmt === 'groups') {
      const seen = new Set<string>();
      const result: Array<{ inscriptionId: string; displayName: string }> = [];
      for (const group of (sourceStage.groups || [])) {
        for (const row of pickFromStandings(group.standings || [])) {
          if (!seen.has(row.inscriptionId)) {
            seen.add(row.inscriptionId);
            result.push(row);
          }
        }
      }
      return result;
    }

    if (fmt === 'elimination') {
      // Clasificar equipos por la ronda más alta que ganaron
      const maxRoundWon: Record<string, { round: number; displayName: string }> = {};
      for (const m of (sourceStage.matches || [])) {
        const status = String(m.status ?? '').toLowerCase();
        if (status !== 'finished' && status !== 'completed') continue;
        const hs = Number(m.homeScore ?? 0);
        const as_ = Number(m.awayScore ?? 0);
        if (hs === as_) continue;
        const round = Number(m.round ?? 1);
        const isHomeWinner = hs > as_;
        const winnerId = isHomeWinner
          ? m.homeAssignedInscription?.inscriptionId
          : m.awayAssignedInscription?.inscriptionId;
        const winnerDisplay = isHomeWinner
          ? (m.homeAssignedInscription?.displayName ?? '')
          : (m.awayAssignedInscription?.displayName ?? '');
        if (!winnerId || winnerId.startsWith('liga360-slot:') || winnerId.startsWith('pos:')) continue;
        if (!maxRoundWon[winnerId] || maxRoundWon[winnerId].round < round) {
          maxRoundWon[winnerId] = { round, displayName: winnerDisplay };
        }
      }
      const sorted = Object.entries(maxRoundWon)
        .sort((a, b) => b[1].round - a[1].round)
        .map(([inscriptionId, info]) => ({ inscriptionId, displayName: info.displayName }));

      if (kind === 'top') {
        const n = Number(tr.topN) || 0;
        return sorted.slice(0, n);
      }
      if (kind === 'range') {
        const from = Number(tr.rangeFrom) || 0;
        const to = Number(tr.rangeTo) || 0;
        if (from <= 0 || to < from) return [];
        return sorted.slice(from - 1, to);
      }
      if (kind === 'bottom') {
        const b = Number(tr.bottomN) || 0;
        return sorted.slice(-b);
      }
      return [];
    }

    return [];
  }

  // Zonas de clasificación derivadas de las transiciones de la etapa
  const classificationZones = React.useMemo((): ClassificationZone[] => {
    if (!stage) return [];
    const outgoing = (stage.transitions || []).filter((tr) => tr.toStageId);
    if (outgoing.length === 0) return [];
    const totalRows =
      stage.format === 'groups'
        ? Math.max(...(stage.groups || []).map((g) => (g.standings || []).length), 0)
        : (stage.standings || []).length;

    const zones: ClassificationZone[] = [];
    for (const tr of outgoing) {
      const destName =
        tournament.competitions
          .flatMap((c) => c.stages)
          .find((s) => s.id === tr.toStageId)?.name ?? tr.toStageId ?? '?';
      const kind = String(tr.selectionKind || 'top').toLowerCase();
      let fromPos = 0;
      let toPos = 0;
      let bestNCount: number | undefined;
      if (kind === 'top' && tr.topN) {
        fromPos = 1;
        toPos = Number(tr.topN);
      } else if (kind === 'range' && tr.rangeFrom && tr.rangeTo) {
        fromPos = Number(tr.rangeFrom);
        toPos = Number(tr.rangeTo);
      } else if (kind === 'bottom' && tr.bottomN && totalRows > 0) {
        fromPos = totalRows - Number(tr.bottomN) + 1;
        toPos = totalRows;
      } else if (kind === 'bestn' && tr.topN && tr.rangeFrom) {
        fromPos = Number(tr.rangeFrom);
        toPos = Number(tr.rangeFrom);
        bestNCount = Number(tr.topN);
      }
      if (fromPos > 0 && toPos >= fromPos) {
        zones.push({ fromPos, toPos, label: `→ ${destName}`, colorIndex: zones.length, ...(bestNCount ? { bestNCount } : {}) });
      }
    }
    // Ordenar por posición inicial para asignar colores lógicamente
    zones.sort((a, b) => a.fromPos - b.fromPos);
    return zones.map((z, i) => ({ ...z, colorIndex: i }));
  }, [stage, tournament]);

  type SummarySection = { label: string; teams: string[]; isChampion?: boolean; colorIndex?: number };

  const stageSummary = React.useMemo((): SummarySection[] | null => {
    if (!stage || !isFinished) return null;
    const sections: SummarySection[] = [];
    const hasOutgoing = classificationZones.length > 0;

    if (hasOutgoing) {
      if (stage.format === 'league') {
        for (const zone of classificationZones) {
          const teams = (stage.standings ?? [])
            .filter((r) => r.position >= zone.fromPos && r.position <= zone.toPos)
            .map((r) => r.displayName);
          if (teams.length) sections.push({ label: zone.label, teams, colorIndex: zone.colorIndex });
        }
      } else if (stage.format === 'groups') {
        const sortedGroups = (stage.groups ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        for (const zone of classificationZones) {
          const teams: string[] = [];
          if (zone.bestNCount) {
            // bestN: recolectar todos los equipos en esa posición, rankear globalmente, tomar los N mejores
            const candidates = sortedGroups.flatMap((g) =>
              (g.standings ?? []).filter((r) => r.position === zone.fromPos)
            );
            candidates.sort((a, b) =>
              b.points !== a.points ? b.points - a.points :
              b.goalDifference !== a.goalDifference ? b.goalDifference - a.goalDifference :
              b.goalsFor - a.goalsFor
            );
            candidates.slice(0, zone.bestNCount).forEach((r) => teams.push(r.displayName));
          } else {
            for (const g of sortedGroups) {
              (g.standings ?? [])
                .filter((r) => r.position >= zone.fromPos && r.position <= zone.toPos)
                .forEach((r) => teams.push(r.displayName));
            }
          }
          if (teams.length) sections.push({ label: zone.label, teams, colorIndex: zone.colorIndex });
        }
      } else if (stage.format === 'elimination') {
        const maxRoundWon: Record<string, { round: number; displayName: string }> = {};
        for (const m of (stage.matches ?? [])) {
          const s = String(m.status ?? '').toLowerCase();
          if (s !== 'finished' && s !== 'completed') continue;
          const hs = Number(m.homeScore ?? 0);
          const as_ = Number(m.awayScore ?? 0);
          if (hs === as_) continue;
          const round = Number(m.round ?? 1);
          const homeWins = hs > as_;
          const wId = homeWins ? m.homeAssignedInscription?.inscriptionId : m.awayAssignedInscription?.inscriptionId;
          const wName = homeWins ? (m.homeAssignedInscription?.displayName ?? '') : (m.awayAssignedInscription?.displayName ?? '');
          if (!wId || wId.startsWith('liga360-slot:') || wId.startsWith('pos:')) continue;
          if (!maxRoundWon[wId] || maxRoundWon[wId].round < round) maxRoundWon[wId] = { round, displayName: wName };
        }
        const sorted = Object.values(maxRoundWon).sort((a, b) => b.round - a.round);
        for (const zone of classificationZones) {
          const teams = sorted.slice(zone.fromPos - 1, zone.toPos).map((t) => t.displayName);
          if (teams.length) sections.push({ label: zone.label, teams, colorIndex: zone.colorIndex });
        }
      }
    } else {
      // Etapa final — mostrar campeón/es
      if (stage.format === 'league') {
        const champ = (stage.standings ?? []).find((r) => r.position === 1);
        if (champ) sections.push({ label: 'Campeón', teams: [champ.displayName], isChampion: true });
      } else if (stage.format === 'groups') {
        for (const g of (stage.groups ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
          const champ = (g.standings ?? []).find((r) => r.position === 1);
          if (champ) sections.push({ label: `Campeón · ${g.name}`, teams: [champ.displayName], isChampion: true });
        }
      } else if (stage.format === 'elimination') {
        const matches = stage.matches ?? [];
        const lastRound = matches.reduce((max, m) => Math.max(max, m.round ?? 1), 0);
        const finalMatch = matches.find((m) => (m.round ?? 1) === lastRound && (m.slotIndex ?? 1) === 1);
        if (finalMatch) {
          const s = String(finalMatch.status ?? '').toLowerCase();
          if (s === 'finished' || s === 'completed') {
            const hs = Number(finalMatch.homeScore ?? 0);
            const as_ = Number(finalMatch.awayScore ?? 0);
            if (hs !== as_) {
              const winner = hs > as_ ? finalMatch.homeAssignedInscription : finalMatch.awayAssignedInscription;
              if (winner) sections.push({ label: 'Campeón', teams: [winner.displayName], isChampion: true });
            }
          }
        }
      }
    }

    return sections.length > 0 ? sections : null;
  }, [stage, isFinished, classificationZones]);

  const ZONE_DOT_CLASSES = [
    'bg-emerald-500', 'bg-sky-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500',
  ];

  return (
    <div className="space-y-4">
      <Card>
        {/* Tabs de competencia — igual que en inicialización */}
        {tournament.competitions.length > 1 && (
          <div className="mb-3 inline-flex flex-wrap rounded-xl bg-surface-0 p-1">
            {tournament.competitions
              .slice()
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCompetitionId(c.id); setStageId(''); }}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    competitionId === c.id
                      ? 'bg-surface-3 text-text-primary shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {c.name}
                </button>
              ))}
          </div>
        )}

        {/* Pills de fase */}
        {selectableStages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectableStages.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStageId(s.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  stageId === s.id
                    ? 'border-accent-primary bg-accent-soft text-success-base'
                    : 'border-border-subtle bg-surface-2 text-text-muted hover:border-border-strong hover:text-text-primary'
                }`}
              >
                {s.order}. {s.name}
              </button>
            ))}
          </div>
        )}

        {!stage && (
          <p className="mt-3 text-xs text-amber-700">No hay fases de liga, grupos o eliminación en esta competencia.</p>
        )}

        {!isFinished && (stage?.format === 'league' || stage?.format === 'groups') && maxRoundsFromConfig ? (
          <div className="mt-4 text-xs text-text-muted">
            Fechas a generar: <span className="font-medium text-text-primary">{maxRoundsFromConfig}</span>
            <span className="ml-1">(según config · {maxRoundsFromConfig === 1 ? '1 partido' : `${maxRoundsFromConfig} partidos`} por equipo)</span>
          </div>
        ) : null}

        {!isFinished && stage?.format === 'league' ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => handleGenerateLeague(doubleRoundFromConfig)}>
              Generar fixture
            </Button>
            <span className="text-xs text-text-muted">
              {doubleRoundFromConfig ? 'Ida y vuelta (según config)' : 'Solo ida (según config)'}
            </span>
          </div>
        ) : null}

        {!isFinished && stage?.format === 'elimination' ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => handleGenerateElimination(doubleRoundFromConfig)}>
              Generar fixture
            </Button>
            <span className="text-xs text-text-muted">
              {doubleRoundFromConfig ? 'Ida y vuelta (según config)' : 'Partido único (según config)'}
            </span>
          </div>
        ) : null}

        {!isFinished && stage?.format === 'groups' ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => handleGenerateGroups(doubleRoundFromConfig)}>
              Generar fixture
            </Button>
            <span className="text-xs text-text-muted">
              {doubleRoundFromConfig ? 'Ida y vuelta (según config)' : 'Solo ida (según config)'}
            </span>
          </div>
        ) : null}

      </Card>

      {/* Panel de horarios frecuentes — solo si la etapa no está finalizada */}
      {schedApi && !isFinished && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-text-primary">Horarios frecuentes</h3>
          <p className="mb-3 text-xs text-text-muted">
            Los horarios guardados aparecen como acceso rápido al programar cada partido.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {schedApi.presetTimes.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-surface-2 px-2.5 py-1 text-xs text-text-primary"
              >
                {t}
                <button
                  type="button"
                  onClick={() => schedApi.removePresetTime(t)}
                  className="ml-0.5 text-text-muted transition-colors hover:text-red-400"
                  aria-label={`Quitar ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={presetTimeInput}
              onChange={(e) => setPresetTimeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPresetTime()}
              placeholder="HH:MM"
              maxLength={5}
              className="w-24 rounded-lg border border-border-subtle bg-surface-2 px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40"
            />
            <Button type="button" variant="secondary" onClick={handleAddPresetTime}>
              Agregar
            </Button>
          </div>
        </Card>
      )}

      {stage && hasAnyMatch ? (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">
              Partidos
              {stage.format === 'league' ? ' · Liga' : stage.format === 'groups' ? ' · Grupos' : ' · Eliminación'}
            </h3>
            {isBlocked && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Esperando etapa anterior
              </span>
            )}
            {stageStatus === 'active' && !isBlocked && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                En curso
              </span>
            )}
            {isFinished && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Finalizada
              </span>
            )}
          </div>

          {isBlocked && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Esta etapa no puede recibir resultados hasta que finalice la etapa anterior.
            </div>
          )}

          {scheduleView ? (
            <>
              <TournamentSchedule
                type={scheduleView.type}
                data={scheduleView.data}
                theme="dark"
                onEdit={
                  canManageMatches
                    ? (matchId) => {
                        const row = matchById.get(matchId);
                        if (
                          !row ||
                          !bothTeamsResolvedFromSlots(
                            row.homeAssignedInscription,
                            row.awayAssignedInscription
                          )
                        ) {
                          return;
                        }
                        setMatchIdDrawerOpen(matchId);
                      }
                    : undefined
                }
                onQuickMatchAction={canManageMatches ? handleQuickMatchAction : undefined}
              />
              {stage.format === 'league' ? (
                <div className="mt-4 space-y-2">
                  <h3 className="text-sm font-semibold text-text-primary">Tabla de posiciones</h3>
                  <StandingsTable rows={stage.standings ?? []} zones={classificationZones} />
                </div>
              ) : null}
              {stage.format === 'groups'
                ? (stage.groups || [])
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    .map((group) => (
                      <div key={`standings-${group.id}`} className="mt-4 space-y-2">
                        <h3 className="text-sm font-semibold text-text-primary">
                          Tabla de posiciones · {group.name}
                        </h3>
                        <StandingsTable rows={group.standings ?? []} zones={classificationZones} />
                      </div>
                    ))
                : null}
              {stage.format === 'elimination' && classificationZones.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                  {classificationZones.map((z) => (
                    <span key={z.label} className="text-xs text-text-muted">
                      <span className="font-medium text-text-primary">
                        Mejor{z.toPos > z.fromPos ? `es ${z.fromPos}–${z.toPos}` : `${z.fromPos}`}
                      </span>{' '}
                      {z.label}
                    </span>
                  ))}
                </div>
              ) : null}

              {stageStatus === 'active' && (
                <div className="mt-4 space-y-2">
                  {pendingMatches.length > 0 && (
                    <p className="text-xs text-amber-700">
                      Faltan {pendingMatches.length} {pendingMatches.length === 1 ? 'partido' : 'partidos'} por finalizar o suspender antes de cerrar la etapa.
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      onClick={handleFinalizeStage}
                      disabled={isAdvancing || !canFinalize}
                    >
                      {isAdvancing ? 'Avanzando clasificados...' : 'Finalizar etapa'}
                    </Button>
                    {canFinalize && (
                      <span className="text-xs text-text-muted">
                        Todos los partidos jugados. Se pasarán los clasificados automáticamente.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </Card>
      ) : null}

      {isFinished && stageSummary && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Resumen de la etapa</h3>
          <div className="space-y-4">
            {stageSummary.map((section, i) => (
              <div key={i}>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
                  {section.isChampion ? (
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-500" fill="currentColor">
                      <path d="M5 3h14v2H5V3zm0 4h14l-2 8H7L5 7zm7 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
                    </svg>
                  ) : (
                    <span className={`inline-block h-2 w-2 rounded-sm ${ZONE_DOT_CLASSES[Math.min(section.colorIndex ?? 0, ZONE_DOT_CLASSES.length - 1)]}`} />
                  )}
                  {section.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {section.teams.map((name) => (
                    <span
                      key={name}
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        section.isChampion
                          ? 'border-amber-300 bg-amber-50 text-amber-900'
                          : 'border-border-subtle bg-surface-2 text-text-primary'
                      }`}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {stage && !hasAnyMatch ? (
        <Card>
          <p className="text-xs text-text-muted">
            Generá el fixture para ver los partidos de esta etapa.
          </p>
        </Card>
      ) : null}

      {matchIdDrawerOpen ? (() => {
        const matchRow = matchById.get(matchIdDrawerOpen);
        const teamsResolved = matchRow
          ? bothTeamsResolvedFromSlots(
              matchRow.homeAssignedInscription,
              matchRow.awayAssignedInscription
            )
          : false;
        const isMatchFinished = ['finished', 'completed', 'suspended'].includes(
          String(matchRow?.status ?? '').toLowerCase()
        );
        return (
          <MatchEditDrawer
            matchId={matchIdDrawerOpen}
            tournamentId={tournament.id}
            teamsResolved={teamsResolved}
            defaultTab={teamsResolved ? (isMatchFinished ? 'schedule' : 'result') : 'schedule'}
            presetTimes={schedApi?.presetTimes}
            initialData={{
              scheduledAt: matchRow?.scheduledAt,
              venue: matchRow?.venue,
              referee: matchRow?.referee,
              homeScore: matchRow?.homeScore,
              awayScore: matchRow?.awayScore,
              status: matchRow?.status,
              homeDisplayName: matchRow?.homeAssignedInscription?.displayName,
              awayDisplayName: matchRow?.awayAssignedInscription?.displayName,
            }}
            onClose={() => setMatchIdDrawerOpen(null)}
            onSaved={async () => {
              await onRefresh();
              setMatchIdDrawerOpen(null);
            }}
          />
        );
      })() : null}
    </div>
  );
};
