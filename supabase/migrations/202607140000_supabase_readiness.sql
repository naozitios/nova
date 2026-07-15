-- Supabase readiness migration
-- Creates foundational tables for workspace RLS testing and a readiness check function.
-- Business Context tables and policies start in the next migration.

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Readiness check: returns true when the local database is operational.
create or replace function check_readiness()
returns boolean
language sql
as $$
  select true;
$$;

-- Business Context migrations start here (next migration: 202607140001_business_context.sql)

-- Enable RLS on readiness tables
alter table workspaces enable row level security;
alter table workspace_members enable row level security;

-- Test helper: execute arbitrary SQL and return rows as JSON
-- Required by tests/rls and tests/integration test suites
create or replace function public.exec_sql(query text)
returns setof json
language plpgsql
security definer
as $$
declare
  rec json;
begin
  for rec in execute 'select row_to_json(t) from (' || query || ') t'
  loop
    return next rec;
  end loop;
end;
$$;
