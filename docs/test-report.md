# Local acceptance test report

Generated: 2026-10-23T15:39:53.629Z

Environment: bun 1.3.13; supabase 2.121.0; local Supabase, fictional seed, caller JWTs. No service-role client.

| Suite | Result | Exit code | Seconds |
|---|---|---:|---:|
| Database / pgTAP | PASS | 0 | 2.18 |
| API / six acceptance categories | PASS | 0 | 5.26 |

API categories: Auth/Session, Permission, Cross-Tenant Denial, API Error, Security, Regression. The expiry test first uses an accepted locally signed JWT, then lets the real Auth server clock expire that same token. Database tests run inside a rolled-back transaction; API tests create fictional reports and withdraw them on cleanup.

## Database / pgTAP

Command: `supabase test db`

```text
/home/symphony/.treehouse/scamreport-v2-662c27/2/scamreport-v2/supabase/tests/database/access.test.sql .. ok
All tests successful.
Files=1, Tests=49,  0 wallclock secs ( 0.02 usr  0.01 sys +  0.01 cusr  0.00 csys =  0.04 CPU)
Result: PASS

Connecting to local database...
psql:/home/symphony/.treehouse/scamreport-v2-662c27/2/scamreport-v2/supabase/tests/database/access.test.sql:2: NOTICE:  extension "pgtap" already exists, skipping
A new version of Supabase CLI is available: v2.122.0 (currently installed v2.121.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

## API / six acceptance categories

Command: `bun test apps/api/tests --reporter=junit --reporter-outfile=/tmp/scamreport-tests-qq7Avp/api.xml`

```text
bun test v1.3.13 (bf2e2cec)


apps/api/tests/acceptance.test.ts:

 17 pass
 0 fail
 182 expect() calls
Ran 17 tests across 1 file. [5.24s]
```

## Structured API cases (Bun JUnit output)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="bun test" tests="17" assertions="182" failures="0" skipped="0" time="5.243427162">
  <testsuite name="apps/api/tests/acceptance.test.ts" file="apps/api/tests/acceptance.test.ts" tests="17" assertions="182" failures="0" skipped="0" time="0" hostname="omarchy">
    <testsuite name="Auth/Session" file="apps/api/tests/acceptance.test.ts" line="67" tests="3" assertions="16" failures="0" skipped="0" time="2.671" hostname="omarchy">
      <testcase name="missing and forged JWTs fail without exposing upstream details" classname="Auth/Session" time="0.070001" file="apps/api/tests/acceptance.test.ts" line="68" assertions="6" />
      <testcase name="a real locally signed token is accepted, then expires at the Auth boundary" classname="Auth/Session" time="2.561032" file="apps/api/tests/acceptance.test.ts" line="72" assertions="6" />
      <testcase name="Supabase refresh rotates credentials and keeps verified identity" classname="Auth/Session" time="0.04" file="apps/api/tests/acceptance.test.ts" line="83" assertions="4" />
    </testsuite>
    <testsuite name="Permission" file="apps/api/tests/acceptance.test.ts" line="94" tests="4" assertions="43" failures="0" skipped="0" time="0.409" hostname="omarchy">
      <testcase name="moderators cannot manage memberships and admins cannot grant themselves roles" classname="Permission" time="0.090001" file="apps/api/tests/acceptance.test.ts" line="95" assertions="9" />
      <testcase name="admin manages another membership; revoked membership takes effect on an existing JWT" classname="Permission" time="0.090001" file="apps/api/tests/acceptance.test.ts" line="101" assertions="6" />
      <testcase name="contact sharing requires consent and is scoped to the assigned organization" classname="Permission" time="0.140002" file="apps/api/tests/acceptance.test.ts" line="111" assertions="10" />
      <testcase name="executive has aggregate access, never queue, contacts, audit or evidence" classname="Permission" time="0.089001" file="apps/api/tests/acceptance.test.ts" line="118" assertions="18" />
    </testsuite>
    <testsuite name="Cross-Tenant Denial" file="apps/api/tests/acceptance.test.ts" line="129" tests="2" assertions="21" failures="0" skipped="0" time="0.098" hostname="omarchy">
      <testcase name="queue, audit, membership and statistics cannot target a different organization" classname="Cross-Tenant Denial" time="0.03" file="apps/api/tests/acceptance.test.ts" line="130" assertions="12" />
      <testcase name="foreign row IDs are invisible to moderation and citizen withdrawal" classname="Cross-Tenant Denial" time="0.068001" file="apps/api/tests/acceptance.test.ts" line="136" assertions="9" />
    </testsuite>
    <testsuite name="API Error" file="apps/api/tests/acceptance.test.ts" line="144" tests="3" assertions="33" failures="0" skipped="0" time="0.047" hostname="omarchy">
      <testcase name="malformed JSON, unknown fields, invalid amounts and query limits use one error shape" classname="API Error" time="0.02" file="apps/api/tests/acceptance.test.ts" line="145" assertions="21" />
      <testcase name="request ID is returned on success, validation and unknown routes" classname="API Error" time="0.009" file="apps/api/tests/acceptance.test.ts" line="155" assertions="9" />
      <testcase name="unreachable Auth is an internal failure, never an expired or invalid session" classname="API Error" time="0.018" file="apps/api/tests/acceptance.test.ts" line="164" assertions="3" />
    </testsuite>
    <testsuite name="Security" file="apps/api/tests/acceptance.test.ts" line="172" tests="3" assertions="42" failures="0" skipped="0" time="0.196" hostname="omarchy">
      <testcase name="direct Data API denies cross-tenant writes, self-escalation and executive raw rows" classname="Security" time="0.028" file="apps/api/tests/acceptance.test.ts" line="173" assertions="15" />
      <testcase name="public projection never includes identity, descriptions or contacts" classname="Security" time="0.021" file="apps/api/tests/acceptance.test.ts" line="189" assertions="7" />
      <testcase name="private evidence enforces owner upload, tenant read and executive denial" classname="Security" time="0.147002" file="apps/api/tests/acceptance.test.ts" line="197" assertions="20" />
    </testsuite>
    <testsuite name="Regression" file="apps/api/tests/acceptance.test.ts" line="217" tests="2" assertions="27" failures="0" skipped="0" time="0.125" hostname="omarchy">
      <testcase name="create → moderate → public feed → withdraw commits correlated immutable audit" classname="Regression" time="0.107001" file="apps/api/tests/acceptance.test.ts" line="218" assertions="15" />
      <testcase name="OpenAPI documents the required contracts and bearer authorization" classname="Regression" time="0.018" file="apps/api/tests/acceptance.test.ts" line="234" assertions="12" />
    </testsuite>
  </testsuite>
</testsuites>

```
