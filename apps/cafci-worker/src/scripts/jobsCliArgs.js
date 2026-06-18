export function parseJobsCliArgs(argv = process.argv.slice(2)) {
  const args = new Set(argv)
  let date = null

  for (const arg of argv) {
    if (arg.startsWith('--date=')) {
      date = arg.slice('--date='.length)
    }
  }

  return {
    all: args.has('--all'),
    date,
  }
}

export function resolveExecutionDate({ all, date } = {}) {
  if (all || date) {
    return date
  }

  return new Date().toISOString().slice(0, 10)
}
