// ─── Content deduplication ──────────────────────────────────────────────────

export async function computeHash(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface DedupePage {
  url: string
  markdown?: string
  html?: string
  statusCode: number
  metadata?: Record<string, unknown>
  title?: string
  description?: string
}

export async function dedupeByCanonical(pages: DedupePage[]): Promise<DedupePage[]> {
  const seen = new Set<string>()
  const result: DedupePage[] = []
  for (const page of pages) {
    const canonical = (page.metadata?.canonical_url as string) ?? page.url
    if (seen.has(canonical)) continue
    seen.add(canonical)
    result.push(page)
  }
  return result
}

export async function dedupeByContentHash(pages: DedupePage[]): Promise<DedupePage[]> {
  const seen = new Set<string>()
  const result: DedupePage[] = []
  for (const page of pages) {
    const hash = await computeHash((page.markdown ?? '') + '\0' + (page.html ?? ''))
    if (seen.has(hash)) continue
    seen.add(hash)
    result.push(page)
  }
  return result
}
