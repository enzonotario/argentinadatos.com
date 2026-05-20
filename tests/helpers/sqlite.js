import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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
