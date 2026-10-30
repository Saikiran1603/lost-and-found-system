import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Async, Card, PageHeader, Stat, btnGhost, btnPrimary } from '../components/ui';
import { api } from '../lib/api';
import { useLoad } from '../lib/hooks';
import type { Claim, FoundItem, Handover, LostReport, Match, Notification } from '../lib/types';

export default function Dashboard() {
  const { user } = useAuth();
  const staff = user!.role !== 'user';
  const { data, loading, error, reload } = useLoad(async () => {
    const [lost, claims, matches, handovers, notes, found] = await Promise.all([
      api.get<LostReport[]>('/lostReports', { params: staff ? {} : { userId: user!.id } }),
      api.get<Claim[]>('/claims', { params: staff ? {} : { claimantId: user!.id } }),
      api.get<Match[]>('/matchSuggestions', { params: { status: 'Suggested' } }),
      api.get<Handover[]>('/handovers'),
      api.get<Notification[]>('/notifications', { params: { userId: user!.id, read: false } }),
      api.get<FoundItem[]>('/foundItems'),
    ]);
    const myLostIds = lost.data.map((l) => l.id);
    return {
      lost: lost.data, claims: claims.data, found: found.data, notes: notes.data.length,
      matches: staff ? matches.data.length : matches.data.filter((m) => myLostIds.includes(m.lostId)).length,
      handovers: handovers.data.filter((h) => (staff ? true : h.claimantId === user!.id)),
    };
  });

  return (
    <>
      <PageHeader title={`Hello, ${user!.name.split(' ')[0]}`} sub={staff ? 'Verification work waiting for you.' : 'Track your reports and claims.'}>
        <Link to="/lost/new" className={btnPrimary}>Report lost item</Link>
        <Link to="/found/new" className={btnGhost}>Register found item</Link>
      </PageHeader>
      <Async loading={loading} error={error} onRetry={reload}>
        {data && (staff ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/queue"><Stat label="Claims awaiting review" value={data.claims.filter((c) => c.status === 'Submitted' || c.status === 'Under Review').length} tone="amber" /></Link>
            <Link to="/queue"><Stat label="Waiting on claimant info" value={data.claims.filter((c) => c.status === 'More Information Required').length} tone="rose" /></Link>
            <Link to="/handovers"><Stat label="Ready for handover" value={data.handovers.filter((h) => h.status === 'Ready for Handover').length} tone="sky" /></Link>
            <Link to="/search?tab=matches"><Stat label="Matches to confirm" value={data.matches} tone="violet" /></Link>
            <Link to="/found"><Stat label="Found items in storage" value={data.found.filter((f) => f.status === 'In Storage').length} tone="emerald" /></Link>
            <Link to="/lost"><Stat label="Open lost reports" value={data.lost.filter((l) => l.status === 'Open').length} /></Link>
            <Link to="/notifications"><Stat label="Unread notifications" value={data.notes} tone="rose" /></Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Link to="/lost"><Stat label="My open lost reports" value={data.lost.filter((l) => l.status === 'Open' || l.status === 'Match Found').length} /></Link>
              <Link to="/search?tab=matches"><Stat label="Possible matches to review" value={data.matches} tone="violet" /></Link>
              <Link to="/claims"><Stat label="My active claims" value={data.claims.filter((c) => c.status !== 'Rejected' && c.status !== 'Approved').length} tone="amber" /></Link>
              <Link to="/notifications"><Stat label="Unread notifications" value={data.notes} tone="rose" /></Link>
            </div>
            <Card className="mt-6">
              <h2 className="font-semibold">How recovery works</h2>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
                <li>Report your lost item with identifying details.</li>
                <li>We suggest matches from the found-item list. Confirm the right one.</li>
                <li>Submit a claim with proof notes. Staff may ask for more information.</li>
                <li>Once approved, collect the item and a verifier records the handover.</li>
              </ol>
            </Card>
          </>
        ))}
      </Async>
    </>
  );
}
