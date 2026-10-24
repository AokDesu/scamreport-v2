import { test as base, expect, type APIRequestContext, type APIResponse, type BrowserContext, type Page } from '@playwright/test';
import type { Session } from '@supabase/supabase-js';

export const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const accounts = {
  citizen: {role:'citizen',tenant:null,path:'/citizen/reports'},
  'moderator-a': {role:'moderator',tenant:A,path:'/admin/queue'},
  'admin-a': {role:'org_admin',tenant:A,path:'/admin/queue'},
  'executive-a': {role:'executive',tenant:A,path:'/admin/dashboard'},
  'moderator-b': {role:'moderator',tenant:B,path:'/admin/queue'},
  'admin-b': {role:'org_admin',tenant:B,path:'/admin/queue'},
  'executive-b': {role:'executive',tenant:B,path:'/admin/dashboard'},
} as const;
type Account = keyof typeof accounts;
type RequestOptions = NonNullable<Parameters<APIRequestContext['fetch']>[1]>;
export type Actor = {
  page: Page;
  session: Session;
  apiRequests: string[];
  request: (path: string, options?: RequestOptions) => Promise<APIResponse>;
  direct: (path: string, options?: RequestOptions) => Promise<APIResponse>;
};

export const test = base.extend<{signIn: (account: Account) => Promise<Actor>}, {sessions: Map<Account,Session>}>({
  sessions: [async ({playwright},use) => {
    const auth = await playwright.request.newContext();
    const sessions = new Map<Account,Session>();
    try {
      for (const account of Object.keys(accounts) as Account[]) {
        const response = await auth.post(process.env.SUPABASE_URL+'/auth/v1/token?grant_type=password',{
          headers:{apikey:process.env.SUPABASE_ANON_KEY!},
          data:{email:`${account}@demo.example.test`,password:'Demo-only-234!'},
        });
        expect(response.status(),`Seed sign-in: ${account}`).toBe(200);
        const session: Session = await response.json();
        sessions.set(account,session);
      }
      await use(sessions);
    } finally { await auth.dispose(); }
  },{scope:'worker'}],
  signIn: async ({browser,baseURL,sessions},use) => {
    const contexts: BrowserContext[] = [];
    await use(async account => {
      const session = sessions.get(account)!;
      const context = await browser.newContext({baseURL,storageState:{cookies:[],origins:[{
        origin:new URL(baseURL!).origin,
        localStorage:[{name:'scamreport-auth',value:JSON.stringify(session)}],
      }]}});
      contexts.push(context);
      const page = await context.newPage();
      const apiRequests: string[] = [];
      page.on('request',request => {
        const url = new URL(request.url());
        if (url.origin === new URL(baseURL!).origin && url.pathname.startsWith('/api/')) apiRequests.push(url.pathname+url.search);
        if (url.pathname.startsWith('/rest/v1/')) apiRequests.push(url.href);
      });
      await page.goto(accounts[account].path);
      await expect(page.getByRole('button',{name:'ออกจากระบบ',exact:true})).toBeVisible();
      async function request(path: string, options: RequestOptions = {}, direct = false) {
        // Read the current browser token, including one intentionally expired by a test.
        const token = await page.evaluate(() => JSON.parse(localStorage.getItem('scamreport-auth')!).access_token as string);
        return context.request.fetch(direct ? process.env.SUPABASE_URL+path : '/api'+path,{
          ...options,headers:{...options.headers,Authorization:'Bearer '+token,...(direct ? {apikey:process.env.SUPABASE_ANON_KEY!} : {})},
        });
      }
      return {page,session,apiRequests,request,direct:(path,options)=>request(path,options,true)};
    });
    await Promise.all(contexts.map(context=>context.close()));
  },
});
export { expect };
