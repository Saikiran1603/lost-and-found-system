import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Timeline from '../components/Timeline';
import { Async, Badge, Card, Field, PageHeader, btnGhost, btnOk, btnPrimary, inputCls, useToast } from '../components/ui';
import { api, errMsg, log, notify, now } from '../lib/api';
import { HANDOVER_STATUSES, fmtDate, today } from '../lib/constants';
import { useLoad, useLookups } from '../lib/hooks';
import type { Claim, FoundItem, Handover } from '../lib/types';

export default function Handovers() {
  const { user } = useAuth();
  const toast = useToast();
  const lk = useLookups();
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('desc');
  const [form, setForm] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useLoad(async () => {
    const [h, f, c] = await Promise.all([
      api.get<Handover[]>('/handovers', { params: { ...(status ? { status } : {}), _sort: 'createdAt', _order: sort } }),
      api.get<FoundItem[]>('/foundItems'),
      api.get<Claim[]>('/claims'),
    ]);
    return h.data.map((x) => ({ h: x, found: f.data.find((y) => y.id === x.foundId), claim: c.data.find((y) => y.id === x.claimId) }));
  }, [status, sort]);

  type Row = NonNullable<typeof data>[number];

  const record = async (r: Row) => {
    const e = !date ? 'Handover date is required.' : date > today() ? 'Date cannot be in the future.' : r.claim && date < r.claim.createdAt.slice(0, 10) ? 'Date cannot be before the claim was submitted.' : '';
    setErr(e);
    if (e) return;
    setBusy(true);
    try {
      const t = now();
      await api.patch(`/handovers/${r.h.id}`, { status: 'Handed Over', handoverDate: date, verifierId: user!.id, note: note.trim(), updatedAt: t });
      await api.patch(`/foundItems/${r.h.foundId}`, { status: 'Returned', updatedAt: t });
      if (r.claim?.lostId) { await api.patch(`/lostReports/${r.claim.lostId}`, { status: 'Resolved', updatedAt: t }); await log('lost', r.claim.lostId, 'Item recovered — report resolved', user!.id); }
      await log('handover', r.h.id, 'Handed over', user!.id, note.trim());
      await log('found', r.h.foundId, 'Item returned to owner', user!.id);
      await notify(r.h.claimantId, 'handover', `Handover of "${r.found?.itemName}" was recorded on ${fmtDate(date)}.`, '/claims');
      toast('Handover recorded');
      setForm(null); setNote('');
      reload();
    } catch (e2) { toast(errMsg(e2), 'error'); } finally { setBusy(false); }
  };

  const close = async (r: Row) => {
    try {
      await api.patch(`/handovers/${r.h.id}`, { status: 'Closed', updatedAt: now() });
      await api.patch(`/foundItems/${r.h.foundId}`, { status: 'Closed', updatedAt: now() });
      await log('handover', r.h.id, 'Case closed', user!.id);
      await notify(r.h.claimantId, 'handover', `The case for "${r.found?.itemName}" is now closed.`, '/claims');
      toast('Case closed');
      reload();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <>
      <PageHeader title="Handover management" sub="Track approved claims from ready to handed over to closed." />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:w-1/2">
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Handover status"><option value="">All statuses</option>{HANDOVER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="desc">Newest first</option><option value="asc">Oldest first</option></select>
      </div>
      <Async loading={loading || lk.loading} error={error} onRetry={reload} empty={!data?.length} emptyTitle="No handovers yet" emptyText="Approve a claim in the verification queue to start a handover.">
        <div className="space-y-4">
          {data?.map((r) => (
            <Card key={r.h.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link to={`/items/found/${r.h.foundId}`} className="font-semibold hover:underline">{r.found?.itemName ?? `Item #${r.h.foundId}`}</Link>
                  <p className="text-xs text-slate-500">Claimant: {lk.userName(r.h.claimantId)} · Stored: {r.found?.storageLocation}</p>
                </div>
                <Badge s={r.h.status} />
              </div>
              {r.h.handoverDate && <p className="mt-2 text-sm text-slate-600">Handed over on {fmtDate(r.h.handoverDate)} · verified by {lk.userName(r.h.verifierId)}{r.h.note ? ` · ${r.h.note}` : ''}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.h.status === 'Ready for Handover' && <button className={btnPrimary} onClick={() => { setForm(form === r.h.id ? null : r.h.id); setErr(''); }}>Record handover</button>}
                {r.h.status === 'Handed Over' && <button className={btnOk} onClick={() => close(r)}>Close case</button>}
                <button className={btnGhost} onClick={() => setOpen(open === r.h.id ? null : r.h.id)}>{open === r.h.id ? 'Hide history' : 'History'}</button>
              </div>
              {form === r.h.id && (
                <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
                  <Field label="Handover date *" error={err}><input type="date" max={today()} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
                  <Field label="Verifier"><input className={`${inputCls} bg-slate-100`} value={user!.name} readOnly /></Field>
                  <div className="sm:col-span-2"><Field label="Note (ID checked, received by…)"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
                  <div className="flex gap-2 sm:col-span-2"><button className={btnOk} disabled={busy} onClick={() => record(r)}>{busy ? 'Saving…' : 'Confirm handover'}</button><button className={btnGhost} onClick={() => setForm(null)}>Cancel</button></div>
                </div>
              )}
              {open === r.h.id && <div className="mt-4"><Timeline type="handover" id={r.h.id} /></div>}
            </Card>
          ))}
        </div>
      </Async>
    </>
  );
}
