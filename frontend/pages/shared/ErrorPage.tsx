import React from 'react';

export type ErrorPageProps = {
  code?: number | string;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Página de error a pantalla completa, con la paleta del design system (404, 500, etc). */
export const ErrorPage: React.FC<ErrorPageProps> = ({
  code = 404,
  title = 'Página no encontrada',
  message = 'La página que buscás no existe o fue movida.',
  actionLabel = 'Volver al inicio',
  onAction,
}) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-0 px-6 text-center text-text-primary">
      <img src="/logoTransparent.png" alt="LIGA360" className="h-12 w-auto opacity-90" />
      <div className="space-y-2">
        <p className="text-7xl font-bold tracking-tight text-accent-primary">{code}</p>
        <h1 className="text-2xl font-semibold text-text-primary">{title}</h1>
        <p className="mx-auto max-w-md text-sm text-text-muted">{message}</p>
      </div>
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
};
