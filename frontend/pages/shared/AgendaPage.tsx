import React from 'react';
import { Card } from '../../components/ui/Card';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { useTournamentRoute } from '../../hooks/useTournamentRoute';
import { AgendaOrganizerRow } from '../../modules/agenda/AgendaOrganizerRow';
import { AgendaParticipantRow } from '../../modules/agenda/AgendaParticipantRow';
import {
  AGENDA_ALL_TOURNAMENTS,
  AGENDA_PAGE_SIZE,
  agendaFixtureFocusFromRow,
  type AgendaOrganizerRowData,
  type AgendaParticipantRowData,
  type AgendaRow,
} from '../../modules/agenda/agendaPickers';
import { useAgendaData, type AgendaRole } from '../../modules/agenda/useAgendaData';
import { TournamentDetail } from '../../modules/tournaments-list';
import type { LinkedTeam } from '../../types/domain';

export interface AgendaPageProps {
  role: AgendaRole;
  teamId?: number | null;
  participantUserId?: number | null;
  linkedTeams?: LinkedTeam[];
  organizerName?: string;
}

export const AgendaPage: React.FC<AgendaPageProps> = ({
  role,
  teamId,
  participantUserId,
  linkedTeams = [],
  organizerName = '',
}) => {
  const [selectedTournamentId, setSelectedTournamentId, routeFocus] = useTournamentRoute('agenda');
  const [tournamentFilter, setTournamentFilter] = React.useState(AGENDA_ALL_TOURNAMENTS);
  const [page, setPage] = React.useState(0);

  const { rows, tournamentsById, imagesByTournamentId, loading, error, refresh, refreshTournament } = useAgendaData({
    role,
    teamId,
    participantUserId,
    linkedTeams,
    organizerName,
  });

  const tournamentOptions = React.useMemo(() => {
    const ids = [...new Set(rows.map((r) => r.tournamentId))];
    return [
      { id: AGENDA_ALL_TOURNAMENTS, label: 'Todos los torneos' },
      ...ids.map((id) => ({
        id,
        label: rows.find((r) => r.tournamentId === id)?.tournamentName || id,
      })),
    ];
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    if (tournamentFilter === AGENDA_ALL_TOURNAMENTS) return rows;
    return rows.filter((r) => r.tournamentId === tournamentFilter);
  }, [rows, tournamentFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / AGENDA_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filteredRows.slice(
    safePage * AGENDA_PAGE_SIZE,
    safePage * AGENDA_PAGE_SIZE + AGENDA_PAGE_SIZE
  );

  React.useEffect(() => {
    setPage(0);
  }, [tournamentFilter, rows.length]);

  const openTournamentAtFixture = React.useCallback(
    (row: AgendaRow) => {
      const focus = agendaFixtureFocusFromRow(row);
      setSelectedTournamentId(row.tournamentId, {
        competitionId: focus.competitionId,
        stageId: focus.stageId,
        roundKey: focus.roundKey,
      });
    },
    [setSelectedTournamentId]
  );

  if (selectedTournamentId) {
    return (
      <TournamentDetail
        id={selectedTournamentId}
        initialFixtureFocus={routeFocus}
        onBack={() => setSelectedTournamentId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-text-primary">Agenda</h1>
        <p className="mt-1 text-sm text-text-muted">
          Próximos partidos por competencia activa. Con fecha primero; el resto por fecha del campeonato.
        </p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <FilterDropdown
            label="Torneo"
            value={tournamentFilter}
            onChange={setTournamentFilter}
            options={tournamentOptions}
            theme="dark"
            minWidthClass="min-w-[200px]"
          />
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-lg border border-border-subtle px-3 py-2 text-xs text-text-muted hover:bg-surface-2 hover:text-text-primary"
          >
            Actualizar
          </button>
        </div>
      </Card>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-text-muted">Cargando agenda…</p>
      ) : null}
      {loading && rows.length > 0 ? (
        <p className="text-xs text-text-muted">Actualizando…</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && filteredRows.length === 0 ? (
        <Card>
          <p className="text-sm text-text-muted">
            No hay próximos partidos en competencias activas. Cuando una etapa esté en juego, aparecerá acá.
          </p>
        </Card>
      ) : null}

      <div className="space-y-3">
        {pageRows.map((row) =>
          row.kind === 'organizer' ? (
            <AgendaOrganizerRow
              key={row.rowKey}
              row={row as AgendaOrganizerRowData}
              tournament={tournamentsById.get(row.tournamentId) ?? null}
              images={imagesByTournamentId.get(row.tournamentId)}
              onRefreshTournament={refreshTournament}
              onViewTournament={() => openTournamentAtFixture(row)}
            />
          ) : (
            <AgendaParticipantRow
              key={row.rowKey}
              row={row as AgendaParticipantRowData}
              images={imagesByTournamentId.get(row.tournamentId)}
              onOpen={() => openTournamentAtFixture(row)}
            />
          )
        )}
      </div>

      {filteredRows.length > AGENDA_PAGE_SIZE ? (
        <div className="flex items-center justify-between gap-3 text-sm text-text-muted">
          <span>
            Página {safePage + 1} de {pageCount} ({filteredRows.length} filas)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-border-subtle px-3 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-lg border border-border-subtle px-3 py-1 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
