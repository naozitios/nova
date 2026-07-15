import type { RepositoryPort } from '@/core/business-context/repository.port'
import type { ContextSource, ContextJob } from '@/core/business-context/types'
import { registerSource, listSources, getSource, processSource, archiveSource, queueScan } from '@/core/business-context/service/source.service'
import type { RegisterSourceInput } from '@/core/business-context/service/source.service'
import type { SourceAdapterPort } from '@/core/business-context/source-adapter.port'
import type { SourceType } from '@/core/business-context/types'
import type { ServiceResult } from '@/core/business-context/types'

export class SourceProcessingService {
  private adapters = new Map<SourceType, SourceAdapterPort>()

  constructor(private readonly repo: RepositoryPort) {}

  registerAdapter(adapter: SourceAdapterPort): void {
    const types: SourceType[] = ['website', 'document', 'meta_ads', 'manual']
    for (const t of types) {
      if (adapter.supports(t)) {
        this.adapters.set(t, adapter)
      }
    }
  }

  registerSource(businessId: string, workspaceId: string, input: RegisterSourceInput) {
    return registerSource(this.repo, businessId, workspaceId, input)
  }

  listSources(businessId: string, workspaceId: string) {
    return listSources(this.repo, businessId, workspaceId)
  }

  getSource(businessId: string, workspaceId: string, sourceId: string) {
    return getSource(this.repo, businessId, workspaceId, sourceId)
  }

  processSource(businessId: string, workspaceId: string, sourceId: string) {
    return processSource(this.repo, businessId, workspaceId, sourceId)
  }

  archiveSource(businessId: string, workspaceId: string, sourceId: string) {
    return archiveSource(this.repo, businessId, workspaceId, sourceId)
  }

  queueScan(businessId: string, workspaceId: string) {
    return queueScan(this.repo, businessId, workspaceId)
  }
}
