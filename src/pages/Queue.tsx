import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Timeline from '../components/Timeline';
import { Async, Badge, Card, PageHeader, btnDanger, btnGhost, btnOk, btnPrimary, inputCls, useToast } from '../components/ui';
import { api, errMsg, log, notify, now } from '../lib/api';
import { CLAIM_STATUSES, NEXT, fmtDate } from '../lib/constants';
import { useLoad, useLookups } from '../lib/hooks';
import { onApprove, onReject } from '../lib/workflow';
import type { Claim, ClaimStatus, FoundItem } from '../lib/types';

const LABEL: Record<ClaimStatus, string> = { Submitted: '', 'Under Review': 'Start review', 'More Information Required': 'Request proof', Approved: 'Approve', Rejected: 'Reject' };
const STYLE: Record<ClaimStatus, string> = { Submitted: btnGhost, 'Under Review': btnPrimary, 'More Information Required': btnGhost, Approved: btnOk, Rejected: btnDanger };

export default function Queue() {
  const { user } = useAuth();
  const toast = useToast();
  const lk = useLookups();
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('desc');
  const [q, setQ] = useState('');
  const [acting, setActing] = useState<{ id: number; to: ClaimStatus } | null>(null);
  const [note, setNote] = useState('');
  const [noteErr, setNoteErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const { data, loading, error, reload } = useLoad(async () => {
    const [c, f] = await Promise.all([
      api.get<Claim[]>('/claims', { params: { ...(status ? { status } : {}), _sort: 'createdAt', _order: sort } }),
      api.get<FoundItem[]>('/foundItems'),
    ]);
    return c.data.map((x) => ({ claim: x, found: f.data.find((y) => y.id === x.foundId) }));
  }, [status, sort]);

  const rows = (data ?? []).filter((r) => !q || (r.found?.itemName ?? '').toLowerCase().includes(q.toLowerCase()) || lk.userName(r.claim.claimantId).toLowerCase().includes(q.toLowerCase()));

  const start = (id: number, to: ClaimStatus) => {
    if (to === 'Under Review') return run({ id, to });
    setActing({ id, to }); setNote(''); setNoteErr('');
  };

  const run = async (a = acting) => {
    if (!a) return;
    const row = data!.find((r) => r.claim.id === a.id)!;
    const c = row.claim;
    const text = note.trim();
    if ((a.to === 'More Information Required' || a.to === 'Rejected') && text.length < 5) return setNoteErr('Add a note (at least 5 characters) so the claimant knows why.');
    setBusy(true);
    try {
      const t = now();
      await api.patch(`/claims/${c.id}`, { status: a.to, reviewerId: user!.id, updatedAt: t, ...(a.to === 'More Information Required' ? { infoRequest: text } : {}) });
      await api.post('/verifications', { claimId: c.id, verifierId: user!.id, status: a.to, note: text, createdAt: t });
      await log('claim', c.id, `Status changed to ${a.to}`, user!.id, text);
      const item = row.found?.itemName ?? 'the item';
      const msgs: Record<ClaimStatus, string> = {
        Submitted: '',
        'Under Review': `Your claim for "${item}" is now under review.`,
        'More Information Required': `More information is needed for "${item}": ${text}`,
        Approved: `Your claim for "${item}" was approved. A handover is being arranged.`,
        Rejected: `Your claim for "${item}" was rejected. ${text}`,
      };
      await notify(c.claimantId, a.to === 'More Information Required' ? 'info-request' : 'claim-update', msgs[a.to], '/claims');
      if (a.to === 'Approved') await onApprove(c, user!.id);
      if (a.to === 'Rejected') await onReject(c, user!.id);
      toast(`Claim ${a.to.toLowerCase()}`);
      setActing(null);
      reload();
    } catch (e) { toast(errMsg(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Claim verification queue" sub="Review claims, request proof and decide." />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <input className={inputCls} placeholder="Search item or claimant" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Claim status"><option value="">All claim statuses</option>{CLAIM_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="desc">Newest first</option><option value="asc">Oldest first</option></select>
      </div>
      <Async loading={loading || lk.loading} error={error} onRetry={reload} empty={!rows.length} emptyTitle="The queue is clear" emptyText="No claims match the current filters.">
        <div className="space-y-4">
          {rows.map(({ claim: c, found }) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link to={`/items/found/${c.foundId}`} className="font-semibold hover:underline">{found?.itemName ?? `Item #${c.foundId}`}</Link>
                  <p className="text-xs text-slate-500">Claimant: {lk.userName(c.claimantId)} · Submitted {fmtDate(c.createdAt)}</p>
                </div>
                <Badge s={c.status} />
              </div>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Claimant says</p>
                  <p>{c.identifyingDetails}</p>
                  <p className="mt-2 whitespace-pre-line text-slate-600">{c.proofNotes}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-800">Item on file</p>
                  <p>{found?.description}</p>
                  <p className="mt-2 text-slate-600">Stored: {found?.storageLocation}</p>
                </div>
              </div>
              {c.infoRequest && c.status === 'More Information Required' && <p className="mt-3 rounded-lg bg-orange-50 p-3 text-sm text-orange-900"><b>Requested:</b> {c.infoRequest}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {NEXT[c.status].map((to) => <button key={to} className={STYLE[to]} disabled={busy} onClick={() => start(c.id, to)}>{LABEL[to]}</button>)}
                <button className={btnGhost} onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? 'Hide history' : 'History'}</button>
              </div>
              {acting?.id === c.id && (
                <div className="mt-3 rounded-lg border border-slate-200 p-3">
                  <label className="mb-1 block text-sm font-medium">{acting.to === 'Approved' ? 'Note (optional)' : 'Note for the claimant *'}</label>
                  <textarea rows={2} className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
                  {noteErr && <p className="mt-1 text-xs font-medium text-rose-600">{noteErr}</p>}
                  <div className="mt-2 flex gap-2"><button className={STYLE[acting.to]} disabled={busy} onClick={() => run()}>{busy ? 'Saving…' : `Confirm: ${LABEL[acting.to]}`}</button><button className={btnGhost} onClick={() => setActing(null)}>Cancel</button></div>
                </div>
              )}
              {open === c.id && <div className="mt-4"><Timeline type="claim" id={c.id} /></div>}
            </Card>
          ))}
        </div>
      </Async>
    </>
  );
}
