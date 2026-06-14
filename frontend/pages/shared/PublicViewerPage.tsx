import React from 'react';
import { Card } from '../../components/ui/Card';
import { TournamentDetail, TournamentsList } from '../../modules/tournaments-list';
import { TournamentsBrowseLayout } from '../../modules/tournaments-list/browse/TournamentsBrowseLayout';
import { useTournamentOrganizers } from '../../modules/tournaments-list/browse/useTournamentOrganizers';
import { SeriesHistoryPage } from '../../modules/tournaments-list/series/SeriesHistoryPage';
import { SeriesList } from '../../modules/tournaments-list/series/SeriesList';
import { listCompetitionSeries, type CompetitionSeries } from '../../services/tournaments/series';
import { useTournamentRoute } from '../../hooks/useTournamentRoute';

interface PublicViewerPageProps {
  onGoToAuth: () => void;
}

type PublicTournamentTab = 'activos' | 'finalizados' | 'historico';

function tabPillClass(active: boolean): string {
  return active
    ? 'rounded-xl px-4 py-2 text-sm font-medium bg-accent-primary text-white shadow-sm shadow-black/30'
    : 'rounded-xl px-4 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary';
}

const fieldClass =
  'w-full rounded-xl border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary/40';

export const PublicViewerPage: React.FC<PublicViewerPageProps> = ({ onGoToAuth }) => {
  const [selectedId, setSelectedId] = useTournamentRoute('torneos');
  const [tab, setTab] = React.useState<PublicTournamentTab>('activos');
  const [participantType, setParticipantType] = React.useState<'all' | 'teams' | 'individuals'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [seriesList, setSeriesList] = React.useState<CompetitionSeries[]>([]);
  const [seriesLoading, setSeriesLoading] = React.useState(false);
  const [seriesError, setSeriesError] = React.useState('');
  const [selectedSeries, setSelectedSeries] = React.useState<CompetitionSeries | null>(null);
  const [openEditionAsHistory, setOpenEditionAsHistory] = React.useState(false);
  const [selectedOrganizer, setSelectedOrganizer] = React.useState<string | null>(null);
  const { organizers, loading: organizersLoading, error: organizersError } = useTournamentOrganizers();

  function switchTab(next: PublicTournamentTab) {
    setSelectedId(null);
    setSelectedSeries(null);
    setOpenEditionAsHistory(false);
    setTab(next);
  }

  // Logo/título → volver a la vista de búsqueda (limpia selección y filtros).
  function goToSearch() {
    setSelectedId(null);
    setSelectedSeries(null);
    setOpenEditionAsHistory(false);
    setSelectedOrganizer(null);
    setTab('activos');
    setSearchTerm('');
    window.scrollTo({ top: 0 });
  }

  function handleSelectOrganizer(organizer: string | null) {
    setSelectedOrganizer(organizer);
    setSelectedId(null);
    setSelectedSeries(null);
    setOpenEditionAsHistory(false);
  }

  React.useEffect(() => {
    if (tab !== 'historico') return;
    let cancelled = false;
    setSeriesLoading(true);
    setSeriesError('');
    listCompetitionSeries()
      .then((rows) => {
        if (!cancelled) setSeriesList(rows);
      })
      .catch((e) => {
        if (!cancelled) setSeriesError(e instanceof Error ? e.message : 'Error al cargar series');
      })
      .finally(() => {
        if (!cancelled) setSeriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const showTournamentDetail = Boolean(selectedId);
  const showSeriesDetail = tab === 'historico' && selectedSeries && !showTournamentDetail;

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <header className="border-b border-border-subtle bg-surface-1 px-4 sm:px-6 lg:px-8">
        <div className="grid h-16 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:grid-cols-[240px_minmax(0,1fr)_240px]">
          <button
            type="button"
            onClick={goToSearch}
            aria-label="Ir a la búsqueda de torneos"
            className="flex items-center gap-3 justify-self-start rounded-lg p-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
          >
            <img src="/logoTransparent.png" alt="LIGA360" className="h-10 w-auto" />
            <span className="text-xl font-semibold tracking-wide text-text-primary">LIGA360</span>
          </button>
          <div aria-hidden="true" className="hidden lg:block" />
          <button
            type="button"
            onClick={onGoToAuth}
            className="justify-self-end rounded-xl bg-accent-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
          >
            Iniciar sesión
          </button>
        </div>
      </header>

      <main className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text-primary">Torneos públicos</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Consultá torneos en curso, finalizados o el histórico agregado por competición.
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-surface-2 p-1">
                <button type="button" onClick={() => switchTab('activos')} className={tabPillClass(tab === 'activos')}>
                  Activos
                </button>
                <button type="button" onClick={() => switchTab('finalizados')} className={tabPillClass(tab === 'finalizados')}>
                  Finalizados
                </button>
                <button type="button" onClick={() => switchTab('historico')} className={tabPillClass(tab === 'historico')}>
                  Histórico
                </button>
              </div>
            </div>

            {tab !== 'historico' ? (
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="w-full md:max-w-xl">
                  <span className="mb-1 block text-sm text-text-muted">Buscar por equipo, organización o participante</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ej: Club Sur, Liga Metropolitana, Mundial Qatar"
                    className={fieldClass}
                  />
                </label>

                <label className="w-full md:w-64">
                  <span className="mb-1 block text-sm text-text-muted">Tipo de torneo</span>
                  <select
                    value={participantType}
                    onChange={(e) => {
                      setSelectedId(null);
                      setParticipantType(e.target.value as 'all' | 'teams' | 'individuals');
                    }}
                    className={fieldClass}
                  >
                    <option value="all">Todos</option>
                    <option value="teams">Equipos</option>
                    <option value="individuals">Individuales</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <TournamentsBrowseLayout
            showPanel={!showTournamentDetail && !showSeriesDetail}
            panel={{
              organizers,
              loading: organizersLoading,
              error: organizersError,
              selectedOrganizer,
              onSelectOrganizer: handleSelectOrganizer,
              variant: 'dark',
            }}
          >
            {showTournamentDetail ? (
              <TournamentDetail
                id={selectedId!}
                onBack={() => {
                  setSelectedId(null);
                  setOpenEditionAsHistory(false);
                }}
                defaultDetailView={openEditionAsHistory || tab === 'finalizados' ? 'history' : 'fixture'}
                onViewSeries={(seriesId) => {
                  setSelectedId(null);
                  setOpenEditionAsHistory(false);
                  setTab('historico');
                  listCompetitionSeries()
                    .then((rows) => {
                      setSeriesList(rows);
                      setSelectedSeries(rows.find((s) => s.id === seriesId) ?? null);
                    })
                    .catch(() => setSelectedSeries(null));
                }}
              />
            ) : showSeriesDetail ? (
              <SeriesHistoryPage
                series={selectedSeries!}
                onBack={() => setSelectedSeries(null)}
                onOpenEdition={(tournamentId) => {
                  setOpenEditionAsHistory(true);
                  setSelectedId(tournamentId);
                }}
              />
            ) : tab === 'historico' ? (
              <SeriesList
                series={seriesList}
                loading={seriesLoading}
                error={seriesError}
                organizerFilter={selectedOrganizer ?? undefined}
                onOpen={(seriesId) => {
                  const found = seriesList.find((s) => s.id === seriesId) ?? null;
                  setSelectedSeries(found);
                }}
              />
            ) : (
              <TournamentsList
                organizerFilter={selectedOrganizer ?? undefined}
                participantTypeFilter={participantType === 'all' ? undefined : participantType}
                searchTerm={searchTerm}
                onOpen={(id) => setSelectedId(id)}
                hideFinished={tab === 'activos'}
                onlyFinished={tab === 'finalizados'}
              />
            )}
          </TournamentsBrowseLayout>
        </Card>
      </main>
    </div>
  );
};
