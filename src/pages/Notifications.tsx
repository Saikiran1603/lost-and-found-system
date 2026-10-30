import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Async, PageHeader, btnGhost, cx, useToast } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { fmtDateTime } from '../lib/constants';
import { useLoad } from '../lib/hooks';
import type { Notification } from '../lib/types';

const ICON: Record<string, string> = { match: '🧩', 'claim-update': '📝', 'info-request': '❓', handover: '🤝', status: '🔄' };

export default function Notifications() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, error, reload } = useLoad(async () =>
    (await api.get<Notification[]>('/notifications', { params: { userId: user!.id, ...(unreadOnly ? { read: false } : {}), _sort: 'createdAt', _order: 'desc' } })).data, [unreadOnly]);

  const refresh = () => { window.dispatchEvent(new Event('lf:notif')); reload(); };
  const open = async (n: Notification) => {
    try {
      if (!n.read) await api.patch(`/notifications/${n.id}`, { read: true });
      window.dispatchEvent(new Event('lf:notif'));
      if (n.link) nav(n.link); else reload();
    } catch (e) { toast(errMsg(e), 'error'); }
  };
  const readAll = async () => {
    try { await Promise.all((data ?? []).filter((n) => !n.read).map((n) => api.patch(`/notifications/${n.id}`, { read: true }))); toast('All marked as read'); refresh(); }
    catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <>
      <PageHeader title="Notifications" sub="Match suggestions, claim updates, information requests and handovers.">
        <button className={btnGhost} onClick={() => setUnreadOnly(!unreadOnly)}>{unreadOnly ? 'Show all' : 'Unread only'}</button>
        <button className={btnGhost} onClick={readAll}>Mark all as read</button>
      </PageHeader>
      <Async loading={loading} error={error} onRetry={reload} empty={!data?.length} emptyTitle="You're all caught up" emptyText="New updates will appear here.">
        <ul className="space-y-2">
          {data?.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className={cx('flex w-full items-start gap-3 rounded-xl border p-4 text-left shadow-sm transition hover:border-teal-600', n.read ? 'border-slate-200 bg-white' : 'border-teal-200 bg-teal-50')}>
                <span className="text-xl" aria-hidden>{ICON[n.type] ?? '🔔'}</span>
                <span className="min-w-0 flex-1"><span className={cx('block break-words text-sm', !n.read && 'font-semibold')}>{n.message}</span><span className="text-xs text-slate-500">{fmtDateTime(n.createdAt)}</span></span>
                {!n.read && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-teal-600" aria-label="Unread" />}
              </button>
            </li>
          ))}
        </ul>
      </Async>
    </>
  );
}
