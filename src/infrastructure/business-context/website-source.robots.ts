// ─── Robots.txt parsing ─────────────────────────────────────────────────────

export function isDisallowedByRobots(path: string, robotsTxt: string): boolean {
  const lines = robotsTxt.split('\n')
  let appliesToWildcard = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (trimmed.toLowerCase().startsWith('user-agent:')) {
      const agent = trimmed.split(':')[1]?.trim()
      appliesToWildcard = agent === '*'
    } else if (appliesToWildcard && trimmed.toLowerCase().startsWith('disallow:')) {
      const disallowedPath = trimmed.split(':')[1]?.trim()
      if (disallowedPath && path.startsWith(disallowedPath)) {
        return true
      }
    }
  }

  return false
}
