import type { ClaimStatus } from './types';
export const LOST_STATUSES = ['Open', 'Match Found', 'Resolved', 'Closed'] as const;
export const FOUND_STATUSES = ['In Storage', 'Claim Pending', 'Ready for Handover', 'Returned', 'Closed'] as const;
export const CLAIM_STATUSES: ClaimStatus[] = ['Submitted', 'Under Review', 'More Information Required', 'Approved', 'Rejected'];
export const HANDOVER_STATUSES = ['Ready for Handover', 'Handed Over', 'Closed'] as const;
/** Allowed staff transitions for a claim. */
export const NEXT: Record<ClaimStatus, ClaimStatus[]> = {
  Submitted: ['Under Review'],
  'Under Review': ['More Information Required', 'Approved', 'Rejected'],
  'More Information Required': ['Under Review', 'Approved', 'Rejected'],
  Approved: [],
  Rejected: [],
};
export const claimable = (s: string) => s === 'In Storage' || s === 'Claim Pending';
export const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtDateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
