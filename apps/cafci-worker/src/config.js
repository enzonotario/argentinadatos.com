import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(currentDirectory, '../../..')
const defaultDatabasePath = resolve(
  repositoryRoot,
  'storage',
  'cafci-worker',
  'db.sqlite',
)

function resolveFromRepositoryRoot(pathname) {
  if (!pathname) {
    return defaultDatabasePath
  }

  return resolve(repositoryRoot, pathname)
}

function readEnv(...names) {
  for (const name of names) {
    const value = process.env[name]

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim()
    }
  }

  return undefined
}

function readNumberEnv(names, fallback) {
  const value = readEnv(...names)
  const parsed = Number(value)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getDatabasePath() {
  const configuredPath = readEnv(
    'CAFCI_WORKER_DB_PATH',
    'FCI_FUND_DETAILS_DB_PATH',
  )

  return configuredPath
    ? resolveFromRepositoryRoot(configuredPath)
    : defaultDatabasePath
}

export function getPollIntervalMs() {
  return readNumberEnv(
    ['CAFCI_WORKER_POLL_INTERVAL_MS', 'FCI_FUND_DETAILS_POLL_INTERVAL_MS'],
    30 * 60 * 1000,
  )
}

export function getR2UploadIntervalMs() {
  return readNumberEnv(
    ['CAFCI_WORKER_R2_UPLOAD_INTERVAL_MS'],
    6 * 60 * 60 * 1000,
  )
}

/** Máximo de fondos a enriquecer con composición CNV por ciclo (0 = sin límite). */
export function getComposicionEnrichLimit() {
  return readNumberEnv(['CAFCI_WORKER_COMPOSICION_LIMIT'], 120)
}

export function isComposicionEnrichEnabled() {
  const value = readEnv('CAFCI_WORKER_COMPOSICION_ENABLED')
  if (value == null) {
    return true
  }

  return !['0', 'false', 'no', 'off'].includes(value.toLowerCase())
}

export function getR2Config() {
  const accountId = readEnv('CAFCI_WORKER_R2_ACCOUNT_ID')
  const accessKeyId = readEnv('CAFCI_WORKER_R2_ACCESS_KEY_ID')
  const secretAccessKey = readEnv('CAFCI_WORKER_R2_SECRET_ACCESS_KEY')
  const bucket = readEnv('CAFCI_WORKER_R2_BUCKET')
  const objectKey =
    readEnv('CAFCI_WORKER_R2_OBJECT_KEY') || 'cafci-worker/db.sqlite'
  const endpoint =
    readEnv('CAFCI_WORKER_R2_ENDPOINT') ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined)

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    objectKey,
    endpoint,
  }
}

export function isR2BackupConfigured() {
  const config = getR2Config()

  return Boolean(
    config.endpoint &&
    config.accessKeyId &&
    config.secretAccessKey &&
    config.bucket,
  )
}
