# Local acceptance test report

Generated: 2026-10-24T14:27:52.236Z

Environment: bun 1.3.13; supabase 2.121.0; isolated local Supabase, fictional fresh seed, production web/API proxy, Chromium, caller JWTs. No service-role client.

Owned project: `scamreport-e2e-5ipJ7N`; Supabase: `http://127.0.0.1:56321`; web: `http://127.0.0.1:56330`; API: `http://127.0.0.1:56331`.

| Suite | Result | Exit code | Seconds |
|---|---|---:|---:|
| Database / pgTAP | PASS | 0 | 4.61 |
| Web / component tests (vitest + Testing Library) | PASS | 0 | 28.50 |
| API / six acceptance categories | PASS | 0 | 15.77 |
| End-to-end / Chromium | PASS | 0 | 102.92 |

Acceptance categories: Auth/Session, Permission, Cross-Tenant Denial, API Error, Security, Regression. Database cases roll back. API tests use real Auth/Data API/Storage. Before Chromium runs, only this disposable database is reset to the fictional seed. Browser expiry uses a token accepted by Auth before the same token expires on the real server clock.

## Database / pgTAP

Command: `supabase test db --local --workdir /tmp/scamreport-e2e-5ipJ7N`

```text
/tmp/scamreport-e2e-5ipJ7N/supabase/tests/database/access.test.sql .. ok
All tests successful.
Files=1, Tests=80,  0 wallclock secs ( 0.06 usr  0.02 sys +  0.02 cusr  0.02 csys =  0.12 CPU)
Result: PASS

Connecting to local database...
psql:/tmp/scamreport-e2e-5ipJ7N/supabase/tests/database/access.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
A new version of Supabase CLI is available: v2.122.0 (currently installed v2.121.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

## Web / component tests (vitest + Testing Library)

Command: `bun run --cwd apps/web test`

```text
RUN  v5.0.5 /home/symphony/.treehouse/scamreport-v2-662c27/2/scamreport-v2/apps/web


 Test Files  7 passed (7)
      Tests  72 passed (72)
   Start at  21:25:21
   Duration  27.68s (tests 63%, environment 25%, import 7%, setup 4%, transform 1%)


$ vitest run
```

## API / six acceptance categories

Command: `bun test apps/api/tests --reporter=junit --reporter-outfile=/tmp/scamreport-e2e-5ipJ7N/api.xml`

```text
bun test v1.3.13 (bf2e2cec)


apps/api/tests/acceptance.test.ts:

 33 pass
 0 fail
 875 expect() calls
Ran 33 tests across 1 file. [15.73s]
```

## End-to-end / Chromium

Command: `bun x --no-install playwright test`

```text
Running 20 tests using 1 worker

  ✓   1 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › citizen browser session has the seeded identity and tenant (1.3s)
  ✓   2 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › moderator-a browser session has the seeded identity and tenant (1.4s)
  ✓   3 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › admin-a browser session has the seeded identity and tenant (1.3s)
  ✓   4 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › executive-a browser session has the seeded identity and tenant (1.3s)
  ✓   5 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › moderator-b browser session has the seeded identity and tenant (1.3s)
  ✓   6 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › admin-b browser session has the seeded identity and tenant (1.3s)
  ✓   7 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › executive-b browser session has the seeded identity and tenant (1.3s)
  ✓   8 [chromium] › e2e/boundaries.spec.ts:31:3 › Auth/Session › the same live browser token expires at real Auth and renders Session Expired (6.6s)
  ✓   9 [chromium] › e2e/boundaries.spec.ts:53:3 › Permission › citizen admin API is forbidden and admin workspace renders Unauthorized (1.7s)
  ✓  10 [chromium] › e2e/boundaries.spec.ts:69:3 › Cross-Tenant Denial › A moderator cannot read or mutate B report; B still sees the original state (2.7s)
  ✓  11 [chromium] › e2e/boundaries.spec.ts:94:5 › Security › executive-a sees only own aggregates, never personal or raw case fields (1.7s)
  ✓  12 [chromium] › e2e/boundaries.spec.ts:94:5 › Security › executive-b sees only own aggregates, never personal or raw case fields (1.7s)
  ✓  13 [chromium] › e2e/boundaries.spec.ts:118:3 › Security › browser caller JWT cannot bypass cross-tenant denial through Data API (2.5s)
  ✓  14 [chromium] › e2e/boundaries.spec.ts:133:3 › API Error › invalid browser-proxied input keeps the safe envelope and caller request ID (1.0s)
  ✓  15 [chromium] › e2e/boundaries.spec.ts:145:3 › Regression › browser sessions create with consent, verify, publish and withdraw through the real proxy (2.2s)
  ✓  16 [chromium] › e2e/ui-flows.spec.ts:28:3 › Auth/Session › mid-report real expiry keeps fields and photo bytes through password sign-in and one submission (9.9s)
  ✓  17 [chromium] › e2e/ui-flows.spec.ts:106:3 › Regression › citizen consented UI filing is verified by its moderator and appears in the public feed (6.8s)
  ✓  18 [chromium] › e2e/ui-flows.spec.ts:153:3 › Cross-Tenant Denial › A moderator opening a B report gets a real 404 and no report, contacts or evidence UI (4.1s)
  ✓  19 [chromium] › e2e/ui-flows.spec.ts:180:5 › Security › executive-a dashboard renders aggregates without requesting or rendering personal data (2.1s)
  ✓  20 [chromium] › e2e/ui-flows.spec.ts:180:5 › Security › executive-b dashboard renders aggregates without requesting or rendering personal data (2.6s)

  20 passed (1.7m)

[WebServer] $ bun run --filter @scamreport/web build
(node:3648661) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## End-to-end acceptance categories (Chromium)

Run: **passed**. Real seeded browser sessions exercise the production web/API proxy: access boundaries, mid-report expiry and password recovery with draft/photo bytes preserved, consented filing and moderator verification into the feed, foreign-report UI denial, and aggregate-only executive dashboards with network privacy assertions.

| Acceptance category | Passed | Failed / not run | Result |
|---|---:|---:|---|
| Auth/Session | 9 | 0 | PASS |
| Permission | 1 | 0 | PASS |
| Cross-Tenant Denial | 2 | 0 | PASS |
| API Error | 1 | 0 | PASS |
| Security | 5 | 0 | PASS |
| Regression | 2 | 0 | PASS |

| Category | Case | Result |
|---|---|---|
| Auth/Session | citizen browser session has the seeded identity and tenant | PASS |
| Auth/Session | moderator-a browser session has the seeded identity and tenant | PASS |
| Auth/Session | admin-a browser session has the seeded identity and tenant | PASS |
| Auth/Session | executive-a browser session has the seeded identity and tenant | PASS |
| Auth/Session | moderator-b browser session has the seeded identity and tenant | PASS |
| Auth/Session | admin-b browser session has the seeded identity and tenant | PASS |
| Auth/Session | executive-b browser session has the seeded identity and tenant | PASS |
| Auth/Session | the same live browser token expires at real Auth and renders Session Expired | PASS |
| Permission | citizen admin API is forbidden and admin workspace renders Unauthorized | PASS |
| Cross-Tenant Denial | A moderator cannot read or mutate B report; B still sees the original state | PASS |
| Security | executive-a sees only own aggregates, never personal or raw case fields | PASS |
| Security | executive-b sees only own aggregates, never personal or raw case fields | PASS |
| Security | browser caller JWT cannot bypass cross-tenant denial through Data API | PASS |
| API Error | invalid browser-proxied input keeps the safe envelope and caller request ID | PASS |
| Regression | browser sessions create with consent, verify, publish and withdraw through the real proxy | PASS |
| Auth/Session | mid-report real expiry keeps fields and photo bytes through password sign-in and one submission | PASS |
| Regression | citizen consented UI filing is verified by its moderator and appears in the public feed | PASS |
| Cross-Tenant Denial | A moderator opening a B report gets a real 404 and no report, contacts or evidence UI | PASS |
| Security | executive-a dashboard renders aggregates without requesting or rendering personal data | PASS |
| Security | executive-b dashboard renders aggregates without requesting or rendering personal data | PASS |

## Structured API cases (Bun JUnit output)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="33" assertions="875" failures="0" skipped="0" time="15.72872504">
  <testsuite name="apps/api/tests/acceptance.test.ts" file="apps/api/tests/acceptance.test.ts" tests="33" assertions="875" failures="0" skipped="0" time="0" hostname="omarchy">
    <testsuite name="Auth/Session" file="apps/api/tests/acceptance.test.ts" line="67" tests="3" assertions="16" failures="0" skipped="0" time="3.151" hostname="omarchy">
      <testcase name="missing and forged JWTs fail without exposing upstream details" classname="Auth/Session" time="0.101001" file="apps/api/tests/acceptance.test.ts" line="68" assertions="6" />
      <testcase name="a real locally signed token is accepted, then expires at the Auth boundary" classname="Auth/Session" time="2.954023" file="apps/api/tests/acceptance.test.ts" line="72" assertions="6" />
      <testcase name="Supabase refresh rotates credentials and keeps verified identity" classname="Auth/Session" time="0.096001" file="apps/api/tests/acceptance.test.ts" line="83" assertions="4" />
    </testsuite>
    <testsuite name="Permission" file="apps/api/tests/acceptance.test.ts" line="94" tests="13" assertions="228" failures="0" skipped="0" time="2.759" hostname="omarchy">
      <testcase name="moderators cannot manage memberships and admins cannot grant themselves roles" classname="Permission" time="0.256002" file="apps/api/tests/acceptance.test.ts" line="95" assertions="9" />
      <testcase name="admin manages another membership; revoked membership takes effect on an existing JWT" classname="Permission" time="0.177001" file="apps/api/tests/acceptance.test.ts" line="101" assertions="6" />
      <testcase name="contact sharing requires consent and is scoped to the assigned organization" classname="Permission" time="0.237002" file="apps/api/tests/acceptance.test.ts" line="111" assertions="10" />
      <testcase name="executive has aggregate access, never queue, contacts, audit or evidence" classname="Permission" time="0.192001" file="apps/api/tests/acceptance.test.ts" line="118" assertions="18" />
      <testcase name="roster names go to moderators and admins; sign-in emails only to admins; executives denied" classname="Permission" time="0.096001" file="apps/api/tests/acceptance.test.ts" line="128" assertions="12" />
      <testcase name="executive breakdown is counts only, for the executive’s own organization" classname="Permission" time="0.076001" file="apps/api/tests/acceptance.test.ts" line="137" assertions="34" />
      <testcase name="denied staff attempts are logged with their request ID; citizens cannot write any tenant log" classname="Permission" time="0.170001" file="apps/api/tests/acceptance.test.ts" line="144" assertions="15" />
      <testcase name="each staff view of a consented contact is audited with its request ID" classname="Permission" time="0.109001" file="apps/api/tests/acceptance.test.ts" line="159" assertions="6" />
      <testcase name="staff cannot read contacts through the Data API; only the audited function returns them" classname="Permission" time="0.181001" file="apps/api/tests/acceptance.test.ts" line="168" assertions="14" />
      <testcase name="staff refusals on consent and on citizen-only routes are logged for the organization" classname="Permission" time="0.128001" file="apps/api/tests/acceptance.test.ts" line="184" assertions="10" />
      <testcase name="queue tables show newest reports while Call next selects oldest pending" classname="Permission" time="0.304002" file="apps/api/tests/acceptance.test.ts" line="194" assertions="26" />
      <testcase name="former citizen owners follow staff contact rules in Data API, RPC and HTTP" classname="Permission" time="0.614005" file="apps/api/tests/acceptance.test.ts" line="214" assertions="50" />
      <testcase name="the audit filters denied entries on the server and labels tickets with the report’s own date" classname="Permission" time="0.219002" file="apps/api/tests/acceptance.test.ts" line="252" assertions="18" />
    </testsuite>
    <testsuite name="Cross-Tenant Denial" file="apps/api/tests/acceptance.test.ts" line="268" tests="3" assertions="37" failures="0" skipped="0" time="0.379" hostname="omarchy">
      <testcase name="queue, audit, membership and statistics cannot target a different organization" classname="Cross-Tenant Denial" time="0.084001" file="apps/api/tests/acceptance.test.ts" line="269" assertions="12" />
      <testcase name="foreign row IDs are invisible to moderation and citizen withdrawal" classname="Cross-Tenant Denial" time="0.112001" file="apps/api/tests/acceptance.test.ts" line="275" assertions="9" />
      <testcase name="report detail with history opens only inside the assigned organization" classname="Cross-Tenant Denial" time="0.183001" file="apps/api/tests/acceptance.test.ts" line="282" assertions="16" />
    </testsuite>
    <testsuite name="API Error" file="apps/api/tests/acceptance.test.ts" line="294" tests="3" assertions="33" failures="0" skipped="0" time="0.068" hostname="omarchy">
      <testcase name="malformed JSON, unknown fields, invalid amounts and query limits use one error shape" classname="API Error" time="0.027" file="apps/api/tests/acceptance.test.ts" line="295" assertions="21" />
      <testcase name="request ID is returned on success, validation and unknown routes" classname="API Error" time="0.017" file="apps/api/tests/acceptance.test.ts" line="305" assertions="9" />
      <testcase name="unreachable Auth is an internal failure, never an expired or invalid session" classname="API Error" time="0.024" file="apps/api/tests/acceptance.test.ts" line="314" assertions="3" />
    </testsuite>
    <testsuite name="Security" file="apps/api/tests/acceptance.test.ts" line="322" tests="5" assertions="67" failures="0" skipped="0" time="0.709" hostname="omarchy">
      <testcase name="direct Data API denies cross-tenant writes, self-escalation and executive raw rows" classname="Security" time="0.063" file="apps/api/tests/acceptance.test.ts" line="323" assertions="15" />
      <testcase name="public projection never includes identity, descriptions or contacts" classname="Security" time="0.042" file="apps/api/tests/acceptance.test.ts" line="339" assertions="16" />
      <testcase name="private evidence enforces owner upload, tenant read and executive denial" classname="Security" time="0.393003" file="apps/api/tests/acceptance.test.ts" line="347" assertions="20" />
      <testcase name="oversized known-length and chunked uploads retain validation errors and request IDs" classname="Security" time="0.110001" file="apps/api/tests/acceptance.test.ts" line="366" assertions="9" />
      <testcase name="ticket numbers are server-assigned and cannot be rewritten through the Data API" classname="Security" time="0.101001" file="apps/api/tests/acceptance.test.ts" line="383" assertions="7" />
    </testsuite>
    <testsuite name="Regression" file="apps/api/tests/acceptance.test.ts" line="395" tests="5" assertions="50" failures="0" skipped="0" time="0.616" hostname="omarchy">
      <testcase name="an owned ticket resolves by ID outside the newest list window; foreign IDs do not" classname="Regression" time="0.086001" file="apps/api/tests/acceptance.test.ts" line="396" assertions="11" />
      <testcase name="removed staff moderation stays identifiable after the report is withdrawn" classname="Regression" time="0.200002" file="apps/api/tests/acceptance.test.ts" line="403" assertions="8" />
      <testcase name="a quote and parenthesis request ID from a direct Data API write does not break the audit page" classname="Regression" time="0.100001" file="apps/api/tests/acceptance.test.ts" line="417" assertions="4" />
      <testcase name="create → moderate → public feed → withdraw commits correlated immutable audit" classname="Regression" time="0.202002" file="apps/api/tests/acceptance.test.ts" line="425" assertions="15" />
      <testcase name="OpenAPI documents the required contracts and bearer authorization" classname="Regression" time="0.028" file="apps/api/tests/acceptance.test.ts" line="441" assertions="12" />
    </testsuite>
    <testsuite name="Queue window boundary" file="apps/api/tests/acceptance.test.ts" line="452" tests="1" assertions="444" failures="0" skipped="0" time="2.268" hostname="omarchy">
      <testcase name="each tab keeps the newest 100 beyond the cap while next remains independent" classname="Queue window boundary" time="2.268018" file="apps/api/tests/acceptance.test.ts" line="453" assertions="444" />
    </testsuite>
  </testsuite>
</testsuites>

```
