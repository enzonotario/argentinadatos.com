import { collect } from 'collect.js'
import { format, parseISO } from 'date-fns'
import { guardarCafci } from '@/finanzas/fci/cafci/guardado/guardarCafci.js'
import { escribirRuta } from '@/utils/rutas.js'
import { extraerCafci } from '@/finanzas/fci/cafci/extraccion/extraerCafci.js'
import {
  extraerSerieOtros,
  extraerSerieOtrosIA,
} from '@/finanzas/fci/otros/extraccion/extraerSerieOtros.js'
import { extraerSerieVariables } from '@/finanzas/fci/variables/extraccion/extraerSerieVariables.js'
import { extraerUalaCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerUala.js'
import { guardarSerieOtros } from '@/finanzas/fci/otros/guardado/guardarSerieOtros.js'
import { FciOtrosDatabaseService } from '@/finanzas/fci/otros/database/service.js'
import { logGrupo, logError, logMensaje } from '@/log.js'

export default async function () {
  await extraerSeriesDesdeCafci()
  await extraerSerieOtros()
  await extraerSerieVariables()
  await extraerSerieOtrosIA()
  await extraerUala()
}

async function extraerUala() {
  const log = logGrupo({
    comando: 'fci',
    fuente: 'extraerUala',
  })

  const valoresExtraidos = (await extraerUalaCuentaRemunerada()).filter(
    item => item.fondo,
  )

  if (valoresExtraidos.length === 0) {
    logMensaje(log, 'No se obtuvieron valores Ualá')
    return
  }

  const db = new FciOtrosDatabaseService()

  try {
    await db.initialize()

    for (const valorExtraido of valoresExtraidos) {
      const ultimo = await db.getLatestFciOtrosByFondo(valorExtraido.fondo)

      if (ultimo) {
        if (
          (!valorExtraido.condiciones || valorExtraido.condiciones === '') &&
          ultimo.condiciones !== null &&
          ultimo.condiciones !== undefined
        ) {
          valorExtraido.condiciones = ultimo.condiciones
        }

        if (
          (!valorExtraido.condicionesCorto ||
            valorExtraido.condicionesCorto === '') &&
          ultimo.condicionesCorto !== null &&
          ultimo.condicionesCorto !== undefined
        ) {
          valorExtraido.condicionesCorto = ultimo.condicionesCorto
        }
      }
    }

    const fechaActual = format(new Date(), 'yyyy-MM-dd')
    const valoresConFecha = valoresExtraidos.map(item => ({
      ...item,
      fecha: item.fecha || fechaActual,
    }))

    await guardarSerieOtros(valoresConFecha)
  } finally {
    db.close()
  }
}

async function extraerSeriesDesdeCafci() {
  const series = [
    'mercadoDinero',
    'rentaVariable',
    'rentaFija',
    'rentaMixta',
    'retornoTotal',
  ]

  await Promise.all(series.map(serie => ejecutarSerie(serie)))
}

async function ejecutarSerie(serie) {
  const log = logGrupo({
    comando: 'fci',
    fuente: 'cafci',
    serie,
  })

  const items = await extraerCafci(serie)

  if (items.length === 0) {
    logError(log, `No se encontraron datos para ${serie}`)
    return
  }

  const itemsConFecha = items.filter(item => item.fecha)
  const guardados = []

  collect(itemsConFecha)
    .groupBy('fecha')
    .map((itemsFecha, fecha) => {
      guardados.push(guardarCafci(serie, itemsFecha.toArray(), parseISO(fecha)))
    })

  await Promise.all(guardados)

  const penultimo = []
  const ultimo = []

  collect(items)
    .groupBy('fondo')
    .map(valores => {
      const itemsFondo = collect(valores)
        .sortByDesc('fecha')
        .unique('fecha')
        .toArray()

      if (itemsFondo.length > 1) {
        penultimo.push(itemsFondo[1])
        ultimo.push(itemsFondo[0])
      } else if (itemsFondo.length === 1) {
        ultimo.push(itemsFondo[0])
      }
    })

  if (penultimo.length !== 0) {
    await escribirRuta(`/finanzas/fci/${serie}/penultimo`, penultimo)
  }

  if (ultimo.length !== 0) {
    await escribirRuta(`/finanzas/fci/${serie}/ultimo`, ultimo)
  }

  return true
}
