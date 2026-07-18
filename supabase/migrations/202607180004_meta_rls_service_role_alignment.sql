-- PRD 008A: Align service-role write policies across Meta migrations
-- Rewrites permissive `using (true) with check (true)` policies in
-- 202607180002 and 202607180003 to match 202607180001's strict pattern:
--   for all to service_role
--     using (auth.role() = 'service_role')
--     with check (auth.role() = 'service_role')
-- This ensures defense-in-depth: only service_role can write, even if
-- another role bypasses RLS.

-- ============================================================================
-- 202607180002_meta_hierarchy_sync — 8 policies
-- ============================================================================

drop policy if exists "meta_campaigns_service_role" on public.meta_campaigns;
create policy "meta_campaigns_service_role" on public.meta_campaigns
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "meta_ad_sets_service_role" on public.meta_ad_sets;
create policy "meta_ad_sets_service_role" on public.meta_ad_sets
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "meta_ads_service_role" on public.meta_ads;
create policy "meta_ads_service_role" on public.meta_ads
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "meta_creatives_service_role" on public.meta_creatives;
create policy "meta_creatives_service_role" on public.meta_creatives
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "meta_sync_runs_service_role" on public.meta_sync_runs;
create policy "meta_sync_runs_service_role" on public.meta_sync_runs
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "meta_sync_checkpoints_service_role" on public.meta_sync_checkpoints;
create policy "meta_sync_checkpoints_service_role" on public.meta_sync_checkpoints
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "meta_sync_attempts_service_role" on public.meta_sync_attempts;
create policy "meta_sync_attempts_service_role" on public.meta_sync_attempts
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "meta_quarantined_records_service_role" on public.meta_quarantined_records;
create policy "meta_quarantined_records_service_role" on public.meta_quarantined_records
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================================
-- 202607180003_meta_daily_insights — 1 policy
-- ============================================================================

drop policy if exists "meta_insights_daily_service_role" on public.meta_insights_daily;
create policy "meta_insights_daily_service_role" on public.meta_insights_daily
  for all to service_role
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
