import React from 'react';

/**
 * Syncs a tournament detail "selectedId" with the URL as a sub-path.
 * e.g. /torneos/t-123-abc
 */
export function useTournamentRoute(navId: string): [string | null, (id: string | null) => void] {
  const [selectedId, _set] = React.useState<string | null>(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === navId && parts[1]) return decodeURIComponent(parts[1]);
    return null;
  });

  const setSelectedId = React.useCallback(
    (id: string | null) => {
      _set(id);
      const path = id ? `/${navId}/${encodeURIComponent(id)}` : `/${navId}`;
      window.history.pushState({ nav: navId, tournamentId: id }, '', path);
    },
    [navId]
  );

  React.useEffect(() => {
    function onPop(e: PopStateEvent) {
      const tid = (e.state?.tournamentId as string) ?? null;
      _set(tid);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return [selectedId, setSelectedId];
}
