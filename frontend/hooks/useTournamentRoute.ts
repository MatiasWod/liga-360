import React from 'react';

export interface TournamentRouteFocus {
  competitionId?: string | null;
  stageId?: string | null;
  /** Clave de fecha del fixture: `${round}|${leg}` */
  roundKey?: string | null;
}

function readFocusFromSearch(): TournamentRouteFocus {
  const params = new URLSearchParams(window.location.search);
  return {
    competitionId: params.get('competition') || null,
    stageId: params.get('stage') || null,
    roundKey: params.get('fecha') || null,
  };
}

function buildPath(navId: string, tournamentId: string | null, focus?: TournamentRouteFocus): string {
  const base = tournamentId ? `/${navId}/${encodeURIComponent(tournamentId)}` : `/${navId}`;
  if (!tournamentId || !focus) return base;
  const params = new URLSearchParams();
  if (focus.competitionId) params.set('competition', focus.competitionId);
  if (focus.stageId) params.set('stage', focus.stageId);
  if (focus.roundKey) params.set('fecha', focus.roundKey);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Syncs a tournament detail "selectedId" with the URL as a sub-path.
 * e.g. /agenda/t-123-abc?competition=c-1&stage=s-1&fecha=2|1
 */
export function useTournamentRoute(
  navId: string
): [string | null, (id: string | null, focus?: TournamentRouteFocus) => void, TournamentRouteFocus] {
  const [selectedId, _set] = React.useState<string | null>(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === navId && parts[1]) return decodeURIComponent(parts[1]);
    return null;
  });

  const [focus, _setFocus] = React.useState<TournamentRouteFocus>(() => readFocusFromSearch());

  const setSelectedId = React.useCallback(
    (id: string | null, nextFocus?: TournamentRouteFocus) => {
      _set(id);
      const resolvedFocus = id ? (nextFocus ?? {}) : {};
      _setFocus(resolvedFocus);
      const path = buildPath(navId, id, id ? resolvedFocus : undefined);
      window.history.pushState({ nav: navId, tournamentId: id, focus: resolvedFocus }, '', path);
    },
    [navId]
  );

  React.useEffect(() => {
    function onPop(e: PopStateEvent) {
      const tid = (e.state?.tournamentId as string) ?? null;
      _set(tid);
      _setFocus(tid ? ((e.state?.focus as TournamentRouteFocus) ?? readFocusFromSearch()) : {});
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return [selectedId, setSelectedId, focus];
}
