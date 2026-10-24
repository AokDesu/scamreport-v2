# ScamReport v2

A fresh, local-only rebuild: citizen mobile web and organization desktop console in one React application, backed by a tenant-isolated Bun/Elysia API and Supabase PostgreSQL/Auth/private Storage. The original CSC234 team repository is read-only and is not used at runtime.

The web app has two surfaces on the approved "queue ticket" theme (K PLUS teal-green family, self-hosted OFL Noto fonts, light mode): a **citizen phone app** (390px) and an **organization console** (desktop, 1280px and wider). Thai is the default language with an English switch on every screen. No Firebase, AI filing/chat, push notifications, exports, Chinese or live deployment.

| Surface | Routes | What it does |
|---|---|---|
| Gate screens | `/sign-in`, `/session-expired`, `/unauthorized` | Sign in; Session Expired keeps the report draft on the device; Unauthorized shows the role held and the role needed |
| Citizen | `/citizen/feed`, `/citizen/report`, `/citizen/report/received/:id`, `/citizen/reports` | Verified-scam feed with search; two-step report (scam type, channel, amount, story, evidence, then destination and consent); numbered tickets with the received → reviewing → result track and withdraw |
| Console | `/admin/queue`, `/admin/reports/:id`, `/admin/members`, `/admin/activity`, `/admin/dashboard` | Queue with "Call next"; report detail with verify/reject/flag, consent-gated contact and history; members and roles; activity log with request IDs and denied attempts; executive dashboard with aggregates only |

## Start in three commands

Prerequisites: **Bun 1.3.13**, Docker with Compose, **Supabase CLI 2.121.0**, Git. Docker must be running; `DOCKER_HOST` is honored by all scripts. No hosted Supabase project, account, cloud credentials or system-package installation is required.

```sh
git clone https://github.com/AokDesu/scamreport-v2.git && cd scamreport-v2
bun install --frozen-lockfile
bun run local:up
```

`local:up` starts the local Supabase stack (migrations + fictional seed), reads local **public anon** keys from the CLI, creates a gitignored `.env`, builds both multi-stage images and starts API/web with health checks. It refuses to overwrite a hand-written `.env`. First run downloads images. Ports must be available: 3000, 8080, 54321–54324 and 54320. Some optional Supabase services are excluded; Auth, PostgreSQL, Data API and Storage are real.

- Web: <http://localhost:8080>
- API documentation: <http://localhost:3000/openapi>
- OpenAPI JSON: <http://localhost:3000/openapi/json>
- Local email inbox: <http://localhost:54324>

The API joins the local stack’s external `supabase_network_scamreport-v2` network and reaches `supabase_kong_scamreport-v2:8000` directly, avoiding host-gateway differences between rootless Docker, Linux and Docker Desktop. Keep `supabase/config.toml`’s project ID and these network names in sync. Browsers reach Supabase at `127.0.0.1:54321`; web `/api/*` is same-origin proxied to Elysia. With a remote Docker daemon, set `VITE_SUPABASE_URL` to an address reachable from your browser.

### Fictional demo accounts

Every account uses the **local demonstration password** `Demo-only-234!`. These are reproducible fictional fixtures, not credentials for a real service. Never reuse them outside the local stack.

| Email | Role | Organization |
|---|---|---|
| `citizen@demo.example.test` | Citizen | None |
| `citizen-two@demo.example.test` | Citizen | None |
| `citizen-three@demo.example.test` | Citizen | None |
| `moderator-a@demo.example.test` | Moderator | Demo River Bank |
| `admin-a@demo.example.test` | Organization admin | Demo River Bank |
| `executive-a@demo.example.test` | Executive | Demo River Bank |
| `moderator-b@demo.example.test` | Moderator | Demo City Safety Unit |
| `admin-b@demo.example.test` | Organization admin | Demo City Safety Unit |
| `executive-b@demo.example.test` | Executive | Demo City Safety Unit |

Seed organizations: A `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`; B `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`. The seed also holds sixteen older fictional reports with decisions so the queue, history, activity log and dashboard have content. Sign-in routes citizens to `/citizen/feed`, moderators and admins to `/admin/queue`, executives to `/admin/dashboard`. A citizen opening a console route, or staff opening a citizen route, lands on `/unauthorized`. In the console, rail items the role lacks are shown locked; opening one asks the API, which answers `403`, logs the denied attempt for the organization admin, and the page explains the role held and the role needed. Route guards are UX only; API and RLS enforce actual access.

Supabase rotates refresh tokens normally. If a persisted session cannot be refreshed, the client shows Session Expired even when Auth discards the invalid session during initialization; deliberate Sign out returns to Sign in instead. Temporary Auth/API transport failures remain retryable connection errors, not false session-expiry or permission denials. Stored-session presence is only a UX hint and never grants access.

## Architecture

```text
apps/web          React + TypeScript + Vite + Tailwind v4; citizen/admin/executive route shells
apps/api          Bun + Elysia; Auth verification, role checks, request IDs, OpenAPI
packages/shared   Elysia request/response schemas and inferred TypeScript contracts
supabase          CLI config, SQL migration, fictional seed, pgTAP access tests
scripts           Local startup, local key loading, acceptance/test-report runner
```

Requests follow browser → Elysia → Supabase with the **caller’s own JWT**, never a service-role key. Elysia verifies the session with Auth and reloads current memberships per request; PostgreSQL independently applies RLS and column grants. Direct Data API calls do not bypass the rules. Role metadata is not authorization.

Organizations are tenants. Citizens own reports; only moderators/admins of the assigned organization can read its non-withdrawn cases. Contact details are a separate consent-gated snapshot. Executives receive only explicit aggregate output, not case rows, reporter details, evidence or audit identities. All signed-in roles can read a separately de-identified verified projection, with no free-text description. See the complete [permission matrix and denial rationale](docs/permission-matrix.md).

Every application table enables RLS and has explicit least-privilege grants/policies. Narrow private security-definer functions implement nonrecursive membership checks and authorized de-identified projections; public RPC wrappers run as invoker. No general-purpose bypass function or default-definer view exists. State and membership mutations write immutable audit/history through database triggers in the same transaction. Public/anonymous execution of privileged private code is revoked.

### API contract

All endpoints except `/health` and `/openapi*` require `Authorization: Bearer <Supabase access token>`. Every response carries `X-Request-Id`. A caller-supplied ID is preserved if it matches `[A-Za-z0-9._:-]{1,128}`, otherwise a UUID is generated. Logs contain method, path, status and request ID, not request bodies, tokens or contact details. Mutation audit rows carry the same ID. Direct Data API mutations without an ID receive a database-generated UUID.

| Endpoint | Contract |
|---|---|
| `GET /me` | Verified user ID/email, citizen/staff designation and current memberships |
| `GET /tenants` | Citizen’s available destinations or staff’s own organizations |
| `GET /memberships[?organization_id=…]` | Own grants; organization admin can request own tenant roster |
| `PUT /memberships` | Upsert another user’s tenant role; no self-management or foreign tenant |
| `DELETE /memberships` | Remove another user’s tenant role; same denials |
| `GET /roles` | Capability catalog; not a source of tenant grants |
| `POST /reports` | Citizen report and contact snapshot, atomic |
| `GET /reports` | Citizen’s own reports, paginated |
| `POST /reports/:id/withdraw` | Citizen withdraws own report |
| `POST /reports/:id/evidence` | Multipart `file`; own pending report; private immutable PNG/JPEG/PDF ≤5 MiB |
| `GET /reports/:id/evidence` | List authorized report’s evidence paths |
| `GET /reports/:id/evidence/:filename` | Authorized attachment download; no public/signed URL |
| `GET /reports/:id/contacts` | Owner, or assigned moderator/admin with consent |
| `GET /feed?search=…` | Verified projection; search scam type/channel only |
| `GET /moderation/queue?organization_id=…` | Own organization’s non-withdrawn cases; moderator/admin only |
| `POST /moderation/:id` | Moderator chooses verified/rejected/flagged from pending/flagged |
| `GET /moderation/:id` | One report of the caller's organization with its decision history; foreign or withdrawn IDs are 404; executives get a logged 403 |
| `GET /members?organization_id=…` | Staff display names for moderators/admins of that tenant; sign-in emails only for organization admins |
| `GET /statistics?organization_id=…` | Executive’s own tenant aggregates only |
| `GET /statistics/breakdown?organization_id=…` | Executive’s own tenant counts by scam type, channel, consent and week; no rows or identities |
| `GET /audit?organization_id=…` | Organization admin’s own tenant audit: mutations, staff contact views and denied attempts, with request IDs and ticket numbers |

Every staff `403` is written to the organization's activity log before the response leaves (`record_denial`), and every staff view of a consented contact is audited (`record_contact_view`); see the [permission matrix](docs/permission-matrix.md).

Lists support `limit` (1–100, default 20) and `offset` (0–100000, default 0), except small tenant/membership catalogs. Success is `{ "data": ... }`. Elysia built-in schemas validate parameters, queries, JSON and files; unknown JSON fields are rejected rather than silently stripped. OpenAPI documents schemas and status codes.

The application bounds total request bodies to **6 MiB before decoding**, counting streamed chunks as well as checking declared lengths. Oversized requests return the same `422 VALIDATION_FAILED` envelope and request ID; the file itself remains limited to 5 MiB. Native Bun limits are not used for this operational bound because native 413 responses skip application error hooks. Rejected body connections close, and the web proxy avoids pooling body requests to prevent Bun 1.3 from reusing a rejected upload connection.

Example report body (`amount` is an exact THB decimal **string**, avoiding floating-point `multipleOf` validation/rounding):

```json
{
  "organization_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "scam_type": "phishing",
  "channel": "sms",
  "amount": "123.45",
  "description": "Fictional demonstration of a suspicious message.",
  "consent_contact": true,
  "contact_email": "citizen@demo.example.test"
}
```

Amount: nonnegative, ≤12 whole digits and ≤2 fractional digits. The database stores `numeric(14,2)` and returns JSON numbers. Report descriptions stay private, even after verification. Valid scam types are impersonation/shopping/investment/phishing/other; channels are phone/sms/social/website/email/other.

Every API failure uses:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission for this organization.",
    "requestId": "demo-request-123"
  }
}
```

Codes: `401 UNAUTHENTICATED`, `401 SESSION_EXPIRED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT`, `422 VALIDATION_FAILED`, `500 INTERNAL_ERROR`. Invisible row IDs return 404 to avoid revealing another tenant’s resources. The web proxy returns this same shape with 502/INTERNAL_ERROR if the API is unavailable. SQL/upstream internals are never returned. Audit correlation IDs are labels, not authorization credentials.

## Tests and Gate F2 evidence

With local Supabase running:

```sh
bun run test
```

This **one command** runs `supabase test db`, `bun test apps/api/tests`, then the web component tests (`vitest` + Testing Library in jsdom, `bun run test:web`), writes real output/exit codes/timestamps to [docs/test-report.md](docs/test-report.md), and exits nonzero if any suite fails. No mock backend for the database and API suites. API tests launch a real ephemeral-port Elysia HTTP server against local Auth/Data API/Storage. They are grouped by ThaiWay’s six categories: **Auth/Session, Permission, Cross-Tenant Denial, API Error, Security, Regression**. Component tests cover the report form (validation in Thai, exact API body, no contact details without consent, 403 handling, English labels) and status handling (step track, status words, 401/403/404/network handling in the API client).

The expiry test signs a short-lived JWT with the local-only test signing secret obtained from `supabase status`, proves that Auth accepts it while live, waits for the separate Auth server’s clock, then proves `401 SESSION_EXPIRED` for the **same token**. No fake expiry branch or decoded-but-unverified token. Refresh-token rotation, existing-JWT permission revocation, direct Data API RLS denial, consent, private evidence, audit correlation and create→moderate→feed→withdraw are covered.

Database tests roll back all changes, temporarily removing earlier API/demo-generated records to isolate the six seed cases. API tests leave only fictional withdrawn records/private test evidence as an audit trail; repeat runs are supported. To restore modified demo seed cases, use `supabase db reset --local` **only on this disposable local stack**; it destroys local demo changes. Never link or point these seed/tests at a hosted/real-data database.

Other checks:

```sh
bun run typecheck
bun run build
supabase db advisors --local --type security
```

CI runs on every PR and main: frozen install, typecheck, local Supabase, database/API/web component tests with report artifact, web build, both Docker image builds. Only a successful main push publishes `ghcr.io/aokdesu/scamreport-v2-api` and `ghcr.io/aokdesu/scamreport-v2-web` (`latest` and commit-SHA tags). No deployment. The web image accepts public Supabase config **at runtime** through `/config.js`, so published images contain no baked-in keys; both containers run as the unprivileged `bun` user.

## New developer handover

1. Run the three setup commands and read the permission matrix before changing roles, contacts, projections or storage policies.
2. For native hot reload, keep Supabase running, stop only these app containers with `docker compose down`, then run `WEB_ORIGIN=http://localhost:5173 bun run dev`. Vite serves 5173 and proxies `/api`; root `.env` supplies local public config. Do not stop another project’s containers or Docker daemon.
3. Add shared input/output contracts in `packages/shared/src/index.ts`; add role checks in `apps/api/src/app.ts`; keep the caller JWT. Generate migrations using `supabase migration new <name>` and extend behavioral pgTAP/API denial tests. Do not change user metadata into authorization or introduce a service-role path.
4. Web code: `src/i18n/{th,en}.ts` hold every visible string (same keys in both; Thai is the type source). `src/components/` holds the signature pieces (`Ticket`, `StepTrack`, `StatusBadge`, `IdentifierChip`, `LanguageToggle`); `src/components/ui/` holds official shadcn/ui components restyled to the theme in `src/index.css`. Screens live in `src/citizen/` and `src/admin/` (the console is lazy-loaded). `api<T>()` throws `ApiFailure` with status, code and request ID; screens show translated text, never server messages. `components.json` uses the official Radix/new-york registry; the CLI's aggregate `radix-ui`/`cn` imports are replaced by individual `@radix-ui/react-*` packages and the local `cn` helper, so keep future additions on approved packages.
5. Use the role accounts above to record mobile/desktop sign-in, no-permission and expired-session demonstrations. To see Session Expired without waiting an hour, sign in as a citizen, start a report, then in the browser console set `scamreport-auth`'s `expires_at` to the past and its `refresh_token` to any invalid value and reload: Auth refuses the refresh and the app shows Session Expired with the draft kept.

Environment variables are documented in `.env.example`. `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY` are public project keys; **never substitute a service-role key**. The test runner reads `JWT_SECRET` transiently for expiry proof and never writes it into app `.env` or browser assets. No live credentials are needed for CI; GHCR uses the main-job `GITHUB_TOKEN` with packages:write. Never commit `.env`, signing secrets, personal data or real evidence.
