-- Phase 1 core schema: companies, users, roles, audit, settings, tax, currency,
-- numbering, chart of accounts, fiscal periods, journals (with DB-level guards).
-- All business tables are locked down with RLS (no public policies): only the app server
-- (database owner connection) can read/write. The Supabase public REST API sees nothing.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- companies
create table companies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  legal_name text,
  commercial_reg_no text,
  tax_reg_no text,
  address text,
  logo_path text,
  base_currency char(3) not null default 'QAR',
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  features text[] not null default '{}',  -- trading, contracting, transport, pipeline_services, gym
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Users: id equals the Supabase Auth user id (no FK so the schema also runs on a plain Postgres for tests)
create table profiles (
  id uuid primary key,
  email text not null unique,
  full_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text
);
create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission text not null,            -- e.g. 'sales.invoice.post'
  primary key (role_id, permission)
);
create table user_company_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role_id uuid not null references roles(id),
  primary key (user_id, company_id, role_id)
);
-- field-level hiding (e.g. cost, margin) is expressed as permissions 'field.cost.view', 'field.margin.view'

-- ---------------------------------------------------------------- audit log (append-only)
create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  company_id uuid,
  entity text not null,
  entity_id text,
  action text not null,                -- create, edit, delete, post, approve, login, permission
  old_value jsonb,
  new_value jsonb,
  ip text
);
create index audit_log_entity_idx on audit_log (entity, entity_id);
create index audit_log_company_at_idx on audit_log (company_id, at desc);

create function audit_log_block() returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'audit_log is append-only' using errcode = 'P0001';
end $$;
create trigger audit_log_no_update before update or delete on audit_log
  for each row execute function audit_log_block();
create trigger audit_log_no_truncate before truncate on audit_log
  for each statement execute function audit_log_block();

-- Generic row audit: records who (app.user_id), what, old and new values.
create function audit_row() returns trigger language plpgsql set search_path = public as $$
declare
  v_actor uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_old jsonb; v_new jsonb; v_company uuid; v_id text; v_action text;
begin
  if tg_op = 'INSERT' then v_new := to_jsonb(new); v_action := 'create';
  elsif tg_op = 'UPDATE' then v_old := to_jsonb(old); v_new := to_jsonb(new); v_action := 'edit';
  else v_old := to_jsonb(old); v_action := 'delete'; end if;
  v_id := coalesce(v_new->>'id', v_old->>'id');
  v_company := nullif(coalesce(v_new->>'company_id', v_old->>'company_id'), '')::uuid;
  if tg_table_name = 'companies' then v_company := v_id::uuid; end if;
  if tg_op = 'UPDATE' and tg_table_name in ('journal_entries')
     and (v_old->>'status') = 'draft' and (v_new->>'status') = 'posted' then
    v_action := 'post';
  end if;
  insert into audit_log(actor_id, company_id, entity, entity_id, action, old_value, new_value)
  values (v_actor, v_company, tg_table_name, v_id, v_action, v_old, v_new);
  return null;
end $$;

-- ---------------------------------------------------------------- settings, currency, tax
create table settings (
  company_id uuid not null references companies(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (company_id, key)
);

create table currencies (
  code char(3) primary key,
  name text not null,
  decimals smallint not null default 2
);
create table exchange_rates (
  id uuid primary key default gen_random_uuid(),
  rate_date date not null,
  from_currency char(3) not null references currencies(code),
  to_currency char(3) not null references currencies(code),
  rate numeric(18,8) not null check (rate > 0),
  unique (rate_date, from_currency, to_currency)
);

create table tax_codes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  rate numeric(9,4) not null check (rate >= 0),   -- entered in Settings; never hardcoded
  direction text not null check (direction in ('input','output')),
  category text not null check (category in ('standard','zero_rated','exempt')),
  account_id uuid,                                -- linked after accounts exist (see below)
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  unique (company_id, code, effective_from)
);

-- ---------------------------------------------------------------- numbering (gapless)
create table document_sequences (
  company_id uuid not null references companies(id) on delete cascade,
  doc_type text not null,
  prefix text not null default '',
  padding smallint not null default 5,
  next_number bigint not null default 1,
  primary key (company_id, doc_type)
);

-- Call inside the posting transaction only. Row lock + same-transaction increment
-- means a rollback also rolls the counter back, so numbers never have gaps.
create function next_document_number(p_company uuid, p_doc_type text) returns text
language plpgsql set search_path = public as $$
declare s document_sequences;
begin
  select * into s from document_sequences
   where company_id = p_company and doc_type = p_doc_type for update;
  if not found then
    insert into document_sequences(company_id, doc_type, prefix) values (p_company, p_doc_type, upper(left(p_doc_type,3)) || '-')
      on conflict do nothing;
    select * into s from document_sequences where company_id = p_company and doc_type = p_doc_type for update;
  end if;
  update document_sequences set next_number = next_number + 1
   where company_id = p_company and doc_type = p_doc_type;
  return s.prefix || lpad(s.next_number::text, s.padding, '0');
end $$;

-- ---------------------------------------------------------------- chart of accounts
create table accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','income','expense')),
  subtype text,
  parent_id uuid references accounts(id),
  is_control boolean not null default false,
  is_postable boolean not null default true,
  currency char(3),
  is_active boolean not null default true,
  unique (company_id, code),
  unique (id, company_id)
);
alter table tax_codes add constraint tax_codes_account_fk
  foreign key (account_id) references accounts(id);

-- Posting engine asks for a ROLE (e.g. AR_CONTROL); this maps role -> account per company.
create table account_roles (
  company_id uuid not null references companies(id) on delete cascade,
  role text not null,
  account_id uuid not null,
  primary key (company_id, role),
  foreign key (account_id, company_id) references accounts(id, company_id)
);

-- ---------------------------------------------------------------- fiscal periods
create table fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'open' check (status in ('open','closed','locked')),
  check (end_date >= start_date),
  unique (company_id, start_date)
);

-- ---------------------------------------------------------------- journals
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  number text,
  entry_date date not null,
  status text not null default 'draft' check (status in ('draft','posted')),
  source_type text,                    -- e.g. 'sales_invoice'
  source_id uuid,                      -- links back to the source document
  memo text,
  currency char(3) not null default 'QAR',
  fx_rate numeric(18,8) not null default 1 check (fx_rate > 0),
  reverses_entry_id uuid references journal_entries(id),
  reversed_by_entry_id uuid references journal_entries(id),
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, number)
);
create index journal_entries_source_idx on journal_entries (source_type, source_id);

create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  company_id uuid not null,
  line_no int not null,
  account_id uuid not null,
  debit numeric(18,4) not null default 0 check (debit >= 0),
  credit numeric(18,4) not null default 0 check (credit >= 0),
  foreign_amount numeric(18,4),
  foreign_currency char(3),
  party_id uuid,
  tax_code_id uuid references tax_codes(id),
  dimension jsonb not null default '{}',   -- project / job / vehicle / equipment tags
  memo text,
  check (not (debit > 0 and credit > 0)),
  check (debit > 0 or credit > 0),
  foreign key (entry_id, company_id) references journal_entries(id, company_id) on delete cascade,
  foreign key (account_id, company_id) references accounts(id, company_id),
  unique (entry_id, line_no)
);
create index journal_lines_account_idx on journal_lines (company_id, account_id);

-- Posting: must balance, have 2+ lines, be in an OPEN fiscal period; posted entries are frozen.
create function journal_entry_guard() returns trigger language plpgsql set search_path = public as $$
declare d numeric; c numeric; n int; p_status text;
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Posted journal entries cannot be deleted; post a reversal instead' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Journal entries must be created as draft, then posted' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- UPDATE
  if old.status = 'posted' then
    -- only allowed change: marking the entry as reversed (once)
    if (to_jsonb(new) - 'reversed_by_entry_id') is distinct from (to_jsonb(old) - 'reversed_by_entry_id')
       or old.reversed_by_entry_id is not null then
      raise exception 'Posted journal entries are immutable; post a reversal instead' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.status = 'posted' then
    select coalesce(sum(debit),0), coalesce(sum(credit),0), count(*) into d, c, n
      from journal_lines where entry_id = new.id;
    if n < 2 then raise exception 'Journal entry needs at least two lines' using errcode = 'P0001'; end if;
    if d <> c then
      raise exception 'Unbalanced journal entry: debits % <> credits %', d, c using errcode = 'P0001';
    end if;
    select status into p_status from fiscal_periods
      where company_id = new.company_id and new.entry_date between start_date and end_date;
    if p_status is null then
      raise exception 'No fiscal period covers %', new.entry_date using errcode = 'P0001';
    elsif p_status <> 'open' then
      raise exception 'Fiscal period is % for date %', p_status, new.entry_date using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger journal_entries_guard before insert or update or delete on journal_entries
  for each row execute function journal_entry_guard();

create function journal_line_guard() returns trigger language plpgsql set search_path = public as $$
declare s text; eid uuid := coalesce(new.entry_id, old.entry_id);
begin
  select status into s from journal_entries where id = eid;
  if s = 'posted' then
    raise exception 'Lines of a posted journal entry cannot be changed' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger journal_lines_guard before insert or update or delete on journal_lines
  for each row execute function journal_line_guard();

-- Closed/locked periods cannot be edited/deleted once they have posted entries? (periods may be reopened by admin; audited)

-- ---------------------------------------------------------------- audit triggers
do $$
declare t text;
begin
  foreach t in array array['companies','profiles','user_company_roles','role_permissions','settings',
    'tax_codes','accounts','account_roles','fiscal_periods','journal_entries','exchange_rates','document_sequences']
  loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function audit_row()', t||'_audit', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- lock down public API
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

insert into currencies(code,name) values ('QAR','Qatari Riyal'),('USD','US Dollar'),('EUR','Euro'),('GBP','Pound Sterling'),('AED','UAE Dirham'),('INR','Indian Rupee');
