import { format } from 'date-fns'
import {
  extraerSerieOtros,
  extraerSerieOtrosIA,
} from '@/finanzas/fci/otros/extraccion/extraerSerieOtros.js'
import { extraerUalaCuentaRemunerada } from '@/finanzas/fci/otros/extraccion/extraerUala.js'
import { guardarSerieOtros } from '@/finanzas/fci/otros/guardado/guardarSerieOtros.js'
import { FciOtrosDatabaseService } from '@/finanzas/fci/otros/database/service.js'
import { logGrupo, logMensaje } from '@/log.js'

export default async function () {
  await extraerSerieOtros()
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
