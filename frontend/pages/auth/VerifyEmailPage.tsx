import React from 'react';

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export const VerifyEmailPage: React.FC = () => {
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = React.useState('');

  React.useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (!token) {
        setStatus('error');
        setMessage('No se encontró el token de verificación en la URL.');
        return;
      }

      const payload = decodeTokenPayload(token);
      if (!payload || !payload.userId) {
        setStatus('error');
        setMessage('El enlace de verificación no es válido.');
        return;
      }

      try {
        const res = await fetch(`/api/auth/users/${payload.userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const json = await res.json();

        if (!res.ok) {
          setStatus('error');
          setMessage(json?.error || json?.message || 'Error al verificar el correo.');
          return;
        }

        if (json.token) {
          localStorage.setItem('liga360:token', json.token);
        }
        if (json.user) {
          localStorage.setItem('liga360:user', JSON.stringify(json.user));
        }

        setStatus('success');
        setMessage('');

        setTimeout(() => {
          window.location.href = '/';
        }, 2500);
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'Error de conexión al verificar el correo.');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F7F9] text-[#0F2A33] flex items-center justify-center">
      <div className="mx-auto max-w-md w-full px-6">
        <div className="rounded-xl border border-border-subtle bg-white p-8 text-center shadow-sm">
          {status === 'loading' && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#0F2A33]">Verificando tu correo...</h1>
              <p className="mt-3 text-sm text-slate-600">Por favor esperá mientras verificamos tu cuenta.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#0F2A33]">¡Correo verificado!</h1>
              <p className="mt-3 text-sm text-slate-600">Redirigiendo a la aplicación...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#0F2A33]">Error de verificación</h1>
              <p className="mt-3 text-sm text-red-600">{message}</p>
              <p className="mt-2 text-xs text-slate-400">
                El enlace puede haber expirado o ya fue usado. Intentá iniciar sesión o registrarte de nuevo.
              </p>
              <button
                type="button"
                onClick={() => window.location.href = '/'}
                className="mt-6 rounded-xl border border-border-subtle bg-white px-6 py-2 text-sm font-medium text-[#0F2A33] hover:bg-slate-50"
              >
                Volver al inicio
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
