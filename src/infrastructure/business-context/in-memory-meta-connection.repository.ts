import type {
  MetaConnection,
  MetaConnectionRepositoryPort,
} from '@/core/business-context/meta-connection-repository.port'
import type { ServiceResult } from '@/core/business-context/types'

export class InMemoryMetaConnectionRepository implements MetaConnectionRepositoryPort {
  private connections = new Map<string, MetaConnection>()

  private key(workspaceId: string, businessId: string): string {
    return `${workspaceId}::${businessId}`
  }

  async getActiveConnection(workspaceId: string, businessId: string): Promise<ServiceResult<MetaConnection | null>> {
    const conn = this.connections.get(this.key(workspaceId, businessId))
    return { ok: true, data: conn ?? null }
  }

  async upsertConnection(data: Omit<MetaConnection, 'id' | 'createdAt'>): Promise<ServiceResult<MetaConnection>> {
    const k = this.key(data.workspaceId, data.businessId)
    const existing = this.connections.get(k)
    const conn: MetaConnection = {
      ...data,
      id: existing?.id ?? `meta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: existing?.createdAt ?? new Date(),
    }
    this.connections.set(k, conn)
    return { ok: true, data: conn }
  }

  async deleteConnection(workspaceId: string, businessId: string): Promise<ServiceResult<void>> {
    this.connections.delete(this.key(workspaceId, businessId))
    return { ok: true, data: undefined }
  }
}
