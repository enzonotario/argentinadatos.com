import { format, parse } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { construirRequestConProxy } from '@/utils/proxy.js'
import {
  calcularTeaDesdeTna,
  porcentajeADecimal,
} from '@/finanzas/compartido/utils/tasas.js'

export async function extraerGlobal66CuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerGlobal66',
    tipo: 'cuentaRemunerada',
  })

  try {
    const apiUrl = import.meta.env.VITE_GLOBAL66_API_URL
    const apiKey = import.meta.env.VITE_GLOBAL66_API_KEY

    if (!apiUrl || !apiKey) {
      logMensaje(log, 'Faltan VITE_GLOBAL66_API_URL o VITE_GLOBAL66_API_KEY')
      return []
    }

    const request = construirRequestConProxy(apiUrl, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (request.usaProxy) {
      logMensaje(log, 'Consultando Global66 via proxy')
    }

    const respuesta = await fetch(request.url, request.opciones)

    if (!respuesta.ok) {
      logMensaje(log, 'Respuesta no OK de Global66 API', {
        status: respuesta.status,
        statusText: respuesta.statusText,
      })
      throw new Error(
        `Error en la solicitud a Global66 API: ${respuesta.status} ${respuesta.statusText}`,
      )
    }

    const datos = await respuesta.json()
    const tna = porcentajeADecimal(datos?.tna)

    if (tna === null) {
      logMensaje(log, 'Datos inválidos de Global66 API', { datos })
      throw new Error('Error en la respuesta de Global66 API')
    }

    let fecha = format(new Date(), 'yyyy-MM-dd')

    if (datos.fecha) {
      try {
        fecha = format(
          parse(datos.fecha, 'dd-MM-yyyy', new Date()),
          'yyyy-MM-dd',
        )
      } catch {
        // Si falla el parseo de fecha, se mantiene la fecha actual.
      }
    }

    return {
      nombre: 'GLOBAL66',
      fondo: 'Compass Liquidez - Clase A',
      tipo: 'billetera',
      tna,
      tea: calcularTeaDesdeTna(tna),
      tope: datos.tope || null,
      fecha,
      condiciones: datos.condiciones || null,
      condicionesCorto: datos.condicionesCorto || null,
    }
  } catch (error) {
    logError(log, error)
    return []
  }
}
