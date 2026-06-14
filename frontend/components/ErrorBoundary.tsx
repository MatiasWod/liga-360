import React from 'react';
import { ErrorPage } from '../pages/shared/ErrorPage';

type ErrorBoundaryState = { hasError: boolean };

/** Captura errores de render no controlados y muestra una página de error con la paleta del sitio. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorPage
          code={500}
          title="Algo salió mal"
          message="Ocurrió un error inesperado. Probá recargar la página."
          actionLabel="Recargar"
          onAction={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
