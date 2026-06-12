import React from 'react';

interface VerificationPendingPageProps {
  email?: string;
  onLogout: () => void;
}

export const VerificationPendingPage: React.FC<VerificationPendingPageProps> = ({ email, onLogout }) => {
  return (
    <div className="min-h-screen bg-[#F5F7F9] text-[#0F2A33]">
      <header className="border-b border-[#22512D] bg-[#163A20] px-6">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logoTransparent.png" alt="LIGA360" className="h-10 w-auto" />
            <span className="text-xl font-semibold tracking-wide text-white">LIGA360</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-[#66BB6A] bg-[#2E7D32] px-4 py-2 text-sm font-medium text-white hover:bg-[#256628]"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto mt-16 max-w-lg px-6">
        <div className="rounded-xl border border-border-subtle bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#0F2A33]">Verifica tu correo electrónico</h1>
          <p className="mt-3 text-sm text-slate-600">
            Te enviamos un enlace de verificación a <strong className="text-[#0F2A33]">{email || 'tu correo'}</strong>.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Hacé clic en el enlace del correo para activar tu cuenta y poder acceder a todas las funcionalidades.
          </p>
          <p className="mt-1 text-xs text-slate-400">El enlace expira en 24 horas.</p>

          <div className="mt-8 border-t border-border-subtle pt-6">
            <p className="text-xs text-slate-400">
              ¿No recibiste el correo? Revisá la carpeta de spam o intentá registrarte de nuevo.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
