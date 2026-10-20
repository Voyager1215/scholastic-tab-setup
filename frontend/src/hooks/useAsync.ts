import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Small data-loading helper: runs an async function whenever the
 * dependencies change and keeps the loading/error state.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    setLoading(true);
    setError(null);

    fn()
      .then((value) => {
        if (!active.current) return;
        setData(value);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active.current) return;
        setError(cause instanceof Error ? cause.message : 'Something went wrong.');
        setLoading(false);
      });

    return () => {
      active.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading, reload };
}
