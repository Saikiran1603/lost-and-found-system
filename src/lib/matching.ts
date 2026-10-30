import { api, notify, now } from './api';
import type { FoundItem, LostReport, Match } from './types';

const STOP = new Set(['the', 'and', 'with', 'for', 'near', 'has', 'have', 'was', 'were', 'small', 'found', 'lost', 'item', 'inside', 'some', 'there', 'from', 'that', 'this', 'its']);
const words = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

/** Score a lost/found pair 0-100 using category, keywords, location and date range. */
export function scorePair(l: LostReport, f: FoundItem) {
  let score = 0;
  const reasons: string[] = [];
  if (l.categoryId === f.categoryId) { score += 35; reasons.push('Same category'); }
  const a = words(`${l.itemName} ${l.description} ${l.identifyingDetails}`);
  const b = words(`${f.itemName} ${f.description}`);
  const common = [...a].filter((w) => b.has(w));
  if (common.length) { score += Math.min(30, common.length * 10); reasons.push(`Shared keywords: ${common.slice(0, 5).join(', ')}`); }
  const la = words(l.lastSeenLocation), fb = words(f.foundLocation);
  const lo = l.lastSeenLocation.toLowerCase().trim(), fo = f.foundLocation.toLowerCase().trim();
  if (lo && fo && (lo.includes(fo) || fo.includes(lo) || [...la].some((w) => fb.has(w)))) { score += 20; reasons.push('Similar location'); }
  const days = Math.round((+new Date(f.foundDate) - +new Date(l.lastSeenDate)) / 864e5);
  if (days >= 0 && days <= 14) { score += 15; reasons.push(days === 0 ? 'Found the same day' : `Found ${days} day${days > 1 ? 's' : ''} after loss`); }
  return { score, reasons };
}

/** Compare a new item with the opposite list and store suggestions (never duplicates). Returns how many were created. */
export async function suggestMatches(kind: 'lost' | 'found', item: LostReport | FoundItem): Promise<number> {
  const [others, existing] = await Promise.all([
    api.get<any[]>(kind === 'lost' ? '/foundItems' : '/lostReports'),
    api.get<Match[]>('/matchSuggestions'),
  ]);
  let created = 0;
  for (const o of others.data) {
    const open = kind === 'lost' ? ['In Storage', 'Claim Pending'] : ['Open', 'Match Found'];
    if (!open.includes(o.status)) continue;
    const l = (kind === 'lost' ? item : o) as LostReport;
    const f = (kind === 'lost' ? o : item) as FoundItem;
    if (existing.data.some((m) => m.lostId === l.id && m.foundId === f.id)) continue;
    const { score, reasons } = scorePair(l, f);
    if (score < 50) continue;
    await api.post('/matchSuggestions', { lostId: l.id, foundId: f.id, score, reasons, status: 'Suggested', createdAt: now() });
    await notify(l.userId, 'match', `Possible match for "${l.itemName}": "${f.itemName}" (${score}% match). Please review.`, '/search?tab=matches');
    created++;
  }
  return created;
}
