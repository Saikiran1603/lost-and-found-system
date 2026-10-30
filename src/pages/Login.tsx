import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, btnPrimary, inputCls } from '../components/ui';
import { errMsg } from '../lib/api';

const DEMO = [
  ['Admin', 'admin@lostfound.com', 'admin123'],
  ['Staff / Verifier', 'staff@lostfound.com', 'staff123'],
  ['User (Priya)', 'priya@example.com', 'user123'],
  ['User (Ravi)', 'ravi@example.com', 'user123'],
];

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errs, setErrs] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: typeof errs = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) v.email = 'Enter a valid email address';
    if (!password) v.password = 'Password is required';
    setErrs(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      nav((loc.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-teal-950 p-12 text-teal-50 lg:flex">
        <p className="text-xl font-bold">Lost &amp; Found</p>
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">Lost it? Found it? Get it back to the right hands.</h1>
          <p className="mt-4 max-w-md text-teal-200">Report lost items, register found ones, review suggested matches, verify ownership and record every handover.</p>
        </div>
        <p className="text-sm text-teal-300">Demo project · data served by JSON Server</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">Log in</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Use your account or a demo login below.</p>
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error && <div role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
            <Field label="Email" error={errs.email}><input type="email" autoComplete="username" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Password" error={errs.password}><input type="password" autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            <button className={`${btnPrimary} w-full`} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          </form>
          <div className="mt-8">
            <p className="mb-2 text-xs font-semibold text-slate-500">Demo accounts (tap to fill)</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map(([n, e, p]) => (
                <button key={e} type="button" onClick={() => { setEmail(e); setPassword(p); setErrs({}); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs hover:border-teal-600">
                  <span className="block font-semibold text-slate-700">{n}</span>
                  <span className="block truncate text-slate-500">{e}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
