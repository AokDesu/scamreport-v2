import { createHmac } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { test, expect, accounts, A, B, type Actor } from './fixtures';

async function failure(actor: Actor, path: string, status: number, code: string, data?: unknown) {
  const response = await actor.request(path, data === undefined ? {} : {method:'POST',data});
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(status);
  expect(Object.keys(body)).toEqual(['error']);
  expect(Object.keys(body.error).sort()).toEqual(['code','message','requestId']);
  expect(body.error.code).toBe(code);
  expect(body.error.requestId).toBeTruthy();
  expect(body.error.requestId).toBe(response.headers()['x-request-id']);
  return body;
}

test.describe('Auth/Session', () => {
  for (const [name, account] of Object.entries(accounts)) {
    test(`${name} browser session has the seeded identity and tenant`, async ({signIn}) => {
      const actor = await signIn(name as keyof typeof accounts);
      const response = await actor.request('/me');
      expect(response.status()).toBe(200);
      const {data} = await response.json();
      expect(data.email).toBe(`${name}@demo.example.test`);
      expect(data.role).toBe(account.role === 'citizen' ? 'citizen' : 'staff');
      expect(data.memberships.map((m: {organization_id: string; role: string}) => ({organization_id:m.organization_id,role:m.role})))
        .toEqual(account.tenant ? [{organization_id:account.tenant,role:account.role}] : []);
    });
  }

  test('the same live browser token expires at real Auth and renders Session Expired', async ({signIn}) => {
    const actor = await signIn('citizen');
    await actor.page.getByRole('button',{name:'English',exact:true}).click();
    const expires = Math.floor(Date.now()/1000)+4;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:actor.session.user.id,aud:'authenticated',role:'authenticated',email:actor.session.user.email,iat:Math.floor(Date.now()/1000)-10,exp:expires});
    const token = content+'.'+createHmac('sha256',process.env.TEST_JWT_SECRET!).update(content).digest('base64url');
    // Keep client refresh metadata live so the real API, not a mocked client clock, observes expiry.
    await actor.page.evaluate(session => localStorage.setItem('scamreport-auth',JSON.stringify(session)), {...actor.session,access_token:token});
    await actor.page.reload();
    await expect(actor.page.getByRole('heading',{name:'My reports',exact:true})).toBeVisible();
    expect((await actor.request('/me')).status()).toBe(200);
    await sleep(Math.max(0,expires*1000-Date.now()+1100));
    await failure(actor,'/me',401,'SESSION_EXPIRED');
    await actor.page.reload();
    await expect(actor.page).toHaveURL(/\/session-expired$/);
    await expect(actor.page.getByRole('heading',{name:'You were signed out to keep your account safe',exact:true})).toBeVisible();
    await expect(actor.page.getByRole('button',{name:'Sign in again',exact:true})).toBeVisible();
  });
});

test.describe('Permission', () => {
  test('citizen admin API is forbidden and admin workspace renders Unauthorized', async ({signIn}) => {
    const citizen = await signIn('citizen');
    await citizen.page.getByRole('button',{name:'English',exact:true}).click();
    await failure(citizen,`/moderation/queue?organization_id=${A}`,403,'FORBIDDEN');
    await citizen.page.goto('/admin/queue');
    await expect(citizen.page).toHaveURL(/\/unauthorized$/);
    await expect(citizen.page.getByRole('heading',{name:'This page is for partner staff only',exact:true})).toBeVisible();
    await expect(citizen.page.getByRole('region',{name:'Your role',exact:true})).toContainText('Public reporter');
    await expect(citizen.page.getByRole('region',{name:'Your role',exact:true})).toContainText('Moderator at a partner organisation');
    await citizen.page.getByRole('button',{name:'Go to my reports',exact:true}).click();
    await expect(citizen.page.getByRole('heading',{name:'My reports',exact:true})).toBeVisible();
    expect(citizen.apiRequests.filter(path=>path.startsWith('/api/moderation') || path.startsWith('/api/members') || path.startsWith('/api/audit'))).toEqual([]);
  });
});

test.describe('Cross-Tenant Denial', () => {
  test('A moderator cannot read or mutate B report; B still sees the original state', async ({signIn}) => {
    const a = await signIn('moderator-a');
    const b = await signIn('moderator-b');
    const id = '20000000-0000-4000-8000-000000000003';
    const ownQueue = await a.request(`/moderation/queue?organization_id=${A}`);
    expect(ownQueue.status()).toBe(200);
    expect((await ownQueue.json()).data.map((row: {id:string})=>row.id)).not.toContain(id);
    await failure(a,`/moderation/queue?organization_id=${B}`,403,'FORBIDDEN');
    await failure(a,`/reports/${id}/contacts`,404,'NOT_FOUND');
    await failure(a,`/reports/${id}/evidence`,404,'NOT_FOUND');
    await failure(a,`/moderation/${id}`,404,'NOT_FOUND',{status:'verified'});
    const queue = await b.request(`/moderation/queue?organization_id=${B}`);
    expect(queue.status()).toBe(200);
    expect((await queue.json()).data.find((row: {id:string})=>row.id===id).status).toBe('pending');
    const contacts = await b.request(`/reports/${id}/contacts`);
    expect(contacts.status()).toBe(200);
    expect((await contacts.json()).data.email).toBe('citizen-three@demo.example.test');
  });
});

test.describe('Security', () => {
  for (const [name,tenant,foreign,id] of [
    ['executive-a',A,B,'20000000-0000-4000-8000-000000000001'],
    ['executive-b',B,A,'20000000-0000-4000-8000-000000000003'],
  ] as const) {
    test(`${name} sees only own aggregates, never personal or raw case fields`, async ({signIn}) => {
      const executive = await signIn(name);
      const response = await executive.request(`/statistics?organization_id=${tenant}`);
      expect(response.status()).toBe(200);
      const {data} = await response.json();
      expect(data).toEqual(expect.arrayContaining([{status:'pending',report_count:tenant===A ? 4 : 2,total_amount:tenant===A ? 5310 : 29000}]));
      for (const row of data) expect(Object.keys(row).sort()).toEqual(['report_count','status','total_amount']);
      await failure(executive,`/statistics?organization_id=${foreign}`,403,'FORBIDDEN');
      await failure(executive,`/moderation/queue?organization_id=${tenant}`,403,'FORBIDDEN');
      await failure(executive,`/audit?organization_id=${tenant}`,403,'FORBIDDEN');
      await failure(executive,'/reports',403,'FORBIDDEN');
      await failure(executive,`/reports/${id}/contacts`,404,'NOT_FOUND');
      await failure(executive,`/reports/${id}/evidence`,404,'NOT_FOUND');
      for (const table of ['reports','report_contacts','moderation_actions','audit_log']) {
        const direct = await executive.direct(`/rest/v1/${table}?select=*`);
        expect(direct.status()).toBe(200);
        expect(await direct.json()).toEqual([]);
      }
      const feed = await executive.request('/feed');
      expect(feed.status()).toBe(200);
      for (const row of (await feed.json()).data) expect(Object.keys(row).sort()).toEqual(['amount','channel','created_at','id','scam_type']);
    });
  }

  test('browser caller JWT cannot bypass cross-tenant denial through Data API', async ({signIn}) => {
    const a = await signIn('moderator-a');
    const read = await a.direct(`/rest/v1/reports?select=id&organization_id=eq.${B}`);
    expect(read.status()).toBe(200);
    expect(await read.json()).toEqual([]);
    const write = await a.direct('/rest/v1/reports?id=eq.20000000-0000-4000-8000-000000000003&select=id',{method:'PATCH',data:{status:'verified'},headers:{Prefer:'return=representation'}});
    expect(write.status()).toBe(200);
    expect(await write.json()).toEqual([]);
    const b = await signIn('moderator-b');
    const queue = await b.request(`/moderation/queue?organization_id=${B}`);
    expect((await queue.json()).data.find((row: {id:string})=>row.id==='20000000-0000-4000-8000-000000000003').status).toBe('pending');
  });
});

test.describe('API Error', () => {
  test('invalid browser-proxied input keeps the safe envelope and caller request ID', async ({signIn}) => {
    const citizen = await signIn('citizen');
    const requestId = 'e2e-validation';
    const response = await citizen.request('/feed?limit=101',{headers:{'X-Request-Id':requestId}});
    expect(response.status()).toBe(422);
    expect(response.headers()['x-request-id']).toBe(requestId);
    expect(await response.json()).toEqual({error:{code:'VALIDATION_FAILED',message:expect.any(String),requestId}});
    await failure(citizen,'/reports',422,'VALIDATION_FAILED',{organization_id:A,reporter_id:'10000000-0000-4000-8000-000000000002'});
  });
});

test.describe('Regression', () => {
  test('browser sessions create with consent, verify, publish and withdraw through the real proxy', async ({signIn}) => {
    const citizen = await signIn('citizen');
    const moderator = await signIn('moderator-a');
    const created = await citizen.request('/reports',{method:'POST',data:{organization_id:A,scam_type:'phishing',channel:'email',amount:'123.45',description:'Fictional browser regression case.',consent_contact:true,contact_email:'e2e@demo.example.test'}});
    expect(created.status()).toBe(200);
    const {data:report} = await created.json();
    try {
      const contact = await moderator.request(`/reports/${report.id}/contacts`);
      expect(contact.status()).toBe(200);
      expect((await contact.json()).data.email).toBe('e2e@demo.example.test');
      const verified = await moderator.request(`/moderation/${report.id}`,{method:'POST',data:{status:'verified'}});
      expect(verified.status()).toBe(200);
      expect((await verified.json()).data.status).toBe('verified');
      const feed = await citizen.request('/feed?limit=100');
      expect((await feed.json()).data).toContainEqual(expect.objectContaining({id:report.id,amount:123.45}));
    } finally {
      const withdrawn = await citizen.request(`/reports/${report.id}/withdraw`,{method:'POST'});
      expect(withdrawn.status()).toBe(200);
      expect((await withdrawn.json()).data.status).toBe('withdrawn');
    }
    const feed = await citizen.request('/feed?limit=100');
    expect((await feed.json()).data.map((row: {id:string})=>row.id)).not.toContain(report.id);
  });
});
