-- Authorization is database state, never user-editable JWT metadata.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;

create type public.member_role as enum ('moderator', 'org_admin', 'executive');
create type public.report_status as enum ('pending', 'verified', 'rejected', 'flagged', 'withdrawn');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120)
);
create table public.memberships (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id),
  role public.member_role not null,
  primary key (organization_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  display_name text not null default '' check (char_length(display_name) <= 100),
  contact_email text check (char_length(contact_email) <= 254),
  contact_phone text check (char_length(contact_phone) <= 40)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users(id),
  organization_id uuid not null references public.organizations(id),
  scam_type text not null check (scam_type in ('impersonation','shopping','investment','phishing','other')),
  channel text not null check (channel in ('phone','sms','social','website','email','other')),
  amount numeric(14,2) not null check (amount >= 0),
  description text not null check (char_length(description) between 10 and 5000),
  status public.report_status not null default 'pending',
  consent_contact boolean not null default false,
  created_at timestamptz not null default now()
);
create index reports_reporter_idx on public.reports(reporter_id, created_at desc);
create index reports_org_status_idx on public.reports(organization_id, status, created_at desc);
create table public.report_contacts (
  report_id uuid primary key references public.reports(id),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 40)
);
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid not null references auth.users(id),
  from_status public.report_status not null,
  to_status public.report_status not null,
  request_id text not null,
  created_at timestamptz not null default now()
);
create index moderation_org_idx on public.moderation_actions(organization_id, created_at desc);
create index moderation_report_idx on public.moderation_actions(report_id);
create index moderation_actor_idx on public.moderation_actions(actor_id);
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  actor_id uuid references auth.users(id),
  action text not null,
  resource_id uuid not null,
  request_id text not null,
  created_at timestamptz not null default now()
);
create index audit_org_idx on public.audit_log(organization_id, created_at desc);
create index audit_actor_idx on public.audit_log(actor_id);

-- Non-exposed lookup avoids recursive membership policies. Identity is always auth.uid().
create function private.has_role(org uuid, allowed public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = auth.uid() and m.role = any(allowed)
  );
$$;
create function private.is_citizen()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and not exists (
    select 1 from public.memberships where user_id = auth.uid()
  );
$$;
revoke all on function private.has_role(uuid, public.member_role[]), private.is_citizen() from public, anon;
grant execute on function private.has_role(uuid, public.member_role[]), private.is_citizen() to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.report_contacts enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_log enable row level security;
revoke all on public.organizations, public.memberships, public.profiles, public.reports,
 public.report_contacts, public.moderation_actions, public.audit_log from anon, authenticated;
grant select on public.organizations, public.memberships, public.profiles, public.reports,
 public.report_contacts, public.moderation_actions, public.audit_log to authenticated;
grant insert, update, delete on public.memberships to authenticated;
grant insert on public.reports, public.report_contacts to authenticated;
grant update(status) on public.reports to authenticated;
grant update(display_name, contact_email, contact_phone) on public.profiles to authenticated;

create policy organizations_read on public.organizations for select to authenticated
using ((select private.is_citizen()) or private.has_role(id, array['moderator','org_admin','executive']::public.member_role[]));
create policy memberships_read on public.memberships for select to authenticated
using (user_id = (select auth.uid()) or private.has_role(organization_id, array['org_admin']::public.member_role[]));
create policy memberships_add on public.memberships for insert to authenticated
with check (user_id <> (select auth.uid()) and private.has_role(organization_id, array['org_admin']::public.member_role[]));
create policy memberships_change on public.memberships for update to authenticated
using (user_id <> (select auth.uid()) and private.has_role(organization_id, array['org_admin']::public.member_role[]))
with check (user_id <> (select auth.uid()) and private.has_role(organization_id, array['org_admin']::public.member_role[]));
create policy memberships_remove on public.memberships for delete to authenticated
using (user_id <> (select auth.uid()) and private.has_role(organization_id, array['org_admin']::public.member_role[]));
create policy profiles_read on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_change on public.profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reports_read on public.reports for select to authenticated using (
  (reporter_id = (select auth.uid()) and (select private.is_citizen())) or
  (status <> 'withdrawn' and private.has_role(organization_id, array['moderator','org_admin']::public.member_role[]))
);
create policy reports_add on public.reports for insert to authenticated with check (
  reporter_id = (select auth.uid()) and status = 'pending' and (select private.is_citizen())
);
create policy reports_change on public.reports for update to authenticated using (
  (reporter_id = (select auth.uid()) and (select private.is_citizen())) or
  (status <> 'withdrawn' and private.has_role(organization_id, array['moderator']::public.member_role[]))
) with check (
  (reporter_id = (select auth.uid()) and status = 'withdrawn' and (select private.is_citizen())) or
  (status in ('verified','rejected','flagged') and private.has_role(organization_id, array['moderator']::public.member_role[]))
);
create policy contacts_read on public.report_contacts for select to authenticated using (exists (
  select 1 from public.reports r where r.id = report_id and (
    r.reporter_id = (select auth.uid()) or
    (r.consent_contact and private.has_role(r.organization_id, array['moderator','org_admin']::public.member_role[]))
  )
));
create policy contacts_add on public.report_contacts for insert to authenticated with check (exists (
  select 1 from public.reports r where r.id = report_id and r.reporter_id = (select auth.uid())
  and r.status = 'pending' and (select private.is_citizen())
));
create policy moderation_read on public.moderation_actions for select to authenticated
using (private.has_role(organization_id, array['moderator','org_admin']::public.member_role[]));
create policy audit_read on public.audit_log for select to authenticated
using (private.has_role(organization_id, array['org_admin']::public.member_role[]));

create function private.guard_changes() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'memberships' then
    if new.organization_id <> old.organization_id or new.user_id <> old.user_id then
      raise exception using errcode = '42501', message = 'Membership identity is immutable';
    end if;
  else
    if new.status = old.status or old.status = 'withdrawn' then
      raise exception using errcode = '22023', message = 'Invalid report transition';
    end if;
    if new.status <> 'withdrawn' and old.status not in ('pending','flagged') then
      raise exception using errcode = '22023', message = 'Only pending or flagged reports can be moderated';
    end if;
  end if;
  return new;
end;
$$;
create trigger membership_identity before update on public.memberships for each row execute function private.guard_changes();
create trigger report_transition before update on public.reports for each row execute function private.guard_changes();

-- Trigger-only definer: mutations and audit commit together; no client audit write privilege.
create function private.record_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  correlation text := coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', gen_random_uuid()::text);
  resource uuid;
begin
  if tg_table_name = 'memberships' then resource := (row_data ->> 'user_id')::uuid;
  else resource := (row_data ->> 'id')::uuid; end if;
  insert into public.audit_log(organization_id, actor_id, action, resource_id, request_id)
  values ((row_data ->> 'organization_id')::uuid, auth.uid(), tg_table_name || '.' || lower(tg_op), resource, left(correlation,128));
  if tg_table_name = 'reports' and tg_op = 'UPDATE' then
    if new.status <> 'withdrawn' and auth.uid() is not null then
      insert into public.moderation_actions(report_id,organization_id,actor_id,from_status,to_status,request_id)
      values (new.id,new.organization_id,auth.uid(),old.status,new.status,left(correlation,128));
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.record_change(), private.guard_changes() from public, anon, authenticated;
create trigger reports_audit after insert or update on public.reports for each row execute function private.record_change();
create trigger memberships_audit after insert or update or delete on public.memberships for each row execute function private.record_change();

create function public.create_report(organization_id uuid, scam_type text, channel text, amount numeric,
  description text, consent_contact boolean, contact_email text default null, contact_phone text default null)
returns public.reports language plpgsql security invoker set search_path = '' as $$
declare created public.reports;
begin
  insert into public.reports(organization_id,scam_type,channel,amount,description,consent_contact)
  values ($1,$2,$3,$4,$5,$6) returning * into created;
  insert into public.report_contacts(report_id,email,phone) values (created.id,$7,$8);
  return created;
end;
$$;
grant execute on function public.create_report(uuid,text,text,numeric,text,boolean,text,text) to authenticated;

-- Deliberate projections, not views exposing reporter IDs or free-text descriptions.
create function private.public_feed(search text, page_size integer, page_offset integer)
returns table(id uuid, scam_type text, channel text, amount numeric, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  return query select r.id,r.scam_type,r.channel,r.amount,r.created_at from public.reports r
  where r.status = 'verified' and (search = '' or r.scam_type ilike '%' || search || '%' or r.channel ilike '%' || search || '%')
  order by r.created_at desc,r.id limit least(greatest(page_size,1),100) offset greatest(page_offset,0);
end;
$$;
create function public.public_feed(search text default '', page_size integer default 20, page_offset integer default 0)
returns table(id uuid, scam_type text, channel text, amount numeric, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$ select * from private.public_feed($1,$2,$3); $$;
create function private.executive_statistics(org uuid)
returns table(status public.report_status, report_count bigint, total_amount numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role(org, array['executive']::public.member_role[]) then raise insufficient_privilege; end if;
  return query select r.status,count(*),coalesce(sum(r.amount),0) from public.reports r
  where r.organization_id = org group by r.status;
end;
$$;
create function public.executive_statistics(org uuid)
returns table(status public.report_status, report_count bigint, total_amount numeric)
language sql stable security invoker set search_path = '' as $$ select * from private.executive_statistics($1); $$;
revoke all on function private.public_feed(text,integer,integer), private.executive_statistics(uuid) from public, anon;
grant execute on function private.public_feed(text,integer,integer), private.executive_statistics(uuid),
 public.public_feed(text,integer,integer), public.executive_statistics(uuid) to authenticated;

create function private.new_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id,contact_email) values (new.id,new.email);
  return new;
end;
$$;
revoke all on function private.new_profile() from public, anon, authenticated;
create trigger auth_profile after insert on auth.users for each row execute function private.new_profile();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('evidence','evidence',false,5242880,array['image/png','image/jpeg','application/pdf']);
-- Object paths are report UUID / random UUID.extension. No overwrite/delete policy: evidence is immutable.
create policy evidence_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'evidence' and exists (select 1 from public.reports r
    where r.id::text = (storage.foldername(name))[1] and r.reporter_id = (select auth.uid())
    and r.status = 'pending' and (select private.is_citizen()))
);
create policy evidence_read on storage.objects for select to authenticated using (
  bucket_id = 'evidence' and exists (select 1 from public.reports r where r.id::text = (storage.foldername(name))[1])
);
