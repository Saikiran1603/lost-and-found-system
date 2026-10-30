export type Role = 'admin' | 'user' | 'staff';
export interface User { id: number; name: string; email: string; password: string; role: Role; active: boolean }
export interface Category { id: number; name: string }
export type LostStatus = 'Open' | 'Match Found' | 'Resolved' | 'Closed';
export type FoundStatus = 'In Storage' | 'Claim Pending' | 'Ready for Handover' | 'Returned' | 'Closed';
export interface LostReport {
  id: number; userId: number; itemName: string; categoryId: number; description: string;
  lastSeenLocation: string; lastSeenDate: string; identifyingDetails: string;
  contactPreference: 'Email' | 'Phone' | 'In-app'; image?: string; status: LostStatus; createdAt: string; updatedAt: string;
}
export interface FoundItem {
  id: number; reportedBy: number; itemName: string; categoryId: number; description: string;
  foundLocation: string; foundDate: string; storageLocation: string; status: FoundStatus;
  image?: string; createdAt: string; updatedAt: string;
}
export interface Match {
  id: number; lostId: number; foundId: number; score: number; reasons: string[];
  status: 'Suggested' | 'Confirmed' | 'Rejected'; confirmedBy?: number; createdAt: string;
}
export type ClaimStatus = 'Submitted' | 'Under Review' | 'More Information Required' | 'Approved' | 'Rejected';
export interface Claim {
  id: number; foundId: number; claimantId: number; lostId?: number | null; identifyingDetails: string;
  proofNotes: string; status: ClaimStatus; infoRequest?: string; reviewerId?: number; createdAt: string; updatedAt: string;
}
export interface Verification { id: number; claimId: number; verifierId: number; status: ClaimStatus; note: string; createdAt: string }
export type HandoverStatus = 'Ready for Handover' | 'Handed Over' | 'Closed';
export interface Handover {
  id: number; claimId: number; foundId: number; claimantId: number; status: HandoverStatus;
  handoverDate?: string | null; verifierId?: number | null; note?: string; createdAt: string; updatedAt: string;
}
export interface Notification { id: number; userId: number; type: string; message: string; link?: string; read: boolean; createdAt: string }
export interface Activity { id: number; entityType: 'lost' | 'found' | 'claim' | 'handover'; entityId: number; action: string; actorId: number; note?: string; createdAt: string }
