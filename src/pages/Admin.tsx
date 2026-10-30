import { Link } from 'react-router-dom';
import { Async, Card, PageHeader, Stat, btnGhost, btnPrimary } from '../components/ui';
import { api } from '../lib/api';
import { CLAIM_STATUSES, FOUND_STATUSES, LOST_STATUSES, fmtDate, fmtDateTime } from '../lib/constants';
import { useLoad, useLookups } from '../lib/hooks';
import type { Activity, Claim, FoundItem, Handover, LostReport } from '../lib/types';
import { Badge } from '../components/ui';

async function loadAll() {
  const [l, f, c, h, a] = await Promise.all([
    api.get<LostReport[]>('/lostReports'), api.get<FoundItem[]>('/foundItems'), api.get<Claim[]>('/claims'),
    api.get<Handover[]>('/handovers'), api.get<Activity[]>('/activityLogs', { params: { _sort: 'createdAt', _order: 'desc', _limit: 10 } }),
  ]);
  return { lost: l.data, found: f.data, claims: c.data, handovers: h.data, activity: a.data };
}

export function AdminDashboard() {
  const lk = useLookups();
  const { data, loading, error, reload } = useLoad(loadAll);
  const open = (s: string) => s === 'Submitted' || s === 'Under Review' || s === 'More Information Required';
  return (
    <>
      <PageHeader title="Admin dashboard" sub="A live view of reports, claims and handovers.">
        <Link to="/admin/reports" className={btnGhost}>View reports</Link>
        <Link to="/queue" className={btnPrimary}>Verification queue</Link>
      </PageHeader>
      <Async loading={loading} error={error} onRetry={reload}>
        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Stat label="Total lost reports" value={data.lost.length} tone="sky" />
              <Stat label="Total found items" value={data.found.length} tone="amber" />
              <Stat label="Open claims" value={data.claims.filter((c) => open(c.status)).length} tone="violet" />
              <Stat label="Pending verification" value={data.claims.filter((c) => c.status === 'Submitted' || c.status === 'Under Review').length} tone="rose" />
              <Stat label="Approved claims" value={data.claims.filter((c) => c.status === 'Approved').length} tone="emerald" />
              <Stat label="Completed handovers" value={data.handovers.filter((h) => h.status === 'Handed Over' || h.status === 'Closed').length} />
            </div>
            <Card className="mt-6">
              <h2 className="mb-4 font-semibold">Recent activity</h2>
              {data.activity.length === 0 ? <p className="text-sm text-slate-500">No activity yet.</p> : (
                <ul className="divide-y divide-slate-100">
                  {data.activity.map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 py-2 text-sm sm:flex-row sm:justify-between">
                      <span><b className="capitalize">{a.entityType} #{a.entityId}</b> · {a.action}{a.note ? ` — ${a.note}` : ''}</span>
                      <span className="text-xs text-slate-500">{lk.userName(a.actorId)} · {fmtDateTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </Async>
    </>
  );
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-2 text-sm sm:grid-cols-[11rem_1fr_2rem]">
          <span className="truncate text-slate-600" title={r.label}>{r.label}</span>
          <span className="h-3 rounded-full bg-slate-100"><span className="block h-3 rounded-full bg-teal-600" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="text-right font-semibold">{r.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function Reports() {
  const lk = useLookups();
  const { data, loading, error, reload } = useLoad(loadAll);
  const count = <T,>(arr: T[], fn: (x: T) => string, keys: readonly string[]) => keys.map((k) => ({ label: k, value: arr.filter((x) => fn(x) === k).length }));
  return (
    <>
      <PageHeader title="Reports" sub="Summaries across items, claims, categories and handovers." />
      <Async loading={loading || lk.loading} error={error} onRetry={reload}>
        {data && (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card><h2 className="mb-3 font-semibold">Lost reports by status ({data.lost.length})</h2><Bars rows={count(data.lost, (x) => x.status, LOST_STATUSES)} /></Card>
              <Card><h2 className="mb-3 font-semibold">Found items by status ({data.found.length})</h2><Bars rows={count(data.found, (x) => x.status, FOUND_STATUSES)} /></Card>
            </div>
            <Card><h2 className="mb-3 font-semibold">Claim status summary ({data.claims.length})</h2><Bars rows={count(data.claims, (x) => x.status, CLAIM_STATUSES)} /></Card>
            <Card>
              <h2 className="mb-3 font-semibold">Category-wise report</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead><tr className="border-b text-slate-500"><th className="py-2">Category</th><th>Lost</th><th>Found</th><th>Claims</th></tr></thead>
                  <tbody>
                    {lk.cats.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="py-2 font-medium">{c.name}</td>
                        <td>{data.lost.filter((x) => x.categoryId === c.id).length}</td>
                        <td>{data.found.filter((x) => x.categoryId === c.id).length}</td>
                        <td>{data.claims.filter((x) => data.found.find((f) => f.id === x.foundId)?.categoryId === c.id).length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <h2 className="mb-3 font-semibold">Handover history</h2>
              {data.handovers.length === 0 ? <p className="text-sm text-slate-500">No handovers recorded yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead><tr className="border-b text-slate-500"><th className="py-2">Item</th><th>Claimant</th><th>Verifier</th><th>Handover date</th><th>Status</th></tr></thead>
                    <tbody>
                      {[...data.handovers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((h) => (
                        <tr key={h.id} className="border-b border-slate-100">
                          <td className="py-2 font-medium">{data.found.find((f) => f.id === h.foundId)?.itemName ?? `#${h.foundId}`}</td>
                          <td>{lk.userName(h.claimantId)}</td><td>{h.verifierId ? lk.userName(h.verifierId) : '—'}</td><td>{fmtDate(h.handoverDate)}</td><td><Badge s={h.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
