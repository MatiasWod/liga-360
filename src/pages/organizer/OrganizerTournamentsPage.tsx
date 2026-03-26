import React from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TournamentForm } from '../../modules/tournament-form/components/TournamentForm';
import { TournamentDetail } from '../../modules/tournaments-list/TournamentDetail';
import { TournamentConfiguration } from '../../modules/tournaments-list/TournamentConfiguration';
import { TournamentsList } from '../../modules/tournaments-list/TournamentsList';

type Mode = 'visualizacion' | 'creacion' | 'configuracion' | 'edicion';

interface OrganizerTournamentsPageProps {
  organizerName: string;
}

export const OrganizerTournamentsPage: React.FC<OrganizerTournamentsPageProps> = ({ organizerName }) => {
  const [mode, setMode] = React.useState<Mode>('visualizacion');
  const [selectedTournamentId, setSelectedTournamentId] = React.useState<string | null>(null);
  const [selectedTournamentName, setSelectedTournamentName] = React.useState<string>('');
  const [feedback, setFeedback] = React.useState<string>('');

  const isViewing = mode === 'visualizacion';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => {
            setSelectedTournamentId(null);
            setSelectedTournamentName('');
            setFeedback('');
            setMode((prev) => (prev === 'visualizacion' ? 'creacion' : 'visualizacion'));
          }}
        >
          {isViewing ? '+ Crear nuevo torneo' : '← Volver a torneos'}
        </Button>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {feedback}
        </div>
      )}

      {mode === 'visualizacion' && (
        <Card>
          {!selectedTournamentId ? (
            <TournamentsList
              organizerFilter={organizerName}
              onOpen={(id, name) => {
                setSelectedTournamentId(id);
                setSelectedTournamentName(name || '');
              }}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('configuracion')}
                  className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628]"
                >
                  Configurar torneo
                </button>
              </div>
              <TournamentDetail id={selectedTournamentId} onBack={() => setSelectedTournamentId(null)} />
            </div>
          )}
        </Card>
      )}

      {mode === 'creacion' && (
        <Card>
          <TournamentForm
            mode="create"
            organizerName={organizerName}
            onCreated={({ id, name }) => {
              setSelectedTournamentId(id);
              setSelectedTournamentName(name);
              setFeedback(`Torneo "${name}" creado con su estructura inicial. Ahora podés terminar de configurarlo.`);
              setMode('configuracion');
            }}
          />
        </Card>
      )}

      {mode === 'configuracion' && (
        <Card>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-[#0F2A33]">Configuración del torneo</h2>
            <p className="text-sm text-slate-600">
              Torneo: <span className="font-medium">{selectedTournamentName || selectedTournamentId}</span>
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMode('edicion')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Editar estructura (etapas y competiciones)
              </button>
            </div>
            {selectedTournamentId && (
              <TournamentConfiguration tournamentId={selectedTournamentId} onBack={() => setMode('visualizacion')} />
            )}
          </div>
        </Card>
      )}

      {mode === 'edicion' && selectedTournamentId && (
        <Card>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-[#0F2A33]">Editar estructura del torneo</h2>
            <p className="text-sm text-slate-600">
              Torneo: <span className="font-medium">{selectedTournamentName || selectedTournamentId}</span>
            </p>
            <TournamentForm
              organizerName={organizerName}
              mode="edit"
              tournamentId={selectedTournamentId}
              onUpdated={({ id, name }) => {
                setSelectedTournamentId(id);
                setSelectedTournamentName(name);
                setFeedback(`Estructura de "${name}" actualizada correctamente.`);
                setMode('configuracion');
              }}
            />
          </div>
        </Card>
      )}
    </div>
  );
};

