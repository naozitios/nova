import type { BusinessProfileVersion } from '@/core/business-context/types'
import { asJsonRecord, type Row } from './helpers'

export function mapProfileVersion(r: Row): BusinessProfileVersion {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    version: Number(r.version),
    profile: asJsonRecord(r.profile),
    profileMarkdown: (r.profile_markdown as string) ?? null,
    status: r.status as BusinessProfileVersion['status'],
    changeSummary: (r.change_summary as string) ?? null,
    createdBy: r.created_by as string,
    createdAt: new Date(r.created_at as string),
    approvedBy: (r.approved_by as string) ?? null,
    approvedAt: r.approved_at ? new Date(r.approved_at as string) : null,
  }
}
