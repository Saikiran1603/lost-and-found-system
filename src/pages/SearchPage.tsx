import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Async, Badge, Card, PageHeader, btnGhost, btnOk, btnPrimary, cx, useToast } from '../components/ui';
import { api, errMsg, log, notify, now } from '../lib/api';
import { claimable, fmtDateTime } from '../lib/constants';
import { useLoad } from '../lib/hooks';
import { suggestMatches } from '../lib/matching';
import type { FoundItem, LostReport, Match } from '../lib/types';
import { ItemList } from './Lists';

function Matches() {
  const { user } = useAuth();
  const toast = useToast();
  const staff = user!.role !== 'user';
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoad(async () => {
    const [m, l, f] = await Promise.all([
      api.get<Match[]>('/matchSuggestions', { params: { _sort: 'createdAt', _order: 'desc' } }),
      api.get<LostReport[]>('/lostReports'),
      api.get<FoundItem[]>('/foundItems'),
    ]);
    return m.data
      .map((x) => ({ m: x, lost: l.data.find((y) => y.id === x.lostId)!, found: f.data.find((y) => y.id === x.foundId)! }))
      .filter((r) => r.lost && r.found && (staff || r.lost.userId === user!.id));
  }, []);

  const scan = async () => {
    setBusy(true);
    try {
      const { data: ls } = await api.get<LostReport[]>('/lostReports', { params: staff ? {} : { userId: user!.id } });
      let n = 0;
      for (const l of ls.filter((x) => x.status === 'Open' || x.status === 'Match Found')) n += await suggestMatches('lost', l);
      toast(n ? `${n} new possible match${n > 1 ? 'es' : ''} found` : 'No new matches found');
      reload();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  const decide = async (r: NonNullable<typeof data>[number], to: 'Confirmed' | 'Rejected') => {
    try {
      await api.patch(`/matchSuggestions/${r.m.id}`, { status: to, confirmedBy: user!.id });
      await log('lost', r.lost.id, `Match with "${r.found.itemName}" ${to.toLowerCase()}`, user!.id);
      if (to === 'Confirmed') {
        if (r.lost.status === 'Open') await api.patch(`/lostReports/${r.lost.id}`, { status: 'Match Found', updatedAt: now() });
        if (r.lost.userId !== user!.id) await notify(r.lost.userId, 'match', `A match for "${r.lost.itemName}" was confirmed: "${r.found.itemName}". You can now submit a claim.`, `/items/found/${r.found.id}`);
      }
      toast(`Match ${to.toLowerCase()}`);
      reload();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Matches use category, keywords, location and a 14-day date window. A person must confirm each one.</p>
        <button className={btnGhost} onClick={scan} disabled={busy}>{busy ? 'Scanning…' : 'Find new matches'}</button>
      </div>
      <Async loading={loading} error={error} onRetry={reload} empty={!data?.length} emptyTitle="No possible matches yet" emptyText="When a found item resembles a lost report, it appears here.">
        <div className="grid gap-4 lg:grid-cols-2">
          {data?.map((r) => (
            <Card key={r.m.id}>
              <div className="mb-3 flex items-center justify-between">
                <span className={cx('rounded-full px-3 py-1 text-sm font-bold', r.m.score >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>{r.m.score}% match</span>
                <Badge s={r.m.status} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-sky-50 p-3"><p className="text-xs font-semibold text-sky-800">Lost</p><Link className="font-semibold hover:underline" to={`/items/lost/${r.lost.id}`}>{r.lost.itemName}</Link><p className="text-xs text-slate-600">{r.lost.lastSeenLocation}</p></div>
                <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-800">Found</p><Link className="font-semibold hover:underline" to={`/items/found/${r.found.id}`}>{r.found.itemName}</Link><p className="text-xs text-slate-600">{r.found.foundLocation}</p></div>
              </div>
              <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-slate-600">{r.m.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="mt-2 text-xs text-slate-400">Suggested {fmtDateTime(r.m.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.m.status === 'Suggested' && (<><button className={btnOk} onClick={() => decide(r, 'Confirmed')}>Confirm match</button><button className={btnGhost} onClick={() => decide(r, 'Rejected')}>Not a match</button></>)}
                {r.m.status === 'Confirmed' && r.lost.userId === user!.id && claimable(r.found.status) && <Link className={btnPrimary} to={`/claims/new?foundId=${r.found.id}&lostId=${r.lost.id}`}>Submit claim</Link>}
              </div>
            </Card>
          ))}
        </div>
      </Async>
    </>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const tab = params.get('tab') ?? 'found';
  const tabs = [['found', 'Found items'], ['lost', user!.role === 'user' ? 'My lost reports' : 'Lost reports'], ['matches', 'Possible matches']];
  return (
    <>
      <PageHeader title="Search & possible matches" sub="Search by name, category, location and date, or review suggested matches." />
      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}
            className={cx('whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold', tab === k ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800')}>{label}</button>
        ))}
      </div>
      {tab === 'matches' ? <Matches /> : <ItemList key={tab} kind={tab === 'lost' ? 'lost' : 'found'} embedded />}
    </>
  );
}
