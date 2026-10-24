import {
  Ban, CircleCheck, CircleX, Clock, Ellipsis, Flag, Globe, Landmark, Link2, Mail, MessageCircle, MessageSquare,
  Package, Phone, TrendingUp, Undo2, type LucideIcon,
} from 'lucide-react';
import type { MemberRole, Me, ReportInput, ReportStatus } from '@scamreport/shared';

export type ScamType = ReportInput['scam_type'];
export type Channel = ReportInput['channel'];
export type { ReportStatus };

// Order follows the approved look: most common first, "other" last.
export const scamTypes: readonly ScamType[] = ['shopping', 'investment', 'impersonation', 'phishing', 'other'];
export const channels: readonly Channel[] = ['phone', 'sms', 'social', 'website', 'email', 'other'];
export const statuses: readonly ReportStatus[] = ['pending', 'flagged', 'verified', 'rejected', 'withdrawn'];

export const scamTypeIcon: Record<ScamType, LucideIcon> = {
  shopping: Package, investment: TrendingUp, impersonation: Landmark, phishing: Link2, other: Ellipsis,
};
export const channelIcon: Record<Channel, LucideIcon> = {
  phone: Phone, sms: MessageSquare, social: MessageCircle, website: Globe, email: Mail, other: Ellipsis,
};
export const statusIcon: Record<ReportStatus, LucideIcon> = {
  pending: Clock, verified: CircleCheck, rejected: CircleX, withdrawn: Undo2, flagged: Flag,
};
export const deniedIcon = Ban;

/** Unknown API values render as "other" rather than as a raw code. */
export const asScamType = (value: string): ScamType => (scamTypes as readonly string[]).includes(value) ? value as ScamType : 'other';
export const asChannel = (value: string): Channel => (channels as readonly string[]).includes(value) ? value as Channel : 'other';

export type HeldRole = MemberRole | 'citizen';
export const rolePriority: MemberRole[] = ['moderator', 'org_admin', 'executive'];
export function initialMembership(me: Me) {
  return rolePriority.flatMap(role => me.memberships.filter(m => m.role === role))[0];
}
export function primaryRole(me: Me): HeldRole {
  if (me.role === 'citizen') return 'citizen';
  return initialMembership(me)!.role;
}
export function homePath(me: Me) {
  const role = primaryRole(me);
  return role === 'citizen' ? '/citizen/feed' : role === 'executive' ? '/admin/dashboard' : '/admin/queue';
}

export const maxEvidenceFiles = 5;
export const maxEvidenceBytes = 5 * 1024 * 1024;
export const evidenceTypes = ['image/png', 'image/jpeg', 'application/pdf'];
