import { defineConfig, devices } from '@playwright/test';

const webPort = Number(process.env.E2E_WEB_PORT ?? 56330);
const apiPort = Number(process.env.E2E_API_PORT ?? 56331);
const baseURL = `http://127.0.0.1:${webPort}`;
export default defineConfig({
  testDir:'./e2e',
  fullyParallel:false,
  workers:1,
  retries:0,
  forbidOnly:Boolean(process.env.CI),
  timeout:30_000,
  expect:{timeout:10_000},
  globalSetup:'./e2e/global-setup.ts',
  outputDir:process.env.E2E_ARTIFACTS_DIR ?? 'test-results',
  reporter:[['list'],['./e2e/reporter.ts'],['junit',{outputFile:(process.env.E2E_ARTIFACTS_DIR ?? 'test-results')+'/e2e.xml'}]],
  use:{baseURL,trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:[
    {command:'bun apps/api/src/index.ts',url:`http://127.0.0.1:${apiPort}/health`,reuseExistingServer:false,env:{PORT:String(apiPort),WEB_ORIGIN:baseURL}},
    {command:'bun run build && bun apps/web/server.ts',url:baseURL+'/config.js',reuseExistingServer:false,timeout:120_000,
      env:{PORT:String(webPort),API_INTERNAL_URL:`http://127.0.0.1:${apiPort}`,VITE_SUPABASE_URL:process.env.SUPABASE_URL!,VITE_SUPABASE_ANON_KEY:process.env.SUPABASE_ANON_KEY!}},
  ],
});
