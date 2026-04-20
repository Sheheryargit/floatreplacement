-- Seed 50 random people + 50 random projects for testing.
-- Safe to re-run: uses ON CONFLICT DO NOTHING keyed on (name) pairs that are
-- realistically unique for this dataset. IDs/UUIDs are generated server-side.

BEGIN;

-- ---------- 50 People ----------
INSERT INTO public.people
  (name, email, role, department, access, tags, type, cost_rate, bill_rate,
   start_date, end_date, work_type, notes, public_holiday_region, holidays, archived)
VALUES
  ('Alice Nguyen','alice.nguyen@example.com','Senior Consultant','Azure','Manager',ARRAY['Azure','Cloud Secure'],'Employee','120','220','2024-02-05','','Full-time','','None','None',false),
  ('Ben Carter','ben.carter@example.com','Consultant','.NET','Member',ARRAY['.NET'],'Employee','95','180','2024-06-17','','Full-time','','None','None',false),
  ('Chloe Martinez','chloe.martinez@example.com','Managing Consultant','Data & AI','Manager',ARRAY['Data&AI','Azure'],'Employee','150','260','2023-01-09','','Full-time','','None','None',false),
  ('Daniel Reyes','daniel.reyes@example.com','Technical Lead','AWS Platform','Manager',ARRAY['AWS Platform','Cloud Secure'],'Employee','140','250','2022-11-14','','Full-time','','None','None',false),
  ('Emma Fitzgerald','emma.fitzgerald@example.com','Graduate','UI/UX','Member',ARRAY['UI and UX Design'],'Employee','70','140','2025-02-03','','Full-time','','None','None',false),
  ('Farhan Ahmed','farhan.ahmed@example.com','Solution Architect','Cloud Secure','Admin',ARRAY['Cloud Secure','Secure'],'Employee','170','290','2021-08-22','','Full-time','','None','None',false),
  ('Grace O''Connor','grace.oconnor@example.com','Senior Consultant','Service Management','Member',ARRAY['service management','SDM'],'Employee','125','225','2023-07-10','','Full-time','','None','None',false),
  ('Hiroshi Tanaka','hiroshi.tanaka@example.com','Consultant','Azure','Member',ARRAY['Azure'],'Employee','95','175','2024-04-15','','Full-time','','None','None',false),
  ('Isabella Romano','isabella.romano@example.com','Principal Consultant','Data & AI','Manager',ARRAY['Data&AI'],'Employee','180','300','2020-05-18','','Full-time','','None','None',false),
  ('Jared Thompson','jared.thompson@example.com','Engagement Manager','Fire Nation','Manager',ARRAY['Firenation'],'Employee','160','280','2022-03-01','','Full-time','','None','None',false),
  ('Kiara Patel','kiara.patel@example.com','Consultant','UI/UX','Member',ARRAY['UI and UX Design'],'Employee','100','185','2024-01-22','','Full-time','','None','None',false),
  ('Liam Walsh','liam.walsh@example.com','Senior Consultant','AWS Platform','Member',ARRAY['AWS Platform'],'Employee','125','225','2023-09-04','','Full-time','','None','None',false),
  ('Maya Chen','maya.chen@example.com','Graduate','Data & AI','Member',ARRAY['Data&AI'],'Employee','70','140','2025-02-03','','Full-time','','None','None',false),
  ('Noah Brennan','noah.brennan@example.com','Consultant','.NET','Member',ARRAY['.NET','Azure'],'Employee','95','180','2024-08-12','','Full-time','','None','None',false),
  ('Olivia Park','olivia.park@example.com','Project Coordinator','Service Management','Member',ARRAY['service management'],'Employee','85','160','2023-11-20','','Full-time','','None','None',false),
  ('Priya Desai','priya.desai@example.com','Senior Consultant','Data & AI','Member',ARRAY['Data&AI','Azure'],'Employee','130','230','2022-12-05','','Full-time','','None','None',false),
  ('Quentin Brooks','quentin.brooks@example.com','Contractor','Azure','Member',ARRAY['Azure'],'Contractor','1200','1800','2025-01-10','2025-12-31','Contract','3-month engagement','None','None',false),
  ('Rachel Kim','rachel.kim@example.com','Managing Consultant','UI/UX','Manager',ARRAY['UI and UX Design'],'Employee','150','265','2021-10-11','','Full-time','','None','None',false),
  ('Samir Khalid','samir.khalid@example.com','Delivery Manager','Cloud Secure','Manager',ARRAY['Cloud Secure','Secure'],'Employee','165','285','2020-07-22','','Full-time','','None','None',false),
  ('Tessa Andersen','tessa.andersen@example.com','Consultant','Azkaban','Member',ARRAY['Azkaban'],'Employee','100','190','2024-03-28','','Full-time','','None','None',false),
  ('Umar Siddiqui','umar.siddiqui@example.com','Technical Lead','.NET','Manager',ARRAY['.NET','Azure'],'Employee','140','250','2022-04-04','','Full-time','','None','None',false),
  ('Valentina Cruz','valentina.cruz@example.com','Senior Consultant','UI/UX','Member',ARRAY['UI and UX Design'],'Employee','125','220','2023-05-15','','Full-time','','None','None',false),
  ('William Ng','william.ng@example.com','Consultant','AWS Platform','Member',ARRAY['AWS Platform'],'Employee','95','180','2024-07-08','','Full-time','','None','None',false),
  ('Xin Li','xin.li@example.com','Principal Consultant','Azure','Admin',ARRAY['Azure','Cloud Secure'],'Employee','180','305','2019-11-12','','Full-time','','None','None',false),
  ('Yasmin Haddad','yasmin.haddad@example.com','Graduate','Service Management','Member',ARRAY['service management'],'Employee','70','140','2025-02-03','','Full-time','','None','None',false),
  ('Zachary Holt','zachary.holt@example.com','Engagement Manager','Data & AI','Manager',ARRAY['Data&AI','SDM'],'Employee','160','275','2022-02-14','','Full-time','','None','None',false),
  ('Aisha Rahman','aisha.rahman@example.com','Senior Consultant','Cloud Secure','Member',ARRAY['Cloud Secure'],'Employee','125','225','2023-08-01','','Full-time','','None','None',false),
  ('Bastien Laurent','bastien.laurent@example.com','Consultant','Fire Nation','Member',ARRAY['Firenation'],'Employee','100','185','2024-05-06','','Full-time','','None','None',false),
  ('Camila Rossi','camila.rossi@example.com','Solution Architect','AWS Platform','Admin',ARRAY['AWS Platform','Cloud Secure'],'Employee','170','295','2021-01-18','','Full-time','','None','None',false),
  ('Dimitri Volkov','dimitri.volkov@example.com','Contractor','.NET','Member',ARRAY['.NET'],'Contractor','1100','1700','2025-03-01','2025-09-30','Contract','','None','None',false),
  ('Elena Popescu','elena.popescu@example.com','Senior Consultant','Data & AI','Member',ARRAY['Data&AI'],'Employee','130','230','2022-09-19','','Full-time','','None','None',false),
  ('Finnegan O''Neill','finnegan.oneill@example.com','Consultant','Azure','Member',ARRAY['Azure'],'Employee','95','180','2024-10-14','','Full-time','','None','None',false),
  ('Gustavo Silva','gustavo.silva@example.com','Technical Lead','Cloud Secure','Manager',ARRAY['Cloud Secure','Secure'],'Employee','140','255','2021-06-07','','Full-time','','None','None',false),
  ('Hana Saito','hana.saito@example.com','Graduate','UI/UX','Member',ARRAY['UI and UX Design'],'Employee','70','140','2025-02-03','','Part-time','0.6 FTE','None','None',false),
  ('Ivan Petrov','ivan.petrov@example.com','Consultant','AWS Platform','Member',ARRAY['AWS Platform'],'Employee','95','180','2024-02-26','','Full-time','','None','None',false),
  ('Jasmine Dubois','jasmine.dubois@example.com','Managing Consultant','Service Management','Manager',ARRAY['service management','SDM'],'Employee','150','270','2021-12-03','','Full-time','','None','None',false),
  ('Kenji Yamamoto','kenji.yamamoto@example.com','Senior Consultant','.NET','Member',ARRAY['.NET'],'Employee','125','220','2023-03-28','','Full-time','','None','None',false),
  ('Lara Novak','lara.novak@example.com','Consultant','Data & AI','Member',ARRAY['Data&AI'],'Employee','100','185','2024-06-03','','Full-time','','None','None',false),
  ('Mateo Alvarez','mateo.alvarez@example.com','Engagement Manager','Azure','Manager',ARRAY['Azure'],'Employee','160','280','2022-05-10','','Full-time','','None','None',false),
  ('Nadia Hassan','nadia.hassan@example.com','Solution Architect','Data & AI','Admin',ARRAY['Data&AI','Azure'],'Employee','175','295','2020-09-14','','Full-time','','None','None',false),
  ('Oskar Lindqvist','oskar.lindqvist@example.com','Consultant','Cloud Secure','Member',ARRAY['Cloud Secure'],'Employee','100','190','2024-09-09','','Full-time','','None','None',false),
  ('Penelope Hughes','penelope.hughes@example.com','Senior Consultant','UI/UX','Member',ARRAY['UI and UX Design'],'Employee','125','225','2023-04-17','','Full-time','','None','None',false),
  ('Qadir Malik','qadir.malik@example.com','Delivery Manager','Fire Nation','Manager',ARRAY['Firenation','SDM'],'Employee','165','285','2021-02-22','','Full-time','','None','None',false),
  ('Ravi Kapoor','ravi.kapoor@example.com','Principal Consultant','.NET','Admin',ARRAY['.NET','Azure'],'Employee','180','305','2019-07-15','','Full-time','','None','None',false),
  ('Sofia Greco','sofia.greco@example.com','Graduate','Azure','Member',ARRAY['Azure'],'Employee','70','140','2025-02-03','','Full-time','','None','None',false),
  ('Thiago Mendes','thiago.mendes@example.com','Consultant','AWS Platform','Member',ARRAY['AWS Platform'],'Employee','95','180','2024-11-05','','Full-time','','None','None',false),
  ('Uma Shankar','uma.shankar@example.com','Senior Consultant','Data & AI','Member',ARRAY['Data&AI'],'Employee','130','230','2023-06-19','','Full-time','','None','None',false),
  ('Violet McPherson','violet.mcpherson@example.com','Project Coordinator','Service Management','Member',ARRAY['service management'],'Employee','85','160','2024-04-08','','Part-time','0.8 FTE','None','None',false),
  ('Wesley Barnes','wesley.barnes@example.com','Contractor','Azure','Member',ARRAY['Azure'],'Contractor','1150','1750','2025-02-10','2025-08-31','Contract','','None','None',false),
  ('Ximena Castillo','ximena.castillo@example.com','Consultant','UI/UX','Member',ARRAY['UI and UX Design'],'Employee','100','185','2024-08-26','','Full-time','','None','None',false)
ON CONFLICT DO NOTHING;

-- ---------- 50 Projects ----------
INSERT INTO public.projects
  (name, code, client, tags, stage, billable, color, owner, start_date, end_date, notes, manager_edit, archived)
VALUES
  ('ASF Managed Services','ASF','ASF',ARRAY['Azure','Cloud Secure'],'active',true,'#4dabf7','Aisha Rahman','2024-01-01','','Ongoing managed services',false,false),
  ('ARTC Cloud Managed Services','ARTC','ARTC',ARRAY['AWS','Cloud Secure'],'active',true,'#63e6be','Camila Rossi','2023-07-01','','24/7 ops',false,false),
  ('Bluecore Analytics Platform','BCAP','Bluecore',ARRAY['Data&AI','Azure'],'active',true,'#9775fa','Isabella Romano','2024-03-18','','Databricks lakehouse',false,false),
  ('Acme CMS Rebuild','ACME-CMS','Acme Corp',ARRAY['CMS','.NET'],'active',true,'#ffa94d','Umar Siddiqui','2024-05-06','2026-05-05','Sitecore to headless migration',false,false),
  ('Zenith Data Lake','ZENDL','Zenith Group',ARRAY['Data&AI'],'active',true,'#74c0fc','Nadia Hassan','2023-10-02','','',false,false),
  ('Northwind ERP Integration','NW-ERP','Northwind Traders',ARRAY['.NET','Azure'],'active',true,'#ff6b6b','Ravi Kapoor','2024-02-12','2026-06-30','',false,false),
  ('Globex Secure Landing Zone','GX-SLZ','Globex',ARRAY['Cloud Secure','Azure'],'active',true,'#ffd43b','Farhan Ahmed','2024-06-24','2025-12-31','',false,false),
  ('Initech Portal Modernisation','INIT-PM','Initech',ARRAY['UI/UX','.NET'],'active',true,'#51cf66','Rachel Kim','2024-09-16','','',false,false),
  ('Vandelay AI Assistant','VND-AI','Vandelay Industries',ARRAY['Data&AI'],'active',true,'#cc5de8','Isabella Romano','2025-01-13','','GPT chatbot pilot',false,false),
  ('Stark Industries Azure Foundation','STK-AZR','Stark Industries',ARRAY['Azure','Cloud Secure'],'active',true,'#339af0','Xin Li','2024-04-08','','Enterprise scale LZ',false,false),
  ('Wayne Enterprises Data Fabric','WAY-DF','Wayne Enterprises',ARRAY['Data&AI','Azure'],'active',true,'#845ef7','Nadia Hassan','2024-08-19','','',false,false),
  ('Wonka Factory Automation','WONKA-OT','Wonka',ARRAY['AWS'],'planning',true,'#ff922b','Camila Rossi','2025-03-03','','IoT / OT integration',false,false),
  ('Oceanic Airlines Ops Portal','OCA-OPS','Oceanic Airlines',ARRAY['.NET','UI/UX'],'active',true,'#20c997','Umar Siddiqui','2024-11-04','','',false,false),
  ('Tyrell Biotech Secure Enclave','TYR-SEC','Tyrell Corp',ARRAY['Cloud Secure','Secure'],'active',true,'#e64980','Samir Khalid','2024-02-26','','ISO27001 aligned',false,false),
  ('Cyberdyne Model Registry','CYB-MLR','Cyberdyne Systems',ARRAY['Data&AI'],'active',true,'#7048e8','Chloe Martinez','2024-10-14','','MLOps platform',false,false),
  ('Umbrella Health Patient Hub','UMB-HH','Umbrella Health',ARRAY['UI/UX','.NET'],'active',true,'#15aabf','Rachel Kim','2024-07-22','2026-02-28','',false,false),
  ('Aperture Science Knowledge Base','APS-KB','Aperture Science',ARRAY['CMS','UI/UX'],'active',true,'#f783ac','Valentina Cruz','2024-12-09','','',false,false),
  ('Massive Dynamic Cloud Ops','MDY-OPS','Massive Dynamic',ARRAY['AWS','Cloud Secure'],'active',true,'#82c91e','Samir Khalid','2023-05-15','','',false,false),
  ('Pied Piper Compression SDK','PPP-SDK','Pied Piper',ARRAY['.NET'],'planning',true,'#fa5252','Umar Siddiqui','2025-04-07','','Greenfield',false,false),
  ('Hooli Search Reindex','HOOLI-IDX','Hooli',ARRAY['Data&AI','Azure'],'active',true,'#22b8cf','Priya Desai','2024-09-02','2026-03-31','',false,false),
  ('Dunder Mifflin Portal Refresh','DM-PRT','Dunder Mifflin',ARRAY['UI/UX'],'active',true,'#fcc419','Kiara Patel','2024-05-27','2025-11-28','',false,false),
  ('Sterling Cooper CRM Migration','SC-CRM','Sterling Cooper',ARRAY['.NET','Azure'],'active',true,'#ced4da','Umar Siddiqui','2024-03-04','2026-01-30','',false,false),
  ('Monarch Solutions DevSecOps','MON-DSO','Monarch Solutions',ARRAY['Cloud Secure'],'active',true,'#5c7cfa','Farhan Ahmed','2025-02-17','','',false,false),
  ('Rekall Memory Archive','REK-ARC','Rekall',ARRAY['Data&AI'],'planning',true,'#be4bdb','Chloe Martinez','2025-05-12','','Discovery',false,false),
  ('Weyland-Yutani Edge Network','WY-EDG','Weyland-Yutani',ARRAY['AWS','Cloud Secure'],'active',true,'#ff8787','Liam Walsh','2024-06-10','','',false,false),
  ('Soylent Supply Chain Insights','SOY-SCI','Soylent Corp',ARRAY['Data&AI'],'active',true,'#69db7c','Nadia Hassan','2024-08-05','','',false,false),
  ('Gringotts PCI Remediation','GRG-PCI','Gringotts',ARRAY['Cloud Secure','Secure'],'active',true,'#f59f00','Samir Khalid','2024-11-18','2025-11-17','',false,false),
  ('Hogwarts Learning Platform','HOG-LMS','Hogwarts',ARRAY['.NET','UI/UX'],'active',true,'#b197fc','Rachel Kim','2024-02-05','','',false,false),
  ('MomCorp Order Management','MOM-OM','MomCorp',ARRAY['.NET'],'active',true,'#38d9a9','Ravi Kapoor','2024-04-22','','',false,false),
  ('Planet Express Fleet Analytics','PEX-FA','Planet Express',ARRAY['Data&AI','AWS'],'active',true,'#4dabf7','Isabella Romano','2024-10-28','','',false,false),
  ('Bluth Co Finance Dashboard','BLU-FD','Bluth Company',ARRAY['Data&AI'],'active',true,'#fab005','Priya Desai','2024-12-16','','',false,false),
  ('Los Pollos Hermanos POS Refresh','LPH-POS','Los Pollos Hermanos',ARRAY['UI/UX','.NET'],'planning',true,'#ffa8a8','Valentina Cruz','2025-06-02','','',false,false),
  ('Buy n Large Retail Intelligence','BNL-RI','Buy n Large',ARRAY['Data&AI','Azure'],'active',true,'#91a7ff','Nadia Hassan','2024-07-01','','',false,false),
  ('Spacely Sprockets Asset Mgmt','SPS-AM','Spacely Sprockets',ARRAY['.NET'],'active',true,'#74b816','Umar Siddiqui','2024-05-20','2026-05-19','',false,false),
  ('Tricell Secure Identity','TRC-IDM','Tricell Pharma',ARRAY['Cloud Secure','Secure'],'active',true,'#e599f7','Farhan Ahmed','2024-09-09','','',false,false),
  ('Oscorp Bio Data Platform','OSC-BDP','Oscorp Industries',ARRAY['Data&AI','Azure'],'active',true,'#66d9e8','Chloe Martinez','2024-03-11','','',false,false),
  ('Krusty Krab Mobile App','KK-MOB','Krusty Krab',ARRAY['UI/UX'],'active',true,'#ffd43b','Kiara Patel','2025-01-20','2025-12-20','',false,false),
  ('Internal Innovation Lab','INT-LAB','Internal',ARRAY['Data&AI','UI/UX'],'active',false,'#868e96','Jared Thompson','2024-01-15','','Non-billable R&D',false,false),
  ('Internal Admin and Operations','INT-ADM','Internal',ARRAY[]::text[],'active',false,'#adb5bd','Jared Thompson','2024-01-01','','Timesheets, ops',false,false),
  ('Pre-Sales Activities','INT-PS','Internal',ARRAY[]::text[],'active',false,'#495057','Mateo Alvarez','2024-01-01','','Proposal writing',false,false),
  ('Training and Certifications','INT-TRN','Internal',ARRAY[]::text[],'active',false,'#0ca678','Qadir Malik','2024-01-01','','Azure / AWS / .NET certs',false,false),
  ('Sitwell Media Portal','SW-PRT','Sitwell Media',ARRAY['.NET','UI/UX'],'active',true,'#fd7e14','Rachel Kim','2024-06-17','','',false,false),
  ('Nakatomi Building Automation','NAK-BA','Nakatomi Trading',ARRAY['AWS'],'active',true,'#ff6b6b','Liam Walsh','2024-08-12','2026-08-11','',false,false),
  ('Cogswell Cogs Integration Hub','CGS-IH','Cogswell Cogs',ARRAY['.NET','Azure'],'active',true,'#4c6ef5','Ravi Kapoor','2024-10-07','','',false,false),
  ('Hudsucker Industries AI Copilot','HUD-AI','Hudsucker Industries',ARRAY['Data&AI'],'planning',true,'#d6336c','Isabella Romano','2025-07-14','','',false,false),
  ('Strickland Propane SCADA','STR-SCADA','Strickland Propane',ARRAY['AWS','Cloud Secure'],'active',true,'#364fc7','Camila Rossi','2024-02-26','','',false,false),
  ('Rich Industries HR Insights','RICH-HR','Rich Industries',ARRAY['Data&AI'],'active',true,'#5f3dc4','Priya Desai','2024-11-11','2025-12-31','',false,false),
  ('Pizza Planet Loyalty App','PP-LOY','Pizza Planet',ARRAY['UI/UX','.NET'],'active',true,'#37b24d','Kiara Patel','2024-09-30','','',false,false),
  ('Tessier-Ashpool Secure Backup','TES-BK','Tessier-Ashpool',ARRAY['Cloud Secure'],'active',true,'#2b8a3e','Samir Khalid','2024-12-02','','',false,false),
  ('Delos Destinations Booking','DEL-BOOK','Delos Destinations',ARRAY['.NET','Azure'],'active',true,'#a61e4d','Umar Siddiqui','2025-02-03','','',false,false)
ON CONFLICT DO NOTHING;

COMMIT;

-- Post-seed summary
SELECT
  (SELECT count(*) FROM public.people)   AS total_people,
  (SELECT count(*) FROM public.projects) AS total_projects;
