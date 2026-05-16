import { FciOtrosDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'

const TURSO_DATABASE_URL = import.meta.env.VITE_TURSO_DATABASE_URL
const TURSO_AUTH_TOKEN = import.meta.env.VITE_TURSO_AUTH_TOKEN

function normalizarNombreFondo(fondo) {
  return fondo
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export async function guardarSerieOtros(
  items,
  url = TURSO_DATABASE_URL,
  authToken = TURSO_AUTH_TOKEN,
) {
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
          ultimo.condicionesCorto !== (item.condicionesCorto || null))

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

  const resultado = todosLosDatos.map(row => ({
    fondo: row.fondo,
    tna: row.tna,
    tea: row.tea,
    tope: row.tope,
    fecha: row.fecha,
    condiciones: row.condiciones,
    condicionesCorto: row.condicionesCorto,
  }))

  escribirRuta('/finanzas/fci/otros/ultimo', resultado)

  const penultimo = await db.getPenultimoFciOtros()
  const penultimoResultado = penultimo.map(row => ({
    fondo: row.fondo,
    tna: row.tna,
    tea: row.tea,
    tope: row.tope,
    fecha: row.fecha,
    condiciones: row.condiciones,
    condicionesCorto: row.condicionesCorto,
  }))

  if (penultimoResultado.length > 0) {
    escribirRuta('/finanzas/fci/otros/penultimo', penultimoResultado)
  }

  const fondos = await db.getAllFondos()

  for (const fondo of fondos) {
    const historial = await db.getHistorialPorFondo(fondo)
    const historialResultado = historial
      .map(row => ({
        tna: row.tna,
        tea: row.tea,
        tope: row.tope,
        fecha: row.fecha,
        condiciones: row.condiciones,
        condicionesCorto: row.condicionesCorto,
      }))
      .filter((item, index, arr) => {
        if (index === 0) return true

        const prev = arr[index - 1]

        return (
          item.tna !== prev.tna ||
          item.tea !== prev.tea ||
          item.tope !== prev.tope ||
          item.condiciones !== prev.condiciones ||
          item.condicionesCorto !== prev.condicionesCorto
        )
      })

    const nombreNormalizado = normalizarNombreFondo(fondo)

    escribirRuta(`/finanzas/fci/otros/${nombreNormalizado}`, historialResultado)
  }
}
