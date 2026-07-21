-- Demo user bootstrap for MVP onboarding walkthrough.
-- Creates a clean workspace + business for demo@nova.io with no pre-existing
-- onboarding data, and makes the demo user the workspace owner.
-- Idempotent: safe to re-run.

insert into workspaces (id, name)
values ('10000000-0000-0000-0000-000000000020', 'Demo Agency Workspace')
on conflict (id) do nothing;

insert into businesses (id, workspace_id, name, website_url, status)
values (
  '10000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000020',
  'Demo Agency',
  'https://demo.nova.io',
  'new'
)
on conflict (id) do nothing;

insert into workspace_members (workspace_id, user_id, role)
values (
  '10000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000010',
  'owner'
)
on conflict (workspace_id, user_id) do update set role = excluded.role;
