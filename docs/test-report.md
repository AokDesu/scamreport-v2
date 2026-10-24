# Local acceptance test report

Generated: 2026-10-24T05:07:15.058Z

Environment: bun 1.3.13; supabase 2.121.0; local Supabase, fictional seed, caller JWTs. No service-role client.

| Suite | Result | Exit code | Seconds |
|---|---|---:|---:|
| Database / pgTAP | PASS | 0 | 3.28 |
| API / six acceptance categories | PASS | 0 | 8.57 |
| Web / component tests (vitest + Testing Library) | PASS | 0 | 12.90 |

API categories: Auth/Session, Permission, Cross-Tenant Denial, API Error, Security, Regression. The expiry test first uses an accepted locally signed JWT, then lets the real Auth server clock expire that same token. Database tests run inside a rolled-back transaction; API tests create fictional reports and withdraw them on cleanup.

## Database / pgTAP

Command: `supabase test db`

```text
/home/symphony/.treehouse/scamreport-v2-662c27/1/scamreport-v2/supabase/tests/database/access.test.sql .. ok
All tests successful.
Files=1, Tests=49,  0 wallclock secs ( 0.03 usr  0.02 sys +  0.02 cusr  0.00 csys =  0.07 CPU)
Result: PASS

Connecting to local database...
psql:/home/symphony/.treehouse/scamreport-v2-662c27/1/scamreport-v2/supabase/tests/database/access.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
A new version of Supabase CLI is available: v2.122.0 (currently installed v2.121.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

## API / six acceptance categories

Command: `bun test apps/api/tests --reporter=junit --reporter-outfile=/tmp/scamreport-tests-C6i28K/api.xml`

```text
bun test v1.3.13 (bf2e2cec)


apps/api/tests/acceptance.test.ts:

 24 pass
 0 fail
 291 expect() calls
Ran 24 tests across 1 file. [8.53s]
```

## Web / component tests (vitest + Testing Library)

Command: `bun run --cwd apps/web test`

```text
RUN  v5.0.5 /home/symphony/.treehouse/scamreport-v2-662c27/1/scamreport-v2/apps/web


 Test Files  3 passed (3)
      Tests  30 passed (30)
   Start at  12:07:01
   Duration  12.10s (tests 62%, environment 26%, import 6%, setup 5%, transform 1%)


$ vitest run
```

## Structured API cases (Bun JUnit output)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="24" assertions="291" failures="0" skipped="0" time="8.533877447">
  <testsuite name="apps/api/tests/acceptance.test.ts" file="apps/api/tests/acceptance.test.ts" tests="24" assertions="291" failures="0" skipped="0" time="0" hostname="omarchy">
    <testsuite name="Auth/Session" file="apps/api/tests/acceptance.test.ts" line="67" tests="3" assertions="16" failures="0" skipped="0" time="3.227" hostname="omarchy">
      <testcase name="missing and forged JWTs fail without exposing upstream details" classname="Auth/Session" time="0.103" file="apps/api/tests/acceptance.test.ts" line="68" assertions="6" />
      <testcase name="a real locally signed token is accepted, then expires at the Auth boundary" classname="Auth/Session" time="2.991013" file="apps/api/tests/acceptance.test.ts" line="72" assertions="6" />
      <testcase name="Supabase refresh rotates credentials and keeps verified identity" classname="Auth/Session" time="0.133001" file="apps/api/tests/acceptance.test.ts" line="83" assertions="4" />
    </testsuite>
    <testsuite name="Permission" file="apps/api/tests/acceptance.test.ts" line="94" tests="8" assertions="110" failures="0" skipped="0" time="1.256" hostname="omarchy">
      <testcase name="moderators cannot manage memberships and admins cannot grant themselves roles" classname="Permission" time="0.244001" file="apps/api/tests/acceptance.test.ts" line="95" assertions="9" />
      <testcase name="admin manages another membership; revoked membership takes effect on an existing JWT" classname="Permission" time="0.166001" file="apps/api/tests/acceptance.test.ts" line="101" assertions="6" />
      <testcase name="contact sharing requires consent and is scoped to the assigned organization" classname="Permission" time="0.236001" file="apps/api/tests/acceptance.test.ts" line="111" assertions="10" />
      <testcase name="executive has aggregate access, never queue, contacts, audit or evidence" classname="Permission" time="0.178001" file="apps/api/tests/acceptance.test.ts" line="118" assertions="18" />
      <testcase name="roster names go to moderators and admins; sign-in emails only to admins; executives denied" classname="Permission" time="0.085" file="apps/api/tests/acceptance.test.ts" line="128" assertions="12" />
      <testcase name="executive breakdown is counts only, for the executive’s own organization" classname="Permission" time="0.079" file="apps/api/tests/acceptance.test.ts" line="137" assertions="34" />
      <testcase name="denied staff attempts are logged with their request ID; citizens cannot write any tenant log" classname="Permission" time="0.158001" file="apps/api/tests/acceptance.test.ts" line="144" assertions="15" />
      <testcase name="each staff view of a consented contact is audited with its request ID" classname="Permission" time="0.11" file="apps/api/tests/acceptance.test.ts" line="159" assertions="6" />
    </testsuite>
    <testsuite name="Cross-Tenant Denial" file="apps/api/tests/acceptance.test.ts" line="169" tests="3" assertions="37" failures="0" skipped="0" time="0.425" hostname="omarchy">
      <testcase name="queue, audit, membership and statistics cannot target a different organization" classname="Cross-Tenant Denial" time="0.095" file="apps/api/tests/acceptance.test.ts" line="170" assertions="12" />
      <testcase name="foreign row IDs are invisible to moderation and citizen withdrawal" classname="Cross-Tenant Denial" time="0.108" file="apps/api/tests/acceptance.test.ts" line="176" assertions="9" />
      <testcase name="report detail with history opens only inside the assigned organization" classname="Cross-Tenant Denial" time="0.222001" file="apps/api/tests/acceptance.test.ts" line="183" assertions="16" />
    </testsuite>
    <testsuite name="API Error" file="apps/api/tests/acceptance.test.ts" line="195" tests="3" assertions="33" failures="0" skipped="0" time="0.088" hostname="omarchy">
      <testcase name="malformed JSON, unknown fields, invalid amounts and query limits use one error shape" classname="API Error" time="0.039" file="apps/api/tests/acceptance.test.ts" line="196" assertions="21" />
      <testcase name="request ID is returned on success, validation and unknown routes" classname="API Error" time="0.021" file="apps/api/tests/acceptance.test.ts" line="206" assertions="9" />
      <testcase name="unreachable Auth is an internal failure, never an expired or invalid session" classname="API Error" time="0.028" file="apps/api/tests/acceptance.test.ts" line="215" assertions="3" />
    </testsuite>
    <testsuite name="Security" file="apps/api/tests/acceptance.test.ts" line="223" tests="5" assertions="68" failures="0" skipped="0" time="0.674" hostname="omarchy">
      <testcase name="direct Data API denies cross-tenant writes, self-escalation and executive raw rows" classname="Security" time="0.062" file="apps/api/tests/acceptance.test.ts" line="224" assertions="15" />
      <testcase name="public projection never includes identity, descriptions or contacts" classname="Security" time="0.045" file="apps/api/tests/acceptance.test.ts" line="240" assertions="17" />
      <testcase name="private evidence enforces owner upload, tenant read and executive denial" classname="Security" time="0.344002" file="apps/api/tests/acceptance.test.ts" line="248" assertions="20" />
      <testcase name="oversized known-length and chunked uploads retain validation errors and request IDs" classname="Security" time="0.123001" file="apps/api/tests/acceptance.test.ts" line="267" assertions="9" />
      <testcase name="ticket numbers are server-assigned and cannot be rewritten through the Data API" classname="Security" time="0.1" file="apps/api/tests/acceptance.test.ts" line="284" assertions="7" />
    </testsuite>
    <testsuite name="Regression" file="apps/api/tests/acceptance.test.ts" line="296" tests="2" assertions="27" failures="0" skipped="0" time="0.273" hostname="omarchy">
      <testcase name="create → moderate → public feed → withdraw commits correlated immutable audit" classname="Regression" time="0.247001" file="apps/api/tests/acceptance.test.ts" line="297" assertions="15" />
      <testcase name="OpenAPI documents the required contracts and bearer authorization" classname="Regression" time="0.026" file="apps/api/tests/acceptance.test.ts" line="313" assertions="12" />
    </testsuite>
  </testsuite>
</testsuites>

```
