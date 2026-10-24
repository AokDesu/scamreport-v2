-- Smallest database support the citizen app and organization console need.
-- Every function keeps the foundation pattern: private security-definer body with its own
-- authorization check, public security-invoker wrapper, execution only for authenticated users.

-- Human ticket reference shown to citizens and moderators (rendered as SR-<BE year>-<number>).
-- It is a label, never an authorization key; identity columns cannot be written by clients.
alter table public.reports add column ticket_no bigint generated always as identity (start with 4801) unique;

-- Request-correlation helper shared by the audit writers below.
create function private.request_correlation() returns text language sql stable set search_path = '' as $$
  select left(coalesce(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', gen_random_uuid()::text), 128);
$$;
revoke all on function private.request_correlation() from public, anon, authenticated;

-- Denied attempts (API 403s) for the organization activity log. Only the caller's own attempt is
-- recorded, and only into organizations the caller belongs to: the target organization when the
-- caller is its member, otherwise the caller's own organizations (a cross-tenant attempt).
-- Citizens have no organization, so they can never write into any tenant's log.
create function private.record_denial(target uuid, denied_action text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if denied_action !~ '^[a-z][a-z_.:-]{0,63}$' then
    raise exception using errcode = '22023', message = 'Invalid action name';
  end if;
  if auth.uid() is null then return; end if;
  insert into public.audit_log(organization_id, actor_id, action, resource_id, request_id)
  select m.organization_id, auth.uid(), 'denied.' || denied_action, target, private.request_correlation()
  from public.memberships m
  where m.user_id = auth.uid() and (m.organization_id = target or not exists (
    select 1 from public.memberships own where own.user_id = auth.uid() and own.organization_id = target
  ));
end;
$$;
create function public.record_denial(target uuid, denied_action text)
returns void language sql security invoker set search_path = '' as $$ select private.record_denial($1, $2); $$;

-- Staff never read report_contacts directly: the table policy now serves only the reporter, and
-- staff get a contact solely through read_report_contact, which writes the report_contacts.view
-- audit row first. If that write fails the function raises and returns nothing.
drop policy contacts_read on public.report_contacts;
create policy contacts_read on public.report_contacts for select to authenticated using ((select private.is_citizen()) and exists (
  select 1 from public.reports r where r.id = report_id and r.reporter_id = (select auth.uid())
));
create function private.read_report_contact(report uuid)
returns table(report_id uuid, email text, phone text)
language plpgsql security definer set search_path = '' as $$
declare target public.reports;
begin
  select r.* into target from public.reports r
  where r.id = report and r.consent_contact and r.status <> 'withdrawn'
    and private.has_role(r.organization_id, array['moderator','org_admin']::public.member_role[]);
  if not found then return; end if;
  insert into public.audit_log(organization_id, actor_id, action, resource_id, request_id)
  values (target.organization_id, auth.uid(), 'report_contacts.view', target.id, private.request_correlation());
  return query select c.report_id, c.email, c.phone from public.report_contacts c where c.report_id = target.id;
end;
$$;
create function public.read_report_contact(report uuid)
returns table(report_id uuid, email text, phone text)
language sql security invoker set search_path = '' as $$ select * from private.read_report_contact($1); $$;

-- Staff roster with display names for moderators and admins of the same organization.
-- Sign-in emails are returned to organization admins only; executives and citizens are denied.
create function private.organization_roster(org uuid)
returns table(user_id uuid, role public.member_role, display_name text, email text)
language plpgsql stable security definer set search_path = '' as $$
declare is_admin boolean := private.has_role(org, array['org_admin']::public.member_role[]);
begin
  if not private.has_role(org, array['moderator','org_admin']::public.member_role[]) then raise insufficient_privilege; end if;
  return query
    select m.user_id, m.role, coalesce(p.display_name, ''), case when is_admin then u.email::text end
    from public.memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.user_id = m.user_id
    where m.organization_id = org
    order by m.role, p.display_name, m.user_id;
end;
$$;
create function public.organization_roster(org uuid)
returns table(user_id uuid, role public.member_role, display_name text, email text)
language sql stable security invoker set search_path = '' as $$ select * from private.organization_roster($1); $$;

-- Executive dashboard breakdowns: counts only, never rows, identities, text or amounts per case.
create function private.executive_breakdown(org uuid)
returns table(dimension text, bucket text, report_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role(org, array['executive']::public.member_role[]) then raise insufficient_privilege; end if;
  return query
    select 'scam_type'::text, r.scam_type, count(*) from public.reports r where r.organization_id = org group by r.scam_type
    union all
    select 'channel'::text, r.channel, count(*) from public.reports r where r.organization_id = org group by r.channel
    union all
    select 'consent'::text, r.consent_contact::text, count(*) from public.reports r where r.organization_id = org group by r.consent_contact
    union all
    select 'week'::text, to_char(date_trunc('week', r.created_at), 'YYYY-MM-DD'), count(*) from public.reports r
      where r.organization_id = org and r.created_at >= date_trunc('week', now()) - interval '7 weeks' group by 2
    union all
    select 'week_verified'::text, to_char(date_trunc('week', r.created_at), 'YYYY-MM-DD'), count(*) from public.reports r
      where r.organization_id = org and r.status = 'verified' and r.created_at >= date_trunc('week', now()) - interval '7 weeks' group by 2;
end;
$$;
create function public.executive_breakdown(org uuid)
returns table(dimension text, bucket text, report_count bigint)
language sql stable security invoker set search_path = '' as $$ select * from private.executive_breakdown($1); $$;

revoke all on function private.record_denial(uuid, text), private.read_report_contact(uuid),
  private.organization_roster(uuid), private.executive_breakdown(uuid) from public, anon;
grant execute on function private.record_denial(uuid, text), private.read_report_contact(uuid),
  private.organization_roster(uuid), private.executive_breakdown(uuid),
  public.record_denial(uuid, text), public.read_report_contact(uuid),
  public.organization_roster(uuid), public.executive_breakdown(uuid) to authenticated;
