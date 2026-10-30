import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Async, Card, Field, ImagePicker, PageHeader, btnGhost, btnPrimary, inputCls, useToast } from '../components/ui';
import { api, errMsg, log, now } from '../lib/api';
import { FOUND_STATUSES, today } from '../lib/constants';
import { useLoad, useLookups } from '../lib/hooks';
import { suggestMatches } from '../lib/matching';
import type { FoundItem } from '../lib/types';

const blank = { itemName: '', categoryId: '', description: '', foundLocation: '', foundDate: '', storageLocation: '', status: 'In Storage', image: '' };

export default function FoundForm() {
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
    const r = (await api.get<FoundItem>(`/foundItems/${id}`)).data;
    if (user!.role === 'user' && r.reportedBy !== user!.id) throw new Error('You can only edit items you registered.');
    setV({ itemName: r.itemName, categoryId: String(r.categoryId), description: r.description, foundLocation: r.foundLocation, foundDate: r.foundDate, storageLocation: r.storageLocation, status: r.status, image: r.image ?? '' });
    return r;
  }, [id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (v.itemName.trim().length < 2) e.itemName = 'Item name is required (at least 2 characters)';
    if (!v.categoryId) e.categoryId = 'Select a category';
    if (v.description.trim().length < 10) e.description = 'Describe the item (at least 10 characters)';
    if (!v.foundLocation.trim()) e.foundLocation = 'Found location is required';
    if (!v.foundDate) e.foundDate = 'Found date is required';
    else if (v.foundDate > today()) e.foundDate = 'Date cannot be in the future';
    if (!v.storageLocation.trim()) e.storageLocation = 'Tell us where the item is stored now';
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
      const body = { ...v, itemName: v.itemName.trim(), description: v.description.trim(), foundLocation: v.foundLocation.trim(), storageLocation: v.storageLocation.trim(), categoryId: Number(v.categoryId) };
      if (id) {
        await api.patch(`/foundItems/${id}`, { ...body, updatedAt: now() });
        await log('found', Number(id), 'Item details edited', user!.id);
        toast('Found item updated');
      } else {
        const { data: all } = await api.get<FoundItem[]>('/foundItems');
        const dup = all.some((r) => r.status !== 'Closed' && r.itemName.toLowerCase() === body.itemName.toLowerCase() && r.foundDate === body.foundDate && r.foundLocation.toLowerCase() === body.foundLocation.toLowerCase());
        if (dup) throw new Error('This item has already been registered for the same date and place.');
        const { data: r } = await api.post<FoundItem>('/foundItems', { ...body, status: 'In Storage', reportedBy: user!.id, createdAt: now(), updatedAt: now() });
        await log('found', r.id, 'Found item registered', user!.id);
        const n = await suggestMatches('found', r);
        toast(n ? `Item registered. ${n} possible owner match${n > 1 ? 'es' : ''} notified.` : 'Found item registered');
      }
      nav('/found');
    } catch (err) { setSubmitErr(errMsg(err)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title={id ? 'Edit found item' : 'Register a found item'} sub="Describe what you found without revealing details only the owner would know." />
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
              <Field label="Found location *" error={errs.foundLocation}><input className={inputCls} value={v.foundLocation} onChange={(e) => set('foundLocation', e.target.value)} /></Field>
              <Field label="Found date *" error={errs.foundDate}><input type="date" max={today()} className={inputCls} value={v.foundDate} onChange={(e) => set('foundDate', e.target.value)} /></Field>
              <Field label="Storage location *" error={errs.storageLocation}><input className={inputCls} value={v.storageLocation} onChange={(e) => set('storageLocation', e.target.value)} /></Field>
              <Field label="Current status">
                {id && user!.role !== 'user' ? (
                  <select className={inputCls} value={v.status} onChange={(e) => set('status', e.target.value)}>{FOUND_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
                ) : <input className={`${inputCls} bg-slate-100`} value={v.status} readOnly />}
              </Field>
            </div>
            <Field label="Description *" error={errs.description}><textarea rows={3} className={inputCls} value={v.description} onChange={(e) => set('description', e.target.value)} /></Field>
            <ImagePicker value={v.image} onChange={(x) => set('image', x)} />
            <div className="flex flex-wrap gap-2 pt-2">
              <button className={btnPrimary} disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Register item'}</button>
              <Link to="/found" className={btnGhost}>Cancel</Link>
            </div>
          </form>
        </Card>
      </Async>
    </>
  );
}
