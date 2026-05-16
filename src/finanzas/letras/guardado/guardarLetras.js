import { LetrasDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'

const TURSO_DATABASE_URL = import.meta.env.VITE_TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN

export async function guardarLetras(
  items,
  url = TURSO_DATABASE_URL,
  authToken = TURSO_AUTH_TOKEN,
) {
  const db = new LetrasDatabaseService(url, authToken)

  try {
    await db.initialize()

    for (const item of items) {
      await db.upsertLetra(
        item.ticker,
        item.fechaEmision,
        item.fechaVencimiento,
        item.tem,
        item.vpv,
      )
    }

    const tickers = items.map(item => item.ticker)
    await db.deleteLetrasExcept(tickers)

    await generarEndpointEstatico(db)
  } finally {
    db.close()
  }
}

async function generarEndpointEstatico(db) {
  const datos = await db.getAllLetras()
  escribirRuta('/finanzas/letras', datos)
}
