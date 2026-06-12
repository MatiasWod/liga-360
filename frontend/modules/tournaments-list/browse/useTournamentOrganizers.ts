import React from 'react';
import { listTournamentsGraphql } from '../../../services/tournamentsApi';
import type { TournamentEntity } from '../types';
import { buildOrganizersIndex, type OrganizerIndexEntry } from './organizersIndex';

export function useTournamentOrganizers(enabled = true): {
  organizers: OrganizerIndexEntry[];
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [organizers, setOrganizers] = React.useState<OrganizerIndexEntry[]>([]);
  const [loading, setLoading] = React.useState(enabled);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    listTournamentsGraphql()
      .then((rows) => {
        if (cancelled) return;
        setOrganizers(buildOrganizersIndex(rows as TournamentEntity[]));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se pudieron cargar organizadores');
        setOrganizers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  const reload = React.useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return { organizers, loading, error, reload };
}
