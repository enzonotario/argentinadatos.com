import { RemDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'

const TURSO_DATABASE_URL =
  import.meta.env.VITE_TURSO_DATABASE_URL || 'file:database.sqlite'

const TURSO_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN

export async function guardarRem(
  items,
  url = TURSO_DATABASE_URL,
  authToken = TURSO_AUTH_TOKEN,
) {
  const db = new RemDatabaseService(url, authToken)

  try {
    await db.initialize()

    await db.deleteAllExpectativas()

    for (const item of items) {
      await db.upsertExpectativa(item)
    }

    return await generarEndpointsEstaticos(db)
  } finally {
    db.close()
  }
}

async function generarEndpointsEstaticos(db) {
  const todos = await db.getAllExpectativas()
  const ultimo = await db.getLatestExpectativas()
  const informes = agruparPorInforme(todos)

  const endpoints = ['/rems/ultimo']

  escribirRuta('/rems/ultimo', ultimo)

  for (const informe of informes.keys()) {
    const [anio, mes] = informe.split('-')
    const endpoint = `/rems/${anio}/${mes}`
    endpoints.push(endpoint)
    escribirRuta(endpoint, informes.get(informe))
  }

  escribirRuta('/rems', endpoints)

  return endpoints
}

function agruparPorInforme(items) {
  const grupos = new Map()

  for (const item of items) {
    if (!grupos.has(item.informe)) grupos.set(item.informe, [])

    grupos.get(item.informe).push(item)
  }

  return grupos
}
