import type { SupabaseClient } from '@supabase/supabase-js'
import type { JsonValue, ServiceResult } from '@/core/business-context/types'
import type {
  AdvanceCheckpointInput,
  CreateSyncRunInput,
  MetaSyncCheckpointRecord,
  MetaSyncRunRecord,
  QuarantineRecordsInput,
} from '@/core/meta-data/repository.port'

type Row = Record<string, unknown>

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

function err<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
}

export function mapSyncRun(row: Row): MetaSyncRunRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    metaAdAccountId: String(row.meta_ad_account_id),
    mode: String(row.mode),
    status: String(row.status),
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
  }
}

export class MetaSyncRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insertQuarantinedRecords(rows: Row[]): Promise<ServiceResult<void>> {
    if (rows.length === 0) return ok(undefined as void)
    const { error } = await this.db.from('meta_quarantined_records').insert(rows)
    if (error) return err('QUARANTINE_RECORDS_FAILED', error.message)
    return ok(undefined as void)
  }

  async createSyncRun(input: CreateSyncRunInput): Promise<ServiceResult<MetaSyncRunRecord>> {
    const { data, error } = await this.db
      .from('meta_sync_runs')
      .insert({
        workspace_id: input.workspaceId,
        meta_ad_account_id: input.metaAdAccountId,
        mode: input.mode,
        status: 'queued',
        idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
      })
      .select('*')
      .single()

    if (error) return err('CREATE_SYNC_RUN_FAILED', error.message)
    return ok(mapSyncRun(data as Row))
  }

  async getSyncRun(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord | null>> {
    const { data, error } = await this.db
      .from('meta_sync_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .maybeSingle()

    if (error) return err('READ_SYNC_RUN_FAILED', error.message)
    return ok(data ? mapSyncRun(data as Row) : null)
  }

  async scheduleSyncRetry(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord>> {
    const { data: existing, error: readErr } = await this.db
      .from('meta_sync_runs')
      .select('id, attempt_count')
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .single()

    if (readErr || !existing) return err('SYNC_RUN_NOT_FOUND', 'Sync run not found')

    const updatePayload: Row = {
      status: 'retry_scheduled',
      locked_by: null,
      locked_at: null,
    }
    if (existing.attempt_count != null) {
      updatePayload.attempt_count = (existing.attempt_count as number) + 1
    }

    const { data, error } = await this.db
      .from('meta_sync_runs')
      .update(updatePayload)
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .select('*')
      .single()

    if (error) return err('SCHEDULE_SYNC_RETRY_FAILED', error.message)
    return ok(mapSyncRun(data as Row))
  }

  async advanceCheckpoint(input: AdvanceCheckpointInput): Promise<ServiceResult<MetaSyncCheckpointRecord>> {
    const { data, error } = await this.db
      .from('meta_sync_checkpoints')
      .upsert(
        {
          workspace_id: input.workspaceId,
          run_id: input.runId,
          partition_key: input.partitionKey,
          status: input.status,
          cursor: input.cursor != null ? String(input.cursor) : null,
        },
        { onConflict: 'run_id,partition_key' },
      )
      .select('*')
      .single()

    if (error) return err('ADVANCE_CHECKPOINT_FAILED', error.message)
    return ok({
      id: String(data.id),
      workspaceId: String(data.workspace_id),
      runId: String(data.run_id),
      partitionKey: String(data.partition_key),
      status: String(data.status),
      cursor: data.cursor as JsonValue | null,
    })
  }

  async claimSyncRun(runId: string, workerId: string, leaseMs: number): Promise<ServiceResult<MetaSyncRunRecord | null>> {
    const now = new Date()
    const leaseExpires = new Date(now.getTime() + leaseMs)
    const nowIso = now.toISOString()
    const leaseExpiresIso = leaseExpires.toISOString()

    const { data, error } = await this.db
      .from('meta_sync_runs')
      .update({
        lease_owner: workerId,
        lease_acquired_at: nowIso,
        lease_expires_at: leaseExpiresIso,
        heartbeat_at: nowIso,
        status: 'running',
      })
      .eq('id', runId)
      .or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`)
      .select('*')
      .maybeSingle()

    if (error) return err('CLAIM_SYNC_RUN_FAILED', error.message)
    return ok(data ? mapSyncRun(data as Row) : null)
  }

  async listRunnableSyncRuns(limit: number): Promise<ServiceResult<MetaSyncRunRecord[]>> {
    const nowIso = new Date().toISOString()
    const { data, error } = await this.db
      .from('meta_sync_runs')
      .select('*')
      .in('status', ['queued', 'retry_scheduled'])
      .or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) return err('LIST_RUNNABLE_SYNC_RUNS_FAILED', error.message)
    return ok((data ?? []).map((row) => mapSyncRun(row as Row)))
  }

  async setSyncRunStatus(runId: string, status: 'completed' | 'failed', errorMessage?: string): Promise<ServiceResult<MetaSyncRunRecord>> {
    const nowIso = new Date().toISOString()
    const updatePayload: Row = {
      status,
      completed_at: nowIso,
      lease_owner: null,
      lease_acquired_at: null,
      lease_expires_at: null,
      heartbeat_at: null,
    }
    if (errorMessage) {
      updatePayload.error = { message: errorMessage }
    }

    const { data, error } = await this.db
      .from('meta_sync_runs')
      .update(updatePayload)
      .eq('id', runId)
      .select('*')
      .single()

    if (error) return err('SET_SYNC_RUN_STATUS_FAILED', error.message)
    if (!data) return err('SYNC_RUN_NOT_FOUND', 'Sync run not found')
    return ok(mapSyncRun(data as Row))
  }

  async getCompletedCheckpointKeys(runId: string): Promise<ServiceResult<string[]>> {
    const { data, error } = await this.db
      .from('meta_sync_checkpoints')
      .select('partition_key')
      .eq('run_id', runId)
      .eq('status', 'completed')

    if (error) return err('READ_COMPLETED_CHECKPOINTS_FAILED', error.message)
    return ok((data ?? []).map((row) => String(row.partition_key)))
  }

  async quarantineRecords(input: QuarantineRecordsInput): Promise<ServiceResult<{ quarantined: number }>> {
    if (input.records.length === 0) return ok({ quarantined: 0 })
    const qRows = input.records.map((r) => ({
      workspace_id: input.workspaceId,
      run_id: input.runId,
      source_table: input.objectType,
      provider_id: r.externalId ?? '',
      redacted_payload: r.payload as JsonValue,
      validation_errors: [r.reason] as JsonValue,
    }))
    const quarantineResult = await this.insertQuarantinedRecords(qRows)
    if (!quarantineResult.ok) return quarantineResult as ServiceResult<{ quarantined: number }>
    return ok({ quarantined: qRows.length })
  }
}
