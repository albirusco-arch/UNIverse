import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

import { subscribe } from '@/data/api';

type QueryState<T> = {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refresh: () => void;
};

/**
 * Minimal async data hook: runs `fetcher` when `deps` change and again whenever
 * the data layer reports a change (after a post, like, save…).
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: DependencyList): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  const requestId = useRef(0);

  // Declared first so the latest fetcher is in place before the fetch effect runs.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Stale-while-revalidate: previous data stays visible while a refresh runs.
  const run = useCallback(() => {
    const id = ++requestId.current;
    fetcherRef
      .current()
      .then((result) => {
        if (id !== requestId.current) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);
  useEffect(() => subscribe(run), [run]);

  return { data, error, loading, refresh: run };
}
