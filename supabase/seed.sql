-- Local demo only. Every name, address, phone and report is fictional.
insert into public.organizations(id,name) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Demo River Bank / ธนาคารสาธิต'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Demo City Safety Unit / หน่วยงานสาธิต');

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
select '00000000-0000-0000-0000-000000000000',
 ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 'authenticated','authenticated',label || '@demo.example.test',
 extensions.crypt('Demo-only-234!',extensions.gen_salt('bf')),now(),
 '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),'','','',''
from (values (1,'citizen'),(2,'citizen-two'),(3,'citizen-three'),(4,'moderator-a'),
 (5,'admin-a'),(6,'executive-a'),(7,'moderator-b'),(8,'admin-b'),(9,'executive-b')) as users(n,label);
insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
select gen_random_uuid(),id,id::text,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
from auth.users where email like '%@demo.example.test';
update public.profiles set display_name = 'Fictional ' || split_part(u.email,'@',1), contact_phone = 'DEMO-NOT-A-NUMBER'
from auth.users u where profiles.user_id = u.id;

insert into public.memberships(organization_id,user_id,role) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000004','moderator'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000005','org_admin'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','10000000-0000-4000-8000-000000000006','executive'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000007','moderator'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000008','org_admin'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','10000000-0000-4000-8000-000000000009','executive');

insert into public.reports(id,reporter_id,organization_id,scam_type,channel,amount,description,status,consent_contact) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','phishing','sms',1500,'รายงานสาธิต: ข้อความลิงก์ธนาคารปลอม ไม่มีข้อมูลจริง','pending',true),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shopping','website',420,'Fictional shopping site requested payment for an imaginary item.','pending',false),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','investment','social',9000,'รายงานสาธิต: โฆษณาการลงทุนที่ไม่มีอยู่จริง','pending',true),
 ('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','impersonation','phone',250,'Fictional caller pretended to represent a fictional organization.','verified',false),
 ('20000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','phishing','email',0,'Fictional email asked for a password; no real credentials included.','verified',false),
 ('20000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','other','other',0,'รายงานสาธิตที่ถูกทำเครื่องหมายเพื่อตรวจสอบ','flagged',false);
insert into public.report_contacts(report_id,email,phone)
select r.id,p.contact_email,p.contact_phone from public.reports r join public.profiles p on p.user_id = r.reporter_id;
