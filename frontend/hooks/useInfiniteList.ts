import React from 'react';

/** Tamaño de página del frontend (alineado con el default generoso del backend). */
export const INFINITE_PAGE_LIMIT = 200;

export interface InfiniteListResult<T> {
  items: T[];
  loading: boolean; // carga inicial
  loadingMore: boolean; // páginas siguientes
  error: string;
  hasMore: boolean;
  /** Colocar al final de la lista; al entrar al viewport dispara la siguiente página. */
  sentinelRef: React.RefObject<HTMLDivElement>;
  reload: () => void;
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * Scroll infinito sobre un endpoint paginado por limit/offset. Acumula páginas y detecta
 * "hay más" con `page.length === limit` (el backend mantiene el shape, sin metadata).
 * `deps` reinicia la lista (p. ej. al cambiar un filtro de servidor).
 */
export function useInfiniteList<T>(
  fetchPage: (opts: { limit: number; offset: number }) => Promise<T[]>,
  deps: React.DependencyList = [],
  limit: number = INFINITE_PAGE_LIMIT,
): InfiniteListResult<T> {
  const [items, setItems] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');
  const [hasMore, setHasMore] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const fetchPageRef = React.useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const offsetRef = React.useRef(0);
  const busyRef = React.useRef(false);
  const hasMoreRef = React.useRef(false);

  const reload = React.useCallback(async () => {
    busyRef.current = true;
    setLoading(true);
    setError('');
    try {
      const page = await fetchPageRef.current({ limit, offset: 0 });
      setItems(page);
      offsetRef.current = page.length;
      const more = page.length >= limit;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  }, [limit]);

  const loadMore = React.useCallback(async () => {
    if (busyRef.current || !hasMoreRef.current) return;
    busyRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPageRef.current({ limit, offset: offsetRef.current });
      setItems((prev) => [...prev, ...page]);
      offsetRef.current += page.length;
      const more = page.length >= limit;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar más');
    } finally {
      setLoadingMore(false);
      busyRef.current = false;
    }
  }, [limit]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { reload(); }, deps);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  return { items, loading, loadingMore, error, hasMore, sentinelRef, reload, setItems };
}
