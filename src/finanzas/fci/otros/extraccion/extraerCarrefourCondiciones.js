import { logGrupo, logError, logMensaje } from '@/log.js'
import { scrapearConIA } from '@/finanzas/compartido/extraccion/ia.js'

export async function extraerCarrefourCondiciones() {
  const log = logGrupo({
    fuente: 'extraerCarrefourCondiciones',
    tipo: 'cuentaRemunerada',
  })

  try {
    const datos = await scrapearConIA(log, {
      url: 'https://www.bancodeserviciosfinancieros.com.ar/costos-prepaga/',
      prompt:
        'Extrae el tope de recarga mensual de la cuenta digital Carrefour. Busca el valor en la sección "CUENTA DIGITAL MI CARREFOUR" bajo "Tope mensual de recarga". Retorna el número sin símbolos ni puntos, solo el valor numérico.',
      schema: {
        topeRecargaMensual: { type: 'number' },
      },
      required: ['topeRecargaMensual'],
    })

    if (!datos || typeof datos.topeRecargaMensual !== 'number') {
      logMensaje(
        log,
        'Datos inválidos de Carrefour Condiciones: falta topeRecargaMensual',
        { datos },
      )
      return null
    }

    logMensaje(log, 'Extracción de Carrefour Condiciones exitosa', {
      topeRecargaMensual: datos.topeRecargaMensual,
    })

    return { topeRecargaMensual: datos.topeRecargaMensual }
  } catch (error) {
    logError(log, error)
    logMensaje(log, 'Error al extraer condiciones de Carrefour', {
      errorMessage: error.message,
    })
    return null
  }
}
