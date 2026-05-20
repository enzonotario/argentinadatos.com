import { CriptopesosDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'

export async function guardarCriptopesos(items, url, authToken) {
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
