import React from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TournamentForm } from '../modules/tournament-form/components/TournamentForm';
import { TournamentDetail } from '../modules/tournaments-list/TournamentDetail';
import { TournamentsList } from '../modules/tournaments-list/TournamentsList';

type Mode = 'visualizacion' | 'creacion' | 'configuracion';

interface OrganizerTournamentsPageProps {
  organizerName: string;
}

export const OrganizerTournamentsPage: React.FC<OrganizerTournamentsPageProps> = ({ organizerName }) => {
  const [mode, setMode] = React.useState<Mode>('visualizacion');
  const [selectedTournamentId, setSelectedTournamentId] = React.useState<string | null>(null);
  const [selectedTournamentName, setSelectedTournamentName] = React.useState<string>('');
  const [feedback, setFeedback] = React.useState<string>('');

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {feedback}
        </div>
      )}

      {mode === 'visualizacion' && (
        <Card>
          {!selectedTournamentId ? (
            <TournamentsList organizerFilter={organizerName} onOpen={(id) => setSelectedTournamentId(id)} />
          ) : (
            <TournamentDetail id={selectedTournamentId} onBack={() => setSelectedTournamentId(null)} />
          )}
        </Card>
      )}

      {mode === 'creacion' && (
        <Card>
          <TournamentForm
            onCreated={({ id, name }) => {
              setSelectedTournamentId(id);
              setSelectedTournamentName(name);
              setFeedback(`Torneo "${name}" creado correctamente. Continúa en la etapa de configuración.`);
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Próxima etapa (placeholder): aquí vas a configurar equipos inscriptos, fechas, fixtures y reglas finales del torneo.
            </div>
            {selectedTournamentId && (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <TournamentDetail id={selectedTournamentId} onBack={() => setMode('visualizacion')} />
              </div>
            )}
          </div>
        </Card>
      )}

      <Button
        onClick={() => {
          setSelectedTournamentId(null);
          setSelectedTournamentName('');
          setFeedback('');
          setMode((prev) => (prev === 'visualizacion' ? 'creacion' : 'visualizacion'));
        }}
        className="fixed bottom-6 right-6 z-40 rounded-full px-7 py-4 text-base font-semibold shadow-md"
      >
        {mode === 'visualizacion' ? '+ Crear nuevo torneo' : '← Volver a torneos'}
      </Button>
    </div>
  );
};

