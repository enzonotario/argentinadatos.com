import { RemDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'

export async function guardarRem(items, url, authToken) {
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

  const endpoints = ['/finanzas/rem/ultimo']
  const legacyEndpoints = ['/rems/ultimo']

  escribirRuta('/finanzas/rem/ultimo', ultimo)
  escribirRuta('/rems/ultimo', ultimo)

  for (const informe of informes.keys()) {
    const [anio, mes] = informe.split('-')
    const endpoint = `/finanzas/rem/${anio}/${mes}`
    const legacyEndpoint = `/rems/${anio}/${mes}`

    endpoints.push(endpoint)
    legacyEndpoints.push(legacyEndpoint)

    escribirRuta(endpoint, informes.get(informe))
    escribirRuta(legacyEndpoint, informes.get(informe))
  }

  escribirRuta('/finanzas/rem', endpoints)
  escribirRuta('/rems', legacyEndpoints)

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
