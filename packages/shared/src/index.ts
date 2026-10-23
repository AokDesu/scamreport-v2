import { t, type Static } from 'elysia';

export const MemberRole = t.Union([t.Literal('moderator'), t.Literal('org_admin'), t.Literal('executive')]);
export type MemberRole = Static<typeof MemberRole>;
export const ReportStatus = t.Union([t.Literal('pending'),t.Literal('verified'),t.Literal('rejected'),t.Literal('flagged'),t.Literal('withdrawn')]);
export const Uuid = t.String({ format: 'uuid' });
export const IdParams = t.Object({ id: Uuid }, { additionalProperties: false });
export const TenantQuery = t.Object({ organization_id: Uuid }, { additionalProperties: false });
export const Pagination = {
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
  offset: t.Optional(t.Numeric({ minimum: 0, maximum: 100000, default: 0 })),
};
export const ReportInput = t.Object({
  organization_id: Uuid,
  scam_type: t.Union([t.Literal('impersonation'),t.Literal('shopping'),t.Literal('investment'),t.Literal('phishing'),t.Literal('other')]),
  channel: t.Union([t.Literal('phone'),t.Literal('sms'),t.Literal('social'),t.Literal('website'),t.Literal('email'),t.Literal('other')]),
  // Decimal text keeps currency validation exact; floating multipleOf(0.01) rejects valid money.
  amount: t.String({ pattern: '^(0|[1-9][0-9]{0,11})(\\.[0-9]{1,2})?$', examples: ['123.45'], description: 'THB decimal string, nonnegative, at most 12 whole and 2 fractional digits' }),
  description: t.String({ minLength: 10, maxLength: 5000 }),
  consent_contact: t.Boolean(),
  contact_email: t.Optional(t.String({ format: 'email', maxLength: 254 })),
  contact_phone: t.Optional(t.String({ minLength: 1, maxLength: 40 })),
}, { additionalProperties: false });
export type ReportInput = Static<typeof ReportInput>;
export const MembershipInput = t.Object({ organization_id: Uuid, user_id: Uuid, role: MemberRole }, { additionalProperties: false });
export const MembershipTarget = t.Object({ organization_id: Uuid, user_id: Uuid }, { additionalProperties: false });
export const ModerationInput = t.Object({ status: t.Union([t.Literal('verified'),t.Literal('rejected'),t.Literal('flagged')]) }, { additionalProperties: false });
export const ErrorCode = t.Union([t.Literal('SESSION_EXPIRED'),t.Literal('UNAUTHENTICATED'),t.Literal('FORBIDDEN'),t.Literal('VALIDATION_FAILED'),t.Literal('NOT_FOUND'),t.Literal('CONFLICT'),t.Literal('INTERNAL_ERROR')]);
export type ErrorCode = Static<typeof ErrorCode>;
export const ApiError = t.Object({ error: t.Object({ code: ErrorCode, message: t.String(), requestId: t.String() }) });
export type ApiError = Static<typeof ApiError>;
export const Membership = t.Object({ organization_id: Uuid, user_id: Uuid, role: MemberRole });
export type Membership = Static<typeof Membership>;
export const Me = t.Object({ id: Uuid, email: t.Optional(t.String()), role: t.Union([t.Literal('citizen'),t.Literal('staff')]), memberships: t.Array(Membership) });
export type Me = Static<typeof Me>;
export const Report = t.Object({ id: Uuid, reporter_id: Uuid, organization_id: Uuid, scam_type: t.String(), channel: t.String(), amount: t.Number(), description: t.String(), status: ReportStatus, consent_contact: t.Boolean(), created_at: t.String() });
export type Report = Static<typeof Report>;
export const FeedItem = t.Object({ id: Uuid, scam_type: t.String(), channel: t.String(), amount: t.Number(), created_at: t.String() });
export const Data = <T extends Parameters<typeof t.Array>[0]>(schema: T) => t.Object({ data: schema });
export const ErrorResponses = { 400: ApiError, 401: ApiError, 403: ApiError, 404: ApiError, 409: ApiError, 422: ApiError, 500: ApiError };
