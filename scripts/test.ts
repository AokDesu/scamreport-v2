import { appendFile, cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { homedir, hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { localEnvironment } from './local-env';
import { sanitizeReport } from './report';

const e2eOnly = process.argv.includes('--e2e');
const scratch = await mkdtemp(join(tmpdir(),'scamreport-e2e-'));
const project = scratch.split('/').at(-1)!;
const artifacts = process.env.E2E_ARTIFACTS_DIR ?? await mkdtemp(join(tmpdir(),'scamreport-browser-'));
const port = Number(process.env.E2E_PORT_BASE ?? 56320);
if (!Number.isInteger(port) || port < 1024 || port > 65520) throw new Error('E2E_PORT_BASE must be an integer in 1024..65520.');
await mkdir(artifacts,{recursive:true});
await rm(join(artifacts,'categories.md'),{force:true});
if (process.env.GITHUB_ENV) await appendFile(process.env.GITHUB_ENV,`E2E_ARTIFACTS_DIR=${artifacts}\n`);
const env: Record<string,string|undefined> = {
  ...process.env,SUPABASE_WORKDIR:scratch,E2E_PROJECT_ID:project,
  E2E_API_PORT:String(port+11),E2E_WEB_PORT:String(port+10),
  E2E_ARTIFACTS_DIR:artifacts,E2E_REPORT_PATH:join(artifacts,'categories.md'),
  NO_COLOR:'1',FORCE_COLOR:'0',
};
const junitPath = join(scratch,'api.xml');
const results: Array<{name:string;command:string;code:number;seconds:string;output:string}> = [];
async function run(name:string,command:string[],record=true) {
  if (command[0] === 'supabase') command = [...command,'--workdir',scratch];
  const started = Date.now();
  const child = Bun.spawn(command,{env,stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,code] = await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  // Supabase start/status print local keys on stdout. Never include them in evidence.
  const output = (record ? stdout+'\n'+stderr : stderr).replace(/\x1b\[[0-9;]*m/g,'').split('\n').filter(line=>!line.startsWith('{"requestId"')).join('\n').trim();
  if (record || code !== 0) results.push({name,command:command.join(' '),code,seconds:((Date.now()-started)/1000).toFixed(2),output});
  console.info(name+': '+(code===0?'PASS':'FAIL')+' ('+code+')');
  return code;
}

let prepared = false;
try {
  await mkdir(join(scratch,'supabase'));
  for (const entry of ['migrations','tests','seed.sql']) await cp(join('supabase',entry),join(scratch,'supabase',entry),{recursive:true});
  const config = (await Bun.file('supabase/config.toml').text())
    .replace(/^project_id = .*$/m,`project_id = "${project}"`)
    .replace(/^(port|shadow_port) = (543\d\d)$/gm,(_line,key,value)=>`${key} = ${port+Number(value)-54320}`);
  await Bun.write(join(scratch,'supabase/config.toml'),config);
  prepared = true;
  process.env.SUPABASE_WORKDIR = scratch;
  console.info(`Disposable stack: ${project}; ports ${port}–${port+11}; artifacts: ${artifacts}`);
  const start = await run('Start isolated seeded Supabase',['supabase','start','--exclude','studio,postgres-meta,realtime,imgproxy,edge-runtime,logflare,vector,supavisor'],false);
  if (start === 0) {
    const local = localEnvironment();
    if (new URL(local.SUPABASE_URL!).port !== String(port+1)) throw new Error('Supabase status returned a different stack; refusing to run acceptance tests.');
    Object.assign(env,local);
    if (!e2eOnly) {
      await run('Report / export privacy',['bun','test','scripts/report.test.ts']);
      await run('Database / pgTAP',['supabase','test','db','--local']);
      await run('Web / component tests (vitest + Testing Library)',['bun','run','--cwd','apps/web','test']);
      await run('API / six acceptance categories',['bun','test','apps/api/tests','--reporter=junit','--reporter-outfile='+junitPath]);
    }
    await run('End-to-end / Chromium',['bun','x','--no-install','playwright','test']);
  }
} catch (error) {
  results.push({name:'Acceptance infrastructure',command:'bun scripts/test.ts',code:1,seconds:'0',output:error instanceof Error ? error.message : String(error)});
} finally {
  if (prepared) {
    const stopped = await run('Stop only owned Supabase stack',['supabase','stop','--no-backup','--project-id',project],false);
    if (stopped !== 0) console.error(`Cleanup failed; owned stack configuration retained at ${scratch}`);
  }
}
const versions = ['bun','supabase'].map(binary=>binary+' '+Bun.spawnSync([binary,'--version'],{stderr:'pipe'}).stdout.toString().trim()).join('; ');
const report = '# Local acceptance test report\n\nGenerated: '+new Date().toISOString()+'\n\nEnvironment: '+versions+'; isolated local Supabase, fictional fresh seed, production web/API proxy, Chromium, caller JWTs. No service-role client.\n\nOwned project: `'+project+'`; Supabase: `'+(env.SUPABASE_URL ?? 'not started')+'`; web: `http://127.0.0.1:'+env.E2E_WEB_PORT+'`; API: `http://127.0.0.1:'+env.E2E_API_PORT+'`.\n\n'+
  '| Suite | Result | Exit code | Seconds |\n|---|---|---:|---:|\n'+results.map(row=>'| '+row.name+' | '+(row.code===0?'PASS':'FAIL')+' | '+row.code+' | '+row.seconds+' |').join('\n')+'\n\n'+
  'Acceptance categories: Auth/Session, Permission, Cross-Tenant Denial, API Error, Security, Regression. Database cases roll back. API tests use real Auth/Data API/Storage. Before Chromium runs, only this disposable database is reset to the fictional seed. Browser expiry uses a token accepted by Auth before the same token expires on the real server clock.\n\n'+
  results.map(row=>'## '+row.name+'\n\nCommand: `'+row.command+'`\n\n```text\n'+row.output+'\n```\n').join('\n');
const junit = Bun.file(junitPath);
const structuredCases = await junit.exists() ? '\n## Structured API cases (Bun JUnit output)\n\n```xml\n'+await junit.text()+'\n```\n' : '\nAPI suite not run or structured API output unavailable.\n';
const browser = Bun.file(env.E2E_REPORT_PATH!);
const content = report+(await browser.exists() ? '\n'+await browser.text() : '\nEnd-to-end results unavailable: browser suite did not finish setup.\n')+structuredCases;
await Bun.write('docs/test-report.md',sanitizeReport(content,[
  [process.cwd(),'[repo]'],[scratch,'[stack]'],[artifacts,'[artifacts]'],
  [homedir(),'[home]'],[tmpdir(),'[temp]'],[hostname(),'[local-host]'],
]));
if (!results.some(row=>row.name==='Stop only owned Supabase stack' && row.code!==0)) await rm(scratch,{recursive:true,force:true});
if (results.some(row=>row.code!==0)) process.exit(1);
