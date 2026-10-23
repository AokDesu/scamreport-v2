import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createApp } from '../src/app';
import { localEnvironment } from '../../../scripts/local-env';
import type { ApiError, Me, Report, ReportInput } from '@scamreport/shared';

const env = localEnvironment();
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const citizenId = '10000000-0000-4000-8000-000000000001';
const otherCitizenId = '10000000-0000-4000-8000-000000000003';
const adminId = '10000000-0000-4000-8000-000000000005';
const accounts = ['citizen','citizen-two','citizen-three','moderator-a','admin-a','executive-a','moderator-b','admin-b','executive-b'] as const;
type Account = typeof accounts[number];
const tokens = new Map<Account,string>();
const clients = new Map<Account,SupabaseClient>();
const created: string[] = [];
let stopServer: (() => unknown) | undefined;
let base: string;

beforeAll(async()=>{
  for (const name of accounts) {
    const client = createClient(env.SUPABASE_URL!,env.SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error} = await client.auth.signInWithPassword({email:`${name}@demo.example.test`,password:'Demo-only-234!'});
    if (error || !data.session) throw new Error(`Local fixture sign-in failed: ${name}: ${error?.message}`);
    tokens.set(name,data.session.access_token);clients.set(name,client);
  }
  const app = createApp({supabaseUrl:env.SUPABASE_URL!,anonKey:env.SUPABASE_ANON_KEY!,webOrigin:'http://localhost:5173'}).listen({port:0,hostname:'127.0.0.1'});
  base = `http://127.0.0.1:${app.server!.port}`;
  stopServer = () => app.stop();
},60000);
afterAll(async()=>{
  for (const id of created) await request(`/reports/${id}/withdraw`,'citizen',{method:'POST'});
  await stopServer?.();
});
async function request(path:string, account:Account|null='citizen', init:RequestInit={}) {
  const headers = new Headers(init.headers);
  if (account) headers.set('Authorization',`Bearer ${tokens.get(account)}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type','application/json');
  return fetch(base+path,{...init,headers});
}
async function data<T>(response:Response):Promise<T> {
  const body: {data:T} = await response.json();
  expect(response.status,JSON.stringify(body)).toBe(200);
  return body.data;
}
async function error(response:Response,status:number,code:ApiError['error']['code']) {
  const body:ApiError = await response.json();
  expect(response.status,JSON.stringify(body)).toBe(status);
  expect(body.error.code).toBe(code);
  expect(body.error.requestId).toBe(response.headers.get('x-request-id')!);
  return body;
}
async function create(overrides:Partial<ReportInput>={}) {
  const report = await data<Report>(await request('/reports','citizen',{method:'POST',body:JSON.stringify({organization_id:A,scam_type:'phishing',channel:'email',amount:'123.45',description:'Fictional acceptance report. No real personal data.',consent_contact:false,contact_email:'contact@demo.example.test',...overrides})}));
  created.push(report.id);return report;
}
function signedToken(exp:number) {
  const encode = (value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({alg:'HS256',typ:'JWT'});
  const payload = encode({sub:citizenId,aud:'authenticated',role:'authenticated',email:'citizen@demo.example.test',iat:Math.floor(Date.now()/1000)-10,exp});
  const content = header+'.'+payload;
  return content+'.'+createHmac('sha256',env.TEST_JWT_SECRET!).update(content).digest('base64url');
}

describe('Auth/Session',()=>{
  test('missing and forged JWTs fail without exposing upstream details',async()=>{
    await error(await request('/me',null),401,'UNAUTHENTICATED');
    await error(await request('/me',null,{headers:{Authorization:'Bearer forged.token.value'}}),401,'UNAUTHENTICATED');
  });
  test('a real locally signed token is accepted, then expires at the Auth boundary',async()=>{
    const expires = Math.floor(Date.now()/1000)+2;
    const token = signedToken(expires);
    const live = await data<Me>(await request('/me',null,{headers:{Authorization:'Bearer '+token}}));
    expect(live.id).toBe(citizenId);
    // Auth runs in a separate container; fake JS timers cannot advance its platform clock.
    await Bun.sleep(Math.max(0,expires*1000-Date.now()+1100));
    await error(await request('/me',null,{headers:{Authorization:'Bearer '+token}}),401,'SESSION_EXPIRED');
    const direct = await clients.get('citizen')!.auth.getUser(token);
    expect(direct.error?.message.toLowerCase()).toContain('expired');
  },10000);
  test('Supabase refresh rotates credentials and keeps verified identity',async()=>{
    const client = clients.get('citizen-two')!;
    const old = (await client.auth.getSession()).data.session!;
    const refreshed = await client.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.session!.refresh_token).not.toBe(old.refresh_token);
    tokens.set('citizen-two',refreshed.data.session!.access_token);
    const me = await data<Me>(await request('/me','citizen-two'));
    expect(me.id).toBe('10000000-0000-4000-8000-000000000002');
  });
});
describe('Permission',()=>{
  test('moderators cannot manage memberships and admins cannot grant themselves roles',async()=>{
    const body = JSON.stringify({organization_id:A,user_id:otherCitizenId,role:'executive'});
    await error(await request('/memberships','moderator-a',{method:'PUT',body}),403,'FORBIDDEN');
    await error(await request('/memberships','admin-a',{method:'PUT',body:JSON.stringify({organization_id:A,user_id:adminId,role:'executive'})}),403,'FORBIDDEN');
    await error(await request('/memberships','admin-a',{method:'DELETE',body:JSON.stringify({organization_id:A,user_id:adminId})}),403,'FORBIDDEN');
  });
  test('admin manages another membership; revoked membership takes effect on an existing JWT',async()=>{
    const body = {organization_id:A,user_id:otherCitizenId,role:'moderator'};
    try {
      await data(await request('/memberships','admin-a',{method:'PUT',body:JSON.stringify(body)}));
      await data(await request(`/moderation/queue?organization_id=${A}`,'citizen-three'));
    } finally {
      await data(await request('/memberships','admin-a',{method:'DELETE',body:JSON.stringify({organization_id:A,user_id:otherCitizenId})}));
    }
    await error(await request(`/moderation/queue?organization_id=${A}`,'citizen-three'),403,'FORBIDDEN');
  });
  test('contact sharing requires consent and is scoped to the assigned organization',async()=>{
    const no = await create(); const yes = await create({consent_contact:true});
    await error(await request(`/reports/${no.id}/contacts`,'moderator-a'),403,'FORBIDDEN');
    const contact = await data<{email:string}>(await request(`/reports/${yes.id}/contacts`,'moderator-a'));
    expect(contact.email).toBe('contact@demo.example.test');
    await error(await request(`/reports/${yes.id}/contacts`,'moderator-b'),404,'NOT_FOUND');
  });
  test('executive has aggregate access, never queue, contacts, audit or evidence',async()=>{
    const statistics = await data<Array<{status:string;report_count:number;total_amount:number}>>(await request(`/statistics?organization_id=${A}`,'executive-a'));
    expect(statistics.some(row=>row.status==='pending' && row.report_count>=2)).toBe(true);
    expect(Object.keys(statistics[0]!).sort()).toEqual(['report_count','status','total_amount']);
    await error(await request(`/moderation/queue?organization_id=${A}`,'executive-a'),403,'FORBIDDEN');
    await error(await request(`/audit?organization_id=${A}`,'executive-a'),403,'FORBIDDEN');
    await error(await request('/reports/20000000-0000-4000-8000-000000000001/contacts','executive-a'),404,'NOT_FOUND');
    await error(await request('/reports/20000000-0000-4000-8000-000000000001/evidence','executive-a'),404,'NOT_FOUND');
    await error(await request('/reports','executive-a'),403,'FORBIDDEN');
  });
});
describe('Cross-Tenant Denial',()=>{
  test('queue, audit, membership and statistics cannot target a different organization',async()=>{
    await error(await request(`/moderation/queue?organization_id=${B}`,'moderator-a'),403,'FORBIDDEN');
    await error(await request(`/audit?organization_id=${B}`,'admin-a'),403,'FORBIDDEN');
    await error(await request(`/statistics?organization_id=${B}`,'executive-a'),403,'FORBIDDEN');
    await error(await request('/memberships','admin-a',{method:'PUT',body:JSON.stringify({organization_id:B,user_id:otherCitizenId,role:'org_admin'})}),403,'FORBIDDEN');
  });
  test('foreign row IDs are invisible to moderation and citizen withdrawal',async()=>{
    const report = await create({organization_id:B});
    await error(await request(`/moderation/${report.id}`,'moderator-a',{method:'POST',body:JSON.stringify({status:'verified'})}),404,'NOT_FOUND');
    await error(await request(`/reports/${report.id}/withdraw`,'citizen-two',{method:'POST'}),404,'NOT_FOUND');
    const own = await data<Report[]>(await request('/reports'));
    expect(own.find(row=>row.id===report.id)?.status).toBe('pending');
  });
});
describe('API Error',()=>{
  test('malformed JSON, unknown fields, invalid amounts and query limits use one error shape',async()=>{
    await error(await request('/reports','citizen',{method:'POST',body:'{'}),422,'VALIDATION_FAILED');
    const valid = {organization_id:A,scam_type:'phishing',channel:'sms',amount:'10.00',description:'Fictional validation report.',consent_contact:false};
    await error(await request('/reports','citizen',{method:'POST',body:JSON.stringify({...valid,reporter_id:otherCitizenId})}),422,'VALIDATION_FAILED');
    await error(await request('/reports','citizen',{method:'POST',body:JSON.stringify({...valid,amount:-1})}),422,'VALIDATION_FAILED');
    await error(await request('/reports','citizen',{method:'POST',body:JSON.stringify({...valid,amount:'1.001'})}),422,'VALIDATION_FAILED');
    await error(await request('/feed?limit=101'),422,'VALIDATION_FAILED');
    await error(await request('/feed?offset=-1'),422,'VALIDATION_FAILED');
    await error(await request('/reports/not-a-uuid/withdraw','citizen',{method:'POST'}),422,'VALIDATION_FAILED');
  });
  test('request ID is returned on success, validation and unknown routes',async()=>{
    const requestId = 'acceptance-request-id';
    const success = await request('/me','citizen',{headers:{'X-Request-Id':requestId}});
    expect(success.headers.get('x-request-id')).toBe(requestId);
    const failure = await error(await request('/unknown',null,{headers:{'X-Request-Id':requestId}}),404,'NOT_FOUND');
    expect(failure.error.requestId).toBe(requestId);
    const invalid = await error(await request('/feed?limit=0','citizen',{headers:{'X-Request-Id':requestId}}),422,'VALIDATION_FAILED');
    expect(invalid.error.requestId).toBe(requestId);
  });
  test('unreachable Auth is an internal failure, never an expired or invalid session',async()=>{
    const offline = createApp({supabaseUrl:'http://127.0.0.1:1',anonKey:env.SUPABASE_ANON_KEY!,webOrigin:'http://localhost:5173'}).listen({port:0,hostname:'127.0.0.1'});
    try {
      const response = await fetch(`http://127.0.0.1:${offline.server!.port}/me`,{headers:{Authorization:'Bearer '+tokens.get('citizen')}});
      await error(response,500,'INTERNAL_ERROR');
    } finally { await offline.stop(); }
  },10000);
});
describe('Security',()=>{
  test('direct Data API denies cross-tenant writes, self-escalation and executive raw rows',async()=>{
    const moderator = clients.get('moderator-a')!;
    const read = await moderator.from('reports').select('id').eq('organization_id',B);
    expect(read.error).toBeNull();expect(read.data).toEqual([]);
    const write = await moderator.from('reports').update({status:'verified'}).eq('id','20000000-0000-4000-8000-000000000003').select('id');
    expect(write.error).toBeNull();expect(write.data).toEqual([]);
    const escalation = await clients.get('citizen')!.from('memberships').insert({organization_id:A,user_id:citizenId,role:'org_admin'});
    expect(escalation.error?.code).toBe('42501');
    const executive = clients.get('executive-a')!;
    for (const table of ['reports','report_contacts','moderation_actions','audit_log']) {
      const denied = await executive.from(table).select('*');
      expect(denied.error).toBeNull();expect(denied.data).toEqual([]);
    }
    const admin = await clients.get('admin-a')!.from('memberships').update({role:'executive'}).eq('user_id',adminId).select('user_id');
    expect(admin.error).toBeNull();expect(admin.data).toEqual([]);
  });
  test('public projection never includes identity, descriptions or contacts',async()=>{
    const feed = await data<Array<Record<string,unknown>>>(await request('/feed'));
    expect(feed.some(item=>item.id==='20000000-0000-4000-8000-000000000004')).toBe(true);
    for (const item of feed) expect(Object.keys(item).sort()).toEqual(['amount','channel','created_at','id','scam_type']);
    const searched = await data<Array<{scam_type:string}>>(await request('/feed?search=phishing'));
    expect(searched.some(item=>item.scam_type==='phishing')).toBe(true);
    expect(searched.every(item=>item.scam_type==='phishing')).toBe(true);
  });
  test('private evidence enforces owner upload, tenant read and executive denial',async()=>{
    const report = await create();
    const form = new FormData();form.set('file',new File(['%PDF-1.4\n% Fictional test evidence\n%%EOF'], 'fictional.pdf',{type:'application/pdf'}));
    const uploaded = await data<{path:string}>(await request(`/reports/${report.id}/evidence`,'citizen',{method:'POST',body:form}));
    const filename = uploaded.path.split('/')[1]!;
    const downloaded = await request(`/reports/${report.id}/evidence/${filename}`,'moderator-a');
    expect(downloaded.status).toBe(200);expect(await downloaded.text()).toContain('%PDF-1.4');
    expect(downloaded.headers.get('content-disposition')).toContain('attachment');
    await error(await request(`/reports/${report.id}/evidence/${filename}`,'moderator-b'),404,'NOT_FOUND');
    await error(await request(`/reports/${report.id}/evidence/${filename}`,'executive-a'),404,'NOT_FOUND');
    const otherUpload = await clients.get('citizen-two')!.storage.from('evidence').upload(`${report.id}/forged.pdf`,new Blob(['%PDF-forged'],{type:'application/pdf'}));
    expect(otherUpload.error).not.toBeNull();
    const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/evidence/${uploaded.path}`;
    expect((await fetch(publicUrl)).ok).toBe(false);
    const wrong = new FormData();wrong.set('file',new File(['<script>bad</script>'],'fake.png',{type:'image/png'}));
    await error(await request(`/reports/${report.id}/evidence`,'citizen',{method:'POST',body:wrong}),422,'VALIDATION_FAILED');
    await data(await request(`/reports/${report.id}/withdraw`,'citizen',{method:'POST'}));
    await error(await request(`/reports/${report.id}/evidence/${filename}`,'moderator-a'),404,'NOT_FOUND');
  });
});
describe('Regression',()=>{
  test('create → moderate → public feed → withdraw commits correlated immutable audit',async()=>{
    const requestId = 'moderation-'+crypto.randomUUID();
    const report = await create();
    expect(report.amount).toBe(123.45);
    const moderated = await data<Report>(await request(`/moderation/${report.id}`,'moderator-a',{method:'POST',headers:{'X-Request-Id':requestId},body:JSON.stringify({status:'verified'})}));
    expect(moderated.status).toBe('verified');
    const feed = await data<Array<{id:string}>>(await request('/feed?limit=100'));
    expect(feed.some(item=>item.id===report.id)).toBe(true);
    const audit = await data<Array<{resource_id:string;request_id:string;actor_id:string}>>(await request(`/audit?organization_id=${A}&limit=100`,'admin-a'));
    expect(audit.find(row=>row.resource_id===report.id && row.request_id===requestId)?.actor_id).toBe('10000000-0000-4000-8000-000000000004');
    const withdrawn = await data<Report>(await request(`/reports/${report.id}/withdraw`,'citizen',{method:'POST'}));
    expect(withdrawn.status).toBe('withdrawn');
    const remaining = await data<Array<{id:string}>>(await request('/feed?limit=100'));
    expect(remaining.some(item=>item.id===report.id)).toBe(false);
    await error(await request(`/moderation/${report.id}`,'moderator-a',{method:'POST',body:JSON.stringify({status:'rejected'})}),404,'NOT_FOUND');
  });
  test('OpenAPI documents the required contracts and bearer authorization',async()=>{
    const response = await request('/openapi/json',null);
    expect(response.status).toBe(200);
    const spec = await response.json();
    for (const path of ['/me','/tenants','/memberships','/roles','/reports','/feed','/statistics','/audit']) expect(spec.paths[path]).toBeDefined();
    expect(spec.paths['/reports'].post.requestBody.content['application/json'].schema).toBeDefined();
    expect(spec.paths['/me'].get.security).toEqual([{bearerAuth:[]}]);
    expect(spec.paths['/reports'].post.responses['422']).toBeDefined();
  });
});
