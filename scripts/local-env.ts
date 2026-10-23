// The CLI is the only source of local keys. Never log its raw output.
export function localEnvironment(): Record<string,string> {
  const status = Bun.spawnSync(['supabase','status','-o','json'],{stdout:'pipe',stderr:'pipe'});
  if (status.exitCode !== 0) throw new Error('Local Supabase is not ready. Run bun run local:up first. ' + status.stderr.toString());
  const values = JSON.parse(status.stdout.toString()) as Record<string,string>;
  if (!values.API_URL || !values.ANON_KEY || !values.JWT_SECRET) throw new Error('Supabase status did not return API_URL, ANON_KEY and JWT_SECRET.');
  return {SUPABASE_URL:values.API_URL,SUPABASE_ANON_KEY:values.ANON_KEY,TEST_JWT_SECRET:values.JWT_SECRET};
}
