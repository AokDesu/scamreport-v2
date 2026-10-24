import { expect, test } from 'bun:test';
import { sanitizeReport } from './report';

const paths: Array<readonly [string, string]> = [
  ['/home/test user', '[home]'],
  ['/home/test user/project', '[repo]'],
  ['/tmp', '[temp]'],
  ['/tmp/owned stack', '[stack]'],
  ['/home/test user/evidence', '[artifacts]'],
  ['private-workstation', '[local-host]'],
];

test('shareable reports remove machine paths and host identity across commands, output and XML', () => {
  const input = 'Command: supabase test db --workdir /tmp/owned stack\n'
    + 'RUN /home/test user/project/apps/web\n'
    + 'psql:/tmp/owned stack/supabase/tests/database/access.test.sql:2\n'
    + 'Screenshot: /home/test user/evidence/failure.png\n'
    + 'Cache: /home/test user/.cache; temporary: /tmp/other/file\n'
    + '<testsuite hostname="private-workstation" file="/home/test user/project/apps/api/tests/acceptance.test.ts">\n'
    + "<testsuite hostname='another-machine'>\nprivate-workstation";
  const output = sanitizeReport(input, paths);
  expect(output).toBe('Command: supabase test db --workdir [stack]\n'
    + 'RUN [repo]/apps/web\n'
    + 'psql:[stack]/supabase/tests/database/access.test.sql:2\n'
    + 'Screenshot: [artifacts]/failure.png\n'
    + 'Cache: [home]/.cache; temporary: [temp]/other/file\n'
    + '<testsuite hostname="local" file="[repo]/apps/api/tests/acceptance.test.ts">\n'
    + "<testsuite hostname='local'>\n[local-host]");
});

test('redaction retains failures, diagnostics, counts, timing and the origins actually tested', () => {
  const evidence = 'Generated: 2026-10-25T00:00:00Z\n'
    + '| API acceptance | FAIL | 1 | 2.35 |\n'
    + 'http://127.0.0.1:59321 http://127.0.0.1:59330\n'
    + 'Auth/Session: expired caller denied\n'
    + 'Expected 401, received 500\n'
    + '<testsuites tests="34" failures="1" time="2.35">\n'
    + '<testcase file="apps/api/tests/acceptance.test.ts" name="foreign tenant is denied" />';
  expect(sanitizeReport(evidence, paths)).toBe(evidence);
});
