import { FciOtrosDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'
import { normalizarSlugParaRuta } from '@/finanzas/compartido/utils/nombres.js'

function mapItemParaEndpoint(row) {
  return {
    fondo: row.fondo,
    tna: row.tna,
    tea: row.tea,
    tope: row.tope,
    fecha: row.fecha,
    condiciones: row.condiciones,
    condicionesCorto: row.condicionesCorto,
    plazoMinDias: row.plazoMinDias ?? null,
    plazoMaxDias: row.plazoMaxDias ?? null,
  }
}

function mapHistorialItem(row) {
  return {
    tna: row.tna,
    tea: row.tea,
    tope: row.tope,
    fecha: row.fecha,
    condiciones: row.condiciones,
    condicionesCorto: row.condicionesCorto,
    plazoMinDias: row.plazoMinDias ?? null,
    plazoMaxDias: row.plazoMaxDias ?? null,
  }
}

function historialCambio(item, prev) {
  return (
    item.tna !== prev.tna ||
    item.tea !== prev.tea ||
    item.tope !== prev.tope ||
    item.condiciones !== prev.condiciones ||
    item.condicionesCorto !== prev.condicionesCorto ||
    item.plazoMinDias !== prev.plazoMinDias ||
    item.plazoMaxDias !== prev.plazoMaxDias
  )
}

export async function guardarSerieOtros(items, url, authToken) {
  const db = new FciOtrosDatabaseService(url, authToken)

  try {
    await db.initialize()

    const timestamp = new Date().toISOString()
    const itemsToInsert = []

    for (const item of items) {
      const ultimo = await db.getLatestFciOtrosByFondo(item.fondo)

      const valoresCambiaron =
        ultimo &&
        (ultimo.tna !== item.tna ||
          ultimo.tea !== item.tea ||
          ultimo.tope !== item.tope ||
          ultimo.condiciones !== (item.condiciones || null) ||
          ultimo.condicionesCorto !== (item.condicionesCorto || null) ||
          ultimo.plazoMinDias !== (item.plazoMinDias ?? null) ||
          ultimo.plazoMaxDias !== (item.plazoMaxDias ?? null))

      if (!ultimo || (valoresCambiaron && item.fecha >= ultimo.fecha)) {
        itemsToInsert.push(item)
        await db.insertFciOtros(
          item.fondo,
          item.tna,
          item.tea,
          item.tope || null,
          item.fecha,
          item.condiciones || null,
          item.condicionesCorto || null,
          item.plazoMinDias ?? null,
          item.plazoMaxDias ?? null,
          timestamp,
        )
      }
    }

    if (itemsToInsert.length > 0) {
      console.log(
        `Guardados ${itemsToInsert.length} nuevos valores de FCI otros`,
      )
    }

    await generarEndpointsEstaticos(db)
  } finally {
    db.close()
  }
}

async function generarEndpointsEstaticos(db) {
  const todosLosDatos = await db.getAllLatestFciOtros()
  const resultado = todosLosDatos.map(mapItemParaEndpoint)

  escribirRuta('/finanzas/fci/otros/ultimo', resultado)

  const penultimo = await db.getPenultimoFciOtros()
  const penultimoResultado = penultimo.map(mapItemParaEndpoint)

  if (penultimoResultado.length > 0) {
    escribirRuta('/finanzas/fci/otros/penultimo', penultimoResultado)
  }

  const fondos = await db.getAllFondos()

  for (const fondo of fondos) {
    const historial = await db.getHistorialPorFondo(fondo)
    const historialResultado = historial
      .map(mapHistorialItem)
      .filter((item, index, arr) => {
        if (index === 0) return true

        return historialCambio(item, arr[index - 1])
      })

    escribirRuta(
      `/finanzas/fci/otros/${normalizarSlugParaRuta(fondo)}`,
      historialResultado,
    )
  }
}
