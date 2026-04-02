import React from 'react';
import { FixtureViewer, type FixtureGroup, type Round } from '../../components/fixture-viewer';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import {
  generateGroupsStageRoundRobin,
  generateLeagueRoundRobin,
  generateSingleEliminationBracket,
  setTournamentPublished,
} from '../../services/tournaments/configuration';
import { buildLiga360FixtureModel, stageMatchesSignature } from './liga360FixtureAdapter';
import {
  persistFixtureGroupsChange,
  persistFixtureRoundsChange,
  persistKnockoutFixtureChange,
} from './persistLiga360Fixture';
import type { TournamentEntity } from './types';
import { useFixtureSchedulingPrefs } from './useFixtureSchedulingPrefs';

export const FixturePlanningPanel: React.FC<{
  tournament: TournamentEntity;
  organizerName: string;
  saveLocked?: boolean;
  /** Mapa inscriptionId → URL de escudo (REST inscripciones). */
  badgeUrlByInscriptionId?: Record<string, string>;
  onRefresh: () => Promise<void>;
  setSaving: (v: boolean) => void;
  setError: (v: string) => void;
}> = ({
  tournament,
  organizerName,
  saveLocked = false,
  badgeUrlByInscriptionId,
  onRefresh,
  setSaving,
  setError,
}) => {
  const [competitionId, setCompetitionId] = React.useState(tournament.competitions[0]?.id || '');
  const [stageId, setStageId] = React.useState('');

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

  const stageSig = React.useMemo(() => (stage ? stageMatchesSignature(stage) : ''), [stage]);
  const builtModel = React.useMemo(
    () => (stage ? buildLiga360FixtureModel(stage, badgeUrlByInscriptionId ?? null) : null),
    [stage, stageSig, badgeUrlByInscriptionId]
  );

  const [draftLeague, setDraftLeague] = React.useState<Round[] | null>(null);
  const [draftKnockout, setDraftKnockout] = React.useState<Round[] | null>(null);
  const [draftGroups, setDraftGroups] = React.useState<FixtureGroup[] | null>(null);

  React.useEffect(() => {
    if (!builtModel) {
      setDraftLeague(null);
      setDraftKnockout(null);
      setDraftGroups(null);
      return;
    }
    if (builtModel.layout === 'league') {
      setDraftLeague(builtModel.fixture);
      setDraftKnockout(null);
      setDraftGroups(null);
    } else if (builtModel.layout === 'knockout') {
      setDraftKnockout(builtModel.fixture);
      setDraftLeague(null);
      setDraftGroups(null);
    } else {
      setDraftGroups(builtModel.groups);
      setDraftLeague(null);
      setDraftKnockout(null);
    }
  }, [builtModel, tournament.id, stage?.id, stageSig]);

  const hasAnyMatch =
    stage &&
    (stage.format === 'groups'
      ? (stage.groups || []).some((g) => (g.matches || []).length > 0)
      : (stage.matches || []).length > 0);

  const isOrganizer = React.useMemo(() => {
    const owner = (tournament.organizer || '').trim().toLowerCase();
    const me = organizerName.trim().toLowerCase();
    return Boolean(owner && me && owner === me);
  }, [tournament.organizer, organizerName]);

  const schedApi = useFixtureSchedulingPrefs(tournament.id, stage?.id);
  const schedulingAssistForScope = React.useMemo(() => {
    if (!isOrganizer || !schedApi) return undefined;
    return (scope: string) => ({
      presetTimes: schedApi.presetTimes,
      setPresetTimes: schedApi.setPresetTimes,
      addPresetTime: schedApi.addPresetTime,
      removePresetTime: schedApi.removePresetTime,
      getPlayWindow: (roundId: string) => schedApi.getPlayWindow(scope, roundId),
      setPlayWindowForRound: (roundId: string, start: string, end: string) =>
        schedApi.setPlayWindow(scope, roundId, start, end),
    });
  }, [isOrganizer, schedApi]);

  const isDraft = String(tournament.status || '').toLowerCase() !== 'published';

  const canEditMatchResults = React.useMemo(() => {
    const pub = String(tournament.status || '').toLowerCase() === 'published';
    return Boolean(pub && isOrganizer);
  }, [tournament.status, isOrganizer]);

  const persistOpts = React.useMemo(
    () => ({ canEditResults: canEditMatchResults }),
    [canEditMatchResults]
  );

  async function handlePublishTournament() {
    setSaving(true);
    setError('');
    try {
      const inscriptionMode =
        String(tournament.inscriptionMode || 'public').toLowerCase() === 'invitation' ? 'invitation' : 'public';
      await setTournamentPublished({
        id: tournament.id,
        name: (tournament.name || 'Torneo').trim() || 'Torneo',
        sport: (tournament.sport || 'football').trim() || 'football',
        season: tournament.season ?? null,
        venue: tournament.venue ?? null,
        participantType: tournament.participantType ?? null,
        inscriptionMode,
      });
      await onRefresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar el torneo');
    } finally {
      setSaving(false);
    }
  }

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

  const onLeagueFixtureChange = React.useCallback(
    async (next: Round[]) => {
      if (!stage || !isOrganizer || builtModel?.layout !== 'league') return;
      const prev = draftLeague ?? builtModel.fixture;
      setDraftLeague(next);
      setSaving(true);
      setError('');
      try {
        await persistFixtureRoundsChange(next, stage, tournament.id, persistOpts);
        await onRefresh();
      } catch (e: unknown) {
        setDraftLeague(prev);
        setError(e instanceof Error ? e.message : 'Error al guardar el fixture');
      } finally {
        setSaving(false);
      }
    },
    [stage, isOrganizer, builtModel, draftLeague, tournament.id, persistOpts, onRefresh, setSaving, setError]
  );

  const onKnockoutFixtureChange = React.useCallback(
    async (next: Round[]) => {
      if (!stage || !isOrganizer || builtModel?.layout !== 'knockout') return;
      const prev = draftKnockout ?? builtModel.fixture;
      setDraftKnockout(next);
      setSaving(true);
      setError('');
      try {
        await persistKnockoutFixtureChange(next, stage, tournament.id, persistOpts);
        await onRefresh();
      } catch (e: unknown) {
        setDraftKnockout(prev);
        setError(e instanceof Error ? e.message : 'Error al guardar el fixture');
      } finally {
        setSaving(false);
      }
    },
    [stage, isOrganizer, builtModel, draftKnockout, tournament.id, persistOpts, onRefresh, setSaving, setError]
  );

  const onGroupsFixtureChange = React.useCallback(
    async (next: FixtureGroup[]) => {
      if (!stage || !isOrganizer || builtModel?.layout !== 'groups') return;
      const prev = draftGroups ?? builtModel.groups;
      setDraftGroups(next);
      setSaving(true);
      setError('');
      try {
        await persistFixtureGroupsChange(next, stage, tournament.id, persistOpts);
        await onRefresh();
      } catch (e: unknown) {
        setDraftGroups(prev);
        setError(e instanceof Error ? e.message : 'Error al guardar el fixture');
      } finally {
        setSaving(false);
      }
    },
    [stage, isOrganizer, builtModel, draftGroups, tournament.id, persistOpts, onRefresh, setSaving, setError]
  );

  const showPublishFooter = isOrganizer && isDraft;
  const scheduleCardVisible = Boolean(stage && builtModel && hasAnyMatch);

  const publishFooter = showPublishFooter ? (
    <div className="mt-6 flex flex-col items-end gap-2 border-t border-slate-100 pt-4">
      <p className="max-w-md text-right text-xs text-slate-500">
        Publicá el torneo para cargar marcadores. Podés definir fecha y hora de cada partido antes (incluso en borrador).
      </p>
      <Button type="button" variant="secondary" onClick={() => void handlePublishTournament()} disabled={saveLocked}>
        Publicar torneo y habilitar resultados
      </Button>
    </div>
  ) : null;

  const viewerMode = isOrganizer ? 'edit' : 'view';
  const scoreEditing = { canEdit: canEditMatchResults, saveLocked };

  const fixtureViewer =
    builtModel && stage ? (
      builtModel.layout === 'groups' ? (
        <FixtureViewer
          mode={viewerMode}
          layout="groups"
          groups={draftGroups ?? builtModel.groups}
          teams={builtModel.teams}
          theme="light"
          disableDragDrop={false}
          disableStructureEdit
          scoreEditing={scoreEditing}
          schedulingAssistForScope={schedulingAssistForScope}
          onChange={isOrganizer ? onGroupsFixtureChange : undefined}
        />
      ) : builtModel.layout === 'knockout' ? (
        <FixtureViewer
          mode={viewerMode}
          layout="knockout"
          fixture={draftKnockout ?? builtModel.fixture}
          teams={builtModel.teams}
          theme="light"
          disableDragDrop
          disableStructureEdit
          scoreEditing={scoreEditing}
          schedulingAssistForScope={schedulingAssistForScope}
          onChange={isOrganizer ? onKnockoutFixtureChange : undefined}
        />
      ) : (
        <FixtureViewer
          mode={viewerMode}
          layout="league"
          fixture={draftLeague ?? builtModel.fixture}
          teams={builtModel.teams}
          theme="light"
          disableDragDrop={false}
          disableStructureEdit
          scoreEditing={scoreEditing}
          schedulingAssistForScope={schedulingAssistForScope}
          onChange={isOrganizer ? onLeagueFixtureChange : undefined}
        />
      )
    ) : null;

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
        {publishFooter && !scheduleCardVisible ? publishFooter : null}
      </Card>

      {stage && builtModel && hasAnyMatch ? (
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
            {!canEditMatchResults ? (
              <p className="mt-2 text-xs text-amber-800">
                {isDraft && isOrganizer
                  ? 'Para marcadores: botón “Publicar torneo…” abajo a la derecha, o estado Publicado en Editar estructura. La fecha/hora y los cupos los editás acá; al soltar un cambio se guarda solo.'
                  : isDraft
                    ? 'Solo el organizador puede publicar el torneo y cargar resultados.'
                    : 'Solo el organizador del torneo puede cargar resultados.'}
              </p>
            ) : null}
            {!isOrganizer ? (
              <p className="mt-2 text-xs text-slate-600">Solo el organizador puede editar cupos, fechas y reordenar fechas.</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                El rango de días por fecha y los horarios sugeridos se guardan en este navegador (no en el servidor).
              </p>
            )}
          </div>
          {fixtureViewer}
          {publishFooter && scheduleCardVisible ? publishFooter : null}
        </Card>
      ) : null}

      {stage && !hasAnyMatch ? (
        <Card>
          <p className="text-xs text-slate-500">
            Generá el fixture para ver el calendario con el formato de esta etapa (fechas, grupos o llave).
          </p>
        </Card>
      ) : null}
    </div>
  );
};
