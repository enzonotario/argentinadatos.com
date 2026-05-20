import { LetrasDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'

export async function guardarLetras(items, url, authToken) {
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
