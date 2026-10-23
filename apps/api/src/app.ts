import { Elysia, t } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { createClient } from '@supabase/supabase-js';
import {
  ApiError, Data, ErrorResponses, FeedItem, IdParams, Me, Membership, MembershipInput,
  MembershipTarget, ModerationInput, Pagination, Report, ReportInput, TenantQuery, Uuid,
  type ErrorCode, type MemberRole, type Membership as MembershipType,
} from '@scamreport/shared';

export interface Config { supabaseUrl: string; anonKey: string; webOrigin: string }
class Failure extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string) { super(message); }
}
function fail(status: number, code: ErrorCode, message: string): never { throw new Failure(status, code, message); }
function result<T>(value: { data: T; error: { code?: string; message: string } | null }): NonNullable<T> {
  if (value.error) {
    const code = value.error.code;
    if (code === '42501') fail(403,'FORBIDDEN','You do not have permission for this action.');
    if (code === '23503' || code === 'PGRST116') fail(404,'NOT_FOUND','Resource not found.');
    if (code === '23505') fail(409,'CONFLICT','Resource already exists.');
    if (code === '22023' || code === '23514' || code === '22P02') fail(422,'VALIDATION_FAILED','Invalid input or state transition.');
    // Never expose SQL, upstream details, tokens or personal information.
    fail(500,'INTERNAL_ERROR','The request could not be completed.');
  }
  if (value.data === null) fail(404,'NOT_FOUND','Resource not found.');
  return value.data!;
}
const reportFields = 'id,reporter_id,organization_id,scam_type,channel,amount,description,status,consent_contact,created_at';
const rows = <T extends Parameters<typeof t.Array>[0]>(schema: T) => ({200:Data(t.Array(schema)),...ErrorResponses});
const one = <T extends Parameters<typeof t.Array>[0]>(schema: T) => ({200:Data(schema),...ErrorResponses});
const roleActions = {
  citizen: ['reports:create','reports:own','reports:withdraw','evidence:upload','feed:read'],
  moderator: ['queue:read','reports:moderate','contacts:consented','evidence:read','feed:read'],
  org_admin: ['queue:read','memberships:manage-others','audit:read','contacts:consented','evidence:read','feed:read'],
  executive: ['statistics:read','feed:read'],
};

export function createApp(config: Config) {
  // Enforce the real bound in the application so native 413s cannot bypass error/request-ID hooks.
  const maxBodyBytes = 6 * 1024 * 1024;
  return new Elysia({ normalize: false, serve: { maxRequestBodySize: Number.MAX_SAFE_INTEGER } })
    .onRequest(context => {
      const {request,set} = context;
      const incoming = request.headers.get('x-request-id');
      set.headers['x-request-id'] = incoming && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming) ? incoming : crypto.randomUUID();
      set.headers['cache-control'] = 'no-store';
      set.headers['x-content-type-options'] = 'nosniff';
      const origin = request.headers.get('origin');
      if (origin === config.webOrigin) {
        set.headers['access-control-allow-origin'] = origin;
        set.headers['vary'] = 'Origin';
        set.headers['access-control-expose-headers'] = 'X-Request-Id';
        set.headers['access-control-allow-headers'] = 'Authorization, Content-Type, X-Request-Id';
        set.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      }
      if (request.method === 'OPTIONS') { set.status = 204; return new Response(null,{status:204}); }
      if (request.body) {
        if (Number(request.headers.get('content-length')) > maxBodyBytes) {
          // A rejected unread body must not poison the next keep-alive request.
          set.headers.connection = 'close';
          fail(422,'VALIDATION_FAILED','Request body exceeds 6 MiB.');
        }
        let bytes = 0;
        // Preserve Bun's native body until the JSON rejection is flushed, then close the connection.
        context.request = new Request(request,{body:request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({
          transform(chunk,controller) {
            bytes += chunk.byteLength;
            if (bytes > maxBodyBytes) {
              set.headers.connection = 'close';
              fail(422,'VALIDATION_FAILED','Request body exceeds 6 MiB.');
            }
            controller.enqueue(chunk);
          },
        }),{preventCancel:true})});
      }
    })
    .onError(({ code, error, set }) => {
      const failure = error instanceof Failure ? error :
        (code === 'VALIDATION' && error.type !== 'response') || code === 'PARSE' || code === 'INVALID_FILE_TYPE' ? new Failure(422,'VALIDATION_FAILED','Invalid request input.') :
        code === 'NOT_FOUND' ? new Failure(404,'NOT_FOUND','Resource not found.') :
        new Failure(500,'INTERNAL_ERROR','The request could not be completed.');
      set.status = failure.status;
      return { error: { code: failure.code, message: failure.message, requestId: String(set.headers['x-request-id']) } };
    })
    .onAfterResponse(({request,set}) => {
      console.info(JSON.stringify({requestId:set.headers['x-request-id'],method:request.method,path:new URL(request.url).pathname,status:set.status ?? 200}));
    })
    .use(openapi({ documentation: {
      info: {title:'ScamReport v2 API',version:'1.0.0',description:'Caller JWT + RLS. Public feed means signed-in, de-identified data. All errors use error.code/message/requestId. Mutations are audited atomically by database triggers.'},
      components:{securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}},schemas:{ApiError}},
    }}))
    .get('/health', () => ({status:'ok'}), {detail:{summary:'Process health (no credentials required)'}})
    .guard({ detail:{security:[{bearerAuth:[]}]} }, app => app
      .resolve(async ({request,set}) => {
        const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
        if (!token) fail(401,'UNAUTHENTICATED','Sign in to continue.');
        const db = createClient(config.supabaseUrl,config.anonKey,{
          global:{headers:{Authorization:`Bearer ${token}`,'X-Request-Id':String(set.headers['x-request-id'])}},
          auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
        });
        const {data,error} = await db.auth.getUser(token);
        if (error || !data.user) {
          if (error && (!error.status || error.status >= 500)) fail(500,'INTERNAL_ERROR','Authentication service is unavailable.');
          if (error && /expired/i.test(error.message)) fail(401,'SESSION_EXPIRED','Your session expired. Sign in again.');
          fail(401,'UNAUTHENTICATED','Invalid session. Sign in again.');
        }
        const memberships: MembershipType[] = result(await db.from('memberships').select('organization_id,user_id,role').eq('user_id',data.user.id));
        const requireRole = (org: string, roles: MemberRole[]) => {
          if (!memberships.some(m => m.organization_id === org && roles.includes(m.role))) fail(403,'FORBIDDEN','You do not have permission for this organization.');
        };
        const requireCitizen = () => { if (memberships.length) fail(403,'FORBIDDEN','This action is for citizen accounts.'); };
        return {db,user:data.user,memberships,requireRole,requireCitizen};
      })
      .get('/me',({user,memberships}) => ({data:{id:user.id,email:user.email,role:memberships.length ? 'staff' : 'citizen',memberships}}),{response:one(Me),detail:{summary:'Current verified identity and database memberships'}})
      .get('/tenants',async ({db}) => ({data:result(await db.from('organizations').select('id,name').order('name'))}),{response:rows(t.Object({id:Uuid,name:t.String()})),detail:{summary:'Available organizations; staff see only their memberships'}})
      .get('/memberships',async ({db,user,query,requireRole}) => {
        if (query.organization_id) requireRole(query.organization_id,['org_admin']);
        const request = db.from('memberships').select('organization_id,user_id,role');
        return {data:result(await (query.organization_id ? request.eq('organization_id',query.organization_id) : request.eq('user_id',user.id)))};
      },{query:t.Object({organization_id:t.Optional(Uuid)},{additionalProperties:false}),response:rows(Membership),detail:{summary:'Own memberships or admin roster for one tenant'}})
      .put('/memberships',async ({db,user,body,requireRole}) => {
        requireRole(body.organization_id,['org_admin']);
        if (body.user_id === user.id) fail(403,'FORBIDDEN','You cannot change your own membership.');
        return {data:result(await db.from('memberships').upsert(body,{onConflict:'organization_id,user_id'}).select('organization_id,user_id,role').single())};
      },{body:MembershipInput,response:one(Membership),detail:{summary:'Grant or change another user’s membership in your organization'}})
      .delete('/memberships',async ({db,user,body,requireRole}) => {
        requireRole(body.organization_id,['org_admin']);
        if (body.user_id === user.id) fail(403,'FORBIDDEN','You cannot remove your own membership.');
        const data = result(await db.from('memberships').delete().eq('organization_id',body.organization_id).eq('user_id',body.user_id).select('organization_id,user_id,role'));
        if (!data.length) fail(404,'NOT_FOUND','Membership not found.');
        return {data:data[0]};
      },{body:MembershipTarget,response:one(Membership),detail:{summary:'Remove another user’s membership in your organization'}})
      .get('/roles',() => ({data:roleActions}),{response:one(t.Object(Object.fromEntries(Object.keys(roleActions).map(key=>[key,t.Array(t.String())])))),detail:{summary:'Role capability catalog; tenant grants come only from memberships'}})
      .post('/reports',async ({db,body,requireCitizen}) => {
        requireCitizen();
        return {data:result(await db.rpc('create_report',{...body,contact_email:body.contact_email ?? null,contact_phone:body.contact_phone ?? null}))};
      },{body:ReportInput,response:one(Report),detail:{summary:'Create own report with optional private contact snapshot (atomic)'}})
      .get('/reports',async ({db,user,query,requireCitizen}) => {
        requireCitizen();
        return {data:result(await db.from('reports').select(reportFields).eq('reporter_id',user.id).order('created_at',{ascending:false}).order('id').range(query.offset ?? 0,(query.offset ?? 0)+(query.limit ?? 20)-1))};
      },{query:t.Object(Pagination,{additionalProperties:false}),response:rows(Report),detail:{summary:'Citizen’s own reports, paginated'}})
      .post('/reports/:id/withdraw',async ({db,user,params,requireCitizen}) => {
        requireCitizen();
        const data = result(await db.from('reports').update({status:'withdrawn'}).eq('id',params.id).eq('reporter_id',user.id).select(reportFields));
        if (!data.length) fail(404,'NOT_FOUND','Report not found.');
        return {data:data[0]};
      },{params:IdParams,response:one(Report),detail:{summary:'Withdraw own report; public and organization access ends'}})
      .get('/feed',async ({db,query}) => ({data:result(await db.rpc('public_feed',{search:query.search ?? '',page_size:query.limit ?? 20,page_offset:query.offset ?? 0}))}),{
        query:t.Object({...Pagination,search:t.Optional(t.String({maxLength:80}))},{additionalProperties:false}),response:rows(FeedItem),detail:{summary:'Verified public projection, searched by scam type or channel; no identities or free text'},
      })
      .get('/moderation/queue',async ({db,query,requireRole}) => {
        requireRole(query.organization_id,['moderator','org_admin']);
        return {data:result(await db.from('reports').select(reportFields).eq('organization_id',query.organization_id).neq('status','withdrawn').order('created_at',{ascending:false}).order('id').range(query.offset ?? 0,(query.offset ?? 0)+(query.limit ?? 20)-1))};
      },{query:t.Object({organization_id:Uuid,...Pagination},{additionalProperties:false}),response:rows(Report),detail:{summary:'Organization-only report rows; executive denied'}})
      .post('/moderation/:id',async ({db,params,body,requireRole}) => {
        const report = result(await db.from('reports').select('organization_id').eq('id',params.id).maybeSingle());
        requireRole(report.organization_id,['moderator']);
        return {data:result(await db.from('reports').update({status:body.status}).eq('id',params.id).select(reportFields).single())};
      },{params:IdParams,body:ModerationInput,response:one(Report),detail:{summary:'Moderator verifies, rejects or flags a pending/flagged report; atomic audit/history'}})
      .get('/reports/:id/contacts',async ({db,user,params,requireRole}) => {
        const report = result(await db.from('reports').select('organization_id,reporter_id,consent_contact').eq('id',params.id).maybeSingle());
        if (report.reporter_id !== user.id) {
          requireRole(report.organization_id,['moderator','org_admin']);
          if (!report.consent_contact) fail(403,'FORBIDDEN','The reporter did not consent to contact sharing.');
        }
        return {data:result(await db.from('report_contacts').select('report_id,email,phone').eq('report_id',params.id).maybeSingle())};
      },{params:IdParams,response:one(t.Object({report_id:Uuid,email:t.Nullable(t.String()),phone:t.Nullable(t.String())})),detail:{summary:'Private contact snapshot; assigned organization requires explicit consent'}})
      .post('/reports/:id/evidence',async ({db,user,params,body,requireCitizen}) => {
        requireCitizen();
        const report = result(await db.from('reports').select('reporter_id,status').eq('id',params.id).maybeSingle());
        if (report.reporter_id !== user.id) fail(403,'FORBIDDEN','Only the reporter can upload evidence.');
        if (report.status !== 'pending') fail(422,'VALIDATION_FAILED','Evidence requires a pending report.');
        const bytes = new Uint8Array(await body.file.arrayBuffer());
        const mime = body.file.type;
        const valid = mime === 'application/pdf' ? new TextDecoder().decode(bytes.subarray(0,5)) === '%PDF-' :
          mime === 'image/png' ? [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v) : bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
        if (!valid) fail(422,'VALIDATION_FAILED','The file content does not match its media type.');
        const extension = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
        const path = `${params.id}/${crypto.randomUUID()}.${extension}`;
        const uploaded = await db.storage.from('evidence').upload(path,bytes,{contentType:mime,upsert:false});
        if (uploaded.error) fail(403,'FORBIDDEN','Evidence upload was denied.');
        return {data:{path}};
      },{params:IdParams,body:t.Object({file:t.File({type:['image/png','image/jpeg','application/pdf'],minSize:1,maxSize:5*1024*1024})},{additionalProperties:false}),response:one(t.Object({path:t.String()})),detail:{summary:'Upload immutable private evidence, max 5 MiB; PNG, JPEG or PDF'}})
      .get('/reports/:id/evidence',async ({db,user,params,requireRole}) => {
        const report = result(await db.from('reports').select('organization_id,reporter_id').eq('id',params.id).maybeSingle());
        if (report.reporter_id !== user.id) requireRole(report.organization_id,['moderator','org_admin']);
        const listed = await db.storage.from('evidence').list(params.id,{limit:100,sortBy:{column:'name',order:'asc'}});
        if (listed.error) fail(500,'INTERNAL_ERROR','Evidence could not be listed.');
        return {data:(listed.data ?? []).map(file=>({path:`${params.id}/${file.name}`}))};
      },{params:IdParams,response:rows(t.Object({path:t.String()})),detail:{summary:'List private evidence paths for a visible report'}})
      .get('/reports/:id/evidence/:filename',async ({db,user,params,requireRole,set}) => {
        const report = result(await db.from('reports').select('organization_id,reporter_id').eq('id',params.id).maybeSingle());
        if (report.reporter_id !== user.id) requireRole(report.organization_id,['moderator','org_admin']);
        const downloaded = await db.storage.from('evidence').download(`${params.id}/${params.filename}`);
        if (downloaded.error || !downloaded.data) fail(404,'NOT_FOUND','Evidence not found.');
        set.headers['content-disposition'] = `attachment; filename="${params.filename}"`;
        set.headers['content-security-policy'] = "default-src 'none'; sandbox";
        return new Response(downloaded.data);
      },{params:t.Object({id:Uuid,filename:t.String({pattern:'^[a-f0-9-]{36}\\.(pdf|png|jpg)$'})},{additionalProperties:false}),detail:{summary:'Download evidence with authorization on every read, never a public URL'},response:{200:t.File(),...ErrorResponses}})
      .get('/statistics',async ({db,query,requireRole}) => {
        requireRole(query.organization_id,['executive']);
        return {data:result(await db.rpc('executive_statistics',{org:query.organization_id}))};
      },{query:TenantQuery,response:rows(t.Object({status:t.String(),report_count:t.Number(),total_amount:t.Number()})),detail:{summary:'Executive-only aggregate counts/amounts for own organization'}})
      .get('/audit',async ({db,query,requireRole}) => {
        requireRole(query.organization_id,['org_admin']);
        return {data:result(await db.from('audit_log').select('id,organization_id,actor_id,action,resource_id,request_id,created_at').eq('organization_id',query.organization_id).order('created_at',{ascending:false}).order('id').range(query.offset ?? 0,(query.offset ?? 0)+(query.limit ?? 20)-1))};
      },{query:t.Object({organization_id:Uuid,...Pagination},{additionalProperties:false}),response:rows(t.Object({id:Uuid,organization_id:Uuid,actor_id:t.Nullable(Uuid),action:t.String(),resource_id:Uuid,request_id:t.String(),created_at:t.String()})),detail:{summary:'Organization admin reads immutable tenant-scoped mutation audit'}})
    );
}
