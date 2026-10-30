import { createContext, useCallback, useContext, useState, type ChangeEvent, type ReactNode } from 'react';

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ');

export const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100';
const btn = 'inline-flex items-center justify-center gap-1 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
export const btnPrimary = `${btn} bg-teal-700 text-white hover:bg-teal-800`;
export const btnGhost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;
export const btnDanger = `${btn} bg-rose-600 text-white hover:bg-rose-700`;
export const btnOk = `${btn} bg-emerald-600 text-white hover:bg-emerald-700`;

/* ---------- toasts ---------- */
type ToastFn = (msg: string, type?: 'success' | 'error') => void;
const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<{ id: number; msg: string; type: string }[]>([]);
  const push = useCallback<ToastFn>((msg, type = 'success') => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, type }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed inset-x-4 bottom-4 z-[100] space-y-2 sm:left-auto sm:w-96" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} role="status" className={cx('rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg', t.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600')}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- states ---------- */
export const Spinner = () => (
  <div className="flex justify-center py-12" role="status" aria-label="Loading">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-100 border-t-teal-700" />
  </div>
);
export const ErrorBox = ({ msg, onRetry }: { msg: string; onRetry?: () => void }) => (
  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">
    <p className="font-semibold">Something went wrong</p>
    <p className="mt-1">{msg}</p>
    {onRetry && <button onClick={onRetry} className={`${btnGhost} mt-3`}>Try again</button>}
  </div>
);
export const Empty = ({ title, text, action }: { title: string; text?: string; action?: ReactNode }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
    <p className="font-semibold text-slate-700">{title}</p>
    {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
export function Async({ loading, error, onRetry, empty, emptyTitle = 'Nothing here yet', emptyText, emptyAction, children }: {
  loading: boolean; error: string; onRetry?: () => void; empty?: boolean; emptyTitle?: string; emptyText?: string; emptyAction?: ReactNode; children: ReactNode;
}) {
  if (loading) return <Spinner />;
  if (error) return <ErrorBox msg={error} onRetry={onRetry} />;
  if (empty) return <Empty title={emptyTitle} text={emptyText} action={emptyAction} />;
  return <>{children}</>;
}

/* ---------- small pieces ---------- */
const COLORS: Record<string, string> = {
  Open: 'bg-sky-100 text-sky-800', 'Match Found': 'bg-violet-100 text-violet-800', Resolved: 'bg-emerald-100 text-emerald-800',
  Closed: 'bg-slate-200 text-slate-700', 'In Storage': 'bg-amber-100 text-amber-800', 'Claim Pending': 'bg-orange-100 text-orange-800',
  'Ready for Handover': 'bg-cyan-100 text-cyan-800', Returned: 'bg-emerald-100 text-emerald-800', Submitted: 'bg-sky-100 text-sky-800',
  'Under Review': 'bg-amber-100 text-amber-800', 'More Information Required': 'bg-orange-100 text-orange-800',
  Approved: 'bg-emerald-100 text-emerald-800', Rejected: 'bg-rose-100 text-rose-800', 'Handed Over': 'bg-emerald-100 text-emerald-800',
  Suggested: 'bg-violet-100 text-violet-800', Confirmed: 'bg-emerald-100 text-emerald-800',
};
export const Badge = ({ s }: { s: string }) => (
  <span className={cx('inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', COLORS[s] ?? 'bg-slate-100 text-slate-700')}>{s}</span>
);

export const PageHeader = ({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) => (
  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);

export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cx('rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5', className)}>{children}</div>
);

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

export function ImagePicker({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [err, setErr] = useState('');
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) return setErr('Please choose an image file.');
    if (f.size > 5 * 1024 * 1024) return setErr('Image must be smaller than 5 MB.');
    setErr('');
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 640 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        onChange(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => setErr('Could not read that image.');
      img.src = r.result as string;
    };
    r.readAsDataURL(f);
  };
  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-slate-700">Photo (optional)</span>
      <div className="flex flex-wrap items-center gap-4">
        {value ? <img src={value} alt="Preview" className="h-24 w-24 rounded-lg border object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed text-xs text-slate-400">No image</div>}
        <div className="space-y-2">
          <input type="file" accept="image/*" onChange={pick} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-800" />
          {value && <button type="button" onClick={() => onChange('')} className="text-xs font-medium text-rose-600">Remove image</button>}
        </div>
      </div>
      {err && <p className="mt-1 text-xs font-medium text-rose-600">{err}</p>}
    </div>
  );
}

export const Stat = ({ label, value, tone = 'teal' }: { label: string; value: number | string; tone?: 'teal' | 'amber' | 'rose' | 'violet' | 'sky' | 'emerald' }) => {
  const t = { teal: 'border-teal-600', amber: 'border-amber-500', rose: 'border-rose-500', violet: 'border-violet-500', sky: 'border-sky-500', emerald: 'border-emerald-500' }[tone];
  return (
    <div className={cx('rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm', t)}>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
};
