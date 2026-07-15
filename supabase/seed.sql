-- Test fixtures for cross-workspace RLS testing.
-- Two workspaces with members in owner, admin, editor, viewer roles.

-- Test workspace (used by repository contract tests with hardcoded IDs)
insert into workspaces (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Test Workspace'),
  ('20000000-0000-0000-0000-000000000001', 'Processing Visibility Test Workspace'),
  ('30000000-0000-0000-0000-000000000001', 'Job Lifecycle Test Workspace');

-- Test businesses (used by repository contract tests)
insert into businesses (id, workspace_id, name, website_url, status) values
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Test Business', 'https://test.example.com', 'active'),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Processing Visibility Test Business', 'https://pv.example.com', 'active'),
  ('30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Job Lifecycle Test Business', 'https://jl.example.com', 'active');

-- Test workspace members (used by RLS tests)
insert into workspace_members (workspace_id, user_id, role) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000010', 'editor'),
  ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000010', 'editor'),
  ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010', 'editor');

-- Test context sources (parent rows for FK references in test fixtures)
insert into context_sources (id, workspace_id, business_id, source_type, source_name, status, metadata) values
  ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'website', 'Test Source', 'registered', '{}'),
  ('20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'website', 'PV Test Source', 'registered', '{}'),
  ('30000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'website', 'Extraction Test Source', 'registered', '{}');

-- Test source document (parent row for FK reference in extraction tests)
insert into source_documents (id, workspace_id, business_id, source_id, title, document_type, content_hash, retrieved_at) values
  ('30000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', 'Test Document', 'webpage', 'test-hash-001', now());

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

-- ============================================================================
-- Business Context fixtures for RLS testing
-- ============================================================================

-- Businesses
insert into businesses (id, workspace_id, name, website_url, status) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Acme Widgets', 'https://acme.example.com', 'active'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Globex Gadgets', 'https://globex.example.com', 'active');

-- Onboarding sessions
insert into onboarding_sessions (id, workspace_id, business_id, status, current_step, started_by) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'awaiting_review', 'extract_facts', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'created', null, 'ffffffff-ffff-ffff-ffff-ffffffffffff');

-- Context sources
insert into context_sources (id, workspace_id, business_id, source_type, source_name, external_reference, status, current_stage, metadata) values
  ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'website', 'Acme Website', 'https://acme.example.com', 'processing', 'extracting', '{"pages_found": 12}'),
  ('88888888-8888-8888-8888-888888888888', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'brand_deck', 'Brand Guidelines 2025', null, 'processed', 'completed', '{"parser": "pdf"}'),
  ('99999999-9999-9999-9999-999999999999', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'website', 'Globex Website', 'https://globex.example.com', 'registered', null, '{}');

-- Source documents
insert into source_documents (id, workspace_id, business_id, source_id, url, title, document_type, mime_type, content_hash, content_text, retrieved_at) values
  ('aaaaaaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', 'https://acme.example.com/about', 'About Acme', 'webpage', 'text/html', 'abc123hash', '# About Acme Widgets\nAcme makes the best widgets since 1995.', now()),
  ('aaaaaaaa-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', null, 'Brand Guidelines 2025', 'pdf', 'application/pdf', 'def456hash', null, now());

-- Context facts
insert into context_facts (id, workspace_id, business_id, fact_key, value, source_id, source_document_id, source_excerpt, confidence, verification_status, created_by) values
  ('bbbbbbbb-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'business.name', '"Acme Widgets"', '77777777-7777-7777-7777-777777777777', 'aaaaaaaa-1111-1111-1111-111111111111', 'Acme makes the best widgets', 0.95, 'user_verified', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  ('bbbbbbbb-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'business.founded_year', '1995', '77777777-7777-7777-7777-777777777777', 'aaaaaaaa-1111-1111-1111-111111111111', 'since 1995', 0.85, 'extracted', 'system'),
  ('bbbbbbbb-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'business.founded_year', '1997', '88888888-8888-8888-8888-888888888888', 'aaaaaaaa-2222-2222-2222-222222222222', 'Established in 1997', 0.70, 'extracted', 'system');

-- Context conflicts (conflicting founded_year facts)
insert into context_conflicts (id, workspace_id, business_id, fact_key, fact_ids, status) values
  ('cccccccc-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'business.founded_year', ARRAY['bbbbbbbb-2222-2222-2222-222222222222', 'bbbbbbbb-3333-3333-3333-333333333333']::uuid[], 'open');

-- Onboarding questions
insert into onboarding_questions (id, workspace_id, session_id, business_id, fact_key, question_type, question, reason, priority, status) values
  ('dddddddd-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'business.founded_year', 'single_choice', 'When was Acme Widgets founded? Website says 1995, brand deck says 1997.', 'conflict', 10, 'open');

-- Business profile versions (draft for Acme)
insert into business_profile_versions (id, workspace_id, business_id, version, profile, status, created_by) values
  ('eeeeeeee-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 1, '{"business": {"name": "Acme Widgets", "website_url": "https://acme.example.com"}, "offers": {}, "customers": {}, "conversion_journey": {}, "economics": {}, "brand": {}, "creative_capacity": {}, "measurement": {}}', 'draft', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- Context jobs
insert into context_jobs (id, workspace_id, business_id, session_id, job_type, status, idempotency_key, input) values
  ('ffffffff-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555', 'crawl_website', 'running', 'idem-acme-crawl-001', '{"url": "https://acme.example.com", "max_pages": 30}'),
  ('ffffffff-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', null, 'extract_facts', 'queued', 'idem-acme-extract-001', '{"source_id": "77777777-7777-7777-7777-777777777777"}');

-- Processing run (Acme website crawl)
insert into context_processing_runs (id, workspace_id, business_id, source_id, job_id, pipeline_type, status, current_stage, pages_processed, documents_created, facts_extracted) values
  ('11111111-aaaa-bbbb-cccc-111111111111', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777', 'ffffffff-1111-1111-1111-111111111111', 'website', 'running', 'extracting', 5, 2, 8);

-- Stage events
insert into context_processing_stage_events (id, workspace_id, business_id, run_id, source_id, stage, status, attempt, worker_id, provider, started_at, completed_at, duration_ms, pages_processed) values
  ('22222222-aaaa-bbbb-cccc-222222222222', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '11111111-aaaa-bbbb-cccc-111111111111', '77777777-7777-7777-7777-777777777777', 'registered', 'succeeded', 1, 'worker-1', 'internal', now() - interval '10 minutes', now() - interval '10 minutes' + interval '2 seconds', 2000, 0),
  ('33333333-aaaa-bbbb-cccc-333333333333', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '11111111-aaaa-bbbb-cccc-111111111111', '77777777-7777-7777-7777-777777777777', 'queued', 'succeeded', 1, 'worker-1', 'internal', now() - interval '9 minutes', now() - interval '9 minutes' + interval '1 second', 1000, 0),
  ('44444444-aaaa-bbbb-cccc-444444444444', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '11111111-aaaa-bbbb-cccc-111111111111', '77777777-7777-7777-7777-777777777777', 'acquiring', 'succeeded', 1, 'worker-1', 'firecrawl', now() - interval '8 minutes', now() - interval '8 minutes' + interval '30 seconds', 30000, 0),
  ('55555555-aaaa-bbbb-cccc-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '11111111-aaaa-bbbb-cccc-111111111111', '77777777-7777-7777-7777-777777777777', 'stored', 'succeeded', 1, 'worker-1', 'internal', now() - interval '7 minutes', now() - interval '7 minutes' + interval '5 seconds', 5000, 0),
  ('66666666-aaaa-bbbb-cccc-666666666666', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '11111111-aaaa-bbbb-cccc-111111111111', '77777777-7777-7777-7777-777777777777', 'parsing', 'succeeded', 1, 'worker-1', 'internal', now() - interval '6 minutes', now() - interval '6 minutes' + interval '15 seconds', 15000, 5),
  ('77777777-aaaa-bbbb-cccc-777777777777', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '11111111-aaaa-bbbb-cccc-111111111111', '77777777-7777-7777-7777-777777777777', 'extracting', 'started', 1, 'worker-1', 'groq', now() - interval '5 minutes', null, null, 0);
