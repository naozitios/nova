import { randomUUID } from 'node:crypto';
import { getRequiredSupabaseTestEnv } from './supabase-env';
import type { CleanupTracker } from './cleanup';

export const TEST_CONTEXT_JOB_WORKSPACE = '00000000-0000-0000-0000-000000000010';
export const TEST_CONTEXT_JOB_BUSINESS = '00000000-0000-0000-0000-000000000011';

export async function seedContextJobParents(): Promise<void> {
  const env = getRequiredSupabaseTestEnv();
  await env.serviceClient
    .from('workspaces')
    .upsert({ id: TEST_CONTEXT_JOB_WORKSPACE, name: 'Job Test Workspace' });
  await env.serviceClient.from('businesses').upsert({
    id: TEST_CONTEXT_JOB_BUSINESS,
    workspace_id: TEST_CONTEXT_JOB_WORKSPACE,
    name: 'Job Test Business',
  });
}

export async function createContextJob(
  overrides: Record<string, unknown> = {},
  cleanup?: CleanupTracker
): Promise<string> {
  await seedContextJobParents();
  const env = getRequiredSupabaseTestEnv();
  const id = randomUUID();
  const row = {
    id,
    workspace_id: TEST_CONTEXT_JOB_WORKSPACE,
    business_id: TEST_CONTEXT_JOB_BUSINESS,
    job_type: 'crawl_website',
    status: 'queued',
    attempt_count: 0,
    max_attempts: 4,
    idempotency_key: `test-${id}`,
    input: { url: 'https://example.com' },
    retry_policy: {},
    stage_timeout_seconds: 60,
    ...overrides,
  };
  const jobId = String(row.id);
  const { error } = await env.serviceClient.from('context_jobs').insert(row);
  if (error) throw error;
  cleanup?.track('context_jobs', jobId);
  return jobId;
}

export async function readContextJob(id: string): Promise<Record<string, unknown>> {
  const env = getRequiredSupabaseTestEnv();
  const { data, error } = await env.serviceClient
    .from('context_jobs')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}
