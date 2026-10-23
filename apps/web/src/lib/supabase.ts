import { createClient } from '@supabase/supabase-js';
const url = window.__SCAMREPORT_CONFIG__?.url || import.meta.env.VITE_SUPABASE_URL;
const key = window.__SCAMREPORT_CONFIG__?.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Missing public Supabase configuration. Run bun run local:up.');
const storageKey = 'scamreport-auth';
// UX-only signal: Auth can discard an invalid refresh token during client initialization.
export const sessionWasStored = Boolean(localStorage.getItem(storageKey));
export const supabase = createClient(url,key,{auth:{storageKey}});
