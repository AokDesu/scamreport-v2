import { Elysia, t } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { createClient } from '@supabase/supabase-js';
import {
  ApiError, AuditCounts, AuditEntry, AuditFilter, BreakdownRow, Contact, Data, ErrorResponses, FeedItem, IdParams, Me, Membership, MembershipInput,
  MembershipTarget, ModerationInput, Pagination, QueueCounts, QueueQuery, Report, ReportDetail, ReportInput, RosterMember, StatisticsRow, Tenant,
  TenantQuery, Uuid, type ErrorCode, type MemberRole, type Membership as MembershipType,
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
const reportFields = 'id,ticket_no,reporter_id,organization_id,scam_type,channel,amount,description,status,consent_contact,created_at';
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
        // Denials are written to the organization activity log before the 403 leaves; a logging
        // failure must never turn a denial into success, so it is ignored here.
        const deny = async (org: string, action: string, message: string): Promise<never> => {
          await db.rpc('record_denial',{target:org,denied_action:action});
          fail(403,'FORBIDDEN',message);
        };
        const requireRole = async (org: string, roles: MemberRole[], action: string) => {
          if (!memberships.some(m => m.organization_id === org && roles.includes(m.role))) await deny(org,action,'You do not have permission for this organization.');
        };
        // For routes keyed by a row ID: a staff member without the role is told so (and logged);
        // a foreign row stays a 404 so other tenants' resources are never revealed.
        const requireAnyRole = async (roles: MemberRole[], action: string) => {
          if (memberships.some(m => roles.includes(m.role))) return;
          if (memberships[0]) await deny(memberships[0].organization_id,action,'Your role cannot open this resource.');
          fail(403,'FORBIDDEN','Your role cannot open this resource.');
        };
        const requireCitizen = async () => { if (memberships[0]) await deny(memberships[0].organization_id,'reports.citizen','This action is for citizen accounts.'); };
        return {db,user:data.user,memberships,deny,requireRole,requireAnyRole,requireCitizen};
      })
      .get('/me',({user,memberships}) => ({data:{id:user.id,email:user.email,role:memberships.length ? 'staff' : 'citizen',memberships}}),{response:one(Me),detail:{summary:'Current verified identity and database memberships'}})
      .get('/tenants',async ({db}) => ({data:result(await db.from('organizations').select('id,name').order('name'))}),{response:rows(Tenant),detail:{summary:'Available organizations; staff see only their memberships'}})
      .get('/memberships',async ({db,user,query,requireRole}) => {
        if (query.organization_id) await requireRole(query.organization_id,['org_admin'],'memberships.read');
        const request = db.from('memberships').select('organization_id,user_id,role');
        return {data:result(await (query.organization_id ? request.eq('organization_id',query.organization_id) : request.eq('user_id',user.id)))};
      },{query:t.Object({organization_id:t.Optional(Uuid)},{additionalProperties:false}),response:rows(Membership),detail:{summary:'Own memberships or admin roster for one tenant'}})
      .put('/memberships',async ({db,user,body,deny,requireRole}) => {
        await requireRole(body.organization_id,['org_admin'],'memberships.write');
        if (body.user_id === user.id) await deny(body.organization_id,'memberships.self','You cannot change your own membership.');
        return {data:result(await db.from('memberships').upsert(body,{onConflict:'organization_id,user_id'}).select('organization_id,user_id,role').single())};
      },{body:MembershipInput,response:one(Membership),detail:{summary:'Grant or change another user’s membership in your organization'}})
      .delete('/memberships',async ({db,user,body,deny,requireRole}) => {
        await requireRole(body.organization_id,['org_admin'],'memberships.write');
        if (body.user_id === user.id) await deny(body.organization_id,'memberships.self','You cannot remove your own membership.');
        const data = result(await db.from('memberships').delete().eq('organization_id',body.organization_id).eq('user_id',body.user_id).select('organization_id,user_id,role'));
        if (!data.length) fail(404,'NOT_FOUND','Membership not found.');
        return {data:data[0]};
      },{body:MembershipTarget,response:one(Membership),detail:{summary:'Remove another user’s membership in your organization'}})
      .get('/members',async ({db,query,requireRole}) => {
        await requireRole(query.organization_id,['moderator','org_admin'],'members.read');
        return {data:result(await db.rpc('organization_roster',{org:query.organization_id}))};
      },{query:TenantQuery,response:rows(RosterMember),detail:{summary:'Staff names for the organization; sign-in emails only for organization admins'}})
      .get('/roles',() => ({data:roleActions}),{response:one(t.Object(Object.fromEntries(Object.keys(roleActions).map(key=>[key,t.Array(t.String())])))),detail:{summary:'Role capability catalog; tenant grants come only from memberships'}})
      .post('/reports',async ({db,body,requireCitizen}) => {
        await requireCitizen();
        return {data:result(await db.rpc('create_report',{...body,contact_email:body.contact_email ?? null,contact_phone:body.contact_phone ?? null}))};
      },{body:ReportInput,response:one(Report),detail:{summary:'Create own report with optional private contact snapshot (atomic)'}})
      .get('/reports',async ({db,user,query,requireCitizen}) => {
        await requireCitizen();
        return {data:result(await db.from('reports').select(reportFields).eq('reporter_id',user.id).order('created_at',{ascending:false}).order('id').range(query.offset ?? 0,(query.offset ?? 0)+(query.limit ?? 20)-1))};
      },{query:t.Object(Pagination,{additionalProperties:false}),response:rows(Report),detail:{summary:'Citizen’s own reports, paginated'}})
      .get('/reports/:id',async ({db,user,params,requireCitizen}) => {
        await requireCitizen();
        return {data:result(await db.from('reports').select(reportFields).eq('id',params.id).eq('reporter_id',user.id).maybeSingle())};
      },{params:IdParams,response:one(Report),detail:{summary:'One citizen-owned report; foreign IDs are 404'}})
      .post('/reports/:id/withdraw',async ({db,user,params,requireCitizen}) => {
        await requireCitizen();
        const data = result(await db.from('reports').update({status:'withdrawn'}).eq('id',params.id).eq('reporter_id',user.id).select(reportFields));
        if (!data.length) fail(404,'NOT_FOUND','Report not found.');
        return {data:data[0]};
      },{params:IdParams,response:one(Report),detail:{summary:'Withdraw own report; public and organization access ends'}})
      .get('/feed',async ({db,query}) => ({data:result(await db.rpc('public_feed',{search:query.search ?? '',page_size:query.limit ?? 20,page_offset:query.offset ?? 0}))}),{
        query:t.Object({...Pagination,search:t.Optional(t.String({maxLength:80}))},{additionalProperties:false}),response:rows(FeedItem),detail:{summary:'Verified public projection, searched by scam type or channel; no identities or free text'},
      })
      .get('/moderation/queue',async ({db,query,requireRole}) => {
        await requireRole(query.organization_id,['moderator','org_admin'],'moderation.queue');
        const base = db.from('reports').select(reportFields).eq('organization_id',query.organization_id).neq('status','withdrawn');
        const tab = query.status;
        const filtered = tab === 'decided' ? base.in('status',['verified','rejected']) : tab ? base.eq('status',tab) : base;
        return {data:result(await filtered.order('created_at',{ascending:false}).order('id').range(query.offset ?? 0,(query.offset ?? 0)+(query.limit ?? 20)-1))};
      },{query:QueueQuery,response:rows(Report),detail:{summary:'Organization-only report rows, newest first, optionally one tab; executive denied'}})
      .get('/moderation/next',async ({db,query,requireRole}) => {
        await requireRole(query.organization_id,['moderator','org_admin'],'moderation.queue');
        const reports = result(await db.from('reports').select(reportFields).eq('organization_id',query.organization_id).eq('status','pending').order('created_at').order('id').limit(1));
        return {data:reports[0] ?? null};
      },{query:TenantQuery,response:one(t.Nullable(Report)),detail:{summary:'Oldest pending report across the organization queue; executive denied'}})
      .get('/moderation/queue/counts',async ({db,query,requireRole}) => {
        await requireRole(query.organization_id,['moderator','org_admin'],'moderation.queue');
        const count = async (statuses: string[]) => {
          const {count,error} = await db.from('reports').select('id',{count:'exact',head:true}).eq('organization_id',query.organization_id).in('status',statuses);
          if (error || count === null) fail(500,'INTERNAL_ERROR','The request could not be completed.');
          return count;
        };
        const [pending,flagged,decided] = await Promise.all([count(['pending']),count(['flagged']),count(['verified','rejected'])]);
        return {data:{pending,flagged,decided}};
      },{query:TenantQuery,response:one(QueueCounts),detail:{summary:'Per-tab report totals for the organization queue; executive denied'}})
      .get('/moderation/:id',async ({db,params,requireAnyRole,requireRole}) => {
        await requireAnyRole(['moderator','org_admin'],'moderation.report');
        const report = result(await db.from('reports').select(reportFields).eq('id',params.id).maybeSingle());
        await requireRole(report.organization_id,['moderator','org_admin'],'moderation.report');
        const history = result(await db.from('moderation_actions').select('actor_id,from_status,to_status,request_id,created_at').eq('report_id',params.id).order('created_at'));
        return {data:{report,history}};
      },{params:IdParams,response:one(ReportDetail),detail:{summary:'One report of your organization with its decision history; foreign IDs are 404'}})
      .post('/moderation/:id',async ({db,params,body,requireRole}) => {
        const report = result(await db.from('reports').select('organization_id').eq('id',params.id).maybeSingle());
        await requireRole(report.organization_id,['moderator'],'moderation.decide');
        return {data:result(await db.from('reports').update({status:body.status}).eq('id',params.id).select(reportFields).single())};
      },{params:IdParams,body:ModerationInput,response:one(Report),detail:{summary:'Moderator verifies, rejects or flags a pending/flagged report; atomic audit/history'}})
      .get('/reports/:id/contacts',async ({db,memberships,params,deny,requireRole}) => {
        const report = result(await db.from('reports').select('organization_id,consent_contact').eq('id',params.id).maybeSingle());
        const staff = memberships.length > 0;
        if (staff) {
          await requireRole(report.organization_id,['moderator','org_admin'],'contacts.read');
          if (!report.consent_contact) await deny(report.organization_id,'contacts.consent','The reporter did not consent to contact sharing.');
          // Staff cannot select the table: the definer function audits the view first and returns nothing if that write fails.
          const [contact] = result(await db.rpc('read_report_contact',{report:params.id}));
          if (!contact) fail(404,'NOT_FOUND','Resource not found.');
          return {data:contact};
        }
        return {data:result(await db.from('report_contacts').select('report_id,email,phone').eq('report_id',params.id).maybeSingle())};
      },{params:IdParams,response:one(Contact),detail:{summary:'Private contact snapshot; assigned organization requires explicit consent; staff views are audited'}})
      .post('/reports/:id/evidence',async ({db,user,params,body,requireCitizen}) => {
        await requireCitizen();
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
        if (report.reporter_id !== user.id) await requireRole(report.organization_id,['moderator','org_admin'],'evidence.read');
        const listed = await db.storage.from('evidence').list(params.id,{limit:100,sortBy:{column:'name',order:'asc'}});
        if (listed.error) fail(500,'INTERNAL_ERROR','Evidence could not be listed.');
        return {data:(listed.data ?? []).map(file=>({path:`${params.id}/${file.name}`}))};
      },{params:IdParams,response:rows(t.Object({path:t.String()})),detail:{summary:'List private evidence paths for a visible report'}})
      .get('/reports/:id/evidence/:filename',async ({db,user,params,requireRole,set}) => {
        const report = result(await db.from('reports').select('organization_id,reporter_id').eq('id',params.id).maybeSingle());
        if (report.reporter_id !== user.id) await requireRole(report.organization_id,['moderator','org_admin'],'evidence.read');
        const downloaded = await db.storage.from('evidence').download(`${params.id}/${params.filename}`);
        if (downloaded.error || !downloaded.data) fail(404,'NOT_FOUND','Evidence not found.');
        set.headers['content-disposition'] = `attachment; filename="${params.filename}"`;
        set.headers['content-security-policy'] = "default-src 'none'; sandbox";
        return new Response(downloaded.data);
      },{params:t.Object({id:Uuid,filename:t.String({pattern:'^[a-f0-9-]{36}\\.(pdf|png|jpg)$'})},{additionalProperties:false}),detail:{summary:'Download evidence with authorization on every read, never a public URL'},response:{200:t.File(),...ErrorResponses}})
      .get('/statistics',async ({db,query,requireRole}) => {
        await requireRole(query.organization_id,['executive'],'statistics.read');
        return {data:result(await db.rpc('executive_statistics',{org:query.organization_id}))};
      },{query:TenantQuery,response:rows(StatisticsRow),detail:{summary:'Executive-only aggregate counts/amounts for own organization'}})
      .get('/statistics/breakdown',async ({db,query,requireRole}) => {
        await requireRole(query.organization_id,['executive'],'statistics.read');
        return {data:result(await db.rpc('executive_breakdown',{org:query.organization_id}))};
      },{query:TenantQuery,response:rows(BreakdownRow),detail:{summary:'Executive-only counts by scam type, channel, consent and week; no rows or identities'}})
      .get('/audit',async ({db,query,requireRole}) => {
        await requireRole(query.organization_id,['org_admin'],'audit.read');
        const base = db.from('audit_log').select('id,organization_id,actor_id,action,resource_id,request_id,created_at').eq('organization_id',query.organization_id);
        const filtered = query.result === 'denied' ? base.like('action','denied.%') : query.result === 'success' ? base.not('action','like','denied.%') : base;
        const entries = result(await filtered.order('created_at',{ascending:false}).order('id').range(query.offset ?? 0,(query.offset ?? 0)+(query.limit ?? 20)-1));
        // Ticket labels for report rows still visible to this admin (withdrawn reports stay hidden); the label's year is the report's own.
        const tickets = result(await db.from('reports').select('id,ticket_no,created_at').in('id',[...new Set(entries.map(entry=>entry.resource_id))]));
        const ticketOf = new Map(tickets.map(row=>[row.id,row]));
        const updates = entries.filter(entry=>entry.action==='reports.update');
        const decisions = updates.length ? result(await db.from('moderation_actions').select('report_id,actor_id,request_id,created_at').eq('organization_id',query.organization_id).in('report_id',[...new Set(updates.map(entry=>entry.resource_id))])) : [];
        return {data:entries.map(entry=>({...entry,ticket_no:ticketOf.get(entry.resource_id)?.ticket_no ?? null,report_created_at:ticketOf.get(entry.resource_id)?.created_at ?? null,is_moderation:entry.action==='reports.update' && decisions.some(decision=>decision.report_id===entry.resource_id && decision.actor_id===entry.actor_id && decision.request_id===entry.request_id && decision.created_at===entry.created_at)}))};
      },{query:AuditFilter,response:rows(AuditEntry),detail:{summary:'Organization admin reads immutable tenant-scoped audit, including denied attempts; optional result filter'}})
      .get('/audit/counts',async ({db,query,requireRole}) => {
        await requireRole(query.organization_id,['org_admin'],'audit.read');
        const count = async (denied?: boolean) => {
          const base = db.from('audit_log').select('id',{count:'exact',head:true}).eq('organization_id',query.organization_id);
          const {count,error} = await (denied ? base.like('action','denied.%') : base);
          if (error || count === null) fail(500,'INTERNAL_ERROR','The request could not be completed.');
          return count;
        };
        const [total,denied] = await Promise.all([count(),count(true)]);
        return {data:{total,denied}};
      },{query:TenantQuery,response:one(AuditCounts),detail:{summary:'Total and denied entries in the organization audit'}})
    );
}
