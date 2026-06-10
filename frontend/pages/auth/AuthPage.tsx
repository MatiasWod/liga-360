import React from 'react';
import { Button } from '../../components/ui/Button';
import { login, register } from '../../services/teamsApi';

const SPORTS_BACKGROUNDS = [
  'https://images.pexels.com/photos/114296/pexels-photo-114296.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/186076/pexels-photo-186076.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'https://images.pexels.com/photos/248547/pexels-photo-248547.jpeg?auto=compress&cs=tinysrgb&w=1600',
];

interface AuthPageProps {
  onAuthenticated: () => void;
  onBackToPublic?: () => void;
}

type Mode = 'login' | 'register';
type RegisterRole = 'team' | 'participant' | 'organizer';

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated, onBackToPublic }) => {
  const [mode, setMode] = React.useState<Mode>('login');
  const [role, setRole] = React.useState<RegisterRole>('team');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [teamName, setTeamName] = React.useState('');
  const [organizerName, setOrganizerName] = React.useState('');
  const [participantFirstName, setParticipantFirstName] = React.useState('');
  const [participantLastName, setParticipantLastName] = React.useState('');
  const [participantNickname, setParticipantNickname] = React.useState('');
  const [participantDni, setParticipantDni] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [backgroundIndex, setBackgroundIndex] = React.useState(0);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setBackgroundIndex((prev) => (prev + 1) % SPORTS_BACKGROUNDS.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        const registrationName =
          role === 'team'
            ? teamName
            : role === 'organizer'
              ? organizerName
              : `${participantFirstName} ${participantLastName}`.trim();
        if (!registrationName.trim()) {
          throw new Error('Completa los datos obligatorios para el rol seleccionado');
        }
        if (role === 'participant' && participantDni.trim() && !/^\d{7,8}$/.test(participantDni.replace(/\D/g, ''))) {
          throw new Error('El DNI del participante debe tener 7 u 8 digitos');
        }
        const participantExtras =
          role === 'participant'
            ? {
                firstName: participantFirstName.trim(),
                lastName: participantLastName.trim(),
                nickname: participantNickname.trim() || undefined,
                dni: participantDni.replace(/\D/g, '') || undefined,
              }
            : undefined;
        await register(role, username, password, registrationName, participantExtras);
      }
      onAuthenticated();
    } catch (err: any) {
      setError(err?.message || 'Error de autenticacion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {SPORTS_BACKGROUNDS.map((imageUrl, index) => {
        const isActive = index === backgroundIndex;
        return (
          <div
            key={imageUrl}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${isActive ? 'opacity-100' : 'opacity-0'}`}
            style={{ backgroundImage: `url(${imageUrl})`, transform: isActive ? 'scale(1.01)' : 'scale(1)' }}
            aria-hidden="true"
          />
        );
      })}
      <div className="absolute inset-0 bg-surface-0/80" aria-hidden="true" />

      <header className="relative border-b border-border-subtle bg-surface-1/90 backdrop-blur-sm px-6">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[240px_minmax(0,1fr)_240px] items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/logoTransparent.png" alt="LIGA360" className="h-10 w-auto" />
            <span className="text-xl font-semibold tracking-wide text-text-primary">LIGA360</span>
          </div>
          <div aria-hidden="true" />
          <div className="flex items-center justify-self-end gap-2">
            {onBackToPublic && (
              <button
                type="button"
                onClick={onBackToPublic}
                className="rounded-xl bg-accent-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
              >
                Volver a Torneos públicos
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="relative mx-auto mt-6 max-w-xl rounded-xl border border-border-subtle bg-surface-1/95 p-6 text-text-primary shadow-2xl shadow-black/40 backdrop-blur-md">
        <p className="text-sm text-text-muted">Inicia sesion o registrate para usar el flujo completo.</p>

        <div className="mt-5 inline-flex rounded-xl border border-border-subtle bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 ${mode === 'login' ? 'bg-accent-primary text-white shadow-sm shadow-black/30' : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 ${mode === 'register' ? 'bg-accent-primary text-white shadow-sm shadow-black/30' : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'}`}
          >
            Registro
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {(['team', 'participant', 'organizer'] as RegisterRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 ${role === r ? 'border-accent-primary bg-accent-primary text-white shadow-sm shadow-black/30' : 'border-border-subtle bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text-primary'}`}
                  >
                    {r === 'team' ? 'Equipo' : r === 'participant' ? 'Participante' : 'Organizador'}
                  </button>
                ))}
              </div>
              {role === 'team' && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Nombre del equipo</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                  />
                </label>
              )}

              {role === 'organizer' && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Nombre de la organizacion</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    required
                  />
                </label>
              )}

              {role === 'participant' && (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Nombre</span>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        value={participantFirstName}
                        onChange={(e) => setParticipantFirstName(e.target.value)}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Apellido</span>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        value={participantLastName}
                        onChange={(e) => setParticipantLastName(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Apodo (opcional)</span>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        value={participantNickname}
                        onChange={(e) => setParticipantNickname(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">DNI (opcional)</span>
                      <input
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        value={participantDni}
                        onChange={(e) => setParticipantDni(e.target.value)}
                      />
                    </label>
                  </div>
                </>
              )}
            </>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Usuario</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={mode === 'register' ? 3 : undefined}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Contrasena</span>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 6 : undefined}
            />
          </label>

          {error && <p className="rounded-xl border border-danger-base/40 bg-danger-soft px-3 py-2 text-sm text-danger-base">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Procesando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </Button>
        </form>
      </div>
    </div>
  );
};

