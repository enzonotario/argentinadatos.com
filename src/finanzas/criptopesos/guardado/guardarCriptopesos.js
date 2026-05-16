import { CriptopesosDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'

const TURSO_DATABASE_URL = import.meta.env.VITE_TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN

export async function guardarCriptopesos(
  items,
  url = TURSO_DATABASE_URL,
  authToken = TURSO_AUTH_TOKEN,
) {
  const db = new CriptopesosDatabaseService(url, authToken)

  try {
    await db.initialize()

    const timestamp = new Date().toISOString()
    const itemsToInsert = []

    for (const item of items) {
      const ultimo = await db.getLatestCriptopesoByEntity(
        item.token,
        item.entidad,
      )

      if (!ultimo || ultimo.tna !== item.tna) {
        itemsToInsert.push(item)
        await db.insertCriptopeso(item.token, item.entidad, item.tna, timestamp)
      }
    }

    if (itemsToInsert.length > 0) {
      console.log(
        `Guardados ${itemsToInsert.length} nuevos valores de criptopesos`,
      )
    }

    await generarEndpointEstatico(db)
  } finally {
    db.close()
  }
}

async function generarEndpointEstatico(db) {
  const todosLosDatos = await db.getAllLatestCriptopesos()

  const resultado = todosLosDatos.map(row => ({
    token: row.token,
    entidad: row.entidad,
    tna: row.tna,
  }))

  escribirRuta('/finanzas/criptopesos', resultado)
}
