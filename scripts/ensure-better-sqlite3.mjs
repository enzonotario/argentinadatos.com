import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadBetterSqlite3() {
  return require(resolve(repositoryRoot, 'node_modules/better-sqlite3'))
}

function isAbiMismatch(error) {
  return (
    error instanceof Error &&
    (error.message.includes('NODE_MODULE_VERSION') ||
      error.message.includes('was compiled against a different Node.js version'))
  )
}

function rebuildBetterSqlite3() {
  console.log(
    `[ensure-better-sqlite3] Rebuilding for Node ${process.version} (ABI ${process.versions.modules})`,
  )

  execSync('pnpm rebuild better-sqlite3', {
    cwd: repositoryRoot,
    stdio: 'inherit',
  })
}

export function ensureBetterSqlite3() {
  try {
    loadBetterSqlite3()
  } catch (error) {
    if (!isAbiMismatch(error)) {
      throw error
    }

    rebuildBetterSqlite3()
    loadBetterSqlite3()
  }
}

const isMainModule =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  ensureBetterSqlite3()
}
