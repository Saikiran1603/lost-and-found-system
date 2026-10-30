import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Async, Badge, Card, Field, PageHeader, btnDanger, btnGhost, btnPrimary, inputCls, useToast } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { useLoad } from '../lib/hooks';
import type { Category, FoundItem, LostReport, Role, User } from '../lib/types';

export function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [v, setV] = useState({ name: '', email: '', password: '', role: 'user' as Role });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoad(async () => (await api.get<User[]>('/users')).data);

  const add = async (ev: FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = 'Name is required';
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email';
    else if (data?.some((u) => u.email.toLowerCase() === v.email.trim().toLowerCase())) e.email = 'A user with this email already exists';
    if (v.password.length < 6) e.password = 'Password must be at least 6 characters';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.post('/users', { name: v.name.trim(), email: v.email.trim().toLowerCase(), password: v.password, role: v.role, active: true });
      toast('User created');
      setV({ name: '', email: '', password: '', role: 'user' });
      reload();
    } catch (err) { toast(errMsg(err), 'error'); } finally { setBusy(false); }
  };
  const patch = async (u: User, body: Partial<User>, msg: string) => {
    try { await api.patch(`/users/${u.id}`, body); toast(msg); reload(); } catch (err) { toast(errMsg(err), 'error'); }
  };

  return (
    <>
      <PageHeader title="Users" sub="Create accounts, assign roles and deactivate access." />
      <Card className="mb-6">
        <form onSubmit={add} noValidate className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-start">
          <Field label="Name" error={errs.name}><input className={inputCls} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Email" error={errs.email}><input className={inputCls} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
          <Field label="Password" error={errs.password}><input type="password" className={inputCls} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></Field>
          <Field label="Role"><select className={inputCls} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as Role })}><option value="user">User</option><option value="staff">Staff / Verifier</option><option value="admin">Admin</option></select></Field>
          <div className="lg:pt-6"><button className={`${btnPrimary} w-full`} disabled={busy}>{busy ? 'Adding…' : 'Add user'}</button></div>
        </form>
      </Card>
      <Async loading={loading} error={error} onRetry={reload} empty={!data?.length}>
        <Card className="overflow-x-auto !p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead><tr className="border-b bg-slate-50 text-slate-500"><th className="p-3">Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="p-3 font-medium">{u.name}{u.id === me!.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}</td>
                  <td>{u.email}</td>
                  <td><select aria-label={`Role for ${u.name}`} disabled={u.id === me!.id} value={u.role} onChange={(e) => patch(u, { role: e.target.value as Role }, 'Role updated')} className="rounded-lg border border-slate-300 px-2 py-1"><option value="user">User</option><option value="staff">Staff</option><option value="admin">Admin</option></select></td>
                  <td><Badge s={u.active ? 'Approved' : 'Rejected'} /> <span className="text-xs text-slate-500">{u.active ? 'Active' : 'Disabled'}</span></td>
                  <td className="pr-3 text-right">{u.id !== me!.id && <button className={u.active ? btnDanger : btnGhost} onClick={() => patch(u, { active: !u.active }, u.active ? 'User deactivated' : 'User activated')}>{u.active ? 'Deactivate' : 'Activate'}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Async>
    </>
  );
}

export function Categories() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<{ id: number; name: string } | null>(null);
  const { data, loading, error, reload } = useLoad(async () => (await api.get<Category[]>('/categories')).data);
  const dup = (n: string, id?: number) => data?.some((c) => c.id !== id && c.name.toLowerCase() === n.trim().toLowerCase());

  const add = async (ev: FormEvent) => {
    ev.preventDefault();
    if (name.trim().length < 2) return setErr('Category name is required (at least 2 characters)');
    if (dup(name)) return setErr('This category already exists');
    setErr('');
    try { await api.post('/categories', { name: name.trim() }); toast('Category added'); setName(''); reload(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const save = async () => {
    if (!edit) return;
    if (edit.name.trim().length < 2 || dup(edit.name, edit.id)) return toast('Enter a unique category name', 'error');
    try { await api.patch(`/categories/${edit.id}`, { name: edit.name.trim() }); toast('Category renamed'); setEdit(null); reload(); } catch (e) { toast(errMsg(e), 'error'); }
  };
  const remove = async (c: Category) => {
    try {
      const [l, f] = await Promise.all([api.get<LostReport[]>('/lostReports', { params: { categoryId: c.id } }), api.get<FoundItem[]>('/foundItems', { params: { categoryId: c.id } })]);
      if (l.data.length + f.data.length > 0) return toast(`"${c.name}" is used by ${l.data.length + f.data.length} item(s) and cannot be deleted.`, 'error');
      await api.delete(`/categories/${c.id}`);
      toast('Category deleted');
      reload();
    } catch (e) { toast(errMsg(e), 'error'); }
  };

  return (
    <>
      <PageHeader title="Categories" sub="Categories are used for reports, filters and match scoring." />
      <Card className="mb-6 max-w-xl">
        <form onSubmit={add} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1"><Field label="New category" error={err}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
          <button className={`${btnPrimary} sm:mt-6`}>Add category</button>
        </form>
      </Card>
      <Async loading={loading} error={error} onRetry={reload} empty={!data?.length} emptyTitle="No categories">
        <ul className="max-w-xl divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {data?.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 p-3">
              {edit?.id === c.id ? (
                <><input aria-label="Category name" className={`${inputCls} flex-1`} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /><button className={btnPrimary} onClick={save}>Save</button><button className={btnGhost} onClick={() => setEdit(null)}>Cancel</button></>
              ) : (
                <><span className="flex-1 font-medium">{c.name}</span><button className={btnGhost} onClick={() => setEdit({ id: c.id, name: c.name })}>Rename</button><button className={btnDanger} onClick={() => remove(c)}>Delete</button></>
              )}
            </li>
          ))}
        </ul>
      </Async>
    </>
  );
}
