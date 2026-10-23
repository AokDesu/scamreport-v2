# Permission matrix

Organizations are partner tenants. Roles are stored in `memberships`, not editable Auth metadata. A citizen is an authenticated account with **no** organization memberships. Staff accounts use their tenant role, not citizen routes. All tenant grants below mean **the caller’s organization only**.

| Action | Signed out | Citizen | Moderator | Organization admin | Executive |
|---|---|---|---|---|---|
| Read `/me` and own memberships | Deny | Own | Own | Own | Own |
| List organizations | Deny | Available organizations | Own memberships | Own memberships | Own memberships |
| Read verified public projection / search | Deny | Allow | Allow | Allow | Allow |
| Create a report, choose assigned organization | Deny | Own, pending | Deny | Deny | Deny |
| List raw report rows | Deny | Own only | Own tenant, not withdrawn | Own tenant, not withdrawn | **Deny** |
| Withdraw report | Deny | Own only, any non-withdrawn status | Deny | Deny | Deny |
| Verify / reject / flag | Deny | Deny | Own tenant; pending or flagged source | Deny | Deny |
| Read private contact snapshot | Deny | Own | Assigned tenant **and consent** | Assigned tenant **and consent** | **Deny** |
| Read citizen profiles | Deny | Own | Own profile only, never reporter profiles | Own profile only, never reporter profiles | Own profile only |
| Edit profile contact/name (direct Data API) | Deny | Own | Own | Own | Own |
| Upload evidence | Deny | Own pending report, new object only | Deny | Deny | Deny |
| Read / list / download evidence | Deny | Own | Own tenant, not withdrawn | Own tenant, not withdrawn | **Deny** |
| Replace / delete evidence | Deny | Deny | Deny | Deny | Deny |
| Read moderation history (Data API) | Deny | Deny | Own tenant | Own tenant | **Deny** |
| List tenant membership roster | Deny | Deny | Deny (own membership only) | Own tenant | Deny (own membership only) |
| Grant / change / remove another membership | Deny | Deny | Deny | Own tenant; moderator, org_admin or executive | Deny |
| Change or delete **own** membership | Deny | Deny | Deny | **Deny** | Deny |
| Read executive aggregates | Deny | Deny | Deny | Deny | Own tenant only |
| Read audit log | Deny | Deny | Deny | Own tenant only | **Deny** |
| Forge / update / delete audit or moderation history | Deny | Deny | Deny | Deny | Deny |
| Read / write another tenant’s protected data | Deny | Deny | Deny | Deny | Deny |
| Change report owner, assignment, consent or contents after filing | Deny | Deny | Deny | Deny | Deny |
| Create organizations / bootstrap first admin | Deny | Deny | Deny | Deny | Deny |
| Delete reports | Deny | Deny | Deny | Deny | Deny |

## API and database enforcement

1. API verifies the bearer token with Supabase Auth on **every** protected request, then loads current database memberships. Existing JWTs do not preserve revoked tenant permissions. No authorization uses `user_metadata`, `app_metadata`, a client role or a service-role key.
2. API checks the selected tenant and required role before querying protected tenant collections or modifying memberships. A foreign tenant request returns `403 FORBIDDEN`. Invisible report IDs return `404 NOT_FOUND`, not an existence oracle.
3. The API creates a fresh Supabase client carrying that same caller JWT. Direct browser/Data API requests therefore face the same RLS as API requests. RLS and column grants prevent changing ownership/tenant/consent, self-verification, self-promotion and self-removal.
4. Every application table enables RLS. Client grants are explicit; missing policies mean deny. The non-exposed `private.has_role` lookup is a narrowly scoped security-definer function to avoid recursive membership policies; identity is always `auth.uid()`, search paths are fixed, and anonymous/public execution is revoked.
5. Organization admins can manage other users only. Membership identity is immutable: moving a membership between tenants requires a separately authorized operation, never an UPDATE that swaps IDs. The first admin is provisioned through trusted migration/operations, never through a public bootstrap endpoint.

## Executive split and public feed

Executives receive `status`, `report_count` and `total_amount` from an explicitly authorized aggregate function. They cannot select report rows, report contacts, another citizen’s profile, evidence, moderation history or audit identities. They cannot acquire report access by inserting a citizen report. There is no commercial-data endpoint or table in this reporting domain; raw case data and reporter information are the restricted equivalent.

The requirement also allows **every signed-in account** to read the verified public feed. This is a separate deliberate projection of `id`, `scam_type`, `channel`, `amount` and `created_at`; it contains no reporter IDs, contact fields, organization identifiers or free-text description. Free text is excluded because a reporter may put personal information into it. Search covers scam type and channel, not private descriptions. No default-definer view exposes the underlying rows.

The two projection functions use private security-definer implementations with explicit authenticated/tenant checks, fixed search paths, revoked public/anonymous execution and projection-only output. Public RPC wrappers are security invoker. They are the documented exception to raw-row RLS, not a general query bypass.

## Consent, state and evidence

Contact details are stored in a separate immutable per-report snapshot. Organization access requires the report to be visible, the caller to be a moderator/admin of its assigned organization, and `consent_contact=true`. A reporter’s own profile is never a back door to the snapshot. Withdrawing a report removes it from tenant queues, tenant contacts/evidence access and the public projection, while retaining the owner’s record and the audit trail.

Only pending/flagged reports may be moderated. Verified and rejected decisions cannot be silently overwritten; the citizen can still withdraw. Repeating the same status is invalid. Evidence uses an immutable private bucket, 5 MiB maximum, PNG/JPEG/PDF content validation, randomized filenames and report-scoped RLS. Downloads are attachments, authorized on every request, not long-lived public or signed URLs. Private evidence may itself contain personal information; executives and the public cannot access it.

Database triggers write audit/history in the same transaction as report and membership mutations. Clients have no audit/history write grants. The request ID comes from the Data API request headers; direct Data API mutations without one receive a generated UUID. Request IDs are correlation labels, not trusted authorization assertions. API request logs include successful and denied reads/writes; the database audit log records durable mutations, not every read.

Proof: `supabase/tests/database/access.test.sql` and `apps/api/tests/acceptance.test.ts`; real execution output is regenerated by `bun run test` into [test-report.md](test-report.md).
