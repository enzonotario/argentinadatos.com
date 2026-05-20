import { FciVariablesDatabaseService } from '../database/service.js'
import { escribirRuta } from '@/utils/rutas.js'
import { normalizarSlugParaRuta } from '@/finanzas/compartido/utils/nombres.js'

export async function guardarSerieVariables(items, url, authToken) {
  const db = new FciVariablesDatabaseService(url, authToken)

  try {
    await db.initialize()

    const timestamp = new Date().toISOString()
    const itemsToInsert = []

    for (const item of items) {
      const ultimo = await db.getLatestFciVariablesByNombre(item.nombre)

      const valoresCambiaron =
        ultimo &&
        (ultimo.tna !== item.tna ||
          ultimo.fondo !== (item.fondo || null) ||
          ultimo.tipo !== (item.tipo || null) ||
          ultimo.tea !== item.tea ||
          ultimo.tope !== item.tope ||
          ultimo.condiciones !== (item.condiciones || null) ||
          ultimo.condicionesCorto !== (item.condicionesCorto || null))

      if (!ultimo || (valoresCambiaron && item.fecha >= ultimo.fecha)) {
        itemsToInsert.push(item)
        await db.insertFciVariables(
          item.nombre,
          item.fondo,
          item.tipo || null,
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
        `Guardados ${itemsToInsert.length} nuevos valores de FCI variables`,
      )
    }

    await generarEndpointsEstaticos(db)
  } finally {
    db.close()
  }
}

async function generarEndpointsEstaticos(db) {
  const todosLosDatos = await db.getAllLatestFciVariables()
  const resultado = todosLosDatos.map(row => ({
    nombre: row.nombre,
    fondo: row.fondo,
    tipo: row.tipo,
    tna: row.tna,
    tea: row.tea,
    tope: row.tope,
    fecha: row.fecha,
    condiciones: row.condiciones,
    condicionesCorto: row.condicionesCorto,
  }))

  escribirRuta('/finanzas/fci/variables/ultimo', resultado)

  const penultimo = await db.getPenultimoFciVariables()
  const penultimoResultado = penultimo.map(row => ({
    nombre: row.nombre,
    fondo: row.fondo,
    tipo: row.tipo,
    tna: row.tna,
    tea: row.tea,
    tope: row.tope,
    fecha: row.fecha,
    condiciones: row.condiciones,
    condicionesCorto: row.condicionesCorto,
  }))

  if (penultimoResultado.length > 0) {
    escribirRuta('/finanzas/fci/variables/penultimo', penultimoResultado)
  }

  const nombres = await db.getAllNombres()

  for (const nombre of nombres) {
    const historial = await db.getHistorialPorNombre(nombre)
    const historialResultado = historial
      .map(row => ({
        nombre: row.nombre,
        fondo: row.fondo,
        tna: row.tna,
        tipo: row.tipo,
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
          item.nombre !== prev.nombre ||
          item.fondo !== prev.fondo ||
          item.tna !== prev.tna ||
          item.tipo !== prev.tipo ||
          item.tea !== prev.tea ||
          item.tope !== prev.tope ||
          item.condiciones !== prev.condiciones ||
          item.condicionesCorto !== prev.condicionesCorto
        )
      })

    escribirRuta(
      `/finanzas/fci/variables/${normalizarSlugParaRuta(nombre)}`,
      historialResultado,
    )
  }
}
