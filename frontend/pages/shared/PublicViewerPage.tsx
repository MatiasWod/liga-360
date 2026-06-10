import React from 'react';
import { Card } from '../../components/ui/Card';
import { TournamentDetail, TournamentsList } from '../../modules/tournaments-list';
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
    ? 'rounded-xl px-4 py-2 text-sm font-medium bg-[#2E7D32] text-white hover:bg-[#256628] hover:text-white'
    : 'rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-[#0F2A33]';
}

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

  function switchTab(next: PublicTournamentTab) {
    setSelectedId(null);
    setSelectedSeries(null);
    setOpenEditionAsHistory(false);
    setTab(next);
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
    <div className="min-h-screen bg-[#F5F7F9] text-[#0F2A33]">
      <header className="border-b border-[#22512D] bg-[#163A20] px-6">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[240px_minmax(0,1fr)_240px] items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/logoTransparent.png" alt="LIGA360" className="h-10 w-auto" />
            <span className="text-xl font-semibold tracking-wide text-white">LIGA360</span>
          </div>
          <div aria-hidden="true" />
          <button
            type="button"
            onClick={onGoToAuth}
            className="justify-self-end rounded-xl border border-[#66BB6A] bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628]"
          >
            Iniciar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-4 px-6 py-6">
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#0F2A33]">Torneos públicos</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Consultá torneos en curso, finalizados o el histórico agregado por competición.
                </p>
              </div>
              <div className="inline-flex rounded-xl bg-slate-100 p-1">
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
                  <span className="mb-1 block text-sm text-slate-600">Buscar por equipo, organización o participante</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ej: Club Sur, Liga Metropolitana, Mundial Qatar"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>

                <label className="w-full md:w-64">
                  <span className="mb-1 block text-sm text-slate-600">Tipo de torneo</span>
                  <select
                    value={participantType}
                    onChange={(e) => {
                      setSelectedId(null);
                      setParticipantType(e.target.value as 'all' | 'teams' | 'individuals');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
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
              onOpen={(seriesId) => {
                const found = seriesList.find((s) => s.id === seriesId) ?? null;
                setSelectedSeries(found);
              }}
            />
          ) : (
            <TournamentsList
              participantTypeFilter={participantType === 'all' ? undefined : participantType}
              searchTerm={searchTerm}
              onOpen={(id) => setSelectedId(id)}
              hideFinished={tab === 'activos'}
              onlyFinished={tab === 'finalizados'}
            />
          )}
        </Card>
      </main>
    </div>
  );
};
