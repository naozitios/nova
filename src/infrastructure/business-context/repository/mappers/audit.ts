import type { AuditLog } from '@/core/business-context/types'
import { asJsonRecordOrNull, type Row } from './helpers'

export function mapAuditLog(r: Row): AuditLog {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    actorId: (r.actor_id as string) ?? null,
    actorType: r.actor_type as AuditLog['actorType'],
    eventType: r.event_type as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string,
    before: asJsonRecordOrNull(r.before),
    after: asJsonRecordOrNull(r.after),
    createdAt: new Date(r.created_at as string),
  }
}
