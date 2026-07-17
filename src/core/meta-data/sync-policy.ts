export type MetaHierarchyObjectType = 'campaigns' | 'ad_sets' | 'ads' | 'creatives'

export interface MetaSyncPartition {
  objectType: MetaHierarchyObjectType
  accountId: string
}

const HIERARCHY_ORDER: MetaHierarchyObjectType[] = ['campaigns', 'ad_sets', 'ads', 'creatives']

export function buildHierarchyPartitions(
  accountId: string,
): MetaSyncPartition[] {
  return HIERARCHY_ORDER.map((objectType) => ({ objectType, accountId }))
}

function hasStatus(error: unknown): error is { status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number"
  )
}

function isValidationError(error: unknown): boolean {
  if (!hasStatus(error)) return false;
  if (error.status !== 400) return false;
  const e = error as Record<string, unknown>;
  if (typeof e.message === 'string' && /invalid|param|validation/i.test(e.message)) return true
  if (e.error && typeof e.error === "object") {
    const inner = e.error as Record<string, unknown>;
    if (inner.error_subcode === 100 || inner.code === 100) return true
  }
  return false
}

export function classifyMetaSyncError(
  error: unknown,
): "retryable" | "permission" | "auth" | "schema" | "permanent" {
  if (!hasStatus(error)) return 'retryable'

  const { status } = error

  if (status === 429 || (status >= 500 && status < 600)) return 'retryable'
  if (status === 401) return 'auth'
  if (status === 403) return 'permission'
  if (isValidationError(error)) return 'schema'

  return 'permanent'
}
