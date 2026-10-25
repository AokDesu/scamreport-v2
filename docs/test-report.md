# Local acceptance test report

Generated: 2026-10-25T04:55:41.844Z

Environment: bun 1.3.13; supabase 2.121.0; isolated local Supabase, fictional fresh seed, production web/API proxy, Chromium, caller JWTs. No service-role client.

Owned project: `scamreport-e2e-F3AkCh`; Supabase: `http://127.0.0.1:57421`; web: `http://127.0.0.1:57430`; API: `http://127.0.0.1:57431`.

| Suite | Result | Exit code | Seconds |
|---|---|---:|---:|
| Report / export privacy | PASS | 0 | 0.03 |
| Database / pgTAP | PASS | 0 | 3.17 |
| Web / component tests (vitest + Testing Library) | PASS | 0 | 32.65 |
| API / six acceptance categories | PASS | 0 | 14.71 |
| End-to-end / Chromium | PASS | 0 | 90.23 |

Acceptance categories: Auth/Session, Permission, Cross-Tenant Denial, API Error, Security, Regression. Database cases roll back. API tests use real Auth/Data API/Storage. Before Chromium runs, only this disposable database is reset to the fictional seed. Browser expiry uses a token accepted by Auth before the same token expires on the real server clock.

## Report / export privacy

Command: `bun test scripts/report.test.ts`

```text
bun test v1.3.13 (bf2e2cec)


 2 pass
 0 fail
 2 expect() calls
Ran 2 tests across 1 file. [23.00ms]
```

## Database / pgTAP

Command: `supabase test db --local --workdir [stack]`

```text
[stack]/supabase/tests/database/access.test.sql .. ok
All tests successful.
Files=1, Tests=80,  1 wallclock secs ( 0.07 usr  0.01 sys +  0.02 cusr  0.01 csys =  0.11 CPU)
Result: PASS

Connecting to local database...
psql:[stack]/supabase/tests/database/access.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
A new version of Supabase CLI is available: v2.122.0 (currently installed v2.121.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

## Web / component tests (vitest + Testing Library)

Command: `bun run --cwd apps/web test`

```text
RUN  v5.0.5 [repo]/apps/web


 Test Files  8 passed (8)
      Tests  79 passed (79)
   Start at  11:53:21
   Duration  32.09s (tests 69%, environment 21%, import 6%, setup 3%, transform 1%)


$ vitest run
```

## API / six acceptance categories

Command: `bun test apps/api/tests --reporter=junit --reporter-outfile=[stack]/api.xml`

```text
bun test v1.3.13 (bf2e2cec)


apps/api/tests/acceptance.test.ts:

 34 pass
 0 fail
 989 expect() calls
Ran 34 tests across 1 file. [14.68s]
```

## End-to-end / Chromium

Command: `bun x --no-install playwright test`

```text
Running 20 tests using 1 worker

  ✓   1 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › citizen browser session has the seeded identity and tenant (958ms)
  ✓   2 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › moderator-a browser session has the seeded identity and tenant (1.1s)
  ✓   3 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › admin-a browser session has the seeded identity and tenant (1.0s)
  ✓   4 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › executive-a browser session has the seeded identity and tenant (1.4s)
  ✓   5 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › moderator-b browser session has the seeded identity and tenant (992ms)
  ✓   6 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › admin-b browser session has the seeded identity and tenant (1.3s)
  ✓   7 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › executive-b browser session has the seeded identity and tenant (1.1s)
  ✓   8 [chromium] › e2e/boundaries.spec.ts:31:3 › Auth/Session › the same live browser token expires at real Auth and renders Session Expired (5.7s)
  ✓   9 [chromium] › e2e/boundaries.spec.ts:53:3 › Permission › citizen admin API is forbidden and admin workspace renders Unauthorized (1.3s)
  ✓  10 [chromium] › e2e/boundaries.spec.ts:69:3 › Cross-Tenant Denial › A moderator cannot read or mutate B report; B still sees the original state (2.1s)
  ✓  11 [chromium] › e2e/boundaries.spec.ts:94:5 › Security › executive-a sees only own aggregates, never personal or raw case fields (1.3s)
  ✓  12 [chromium] › e2e/boundaries.spec.ts:94:5 › Security › executive-b sees only own aggregates, never personal or raw case fields (1.7s)
  ✓  13 [chromium] › e2e/boundaries.spec.ts:118:3 › Security › browser caller JWT cannot bypass cross-tenant denial through Data API (1.9s)
  ✓  14 [chromium] › e2e/boundaries.spec.ts:133:3 › API Error › invalid browser-proxied input keeps the safe envelope and caller request ID (726ms)
  ✓  15 [chromium] › e2e/boundaries.spec.ts:145:3 › Regression › browser sessions create with consent, verify, publish and withdraw through the real proxy (1.8s)
  ✓  16 [chromium] › e2e/ui-flows.spec.ts:28:3 › Auth/Session › mid-report real expiry keeps fields and photo bytes through password sign-in and one submission (10.0s)
  ✓  17 [chromium] › e2e/ui-flows.spec.ts:114:3 › Regression › citizen consented UI filing is verified by its moderator and appears in the public feed (5.9s)
  ✓  18 [chromium] › e2e/ui-flows.spec.ts:161:3 › Cross-Tenant Denial › A moderator opening a B report gets a real 404 and no report, contacts or evidence UI (3.6s)
  ✓  19 [chromium] › e2e/ui-flows.spec.ts:188:5 › Security › executive-a dashboard renders aggregates without requesting or rendering personal data (2.3s)
  ✓  20 [chromium] › e2e/ui-flows.spec.ts:188:5 › Security › executive-b dashboard renders aggregates without requesting or rendering personal data (2.1s)

  20 passed (1.5m)

[WebServer] $ bun run --filter @scamreport/web build
(node:2613918) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
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
<testsuites name="bun test" tests="34" assertions="989" failures="0" skipped="0" time="14.680039116">
  <testsuite name="apps/api/tests/acceptance.test.ts" file="apps/api/tests/acceptance.test.ts" tests="34" assertions="989" failures="0" skipped="0" time="0" hostname="local">
    <testsuite name="Auth/Session" file="apps/api/tests/acceptance.test.ts" line="67" tests="3" assertions="16" failures="0" skipped="0" time="3.213" hostname="local">
      <testcase name="missing and forged JWTs fail without exposing upstream details" classname="Auth/Session" time="0.080001" file="apps/api/tests/acceptance.test.ts" line="68" assertions="6" />
      <testcase name="a real locally signed token is accepted, then expires at the Auth boundary" classname="Auth/Session" time="2.979019" file="apps/api/tests/acceptance.test.ts" line="72" assertions="6" />
      <testcase name="Supabase refresh rotates credentials and keeps verified identity" classname="Auth/Session" time="0.154001" file="apps/api/tests/acceptance.test.ts" line="83" assertions="4" />
    </testsuite>
    <testsuite name="Permission" file="apps/api/tests/acceptance.test.ts" line="94" tests="13" assertions="230" failures="0" skipped="0" time="2.644" hostname="local">
      <testcase name="moderators cannot manage memberships and admins cannot grant themselves roles" classname="Permission" time="0.216001" file="apps/api/tests/acceptance.test.ts" line="95" assertions="9" />
      <testcase name="admin manages another membership; revoked membership takes effect on an existing JWT" classname="Permission" time="0.181001" file="apps/api/tests/acceptance.test.ts" line="101" assertions="6" />
      <testcase name="contact sharing requires consent and is scoped to the assigned organization" classname="Permission" time="0.282002" file="apps/api/tests/acceptance.test.ts" line="111" assertions="12" />
      <testcase name="executive has aggregate access, never queue, contacts, audit or evidence" classname="Permission" time="0.211001" file="apps/api/tests/acceptance.test.ts" line="121" assertions="18" />
      <testcase name="roster names go to moderators and admins; sign-in emails only to admins; executives denied" classname="Permission" time="0.096001" file="apps/api/tests/acceptance.test.ts" line="131" assertions="12" />
      <testcase name="executive breakdown is counts only, for the executive’s own organization" classname="Permission" time="0.075" file="apps/api/tests/acceptance.test.ts" line="140" assertions="34" />
      <testcase name="denied staff attempts are logged with their request ID; citizens cannot write any tenant log" classname="Permission" time="0.167001" file="apps/api/tests/acceptance.test.ts" line="147" assertions="15" />
      <testcase name="each staff view of a consented contact is audited with its request ID" classname="Permission" time="0.106001" file="apps/api/tests/acceptance.test.ts" line="162" assertions="6" />
      <testcase name="staff cannot read contacts through the Data API; only the audited function returns them" classname="Permission" time="0.208001" file="apps/api/tests/acceptance.test.ts" line="171" assertions="14" />
      <testcase name="staff refusals on consent and on citizen-only routes are logged for the organization" classname="Permission" time="0.147001" file="apps/api/tests/acceptance.test.ts" line="187" assertions="10" />
      <testcase name="queue tables show newest reports while Call next selects oldest pending" classname="Permission" time="0.283002" file="apps/api/tests/acceptance.test.ts" line="197" assertions="26" />
      <testcase name="former citizen owners follow staff contact rules in Data API, RPC and HTTP" classname="Permission" time="0.509003" file="apps/api/tests/acceptance.test.ts" line="217" assertions="50" />
      <testcase name="the audit filters denied entries on the server and labels tickets with the report’s own date" classname="Permission" time="0.163001" file="apps/api/tests/acceptance.test.ts" line="255" assertions="18" />
    </testsuite>
    <testsuite name="Cross-Tenant Denial" file="apps/api/tests/acceptance.test.ts" line="271" tests="3" assertions="37" failures="0" skipped="0" time="0.277" hostname="local">
      <testcase name="queue, audit, membership and statistics cannot target a different organization" classname="Cross-Tenant Denial" time="0.07" file="apps/api/tests/acceptance.test.ts" line="272" assertions="12" />
      <testcase name="foreign row IDs are invisible to moderation and citizen withdrawal" classname="Cross-Tenant Denial" time="0.082001" file="apps/api/tests/acceptance.test.ts" line="278" assertions="9" />
      <testcase name="report detail with history opens only inside the assigned organization" classname="Cross-Tenant Denial" time="0.125001" file="apps/api/tests/acceptance.test.ts" line="285" assertions="16" />
    </testsuite>
    <testsuite name="API Error" file="apps/api/tests/acceptance.test.ts" line="297" tests="3" assertions="33" failures="0" skipped="0" time="0.052" hostname="local">
      <testcase name="malformed JSON, unknown fields, invalid amounts and query limits use one error shape" classname="API Error" time="0.018" file="apps/api/tests/acceptance.test.ts" line="298" assertions="21" />
      <testcase name="request ID is returned on success, validation and unknown routes" classname="API Error" time="0.015" file="apps/api/tests/acceptance.test.ts" line="308" assertions="9" />
      <testcase name="unreachable Auth is an internal failure, never an expired or invalid session" classname="API Error" time="0.019" file="apps/api/tests/acceptance.test.ts" line="317" assertions="3" />
    </testsuite>
    <testsuite name="Security" file="apps/api/tests/acceptance.test.ts" line="325" tests="5" assertions="67" failures="0" skipped="0" time="0.546" hostname="local">
      <testcase name="direct Data API denies cross-tenant writes, self-escalation and executive raw rows" classname="Security" time="0.042" file="apps/api/tests/acceptance.test.ts" line="326" assertions="15" />
      <testcase name="public projection never includes identity, descriptions or contacts" classname="Security" time="0.031" file="apps/api/tests/acceptance.test.ts" line="342" assertions="16" />
      <testcase name="private evidence enforces owner upload, tenant read and executive denial" classname="Security" time="0.300002" file="apps/api/tests/acceptance.test.ts" line="350" assertions="20" />
      <testcase name="oversized known-length and chunked uploads retain validation errors and request IDs" classname="Security" time="0.092001" file="apps/api/tests/acceptance.test.ts" line="369" assertions="9" />
      <testcase name="ticket numbers are server-assigned and cannot be rewritten through the Data API" classname="Security" time="0.081001" file="apps/api/tests/acceptance.test.ts" line="386" assertions="7" />
    </testsuite>
    <testsuite name="Regression" file="apps/api/tests/acceptance.test.ts" line="398" tests="5" assertions="50" failures="0" skipped="0" time="0.468" hostname="local">
      <testcase name="an owned ticket resolves by ID outside the newest list window; foreign IDs do not" classname="Regression" time="0.06" file="apps/api/tests/acceptance.test.ts" line="399" assertions="11" />
      <testcase name="removed staff moderation stays identifiable after the report is withdrawn" classname="Regression" time="0.151001" file="apps/api/tests/acceptance.test.ts" line="406" assertions="8" />
      <testcase name="a quote and parenthesis request ID from a direct Data API write does not break the audit page" classname="Regression" time="0.078" file="apps/api/tests/acceptance.test.ts" line="420" assertions="4" />
      <testcase name="create → moderate → public feed → withdraw commits correlated immutable audit" classname="Regression" time="0.159001" file="apps/api/tests/acceptance.test.ts" line="428" assertions="15" />
      <testcase name="OpenAPI documents the required contracts and bearer authorization" classname="Regression" time="0.02" file="apps/api/tests/acceptance.test.ts" line="444" assertions="12" />
    </testsuite>
    <testsuite name="Queue window boundary" file="apps/api/tests/acceptance.test.ts" line="455" tests="1" assertions="444" failures="0" skipped="0" time="1.871" hostname="local">
      <testcase name="each tab keeps the newest 100 beyond the cap while next remains independent" classname="Queue window boundary" time="1.871012" file="apps/api/tests/acceptance.test.ts" line="456" assertions="444" />
    </testsuite>
    <testsuite name="Audit attribution boundary" file="apps/api/tests/acceptance.test.ts" line="492" tests="1" assertions="112" failures="0" skipped="0" time="1.602" hostname="local">
      <testcase name="one report with 105 decisions retains staff attribution across audit pages and a citizen withdrawal" classname="Audit attribution boundary" time="1.60201" file="apps/api/tests/acceptance.test.ts" line="493" assertions="112" />
    </testsuite>
  </testsuite>
</testsuites>

```
