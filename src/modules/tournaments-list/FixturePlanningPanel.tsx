import React from 'react';
import { buildScheduleFromStage, TournamentSchedule } from '../../components/tournament-schedule';
import { MatchEditDrawer } from '../../components/match-edit/MatchEditDrawer';
import { StandingsTable } from '../../components/standings';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  generateGroupsStageRoundRobin,
  generateLeagueRoundRobin,
  generateSingleEliminationBracket,
} from '../../services/tournaments/configuration';
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

  const hasAnyMatch =
    stage &&
    (stage.format === 'groups'
      ? (stage.groups || []).some((g) => (g.matches || []).length > 0)
      : (stage.matches || []).length > 0);

  async function handleGenerateLeague(doubleRound: boolean) {
    if (!stage || stage.format !== 'league') return;
    setSaving(true);
    setError('');
    try {
      await generateLeagueRoundRobin(stage.id, doubleRound);
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
      await generateGroupsStageRoundRobin(stage.id, doubleRound);
      await onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al generar grupos');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Fixture · competencia y fase</h3>
        <p className="mb-3 text-xs text-slate-600">
          Generá el calendario automático. Con equipos ya asignados, verás cada cruce por fecha, grupo o llave según la
          etapa. Al regenerar se reemplazan los partidos de esa fase.
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-xs text-slate-600">
            Competencia
            <select
              className="mt-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
              value={competitionId}
              onChange={(e) => {
                setCompetitionId(e.target.value);
                setStageId('');
              }}
            >
              {tournament.competitions
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-slate-600">
            Fase
            <select
              className="mt-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
            >
              {selectableStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.order}. {s.name} ({s.format})
                </option>
              ))}
            </select>
          </label>
        </div>

        {stage?.format === 'league' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => handleGenerateLeague(false)}>
              Generar liga (ida)
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleGenerateLeague(true)}>
              Generar liga ida y vuelta
            </Button>
          </div>
        ) : null}

        {stage?.format === 'elimination' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => handleGenerateElimination(false)}>
              Generar llave (ida)
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleGenerateElimination(true)}>
              Generar llave ida y vuelta
            </Button>
          </div>
        ) : null}

        {stage?.format === 'groups' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => handleGenerateGroups(false)}>
              Generar grupos (ida)
            </Button>
            <Button type="button" variant="secondary" onClick={() => handleGenerateGroups(true)}>
              Generar grupos ida y vuelta
            </Button>
          </div>
        ) : null}

        {!stage ? (
          <p className="mt-3 text-xs text-amber-700">No hay fases de liga, grupos o eliminación en esta competencia.</p>
        ) : null}
      </Card>

      {stage && scheduleView && hasAnyMatch ? (
        <Card>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Vista del fixture
              {stage.format === 'league'
                ? ' · Liga'
                : stage.format === 'groups'
                  ? ' · Grupos'
                  : ' · Eliminación'}
            </h3>
          </div>
          <TournamentSchedule
            type={scheduleView.type}
            data={scheduleView.data}
            theme="dark"
            onEdit={(matchId) => setMatchIdDrawerOpen(matchId)}
          />
          {stage.format === 'league' ? (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold text-slate-800">Tabla de posiciones</h3>
              <StandingsTable rows={stage.standings ?? []} />
            </div>
          ) : null}
          {stage.format === 'groups'
            ? (stage.groups || [])
                .slice()
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((group) => (
                  <div key={`standings-${group.id}`} className="mt-4 space-y-2">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Tabla de posiciones · {group.name}
                    </h3>
                    <StandingsTable rows={group.standings ?? []} />
                  </div>
                ))
            : null}
        </Card>
      ) : null}

      {stage && !hasAnyMatch ? (
        <Card>
          <p className="text-xs text-slate-500">
            Generá el fixture para ver el calendario con el formato de esta etapa (fechas, grupos o llave).
          </p>
        </Card>
      ) : null}

      {matchIdDrawerOpen ? (() => {
        const matchRow = matchById.get(matchIdDrawerOpen);
        return (
          <MatchEditDrawer
            matchId={matchIdDrawerOpen}
            tournamentId={tournament.id}
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
            onSaved={() => onRefresh()}
          />
        );
      })() : null}
    </div>
  );
};
