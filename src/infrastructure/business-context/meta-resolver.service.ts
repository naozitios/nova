import type { MetaConnectionPort, ResolvedMetaConnection } from '@/core/business-context/meta-connection.port'
import type { MetaConnectionRepositoryPort } from '@/core/business-context/meta-connection-repository.port'
import type { ServiceResult } from '@/core/business-context/types'

export class MetaResolver implements MetaConnectionPort {
  constructor(private readonly repo: MetaConnectionRepositoryPort) {}

  async resolve(workspaceId: string, businessId: string): Promise<ServiceResult<ResolvedMetaConnection>> {
    const conn = await this.repo.getActiveConnection(workspaceId, businessId)
    if (!conn.ok) return conn
    if (!conn.data) {
      return { ok: false, error: { code: 'NO_CONNECTION', message: 'No active Meta connection found' } }
    }
    return {
      ok: true,
      data: {
        accessToken: conn.data.accessToken,
        adAccountId: conn.data.adAccountId,
        expiresAt: conn.data.expiresAt,
      },
    }
  }
}
