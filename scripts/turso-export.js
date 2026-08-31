import { writeFile } from 'node:fs/promises'
import { createClient } from '@libsql/client'
import { config } from 'dotenv'

config()

const TABLES = [
  'criptopesos',
  'cuentas_remuneradas_usd',
  'letras',
  'rem_expectativas',
  'fci_otros',
  'fci_variables',
  'diputados',
  'diputados_actas',
  'senadores',
  'senado_actas',
]

/**
 * Exporta tablas Turso a un JSON para importar en PocketBase.
 * Uso: node scripts/turso-export.js [salida.json]
 *
 * Requiere VITE_TURSO_DATABASE_URL + VITE_TURSO_AUTH_TOKEN.
 */
async function main() {
  const url = process.env.VITE_TURSO_DATABASE_URL
  const authToken = process.env.VITE_TURSO_AUTH_TOKEN
  if (!url || !authToken) {
    throw new Error('Missing VITE_TURSO_DATABASE_URL or VITE_TURSO_AUTH_TOKEN')
  }

  const outPath = process.argv[2] || 'turso-export.json'
  const db = createClient({ url, authToken })
  const payload = {
    exportedAt: new Date().toISOString(),
    tables: {},
  }

  try {
    for (const table of TABLES) {
      try {
        const result = await db.execute(`SELECT * FROM ${table}`)
        payload.tables[table] = result.rows.map(row => ({ ...row }))
        console.log(`[export] ${table}: ${result.rows.length} rows`)
      } catch (err) {
        console.warn(`[export] skip ${table}: ${err.message}`)
        payload.tables[table] = []
      }
    }
  } finally {
    db.close()
  }

  await writeFile(outPath, JSON.stringify(payload, null, 2))
  console.log(`[export] wrote ${outPath}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
