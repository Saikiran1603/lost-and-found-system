import { useEffect, useState } from 'react';
import { api, errMsg } from './api';
import type { Category, User } from './types';

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    fn()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errMsg(e)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

export function useDebounced<T>(value: T, ms = 350) {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return d;
}

export function useLookups() {
  const { data, loading, reload } = useLoad(async () => {
    const [c, u] = await Promise.all([api.get<Category[]>('/categories'), api.get<User[]>('/users')]);
    return { cats: c.data, users: u.data };
  });
  const cats = data?.cats ?? [];
  const users = data?.users ?? [];
  return {
    cats, users, loading, reload,
    catName: (id: number) => cats.find((c) => c.id === id)?.name ?? '—',
    userName: (id?: number | null) => users.find((u) => u.id === id)?.name ?? '—',
  };
}
