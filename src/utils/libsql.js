import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createClient } from '@libsql/client'

function leerEnv(nombre) {
  return import.meta.env?.[nombre] ?? process.env[nombre]
}

export function esSqliteLocal(url) {
  return typeof url === 'string' && url.startsWith('file:')
}

export function obtenerDirectorioSqliteLocal() {
  const directorioConfigurado = leerEnv('VITE_SQLITE_DB_DIR')

  const directorio = directorioConfigurado
    ? resolve(directorioConfigurado)
    : resolve(process.cwd(), '.local', 'sqlite')

  mkdirSync(directorio, {
    recursive: true,
  })

  return directorio
}

export function obtenerUrlSqliteLocal(scope = 'database') {
  return `file:${join(obtenerDirectorioSqliteLocal(), `${scope}.sqlite`)}`
}

export function resolverConexionLibsql({
  scope = 'database',
  url,
  authToken,
} = {}) {
  const urlDesdeEnv = leerEnv('VITE_TURSO_DATABASE_URL')
  const authTokenDesdeEnv = leerEnv('VITE_TURSO_AUTH_TOKEN')

  if (url) {
    return {
      url,
      authToken: esSqliteLocal(url)
        ? undefined
        : (authToken ?? authTokenDesdeEnv),
    }
  }

  if (urlDesdeEnv && authTokenDesdeEnv) {
    return {
      url: urlDesdeEnv,
      authToken: authTokenDesdeEnv,
    }
  }

  return {
    url: obtenerUrlSqliteLocal(scope),
    authToken: undefined,
  }
}

export function crearClienteLibsql(config = {}) {
  const conexion = resolverConexionLibsql(config)

  return createClient({
    url: conexion.url,
    ...(conexion.authToken
      ? {
          authToken: conexion.authToken,
        }
      : {}),
  })
}
