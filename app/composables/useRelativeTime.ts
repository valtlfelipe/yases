const RELATIVE_THRESHOLD_HOURS = 1

export function useRelativeTime() {
  function fullFormat(dateStr: string, withYear = true) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(withYear ? { year: 'numeric' } : {}),
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function relativeFormat(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    return `${hours}h ago`
  }

  function isRecent(dateStr: string): boolean {
    const diff = Date.now() - new Date(dateStr).getTime()
    return diff < RELATIVE_THRESHOLD_HOURS * 3_600_000
  }

  function formatDate(dateStr: string, withYear = true): { text: string; tooltip: string | null } {
    if (isRecent(dateStr)) {
      return { text: relativeFormat(dateStr), tooltip: fullFormat(dateStr, withYear) }
    }
    return { text: fullFormat(dateStr, withYear), tooltip: null }
  }

  return { formatDate, fullFormat }
}
