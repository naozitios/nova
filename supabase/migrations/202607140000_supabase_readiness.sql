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
