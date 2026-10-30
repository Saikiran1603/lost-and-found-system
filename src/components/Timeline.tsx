import { api } from '../lib/api';
import { fmtDateTime } from '../lib/constants';
import { useLoad } from '../lib/hooks';
import type { Activity, User } from '../lib/types';
import { Async } from './ui';

export default function Timeline({ type, id }: { type: string; id: number }) {
  const { data, loading, error, reload } = useLoad(async () => {
    const [a, u] = await Promise.all([
      api.get<Activity[]>('/activityLogs', { params: { entityType: type, entityId: id, _sort: 'createdAt', _order: 'desc' } }),
      api.get<User[]>('/users'),
    ]);
    return a.data.map((x) => ({ ...x, actor: u.data.find((y) => y.id === x.actorId)?.name ?? 'System' }));
  }, [type, id]);
  return (
    <Async loading={loading} error={error} onRetry={reload} empty={!data?.length} emptyTitle="No activity recorded yet">
      <ol className="space-y-4 border-l-2 border-teal-100 pl-4">
        {data?.map((a) => (
          <li key={a.id} className="relative">
            <span className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-teal-600" />
            <p className="text-sm font-semibold text-slate-800">{a.action}</p>
            {a.note && <p className="text-sm text-slate-600">{a.note}</p>}
            <p className="text-xs text-slate-500">{a.actor} · {fmtDateTime(a.createdAt)}</p>
          </li>
        ))}
      </ol>
    </Async>
  );
}
