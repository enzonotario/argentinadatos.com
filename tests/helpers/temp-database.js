import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Ruta temporal para tests de guardado.
 * `file:` se resuelve a PocketBase in-memory (@argentinadatos/pocketbase).
 * Los tests de CAFCI/FCI fondos usan la ruta sin el prefijo `file:` con better-sqlite3.
 */
export function crearBaseDeDatosTemporal(scope = 'test') {
  const directorio = mkdtempSync(join(tmpdir(), 'esjs-argentina-datos-api-'))
  const ruta = join(directorio, `${scope}.sqlite`)

  return {
    url: `file:${ruta}`,
    authToken: undefined,
    cleanup() {
      rmSync(directorio, {
        recursive: true,
        force: true,
      })
    },
  }
}
