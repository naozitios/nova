// ─── Content sanitization helpers ───────────────────────────────────────────

export function sanitizeContent(text: string): string {
  let cleaned = text
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleaned = cleaned.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
  cleaned = cleaned.replace(/\son\w+\s*=\s*\S+/gi, '')
  cleaned = cleaned.replace(/javascript\s*:/gi, '')
  cleaned = cleaned.replace(/<[^>]+>/g, '')
  return cleaned
}

export function applyLinePrefix(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? `>${line}` : line))
    .join('\n')
}
