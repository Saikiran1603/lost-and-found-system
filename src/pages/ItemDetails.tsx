import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Timeline from '../components/Timeline';
import { Async, Badge, Card, PageHeader, btnGhost, btnPrimary } from '../components/ui';
import { api } from '../lib/api';
import { claimable, fmtDate } from '../lib/constants';
import { useLoad, useLookups } from '../lib/hooks';
import type { Claim, FoundItem, LostReport, Match } from '../lib/types';

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-2 text-sm last:border-0">
    <dt className="text-slate-500">{k}</dt><dd className="col-span-2 break-words font-medium text-slate-800">{v}</dd>
  </div>
);

export default function ItemDetails() {
  const { type, id } = useParams();
  const kind = type === 'found' ? 'found' : 'lost';
  const { user } = useAuth();
  const lk = useLookups();
  const staff = user!.role !== 'user';

  const { data, loading, error, reload } = useLoad(async () => {
    const ep = kind === 'lost' ? '/lostReports' : '/foundItems';
    const item = (await api.get<any>(`${ep}/${id}`)).data as LostReport & FoundItem;
    if (kind === 'lost' && !staff && item.userId !== user!.id) throw new Error('This lost report is private to its owner and verifiers.');
    const [claims, matches] = await Promise.all([
      kind === 'found' ? api.get<Claim[]>('/claims', { params: { foundId: id, _sort: 'createdAt', _order: 'desc' } }) : Promise.resolve({ data: [] as Claim[] }),
      kind === 'lost' ? api.get<Match[]>('/matchSuggestions', { params: { lostId: id } }) : Promise.resolve({ data: [] as Match[] }),
    ]);
    return { item, claims: claims.data.filter((c) => staff || c.claimantId === user!.id), matches: matches.data };
  }, [kind, id]);

  const item: any = data?.item;
  const myActive = data?.claims.find((c) => c.claimantId === user!.id && c.status !== 'Rejected');
  const canClaim = kind === 'found' && item && claimable(item.status) && !staff && item.reportedBy !== user!.id && !myActive;

  return (
    <>
      <PageHeader title={item?.itemName ?? 'Item details'} sub={kind === 'lost' ? 'Lost report' : 'Found item'}>
        <Link to={kind === 'lost' ? '/lost' : '/found'} className={btnGhost}>Back to list</Link>
        {canClaim && <Link to={`/claims/new?foundId=${id}`} className={btnPrimary}>Submit claim</Link>}
      </PageHeader>
      <Async loading={loading || lk.loading} error={error} onRetry={reload}>
        {item && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <Card>
                {item.image && <img src={item.image} alt={item.itemName} className="mb-4 max-h-80 w-full rounded-lg object-contain bg-slate-50" />}
                <div className="mb-2"><Badge s={item.status} /></div>
                <dl>
                  <Row k="Category" v={lk.catName(item.categoryId)} />
                  <Row k="Description" v={item.description} />
                  {kind === 'lost' ? (
                    <>
                      <Row k="Last seen" v={`${item.lastSeenLocation}, ${fmtDate(item.lastSeenDate)}`} />
                      <Row k="Identifying details" v={item.identifyingDetails} />
                      <Row k="Contact preference" v={item.contactPreference} />
                      <Row k="Reported by" v={lk.userName(item.userId)} />
                    </>
                  ) : (
                    <>
                      <Row k="Found" v={`${item.foundLocation}, ${fmtDate(item.foundDate)}`} />
                      <Row k="Stored at" v={staff ? item.storageLocation : 'Held securely by staff. Location is shared after approval.'} />
                      <Row k="Registered by" v={lk.userName(item.reportedBy)} />
                    </>
                  )}
                  <Row k="Created" v={fmtDate(item.createdAt)} />
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(staff || (kind === 'lost' ? item.userId : item.reportedBy) === user!.id) && <Link to={`/${kind}/${id}/edit`} className={btnGhost}>Edit</Link>}
                </div>
              </Card>

              {kind === 'found' && data!.claims.length > 0 && (
                <Card>
                  <h2 className="mb-3 font-semibold">{staff ? 'Claims on this item' : 'Your claim'}</h2>
                  <ul className="divide-y divide-slate-100">
                    {data!.claims.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                        <span>{lk.userName(c.claimantId)} · {fmtDate(c.createdAt)}</span><Badge s={c.status} />
                      </li>
                    ))}
                  </ul>
                  <Link to={staff ? '/queue' : '/claims'} className="mt-3 inline-block text-sm font-semibold text-teal-700">Open {staff ? 'verification queue' : 'my claims'}</Link>
                </Card>
              )}

              {kind === 'lost' && data!.matches.length > 0 && (
                <Card>
                  <h2 className="mb-3 font-semibold">Possible matches</h2>
                  <ul className="divide-y divide-slate-100">
                    {data!.matches.map((m) => (
                      <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                        <Link to={`/items/found/${m.foundId}`} className="font-medium text-teal-700 hover:underline">Found item #{m.foundId} · {m.score}%</Link><Badge s={m.status} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
            <Card>
              <h2 className="mb-4 font-semibold">Activity history</h2>
              <Timeline type={kind} id={Number(id)} />
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}
