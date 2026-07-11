import axios from 'axios'
import { load } from 'cheerio'
import { logGrupo, logError, logMensaje } from '@/log.js'
import { construirRequestConProxy } from '@/utils/proxy.js'

const log = logGrupo({
  fuente: 'extraerPlazoFijoUvaPagoPeriodico',
  tipo: 'extraccion',
})

const URL_BNA_PLAZO_FIJO_ELECTRONICO =
  'https://www.bna.com.ar/Personas/PlazoFijoElectronico'

export async function extraerPlazoFijoUvaPagoPeriodico() {
  try {
    const proveedores = [...(await extraerBna())]

    return proveedores
  } catch (error) {
    logError(log, error)
    return []
  }
}

async function extraerBna() {
  try {
    const request = construirRequestConProxy(URL_BNA_PLAZO_FIJO_ELECTRONICO)

    if (request.usaProxy) {
      logMensaje(log, 'Consultando BNA via proxy')
    }

    const respuesta = await axios.get(request.url, {
      headers: request.opciones.headers,
    })

    const $ = load(respuesta.data)

    const tabla = $(
      'table.plazoTable:contains("PF TRAD.EN UVA CON PAGO INTERÉS SUBPERÍODOS DE 30 DÍAS")',
    )

    if (!tabla.length) {
      return []
    }

    const filas = tabla.find('tbody tr')
    const tasas = []

    filas.each((i, fila) => {
      const celdas = $(fila).find('td')

      if (celdas.length === 3) {
        const rangoTexto = $(celdas[0]).text().trim()

        const plazos = parsearRangoPlazoDias(rangoTexto)

        if (!plazos) {
          return
        }

        const tna = parsearPorcentaje($(celdas[1]).text())
        const tea = parsearPorcentaje($(celdas[2]).text())

        tasas.push({
          nombre: 'PF TRAD.EN UVA CON PAGO INTERÉS SUBPERÍODOS DE 30 DÍAS',
          plazoMinDias: plazos.plazoMinDias,
          plazoMaxDias: plazos.plazoMaxDias,
          tna,
          tea,
        })
      }
    })

    return [
      {
        id: 'bna',
        entidad: 'Banco de la Nación Argentina',
        logo: 'https://www.bna.com.ar/Content/img/logo-bna.png',
        tasas,
      },
    ]
  } catch (error) {
    logError(log, error)
    return []
  }
}

function parsearRangoPlazoDias(texto) {
  if (!texto) return null

  const coincidencia = texto.match(/De\s+(\d+)\s+a\s+(\d+)/i)

  if (!coincidencia) return null

  const plazoMinDias = Number.parseInt(coincidencia[1], 10)
  const plazoMaxDias = Number.parseInt(coincidencia[2], 10)

  if (Number.isNaN(plazoMinDias) || Number.isNaN(plazoMaxDias)) return null

  return {
    plazoMinDias,
    plazoMaxDias,
  }
}

function parsearPorcentaje(valor) {
  if (!valor) return null

  const limpio = valor.replace('%', '').replace(',', '.').trim()

  const numero = Number.parseFloat(limpio)

  return Number.isNaN(numero) ? null : numero / 100
}
