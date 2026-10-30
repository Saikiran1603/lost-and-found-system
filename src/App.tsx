import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/ui';
import type { Role } from './lib/types';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { LostList, FoundList } from './pages/Lists';
import LostForm from './pages/LostForm';
import FoundForm from './pages/FoundForm';
import SearchPage from './pages/SearchPage';
import ItemDetails from './pages/ItemDetails';
import { MyClaims, ClaimForm } from './pages/Claims';
import Queue from './pages/Queue';
import Handovers from './pages/Handovers';
import Notifications from './pages/Notifications';
import { AdminDashboard, Reports } from './pages/Admin';
import { Users, Categories } from './pages/AdminManage';

function Protected({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role))
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-5xl">🚫</p>
        <h1 className="mt-4 text-xl font-bold">Access denied</h1>
        <p className="mt-1 text-sm text-slate-500">Your role does not have permission to open this page.</p>
      </div>
    );
  return <Outlet />;
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user!.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="lost" element={<LostList />} />
          <Route path="lost/new" element={<LostForm />} />
          <Route path="lost/:id/edit" element={<LostForm />} />
          <Route path="found" element={<FoundList />} />
          <Route path="found/new" element={<FoundForm />} />
          <Route path="found/:id/edit" element={<FoundForm />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="items/:type/:id" element={<ItemDetails />} />
          <Route path="claims" element={<MyClaims />} />
          <Route path="claims/new" element={<ClaimForm />} />
          <Route path="notifications" element={<Notifications />} />
          <Route element={<Protected roles={['staff', 'admin']} />}>
            <Route path="queue" element={<Queue />} />
            <Route path="handovers" element={<Handovers />} />
          </Route>
          <Route element={<Protected roles={['admin']} />}>
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/reports" element={<Reports />} />
            <Route path="admin/users" element={<Users />} />
            <Route path="admin/categories" element={<Categories />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
