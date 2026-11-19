-- Standard roles and their permissions (module.action). Owner can adjust per company later.
insert into roles(key,name,description) values
 ('owner','Owner / Admin','Full access to everything in the company'),
 ('manager','Manager','Day-to-day management; cannot change system settings'),
 ('accountant','Accountant','Accounting, reports, posting'),
 ('sales','Sales','CRM and sales documents'),
 ('purchasing','Purchasing','Purchasing documents; can see costs'),
 ('warehouse','Warehouse','Stock handling'),
 ('logistics','Logistics / Driver','Vehicles, trips, fuel'),
 ('gym_staff','Gym Staff','Membership and POS only'),
 ('partner','Partner','Read-only reports');

create temp table _mods(m text);
insert into _mods values ('crm'),('sales'),('purchasing'),('inventory'),('logistics'),('projects'),('gym'),('accounting'),('reports'),('settings');
create temp table _acts(a text);
insert into _acts values ('view'),('create'),('edit'),('approve'),('post'),('delete'),('export');

-- owner: everything + field-level visibility of cost and margin
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts where r.key='owner';
insert into role_permissions select r.id, f from roles r, (values ('field.cost.view'),('field.margin.view')) v(f) where r.key in ('owner','manager','accountant');

-- manager: everything except settings changes and hard delete
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts
  where r.key='manager' and not (m='settings' and a<>'view') and a<>'delete';

-- accountant
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts
  where r.key='accountant' and ((m in ('accounting','reports')) or (m in ('sales','purchasing','inventory','gym','projects','logistics','crm') and a in ('view','export','post')) or (m='settings' and a='view'));

-- sales
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts
  where r.key='sales' and ((m in ('crm','sales') and a in ('view','create','edit','export')) or (m='inventory' and a='view') or (m='reports' and a='view'));

-- purchasing
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts
  where r.key='purchasing' and ((m='purchasing' and a in ('view','create','edit','export')) or (m='inventory' and a='view'));
insert into role_permissions select id,'field.cost.view' from roles where key='purchasing';

-- warehouse
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts
  where r.key='warehouse' and ((m='inventory' and a in ('view','create','edit')) or (m in ('purchasing','sales') and a='view'));

-- logistics
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts
  where r.key='logistics' and ((m='logistics' and a in ('view','create','edit')) or (m='projects' and a='view'));

-- gym staff
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts
  where r.key='gym_staff' and m='gym' and a in ('view','create','edit');

-- partner: read-only reports
insert into role_permissions select r.id, m||'.'||a from roles r, _mods, _acts
  where r.key='partner' and ((m='reports' and a in ('view','export')) or (m='gym' and a='view'));
