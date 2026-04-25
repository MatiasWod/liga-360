import React from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TournamentForm } from '../../modules/tournament-form';
import { TournamentConfiguration, TournamentDetail, TournamentsList } from '../../modules/tournaments-list';

type Mode = 'visualizacion' | 'creacion' | 'configuracion' | 'edicion';

interface OrganizerTournamentsPageProps {
  organizerName: string;
}

export const OrganizerTournamentsPage: React.FC<OrganizerTournamentsPageProps> = ({ organizerName }) => {
  const [mode, setMode] = React.useState<Mode>('visualizacion');
  const [scope, setScope] = React.useState<'mios' | 'publicos'>('mios');
  const [searchTerm, setSearchTerm] = React.useState('');
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
          <div className="mb-4 space-y-3">
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedTournamentId(null);
                  setScope('mios');
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${scope === 'mios' ? 'bg-[#2E7D32] text-white' : 'text-slate-600'}`}
              >
                Mis torneos
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTournamentId(null);
                  setScope('publicos');
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${scope === 'publicos' ? 'bg-[#2E7D32] text-white' : 'text-slate-600'}`}
              >
                Públicos
              </button>
            </div>

            <label className="block md:max-w-xl">
              <span className="mb-1 block text-sm text-slate-600">Buscar torneos, organización, participantes o etapas</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ej: Apertura, Playoffs"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          {!selectedTournamentId ? (
            <TournamentsList
              organizerFilter={scope === 'mios' ? organizerName : undefined}
              inscriptionModeFilter={scope === 'publicos' ? 'public' : undefined}
              searchTerm={searchTerm}
              onOpen={(id, name) => {
                setSelectedTournamentId(id);
                setSelectedTournamentName(name || '');
              }}
            />
          ) : (
            <div className="space-y-3">
              {scope === 'mios' ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMode('configuracion')}
                    className="rounded-xl bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628]"
                  >
                    Configurar torneo
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Vista pública en modo solo lectura.
                </div>
              )}
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
                className="rounded-xl border border-border-subtle bg-surface-1 px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-2"
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

