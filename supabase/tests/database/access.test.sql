begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();
-- Isolate the six demo fixtures from earlier API/demo runs without persisting cleanup.
-- All deletions and assertions are rolled back below; never run this suite on a hosted database.
delete from public.moderation_actions;
delete from public.audit_log;
delete from public.report_contacts where report_id not in (
  select id from public.reports where id::text like '20000000-0000-4000-8000-00000000000_'
);
delete from public.reports where id::text not like '20000000-0000-4000-8000-00000000000_';
select is((select count(*)::integer from pg_tables where schemaname='public' and not rowsecurity),0,'Security: every public table enables RLS');
select is((select public from storage.buckets where id='evidence'),false,'Security: evidence bucket is private');
select ok(not has_table_privilege('authenticated','public.audit_log','insert,update,delete'),'Security: audit cannot be forged or changed');
select ok(not has_table_privilege('authenticated','public.moderation_actions','insert,update,delete'),'Security: moderation history is trigger-only');

set local role anon;
select throws_ok($$select * from public.reports$$,'42501',null,'Permission: anonymous cannot read reports');
select throws_ok($$select * from public.public_feed()$$,'42501',null,'Permission: feed requires authentication');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from public.reports),2,'Permission: citizen sees exactly their own reports');
select is((select count(*)::integer from public.organizations),2,'Regression: citizen can choose either organization');
select is((select count(*)::integer from public.profiles),1,'Security: profiles are private to their owner');
select is((select count(*)::integer from public.public_feed()),2,'Regression: signed-in citizen reads verified projection');
select is((select count(*)::integer from public.public_feed('phishing')),1,'Regression: public feed search is filtered');
select throws_ok($$insert into public.reports(reporter_id,organization_id,scam_type,channel,amount,description) values ('10000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','other','other',0,'Fictional forged reporter')$$,'42501',null,'Security: citizen cannot forge report ownership');
select results_eq($$update public.reports set status='withdrawn' where id='20000000-0000-4000-8000-000000000002' returning id$$,array[]::uuid[],'Cross-Tenant Denial: citizen cannot withdraw another citizen report');
select throws_ok($$update public.reports set status='verified' where id='20000000-0000-4000-8000-000000000001'$$,'42501',null,'Permission: citizen cannot self-verify');
select throws_ok($$update public.reports set organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where id='20000000-0000-4000-8000-000000000001'$$,'42501',null,'Security: report organization is immutable');
select throws_ok($$insert into public.memberships values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000001','org_admin')$$,'42501',null,'Permission: citizen cannot grant themself a role');
select results_eq($$update public.reports set status='withdrawn' where id='20000000-0000-4000-8000-000000000004' returning status::text$$,array['withdrawn'],'Regression: owner can withdraw their verified report');
select is((select count(*)::integer from public.public_feed()),1,'Regression: withdrawn report disappears from public feed');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('evidence','20000000-0000-4000-8000-000000000003/forged.pdf')$$,'42501',null,'Cross-Tenant Denial: evidence cannot be uploaded against another reporter');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('evidence','20000000-0000-4000-8000-000000000004/withdrawn.pdf')$$,'42501',null,'Permission: withdrawn report cannot accept evidence');
insert into storage.objects(bucket_id,name) values ('evidence','20000000-0000-4000-8000-000000000001/fictional.pdf');
select is((select count(*)::integer from storage.objects where bucket_id='evidence'),1,'Regression: citizen reads their own evidence');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select is((select count(*)::integer from public.reports where organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),0,'Cross-Tenant Denial: moderator cannot read organization B');
select results_eq($$update public.reports set status='verified' where id='20000000-0000-4000-8000-000000000003' returning id$$,array[]::uuid[],'Cross-Tenant Denial: moderator cannot write organization B');
select is((select count(*)::integer from public.report_contacts),0,'Security: staff cannot select contacts directly, consented or not');
select results_eq($$select email from public.read_report_contact('20000000-0000-4000-8000-000000000001')$$,array['citizen@demo.example.test'],'Permission: assigned moderator reads consented contact through the audited function');
select is((select count(*)::integer from public.read_report_contact('20000000-0000-4000-8000-000000000002')),0,'Permission: no consent means no contact');
select is((select count(*)::integer from public.read_report_contact('20000000-0000-4000-8000-000000000003')),0,'Cross-Tenant Denial: moderator cannot read organization B contact through the function');
select ok((select bool_and(email is null) from public.organization_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),'Permission: moderator roster hides sign-in emails');
select throws_ok($$select * from public.organization_roster('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,'42501',null,'Cross-Tenant Denial: moderator cannot read organization B roster');
select throws_ok($$select * from public.executive_breakdown('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'42501',null,'Permission: moderator cannot read executive breakdown');
select is((select count(*)::integer from public.profiles where user_id='10000000-0000-4000-8000-000000000001'),0,'Security: organization cannot bypass consent via citizen profile');
select set_config('request.headers','{"x-request-id":"database-acceptance"}',true);
select results_eq($$update public.reports set status='verified' where id='20000000-0000-4000-8000-000000000001' returning status::text$$,array['verified'],'Permission: moderator verifies own organization report');
select results_eq($$select request_id from public.moderation_actions where report_id='20000000-0000-4000-8000-000000000001'$$,array['database-acceptance'],'Regression: moderation records correlation ID atomically');
select throws_ok($$update public.reports set status='rejected' where id='20000000-0000-4000-8000-000000000001'$$,'22023',null,'Regression: terminal moderation cannot be silently overwritten');
select throws_ok($$insert into public.memberships values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000004','org_admin')$$,'42501',null,'Permission: moderator cannot escalate');
select is((select count(*)::integer from storage.objects where bucket_id='evidence'),1,'Permission: assigned moderator can read evidence');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
select is((select count(*)::integer from storage.objects where bucket_id='evidence'),0,'Cross-Tenant Denial: organization B cannot read organization A evidence');
select is((select count(*)::integer from public.report_contacts where report_id='20000000-0000-4000-8000-000000000001'),0,'Cross-Tenant Denial: consent is scoped to assigned organization only');
select is((select count(*)::integer from public.read_report_contact('20000000-0000-4000-8000-000000000001')),0,'Cross-Tenant Denial: organization B cannot read organization A contact through the function');
select is((select count(*)::integer from public.moderation_actions),0,'Cross-Tenant Denial: moderation history is tenant-scoped');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
select results_eq($$update public.memberships set role='executive' where user_id='10000000-0000-4000-8000-000000000005' returning user_id$$,array[]::uuid[],'Permission: org admin cannot change own role');
select throws_ok($$insert into public.memberships values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000001','org_admin')$$,'42501',null,'Cross-Tenant Denial: admin cannot grant a role in another organization');
select results_eq($$update public.memberships set role='org_admin' where organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning user_id$$,array[]::uuid[],'Cross-Tenant Denial: admin cannot edit organization B memberships');
insert into public.memberships values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000002','moderator');
select results_eq($$select role::text from public.memberships where user_id='10000000-0000-4000-8000-000000000002'$$,array['moderator'],'Permission: admin manages another user in own organization');
select throws_ok($$update public.memberships set organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where user_id='10000000-0000-4000-8000-000000000002'$$,'42501',null,'Security: membership identity cannot be moved to another tenant');
select is((select count(*)::integer from public.audit_log where request_id='database-acceptance'),2,'Regression: admin reads only tenant audit with correlation IDs');
select results_eq($$delete from public.memberships where user_id='10000000-0000-4000-8000-000000000005' returning user_id$$,array[]::uuid[],'Permission: admin cannot remove own membership');
select is((select count(*)::integer from public.audit_log where action='report_contacts.view'),1,'Audit: only the one permitted contact view was logged');
select is((select count(*)::integer from public.audit_log where action='report_contacts.view' and resource_id='20000000-0000-4000-8000-000000000001' and actor_id='10000000-0000-4000-8000-000000000004'),1,'Audit: the contact view names the moderator and the report');
select is((select count(*)::integer from public.report_contacts),0,'Security: org admin cannot select contacts directly');
select results_eq($$select email from public.read_report_contact('20000000-0000-4000-8000-000000000001')$$,array['citizen@demo.example.test'],'Permission: org admin reads consented contact through the audited function');
select is((select count(*)::integer from public.audit_log where action='report_contacts.view' and actor_id='10000000-0000-4000-8000-000000000005'),1,'Audit: the admin contact view is logged as well');
select ok((select bool_and(email is not null) from public.organization_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),'Permission: org admin roster includes sign-in emails');
select throws_ok($$select * from public.executive_breakdown('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'42501',null,'Permission: org admin cannot read executive breakdown');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
select is((select count(*)::integer from public.reports),0,'Security: executive cannot read raw report rows');
select is((select count(*)::integer from public.report_contacts),0,'Security: executive cannot read contact details');
select is((select count(*)::integer from storage.objects where bucket_id='evidence'),0,'Security: executive cannot read evidence');
select is((select count(*)::integer from public.moderation_actions),0,'Security: executive cannot read moderation history');
select is((select count(*)::integer from public.audit_log),0,'Security: executive cannot read audit identities');
select is((select sum(report_count)::integer from public.executive_statistics('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')),3,'Permission: executive sees aggregate count for own tenant');
select throws_ok($$select * from public.executive_statistics('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,'42501',null,'Cross-Tenant Denial: executive cannot aggregate another organization');
select is((select sum(report_count)::integer from public.executive_breakdown('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') where dimension='channel'),3,'Permission: executive reads the breakdown of their own organization');
select throws_ok($$select * from public.executive_breakdown('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$$,'42501',null,'Cross-Tenant Denial: executive cannot break down another organization');
select throws_ok($$select * from public.organization_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'42501',null,'Permission: executive cannot read the staff roster');
select is((select count(*)::integer from public.read_report_contact('20000000-0000-4000-8000-000000000001')),0,'Security: executive cannot read contacts through the function');
select throws_ok($$insert into public.reports(organization_id,scam_type,channel,amount,description) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','other','other',0,'Fictional executive bypass')$$,'42501',null,'Security: executive cannot acquire report-row access through citizen insertion');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select lives_ok($$select public.record_denial('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cross_tenant_probe')$$,'Audit: a denial can be recorded');
select throws_ok($$select public.record_denial('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','DROP;')$$,'22023',null,'Validation: a malformed denial action is rejected');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select * from public.organization_roster('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')$$,'42501',null,'Permission: citizen cannot read a staff roster');
select lives_ok($$select public.record_denial('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','citizen_probe')$$,'Audit: a citizen denial call is accepted but ignored');
reset role;
select is((select count(*)::integer from public.audit_log where action='denied.cross_tenant_probe' and organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and resource_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and actor_id='10000000-0000-4000-8000-000000000004'),1,'Audit: a cross-tenant denial lands in the caller organization log');
select is((select count(*)::integer from public.audit_log where organization_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and action like 'denied.%'),0,'Cross-Tenant Denial: the target organization log receives nothing');
select is((select count(*)::integer from public.audit_log where action='denied.citizen_probe'),0,'Security: a citizen can never write into a tenant log');
set local role anon;
select throws_ok($$select public.record_denial('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','anon_probe')$$,'42501',null,'Permission: anonymous cannot record denials');
select throws_ok($$select * from public.read_report_contact('20000000-0000-4000-8000-000000000001')$$,'42501',null,'Permission: anonymous cannot call the contact function');
reset role;
create function public.test_audit_down() returns trigger language plpgsql as $f$ begin
  if new.action = 'report_contacts.view' then raise exception using errcode = 'XX000', message = 'audit unavailable'; end if; return new; end $f$;
create trigger test_audit_down before insert on public.audit_log for each row execute function public.test_audit_down();
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select throws_ok($$select * from public.read_report_contact('20000000-0000-4000-8000-000000000001')$$,'XX000',null,'Fail closed: no contact is returned when the audit write fails');
select * from finish();
rollback;
