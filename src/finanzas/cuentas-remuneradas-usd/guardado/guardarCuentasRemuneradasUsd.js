import { CuentasRemuneradasUsdDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'

const TURSO_DATABASE_URL = import.meta.env.VITE_TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN

export async function guardarCuentasRemuneradasUsd(
  items,
  url = TURSO_DATABASE_URL,
  authToken = TURSO_AUTH_TOKEN,
) {
  const db = new CuentasRemuneradasUsdDatabaseService(url, authToken)

  try {
    await db.initialize()

    const timestamp = new Date().toISOString()
    const itemsToInsert = []

    for (const item of items) {
      const ultimo = await db.getLatestCuentaRemuneradaByEntity(item.entidad)

      if (!ultimo || ultimo.tasa !== item.tasa || ultimo.tope !== item.tope) {
        itemsToInsert.push(item)
        await db.insertCuentaRemuneradaUsd(
          item.entidad,
          item.tasa,
          item.tope || null,
          timestamp,
        )
      }
    }

    if (itemsToInsert.length > 0) {
      console.log(
        `Guardados ${itemsToInsert.length} nuevos valores de cuentas remuneradas USD`,
      )
    }

    await generarEndpointEstatico(db)
  } finally {
    db.close()
  }
}

async function generarEndpointEstatico(db) {
  const todosLosDatos = await db.getAllLatestCuentasRemuneradasUsd()

  const resultado = todosLosDatos.map(row => ({
    entidad: row.entidad,
    tasa: row.tasa,
    tope: row.tope,
  }))

  escribirRuta('/finanzas/cuentas-remuneradas-usd', resultado)
}
