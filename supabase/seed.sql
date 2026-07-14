-- Test fixtures for cross-workspace RLS testing.
-- Two workspaces with members in owner, admin, editor, viewer roles.

-- Workspace 1
insert into workspaces (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Acme Corp');

-- Workspace 2 (for cross-workspace isolation testing)
insert into workspaces (id, name) values
  ('22222222-2222-2222-2222-222222222222', 'Globex Inc');

-- Members for Workspace 1 (Acme Corp)
insert into workspace_members (workspace_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'editor'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'viewer');

-- Members for Workspace 2 (Globex Inc)
insert into workspace_members (workspace_id, user_id, role) values
  ('22222222-2222-2222-2222-222222222222', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'editor');
