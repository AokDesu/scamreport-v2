import { createApp } from './app';
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY using supabase start output.');
const app = createApp({supabaseUrl,anonKey,webOrigin:process.env.WEB_ORIGIN ?? 'http://localhost:5173'});
app.listen({port:Number(process.env.PORT ?? 3000),hostname:'0.0.0.0'});
console.info('ScamReport API listening on port ' + app.server?.port);
