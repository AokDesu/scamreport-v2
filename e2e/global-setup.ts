import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export default function setup() {
  const workdir = process.env.SUPABASE_WORKDIR;
  const project = process.env.E2E_PROJECT_ID;
  if (!workdir || !project?.startsWith('scamreport-e2e-') ||
      !readFileSync(join(workdir,'supabase/config.toml'),'utf8').includes(`project_id = "${project}"`)) {
    throw new Error('Use bun run test:e2e (or bun run test); refusing to reset an unowned local stack.');
  }
  // API tests may have left fictional mutations; browsers always begin with the exact seed.
  execFileSync('supabase',['db','reset','--local','--yes','--workdir',workdir],{stdio:'pipe'});
}
