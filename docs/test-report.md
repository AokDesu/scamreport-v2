# Local acceptance test report

Generated: 2026-10-24T15:32:30.473Z

Environment: bun 1.3.13; supabase 2.121.0; isolated local Supabase, fictional fresh seed, production web/API proxy, Chromium, caller JWTs. No service-role client.

Owned project: `scamreport-e2e-MNVMCk`; Supabase: `http://127.0.0.1:58321`; web: `http://127.0.0.1:58330`; API: `http://127.0.0.1:58331`.

| Suite | Result | Exit code | Seconds |
|---|---|---:|---:|
| Database / pgTAP | PASS | 0 | 4.80 |
| Web / component tests (vitest + Testing Library) | PASS | 0 | 34.16 |
| API / six acceptance categories | PASS | 0 | 19.70 |
| End-to-end / Chromium | FAIL | 1 | 111.39 |

Acceptance categories: Auth/Session, Permission, Cross-Tenant Denial, API Error, Security, Regression. Database cases roll back. API tests use real Auth/Data API/Storage. Before Chromium runs, only this disposable database is reset to the fictional seed. Browser expiry uses a token accepted by Auth before the same token expires on the real server clock.

## Database / pgTAP

Command: `supabase test db --local --workdir /home/symphony/Documents/projects/firstmate/data/srv2-p2-fixes/tmp/scamreport-e2e-MNVMCk`

```text
/home/symphony/Documents/projects/firstmate/data/srv2-p2-fixes/tmp/scamreport-e2e-MNVMCk/supabase/tests/database/access.test.sql .. ok
All tests successful.
Files=1, Tests=80,  0 wallclock secs ( 0.07 usr  0.02 sys +  0.02 cusr  0.02 csys =  0.13 CPU)
Result: PASS

Connecting to local database...
psql:/home/symphony/Documents/projects/firstmate/data/srv2-p2-fixes/tmp/scamreport-e2e-MNVMCk/supabase/tests/database/access.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
A new version of Supabase CLI is available: v2.122.0 (currently installed v2.121.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

## Web / component tests (vitest + Testing Library)

Command: `bun run --cwd apps/web test`

```text
RUN  v5.0.5 /home/symphony/.treehouse/scamreport-v2-662c27/1/scamreport-v2/apps/web


 Test Files  7 passed (7)
      Tests  76 passed (76)
   Start at  22:29:41
   Duration  33.30s (tests 62%, environment 25%, import 5%, setup 4%, transform 3%)


$ vitest run
```

## API / six acceptance categories

Command: `bun test apps/api/tests --reporter=junit --reporter-outfile=/home/symphony/Documents/projects/firstmate/data/srv2-p2-fixes/tmp/scamreport-e2e-MNVMCk/api.xml`

```text
bun test v1.3.13 (bf2e2cec)


apps/api/tests/acceptance.test.ts:

 34 pass
 0 fail
 987 expect() calls
Ran 34 tests across 1 file. [18.79s]
```

## End-to-end / Chromium

Command: `bun x --no-install playwright test`

```text
Running 20 tests using 1 worker

  ✓   1 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › citizen browser session has the seeded identity and tenant (1.5s)
  ✓   2 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › moderator-a browser session has the seeded identity and tenant (1.4s)
  ✓   3 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › admin-a browser session has the seeded identity and tenant (1.1s)
  ✓   4 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › executive-a browser session has the seeded identity and tenant (1.0s)
  ✓   5 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › moderator-b browser session has the seeded identity and tenant (1.0s)
  ✓   6 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › admin-b browser session has the seeded identity and tenant (1.4s)
  ✓   7 [chromium] › e2e/boundaries.spec.ts:19:5 › Auth/Session › executive-b browser session has the seeded identity and tenant (1.0s)
  ✓   8 [chromium] › e2e/boundaries.spec.ts:31:3 › Auth/Session › the same live browser token expires at real Auth and renders Session Expired (5.9s)
  ✓   9 [chromium] › e2e/boundaries.spec.ts:53:3 › Permission › citizen admin API is forbidden and admin workspace renders Unauthorized (1.3s)
  ✓  10 [chromium] › e2e/boundaries.spec.ts:69:3 › Cross-Tenant Denial › A moderator cannot read or mutate B report; B still sees the original state (2.8s)
  ✓  11 [chromium] › e2e/boundaries.spec.ts:94:5 › Security › executive-a sees only own aggregates, never personal or raw case fields (1.8s)
  ✓  12 [chromium] › e2e/boundaries.spec.ts:94:5 › Security › executive-b sees only own aggregates, never personal or raw case fields (1.8s)
  ✓  13 [chromium] › e2e/boundaries.spec.ts:118:3 › Security › browser caller JWT cannot bypass cross-tenant denial through Data API (2.6s)
  ✓  14 [chromium] › e2e/boundaries.spec.ts:133:3 › API Error › invalid browser-proxied input keeps the safe envelope and caller request ID (880ms)
  ✓  15 [chromium] › e2e/boundaries.spec.ts:145:3 › Regression › browser sessions create with consent, verify, publish and withdraw through the real proxy (1.7s)
  ✘  16 [chromium] › e2e/ui-flows.spec.ts:28:3 › Auth/Session › mid-report real expiry keeps fields and photo bytes through password sign-in and one submission (17.7s)
  ✓  17 [chromium] › e2e/ui-flows.spec.ts:106:3 › Regression › citizen consented UI filing is verified by its moderator and appears in the public feed (6.9s)
  ✓  18 [chromium] › e2e/ui-flows.spec.ts:153:3 › Cross-Tenant Denial › A moderator opening a B report gets a real 404 and no report, contacts or evidence UI (4.2s)
  ✓  19 [chromium] › e2e/ui-flows.spec.ts:180:5 › Security › executive-a dashboard renders aggregates without requesting or rendering personal data (2.7s)
  ✓  20 [chromium] › e2e/ui-flows.spec.ts:180:5 › Security › executive-b dashboard renders aggregates without requesting or rendering personal data (2.6s)


  1) [chromium] › e2e/ui-flows.spec.ts:28:3 › Auth/Session › mid-report real expiry keeps fields and photo bytes through password sign-in and one submission 

    Error: expect(page).toHaveURL(expected) failed

    Expected pattern: /\/citizen\/report\?step=consent$/
    Received string:  "http://127.0.0.1:58330/citizen/feed"
    Timeout: 10000ms

    Call log:
      - Expect "toHaveURL" with timeout 10000ms
        2 × locator resolved to <html lang="en">…</html>
          - unexpected value "http://127.0.0.1:58330/session-expired"
        21 × locator resolved to <html lang="en">…</html>
           - unexpected value "http://127.0.0.1:58330/citizen/feed"


      63 |     await page.getByRole('button',{name:'Sign in again',exact:true}).click();
      64 |     expect((await authenticated).status()).toBe(200);
    > 65 |     await expect(page).toHaveURL(/\/citizen\/report\?step=consent$/);
         |                        ^
      66 |     await expect(page.getByRole('textbox',{name:'Email',exact:true})).toHaveValue('expiry@demo.example.test');
      67 |     await expect(page.getByRole('textbox',{name:'Phone',exact:true})).toHaveValue('0X-EXPIRY-234');
      68 |     await expect(page.getByRole('radio',{name:'Demo River Bank',exact:true})).toBeChecked();
        at /home/symphony/.treehouse/scamreport-v2-662c27/1/scamreport-v2/e2e/ui-flows.spec.ts:65:24

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    ../../../../Documents/projects/firstmate/data/srv2-p2-fixes/full-pack/ui-flows-Auth-Session-mid--29063--sign-in-and-one-submission-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: ../../../../Documents/projects/firstmate/data/srv2-p2-fixes/full-pack/ui-flows-Auth-Session-mid--29063--sign-in-and-one-submission-chromium/error-context.md

    attachment #3: trace (application/zip) ─────────────────────────────────────────────────────────
    ../../../../Documents/projects/firstmate/data/srv2-p2-fixes/full-pack/ui-flows-Auth-Session-mid--29063--sign-in-and-one-submission-chromium/trace.zip
    Usage:

        npx playwright show-trace ../../../../Documents/projects/firstmate/data/srv2-p2-fixes/full-pack/ui-flows-Auth-Session-mid--29063--sign-in-and-one-submission-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  1 failed
    [chromium] › e2e/ui-flows.spec.ts:28:3 › Auth/Session › mid-report real expiry keeps fields and photo bytes through password sign-in and one submission 
  19 passed (1.8m)

[WebServer] $ bun run --filter @scamreport/web build
(node:242802) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:258629) Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.
(Use `node --trace-warnings ...` to show where the warning was created)
```

## End-to-end acceptance categories (Chromium)

Run: **failed**. Real seeded browser sessions exercise the production web/API proxy: access boundaries, mid-report expiry and password recovery with draft/photo bytes preserved, consented filing and moderator verification into the feed, foreign-report UI denial, and aggregate-only executive dashboards with network privacy assertions.

| Acceptance category | Passed | Failed / not run | Result |
|---|---:|---:|---|
| Auth/Session | 8 | 1 | FAIL / missing coverage |
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
| Auth/Session | mid-report real expiry keeps fields and photo bytes through password sign-in and one submission | FAIL |
| Regression | citizen consented UI filing is verified by its moderator and appears in the public feed | PASS |
| Cross-Tenant Denial | A moderator opening a B report gets a real 404 and no report, contacts or evidence UI | PASS |
| Security | executive-a dashboard renders aggregates without requesting or rendering personal data | PASS |
| Security | executive-b dashboard renders aggregates without requesting or rendering personal data | PASS |

## Structured API cases (Bun JUnit output)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="34" assertions="987" failures="0" skipped="0" time="18.793845944">
  <testsuite name="apps/api/tests/acceptance.test.ts" file="apps/api/tests/acceptance.test.ts" tests="34" assertions="987" failures="0" skipped="0" time="0" hostname="omarchy">
    <testsuite name="Auth/Session" file="apps/api/tests/acceptance.test.ts" line="67" tests="3" assertions="16" failures="0" skipped="0" time="2.693" hostname="omarchy">
      <testcase name="missing and forged JWTs fail without exposing upstream details" classname="Auth/Session" time="0.116001" file="apps/api/tests/acceptance.test.ts" line="68" assertions="6" />
      <testcase name="a real locally signed token is accepted, then expires at the Auth boundary" classname="Auth/Session" time="2.46502" file="apps/api/tests/acceptance.test.ts" line="72" assertions="6" />
      <testcase name="Supabase refresh rotates credentials and keeps verified identity" classname="Auth/Session" time="0.112001" file="apps/api/tests/acceptance.test.ts" line="83" assertions="4" />
    </testsuite>
    <testsuite name="Permission" file="apps/api/tests/acceptance.test.ts" line="94" tests="13" assertions="228" failures="0" skipped="0" time="3.767" hostname="omarchy">
      <testcase name="moderators cannot manage memberships and admins cannot grant themselves roles" classname="Permission" time="0.227002" file="apps/api/tests/acceptance.test.ts" line="95" assertions="9" />
      <testcase name="admin manages another membership; revoked membership takes effect on an existing JWT" classname="Permission" time="0.194002" file="apps/api/tests/acceptance.test.ts" line="101" assertions="6" />
      <testcase name="contact sharing requires consent and is scoped to the assigned organization" classname="Permission" time="0.266002" file="apps/api/tests/acceptance.test.ts" line="111" assertions="10" />
      <testcase name="executive has aggregate access, never queue, contacts, audit or evidence" classname="Permission" time="0.208002" file="apps/api/tests/acceptance.test.ts" line="118" assertions="18" />
      <testcase name="roster names go to moderators and admins; sign-in emails only to admins; executives denied" classname="Permission" time="0.102001" file="apps/api/tests/acceptance.test.ts" line="128" assertions="12" />
      <testcase name="executive breakdown is counts only, for the executive’s own organization" classname="Permission" time="0.082001" file="apps/api/tests/acceptance.test.ts" line="137" assertions="34" />
      <testcase name="denied staff attempts are logged with their request ID; citizens cannot write any tenant log" classname="Permission" time="0.176001" file="apps/api/tests/acceptance.test.ts" line="144" assertions="15" />
      <testcase name="each staff view of a consented contact is audited with its request ID" classname="Permission" time="0.159001" file="apps/api/tests/acceptance.test.ts" line="159" assertions="6" />
      <testcase name="staff cannot read contacts through the Data API; only the audited function returns them" classname="Permission" time="0.223002" file="apps/api/tests/acceptance.test.ts" line="168" assertions="14" />
      <testcase name="staff refusals on consent and on citizen-only routes are logged for the organization" classname="Permission" time="0.163001" file="apps/api/tests/acceptance.test.ts" line="184" assertions="10" />
      <testcase name="queue tables show newest reports while Call next selects oldest pending" classname="Permission" time="1.016008" file="apps/api/tests/acceptance.test.ts" line="194" assertions="26" />
      <testcase name="former citizen owners follow staff contact rules in Data API, RPC and HTTP" classname="Permission" time="0.694006" file="apps/api/tests/acceptance.test.ts" line="214" assertions="50" />
      <testcase name="the audit filters denied entries on the server and labels tickets with the report’s own date" classname="Permission" time="0.257002" file="apps/api/tests/acceptance.test.ts" line="252" assertions="18" />
    </testsuite>
    <testsuite name="Cross-Tenant Denial" file="apps/api/tests/acceptance.test.ts" line="268" tests="3" assertions="37" failures="0" skipped="0" time="0.411" hostname="omarchy">
      <testcase name="queue, audit, membership and statistics cannot target a different organization" classname="Cross-Tenant Denial" time="0.089001" file="apps/api/tests/acceptance.test.ts" line="269" assertions="12" />
      <testcase name="foreign row IDs are invisible to moderation and citizen withdrawal" classname="Cross-Tenant Denial" time="0.121001" file="apps/api/tests/acceptance.test.ts" line="275" assertions="9" />
      <testcase name="report detail with history opens only inside the assigned organization" classname="Cross-Tenant Denial" time="0.201002" file="apps/api/tests/acceptance.test.ts" line="282" assertions="16" />
    </testsuite>
    <testsuite name="API Error" file="apps/api/tests/acceptance.test.ts" line="294" tests="3" assertions="33" failures="0" skipped="0" time="0.073" hostname="omarchy">
      <testcase name="malformed JSON, unknown fields, invalid amounts and query limits use one error shape" classname="API Error" time="0.023" file="apps/api/tests/acceptance.test.ts" line="295" assertions="21" />
      <testcase name="request ID is returned on success, validation and unknown routes" classname="API Error" time="0.024" file="apps/api/tests/acceptance.test.ts" line="305" assertions="9" />
      <testcase name="unreachable Auth is an internal failure, never an expired or invalid session" classname="API Error" time="0.026" file="apps/api/tests/acceptance.test.ts" line="314" assertions="3" />
    </testsuite>
    <testsuite name="Security" file="apps/api/tests/acceptance.test.ts" line="322" tests="5" assertions="67" failures="0" skipped="0" time="0.697" hostname="omarchy">
      <testcase name="direct Data API denies cross-tenant writes, self-escalation and executive raw rows" classname="Security" time="0.063001" file="apps/api/tests/acceptance.test.ts" line="323" assertions="15" />
      <testcase name="public projection never includes identity, descriptions or contacts" classname="Security" time="0.043" file="apps/api/tests/acceptance.test.ts" line="339" assertions="16" />
      <testcase name="private evidence enforces owner upload, tenant read and executive denial" classname="Security" time="0.382003" file="apps/api/tests/acceptance.test.ts" line="347" assertions="20" />
      <testcase name="oversized known-length and chunked uploads retain validation errors and request IDs" classname="Security" time="0.109001" file="apps/api/tests/acceptance.test.ts" line="366" assertions="9" />
      <testcase name="ticket numbers are server-assigned and cannot be rewritten through the Data API" classname="Security" time="0.100001" file="apps/api/tests/acceptance.test.ts" line="383" assertions="7" />
    </testsuite>
    <testsuite name="Regression" file="apps/api/tests/acceptance.test.ts" line="395" tests="5" assertions="50" failures="0" skipped="0" time="0.604" hostname="omarchy">
      <testcase name="an owned ticket resolves by ID outside the newest list window; foreign IDs do not" classname="Regression" time="0.078001" file="apps/api/tests/acceptance.test.ts" line="396" assertions="11" />
      <testcase name="removed staff moderation stays identifiable after the report is withdrawn" classname="Regression" time="0.170001" file="apps/api/tests/acceptance.test.ts" line="403" assertions="8" />
      <testcase name="a quote and parenthesis request ID from a direct Data API write does not break the audit page" classname="Regression" time="0.107001" file="apps/api/tests/acceptance.test.ts" line="417" assertions="4" />
      <testcase name="create → moderate → public feed → withdraw commits correlated immutable audit" classname="Regression" time="0.227002" file="apps/api/tests/acceptance.test.ts" line="425" assertions="15" />
      <testcase name="OpenAPI documents the required contracts and bearer authorization" classname="Regression" time="0.022" file="apps/api/tests/acceptance.test.ts" line="441" assertions="12" />
    </testsuite>
    <testsuite name="Queue window boundary" file="apps/api/tests/acceptance.test.ts" line="452" tests="1" assertions="444" failures="0" skipped="0" time="2.113" hostname="omarchy">
      <testcase name="each tab keeps the newest 100 beyond the cap while next remains independent" classname="Queue window boundary" time="2.113017" file="apps/api/tests/acceptance.test.ts" line="453" assertions="444" />
    </testsuite>
    <testsuite name="Audit attribution boundary" file="apps/api/tests/acceptance.test.ts" line="489" tests="1" assertions="112" failures="0" skipped="0" time="3.244" hostname="omarchy">
      <testcase name="one report with 105 decisions retains staff attribution across audit pages and a citizen withdrawal" classname="Audit attribution boundary" time="3.244026" file="apps/api/tests/acceptance.test.ts" line="490" assertions="112" />
    </testsuite>
  </testsuite>
</testsuites>

```
