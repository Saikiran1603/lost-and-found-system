import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Async, Card, Field, ImagePicker, PageHeader, btnGhost, btnPrimary, inputCls, useToast } from '../components/ui';
import { api, errMsg, log, now } from '../lib/api';
import { today } from '../lib/constants';
import { useLoad, useLookups } from '../lib/hooks';
import { suggestMatches } from '../lib/matching';
import type { LostReport } from '../lib/types';

const blank = { itemName: '', categoryId: '', description: '', lastSeenLocation: '', lastSeenDate: '', identifyingDetails: '', contactPreference: 'Email', image: '' };

export default function LostForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const lk = useLookups();
  const [v, setV] = useState({ ...blank });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const set = (k: keyof typeof blank, val: string) => setV((p) => ({ ...p, [k]: val }));

  const load = useLoad(async () => {
    if (!id) return null;
    const r = (await api.get<LostReport>(`/lostReports/${id}`)).data;
    if (user!.role === 'user' && r.userId !== user!.id) throw new Error('You can only edit your own reports.');
    setV({ itemName: r.itemName, categoryId: String(r.categoryId), description: r.description, lastSeenLocation: r.lastSeenLocation, lastSeenDate: r.lastSeenDate, identifyingDetails: r.identifyingDetails, contactPreference: r.contactPreference, image: r.image ?? '' });
    return r;
  }, [id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (v.itemName.trim().length < 2) e.itemName = 'Item name is required (at least 2 characters)';
    if (!v.categoryId) e.categoryId = 'Select a category';
    if (v.description.trim().length < 10) e.description = 'Describe the item (at least 10 characters)';
    if (!v.lastSeenLocation.trim()) e.lastSeenLocation = 'Last seen location is required';
    if (!v.lastSeenDate) e.lastSeenDate = 'Last seen date is required';
    else if (v.lastSeenDate > today()) e.lastSeenDate = 'Date cannot be in the future';
    if (v.identifyingDetails.trim().length < 5) e.identifyingDetails = 'Add identifying details such as marks, colour or serial number';
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setSubmitErr('');
    try {
      const body = { ...v, itemName: v.itemName.trim(), description: v.description.trim(), lastSeenLocation: v.lastSeenLocation.trim(), identifyingDetails: v.identifyingDetails.trim(), categoryId: Number(v.categoryId) };
      if (id) {
        await api.patch(`/lostReports/${id}`, { ...body, updatedAt: now() });
        await log('lost', Number(id), 'Report edited', user!.id);
        toast('Report updated');
      } else {
        const { data: mine } = await api.get<LostReport[]>('/lostReports', { params: { userId: user!.id } });
        const dup = mine.some((r) => r.status !== 'Closed' && r.itemName.toLowerCase() === body.itemName.toLowerCase() && r.lastSeenDate === body.lastSeenDate && r.lastSeenLocation.toLowerCase() === body.lastSeenLocation.toLowerCase());
        if (dup) throw new Error('You already submitted an identical report for this item, date and place.');
        const { data: r } = await api.post<LostReport>('/lostReports', { ...body, userId: user!.id, status: 'Open', createdAt: now(), updatedAt: now() });
        await log('lost', r.id, 'Lost report submitted', user!.id);
        const n = await suggestMatches('lost', r);
        toast(n ? `Report submitted. We found ${n} possible match${n > 1 ? 'es' : ''}.` : 'Report submitted');
      }
      nav('/lost');
    } catch (err) { setSubmitErr(errMsg(err)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title={id ? 'Edit lost report' : 'Report a lost item'} sub="The more precise your details, the easier it is to verify a match." />
      <Async loading={load.loading || lk.loading} error={load.error} onRetry={load.reload}>
        <Card className="max-w-3xl">
          <form onSubmit={submit} noValidate className="space-y-4">
            {submitErr && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{submitErr}</div>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Item name *" error={errs.itemName}><input className={inputCls} value={v.itemName} onChange={(e) => set('itemName', e.target.value)} /></Field>
              <Field label="Category *" error={errs.categoryId}>
                <select className={inputCls} value={v.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                  <option value="">Select…</option>
                  {lk.cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Last seen location *" error={errs.lastSeenLocation}><input className={inputCls} value={v.lastSeenLocation} onChange={(e) => set('lastSeenLocation', e.target.value)} /></Field>
              <Field label="Last seen date *" error={errs.lastSeenDate}><input type="date" max={today()} className={inputCls} value={v.lastSeenDate} onChange={(e) => set('lastSeenDate', e.target.value)} /></Field>
            </div>
            <Field label="Description *" error={errs.description}><textarea rows={3} className={inputCls} value={v.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Identifying details *" error={errs.identifyingDetails} hint="Only you and verifiers can see these. They are used to check ownership."><textarea rows={2} className={inputCls} value={v.identifyingDetails} onChange={(e) => set('identifyingDetails', e.target.value)} /></Field>
            <Field label="Contact preference">
              <select className={inputCls} value={v.contactPreference} onChange={(e) => set('contactPreference', e.target.value)}>
                <option>Email</option><option>Phone</option><option>In-app</option>
              </select>
            </Field>
            <ImagePicker value={v.image} onChange={(x) => set('image', x)} />
            <div className="flex flex-wrap gap-2 pt-2">
              <button className={btnPrimary} disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Submit report'}</button>
              <Link to="/lost" className={btnGhost}>Cancel</Link>
            </div>
          </form>
        </Card>
      </Async>
    </>
  );
}
