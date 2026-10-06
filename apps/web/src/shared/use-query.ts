import { useEffect, useState } from 'react';
import { useErp } from '../app/erp-provider';

export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: T };
export function useQuery<T>(load: () => Promise<T>): QueryState<T> {
  const { revision } = useErp();
  return useApiQuery(load, revision);
}

export function useApiQuery<T>(
  load: () => Promise<T>,
  revision = 0,
): QueryState<T> {
  const [result, setResult] = useState<{
    load: typeof load;
    revision: number;
    state: QueryState<T>;
  } | null>(null);
  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active)
          setResult({ load, revision, state: { status: 'success', data } });
      },
      (error: unknown) => {
        if (active)
          setResult({ load, revision, state: { status: 'error', error } });
      },
    );
    return () => {
      active = false;
    };
  }, [load, revision]);
  return result?.load === load && result.revision === revision
    ? result.state
    : { status: 'loading' };
}
