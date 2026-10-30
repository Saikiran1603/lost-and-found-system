import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

interface Ctx { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<User>; logout: () => void }
const C = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(C);
const KEY = 'lf_uid';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem(KEY);
    if (!id) { setLoading(false); return; }
    api.get<User>(`/users/${id}`)
      .then((r) => (r.data.active ? setUser(r.data) : localStorage.removeItem(KEY)))
      .catch(() => localStorage.removeItem(KEY))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.get<User[]>('/users', { params: { email: email.trim().toLowerCase() } });
    const u = data.find((x) => x.password === password);
    if (!u) throw new Error('Invalid email or password.');
    if (!u.active) throw new Error('This account has been deactivated. Contact an administrator.');
    localStorage.setItem(KEY, String(u.id));
    setUser(u);
    return u;
  };
  const logout = () => { localStorage.removeItem(KEY); setUser(null); };

  return <C.Provider value={{ user, loading, login, logout }}>{children}</C.Provider>;
}
