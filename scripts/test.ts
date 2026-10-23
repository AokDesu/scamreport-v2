import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localEnvironment } from './local-env';
const env = {...process.env,...localEnvironment(),NO_COLOR:'1',FORCE_COLOR:'0'};
const scratch = await mkdtemp(join(tmpdir(),'scamreport-tests-'));
const junitPath = join(scratch,'api.xml');
const commands = [ ['Database / pgTAP',['supabase','test','db']], ['API / six acceptance categories',['bun','test','apps/api/tests','--reporter=junit','--reporter-outfile='+junitPath]] ] as const;
const results = [];
for (const [name,command] of commands) {
  const started=Date.now();
  const child=Bun.spawn([...command],{env,stdout:'pipe',stderr:'pipe'});
  const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
  const output=(stdout+'\n'+stderr).replace(/\x1b\[[0-9;]*m/g,'').split('\n').filter(line=>!line.startsWith('{"requestId"')).join('\n').trim();
  results.push({name,command:command.join(' '),code,seconds:((Date.now()-started)/1000).toFixed(2),output});
  console.info(name+': '+(code===0?'PASS':'FAIL')+' ('+code+')');
}
const versions = ['bun','supabase'].map(binary=>binary+' '+Bun.spawnSync([binary,'--version'],{stderr:'pipe'}).stdout.toString().trim()).join('; ');
const report = '# Local acceptance test report\n\nGenerated: '+new Date().toISOString()+'\n\nEnvironment: '+versions+'; local Supabase, fictional seed, caller JWTs. No service-role client.\n\n'+
  '| Suite | Result | Exit code | Seconds |\n|---|---|---:|---:|\n'+results.map(row=>'| '+row.name+' | '+(row.code===0?'PASS':'FAIL')+' | '+row.code+' | '+row.seconds+' |').join('\n')+'\n\n'+
  'API categories: Auth/Session, Permission, Cross-Tenant Denial, API Error, Security, Regression. The expiry test first uses an accepted locally signed JWT, then lets the real Auth server clock expire that same token. Database tests run inside a rolled-back transaction; API tests create fictional reports and withdraw them on cleanup.\n\n'+
  results.map(row=>'## '+row.name+'\n\nCommand: `'+row.command+'`\n\n```text\n'+row.output+'\n```\n').join('\n');
const junit = Bun.file(junitPath);
const structuredCases = await junit.exists() ? '\n## Structured API cases (Bun JUnit output)\n\n```xml\n'+await junit.text()+'\n```\n' : '\nBun did not produce structured API output.\n';
await Bun.write('docs/test-report.md',report+structuredCases);
await rm(scratch,{recursive:true,force:true});
if (results.some(row=>row.code!==0)) process.exit(1);
