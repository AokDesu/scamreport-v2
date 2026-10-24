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
-- Fictional display names and reserved 555-pattern phone numbers; none belong to a real person.
update public.profiles set display_name = names.display_name, contact_phone = names.phone
from auth.users u join (values
 ('citizen','สมศรี ใจดี (สาธิต)','02-555-0101'),('citizen-two','วิชัย มั่นคง (สาธิต)','02-555-0102'),
 ('citizen-three','มาลี รักษ์ไทย (สาธิต)','02-555-0103'),('moderator-a','ณัฐวุฒิ ศรีสุข (สาธิต)','02-555-0104'),
 ('admin-a','พิมพ์ชนก วงศ์ทอง (สาธิต)','02-555-0105'),('executive-a','ประเสริฐ อินทร์แก้ว (สาธิต)','02-555-0106'),
 ('moderator-b','อรุณา แสงจันทร์ (สาธิต)','02-555-0107'),('admin-b','ธีรพงษ์ บุญมา (สาธิต)','02-555-0108'),
 ('executive-b','กมลวรรณ ทองดี (สาธิต)','02-555-0109')) as names(label,display_name,phone)
 on u.email = names.label || '@demo.example.test'
where profiles.user_id = u.id;

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
-- Older fictional history for the console and dashboard. These IDs fall outside the six fixtures,
-- so the database suite removes them inside its rolled-back transaction.
insert into public.reports(id,reporter_id,organization_id,scam_type,channel,amount,description,consent_contact,created_at)
select ('21000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
 -- The main demo citizen also owns a rejected (8) and a withdrawn (14) report, so My reports shows every status.
 ('10000000-0000-4000-8000-00000000000' || (case when n in (8,14) then 1 else 1 + n % 3 end))::uuid,
 org::uuid,scam_type,channel,amount,description,consent,now() - make_interval(days => days, hours => n)
from (values
 (1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shopping','sms',2500,'รายงานสาธิต: SMS แจ้งพัสดุตกค้าง ให้กดลิงก์จ่ายค่าส่ง แล้วถูกตัดเงินจากบัตร',true,1),
 (2,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','investment','social',45000,'รายงานสาธิต: กลุ่มแชตชวนลงทุนทองคำ ปันผลสูงเกินจริง ถอนเงินไม่ได้',true,3),
 (3,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','impersonation','phone',58000,'รายงานสาธิต: โทรอ้างเป็นเจ้าหน้าที่รัฐ ให้โอนเงินไปตรวจสอบ',false,5),
 (4,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shopping','social',890,'Fictional demo: paid a social page for a bag that never arrived.',true,8),
 (5,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','phishing','email',0,'Fictional demo: email asked to confirm a bank password on a lookalike site.',false,11),
 (6,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','other','website',3000,'รายงานสาธิต: แอปเงินกู้ให้จ่ายค่าธรรมเนียมก่อนปล่อยกู้',true,15),
 (7,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','investment','website',120000,'รายงานสาธิต: เว็บเทรดคริปโตปลอม ยอดในระบบขึ้นแต่ถอนไม่ได้',true,19),
 (8,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','phishing','sms',1200,'Fictional demo: SMS about expiring card points linked to a fake form.',false,24),
 (9,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','impersonation','phone',15000,'รายงานสาธิต: โทรอ้างเป็นตำรวจ บอกว่าพัวพันคดีฟอกเงิน',true,30),
 (10,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','shopping','sms',650,'Fictional demo: fake parcel fee message for a delivery never ordered.',false,36),
 (11,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','investment','social',30000,'รายงานสาธิต: ชวนลงทุนหุ้นผ่านกลุ่มไลน์ อ้างชื่อโบรกเกอร์',true,42),
 (12,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','phishing','email',0,'Fictional demo: tax refund email linking to a credential form.',true,48),
 (13,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','impersonation','phone',20000,'รายงานสาธิต: โทรอ้างเป็นการไฟฟ้า ขอค่ามิเตอร์ค้างจ่าย',true,2),
 (14,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','shopping','social',4500,'Fictional demo: concert tickets sold on a page that disappeared.',false,9),
 (15,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','investment','website',80000,'รายงานสาธิต: แพลตฟอร์มลงทุนปลอม ให้เติมเงินเพื่อปลดล็อกยอด',true,20),
 (16,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','phishing','sms',0,'Fictional demo: SMS claiming a locked account with a lookalike link.',false,33)
) as demo(n,org,scam_type,channel,amount,description,consent,days);

-- Decisions are made as the fictional moderators so history and audit rows carry real actors.
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated"}',false);
update public.reports set status = 'verified' where id in ('21000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000003',
 '21000000-0000-4000-8000-000000000005','21000000-0000-4000-8000-000000000007','21000000-0000-4000-8000-000000000009',
 '21000000-0000-4000-8000-000000000011','21000000-0000-4000-8000-000000000012');
update public.reports set status = 'rejected' where id in ('21000000-0000-4000-8000-000000000008','21000000-0000-4000-8000-000000000010');
update public.reports set status = 'flagged' where id = '21000000-0000-4000-8000-000000000006';
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000007","role":"authenticated"}',false);
update public.reports set status = 'verified' where id in ('21000000-0000-4000-8000-000000000015','21000000-0000-4000-8000-000000000016');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
update public.reports set status = 'withdrawn' where id = '21000000-0000-4000-8000-000000000014';
select set_config('request.jwt.claims','',false);
insert into public.report_contacts(report_id,email,phone)
select r.id,p.contact_email,p.contact_phone from public.reports r join public.profiles p on p.user_id = r.reporter_id;
