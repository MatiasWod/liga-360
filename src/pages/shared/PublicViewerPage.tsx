import React from 'react';
import { Card } from '../../components/ui/Card';
import { TournamentDetail, TournamentsList } from '../../modules/tournaments-list';

interface PublicViewerPageProps {
  onGoToAuth: () => void;
}

export const PublicViewerPage: React.FC<PublicViewerPageProps> = ({ onGoToAuth }) => {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [participantType, setParticipantType] = React.useState<'all' | 'teams' | 'individuals'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

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
            <div>
              <h2 className="text-xl font-semibold text-[#0F2A33]">Torneos públicos</h2>
              <p className="mt-1 text-sm text-slate-600">
                Cualquier visitante puede consultar torneos publicados y su cronograma de partidos.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="w-full md:max-w-xl">
                <span className="mb-1 block text-sm text-slate-600">Buscar por equipo, organización o participante</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ej: Club Sur, Liga Metropolitana, participantes"
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
          </div>
        </Card>

        <Card>
          {selectedId ? (
            <TournamentDetail id={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <TournamentsList
              participantTypeFilter={participantType === 'all' ? undefined : participantType}
              searchTerm={searchTerm}
              onOpen={(id) => setSelectedId(id)}
            />
          )}
        </Card>
      </main>
    </div>
  );
};
