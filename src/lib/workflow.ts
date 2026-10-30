import { api, log, notify, now } from './api';
import type { Claim, Handover } from './types';

/** Approving a claim creates the handover record and releases competing claims. */
export async function onApprove(c: Claim, actor: number) {
  const { data: existing } = await api.get<Handover[]>('/handovers', { params: { claimId: c.id } });
  if (!existing.length) {
    const { data: h } = await api.post<Handover>('/handovers', {
      claimId: c.id, foundId: c.foundId, claimantId: c.claimantId, status: 'Ready for Handover',
      handoverDate: null, verifierId: null, note: '', createdAt: now(), updatedAt: now(),
    });
    await log('handover', h.id, 'Ready for Handover', actor);
  }
  await api.patch(`/foundItems/${c.foundId}`, { status: 'Ready for Handover', updatedAt: now() });
  await log('found', c.foundId, 'Claim approved — ready for handover', actor);
  const { data: others } = await api.get<Claim[]>('/claims', { params: { foundId: c.foundId } });
  for (const o of others.filter((x) => x.id !== c.id && x.status !== 'Rejected' && x.status !== 'Approved')) {
    await api.patch(`/claims/${o.id}`, { status: 'Rejected', updatedAt: now() });
    await log('claim', o.id, 'Status changed to Rejected', actor, 'Item released to another verified claimant');
    await notify(o.claimantId, 'claim-update', 'Your claim was closed because the item was released to another verified claimant.', '/claims');
  }
}

/** After a rejection, put the item back in storage when no other active claim remains. */
export async function onReject(c: Claim, actor: number) {
  const { data: all } = await api.get<Claim[]>('/claims', { params: { foundId: c.foundId } });
  if (!all.some((x) => x.status !== 'Rejected')) {
    await api.patch(`/foundItems/${c.foundId}`, { status: 'In Storage', updatedAt: now() });
    await log('found', c.foundId, 'Returned to storage (no active claims)', actor);
  }
}
