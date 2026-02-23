import React from 'react';
import { Card } from '../components/ui/Card';
import { TournamentDetail } from '../modules/tournaments-list/TournamentDetail';
import { TournamentsList } from '../modules/tournaments-list/TournamentsList';

interface TeamTournamentsPageProps {
  activeTeamId?: string | null;
}

export const TeamTournamentsPage: React.FC<TeamTournamentsPageProps> = ({ activeTeamId }) => {
  const [tab, setTab] = React.useState<'publicos' | 'participando'>('publicos');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F2A33]">Torneos</h1>
            <p className="mt-1 text-sm text-slate-600">
              Explora torneos públicos y los torneos donde participa tu equipo.
            </p>
          </div>
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setTab('publicos');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === 'publicos' ? 'bg-[#2E7D32] text-white' : 'text-slate-600'}`}
            >
              Publicos
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setTab('participando');
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${tab === 'participando' ? 'bg-[#2E7D32] text-white' : 'text-slate-600'}`}
            >
              Mi equipo participa
            </button>
          </div>
        </div>
      </Card>

      <Card>
        {tab === 'publicos' && (
          !selectedId ? (
            <TournamentsList onOpen={(id) => setSelectedId(id)} />
          ) : (
            <TournamentDetail id={selectedId} onBack={() => setSelectedId(null)} />
          )
        )}

        {tab === 'participando' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Mostraremos aqui los torneos en los que participa el equipo activo.
              {activeTeamId ? ` Equipo activo: #${activeTeamId}.` : ''}
            </p>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta vista queda lista para conectarse al modulo de inscripciones (A4) y mostrar participaciones reales.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

