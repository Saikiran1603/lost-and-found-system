import type { ChangeEvent } from 'react';
import type { Category } from '../lib/types';
import { btnGhost, inputCls } from './ui';

export interface Filt { q: string; categoryId: string; location: string; from: string; to: string; status: string; sort: 'desc' | 'asc' }
export const emptyFilt: Filt = { q: '', categoryId: '', location: '', from: '', to: '', status: '', sort: 'desc' };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Convert filter state to JSON Server query params (_like = case-insensitive regex, _gte/_lte = ranges). */
export function toParams(f: Filt, locKey: string, dateKey: string) {
  const p: Record<string, string> = { _sort: 'createdAt', _order: f.sort };
  if (f.q) p.itemName_like = esc(f.q);
  if (f.categoryId) p.categoryId = f.categoryId;
  if (f.location) p[`${locKey}_like`] = esc(f.location);
  if (f.status) p.status = f.status;
  if (f.from) p[`${dateKey}_gte`] = f.from;
  if (f.to) p[`${dateKey}_lte`] = f.to;
  return p;
}

export function FilterBar({ f, set, cats, statuses, statusLabel = 'Status' }: {
  f: Filt; set: (f: Filt) => void; cats: Category[]; statuses: readonly string[]; statusLabel?: string;
}) {
  const u = (k: keyof Filt) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set({ ...f, [k]: e.target.value } as Filt);
  const bad = f.from && f.to && f.from > f.to;
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className={inputCls} placeholder="Search item name" value={f.q} onChange={u('q')} aria-label="Search item name" />
        <select className={inputCls} value={f.categoryId} onChange={u('categoryId')} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className={inputCls} placeholder="Location" value={f.location} onChange={u('location')} aria-label="Location" />
        <select className={inputCls} value={f.status} onChange={u('status')} aria-label={statusLabel}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-500">From<input type="date" className={inputCls} value={f.from} onChange={u('from')} /></label>
        <label className="flex items-center gap-2 text-xs text-slate-500">To<input type="date" className={inputCls} value={f.to} onChange={u('to')} /></label>
        <select className={inputCls} value={f.sort} onChange={u('sort')} aria-label="Sort order">
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
        <button className={btnGhost} onClick={() => set(emptyFilt)}>Clear filters</button>
      </div>
      {bad && <p className="mt-2 text-xs font-medium text-rose-600">“From” date must be before “To” date.</p>}
    </div>
  );
}
