import { format } from 'date-fns'
import { guardarSerieVariables } from '@/finanzas/fci/variables/guardado/guardarSerieVariables.js'
import { logGrupo, logMensaje, logError } from '@/log.js'

const log = logGrupo({
  comando: 'finanzas.fci.variables',
})

export async function extraerSerieVariables() {
  try {
    const extractores = []
    const resultados = await Promise.all(extractores.map((extraer) => extraer()))

    const valoresExtraidos = resultados.filter((item) => item.nombre)
    const sinNombre = resultados.length - valoresExtraidos.length

    if (sinNombre > 0) {
      logMensaje(
        log,
        'Se descartaron extracciones sin nombre en FCI variables',
        {
          totalFuentes: resultados.length,
          descartados: sinNombre,
        },
      )
    }

    if (valoresExtraidos.length === 0) {
      logMensaje(log, 'No se obtuvieron valores válidos en FCI variables')
      return
    }

    log.info('[/v1/finanzas/fci/variables]: Valores extraídos', valoresExtraidos)
    console.log(
      '[/v1/finanzas/fci/variables]: Valores extraídos',
      valoresExtraidos,
    )

    const fechaActual = format(new Date(), 'yyyy-MM-dd')
    const valoresConFecha = valoresExtraidos.map((item) => ({
      ...item,
      fecha: item.fecha || fechaActual,
    }))

    await guardarSerieVariables(valoresConFecha)
  } catch (error) {
    logError(log, error)
  }
}
