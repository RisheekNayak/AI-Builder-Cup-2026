'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

/** Load data, reloading when `deps` change or the workspace reports a change (payment, dispatch, task…). */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const { dataVersion } = useWorkspace();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  const key = JSON.stringify(deps);

  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    let cancelled = false;
    loadRef.current().then(value => { if (!cancelled) { setData(value); setError(null); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load data.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, dataVersion, attempt]);

  const retry = useCallback(() => { setLoading(true); setAttempt(a => a + 1); }, []);
  return { data, error, loading, retry, setData };
}
