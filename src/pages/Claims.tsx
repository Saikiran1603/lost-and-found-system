import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Timeline from '../components/Timeline';
import { Async, Badge, Card, Field, PageHeader, btnGhost, btnPrimary, inputCls, useToast } from '../components/ui';
import { api, errMsg, log, notify, notifyStaff, now } from '../lib/api';
import { CLAIM_STATUSES, claimable, fmtDate } from '../lib/constants';
import { useLoad, useLookups } from '../lib/hooks';
import type { Claim, FoundItem, Handover, LostReport } from '../lib/types';

export function MyClaims() {
  const { user } = useAuth();
  const toast = useToast();
  const lk = useLookups();
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('desc');
  const [resp, setResp] = useState<Record<number, string>>({});
  const [rerr, setRerr] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<number | null>(null);

  const { data, loading, error, reload } = useLoad(async () => {
    const [c, f, h] = await Promise.all([
      api.get<Claim[]>('/claims', { params: { claimantId: user!.id, ...(status ? { status } : {}), _sort: 'createdAt', _order: sort } }),
      api.get<FoundItem[]>('/foundItems'),
      api.get<Handover[]>('/handovers', { params: { claimantId: user!.id } }),
    ]);
    return c.data.map((x) => ({ c: x, found: f.data.find((y) => y.id === x.foundId), h: h.data.find((y) => y.claimId === x.id) }));
  }, [status, sort]);

  const respond = async (c: Claim) => {
    const text = (resp[c.id] ?? '').trim();
    if (text.length < 5) return setRerr({ ...rerr, [c.id]: 'Please add at least 5 characters.' });
    try {
      await api.patch(`/claims/${c.id}`, { proofNotes: `${c.proofNotes}\n\n[Additional info ${fmtDate(now())}] ${text}`, status: 'Under Review', updatedAt: now() });
      await log('claim', c.id, 'Additional information provided', user!.id, text);
      await notifyStaff('claim-update', `${user!.name} responded to the information request.`, '/queue');
      toast('Information sent. Your claim is back under review.');
      setResp({ ...resp, [c.id]: '' });
      reload();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <>
      <PageHeader title="My claims" sub="Track the status of every ownership claim you submitted.">
        <Link to="/found" className={btnPrimary}>Browse found items</Link>
      </PageHeader>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:w-1/2">
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Claim status">
          <option value="">All claim statuses</option>{CLAIM_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="desc">Newest first</option><option value="asc">Oldest first</option></select>
      </div>
      <Async loading={loading || lk.loading} error={error} onRetry={reload} empty={!data?.length} emptyTitle="No claims yet" emptyText="Find your item in the found list and submit a claim."
        emptyAction={<Link to="/found" className={btnPrimary}>Browse found items</Link>}>
        <div className="space-y-4">
          {data?.map(({ c, found, h }) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link to={`/items/found/${c.foundId}`} className="font-semibold text-slate-900 hover:underline">{found?.itemName ?? `Item #${c.foundId}`}</Link>
                  <p className="text-xs text-slate-500">Submitted {fmtDate(c.createdAt)} · Updated {fmtDate(c.updatedAt)}</p>
                </div>
                <Badge s={c.status} />
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div><dt className="text-xs font-semibold text-slate-500">Identifying details</dt><dd>{c.identifyingDetails}</dd></div>
                <div><dt className="text-xs font-semibold text-slate-500">Proof notes</dt><dd className="whitespace-pre-line">{c.proofNotes}</dd></div>
              </dl>
              {c.status === 'More Information Required' && (
                <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <p className="text-sm font-semibold text-orange-900">Verifier request</p>
                  <p className="mb-2 text-sm text-orange-900">{c.infoRequest}</p>
                  <textarea rows={2} className={inputCls} placeholder="Your response" value={resp[c.id] ?? ''} onChange={(e) => setResp({ ...resp, [c.id]: e.target.value })} />
                  {rerr[c.id] && <p className="mt-1 text-xs font-medium text-rose-600">{rerr[c.id]}</p>}
                  <button className={`${btnPrimary} mt-2`} onClick={() => respond(c)}>Send information</button>
                </div>
              )}
              {h && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-teal-50 p-3 text-sm">
                  <span className="font-semibold text-teal-900">Handover</span><Badge s={h.status} />
                  {h.handoverDate && <span className="text-teal-900">on {fmtDate(h.handoverDate)} · verified by {lk.userName(h.verifierId)}</span>}
                  {h.status === 'Ready for Handover' && <span className="text-teal-900">Visit the lost property desk with a photo ID.</span>}
                </div>
              )}
              <button className="mt-3 text-sm font-semibold text-teal-700" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide history' : 'Show history'}</button>
              {open === c.id && <div className="mt-3"><Timeline type="claim" id={c.id} /></div>}
            </Card>
          ))}
        </div>
      </Async>
    </>
  );
}

export function ClaimForm() {
  const [sp] = useSearchParams();
  const foundId = sp.get('foundId');
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [v, setV] = useState({ identifyingDetails: '', proofNotes: '', lostId: sp.get('lostId') ?? '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  const { data, loading, error, reload } = useLoad(async () => {
    if (!foundId) throw new Error('No item selected. Choose a found item to claim.');
    const [f, mine, lost] = await Promise.all([
      api.get<FoundItem>(`/foundItems/${foundId}`),
      api.get<Claim[]>('/claims', { params: { foundId, claimantId: user!.id } }),
      api.get<LostReport[]>('/lostReports', { params: { userId: user!.id } }),
    ]);
    return { found: f.data, active: mine.data.find((c) => c.status !== 'Rejected'), lost: lost.data.filter((l) => l.status === 'Open' || l.status === 'Match Found') };
  }, [foundId]);

  const blockMsg = !data ? '' : data.found.reportedBy === user!.id ? 'You registered this item, so you cannot claim it.'
    : !claimable(data.found.status) ? `This item is "${data.found.status}" and cannot be claimed right now.`
    : data.active ? 'You already have an active claim for this item.' : '';

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (v.identifyingDetails.trim().length < 10) e.identifyingDetails = 'Describe unique details of the item (at least 10 characters)';
    if (v.proofNotes.trim().length < 10) e.proofNotes = 'Add proof notes, e.g. receipts, photos or purchase details (at least 10 characters)';
    setErrs(e);
    if (Object.keys(e).length || !data) return;
    setSaving(true);
    setSubmitErr('');
    try {
      const { data: fresh } = await api.get<Claim[]>('/claims', { params: { foundId, claimantId: user!.id } });
      if (fresh.some((c) => c.status !== 'Rejected')) throw new Error('You already have an active claim for this item.');
      const { data: c } = await api.post<Claim>('/claims', {
        foundId: Number(foundId), claimantId: user!.id, lostId: v.lostId ? Number(v.lostId) : null,
        identifyingDetails: v.identifyingDetails.trim(), proofNotes: v.proofNotes.trim(), status: 'Submitted', infoRequest: '', createdAt: now(), updatedAt: now(),
      });
      if (data.found.status === 'In Storage') await api.patch(`/foundItems/${foundId}`, { status: 'Claim Pending', updatedAt: now() });
      await log('claim', c.id, 'Claim submitted', user!.id);
      await log('found', Number(foundId), 'Claim submitted', user!.id);
      await notify(user!.id, 'claim-update', `Your claim for "${data.found.itemName}" was submitted.`, '/claims');
      await notifyStaff('claim-update', `New claim submitted for "${data.found.itemName}".`, '/queue');
      toast('Claim submitted');
      nav('/claims');
    } catch (err) { setSubmitErr(errMsg(err)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Submit a claim" sub={data ? `Claiming: ${data.found.itemName}` : undefined} />
      <Async loading={loading} error={error} onRetry={reload}>
        {data && (
          <Card className="max-w-3xl">
            {blockMsg ? (
              <div className="space-y-3"><p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{blockMsg}</p><Link to="/found" className={btnGhost}>Back to found items</Link></div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4">
                {submitErr && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{submitErr}</div>}
                <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Only the owner can describe the details a verifier will ask about. Do not guess: inaccurate claims are rejected.</p>
                <Field label="Identifying details *" error={errs.identifyingDetails} hint="Marks, contents, serial number, colours, wallpaper…"><textarea rows={3} className={inputCls} value={v.identifyingDetails} onChange={(e) => setV({ ...v, identifyingDetails: e.target.value })} /></Field>
                <Field label="Proof notes *" error={errs.proofNotes} hint="Receipts, photos you own, purchase date, who can vouch for you."><textarea rows={3} className={inputCls} value={v.proofNotes} onChange={(e) => setV({ ...v, proofNotes: e.target.value })} /></Field>
                <Field label="Linked lost report (optional)">
                  <select className={inputCls} value={v.lostId} onChange={(e) => setV({ ...v, lostId: e.target.value })}>
                    <option value="">None</option>{data.lost.map((l) => <option key={l.id} value={l.id}>{l.itemName} · {fmtDate(l.lastSeenDate)}</option>)}
                  </select>
                </Field>
                <div className="flex flex-wrap gap-2"><button className={btnPrimary} disabled={saving}>{saving ? 'Submitting…' : 'Submit claim'}</button><Link to="/found" className={btnGhost}>Cancel</Link></div>
              </form>
            )}
          </Card>
        )}
      </Async>
    </>
  );
}
