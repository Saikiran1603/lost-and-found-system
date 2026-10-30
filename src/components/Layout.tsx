import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { Role } from '../lib/types';
import { cx } from './ui';

const L = (to: string, label: string, icon: string) => ({ to, label, icon });
const common = [L('/found', 'Found Items', '📦'), L('/search', 'Search & Matches', '🧩')];
const NAV: Record<Role, { to: string; label: string; icon: string }[]> = {
  user: [L('/dashboard', 'Dashboard', '🏠'), L('/lost', 'My Lost Reports', '🔎'), ...common, L('/claims', 'My Claims', '📝'), L('/notifications', 'Notifications', '🔔')],
  staff: [L('/dashboard', 'Dashboard', '🏠'), L('/lost', 'Lost Reports', '🔎'), ...common, L('/queue', 'Verification Queue', '✅'), L('/handovers', 'Handovers', '🤝'), L('/notifications', 'Notifications', '🔔')],
  admin: [L('/admin', 'Admin Dashboard', '📊'), L('/admin/reports', 'Reports', '📈'), L('/admin/users', 'Users', '👥'), L('/admin/categories', 'Categories', '🏷️'), L('/lost', 'Lost Reports', '🔎'), ...common, L('/queue', 'Verification Queue', '✅'), L('/handovers', 'Handovers', '🤝'), L('/notifications', 'Notifications', '🔔')],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const load = () => api.get('/notifications', { params: { userId: user!.id, read: false } }).then((r) => setUnread(r.data.length)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    window.addEventListener('lf:notif', load);
    return () => { clearInterval(t); window.removeEventListener('lf:notif', load); };
  }, [user, loc.pathname]);

  const bell = (
    <NavLink to="/notifications" aria-label={`Notifications, ${unread} unread`} className="relative rounded-lg p-2 text-lg hover:bg-slate-100 md:hidden">
      🔔{unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
    </NavLink>
  );

  return (
    <div className="min-h-screen md:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-2.5 md:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 text-xl hover:bg-slate-100">☰</button>
        <span className="font-bold text-teal-800">Lost &amp; Found</span>
        {bell}
      </header>
      {open && <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}
      <aside className={cx('fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-teal-950 text-teal-50 transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="px-5 py-5">
          <p className="text-lg font-bold">Lost &amp; Found</p>
          <p className="text-xs text-teal-300">Item recovery system</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV[user!.role].map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/admin'}
              className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium', isActive ? 'bg-teal-700 text-white' : 'text-teal-100 hover:bg-teal-900')}>
              <span aria-hidden>{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.to === '/notifications' && unread > 0 && <span className="rounded-full bg-rose-500 px-2 text-xs font-bold text-white">{unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-teal-900 p-4 text-sm">
          <p className="font-semibold">{user!.name}</p>
          <p className="mb-3 text-xs capitalize text-teal-300">{user!.role === 'staff' ? 'Staff / Verifier' : user!.role}</p>
          <button onClick={() => { logout(); navigate('/login'); }} className="w-full rounded-lg bg-teal-900 px-3 py-2 font-semibold hover:bg-teal-800">Log out</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
    </div>
  );
}
