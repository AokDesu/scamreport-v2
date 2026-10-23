import { resolve, sep } from 'node:path';
const root=resolve(import.meta.dir,'dist');
// The API enforces its bounded stream; native proxy 413s would bypass its JSON error contract.
Bun.serve({port:Number(process.env.PORT ?? 8080),hostname:'0.0.0.0',maxRequestBodySize:Number.MAX_SAFE_INTEGER,async fetch(request){
  const url=new URL(request.url);
  if(url.pathname==='/config.js') {
    const config={url:process.env.VITE_SUPABASE_URL,anonKey:process.env.VITE_SUPABASE_ANON_KEY};
    return new Response('window.__SCAMREPORT_CONFIG__='+JSON.stringify(config)+';',{headers:{'Content-Type':'text/javascript','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  if(url.pathname.startsWith('/api/')) {
    const target=new URL(url.pathname.slice(4)+url.search,process.env.API_INTERNAL_URL ?? 'http://localhost:3000');
    const headers=new Headers(request.headers);headers.delete('host');
    // Bun 1.3 can reuse a closed connection after an upload rejection; do not pool body requests.
    try { return await fetch(target,{method:request.method,headers,body:request.body,redirect:'manual',keepalive:request.body === null}); }
    catch {
      const id=request.headers.get('x-request-id') ?? crypto.randomUUID();
      return Response.json({error:{code:'INTERNAL_ERROR',message:'API is unavailable.',requestId:id}},{status:502,headers:{'X-Request-Id':id}});
    }
  }
  if(request.method!=='GET' && request.method!=='HEAD') return new Response('Method not allowed',{status:405});
  let pathname:string;
  try {pathname=decodeURIComponent(url.pathname);} catch {return new Response('Invalid path',{status:400});}
  const path=resolve(root,'.'+pathname);
  if(path!==root && !path.startsWith(root+sep)) return new Response('Not found',{status:404});
  const file=Bun.file(path);
  if(path!==root && await file.exists()) return new Response(file,{headers:{'X-Content-Type-Options':'nosniff','Cache-Control':pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}});
  if(pathname.startsWith('/assets/')) return new Response('Not found',{status:404});
  return new Response(Bun.file(resolve(root,'index.html')),{headers:{'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
}});
