const STATUS_ORDER = ['pending', 'completed', 'failed']

function formatStatusCounts(byStatus) {
  const lines = []

  for (const status of STATUS_ORDER) {
    if (byStatus[status] != null) {
      lines.push(`  ${status}: ${byStatus[status]}`)
    }
  }

  for (const [status, count] of Object.entries(byStatus)) {
    if (!STATUS_ORDER.includes(status)) {
      lines.push(`  ${status}: ${count}`)
    }
  }

  return lines
}

export function formatJobsStats(stats) {
  const lines = [
    '[cafci-worker] jobs stats',
    `database: ${stats.databasePath}`,
    `total: ${stats.total}`,
    '',
    'by status:',
    ...formatStatusCounts(stats.byStatus),
  ]

  if (stats.executionDate) {
    lines.splice(2, 0, `execution date: ${stats.executionDate}`)
    return lines.join('\n')
  }

  const dates = Object.entries(stats.byExecutionDate ?? {})

  if (dates.length === 0) {
    return lines.join('\n')
  }

  lines.push('', 'by execution date:')
  lines.push('  date         total  pending  completed  failed')

  for (const [date, entry] of dates) {
    const pending = entry.byStatus.pending ?? 0
    const completed = entry.byStatus.completed ?? 0
    const failed = entry.byStatus.failed ?? 0

    lines.push(
      `  ${date}  ${String(entry.total).padStart(5)}  ${String(pending).padStart(7)}  ${String(completed).padStart(9)}  ${String(failed).padStart(6)}`,
    )
  }

  return lines.join('\n')
}

export function formatJobsCleared({ databasePath, scope, deleted }) {
  return [
    '[cafci-worker] jobs cleared',
    `database: ${databasePath}`,
    `scope: ${scope}`,
    `deleted: ${deleted}`,
  ].join('\n')
}
