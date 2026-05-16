import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { createServer } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

const module = process.argv[2]
const command = process.argv[3]

if (!module) {
  console.error('Uso: pnpm run migrate <modulo> <comando>')
  console.error('Ejemplo: pnpm run migrate criptopesos up')
  console.error('Comandos: up, down, status')
  process.exit(1)
}

if (!command) {
  console.error('Uso: pnpm run migrate <modulo> <comando>')
  console.error('Comandos: up, down, status')
  process.exit(1)
}

const modulePath = `src/finanzas/${module}/database/migrations/cli.js`
const fullPath = join(rootDir, modulePath)

if (!existsSync(fullPath)) {
  console.error(`Error: No se encontró el módulo de migraciones para "${module}"`)
  console.error(`Ruta esperada: ${modulePath}`)
  process.exit(1)
}

try {
  const server = await createServer({
    root: rootDir,
    plugins: [],
    server: { middlewareMode: true },
    appType: 'custom'
  })

  const { main } = await server.ssrLoadModule(fullPath)

  const originalArgv = process.argv
  process.argv = ['node', 'cli.js', command, ...process.argv.slice(4)]

  await main()

  process.argv = originalArgv
  await server.close()
} catch (error) {
  console.error('Error:', error)
  process.exit(1)
}

