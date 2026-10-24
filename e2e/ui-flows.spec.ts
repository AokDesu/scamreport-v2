import { createHmac } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { Page } from '@playwright/test';
import { test, expect, A, B } from './fixtures';

const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8u0AAAAASUVORK5CYII=','base64');

async function fillDetails(page: Page, description: string, amount: string) {
  await page.getByRole('link',{name:'Report',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Report a scam',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:'Fake link asking for details',exact:true}).check();
  await page.getByRole('radio',{name:'SMS',exact:true}).check();
  await page.getByRole('textbox',{name:'Money lost',exact:true}).fill(amount);
  await page.getByRole('textbox',{name:'What happened',exact:true}).fill(description);
}

async function consent(page: Page, email: string) {
  await page.getByRole('button',{name:'Next: who can contact you',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Can they contact you?',exact:true})).toBeVisible();
  await page.getByRole('radio',{name:'Demo River Bank',exact:true}).check();
  await page.getByRole('radio',{name:/^Yes, they may contact me/}).check();
  await page.getByRole('textbox',{name:'Email',exact:true}).fill(email);
  // The UI deliberately ignores an immediate second click after changing steps.
  await sleep(850);
}

test.describe('Auth/Session', () => {
  test('mid-report real expiry keeps fields and photo bytes through password sign-in and one submission', async ({signIn},testInfo) => {
    const citizen = await signIn('citizen');
    const page = citizen.page;
    await page.getByRole('button',{name:'English',exact:true}).click();
    const description = 'Fictional real-expiry draft with PNG bytes.';
    await fillDetails(page,description,'432.19');
    await page.getByLabel('Add photo',{exact:true}).setInputFiles({name:'fictional-expiry.png',mimeType:'image/png',buffer:photo});
    await expect(page.getByRole('img',{name:'fictional-expiry.png',exact:true})).toBeVisible();
    await consent(page,'expiry@demo.example.test');

    const expires = Math.floor(Date.now()/1000)+4;
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:citizen.session.user.id,aud:'authenticated',role:'authenticated',email:citizen.session.user.email,iat:Math.floor(Date.now()/1000)-10,exp:expires});
    const token = content+'.'+createHmac('sha256',process.env.TEST_JWT_SECRET!).update(content).digest('base64url');
    // The page remains in use. Only the token lifetime changes; no fake response, clock or gate navigation.
    await page.evaluate(session=>localStorage.setItem('scamreport-auth',JSON.stringify(session)),{...citizen.session,access_token:token});
    expect((await citizen.request('/me')).status()).toBe(200);
    let expiredBody = '';
    // Buffer the real proxy response before forwarding it unchanged: the hard redirect can
    // discard Chromium's response resource before the test reads it. No mock or request retry.
    await page.route('**/api/reports',async route=>{
      const response = await route.fetch({maxRetries:0});
      expiredBody = await response.text();
      await route.fulfill({response});
    },{times:1});
    await sleep(Math.max(0,expires*1000-Date.now()+1100));
    // Submit before the 400 ms autosave can run: the pre-submit checkpoint must keep this last edit too.
    await page.getByRole('textbox',{name:'Phone',exact:true}).fill('0X-EXPIRY-234');
    const expiredResponse = page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reports' && response.request().method()==='POST');
    await page.getByRole('button',{name:'Send report',exact:true}).click();
    const expired = await expiredResponse;
    expect(expired.status()).toBe(401);
    await expect(page).toHaveURL(/\/session-expired$/);
    const failure = JSON.parse(expiredBody);
    expect(failure.error.code).toBe('SESSION_EXPIRED');
    expect(failure.error.requestId).toBeTruthy();
    expect(failure.error.requestId).toBe(expired.headers()['x-request-id']);
    await expect(page.getByRole('heading',{name:'You were signed out to keep your account safe',exact:true})).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Your unfinished report was saved.');
    await expect(page.getByRole('textbox',{name:'Signed in as',exact:true})).toHaveValue('citizen@demo.example.test');
    await page.screenshot({path:testInfo.outputPath('session-expired-with-draft.png'),fullPage:true});
    await page.getByLabel('Password',{exact:true}).fill('Demo-only-234!');
    const authenticated = page.waitForResponse(response=>new URL(response.url()).pathname==='/auth/v1/token');
    await page.getByRole('button',{name:'Sign in again',exact:true}).click();
    expect((await authenticated).status()).toBe(200);
    await expect(page).toHaveURL(/\/citizen\/report\?step=consent$/);
    await expect(page.getByRole('textbox',{name:'Email',exact:true})).toHaveValue('expiry@demo.example.test');
    await expect(page.getByRole('textbox',{name:'Phone',exact:true})).toHaveValue('0X-EXPIRY-234');
    await expect(page.getByRole('radio',{name:'Demo River Bank',exact:true})).toBeChecked();
    await expect(page.getByRole('radio',{name:/^Yes, they may contact me/})).toBeChecked();
    await page.getByRole('link',{name:'Back',exact:true}).click();
    await expect(page.getByRole('textbox',{name:'Money lost',exact:true})).toHaveValue('432.19');
    await expect(page.getByRole('textbox',{name:'What happened',exact:true})).toHaveValue(description);
    await expect(page.getByRole('radio',{name:'Fake link asking for details',exact:true})).toBeChecked();
    await expect(page.getByRole('radio',{name:'SMS',exact:true})).toBeChecked();
    const restored = page.getByRole('img',{name:'fictional-expiry.png',exact:true});
    await expect(restored).toBeVisible();
    expect(await restored.evaluate(async image=>Array.from(new Uint8Array(await (await fetch((image as HTMLImageElement).src)).arrayBuffer())))).toEqual(Array.from(photo));
    await page.screenshot({path:testInfo.outputPath('restored-draft-and-photo.png'),fullPage:true});
    await consent(page,'expiry@demo.example.test');
    let id: string | undefined;
    try {
      const createdResponse = page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reports' && response.request().method()==='POST');
      await page.getByRole('button',{name:'Send report',exact:true}).click();
      const created = await createdResponse;
      expect(created.status()).toBe(200);
      const {data:report} = await created.json();
      id = report.id;
      await expect(page.getByRole('heading',{name:'We have your report',exact:true})).toBeVisible();
      await expect(page.getByText('1 file attached',{exact:true})).toBeVisible();
      const reports = await citizen.request('/reports?limit=100');
      expect((await reports.json()).data.filter((row: {description:string})=>row.description===description)).toEqual([expect.objectContaining({id,amount:432.19,consent_contact:true})]);
      const evidence = await citizen.request(`/reports/${id}/evidence`);
      expect(evidence.status()).toBe(200);
      const {data:files} = await evidence.json();
      expect(files).toHaveLength(1);
      const downloaded = await citizen.request(`/reports/${id}/evidence/${files[0].path.split('/')[1]}`);
      expect(downloaded.status()).toBe(200);
      expect(await downloaded.body()).toEqual(photo);
    } finally {
      if (id) expect((await citizen.request(`/reports/${id}/withdraw`,{method:'POST'})).status()).toBe(200);
    }
  });
});

test.describe('Regression', () => {
  test('citizen consented UI filing is verified by its moderator and appears in the public feed', async ({signIn},testInfo) => {
    const citizen = await signIn('citizen');
    const moderator = await signIn('moderator-a');
    await citizen.page.getByRole('button',{name:'English',exact:true}).click();
    await moderator.page.getByRole('button',{name:'English',exact:true}).click();
    const description = 'Fictional UI filing to moderation to verified feed.';
    await fillDetails(citizen.page,description,'9876.54');
    await consent(citizen.page,'consented-ui@demo.example.test');
    let id: string | undefined;
    try {
      const response = citizen.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/reports' && response.request().method()==='POST');
      await citizen.page.getByRole('button',{name:'Send report',exact:true}).click();
      const created = await response;
      expect(created.status()).toBe(200);
      const {data:report} = await created.json();
      id = report.id;
      expect(report).toMatchObject({organization_id:A,description,consent_contact:true,status:'pending'});
      await expect(citizen.page.getByRole('heading',{name:'We have your report',exact:true})).toBeVisible();
      await moderator.page.goto(`/admin/reports/${id}`);
      await expect(moderator.page.getByText(description,{exact:true})).toBeVisible();
      await moderator.page.getByRole('button',{name:'Show contact details',exact:true}).click();
      await expect(moderator.page.getByText('consented-ui@demo.example.test',{exact:true})).toBeVisible();
      await moderator.page.getByRole('radio',{name:'Verify',exact:true}).check();
      const decidedResponse = moderator.page.waitForResponse(response=>new URL(response.url()).pathname===`/api/moderation/${id}` && response.request().method()==='POST');
      await moderator.page.getByRole('button',{name:'Save and call next',exact:true}).click();
      const decided = await decidedResponse;
      expect(decided.status()).toBe(200);
      expect((await decided.json()).data.status).toBe('verified');
      const feedResponse = citizen.page.waitForResponse(response=>new URL(response.url()).pathname==='/api/feed');
      await citizen.page.getByRole('link',{name:'Check other verified scams',exact:true}).click();
      const feed = await feedResponse;
      expect((await feed.json()).data).toContainEqual(expect.objectContaining({id,amount:9876.54}));
      const card = citizen.page.getByRole('list',{name:'Verified scams',exact:true}).getByRole('listitem').filter({hasText:'9,876.54'});
      await expect(card).toHaveCount(1);
      await expect(card.getByRole('heading',{name:'Fake link asking for details',exact:true})).toBeVisible();
      await expect(card.getByText('Verified',{exact:true})).toBeVisible();
      await expect(card).toContainText('Contacted by SMS');
      await expect(citizen.page.getByText(description,{exact:true})).toHaveCount(0);
      await expect(citizen.page.getByText('consented-ui@demo.example.test',{exact:true})).toHaveCount(0);
      await citizen.page.screenshot({path:testInfo.outputPath('verified-feed.png'),fullPage:true});
    } finally {
      if (id) expect((await citizen.request(`/reports/${id}/withdraw`,{method:'POST'})).status()).toBe(200);
    }
  });
});

test.describe('Cross-Tenant Denial', () => {
  test('A moderator opening a B report gets a real 404 and no report, contacts or evidence UI', async ({signIn},testInfo) => {
    const a = await signIn('moderator-a');
    const b = await signIn('moderator-b');
    await a.page.getByRole('button',{name:'English',exact:true}).click();
    await b.page.getByRole('button',{name:'English',exact:true}).click();
    const id = '20000000-0000-4000-8000-000000000003';
    const description = 'รายงานสาธิต: โฆษณาการลงทุนที่ไม่มีอยู่จริง';
    const deniedResponse = a.page.waitForResponse(response=>new URL(response.url()).pathname===`/api/moderation/${id}`);
    await a.page.goto(`/admin/reports/${id}`);
    const denied = await deniedResponse;
    expect(denied.status()).toBe(404);
    expect((await denied.json()).error.code).toBe('NOT_FOUND');
    await expect(a.page.getByRole('heading',{name:'This report is not in your queue',level:1,exact:true})).toBeVisible();
    await expect(a.page.getByText(description,{exact:true})).toHaveCount(0);
    await expect(a.page.getByText('citizen-three@demo.example.test',{exact:true})).toHaveCount(0);
    await expect(a.page.getByRole('button',{name:'Show contact details',exact:true})).toHaveCount(0);
    await expect(a.page.getByRole('radio',{name:'Verify',exact:true})).toHaveCount(0);
    expect(a.apiRequests.filter(path=>path.includes(`/reports/${id}/`) || path.startsWith('/api/members?organization_id='+B))).toEqual([]);
    await a.page.screenshot({path:testInfo.outputPath('foreign-report-denied.png'),fullPage:true});
    await b.page.goto(`/admin/reports/${id}`);
    await expect(b.page.getByText(description,{exact:true})).toBeVisible();
    await expect(b.page.getByRole('radio',{name:'Verify',exact:true})).toBeVisible();
  });
});

test.describe('Security', () => {
  for (const [account,tenant] of [['executive-a',A],['executive-b',B]] as const) {
    test(`${account} dashboard renders aggregates without requesting or rendering personal data`, async ({signIn},testInfo) => {
      const executive = await signIn(account);
      const page = executive.page;
      await page.getByRole('button',{name:'English',exact:true}).click();
      const statisticsResponse = page.waitForResponse(response=>new URL(response.url()).pathname==='/api/statistics');
      const breakdownResponse = page.waitForResponse(response=>new URL(response.url()).pathname==='/api/statistics/breakdown');
      await page.reload();
      const statistics = await statisticsResponse;
      const breakdown = await breakdownResponse;
      expect(statistics.status()).toBe(200);
      expect(breakdown.status()).toBe(200);
      const {data:rows} = await statistics.json();
      for (const row of rows) expect(Object.keys(row).sort()).toEqual(['report_count','status','total_amount']);
      for (const row of (await breakdown.json()).data) expect(Object.keys(row).sort()).toEqual(['bucket','dimension','report_count']);
      const total = rows.reduce((sum: number,row: {report_count:number})=>sum+row.report_count,0);
      await expect(page.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();
      const status = page.getByRole('region',{name:/^All reports by status/});
      await expect(status).toContainText(`${total} reports`);
      await expect(status).toContainText('Total reported loss');
      await expect(page.getByRole('region',{name:/^Reports received per week/})).toBeVisible();
      await expect(page.getByRole('region',{name:'By scam type',exact:true})).toBeVisible();
      expect(new Set(executive.apiRequests)).toEqual(new Set(['/api/me','/api/tenants',`/api/statistics?organization_id=${tenant}`,`/api/statistics/breakdown?organization_id=${tenant}`]));
      const text = await page.getByRole('main').innerText();
      for (const personal of ['citizen@demo.example.test','citizen-two@demo.example.test','citizen-three@demo.example.test','สมศรี ใจดี','วิชัย มั่นคง','มาลี รักษ์ไทย','0X-XXX-1001','0X-XXX-1002','0X-XXX-1003','consented-ui@demo.example.test','expiry@demo.example.test','0X-EXPIRY-234','รายงานสาธิต: โฆษณาการลงทุนที่ไม่มีอยู่จริง']) expect(text).not.toContain(personal);
      await expect(page.getByRole('button',{name:'Show contact details',exact:true})).toHaveCount(0);
      await expect(page.getByRole('textbox',{name:'Email',exact:true})).toHaveCount(0);
      await page.screenshot({path:testInfo.outputPath('executive-aggregate-only.png'),fullPage:true});
    });
  }
});
