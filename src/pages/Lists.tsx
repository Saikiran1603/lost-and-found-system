import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FilterBar, emptyFilt, toParams, type Filt } from '../components/Filters';
import { Async, Badge, PageHeader, btnGhost, btnPrimary, useToast } from '../components/ui';
import { api, errMsg, log, notify, now } from '../lib/api';
import { FOUND_STATUSES, LOST_STATUSES, claimable, fmtDate } from '../lib/constants';
import { useDebounced, useLoad, useLookups } from '../lib/hooks';

const CFG = {
  lost: { ep: '/lostReports', loc: 'lastSeenLocation', date: 'lastSeenDate', statuses: LOST_STATUSES, title: 'Lost reports', base: '/lost' },
  found: { ep: '/foundItems', loc: 'foundLocation', date: 'foundDate', statuses: FOUND_STATUSES, title: 'Found items', base: '/found' },
};

export function ItemList({ kind, embedded }: { kind: 'lost' | 'found'; embedded?: boolean }) {
  const c = CFG[kind];
  const { user } = useAuth();
  const toast = useToast();
  const lk = useLookups();
  const staff = user!.role !== 'user';
  const [f, setF] = useState<Filt>(emptyFilt);
  const df = useDebounced(f);
  const badRange = !!df.from && !!df.to && df.from > df.to;

  const { data, loading, error, reload } = useLoad(async () => {
    if (badRange) return [];
    const params: Record<string, string | number> = toParams(df, c.loc, c.date);
    if (kind === 'lost' && !staff) params.userId = user!.id;
    return (await api.get<any[]>(c.ep, { params })).data;
  }, [kind, JSON.stringify(df)]);

  const owner = (i: any) => (kind === 'lost' ? i.userId : i.reportedBy);
  const canEdit = (i: any) => (kind === 'lost' ? staff || (i.userId === user!.id && i.status === 'Open') : staff || i.reportedBy === user!.id);

  const setStatus = async (i: any, status: string) => {
    try {
      await api.patch(`${c.ep}/${i.id}`, { status, updatedAt: now() });
      await log(kind, i.id, `Status changed to ${status}`, user!.id);
      if (owner(i) !== user!.id) await notify(owner(i), 'status', `Status of "${i.itemName}" is now ${status}.`, `/items/${kind}/${i.id}`);
      toast('Status updated');
      reload();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <>
      {!embedded && (
        <PageHeader title={kind === 'lost' && !staff ? 'My lost reports' : c.title} sub={kind === 'lost' && !staff ? 'Reports you have submitted.' : 'Browse, filter and manage listings.'}>
          <Link to={`${c.base}/new`} className={btnPrimary}>{kind === 'lost' ? 'Report lost item' : 'Register found item'}</Link>
        </PageHeader>
      )}
      <FilterBar f={f} set={setF} cats={lk.cats} statuses={c.statuses} />
      <Async loading={loading} error={error} onRetry={reload} empty={!data?.length} emptyTitle="No items match your filters"
        emptyText={kind === 'lost' ? 'Try clearing filters, or report a lost item.' : 'Try clearing filters, or register a found item.'}
        emptyAction={<Link to={`${c.base}/new`} className={btnPrimary}>{kind === 'lost' ? 'Report lost item' : 'Register found item'}</Link>}>
        <p className="mb-3 text-sm text-slate-500">{data?.length} result{data?.length === 1 ? '' : 's'}</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data?.map((i) => (
            <article key={i.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {i.image ? <img src={i.image} alt={i.itemName} className="h-40 w-full object-cover" /> : <div className="flex h-40 items-center justify-center bg-slate-100 text-4xl" aria-hidden>{kind === 'lost' ? '🔎' : '📦'}</div>}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="break-words font-semibold text-slate-900">{i.itemName}</h3>
                  <Badge s={i.status} />
                </div>
                <p className="text-xs font-medium text-teal-800">{lk.catName(i.categoryId)}</p>
                <p className="line-clamp-2 text-sm text-slate-600">{i.description}</p>
                <p className="text-xs text-slate-500">📍 {i[c.loc]} &nbsp; 📅 {fmtDate(i[c.date])}</p>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <Link to={`/items/${kind}/${i.id}`} className={btnGhost}>View</Link>
                  {canEdit(i) && <Link to={`${c.base}/${i.id}/edit`} className={btnGhost}>Edit</Link>}
                  {kind === 'found' && claimable(i.status) && i.reportedBy !== user!.id && !staff && <Link to={`/claims/new?foundId=${i.id}`} className={btnPrimary}>Claim</Link>}
                  {kind === 'lost' && !staff && i.userId === user!.id && i.status === 'Open' && <button className={btnGhost} onClick={() => setStatus(i, 'Closed')}>Close</button>}
                  {staff && (
                    <select aria-label="Change status" value={i.status} onChange={(e) => setStatus(i, e.target.value)} className="ml-auto rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                      {c.statuses.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Async>
    </>
  );
}

export const LostList = () => <ItemList kind="lost" />;
export const FoundList = () => <ItemList kind="found" />;
