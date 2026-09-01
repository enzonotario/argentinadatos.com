type DatabaseMode = 'hybrid' | 'pocketbase-only'

const LEGACY_MODE_ALIASES: Record<string, DatabaseMode> = {
  'sqlite-only': 'pocketbase-only',
  'pocketbase-only': 'pocketbase-only',
  hybrid: 'hybrid',
}

function resolveDatabaseMode(): DatabaseMode {
  const raw = process.env.VITE_DATABASE_MODE || 'pocketbase-only'
  return LEGACY_MODE_ALIASES[raw] ?? 'pocketbase-only'
}

export function shouldWriteJsonFiles(): boolean {
  return resolveDatabaseMode() === 'hybrid'
}

export function shouldWriteFromDatabase(): boolean {
  const mode = resolveDatabaseMode()
  return mode === 'pocketbase-only' || mode === 'hybrid'
}
