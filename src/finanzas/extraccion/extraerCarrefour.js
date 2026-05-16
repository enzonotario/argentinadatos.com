import { escribirRuta, leerRuta } from '@/utils/rutas.js'
import { format } from 'date-fns'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { extraerCarrefourCondiciones } from './extraerCarrefourCondiciones.js'

export async function extraerCarrefourCuentaRemunerada() {
  const log = logGrupo({
    fuente: 'extraerCarrefour',
    tipo: 'cuentaRemunerada',
  })

  try {
    const respuesta = await fetch(import.meta.env.VITE_CARREFOUR_API_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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

    if (
      !datos ||
      datos.data === null ||
      datos.data.tna === null ||
      datos.data.tna === undefined
    ) {
      logMensaje(log, 'Datos inválidos de Carrefour API', {
        datos,
      })
      throw new Error('Error en la respuesta de Carrefour API')
    }

    const valor = Number(datos.data.tna) / 100

    if (valor === null || isNaN(valor)) {
      throw new Error('No se encontró el valor de la cuenta remunerada')
    }

    const tna = Number(valor.toFixed(4))

    const tea = Number(((1 + tna / 365) ** 365 - 1).toFixed(4))

    const condicionesData = await extraerCarrefourCondiciones()

    var condiciones = null
    var condicionesCorto = null

    if (condicionesData && condicionesData.topeRecargaMensual) {
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
          .find(e => e.condiciones !== null)

        if (ultimaConCondiciones) {
          condiciones = ultimaConCondiciones.condiciones
          condicionesCorto = ultimaConCondiciones.condicionesCorto
        }
      }
    }

    return {
      fondo: 'CARREFOUR BANCO',
      tna,
      tea,
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
