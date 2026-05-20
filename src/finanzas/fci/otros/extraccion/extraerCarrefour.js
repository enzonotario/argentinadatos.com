import { format } from 'date-fns'
import { leerRuta } from '@/utils/rutas.js'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { extraerCarrefourCondiciones } from './extraerCarrefourCondiciones.js'
import {
  calcularTeaDesdeTna,
  porcentajeADecimal,
} from '@/finanzas/compartido/utils/tasas.js'

export async function extraerCarrefourCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerCarrefour',
    tipo: 'cuentaRemunerada',
  })

  try {
    const respuesta = await fetch(import.meta.env.VITE_CARREFOUR_API_URL, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!respuesta.ok) {
      logMensaje(log, 'Respuesta no OK de Carrefour API', {
        status: respuesta.status,
        statusText: respuesta.statusText,
      })
      throw new Error(
        `Error en la solicitud a Carrefour API: ${respuesta.status} ${respuesta.statusText}`,
      )
    }

    const datos = await respuesta.json()
    const tna = porcentajeADecimal(datos?.data?.tna)

    if (tna === null) {
      logMensaje(log, 'Datos inválidos de Carrefour API', { datos })
      throw new Error('Error en la respuesta de Carrefour API')
    }

    const condicionesData = await extraerCarrefourCondiciones()
    let condiciones = null
    let condicionesCorto = null

    if (condicionesData?.topeRecargaMensual) {
      const topeFormateado = condicionesData.topeRecargaMensual.toLocaleString(
        'es-AR',
        {
          style: 'currency',
          currency: 'ARS',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        },
      )

      condiciones = `Permite ingresar ${topeFormateado} / mes`
      condicionesCorto = `Permite ingresar ${topeFormateado} / mes`
    } else {
      const historial = leerRuta('finanzas/fci/otros/carrefour-banco')

      if (Array.isArray(historial)) {
        const ultimaConCondiciones = [...historial]
          .reverse()
          .find(item => item.condiciones !== null)

        if (ultimaConCondiciones) {
          condiciones = ultimaConCondiciones.condiciones
          condicionesCorto = ultimaConCondiciones.condicionesCorto
        }
      }
    }

    return {
      fondo: 'CARREFOUR BANCO',
      tna,
      tea: calcularTeaDesdeTna(tna),
      tope: datos.data.tope || null,
      fecha: format(new Date(), 'yyyy-MM-dd'),
      condiciones,
      condicionesCorto,
    }
  } catch (error) {
    logError(log, error)
    return []
  }
}
