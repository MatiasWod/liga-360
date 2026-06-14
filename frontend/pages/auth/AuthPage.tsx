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
  const [email, setEmail] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState(''); // Estado para la segunda contraseña
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false); // Ojito de la segunda contraseña

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
        // Validar contraseñas iguales en registro
        if (password !== confirmPassword) {
          throw new Error('Las contraseñas no coinciden');
        }

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
        await register(role, username, email, password, registrationName, participantNickname, participantDni);
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
            {onBackToPublic ? (
              <button
                type="button"
                onClick={onBackToPublic}
                aria-label="Ir a la búsqueda de torneos"
                className="flex items-center gap-3 justify-self-start rounded-lg p-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
              >
                <img src="/logoTransparent.png" alt="LIGA360" className="h-10 w-auto" />
                <span className="text-xl font-semibold tracking-wide text-text-primary">LIGA360</span>
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <img src="/logoTransparent.png" alt="LIGA360" className="h-10 w-auto" />
                <span className="text-xl font-semibold tracking-wide text-text-primary">LIGA360</span>
              </div>
            )}
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
                onClick={() => {
                  setMode('login');
                  setError(''); // Limpia errores al cambiar
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 ${mode === 'login' ? 'bg-accent-primary text-white shadow-sm shadow-black/30' : 'text-text-muted hover:bg-surface-3 hover:text-text-primary'}`}
            >
              Login
            </button>
            <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(''); // Limpia errores al cambiar
                }}
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
              {mode === 'register' && (
                  <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Email</span>
                      <input
                          className="w-full rounded-xl border border-slate-200 px-3 py-2"
                          type="email" /* Buena práctica añadir el tipo */
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          minLength={3} /* Simplificado: ya estás dentro de la condición 'register' */
                      />
                  </label>
              )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Contraseña</span>
              <div className="relative">
                <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'register' ? 6 : undefined}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                  ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                  )}
                </button>
              </div>
            </label>

            {/* Campo de confirmar contraseña: solo se muestra en modo registro */}
            {mode === 'register' && (
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Repetir contraseña</span>
                  <div className="relative">
                    <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                        aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showConfirmPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                      ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                      )}
                    </button>
                  </div>
                </label>
            )}

            {error && <p className="rounded-xl border border-danger-base/40 bg-danger-soft px-3 py-2 text-sm text-danger-base">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Procesando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </Button>
          </form>
        </div>
      </div>
  );
};