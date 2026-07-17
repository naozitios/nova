export type DateWindow = { since: string; until: string }

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

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function subDays(dateStr: string, n: number): Date {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

function buildWindows(today: string, count: number, offset: number): DateWindow[] {
  const windows: DateWindow[] = []
  for (let i = offset + count - 1; i >= offset; i--) {
    const since = toDateStr(subDays(today, i + 1))
    const until = since
    windows.push({ since, until })
  }
  return windows
}

export function buildInitialInsightWindows(
  today: string,
  days = 90,
): DateWindow[] {
  return buildWindows(today, days, 0)
}

export function buildIncrementalInsightWindows(
  today: string,
  lookbackDays = 7,
): DateWindow[] {
  return buildWindows(today, lookbackDays, 0)
}
