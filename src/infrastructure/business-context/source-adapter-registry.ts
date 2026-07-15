import type { SourceAdapterPort } from '@/core/business-context/source-adapter.port'
import type { SourceType } from '@/core/business-context/types'

export class SourceAdapterRegistry {
  private adapters = new Map<SourceType, SourceAdapterPort>()

  register(adapter: SourceAdapterPort): void {
    // Store by all types this adapter supports — iterate common types
    const types: SourceType[] = ['website', 'document', 'meta_ads', 'manual']
    for (const t of types) {
      if (adapter.supports(t)) {
        this.adapters.set(t, adapter)
      }
    }
  }

  getAdapter(sourceType: SourceType): SourceAdapterPort | undefined {
    return this.adapters.get(sourceType)
  }

  hasAdapter(sourceType: SourceType): boolean {
    return this.adapters.has(sourceType)
  }

  listAdapterTypes(): SourceType[] {
    return Array.from(this.adapters.keys())
  }
}
