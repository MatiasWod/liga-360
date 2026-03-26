import React from 'react';
import { Button } from '../../components/ui/Button';
import { login, register } from '../../services/teamsApi';

interface AuthPageProps {
  onAuthenticated: () => void;
}

type Mode = 'login' | 'register';
type RegisterRole = 'team' | 'participant' | 'organizer';

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthenticated }) => {
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
        await register(role, username, password, registrationName);
      }
      onAuthenticated();
    } catch (err: any) {
      setError(err?.message || 'Error de autenticacion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7F9] p-6">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-md">
        <h1 className="text-2xl font-semibold text-[#0F2A33]">LIGA360</h1>
        <p className="mt-1 text-sm text-slate-600">Inicia sesion o registrate para usar el flujo completo.</p>

        <div className="mt-5 inline-flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === 'login' ? 'bg-white text-[#0F2A33] shadow-sm' : 'text-slate-600'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === 'register' ? 'bg-white text-[#0F2A33] shadow-sm' : 'text-slate-600'}`}
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
                    className={`rounded-xl border px-3 py-2 text-sm ${role === r ? 'border-[#66BB6A] bg-[#EAF7EB] text-[#2E7D32]' : 'border-slate-200 text-slate-600'}`}
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
            />
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Procesando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </Button>
        </form>
      </div>
    </div>
  );
};

