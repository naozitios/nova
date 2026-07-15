import { SourceType } from '@/core/business-context/types/enums'
import type { SourceAdapterPort } from '@/core/business-context/source-adapter.port'

// ─── Error codes ────────────────────────────────────────────────────────────

export const RegistryErrors = {
  UNSUPPORTED_SOURCE_TYPE: 'UNSUPPORTED_SOURCE_TYPE',
  ADAPTER_NOT_CONFIGURED: 'ADAPTER_NOT_CONFIGURED',
} as const

// ─── Registry ───────────────────────────────────────────────────────────────

export class SourceAdapterRegistry {
  private readonly adapters = new Map<string, SourceAdapterPort>()
  private readonly unsupportedErrors = new Map<string, string>()

  register(adapter: SourceAdapterPort): void {
    // A single adapter may support multiple source types.
    // We store it under every type it claims to support.
    const probeTypes: SourceType[] = Object.values(SourceType)
    for (const t of probeTypes) {
      if (adapter.supports(t)) {
        this.adapters.set(t, adapter)
      }
    }
  }

  /**
   * Register a stable error returned when a source type has no adapter.
   */
  registerUnsupported(sourceType: SourceType, message: string): void {
    this.unsupportedErrors.set(sourceType, message)
  }

  getAdapter(sourceType: SourceType): SourceAdapterPort | null {
    return this.adapters.get(sourceType) ?? null
  }

  hasAdapter(sourceType: SourceType): boolean {
    return this.adapters.has(sourceType)
  }

  /**
   * Resolve adapter or return a structured error result.
   */
  resolve(sourceType: SourceType): {
    adapter: SourceAdapterPort
  } | {
    error: { code: string; message: string }
  } {
    const adapter = this.adapters.get(sourceType)
    if (adapter) return { adapter }

    const customMsg = this.unsupportedErrors.get(sourceType)
    return {
      error: {
        code: RegistryErrors.UNSUPPORTED_SOURCE_TYPE,
        message: customMsg ?? `No adapter registered for source type: ${sourceType}`,
      },
    }
  }

  listSupportedTypes(): SourceType[] {
    return Array.from(this.adapters.keys()) as SourceType[]
  }
}
